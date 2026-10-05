# VGON PONTO - Product Requirements Document

## Overview
- **Summary**: Sistema web profissional de controle de jornada de trabalho integrado ao equipamento Control iD iDFace via agente local, destinado à empresa Vgon Soluções em Informática. Inclui cadastro de funcionários, gestão de jornadas, cálculo automático de horas, banco de horas, férias, ajustes, aprovações, espelho de ponto, dashboard administrativo, portal do funcionário, RBAC, auditoria completa e relatórios.
- **Purpose**: Automatizar e centralizar o controle de ponto com identificação facial, garantindo integridade dos registros, funcionamento offline, sincronização confiável e conformidade com requisitos trabalhistas.
- **Target Users**: Master, Administradores/RH, Gestores, Funcionários da Vgon Soluções em Informática.

## Goals
- Cadastro completo de funcionários, setores, cargos, jornadas, escalas e feriados.
- Registro e processamento de marcações de ponto com múltiplas origens (IDFACE, MANUAL, ADMINISTRATIVO, WEB).
- Integração via MODELO B (Agente Local) com Control iD iDFace, com coleta offline, fila local SQLite, retry exponencial, prevenção de duplicidade e heartbeat.
- Motor de cálculo parametrizável: horas previstas, realizadas, atraso, saída antecipada, extras, débito, saldo diário e banco de horas. Suporta múltiplas entradas/saídas no dia.
- Ajustes de ponto com fluxo de aprovação, sem sobrescrever registros originais.
- Dashboard com situação diária e indicadores.
- Espelho de ponto, banco de horas, férias, afastamentos, atestados.
- Portal individual do funcionário com isolamento de dados.
- RBAC com perfis MASTER, ADMIN, GESTOR e FUNCIONÁRIO.
- Auditoria completa de operações críticas.
- Relatórios com exportação PDF/Excel.
- Deploy via Docker no EasyPanel, PostgreSQL, Next.js App Router, TypeScript, Prisma, Tailwind, shadcn/ui.

## Non-Goals
- Não implementar conexão direta entre servidor cloud (EasyPanel) e IP privado do iDFace.
- Não inventar endpoints da Control iD; usar documentação oficial.
- Não armazenar templates biométricos ou imagens faciais no servidor; biometria permanece no iDFace.
- Não implementar sincronização biométrica bidirecional sem suporte oficial.
- Não gerar atualizações automáticas do Agente sem autorização administrativa.
- Não apagar logicamente marcações originais do equipamento.
- Nesta entrega inicial, não incluir aplicativo mobile nativo; deixar preparada a arquitetura.

## Background & Context
- Equipamento inicial: Control iD iDFace, serial `0M0200/01017B`, firmware `6.18.6`, MAC `FC:52:CE:8A:B9:91`, Device ID `4408801109279099`.
- Arquitetura obrigatória MODELO B: iDFace → (LAN) → VGON PONTO Agent (Windows, SQLite, Windows Service) → (HTTPS/Internet) → API VGON PONTO → PostgreSQL.
- Comandos administrativos usam fila de comandos (Command Queue) polled pelo Agente, nunca conexão iniciada de fora para a LAN.
- Credenciais e configurações sensíveis ficam em `.env` e tabelas específicas, nunca no código-fonte nem no histórico de commits.
- Timezone: `America/Sao_Paulo`.

## Functional Requirements
- **FR-01 Autenticação e RBAC**: Autenticação segura (senha hasheada, sessões), perfis MASTER / ADMIN / RH / GESTOR / FUNCIONÁRIO com permissões granulares. Funcionário só vê seus próprios dados.
- **FR-02 Usuários**: CRUD de usuários com vínculo opcional a funcionário, status ativo/inativo, atribuição de perfil.
- **FR-03 Setores**: CRUD de setores (ex.: Administrativo, Comercial, Técnico, Financeiro, Diretoria) com ativar/desativar (soft delete).
- **FR-04 Cargos**: CRUD de cargos vinculáveis aos funcionários, com ativar/desativar.
- **FR-05 Funcionários**: Cadastro completo com nome, foto, CPF, matrícula, e-mail, telefone, cargo, setor, admissão, jornada, gestor, status (Ativo/Férias/Afastado/Desligado), ID no iDFace, observações. Soft delete; nunca apagar com histórico de ponto.
- **FR-06 Jornadas**: Cadastro parametrizável com horários por dia, entrada/início/fim intervalo/saída, tolerância, carga diária/semanal, dias trabalhados, folgas; modelos 5x2, 6x1, 12x36, personalizada, horários diferentes por dia. Nenhuma regra trabalhista fixa em código.
- **FR-07 Escalas**: Vinculação de funcionários a jornadas, com data de início e possibilidade de escala rotativa (preparado).
- **FR-08 Feriados**: Cadastro de feriados nacionais/regionais/empresariais, usados no cálculo de ausência.
- **FR-09 Dispositivos**: Tabela `devices` + menu Configurações → Dispositivos; cadastro de múltiplos equipamentos (fabricante, modelo, serial, firmware, MAC, device_id, status, última comunicação). Credenciais armazenadas de forma segura.
- **FR-10 Agents**: Tabela `agents`; cadastro/registro de múltiplos Agentes Locais (agent_id, token, nome, computador, versão, SO, IP local, último heartbeat, status).
- **FR-11 Marcações**: `time_entries` com funcionário, ID externo, dispositivo, data, hora, timestamp, tipo, origem (IDFACE/MANUAL/ADMINISTRATIVO/WEB), identificador original do evento, data de importação, status, observação. Nenhuma exclusão definitiva de origem IDFACE. UNIQUE INDEX `(device_id, external_event_id)` para prevenir duplicidade.
- **FR-12 Motor de Cálculo**: Processa marcações do dia, suporta múltiplas entradas/saídas; calcula previsto, realizado, intervalo, atraso, saída antecipada, extras, débito, saldo diário, banco de horas. Respeita jornadas parametrizadas.
- **FR-13 Dias Trabalhados**: Persiste `work_days` com os resultados do cálculo diário para cada funcionário.
- **FR-14 Banco de Horas**: Tabela `hour_bank` com extrato (crédito/débito por data), saldo acumulado por funcionário; alterações administrativas auditadas.
- **FR-15 Ajustes de Ponto**: Funcionário solicita ajuste (data, horário, tipo, justificativa); status PENDENTE/APROVADO/REPROVADO; registra solicitante, aprovador, data, valor anterior/novo, justificativa. Nunca sobrescreve registro original; ajuste fica em camada separada.
- **FR-16 Férias e Afastamentos**: CRUD de férias, atestados, afastamentos, folgas, compensações, com períodos e tipos. Cálculo de ausência verifica antes de marcar falta.
- **FR-17 Dashboard**: Cards com funcionários ativos, trabalhando agora, ausentes, atrasados, em férias, horas extras, banco de horas, status iDFace, status Agent. Tabela "Situação de Hoje" com Entrada/Intervalo/Retorno/Saída/Trabalhado/Saldo/Situação e indicadores coloridos.
- **FR-18 Espelho de Ponto**: Filtros por funcionário, mês, ano, setor. Tabela diária e totais (trabalhadas, previstas, extras, negativas, banco, faltas, atrasos). Preparado para impressão e exportação.
- **FR-19 Portal do Funcionário**: Login individual; visualiza seu ponto do dia, marcações, horas, banco, jornada, espelho, solicitações, férias, afastamentos.
- **FR-20 Auditoria**: `audit_logs` registra usuário, data/hora, IP, ação, entidade, registro, valor anterior/novo para: criar/alterar/excluir lógico, ajuste, aprovação, reprovação, jornada, banco de horas, configurações, sincronizações.
- **FR-21 Relatórios**: Espelho de ponto, folha mensal, banco de horas, horas extras, atrasos, faltas, funcionários, marcações, ajustes, férias, afastamentos, auditoria. Filtros e exportação PDF/Excel.
- **FR-22 VGON PONTO Agent (Local)**: Aplicação Windows rodando como Windows Service, SQLite local, polling iDFace em intervalo configurável (padrão 30s), fila local de eventos, envio com retry exponencial, envio de heartbeat, status diferenciados (Agent ON/OFF, iDFace ON/OFF, Internet OFF, API OFF, sincronizando, erro auth), comandos polled via Command Queue.
- **FR-23 ControlIdService**: Camada de serviço dedicada à comunicação oficial com a API do iDFace, autenticação, consulta status/eventos/usuários, tratamento de erros, logs. Não inventar endpoints.
- **FR-24 Sincronização Incremental**: Mantém "último evento processado" no Agent e servidor, não reimporta histórico todo.
- **FR-25 Prevenção de Duplicidade**: Servidor aceita mesmo `(device_id, external_event_id)` apenas uma vez via UNIQUE.
- **FR-26 Funcionamento Offline**: Agent continua coletando do iDFace sem internet; enfileira no SQLite e sincroniza quando possível. Nenhuma marcação perdida por queda de internet.
- **FR-27 Heartbeat do Agent**: `POST /api/agents/heartbeat` com agent_id, computador, versão, IP local, SO, data/hora, status iDFace, última comunicação, última sincronização, eventos pendentes. Dashboard usa isso para indicar status.
- **FR-28 Command Queue (Sistema → iDFace via Agent)**: Tabela de comandos pendentes (PENDING/PROCESSING/SUCCESS/FAILED); Agent poll periodicamente, executa no iDFace, devolve resultado. Preparado para cadastrar/atualizar/ativar/desativar usuários no equipamento.
- **FR-29 Monitoramento Integrações**: Menu Integrações → Control iD, mostra status Agent/IDFace, versão, serial, firmware, device_id, eventos pendentes, última marcação, última sincronização, botão "Sincronizar agora" que enfileira comando.
- **FR-30 Segurança Agent ↔ API**: HTTPS, autenticação via Agent ID + Token dedicado, nunca credenciais do iDFace.
- **FR-31 Estrutura de Menu**: Dashboard / Ponto (Marcações, Espelho, Banco de Horas, Ajustes) / Funcionários (Funcionários, Setores, Cargos) / Jornadas (Jornadas, Escalas, Feriados) / Ausências (Férias, Afastamentos, Atestados) / Relatórios / Integrações (Control iD, Agent, Sincronizações, Logs) / Configurações (Empresa, Dispositivos, Usuários, Permissões, Auditoria).

## Non-Functional Requirements
- **NFR-01 Tecnologia**: Next.js (App Router), TypeScript, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui, Lucide Icons, API REST segura. Agente Local: Node.js + TypeScript compilado, SQLite, Windows Service compatível.
- **NFR-02 Segurança**: Hash Argon2id ou bcrypt para senhas, sessões seguras, validação de payload (Zod), rate limiting, proteção SQLi (Prisma parametrizado), XSS (React/Next sanitização), CSRF onde aplicável, auditoria obrigatória em operações críticas.
- **NFR-03 Integridade de Dados**: UNIQUE INDEXs adequados, FKs, constraints, soft deletes via `deletedAt` onde aplicável, timezone `America/Sao_Paulo`, dados sensíveis nunca em logs.
- **NFR-04 Persistência Offline no Agent**: SQLite com eventos pendentes/enviados, último evento, última sincronização, tentativas e erros. Nenhuma perda de batidas por indisponibilidade de rede/API.
- **NFR-05 Resiliência Sincronização**: Retry exponencial no envio, polling configurável, idempotência no servidor.
- **NFR-06 Qualidade de Código**: Limpo, organizado, escalável, production-ready. Estrutura por módulos (app, server/services, server/lib, etc.).
- **NFR-07 Responsividade**: UI profissional desktop/tablet/smartphone, identidade visual corporativa da Vgon.
- **NFR-08 Configuração**: `.env` e `.env.example`; nenhuma credencial hardcoded. Configurações do Agent em arquivo ou registro, com assistente de setup inicial.
- **NFR-09 Deploy**: Dockerfile(s) para web, arquivo `docker-compose` opcional, preparado para EasyPanel; migrations Prisma versionadas.
- **NFR-10 Observabilidade**: Logs estruturados do Agent e da API; tabelas `device_sync_logs`, `agent_heartbeats`, `audit_logs`.
- **NFR-11 Escalabilidade**: Sem dependências rígidas de 1 dispositivo/1 agent; múltiplos devices/agents preparados.

## Constraints
- **Technical**: 
  - Arquitetura MODELO B obrigatória; nunca EasyPanel → IP privado do iDFace diretamente.
  - Prisma + PostgreSQL como fonte única de verdade.
  - Sem endpoints inventados da Control iD; `ControlIdService` segue doc oficial.
  - Sincronização bidirecional restrita a operações oficialmente suportadas; biometria só no iDFace.
- **Business**:
  - Nunca apagar definitivamente marcação de origem IDFACE.
  - Nunca sobrescrever marcação original sem registro de ajuste separado e auditado.
  - Funcionário não visualiza dados de outro funcionário.
  - HTTPS obrigatório em toda comunicação externa (Agent ↔ API).
- **Dependencies**:
  - Documentação oficial Control iD para firmware 6.18.6 do iDFace.
  - Docker, EasyPanel, PostgreSQL, GitHub Actions (opcional), Node LTS.

## Assumptions
- O iDFace expõe uma API HTTP documentada com autenticação; `ControlIdService` a usará.
- Eventos do equipamento possuem identificador único (ou campo data+hora+usuário+dispositivo) suficiente para prevenção de duplicidade.
- Windows Service do Agent pode ser implementado com `node-windows` ou similar e empacotado em setup `.exe` futuro.
- Deploy no EasyPanel via imagem Docker; Prisma migrations rodam no startup ou job separado.
- Identidade visual corporativa da Vgon será usada (cores, logo) na UI; se não fornecida, usaremos paleta azul/verde profissional padrão.

## Acceptance Criteria

### AC-01: Projeto inicial scaffolded com Next.js + TypeScript + Prisma + Tailwind + shadcn/ui
- **Type**: `rule`
- **Given**: Repositório vazio
- **When**: Executar `npm install` e `npm run dev`
- **Then**: Aplicação web inicia em `http://localhost:3000` sem erros, mostra página inicial com identidade VGON PONTO e layout base (sidebar/topbar)
- **Pass Condition**: Build de desenvolvimento sobe sem erros fatais; `npm run build` completa sem erros.
- **Evidence**: Saída do terminal + screenshot da home.

### AC-02: Schema Prisma com tabelas mínimas e FKs/índices/soft-delete
- **Type**: `rule`
- **Given**: Arquivo `prisma/schema.prisma`
- **When**: Executar `npx prisma validate`
- **Then**: Todas as tabelas mínimas existem (users, employees, departments, positions, work_schedules, work_schedule_days, devices, agents, time_entries, time_entry_adjustments, time_entry_requests, work_days, hour_bank, vacations, leaves, holidays, audit_logs, device_sync_logs, agent_heartbeats, commands, device_users) com PK, FKs, campos `createdAt/updatedAt`, `deletedAt` onde aplicável, UNIQUE em `(device_id, external_event_id)` em `time_entries`
- **Pass Condition**: `prisma validate` retorna válido e o schema contém as entidades e constraints acima.
- **Evidence**: `prisma validate` + diff do schema.

### AC-03: Autenticação + RBAC com 4 perfis e isolamento do portal funcionário
- **Type**: `rule`
- **Given**: Usuários dos perfis MASTER, ADMIN, GESTOR, FUNCIONÁRIO existem
- **When**: Funcionário logado acessa endpoint/rota de espelho de outro funcionário por ID ou query param
- **Then**: Acesso negado; só vê seus dados; Admin/RH/Master conseguem ver dados conforme permissão
- **Pass Condition**: Testes de permissão em endpoints-chave retornam 403 para usário não autorizado.
- **Evidence**: Request/response logs ou testes automatizados.

### AC-04: CRUD Setores, Cargos e Funcionários com soft-delete e status Ativo/Férias/Afastado/Desligado
- **Type**: `rule`
- **Given**: Usuário Admin autenticado
- **When**: Criar/editar/desativar setor, cargo e funcionário via UI
- **Then**: Dados persistem, funcionário desligado não some do histórico, consultas com filtro ativo funcionam
- **Pass Condition**: 6 operações (3 CRUDs) concluem sem erro e entidade persiste no banco.
- **Evidence**: Registro no banco e screenshot das telas.

### AC-05: Cadastro de Jornada parametrizável (5x2 / 6x1 / 12x36 / personalizada)
- **Type**: `rule`
- **Given**: Usuário Admin
- **When**: Criar jornada com horários diferentes por dia, tolerância, cargas diária/semanal, folgas
- **Then**: Registro salvo em `work_schedules` + `work_schedule_days`
- **Pass Condition**: Consulta SQL retorna linhas em ambas tabelas com valores corretos.
- **Evidence**: Linhas no banco + tela de criação.

### AC-06: Motor de cálculo processa múltiplas entradas/saídas e gera work_days + hour_bank
- **Type**: `rule`
- **Given**: Funcionário com jornada 5x2 07:30–12:00 / 13:00–17:30 e marcações [07:35, 12:02, 13:05, 17:45]
- **When**: Executar rotina de cálculo diário
- **Then**: `work_days` registra atraso ~5+5min, saída normal, intervalo ~1h03, extra ~15min, saldo diário e `hour_bank` tem movimentação
- **Pass Condition**: Valores calculados batem com fórmula parametrizada (tolerância aplicada, extras/débito computados).
- **Evidence**: Linhas em `work_days` e `hour_bank` com valores calculados.

### AC-07: API `/api/agents/heartbeat` autêntica Agent por Token e persiste agent_heartbeats
- **Type**: `rule`
- **Given**: Agent com ID + Token cadastrados
- **When**: Enviar POST `/api/agents/heartbeat` com token válido no header e JSON payload
- **Then**: Cria registro em `agent_heartbeats`, atualiza último status do agent; token inválido retorna 401
- **Pass Condition**: Requests com/sem token retornam 200/401 respectivamente.
- **Evidence**: `curl`/Postman output + linha no banco.

### AC-08: Importação de marcações idempotente via API (prevenção duplicidade)
- **Type**: `rule`
- **Given**: Mesmo evento `(device_id=X, external_event_id=Y)`
- **When**: POST `/api/time-entries` (ou endpoint interno Agent) duas vezes com mesmo payload
- **Then**: Apenas 1 linha em `time_entries`; segunda chamada retorna 200/204 sem duplicar
- **Pass Condition**: `SELECT COUNT(*) FROM time_entries WHERE device_id=X AND external_event_id=Y` = 1
- **Evidence**: SQL count após dois envios idênticos.

### AC-09: Agent Local coleta, enfileira no SQLite e envia com retry (modo simulável/documentado)
- **Type**: `rule`
- **Given**: Agent configurado e rodando localmente
- **When**: iDFace responde (ou mock) e API está temporariamente offline
- **Then**: Eventos são salvos em `pending_events` do SQLite local; quando API volta, são enviados e marcados `sent`
- **Pass Condition**: Logs do Agent mostram enfileiramento + envio posterior com sucesso
- **Evidence**: Arquivo SQLite consultado + logs do Agent.

### AC-10: Command Queue entre Sistema e Agent (polling)
- **Type**: `rule`
- **Given**: Comando criado no servidor status PENDING
- **When**: Agent poll em `GET /api/agents/commands`
- **Then**: Agent recebe comando, executa, marca PROCESSING e depois SUCCESS/FAILED com resultado
- **Pass Condition**: Linha da tabela de comandos transita PENDING→PROCESSING→SUCCESS e retorno é armazenado
- **Evidence**: Estados no banco ao longo do tempo.

### AC-11: Dashboard administrativo com cards e tabela "Situação de Hoje"
- **Type**: `rule`
- **Given**: Dados de funcionários e work_days de hoje
- **When**: Acessar `/dashboard` como Admin
- **Then**: Renderiza cards (Ativos, Trabalhando Agora, Ausentes, Atrasados, Férias, Horas Extras, Banco de Horas, Status iDFace, Status Agent) e tabela com Entrada/Intervalo/Retorno/Saída/Trabalhado/Saldo/Situação colorida
- **Pass Condition**: Tela renderiza sem erros JS e cards têm contagens > 0 conforme massa de dados.
- **Evidence**: Screenshot + console browser limpo.

### AC-12: Espelho de ponto com filtros e totais (mês/ano/funcionário/setor)
- **Type**: `rule`
- **Given**: Dados de um mês completo de marcações
- **When**: Acessar Ponto → Espelho de Ponto, filtrar mês e funcionário, clicar imprimir
- **Then**: Tabela diária exibe corretamente; totais batem; layout impressão funciona
- **Pass Condition**: Soma de horas trabalhadas na UI igual soma SQL de `work_days`.
- **Evidence**: Valor soma UI vs SQL.

### AC-13: Solicitação/Aprovação de ajuste sem sobrescrever marcação original
- **Type**: `rule`
- **Given**: Funcionário solicitou ajuste de horário
- **When**: Admin aprova
- **Then**: `time_entry_adjustments` / `time_entry_requests` registram valor anterior/novo; `time_entries` original inalterado; cálculo reprocessado usa ajuste em camada
- **Pass Condition**: `updatedAt` da marcação original não muda; ajuste salvo e auditado.
- **Evidence**: Consultas mostrando original intacto e ajuste criado + audit.

### AC-14: Auditoria registra criação, alteração, exclusão lógica, ajustes e aprovações
- **Type**: `rule`
- **Given**: Admin edita cargo e aprova ajuste
- **When**: Consultar `audit_logs`
- **Then**: Registros para ambas ações existem com usuário, data, IP, entidade, valores antigo/novo
- **Pass Condition**: 2 linhas em `audit_logs` correspondentes
- **Evidence**: Linhas retornadas por consulta.

### AC-15: Variáveis sensíveis em `.env.example` e ausentes do código
- **Type**: `rule`
- **Given**: Código-fonte
- **When**: Buscar por strings que pareçam senhas/tokens hardcoded (regex padrão)
- **Then**: Nenhuma credencial real ou placeholder suspeito fora de `.env.example`; arquivo `.env.example` lista `DATABASE_URL`, `NEXTAUTH_*`, chaves secretas e placeholders para tokens dos agents.
- **Pass Condition**: Grep não encontra credenciais hardcoded.
- **Evidence**: Saída do grep.

### AC-16: Qualidade e organização da arquitetura
- **Type**: `rubric`
- **Dimension**: Arquitetura e organização do código
- **Scale**: 1-5
- **Anchors**: 1 = monolítico desorganizado; 3 = camadas separadas razoavelmente; 5 = estrutura limpa por domínio, serviços separados, Prisma bem usado, shadcn/ui componentizado, pastas `app/` (rotas), `server/` (serviços/repos), `components/`, `lib/`, integrações (ControlIdService, AgentClient)
- **Pass Threshold**: >= 4
- **Evidence**: Listagem de diretórios e inspeção de arquivos.

### AC-17: UI profissional e responsiva
- **Type**: `rubric`
- **Dimension**: Qualidade visual e responsividade
- **Scale**: 1-5
- **Anchors**: 1 = quebrada; 3 = desktop ok, mobile ruim; 5 = identidade visual Vgon, sidebar/topbar, cards/tabelas profissionais, breakpoints mobile/tablet/desktop funcionando
- **Pass Threshold**: >= 4
- **Evidence**: Screenshots em múltiplas resoluções.

### AC-18: Segurança e validação
- **Type**: `rubric`
- **Dimension**: Segurança, validação e boas práticas
- **Scale**: 1-5
- **Anchors**: 1 = sem validação, sem hash; 3 = senha hasheada, alguma validação; 5 = Zod em todas as rotas, rate limiting, sessão segura, RBAC em middleware ou server-side, audit em operações críticas, CSRF onde aplicável
- **Pass Threshold**: >= 4
- **Evidence**: Código de rotas, middleware e serviços.

## Open Questions
- [ ] Confirmar detalhes de identidade visual da Vgon (cores hex, logo, tipografia).
- [ ] Definir biblioteca de hash preferida (Argon2id recomendado) e biblioteca de relatórios/exportação (ex.: `pdf-lib`, `exceljs`).
- [ ] Definir biblioteca para Windows Service do Agent (node-windows, nssm wrapper, ou similar) e empacotamento para `.exe`.
- [ ] Confirmar intervalos permitidos de sincronização (limites mínimo/máximo).
