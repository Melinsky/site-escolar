const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const local=require('./postgres-local');
async function exportData(){
 const backup=await local.backup();
 const tag='eeafr-data-'+new Date().toISOString().replace(/[:.]/g,'-');
 const parent=path.join(local.backend,'.data','exports');const folder=path.join(parent,tag);
 await fs.mkdir(path.join(folder,'uploads'),{recursive:true,mode:0o700});
 await fs.copyFile(backup.dump,path.join(folder,'database.dump'));
 if(backup.uploads)await fs.cp(backup.uploads,path.join(folder,'uploads'),{recursive:true,errorOnExist:false,force:false});
 const hash=crypto.createHash('sha256').update(await fs.readFile(path.join(folder,'database.dump'))).digest('hex');
 await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),format:'postgres-custom',database:'eeafr_database',sha256:hash},null,2));
 const archive=path.join(parent,tag+'.tar.gz');await local.run('tar',['-czf',archive,'-C',folder,'database.dump','uploads','manifest.json']);
 console.log('Pacote PRIVADO de dados: '+archive);console.log('Contém mensagens e contas: transfira por SSH/SCP e não coloque em repositório público.');
}
exportData().catch(error=>{console.error(error.message);process.exitCode=1;});
