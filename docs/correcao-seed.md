# Correção do seed de cargos

O log informado mostra migrations aplicadas e servidor Next.js iniciado (`Ready`), mas seed interrompido por uso de `Prisma.DbNull` na chave composta de cargos. Esse valor é reservado a campos JSON; `departmentId` é texto nullable.

## Mudanças

- Com setor: upsert pela chave composta com valor string, sem atualizar cargos existentes.
- Sem setor: busca por nome e `departmentId: null`, criação somente se não existir.
- Lock transacional PostgreSQL serializa escritores desse seed, pois UNIQUE com NULL não impede duplicidade por si só.
- Reinícios deixam de executar seed automaticamente. Habilitar `RUN_BOOTSTRAP_SEED=true` apenas quando o bootstrap for explicitamente necessário; o seed legado ainda cria cadastros iniciais e não deve ser executado rotineiramente sobre produção.
- Nenhuma migration, exclusão de dados ou alteração de credenciais nesta correção.

## Validação

`node --import tsx --test tests/seed-positions.test.ts`: 3 testes aprovados.

Typecheck web incluindo o seed e lint aprovados. O typecheck usou configuração temporária para excluir artefatos `.next` gerados por outra branch. Não foi executado seed contra produção, nem validado o lock em banco real. O build Docker/Linux permanece pendente.

## Aplicação

Integrar a branch `codex/fix-seed-null-department` à `main` e executar o deploy autorizado no EasyPanel. Manter `RUN_BOOTSTRAP_SEED` ausente ou `false`. A inicialização deverá registrar `Skipping seed` e depois `Ready`.

Os avisos de atualização do npm não são a causa da falha. A mensagem sobre `/tmp/nft-originals/api-agents` é independente e não foi alterada nesta correção.
