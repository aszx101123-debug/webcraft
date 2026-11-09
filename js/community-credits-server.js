/* WebCraft production free credits — server-authoritative, no real-money purchases. */
import { supabase as db } from './supabase-client.js';
const $=id=>document.getElementById(id);
const status=$('credit-server-status');
const tell=message=>{ if(status) status.textContent=message; };
const name={feature:'게임 기능',bug:'버그 신고',ui:'UI / 편의성',other:'기타'};
let user=null,admin=false;
let authRevision=0;
const formatDate=value=>new Date(value).toLocaleDateString('ko-KR');
const errorMessage=e=>e?.message?.includes('Already claimed')?'오늘 출석은 이미 완료했습니다.':
 e?.message?.includes('Not enough')?'크레딧이 부족합니다.':
 e?.message?.includes('duplicate')?'중복 요청입니다.':(e?.message||'요청에 실패했습니다.');
const guestMessage='로그인 없이 게임을 즐길 수 있습니다. 크레딧 적립·배지 교환은 로그인한 계정에서만 가능합니다.';
function showGuest(message=guestMessage){
 user=null;admin=false;
 $('credit-server-login').hidden=false;
 $('credit-server-app').hidden=true;
 $('credit-server-admin-label').hidden=true;
 $('credit-server-fc').textContent='0';
 $('credit-server-badges').textContent='0';
 $('credit-server-identity').textContent='';
 for(const id of ['credit-server-checkin','credit-server-badge-buy'])$(id).disabled=true;
 tell(message);
}
async function refresh(){
 if(!user)return;
 const [wallet,badges,ledger,suggestions,admins]=await Promise.all([
 db.from('wc_wallets').select('free_credits').eq('user_id',user.id).maybeSingle(),
 db.from('wc_badges').select('quantity').eq('user_id',user.id).maybeSingle(),
 db.from('wc_credit_ledger').select('amount,reason,created_at').order('created_at',{ascending:false}).limit(20),
 db.from('wc_suggestions').select('id,title,description,category,status,review_reason,created_at').order('created_at',{ascending:false}).limit(30),
 db.from('wc_admins').select('user_id').eq('user_id',user.id).maybeSingle()
 ]);
 for(const result of [wallet,badges,ledger,suggestions,admins]){
  if(result.error)throw result.error;
 }
 admin=!!admins.data;
 $('credit-server-fc').textContent=String(wallet.data?.free_credits||0);
 $('credit-server-badges').textContent=String(badges.data?.quantity||0);
 const ledgerList=$('credit-server-ledger');ledgerList.replaceChildren();
 for(const x of ledger.data||[]){
  const li=document.createElement('li');
  li.textContent=(x.amount>0?'+':'')+x.amount+' FC · '+({daily_checkin:'출석 적립',suggestion_badge:'제안 배지 교환'}[x.reason]||x.reason)+' · '+formatDate(x.created_at);
  ledgerList.append(li);
 }
 if(!ledger.data?.length){const li=document.createElement('li');li.textContent='거래 내역이 없습니다.';ledgerList.append(li);}
 const list=$('credit-server-list');list.replaceChildren();
 for(const item of suggestions.data||[]){
  const article=document.createElement('article');article.className='credit-server-item';
  const title=document.createElement('strong');title.textContent='#'+item.id+' '+item.title;
  const info=document.createElement('small');info.textContent=(name[item.category]||item.category)+' · '+({reviewing:'검토 중',accepted:'채택',on_hold:'보류',rejected:'반려'}[item.status]||item.status)+' · '+formatDate(item.created_at);
  const desc=document.createElement('p');desc.textContent=item.description;article.append(title,info,desc);
  if(item.review_reason){const p=document.createElement('p');p.textContent='운영자 답변: '+item.review_reason;article.append(p);}
  if(admin){
   const sel=document.createElement('select');
   for(const [v,t] of [['reviewing','검토 중'],['accepted','채택'],['on_hold','보류'],['rejected','반려']]){
    const o=document.createElement('option');o.value=v;o.textContent=t;sel.append(o);
   }
   sel.value=item.status;
   const reason=document.createElement('textarea');reason.placeholder='검토 사유 5~500자';reason.maxLength=500;reason.value=item.review_reason||'';
   const save=document.createElement('button');save.className='btn';save.textContent='검토 결과 저장';save.type='button';
   save.addEventListener('click',async()=>{save.disabled=true;try{const {error}=await db.rpc('wc_review_suggestion',{p_id:item.id,p_status:sel.value,p_reason:reason.value});if(error)throw error;tell('검토 결과가 저장되었습니다.');await refresh();}catch(e){tell(errorMessage(e));}finally{save.disabled=false;}});
   article.append(sel,reason,save);
  }
  list.append(article);
 }
 $('credit-server-admin-label').hidden=!admin;
}
async function loadUser(){
 const revision=++authRevision;
 showGuest();
 const {data,error}=await db.auth.getUser();
 if(revision!==authRevision)return;
 if(error||!data?.user||data.user.is_anonymous){
  if(error&&error.name!=='AuthSessionMissingError')tell('로그인 상태를 확인하지 못했습니다. 게임은 로그인 없이 플레이할 수 있습니다.');
  return;
 }
 user=data.user;
 $('credit-server-login').hidden=true;
 $('credit-server-app').hidden=false;
 for(const id of ['credit-server-checkin','credit-server-badge-buy'])$(id).disabled=false;
 $('credit-server-identity').textContent='로그인: '+(user.email||'플레이어');
 await refresh();tell('계정 크레딧이 안전하게 동기화되었습니다.');
}
async function action(button,operation,success){
 if(!user||user.is_anonymous)return tell(guestMessage);
 button.disabled=true;
 try{const {error}=await operation();if(error)throw error;await refresh();tell(success);}
 catch(e){tell(errorMessage(e));}
 finally{button.disabled=false;}
}
$('credit-server-checkin').addEventListener('click',()=>action($('credit-server-checkin'),()=>db.rpc('wc_claim_daily'),'출석 +10 FC가 적립되었습니다.'));
$('credit-server-badge-buy').addEventListener('click',()=>action($('credit-server-badge-buy'),()=>db.rpc('wc_buy_badge'),'100 FC로 제안 배지 1개를 교환했습니다. 배지는 채택을 보장하지 않습니다.'));
$('credit-server-proposal').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!user)return tell('로그인 후 이용하세요.');
 const form=e.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const title=$('credit-server-title').value.trim(),description=$('credit-server-description').value.trim(),category=$('credit-server-category').value;
  if(title.length<3||title.length>100||description.length<10||description.length>1400)throw Error('제목 3~100자, 설명 10~1400자로 입력하세요.');
  const {error}=await db.from('wc_suggestions').insert({author_id:user.id,title,description,category});
  if(error)throw error;
  form.reset();await refresh();tell('제안이 등록되었습니다. 채택 여부는 운영자가 결정합니다.');
 }catch(err){tell(errorMessage(err));}
 finally{submit.disabled=false;}
});
$('credit-server-logout').addEventListener('click',async()=>{
 const {error}=await db.auth.signOut();if(error)return tell(errorMessage(error));
 location.reload();
});
$('credit-server-login-link').addEventListener('click',()=>{location.href='auth.html?next=index.html';});
db.auth.onAuthStateChange((_event,session)=>{
 if(!session?.user||session.user.is_anonymous){++authRevision;showGuest();}
 setTimeout(()=>loadUser().catch(e=>showGuest(errorMessage(e))),0);
});
loadUser().catch(()=>showGuest('계정 서버에 연결하지 못했습니다. 게임은 로그인 없이 플레이할 수 있습니다.'));
