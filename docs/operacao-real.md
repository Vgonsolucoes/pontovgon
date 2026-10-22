# Operação real — entrega inicial

Branch: `feature/vgon-ponto-operacao-real`. Não representa conclusão do prompt mestre.

Nenhum banco foi acessado, limpo ou migrado. Nenhuma credencial de produção foi alterada. Nenhum deploy ou merge foi executado. A autorização posterior para homologar em produção será usada inicialmente para consultas não destrutivas, assim que o acesso estiver disponível; dados fictícios de teste permanecem isolados.

| Módulo | Situação anterior | Correção realizada | Testado | Status |
|---|---|---|---|---|
| Dashboard | Indicadores, pessoas e status fixos | Consultas Prisma, últimos eventos, saldos persistidos, atualização parcial a cada 30s; status exige comunicação recente; erro distinto de vazio | Tipos/lint; regra de recência unitária | PARCIALMENTE IMPLEMENTADO |
| Funcionários | Estrutura visual | Nenhuma implementação de CRUD nesta entrega | Não | PENDENTE |
| Setores | Estrutura visual | Cadastro, edição, ativação, desativação, busca; transação com auditoria, backend restrito a MASTER/ADMIN/RH | Tipos/lint; integração pendente | PARCIALMENTE IMPLEMENTADO |
| Cargos | Estrutura visual | Cadastro, edição, ativação, desativação e busca, auditoria transacional | Tipos/lint; integração pendente | PARCIALMENTE IMPLEMENTADO |
| Jornadas | Estrutura visual | Sem alteração | Não | PENDENTE |
| Escalas | Estrutura visual | Sem alteração | Não | PENDENTE |
| Marcações | Importação com associação recebida do cliente e cadastro automático de equipamento | Exige dispositivo vinculado; resolve funcionário por device_users; preserva identidade original sem vínculo; rejeita eventos MOCK; distingue conflito de unicidade de repetição do mesmo evento | Tipos/lint; integração pendente | PARCIALMENTE IMPLEMENTADO |
| Espelho de ponto | Estrutura visual | Sem alteração | Não | PENDENTE |
| Banco de horas | Estrutura visual | Dashboard soma movimentos existentes; não foi criado motor de cálculo | Não | PARCIALMENTE IMPLEMENTADO |
| Ajustes | Estrutura visual | Sem alteração | Não | PENDENTE |
| Férias | Estrutura visual | Dashboard consulta férias aprovadas vigentes; CRUD pendente | Não | PARCIALMENTE IMPLEMENTADO |
| Afastamentos | Estrutura visual | Sem alteração | Não | PENDENTE |
| Feriados | Estrutura visual | Sem alteração | Não | PENDENTE |
| Relatórios | Estrutura visual | Sem alteração; exportações pendentes | Não | PENDENTE |
| Agent | Simulação automática possível; confirmação incompleta podia retirar eventos da fila | Simulação exige ambiente e opt-in explícitos; valida ACK integral; mantém eventos em caso de falha; heartbeat inclui dispositivo consultado; status expirado na lista | Typecheck e testes de configuração/ACK/timezone | PARCIALMENTE IMPLEMENTADO |
| Control iD | Cliente existente sem homologação física | Heartbeat atualiza somente o equipamento identificado e vinculado | Equipamento não acessado | BLOQUEADO POR DEPENDÊNCIA EXTERNA |
| Usuários | Login existente; helper de gestor permissivo | Helper exige vínculo managerId explícito; incompatibilidade de tipos corrigida; CRUD pendente | Typecheck | PARCIALMENTE IMPLEMENTADO |
| Configurações | Estrutura visual | Bootstrap explícito, não modifica usuários existentes; não cria equipamentos/agents/setores artificiais | Análise estática; execução de bootstrap não realizada | PARCIALMENTE IMPLEMENTADO |
| Auditoria | 14 eventos inventados e total fixo | PostgreSQL com filtros e paginação reais; operações dos novos cadastros auditadas atomicamente | Tipos/lint; integração pendente | PARCIALMENTE IMPLEMENTADO |

## Verificações

- Typecheck web e Agent: aprovados após corrigir incompatibilidades existentes de Zod, Buffer, augmentation de JWT e tipo Logger.
- Lint web: aprovado.
- Testes: 15 aprovados (11 existentes de timezone, configuração de mock, recência e dois cenários de confirmação de lote).
- Prisma validate: aprovado com URL local de validação, sem conexão ao banco.
- Build: compilação, tipos e geração das 29 páginas aprovadas. Empacotamento standalone falhou com EPERM ao criar symlinks no Windows. Build completo ainda precisa passar em ambiente Linux/Docker.
- Sem testes de integração ou E2E executados: faltam acesso configurado ao banco e ambiente em execução.
- Instalação local usou pnpm/runtime disponível, resolvendo as faixas semver; a CI deve repetir com `npm ci` e o package-lock existente.
- Migrations criadas: nenhuma. Nenhuma migration aplicada.

## Riscos e pendências

O motor de cálculo ainda não existe. Por isso presença e ausência não são inventadas: o dashboard informa a pendência. Atrasos e extras referem-se somente a work_days calculados e persistidos. Ainda faltam filtros e gráficos do dashboard.

A constraint legada por origem/funcionário/data/minuto pode conflitar com eventos distintos. Agora esse conflito permanece na fila em vez de ser confirmado como duplicado. A revisão da constraint exige migration futura e homologação.

Eventos antigos sem identidade rastreável exigem análise manual; nenhuma associação ou limpeza retroativa foi realizada. Campos de saúde e anexos ainda precisam de implementação e testes específicos. Gestão de usuários, escalas históricas, configuração de localidades e exportações continuam pendentes.

Não houve validação física da API Control iD. A referência oficial é https://www.controlid.com.br/docs/access-api-pt/ ; sessões, paginação e eventos devem ser homologados no firmware em uso antes de considerar a integração concluída.

## Implantação futura — após validação

1. Backup consistente do PostgreSQL e registro da versão atual; não remover registros existentes.
2. Executar `npm ci`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` em Linux/Docker. No Agent, instalar dependências, executar `npm run typecheck`, `npm test` e `npm run build`.
3. Verificar `prisma migrate status`; não executar limpeza nem reset. Esta entrega não adiciona migration.
4. Manter `RUN_BOOTSTRAP_SEED=false` em produção já instalada. O bootstrap, quando explicitamente necessário em instalação nova, exige nome, email e senha de 12+ caracteres e não atualiza usuário existente.
5. Cadastrar/vincular equipamento e Agent reais antes da importação. Conferir mapeamentos device_users e conciliar eventos sem vínculo.
6. Homologar heartbeat, equipamento offline, repetição de lote, falha parcial, fila offline e reconexão. Não inserir eventos fictícios na produção.
7. Obter autorização específica para deploy/merge. A autorização para testes em produção não equivale a autorização de implantação.

O relatório deve ser atualizado a cada módulo. Não classificar o sistema inteiro como pronto com base nesta entrega inicial.
