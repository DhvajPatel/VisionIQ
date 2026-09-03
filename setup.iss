; setup.iss — Inno Setup 6 script for VisionIQ
;
; Prerequisites:
;   1. Run build.bat first to produce:
;      - backend\dist\visioniq_server\  (PyInstaller output)
;      - frontend\dist\                 (Vite output)
;      - dist-electron\win-unpacked\    (electron-builder unpacked output)
;
;   2. Install Inno Setup 6: https://jrsoftware.org/isinfo.php
;   3. Open this file in Inno Setup Compiler and click Build → Compile
;   OR run from command line:
;      "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" setup.iss
;
; Output: installer\VisionIQ_Setup_1.0.0.exe

#define MyAppName      "VisionIQ"
#define MyAppVersion   "1.0.0"
#define MyAppPublisher "VisionIQ"
#define MyAppURL       "https://vision-iq-one.vercel.app"
#define MyAppExeName   "VisionIQ.exe"
#define MyAppId        "{{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"

; Path to electron-builder's unpacked output
#define UnpackedDir    "dist-electron\win-unpacked"

[Setup]
AppId={{#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
PrivilegesRequired=admin
OutputDir=installer
OutputBaseFilename=VisionIQ_Setup_{#MyAppVersion}
; MUST be .ico for Inno Setup
SetupIconFile=frontend\public\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120
LicenseFile=LICENSE.txt
MinVersion=10.0
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";     Description: "{cm:CreateDesktopIcon}";      GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}";  GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; All Electron app files
Source: "{#UnpackedDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; App icon (for shortcuts) — .ico required for Windows shortcuts
Source: "frontend\public\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu
Name: "{group}\{#MyAppName}";           Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; Desktop shortcut (optional, user-selected)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

; Quick Launch (legacy Windows)
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Launch app after install finishes
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up generated files on uninstall
Type: filesandordirs; Name: "{app}\resources\backend\_internal\.hf_cache"
Type: filesandordirs; Name: "{app}\resources\backend\history.db"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  if not Is64BitInstallMode then begin
    MsgBox('VisionIQ requires a 64-bit version of Windows 10 or later.', mbError, MB_OK);
    Result := False;
  end;
end;
