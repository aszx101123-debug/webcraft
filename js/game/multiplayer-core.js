'use strict';

// Transport-independent room protocol. All inbound data is treated as untrusted.
const MultiplayerCore = (() => {
  const VERSION=1, MAX_PLAYERS=4, MAX_SNAPSHOT=1048576, PART_SIZE=8000;
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,64}$/.test(id);
  const roomCode=value=>String(value||'').toUpperCase().replace(/[\s-]/g,'');
  const validRoom=value=>/^[A-HJ-NP-Z2-9]{12}$/.test(value);
  const cleanName=value=>String(value||'Player').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16)||'Player';
  const finite=(n,limit=1000000)=>Number.isFinite(n)&&Math.abs(n)<=limit;
  const validPose=p=>p&&['x','y','z','yaw','pitch'].every(k=>finite(p[k]))&&p.y>=-100&&p.y<=200;
  const copy=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
  function create(options){
    const {id,host,room,send}=options,now=options.now||Date.now;
    if(!validId(id)||!validRoom(room)||typeof send!=='function')throw Error('Invalid room configuration');
    let roster=new Map(),present=new Map(),hostId=host?id:null,ready=!!host,closed=false,seq=0,requestNumber=0,lastHello=0;
    let snapshot=null,pendingCommits=new Map(),snapshotSource=null;
    const requests=new Map(),replies=new Map(),transfers=new Map(),rates=new Map();
    const emit=(kind,data,to)=>{
      if(closed)return;
      const packet={v:VERSION,room,from:id,kind,data,...(to?{to}:{})};
      try{const result=send(packet);result?.catch?.(e=>options.onError?.(e));}catch(e){options.onError?.(e);}
    };
    function status(value){options.onStatus?.(value);}
    function hello(){if(!host&&hostId){lastHello=now();emit('hello',{},hostId);}}
    function setRoster(entries){
      const clean=new Map();
      for(const item of Array.isArray(entries)?entries.slice(0,32):[]){
        if(!validId(item?.id)||item.version!==VERSION)continue;
        clean.set(item.id,{id:item.id,name:cleanName(item.name),host:item.host===true,joinedAt:Number.isFinite(item.joinedAt)?item.joinedAt:0});
      }
      present=clean;
      const hosts=[...clean.values()].filter(p=>p.host).sort((a,b)=>a.joinedAt-b.joinedAt||a.id.localeCompare(b.id));
      if(host&&hosts[0]&&hosts[0].id!==id){ready=false;status('duplicate-host');return;}
      const nextHost=hosts[0]?.id||null;
      if(!host&&nextHost!==hostId){hostId=nextHost;ready=false;snapshot=null;pendingCommits.clear();status(hostId?'connecting':'host-left');}
      // Keep existing seats when another guest arrives. Presence ordering is not admission ordering.
      const admitted=[...roster.values()].filter(p=>!p.host&&clean.has(p.id));
      if(host)for(const p of clean.values())if(!p.host&&!admitted.some(m=>m.id===p.id)&&admitted.length<MAX_PLAYERS-1)admitted.push(p);
      roster=new Map([...hosts.slice(0,1),...admitted].map(p=>[p.id,p]));
      options.onRoster?.([...roster.values()]);
      if(host){
        emit('roster',{ids:[...roster.keys()]});
        for(const p of clean.values())if(!p.host&&!roster.has(p.id))emit('failure',{reason:'full'},p.id);
      }else if(hostId&&!ready)hello();
    }
    function answer(peer,request,result){
      const key=peer+':'+request;
      replies.set(key,{result:copy(result),at:now()});
      while(replies.size>512)replies.delete(replies.keys().next().value);
      emit('result',{request,result},peer);
    }
    async function sendSnapshot(peer){
      if(!host||!options.getSnapshot||transfers.has(peer))return;
      const state=options.getSnapshot();if(!state)return;
      let json;try{json=JSON.stringify({seq,state});}catch{return;}
      if(json.length>MAX_SNAPSHOT){emit('failure',{reason:'world-too-large'},peer);return;}
      const token=id+'_'+(++requestNumber),count=Math.max(1,Math.ceil(json.length/PART_SIZE));
      transfers.set(peer,token);
      for(let index=0;index<count;index++){
        if(closed||transfers.get(peer)!==token)break;
        emit('snapshot',{token,index,count,text:json.slice(index*PART_SIZE,(index+1)*PART_SIZE)},peer);
        if(options.yieldSnapshot)await options.yieldSnapshot();
      }
      transfers.delete(peer);
    }
    function applyCommit(data){
      if(!Number.isSafeInteger(data?.seq)||data.seq<1)return;
      if(data.seq<=seq)return;
      if(!ready||snapshot){if(pendingCommits.size<2048)pendingCommits.set(data.seq,data);return;}
      if(data.seq!==seq+1){ready=false;status('resyncing');pendingCommits.set(data.seq,data);hello();return;}
      seq=data.seq;options.onCommit?.(copy(data.value));
    }
    function commit(value){if(!host||!ready)return false;seq++;emit('commit',{seq,value});return true;}
    function observeSequence(value){
      if(!host&&ready&&Number.isSafeInteger(value)&&value>seq){ready=false;status('resyncing');hello();}
    }
    async function receive(packet){
      if(closed||!packet||packet.v!==VERSION||packet.room!==room||!validId(packet.from)||packet.from===id||
        (packet.to&&packet.to!==id)||typeof packet.kind!=='string')return;
      let size;try{size=JSON.stringify(packet).length;}catch{return;}
      if(size>PART_SIZE*2+2500)return;
      if(!present.has(packet.from))return;
      const rate=rates.get(packet.from)||{start:now(),count:0};
      if(now()-rate.start>1000){rate.start=now();rate.count=0;}
      if(++rate.count>100)return;rates.set(packet.from,rate);
      const data=packet.data;
      if(packet.kind==='pose'){
        if(roster.has(packet.from)&&validPose(data))options.onPose?.(packet.from,copy(data));return;
      }
      if(host){
        if(!roster.has(packet.from)){if(packet.kind==='hello')emit('failure',{reason:'full'},packet.from);return;}
        if(packet.kind==='hello'){emit('roster',{ids:[...roster.keys()]},packet.from);await sendSnapshot(packet.from);return;}
        if(packet.kind!=='request'||!data||!validId(data.request)||typeof data.action!=='string'||!ready)return;
        const key=packet.from+':'+data.request,cached=replies.get(key);
        if(cached){emit('result',{request:data.request,result:cached.result},packet.from);return;}
        // Mark requests before handling them so asynchronous retries cannot execute twice.
        replies.set(key,{result:{ok:false,error:'pending'},at:now()});
        try{answer(packet.from,data.request,await options.onRequest?.(packet.from,data.action,copy(data.value))||{ok:false,error:'unsupported'});}
        catch{answer(packet.from,data.request,{ok:false,error:'rejected'});}
        return;
      }
      if(packet.from!==hostId)return;
      if(packet.kind==='roster'){
        if(!Array.isArray(data?.ids)||data.ids.length>MAX_PLAYERS||!data.ids.includes(hostId))return;
        roster=new Map(data.ids.filter(peer=>present.has(peer)).map(peer=>[peer,present.get(peer)]));
        options.onRoster?.([...roster.values()]);
        if(!data.ids.includes(id)){ready=false;status('full');}
        return;
      }
      if(packet.kind==='failure'){ready=false;status(data?.reason||'unavailable');return;}
      if(packet.kind==='commit'){applyCommit(data);return;}
      if(packet.kind==='event'){options.onEvent?.(copy(data));return;}
      if(packet.kind==='result'){
        const pending=requests.get(data?.request);if(!pending||data.result?.error==='pending')return;
        requests.delete(data.request);pending.resolve(copy(data.result));return;
      }
      if(packet.kind!=='snapshot'||!validId(data?.token)||!Number.isInteger(data.index)||!Number.isInteger(data.count)||
        data.count<1||data.count>Math.ceil(MAX_SNAPSHOT/PART_SIZE)||data.index<0||data.index>=data.count||
        typeof data.text!=='string'||data.text.length>PART_SIZE)return;
      if(!snapshot||snapshot.token!==data.token){snapshot={token:data.token,count:data.count,parts:new Map(),at:now()};snapshotSource=hostId;}
      if(snapshot.count!==data.count||snapshotSource!==hostId)return;
      snapshot.parts.set(data.index,data.text);
      if(snapshot.parts.size!==snapshot.count)return;
      const json=Array.from({length:snapshot.count},(_,i)=>snapshot.parts.get(i)).join('');
      snapshot=null;
      let payload;try{payload=JSON.parse(json);}catch{hello();return;}
      if(!Number.isSafeInteger(payload?.seq)||payload.seq<0||!payload.state||json.length>MAX_SNAPSHOT)return;
      ready=false;
      try{await options.onSnapshot?.(copy(payload.state));}catch{status('invalid-snapshot');return;}
      seq=payload.seq;ready=true;status('ready');
      const queued=[...pendingCommits.values()].sort((a,b)=>a.seq-b.seq);pendingCommits.clear();
      for(const entry of queued)applyCommit(entry);
    }
    function request(action,value){
      if(closed||!ready)return Promise.resolve({ok:false,error:'disconnected'});
      if(host)return Promise.resolve(options.onRequest?.(id,action,copy(value))||{ok:false,error:'unsupported'});
      if(requests.size>=32)return Promise.resolve({ok:false,error:'busy'});
      const request=id+'_'+(++requestNumber),data={request,action,value:copy(value)};
      return new Promise(resolve=>{requests.set(request,{resolve,data,at:now(),sent:now()});emit('request',data,hostId);});
    }
    function tick(){
      if(closed)return;
      if(!host&&hostId&&!ready&&now()-lastHello>2000)hello();
      if(snapshot&&now()-snapshot.at>15000){snapshot=null;hello();}
      for(const [key,p] of requests){
        if(now()-p.at>8000){requests.delete(key);p.resolve({ok:false,error:'timeout'});}
        else if(now()-p.sent>800){p.sent=now();emit('request',p.data,hostId);}
      }
      for(const [key,reply] of replies)if(now()-reply.at>30000)replies.delete(key);
    }
    function disconnected(){ready=false;snapshot=null;status('disconnected');}
    function reconnected(){if(host){ready=true;status('ready');}else hello();}
    function close(){closed=true;ready=false;for(const p of requests.values())p.resolve({ok:false,error:'closed'});requests.clear();}
    return {receive,setRoster,tick,request,commit,observeSequence,sendSnapshot,disconnected,reconnected,close,
      pose:value=>{if(ready&&validPose(value))emit('pose',value);},
      event:(value,to)=>{if(host)emit('event',value,to);},
      get ready(){return ready;},get hostId(){return hostId;},get sequence(){return seq;},get roster(){return [...roster.values()];}};
  }
  return {create,roomCode,validRoom,cleanName,validPose,VERSION,MAX_PLAYERS,MAX_SNAPSHOT};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MultiplayerCore;
