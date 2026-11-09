'use strict';
(()=>{
  const params=new URLSearchParams(location.search),en=params.get('lang')==='en';
  if(en){
    document.documentElement.lang='en';
    for(const node of document.querySelectorAll('[data-en]'))node.textContent=node.dataset.en;
    const toggle=document.getElementById('mp-language');toggle.textContent='한국어';toggle.lang='ko';
    params.delete('lang');toggle.href='?'+params.toString();
  }else{
    const next=new URLSearchParams(params);next.set('lang','en');document.getElementById('mp-language').href='?'+next;
  }
  const name=document.getElementById('mp-name'),code=document.getElementById('mp-code');
  const error=document.getElementById('mp-error'),resume=document.getElementById('mp-resume');
  const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
  const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  name.value=MultiplayerCore.cleanName(read('webcraft.multiplayer.name')||'Player');
  code.value=MultiplayerCore.roomCode(params.get('room'));
  const go=values=>{
    const nick=MultiplayerCore.cleanName(name.value);write('webcraft.multiplayer.name',nick);
    const query=new URLSearchParams({...values,name:nick,...(en?{lang:'en'}:{})});
    location.href='play.html?'+query;
  };
  function seedOf(raw){
    if(!raw)return crypto.getRandomValues(new Uint32Array(1))[0]%2147483646+1;
    if(/^\d+$/.test(raw))return Number(BigInt(raw)%2147483647n)||1;
    let h=5381;for(const ch of raw)h=((h*33)^ch.charCodeAt(0))>>>0;return h%2147483646+1;
  }
  document.getElementById('mp-create').addEventListener('submit',event=>{
    event.preventDefault();
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // The 32-character alphabet divides the full byte range evenly.
    const room=Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>alphabet[n%32]).join('');
    const values={room,host:'1',seed:String(seedOf(document.getElementById('mp-seed').value.trim())),mode:document.getElementById('mp-mode').value};
    write('webcraft.multiplayer.last-host',JSON.stringify(values));go(values);
  });
  document.getElementById('mp-join').addEventListener('submit',event=>{
    event.preventDefault();const room=MultiplayerCore.roomCode(code.value);
    if(!MultiplayerCore.validRoom(room)){error.textContent=en?'Enter the 12-character room code.':'영문·숫자 12자리 방 코드를 입력해 주세요.';return;}
    go({room});
  });
  try{
    const last=JSON.parse(read('webcraft.multiplayer.last-host'));
    if(MultiplayerCore.validRoom(last?.room)&&Number.isInteger(Number(last.seed))&&Number(last.seed)>0&&['survival','creative'].includes(last.mode)){
      resume.hidden=false;resume.addEventListener('click',()=>go({room:last.room,host:'1',seed:String(last.seed),mode:last.mode}));
    }
  }catch{}
  if(code.value)document.getElementById('mp-join').classList.add('mp-invited');
})();
