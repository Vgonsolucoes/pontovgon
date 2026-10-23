# Publicação do VGON PONTO Agent 1.0.4

Artefato: `public/downloads/VGON-PONTO-Agent-Setup-1.0.4.exe`. A página `/integracoes/agents` lê o manifesto e disponibiliza o arquivo, versão, tamanho e SHA-256. O executável é distribuído pelo próprio site, sem depender de um link de release externo.

## Envio de cadastros e fotos na versão 1.0.4

Implementa `SYNC_EMPLOYEE`, com verificação de série física, busca por matrícula, atualização do usuário existente, cadastro da foto e confirmação explícita do resultado. A confirmação é persistida no SQLite para sobreviver à perda de rede ou reinício. O ciclo de comandos impede execuções sobrepostas. O smoke test também carrega o runtime e o módulo de cadastro facial. O fluxo completo está em [sincronizacao-facial.md](sincronizacao-facial.md).

## Correção do teste iDFace na versão 1.0.3

A consulta `system_information.fcgi` envia `{}` em vez de `null` e lê os campos oficiais `serial` e `version`. Respostas HTML ou JSON sem informações do equipamento não são consideradas online. A API da tela retorna `ok: false` quando a consulta falha e rejeita configurações inválidas, sem testar silenciosamente os valores antigos.

Diagnóstico no equipamento físico com firmware 6.18.6: login HTTP 200; consulta com `null` HTTP 400 (`object expected`); consulta com `{}` HTTP 200. O cliente compilado corrigido confirmou `online: true`, firmware e presença do número de série usando a configuração existente, sem alterar dados do equipamento.

O status do serviço reconhece a saída do Windows em português. Falhas de conexão ou timeout aparecem no console. Ao parar o próprio serviço, a tela desabilita as ações e orienta reabrir o atalho no menu Iniciar para iniciar novamente. Testes cobrem o contrato HTTP, respostas inválidas, status localizado, validação de configuração e falhas de conexão na tela.

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

O pacote não possui assinatura Authenticode da VGON. A conferência SHA-256 verifica a integridade do download. Os testes desta publicação incluem login e consulta de status no iDFace físico; instalação/desinstalação em máquina limpa e sincronização completa de marcações permanecem na homologação operacional.

Fontes dos componentes: https://nodejs.org/dist/ e https://github.com/winsw/winsw/releases . Compilador utilizado no build local: Inno Setup 6.2.2, obtido de https://github.com/jrsoftware/issrc/releases/tag/is-6_2_2 e com assinatura do fornecedor verificada.
