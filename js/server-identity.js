import {supabase} from './supabase-client.js';

let current=null;
export function serverBase(){
  const base=new URL(globalThis.WebCraftServerConfig?.apiBase||location.origin);
  if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||
    base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('서버 주소를 확인해 주세요.');
  return base.origin;
}
const guestKey=()=> 'webcraft.server.guest:'+serverBase();
const readGuest=()=>{try{return localStorage.getItem(guestKey());}catch{return null;}};
const writeGuest=token=>{try{localStorage.setItem(guestKey(),token);}catch{}};
const errors={
  NICKNAME_REQUIRED:'로그인되었습니다. 사용할 영문 닉네임을 저장해 주세요.',
  INVALID_NICKNAME:'영문자로 시작하는 3~16자리 영문·숫자·밑줄을 사용하세요. Guest와 Guest숫자는 사용할 수 없습니다.',
  NICKNAME_TAKEN:'이미 사용 중인 닉네임입니다. 다른 이름을 선택해 주세요.',PROFILE_IN_USE:'서버에서 나온 뒤 닉네임을 변경해 주세요.',
  LOGIN_REQUIRED:'원하는 닉네임을 사용하려면 로그인해 주세요.',INVALID_LOGIN:'로그인 상태를 다시 확인해 주세요.',
  RATE_LIMITED:'요청이 많습니다. 잠시 후 다시 시도해 주세요.',AUTH_UNAVAILABLE:'로그인 서버에 연결하지 못했습니다.'
};
export async function identity({nickname,force=false}={}){
  if(current&&!force&&nickname===undefined&&current.expiresAt>Date.now()+30000)return current;
  const {data:{session}}=await supabase.auth.getSession();
  let accessToken;
  if(session){
    const {data:{user},error}=await supabase.auth.getUser();
    if(error)throw Error(errors.INVALID_LOGIN);
    if(user&&!user.is_anonymous)accessToken=session.access_token;
  }
  let response;
  try{response=await fetch(serverBase()+'/api/identity',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(accessToken?{accessToken,...(nickname!==undefined?{nickname}:{})}:{guestToken:readGuest(),...(nickname!==undefined?{nickname}:{})}),signal:AbortSignal.timeout(15000)});}
  catch{const error=Error('서버에 연결하지 못했습니다. 서버 안내를 확인하고 다시 시도해 주세요.');error.code='SERVER_UNAVAILABLE';throw error;}
  let value;try{value=await response.json();}catch{const error=Error('서버 연결을 준비 중입니다. 기존 친구 방은 계속 이용할 수 있습니다.');error.code='SERVER_UNAVAILABLE';throw error;}
  if(!response.ok){const error=Error(errors[value.error]||'서버 연결을 확인해 주세요.');error.code=value.error;throw error;}
  current=value;if(!value.account)writeGuest(value.token);return current;
}
export async function logout(){await supabase.auth.signOut();current=null;}
