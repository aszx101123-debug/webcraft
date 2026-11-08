'use strict';

const ItemActions = (() => {
  let scene=null,camera=null,getTime=()=>.25,clock=0,lastShot=-10,guardUntil=0,guardHand='main';
  let fishing=null,bobber=null,line=null;
  const held=hand=>hand==='offhand'?Inventory.getEquipment().offhand:Inventory.selectedSlot();
  const consume=hand=>hand==='offhand'?Inventory.consumeOffhand():Inventory.consumeSelected();
  const result=(success,message)=>{if(message)UI.showToast(message);if(success)UI.renderHotbar();return {handled:true,success};};
  const pass=()=>({handled:false,success:false});
  function give(id,count=1) {
    const added=Inventory.add(id,count);
    if(added<count)Drops.spawn(id,count-added,Player.pos.x,Player.pos.y+.7,Player.pos.z);
  }
  function aim() {
    return Interact.getTouchDirection()||camera.getWorldDirection(new THREE.Vector3());
  }
  function clearFishing() {
    for(const object of [bobber,line])if(object){
      scene.remove(object);object.geometry.dispose();object.material.dispose();
    }
    bobber=line=fishing=null;
  }
  function cancel() {guardUntil=0;if(scene)clearFishing();}
  function init(scene_,camera_,time) {
    cancel();scene=scene_;camera=camera_;getTime=time||getTime;clock=0;lastShot=-10;
    Player.onBeforeDamage=filterDamage;
  }
  function filterDamage(amount,cause,from) {
    if(!from||clock>=guardUntil||held(guardHand)?.id!==ITEM.SHIELD)return amount;
    const dx=from.x-Player.pos.x,dz=from.z-Player.pos.z,length=Math.hypot(dx,dz)||1;
    if((-Math.sin(Player.yaw)*dx-Math.cos(Player.yaw)*dz)/length<.1)return amount;
    Inventory.damageHeld(guardHand,Math.max(1,Math.ceil(amount*2)));
    UI.renderHotbar();UI.showToast('방패로 공격을 막았습니다');return 0;
  }
  function canUse(id) {
    const d=getItemDef(id);
    return !!d&&(!!d.plant||!!d.food||['hoe','bow','shears','fishing','shield'].includes(d.toolType)||
      [ITEM.BUCKET,ITEM.WATER_BUCKET,ITEM.BONE_MEAL,ITEM.COMPASS,ITEM.CLOCK].includes(id)||id>=400&&id<=415);
  }
  function use(target,hand='main') {
    const stack=hand==='empty'?null:held(hand),id=stack?.id,d=getItemDef(id);
    if(target&&CROP_TYPES[target.id]&&id!==ITEM.BONE_MEAL){
      if(Farming.harvest(target))return result(true,'작물을 수확했습니다');
      if(!stack)return result(false,'성장 '+Farming.progressAt(target.x,target.y,target.z)+'% · 물과 빛이 있으면 잘 자랍니다');
    }
    if(!stack)return pass();
    if(d.plant&&target?.id===BLOCK.FARMLAND){
      if(!Farming.plant(target,id))return result(false,'위에 빈 공간이 있는 경작지에 심어 주세요');
      consume(hand);return result(true,getItemName(id)+' 심기');
    }
    if(d.toolType==='hoe'&&target&&[BLOCK.GRASS,BLOCK.DIRT].includes(target.id)){
      if(target.face?.[1]!==1||World.getBlock(target.x,target.y+1,target.z)!==BLOCK.AIR)return result(false,'흙 위를 비운 뒤 윗면에 사용하세요');
      if(!World.setBlock(target.x,target.y,target.z,BLOCK.FARMLAND))return result(false);
      if(target.id===BLOCK.GRASS&&!Inventory.isCreative())give(ITEM.WHEAT_SEEDS);
      Inventory.damageHeld(hand);return result(true,'경작지를 만들었습니다 · 씨앗을 심어 보세요');
    }
    if(id===ITEM.BONE_MEAL){
      if(!Farming.fertilize(target))return result(false,'자라고 있는 작물에 사용하세요');
      consume(hand);return result(true,'작물이 자랐습니다');
    }
    if(id===ITEM.BUCKET){
      if(!Inventory.canExchangeHeld(hand,ITEM.WATER_BUCKET))return result(false,'가득 찬 양동이를 넣을 빈 칸이 필요합니다');
      const animal=Mobs.interactRay(camera.position,aim(),4,'milk');
      if(animal?.success){Inventory.exchangeHeld(hand,ITEM.MILK_BUCKET,true);return result(true,'우유를 담았습니다');}
      if(animal?.cooldown)return result(false,'소에게 잠시 후 다시 사용해 주세요');
      const hit=Interact.raycast(CONFIG.REACH,true);
      if(!hit||hit.id!==BLOCK.WATER)return result(false,'물의 수원에 사용하거나 소를 바라보고 사용하세요');
      if(!World.setBlock(hit.x,hit.y,hit.z,BLOCK.AIR))return result(false);
      Inventory.exchangeHeld(hand,ITEM.WATER_BUCKET,true);return result(true,'물을 담았습니다');
    }
    if(id===ITEM.WATER_BUCKET){
      if(!target?.face)return result(false,'물을 놓을 블록 면을 바라보세요');
      const x=target.x+target.face[0],y=target.y+target.face[1],z=target.z+target.face[2];
      if(y<1||y>=CONFIG.HEIGHT||World.getBlock(x,y,z)!==BLOCK.AIR)return result(false,'빈 공간에 물을 놓아 주세요');
      if(!Inventory.canExchangeHeld(hand,ITEM.BUCKET)||!World.setBlock(x,y,z,BLOCK.WATER))return result(false);
      Inventory.exchangeHeld(hand,ITEM.BUCKET);return result(true,'물을 놓았습니다');
    }
    if(d.toolType==='shears'){
      const animal=Mobs.interactRay(camera.position,aim(),4,'shear');
      if(animal?.success){give(BLOCK.WOOL_WHITE,3);Inventory.damageHeld(hand);return result(true,'양털 3개를 깎았습니다');}
      if(animal?.cooldown)return result(false,'양털이 다시 자랄 때까지 기다려 주세요');
      const gathered=Farming.forage(target);
      if(!gathered)return target?.id===BLOCK.GRASS?result(false,'풀이 다시 자랄 때까지 기다려 주세요'):pass();
      for(const item of gathered)give(item.id,item.count);
      Inventory.damageHeld(hand);return result(true,gathered.map(x=>getItemName(x.id)+' +'+x.count).join(' · '));
    }
    if(id>=400&&id<=415){
      if(!target||target.id<BLOCK.WOOL_WHITE||target.id>BLOCK.WOOL_BLACK)return result(false,'놓여 있는 양털 블록에 사용하거나 제작 창에서 염색하세요');
      const next=WOOL_TYPES[id-400].block;
      if(target.id===next)return result(false,'이미 같은 색입니다');
      if(!World.setBlock(target.x,target.y,target.z,next))return result(false);
      consume(hand);return result(true,'양털을 염색했습니다');
    }
    if(d.toolType==='bow'){
      if(clock-lastShot<.6)return result(false);
      if(!Inventory.isCreative()&&Inventory.countItem(ITEM.ARROW)<1)return result(false,'화살이 필요합니다');
      if(!Mobs.firePlayerArrow(camera.position,aim(),6))return result(false,'지금은 더 발사할 수 없습니다');
      if(!Inventory.isCreative())Inventory.removeItem(ITEM.ARROW,1);
      Inventory.damageHeld(hand);Player.addExhaustion(SURVIVAL.ATTACK_COST);lastShot=clock;
      return result(true);
    }
    if(d.toolType==='shield'){guardUntil=clock+1.6;guardHand=hand;return result(true,'방패 방어 · 정면 공격을 막습니다');}
    if(id===ITEM.COMPASS){
      const p=Player.spawnPoint,dx=p.x-Player.pos.x,dz=p.z-Player.pos.z;
      const direction=Math.abs(dx)>Math.abs(dz)?(dx>0?'동쪽':'서쪽'):(dz>0?'남쪽':'북쪽');
      return result(true,'리스폰 지점: '+direction+' · '+Math.round(Math.hypot(dx,dz))+'블록');
    }
    if(id===ITEM.CLOCK){
      const hours=(getTime()*24+6)%24;
      return result(true,'월드 시간 '+String(Math.floor(hours)).padStart(2,'0')+':'+String(Math.floor(hours%1*60)).padStart(2,'0'));
    }
    if(d.heals){
      if(Player.hp>=SURVIVAL.MAX_HP&&Player.food>=SURVIVAL.MAX_FOOD)return result(false,'이미 건강하고 배가 부릅니다');
      if(d.container&&!Inventory.canExchangeHeld(hand,d.container))return result(false,'빈 양동이를 넣을 공간이 필요합니다');
      if(d.container)Inventory.exchangeHeld(hand,d.container);else consume(hand);
      Player.heal(d.heals);Player.eat(d.food);return result(true,getItemName(id)+' 사용');
    }
    if(d.toolType==='fishing'){
      if(fishing){
        const caught=clock>=fishing.ready&&clock<=fishing.ready+6;
        clearFishing();
        if(caught){give(ITEM.RAW_FISH);Inventory.damageHeld(hand);return result(true,'생선을 낚았습니다!');}
        return result(false,'입질 전에 낚시를 끝냈습니다');
      }
      const hit=Interact.raycast(12,true);
      if(!hit||![BLOCK.WATER,BLOCK.WATER_FLOW].includes(hit.id))return result(false,'물 표면을 바라보고 사용하세요');
      const position=new THREE.Vector3(hit.x+.5,hit.y+.9,hit.z+.5);
      fishing={hand,stack,position,ready:clock+3+Math.random()*4,notified:false};
      bobber=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.14),new THREE.MeshBasicMaterial({color:0xe55b4d}));
      bobber.position.copy(position);scene.add(bobber);
      const geometry=new THREE.BufferGeometry().setFromPoints([camera.position,position]);
      line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x272727,transparent:true,opacity:.8}));scene.add(line);
      return result(true,'찌를 던졌습니다 · 입질 알림 후 다시 사용하세요');
    }
    if(d.plant&&!d.food)return result(false,'괭이로 흙을 갈고 경작지에 심어 주세요');
    return pass();
  }
  function update(dt) {
    if(!Number.isFinite(dt)||dt<=0)return;
    clock+=Math.min(1,dt);
    if(!fishing)return;
    const water=World.getBlock(Math.floor(fishing.position.x),Math.floor(fishing.position.y),Math.floor(fishing.position.z));
    if(Player.dead||held(fishing.hand)!==fishing.stack||![BLOCK.WATER,BLOCK.WATER_FLOW].includes(water)||Player.pos.distanceTo(fishing.position)>18){clearFishing();return;}
    if(clock>fishing.ready+6){clearFishing();UI.showToast('물고기가 빠져나갔습니다');return;}
    if(clock>=fishing.ready&&!fishing.notified){fishing.notified=true;UI.showToast('입질! 낚싯대를 다시 사용하세요');}
    bobber.position.y=fishing.position.y+Math.sin(clock*(fishing.notified?24:3))*(fishing.notified ? .08 : .025);
    const a=line.geometry.attributes.position;
    a.setXYZ(0,camera.position.x,camera.position.y-.3,camera.position.z);
    a.setXYZ(1,bobber.position.x,bobber.position.y,bobber.position.z);a.needsUpdate=true;
    line.geometry.computeBoundingSphere();
  }
  return {init,use,update,cancel,canUse,filterDamage,isFishing:()=>!!fishing};
})();
