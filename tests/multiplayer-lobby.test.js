'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const Core=require('../js/game/multiplayer-core');
const source=fs.readFileSync(require.resolve('../js/multiplayer-lobby.js'),'utf8');
function lobby(search='',saved={}){
  const nodes=new Map(),storage=new Map(Object.entries(saved)),location={search,href:''};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='mp-mode'?'survival':'',hidden:true,textContent:'',events:{},
    classList:{add(){}},addEventListener(name,fn){this.events[name]=fn;}});return nodes.get(id);};
  const document={documentElement:{lang:'ko'},getElementById:node,querySelectorAll:()=>[]};
  new Function('MultiplayerCore','document','location','localStorage','crypto',source)(Core,document,location,
    {getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v)},globalThis.crypto);
  return {node,location,storage,submit:id=>node(id).events.submit({preventDefault(){}})};
}
test('creating a room carries its fixed seed, chosen mode and sanitized display name',()=>{
  const g=lobby();g.node('mp-name').value='Alice\u0000';g.node('mp-seed').value='12345';g.node('mp-mode').value='creative';g.submit('mp-create');
  const query=new URL(g.location.href,'https://example.test/').searchParams;
  assert.equal(Core.validRoom(query.get('room')),true);assert.equal(query.get('host'),'1');assert.equal(query.get('seed'),'12345');
  assert.equal(query.get('mode'),'creative');assert.equal(query.get('name'),'Alice');
  assert.equal(JSON.parse(g.storage.get('webcraft.multiplayer.last-host')).room,query.get('room'));
});
test('an invite joins as a guest without inheriting host permissions or overriding room mode',()=>{
  const g=lobby('?room=abcd-efgh-2345&lang=en');assert.equal(g.node('mp-code').value,'ABCDEFGH2345');g.submit('mp-join');
  const query=new URL(g.location.href,'https://example.test/').searchParams;
  assert.equal(query.get('room'),'ABCDEFGH2345');assert.equal(query.has('host'),false);assert.equal(query.has('mode'),false);assert.equal(query.get('lang'),'en');
});
test('invalid room codes stay on the lobby and the last host room can be reopened',()=>{
  const g=lobby('',{'webcraft.multiplayer.last-host':JSON.stringify({room:'ABCDEFGH2345',seed:12345,mode:'survival'})});
  g.node('mp-code').value='invalid';g.submit('mp-join');assert.equal(g.location.href,'');assert.ok(g.node('mp-error').textContent.length);
  assert.equal(g.node('mp-resume').hidden,false);g.node('mp-resume').events.click();
  const query=new URL(g.location.href,'https://example.test/').searchParams;assert.equal(query.get('host'),'1');assert.equal(query.get('room'),'ABCDEFGH2345');
});
