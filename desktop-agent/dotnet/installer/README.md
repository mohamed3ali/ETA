# MSI Installer (scaffold)

Package the published `EtaSigner.exe` for end-user distribution.

## Recommended tools

- **WiX Toolset v4** — enterprise MSI, supports upgrades
- **Inno Setup** — simpler single-file installer

## What to bundle

1. `dotnet publish -c Release -r win-x64 --self-contained` output
2. Shortcut → Startup (optional auto-run)
3. Link or silent-install for **ePass2003 driver** (Egypt Trust)

## Do not bundle

- User PIN or certificate private keys
- ETA Client Secret (stays in SaaS settings)

See [`../PRODUCTION.md`](../PRODUCTION.md) § MSI installer for the full checklist.
