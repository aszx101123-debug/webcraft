'use strict';

const MultiplayerEngine = (()=>{
  const coords=p=>p&&['x','y','z'].every(k=>Number.isInteger(p[k]))&&Math.abs(p.x)<=1000000&&Math.abs(p.z)<=1000000&&p.y>0&&p.y<CONFIG.HEIGHT;
  const key=p=>[p.x,p.y,p.z].join(',');
  const point=value=>typeof value==='string'?(()=>{const [x,y,z]=value.split(',').map(Number);return {x,y,z};})():value;
  const vector=p=>new THREE.Vector3(p.x,p.y,p.z);
  const q=n=>Math.round(n*1000)/1000;
  function bind({scene,state,seed,onResync,onStatus,onContainerDenied}){
    const context=Multiplayer.context,avatars=RemotePlayers.create(scene,context.id,context.server?24:3);
    let applying=false,batch=[],scheduled=false,busy=false,utilityBusy=false,arrowBusy=false,lastLeaseBeat=0;
    const actions=new Map(),pendingEdits=new Map(),canonicalBlocks=new Map();let canonicalVersion=0;
    const metadata=()=>({objects:BlockFurniture.serialize(),furnaces:FurnaceSystem.serialize(),farming:Farming.serialize()});
    const selfPose=()=>({x:q(Player.pos.x),y:q(Player.pos.y),z:q(Player.pos.z),yaw:q(Player.yaw),pitch:q(Player.pitch),
      speed:q(Math.hypot(Player.vel.x,Player.vel.z)),dead:Player.dead||!state.started,tool:Inventory.selectedId()||0,offhand:Inventory.getEquipment().offhand?.id||0,appearance:PlayerModel.getAppearance()});
    const peerPose=id=>id===context.id?selfPose():Multiplayer.poseFor(id);
    const peerPlayers=()=>Multiplayer.members.filter(m=>m.id!==context.id).map(m=>{
      const pose=Multiplayer.poseFor(m.id);return pose?{id:m.id,pos:vector(pose),dead:!!pose.dead}:null;
    }).filter(p=>p&&Date.now()-(Multiplayer.poseFor(p.id)?.seen||Date.now())<10000);
    function near(id,pos,reach=7){const pose=peerPose(id);return pose&&!pose.dead&&coords(pos)&&vector(pose).distanceTo(vector(pos))<reach;}
    function allowed(id,action,ms){const k=id+':'+action,now=Date.now();if(now-(actions.get(k)||0)<ms)return false;actions.set(k,now);return true;}
    function addStack(stack){
      if(!stack||!getItemDef(stack.id)||!Number.isInteger(stack.count)||stack.count<1||stack.count>64)return;
      let added=0;
      if(isToolId(stack.id)||isArmorId(stack.id)){
        const index=Inventory.getSlots().findIndex(s=>!s);
        if(index>=0&&!Inventory.putIntoSlot(index,{...stack,count:1}))added=1;
      }else added=Inventory.add(stack.id,stack.count);
      if(added<stack.count)void Multiplayer.request('drop',{id:stack.id,count:stack.count-added,durability:stack.durability});
      UI.renderHotbar();
    }
    function capacity(id){
      const def=getItemDef(id);if(!def)return 0;const max=getMaxStack(id);
      return Math.min(64,Inventory.getSlots().reduce((n,s)=>n+(!s?max:s.id===id?Math.max(0,max-s.count):0),0));
    }
    function wearStack(stack){
      if(Inventory.isCreative()||!stack||!getToolDef(stack.id))return;
      const index=Inventory.getSlots().indexOf(stack),offhand=Inventory.getEquipment().offhand===stack;
      if(index<0&&!offhand)return;
      stack.durability=Math.max(0,(stack.durability||getItemDef(stack.id).maxDurability)-1);
      if(!stack.durability){if(offhand)Inventory.takeEquipment('offhand');else Inventory.takeFromSlot(index);}
    }
    function readContainer(kind,raw){
      const pos=point(raw);if(!coords(pos))return null;
      return kind==='chest'?BlockFurniture.stateAt(pos.x,pos.y,pos.z):FurnaceSystem.getState(pos,true);
    }
    function containerState(kind,raw,value){
      const pos=point(raw);if(!coords(pos)||!value)return;
      const k=key(pos);
      if(kind==='chest'){
        const rows=new Map(BlockFurniture.serialize());rows.set(k,value);BlockFurniture.applyNetwork([...rows]);
      }else{
        const rows=new Map(FurnaceSystem.serialize().entries);rows.set(k,value);FurnaceSystem.applyNetwork({version:1,entries:[...rows]});
        if(UI.isFurnaceOpen())UI.renderFurnace();
      }
    }
    function owns(peer,kind,pos){
      const lease=Multiplayer.leases.get(Multiplayer.containerKey(kind,pos));
      return lease?.owner===peer&&lease.expires>Date.now();
    }
    function rejectEdit(value){
      const id=World.getBlock(value.x,value.y,value.z);return {ok:false,error:'conflict',id};
    }
    function edit(peer,value){
      if(!coords(value)||!Number.isInteger(value.id)||!Number.isInteger(value.old)||!BLOCKS[value.old]&&value.old!==0||
        value.id!==0&&!BLOCKS[value.id]||!near(peer,value))return {ok:false,error:'invalid'};
      World.ensureChunkAt(value.x,value.z);
      if(World.getBlock(value.x,value.y,value.z)!==value.old||BLOCKS[value.old]?.unbreakable)return rejectEdit(value);
      const reserved=['chest','furnace'].some(kind=>{
        const lease=Multiplayer.leases.get(Multiplayer.containerKey(kind,value));return lease&&lease.expires>Date.now()&&lease.owner!==peer;
      });
      if(reserved)return rejectEdit(value);
      if(value.id!==0&&!isPlaceable(value.id)&&!CROP_TYPES[value.id]&&value.id!==BLOCK.FARMLAND&&value.id!==BLOCK.WOOD_DOOR_TOP)return rejectEdit(value);
      if(value.id===BLOCK.WOOD_DOOR_TOP&&World.getBlock(value.x,value.y-1,value.z)!==BLOCK.WOOD_DOOR)return rejectEdit(value);
      if(value.old===BLOCK.CHEST&&value.id===0)BlockFurniture.releaseContents(value.x,value.y,value.z);
      if(value.old===BLOCK.FURNACE&&value.id===0)for(const stack of FurnaceSystem.remove(value))Drops.spawn(stack.id,stack.count,value.x+.5,value.y+.5,value.z+.5);
      const changed=World.setBlock(value.x,value.y,value.z,value.id);
      if(!changed)return rejectEdit(value);
      if(BLOCKS[value.id]?.shape){
        const rows=new Map(BlockFurniture.serialize());
        const facing=['north','south','east','west'].includes(value.meta?.facing)?value.meta.facing:'north';
        if(value.id===BLOCK.CHEST)rows.set(key(value),{facing,chest:Array(18).fill(null)});
        else if(value.id===BLOCK.STONE_SLAB)rows.set(key(value),{half:value.meta?.half==='top'?'top':'bottom'});
        else if(value.id===BLOCK.WOOD_STAIRS)rows.set(key(value),{facing});
        else if(value.id===BLOCK.WOOD_DOOR)rows.set(key(value),{facing,open:false});
        BlockFurniture.applyNetwork([...rows]);
      }
      if(state.mode===GAME_MODE.SURVIVAL&&value.id===0){
        const drop=value.old===BLOCK.WOOD_DOOR_TOP?BLOCK.WOOD_DOOR:getBlockDrop(value.old,Math.random,getToolDef(peerPose(peer)?.tool));
        if(drop)Drops.spawn(drop,1,value.x+.5,value.y+.5,value.z+.5);
      }
      return {ok:true,id:value.id};
    }
    function request(peer,action,value){
      if(!Multiplayer.ready||!peerPose(peer))return {ok:false,error:'disconnected'};
      if(action==='edit')return edit(peer,value);
      const pose=peerPose(peer);
      if(action==='door'){
        if(!near(peer,value)||!allowed(peer,'door',150))return {ok:false};
        World.ensureChunkAt(value.x,value.z);
        if(![BLOCK.WOOD_DOOR,BLOCK.WOOD_DOOR_TOP].includes(World.getBlock(value.x,value.y,value.z)))return {ok:false};
        BlockFurniture.toggleDoor(value.x,value.y,value.z);return {ok:true};
      }
      if(action==='attack'){
        if(!allowed(peer,'attack',430)||!value||!Number.isInteger(value.id)||!validAim(peer,value))return {ok:false};
        const tool=getToolDef(value.tool),damage=tool?.attackDamage||SURVIVAL.FIST_DMG;
        return {ok:!!Mobs.networkAttack(value.id,value.eye,value.direction,damage)};
      }
      if(action==='arrow'){
        if(!allowed(peer,'arrow',550)||!validAim(peer,value))return {ok:false};
        return {ok:Mobs.firePlayerArrow(value.eye,vector(value.direction).normalize(),6)};
      }
      if(action==='pickup'){
        if(state.mode!==GAME_MODE.SURVIVAL||!Number.isInteger(value?.id))return {ok:false};
        const stack=Drops.takeNetworkDrop(value.id,value.capacity,vector(pose));return stack?{ok:true,stack}:{ok:false};
      }
      if(action==='drop'){
        if(!getItemDef(value?.id)||!Number.isInteger(value.count)||value.count<1||value.count>64)return {ok:false};
        Drops.spawn(value.id,value.count,pose.x,pose.y+.8,pose.z,value.durability);return {ok:true};
      }
      if(action==='utility')return utilityRequest(peer,value);
      const pos=point(value?.pos),kind=value?.kind;
      if(!['chest','furnace'].includes(kind)||!near(peer,pos))return {ok:false,error:'invalid'};
      World.ensureChunkAt(pos.x,pos.z);
      if(World.getBlock(pos.x,pos.y,pos.z)!==(kind==='chest'?BLOCK.CHEST:BLOCK.FURNACE))return {ok:false,error:'missing'};
      const k=Multiplayer.containerKey(kind,pos),lease=Multiplayer.leases.get(k);
      if(action==='lock'){
        if(lease&&lease.expires>Date.now()&&lease.owner!==peer)return {ok:false,error:'locked'};
        Multiplayer.leases.set(k,{owner:peer,expires:Date.now()+10000});
        if(kind==='chest')BlockFurniture.ensureChest(pos.x,pos.y,pos.z);
        return {ok:true,state:readContainer(kind,pos)||{facing:'north',chest:Array(18).fill(null)}};
      }
      if(!owns(peer,kind,pos))return {ok:false,error:'locked'};
      if(action==='heartbeat'){lease.expires=Date.now()+10000;return {ok:true};}
      if(action==='release'){Multiplayer.leases.delete(k);return {ok:true};}
      if(action==='chest-deposit')return {ok:BlockFurniture.networkDeposit(pos,value.stack),state:readContainer(kind,pos)};
      if(action==='chest-withdraw'){
        const stack=BlockFurniture.networkWithdraw(pos,value.index);return {ok:!!stack,stack,state:readContainer(kind,pos)};
      }
      if(action==='furnace-interact'){
        const held=value.held;
        if(held&&(!getItemDef(held.id)||!Number.isInteger(held.count)||held.count<1||held.count>64))return {ok:false};
        const result=FurnaceSystem.interact(pos,value.slot,held,!!value.right);
        return {ok:true,cursor:result.cursor,state:readContainer(kind,pos)};
      }
      return {ok:false,error:'unsupported'};
    }
    function validAim(peer,value){
      return value?.eye&&value?.direction&&['x','y','z'].every(k=>Number.isFinite(value.eye[k])&&Number.isFinite(value.direction[k]))&&
        vector(value.eye).distanceTo(vector(peerPose(peer)))<2.5&&vector(value.direction).length()>.5&&vector(value.direction).length()<1.5;
    }
    function utilityRequest(peer,value){
      if(!value||!allowed(peer,'utility',300)||!validAim(peer,value))return {ok:false};
      if(value.action==='milk'||value.action==='shear'){
        if(value.action==='milk'?value.tool!==ITEM.BUCKET:getItemDef(value.tool)?.toolType!=='shears')return {ok:false};
        const result=Mobs.interactRay(value.eye,value.direction,4,value.action);
        return {ok:!!result?.success,items:result?.success?(value.action==='milk'?[{id:ITEM.MILK_BUCKET,count:1}]:[{id:BLOCK.WOOL_WHITE,count:3}]):[]};
      }
      if(!near(peer,value.target))return {ok:false};
      if(value.action==='fertilize'&&value.tool===ITEM.BONE_MEAL)return {ok:Farming.fertilize(value.target)};
      if(value.action==='forage'&&getItemDef(value.tool)?.toolType==='shears'){
        const items=Farming.forage(value.target);return {ok:!!items,items:items||[]};
      }
      return {ok:false};
    }
    function applyState(frame){
      if(!frame||typeof frame!=='object')return;
      if(Number.isFinite(frame.time)&&frame.time>=0&&frame.time<=1)state.time=frame.time;
      if(frame.metadata){BlockFurniture.applyNetwork(frame.metadata.objects);FurnaceSystem.applyNetwork(frame.metadata.furnaces);Farming.applyNetwork(frame.metadata.farming);}
      if(frame.entities)entities(frame.entities);
    }
    function entities(value){
      if(!value||typeof value!=='object')return;
      Mobs.applyNetwork(value.mobs);Drops.applyNetwork(value.drops);
      if(Number.isFinite(value.time)&&value.time>=0&&value.time<=1)state.time=value.time;
    }
    function commit(value){
      if(value?.kind!=='blocks'||!Array.isArray(value.changes)||value.changes.length>64)return;
      applying=true;
      try{for(const [x,y,z,id] of value.changes){World.applyRemoteBlock(x,y,z,id);canonicalBlocks.set([x,y,z].join(','),{id,version:++canonicalVersion});}
        while(canonicalBlocks.size>16384)canonicalBlocks.delete(canonicalBlocks.keys().next().value);
        if(Array.isArray(value.objects)){
          const rows=new Map(BlockFurniture.serialize());for(const entry of value.objects){const current=rows.get(entry[0])||{};rows.set(entry[0],{...current,...entry[1]});}BlockFurniture.applyNetwork([...rows]);
        }}finally{applying=false;}
    }
    function flush(){
      scheduled=false;if(!batch.length)return;
      const changes=batch;batch=[];
      for(let i=0;i<changes.length;i+=64){
        const part=changes.slice(i,i+64),keys=new Set(part.map(([x,y,z])=>[x,y,z].join(',')));
        const objects=BlockFurniture.serialize().filter(([k])=>keys.has(k)).map(([k,s])=>[k,{...(s.facing?{facing:s.facing}:{}),...(s.half?{half:s.half}:{}),...(typeof s.open==='boolean'?{open:s.open}:{})}]);
        Multiplayer.commit({kind:'blocks',changes:part,objects});
      }
    }
    function refundEdit(value){
      if(Inventory.isCreative())return;
      if(value.old===BLOCK.WATER&&value.id===BLOCK.AIR){Inventory.removeItem(ITEM.WATER_BUCKET,1);addStack({id:ITEM.BUCKET,count:1});}
      else if(value.id===BLOCK.WATER&&value.old===BLOCK.AIR){Inventory.removeItem(ITEM.BUCKET,1);addStack({id:ITEM.WATER_BUCKET,count:1});}
      else if(value.old>=BLOCK.WOOL_WHITE&&value.old<=BLOCK.WOOL_BLACK&&value.id>=BLOCK.WOOL_WHITE&&value.id<=BLOCK.WOOL_BLACK)addStack({id:400+value.id-BLOCK.WOOL_WHITE,count:1});
      else if(CROP_TYPES[value.id])addStack({id:CROP_TYPES[value.id].seed,count:1});
      else if(value.id!==BLOCK.AIR&&[BLOCK.AIR,BLOCK.WATER].includes(value.old)&&isPlaceable(value.id))addStack({id:value.id,count:1});
      else if(value.id===BLOCK.FARMLAND&&value.old===BLOCK.GRASS)Inventory.removeItem(ITEM.WHEAT_SEEDS,1);
    }
    const unsubscribe=World.onBlockChanged((x,y,z,id,old,record)=>{
      if(applying||Multiplayer.applying||record===false)return;
      if(context.host){batch.push([x,y,z,id]);if(!scheduled){scheduled=true;queueMicrotask(flush);}return;}
      const value={x,y,z,id,old},k=key(value);value.version=canonicalBlocks.get(k)?.version||0;pendingEdits.set(k,value);
      queueMicrotask(()=>{
        value.meta=BlockFurniture.stateAt(x,y,z);
        if(value.meta)value.meta={facing:value.meta.facing,half:value.meta.half};
        void Multiplayer.request('edit',value).then(result=>{
          if(!result.ok){
            if(pendingEdits.get(k)===value){const canonical=canonicalBlocks.get(k);applying=true;try{World.applyRemoteBlock(x,y,z,canonical&&canonical.version>value.version?canonical.id:Number.isInteger(result.id)?result.id:old);}finally{applying=false;}}
            refundEdit(value);UI.showToast('다른 변경이 먼저 적용되었습니다. 다시 시도해 주세요.');
          }
          if(pendingEdits.get(k)===value)pendingEdits.delete(k);
        });
      });
    });
    async function pickup(id){
      const row=Drops.networkSnapshot().find(row=>row[0]===id);if(!row)return;
      const result=await Multiplayer.request('pickup',{id,capacity:capacity(row[1])});if(result.ok)addStack(result.stack);
    }
    async function chestTransfer(raw,operation,index){
      if(busy)return false;const pos=point(raw);if(!coords(pos))return false;
      let stack=null;
      if(operation==='deposit'){
        const slot=Inventory.getSlots()[index];if(!slot)return false;
        stack=Inventory.takeFromSlot(index,slot.count);
      }else{
        const slot=BlockFurniture.stateAt(pos.x,pos.y,pos.z)?.chest?.[index];if(!slot||!Inventory.canAdd(slot.id,slot.count))return false;
      }
      busy=true;UI.renderHotbar();BlockFurniture.renderChest();
      try{
        const result=await Multiplayer.request('chest-'+operation,{kind:'chest',pos,index,stack});
        if(result.ok){containerState('chest',pos,result.state);if(result.stack)addStack(result.stack);}
        else{if(stack)addStack(stack);UI.showToast('상자 이동을 완료하지 못했습니다. 다시 시도해 주세요.');}
      }finally{busy=false;BlockFurniture.renderChest();UI.renderHotbar();}
      return true;
    }
    async function furnaceInteract(pos,slot,held,right){
      if(busy)return {ok:false};busy=true;
      const wireHeld=held?{...held,count:Math.min(64,Number.isFinite(held.count)?held.count:64)}:null;
      try{const result=await Multiplayer.request('furnace-interact',{kind:'furnace',pos,slot,held:wireHeld,right});
        if(result.ok)containerState('furnace',pos,result.state);return result;
      }finally{busy=false;}
    }
    async function furnaceDeposit(pos,index){
      if(busy)return;const stack=Inventory.getSlots()[index];if(!stack)return;
      const slot=FurnaceSystem.accepts('input',stack.id)?'input':FurnaceSystem.accepts('fuel',stack.id)?'fuel':null;if(!slot)return;
      const removed=Inventory.takeFromSlot(index,stack.count);UI.renderHotbar();
      const result=await furnaceInteract(pos,slot,removed,false);
      if(result.ok){if(result.cursor)addStack(result.cursor);}else addStack(removed);
      UI.renderFurnace();
    }
    async function furnaceWithdraw(pos,slot){
      if(busy)return;const stack=FurnaceSystem.getState(pos)?.[slot];if(!stack||!Inventory.canAdd(stack.id,stack.count))return;
      const result=await furnaceInteract(pos,slot,null,false);if(result.ok&&result.cursor)addStack(result.cursor);UI.renderFurnace();
    }
    async function utility(action,target,hand,eye,direction){
      if(utilityBusy||!Multiplayer.ready)return;const stack=hand==='offhand'?Inventory.getEquipment().offhand:Inventory.selectedSlot();if(!stack)return;
      if(action==='milk'&&!Inventory.canExchangeHeld(hand,ITEM.MILK_BUCKET))return;
      utilityBusy=true;
      try{
        const result=await Multiplayer.request('utility',{action,target,tool:stack.id,eye:{x:eye.x,y:eye.y,z:eye.z},direction:{x:direction.x,y:direction.y,z:direction.z}});
        if(!result.ok){UI.showToast('지금은 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');return;}
        const index=Inventory.getSlots().indexOf(stack),offhand=Inventory.getEquipment().offhand===stack;
        if(index<0&&!offhand)return;
        if(!Inventory.isCreative()){
          if(action==='milk'||action==='fertilize'){if(offhand)Inventory.consumeOffhand();else Inventory.takeFromSlot(index,1);}
          else wearStack(stack);
        }
        for(const item of result.items||[])addStack(item);
        UI.renderHotbar();
      }finally{utilityBusy=false;}
    }
    async function fireArrow(hand,eye,direction){
      if(arrowBusy||!Multiplayer.ready)return;
      const stack=hand==='offhand'?Inventory.getEquipment().offhand:Inventory.selectedSlot();
      if(getItemDef(stack?.id)?.toolType!=='bow')return;
      const consumed=!Inventory.isCreative();
      if(consumed&&!Inventory.removeItem(ITEM.ARROW,1))return;
      arrowBusy=true;UI.renderHotbar();
      try{
        const result=await Multiplayer.request('arrow',{eye:{x:eye.x,y:eye.y,z:eye.z},direction:{x:direction.x,y:direction.y,z:direction.z}});
        if(result.ok){wearStack(stack);Player.addExhaustion(SURVIVAL.ATTACK_COST);}
        else{if(consumed)addStack({id:ITEM.ARROW,count:1});UI.showToast('화살을 발사하지 못했습니다. 다시 시도해 주세요.');}
      }finally{arrowBusy=false;UI.renderHotbar();}
    }
    Mobs.setNetwork({replica:!context.host,players:peerPlayers,localActive:()=>state.started,
      damage:(peer,amount,cause,source)=>Multiplayer.event({kind:'damage',amount,cause,source:{x:source.x,y:source.y,z:source.z}},peer),
      attack:(id,eye,direction)=>{const used=Inventory.selectedSlot();void Multiplayer.request('attack',{id,eye:{x:eye.x,y:eye.y,z:eye.z},direction:{x:direction.x,y:direction.y,z:direction.z},tool:used?.id||0}).then(result=>{if(result.ok){wearStack(used);Player.addExhaustion(SURVIVAL.ATTACK_COST);UI.renderHotbar();}});},
      arrow:(eye,direction)=>{void Multiplayer.request('arrow',{eye:{x:eye.x,y:eye.y,z:eye.z},direction:{x:direction.x,y:direction.y,z:direction.z}});}});
    Drops.setNetwork({replica:!context.host,pickup,spawn:stack=>{void Multiplayer.request('drop',stack);}});
    const adapter={selfPose,request,commit,containerState,readContainer,utility,fireArrow,chestTransfer,furnaceDeposit,furnaceWithdraw,furnaceInteract,
      toggleDoor:pos=>{void Multiplayer.request('door',pos);},
      containerBusy:()=>busy,
      snapshot:()=>({meta:{seed,mode:state.mode,generatorVersion:2,gameVersion:CONFIG.VERSION},edits:World.getEdits(),
        spawn:{x:Player.spawnPoint.x,y:Player.spawnPoint.y,z:Player.spawnPoint.z},time:state.time,metadata:metadata(),entities:{mobs:Mobs.networkSnapshot(),drops:Drops.networkSnapshot()}}),
      sharedState:()=>({time:state.time,metadata:metadata()}),
      entities:()=>({mobs:Mobs.networkSnapshot(),drops:Drops.networkSnapshot(),time:state.time}),
      initial:snapshot=>{applyState(snapshot);entities(snapshot.entities);},
      snapshotReceived:snapshot=>{
        World.init(scene,seed,snapshot.edits,2);BlockPhysics.init();Fluids.init();applyState(snapshot);entities(snapshot.entities);pendingEdits.clear();canonicalBlocks.clear();onResync?.();
      },
      applyState,
      event:data=>{
        if(data?.kind==='entities')entities(data.value);
        else if(data?.kind==='damage'&&Number.isFinite(data.amount)&&data.amount>0&&data.amount<=40&&data.source&&['x','y','z'].every(k=>Number.isFinite(data.source[k])))Player.damage(data.amount,String(data.cause||'몹의 공격').slice(0,80),data.source);
      },
      members:members=>{avatars.members(members);const label=document.getElementById('mp-members');if(label)label.textContent=context.server?'접속 '+Multiplayer.onlineCount+'/100 · 주변 '+Math.max(0,members.length-1)+'명':members.map(p=>p.name).join(' · ');},
      region:value=>{applying=true;try{World.mergeRemoteEdits(value.edits);applyState({metadata:value.metadata});}finally{applying=false;}},
      correction:pos=>{Player.pos.set(pos.x,pos.y,pos.z);Player.vel.set(0,0,0);},
      pose:(id,pose)=>avatars.pose(id,pose),
      frame:dt=>{avatars.update(dt);if(context.host)World.setInterestPoints(peerPlayers().map(p=>p.pos));},
      networkTick:()=>{
        const now=Date.now();for(const [k,l] of Multiplayer.leases)if(l.expires<now)Multiplayer.leases.delete(k);
        if(now-lastLeaseBeat<3000)return;lastLeaseBeat=now;
        for(const [k,l] of Multiplayer.leases)if(l.owner===context.id){const split=k.indexOf(':'),kind=k.slice(0,split),pos=point(k.slice(split+1));
          void Multiplayer.request('heartbeat',{kind,pos}).then(result=>{if(result.ok)l.expires=Date.now()+10000;else Multiplayer.leases.delete(k);});}
      },status:onStatus,toast:UI.showToast,containerDenied:onContainerDenied,
      dispose:()=>{unsubscribe();avatars.dispose();Mobs.setNetwork(null);Drops.setNetwork(null);World.setInterestPoints([]);}
    };
    Multiplayer.bind(adapter);
    return adapter;
  }
  return {bind};
})();
