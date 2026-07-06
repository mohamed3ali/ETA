; ETA Signer — Inno Setup installer script (scaffold)
; Build the app first:
;   dotnet publish ..\src\EtaSigner.Tray -c Release -r win-x64 --self-contained -o ..\publish
; Compile this script with Inno Setup 6+: https://jrsoftware.org/isinfo.php

#define AppName "ETA Signer"
#define AppVersion "1.0.0"
#define PublishDir "..\publish"
#define ExeName "EtaSigner.exe"

[Setup]
AppId={{B8F3A2E1-4C5D-6E7F-8A9B-0C1D2E3F4A5B}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\ETA Signer
DefaultGroupName={#AppName}
OutputDir=output
OutputBaseFilename=EtaSigner-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#ExeName}"
Name: "{userstartup}\{#AppName}"; Filename: "{app}\{#ExeName}"; Tasks: startup

[Tasks]
Name: "startup"; Description: "Start ETA Signer when Windows starts"; GroupDescription: "Options:"

[Run]
Filename: "{app}\{#ExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { Remind operator to install Egypt Trust ePass2003 driver if not present }
  end;
end;
