; ============================================================
; VGON PONTO Agent — Instalador Windows (Inno Setup 6)
; Gera VGON-PONTO-Agent-Setup-<versao>.exe
; Estrutura instalada:
;   C:\Program Files\VGON\Ponto Agent\runtime\node.exe   (runtime embutido)
;   C:\Program Files\VGON\Ponto Agent\app\               (dist + node_modules)
;   C:\Program Files\VGON\Ponto Agent\service\           (WinSW + xml)
;   C:\ProgramData\VGON\Ponto Agent\                     (config, dados, logs)
; Serviço Windows: VgonPontoAgent (auto-start, restart em falha)
; ============================================================

#define MyAppName "VGON PONTO Agent"
#ifndef MyAppVersion
  #define MyAppVersion "1.0.2"
#endif
#define MyAppPublisher "Vgon Solucoes em Informatica"
#define MyAppServiceName "VgonPontoAgent"
#define MyAppURL "https://vgonponto-web.54myeq.easypanel.host"

[Setup]
AppId={{7F3A9C2E-4B1D-4E8A-9C5F-2D6B8A1E3F47}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\VGON\Ponto Agent
DefaultGroupName=VGON PONTO
OutputDir=Output
OutputBaseFilename=VGON-PONTO-Agent-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
UninstallDisplayName={#MyAppName}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoDescription={#MyAppName} — Setup
DisableProgramGroupPage=yes

[Files]
; Runtime Node.js embutido
Source: "staging\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs
; Aplicação compilada + dependências de produção
Source: "staging\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs
; Windows Service Wrapper (WinSW) renomeado + config
Source: "staging\service\VgonPontoAgentService.exe"; DestDir: "{app}\service"; Flags: ignoreversion
Source: "VgonPontoAgentService.xml"; DestDir: "{app}\service"; Flags: ignoreversion
; Config inicial — NUNCA sobrescreve em atualizações (preserva configuração do cliente)
Source: "initial-config.json"; DestDir: "{commonappdata}\VGON\Ponto Agent"; DestName: "agent.config.json"; Flags: onlyifdoesntexist uninsneveruninstall

[Dirs]
; Pastas de dados/logs do Agent (preservadas na desinstalação)
Name: "{commonappdata}\VGON\Ponto Agent\logs"
Name: "{commonappdata}\VGON\Ponto Agent\data"

[Icons]
Name: "{group}\VGON PONTO Agent — Configuracoes"; Filename: "{app}\runtime\node.exe"; Parameters: """{app}\app\dist\ui-launcher.js"""; WorkingDir: "{app}\app"; Comment: "Abrir a tela VGON PONTO Agent — Configurações"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Restringe a pasta de dados a Administradores + SYSTEM (protege credenciais e token da UI)
Filename: "icacls.exe"; Parameters: """{commonappdata}\VGON\Ponto Agent"" /inheritance:r /grant:r ""*S-1-5-32-544:(OI)(CI)F"" ""*S-1-5-18:(OI)(CI)F"""; Flags: runhidden waituntilterminated; StatusMsg: "Aplicando permissões de segurança…"
; Registra e inicia o serviço Windows
Filename: "{app}\service\VgonPontoAgentService.exe"; Parameters: "install"; Check: not ServiceExists; Flags: runhidden waituntilterminated; StatusMsg: "Registrando o serviço {#MyAppServiceName}…"
Filename: "{app}\service\VgonPontoAgentService.exe"; Parameters: "start"; Flags: runhidden waituntilterminated; StatusMsg: "Iniciando o serviço {#MyAppServiceName}…"

[UninstallRun]
Filename: "{app}\service\VgonPontoAgentService.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopVgonSvc"
Filename: "{app}\service\VgonPontoAgentService.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveVgonSvc"

[Code]
function ServiceExists(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('sc.exe', 'query {#MyAppServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure StopService();
var
  ResultCode: Integer;
begin
  if ServiceExists() then
  begin
    Exec('sc.exe', 'stop {#MyAppServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(2500);
  end;
end;

{ Atualização: para o serviço ANTES de sobrescrever os arquivos }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    StopService();
end;

{ Desinstalação: garante parada antes de remover arquivos }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    StopService();
end;
