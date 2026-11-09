'use strict';
const {createGameServer}=require('./index.cjs'),{IdentityStore}=require('./identity-store.cjs'),{Client}=require('./test/client.cjs');
const assert=require('node:assert/strict');
async function runLoadTest({players=100,duration=5000}={}){
  const store=new IdentityStore(),editedCells=50000;
  store.writeWorld('creative',{meta:{seed:12345},spawn:{x:8.5,y:57.5,z:8.5},time:.22,
    edits:Array.from({length:500},(_,i)=>[(1000+i)+',1000',Array.from({length:100},(_,j)=>[j*64+30,2])]),metadata:{objects:[],furnaces:{version:1,entries:[]},farming:{version:1,crops:[],foraged:[]}},entities:{drops:[]}});
  const app=createGameServer({store,origins:['http://localhost'],identityLimit:200,guestLimit:200});
  const address=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+address.port,clients=[],started=performance.now(),latencies=[],outstanding=new Set();let poseMessages=0,edits=0,editFailures=0;
  try{
    const identities=await Promise.all(Array.from({length:players},async()=>{
      const response=await fetch(base+'/api/identity',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,200);return response.json();
    }));
    assert.equal(new Set(identities.map(p=>p.name)).size,players);
    for(const group of Array.from({length:Math.ceil(players/10)},(_,i)=>identities.slice(i*10,i*10+10))){
      await Promise.all(group.map(async identity=>{const client=new Client(base.replace('http:','ws:')+'/ws',identity.token,app.metadata().version,{server:'creative'});clients.push(client);await client.ready;}));
    }
    assert.equal(app.online.size,players);
    const runtime=app.worlds.get('creative').runtime;
    const targets=clients.map((c,i)=>({x:Math.floor(c.snapshot.spawn.x)+i%7-3,y:Math.floor(c.snapshot.spawn.y)+1+Math.floor(i/49),z:Math.floor(c.snapshot.spawn.z)+Math.floor(i/7)%7-3}));
    const poseTimer=setInterval(()=>{for(const [i,client] of clients.entries()){client.pose({x:client.snapshot.spawn.x+Math.sin(performance.now()/1000+i)*.25,z:client.snapshot.spawn.z+Math.cos(performance.now()/1000+i)*.25,speed:1});poseMessages++;}},125);
    const editTimer=setInterval(()=>{for(const [i,client] of clients.entries()){
      const pos=targets[i],old=runtime.game.World.getBlock(pos.x,pos.y,pos.z),began=performance.now();
      const operation=client.request('edit',{...pos,old,id:old===2?0:2}).then(result=>{latencies.push(performance.now()-began);if(result.ok)edits++;else editFailures++;}).catch(()=>{editFailures++;}).finally(()=>outstanding.delete(operation));outstanding.add(operation);
    }},1000);
    await new Promise(resolve=>setTimeout(resolve,duration));clearInterval(poseTimer);clearInterval(editTimer);await Promise.all(outstanding);
    assert.equal(app.online.size,players);assert.ok(clients.every(client=>client.frames.length>0));
    assert.ok(clients.every(client=>client.frames.every(frame=>frame.players.length<=24)));
    assert.equal(editFailures,0);assert.ok(edits>=players,'all players must exercise shared edits');latencies.sort((a,b)=>a-b);
    const extra=new Client(base.replace('http:','ws:')+'/ws',app.store.guest().token,app.metadata().version);
    await assert.rejects(extra.ready,/SERVER_FULL/);extra.close();
    return {players,preexistingEditedCells:editedCells,successfulEdits:edits,editFailures,editRoundTripP95Ms:Number((latencies[Math.floor(latencies.length*.95)]||0).toFixed(2)),poseMessages,durationMs:Math.round(performance.now()-started),receivedMiB:Number((clients.reduce((n,c)=>n+c.receivedBytes,0)/1048576).toFixed(2)),maximumVisibleAvatars:Math.max(...clients.flatMap(c=>c.frames.map(f=>f.players.length))),maxTickMs:Number(app.metrics.maxTickMs.toFixed(2)),maxTickDelayMs:Number(app.metrics.maxTickDelayMs.toFixed(2)),rssMiB:Math.round(process.memoryUsage().rss/1048576),extraPlayerRejected:true};
  }finally{for(const client of clients)client.close();await app.close();}
}
if(require.main===module)runLoadTest({duration:Number(process.env.LOAD_TEST_MS)||5000}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={runLoadTest};
