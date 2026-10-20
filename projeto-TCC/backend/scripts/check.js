const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'../..');
let count=0;
function walk(folder){for(const file of fs.readdirSync(folder,{withFileTypes:true})){
 if(['node_modules','.data','test-results','playwright-report'].includes(file.name))continue;
 const full=path.join(folder,file.name);
 if(full===path.join(root,'backend','backend'))continue; // Original misplaced copy retained locally.
 if(file.isDirectory())walk(full);
 else if(file.name.endsWith('.js')){const result=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(1);}count++;}
}}
walk(root);console.log(`${count} arquivos JavaScript verificados.`);
