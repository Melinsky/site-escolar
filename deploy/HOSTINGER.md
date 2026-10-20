# Publicação na Hostinger — VPS com Docker

Este guia prepara o **site, painel, PostgreSQL e imagens** para o servidor real. A aplicação permanece em Node.js e PostgreSQL. Nenhuma conta de hospedagem, domínio ou assinatura é criada pelos scripts.

**Voltar:** [README principal](../README.md) · [Backend](../projeto-TCC/backend/README.md) · [Compose](../compose.yaml)

## Qual ambiente da Hostinger utilizar

Este pacote foi preparado para um **VPS Linux com Docker e Docker Compose**, como o template Docker Ubuntu oferecido pela Hostinger. PostgreSQL na própria infraestrutura da Hostinger exige VPS, conforme a [documentação da Hostinger](https://support.hostinger.com/en/articles/1583659-is-postgresql-supported-at-hostinger). Veja também o [template Docker](https://support.hostinger.com/en/articles/8306612-how-to-use-the-docker-vps-template).

A Hostinger também oferece [aplicações Node.js em planos Business e Cloud](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). Esse é outro caminho, que exige banco externo e solução própria para persistência das imagens. Os comandos Docker deste guia são para VPS; não devem ser executados como uma publicação de arquivos PHP em `public_html`.

## O que está preparado

| Componente | Configuração |
| --- | --- |
| Aplicação | Imagem Node.js 22, dependências travadas e usuário sem privilégios de root. |
| PostgreSQL | Versão 18.6, usuário próprio da aplicação e volume persistente. |
| HTTPS | Caddy com emissão/renovação automática de certificado para o domínio informado. |
| Acesso externo | Apenas portas 80 e 443; a porta do banco e a porta Node não são publicadas. |
| Imagens enviadas | Volume persistente, mantido nas atualizações. |
| Senhas | Arquivos de secrets separados do código e do pacote público. |
| Verificação | Healthcheck consulta a aplicação e o banco antes de liberar o proxy. |
| Busca | `robots.txt` e sitemap usam o domínio de produção; painel e API indicam ausência de indexação. |
| Operação | Reinício automático dos containers, rotação de logs e scripts de backup/restauração. |

O certificado automático depende de DNS apontando para o VPS e portas 80/443 acessíveis. Não é emitido no computador local antes de existir um domínio. Referência: [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https).

## 1. Gerar os pacotes no computador

Na raiz do projeto:

```powershell
npm run deploy:package
```

O resultado fica em `release/eeafr-production-DATA.tar.gz`, junto do arquivo SHA256. Esse pacote contém código, imagens originais e arquivos de implantação. Não inclui `.env`, banco local, senhas, relatórios ou a instalação Windows do PostgreSQL.

Para levar os **dados atuais**, pare o site local com Ctrl+C e execute:

```powershell
npm run deploy:export
npm start
```

O exportador usa o PostgreSQL local gerenciado e cria um pacote privado em `projeto-TCC/backend/.data/exports/eeafr-data-DATA.tar.gz`, contendo:

- `database.dump`: dados, contas e mensagens, em formato custom do PostgreSQL.
- `uploads/`: imagens enviadas.
- `manifest.json`: data e hash SHA256 do dump.

Os pacotes de código e dados são separados. O pacote de dados deve ser transferido por SSH/SCP e guardado fora de qualquer repositório público. Ele não inclui as senhas em texto puro da instalação Windows; inclui os hashes das contas do painel.

## 2. Preparar domínio e VPS

Quando tiver o servidor:

1. Selecione uma instalação Linux com Docker Engine e Compose atuais.
2. Confirme acesso SSH com o usuário autorizado a usar Docker.
3. Aponte o registro DNS A do domínio para o IPv4 do VPS.
4. Se publicar AAAA, ele deve apontar para o IPv6 correto do mesmo servidor.
5. Libere SSH conforme sua configuração e as portas HTTP 80/TCP e HTTPS 443/TCP; 443/UDP é usada pelo HTTP/3.
6. Preserve acesso ao DNS e ao e-mail que receberá avisos do certificado.

Não é necessário abrir 5432 ou 3000 na internet. Este Compose utiliza um único domínio e uma única instância de aplicação; não configure um CDN/proxy adicional sem revisar o tratamento de IP e `TRUST_PROXY`.

## 3. Transferir o código

Exemplo no PowerShell local, substituindo o caminho do arquivo e o IP reais:

```powershell
scp "CAMINHO/eeafr-production-DATA.tar.gz" root@IP_DO_VPS:/tmp/eeafr-production.tar.gz
scp "CAMINHO/eeafr-data-DATA.tar.gz" root@IP_DO_VPS:/tmp/eeafr-data.tar.gz
ssh root@IP_DO_VPS
```

No terminal Linux do VPS:

```sh
mkdir -p /opt/eeafr
tar -xzf /tmp/eeafr-production.tar.gz -C /opt/eeafr --strip-components=1
cd /opt/eeafr
docker version
docker compose version
```

O usuário e o IP acima são exemplos; use o acesso fornecido pelo seu servidor. Não é necessário instalar Node.js no host: a aplicação e o configurador podem rodar com a imagem Node do Docker.

## 4. Gerar a configuração real

No VPS, substitua domínio e e-mails:

```sh
sh deploy/configure.sh \
  --domain escola.seudominio.com.br \
  --email responsavel@seudominio.com.br \
  --admin-email admin@seudominio.com.br
```

O comando cria `.env.production` e três arquivos privados em `deploy/secrets/`. Ele recusa sobrescrever uma configuração existente. As senhas são geradas aleatoriamente, sem aparecer no terminal.

O diretório de secrets é privado. Os arquivos permitem leitura ao usuário sem privilégios dentro do container, pois o Compose utiliza montagem direta dos arquivos. Mantenha a permissão do diretório em `0700` no VPS e não publique seu conteúdo.

Valide e monte a aplicação:

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build app
```

Use sempre `--env-file .env.production`. O arquivo `.env` de desenvolvimento do backend não deve ser enviado ao servidor; ele também é excluído do contexto Docker.

## 5. Importar o banco e as imagens existentes

Faça este passo **antes de iniciar a aplicação pela primeira vez**:

```sh
tar -xzf /tmp/eeafr-data.tar.gz -C deploy/import
sh deploy/restore.sh
docker compose --env-file .env.production up -d --build --wait --wait-timeout 180
```

O script sobe o banco, confirma que o destino não contém tabelas, restaura em transação e copia os uploads. Se o destino estiver preenchido, ele cancela sem apagar os dados. As tabelas restauradas ficam sob o usuário da aplicação. Sessões copiadas do computador são invalidadas; contas e senhas do painel são preservadas.

Depois da importação, use o **mesmo login do painel local**. A senha em `deploy/secrets/admin_password.txt` só cria uma conta quando o banco não possui usuários.

Se quiser começar um site vazio, pode omitir a importação e executar `up` diretamente. Nesse caso será criada a primeira conta indicada na configuração. A carga de conteúdo de exemplo fica desativada em produção; cadastre/revise o conteúdo pelo painel. Não inicie vazio se a intenção for restaurar o banco existente depois, pois a criação de tabelas fará o importador recusar o destino preenchido.

## 6. Conferir a publicação

```sh
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 100 app proxy
curl --fail https://escola.seudominio.com.br/api/health
```

Confirme no navegador:

1. Domínio abre em HTTPS sem aviso de certificado.
2. `/api/health` responde com `dados.status` igual a `ok`.
3. Login em `/admin/` funciona, e logout encerra a sessão.
4. Uma edição de teste aparece na página pública após recarregar.
5. Upload aparece na galeria e continua disponível após reiniciar a aplicação.
6. Contato gera protocolo e chega à caixa de mensagens.
7. `/backend/.env` e `/.env` respondem 404.
8. Eventos, indicadores, informações da escola e conteúdo de privacidade foram conferidos pela equipe.

Os arquivos `compose.smoke.yaml` e `Caddyfile.smoke` são exclusivos de teste local/CI e usam certificado interno. **Não os inclua no comando de produção pública.** O Compose principal usa certificados públicos do Caddy.

## 7. Backup e atualizações

Para backup:

```sh
sh deploy/backup.sh
```

O resultado fica em `deploy/backups/DATA/`, com dump, cópia dos uploads e lista de conteúdo do dump. Copie também para armazenamento restrito fora do VPS. O script não envia arquivos a terceiros nem configura uma rotina de agendamento.

Para uma cópia de banco e imagens sem mudanças concorrentes, pare `app` e `proxy`, faça o backup e suba novamente:

```sh
docker compose --env-file .env.production stop app proxy
sh deploy/backup.sh
docker compose --env-file .env.production up -d --wait --wait-timeout 180
```

Para atualizar o código, mantenha `.env.production`, `deploy/secrets/` e os volumes. Transfira/extraia a nova versão e execute:

```sh
sh deploy/update.sh
```

O script gera backup, constrói a imagem e aguarda os serviços. Confira novamente os fluxos públicos após a atualização. Se precisar parar temporariamente:

```sh
docker compose --env-file .env.production stop
```

Não use `down -v` ou limpeza de volumes no servidor de trabalho: isso remove banco e imagens. Atualizar a versão principal do PostgreSQL exige um plano de migração; não basta trocar `18` por outra versão no Compose.

## Segurança e configuração

- O usuário da aplicação não é superusuário do banco.
- A API exige PostgreSQL e `DATA_DIR` absoluto no modo produção.
- Escritas de navegador são limitadas à origem HTTPS configurada em `PUBLIC_URL`.
- A sessão utiliza cookies HttpOnly, Secure e SameSite, além de CSRF nas escritas autenticadas.
- O banco está em rede interna do Compose; HTTPS termina no Caddy, que encaminha à aplicação.
- Secrets e backups não são copiados para a imagem Docker nem para o pacote de código.
- Mensagens de contato são guardadas no painel. Não há SMTP ou recuperação de senha por e-mail configurados.

Se optar por um PostgreSQL hospedado em outro provedor, use a configuração externa documentada no [backend](../projeto-TCC/backend/README.md#ambiente), incluindo SSL e certificado CA quando necessário. Essa alternativa precisa de adaptação da implantação para o serviço escolhido.

## Verificação disponível antes da contratação

Foram preparados testes da API em produção com PostgreSQL, cookies Secure, CSRF/origem, leitura de secrets e ausência de carga de exemplo. O Docker Compose pode ser validado sem executar os containers. A [workflow de CI](../.github/workflows/ci.yaml) inclui build da imagem e teste HTTPS local com o Compose quando o projeto for enviado a um repositório GitHub.

A execução da imagem Docker e a emissão do certificado público precisam ser conferidas em um ambiente com Docker e, no caso do certificado público, com o domínio e DNS reais. Enquanto o VPS não existir, não há como validar as características específicas dessa máquina ou garantir ausência de qualquer erro de infraestrutura.
