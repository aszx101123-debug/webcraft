'use strict';
const {WebSocket}=require('ws');
const {randomBytes}=require('node:crypto');
class Client{
  constructor(url,token,version,{origin='http://localhost',server='survival'}={}){
    this.frames=[];this.parts=new Map();this.pending=new Map();this.number=0;this.prefix=randomBytes(12).toString('hex');this.receivedBytes=0;
    this.socket=new WebSocket(url,{headers:{Origin:origin}});
    this.ready=new Promise((resolve,reject)=>{
      this.resolve=resolve;this.reject=reject;this.timeout=setTimeout(()=>reject(Error('JOIN_TIMEOUT')),10000);
    });
    this.socket.on('open',()=>this.send({type:'hello',protocol:1,token,server,gameVersion:version}));
    this.socket.on('error',error=>{clearTimeout(this.timeout);this.reject(error);});
    this.socket.on('message',raw=>{
      this.receivedBytes+=raw.length;const value=JSON.parse(raw.toString());
      if(value.type==='welcome')this.identity=value.identity;
      if(value.type==='error'){this.error=value.code;clearTimeout(this.timeout);this.reject(Error(value.code));}
      if(value.type==='frame'){this.frames.push(value);if(this.frames.length>20)this.frames.shift();}
      if(value.type==='part'){
        let transfer=this.parts.get(value.token);if(!transfer){transfer=new Map();this.parts.set(value.token,transfer);}transfer.set(value.index,value.text);
        if(transfer.size===value.count){const data=JSON.parse(Array.from({length:value.count},(_,i)=>transfer.get(i)).join(''));this.parts.delete(value.token);
          if(value.kind==='snapshot'){this.snapshot=data;clearTimeout(this.timeout);this.resolve(data);}else this.region=data;}
      }
      if(value.type==='commit'){(this.commits||=[]).push(value);}
      if(value.type==='result'){const resolve=this.pending.get(value.request);if(resolve){this.pending.delete(value.request);resolve(value.result);}}
    });
  }
  send(value){if(this.socket.readyState===1)this.socket.send(JSON.stringify(value));}
  pose(value={}){this.send({type:'pose',value:{...this.snapshot.spawn,yaw:0,pitch:0,dead:false,speed:0,...value}});}
  request(action,value={},id=this.prefix+'_'+(++this.number)){
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('RPC_TIMEOUT')),5000);this.pending.set(id,result=>{clearTimeout(timer);resolve(result);});this.send({type:'request',request:id,action,value});});
  }
  close(){clearTimeout(this.timeout);this.socket.terminate();}
}
module.exports={Client};
