'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),path=require('node:path');
const {IdentityStore,validNickname,ApiError}=require('../identity-store.cjs');
const {createAuthVerifier}=require('../auth.cjs');
test('English account names are bounded, unique without case distinctions and reserve guest names',()=>{
  const store=new IdentityStore();
  try{
    assert.equal(validNickname('Alex_123'),true);
    for(const name of ['한글닉','ab','3Alex','Alice Smith','Guest','Guest1','gUeSt999','x'.repeat(17),'<script>'])assert.equal(validNickname(name),false,name);
    store.setNickname('first-user','Alex_123');assert.throws(()=>store.setNickname('second-user','aLeX_123'),error=>error.code==='NICKNAME_TAKEN');
    assert.throws(()=>store.setNickname(null,'Alex_123'),error=>error.code==='LOGIN_REQUIRED');
    const session=store.account('first-user');assert.equal(store.session(session.token).name,'Alex_123');
    store.setNickname('first-user','NewName');assert.equal(store.session(session.token).name,'NewName');
  }finally{store.close();}
});
test('guest numbers are global, persist after restart and cannot choose an account nickname',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'webcraft-identity-')),file=path.join(dir,'server.sqlite');let store=new IdentityStore(file);
  try{
    const a=store.guest(),b=store.guest();assert.equal(a.name,'Guest1');assert.equal(b.name,'Guest2');assert.equal(a.account,false);
    assert.equal(store.guest(a.token).name,'Guest1');assert.equal(store.session('forged-token'),null);
    store.close();store=new IdentityStore(file);assert.equal(store.guest().name,'Guest3');assert.equal(store.session(a.token).name,'Guest1');
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('sessions expire and a verified account is required before issuing an account identity',()=>{
  let now=10000;const store=new IdentityStore(':memory:',{now:()=>now});
  try{assert.throws(()=>store.account('missing'),error=>error.code==='NICKNAME_REQUIRED');const guest=store.guest();now+=86400001;assert.equal(store.session(guest.token),null);}finally{store.close();}
});
test('Auth checks use the Supabase user endpoint and reject anonymous or invalid credentials',async()=>{
  const requests=[],token='untrusted-client-token-xxxxxxxxxxxxxxxxxxxx';
  let user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:false,user_metadata:{nickname:'Admin'}};
  const verify=createAuthVerifier({fetchImpl:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>user};}});
  assert.deepEqual(await verify(token),{id:user.id});assert.ok(requests[0].url.endsWith('/auth/v1/user'));assert.equal(requests[0].init.headers.Authorization,'Bearer '+token);
  user={...user,is_anonymous:true};await assert.rejects(verify(token),error=>error.code==='LOGIN_REQUIRED');
  const rejected=createAuthVerifier({fetchImpl:async()=>({ok:false,status:401})});await assert.rejects(rejected(token),error=>error.code==='INVALID_LOGIN');
});
