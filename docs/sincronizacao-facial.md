# Envio do sistema para o iDFace

Requer VGON PONTO Agent 1.0.4 ou superior na mesma rede do equipamento. O servidor enfileira comandos; somente o Agent inicia chamadas para a LAN.

1. Na página Agents, vincular computador e equipamento usando nome, Device ID e número de série reais. Copiar o token gerado para a tela local do Agent, salvar e reiniciar. Aguardar o heartbeat mostrar a versão atual. O cadastro de vínculo é restrito a Master/Administrador.
2. Em Funcionários, criar ou editar o colaborador, selecionar uma foto individual JPG/PNG e salvar. O navegador prepara uma imagem JPEG de até 1024 pixels no maior lado, com no máximo 1 MB, preservando a proporção. A foto é armazenada no campo existente do PostgreSQL e servida por rota autenticada a Master/Administrador/RH; não depende do filesystem descartável do container.
3. Em “Enviar cadastros e fotos para o iDFace”, escolher o equipamento, selecionar até 20 funcionários ativos com foto e enviar. A mesma pessoa não é enfileirada novamente enquanto possui envio pendente para aquele equipamento.
4. Acompanhar o histórico: Na fila, Enviando, Cadastro e foto confirmados ou Falhou. Um Agent offline deixa o envio na fila. A confirmação exige resposta positiva do cadastro facial, identidade, matrícula, hash da foto, Device ID e série esperados.

O Agent confere a série física antes de transmitir dados pessoais. Localiza o usuário por matrícula ou valida o ID vinculado; cria apenas quando não existe e atualiza somente aquele usuário. Matrículas duplicadas ou IDs de outra pessoa interrompem a operação. O envio usa `user_set_image_list.fcgi` com verificação de rosto duplicado ativa. Recusas de qualidade são exibidas, sem marcar sucesso.

O vínculo `device_users` é persistido somente após confirmação do usuário no equipamento. Se a foto for recusada, o cadastro do usuário pode estar criado; o histórico permanece Falhou e a nova tentativa reutiliza esse cadastro. Não há exclusão automática de usuários, fotos, regras ou permissões de acesso no equipamento.

O resultado de um comando executado é salvo no SQLite antes do envio da confirmação. Uma falha de rede ou reinício faz o Agent reenviar a confirmação, sem repetir a operação. Comandos faciais interrompidos são retomados após dez minutos, até cinco tentativas; a busca por matrícula evita recriação. A fila remove os bytes da foto ao finalizar ou esgotar tentativas e mantém os metadados do resultado. Fotos e senhas não entram na auditoria nem nos logs de execução.

Testes isolados exercitam o contrato HTTP do equipamento, matrícula existente, atualização de nome, foto recusada, destino e série incorretos, perda da resposta de criação, confirmação durável após reinício, limites da foto, versão do Agent e correspondência de resultados. Não são inseridas pessoas de exemplo no equipamento físico. A aceitação de uma foto real pelo firmware depende da imagem e precisa ser confirmada no histórico.

Referências oficiais: [cadastro facial](https://www.controlid.com.br/docs/access-api-pt/reconhecimento-facial/cadastro-facial/), [consulta de objetos](https://www.controlid.com.br/docs/access-api-pt/objetos/carregar-objetos/), [criação](https://www.controlid.com.br/docs/access-api-pt/objetos/criar-objetos/) e [alteração](https://www.controlid.com.br/docs/access-api-pt/objetos/modificar-objetos/).
