/* WebCraft free credit preview. No trusted economy or payments on a static website. */
(()=>{'use strict';
const root=document.querySelector('#community-credits');if(!root)return;
const key='webcraft-credits-preview-v1',cost=100;
const day=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
const $=id=>document.getElementById(id);
const safeLoad=()=>{try{const obj=JSON.parse(localStorage.getItem(key)||'{}');return {free:Math.max(0,Math.min(100000,Number(obj.free)||0)),checkin:typeof obj.checkin==='string'?obj.checkin:'',badges:Math.max(0,Math.min(1000,Number(obj.badges)||0))};}catch{return {free:0,checkin:'',badges:0};}};
const state=safeLoad();
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{show('이 브라우저에서 저장할 수 없습니다.');}}
function show(s){$('credit-status').textContent=s;}
function render(){$('credit-free-balance').textContent=state.free.toLocaleString('ko-KR');$('credit-paid-balance').textContent='0';$('credit-checkin').disabled=state.checkin===day();$('credit-checkin').textContent=state.checkin===day()?'오늘 출석 완료':'오늘 출석 +10 FC';$('credit-badges').textContent=state.badges;}
$('credit-checkin').addEventListener('click',()=>{if(state.checkin===day())return;state.free+=10;state.checkin=day();save();render();show('무료 크레딧 10 FC를 받았어요. 이 브라우저에서만 저장됩니다.');});
$('credit-highlight').addEventListener('click',()=>{if(state.free<cost){show('강조 표시에는 100 FC가 필요해요.');return;}state.free-=cost;state.badges++;save();render();updatePreview();show('제안서에 사용할 강조 배지를 받았어요. 실제 우선 검토 권한은 아닙니다.');});
function issueData(){const title=$('credit-title').value.trim().slice(0,100);const detail=$('credit-detail').value.trim().slice(0,1400);const kind=$('credit-category').value;return {title,detail,kind};}
function issueText(){const o=issueData();return '제안 유형: '+o.kind+'\n\n내용:\n'+(o.detail||'(내용을 입력해주세요)')+'\n\n---\nWebCraft 커뮤니티 제안 · 운영자 채택 보장 없음'+(state.badges?'\n참여 배지 (브라우저 데모): '+state.badges+'개 · 실제 우선 검토 효력 없음':'');}
function updatePreview(){$('credit-preview').textContent='[제안] '+(issueData().title||'제목을 입력해주세요')+'\n\n'+issueText();}
['credit-title','credit-detail','credit-category'].forEach(id=>$(id).addEventListener('input',updatePreview));
$('credit-proposal-form').addEventListener('submit',e=>{e.preventDefault();const o=issueData();if(o.title.length<3||o.detail.length<10){show('제목 3자 이상, 설명 10자 이상 작성해주세요.');return;}const url='https://github.com/aszx101123-debug/webcraft/issues/new?'+new URLSearchParams({title:'[제안] '+o.title,body:issueText()});const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();show('GitHub 제안 작성 화면이 열리면 로그인 후 직접 제출해주세요.');});
render();updatePreview();
})();