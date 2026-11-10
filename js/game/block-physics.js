'use strict';

// Event-driven, bounded sand/gravel gravity. Old saved block IDs remain unchanged.
// No all-chunk physics scans: only cells affected by player edits are scheduled.
const BlockPhysics = (() => {
  const queue = [];
  const queued = new Set();
  let unsubscribe = null;
  let unsubscribeChunks = null;
  let elapsed = 0;
  const LIMIT = 4096;
  const STEP = .065;
  const MAX_MOVES = 52;
  const key = (x,y,z) => x + ',' + y + ',' + z;

  function schedule(x,y,z) {
    if (y < 1 || y >= CONFIG.HEIGHT) return;
    if (!World.getChunk(x >> 4,z >> 4)) return;
    if (!isFallingBlock(World.getBlock(x,y,z))) return;
    const k=key(x,y,z);
    if(queued.has(k) || queue.length >= LIMIT)return;
    queued.add(k);
    queue.push({x,y,z,k});
  }

  function onChange(x,y,z,id,oldId) {
    if (isFallingBlock(id)) schedule(x,y,z);
    if (isFallingBlock(oldId) || id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.WATER_FLOW)
      schedule(x,y+1,z);
  }

  function onChunkLoaded(cx,cz,data){
    // Unedited/generated sand and gravel must obey gravity too. Previously
    // only edits triggered movement, leaving floating natural cave ceilings.
    // Schedule unsupported cells only; each falling column pulls the rest down.
    const C=CONFIG.CHUNK,H=CONFIG.HEIGHT;
    for(let x=0;x<C;x++)for(let z=0;z<C;z++){
      for(let y=2;y<H;y++){
        const idx=Terrain.idx(x,y,z);
        const id=data[idx];
        if(!isFallingBlock(id))continue;
        const underneath=data[Terrain.idx(x,y-1,z)];
        if(underneath===BLOCK.AIR || underneath===BLOCK.WATER ||
           underneath===BLOCK.WATER_FLOW)
          schedule(cx*C+x,y,cz*C+z);
      }
    }
  }

  function init() {
    if (unsubscribe) unsubscribe();
    if (unsubscribeChunks) unsubscribeChunks();
    queue.length=0;
    queued.clear();
    elapsed=0;
    unsubscribe=World.onBlockChanged(onChange);
    unsubscribeChunks=World.onChunkLoaded(onChunkLoaded);
  }

  function update(dt) {
    elapsed+=Math.min(Math.max(0,Number.isFinite(dt)?dt:0),.1);
    if (elapsed < STEP)return;
    elapsed%=STEP;
    const count=Math.min(MAX_MOVES,queue.length);
    for(let i=0;i<count;i++){
      const job=queue.shift();
      queued.delete(job.k);
      const {x,y,z}=job;
      const id=World.getBlock(x,y,z);
      if(!isFallingBlock(id) || y<=1)continue;
      if(!World.getChunk(x>>4,z>>4))continue;
      const below=World.getBlock(x,y-1,z);
      // In the original block behavior, sand/gravel landing on a torch drops
      // as an item instead of hovering in place or deleting the torch.
      if(below===BLOCK.TORCH){
        if(World.setBlock(x,y,z,BLOCK.AIR)){
          if(typeof Drops!=='undefined')
            Drops.spawn(id,1,x+.5,y-.35,z+.5,undefined,{world:true});
          schedule(x,y+1,z);
        }
        continue;
      }
      if(below!==BLOCK.AIR && below!==BLOCK.WATER && below!==BLOCK.WATER_FLOW)continue;
      // Restoring the source if the destination becomes invalid is safer than losing a block.
      if(!World.setBlock(x,y-1,z,id))continue;
      if(!World.setBlock(x,y,z,BLOCK.AIR)) {
        World.setBlock(x,y-1,z,below);
        continue;
      }
      schedule(x,y-1,z);
      schedule(x,y+1,z);
    }
  }

  function pendingCount(){return queue.length;}
  return {init,update,pendingCount,schedule};
})();
