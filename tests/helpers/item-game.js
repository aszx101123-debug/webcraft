'use strict';
const fs=require('node:fs'),path=require('node:path');
const THREE=require('../../pogl-game/vendor/three.min.js');
const root=path.join(__dirname,'../..');
const source=name=>fs.readFileSync(path.join(root,'js/game/'+name+'.js'),'utf8');
module.exports=function game(options={}) {
  const blocks=new Map(),listeners=new Set(),dirty=[],messages=[],spawns=[],storage=new Map();
  let loaded=true,rayTarget=null;
  const posKey=(x,y,z)=>x+','+y+','+z;
  const World={
    getBlock:(x,y,z)=>blocks.get(posKey(x,y,z))||(y<1?13:0),
    setBlock(x,y,z,id,record=true){
      if(y<1||y>=64||!loaded)return false;
      const old=this.getBlock(x,y,z);if(old===id)return false;
      if(id)blocks.set(posKey(x,y,z),id);else blocks.delete(posKey(x,y,z));
      for(const fn of listeners)fn(x,y,z,id,old,record);return true;
    },
    getChunk:()=>loaded?{}:null,heightAt:()=>1,biomeAt:()=> 'plains',getSeed:()=>123,
    getFluidLevel:()=>8,invalidateAt:(...p)=>dirty.push(p),
    onBlockChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    ensureChunkAt(){},applyRemoteBlock(x,y,z,id){return this.setBlock(x,y,z,id);},
    getEdits:()=>[...blocks],setInterestPoints(){},init(){}
  };
  const UI={showToast:t=>messages.push(t),renderHotbar(){},flashVignette(){}};
  const DropRecorder={spawn:(id,count,x,y,z,durability)=>spawns.push({id,count,x,y,z,durability})};
  const FurnitureStub={stateAt:()=>null};
  const Interact={getTouchDirection:()=>null,raycast:()=>rayTarget,getTarget:()=>rayTarget,tryPlace:()=>false};
  const Textures={getTexture:()=>null,tileUV:()=>({u0:0,u1:1,v0:0,v1:1})};
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const files=['config','noise','items','player','mobs','mobile-test-crafting','furnace-system','farming','item-actions','save'];
  const dropCode=options.realDrops?source('drops'):'const Drops=DropRecorder;';
  const document={getElementById:()=>null,createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})};
  const RemotePlayers={create:()=>({members(){},pose(){},update(){},dispose(){}})};
  const PlayerModel={getAppearance:()=>({})};
  const furnitureCode=options.realFurniture?source('block-furniture'):'const BlockFurniture=FurnitureStub;';
  const runtime=new Function('THREE','World','UI','DropRecorder','FurnitureStub','Interact','Textures','localStorage','Multiplayer','document','RemotePlayers','PlayerModel',
    dropCode+'\n'+files.map(source).join('\n')+'\n'+furnitureCode+'\n'+(options.multiplayerEngine?source('multiplayer-engine'):'')+
    '\nreturn {Inventory,Player,Mobs,Crafting,FurnaceSystem,Farming,ItemActions,SaveSystem,Noise,BLOCK,BLOCKS,ITEM,ITEMS,WOOL_TYPES,STORAGE_TYPES,CROP_TYPES,GAME_MODE,CONFIG,getItemDef,getMaxStack,getBlockDrop,isPlaceable,isFoodId,isBlockId,Drops,BlockFurniture'+(options.multiplayerEngine?',MultiplayerEngine':'')+'};')(
    THREE,World,UI,DropRecorder,FurnitureStub,Interact,Textures,localStorage,options.multiplayer,document,RemotePlayers,PlayerModel);
  const {Inventory,Player,Mobs,Farming,ItemActions,FurnaceSystem,GAME_MODE}=runtime;
  Inventory.init(GAME_MODE.SURVIVAL);Player.setMode(GAME_MODE.SURVIVAL);Player.reset(.5,1,.5,0,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.1,300);
  camera.position.set(.5,2.3,.5);camera.lookAt(.5,1.5,-5);camera.updateMatrixWorld(true);
  Mobs.init(scene);Mobs.setMode(GAME_MODE.SURVIVAL);
  if(options.realDrops)runtime.Drops.init(scene);
  Farming.init(null);FurnaceSystem.init(null);ItemActions.init(scene,camera,()=>.25);
  if(options.realFurniture)runtime.BlockFurniture.init(null);
  const hold=(id,count=1,durability)=>{
    Inventory.takeFromSlot(0);Inventory.putIntoSlot(0,{id,count,...(durability===undefined?{}:{durability})});Inventory.setSelected(0);
  };
  return {...runtime,THREE,World,UI,Interact,scene,camera,blocks,messages,spawns,dirty,storage,hold,
    ray:target=>{rayTarget=target;},loaded:v=>{loaded=v;},
    tickFarm:(seconds,time=.25)=>{for(let i=0;i<seconds;i++)Farming.update(1,time);},
    tickItems:seconds=>{for(let i=0;i<seconds;i++)ItemActions.update(1);}
  };
};
