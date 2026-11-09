'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('../js/game/multiplayer-core');
const source=fs.readFileSync(require.resolve('../js/game/multiplayer.js'),'utf8')
  .replace("await import('../supabase-client.js')",'await Promise.resolve({supabase:relayClient})');
const drain=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
function relay(){
  const channels=[],intervals=[];let imports=0;
  const sync=()=>{for(const ch of channels)if(ch.active)queueMicrotask(()=>ch.handlers['presence:sync']?.());};
  const client={channel(topic){
    imports++;const ch={topic,handlers:{},active:false,meta:null,
      on(type,filter,fn){this.handlers[type+':'+filter.event]=fn;return this;},
      subscribe(fn){this.subscription=fn;queueMicrotask(()=>{this.active=true;void fn('SUBSCRIBED');});return this;},
      track(meta){this.meta=meta;sync();return Promise.resolve('ok');},
      presenceState:()=>Object.fromEntries(channels.filter(c=>c.active&&c.meta&&c.topic===topic).map(c=>[c.meta.id,[c.meta]])),
      send(value){for(const other of channels)if(other!==ch&&other.active&&other.topic===topic)
        queueMicrotask(()=>other.handlers['broadcast:game']?.({payload:structuredClone(value.payload)}));return Promise.resolve('ok');}};
    channels.push(ch);return ch;
  },async removeChannel(ch){ch.active=false;ch.subscription('CLOSED');sync();}};
  function controller(){
    const label={textContent:''},document={getElementById:()=>label};
    const result=new Function('MultiplayerCore','CONFIG','GAME_MODE','BLOCKS','document','relayClient','crypto','setTimeout','clearTimeout','setInterval','clearInterval',
      source+'\nreturn Multiplayer;')(Core,{VERSION:'1.9.0'},{SURVIVAL:'survival',CREATIVE:'creative'},{1:{}},document,client,globalThis.crypto,
      (fn,ms)=>{if(ms<=35)queueMicrotask(fn);return 0;},()=>{},fn=>{intervals.push(fn);return intervals.length;},()=>{});
    return {mp:result,label};
  }
  return {controller,channels,intervals,imports:()=>imports};
}
function snapshot(version='1.9.0'){
  return {meta:{seed:987,mode:'survival',generatorVersion:2,gameVersion:version},edits:[],time:.2,metadata:{objects:[]}};
}
test('single-player preparation opens no relay or auth connection',async()=>{
  const r=relay(),{mp}=r.controller();assert.equal(await mp.prepare(new URLSearchParams()),null);
  assert.equal(r.imports(),0);assert.equal(mp.active,false);
});
test('controller joins without login, takes host settings and keeps changes received during boot',async()=>{
  const r=relay(),host=r.controller(),guest=r.controller(),applied=[];
  const room='ABCDEFGH2345';await host.mp.prepare(new URLSearchParams({room,host:'1',seed:'987'}));
  host.mp.bind({snapshot:()=>snapshot(),members(){}});
  const context=await guest.mp.prepare(new URLSearchParams({room,name:'Alice'}));await drain();
  assert.equal(context.seed,987);assert.equal(context.mode,'survival');assert.equal(context.name,'Alice');
  assert.equal(guest.mp.ready,true);assert.equal(guest.mp.members.length,2);
  host.mp.commit({kind:'blocks',changes:[[1,2,3,1]]});await drain();
  guest.mp.bind({initial:value=>applied.push(value.meta.seed),commit:value=>applied.push(value)});
  assert.equal(applied[0],987);assert.deepEqual(applied[1],{kind:'blocks',changes:[[1,2,3,1]]});
  await host.mp.leave();await drain();assert.equal(guest.mp.ready,false);assert.match(guest.label.textContent,/방장/);
  await guest.mp.leave();assert.equal(guest.mp.active,false);
});
test('incompatible game versions fail with a readable error and close the room connection',async()=>{
  const r=relay(),host=r.controller(),guest=r.controller(),room='ABCDEFGH2345';
  await host.mp.prepare(new URLSearchParams({room,host:'1',seed:'987'}));host.mp.bind({snapshot:()=>snapshot('0.0.0')});
  await assert.rejects(guest.mp.prepare(new URLSearchParams({room})),/월드 정보를 읽지 못했습니다/);
  assert.equal(guest.mp.active,false);await host.mp.leave();
});
test('a lost final block commit is detected by periodic host sequence numbers',async()=>{
  const r=relay(),host=r.controller(),guest=r.controller(),room='ABCDEFGH2345';let resynced=0;
  await host.mp.prepare(new URLSearchParams({room,host:'1',seed:'987'}));
  host.mp.bind({snapshot:()=>snapshot(),entities:()=>({mobs:[],drops:[]})});
  await guest.mp.prepare(new URLSearchParams({room}));guest.mp.bind({snapshotReceived:()=>{resynced++;},event(){}});
  const ch=r.channels[1],receive=ch.handlers['broadcast:game'];
  ch.handlers['broadcast:game']=()=>{};host.mp.commit({kind:'blocks',changes:[[1,2,3,1]]});await drain();
  ch.handlers['broadcast:game']=receive;for(const tick of r.intervals)tick();await drain();
  assert.equal(resynced,1);assert.equal(guest.mp.ready,true);
  await guest.mp.leave();await host.mp.leave();
});
