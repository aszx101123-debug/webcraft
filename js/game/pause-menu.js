'use strict';
// Pause-menu navigation, inspired by the familiar Minecraft settings hierarchy.
// Each screen uses real game controls; the main pause menu stays uncluttered.
window.WebCraftPauseMenu = (() => {
  const root=document.getElementById('overlay-pause');
  if(!root)return {show(){},back(){return false;},isSubpage(){return false;}};
  const screens=new Map([...root.querySelectorAll('[data-wc-screen]')]
    .map(node=>[node.dataset.wcScreen,node]));
  const parents={options:'main',video:'options',controls:'options',audio:'options',accessibility:'options',world:'main',help:'main'};
  let current='main';
  function show(page='main',focus=true){
    if(!screens.has(page))return false;
    current=page;
    for(const [key,node] of screens){
      const active=key===page;
      node.hidden=!active;
      node.setAttribute('aria-hidden',String(!active));
    }
    const panel=root.querySelector('.wc-pause-panel');
    if(panel)panel.scrollTop=0;
    if(focus && !root.classList.contains('hidden')){
      const first=screens.get(page)?.querySelector('button:not([disabled]):not(.hidden)');
      first?.focus?.();
    }
    return true;
  }
  function isSubpage(){return current!=='main';}
  function back(){
    if(!isSubpage())return false;
    show(parents[current]||'main');
    return true;
  }
  root.addEventListener('click',e=>{
    const open=e.target.closest('[data-wc-open]');
    if(open&&root.contains(open)){
      e.preventDefault();
      show(open.dataset.wcOpen);
      return;
    }
    const backButton=e.target.closest('[data-wc-back]');
    if(backButton&&root.contains(backButton)){
      e.preventDefault();
      show(backButton.dataset.wcBack||parents[current]||'main');
    }
  });
  show('main',false);
  return {show,back,isSubpage};
})();
