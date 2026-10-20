const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const project=path.resolve(__dirname,'../../..');
const rootFiles=['README.md','LICENSE','package.json','Dockerfile','compose.yaml','.dockerignore','.gitignore','.gitattributes','.env.production.example'];
const allowedFile=file=>!['.env','.env.production','.git'].includes(path.basename(file))&&!/\.(?:log|dump|zip|tgz|gz|png)$/i.test(file);
async function copyTree(source,destination) {
 for(const item of await fs.readdir(source,{withFileTypes:true})){
  if(['node_modules','.data','test-results','playwright-report','secrets','backups','import','.git'].includes(item.name))continue;
  if(item.isSymbolicLink())throw new Error('Link simbólico inesperado no pacote: '+item.name);
  const target=path.join(destination,item.name);const original=path.join(source,item.name);
  if(original===path.join(project,'projeto-TCC','backend','backend'))continue;
  if(item.isDirectory()){await fs.mkdir(target,{recursive:true});await copyTree(original,target);}
  else if(allowedFile(original))await fs.copyFile(original,target);
 }
}
async function pack(){
 const tag='eeafr-production-'+new Date().toISOString().replace(/[:.]/g,'-');
 const release=path.join(project,'release');const directory=path.join(release,tag);await fs.mkdir(directory,{recursive:true});
 for(const file of rootFiles)await fs.copyFile(path.join(project,file),path.join(directory,file));
 for(const folder of ['deploy','.github']){await fs.mkdir(path.join(directory,folder));await copyTree(path.join(project,folder),path.join(directory,folder));}
 const site=path.join(directory,'projeto-TCC');await fs.mkdir(site);
 await fs.copyFile(path.join(project,'projeto-TCC','index.html'),path.join(site,'index.html'));
 for(const folder of ['CSS','js','pages','admin','backend']){await fs.mkdir(path.join(site,folder));await copyTree(path.join(project,'projeto-TCC',folder),path.join(site,folder));}
 // Original images are public assets and are intentionally included.
 await fs.cp(path.join(project,'projeto-TCC','imagens'),path.join(site,'imagens'),{recursive:true,dereference:false});
 const archive=path.join(release,tag+'.tar.gz');
 await new Promise((resolve,reject)=>{const child=spawn('tar',['-czf',archive,'-C',release,tag],{windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Falha ao compactar o pacote.')));});
 const hash=crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex');await fs.writeFile(archive+'.sha256',hash+'  '+path.basename(archive)+'\n');
 console.log('Pacote de código: '+archive);console.log('O pacote não contém banco, credenciais ou uploads privados. Para os dados, use deploy:export.');
}
pack().catch(error=>{console.error(error.message);process.exitCode=1;});
