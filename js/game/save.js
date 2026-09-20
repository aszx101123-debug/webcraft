'use strict';

const SaveSystem=(()=>{
  const WORLDS_KEY=CONFIG.SAVE_KEY+'_worlds';
  const SCHEMA_VERSION=1;

  function makeId(){
    if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();
    return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }

  function safeName(name){
    const n=String(name??'').trim().replace(/[<>:"/\\|?*]/g,'').slice(0,32);
    return n||'새로운 월드';
  }

  function readStore(){
    try{
      const raw=localStorage.getItem(WORLDS_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        if(parsed&&parsed.worlds&&typeof parsed.worlds==='object')return parsed;
      }
    }catch(e){}
    const store={version:SCHEMA_VERSION,currentWorldId:null,worlds:{}};
    try{
      const legacy=localStorage.getItem(CONFIG.SAVE_KEY);
      if(legacy){
        const data=JSON.parse(legacy);
        if(data&&typeof data==='object'&&data.seed!=null){
          const id=makeId();
          const now=Date.now();
          store.worlds[id]={id,name:'기존 월드',seed:data.seed,createdAt:now,updatedAt:now,data};
          store.currentWorldId=id;
          localStorage.setItem(WORLDS_KEY,JSON.stringify(store));
        }
      }
    }catch(e){}
    return store;
  }

  function writeStore(store){
    try{localStorage.setItem(WORLDS_KEY,JSON.stringify(store));return true;}
    catch(e){return false;}
  }

  function listWorlds(){
    const store=readStore();
    return Object.values(store.worlds).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(w=>({
      id:w.id,name:w.name,seed:w.seed,createdAt:w.createdAt,updatedAt:w.updatedAt,
      mode:(w.data&&w.data.mode)||w.mode||'survival'
    }));
  }

  function currentId(){return readStore().currentWorldId||null;}

  function getWorldMeta(id){
    if(!id)return null;
    return readStore().worlds[id]||null;
  }

  function createWorld(name,seed,mode){
    const store=readStore();
    const id=makeId();
    const finalSeed=seed!=null&&String(seed).trim()!==''?seed:(Math.floor(Math.random()*2147483646)+1);
    const now=Date.now();
    store.worlds[id]={id,name:safeName(name),seed:finalSeed,createdAt:now,updatedAt:now,data:null,mode:mode||'survival'};
    store.currentWorldId=id;
    if(!writeStore(store))throw new Error('월드 저장 공간이 부족합니다.');
    return id;
  }

  function save(data,id,name){
    const store=readStore();
    let worldId=id||store.currentWorldId;
    if(!worldId)worldId=makeId();
    const existing=store.worlds[worldId];
    const now=Date.now();
    store.worlds[worldId]={
      id:worldId,
      name:safeName(name||((existing&&existing.name)||data.worldName||'새로운 월드')),
      seed:data.seed,
      createdAt:(existing&&existing.createdAt)||now,
      updatedAt:now,
      data
    };
    store.currentWorldId=worldId;
    return writeStore(store)?true:false;
  }

  function load(id){
    const store=readStore();
    const worldId=id||store.currentWorldId;
    if(!worldId)return null;
    const w=store.worlds[worldId];
    if(!w||!w.data)return null;
    store.currentWorldId=worldId;
    writeStore(store);
    return w.data;
  }

  function setCurrent(id){
    const store=readStore();
    if(!store.worlds[id])return false;
    store.currentWorldId=id;
    return writeStore(store);
  }

  function rename(id,name){
    const store=readStore();
    const w=store.worlds[id];
    if(!w)return false;
    w.name=safeName(name);
    w.updatedAt=Date.now();
    return writeStore(store);
  }

  function remove(id){
    const store=readStore();
    if(!store.worlds[id])return false;
    delete store.worlds[id];
    if(store.currentWorldId===id){
      const rest=Object.values(store.worlds).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      store.currentWorldId=rest[0]?rest[0].id:null;
    }
    return writeStore(store);
  }

  function clear(){
    const store=readStore();
    const id=store.currentWorldId;
    if(id)remove(id);
    try{localStorage.removeItem(CONFIG.SAVE_KEY);}catch(e){}
  }

  return{save,load,clear,listWorlds,currentId,getWorldMeta,createWorld,setCurrent,rename,remove};
})();
