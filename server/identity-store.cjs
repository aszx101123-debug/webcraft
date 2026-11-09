'use strict';
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,createHash}=require('node:crypto');
const {mkdirSync}=require('node:fs');
const {dirname}=require('node:path');
const hash=value=>createHash('sha256').update(value).digest('hex');
const publicId=identity=>'player_'+hash(identity).slice(0,24);
class ApiError extends Error{
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
function validNickname(value){
  return typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(value)&&!/^guest(?:\d+)?$/i.test(value);
}
class IdentityStore{
  constructor(path=':memory:',{now=Date.now}={}){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.now=now;this.db=new DatabaseSync(path);this.statements=new Map();
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY,value INTEGER NOT NULL);
      INSERT OR IGNORE INTO counters VALUES ('guest',0);
      CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY,nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,identity_id TEXT NOT NULL,display_name TEXT NOT NULL,user_id TEXT,expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_events (id INTEGER PRIMARY KEY AUTOINCREMENT,world_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS world_events_world ON world_events(world_id,id);
      CREATE TABLE IF NOT EXISTS operations (session_hash TEXT NOT NULL,world_id TEXT NOT NULL,request_id TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(session_hash,world_id,request_id));
      CREATE INDEX IF NOT EXISTS operations_expiry ON operations(created_at);
      CREATE TABLE IF NOT EXISTS player_saves (identity_id TEXT NOT NULL,world_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(identity_id,world_id));`);
  }
  statement(sql){if(!this.statements.has(sql))this.statements.set(sql,this.db.prepare(sql));return this.statements.get(sql);}
  transaction(fn){
    this.db.exec('BEGIN IMMEDIATE');
    try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  profile(userId){return this.statement('SELECT nickname FROM accounts WHERE user_id=?').get(userId)||null;}
  setNickname(userId,nickname){
    if(!userId)throw new ApiError('LOGIN_REQUIRED',401);
    if(!validNickname(nickname))throw new ApiError('INVALID_NICKNAME');
    try{
      this.statement('INSERT INTO accounts(user_id,nickname,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,updated_at=excluded.updated_at').run(userId,nickname,this.now());
    }catch(error){if(String(error.code).includes('CONSTRAINT')||String(error.message).includes('UNIQUE'))throw new ApiError('NICKNAME_TAKEN',409);throw error;}
    return {nickname};
  }
  issue(identity,name,userId=null){
    const token=randomBytes(32).toString('base64url'),expires=this.now()+(userId?3600000:86400000);
    this.statement('INSERT INTO sessions VALUES (?,?,?,?,?)').run(hash(token),identity,name,userId,expires);
    return {token,expiresAt:expires,id:publicId(identity),name,account:!!userId};
  }
  guest(previous){
    if(typeof previous==='string'){
      const existing=this.session(previous);
      if(existing&&!existing.userId){const expiresAt=this.now()+86400000;this.statement('UPDATE sessions SET expires_at=? WHERE token_hash=?').run(expiresAt,existing.hash);return {token:previous,expiresAt,id:existing.id,name:existing.name,account:false};}
    }
    return this.transaction(()=>{
      const {value}=this.statement("UPDATE counters SET value=value+1 WHERE key='guest' RETURNING value").get();
      return this.issue('guest:'+value,'Guest'+value);
    });
  }
  account(userId){
    const profile=this.profile(userId);if(!profile)throw new ApiError('NICKNAME_REQUIRED',409);
    return this.issue('account:'+userId,profile.nickname,userId);
  }
  session(token){
    if(typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const row=this.statement('SELECT s.*,a.nickname FROM sessions s LEFT JOIN accounts a ON a.user_id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),this.now());
    return row?{identity:row.identity_id,id:publicId(row.identity_id),name:row.user_id?row.nickname:row.display_name,userId:row.user_id||null,expiresAt:row.expires_at,hash:row.token_hash}:null;
  }
  readWorld(id){
    const row=this.statement('SELECT data FROM worlds WHERE id=?').get(id);if(!row)return null;const state=JSON.parse(row.data);
    const edits=new Map((state.edits||[]).map(([k,v])=>[k,new Map(v)]));
    for(const record of this.statement('SELECT data FROM world_events WHERE world_id=? ORDER BY id').all(id)){
      const event=JSON.parse(record.data);
      for(const [x,y,z,block] of event.changes||[]){const key=(x>>4)+','+(z>>4);if(!edits.has(key))edits.set(key,new Map());edits.get(key).set(((x&15)<<10)|((z&15)<<6)|y,block);}
      const merge=(rows,patch)=>{const map=new Map(rows||[]);for(const key of event.keys||[])map.delete(key);for(const entry of patch||[])map.set(entry[0],entry[1]);return [...map];};
      state.metadata||={};state.metadata.objects=merge(state.metadata.objects,event.objects);
      state.metadata.furnaces={version:1,entries:merge(state.metadata.furnaces?.entries,event.furnaces)};
      state.metadata.farming={version:1,crops:merge(state.metadata.farming?.crops,event.crops),foraged:merge(state.metadata.farming?.foraged,event.foraged)};
      if(event.drops){state.entities||={};state.entities.drops=event.drops;}state.time=event.time;
    }
    state.edits=[...edits].map(([k,v])=>[k,[...v]]);return state;
  }
  writeWorld(id,state){this.transaction(()=>{this.statement('INSERT INTO worlds VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(state));this.statement('DELETE FROM world_events WHERE world_id=?').run(id);});}
  writeWorldEvent(id,event){this.statement('INSERT INTO world_events(world_id,data) VALUES (?,?)').run(id,JSON.stringify(event));}
  readOperation(session,world,request){const row=this.statement('SELECT result FROM operations WHERE session_hash=? AND world_id=? AND request_id=?').get(session,world,request);return row?JSON.parse(row.result):null;}
  writeOperation(session,world,request,result){this.statement('INSERT OR IGNORE INTO operations VALUES (?,?,?,?,?)').run(session,world,request,JSON.stringify(result),this.now());}
  savePlayer(identity,world,data){this.statement('INSERT INTO player_saves VALUES (?,?,?) ON CONFLICT(identity_id,world_id) DO UPDATE SET data=excluded.data').run(identity,world,JSON.stringify(data));}
  loadPlayer(identity,world){const row=this.statement('SELECT data FROM player_saves WHERE identity_id=? AND world_id=?').get(identity,world);return row?JSON.parse(row.data):null;}
  cleanup(){this.statement('DELETE FROM sessions WHERE expires_at<?').run(this.now());this.statement('DELETE FROM operations WHERE created_at<?').run(this.now()-120000);}
  close(){this.db.close();}
}
module.exports={IdentityStore,ApiError,validNickname,hash,publicId};
