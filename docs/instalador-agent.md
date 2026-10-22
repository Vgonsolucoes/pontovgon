# Publicação do VGON PONTO Agent 1.0.2

Artefato: `public/downloads/VGON-PONTO-Agent-Setup-1.0.2.exe`. A página `/integracoes/agents` lê o manifesto e disponibiliza o arquivo, versão, tamanho e SHA-256. O executável é distribuído pelo próprio site, sem depender de um link de release externo.

## Correção da tela local na versão 1.0.2

O atalho autentica o navegador com o token local e redireciona para o endereço sem token, criando uma sessão HttpOnly/SameSite=Strict. Assim, `http://127.0.0.1:3737` pode ser reaberto nessa sessão. Um navegador ainda não autorizado continua bloqueado. A sessão deve ser autorizada novamente pelo atalho após reiniciar o serviço ou trocar de navegador.

A criação do token agora é atômica entre processos, sem sobrescrever o arquivo existente. O launcher aguarda a porta estar pronta, trata início concorrente e impede repetição infinita da elevação de administrador. Requisições com Host ou Origin fora da origem local são recusadas.

Testes novos exercitam oito processos concorrentes e o fluxo HTTP real em porta efêmera: acesso anônimo bloqueado, autorização pelo atalho, cookie de sessão, reabertura sem token, API autenticada e bloqueio de token/cookie inválidos e origem externa. Esses testes usam somente pastas temporárias; não modificam o serviço instalado.

Pacote Windows x64: Node.js 22.23.4, dependências de produção travadas em `agent/package-lock.json`, SQLite nativo e WinSW 2.12.0. A versão exibida no heartbeat e no User-Agent vem do package.json.

## Gerar uma nova versão

1. Atualizar a versão de `agent/package.json` e o lockfile.
2. Em Windows x64, com Node.js e npm no PATH e Inno Setup 6 instalado, executar `agent/installer/build-installer.ps1 -IsccPath <caminho-do-ISCC.exe>`.
3. O script executa os testes, compila o Agent, instala as dependências de produção e verifica o hash do runtime oficial. O smoke test verifica SQLite em memória e carrega os módulos compilados com o Node embutido antes de gerar o instalador.
4. Versionar o executável, `agent-manifest.json` e `SHA256SUMS.txt` de `public/downloads/`. O manifesto usa UTF-8 sem BOM, inclusive no Windows PowerShell.
5. Executar typecheck, lint e `npm test` da aplicação web antes da publicação. O teste de download confere versão, cabeçalho PE, tamanho e hash do executável.

## Instalação

Executar o instalador como administrador. Depois abrir **VGON PONTO Agent — Configurações** no menu Iniciar e informar o token real, endereço do iDFace e credenciais. O pacote não contém credenciais de produção. A configuração existente é preservada em atualizações; o instalador evita registrar novamente um serviço já instalado.

O pacote não possui assinatura Authenticode da VGON. A conferência SHA-256 verifica a integridade do download. Os testes desta publicação não incluem instalação/desinstalação em máquina limpa nem comunicação com o iDFace físico; esses passos permanecem na homologação operacional.

Fontes dos componentes: https://nodejs.org/dist/ e https://github.com/winsw/winsw/releases . Compilador utilizado no build local: Inno Setup 6.2.2, obtido de https://github.com/jrsoftware/issrc/releases/tag/is-6_2_2 e com assinatura do fornecedor verificada.
