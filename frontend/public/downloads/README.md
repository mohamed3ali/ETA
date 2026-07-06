# ETA Signer download

The SaaS app serves the Windows desktop agent as a **single-file executable**
from `/download/eta-signer`. Users click it once, run it, and the app
self-installs to `%LOCALAPPDATA%\EtaSigner` plus a Run-on-login registry key —
extension-style one-click setup.

Rebuild the executable after agent changes:

```powershell
cd desktop-agent
npm run package:web
```

This publishes the .NET tray app as a single-file self-contained `EtaSigner.exe`
(~85 MB) and copies it here. Override the public URL in production with
`NEXT_PUBLIC_ETA_AGENT_DOWNLOAD_URL` (e.g. a CDN).
