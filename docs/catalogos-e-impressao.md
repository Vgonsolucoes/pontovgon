# Cadastros administrativos e impressão

## Espelho em uma folha

O botão Imprimir/PDF prepara um documento separado em iframe com A4 retrato, margens de 8 mm e largura útil de 194 mm. Inclui identificação, período, totais, todos os dias e observações. Aguarda as fontes, mede a altura e reduz a escala se necessário para caber em 279 mm (com reserva de arredondamento). Não oculta linhas ou corta batidas para caber. O tamanho final depende do volume de observações; meses com muitos registros usam fonte menor. O documento não contém filtros, menus nem botões. Dados de usuários são escapados antes da geração do HTML.

## Sincronizações

Master/Admin consultam até 62 dias de lotes reais, com filtros por Agent, equipamento e situação. Contadores e paginação usam os filtros aplicados. Atualização a cada 10 segundos mantém o período consultado. A fila local mostra o último valor informado pelo heartbeat, indicando comunicação desatualizada quando necessário.

Testar comunicação enfileira somente `TEST_DEVICE`, implementado no Agent atual. A resposta inicial indica fila, e a confirmação aparece somente após execução. Solicitações pendentes são deduplicadas. Teste não equivale a importação de batidas; a coleta permanece automática no Agent. Erros não expõem credenciais ou payloads brutos.

## Dispositivos e permissões

Cadastro de metadados e habilitação do dispositivo, com auditoria e validação no servidor. Não expõe configurações, senhas ou tokens. Identificadores de equipamento vinculado ou com histórico não podem ser alterados. Desabilitar exige conclusão dos comandos pendentes e impede novas importações e novos envios faciais. IP e senha ficam no Agent local, e o vínculo é feito pela tela Agents.

A tela Permissões é exclusiva do Master. Mostra a matriz das operações implementadas e permite atribuir os perfis existentes pelo cadastro de usuários, usando a mesma API validada e auditada. Não cria regras de acesso independentes das verificações do servidor.

## Feriados de Contagem — 2026

Fonte primária: [Decreto municipal 1.829, de 15/01/2026, anexo](https://legislacao.contagem.mg.gov.br/legislacao/view/29675). Somente os itens classificados como Feriado: nove federais e três municipais (27/03, 03/04 e 04/06). Não inclui Carnaval, aniversário da cidade ou outros pontos facultativos. A classificação municipal de Paixão de Cristo e Corpus Christi segue o decreto e a Lei municipal 3.484/2001 nele citada.

A migração insere datas específicas de 2026, sem recorrência automática, preserva feriados existentes equivalentes e não duplica importações. Alterações pelo formulário marcam cálculos anteriores do banco para reapuração. O espelho utiliza somente feriados ativos. Não importa automaticamente calendários de outros anos.

Validação: testes unitários de cadastros e escape da impressão; teste PostgreSQL em memória executando ambas as migrações e conferindo as 12 datas, exclusão dos facultativos e repetição sem duplicidade. A validação visual deve ser feita no navegador autorizado do usuário.
