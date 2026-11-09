'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {randomInt,randomBytes}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {WebSocketServer,WebSocket}=require('ws');
const {IdentityStore,ApiError}=require('./identity-store.cjs');
const {createAuthVerifier}=require('./auth.cjs');
const {WorldRuntime}=require('./world-runtime.cjs');
const ROOT=path.resolve(__dirname,'..'),MAX_BUFFER=524288,MAX_SNAPSHOT=4194304,PART=12000;
const SERVER_CODES={survival:'SURV2VAL2222',creative:'CREAT2VE2222'};
const finitePosition=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1000000)&&p.y>=-100&&p.y<=200;
const validRequest=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(id);
const ACTIONS=new Set(['edit','door','attack','arrow','drop','pickup','utility','lock','release','heartbeat','chest-deposit','chest-withdraw','furnace-interact','save-player']);
const MUTATIONS=new Set(['edit','door','attack','arrow','drop','pickup','utility','chest-deposit','chest-withdraw','furnace-interact']);
function createGameServer(options={}){
  const maxPlayers=Math.max(1,Math.min(100,Number(options.maxPlayers||process.env.MAX_PLAYERS)||100));
  const store=options.store||new IdentityStore(process.env.DATA_FILE||path.join(__dirname,'data/webcraft.sqlite'));
  const verifyUser=options.verifyUser||createAuthVerifier();
  const allowedOrigins=new Set(options.origins||String(process.env.ALLOWED_ORIGINS||'https://aszx101123-debug.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',').map(v=>v.trim()).filter(Boolean));
  if(!options.origins&&process.env.RENDER_EXTERNAL_URL)allowedOrigins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
  const rateLimits=new Map(),online=new Map(),worlds=new Map();
  let stopped=false,lastTick=performance.now(),tickNumber=0,maxTickMs=0,maxTickDelayMs=0,actorNumber=0;
  const limit=(key,count,ms=60000)=>{
    const now=Date.now();let entry=rateLimits.get(key);if(!entry||now-entry.start>ms){entry={start:now,count:0};rateLimits.set(key,entry);}
    if(++entry.count>count)throw new ApiError('RATE_LIMITED',429);
  };
  const send=(peer,value)=>{
    if(peer.socket.readyState!==WebSocket.OPEN)return false;
    if(peer.socket.bufferedAmount>MAX_BUFFER){peer.socket.close(1013,'SLOW_CONNECTION');return false;}
    peer.socket.send(JSON.stringify(value));return true;
  };
  for(const mode of ['survival','creative']){
    const saved=store.readWorld(mode),peers=new Map();
    const runtime=new WorldRuntime({id:mode,mode,seed:randomInt(1,2147483647),saved,peers,
      onEvent:(id,value)=>{const peer=peers.get(id);if(peer)send(peer,{type:'event',value});}});
    worlds.set(mode,{id:mode,peers,runtime,chain:Promise.resolve(),writeQueue:[],pendingOperations:new Map(),writeTimer:null});
    if(!saved)store.writeWorld(mode,runtime.persistentSnapshot());
  }
  const version=worlds.get('survival').runtime.version;
  const metadata=()=>({version,maxPlayers,online:online.size,servers:[...worlds.values()].map(w=>({id:w.id,name:w.id==='survival'?'WebCraft Survival':'WebCraft Creative',mode:w.id,online:w.peers.size,maxPlayers,available:!w.failed&&online.size<maxPlayers}))});
  const failWorld=world=>{world.failed=true;clearTimeout(world.writeTimer);world.writeQueue=[];world.pendingOperations.clear();for(const peer of world.peers.values()){send(peer,{type:'error',code:'SAVE_FAILED'});peer.socket.close(1011,'SAVE_FAILED');}};
  function flushWrites(world){
    clearTimeout(world.writeTimer);world.writeTimer=null;if(world.failed||!world.writeQueue.length)return;
    const writes=world.writeQueue;world.writeQueue=[];
    try{
      store.transaction(()=>{for(const op of writes){if(op.event)store.writeWorldEvent(world.id,op.event);store.writeOperation(op.identity,world.id,op.request,op.result);}});
      const changes=writes.flatMap(op=>op.changes),blocks=changes.flatMap(c=>c.value.changes||[]),grouped=[];
      const objects=world.runtime.game.BlockFurniture.serialize();
      for(let i=0;i<blocks.length;i+=64){const part=blocks.slice(i,i+64),keys=new Set(part.map(([x,y,z])=>[x,y,z].join(',')));
        grouped.push({revision:world.runtime.revision,value:{kind:'blocks',changes:part,objects:objects.filter(([key])=>keys.has(key)).map(([key,value])=>[key,{...(value.facing?{facing:value.facing}:{}),...(value.half?{half:value.half}:{}),...(typeof value.open==='boolean'?{open:value.open}:{})}])}});
      }
      publish(world,grouped);
      for(const op of writes){for(const peer of op.waiters)send(peer,{type:'result',request:op.request,result:op.result});world.pendingOperations.delete(op.key);}
    }catch{failWorld(world);}
  }
  function respond(req,res,status,value){
    const origin=req.headers.origin;if(allowedOrigins.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));
  }
  async function body(req){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>16384)throw new ApiError('PAYLOAD_TOO_LARGE',413);}
    try{const value=JSON.parse(text||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}catch{throw new ApiError('INVALID_JSON');}}
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='OPTIONS'){
        if(!allowedOrigins.has(req.headers.origin))return respond(req,res,403,{error:'ORIGIN_DENIED'});
        res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);return res.end();
      }
      if(req.method==='GET'&&url.pathname==='/health'){const ok=!stopped&&![...worlds.values()].some(w=>w.failed);return respond(req,res,ok?200:503,{ok,...metadata()});}
      if(req.method==='GET'&&url.pathname==='/api/servers')return respond(req,res,200,metadata());
      if(req.method==='POST'&&url.pathname==='/api/identity'){
        if(!allowedOrigins.has(req.headers.origin))throw new ApiError('ORIGIN_DENIED',403);
        const ip=options.trustProxy||process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
        limit('identity:'+ip,options.identityLimit||120);const value=await body(req);
        if(value.accessToken){
          const user=await verifyUser(value.accessToken);
          if(value.nickname!==undefined){
            const profile=store.profile(user.id);
            if(profile&&profile.nickname!==value.nickname&&[...online.values()].some(p=>p.identity.userId===user.id))throw new ApiError('PROFILE_IN_USE',409);
            store.setNickname(user.id,value.nickname);
          }
          return respond(req,res,200,store.account(user.id));
        }
        if(value.nickname!==undefined)throw new ApiError('LOGIN_REQUIRED',401);
        const prior=store.session(value.guestToken);
        if(!prior||prior.userId)limit('new-guest:'+ip,options.guestLimit||120);
        return respond(req,res,200,store.guest(prior&&!prior.userId?value.guestToken:null));
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError('NOT_FOUND',404);
      let name=decodeURIComponent(url.pathname);if(name==='/')name='/servers.html';
      const allowed=/^\/(?:index|play|mobile-test|servers|multiplayer|auth|en)\.html$/.test(name)||/^\/(?:js|css|img|pogl-game\/vendor)\/[A-Za-z0-9_./-]+$/.test(name)||['/service-worker.js','/manifest.webmanifest','/sitemap.xml','/robots.txt'].includes(name);
      const file=path.resolve(ROOT,'.'+name);
      if(!allowed||!file.startsWith(ROOT+path.sep)||name.includes('..'))throw new ApiError('NOT_FOUND',404);
      const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
      const raw=await fs.promises.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:raw);
    }catch(error){respond(req,res,error.status||404,{error:error.code||'NOT_FOUND'});}
  });
  server.headersTimeout=15000;server.requestTimeout=15000;
  const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    if(stopped||req.url!=='/ws'||!allowedOrigins.has(req.headers.origin)||wss.clients.size>=maxPlayers+32){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  function disconnect(peer){
    if(!peer)return;peer.world.peers.delete(peer.identity.id);
    if(online.get(peer.identity.id)===peer)online.delete(peer.identity.id);
    for(const [k,v] of peer.world.runtime.multiplayer.leases)if(v.owner===peer.identity.id)peer.world.runtime.multiplayer.leases.delete(k);
  }
  async function transfer(peer,value,kind='snapshot'){
    if(peer.transferring){peer.regionPending=true;return;}
    const text=JSON.stringify(value);if(text.length>MAX_SNAPSHOT){send(peer,{type:'error',code:'REGION_TOO_LARGE'});peer.socket.close(1009);return;}
    peer.transferring=true;const token=randomBytes(8).toString('hex'),count=Math.max(1,Math.ceil(text.length/PART));
    try{
      for(let index=0;index<count;index++){
        if(peer.socket.readyState!==WebSocket.OPEN)return;
        await new Promise((resolve,reject)=>peer.socket.send(JSON.stringify({type:'part',kind,token,index,count,text:text.slice(index*PART,(index+1)*PART)}),error=>error?reject(error):resolve()));
      }
      peer.synced=true;for(const commit of peer.queued)send(peer,commit);peer.queued=[];
    }catch{peer.socket.terminate();}
    finally{peer.transferring=false;if(peer.regionPending&&peer.socket.readyState===WebSocket.OPEN){peer.regionPending=false;void transfer(peer,{edits:peer.world.runtime.game.World.editsNear(peer.pose),metadata:peer.world.runtime.frame(peer.pose,true).metadata},'region');}}
  }
  function publish(world,changes=world.runtime.drain()){
    for(const change of changes)for(const peer of world.peers.values()){
      const changes=change.value.changes?.filter(([x,,z])=>Math.abs(x-peer.pose.x)<=112&&Math.abs(z-peer.pose.z)<=112)||[];
      if(!changes.length)continue;const keys=new Set(changes.map(([x,y,z])=>[x,y,z].join(',')));
      const value={...change.value,changes,objects:change.value.objects?.filter(([key])=>keys.has(key))};
      const packet={type:'commit',revision:change.revision,value};
      if(peer.transferring||!peer.synced){if(peer.queued.length<512)peer.queued.push(packet);else peer.socket.close(1013,'RESYNC_REQUIRED');}else send(peer,packet);
    }
  }
  function checkpoint(peer,value){
    if(!value||!finitePosition(value.player)||Math.hypot(value.player.x-peer.pose.x,value.player.z-peer.pose.z)>24)throw new ApiError('INVALID_CHECKPOINT');
    const g=peer.world.runtime.game,slots=value.inventory;
    if(!Array.isArray(slots)||slots.length>36)throw new ApiError('INVALID_CHECKPOINT');
    const validStack=stack=>!stack||Number.isInteger(stack.id)&&g.getItemDef(stack.id)&&Number.isInteger(stack.count)&&(stack.count>=1&&stack.count<=64||peer.world.id==='creative'&&stack.count===-1)&&(stack.durability===undefined||Number.isInteger(stack.durability)&&stack.durability>=1&&stack.durability<=10000);
    if(!slots.every(validStack)||!validStack(value.inventoryCursor))throw new ApiError('INVALID_CHECKPOINT');
    const safe={version:8,generatorVersion:2,seed:peer.world.runtime.seed,mode:peer.world.id,
      player:{x:value.player.x,y:value.player.y,z:value.player.z,yaw:Number.isFinite(value.player.yaw)?value.player.yaw:0,pitch:Number.isFinite(value.player.pitch)?value.player.pitch:0,flying:peer.world.id==='creative'&&!!value.player.flying},
      inventory:slots,hp:Number.isFinite(value.hp)?Math.max(1,Math.min(20,value.hp)):20,food:Number.isFinite(value.food)?Math.max(0,Math.min(20,value.food)):20,
      spawn:peer.world.runtime.spawn,equipment:{},inventoryCursor:value.inventoryCursor||null};
    for(const slot of ['head','chest','legs','feet','offhand']){const stack=value.equipment?.[slot];if(!validStack(stack))throw new ApiError('INVALID_CHECKPOINT');safe.equipment[slot]=stack||null;}
    if(value.crafting&&[2,3].includes(value.crafting.size)&&Array.isArray(value.crafting.grid)&&value.crafting.grid.length===9&&value.crafting.grid.every(id=>id===0||Number.isInteger(id)&&g.getItemDef(id)))safe.crafting=value.crafting;
    store.savePlayer(peer.identity.identity,peer.world.id,safe);return {ok:true};
  }
  wss.on('connection',socket=>{
    let peer=null,packets=0,windowAt=Date.now();socket.alive=true;
    const authTimer=setTimeout(()=>{if(!peer)socket.close(1008,'AUTH_TIMEOUT');},10000);authTimer.unref();
    socket.on('pong',()=>{socket.alive=true;});socket.on('error',()=>{});
    socket.on('message',raw=>{
      try{
        if(Date.now()-windowAt>1000){windowAt=Date.now();packets=0;}if(++packets>30)throw new ApiError('RATE_LIMITED',429);
        let value;try{value=JSON.parse(raw.toString());}catch{throw new ApiError('INVALID_JSON');}
        if(!peer){
          if(value?.type!=='hello'||value.protocol!==1)throw new ApiError('INVALID_PROTOCOL');
          const identity=store.session(value.token),world=worlds.get(value.server);
          if(!identity)throw new ApiError('INVALID_SESSION',401);if(!world)throw new ApiError('UNKNOWN_SERVER',404);
          if(world.failed)throw new ApiError('SAVE_FAILED',503);
          if(value.gameVersion!==version)throw new ApiError('VERSION_MISMATCH',409);
          const prior=online.get(identity.id);if(prior){disconnect(prior);prior.socket.close(4001,'SESSION_REPLACED');}
          if(online.size>=maxPlayers)throw new ApiError('SERVER_FULL',503);
          const saved=store.loadPlayer(identity.identity,world.id),spawn=saved?.player||world.runtime.spawn;
          peer={socket,identity,world,actorId:'actor_'+(++actorNumber),pose:{...spawn,yaw:0,pitch:0,dead:true,seen:Date.now()},lastPose:Date.now(),synced:false,queued:[],transferring:false,regionPending:false,lastChunk:[Math.floor(spawn.x)>>4,Math.floor(spawn.z)>>4]};
          world.peers.set(identity.id,peer);online.set(identity.id,peer);clearTimeout(authTimer);world.runtime.ensureArea(spawn);
          send(peer,{type:'welcome',identity:{id:identity.id,name:identity.name,account:!!identity.userId},room:SERVER_CODES[world.id],server:world.id,online:world.peers.size,maxPlayers});
          const snapshot=world.runtime.snapshot(spawn);snapshot.playerSave=saved;snapshot.spawn=world.runtime.spawn;
          void transfer(peer,snapshot);return;
        }
        if(online.get(peer.identity.id)!==peer)return;
        if(value?.type==='renew'){
          const next=store.session(value.token);if(!next||next.identity!==peer.identity.identity)throw new ApiError('INVALID_SESSION',401);
          peer.identity=next;send(peer,{type:'renewed',expiresAt:next.expiresAt});return;
        }
        if(peer.identity.expiresAt<Date.now())throw new ApiError('SESSION_EXPIRED',401);
        if(value?.type==='pose'){
          const p=value.value;if(!finitePosition(p)||!Number.isFinite(p.yaw)||!Number.isFinite(p.pitch))return;
          const elapsed=Math.min(5,(Date.now()-peer.lastPose)/1000),travel=Math.hypot(p.x-peer.pose.x,p.z-peer.pose.z);
          if(travel>elapsed*24+6){send(peer,{type:'correction',position:peer.pose});return;}
          peer.pose={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,speed:Math.max(0,Math.min(12,Number(p.speed)||0)),dead:!!p.dead,
            tool:Number.isInteger(p.tool)&&peer.world.runtime.game.getItemDef(p.tool)?p.tool:0,appearance:p.appearance&&JSON.stringify(p.appearance).length<500?p.appearance:{},seen:Date.now()};peer.lastPose=Date.now();
          const next=[Math.floor(p.x)>>4,Math.floor(p.z)>>4];
          if(next[0]!==peer.lastChunk[0]||next[1]!==peer.lastChunk[1]){peer.lastChunk=next;peer.world.runtime.ensureArea(p);void transfer(peer,{edits:peer.world.runtime.game.World.editsNear(p),metadata:peer.world.runtime.frame(p,true).metadata},'region');}
          return;
        }
        if(value?.type==='respawn'){
          peer.pose={...peer.world.runtime.spawn,yaw:0,pitch:0,dead:false,seen:Date.now()};send(peer,{type:'correction',position:peer.pose});return;
        }
        if(value?.type!=='request'||!validRequest(value.request)||typeof value.action!=='string')return;
        if(!ACTIONS.has(value.action)){send(peer,{type:'result',request:value.request,result:{ok:false,error:'unsupported'}});return;}
        for(const stack of [value.value?.stack,value.value?.held,value.action==='drop'?value.value:null])if(stack&&(!Number.isInteger(stack.id)||!peer.world.runtime.game.getItemDef(stack.id)||!Number.isInteger(stack.count)||stack.count<1||stack.count>64||stack.durability!==undefined&&(!Number.isInteger(stack.durability)||stack.durability<1||stack.durability>(peer.world.runtime.game.getItemDef(stack.id)?.maxDurability||1)))){
          send(peer,{type:'result',request:value.request,result:{ok:false,error:'invalid'}});return;
        }
        const active=peer,world=peer.world;
        world.chain=world.chain.then(async()=>{
          if(active.socket.readyState!==WebSocket.OPEN||world.failed)return;
          const cached=store.readOperation(active.identity.id,world.id,value.request);
          if(cached)return void send(active,{type:'result',request:value.request,result:cached});
          const key=active.identity.id+':'+value.request,existing=world.pendingOperations.get(key);
          if(existing){if(existing.waiters.length<4)existing.waiters.push(active);return;}
          const op={key,identity:active.identity.id,request:value.request,waiters:[active]};world.pendingOperations.set(key,op);
          let result;
          try{result=value.action==='save-player'?checkpoint(active,value.value):world.runtime.request(active.identity.id,value.action,value.value);}catch(error){result={ok:false,error:error.code||'rejected'};}
          await Promise.resolve();
          const changes=world.runtime.drain();
          Object.assign(op,{changes,result,event:MUTATIONS.has(value.action)&&(result?.ok||changes.length)?world.runtime.persistenceEvent(changes,value.value):null});
          world.writeQueue.push(op);if(!world.writeTimer)world.writeTimer=setTimeout(()=>flushWrites(world),10);
        }).catch(()=>failWorld(world));
      }catch(error){
        const temporary={socket};send(temporary,{type:'error',code:error.code||'INVALID_MESSAGE'});
        if(error.status===401||['SERVER_FULL','INVALID_PROTOCOL','VERSION_MISMATCH','RATE_LIMITED'].includes(error.code))socket.close(1008,error.code);
      }
    });
    socket.on('close',()=>{clearTimeout(authTimer);if(online.get(peer?.identity.id)===peer)disconnect(peer);});
  });
  const interval=setInterval(()=>{
    if(stopped)return;const began=performance.now(),dt=Math.min(.1,(began-lastTick)/1000);maxTickDelayMs=Math.max(maxTickDelayMs,began-lastTick-50);lastTick=began;tickNumber++;
    for(const world of worlds.values()){
      if(!world.peers.size||world.failed)continue;world.runtime.tick(dt);queueMicrotask(()=>publish(world));
      if(tickNumber%2===0){
        const shared={entities:world.runtime.adapter.entities(),metadata:tickNumber%20===0?world.runtime.adapter.sharedState().metadata:null};
        const q=n=>Math.round(n*1000)/1000;
        const rows=new Map([...world.peers.values()].map(p=>[p,[p.actorId,p.identity.name,q(p.pose.x),q(p.pose.y),q(p.pose.z),q(p.pose.yaw),q(p.pose.pitch),q(p.pose.speed||0),p.pose.dead?1:0,p.pose.appearance||{}]]));
        for(const peer of world.peers.values())if(peer.synced&&!peer.transferring){
          const visible=[...world.peers.values()].filter(p=>p!==peer).map(p=>({p,d:(p.pose.x-peer.pose.x)**2+(p.pose.z-peer.pose.z)**2})).filter(p=>p.d<112**2).sort((a,b)=>a.d-b.d).slice(0,24);
          send(peer,{type:'frame',online:world.peers.size,maxPlayers,players:visible.map(({p})=>rows.get(p)),state:world.runtime.frame(peer.pose,tickNumber%20===0,shared)});
        }
      }
      if(tickNumber%40===0)try{flushWrites(world);if(!world.failed)store.writeWorld(world.id,world.runtime.persistentSnapshot());}catch{failWorld(world);}
    }
    maxTickMs=Math.max(maxTickMs,performance.now()-began);
  },50);interval.unref();
  const heartbeat=setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}
    store.cleanup();const now=Date.now();for(const [key,value] of rateLimits)if(now-value.start>60000)rateLimits.delete(key);},30000);heartbeat.unref();
  return {server,wss,store,worlds,online,metadata,get metrics(){return {maxTickMs,maxTickDelayMs,ticks:tickNumber};},
    listen(port=Number(process.env.PORT)||8080,host='0.0.0.0'){return new Promise(resolve=>server.listen(port,host,()=>resolve(server.address())));},
    async close(){if(stopped)return;stopped=true;clearInterval(interval);clearInterval(heartbeat);for(const socket of wss.clients)socket.terminate();
      await Promise.all([...worlds.values()].map(w=>w.chain));for(const world of worlds.values()){flushWrites(world);if(!world.failed)store.writeWorld(world.id,world.runtime.persistentSnapshot());world.runtime.dispose();}
      await new Promise(resolve=>server.close(resolve));store.close();}
  };
}
if(require.main===module){
  const app=createGameServer();app.listen().then(address=>console.log('WebCraft dedicated server listening on port '+address.port+' (capacity '+app.metadata().maxPlayers+')'));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
}
module.exports={createGameServer,SERVER_CODES,finitePosition};
