/* WebCraft phase 3 server-backed beta. No money, PC, or real purchase workflows. */
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './wc-backend-config.js';
const $=id=>document.getElementById(id),section=$('credit-server');
if(section){
const notice=$('credit-server-status');
const report=msg=>{notice.textContent=msg;};
const configReady=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)&&SUPABASE_PUBLISHABLE_KEY.length>20;
if(!configReady){report('서버 미연결: 운영자가 Supabase URL과 공개 키를 설정해야 회원·제안 기능이 활성화됩니다. 기존 체험판은 이용할 수 있습니다.');}
else {
try{
const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,isAdmin=false;
function fail(error){report(error?.message||String(error));}
const categoryNames={feature:'게임 기능',bug:'버그 신고',ui:'UI 및 편의성',other:'기타'};
function row(entry,admin){
 const box=document.createElement('article');box.className='credit-server-item';
 const title=document.createElement('strong');title.textContent='#'+entry.id+' '+entry.title;
 const desc=document.createElement('p');desc.textContent=entry.description;
 const meta=document.createElement('small');meta.textContent=(categoryNames[entry.category]||entry.category)+' · '+entry.status+' · '+new Date(entry.created_at).toLocaleDateString();
 box.append(title,meta,desc);
 if(entry.review_reason){const reason=document.createElement('p');reason.textContent='운영자 답변: '+entry.review_reason;box.append(reason);}
 if(admin){
   const sel=document.createElement('select');sel.setAttribute('aria-label','검토 상태');for(const [value,name] of [['reviewing','검토 중'],['accepted','채택'],['on_hold','보류'],['rejected','반려']]){const op=document.createElement('option');op.value=value;op.textContent=name;sel.append(op);}sel.value=['reviewing','accepted','on_hold','rejected'].includes(entry.status)?entry.status:'reviewing';
   const reason=document.createElement('textarea');reason.placeholder='결정 이유를 5~500자로 입력';reason.maxLength=500;reason.value=entry.review_reason||'';
   const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='검토 결과 저장';
   button.addEventListener('click',async()=>{button.disabled=true;const {error}=await db.rpc('wc_review_suggestion',{p_id:entry.id,p_status:sel.value,p_reason:reason.value});button.disabled=false;if(error)fail(error);else{report('검토 결과가 저장됐습니다.');await refresh();}});
   box.append(sel,reason,button);
 }
 return box;
}
async function refresh(){
 if(!user)return;
 const [wallet,history,suggestions,admin]=await Promise.all([
  db.from('wc_wallets').select('free_credits').eq('user_id',user.id).maybeSingle(),
  db.from('wc_credit_ledger').select('amount,reason,created_at').order('created_at',{ascending:false}).limit(20),
  db.from('wc_suggestions').select('id,author_id,title,description,category,status,review_reason,created_at').order('created_at',{ascending:false}).limit(30),
  db.from('wc_admins').select('user_id').eq('user_id',user.id).maybeSingle()
 ]);
 for(const result of [wallet,history,suggestions,admin])if(result.error){fail(result.error);return;}
 isAdmin=!!admin.data;
 $('credit-server-fc').textContent=String(wallet.data?.free_credits||0);
 const ledger=$('credit-server-ledger');ledger.replaceChildren();
 for(const entry of history.data||[]){const li=document.createElement('li');li.textContent=(entry.amount>0?'+':'')+entry.amount+' FC · '+entry.reason+' · '+new Date(entry.created_at).toLocaleDateString();ledger.append(li);}
 const proposals=$('credit-server-list');proposals.replaceChildren();
 for(const entry of suggestions.data||[])proposals.append(row(entry,isAdmin));
 $('credit-server-admin-label').hidden=!isAdmin;
}
async function showSession(){
 const result=await db.auth.getUser();user=result.data?.user||null;
 $('credit-server-login').hidden=!!user;
 $('credit-server-app').hidden=!user;
 $('credit-server-identity').textContent=user?'로그인: '+(user.email||'회원'):'';
 if(user)await refresh();else report('로그인하면 서버에 저장되는 무료 크레딧과 제안을 사용할 수 있습니다.');
}
$('credit-server-login').addEventListener('submit',async e=>{
 e.preventDefault();const email=$('credit-server-email').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){report('이메일 형식을 확인해주세요.');return;}
 const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname+'#community-credits',shouldCreateUser:true}});
 if(error)fail(error);else report('이메일로 로그인 링크를 보냈어요. 받은 편지함을 확인해주세요.');
});
$('credit-server-logout').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error)fail(error);else await showSession();});
$('credit-server-checkin').addEventListener('click',async()=>{const {error}=await db.rpc('wc_claim_daily');if(error)fail(error);else{report('출석을 확인했어요. 같은 날에는 중복 적립되지 않습니다.');await refresh();}});
$('credit-server-proposal').addEventListener('submit',async e=>{
 e.preventDefault();if(!user)return;
 const title=$('credit-server-title').value.trim(),description=$('credit-server-description').value.trim(),category=$('credit-server-category').value;
 if(title.length<3||title.length>100||description.length<10||description.length>1400)return report('제목 3~100자, 설명 10~1400자로 입력해주세요.');
 const {error}=await db.from('wc_suggestions').insert({author_id:user.id,title,description,category});
 if(error)fail(error);else{$('credit-server-proposal').reset();report('제안이 서버에 등록됐습니다. 채택 여부는 운영자가 결정합니다.');await refresh();}
});
db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setTimeout(()=>{showSession().catch(fail);},0);});
await showSession();
}catch(e){fail(e);}
}
}
