# EtaSigner — .NET Tray App

Windows system-tray helper for **real eSeal signing**. Drop-in replacement for the Node mock agent — same API on `http://127.0.0.1:8765`.

## Quick start

```powershell
# Requires .NET 8 SDK
dotnet run --project src/EtaSigner.Tray
```

## Docs

- [`PRODUCTION.md`](PRODUCTION.md) — PKCS#11, CAdES-BES, MSI, drivers
- [`../README.md`](../README.md) — HTTP API contract (shared with Node mock)

## Status

| Component | Ready |
|-----------|-------|
| Tray + Kestrel `/health` `/sign` | ✅ |
| PIN prompt (WinForms) | ✅ |
| ETA canonicalizer (C#) | ✅ |
| Mock signer (dev) | ✅ |
| PKCS#11 + CAdES-BES | ⏳ see `Pkcs11CadesSigner.cs` |
