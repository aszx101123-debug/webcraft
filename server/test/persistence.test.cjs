'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IdentityStore}=require('../identity-store.cjs');
test('incremental world writes recover accepted blocks, storage and drops before a checkpoint',()=>{
  const store=new IdentityStore();
  try{
    store.writeWorld('survival',{meta:{seed:12345},edits:[],metadata:{objects:[],furnaces:{version:1,entries:[]},farming:{version:1,crops:[],foraged:[]}},entities:{drops:[]},time:.2});
    store.transaction(()=>{
      store.writeWorldEvent('survival',{keys:['1,10,1'],changes:[[1,10,1,44]],objects:[['1,10,1',{facing:'north',chest:[{id:2,count:5}]}]],furnaces:[],crops:[],foraged:[],drops:[[1,2,1,1,11,1,0]],time:.3});
      store.writeOperation('player1','survival','request1',{ok:true});
    });
    const recovered=store.readWorld('survival');assert.deepEqual(recovered.edits,[['0,0',[[1098,44]]]]);assert.equal(recovered.metadata.objects[0][1].chest[0].count,5);assert.equal(recovered.entities.drops.length,1);
    store.writeWorld('survival',recovered);assert.equal(store.db.prepare('SELECT count(*) AS n FROM world_events').get().n,0);
    assert.deepEqual(store.readWorld('survival'),recovered);assert.deepEqual(store.readOperation('player1','survival','request1'),{ok:true});
  }finally{store.close();}
});
test('a failed atomic write leaves the checkpoint, events and operation result unchanged',()=>{
  const store=new IdentityStore();
  try{
    store.writeWorld('creative',{meta:{seed:1},edits:[],time:.2});
    assert.throws(()=>store.transaction(()=>{store.writeWorldEvent('creative',{changes:[[1,5,1,2]],keys:[],time:.3});store.writeOperation('p','creative','operation',{ok:true});throw Error('disk failure');}));
    assert.equal(store.readOperation('p','creative','operation'),null);assert.equal(store.readWorld('creative').edits.length,0);
  }finally{store.close();}
});
