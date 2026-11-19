Unicode true
!include "MUI2.nsh"
!include "x64.nsh"

!define APP "Fazenda de Celulares"
!define APP_EXE "Fazenda-de-Celulares-${APP_VERSION}.exe"
!define PRODUCT_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MauseHotFazenda"
Name "${APP}"
OutFile "dist\Fazenda-de-Celulares-${APP_VERSION}-Setup-Windows-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\MauseHot\Fazenda de Celulares"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon ".build\fazenda.ico"
UninstallIcon ".build\fazenda.ico"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1046 "ProductName" "${APP}"
VIAddVersionKey /LANG=1046 "CompanyName" "MauseHot"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador da Fazenda de Celulares"
VIAddVersionKey /LANG=1046 "FileVersion" "${APP_VERSION}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\app\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Fazenda de Celulares"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Este instalador requer Windows de 64 bits." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

Section
  SetShellVarContext current
  SetOutPath "$INSTDIR\app"
  File /r "dist\Fazenda-de-Celulares-${APP_VERSION}\*.*"
  File "COPYING"
  File "THIRD-PARTY-NOTICES.md"
  CreateShortcut "$SMPROGRAMS\Fazenda de Celulares.lnk" "$INSTDIR\app\${APP_EXE}"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "${PRODUCT_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${PRODUCT_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${PRODUCT_KEY}" "Publisher" "MauseHot"
  WriteRegStr HKCU "${PRODUCT_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_KEY}" "DisplayIcon" "$INSTDIR\app\${APP_EXE}"
  WriteRegStr HKCU "${PRODUCT_KEY}" "UninstallString" '$\"$INSTDIR\Desinstalar.exe$\"'
  WriteRegDWORD HKCU "${PRODUCT_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$SMPROGRAMS\Fazenda de Celulares.lnk"
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${PRODUCT_KEY}"
SectionEnd
