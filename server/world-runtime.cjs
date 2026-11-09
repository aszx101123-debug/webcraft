'use strict';
const fs=require('node:fs'),path=require('node:path');
const THREE=require('../pogl-game/vendor/three.min.js');
const source=name=>fs.readFileSync(path.join(__dirname,'../js/game',name+'.js'),'utf8');
const MAX_LOADED=1024,VIEW=6;
function makeWorld({CONFIG,BLOCKS,Terrain},seed,snapshot){
  const gen=Terrain.makeGen(seed,2),chunks=new Map(),edits=new Map(snapshot?.edits?.map(([k,v])=>[k,new Map(v)])||[]),editCache=new Map(snapshot?.edits||[]),listeners=new Set();
  const entries=key=>{if(!editCache.has(key))editCache.set(key,[...edits.get(key)]);return editCache.get(key);};
  const key=(x,z)=>(x>>4)+','+(z>>4);
  const world={
    ensureChunkAt(x,z){
      const k=key(x,z);if(chunks.has(k)){const value=chunks.get(k);chunks.delete(k);chunks.set(k,value);return;}
      const data=gen.genChunk(x>>4,z>>4);for(const [i,id] of edits.get(k)||[])data[i]=id;
      if(chunks.size>=MAX_LOADED)chunks.delete(chunks.keys().next().value);
      chunks.set(k,{data,cx:x>>4,cz:z>>4});
    },
    getChunk:(cx,cz)=>chunks.get(cx+','+cz),
    getBlock(x,y,z){if(y<0||y>=CONFIG.HEIGHT)return 0;return chunks.get(key(x,z))?.data[Terrain.idx(x&15,y,z&15)]||0;},
    setBlock(x,y,z,id,record=true){
      if(![x,y,z,id].every(Number.isInteger)||y<0||y>=CONFIG.HEIGHT||Math.abs(x)>1000000||Math.abs(z)>1000000||id!==0&&!BLOCKS[id])return false;
      const k=key(x,z),ch=chunks.get(k);if(!ch)return false;
      const i=Terrain.idx(x&15,y,z&15),old=ch.data[i];if(old===id)return false;
      ch.data[i]=id;if(record){if(!edits.has(k))edits.set(k,new Map());edits.get(k).set(i,id);editCache.delete(k);}
      for(const fn of listeners)fn(x,y,z,id,old,record);return true;
    },
    getEdits:()=>[...edits.keys()].map(k=>[k,entries(k)]),
    editsNear(p){const cx=Math.floor(p.x)>>4,cz=Math.floor(p.z)>>4,result=[];for(const key of edits.keys()){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)<=VIEW&&Math.abs(z-cz)<=VIEW)result.push([key,entries(key)]);}return result;},
    onBlockChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    heightAt:(x,z)=>gen.heightAt(x,z),biomeAt:(x,z)=>gen.biomeAt(x,z),getSeed:()=>seed,
    invalidateAt(){},setInterestPoints(){},getFluidLevel:(x,y,z)=>world.getBlock(x,y,z)===12?8:0,
    loadedCount:()=>chunks.size
  };
  return world;
}
function nearbyEntries(entries,pos){
  return (entries||[]).filter(([key])=>{const [x,,z]=key.split(',').map(Number);return Math.abs(x-pos.x)<=112&&Math.abs(z-pos.z)<=112;});
}
class WorldRuntime{
  constructor({id,mode,seed,saved,peers,onCommit,onEvent}){
    this.id=id;this.seed=saved?.meta?.seed||seed;this.mode=mode;this.revision=0;this.peers=peers;this.pending=[];this.spawn=saved?.spawn||null;
    const multiplayer={context:{id:'dedicated_server',host:true,serverWorker:true},active:true,isHost:true,ready:true,applying:false,leases:new Map(),
      get members(){return [...peers.values()].map(p=>({id:p.identity.id,name:p.identity.name}));},
      poseFor:peer=>peers.get(peer)?.pose,
      containerKey:(kind,pos)=>kind+':'+(typeof pos==='string'?pos:[pos.x,pos.y,pos.z].join(',')),
      commit:value=>{this.revision++;this.pending.push({revision:this.revision,value});onCommit?.(value);},
      event:(value,peer)=>onEvent?.(peer,value),bind:adapter=>{this.adapter=adapter;}};
    const stubs={getElementById:()=>null,createElement:()=>({getContext:()=>null})};
    const renderer={create:()=>({members(){},pose(){},update(){},dispose(){}})};
    const code=['config','noise','terrain-legacy','terrain'].map(source).join('\n')+
      '\nconst World=makeWorld({CONFIG,BLOCKS,Terrain},seed,snapshot);\n'+
      ['items','player','mobs','drops','farming','furnace-system','block-furniture','block-physics','multiplayer-engine'].map(source).join('\n')+
      '\nreturn {CONFIG,BLOCK,BLOCKS,GAME_MODE,World,Inventory,Player,Mobs,Drops,Farming,FurnaceSystem,BlockFurniture,BlockPhysics,MultiplayerEngine,getItemDef};';
    this.game=new Function('THREE','makeWorld','seed','snapshot','Multiplayer','document','RemotePlayers','PlayerModel','Textures','UI',code)(
      THREE,makeWorld,this.seed,saved,multiplayer,stubs,renderer,{getAppearance:()=>({})},
      {getTexture:()=>null,tileUV:()=>({u0:0,u1:1,v0:0,v1:1})},{renderHotbar(){},showToast(){}});
    const g=this.game;this.version=g.CONFIG.VERSION;
    if(!this.spawn){let x=8,z=8;for(let i=0;i<400&&g.World.heightAt(x,z)<=g.CONFIG.SEA+1;i++){x+=11;z+=7;}
      this.spawn={x:x+.5,y:g.World.heightAt(x,z)+2.5,z:z+.5};}
    this.state={mode,started:false,time:saved?.time??.22};
    g.Inventory.init(mode);g.Player.setMode(mode);g.Player.reset(this.spawn.x,this.spawn.y,this.spawn.z);
    const scene=new THREE.Scene();g.Mobs.init(scene);g.Mobs.setMode(mode);g.Drops.init(scene);
    g.BlockFurniture.init(saved?.metadata?.objects);g.FurnaceSystem.init(saved?.metadata?.furnaces);g.Farming.init(saved?.metadata?.farming);g.BlockPhysics.init();
    this.multiplayer=multiplayer;g.MultiplayerEngine.bind({scene,state:this.state,seed:this.seed});
    // Restore dropped items after restart; mob populations are regenerated by the simulation.
    for(const row of saved?.entities?.drops||[])if(Array.isArray(row)&&row.length===7&&g.getItemDef(row[1]))g.Drops.spawn(row[1],row[2],row[3],row[4],row[5],row[6]||undefined);
    this.ensureArea(this.spawn);
  }
  ensureArea(pos){const x=Math.floor(pos.x),z=Math.floor(pos.z);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.game.World.ensureChunkAt(x+dx*16,z+dz*16);}
  request(peer,action,value){return this.adapter.request(peer,action,value);}
  tick(dt){
    const g=this.game;this.state.time=(this.state.time+dt/g.CONFIG.DAY_LENGTH)%1;
    g.Mobs.setEnv(this.state.time<.18||this.state.time>.8,this.state.time<.18||this.state.time>.8?.2:1);
    g.BlockPhysics.update(dt);g.FurnaceSystem.update(dt);g.Farming.update(dt,this.state.time);
    g.Mobs.update(dt,true);g.Drops.update(dt,g.Player.pos,false);
    for(const [key,lease] of this.multiplayer.leases)if(lease.expires<Date.now()||!this.peers.has(lease.owner))this.multiplayer.leases.delete(key);
  }
  snapshot(pos=this.spawn){
    return {meta:{seed:this.seed,mode:this.mode,generatorVersion:2,gameVersion:this.version},spawn:this.spawn,time:this.state.time,
      edits:this.game.World.editsNear(pos),metadata:this.metadataNear(this.adapter.sharedState().metadata,pos),entities:this.entitiesNear(this.adapter.entities(),pos)};
  }
  persistenceEvent(changes,value){
    const keys=new Set(changes.flatMap(change=>(change.value.changes||[]).map(([x,y,z])=>[x,y,z].join(','))));
    for(const pos of [value,value?.pos,value?.target])if(pos&&['x','y','z'].every(k=>Number.isInteger(pos[k]))){keys.add([pos.x,pos.y,pos.z].join(','));keys.add([pos.x,pos.y-1,pos.z].join(','));}
    const metadata=this.adapter.sharedState().metadata,filter=rows=>(rows||[]).filter(([key])=>keys.has(key));
    return {keys:[...keys],changes:changes.flatMap(c=>c.value.changes||[]),objects:filter(metadata.objects),furnaces:filter(metadata.furnaces?.entries),
      crops:filter(metadata.farming?.crops),foraged:filter(metadata.farming?.foraged),drops:this.game.Drops.networkSnapshot(),time:this.state.time};
  }
  persistentSnapshot(){const snapshot=this.adapter.snapshot();snapshot.spawn=this.spawn;return snapshot;}
  metadataNear(metadata,pos){
    return {objects:nearbyEntries(metadata.objects,pos),furnaces:{version:1,entries:nearbyEntries(metadata.furnaces?.entries,pos)},
      farming:{version:1,crops:nearbyEntries(metadata.farming?.crops,pos),foraged:nearbyEntries(metadata.farming?.foraged,pos)}};
  }
  entitiesNear(entities,pos){
    const near=(row,x,z)=>Math.abs(row[x]-pos.x)<112&&Math.abs(row[z]-pos.z)<112;
    return {mobs:{mobs:(entities?.mobs?.mobs||[]).filter(r=>near(r,2,4)),arrows:(entities?.mobs?.arrows||[]).filter(r=>near(r,1,3))},
      drops:(entities?.drops||[]).filter(r=>near(r,3,5)),time:this.state.time};
  }
  frame(pos,metadata=false,shared=null){
    const value=this.entitiesNear(shared?.entities||this.adapter.entities(),pos);if(metadata)value.metadata=this.metadataNear(shared?.metadata||this.adapter.sharedState().metadata,pos);return value;
  }
  drain(){const values=this.pending;this.pending=[];return values;}
  dispose(){this.adapter.dispose();this.game.Mobs.reset();this.game.Drops.reset();}
}
module.exports={WorldRuntime,makeWorld,nearbyEntries};
