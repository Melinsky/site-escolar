const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const project=path.resolve(__dirname,'../../..');
function validateInput(domain,email,adminEmail) {
 if(typeof domain!=='string'||domain.length>253||!domain.includes('.')||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))throw new Error('Informe o domínio completo, sem https://, porta ou caminho.');
 for(const value of [email,adminEmail])if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(value||'')||value.length>200)throw new Error('Informe e-mails válidos para certificado e administrador.');
 return {APP_DOMAIN:domain,ACME_EMAIL:email,ADMIN_EMAIL:adminEmail};
}
async function configure(directory,input) {
 const envFile=path.join(directory,'.env.production');
 if(await fs.stat(envFile).catch(()=>null))throw new Error('.env.production já existe. Não sobrescrevi credenciais. Edite somente os dados públicos se necessário.');
 const secrets=path.join(directory,'deploy','secrets');await fs.mkdir(secrets,{recursive:true,mode:0o700});
 for(const name of ['postgres_owner_password','postgres_app_password','admin_password']){
  const file=path.join(secrets,name+'.txt');
  if(await fs.stat(file).catch(()=>null))throw new Error('Há arquivos de segredo anteriores. Preserve-os e confira a configuração existente.');
 }
 for(const name of ['postgres_owner_password','postgres_app_password','admin_password']){
  // Compose mounts file secrets directly. The private parent folder protects the
  // host files; read permission is needed by the non-root application container.
  await fs.writeFile(path.join(secrets,name+'.txt'),crypto.randomBytes(32).toString('base64url')+'\n',{flag:'wx',mode:0o444});
 }
 await fs.writeFile(envFile,Object.entries(input).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
 await fs.mkdir(path.join(directory,'deploy','import'),{recursive:true,mode:0o700});
 await fs.mkdir(path.join(directory,'deploy','backups'),{recursive:true,mode:0o700});
 console.log('Configuração criada. Senhas não foram exibidas.');
 console.log('A senha inicial do painel está em deploy/secrets/admin_password.txt; se importar um banco existente, mantenha o login desse banco.');
}
module.exports={validateInput,configure};
if(require.main===module){
 const args=process.argv.slice(2);const get=name=>args[args.indexOf(name)+1];
 try{const input=validateInput(args.includes('--domain')?get('--domain'):undefined,args.includes('--email')?get('--email'):undefined,args.includes('--admin-email')?get('--admin-email'):undefined);configure(project,input).catch(e=>{console.error(e.message);process.exitCode=1;});}
 catch(error){console.error(error.message+' Use --domain escola.seudominio.com.br --email contato@seudominio.com.br --admin-email admin@seudominio.com.br');process.exitCode=1;}
}
