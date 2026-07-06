# Production Desktop Agent (.NET)

Windows tray application that signs ETA invoices with a real **eSeal USB Token** (ePass2003 / WatchData). Same HTTP contract as the Node mock agent (`127.0.0.1:8765`).

## Prerequisites

| Requirement | Source |
|-------------|--------|
| .NET 8 SDK | https://dotnet.microsoft.com/download |
| ePass2003 or WatchData driver | [Egypt Trust drivers](https://egypttrust.com/en/other-drivers/) |
| eSeal USB Token + PIN | Issued after ETA e-invoicing registration |
| Itida Web Sign (optional) | For browser ↔ token middleware in some setups |

## Build & run (mock mode — no token)

```powershell
cd desktop-agent/dotnet
dotnet restore
dotnet run --project src/EtaSigner.Tray
```

Tray icon appears; API listens on `http://127.0.0.1:8765`. Mock mode is the default (`ETA_SIGNER_MOCK` unset).

## Build for production

```powershell
dotnet publish src/EtaSigner.Tray -c Release -r win-x64 --self-contained -o ./publish
```

Set before launch:

```powershell
$env:ETA_SIGNER_MOCK = "false"
$env:PKCS11_LIB = "C:\Windows\System32\eps2003csp11.dll"   # ePass2003 — path varies
```

---

## 1. PKCS#11 + ePass2003

### Install drivers

1. Download **ePass2003 Driver Setup** from Egypt Trust.
2. Plug in the USB Token; Windows should detect it.
3. Install the eSeal certificate using the PIN from your registration pack.
4. Note the PKCS#11 DLL path (common: `eps2003csp11.dll` in `System32` or the driver install folder).

### Wire `Pkcs11CadesSigner`

Uncomment NuGet packages in `EtaSigner.Core.csproj`:

```xml
<PackageReference Include="Pkcs11Interop" Version="5.1.2" />
<PackageReference Include="BouncyCastle.Cryptography" Version="2.4.0" />
```

Implement `Pkcs11CadesSigner.SignAsync`:

```
1. Load PKCS11_LIB
2. GetSlotList → open session → Login(PIN)
3. Find certificate where subject contains taxpayer RIN
4. Verify request.IssuerRin matches certificate
5. C_SignInit + C_Sign on SHA-256 hash of canonical bytes
6. Build CAdES-BES CMS (detached) → Base64
7. Return { signatureType: "I", value: "..." }
```

Reference: [ETA Signature Creation](https://sdk.invoicing.eta.gov.eg/signature-creation/)

---

## 2. CAdES-BES (real signature)

ETA expects **CAdES-BES** (CMS/PKCS#7, OID 1.2.840.113549.1.7.2) with:

- Signed attributes: `contentType`, `messageDigest`, `signingCertificateV2`
- **Detached** content (hash only — not the full JSON embedded)
- Base64-encoded binary ASN.1 in `signatures[].value`

### Signing steps (match backend + agent)

```
unsigned JSON (no signatures field)
    → ETA canonicalization (EtaCanonicalizer)
    → SHA-256 (UTF-8 bytes)
    → Sign hash with eSeal private key (PKCS#11)
    → Wrap in CAdES-BES CMS
    → Base64 → attach to document.signatures[]
    → POST /api/v1/documentsubmissions
```

Use the official ETA SDK sample code (C#) as the source of truth for CMS structure — our `MockCadesSigner` is **not** accepted by real ETA.

---

## 3. MSI installer

Recommended stack: **WiX Toolset v4** or **Inno Setup** bundling:

```
EtaSigner.msi
├── EtaSigner.exe          (self-contained publish)
├── ePass2003 driver       (or link to Egypt Trust download)
└── Start menu + Run at login (optional)
```

### WiX outline

```xml
<!-- installer/EtaSigner.wxs — scaffold only -->
<Package Name="ETA Signer" Manufacturer="YourCo" Version="1.0.0.0">
  <MajorUpgrade DowngradeErrorMessage="!" />
  <Feature Id="Main">
    <ComponentGroupRef Id="EtaSignerFiles" />
  </Feature>
</Package>
```

### Post-install checklist

- [ ] Agent auto-starts at login (Task Scheduler or registry Run key)
- [ ] Firewall rule **not** needed (localhost only)
- [ ] User installs Egypt Trust driver if not bundled
- [ ] First-run balloon: "Connect USB Token"

### Code signing

Sign `EtaSigner.exe` and the MSI with an Authenticode certificate so SmartScreen does not block installs.

---

## Project layout

```
dotnet/
├── EtaSigner.sln
└── src/
    ├── EtaSigner.Core/
    │   ├── Canonicalization/EtaCanonicalizer.cs
    │   └── Signing/
    │       ├── ICadesSigner.cs
    │       ├── MockCadesSigner.cs      ← dev (done)
    │       └── Pkcs11CadesSigner.cs    ← production (TODO)
    └── EtaSigner.Tray/
        ├── Program.cs                  ← entry + env config
        ├── AgentWebHost.cs             ← Kestrel /health /sign
        ├── TrayApplicationContext.cs   ← system tray
        └── PinPromptForm.cs            ← native PIN UI
```

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ETA_SIGNER_MOCK` | (mock on) | Set `false` for PKCS#11 signer |
| `ETA_SIGNER_MOCK_RIN` | `123456789` | Mock certificate RIN |
| `AGENT_PORT` | `8765` | HTTP port |
| `AGENT_HOST` | `127.0.0.1` | Bind address |
| `AGENT_CORS_ORIGINS` | localhost:3000, … | SaaS origins |
| `PKCS11_LIB` | — | Path to PKCS#11 DLL (production) |

---

## Verification

1. Run .NET agent (mock) → `GET http://127.0.0.1:8765/health`
2. Open SaaS draft invoice → green **eSeal token connected**
3. **Sign & submit to ETA** → backend mock accepts signed payload
4. After real PKCS#11: submit to ETA **preprod** with test credentials

---

## Remaining work

| Item | Status |
|------|--------|
| Tray app + localhost API | ✅ |
| ETA canonicalizer (C#) | ✅ |
| Mock signer | ✅ |
| PIN prompt UI | ✅ |
| PKCS#11 probe + RSA sign | ✅ code ready — test with ePass2003 |
| CAdES-BES CMS | ✅ initial builder — validate on ETA preprod |
| Inno Setup installer | ✅ `installer/EtaSigner.iss` |

### Build MSI (Inno Setup 6+)

```powershell
dotnet publish src/EtaSigner.Tray -c Release -r win-x64 --self-contained -o publish
# Open installer/EtaSigner.iss in Inno Setup Compiler → Compile
```
