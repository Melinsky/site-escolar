# Backend EEAFR — API, banco e administração

API REST que serve o site institucional e o painel administrativo na mesma aplicação Express. O banco pode ser PGlite local ou PostgreSQL externo. Este guia descreve os contratos implementados em [api.js](api.js), [auth.js](auth.js) e [resources.js](resources.js).

**Navegação:** [Voltar ao README principal](../../README.md) · [Publicar na Hostinger VPS](../../deploy/HOSTINGER.md) · [Modelo de ambiente](.env.example) · [Schema](models/schema.sql)

## Sumário

- [Instalação e execução](#execucao)
- [Variáveis de ambiente](#ambiente)
- [Banco, inicialização e migrações](#banco)
- [PostgreSQL local gerenciado](#postgres-local)
- [Primeiro acesso, sessões e perfis](#acesso)
- [Contratos HTTP e endpoints](#api)
- [Campos e validação dos recursos](#recursos)
- [Exemplos de consumo](#exemplos)
- [Uploads](#uploads)
- [Integração com o site e painel](#integracao)
- [Estrutura interna](#estrutura)
- [Testes](#testes)
- [Produção](#producao)
- [Backup e restauração](#backup)
- [Solução de problemas](#problemas)
- [Limites atuais](#limites)

<a id="execucao"></a>

## Instalação e execução

Requer **Node.js 22 ou superior**. A partir da raiz do repositório:

```powershell
npm run setup
npm start
```

Ou, trabalhando diretamente nesta pasta:

```powershell
cd projeto-TCC/backend
npm ci
npm start
```

O servidor lê o `.env` desta pasta, independentemente de ser iniciado pela raiz ou pelo backend. Variáveis já definidas no processo têm precedência sobre o arquivo.

| Função | Endereço padrão |
| --- | --- |
| Site | [http://localhost:3000](http://localhost:3000) |
| Painel | [http://localhost:3000/admin/](http://localhost:3000/admin/) |
| API | `/api` na mesma origem |
| Saúde do banco | [http://localhost:3000/api/health](http://localhost:3000/api/health) |

Use `npm run dev` para reinício automático com `node --watch`. Encerre com **Ctrl+C**. Não execute duas instâncias sobre o mesmo diretório PGlite.

<a id="ambiente"></a>

## Variáveis de ambiente

O [arquivo `.env.example`](.env.example) contém uma configuração local de referência. Se `.env` ainda não existir, copie o modelo a partir desta pasta:

```powershell
Copy-Item .env.example .env
```

| Variável | Padrão/comportamento | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP. |
| `HOST` | `127.0.0.1` | Interface de escuta. Use `0.0.0.0` quando a implantação exigir acesso pela rede. |
| `NODE_ENV` | Sem valor no código; modelo usa `development` | `production` ativa cookies Secure e políticas HTTP próprias de produção. |
| `DB_DRIVER` | PGlite quando não for `postgres` | Defina explicitamente `pglite` ou `postgres`. |
| `DB_LOCAL_MANAGED` | Desativado | O valor `true`, com driver `postgres`, inicia o PostgreSQL local gerenciado antes da API. Deixe desativado para banco externo. |
| `DATA_DIR` | Pasta `.data` dentro do backend | Diretório do PGlite, uploads e arquivo de primeiro acesso. Prefira caminho absoluto ao personalizar. |
| `DATABASE_URL` | Sem valor | String de conexão do PostgreSQL externo. |
| `DB_HOST` | Sem padrão explícito da aplicação | Host alternativo da conexão `pg`. |
| `DB_PORT` | `5432` | Porta do PostgreSQL externo. |
| `DB_USER` | Sem padrão explícito da aplicação | Usuário do PostgreSQL externo. |
| `DB_PASSWORD` | Sem valor | Senha do PostgreSQL externo. |
| `DB_NAME` | Sem padrão explícito da aplicação | Banco PostgreSQL externo já criado. |
| `DB_SSL` | Desativado | O valor literal `true` ativa SSL com `rejectUnauthorized: true`. |
| `DB_SSL_CA_FILE` | Sem valor | Arquivo da autoridade certificadora para PostgreSQL externo, quando `DB_SSL=true`. |
| `PUBLIC_URL` | Obrigatória em produção | Origem HTTPS do site, sem caminho; usada na verificação de origem das escritas. |
| `SEED_CONTENT` | Carga ativa se não for `false` | `false` impede carregar os dados de referência em bancos novos; o Compose de produção desativa essa carga. |
| `DB_PASSWORD_FILE` | Sem valor | Alternativa a `DB_PASSWORD`: lê a senha de um arquivo de secret. |
| `DATABASE_URL_FILE` | Sem valor | Alternativa a `DATABASE_URL`: lê a URL de conexão de arquivo privado. |
| `ADMIN_PASSWORD_FILE` | Sem valor | Alternativa a `ADMIN_PASSWORD`: lê a senha inicial do administrador de arquivo. |
| `ADMIN_EMAIL` | `admin@eeafr.local` no primeiro acesso local | E-mail da primeira conta, se ainda não houver usuários. |
| `ADMIN_PASSWORD` | Senha aleatória no modo local | Senha inicial; pelo menos 12 caracteres. Defina entre 12 e 200 para compatibilidade com o login. |
| `TRUST_PROXY` | Não configurado | Número de saltos de proxy confiáveis para o Express. |
| `PLAYWRIGHT_CHANNEL` | `msedge` | Canal de navegador utilizado apenas pelos testes de interface. |
| `TEST_DB_DRIVER` | PGlite nos testes | O valor `postgres` faz as suítes usarem bancos temporários no PostgreSQL local gerenciado. |
| `TEST_DATABASE_URL` | Sem valor | Conexão administrativa de teste PostgreSQL externa, como no CI; somente para criação de bancos temporários da suíte. |

Escolha `DATABASE_URL` **ou** a configuração separada `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` para evitar combinações ambíguas. Valores não definidos na conexão separada ficam sujeitos aos padrões do driver `pg` e do ambiente.

Não coloque credenciais reais no README, no `.env.example` ou em arquivos públicos. Reinicie o servidor após alterar a configuração.

Não configure simultaneamente uma variável de segredo e sua alternativa `_FILE`. Em produção, a configuração é validada antes de conectar: o backend recusa PGlite, runtime Windows gerenciado, conexão incompleta, `DATA_DIR` relativo ou `PUBLIC_URL` sem HTTPS. Use o [Compose de produção](../../compose.yaml) e o [guia Hostinger](../../deploy/HOSTINGER.md) para o caminho preparado.

<a id="banco"></a>

## Banco, inicialização e migrações

### PGlite local

```dotenv
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
DB_DRIVER=pglite
```

O backend cria `DATA_DIR/postgres` e persiste os dados em disco. Uploads são gravados em `DATA_DIR/uploads`. Não é um banco temporário: reiniciar a aplicação mantém os dados.

### PostgreSQL externo

Crie previamente o banco usando uma conta com permissão para isso. Depois configure, por exemplo:

```dotenv
DB_DRIVER=postgres
DATABASE_URL=postgresql://usuario:senha@localhost:5432/eeafr_database
DB_SSL=false
```

Os valores acima são exemplos, não credenciais fornecidas pelo projeto. O usuário da aplicação precisa de permissão para aplicar o schema e operar as tabelas. Para uma conexão SSL com certificado confiável, use `DB_SSL=true`.

O pool usa até **10 conexões**, timeout de conexão de **5 segundos** e até **três tentativas** na verificação inicial. Uma falha persistente impede o servidor de começar a atender. O código não faz reconexão/repetição automática de todas as operações de escrita.

Mudar o driver não migra dados entre bancos. Ambos usam o mesmo contrato SQL, mas a transferência de conteúdo é uma operação separada.

O script `db:migrate` automatiza especificamente a transferência do PGlite para o PostgreSQL local preparado por `db:setup`, conforme a seção seguinte.

### Ordem da inicialização

1. Cria o diretório de dados e conecta ao banco selecionado.
2. Abre uma transação; no PostgreSQL externo, utiliza também um bloqueio consultivo para essa fase.
3. Aplica [schema.sql](models/schema.sql), com criação das tabelas e alterações idempotentes existentes.
4. Aplica [seed.sql](models/seed.sql) se a migração `initial-content` ainda não foi registrada.
5. Aplica [calendar.sql](models/calendar.sql) se a migração `calendar-content` ainda não foi registrada.
6. Confirma a transação e verifica a criação do primeiro administrador.
7. Inicia o servidor HTTP.

O seed verifica se as tabelas estão vazias antes de inserir a carga principal. Ele também preenche detalhes dos cursos de IDs iniciais quando `sobre` está vazio. A carga de calendário verifica se já há registros com `tipo=calendario`. Não execute esses arquivos manualmente para atualizar conteúdo de uso diário; utilize o painel.

Com `SEED_CONTENT=false`, as cargas de referência não são aplicadas e seus identificadores são registrados. Ativar o seed depois não preenche automaticamente um banco já inicializado. Para levar o conteúdo de trabalho, importe o dump antes do primeiro início da aplicação, conforme o guia de produção.

[database.sql](models/database.sql) é um arquivo auxiliar do `psql` que inclui o schema. Não cria o banco, não substitui o fluxo automático de inicialização e não deve ser usado como comando de reset. Os antigos scripts `db:init`, `db:seed` e `db:reset` não existem no `package.json` atual.

### Tabelas

| Tabela | Conteúdo |
| --- | --- |
| `cursos` | Cursos e seus detalhes curriculares. |
| `eventos` | Eventos e registros de calendário, diferenciados por `tipo`. |
| `avisos` | Avisos e sinalização de urgência. |
| `comunicados` | Comunicados e categoria. |
| `galeria` | Metadados e caminho das fotos. |
| `professores` | Corpo docente por área. |
| `escola_dados` | Pares únicos `campo`/`valor`. |
| `contato_mensagens` | Mensagens, remetentes, data e estado de leitura. |
| `usuarios` | Nome, e-mail, hash de senha, perfil e estado da conta. |
| `sessoes` | Hash do token de sessão, usuário, CSRF e expiração. |
| `auditoria` | Autor, ação, recurso, identificador e data das alterações registradas. |
| `app_migrations` | Identificadores das cargas já aplicadas. |

<a id="postgres-local"></a>

## PostgreSQL local gerenciado

O projeto inclui instalação de **PostgreSQL 18.6 x64 para Windows**, obtida no [distribuidor EDB](https://www.enterprisedb.com/download-postgresql-binaries) indicado pela [página oficial do PostgreSQL](https://www.postgresql.org/download/windows/). O pacote tem URL e SHA256 fixados em [install-postgres.ps1](scripts/install-postgres.ps1). A instalação não registra serviço do Windows, não altera o PATH e não abre acesso à rede externa.

### Comandos

Estes comandos funcionam nesta pasta ou como atalhos na raiz:

| Comando | Ação |
| --- | --- |
| `npm run db:setup` | Obtém os binários quando ausentes, inicializa o cluster, inicia o banco e cria usuários e database. |
| `npm run db:migrate` | Copia o PGlite existente, valida os registros e altera o `.env` para PostgreSQL. Exige site parado e destino vazio. |
| `npm run db:start` | Inicia o cluster gerenciado quando ainda não está ativo. |
| `npm run db:status` | Conecta com a conta da aplicação e informa versão, banco, usuário e porta. |
| `npm run db:stop` | Encerra o cluster gerenciado com `pg_ctl`, sem remover dados. |
| `npm run db:backup` | Gera dump em formato custom e copia os uploads existentes. |

Para uma instalação já inicializada em PGlite, pare o site e execute:

```powershell
npm run db:setup
npm run db:migrate
npm start
```

Em um checkout novo, primeiro inicialize a aplicação em PGlite pelo fluxo normal, pare o site e execute essa sequência. `db:migrate` não inventa uma origem inexistente nem substitui um destino preenchido. Depois de migrar, não é necessário repetir o comando.

### Organização e acesso

```text
.data/
  postgres/                         PGlite original preservado
  uploads/                          Imagens utilizadas pelo site
  backups/                          Snapshots, dumps e cópias de uploads
  postgresql-local/
    pgsql/                          Binários, bibliotecas e suporte PostgreSQL
    cluster/                        Dados do PostgreSQL real
    connection.json                 Credenciais locais privadas
    migration-report.json           Contagens e hashes da transferência
    postgresql.log                  Log do servidor PostgreSQL
    postgresql-binaries.zip         Pacote de instalação verificado
```

O usuário `eeafr_owner` é usado somente para administração do cluster e preparação de bancos. A aplicação usa `eeafr_app`, sem privilégios de superusuário, criação de bancos, criação de roles ou replicação; ele é dono do banco específico da escola e de suas tabelas.

As senhas são geradas aleatoriamente e mantidas em arquivos locais ignorados pelo Git. O `.env` recebe apenas a conexão da aplicação. Não publique `connection.json`, backups, `.env` ou a pasta `.data`. As credenciais do banco são diferentes das credenciais de login no painel.

O cluster exige autenticação `scram-sha-256`, escuta somente em `127.0.0.1`, usa timezone UTC e normalmente porta 5432. Na primeira configuração, se 5432 estiver ocupada, tenta 5433. Não há TLS nessa conexão restrita ao computador; para hospedagem externa, configure SSL de acordo com o servidor.

Com `DB_DRIVER=postgres` e `DB_LOCAL_MANAGED=true`, `npm start` verifica/inicia esse cluster antes de conectar a API. Depois de reiniciar o Windows, basta iniciar o projeto novamente. Ctrl+C no site não para o PostgreSQL; para encerrar o banco, pare o site e use `db:stop`.

O diretório do runtime gerenciado fica sempre em `backend/.data/postgresql-local`. `DATA_DIR` continua controlando os uploads e a origem PGlite quando personalizada; não desloca automaticamente o cluster gerenciado.

### Garantias da transferência

O script de migração exige que a porta do site esteja livre e que a origem PGlite exista. Ele lê as 12 tabelas, salva um snapshot privado e uma cópia do `.env`, cria o schema no destino e insere os registros em transação. As sequências dos IDs são ajustadas; a comparação por SHA256 de cada tabela acontece antes do commit. O banco PGlite original não é apagado.

Somente após confirmar os dados, o script ativa a conexão PostgreSQL no `.env`. Se a gravação da configuração falhar depois do commit, o destino já estará preenchido; preserve ambos os bancos e corrija a configuração usando o relatório/credenciais, sem repetir uma importação sobre o destino. Uma falha durante a cópia em transação desfaz as alterações dessa cópia.

<a id="acesso"></a>

## Primeiro acesso, sessões e perfis

### Criação do administrador

Se a tabela `usuarios` estiver vazia, o backend cria a primeira conta com perfil `admin`.

- Em desenvolvimento, sem `ADMIN_PASSWORD`, gera uma senha aleatória e salva e-mail/senha em `DATA_DIR/primeiro-acesso.txt`.
- Com `ADMIN_PASSWORD`, usa a senha informada e não gera o arquivo de credenciais.
- Em produção, um banco sem usuários exige **ADMIN_EMAIL e ADMIN_PASSWORD** antes de iniciar.
- Se já houver qualquer usuário, o bootstrap não altera contas nem redefine senhas.

Entre em `/admin/`, abra **Minha conta** e troque a senha. O arquivo de primeiro acesso continua contendo a senha inicial; ele não acompanha trocas posteriores. A aplicação não fornece recuperação de senha por e-mail.

### Perfis

| Ação | `admin` | `editor` |
| --- | --- | --- |
| Gerenciar conteúdo e imagens | Sim | Sim |
| Consultar dashboard e atividades recentes | Sim | Sim |
| Ler, marcar e excluir mensagens | Sim | Sim |
| Alterar própria senha | Sim | Sim |
| Listar, criar ou alterar usuários | Sim | Não |

Não há endpoint DELETE para usuários: desative com `ativo=false`. O administrador não pode desativar a própria conta nem rebaixar seu próprio perfil para editor.

### Sessão e CSRF

O login bem-sucedido envia o cookie **`eeafr_session`**, com `HttpOnly`, `SameSite=Strict`, caminho `/` e validade de oito horas. Em produção, o cookie também é `Secure`, exigindo HTTPS. O banco armazena o hash do token, não o token de sessão em texto puro.

O login e `/auth/me` retornam `dados.csrf`. Nas requisições autenticadas de escrita, envie esse valor no cabeçalho **`X-CSRF-Token`**, juntamente com o cookie de sessão. O painel faz isso automaticamente.

Sair remove a sessão atual. Trocar a própria senha ou alterar uma conta revoga todas as sessões do usuário afetado, exigindo novo login.

As senhas usam scrypt com salt aleatório e comparação em tempo constante. Alterações de conteúdo, leitura/exclusão de mensagens e alterações de contas geram auditoria na mesma transação da operação. Login, logout, upload isolado e troca da própria senha não recebem entradas específicas nessa auditoria.

<a id="api"></a>

## Contratos HTTP e endpoints

### Formato de resposta

Sucesso de consulta ou atualização:

```json
{ "erro": false, "dados": { "id": 1, "titulo": "Exemplo" } }
```

Listagens normalmente retornam um array em `dados`. A exceção é `GET /api/escola`, que retorna um objeto de pares campo/valor. Exclusões retornam `dados: null`. Logout e troca de senha retornam apenas `{ "erro": false }`.

Erros:

```json
{ "erro": true, "mensagem": "Registro não encontrado." }
```

| Status | Situação |
| --- | --- |
| `200` | Consulta, atualização ou exclusão concluída. |
| `201` | Registro, mensagem ou upload criado. |
| `400` | Campos, formato ou identificador inválidos. |
| `401` | Login inválido, sessão ausente, expirada ou revogada. |
| `403` | Perfil sem permissão ou CSRF ausente/incorreto. |
| `404` | Recurso ou rota não encontrado. |
| `409` | Registro duplicado ou restrição de integridade. |
| `413` | Corpo da requisição ou arquivo maior que o limite. |
| `429` | Limite de tentativas atingido. |
| `500` | Falha interna; detalhes ficam no terminal do servidor. |

As respostas da API usam `Cache-Control: no-store`. Rotas desconhecidas sob `/api` retornam JSON 404; demais endereços desconhecidos recebem a página HTML 404.

### Autenticação e saúde

| Método | Endpoint | Acesso / corpo |
| --- | --- | --- |
| GET | `/api/health` | Público; executa consulta no banco e retorna `dados.status="ok"`. |
| POST | `/api/auth/login` | Público; `{email, senha}`. |
| GET | `/api/auth/me` | Autenticado; dados da conta e CSRF. |
| POST | `/api/auth/logout` | Autenticado + CSRF. |
| PUT | `/api/auth/senha` | Autenticado + CSRF; `{atual, nova}`. |

### Conteúdo institucional

Para **cada** recurso `cursos`, `eventos`, `avisos`, `comunicados`, `galeria` e `professores`:

| Método | Endpoint | Acesso |
| --- | --- | --- |
| GET | `/api/{recurso}` | Público; lista registros. |
| GET | `/api/{recurso}/:id` | Público; consulta registro por ID inteiro positivo. |
| POST | `/api/{recurso}` | Administrador/editor + CSRF; cria registro. |
| PUT | `/api/{recurso}/:id` | Administrador/editor + CSRF; atualiza os campos enviados. |
| DELETE | `/api/{recurso}/:id` | Administrador/editor + CSRF; exclui registro. |

Filtros implementados: `GET /api/eventos?tipo=evento`, `GET /api/eventos?tipo=calendario` e `GET /api/professores?area=Exatas`. Valores de áreas são sensíveis à grafia utilizada no cadastro.

A API retorna a listagem inteira; busca, filtros adicionais e paginação de dez itens são feitos pelo painel no navegador. Não há parâmetros de paginação no backend.

### Dados da escola

| Método | Endpoint | Acesso / corpo |
| --- | --- | --- |
| GET | `/api/escola` | Público; objeto `{campo: valor}`. |
| GET | `/api/escola/:campo` | Público; registro completo. |
| POST | `/api/escola` | Administrador/editor + CSRF; `{campo, valor}`. |
| PUT | `/api/escola/:campo` | Administrador/editor + CSRF; `{valor}`. |
| DELETE | `/api/escola/:campo` | Administrador/editor + CSRF. |

O identificador `campo` não é renomeado por PUT. Preserve os identificadores usados pelo frontend; nem todo campo cadastrado possui um componente público associado.

### Contato

| Método | Endpoint | Acesso / corpo |
| --- | --- | --- |
| POST | `/api/contato` | Público; `{nome, email, assunto, mensagem}`. Retorna o `id` do protocolo. |
| GET | `/api/contato` | Administrador/editor; lista mensagens da mais recente para a mais antiga. |
| PUT | `/api/contato/:id/lida` | Administrador/editor + CSRF; `{lida: true}` ou `{lida: false}`. |
| DELETE | `/api/contato/:id` | Administrador/editor + CSRF. |

O backend limita o login a **10 requisições por IP em 15 minutos**, e o envio de contato a **5 por IP em 15 minutos**. As contagens ficam na memória do processo. As requisições a essas rotas contam para o limite, inclusive as que falham na validação.

### Administração

| Método | Endpoint | Acesso / resultado |
| --- | --- | --- |
| GET | `/api/admin/resources` | Administrador/editor; metadados dos formulários de conteúdo. |
| GET | `/api/admin/stats` | Administrador/editor; contagens, cinco mensagens recentes e até 12 atividades recentes. |
| POST | `/api/admin/upload` | Administrador/editor + CSRF; imagem multipart. |
| GET | `/api/admin/usuarios` | Somente admin; contas sem hash de senha. |
| POST | `/api/admin/usuarios` | Somente admin + CSRF; `{nome, email, senha, papel, ativo}`. |
| PUT | `/api/admin/usuarios/:id` | Somente admin + CSRF; campos alterados, com `senha` opcional. |

<a id="recursos"></a>

## Campos e validação dos recursos

Os campos da tabela abaixo correspondem ao contrato da API. O [schema SQL](models/schema.sql) contém os valores padrão do banco; [resources.js](resources.js) define formulários e validação de conteúdo.

| Recurso | Obrigatórios na criação | Campos adicionais |
| --- | --- | --- |
| `cursos` | `nome` | `descricao`, `categoria`, `duracao`, `turno`, `certificacao`, `vagas`, `sobre`, `modulos`, `habilidades`, `carreira`. |
| `eventos` | `titulo`, `tipo` | `descricao`, `data_evento`, `hora_inicio`, `local_evento`, `destaque`. |
| `avisos` | `titulo`, `tipo` | `descricao`, `urgente`, `data_publicacao`. |
| `comunicados` | `titulo`, `tag` | `descricao`, `data_publicacao`. |
| `galeria` | `titulo`, `caminho_imagem` | `descricao`, `ordem`. |
| `professores` | `nome`, `area` | `disciplina`, `sigla`. |
| `escola` | `campo`, `valor` | Sem campos adicionais editáveis. |

| Campo | Valores aceitos |
| --- | --- |
| `eventos.tipo` | `evento`, `calendario`. |
| `avisos.tipo` | `informativo`, `importante`, `alerta`, `urgente`. |
| `comunicados.tag` | `novidade`, `resultado`, `homenagem`. |
| `professores.area` | `Linguagem`, `Exatas`, `Humanas`, `Tecnicos`. |
| `usuarios.papel` | `admin`, `editor`. |

Regras relevantes:

- PUT aceita atualização parcial, mas precisa conter ao menos um campo reconhecido aplicável. Campos extras não são persistidos.
- Textos são aparados nas extremidades; campos obrigatórios não aceitam texto vazio.
- Títulos têm até 200 caracteres; o nome do curso e o nome do usuário têm até 100.
- Campos longos de conteúdo têm até 20.000 caracteres, respeitando também o limite total do JSON de **64 KB**.
- `vagas` e `ordem` aceitam números inteiros JSON entre 0 e 100.000, não strings numéricas.
- Campos booleanos aceitam `true`/`false` JSON, não as strings `"true"`/`"false"`.
- Datas usam `AAAA-MM-DD`; vazio ou `null` é aceito nos campos de data opcionais.
- `campo` da escola deve começar com letra minúscula e conter apenas letras minúsculas, números e `_`, até 100 caracteres.
- No contato, nome, e-mail e assunto têm até 200 caracteres; a mensagem tem até 10.000. Todos são obrigatórios.
- Na criação de usuários, nome, e-mail e papel são obrigatórios; a senha também é exigida, com 12 a 200 caracteres. E-mails são normalizados para minúsculas.

<a id="exemplos"></a>

## Exemplos de consumo

Os exemplos abaixo usam **PowerShell**, com o servidor local iniciado. Criações e exclusões alteram o banco escolhido: use conteúdo de teste que você possa remover.

### Verificar saúde e consultar conteúdo

```powershell
$baseUrl = 'http://localhost:3000'
Invoke-RestMethod "$baseUrl/api/health"
Invoke-RestMethod "$baseUrl/api/cursos"
Invoke-RestMethod "$baseUrl/api/eventos?tipo=calendario"
```

### Autenticar sem gravar a senha no exemplo

```powershell
$acesso = Get-Credential -Message 'Informe o e-mail e a senha do painel'
$loginBody = @{
    email = $acesso.UserName
    senha = $acesso.GetNetworkCredential().Password
} | ConvertTo-Json

$login = Invoke-RestMethod "$baseUrl/api/auth/login" `
    -Method Post -ContentType 'application/json' `
    -Body $loginBody -SessionVariable sessaoEeafr

$csrfHeaders = @{ 'X-CSRF-Token' = $login.dados.csrf }

Invoke-RestMethod "$baseUrl/api/auth/me" -WebSession $sessaoEeafr
```

`-WebSession` mantém o cookie. `$csrfHeaders` autoriza as escritas dessa sessão; ambos precisam ser enviados nas operações autenticadas de alteração.

### Criar, atualizar e remover um evento de exemplo

```powershell
$eventoBody = @{
    titulo = 'Evento de teste da integração'
    descricao = 'Registro temporário criado pela API.'
    tipo = 'evento'
    data_evento = '2026-11-21'
    hora_inicio = '14h'
    local_evento = 'Pátio'
    destaque = $false
} | ConvertTo-Json

$criado = Invoke-RestMethod "$baseUrl/api/eventos" `
    -Method Post -WebSession $sessaoEeafr -Headers $csrfHeaders `
    -ContentType 'application/json' -Body $eventoBody

$eventoId = $criado.dados.id

Invoke-RestMethod "$baseUrl/api/eventos/$eventoId" `
    -Method Put -WebSession $sessaoEeafr -Headers $csrfHeaders `
    -ContentType 'application/json' `
    -Body (@{ titulo = 'Evento de teste atualizado' } | ConvertTo-Json)

Invoke-RestMethod "$baseUrl/api/eventos/$eventoId" `
    -Method Delete -WebSession $sessaoEeafr -Headers $csrfHeaders

Invoke-RestMethod "$baseUrl/api/auth/logout" `
    -Method Post -WebSession $sessaoEeafr -Headers $csrfHeaders
```

No navegador, o [código do painel](../admin/app.js) demonstra o uso de `fetch`, cookie de mesma origem e envio do cabeçalho CSRF.

<a id="uploads"></a>

## Uploads

Envie `multipart/form-data` para `/api/admin/upload`, com um único arquivo no campo **`imagem`**, cookie de sessão e CSRF. O limite é de **5 MB** por arquivo. O servidor mantém o arquivo em memória durante o recebimento, verifica a assinatura inicial de JPG, PNG ou WebP e grava em disco com nome UUID.

Exemplo de retorno:

```json
{
  "erro": false,
  "dados": { "caminho_imagem": "/uploads/identificador-gerado.png" }
}
```

Depois, use esse caminho em POST/PUT de `/api/galeria`. O upload e a criação do registro são operações separadas; apenas enviar o arquivo não publica uma foto na galeria.

Também são aceitos caminhos de imagens originais em `imagens/`, como `imagens/Escola/Patio.jpeg`. O campo não aceita URL externa, SVG, HTML, segmentos `..` ou extensões diferentes das permitidas.

Os arquivos enviados ficam em `DATA_DIR/uploads` e são públicos por `/uploads`. Não envie documentos privados nesse recurso. A validação de assinatura não faz reprocessamento completo, redimensionamento ou análise antivírus da imagem.

Excluir um registro da galeria não apaga o arquivo de imagem. Um upload cancelado no formulário também pode deixar um arquivo sem referência. A limpeza de arquivos não utilizados é uma tarefa de manutenção manual.

<a id="integracao"></a>

## Integração com o site e painel

| Origem | Endpoint usado | Destino público |
| --- | --- | --- |
| Cursos no painel | `/api/cursos` | Cards da home e abas da página de cursos. |
| Eventos e calendário | `/api/eventos` | Abas separadas conforme `tipo`. |
| Avisos e comunicados | `/api/avisos`, `/api/comunicados` | Abas da página de eventos. |
| Galeria | `/api/galeria` | Fotos, legendas e ordenação. |
| Corpo docente | `/api/professores` | Grades por área. |
| Dados da escola | `/api/escola` | Elementos vinculados, indicadores, contatos, gestores e mapa. |
| Formulário público | POST `/api/contato` | Caixa administrativa de mensagens. |
| Dashboard | `/api/admin/stats` | Indicadores, mensagens e atividades recentes. |
| Formulários do painel | `/api/admin/resources` | Campos definidos em `resources.js`. |

O site consulta os dados ao carregar; não há WebSocket ou atualização automática de outras abas. Depois de salvar no painel, recarregue a página pública.

### Dados da escola vinculados

O frontend usa atributos `data-school` e regras em [data.js](../js/data.js). Entre os campos reconhecidos estão:

- Identificação e contatos: `nome`, `telefone`, `email`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `instagram`, `horario`.
- Secretaria e indicadores: `cie`, `inep`, `diretoria_ensino`, `ideb`, `idesp`, `alunos_matriculados`, `turmas`, `professores_qtd`.
- Gestores: `diretora`, `vice_diretor_1`, `vice_diretor_2`, `coordenadora_1`, `coordenadora_2`.

Nem todo dado do banco aparece em todas as páginas. Novos identificadores precisam de um vínculo correspondente no HTML/JavaScript. Se um campo esperado for removido, partes do HTML podem manter a referência estática; para atualizar uma informação vinculada, prefira editar seu valor e preserve o identificador.

As estatísticas institucionais de alunos/professores são valores cadastrados em `escola_dados`; elas não representam uma contagem de matrículas ou um sistema acadêmico. A dashboard conta os registros efetivos das tabelas de conteúdo.

### Mesma origem e arquivos públicos

[server.js](server.js) serve `/`, `/index.html`, `/CSS`, `/js`, `/imagens`, `/pages`, `/admin` e `/uploads`. As chamadas usam `/api` na mesma origem. Não há configuração de CORS para um frontend hospedado separadamente.

Fontes do Google e mapa do Google Maps são recursos externos. Mudanças em domínios de recursos precisam ser compatíveis com a política CSP do servidor. A pasta do backend, `.env`, arquivos do banco e credenciais não são publicados como arquivos estáticos.

<a id="estrutura"></a>

## Estrutura interna

| Arquivo ou diretório | Responsabilidade |
| --- | --- |
| [server.js](server.js) | Ambiente, Helmet/CSP, JSON de até 64 KB, rotas públicas, API, 404 e ciclo de início/encerramento. |
| [api.js](api.js) | Endpoints, validação, limites por IP, upload, usuários, estatísticas e auditoria. |
| [auth.js](auth.js) | Bootstrap do administrador, hash de senha, login, cookie, CSRF e sessão. |
| [resources.js](resources.js) | Lista de recursos e metadados compartilhados entre API e painel. |
| [config/database.js](config/database.js) | Driver, conexão, transações e inicialização dos dados. |
| [middleware/errorHandler.js](middleware/errorHandler.js) | Respostas de erros HTTP, validação, integridade e upload. |
| [models/schema.sql](models/schema.sql) | Tabelas, restrições e alterações idempotentes atuais. |
| [models/seed.sql](models/seed.sql) | Conteúdo inicial reaproveitado do projeto. |
| [models/calendar.sql](models/calendar.sql) | Carga inicial do calendário original. |
| [scripts/check.js](scripts/check.js) | Verificação de sintaxe JavaScript. |
| [tests/api.test.js](tests/api.test.js) | Testes HTTP com banco temporário. |
| [browser-tests/site.spec.js](browser-tests/site.spec.js) | Testes funcionais de navegador. |
| [playwright.config.js](playwright.config.js) | Configuração do navegador e relatórios. |
| [scripts/install-postgres.ps1](scripts/install-postgres.ps1) | Download verificado e extração dos binários Windows x64. |
| [scripts/postgres-local.js](scripts/postgres-local.js) | Preparação, inicialização, status, encerramento e backup do PostgreSQL local. |
| [scripts/migrate-to-postgres.js](scripts/migrate-to-postgres.js) | Snapshot e transferência transacional do PGlite, com verificação de integridade. |
| [tests/database-fixture.js](tests/database-fixture.js) | Bancos isolados para executar as suítes com os dois drivers. |

As antigas pastas de controllers e rotas comentadas foram substituídas pelo registro de recursos e pelas rotas atuais em `api.js`.

<a id="testes"></a>

## Testes

Execute nesta pasta:

```powershell
npm run check
npm test
npm run test:browser
```

Os mesmos comandos estão disponíveis como atalhos no [package.json principal](../../package.json).

| Verificação | Cobertura |
| --- | --- |
| Sintaxe | Arquivos JavaScript do projeto, excluindo dependências e diretórios de dados/relatórios. |
| API | Conteúdo inicial, arquivos privados, autenticação, CSRF, CRUD, validações, contato, auditoria, upload, perfis, persistência e revogação após troca de senha. |
| Navegador | Páginas públicas, alterações do painel refletidas no site, contato recebido, leitura de mensagem, galeria, abas e mobile. |

Os testes HTTP iniciam um servidor na porta **3017**. Os testes de navegador usam **3018**, um worker e Edge por padrão. Os bancos de teste são criados em diretórios temporários e removidos ao término. Não rode duas execuções da mesma suíte simultaneamente nas mesmas portas.

Para usar Chromium gerenciado pelo Playwright em vez de Edge, a partir desta pasta:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run test:browser
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Falhas de navegador podem gerar capturas e traces em `test-results/`. Para abrir um trace, use `npx playwright show-trace` seguido do caminho do arquivo `trace.zip` gerado. O teste de capturas também escreve `.data/painel-desktop.png` e `.data/painel-celular.png`.

Por padrão, as suítes usam PGlite. Para usar o PostgreSQL local gerenciado, já preparado com `db:setup`:

```powershell
$env:TEST_DB_DRIVER = 'postgres'
npm test
npm run test:browser
Remove-Item Env:TEST_DB_DRIVER
```

Nesse modo, o fixture cria bancos com nomes aleatórios `eeafr_test_...`, utiliza a conta da aplicação nos servidores de teste e remove somente esses bancos ao terminar. O banco `eeafr_database` do site não é usado pelos testes. As credenciais de administração permanecem nos arquivos locais; não são impressas nos relatórios.

O navegador bloqueia HTTPS externo nos testes. As suítes não comprovam uma infraestrutura externa de produção, certificados, fontes ou mapa externos.

[production.test.js](tests/production.test.js) também verifica a configuração de produção, geração de secrets sem sobrescrita e, com `TEST_DB_DRIVER=postgres`, um servidor real em modo produção na porta 3019: leitura de arquivos privados, cookie Secure, bloqueio de origem incorreta e conteúdo inicial vazio.

A [workflow de CI](../../.github/workflows/ci.yaml) inclui PostgreSQL em serviço, testes de API/interface, build Docker e teste HTTPS local com certificado interno. `compose.smoke.yaml` é exclusivo desse teste; não use seu certificado interno no domínio público.

<a id="producao"></a>

## Produção

O caminho completo preparado para a Hostinger está em [deploy/HOSTINGER.md](../../deploy/HOSTINGER.md), com Docker, PostgreSQL e Caddy. Para outra implantação manual:

1. Disponibilize Node.js 22+, PostgreSQL, HTTPS e armazenamento persistente absoluto para `DATA_DIR`.
2. Instale as dependências com `npm ci --omit=dev` nesta pasta quando o ambiente não executar testes de navegador.
3. Configure `NODE_ENV=production`, `PUBLIC_URL=https://DOMINIO`, `PORT`, `DB_DRIVER=postgres` e a interface `HOST` exigidas pela hospedagem. Mantenha `DB_LOCAL_MANAGED=false`.
4. Para banco novo, defina `ADMIN_EMAIL` e uma `ADMIN_PASSWORD` de 12 a 200 caracteres.
5. Escolha PGlite em um único processo ou PostgreSQL externo para uma implantação com múltiplos processos. Compartilhe também os uploads entre instâncias quando houver mais de uma.
6. Configure o proxy para HTTPS e `TRUST_PROXY` de acordo com a cadeia real de proxies confiáveis. Um único salto conhecido pode usar `TRUST_PROXY=1`.
7. Inicie com `npm start` e verifique site, `/api/health`, login e envio de contato.
8. Faça um backup e confira os dados institucionais antes de disponibilizar à comunidade.

Em produção, abrir o painel apenas por HTTP não permite utilizar corretamente o cookie Secure. O limitador em memória é independente por processo; múltiplas instâncias não compartilham automaticamente a contagem de tentativas.

A hospedagem precisa executar o processo Node.js; publicar só os arquivos HTML não entrega o backend. O repositório fornece a configuração de implantação, mas não provisiona domínio, conta ou servidor automaticamente.

O JSON da API continua limitado a 64 KB; no proxy, uploads são limitados a 6 MB no total e a aplicação permite imagens de até 5 MB. O processo trata falhas na porta e tenta encerrar conexões e banco em até 15 segundos ao receber SIGTERM/SIGINT.

Os scripts de produção na raiz são `deploy:configure`, `deploy:package` e `deploy:export`. O pacote de código exclui dados e credenciais; a exportação privada contém o dump e os uploads. Scripts Linux de operação ficam em [deploy/](../../deploy/HOSTINGER.md).

<a id="backup"></a>

## Backup e restauração

### PGlite

1. Pare o servidor para obter uma cópia consistente.
2. Copie o diretório `DATA_DIR` inteiro para um destino restrito, fora da área pública.
3. Preserve banco, uploads e as configurações necessárias para a recuperação.
4. Para restaurar, mantenha o servidor parado e recoloque a cópia no diretório configurado.
5. Inicie novamente e confira saúde da API, login, conteúdo e imagens.

Não apague `.data` para resolver um erro de login: ela contém os dados de trabalho. Se personalizar `DATA_DIR`, o backup deve seguir o novo caminho.

### PostgreSQL externo

Faça backup do banco com `pg_dump` ou com o mecanismo da hospedagem e copie também `DATA_DIR/uploads`. A restauração do banco e dos arquivos precisa corresponder ao mesmo conjunto de dados. Teste a recuperação em ambiente separado antes de depender do backup.

### PostgreSQL local gerenciado

Execute `npm run db:backup`. O comando usa `pg_dump` em formato custom e grava `backend/.data/backups/eeafr-postgres-DATA.dump`. Os uploads existentes são copiados para a pasta `uploads-DATA` correspondente. O dump pode ser gerado com o banco ativo; para evitar mudanças entre os registros e a cópia de imagens, pare o site durante o backup completo.

A senha é entregue ao `pg_dump` por um arquivo de senha temporário, removido ao término, sem passar a senha na linha de comando. O comando de backup deve ser usado apenas para a instalação gerenciada; ele não seleciona automaticamente outro servidor configurado no `.env`.

Para restaurar, use o `pg_restore.exe` dos binários em `postgresql-local/pgsql/bin` contra um banco separado vazio, restaure os uploads correspondentes e verifique os dados antes de alterar a conexão da aplicação. Não restaure sobre o banco em uso sem um plano próprio de substituição. Uma cópia física de `postgresql-local/cluster` exige o cluster parado com `npm run db:stop`.

O banco contém mensagens, hashes de senhas e sessões. Proteja o backup e o `.env`; não coloque esses arquivos em repositório público. O `.gitignore` inclui os caminhos locais padrão, mas um `DATA_DIR` personalizado dentro do repositório precisa ser protegido também.

<a id="problemas"></a>

## Solução de problemas

| Problema | Diagnóstico e ação |
| --- | --- |
| `EADDRINUSE` | A porta já tem um processo escutando. Encerre a execução conhecida ou altere `PORT`. |
| Backend não iniciou | Leia o terminal. Em PostgreSQL, confira banco criado, conexão, permissões e SSL. |
| Banco novo recusa início em produção | Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` antes de iniciar. |
| Arquivo de primeiro acesso ausente | Pode haver usuários já cadastrados, senha inicial fornecida por ambiente ou `DATA_DIR` personalizado. |
| Senha do arquivo deixou de funcionar | O arquivo registra a senha inicial; use a senha alterada no painel. Mudar `.env` não redefine uma conta existente. |
| Falha no login em HTTP com produção ativa | Use HTTPS, necessário para o cookie Secure. |
| `401` após editar conta ou trocar senha | As sessões do usuário foram revogadas; entre novamente. |
| `403` em escrita manual na API | Confira cookie, cabeçalho CSRF e perfil autorizado. |
| `429` | Aguarde a janela de 15 minutos; confira também a configuração de proxy/IP. |
| Upload recusado | Campo multipart deve ser `imagem`, um arquivo JPG/PNG/WebP de até 5 MB. |
| Upload funciona, mas foto não aparece | Salve o registro da galeria com o caminho retornado e confira o arquivo em `/uploads`. |
| Conteúdo antigo no site | Recarregue a página, confira o banco/driver, o tipo do registro e o aviso de indisponibilidade da API. |
| Campo novo da escola não aparece | Adicione o vínculo apropriado no HTML/JavaScript; cadastrar um campo não gera layout. |
| Browser de testes não encontrado | Instale Edge ou configure um canal instalado conforme a seção de testes. |
| Testes não conseguem iniciar servidor | Confira se as portas 3017 e 3018 estão livres para as respectivas suítes. |
| PostgreSQL gerenciado não inicia | Execute `npm run db:status`, consulte `.data/postgresql-local/postgresql.log` e confira se a porta foi ocupada por outro processo. |
| Migração recusou o destino | O destino contém tabelas ou já está configurado. O script não apaga dados nem repete a transferência automaticamente. |
| Migração pede para parar o site | Encerre o processo do site com Ctrl+C antes de copiar a origem PGlite. |

<a id="limites"></a>

## Limites atuais

- O contato é armazenado no painel; não há envio de e-mail ou SMTP.
- Não há recuperação de senha por e-mail, rascunhos, publicação agendada ou atualização em tempo real de outras abas.
- O sistema não gerencia notas, frequência ou matrícula acadêmica.
- Parte do conteúdo institucional e do layout continua no HTML.
- A carga inicial reproduz informações do projeto recebido; indicadores, textos e datas precisam de validação da escola.
- Uploads não utilizados não têm limpeza automática e não são compartilhados automaticamente entre servidores.
- Os testes automatizados suportam PGlite e PostgreSQL local gerenciado; outra infraestrutura de produção exige validação no ambiente escolhido.

Para orientação de uso pela equipe, volte ao [guia principal do projeto](../../README.md#painel).
