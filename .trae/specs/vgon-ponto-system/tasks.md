# VGON PONTO - Implementation Plan

## Task 1: Scaffold do projeto Web - Next.js + TypeScript + Tailwind + shadcn/ui
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Inicializar `package.json` com `next`, `react`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `@radix-ui/*`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`.
  - Criar estrutura `app/` (App Router) com layout root, página inicial, globals.css com tokens da Vgon (azul + verde profissional).
  - Inicializar shadcn/ui com componentes base: button, card, input, label, table, badge, avatar, dropdown-menu, sheet, dialog, sonner/toast, select, form (zod + react-hook-form), textarea, tabs, pagination.
  - Configurar `tsconfig.json` paths `@/*`, `next.config.ts`.
  - Criar identidade visual: logo VGON PONTO, paleta (primary Vgon blue, secondary success green, warning yellow, danger red), sidebar + topbar shell.
  - Criar `.env.example` e `.gitignore`.
- **Acceptance Criteria Addressed**: AC-01, AC-15, AC-16, AC-17
- **Test Requirements**:
  - `rule` TR-1.1: `npm run build` finaliza com exit code 0 e `npm run dev` abre página home sem erros console.
  - `rubric` TR-1.2: Organização inicial; scale 1-5; anchors 1=bagunçado 3=ok 5=limpo modular; threshold >=4; evidence `tree -L 3`.

## Task 2: Prisma + PostgreSQL Schema com todas as tabelas, FKs, índices e soft-delete
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Instalar `prisma` dev e `@prisma/client`.
  - Criar `prisma/schema.prisma` com provider PostgreSQL, datasource, generator, entidades mínimas: `users`, `employees`, `departments`, `positions`, `work_schedules`, `work_schedule_days`, `devices`, `device_users`, `agents`, `time_entries`, `time_entry_adjustments`, `time_entry_requests`, `work_days`, `hour_bank`, `vacations`, `leaves`, `holidays`, `audit_logs`, `device_sync_logs`, `agent_heartbeats`, `commands`.
  - Adicionar enums: `UserRole`, `EmployeeStatus`, `TimeEntryOrigin`, `TimeEntryStatus`, `RequestStatus`, `LeaveType`, `CommandStatus`.
  - Campos padrão: `id`, `createdAt`, `updatedAt`, `deletedAt @db.Timestamptz?`.
  - Timezone padrão `America/Sao_Paulo` via comentário/documento e campos `@db.Timestamptz`.
  - Índices e UNIQUE: `time_entries (device_id, external_event_id)` UNIQUE partial, `users(email)` UNIQUE, `employees(cpf)` UNIQUE, `employees(registration)` UNIQUE, `agents(token)` UNIQUE, `devices(device_unique_id)` UNIQUE.
  - Criar migration inicial vazia via `prisma migrate dev --name init` somente para validar; manter arquivo `prisma/migrations/`.
  - Criar `src/server/db.ts` singleton do PrismaClient com `globalThis`.
- **Acceptance Criteria Addressed**: AC-02, AC-15
- **Test Requirements**:
  - `rule` TR-2.1: `npx prisma validate` retorna "The schema at ... is valid"; `npx prisma migrate dev --name init` aplicado sem erro.
  - `rule` TR-2.2: `SELECT * FROM pg_indexes WHERE tablename='time_entries'` lista o UNIQUE INDEX de prevenção de duplicidade.

## Task 3: Autenticação + RBAC (NextAuth/Auth.js com Credentials + middleware de permissões)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Instalar `next-auth@beta` (v5) ou `@auth/nextjs`, `@auth/prisma-adapter`, `bcryptjs` (ou argon2).
  - Implementar `auth.ts` com provider Credentials, adapter Prisma, session strategy jwt ou database, sessão segura.
  - Adicionar `passwordHash` e `role UserRole` em `users`.
  - Middleware `middleware.ts` que protege rotas `/admin/*`, `/portal/*`, verifica sessão e role.
  - Helper `requireUser`, `requireRole(roles[])`, `canAccessEmployee(employeeId, user)`.
  - Isolamento portal funcionário: qualquer acesso a `employeeId != user.employeeId` retorna 403 quando role=FUNCIONARIO.
  - Login page com identidade visual e formulário shadcn/ui.
  - Seed de usuário MASTER padrão via `prisma/seed.ts` (senha via env `SEED_MASTER_PASSWORD`).
- **Acceptance Criteria Addressed**: AC-03, AC-18
- **Test Requirements**:
  - `rule` TR-3.1: Login com credenciais seed funciona e sessão é criada; credenciais erradas retornam erro.
  - `rule` TR-3.2: Usuário role=FUNCIONARIO acessa `/portal/ponto/[outro-id]` e recebe HTTP 403 ou redirect proibido.

## Task 4: Audit Service + helpers de auditoria aplicados em operações críticas
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**:
  - Criar `server/services/AuditService.ts` com `log(action, entity, recordId, before?, after?, ip?, userId?)`.
  - Integrar em ações de create/update/soft-delete de departments, positions, employees, work_schedules, time_entry adjustments/approvals, devices, agents, users/roles, hours bank manual adjustments.
  - Página Configurações → Auditoria com tabela, filtros por ação/entidade/usuário/período.
- **Acceptance Criteria Addressed**: AC-14
- **Test Requirements**:
  - `rule` TR-4.1: Após editar um cargo logado, existe 1 linha em `audit_logs` com action='UPDATE', entity='Position'.

## Task 5: CRUDs administrativos - Setores, Cargos, Empresa/Configurações
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Telas + server actions ou API Routes (App Router Route Handlers) para CRUD Departments e Positions com ativar/desativar (soft delete).
  - Validação Zod em todos os schemas.
  - Listagem com paginação, busca e filtro ativo/inativo.
  - Tela Configurações → Empresa (dados da empresa, timezone padrão, etc.).
- **Acceptance Criteria Addressed**: AC-04
- **Test Requirements**:
  - `rule` TR-5.1: Criar/editar/desativar 1 setor e 1 cargo via UI sem erros e registros persistem.

## Task 6: CRUD Funcionários (com foto, cargo, setor, jornada, gestor, status)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - Tabela employees com todos campos do spec; foto via upload (server action usando `fs` local temporário ou storage desacoplado; nesta etapa usar upload simples).
  - Validação CPF (formato) e matrícula únicos.
  - Formulário com selects para cargo, setor, jornada (criar FK), gestor (self-referential employees), status enum.
  - Regra de negócio: não permitir hard delete de funcionário com registros em time_entries/work_days.
  - Lista com busca, filtro por setor/status.
- **Acceptance Criteria Addressed**: AC-04
- **Test Requirements**:
  - `rule` TR-6.1: Criar funcionário completo, alterar status para Desligado e tentar hard delete; operação é rejeitada.

## Task 7: CRUD Jornadas e Escalas + Feriados
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - `work_schedules`: nome, modelo (5x2,6x1,12x36,custom), tolerância minutos, carga diária (min), carga semanal (min).
  - `work_schedule_days`: dia da semana (0-6), entrada, inicio_intervalo, fim_intervalo, saída, is_day_off.
  - UI wizard/table matricial para horários por dia; checkbox folga.
  - Escalas: vincula funcionário → jornada com `effective_from` (início).
  - Feriados: data, descrição, abrangência (nacional/regional/empresa), `recurring` anual.
- **Acceptance Criteria Addressed**: AC-05
- **Test Requirements**:
  - `rule` TR-7.1: Criar jornada 5x2 padrão e persistir 7 linhas em `work_schedule_days` com seg-sex trabalhados, sáb/dom folgas.

## Task 8: Core Engine - Cálculo diário de jornada (work_days) e Banco de Horas
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - `server/services/WorkDayCalculationService.ts`: recebe `(employeeId, date, time_entries[], work_schedule, holidays[])` e calcula par/ímpar entrada/saída, pareando múltiplas marcações.
  - Métricas calculadas: `expected_work_minutes`, `worked_minutes`, `break_minutes`, `late_minutes`, `early_leave_minutes`, `overtime_minutes`, `debit_minutes`, `daily_balance_minutes`.
  - Aplica tolerância antes de marcar atraso/saída antecipada.
  - Tratamento de jornadas 12x36 e múltiplos intervalos.
  - Persiste em `work_days` (unique por `(employee_id, date)`).
  - `HourBankService.applyDailyBalance(employeeId, date, delta, audit?)` grava em `hour_bank` extrato e acumula saldo.
  - Rotina/endpoint de (re)processar dia.
- **Acceptance Criteria Addressed**: AC-06
- **Test Requirements**:
  - `rule` TR-8.1: Cenário de teste (07:35/12:02/13:05/17:45) gera work_day com atraso ~10min (aplicada tolerância se <=5), extra ~15min, saldo calculado e linha em hour_bank.
  - `rubric` TR-8.2: Legibilidade e testabilidade do motor; scale 1-5 threshold >=4; evidence leitura do serviço.

## Task 9: CRUD Marcações (origem MANUAL/ADMIN) + API recebimento de marcações (idempotente)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - UI manual de lançar marcação (Admin) em Ponto → Marcações.
  - Route Handler POST `/api/internal/time-entries` ou Server Action que usa `Prisma.upsert` ou `createMany on conflict do nothing` por `(device_id, external_event_id)`. Para marcação MANUAL usar external_event_id determinístico `MANUAL-{id}`.
  - Trigger: após inserir nova marcação, disparar recálculo do work_day do funcionário/dia via `WorkDayCalculationService`.
  - Endpoint Agent → API: POST `/api/agents/time-entries/batch` autenticado por token de agent, recebe array de eventos.
- **Acceptance Criteria Addressed**: AC-08
- **Test Requirements**:
  - `rule` TR-9.1: Enviar 2x mesmo (device_id, external_event_id) em `POST /api/agents/time-entries/batch` → count no banco = 1.

## Task 10: Agents - Cadastro, Heartbeat API e tabelas auxiliares
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 9
- **Description**:
  - CRUD Agents com geração automática de token seguro (cadastro apenas por MASTER/ADMIN).
  - Middleware de autenticação de Agent: header `X-Agent-Id` + `X-Agent-Token` ou `Authorization: Bearer <agentToken>`. Valida contra tabela agents (token hasheado ou plain de baixa rotatividade em cenário controlado; prefira hash).
  - `POST /api/agents/heartbeat` grava `agent_heartbeats` e atualiza último status do agent.
  - Tabela `device_sync_logs` grava cada sincronização (agent_id, device_id, started_at, finished_at, events_count, status, error?).
  - Menu Integrações → VGON PONTO Agent com listagem e status.
- **Acceptance Criteria Addressed**: AC-07
- **Test Requirements**:
  - `rule` TR-10.1: POST heartbeat com token válido cria 1 linha em `agent_heartbeats`; com token inválido retorna 401.

## Task 11: Command Queue (Sistema → Agent) e integração bidirecional preparada
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 10
- **Description**:
  - Tabela `commands`: id, agent_id, command_type (SYNC_USERS, SYNC_TIME_ENTRIES_NOW, DEVICE_TEST...), payload JSON, status PENDING/PROCESSING/SUCCESS/FAILED, result JSON, picked_at, finished_at, attempts.
  - UI Integrações → Control iD: botão "Sincronizar agora" cria command SYNC_TIME_ENTRIES_NOW status PENDING.
  - GET `/api/agents/commands/next` autenticado como agent: retorna próximo comando PENDING e marca PROCESSING com `picked_at = now`.
  - PATCH `/api/agents/commands/:id` com result e status final.
  - Botão de teste de comunicação com device via agent.
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-11.1: Criar command via UI, agent poll, marca PROCESSING e depois SUCCESS; estados transitam corretamente.

## Task 12: Scaffold VGON PONTO Agent Local (Node.js/TS, SQLite, polling, loop principal)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 11
- **Description**:
  - Criar diretório `agent/` separado (pacote próprio ou workspace).
  - Dependências: `typescript`, `better-sqlite3`, `axios`, `pino` logger, `node-cron` ou loop interval, `zod`, `node-windows` (dev).
  - SQLite schema: `pending_events(id, payload_json, created_at, attempts, last_error)`, `sent_events`, `kv_store(key UNIQUE, value)` para `last_event_id`, `last_sync_at`.
  - Loop principal: cada `syncIntervalMs`:
    1. Autenticar no iDFace via ControlIdService (implementação stub/mock com flag MOCK no env).
    2. Buscar eventos desde last_event_id.
    3. Inserir cada evento em pending_events.
    4. Enviar lote de pending_events para `/api/agents/time-entries/batch`.
    5. Em sucesso: mover para sent_events e atualizar `last_event_id`/`last_sync_at` em kv_store.
    6. Em falha: incrementar attempts, aplicar backoff no próximo envio, salvar erro.
  - Heartbeat periódico para `/api/agents/heartbeat`.
  - Polling de comandos: a cada X segundos, `GET /api/agents/commands/next` e executa.
  - Configuração via arquivo `agent.config.json` e env: `IDFACE_URL`, `IDFACE_PORT`, `IDFACE_USER`, `IDFACE_PASSWORD`, `DEVICE_ID`, `API_URL`, `AGENT_ID`, `AGENT_TOKEN`, `SYNC_INTERVAL_SEC`.
- **Acceptance Criteria Addressed**: AC-09, FR-22
- **Test Requirements**:
  - `rule` TR-12.1: Rodar agent com MOCK=true por 3 ciclos: eventos são enfileirados, enviados para API mock e confirmados; falha simulada na API não causa duplicação ao recuperar.

## Task 13: ControlIdService (stub oficial + integração documentada)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 12
- **Description**:
  - No `agent/` criar `services/ControlIdService.ts` com métodos públicos: `login()`, `getStatus()`, `getEvents(sinceCursor?)`, `getUsers()`, com tratamento de timeout e logs estruturados.
  - Documentar no código quais endpoints reais da Control iD serão usados (comentários com referências de documentação). NÃO inventar; marcar claramente "MOCK" onde dado é simulado.
  - Validação Zod de resposta do equipamento.
  - No dashboard Integrações → Control iD mostrar Serial/Firmware/MAC/Device ID cadastrados (de devices) e status de conectividade reportado pelo heartbeat.
- **Acceptance Criteria Addressed**: FR-23
- **Test Requirements**:
  - `rule` TR-13.1: Método `getEvents` retorna array validado por schema; em modo MOCK retorna lista fixa e logs adequados.

## Task 14: Dashboard administrativo com cards e "Situação de Hoje"
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8, Task 10
- **Description**:
  - Query server-side agregada para cards: ativos (count employees status=Ativo), trabalhando agora (última marcação hoje = entrada par sem saída correspondente), ausentes, atrasados, em férias, horas extras soma hoje, saldo banco de horas, status iDFace (último device_sync_logs recente), status agent (último heartbeat < N min).
  - Tabela "Situação de Hoje": lista funcionário, primeira entrada, par de intervalo (início/fim), saída final, trabalhado (HH:MM), saldo, situação com badge colorido (🟢 Normal, 🟡 Atrasado, 🔴 Ausente, 🔵 Férias, 🟠 Incompleto).
  - Componentes reutilizáveis de cards e tabela com shadcn.
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-14.1: Dashboard carrega sem erros JS; tabela Situação de Hoje mostra badge correto para 3 cenários (normal/atrasado/ausente) inseridos por seed.

## Task 15: Espelho de Ponto + filtros + totais + impressão
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 14
- **Description**:
  - Página Ponto → Espelho de Ponto com filtros (funcionário, setor, mês, ano).
  - Consome work_days + time_entries agregados por dia; colunas: Data, Dia, Entrada, Saída, Entrada, Saída, Trabalhado, Previsto, Extra, Débito, Saldo.
  - Linha de totais: trabalhadas, previstas, extras, negativas, banco, faltas, atrasos.
  - View de impressão: `@media print` limpa sidebar/topbar.
  - Exportação Excel básica usando `exceljs` (colunas + totais) e preparação para PDF.
- **Acceptance Criteria Addressed**: AC-12
- **Test Requirements**:
  - `rule` TR-15.1: Espelho para mês com massa de dados mostra soma UI igual soma SQL via service.

## Task 16: Banco de Horas (extrato por funcionário)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 15
- **Description**:
  - Página Ponto → Banco de Horas: lista funcionários com Crédito, Débito, Saldo.
  - Drill-down por funcionário: extrato diário com Data, +/- Minutos (ex.: +00:35), origem (cálculo diário / ajuste manual), saldo acumulado.
  - Admin pode lançar ajuste manual no banco (crédito/débito) com justificativa → dispara Audit.
- **Acceptance Criteria Addressed**: FR-14
- **Test Requirements**:
  - `rule` TR-16.1: Lançamento manual administrativo aparece no extrato + linha em audit_logs.

## Task 17: Fluxo Ajustes de Ponto (solicitação → aprovação/reprovação)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 16
- **Description**:
  - Funcionário abre solicitação: data, horário, tipo (ajuste entrada/saída/intervalo/justificativa), justificativa texto.
  - Tabela `time_entry_requests` + `time_entry_adjustments` quando aprovado.
  - Tela Admin/RH/Gestor: fila pendente, aprovar/reprovar com parecer.
  - Ao aprovar: cria `time_entry_adjustments` (nunca toca em `time_entries` original), reprocessa work_day via engine.
  - Histórico completo com valores anterior/novo, solicitante, aprovador, datas.
- **Acceptance Criteria Addressed**: AC-13
- **Test Requirements**:
  - `rule` TR-17.1: Aprovar ajuste não altera `updatedAt` da marcação original; cria ajuste e 2 linhas de audit (criação + aprovação).

## Task 18: Férias, Afastamentos, Atestados e impactos no cálculo de ausência
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - CRUD vacations, leaves (tipo: atestado, afastamento, folga, compensação), holidays.
  - Motor WorkDayCalculationService verifica: se data em holidays/férias/afastamento justificado → não marca como falta; exibe correspondente no Situação de Hoje.
  - Tabela Ausências com 3 sub-abas.
- **Acceptance Criteria Addressed**: FR-16
- **Test Requirements**:
  - `rule` TR-18.1: Funcionário registrado em férias no dia não aparece como 🔴 Ausente e sim 🔵 Férias no dashboard.

## Task 19: Portal do Funcionário (rota /portal)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 17, Task 18
- **Description**:
  - Layout diferente ou filtro automático: dados sempre escopo `employeeId = session.user.employeeId`.
  - Abas: Meu Ponto Hoje, Minhas Marcações, Banco de Horas, Minha Jornada, Espelho de Ponto (pré-filtrado), Solicitações (criar/acompanhar ajustes), Férias/Afastamentos.
  - Middleware garante nenhum acesso cross-employee.
- **Acceptance Criteria Addressed**: FR-19
- **Test Requirements**:
  - `rule` TR-19.1: Usuário portal ao tentar trocar query de espelho para outro employeeId recebe 403.

## Task 20: Relatórios (agregados + exportação Excel/PDF inicial)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 19
- **Description**:
  - Menu Relatórios com listagem: Espelho, Folha Mensal, Banco de Horas, Horas Extras, Atrasos, Faltas, Funcionários, Marcações, Ajustes, Férias, Afastamentos, Auditoria.
  - Páginas server-side renderizadas com filtros (funcionário, setor, período, status).
  - Botões exportar Excel e preparar impressão/PDF via biblioteca ou print.
- **Acceptance Criteria Addressed**: FR-21
- **Test Requirements**:
  - `rule` TR-20.1: Exportar Excel de "Horas Extras do Mês" contém ao menos as colunas esperadas e linhas >0 quando há dados.

## Task 21: Configurações → Usuários, Permissões, Dispositivos; Integrações → Control iD / Logs
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 11, Task 20
- **Description**:
  - CRUD usuários, atribuição de role, vincular a employee (opcional).
  - Menu Configurações → Dispositivos com serial/firmware/MAC/device_id cadastrados e status (baseado último sync).
  - Tela Integrações → Control iD com card iDFace (serial, firmware, status agent, status iDFace, eventos pendentes, última marcação, última sincronização) + botão "Sincronizar agora" (Command Queue).
  - Tela Integrações → Logs exibe device_sync_logs e últimos heartbeats.
- **Acceptance Criteria Addressed**: FR-29, FR-09
- **Test Requirements**:
  - `rule` TR-21.1: Botão Sincronizar agora cria command PENDING; após agent poll/responder aparece como SUCCESS.

## Task 22: Dockerfile, compose, deploy Easypanel (build/prod) e validações finais
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 21
- **Description**:
  - `Dockerfile` para web (multi-stage install → build → runner com node), healthcheck, porta 3000.
  - `docker-compose.yml` web + postgres + volumes.
  - Script de inicialização para rodar migrations (`prisma migrate deploy`) no startup.
  - Revisão `.env.example` completo.
  - Checagens: `npm run lint`, `npm run build`, `prisma validate`.
- **Acceptance Criteria Addressed**: NFR-09, AC-15
- **Test Requirements**:
  - `rule` TR-22.1: `docker build .` finaliza sem erro; `docker compose up -d` inicia serviços e app responde em 3000.

## Task 23: Verificação geral, documentação operacional e seed de demonstração
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 22
- **Description**:
  - Seed PRD: setores, cargos, jornadas, 15 funcionários distribuidos por setor, feriados do ano, marcações de 1 mês.
  - Checklist final percorrendo todos ACs e marcando evidências de self-verification no tasks.md.
  - Garantir que `review.md` ainda não foi criado (será criado na fase Review).
- **Acceptance Criteria Addressed**: Todos ACs
- **Test Requirements**:
  - `rubric` TR-23.1: Cobertura e qualidade geral final; scale 1-5 threshold >=4.
