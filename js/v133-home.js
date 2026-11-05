'use strict';

// Lightweight, accessible mobile launcher navigation.
(() => {
  const toggle=document.querySelector('.nav-toggle');
  const menu=document.getElementById('site-menu');
  if(!toggle||!menu)return;
  function close(){
    menu.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','메뉴 열기');
  }
  toggle.addEventListener('click',()=>{
    const expanded=toggle.getAttribute('aria-expanded')==='true';
    if(expanded)close();
    else{
      menu.classList.add('nav-open');
      toggle.setAttribute('aria-expanded','true');
      toggle.setAttribute('aria-label','메뉴 닫기');
    }
  });
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('pointerdown',e=>{
    if(!menu.contains(e.target)&&!toggle.contains(e.target))close();
  });
  window.addEventListener('resize',()=>{if(window.innerWidth>900)close();});
})();
