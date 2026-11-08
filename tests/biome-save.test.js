'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=n=>fs.readFileSync(path.join(root,'js/game/'+n+'.js'),'utf8');
function runtime(){
  const storage=new Map();
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  return new Function('localStorage',['config','noise','terrain-legacy','terrain','save'].map(source).join('\n')+'\nreturn {Terrain,LegacyTerrain,SaveSystem};')(localStorage);
}

test('unversioned worlds regenerate the original chunks byte for byte',()=>{
  const {Terrain,SaveSystem}=runtime();
  const fixtures=[
    [12345,0,0,'0e2bc783efcc33b7dee253b834af13a01afe6689474f9dc1c6d33ab72c36edb1'],
    [42,-3,5,'988228692514545edbe35d49dabdedcb46192d15747b2ffbfd7084486167569b'],
    [777,15,-22,'3f7dcaf4eef61560c8479a07171bed48e6cd01c377a04c1ff605fa91ec1b87b2']
  ];
  for(const [seed,cx,cz,expected] of fixtures){
    const gen=Terrain.makeGen(seed,SaveSystem.generatorVersion({seed,version:8}));
    assert.equal(crypto.createHash('sha256').update(gen.genChunk(cx,cz)).digest('hex'),expected);
  }
  assert.equal(SaveSystem.generatorVersion(null),2);
});

test('old and expanded generator choices survive save, export and import',()=>{
  for(const version of [undefined,1,2]){
    const {SaveSystem}=runtime(),meta=SaveSystem.create('지형 테스트',12345);
    const data={seed:12345,version:8,inventory:[],edits:[],...(version===undefined?{}:{generatorVersion:version})};
    assert.ok(SaveSystem.save(meta.id,data));
    const backup=SaveSystem.exportWorld(meta.id);
    const copy=SaveSystem.importWorld(backup);
    assert.ok(copy);
    assert.equal(SaveSystem.generatorVersion(SaveSystem.load(copy.id)),version===2?2:1);
  }
});

test('unknown generator versions cannot silently load with different terrain',()=>{
  const {SaveSystem}=runtime(),meta=SaveSystem.create('잘못된 지형 버전',42);
  assert.equal(SaveSystem.save(meta.id,{seed:42,generatorVersion:3}),false);
  assert.equal(SaveSystem.importWorld({type:'webcraft-world-export',formatVersion:1,meta:{name:'잘못된 버전',seed:42},world:{seed:42,generatorVersion:3}}),null);
});
