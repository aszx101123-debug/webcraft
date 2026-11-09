'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../js/game/multiplayer-core');
const ROOM='ABCDEFGH2345';
function network(){
  let now=10000;const peers=new Map(),wire=[],packets=[],statuses=new Map();
  function add(id,host=false,options={}){
    const data={edits:[],seed:123},applied=[];
    const peer={id,host,name:id,version:1,joinedAt:now,data,applied};
    peer.core=Core.create({id,host,room:ROOM,now:()=>now,
      send:packet=>{wire.push(structuredClone(packet));packets.push(structuredClone(packet));},
      getSnapshot:()=>data,onSnapshot:value=>Object.assign(data,value),
      onCommit:value=>applied.push(value),onRequest:()=>({ok:true}),
      onStatus:value=>statuses.set(id,value),...options});
    peers.set(id,peer);return peer;
  }
  async function pump(){
    let count=0;while(wire.length){assert.ok(++count<5000,'protocol must settle');const packet=wire.shift();
      for(const [id,p] of peers)if(id!==packet.from&&(!packet.to||packet.to===id))await p.core.receive(packet);
    }
  }
  function presence(){const list=[...peers.values()];for(const p of peers.values())p.core.setRoster(list);}
  return {add,peers,wire,packets,statuses,presence,pump,advance:ms=>{now+=ms;for(const p of peers.values())p.core.tick();}};
}
test('room codes and public names are normalized without allowing ambiguous codes',()=>{
  assert.equal(Core.roomCode('abcd efgh-2345'),ROOM);assert.equal(Core.validRoom(ROOM),true);
  for(const bad of ['ABC','ABCDEFGHI234','ABCDEFGH2340','<script>'])assert.equal(Core.validRoom(bad),false);
  assert.equal(Core.cleanName('\u0000Alice\n'), 'Alice');assert.equal(Core.cleanName('x'.repeat(80)).length,16);
});
test('a late joiner receives the complete chunked world and subsequent ordered commits',async()=>{
  const n=network(),host=n.add('host00001',true);host.data.edits=Array.from({length:3000},(_,i)=>[i,i%90]);
  const guest=n.add('guest0001');n.presence();await n.pump();
  assert.equal(guest.core.ready,true);assert.deepEqual(guest.data.edits,host.data.edits);
  assert.ok(n.packets.filter(p=>p.kind==='snapshot').length>1);
  host.core.commit({block:1});host.core.commit({block:2});await n.pump();
  assert.deepEqual(guest.applied,[{block:1},{block:2}]);assert.equal(host.applied.length,0);
  const late=n.add('guest0002');host.data.edits.push([9999,5]);n.presence();await n.pump();
  assert.equal(late.core.sequence,2);assert.deepEqual(late.data.edits,host.data.edits);
});
test('missing a world commit pauses the guest and recovers from a fresh snapshot',async()=>{
  const n=network(),host=n.add('host00001',true),guest=n.add('guest0001');n.presence();await n.pump();
  host.data.edits=[[1,2]];host.core.commit({first:true});n.wire.length=0;
  host.data.edits.push([3,4]);host.core.commit({second:true});await n.pump();
  assert.equal(guest.core.ready,true);assert.equal(guest.core.sequence,2);assert.deepEqual(guest.data.edits,host.data.edits);
  assert.equal(guest.applied.length,0,'the gap is replaced by canonical snapshot state');
});
test('request retry returns the original result and executes the host action once',async()=>{
  let count=0;const n=network(),host=n.add('host00001',true,{onRequest:()=>({ok:true,count:++count})});
  const guest=n.add('guest0001');n.presence();await n.pump();
  const result=guest.core.request('take',{id:1});const sent=n.wire.shift();await host.core.receive(sent);
  n.wire.length=0;n.advance(900);await n.pump();
  assert.deepEqual(await result,{ok:true,count:1});assert.equal(count,1);
});
test('four-player admission keeps existing seats and rejects a fifth participant',async()=>{
  const n=network();n.add('host00001',true);n.presence();await n.pump();
  for(const id of ['guest0003','guest0002','guest0001']){n.add(id);n.presence();await n.pump();}
  const fifth=n.add('aaaa00001');n.presence();await n.pump();
  assert.equal(n.statuses.get(fifth.id),'full');assert.equal(fifth.core.ready,false);
  for(const id of ['guest0003','guest0002','guest0001'])assert.equal(n.peers.get(id).core.ready,true);
  assert.equal(n.peers.get('host00001').core.roster.length,4);
  n.peers.delete('guest0002');n.presence();await n.pump();assert.equal(fifth.core.ready,true);
});
test('host departure freezes guests and a returning host synchronizes them again',async()=>{
  const n=network(),host=n.add('host00001',true),guest=n.add('guest0001');n.presence();await n.pump();
  n.peers.delete(host.id);n.presence();await n.pump();assert.equal(guest.core.ready,false);assert.equal(n.statuses.get(guest.id),'host-left');
  host.data.edits=[[5,6]];n.peers.set(host.id,host);n.presence();await n.pump();
  assert.equal(guest.core.ready,true);assert.deepEqual(guest.data.edits,host.data.edits);
});
test('opening a second host does not take over an existing host',async()=>{
  const n=network(),host=n.add('host00001',true);n.presence();await n.pump();n.advance(1);
  const duplicate=n.add('host00002',true);n.presence();await n.pump();
  assert.equal(host.core.ready,true);assert.equal(duplicate.core.ready,false);assert.equal(n.statuses.get(duplicate.id),'duplicate-host');
});
test('foreign, malformed and oversized packets cannot mutate a joined world',async()=>{
  const n=network();const host=n.add('host00001',true),guest=n.add('guest0001');n.presence();await n.pump();
  const base={v:1,room:ROOM,from:host.id,kind:'commit',data:{seq:1,value:{bad:true}}};
  for(const packet of [{...base,room:'ZZZZZZZZ9999'},{...base,from:'stranger1'},{...base,v:99},
    {...base,data:{seq:-1,value:1}},{...base,data:{seq:1,value:'x'.repeat(20000)}}])await guest.core.receive(packet);
  assert.equal(guest.applied.length,0);assert.equal(guest.core.sequence,0);
});
test('pending requests time out and room close settles outstanding operations',async()=>{
  const n=network();n.add('host00001',true);const guest=n.add('guest0001');n.presence();await n.pump();
  const timeout=guest.core.request('take',{});n.wire.length=0;n.advance(8100);assert.equal((await timeout).error,'timeout');
  const pending=guest.core.request('take',{});guest.core.close();assert.equal((await pending).error,'closed');
});
