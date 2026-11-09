'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
// Persistent volumes may be mounted as root. Initialize ownership, then run the game unprivileged.
const uid=1000,gid=1000,file=process.env.DATA_FILE||'/data/webcraft.sqlite',directory=path.dirname(file);
if(process.getuid?.()===0){
  fs.mkdirSync(directory,{recursive:true});fs.chownSync(directory,uid,gid);
  for(const suffix of ['','-wal','-shm'])if(fs.existsSync(file+suffix))fs.chownSync(file+suffix,uid,gid);
}
const child=spawn(process.execPath,[path.join(__dirname,'index.cjs')],{
  stdio:'inherit',...(process.getuid?.()===0?{uid,gid}:{})
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code??0));
