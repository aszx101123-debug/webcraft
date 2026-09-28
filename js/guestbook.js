'use strict';

(() => {
  const KEY='webcraft_guestbook_v1', $=id=>document.getElementById(id);
  const form=$('guestbook-form'), nameEl=$('guestbook-name'), messageEl=$('guestbook-message'), countEl=$('guestbook-count'), listEl=$('guestbook-list'), clearBtn=$('guestbook-clear');
  if(!form||!nameEl||!messageEl||!listEl)return;
  const load=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.name==='string'&&typeof x.message==='string'):[]}catch(_){return[]}};
  const save=e=>localStorage.setItem(KEY,JSON.stringify(e.slice(0,50)));
  const esc=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  function render(){const e=load();listEl.innerHTML=e.length?e.map(x=>'<article class="guestbook-entry"><div class="guestbook-entry-top"><span class="guestbook-entry-name">'+esc(x.name)+'</span><time class="guestbook-entry-date">'+esc(new Date(x.createdAt||Date.now()).toLocaleString('ko-KR'))+'</time></div><p class="guestbook-entry-message">'+esc(x.message)+'</p></article>').join(''):'<div class="guestbook-empty">아직 방명록이 없습니다. 첫 글을 남겨보세요.</div>';}
  function updateCount(){countEl.textContent=messageEl.value.length+'/160';}
  messageEl.addEventListener('input',updateCount);
  form.addEventListener('submit',e=>{e.preventDefault();const name=nameEl.value.trim(),message=messageEl.value.trim();if(!name||!message)return;const a=load();a.unshift({name:name.slice(0,20),message:message.slice(0,160),createdAt:Date.now()});save(a);form.reset();updateCount();render();});
  clearBtn?.addEventListener('click',()=>{if(!load().length)return;if(!confirm('이 브라우저에 저장된 방명록 기록을 모두 지울까요?'))return;localStorage.removeItem(KEY);render();});
  updateCount();render();
})();