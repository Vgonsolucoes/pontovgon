# Cadastros de usuários e funcionários

As páginas `/configuracoes/usuarios` e `/funcionarios` substituem as telas provisórias por formulários e listagens conectados ao PostgreSQL existente. Não há alteração de schema nem execução de seed.

Usuários: nome, e-mail, senha inicial, perfil, vínculo opcional com funcionário e acesso ativo. A senha é gravada com bcrypt; ao editar, senha vazia mantém a atual. A resposta e a auditoria nunca incluem senha ou hash. E-mail é normalizado para minúsculas. Cada funcionário pode ter apenas uma conta vinculada.

Funcionários: nome, CPF, matrícula, e-mail, telefone, admissão, setor, cargo, jornada, gestor, situação, ID individual no iDFace e observações. CPF é validado pelos dígitos verificadores e armazenado sem máscara. Datas inválidas, vínculos inexistentes, cargos de outro setor, hierarquia circular e ID de equipamento já associado a outra pessoa são recusados.

Master administra os usuários. Administrador administra contas não administrativas e edita os próprios dados, mantendo seu perfil e acesso. RH administra funcionários. Gestor consulta somente sua equipe; sem vínculo com funcionário, a equipe fica vazia. Nenhuma conta pode desativar a si mesma ou alterar o próprio perfil. As APIs conferem o usuário ativo diretamente no banco. Sessões do servidor atualizam perfil e vínculo e recusam contas desativadas ou excluídas.

Criação e edição são transações serializáveis com auditoria na mesma transação. Registros e histórico são preservados: contas são desativadas pelo campo de acesso, e funcionários possuem situação cadastral. Pesquisa e edição funcionam sobre os registros reais.

Verificação automatizada: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Testes isolados cobrem CPF, data, normalização, campos obrigatórios, senha na criação/edição, limite UTF-8 do bcrypt e regras de acesso. A conferência de interface em produção usa listagem e validação de campos, sem inserir pessoas de exemplo.
