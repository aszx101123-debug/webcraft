'use strict';
const {ApiError}=require('./identity-store.cjs');
const SUPABASE_URL='https://rswxnprupyulbjblafgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_AFoQ_eNoMTeHmePv5TvC7w_aoL0gck7';
function createAuthVerifier({url=SUPABASE_URL,key=PUBLISHABLE_KEY,fetchImpl=fetch}={}){
  return async token=>{
    if(typeof token!=='string'||token.length<30||token.length>10000)throw new ApiError('LOGIN_REQUIRED',401);
    let response;
    try{response=await fetchImpl(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});}
    catch{throw new ApiError('AUTH_UNAVAILABLE',503);}
    if(!response.ok)throw new ApiError(response.status>=500?'AUTH_UNAVAILABLE':'INVALID_LOGIN',response.status>=500?503:401);
    const user=await response.json();
    if(!/^[0-9a-f-]{36}$/i.test(user?.id)||user.is_anonymous===true)throw new ApiError('LOGIN_REQUIRED',401);
    // Identity is accepted only from the Auth server, never from client claims or metadata.
    return {id:user.id};
  };
}
module.exports={createAuthVerifier};
