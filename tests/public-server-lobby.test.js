'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const source=fs.readFileSync(require.resolve('../js/public-servers.js'),'utf8').replace("import {identity,logout,serverBase} from './server-identity.js';",'const {identity,logout,serverBase}=api;');
async function lobby(api){
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,dataset:{},textContent:'',events:{},addEventListener(type,fn){this.events[type]=fn;}});return nodes.get(id);};
  const location={origin:'https://game.example',search:'',href:''};
  const document={hidden:false,documentElement:{},querySelectorAll:()=>[],getElementById:node};
  await new AsyncFunction('api','document','location','fetch','setInterval',source)(
    {serverBase:()=>location.origin,logout:async()=>{},...api},document,location,
    async()=>({ok:true,json:async()=>({servers:[{id:'survival',online:5,maxPlayers:100,available:true},{id:'creative',online:2,maxPlayers:100,available:true}]})}),()=>0);
  return {node,location};
}
test('a guest sees their assigned English name and cannot edit a nickname',async()=>{
  const g=await lobby({identity:async()=>({name:'Guest12',account:false})});
  assert.match(g.node('server-identity-status').textContent,/Guest12/);assert.equal(g.node('server-nickname-form').hidden,true);
  assert.equal(g.node('server-login').hidden,false);assert.equal(g.node('server-survival-join').disabled,false);
  g.node('server-survival-join').events.click();const url=new URL(g.location.href,'https://game.example');assert.equal(url.searchParams.get('server'),'survival');assert.equal(url.searchParams.has('name'),false);assert.equal(url.searchParams.has('token'),false);
});
test('a logged-in player chooses a name, can correct errors and then joins',async()=>{
  let saved=false;
  const g=await lobby({identity:async options=>{
    if(options.nickname===undefined)throw Object.assign(Error('Choose a name'),{code:'NICKNAME_REQUIRED'});
    if(options.nickname==='TakenName')throw Object.assign(Error('Taken'),{code:'NICKNAME_TAKEN'});
    saved=true;return {name:options.nickname,account:true};}});
  assert.equal(g.node('server-nickname-form').hidden,false);assert.equal(g.node('server-login').hidden,true);assert.equal(g.node('server-survival-join').disabled,true);
  g.node('server-nickname').value='TakenName';await g.node('server-nickname-form').events.submit({preventDefault(){}});
  assert.equal(g.node('server-nickname-form').hidden,false,'name errors must keep the editor open');
  g.node('server-nickname').value='NewBuilder';await g.node('server-nickname-form').events.submit({preventDefault(){}});
  assert.equal(saved,true);assert.match(g.node('server-identity-status').textContent,/NewBuilder/);assert.equal(g.node('server-survival-join').disabled,false);
});
