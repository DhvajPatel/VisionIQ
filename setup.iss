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

; Path to electron-builder's unpacked output (change if different)
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
; Require admin — needed to write to Program Files
PrivilegesRequired=admin
OutputDir=installer
OutputBaseFilename=VisionIQ_Setup_{#MyAppVersion}
SetupIconFile=frontend\public\icon.png
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120
; Show license if it exists
LicenseFile=LICENSE.txt
; Minimum Windows 10
MinVersion=10.0
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";    Description: "{cm:CreateDesktopIcon}";     GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; ── All Electron app files (from electron-builder unpacked output) ──
Source: "{#UnpackedDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── App icon separately (for shortcuts) ──
Source: "frontend\public\icon.png"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu
Name: "{group}\{#MyAppName}";            Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.png"
Name: "{group}\Uninstall {#MyAppName}";  Filename: "{uninstallexe}"

; Desktop shortcut (optional)
Name: "{autodesktop}\{#MyAppName}";      Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.png"; Tasks: desktopicon

; Quick Launch (Windows XP/Vista only)
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Launch app after install
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up model cache and history database on uninstall
Type: filesandordirs; Name: "{app}\resources\backend\_internal\.hf_cache"
Type: filesandordirs; Name: "{app}\resources\backend\history.db"

[Code]
// Show a message if Visual C++ Redistributable might be needed
procedure InitializeWizard();
begin
  // Nothing extra needed — Electron ships its own runtime
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Warn if running 32-bit Windows
  if not Is64BitInstallMode then begin
    MsgBox('VisionIQ requires a 64-bit version of Windows.', mbError, MB_OK);
    Result := False;
  end;
end;
