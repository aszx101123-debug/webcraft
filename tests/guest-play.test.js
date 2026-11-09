'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

function guestLoader(failAt=null){
  const loaded=[],redirects=[];
  let notice,finishBoot,reloads=0;
  const boot=new Promise(resolve=>{finishBoot=resolve;});
  const document={
    createElement(tag){return {tag,children:[],listeners:{},style:{},setAttribute(){},
      appendChild(child){this.children.push(child);},addEventListener(type,fn){this.listeners[type]=fn;},
      remove(){this.removed=true;}};},
    body:{appendChild(node){
      if(node.tag==='div'){notice=node;return;}
      loaded.push(node.src);
      queueMicrotask(()=>node.src===failAt?node.onerror():node.onload());
    }}
  };
  const location={replace:url=>redirects.push(url),reload:()=>{reloads++;}};
  const run=new AsyncFunction('document','window','location',read('js/auth-play.js'))(
    document,{webcraftBoot:boot},location);
  return {run,loaded,redirects,finishBoot,notice:()=>notice,reloads:()=>reloads};
}

test('guest game loader starts without an auth client or session and waits for game initialization',async()=>{
  const g=guestLoader();
  for(let i=0;i<150;i++)await Promise.resolve();
  assert.ok(g.loaded.includes('pogl-game/vendor/three.min.js'));
  assert.ok(g.loaded.some(url=>url.startsWith('js/game/mobile-test-main.js?')));
  assert.ok(g.loaded.indexOf('js/game/noise.js')<g.loaded.findIndex(url=>url.startsWith('js/game/world.js?')));
  assert.equal(g.notice().removed,undefined,'loading notice stays until world initialization finishes');
  assert.deepEqual(g.redirects,[]);
  assert.ok(g.loaded.every(url=>!url.includes('supabase')&&!url.includes('credits')));
  g.finishBoot();await g.run;
  assert.equal(g.notice().removed,true);
});

test('guest loader failure offers a retry without redirecting to login',async()=>{
  const g=guestLoader('js/game/noise.js');
  await g.run;
  assert.deepEqual(g.redirects,[]);
  assert.ok(g.notice().textContent.includes('게임 파일을 불러오지 못했습니다'));
  const retry=g.notice().children[0];
  assert.equal(retry.tag,'button');retry.listeners.click();assert.equal(g.reloads(),1);
  assert.equal(g.loaded.some(url=>url.startsWith('js/game/world.js')),false);
});

function creditPanel(account=null,options={}){
  const nodes=new Map(),reads=[],rpcs=[],timers=[];
  let onAuthChange,balance=100;
  function element(){return {hidden:false,disabled:false,textContent:'',children:[],listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn;},
    replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},
    appendChild(child){this.children.push(child);},querySelector(){return element();}};}
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
  const db={
    auth:{getUser:()=>options.getUser?options.getUser():Promise.resolve({data:{user:account},error:options.error||null}),
      onAuthStateChange(fn){onAuthChange=fn;},signOut:async()=>({error:null})},
    from(table){
      reads.push(table);
      const result={data:table==='wc_wallets'?{free_credits:balance}:table==='wc_badges'?{quantity:2}:table==='wc_admins'?null:[],error:null};
      const query={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
        maybeSingle(){return Promise.resolve(result);},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
      return query;
    },
    async rpc(name){rpcs.push(name);if(name==='wc_claim_daily')balance+=10;return {data:balance,error:null};}
  };
  const source=read('js/community-credits-server.js').replace(/^import[^\n]+\n/m,'')
    .replace('\nloadUser().catch(', '\nconst ready=loadUser().catch(');
  const runtime=new Function('db','document','setTimeout',source+'\nreturn {ready};')(
    db,document,fn=>{timers.push(fn);});
  return {...runtime,nodes,reads,rpcs,authChanged:(...args)=>onAuthChange(...args),timers};
}

for(const [label,account,error] of [
  ['signed out',null,null],
  ['Supabase anonymous account',{id:'guest',is_anonymous:true},null],
  ['expired session',null,{name:'AuthSessionMissingError',message:'Auth session missing!'}]
]){
  test(label+': credit panel shows login and blocks direct reward actions',async()=>{
    const g=creditPanel(account,{error});await g.ready;
    assert.equal(g.nodes.get('credit-server-login').hidden,false);
    assert.equal(g.nodes.get('credit-server-app').hidden,true);
    assert.equal(g.nodes.get('credit-server-fc').textContent,'0');
    assert.equal(g.nodes.get('credit-server-checkin').disabled,true);
    // Invoke the callbacks directly to verify the guard, independently of hidden/disabled UI.
    await g.nodes.get('credit-server-checkin').listeners.click();
    await g.nodes.get('credit-server-badge-buy').listeners.click();
    await g.nodes.get('credit-server-proposal').listeners.submit({preventDefault(){}});
    assert.deepEqual(g.reads,[]);assert.deepEqual(g.rpcs,[]);
  });
}

test('registered accounts can claim server credits, and signing out immediately disables rewards',async()=>{
  const g=creditPanel({id:'registered',email:'player@example.test',is_anonymous:false});await g.ready;
  assert.equal(g.nodes.get('credit-server-app').hidden,false);
  assert.equal(g.nodes.get('credit-server-login').hidden,true);
  assert.equal(g.nodes.get('credit-server-checkin').disabled,false);
  assert.equal(g.nodes.get('credit-server-fc').textContent,'100');
  await g.nodes.get('credit-server-checkin').listeners.click();
  assert.deepEqual(g.rpcs,['wc_claim_daily']);
  assert.equal(g.nodes.get('credit-server-fc').textContent,'110');
  g.authChanged('SIGNED_OUT',null);
  assert.equal(g.nodes.get('credit-server-app').hidden,true);
  assert.equal(g.nodes.get('credit-server-fc').textContent,'0');
  await g.nodes.get('credit-server-checkin').listeners.click();
  assert.deepEqual(g.rpcs,['wc_claim_daily']);
});

test('a late signed-in response cannot reopen credits after sign-out',async()=>{
  let finish;
  const g=creditPanel(null,{getUser:()=>new Promise(resolve=>{finish=resolve;})});
  g.authChanged('SIGNED_OUT',null);
  finish({data:{user:{id:'old-session',is_anonymous:false}},error:null});await g.ready;
  assert.equal(g.nodes.get('credit-server-app').hidden,true);
  assert.equal(g.nodes.get('credit-server-checkin').disabled,true);
  assert.deepEqual(g.reads,[]);
});

test('public entry pages offer guest play and default account rewards to disabled',()=>{
  assert.match(read('auth.html'),/href="play\.html"[^>]*>로그인 없이 플레이/);
  assert.match(read('index.html'),/id="credit-server-checkin" disabled/);
  assert.ok(read('index.html').includes('로그인 없이 바로 플레이'));
  assert.ok(!read('index.html').includes('게임 플레이에는 로그인이 필요합니다'));
  const worker=read('service-worker.js');
  for(const [page,pattern] of [['play.html',/src="(js\/auth-play\.js\?[^"\s]+)"/],
    ['auth.html',/src="(js\/auth-page\.js\?[^"\s]+)"/],
    ['index.html',/src="(js\/community-credits-server\.js\?[^"\s]+)"/]])
    assert.ok(worker.includes(read(page).match(pattern)[1]));
});
