'use strict';

const Multiplayer = (() => {
  let context=null,core=null,channel=null,client=null,adapter=null,initial=null,timer=null;
  let dedicated=null;
  let status='offline',connected=false,applying=0,lastPose=0,lastState=0,frameParts=null,frameNumber=0;
  let prepareResolve=null,prepareReject=null,prepareTimer=null;
  const poses=new Map(),leases=new Map();
  let earlyCommits=[],earlyEvents=[];
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const messages={connecting:'방장과 월드 연결 중…',ready:'연결됨',resyncing:'월드 다시 동기화 중…',
    disconnected:'연결이 끊겼습니다. 다시 연결하는 중…','host-left':'방장 연결이 끊겼습니다. 방장을 기다리는 중…',
    full:'방이 가득 찼습니다 (최대 4명)','duplicate-host':'이미 열려 있는 방입니다. 참가로 들어가 주세요.',
    'world-too-large':'공유 월드의 동기화 한도를 넘었습니다. 새 방을 만들어 주세요.',
    'invalid-snapshot':'월드 정보를 읽지 못했습니다. 방에 다시 들어가 주세요.'};
  function paintStatus(value){
    status=value;
    const label=document.getElementById('mp-status');
    if(label)label.textContent=(context?'방 '+context.room+' · ':'')+(messages[value]||value);
    adapter?.status?.(value);
    if(['full','duplicate-host','world-too-large','invalid-snapshot'].includes(value)){
      prepareReject?.(Error(messages[value]));prepareReject=null;
    }
  }
  function validateSnapshot(state){
    if(!state||state.meta?.gameVersion!==CONFIG.VERSION||!Number.isInteger(state.meta.seed)||state.meta.seed<1||state.meta.seed>=2147483647||
      ![GAME_MODE.SURVIVAL,GAME_MODE.CREATIVE].includes(state.meta.mode)||state.meta.generatorVersion!==2||
      !Number.isFinite(state.time)||state.time<0||state.time>1||
      state.spawn&&!['x','y','z'].every(k=>Number.isFinite(state.spawn[k])&&Math.abs(state.spawn[k])<=1000000)||
      !Array.isArray(state.edits)||state.edits.length>4096)throw Error('다른 게임 버전이거나 잘못된 월드입니다.');
    let total=0;
    for(const entry of state.edits){
      if(!Array.isArray(entry)||entry.length!==2||!/^[-]?\d+,[-]?\d+$/.test(entry[0])||!Array.isArray(entry[1]))throw Error('Invalid edits');
      const [x,z]=entry[0].split(',').map(Number);
      if(Math.abs(x)>62500||Math.abs(z)>62500)throw Error('Invalid region');
      for(const pair of entry[1]){
        if(++total>16384||!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||pair[0]<0||pair[0]>=16384||
          !Number.isInteger(pair[1])||(pair[1]!==0&&!BLOCKS[pair[1]]))throw Error('Invalid blocks');
      }
    }
    return state;
  }
  function receiveEvent(data){
    if(!adapter){if(earlyEvents.length<64)earlyEvents.push(data);return;}
    if(data?.kind==='state-part'){
      if(typeof data.token!=='string'||!Number.isInteger(data.count)||data.count<1||data.count>128||
        !Number.isInteger(data.index)||data.index<0||data.index>=data.count||typeof data.text!=='string'||data.text.length>8000)return;
      if(!frameParts||frameParts.token!==data.token)frameParts={token:data.token,count:data.count,parts:new Map()};
      if(frameParts.count!==data.count)return;
      frameParts.parts.set(data.index,data.text);
      if(frameParts.parts.size!==data.count)return;
      const json=Array.from({length:data.count},(_,i)=>frameParts.parts.get(i)).join('');frameParts=null;
      try{const frame=JSON.parse(json);core.observeSequence(frame.sequence);applying++;adapter?.applyState?.(frame);}catch{}finally{applying=Math.max(0,applying-1);}
      return;
    }
    if(data?.kind==='entities')core.observeSequence(data.value?.sequence);
    adapter?.event?.(data);
  }
  async function prepare(params){
    if(params.get('server')){dedicated=DedicatedMultiplayer;try{return await dedicated.prepare(params);}catch(error){dedicated=null;throw error;}}
    const raw=params.get('room');if(!raw)return null;
    const room=MultiplayerCore.roomCode(raw);
    if(!MultiplayerCore.validRoom(room))throw Error('방 코드는 영문·숫자 12자리입니다.');
    const host=params.get('host')==='1';
    const seed=Number(params.get('seed'));
    const mode=params.get('mode')===GAME_MODE.CREATIVE?GAME_MODE.CREATIVE:GAME_MODE.SURVIVAL;
    context={room,id:uid(),host,joinedAt:Date.now(),name:MultiplayerCore.cleanName(params.get('name')),
      seed:Number.isInteger(seed)&&seed>0&&seed<2147483647?seed:crypto.getRandomValues(new Uint32Array(1))[0]%2147483646+1,
      mode,generatorVersion:2,gameVersion:CONFIG.VERSION};
    paintStatus('connecting');
    let db;try{db=await import('../supabase-client.js');}catch{throw Error('멀티플레이 서버를 불러올 수 없습니다. 인터넷 연결을 확인해 주세요.');}
    client=db.supabase;
    const prepared=new Promise((resolve,reject)=>{prepareResolve=resolve;prepareReject=reject;});
    prepareTimer=setTimeout(()=>{prepareReject?.(Error('방에 연결하지 못했습니다. 방장이 게임을 열었는지와 방 코드를 확인해 주세요.'));prepareReject=null;},20000);
    core=MultiplayerCore.create({id:context.id,room,host,
      send:async packet=>{const result=await channel.send({type:'broadcast',event:'game',payload:packet});if(result!=='ok')throw Error('Broadcast failed');},
      yieldSnapshot:()=>new Promise(resolve=>setTimeout(resolve,35)),
      onStatus:paintStatus,
      getSnapshot:()=>adapter?.snapshot?.(),
      onRequest:(peer,action,value)=>adapter?.request?.(peer,action,value)||{ok:false,error:'not-ready'},
      onSnapshot:state=>{
        validateSnapshot(state);
        if(adapter){applying++;try{adapter.snapshotReceived(state);}finally{applying--;}}
        else{initial=state;earlyCommits=[];earlyEvents=[];context={...context,...state.meta,room,id:context.id,host:false,name:context.name};
          clearTimeout(prepareTimer);prepareResolve?.(context);prepareResolve=null;prepareReject=null;}
      },
      onCommit:value=>{if(!adapter){earlyCommits.push(value);return;}applying++;try{adapter.commit(value);}finally{applying--;}}
      ,onPose:(peer,pose)=>{poses.set(peer,{...pose,seen:Date.now()});adapter?.pose?.(peer,pose);},
      onRoster:members=>{
        for(const peer of [...poses.keys()])if(!members.some(p=>p.id===peer))poses.delete(peer);
        for(const [key,lease] of leases)if(!members.some(p=>p.id===lease.owner))leases.delete(key);
        adapter?.members?.(members);
      },onEvent:receiveEvent,onError:()=>{core?.disconnected();setTimeout(()=>{if(connected)core?.reconnected();},1000);}
    });
    channel=client.channel('webcraft:v1:'+room,{config:{broadcast:{ack:true,self:false},presence:{key:context.id},private:false}});
    channel.on('broadcast',{event:'game'},({payload})=>{void core?.receive(payload);});
    channel.on('presence',{event:'sync'},()=>{
      const members=Object.values(channel.presenceState()).flat().map(p=>({id:p.id,name:p.name,host:p.host,version:p.version,joinedAt:p.joinedAt}));
      core?.setRoster(members);
    });
    channel.subscribe(async value=>{
      if(!core||!context)return;
      if(value==='SUBSCRIBED'){
        connected=true;core.reconnected();
        const tracked=await channel.track({id:context.id,name:context.name,host,version:MultiplayerCore.VERSION,joinedAt:context.joinedAt});
        if(tracked!=='ok'){core.disconnected();prepareReject?.(Error('방 참가 정보를 전송하지 못했습니다. 다시 시도해 주세요.'));return;}
        if(host){clearTimeout(prepareTimer);prepareResolve?.(context);prepareResolve=null;prepareReject=null;paintStatus('ready');}
      }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(value)){connected=false;core.disconnected();}
    });
    timer=setInterval(()=>{core.tick();networkTick();},125);
    try{return await prepared;}catch(error){await leave();throw error;}
  }
  function networkTick(){
    if(!adapter||!connected||!core?.ready)return;
    const now=Date.now();
    if(now-lastPose>=125){lastPose=now;const pose=adapter.selfPose?.();if(pose)core.pose(pose);
      if(context.host){const entities=adapter.entities?.();if(entities){entities.sequence=core.sequence;
        if(JSON.stringify(entities).length<8000)core.event({kind:'entities',value:entities});
        else broadcastFrame({entities});
      }}
    }
    adapter.networkTick?.();
    if(context.host&&now-lastState>=750){
      lastState=now;
      const frame=adapter.sharedState?.();if(!frame)return;
      broadcastFrame({...frame,sequence:core.sequence});
    }
  }
  function broadcastFrame(frame){
    let json;try{json=JSON.stringify(frame);}catch{return;}
    if(json.length>1048576)return;
    const count=Math.max(1,Math.ceil(json.length/8000)),token=context.id+'_'+(++frameNumber);
    for(let index=0;index<count;index++)core.event({kind:'state-part',token,count,index,text:json.slice(index*8000,(index+1)*8000)});
  }
  function bind(value){
    adapter=value;if(initial)adapter.initial?.(initial);
    applying++;try{for(const commit of earlyCommits)adapter.commit(commit);}finally{applying--;earlyCommits=[];}
    for(const event of earlyEvents)receiveEvent(event);earlyEvents=[];
    adapter.members?.(core?.roster||[]);for(const [id,pose] of poses)adapter.pose?.(id,pose);paintStatus(status);
  }
  async function leave(){
    clearTimeout(prepareTimer);clearInterval(timer);core?.close();
    if(channel&&client)await client.removeChannel(channel);
    connected=false;adapter?.dispose?.();adapter=null;context=null;core=null;channel=null;initial=null;
    poses.clear();leases.clear();earlyCommits=[];earlyEvents=[];
  }
  function request(action,value){return core?core.request(action,value):Promise.resolve({ok:false,error:'offline'});}
  function containerKey(kind,pos){return kind+':'+(typeof pos==='string'?pos:[pos.x,pos.y,pos.z].join(','));}
  async function lockContainer(kind,pos){
    const key=containerKey(kind,pos),result=await request('lock',{kind,pos});
    if(result.ok){leases.set(key,{owner:context.id,expires:Date.now()+10000});adapter?.containerState?.(kind,pos,result.state);}
    else{adapter?.toast?.(result.error==='locked'?'다른 플레이어가 사용 중입니다.':'상자를 열 수 없습니다. 연결을 확인해 주세요.');adapter?.containerDenied?.();}
    return !!result.ok;
  }
  function releaseContainer(kind,pos){
    if(!context)return;const key=containerKey(kind,pos);
    if(leases.get(key)?.owner!==context.id)return;
    const state=adapter?.readContainer?.(kind,pos);
    void request('release',{kind,pos,state});leases.delete(key);
  }
  function canUseContainer(kind,pos){const lease=leases.get(containerKey(kind,pos));return !context||connected&&core?.ready&&lease?.owner===context.id&&lease.expires>Date.now();}
  const api={prepare,bind,leave,request,lockContainer,releaseContainer,canUseContainer,containerKey,validateSnapshot,
    useUtility:(...args)=>adapter?.utility?.(...args),
    fireArrow:(...args)=>adapter?.fireArrow?.(...args),
    toggleDoor:pos=>adapter?.toggleDoor?.(pos),
    canEditBlock:pos=>{
      if(!context)return true;if(!connected||!core?.ready)return false;
      return !['chest','furnace'].some(kind=>{const lease=leases.get(containerKey(kind,pos));return lease&&lease.expires>Date.now()&&lease.owner!==context.id;});
    },
    chestTransfer:(...args)=>adapter?.chestTransfer?.(...args),
    furnaceDeposit:(...args)=>adapter?.furnaceDeposit?.(...args),
    furnaceWithdraw:(...args)=>adapter?.furnaceWithdraw?.(...args),
    furnaceInteract:(...args)=>adapter?.furnaceInteract?.(...args),
    get containerBusy(){return !!adapter?.containerBusy?.();},
    frame:dt=>adapter?.frame?.(dt),
    commit:value=>core?.commit(value),event:(value,peer)=>core?.event(value,peer),
    poseFor:id=>poses.get(id),get poses(){return poses;},get leases(){return leases;},
    get context(){return context;},get initial(){return initial;},get active(){return !!context;},
    get isHost(){return !!context?.host;},get ready(){return !!context&&connected&&!!core?.ready;},
    get applying(){return applying>0;},get status(){return status;},get members(){return core?.roster||[];}};
  return new Proxy(api,{get:(target,key)=>dedicated&&key!=='prepare'?dedicated[key]:target[key]});
})();
