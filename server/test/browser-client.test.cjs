'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {WebSocket}=require('ws');
const {IdentityStore}=require('../identity-store.cjs'),{createGameServer}=require('../index.cjs');
const Core=require('../../js/game/multiplayer-core');
const source=fs.readFileSync(path.join(__dirname,'../../js/game/dedicated-multiplayer.js'),'utf8').replace("await import('../server-identity.js')",'await Promise.resolve(identityApiForTest)');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('the production game transport joins with a server-assigned name, saves and reconnects',async()=>{
  const app=createGameServer({store:new IdentityStore(),origins:['http://localhost']});
  const address=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+address.port;
  const player=app.store.guest(),identityApiForTest={identity:async()=>player,serverBase:()=>base};
  const nodes=new Map(),document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);}};
  const sockets=[];class BrowserSocket extends WebSocket{constructor(url){super(url,{headers:{Origin:'http://localhost'}});sockets.push(this);}}
  const runtime=app.worlds.get('survival').runtime;
  const multiplayer=new Function('identityApiForTest','MultiplayerCore','CONFIG','GAME_MODE','BLOCKS','document','WebSocket','crypto',source+'\nreturn DedicatedMultiplayer;')(
    identityApiForTest,Core,{VERSION:app.metadata().version},{SURVIVAL:'survival',CREATIVE:'creative'},runtime.game.BLOCKS,document,BrowserSocket,globalThis.crypto);
  try{
    const context=await multiplayer.prepare(new URLSearchParams({server:'survival',name:'ForgedAccount'}));
    assert.equal(context.name,'Guest1');assert.equal(context.host,false);assert.equal(multiplayer.ready,true);assert.ok(context.saveKey.includes(player.id));
    let initialCount=0,resyncCount=0;const pose={...multiplayer.initial.spawn,yaw:0,pitch:0,speed:0,dead:false};
    multiplayer.bind({initial:()=>initialCount++,selfPose:()=>pose,members(){},applyState(){},snapshotReceived:()=>resyncCount++,commit(){},dispose(){}});
    assert.equal(initialCount,1);await delay(150);
    const saved=await multiplayer.checkpoint({player:pose,inventory:[],equipment:{},hp:17,food:18,crafting:{size:2,grid:Array(9).fill(0)},inventoryCursor:null});
    assert.equal(saved.ok,true);assert.equal(app.store.loadPlayer(app.store.session(player.token).identity,'survival').hp,17);
    sockets[0].terminate();await delay(900);assert.equal(multiplayer.ready,true);assert.ok(resyncCount>=1);
    assert.equal(app.online.size,1,'reconnection must not consume another player slot');
  }finally{multiplayer.leave();await app.close();}
});
