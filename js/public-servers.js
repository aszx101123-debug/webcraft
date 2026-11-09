import {identity,logout,serverBase} from './server-identity.js';

const params=new URLSearchParams(location.search),en=params.get('lang')==='en';
const $=id=>document.getElementById(id),status=$('server-identity-status'),error=$('server-error');
let player=null,servers=[],busy=false,signedIn=false;
if(en){document.documentElement.lang='en';for(const node of document.querySelectorAll('[data-en]'))node.textContent=node.dataset.en;
  $('server-language').textContent='한국어';$('server-language').href='servers.html';}
$('server-login').href='auth.html?next='+encodeURIComponent('servers.html'+(en?'?lang=en':''));
const message=(ko,english)=>en?english:ko;
function paint(){
  $('server-login').hidden=signedIn;
  $('server-logout').hidden=!signedIn;
  $('server-nickname-form').hidden=!signedIn;
  if(player){status.textContent=player.name+(player.account?message(' · 로그인 계정',' · Signed in'):message(' · 게스트',' · Guest'));
    if(player.account&&!$('server-nickname').value)$('server-nickname').value=player.name;}
  for(const mode of ['survival','creative']){
    const server=servers.find(s=>s.id===mode);$('server-'+mode+'-count').textContent=server?server.online+' / '+server.maxPlayers:'— / 100';
    $('server-'+mode+'-join').disabled=busy||!player||!server?.available;
  }
}
function showError(problem){
  error.dataset.code=problem.code||'';
  const english={NICKNAME_REQUIRED:'You are signed in. Save an English nickname to continue.',INVALID_NICKNAME:'Use 3–16 letters, numbers or underscores, starting with a letter. Guest names are reserved.',NICKNAME_TAKEN:'That nickname is taken. Choose another name.',SERVER_UNAVAILABLE:'The server connection is not ready. Friend rooms remain available.',LOGIN_REQUIRED:'Sign in to choose your own nickname.'};
  error.textContent=en?(english[problem.code]||'Could not connect. Please try again.'):problem.message;
  if(problem.code==='NICKNAME_REQUIRED'){signedIn=true;status.textContent=message('로그인됨 · 닉네임을 정해 주세요.','Signed in · Choose your nickname.');}
}
async function refresh(){
  if(busy)return;busy=true;error.textContent='';error.dataset.code='';paint();
  try{
    const response=await fetch(serverBase()+'/api/servers',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Object.assign(Error(message('서버 연결을 준비 중입니다. 기존 친구 방은 계속 이용할 수 있습니다.','Server unavailable.')),{code:'SERVER_UNAVAILABLE'});
    servers=(await response.json()).servers||[];player=await identity({force:true});signedIn=!!player.account;
  }catch(problem){player=null;showError(problem);}
  finally{busy=false;paint();}
}
$('server-nickname-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;paint();error.textContent='';
  try{player=await identity({nickname:$('server-nickname').value.trim(),force:true});signedIn=!!player.account;error.dataset.code='';}
  catch(problem){showError(problem);}finally{busy=false;paint();}
});
$('server-logout').addEventListener('click',async()=>{await logout();player=null;signedIn=false;$('server-nickname').value='';await refresh();});
$('server-refresh').addEventListener('click',refresh);
for(const mode of ['survival','creative'])$('server-'+mode+'-join').addEventListener('click',()=>{
  if(!player||busy)return;location.href='play.html?'+new URLSearchParams({server:mode,...(en?{lang:'en'}:{})});
});
await refresh();
setInterval(async()=>{if(document.hidden||busy)return;try{const response=await fetch(serverBase()+'/api/servers',{signal:AbortSignal.timeout(8000)});if(response.ok){servers=(await response.json()).servers||[];paint();}}catch{}},15000);
