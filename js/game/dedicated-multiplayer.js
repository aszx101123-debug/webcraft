'use strict';
const DedicatedMultiplayer=(()=>{
  let context=null,initial=null,adapter=null,socket=null,identityApi=null,player=null;
  let ready=false,closed=false,applying=0,timer=null,reconnectTimer=null,attempt=0,requestNumber=0,preparedResolve=null,preparedReject=null,prepareTimer=null;
  let status='offline',lastPose=0,lastDead=false,online=0,members=[],earlyCommits=[],latestFrame=null;
  let renewing=false,nextRenewAt=0;
  const poses=new Map(),leases=new Map(),pending=new Map(),parts=new Map();
  const instance=()=>crypto.randomUUID().replace(/-/g,'');let requestPrefix='';
  const messages={connecting:'서버에 연결 중…',ready:'연결됨',disconnected:'연결이 끊겼습니다. 다시 연결 중…',SERVER_FULL:'서버가 가득 찼습니다. 잠시 후 다시 시도해 주세요.',
    SESSION_REPLACED:'다른 창에서 접속했습니다. 이 창의 연결을 종료합니다.',SESSION_EXPIRED:'접속 시간이 만료되었습니다. 서버 목록에서 다시 참가해 주세요.',
    INVALID_SESSION:'접속 정보를 확인할 수 없습니다. 서버 목록에서 다시 참가해 주세요.',VERSION_MISMATCH:'게임 버전이 달라졌습니다. 새로고침해 주세요.',
    REGION_TOO_LARGE:'이 지역의 변경 데이터가 너무 큽니다. 서버 관리자에게 알려 주세요.',SAVE_FAILED:'서버 저장에 실패했습니다. 연결을 확인해 주세요.',WORLD_CHANGED:'월드가 변경되었습니다. 새로고침해 주세요.'};
  function paint(value){
    status=value;const label=document.getElementById('mp-status');
    if(label)label.textContent=(context?.name?context.name+' · ':'')+(messages[value]||value)+' · '+online+'/100';
    adapter?.status?.(value);
  }
  const send=value=>{if(socket?.readyState===1){socket.send(JSON.stringify(value));return true;}return false;};
  function validate(snapshot){
    if(snapshot?.meta?.gameVersion!==CONFIG.VERSION||!Number.isInteger(snapshot.meta.seed)||snapshot.meta.seed<1||snapshot.meta.seed>=2147483647||
      ![GAME_MODE.SURVIVAL,GAME_MODE.CREATIVE].includes(snapshot.meta.mode)||snapshot.meta.generatorVersion!==2||
      !Array.isArray(snapshot.edits)||snapshot.edits.length>169||!Number.isFinite(snapshot.time)||snapshot.time<0||snapshot.time>1||
      !snapshot.spawn||!['x','y','z'].every(k=>Number.isFinite(snapshot.spawn[k])))throw Error('잘못된 서버 월드 정보입니다.');
    for(const [key,entries] of snapshot.edits){
      if(typeof key!=='string'||! /^-?\d+,-?\d+$/.test(key)||!Array.isArray(entries)||entries.length>16384)throw Error('잘못된 블록 정보입니다.');
      for(const [index,id] of entries)if(!Number.isInteger(index)||index<0||index>=16384||!Number.isInteger(id)||id!==0&&!BLOCKS[id])throw Error('잘못된 블록 정보입니다.');
    }
  }
  function updateFrame(frame){
    if(!frame||!Array.isArray(frame.players)||frame.players.length>24)return;
    const players=frame.players.filter(p=>Array.isArray(p)&&p.length===10&&typeof p[0]==='string'&&typeof p[1]==='string').map(p=>({id:p[0],name:p[1],pose:{x:p[2],y:p[3],z:p[4],yaw:p[5],pitch:p[6],speed:p[7],dead:!!p[8],appearance:p[9]}}));
    online=Number.isInteger(frame.online)?Math.max(0,Math.min(100,frame.online)):online;
    members=[{id:context.id,name:context.name},...players.map(p=>({id:p.id,name:p.name}))];
    poses.clear();for(const peer of players)if(MultiplayerCore.validPose(peer.pose))poses.set(peer.id,{...peer.pose,seen:Date.now()});
    if(!adapter){latestFrame=frame;return;}
    adapter.members?.(members);for(const [id,pose] of poses)adapter.pose?.(id,pose);
    applying++;try{adapter.applyState?.(frame.state);}finally{applying--;}
    paint(status);
  }
  function applyTransfer(kind,value){
    if(kind==='region'){
      if(adapter){applying++;try{adapter.region?.(value);}finally{applying--;}}else earlyCommits.push({kind:'region',value});return;
    }
    validate(value);
    if(initial&&value.meta.seed!==context.seed)throw Object.assign(Error(messages.WORLD_CHANGED),{code:'WORLD_CHANGED'});
    initial=value;context={...context,...value.meta,saveKey:context.server+':'+context.id};ready=true;attempt=0;
    if(adapter){applying++;try{adapter.snapshotReceived(value);}finally{applying--;}}
    else earlyCommits=[];
    clearTimeout(prepareTimer);paint('ready');preparedResolve?.(context);preparedResolve=null;preparedReject=null;
  }
  function receive(raw){
    try{
      if(typeof raw!=='string'||raw.length>4300000)return;const packet=JSON.parse(raw);
      if(packet.type==='welcome'){
        if(!packet.identity?.id||typeof packet.identity.name!=='string')return;
        context={...context,id:packet.identity.id,name:packet.identity.name,account:packet.identity.account,room:packet.room};online=packet.online;return;
      }
      if(packet.type==='error'){
        const code=packet.code||'disconnected';ready=false;paint(code);
        if(['SERVER_FULL','INVALID_SESSION','SESSION_EXPIRED','VERSION_MISMATCH','REGION_TOO_LARGE','SAVE_FAILED'].includes(code)){
          closed=true;preparedReject?.(Error(messages[code]||code));preparedReject=null;socket?.close();
        }return;
      }
      if(packet.type==='part'){
        if(!['snapshot','region'].includes(packet.kind)||typeof packet.token!=='string'||!Number.isInteger(packet.count)||packet.count<1||packet.count>350||
          !Number.isInteger(packet.index)||packet.index<0||packet.index>=packet.count||typeof packet.text!=='string'||packet.text.length>12000)return;
        let transfer=parts.get(packet.token);if(!transfer){if(parts.size>=2)parts.delete(parts.keys().next().value);transfer={kind:packet.kind,count:packet.count,values:new Map(),at:Date.now()};parts.set(packet.token,transfer);}
        if(transfer.count!==packet.count||transfer.kind!==packet.kind)return;transfer.values.set(packet.index,packet.text);
        if(transfer.values.size===transfer.count){const json=Array.from({length:transfer.count},(_,i)=>transfer.values.get(i)).join('');parts.delete(packet.token);if(json.length>4194304)throw Error('월드 정보가 너무 큽니다.');applyTransfer(transfer.kind,JSON.parse(json));}return;
      }
      if(packet.type==='frame'){updateFrame(packet);return;}
      if(packet.type==='commit'){
        if(!adapter){if(earlyCommits.length<2048)earlyCommits.push(packet.value);return;}
        applying++;try{adapter.commit(packet.value);}finally{applying--;}return;
      }
      if(packet.type==='result'){const operation=pending.get(packet.request);if(operation){pending.delete(packet.request);operation.resolve(packet.result);}return;}
      if(packet.type==='event'){adapter?.event?.(packet.value);return;}
      if(packet.type==='correction'&&MultiplayerCore.validPose(packet.position))adapter?.correction?.(packet.position);
    }catch(error){ready=false;closed=true;paint(error.code||'WORLD_CHANGED');preparedReject?.(error);preparedReject=null;socket?.close();}
  }
  function connect(){
    if(closed)return;paint('connecting');
    const url=new URL(identityApi.serverBase());url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';
    socket=new WebSocket(url.href);
    socket.addEventListener('open',()=>send({type:'hello',protocol:1,gameVersion:CONFIG.VERSION,server:context.server,token:player.token}));
    socket.addEventListener('message',event=>receive(event.data));socket.addEventListener('error',()=>{});
    socket.addEventListener('close',event=>{
      ready=false;parts.clear();leases.clear();
      if(event.code===4001){closed=true;paint('SESSION_REPLACED');return;}
      if(closed)return;paint('disconnected');
      if(player.expiresAt<Date.now()){closed=true;paint('SESSION_EXPIRED');return;}
      reconnectTimer=setTimeout(connect,Math.min(10000,500*2**Math.min(5,attempt++)));
    });
  }
  async function prepare(params){
    const server=params.get('server');if(!['survival','creative'].includes(server))throw Error('올바른 서버를 선택해 주세요.');
    closed=false;ready=false;requestPrefix=instance();
    identityApi=await import('../server-identity.js');player=await identityApi.identity();
    context={server,host:false,id:player.id,name:player.name,account:player.account,mode:server,generatorVersion:2,gameVersion:CONFIG.VERSION};
    const prepared=new Promise((resolve,reject)=>{preparedResolve=resolve;preparedReject=reject;});
    prepareTimer=setTimeout(()=>{preparedReject?.(Error('서버에 연결하지 못했습니다. 서버 목록에서 연결 상태를 확인해 주세요.'));preparedReject=null;},20000);
    connect();timer=setInterval(tick,125);
    try{return await prepared;}catch(error){leave();throw error;}
  }
  function tick(){
    const now=Date.now();for(const [key,value] of parts)if(now-value.at>15000)parts.delete(key);
    for(const [id,operation] of pending){
      if(now-operation.at>8000){pending.delete(id);operation.resolve({ok:false,error:'timeout'});}
      else if(ready&&now-operation.sent>800){operation.sent=now;send(operation.packet);}
    }
    if(!ready||!adapter)return;
    if(!renewing&&now>nextRenewAt&&player.expiresAt-now<300000){
      renewing=true;nextRenewAt=now+30000;
      void identityApi.identity({force:true}).then(next=>{if(!closed&&next.id===context.id){player=next;send({type:'renew',token:next.token});}}).catch(()=>{}).finally(()=>{renewing=false;});
    }
    if(now-lastPose>=125){lastPose=now;const pose=adapter.selfPose?.();if(pose){if(lastDead&&!pose.dead)send({type:'respawn'});lastDead=!!pose.dead;send({type:'pose',value:pose});}}
    adapter.networkTick?.();
  }
  function bind(value){
    adapter=value;if(initial)adapter.initial?.(initial);
    applying++;try{for(const change of earlyCommits)if(change?.kind==='region')adapter.region?.(change.value);else adapter.commit(change);}finally{applying--;earlyCommits=[];}
    if(latestFrame){updateFrame(latestFrame);latestFrame=null;}paint(status);
  }
  function request(action,value){
    if(!ready||closed)return Promise.resolve({ok:false,error:'disconnected'});
    if(pending.size>=32)return Promise.resolve({ok:false,error:'busy'});
    const id=requestPrefix+'_'+(++requestNumber),packet={type:'request',request:id,action,value};
    return new Promise(resolve=>{pending.set(id,{resolve,packet,at:Date.now(),sent:Date.now()});send(packet);});
  }
  function leave(){
    closed=true;ready=false;clearInterval(timer);clearTimeout(reconnectTimer);clearTimeout(prepareTimer);socket?.close();
    for(const operation of pending.values())operation.resolve({ok:false,error:'closed'});pending.clear();parts.clear();poses.clear();leases.clear();adapter?.dispose?.();adapter=null;context=null;initial=null;
  }
  const containerKey=(kind,pos)=>kind+':'+(typeof pos==='string'?pos:[pos.x,pos.y,pos.z].join(','));
  async function lockContainer(kind,pos){
    const result=await request('lock',{kind,pos});
    if(result.ok){leases.set(containerKey(kind,pos),{owner:context.id,expires:Date.now()+10000});adapter?.containerState?.(kind,pos,result.state);}
    else{adapter?.toast?.('다른 플레이어가 사용 중이거나 연결할 수 없습니다.');adapter?.containerDenied?.();}return !!result.ok;
  }
  return {prepare,bind,request,leave,containerKey,lockContainer,
    releaseContainer:(kind,pos)=>{if(!context)return;void request('release',{kind,pos});leases.delete(containerKey(kind,pos));},
    canUseContainer:(kind,pos)=>ready&&leases.get(containerKey(kind,pos))?.owner===context?.id&&leases.get(containerKey(kind,pos))?.expires>Date.now(),
    canEditBlock:()=>ready,
    useUtility:(...args)=>adapter?.utility?.(...args),fireArrow:(...args)=>adapter?.fireArrow?.(...args),toggleDoor:pos=>adapter?.toggleDoor?.(pos),
    chestTransfer:(...args)=>adapter?.chestTransfer?.(...args),furnaceDeposit:(...args)=>adapter?.furnaceDeposit?.(...args),furnaceWithdraw:(...args)=>adapter?.furnaceWithdraw?.(...args),furnaceInteract:(...args)=>adapter?.furnaceInteract?.(...args),
    frame:dt=>adapter?.frame?.(dt),commit:()=>false,event:()=>{},poseFor:id=>poses.get(id),
    checkpoint:data=>{const {player,inventory,equipment,hp,food,crafting}=data;let {inventoryCursor}=data;if(inventoryCursor&&!Number.isFinite(inventoryCursor.count))inventoryCursor={...inventoryCursor,count:64};return request('save-player',{player,inventory,equipment,hp,food,crafting,inventoryCursor});},
    get context(){return context;},get initial(){return initial;},get active(){return !!context;},get isHost(){return false;},get ready(){return ready;},get applying(){return applying>0;},
    get poses(){return poses;},get leases(){return leases;},get members(){return members;},get onlineCount(){return online;},get status(){return status;},get containerBusy(){return !!adapter?.containerBusy?.();}};
})();
