# Marcações, espelho, ajustes e banco de horas

As consultas usam os registros reais de `time_entries`, com datas/horários de Brasília. Administradores e RH consultam os funcionários; gestores somente sua equipe direta; funcionários somente seu próprio espelho, ajustes e extrato. APIs conferem a conta ativa no banco e aplicam o escopo no servidor.

## Regras de marcação

Em Marcações, Master/Admin configuram a janela do turno e o intervalo de duplicidade. Padrões: janela ativa, 30 minutos antes da entrada e depois da saída, duplicidade de até 2 minutos (inclusive). O intervalo dentro do turno é permitido. Folgas e funcionários sem jornada válida não permitem inclusão/correção manual com janela ativa. Turnos noturnos consideram a data anterior/seguinte.

Eventos com o mesmo identificador externo e dispositivo são idempotentes. Eventos diferentes, inclusive no mesmo minuto, são preservados. Quando existe vínculo com funcionário, novas batidas próximas de uma anterior recebem `DUPLICATE` e são desconsideradas no espelho. Batidas fora da janela recebem `OUTSIDE_WINDOW` e exigem conferência. Sem vínculo, ficam identificadas como `UNLINKED`. Não altera acesso físico no iDFace. As regras não reclassificam retroativamente eventos antigos.

## Espelho

Conferência pela jornada atual, sem fechamento oficial de folha. Pareamento cronológico das batidas; não inventa intervalos. Batidas incompletas, inconsistentes, duplicadas sem classificação anterior, horários futuros e timestamps divergentes não produzem saldo confirmado. Repetidas classificadas são removidas apenas da apuração e continuam na tela Marcações. A tolerância cadastrada é aplicada à diferença líquida diária.

Jornadas noturnas incluem a manhã seguinte até uma hora após a saída prevista, antes da entrada do próximo turno. Dias atuais/futuros não geram débito. Feriados cadastrados, férias/afastamentos integrais aprovados e dias anteriores à admissão dispensam a carga prevista. Justificativas parciais exigem conferência. Sem jornada válida ou com 12x36 sem escala, não há cálculo de previstas/saldo. CSV e impressão refletem os resultados consultados.

## Ajustes

Solicitações de incluir, corrigir e desconsiderar exigem justificativa e permissão sobre o funcionário. RH/Admin/Master avaliam. Solicitação e aprovação verificam novamente janela, futuro e duplicidade. Aprovações/rejeições repetidas não repetem a alteração. Corrigir/desconsiderar marca a origem como excluída logicamente; não muda data/hora originais. Correções criam outro registro manual ajustado, vinculado à solicitação e auditoria. Rejeições preservam as batidas.

## Banco de horas

O extrato inclui saldo anterior e movimentos cronológicos. A apuração é uma ação explícita de RH/Admin/Master. Utiliza somente dias encerrados com saldo confirmado no espelho, incluindo débito por dia previsto sem marcação. Cada dia usa chave única por funcionário/data: reapurar substitui o valor diário, sem acumular novamente. Alterações em batidas, vínculo ou jornada sinalizam cálculos antigos para reapuração; o extrato informa pendências.

Crédito/débito manual exige justificativa e chave de envio para impedir duplicação por repetição da requisição. Estorno é um lançamento inverso na data atual com referência única; não apaga o original. Somente movimentos manuais podem ser estornados. Cálculos diários são corrigidos pelo fluxo de batidas e reapuração. Saldos armazenados são recompostos em ordem de data, criação e ID dentro da transação. Todos os comandos de escrita são transacionais e auditados; conflitos serializáveis são repetidos com limite.

## Migração

`202610230001_attendance_controls` adiciona flags, referência de duplicidade, alvo de ajuste, chaves do banco e configurações. Troca somente o índice de unicidade por minuto por um índice de consulta; mantém a unicidade de evento externo/dispositivo e preserva registros existentes. Não executa seed ou apuração automática em produção.

## Validação isolada

`npm test` cobre regras de horários, apuração, escopo, ajustes, extrato e CSV. Para testar as migrações reais e o SQL de recomposição em PostgreSQL em memória, sem acessar `DATABASE_URL`:

```sh
npm install --prefix agent/installer/Output/attendance-db-tests --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
node --import tsx --test tests/attendance-database.mjs
```

O pacote de teste fica em diretório ignorado e não integra a aplicação publicada.
