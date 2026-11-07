/* Phase 2 sandbox: simulated payments only. NEVER use as a real wallet/payment authority. */
(()=>{'use strict';
const root=document.querySelector('#credit-sandbox');if(!root)return;
const key='webcraft-mock-payments-v1',MAX=100000,MAX_LOG=40;
const $=id=>document.getElementById(id);
const packs={small:50,medium:100,large:300};
function empty(){return {balance:0,transactions:[],priorityTokens:0};}
function load(){try{
 const raw=JSON.parse(localStorage.getItem(key)||'null');if(!raw||typeof raw!=='object')return empty();
 const transactions=Array.isArray(raw.transactions)?raw.transactions.filter(t=>t&&typeof t.id==='string'&&['charge','refund','redeem'].includes(t.type)&&Number.isInteger(t.amount)&&t.amount>0).slice(-MAX_LOG):[];
 return {balance:Number.isSafeInteger(raw.balance)?Math.max(0,Math.min(MAX,raw.balance)):0,transactions,priorityTokens:Number.isSafeInteger(raw.priorityTokens)?Math.max(0,Math.min(100,raw.priorityTokens)):0};
}catch{return empty();}}
const wallet=load();
const save=()=>{try{localStorage.setItem(key,JSON.stringify(wallet));return true;}catch{note('브라우저 저장소에 기록할 수 없습니다.');return false;}};
const label=t=>t.type==='charge'?'모의 충전':t.type==='refund'?'모의 취소':'테스트 우선 검토권';
const localizedDate=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleString();};
function note(message){$('credit-sandbox-status').textContent=message;}
function commit(type,amount,related){const entry={id:'demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),type,amount,date:new Date().toISOString(),related:related||null};wallet.transactions.push(entry);wallet.transactions=wallet.transactions.slice(-MAX_LOG);return entry;}
function showHistory(){const list=$('credit-transaction-list');list.replaceChildren();for(const item of [...wallet.transactions].reverse()){const li=document.createElement('li');const title=document.createElement('span');title.textContent=label(item)+' · '+(item.type==='charge'?'+':'-')+item.amount+' PC';const when=document.createElement('small');when.textContent=localizedDate(item.date);li.append(title,when);list.appendChild(li);}if(!wallet.transactions.length){const li=document.createElement('li');li.textContent='아직 테스트 거래가 없습니다.';list.appendChild(li);}}
function lastRefundable(){const reversed=[...wallet.transactions].reverse();return reversed.find(t=>t.type==='charge'&&!wallet.transactions.some(u=>u.type==='refund'&&u.related===t.id))||null;}
function render(){ $('credit-test-balance').textContent=wallet.balance.toLocaleString('ko-KR');$('credit-test-priority').textContent=String(wallet.priorityTokens);const main=$('credit-paid-balance');if(main)main.textContent=wallet.balance.toLocaleString('ko-KR');showHistory();const refundable=lastRefundable();$('credit-test-refund').disabled=!refundable||wallet.balance<refundable.amount;$('credit-test-redeem').disabled=wallet.balance<100; }
$('credit-test-charge').addEventListener('click',()=>{const amount=packs[$('credit-test-pack').value];if(!amount||wallet.balance+amount>MAX){note('테스트 잔액 한도(100,000 PC)를 초과했어요.');return;}wallet.balance+=amount;commit('charge',amount);if(!save())return;render();note(amount+' PC가 모의 충전됐어요. 실제 결제는 발생하지 않았습니다.');});
$('credit-test-refund').addEventListener('click',()=>{const original=lastRefundable();if(!original){note('취소할 모의 충전이 없어요.');return;}if(wallet.balance<original.amount){note('이미 사용한 테스트 PC가 있어서 해당 충전을 취소할 수 없어요.');return;}wallet.balance-=original.amount;commit('refund',original.amount,original.id);if(!save())return;render();note('최근 모의 충전이 취소됐어요. 실제 환불은 발생하지 않았습니다.');});
$('credit-test-redeem').addEventListener('click',()=>{if(wallet.balance<100){note('100 테스트 PC가 필요해요.');return;}wallet.balance-=100;wallet.priorityTokens=Math.min(100,wallet.priorityTokens+1);commit('redeem',100);if(!save())return;render();note('테스트 우선 검토권을 1개 받았어요. 실제 운영자 검토 효력은 없습니다.');});
render();
})();
