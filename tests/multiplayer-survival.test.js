'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const game=require('./helpers/item-game');
function hosted(){
  const packets=[],poses=new Map(),members=[{id:'host00001'},{id:'guest0001'},{id:'guest0002'}];
  const mp={context:{host:true,id:'host00001'},active:true,isHost:true,ready:true,applying:false,leases:new Map(),members,
    poseFor:id=>poses.get(id),containerKey:(kind,pos)=>kind+':'+[pos.x,pos.y,pos.z].join(','),
    commit:value=>packets.push(value),event(){},bind(value){this.adapter=value;},request(action,value){return Promise.resolve(this.adapter.request(this.context.id,action,value));}};
  const g=game({realDrops:true,realFurniture:true,multiplayerEngine:true,multiplayer:mp});
  const state={mode:'survival',started:true,time:.3};
  poses.set('guest0001',{x:.5,y:1,z:1.5,yaw:0,pitch:0,dead:false,tool:0});
  poses.set('guest0002',{x:1.5,y:1,z:1.5,yaw:0,pitch:0,dead:false,tool:0});
  const adapter=g.MultiplayerEngine.bind({scene:g.scene,state,seed:123});
  return {...g,mp,adapter,poses,packets,state};
}
test('two players mining the same block produce a single canonical change and drop',async()=>{
  const g=hosted(),{BLOCK:B}=g;g.World.setBlock(1,1,2,B.DIRT);await Promise.resolve();g.packets.length=0;
  const change={x:1,y:1,z:2,old:B.DIRT,id:B.AIR};
  assert.equal(g.adapter.request('guest0001','edit',change).ok,true);
  assert.equal(g.adapter.request('guest0002','edit',change).ok,false);
  await Promise.resolve();assert.equal(g.World.getBlock(1,1,2),B.AIR);
  assert.equal(g.Drops.networkSnapshot().filter(row=>row[1]===B.DIRT).length,1);
  assert.equal(g.packets.filter(p=>p.kind==='blocks').length,1);
});
test('remote edits reject bedrock, out-of-reach actions and malformed block ids',()=>{
  const g=hosted(),B=g.BLOCK;g.World.setBlock(1,1,2,B.BEDROCK);
  for(const value of [{x:1,y:1,z:2,old:B.BEDROCK,id:0},{x:100,y:1,z:100,old:0,id:B.DIRT},
    {x:1,y:1,z:2,old:B.BEDROCK,id:99999},{x:NaN,y:1,z:2,old:0,id:B.DIRT}])assert.equal(g.adapter.request('guest0001','edit',value).ok,false);
  assert.equal(g.World.getBlock(1,1,2),B.BEDROCK);
});
test('a shared drop can be collected once, with partial capacity and gear durability preserved',()=>{
  const g=hosted();g.Drops.spawn(g.BLOCK.DIRT,5,.5,1,.5);g.Drops.update(.5,g.Player.pos,false);
  const row=g.Drops.networkSnapshot()[0],pos=new g.THREE.Vector3(row[3],row[4],row[5]);
  assert.equal(g.Drops.takeNetworkDrop(row[0],2,pos).count,2);
  assert.equal(g.Drops.takeNetworkDrop(row[0],64,pos).count,3);
  assert.equal(g.Drops.takeNetworkDrop(row[0],64,pos),null);
  g.Drops.spawn(g.ITEM.WOODEN_PICKAXE,1,.5,1,.5,12);g.Drops.update(.5,g.Player.pos,false);
  const gear=g.Drops.networkSnapshot()[0];assert.equal(g.Drops.takeNetworkDrop(gear[0],1,new g.THREE.Vector3(...gear.slice(3,6))).durability,12);
});
test('chests have one active user and transfers conserve their canonical contents',()=>{
  const g=hosted(),pos={x:1,y:1,z:2};g.World.setBlock(1,1,2,g.BLOCK.CHEST);
  const request=(id,action,value={})=>g.adapter.request(id,action,{kind:'chest',pos,...value});
  assert.equal(request('guest0001','lock').ok,true);assert.equal(request('guest0002','lock').error,'locked');
  assert.equal(request('guest0002','chest-deposit',{stack:{id:g.BLOCK.DIRT,count:5}}).ok,false);
  assert.equal(request('guest0001','chest-deposit',{stack:{id:g.BLOCK.DIRT,count:5}}).ok,true);
  const first=request('guest0001','chest-withdraw',{index:0});assert.equal(first.stack.count,5);
  assert.equal(request('guest0001','chest-withdraw',{index:0}).ok,false);
  assert.equal(g.adapter.request('guest0002','edit',{...pos,old:g.BLOCK.CHEST,id:0}).ok,false);
  assert.equal(request('guest0001','release').ok,true);assert.equal(request('guest0002','lock').ok,true);
});
test('furnace input, cooking and output run on the host and require a lease',()=>{
  const g=hosted(),pos={x:1,y:1,z:2};g.World.setBlock(1,1,2,g.BLOCK.FURNACE);
  const request=(id,action,value={})=>g.adapter.request(id,action,{kind:'furnace',pos,...value});
  assert.equal(request('guest0001','lock').ok,true);
  assert.equal(request('guest0002','furnace-interact',{slot:'input',held:{id:g.BLOCK.IRON_ORE,count:1}}).ok,false);
  const ore=request('guest0001','furnace-interact',{slot:'input',held:{id:g.BLOCK.IRON_ORE,count:1}});
  assert.equal(ore.ok,true);assert.equal(ore.cursor,null);
  assert.equal(request('guest0001','furnace-interact',{slot:'fuel',held:{id:g.ITEM.COAL,count:1}}).ok,true);
  for(let i=0;i<10;i++)g.FurnaceSystem.update(1);
  const output=request('guest0001','furnace-interact',{slot:'output',held:null});
  assert.equal(output.cursor.id,g.ITEM.IRON_INGOT);assert.equal(output.cursor.count,1);
  assert.equal(request('guest0001','furnace-interact',{slot:'output',held:null}).cursor,null);
});
test('guest mob and drop replicas never generate their own AI, loot or world-origin drops',()=>{
  const g=game({realDrops:true}),hits=[];
  g.Mobs.setNetwork({replica:true,attack:(...args)=>hits.push(args)});g.Drops.setNetwork({replica:true,spawn:stack=>hits.push(stack)});
  const snapshot={mobs:[[1,'zombie',.5,1,-1,0,20,0,0]],arrows:[]};g.Mobs.applyNetwork(snapshot);
  for(let i=0;i<100;i++)g.Mobs.update(.05,true);
  assert.equal(g.Player.hp,20);assert.equal(g.Mobs.networkSnapshot().mobs.length,1);
  assert.equal(g.Mobs.networkSnapshot().mobs[0][4],-1);assert.equal(g.Drops.count(),0);
  g.Drops.spawn(g.BLOCK.DIRT,1,0,1,0,undefined,{world:true});assert.equal(hits.length,0);
  g.Drops.spawn(g.BLOCK.DIRT,1,0,1,0);assert.equal(hits.length,1);
  g.Mobs.applyNetwork({mobs:[],arrows:[]});assert.equal(g.Mobs.counts().total,0);assert.equal(g.Drops.count(),0);
});
test('room saves preserve the single-player index and active world',()=>{
  const g=game(),sp=g.SaveSystem.create('Single',123),room='ABCDEFGH2345';
  assert.equal(g.SaveSystem.save(sp.id,{version:8,seed:123,edits:[]}),true);
  const before=g.SaveSystem.list();
  assert.equal(g.SaveSystem.saveRoom(room,{version:8,seed:234,edits:[],inventory:[{id:g.BLOCK.DIRT,count:4}]}),true);
  assert.equal(g.SaveSystem.loadRoom(room).seed,234);assert.equal(g.SaveSystem.load(sp.id).seed,123);
  assert.equal(g.SaveSystem.getActiveId(),sp.id);assert.deepEqual(g.SaveSystem.list(),before);
  assert.equal(g.SaveSystem.saveRoom('../../bad',{}),false);
});

test('host mobs target a nearby guest and send damage only to that player',()=>{
  const g=hosted(),events=[];g.mp.event=(value,peer)=>events.push({value,peer});
  g.poses.set('guest0001',{x:10.5,y:1,z:.5,yaw:0,pitch:0,dead:false});
  g.poses.set('guest0002',{x:100,y:1,z:100,yaw:0,pitch:0,dead:false});
  g.Mobs.setEnv(true,0);g.Mobs.spawn('zombie',10,1,0);g.Mobs.update(.05,true);
  assert.equal(events.length,1);assert.equal(events[0].peer,'guest0001');assert.equal(events[0].value.kind,'damage');
  assert.ok(events[0].value.amount>0);assert.equal(g.Player.hp,20);
});
test('guest crop harvesting uses the host yield once, without an extra crop block drop',()=>{
  const g=hosted(),pos={x:1,y:2,z:2};g.World.setBlock(1,1,2,g.BLOCK.FARMLAND);g.World.setBlock(1,2,2,g.BLOCK.WHEAT_CROP);
  g.Farming.init({version:1,crops:[['1,2,2',{id:g.BLOCK.WHEAT_CROP,progress:180}]],foraged:[]});
  assert.equal(g.adapter.request('guest0001','edit',{...pos,old:g.BLOCK.WHEAT_CROP,id:0}).ok,true);
  const drops=g.Drops.networkSnapshot();assert.equal(drops.find(r=>r[1]===g.ITEM.WHEAT)?.[2],1);
  assert.equal(drops.find(r=>r[1]===g.ITEM.WHEAT_SEEDS)?.[2],2);assert.equal(drops.some(r=>r[1]===g.BLOCK.WHEAT_CROP),false);
});
test('a rejected guest arrow refunds ammunition and accepted fire wears the original bow',async()=>{
  let accepted=false;
  const mp={context:{host:false,id:'guest0001'},active:true,isHost:false,ready:true,applying:false,leases:new Map(),members:[],
    poseFor:()=>null,bind(){},request:async()=>({ok:accepted})};
  const g=game({realDrops:true,realFurniture:true,multiplayerEngine:true,multiplayer:mp});
  g.hold(g.ITEM.BOW,1,10);g.Inventory.add(g.ITEM.ARROW,2);const bow=g.Inventory.selectedSlot();
  const adapter=g.MultiplayerEngine.bind({scene:g.scene,state:{mode:'survival',started:true,time:.2},seed:123});
  const eye={x:0,y:2,z:0},direction={x:0,y:0,z:-1};
  await adapter.fireArrow('main',eye,direction);assert.equal(g.Inventory.countItem(g.ITEM.ARROW),2);assert.equal(bow.durability,10);
  accepted=true;const pending=adapter.fireArrow('main',eye,direction);g.Inventory.setSelected(1);await pending;
  assert.equal(g.Inventory.countItem(g.ITEM.ARROW),1);assert.equal(bow.durability,9);
});
