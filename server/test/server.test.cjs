'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createGameServer}=require('../index.cjs'),{IdentityStore,ApiError}=require('../identity-store.cjs'),{Client}=require('./client.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(options={}){
  const app=createGameServer({store:new IdentityStore(),origins:['http://localhost'],identityLimit:200,guestLimit:200,...options});
  const address=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+address.port;
  const post=async data=>{const res=await fetch(base+'/api/identity',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(data)});return {status:res.status,value:await res.json()};};
  const join=async(identity,server='survival')=>{const client=new Client(base.replace('http:','ws:')+'/ws',identity.token,app.metadata().version,{server});await client.ready;return client;};
  return {app,base,post,join};
}
test('guests receive server-numbered names, while custom names require a verified login',async()=>{
  let authCalls=0;
  const f=await fixture({verifyUser:async token=>{authCalls++;if(token!=='verified-user')throw new ApiError('INVALID_LOGIN',401);return {id:'11111111-1111-4111-8111-111111111111'};}});
  try{
    const a=await f.post({}),b=await f.post({});assert.equal(a.value.name,'Guest1');assert.equal(b.value.name,'Guest2');assert.equal(authCalls,0);
    assert.equal((await f.post({nickname:'PretendAccount'})).status,401);
    assert.equal((await f.post({accessToken:'forged-user',nickname:'PretendAccount'})).status,401);
    assert.equal((await f.post({accessToken:'verified-user',nickname:'Guest3'})).status,400);
    const account=await f.post({accessToken:'verified-user',nickname:'Builder_1'});assert.equal(account.value.account,true);assert.equal(account.value.name,'Builder_1');
    const client=await f.join(account.value);try{assert.equal(client.identity.name,'Builder_1');}finally{client.close();}
  }finally{await f.app.close();}
});
test('capacity is enforced across modes and forged sessions cannot join',async()=>{
  const f=await fixture({maxPlayers:2}),clients=[];
  try{
    clients.push(await f.join((await f.post({})).value));clients.push(await f.join((await f.post({})).value,'creative'));
    const extra=new Client(f.base.replace('http:','ws:')+'/ws',(await f.post({})).value.token,f.app.metadata().version);
    await assert.rejects(extra.ready,/SERVER_FULL/);extra.close();
    const forged=new Client(f.base.replace('http:','ws:')+'/ws','forged-token',f.app.metadata().version);await assert.rejects(forged.ready,/INVALID_SESSION/);forged.close();
    assert.equal(f.app.online.size,2);
  }finally{for(const c of clients)c.close();await f.app.close();}
});
test('concurrent mining and repeated operation IDs change the shared world once',async()=>{
  const f=await fixture(),clients=[];
  try{
    const first=await f.join((await f.post({})).value),second=await f.join((await f.post({})).value);clients.push(first,second);first.pose();second.pose();await delay(20);
    const runtime=f.app.worlds.get('survival').runtime,p=first.snapshot.spawn,pos={x:Math.floor(p.x)+1,y:Math.floor(p.y),z:Math.floor(p.z)};
    runtime.game.World.setBlock(pos.x,pos.y,pos.z,runtime.game.BLOCK.DIRT);await delay(10);
    const value={...pos,old:runtime.game.BLOCK.DIRT,id:0},id='operation_12345678';
    const firstRequest=first.request('edit',value,id);first.send({type:'request',request:id,action:'edit',value});
    const results=await Promise.all([firstRequest,second.request('edit',value)]);assert.equal(results.filter(r=>r.ok).length,1);
    const repeated=await first.request('edit',value,id);assert.deepEqual(repeated,results[0]);
    const dirt=runtime.game.Drops.networkSnapshot().filter(row=>row[1]===runtime.game.BLOCK.DIRT);assert.equal(dirt.length,1);
    first.close();await delay(20);assert.equal(f.app.online.size,1);assert.equal(second.socket.readyState,1,'no player hosts the server');
  }finally{for(const c of clients)c.close();await f.app.close();}
});
test('server state is private to API routes and cross-origin joins are denied',async()=>{
  const f=await fixture();
  try{
    for(const url of ['/server/data/webcraft.sqlite','/.git/config','/server/identity-store.cjs','/supabase/webcraft-phase3.sql'])assert.equal((await fetch(f.base+url)).status,404,url);
    const res=await fetch(f.base+'/api/identity',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);
  }finally{await f.app.close();}
});
test('renewing an account session preserves its player slot and duplicate-action protection',async()=>{
  const f=await fixture({verifyUser:async()=>({id:'11111111-1111-4111-8111-111111111111'})});let client;
  try{
    const original=(await f.post({accessToken:'verified-account',nickname:'LongSession'})).value;client=await f.join(original);client.pose();await delay(20);
    const runtime=f.app.worlds.get('survival').runtime,p=client.snapshot.spawn,pos={x:Math.floor(p.x)+1,y:Math.floor(p.y),z:Math.floor(p.z)};
    runtime.game.World.setBlock(pos.x,pos.y,pos.z,2);await delay(10);const id='same_action_after_renewal';
    const first=await client.request('edit',{...pos,old:2,id:0},id);assert.equal(first.ok,true);
    assert.equal((await f.post({accessToken:'verified-account',nickname:'RenamedWhilePlaying'})).value.error,'PROFILE_IN_USE');
    const renewed=(await f.post({accessToken:'verified-account'})).value;client.send({type:'renew',token:renewed.token});await delay(10);
    assert.deepEqual(await client.request('edit',{...pos,old:2,id:0},id),first);assert.equal(f.app.online.size,1);
    assert.equal(runtime.game.Drops.networkSnapshot().filter(row=>row[1]===2).length,1);
  }finally{client?.close();await f.app.close();}
});
