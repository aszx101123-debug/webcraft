'use strict';

const Mobs = (() => {
  let scene = null, group = null;
  let mobs = [];
  let arrows = [];
  let env = { night: false, brightness: 1 };
  let mode = GAME_MODE.CREATIVE;
  let spawnTimer = 3;
  let lastPlayerAttackAt = -Infinity;
  let lastAttackResult = null;
  let onEvent = null;
  let simulationTime=0;
  let network=null,nextNetworkId=1;
  let explosionEffects=[],recentExplosions=[],nextExplosionId=1;
  const seenRemoteExplosions=new Set();
  function networkPlayers(){
    return [{id:null,pos:Player.pos,dead:Player.dead||network?.localActive?.()===false},...(network?.players?.()||[])].filter(p=>p?.pos&&['x','y','z'].every(k=>Number.isFinite(p.pos[k])));
  }
  function damagePlayer(target,amount,cause,source){
    if(target.id)network?.damage?.(target.id,amount,cause,source);
    else Player.damage(amount,cause,source);
  }

  function init(scene_) {
    scene = scene_;
    group = new THREE.Group();
    scene.add(group);
  }

  function reset() {
    if (!group) return;
    while(mobs.length)removeMob(mobs.length-1);
    while(arrows.length)removeArrow(arrows.length-1);
    spawnTimer = 3;
    lastPlayerAttackAt = -Infinity;
    lastAttackResult = null;
    simulationTime=0;
    for(const effect of explosionEffects)disposeEffect(effect.root);
    explosionEffects=[];
    recentExplosions=[];
    seenRemoteExplosions.clear();
    nextExplosionId=1;
  }

  function setEnv(night, brightness) { env.night = night; env.brightness = brightness; }
  function setMode(m) { mode = m; }

  // An original procedurally-generated 16×16 texture gives each surface small
  // pixel-level color variation without loading external assets or copying textures.
  const mobTextureCache=new Map();
  function pixelTexture(color){
    if(mobTextureCache.has(color))return mobTextureCache.get(color);
    if(typeof document==='undefined'||typeof THREE.CanvasTexture!=='function')return null;
    const canvas=document.createElement('canvas');
    canvas.width=16;canvas.height=16;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    let seed=(color^0x71e9a63)>>>0;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      seed=(Math.imul(seed^((x+3)*17+(y+7)*41),1664525)+1013904223)>>>0;
      const edge=(x===0||y===0||x===15||y===15)?-.07:0;
      const grain=((seed>>>22)%24)/255;
      const v=Math.max(170,Math.min(255,Math.round(233+edge*255+grain*255-12)));
      ctx.fillStyle='rgb('+v+','+v+','+v+')';
      ctx.fillRect(x,y,1,1);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.encoding=THREE.sRGBEncoding;
    texture.magFilter=THREE.NearestFilter;
    texture.minFilter=THREE.NearestFilter;
    texture.generateMipmaps=false;
    mobTextureCache.set(color,texture);
    return texture;
  }
  function mat(color) {
    const texture=pixelTexture(color);
    return new THREE.MeshLambertMaterial(texture?{color,map:texture}:{color});
  }
  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
  }

  // Self-contained visual effects; no modifications to world blocks.
  function disposeEffect(root){
    group?.remove(root);
    root?.traverse(node=>{
      node.geometry?.dispose?.();
      if(node.material)for(const mat of (Array.isArray(node.material)?node.material:[node.material]))
        mat?.dispose?.();
    });
  }

  function attachFuseWarning(m){
    const marker=new THREE.Group();
    const basic=(color,opacity)=>new THREE.MeshBasicMaterial({
      color,opacity,transparent:true,depthWrite:false,side:THREE.DoubleSide
    });
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.54,.045,4,28),basic(0xf9f9f4,.8));
    ring.rotation.x=Math.PI/2;
    ring.position.y=.12;
    marker.add(ring);
    const sparks=[];
    for(let i=0;i<6;i++){
      const cube=new THREE.Mesh(new THREE.BoxGeometry(.115,.115,.115),
        basic(i%2?0xffe8ad:0xffffff,.95));
      marker.add(cube);sparks.push(cube);
    }
    marker.visible=false;
    m.mesh.add(marker);
    const materials=[];
    m.mesh.traverse(obj=>{
      if(!obj.material || obj===ring || sparks.includes(obj))return;
      const mat=obj.material;
      if(mat.color)materials.push({mat,normal:mat.color.getHex()});
    });
    m.fuseVisual={marker,ring,sparks,materials};
  }

  function updateFuseWarning(m){
    const fx=m.fuseVisual;
    if(!fx)return;
    const p=Math.min(1,Math.max(0,m.fuseT/1.5));
    fx.marker.visible=p>.005;
    if(p>.005){
      // Accelerating bright-white flashes, readable at all light levels.
      const pulse=Math.sin(m.fuseT*(15+24*p))>0;
      if(m.hurtT<=0)for(const entry of fx.materials){
        entry.mat.color.setHex(pulse?0xf9f9f9:entry.normal);
        entry.mat.emissive?.setHex(pulse?0x676767:0x000000);
      }
      fx.ring.scale.setScalar(1+p*.85);
      fx.ring.material.opacity=.42+p*.45;
      fx.sparks.forEach((cube,i)=>{
        const a=(i/6)*Math.PI*2+simulationTime*2.2;
        cube.position.set(Math.sin(a)*(.46+p*.27),.55+i%3*.38+Math.sin(simulationTime*7+i)*.10,
          Math.cos(a)*(.46+p*.27));
        cube.material.opacity=.45+.5*Math.abs(Math.sin(simulationTime*15+i));
      });
    }else{
      for(const entry of fx.materials){
        if(m.hurtT<=0)entry.mat.color.setHex(entry.normal);
        entry.mat.emissive?.setHex(0x000000);
      }
    }
  }

  function spawnExplosionEffect(position,remote=false){
    if(!group)return;
    const root=new THREE.Group();
    root.position.set(position.x,position.y+.8,position.z);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.56,.09,6,32),
      new THREE.MeshBasicMaterial({color:0xf8f9fa,transparent:true,opacity:.95,
        depthWrite:false,side:THREE.DoubleSide}));
    ring.rotation.x=Math.PI/2;
    root.add(ring);
    const particles=[];
    for(let i=0;i<26;i++){
      const angle=(i/26)*Math.PI*2;
      const rise=(Math.random()-.35)*1.5;
      const spread=1.5+Math.random()*2.2;
      const material=new THREE.MeshBasicMaterial({
        color:[0xfdfdfd,0xd8d9d9,0xaaaaac,0xe9e7dc][i%4],
        transparent:true,opacity:.88,depthWrite:false
      });
      const size=.16+Math.random()*.25;
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),material);
      mesh.position.set(Math.sin(angle)*.16,rise*.13,Math.cos(angle)*.16);
      root.add(mesh);
      particles.push({mesh,vx:Math.sin(angle)*spread,vy:rise+1.2,
        vz:Math.cos(angle)*spread,spin:Math.random()*2-1});
    }
    group.add(root);
    explosionEffects.push({root,ring,particles,life:.85,maxLife:.85});
    if(!remote){
      const id=nextExplosionId++;
      recentExplosions.push({id,x:position.x,y:position.y,z:position.z,until:simulationTime+1.5});
      recentExplosions=recentExplosions.slice(-12);
    }
  }
  function updateExplosionEffects(dt){
    if(dt<=0)return;
    recentExplosions=recentExplosions.filter(e=>e.until>simulationTime);
    for(let i=explosionEffects.length-1;i>=0;i--){
      const e=explosionEffects[i];
      e.life-=dt;
      if(e.life<=0){
        disposeEffect(e.root);
        explosionEffects.splice(i,1);
        continue;
      }
      const t=1-e.life/e.maxLife;
      e.ring.scale.setScalar(1+t*5.5);
      e.ring.material.opacity=Math.max(0,1-t*1.2);
      for(const p of e.particles){
        p.mesh.position.x+=p.vx*dt;
        p.mesh.position.y+=p.vy*dt;
        p.mesh.position.z+=p.vz*dt;
        p.mesh.rotation.x+=p.spin*dt*3;
        p.mesh.rotation.z+=p.spin*dt*2;
        p.mesh.scale.setScalar(Math.max(.04,1-t*.78));
        p.mesh.material.opacity=Math.max(0,.95-t*1.1);
      }
    }
  }

  function buildMob(type) {
    const kind=type==='husk'?'zombie':type==='stray'?'skeleton':type==='mooshroom'?'cow':type;
    const g = new THREE.Group();
    const parts = { legs: [], arms: [], extraLegs: [], spiderLegs: [], eyes: [], head: null, healthBar: null, detailGroup: null, fuseGroup: null };
    const limb = (w, h, d, color, x, y, z) => {
      const l = box(w, h, d, color, x, y, z);
      parts.legs.push(l);
      g.add(l);
      return l;
    };
    const sphere = (r, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = box(2*r*sx,2*r*sy,2*r*sz,color,x,y,z);
      g.add(m);
      return m;
    };
    const cone = (r, h, color, x, y, z, rotX = 0, rotZ = 0) => {
      const m = box(r*1.65,h,r*1.65,color,x,y,z);
      m.rotation.x=rotX;m.rotation.z=rotZ;
      g.add(m);
      return m;
    };
    const eye = (x, y, z, color = 0x1b1b1b, w = .08, h = .08) => {
      const pupil=box(w,h,.035,color,x,y,z);
      g.add(pupil);
      parts.eyes.push(pupil);
    };

    if (kind==='pig') {
      g.add(box(1.0, .58, .72, 0xe69aa8, 0, .62, 0));
      g.add(box(.66, .46, .5, 0xeea9b4, 0, .68, .46));
      g.add(box(.3, .16, .09, 0xc97988, 0, .59, .71));
      g.add(box(.045, .06, .025, 0x9e5968, .07, .61, .755));
      g.add(box(.045, .06, .025, 0x9e5968, -.07, .61, .755));
      eye(.16, .76, .69); eye(-.16, .76, .69);
      cone(.12, .16, 0xd98492, .24, .88, .35, .35, -.25);
      cone(.12, .16, 0xd98492, -.24, .88, .35, .35, .25);
      limb(.18, .34, .18, 0xcf808e, .29, .17, .24);
      limb(.18, .34, .18, 0xcf808e, -.29, .17, .24);
      limb(.18, .34, .18, 0xcf808e, .29, .17, -.24);
      limb(.18, .34, .18, 0xcf808e, -.29, .17, -.24);
      const tail = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 6, 10, Math.PI * 1.5), mat(0xc97988));
      tail.position.set(-.56, .65, -.24);
      tail.rotation.y = Math.PI / 2;
      g.add(tail);
    } else if (kind==='cow') {
      g.add(box(1.08, .74, .82, 0x5b3d2b, 0, .92, 0));
      g.add(box(.52, .58, .46, 0x6f4a34, 0, 1.08, .56));
      g.add(box(.31, .18, .1, 0xd2c8b8, 0, .94, .8));
      sphere(.14, 0x352317, .28, 1.0, .05, .85, 1.1, .45);
      sphere(.13, 0x352317, -.3, 1.18, -.12, .8, 1, .45);
      sphere(.11, 0x352317, .2, .72, .2, .75, 1.1, .45);
      eye(.14, 1.21, .78); eye(-.14, 1.21, .78);
      cone(.1, .2, 0xe5dcc9, .2, 1.48, .45, 0, -.35);
      cone(.1, .2, 0xe5dcc9, -.2, 1.48, .45, 0, .35);
      g.add(box(.12, .16, .22, 0x6a4c36, .3, 1.3, .35));
      g.add(box(.12, .16, .22, 0x6a4c36, -.3, 1.3, .35));
      limb(.2, .62, .2, 0x463021, .35, .31, .28);
      limb(.2, .62, .2, 0x463021, -.35, .31, .28);
      limb(.2, .62, .2, 0x463021, .35, .31, -.28);
      limb(.2, .62, .2, 0x463021, -.35, .31, -.28);
      g.add(box(.16, .11, .2, 0xc98e92, .2, .33, .25));
      g.add(box(.16, .11, .2, 0xc98e92, -.2, .33, .25));
    } else if (kind==='sheep') {
      g.add(box(.98, .76, .78, 0xe9e8df, 0, .94, 0));
      g.add(box(.42, .44, .44, 0x8f7867, 0, 1.08, .55));
      g.add(box(.34, .25, .25, 0xd9d2c7, 0, 1.16, .8));
      eye(.11, 1.17, .79, 0x141414, .06, .09); eye(-.11, 1.17, .79, 0x141414, .06, .09);
      sphere(.11, 0xd9d2c7, .25, 1.28, .48, .7, .8, .7);
      sphere(.11, 0xd9d2c7, -.25, 1.28, .48, .7, .8, .7);
      sphere(.16, 0xf4f2eb, .32, 1.27, .18, .8, .7, .8);
      sphere(.16, 0xf4f2eb, -.32, 1.27, .18, .8, .7, .8);
      limb(.16, .56, .16, 0x7a6658, .3, .28, .25);
      limb(.16, .56, .16, 0x7a6658, -.3, .28, .25);
      limb(.16, .56, .16, 0x7a6658, .3, .28, -.25);
      limb(.16, .56, .16, 0x7a6658, -.3, .28, -.25);
    } else if (kind==='chicken') {
      g.add(box(.46, .46, .58, 0xe7e1d6, 0, .5, 0));
      g.add(box(.31, .38, .3, 0xf0e9dd, 0, .78, .29));
      g.add(box(.13, .1, .14, 0xe3a038, 0, .7, .48));
      g.add(box(.08, .14, .08, 0xc9463e, 0, .99, .27));
      g.add(box(.07, .1, .06, 0xc9463e, 0, .62, .46));
      eye(.1, .87, .43, 0x151515, .055, .055);
      eye(-.1, .87, .43, 0x151515, .055, .055);
      g.add(box(.12, .22, .05, 0xd9d1c7, .28, .54, .02));
      g.add(box(.12, .22, .05, 0xd9d1c7, -.28, .54, .02));
      limb(.065, .24, .065, 0xd8a03a, .11, .12, .02);
      limb(.065, .24, .065, 0xd8a03a, -.11, .12, .02);
      cone(.08, .18, 0xe7e1d6, 0, .56, -.32, Math.PI / 2, 0);
    } else if (kind==='zombie') {
      limb(.23, .72, .23, 0x263e5d, .14, .36, 0);
      limb(.23, .72, .23, 0x263e5d, -.14, .36, 0);
      g.add(box(.58, .76, .34, 0x3d7a6c, 0, 1.08, 0));
      g.add(box(.5, .48, .48, 0x5d9b4e, 0, 1.7, 0));
      g.add(box(.18, .16, .42, 0x314f8b, .28, .99, .03));
      g.add(box(.18, .16, .42, 0x314f8b, -.28, .99, .03));
      g.add(box(.63, .06, .06, 0x8a6a43, 0, .76, -.18));
      eye(.12, 1.74, .25, 0x9cff68, .085, .08); eye(-.12, 1.74, .25, 0x9cff68, .085, .08);
      g.add(box(.22, .06, .06, 0x2b4435, 0, 1.55, .25));
      g.add(box(.18, .2, .2, 0x5d9b4e, .34, 1.06, .12));
      g.add(box(.18, .2, .2, 0x5d9b4e, -.34, 1.06, .12));
    } else if (kind==='skeleton') {
      limb(.14, .72, .14, 0xd8d6cc, .12, .36, 0);
      limb(.14, .72, .14, 0xd8d6cc, -.12, .36, 0);
      g.add(box(.42, .7, .24, 0xdcdad0, 0, 1.08, 0));
      g.add(box(.44, .44, .44, 0xe6e4da, 0, 1.68, 0));
      eye(.11, 1.73, .23, 0x262018, .07, .08); eye(-.11, 1.73, .23, 0x262018, .07, .08);
      g.add(box(.06, .48, .06, 0xc5c2ba, 0, 1.2, .16));
      g.add(box(.05, .38, .06, 0xc5c2ba, .16, 1.2, .17));
      g.add(box(.05, .38, .06, 0xc5c2ba, -.16, 1.2, .17));
      g.add(box(.06, .58, .06, 0x6b4a2a, .42, 1.22, .44));
      const bow = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 5, 12, Math.PI), mat(0x7d5730));
      bow.position.set(.38, 1.28, .43);
      bow.rotation.x = Math.PI / 2;
      g.add(bow);
      g.add(box(.02, .04, .54, 0xd7d2c7, .38, 1.28, .44));
      g.add(box(.12, .12, .48, 0xd7d2c7, .29, 1.25, .2));
      g.add(box(.12, .12, .48, 0xd7d2c7, -.29, 1.25, .2));
    } else if (kind==='creeper') {
      // Classic long-neck silhouette and pixel face, original voxel geometry.
      for(const sx of [-1,1])for(const sz of [-1,1])
        limb(.23,.64,.24,0x2c9835,sx*.21,.32,sz*.23);
      g.add(box(.52,.91,.49,0x44b349,0,.91,0));
      g.add(box(.72,.69,.70,0x55c855,0,1.47,.025));
      g.add(box(.18,.17,.025,0x183b1e,-.18,1.57,.382));
      g.add(box(.18,.17,.025,0x183b1e,.18,1.57,.382));
      g.add(box(.14,.19,.027,0x163b1b,0,1.36,.388));
      g.add(box(.30,.14,.027,0x163b1b,0,1.22,.387));
      g.add(box(.095,.10,.029,0x163b1b,-.13,1.17,.389));
      g.add(box(.095,.10,.029,0x163b1b,.13,1.17,.389));
      for(const [x,y,z] of [[-.27,1.63,.19],[.24,1.39,-.2],[.15,.94,.26],[-.17,.67,.23],[.3,1.67,-.14]])
        g.add(box(.11,.12,.025,0x318a3b,x,y,z));
    } else if(kind==='slime') {
      const shell=box(.83,.78,.83,0x5dc858,0,.41,0);
      shell.material.transparent=true;shell.material.opacity=.79;
      g.add(shell);
      g.add(box(.56,.48,.58,0x52a952,0,.35,0));
      eye(-.17,.53,.424,0x1b3920,.12,.16);
      eye(.17,.53,.424,0x1b3920,.12,.16);
      g.add(box(.26,.06,.026,0x245127,0,.26,.43));
    } else if (kind==='spider') {
      // Eight articulated leg pivots, four on each side.
      g.add(box(.91,.45,1.04,0x26232b,0,.48,-.18));
      g.add(box(.52,.35,.49,0x36313b,0,.48,.49));
      for (const sx of [-1,1]) for(let i=0;i<4;i++){
        const anchor=new THREE.Group();
        anchor.position.set(sx*.36,.47,(i-1.5)*.26);
        const thigh=box(.46,.09,.11,0x241e2a,sx*.25,.075,0);
        thigh.rotation.z=-sx*.28;
        const knee=box(.13,.13,.13,0x3a2b3d,sx*.50,.08,0);
        const shin=box(.13,.41,.12,0x201923,sx*.58,-.15,0);
        shin.rotation.z=sx*.21;
        anchor.add(thigh,knee,shin);
        anchor.userData.spiderSide=sx;
        anchor.userData.spiderIndex=i;
        g.add(anchor);
        parts.spiderLegs.push(anchor);
      }
      for(const x of [-.16,.16]){
        eye(x,.55,.76,0xe25b4a,.085,.09);
        eye(x*.45,.43,.77,0xad3e3d,.05,.055);
      }
    }
    // Pixel-overlaid details and animated shoulder/hip joints for each species.
    const detailGroup=new THREE.Group();
    g.add(detailGroup);
    parts.detailGroup=detailGroup;
    const detail=(w,h,d,col,x,y,z)=>{
      const p=box(w,h,d,col,x,y,z);detailGroup.add(p);return p;
    };
    const patch=(x,y,z,w,h,color)=>{
      const p=detail(w,h,.018,color,x,y,z);return p;
    };
    const legJoint=(mesh)=>{
      const base=mesh.position.clone();
      const height=mesh.geometry?.parameters?.height||.4;
      const pivot=new THREE.Group();
      pivot.position.set(base.x,base.y+height*.5,base.z);
      g.remove(mesh);
      mesh.position.set(0,-height*.5,0);
      pivot.add(mesh);
      g.add(pivot);
      return pivot;
    };
    if(kind!=='spider')parts.legs=parts.legs.map(legJoint);
    const makeArm=(x,y,z,color,sleeveColor,raised=0)=>{
      const pivot=new THREE.Group();
      pivot.position.set(x,y,z);
      pivot.rotation.x=raised;
      pivot.userData.baseX=raised;
      const sleeve=box(.17,.29,.20,sleeveColor,0,-.16,0);
      const arm=box(.16,.37,.18,color,0,-.48,0);
      const cuff=box(.18,.045,.20,0x303c46,0,-.34,.004);
      pivot.add(sleeve,arm,cuff);
      g.add(pivot);
      parts.arms.push(pivot);
      return pivot;
    };
    if(kind==='pig'){
      patch(.0,.87,.725,.10,.06,0xffddce);
      patch(-.21,.71,.707,.035,.035,0xfdf0e3);
      patch(.21,.71,.707,.035,.035,0xfdf0e3);
      patch(-.22,.6,.763,.07,.045,0xb8697e);
      patch(.22,.6,.763,.07,.045,0xb8697e);
      detail(.15,.09,.16,0xffb6c3,-.245,.93,.35);
      detail(.15,.09,.16,0xffb6c3,.245,.93,.35);
      for(const sx of [-1,1]){
        detail(.19,.075,.20,0x7d5360,sx*.29,.07,.25);
        detail(.19,.075,.20,0x7d5360,sx*.29,.07,-.25);
      }
    }else if(kind==='cow'){
      for(const [px,py,pz,w,h] of [
        [-.27,.97,.42,.24,.25],[.34,1.0,.42,.21,.19],
        [-.18,.87,-.421,.25,.30],[.30,1.08,-.421,.27,.25]
      ])patch(px,py,pz,w,h,0x312921);
      patch(0,1.0,.812,.18,.09,0xeab3b0);
      for(const sx of [-1,1]){
        detail(.1,.1,.12,0x372a22,sx*.17,.37,.40);
        patch(sx*.14,1.23,.795,.035,.045,0xe8ebed);
      }
    }else if(kind==='sheep'){
      for(const x of [-.31,0,.31])for(const z of [-.25,.12,.39]){
        if(z===.39&&x===0)continue;
        detail(.27,.23,.26,((x+z)>0)?0xf4f1e7:0xd3d8d2,x,1.33,z);
      }
      for(const sx of [-1,1])for(const z of [-.24,.24]){
        detail(.19,.14,.19,0xe6e9e0,sx*.34,.68,z);
        detail(.18,.12,.18,0x524840,sx*.30,.065,z);
      }
      patch(0,1.03,.942,.065,.045,0x302b27);
    }else if(kind==='chicken'){
      detail(.34,.17,.28,0xf4f1e9,0,.46,-.43);
      for(const sx of [-1,1]){
        detail(.15,.29,.09,0xd4d8d2,sx*.28,.58,-.04);
        detail(.12,.055,.16,0xdca542,sx*.11,.08,.17);
      }
      detail(.10,.1,.12,0xecaf4c,0,.73,.55);
      detail(.06,.06,.07,0xffede0,-.10,.88,.443);
      detail(.06,.06,.07,0xffede0,.10,.88,.443);
    }else if(kind==='zombie'){
      makeArm(-.40,1.43,.10,0x669c63,0x3e7e79,-.85);
      makeArm(.40,1.43,.10,0x669c63,0x3e7e79,-.85);
      patch(0,1.25,.184,.42,.065,0x4e938a);
      patch(-.15,.98,.19,.18,.20,0x2f5952);
      patch(.20,1.05,.19,.13,.13,0x6faca0);
      patch(0,1.81,.247,.36,.075,0x6cae62);
      patch(-.13,1.58,.253,.085,.045,0x2a3c28);
      patch(.13,1.58,.253,.085,.045,0x2a3c28);
      for(const sx of [-1,1]){
        patch(sx*.14,.62,.126,.1,.14,0x1d3049);
        patch(sx*.14,.14,.126,.12,.1,0x253447);
      }
    }else if(kind==='skeleton'){
      makeArm(-.33,1.45,.04,0xdcd8c8,0xd8d4c8,-.52);
      makeArm(.33,1.45,.04,0xdcd8c8,0xd8d4c8,-.52);
      // Exposed vertebrae, rib lines, jaw and facial shading.
      detail(.11,.68,.1,0xbab9ad,0,1.06,.15);
      for(const y of [.93,1.04,1.15,1.26]){
        patch(0,y,.185,.35,.048,0xc4c5b9);
        for(const sx of [-1,1])detail(.04,.09,.07,0x888b85,sx*.17,y,.145);
      }
      detail(.32,.09,.25,0xc9c5b9,0,1.44,.055);
      patch(0,1.57,.238,.12,.04,0x4e4840);
      patch(-.11,1.69,.252,.10,.11,0x201f23);
      patch(.11,1.69,.252,.10,.11,0x201f23);
      detail(.025,.48,.025,0xd5d0b6,.40,1.30,.61);
      for(const sx of [-1,1])patch(sx*.12,.30,.079,.045,.17,0xb8b7af);
    }else if(kind==='spider'){
      // Four additional articulated legs complete the eight-legged silhouette.
      for(const sx of [-1,1])for(const z of [-.47,.44]){
        const hip=new THREE.Group();
        hip.position.set(sx*.47,.5,z);
        const upper=box(.50,.09,.08,0x292833,sx*.25,-.005,0);
        upper.rotation.z=sx*.20;
        const joint=box(.14,.12,.16,0x3d3847,sx*.51,-.12,0);
        const foot=box(.10,.34,.095,0x201f26,sx*.62,-.26,0);
        hip.add(upper,joint,foot);
        g.add(hip);
        parts.extraLegs.push(hip);
      }
      for(const x of [-.24,0,.24])for(const z of [-.32,-.08,.18]){
        detail(.11,.035,.12,0x514552,x,.77,z);
      }
      patch(-.14,.54,.929,.09,.1,0xff7563);
      patch(.14,.54,.929,.09,.1,0xff7563);
    }
    if(type==='mooshroom'){
      g.add(box(1.10,.74,.84,0xb92c30,0,.92,0));
      for(const [x,y,z] of [[-.22,1.296,-.18],[.25,1.296,.20],[.02,1.73,.42]]){
        g.add(box(.10,.16,.10,0xf2e9d6,x,y+.07,z));
        g.add(box(.32,.12,.31,0xc72a34,x,y+.19,z));
        g.add(box(.09,.022,.10,0xf5e6cd,x-.08,y+.26,z));
      }
      for(const [x,y,z] of [[-.32,.99,.42],[.32,1.15,-.40],[.22,.78,.43]]){
        g.add(box(.16,.18,.03,0xf7dfd2,x,y,z));
      }
    }
    if(type==='husk'){
      // Desert zombie variant: sand-tan layers and a dry scarf.
      g.add(box(.59,.68,.35,0xb6a071,0,1.08,.005));
      g.add(box(.50,.44,.485,0xaa9364,0,1.69,.004));
      g.add(box(.54,.13,.505,0x65543e,0,1.9,.004));
      for(const sx of [-1,1]){
        g.add(box(.105,.095,.028,0x463a25,sx*.13,1.72,.256));
      }
    }else if(type==='stray'){
      // Frozen skeleton variant: layered hood and tattered pale blue cloth.
      g.add(box(.51,.22,.49,0x879fae,0,1.91,0));
      g.add(box(.45,.16,.24,0x647f96,0,1.31,.08));
      g.add(box(.43,.24,.30,0x90a9b5,0,.94,-.08));
      for(const sx of [-1,1]){
        g.add(box(.09,.12,.027,0x70dbec,sx*.11,1.72,.25));
      }
    }
    const health=new THREE.Group();
    health.position.set(0,(MOB_DEFS[type]?.height||1.2)+.27,0);
    const bg=box(.76,.075,.025,0x171b26,0,0,0);
    const fill=box(.72,.048,.029,0x8edc80,0,0,.01);
    health.add(bg,fill);
    health.visible=false;
    g.add(health);
    parts.healthBar={group:health,fill};
    return { mesh: g, parts };
  }
  function spawn(type, x, y, z) {
    if (!group) return null;
    const def = MOB_DEFS[type];
    const built = buildMob(type);
    // Keep vanilla mob shapes recognizable in every biome; variants have their own models.
    built.mesh.position.set(x, y, z);
    group.add(built.mesh);
    const m = {
      networkId:nextNetworkId++,
      type, def, hp: def.hp,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      mesh: built.mesh, parts: built.parts,
      dir: new THREE.Vector3(0, 0, 1),
      moving: false, onGround: false,
      wanderT: Math.random() * 2, wanderMoving: false, grazeT: 2+Math.random()*6,
      blinkT: 2+Math.random()*4, blinkDuration: 0,
      attackT: 0, shootT: 1 + Math.random() * 2,
      strafeT: 2, strafeDir: 1, hurtT: 0, flashed: false,
      hurtGrace: 0, healthVisibleT: 0, provokedT: 0,
      burnT: 0, fleeT: 0, animT: 0, jumpT: 0, pathT: 0,
      fuseT:0,fuseStarted:false,alertT:0,seeT:0,
      dead: false, deadT: 0
    };
    if(type==='creeper')attachFuseWarning(m);
    mobs.push(m);
    return m;
  }

  function removeMob(i) {
    group.remove(mobs[i].mesh);
    mobs[i].mesh.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      if(o.material){
        for(const material of (Array.isArray(o.material)?o.material:[o.material]))
          if(material?.dispose)material.dispose();
      }
    });
    mobs.splice(i,1);
  }

  function collideBox(m, axis, dist) {
    if (!dist) return false;
    const halfW = m.def.width / 2, hgt = m.def.height;
    m.pos[axis] += dist;
    const x0 = Math.floor(m.pos.x - halfW), x1 = Math.floor(m.pos.x + halfW);
    const y0 = Math.floor(m.pos.y), y1 = Math.floor(m.pos.y + hgt - 1e-4);
    const z0 = Math.floor(m.pos.z - halfW), z1 = Math.floor(m.pos.z + halfW);
    let hit = false;
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      if (!isSolidBlock(World.getBlock(bx, by, bz))) continue;
      hit = true;
      if (axis === 'y') {
        if (dist < 0) m.pos.y = Math.max(m.pos.y, by + 1), m.onGround = true;
        else m.pos.y = Math.min(m.pos.y, by - hgt - 1e-3);
      } else if (axis === 'x') {
        m.pos.x = dist > 0 ? Math.min(m.pos.x, bx - halfW - 1e-3) : Math.max(m.pos.x, bx + 1 + halfW + 1e-3);
      } else {
        m.pos.z = dist > 0 ? Math.min(m.pos.z, bz - halfW - 1e-3) : Math.max(m.pos.z, bz + 1 + halfW + 1e-3);
      }
    }
    return hit;
  }

  function flash(m, on) {
    m.flashed = on;
    m.mesh.traverse(o => {
      if (!o.material) return;
      if (on) {
        if (o.userData.baseColor === undefined) o.userData.baseColor = o.material.color.getHex();
        o.material.color.setHex(0xff5555);
      } else if (o.userData.baseColor !== undefined) {
        o.material.color.setHex(o.userData.baseColor);
      }
    });
  }

  function hurtMob(m, dmg, knockFrom) {
    if (m.dead || m.hurtGrace > 0) return false;
    m.hurtGrace = .33;
    m.healthVisibleT = 1.8;
    m.hp -= dmg;
    m.hurtT = .18;
    flash(m, true);
    if (knockFrom) {
      const dx = m.pos.x - knockFrom.x, dz = m.pos.z - knockFrom.z;
      const l = Math.hypot(dx, dz) || 1;
      m.vel.x += dx / l * 6;
      m.vel.z += dz / l * 6;
      m.vel.y = Math.max(m.vel.y, 4.5);
    }
    if (!m.def.hostile) m.fleeT = 4;
    if (m.type==='spider')m.provokedT=7;
    if (onEvent) onEvent('hurt', m);
    if (m.hp <= 0) {
      m.dead = true;
      m.deadT = .35;
      if (onEvent) onEvent('die', m);
    }
    return true;
  }

  function dropLoot(m) {
    if (mode === GAME_MODE.CREATIVE) return;
    (m.def.drops || []).forEach(d => {
      if (d.chance && Math.random() > d.chance) return;
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) Drops.spawn(d.id, n, m.pos.x, m.pos.y + .4, m.pos.z);
    });
  }

  function rayBox(o, d, min, max) {
    let t0 = 0, t1 = Infinity;
    for (const axis of ['x', 'y', 'z']) {
      if (Math.abs(d[axis]) < 1e-9) {
        if (o[axis] < min[axis] || o[axis] > max[axis]) return null;
        continue;
      }
      const inv = 1 / d[axis];
      let ta = (min[axis] - o[axis]) * inv;
      let tb = (max[axis] - o[axis]) * inv;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
    return t0;
  }

  function tryAttack(eye, dir, reach) {
    let best = null, bestT = Infinity;
    for (const m of mobs) {
      if (m.dead) continue;
      const halfW = m.def.width / 2;
      const t = rayBox(eye, dir,
        { x: m.pos.x - halfW, y: m.pos.y, z: m.pos.z - halfW },
        { x: m.pos.x + halfW, y: m.pos.y + m.def.height, z: m.pos.z + halfW });
      if (t !== null && t < reach && t < bestT) { bestT = t; best = m; }
    }
    if (best) {
      // Consistent, visible cooldown instead of applying damage on every click.
      const now=performance.now();
      const charge=Math.max(0,Math.min(1,(now-lastPlayerAttackAt)/450));
      if(now-lastPlayerAttackAt<450){
        lastAttackResult={target:best,landed:false,reason:'recharge',charge,damage:0};
        return best;
      }
      if(!hasLineOfSight(eye,{x:best.pos.x,y:best.pos.y+best.def.height*.64,z:best.pos.z})){
        lastAttackResult={target:best,landed:false,reason:'blocked',charge,damage:0};
        return null;
      }
      lastPlayerAttackAt=now;
      const tool=Inventory.selectedTool();
      const damage=tool&&Number.isFinite(tool.attackDamage)
        ? tool.attackDamage:SURVIVAL.FIST_DMG;
      if(network?.replica){
        network.attack?.(best.networkId,eye,dir,damage);
        lastAttackResult={target:best,landed:false,reason:'pending',charge,damage:0};
        return best;
      }
      const landed=hurtMob(best,damage,Player.pos);
      if(landed&&tool){
        Inventory.damageSelectedTool(1);
        UI.renderHotbar();
      }
      lastAttackResult={target:best,landed,
        reason:landed?'hit':'hurt-grace',charge,damage:landed?damage:0};
      return best;
    }
    return null;
  }


  function hasLineOfSight(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / .45));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(from.x + dx * t);
      const y = Math.floor(from.y + dy * t);
      const z = Math.floor(from.z + dz * t);
      if (isSolidBlock(World.getBlock(x, y, z))) return false;
    }
    return true;
  }

  function shootArrow(m,target={pos:Player.pos}) {
    const from = new THREE.Vector3(m.pos.x, m.pos.y + m.def.height * .78, m.pos.z);
    const to = new THREE.Vector3(target.pos.x, target.pos.y + 1.1, target.pos.z);
    const dir = to.sub(from).normalize();
    const vel = dir.multiplyScalar(19);
    vel.y += 1.4;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .55), mat(0x9a7a4a));
    mesh.position.copy(from);
    group.add(mesh);
    arrows.push({ networkId:nextNetworkId++,pos: from.clone(), vel, mesh, life: 5, slow:m.type==='stray' });
    if (onEvent) onEvent('shoot', m);
  }

  function firePlayerArrow(eye,direction,damage=6) {
    if(network?.replica){network.arrow?.(eye,direction,damage);return true;}
    if(!group||arrows.length>=64||!direction||!['x','y','z'].every(k=>Number.isFinite(direction[k])&&Number.isFinite(eye[k])))return false;
    const dir=new THREE.Vector3(direction.x,direction.y,direction.z);
    if(dir.lengthSq()<.001)return false;
    dir.normalize();
    const from=new THREE.Vector3(eye.x,eye.y,eye.z).addScaledVector(dir,.4);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.065,.065,.6),mat(0xb59c70));
    mesh.position.copy(from);group.add(mesh);
    arrows.push({networkId:nextNetworkId++,pos:from,vel:dir.multiplyScalar(26),mesh,life:5,player:true,damage});
    if(onEvent)onEvent('shoot',null);
    return true;
  }

  function interactRay(eye,dir,reach,action,preview=false) {
    const type=action==='milk'?'cow':action==='shear'?'sheep':null;
    if(!type)return null;
    let best=null,distance=reach;
    for(const m of mobs){
      if(m.dead||(m.type!==type && !(type==='cow'&&m.type==='mooshroom')))continue;
      const half=m.def.width/2;
      const hit=rayBox(eye,dir,{x:m.pos.x-half,y:m.pos.y,z:m.pos.z-half},{x:m.pos.x+half,y:m.pos.y+m.def.height,z:m.pos.z+half});
      if(hit!==null&&hit<distance&&hasLineOfSight(eye,{x:m.pos.x,y:m.pos.y+m.def.height*.6,z:m.pos.z})){best=m;distance=hit;}
    }
    if(!best)return null;
    if(preview)return {id:best.networkId,type};
    const cooldown=action==='shear'?'shearedUntil':'milkUntil';
    if((best[cooldown]||0)>simulationTime)return {success:false,cooldown:true};
    best[cooldown]=simulationTime+(action==='shear'?90:5);
    return {success:true,type};
  }

  function surfaceY(x, z) {
    for (let y = CONFIG.HEIGHT - 1; y > 0; y--) {
      const id = World.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) return y;
    }
    return 0;
  }

  function skyExposed(m) {
    const bx = Math.floor(m.pos.x), bz = Math.floor(m.pos.z);
    const from = Math.ceil(m.pos.y + m.def.height);
    for (let y = from; y < CONFIG.HEIGHT; y++) {
      if (isSolidBlock(World.getBlock(bx, y, bz))) return false;
    }
    return true;
  }

  // Biome wildlife: common types recur as weights; hostile spawns remain
  // limited by the global cap and light / ground checks.
  const spawnPools={
    plains:{passive:['pig','cow','sheep','chicken','sheep'],hostile:['zombie','skeleton','spider','creeper','creeper']},
    forest:{passive:['cow','pig','chicken','sheep'],hostile:['spider','zombie','creeper','skeleton']},
    jungle:{passive:['chicken','chicken','pig'],hostile:['spider','spider','zombie','creeper']},
    swamp:{passive:['pig','chicken'],hostile:['slime','slime','spider','zombie','creeper']},
    taiga:{passive:['sheep','cow','chicken'],hostile:['skeleton','spider','zombie','creeper']},
    snowy:{passive:['sheep','sheep','cow'],hostile:['stray','stray','skeleton','creeper','spider']},
    glacier:{passive:['sheep'],hostile:['stray','stray','skeleton','spider']},
    desert:{passive:[],hostile:['husk','husk','husk','skeleton','creeper','spider']},
    badlands:{passive:[],hostile:['husk','zombie','skeleton','creeper','spider']},
    savanna:{passive:['cow','pig','chicken'],hostile:['husk','zombie','skeleton','creeper','spider']},
    highland:{passive:['sheep','sheep','cow'],hostile:['skeleton','spider','zombie','creeper']},
    cherry:{passive:['sheep','pig','chicken'],hostile:['zombie','spider','skeleton','creeper']},
    bamboo:{passive:['chicken','pig'],hostile:['spider','spider','zombie','creeper']},
    mushroom:{passive:['mooshroom','mooshroom'],hostile:[]},
    volcanic:{passive:[],hostile:['skeleton','zombie','creeper','spider']},
    crystal:{passive:['sheep','chicken'],hostile:['skeleton','spider','zombie','creeper']}
  };
  function surfaceDarkEnough(x,y,z){
    // Include directly adjacent torches so hostile mobs cannot spawn inside
    // a player's lit area or on top of transparent foliage.
    for(let dx=-5;dx<=5;dx+=2)for(let dz=-5;dz<=5;dz+=2)
      for(let dy=-2;dy<=3;dy++){
        const id=World.getBlock(x+dx,y+dy,z+dz);
        if(id===BLOCK.TORCH||id===BLOCK.LANTERN||id===BLOCK.GLOWSTONE)return false;
      }
    return true;
  }

  function trySpawnCave() {
    // Hostile spawns are allowed underground even in daylight, but require
    // two empty blocks, a solid floor and a real roof (not open night terrain).
    const peers=networkPlayers().filter(p=>!p.dead);
    const pp=peers.length?peers[Math.floor(Math.random()*peers.length)].pos:Player.pos;
    // Surface players should not fill the hostile-mob cap with invisible
    // underground creatures. The caves come alive when players enter them.
    if(pp.y+2>=World.heightAt(Math.floor(pp.x),Math.floor(pp.z)))return false;
    for(let attempt=0;attempt<9;attempt++){
      const a=Math.random()*Math.PI*2, d=14+Math.random()*20;
      const x=Math.floor(pp.x+Math.cos(a)*d),z=Math.floor(pp.z+Math.sin(a)*d);
      if(!World.getChunk(x>>4,z>>4))continue;
      const startY=Math.min(CONFIG.HEIGHT-5,Math.max(6,Math.floor(pp.y+6+Math.random()*6)));
      for(let y=startY;y>=Math.max(3,Math.floor(pp.y)-13);y--){
        if(World.getBlock(x,y,z)!==BLOCK.AIR || World.getBlock(x,y+1,z)!==BLOCK.AIR)continue;
        const floor=World.getBlock(x,y-1,z);
        if(!isSolidBlock(floor)||floor===BLOCK.LEAVES||floor===BLOCK.CACTUS)continue;
        // A cave must lie below the actual terrain surface; tree canopies
        // and player-built shelters should not count as underground caves.
        if(y+3>=World.heightAt(x,z))continue;
        let roof=false;
        for(let ry=y+2;ry<CONFIG.HEIGHT;ry++){
          const roofBlock=World.getBlock(x,ry,z);
          if([BLOCK.LEAVES,BLOCK.BIRCH_LEAVES,BLOCK.SPRUCE_LEAVES,BLOCK.CHERRY_LEAVES].includes(roofBlock))continue;
          if(isSolidBlock(roofBlock)){roof=true;break;}
        }
        if(!roof)continue;
        // Avoid spawning within a torch-lit shelter.
        let lit=false;
        for(let dx=-4;dx<=4&&!lit;dx+=2)
          for(let dz=-4;dz<=4&&!lit;dz+=2)
            for(let dy=-2;dy<=3;dy++){
              const id=World.getBlock(x+dx,y+dy,z+dz);
              if(id===BLOCK.TORCH||id===BLOCK.LANTERN||id===BLOCK.GLOWSTONE){lit=true;break;}
            }
        if(lit)continue;
        const biome=World.biomeAt(x,z);
        const pool=(spawnPools[biome]||spawnPools.plains).hostile;
        if(!pool?.length)continue;
        // Surface-only variants stay above ground; ordinary zombies/skeletons
        // replace them in caves. Slimes are occasional deep-cave inhabitants.
        let type=pool[Math.floor(Math.random()*pool.length)];
        if(type==='husk')type='zombie';
        if(type==='stray' && biome!=='snowy' && biome!=='glacier')type='skeleton';
        if(y<20 && Math.random()<.12)type='slime';
        if(type==='slime'&&y>24&&biome!=='swamp')type='zombie';
        spawn(type,x+.5,y,z+.5);
        return true;
      }
    }
    return false;
  }

  function trySpawn(category) {
    const candidates=networkPlayers().filter(p=>!p.dead);
    const pp=candidates.length?candidates[Math.floor(Math.random()*candidates.length)].pos:Player.pos;
    const ang=Math.random()*Math.PI*2;
    const dist=22+Math.random()*(category==='hostile'?16:26);
    const x=Math.floor(pp.x+Math.cos(ang)*dist);
    const z=Math.floor(pp.z+Math.sin(ang)*dist);
    if(!World.getChunk(x>>4,z>>4))return;
    const y=surfaceY(x,z);
    if(y<=1 || y>=CONFIG.HEIGHT-3)return;
    const top=World.getBlock(x,y,z);
    if(World.getBlock(x,y+1,z)!==BLOCK.AIR||World.getBlock(x,y+2,z)!==BLOCK.AIR)return;
    const biome=World.biomeAt(x,z);
    const pool=(spawnPools[biome]||spawnPools.plains)[category]||[];
    if(!pool.length)return;
    if(category==='hostile'){
      if(!env.night||!isSolidBlock(top)||top===BLOCK.LEAVES||
         top===BLOCK.BIRCH_LEAVES||top===BLOCK.SPRUCE_LEAVES)return;
      if(!surfaceDarkEnough(x,y+1,z))return;
    }else{
      const soils=[BLOCK.GRASS,BLOCK.SNOW,BLOCK.MYCELIUM];
      if(!soils.includes(top))return;
      if(biome==='glacier' && Math.random()>.16)return;
    }
    const kind=pool[Math.floor(Math.random()*pool.length)];
    if(kind==='slime' && biome==='swamp' && Math.random()>.6)return;
    spawn(kind,x+.5,y+1,z+.5);
  }

  function creeperDetonate(m) {
    // An entirely fictional, gameplay-only area event. Protect existing
    // builds by default; this update does not modify world block data.
    const center={x:m.pos.x,y:m.pos.y+1,z:m.pos.z};
    if(mode===GAME_MODE.SURVIVAL){
      for(const player of networkPlayers()){
        if(player.dead)continue;
        const d=Math.hypot(player.pos.x-center.x,player.pos.y+.9-center.y,player.pos.z-center.z);
        if(d>4.25)continue;
        if(!hasLineOfSight(center,{x:player.pos.x,y:player.pos.y+1,z:player.pos.z}))continue;
        damagePlayer(player,Math.max(1,Math.ceil(12*(1-d/4.5))), '크리퍼',center);
      }
    }
    for(const other of mobs){
      if(other===m||other.dead)continue;
      const d=other.pos.distanceTo(m.pos);
      if(d<3.15)hurtMob(other,Math.max(1,Math.round(7*(1-d/3.25))),m.pos);
    }
    spawnExplosionEffect(m.pos);
    if(onEvent)onEvent('explode',m);
  }

  function lerpAngle(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function update(dt, active) {
    if(network?.replica){updateReplica(dt);if(active)updateExplosionEffects(dt);return;}
    if(active)simulationTime+=dt;
    if(active)updateExplosionEffects(dt);
    if (!group) return;
    const pp = Player.pos;
    const survival = mode === GAME_MODE.SURVIVAL;

    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];

      if (m.dead) {
        m.deadT -= dt;
        m.mesh.scale.setScalar(Math.max(m.deadT / .35, .02));
        m.mesh.position.copy(m.pos);
        if (m.deadT <= 0) {
          dropLoot(m);
          removeMob(i);
        }
        continue;
      }
      if (!active) continue;

      const candidates=networkPlayers().filter(p=>!p.dead);
      let target={pos:Player.pos,dead:true,id:null},nearest=Infinity;
      for(const p of candidates){
        const d=m.pos.distanceToSquared(p.pos);
        if(d<nearest){nearest=d;target=p;}
      }
      const pp=target.pos;

      const dx = pp.x - m.pos.x, dz = pp.z - m.pos.z;
      const distXZ = Math.hypot(dx, dz);
      const dist = Math.sqrt(dx * dx + dz * dz + (pp.y - m.pos.y) ** 2);

      if (dist > 64) { removeMob(i); continue; }
      if(m.parts.detailGroup)m.parts.detailGroup.visible=dist<28;
      if(!m.def.hostile){
        m.blinkT-=dt;
        if(m.blinkT<=0){m.blinkDuration=.11;m.blinkT=2+Math.random()*4;}
        m.blinkDuration=Math.max(0,m.blinkDuration-dt);
        for(const eye of m.parts.eyes)eye.visible=m.blinkDuration<=0;
        if(!m.moving && m.fleeT<=0){
          m.grazeT-=dt;
          if(m.grazeT<0){m.grazeT=4+Math.random()*5;}
        }
      }

      m.attackT -= dt;
      m.hurtT -= dt;
      m.hurtGrace = Math.max(0,m.hurtGrace-dt);
      m.healthVisibleT = Math.max(0,m.healthVisibleT-dt);
      m.provokedT = Math.max(0,m.provokedT-dt);
      m.jumpT -= dt;
      m.pathT -= dt;
      m.alertT=Math.max(0,m.alertT-dt);
      m.seeT-=dt;
      if(m.def.hostile && !target.dead && m.seeT<=0){
        m.seeT=.4+Math.random()*.25;
        if(dist<m.def.aggro &&
           hasLineOfSight({x:m.pos.x,y:m.pos.y+m.def.height*.78,z:m.pos.z},
                          {x:pp.x,y:pp.y+1.0,z:pp.z})){
          m.alertT=3.6;
        }
      }
      if (m.hurtT <= 0 && m.flashed) flash(m, false);

      let speed = m.def.speed;
      m.moving = false;

      if (!m.def.hostile) {
        if (m.fleeT > 0) {
          m.fleeT -= dt;
          m.dir.set(-dx, 0, -dz).normalize();
          m.moving = true;
          speed *= 1.7;
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 1.5 + Math.random() * 3;
            m.wanderMoving=Math.random()>=.45;
            if(m.wanderMoving) {
              const a=Math.random()*Math.PI*2;
              m.dir.set(Math.cos(a),0,Math.sin(a));
            }
          }
          m.moving=m.wanderMoving;
        }
      } else {
        const aggro=survival && !target.dead && m.def.aggro && dist<m.def.aggro+4 &&
          m.alertT>0 && (m.type!=='spider'||env.night||!skyExposed(m)||m.provokedT>0);
        if (aggro) {
          m.dir.set(dx, 0, dz).normalize();
          m.moving = true;
          if(m.type==='creeper'){
            // Creepers approach silently; the warning can be escaped before
            // the fuse finishes if the player creates enough distance.
            if(dist<3 && Math.abs(pp.y-m.pos.y)<2.3 &&
               hasLineOfSight({x:m.pos.x,y:m.pos.y+1,z:m.pos.z},
                              {x:pp.x,y:pp.y+1,z:pp.z})){
              if(!m.fuseStarted && onEvent)onEvent('fuse',m);
              m.fuseStarted=true;
              m.fuseT+=dt;
              m.moving=false;
            }else{
              // Backing away or breaking line of sight cancels the warning.
              m.fuseT=Math.max(0,m.fuseT-dt*3.5);
              if(m.fuseT===0)m.fuseStarted=false;
            }
            if(m.fuseT>=1.5){
              creeperDetonate(m);
              removeMob(i);
              continue;
            }
          }else if (m.def.ranged) {
            if (dist > 11) { /* approach */ }
            else if (dist < 5) { m.dir.set(-dx, 0, -dz).normalize(); }
            else {
              m.strafeT -= dt;
              if (m.strafeT <= 0) { m.strafeT = 1.5 + Math.random() * 2; m.strafeDir *= -1; }
              m.dir.set(-dz * m.strafeDir, 0, dx * m.strafeDir).normalize();
            }
            m.shootT -= dt;
            if (m.shootT <= 0 && dist < 22 && hasLineOfSight({ x: m.pos.x, y: m.pos.y + 1.2, z: m.pos.z }, { x: pp.x, y: pp.y + 1.1, z: pp.z })) {
              m.shootT = 2.2 + Math.random();
              shootArrow(m,target);
            }
          } else if (distXZ < (m.def.width / 2 + .55) && Math.abs(pp.y - m.pos.y) < 1.8 && m.attackT <= 0 &&
              hasLineOfSight({x:m.pos.x,y:m.pos.y+m.def.height*.75,z:m.pos.z},
                {x:pp.x,y:pp.y+1.1,z:pp.z})) {
            m.attackT = 1.2;
            damagePlayer(target,m.def.dmg, m.def.name + '에게 당했다', m.pos);
            if(m.type==='husk' && !target.id)Player.applyMobEffect?.('hunger',7);
          }
        } else {
          if(m.type==='creeper' && m.fuseT>0){
            m.fuseT=Math.max(0,m.fuseT-dt*3.5);
            if(m.fuseT===0)m.fuseStarted=false;
          }
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 2 + Math.random() * 3;
            m.wanderMoving=Math.random()>=.5;
            if(m.wanderMoving){
              const a=Math.random()*Math.PI*2;
              m.dir.set(Math.cos(a),0,Math.sin(a));
            }
          }
          m.moving=m.wanderMoving;
        }

        if (!env.night && (m.type==='zombie'||m.type==='skeleton'||m.type==='stray') && skyExposed(m)) {
          m.burnT += dt;
          if (m.burnT >= 1) {
            m.burnT = 0;
            hurtMob(m, 2, null);
            if (onEvent) onEvent('burn', m);
          }
        }
      }

      if(m.type==='slime'){
        // Slimes move in bouncy hops rather than sliding along the ground.
        if(m.onGround && m.jumpT<=0){
          m.vel.y=6.9;
          m.jumpT=.8+Math.random()*.45;
        }
        if(m.onGround && m.jumpT>.2){
          m.vel.x*=.82;m.vel.z*=.82;
        }else{
          m.vel.x=m.moving?m.dir.x*speed:m.vel.x*.90;
          m.vel.z=m.moving?m.dir.z*speed:m.vel.z*.90;
        }
      }else{
        const k=1-Math.exp(-dt*(m.onGround?9:3));
        m.vel.x+=( (m.moving?m.dir.x*speed:0)-m.vel.x)*k;
        m.vel.z+=( (m.moving?m.dir.z*speed:0)-m.vel.z)*k;
      }
      const inWater=World.getBlock(Math.floor(m.pos.x),Math.floor(m.pos.y+.3),Math.floor(m.pos.z));
      if(inWater===BLOCK.WATER||inWater===BLOCK.WATER_FLOW)
        m.vel.y=Math.min(2.2,m.vel.y+14*dt);
      m.vel.y=Math.max(m.vel.y-26*dt,-40);

      m.onGround = false;
      const maxD = Math.max(Math.abs(m.vel.x), Math.abs(m.vel.y), Math.abs(m.vel.z)) * dt;
      const steps = Math.max(1, Math.ceil(maxD / .3));
      let blockedH = false;
      for (let s = 0; s < steps; s++) {
        if (collideBox(m, 'y', m.vel.y * dt / steps)) m.vel.y = 0;
        if (collideBox(m, 'x', m.vel.x * dt / steps)) { m.vel.x = 0; blockedH = true; }
        if (collideBox(m, 'z', m.vel.z * dt / steps)) { m.vel.z = 0; blockedH = true; }
      }
      if (blockedH && m.onGround && m.jumpT <= 0) {
        m.vel.y = 7.8;
        m.jumpT = .8;
      }

      if (m.pos.y < -12) { removeMob(i); continue; }

      if (m.moving) m.yaw = lerpAngle(m.yaw, Math.atan2(m.dir.x, m.dir.z), Math.min(1, dt * 8));
      m.mesh.rotation.y = m.yaw;
      m.mesh.scale.set(1,1,1);
      if(m.type==='creeper'){
        const p=Math.min(1,m.fuseT/1.5);
        m.mesh.scale.set(1+p*.21,1+p*.30,1+p*.21);
        updateFuseWarning(m);
      }else if(m.type==='slime'){
        const hop=Math.max(0,m.vel.y)/7;
        m.mesh.scale.set(1-hop*.13,1+hop*.17,1-hop*.13);
      }
      m.animT += dt * (m.moving ? speed * 3.2 : .25);
      m.mesh.position.copy(m.pos);
      // Body stays grounded; only a slight step-bob on moving mobs.
      m.mesh.position.y+=m.moving && m.type!=='slime' ? Math.sin(m.animT*2)*.007 : 0;
      m.mesh.rotation.z = m.moving
        ? Math.sin(m.animT)*.014 : Math.sin(m.animT*.45)*.006;
      m.parts.legs.forEach((l, li) => {
        // Quadrupeds move opposing diagonal pairs, rather than both legs on a side.
        const phase=m.parts.legs.length===4
          ? ((li===0||li===3)?0:Math.PI) : (li%2)*Math.PI;
        l.rotation.x=m.moving?Math.sin(m.animT+phase)*.48
          :l.rotation.x*Math.exp(-dt*9);
      });
      m.parts.spiderLegs.forEach((leg,i)=>{
        const side=leg.userData.spiderSide;
        const phase=i%4===0||i%4===3?0:Math.PI;
        const step=m.moving?Math.sin(m.animT*1.25+phase)*.20:0;
        leg.rotation.y=side*step;
        leg.rotation.z=side*(.04+Math.abs(step)*.12);
      });
      m.parts.arms.forEach((arm,i)=>{
        const base=arm.userData.baseX||0;
        arm.rotation.x=base+(m.moving?Math.sin(m.animT+Math.PI*(i+1))*.34
          :Math.sin(m.animT*.38+i)*.025);
      });
      m.parts.extraLegs.forEach((limb,i)=>{
        limb.rotation.z=Math.sin(m.animT+i*Math.PI*.5)*.13;
      });
      if(m.parts.healthBar){
        const {group:bar,fill}=m.parts.healthBar;
        bar.visible=CONFIG.MOB_HEALTH_BARS===true && m.healthVisibleT>0;
        if(bar.visible){
          const ratio=Math.max(.015,Math.min(1,m.hp/m.def.hp));
          fill.scale.x=ratio;
          fill.position.x=-.36*(1-ratio);
          bar.rotation.y=Math.atan2(pp.x-m.pos.x,pp.z-m.pos.z)-m.yaw;
        }
      }
    }

    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      if (!active) break;
      a.life -= dt;
      if (a.life <= 0) { removeArrow(i); continue; }
      const steps=Math.max(1,Math.ceil(Math.hypot(a.vel.x,a.vel.y,a.vel.z)*dt/.16));
      let hit=false;
      for(let step=0;step<steps&&!hit;step++){
        a.vel.y-=12*dt/steps;a.pos.addScaledVector(a.vel,dt/steps);
        if(isSolidBlock(World.getBlock(Math.floor(a.pos.x),Math.floor(a.pos.y),Math.floor(a.pos.z)))){
          if(a.player&&mode===GAME_MODE.SURVIVAL)Drops.spawn(ITEM.ARROW,1,a.pos.x,a.pos.y,a.pos.z);
          hit=true;break;
        }
        if(a.player){
          for(const mob of mobs){
            if(mob.dead)continue;
            const half=mob.def.width/2+.04;
            if(Math.abs(a.pos.x-mob.pos.x)<=half&&Math.abs(a.pos.z-mob.pos.z)<=half&&a.pos.y>=mob.pos.y&&a.pos.y<=mob.pos.y+mob.def.height){
              hurtMob(mob,a.damage,Player.pos);hit=true;break;
            }
          }
        }else if(mode===GAME_MODE.SURVIVAL){
          for(const target of networkPlayers())if(!target.dead&&Math.abs(a.pos.x-target.pos.x)<.45&&Math.abs(a.pos.z-target.pos.z)<.45&&a.pos.y>target.pos.y&&a.pos.y<target.pos.y+1.9){
            damagePlayer(target,3,a.slow?'스트레이의 화살':'스켈레톤의 화살',a.pos);
            if(a.slow && !target.id)Player.applyMobEffect?.('slow',6);
            hit=true;break;
          }
        }
      }
      if(hit){removeArrow(i);continue;}
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.x+a.vel.x,a.pos.y+a.vel.y,a.pos.z+a.vel.z);
    }

    if (active) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 2.15;
        const hostiles = mobs.filter(m => m.def.hostile && !m.dead).length;
        const passives = mobs.filter(m => !m.def.hostile && !m.dead).length;
        if (hostiles < MOB_CAPS.hostile) {
          if (!trySpawnCave() && env.night) trySpawn('hostile');
        }
        if (passives < MOB_CAPS.passive && Math.random() < .5) trySpawn('passive');
      }
    }
  }

  function removeArrow(i) {
    group.remove(arrows[i].mesh);
    arrows[i].mesh.geometry.dispose();
    arrows[i].mesh.material.dispose();
    arrows.splice(i, 1);
  }

  function getAttackCharge() {
    return Math.max(0,Math.min(1,(performance.now()-lastPlayerAttackAt)/450));
  }
  function getLastAttackResult(){return lastAttackResult;}

  function counts() {
    return {
      total: mobs.length,
      hostile: mobs.filter(m => m.def.hostile).length,
      passive: mobs.filter(m => !m.def.hostile).length,
      arrows: arrows.length
    };
  }

  function networkSnapshot(){
    const q=n=>Math.round(n*1000)/1000;
    return {mobs:mobs.slice(0,64).map(m=>[m.networkId,m.type,q(m.pos.x),q(m.pos.y),q(m.pos.z),q(m.yaw),m.hp,m.dead?1:0,m.moving?1:0,q(m.fuseT||0)]),
      arrows:arrows.slice(0,64).map(a=>[a.networkId,q(a.pos.x),q(a.pos.y),q(a.pos.z),q(a.vel.x),q(a.vel.y),q(a.vel.z)]),
      explosions:recentExplosions.filter(e=>e.until>simulationTime)
        .map(e=>[e.id,q(e.x),q(e.y),q(e.z)])};
  }
  function applyNetwork(snapshot){
    if(!network?.replica||!snapshot||!Array.isArray(snapshot.mobs)||snapshot.mobs.length>64)return;
    const keep=new Set();
    for(const row of snapshot.mobs){
      if(!Array.isArray(row)||(row.length!==10&&row.length!==9)||!Number.isSafeInteger(row[0])||row[0]<1||!Object.prototype.hasOwnProperty.call(MOB_DEFS,row[1])||!row.slice(2,7).every(Number.isFinite)||row.slice(2,5).some(v=>Math.abs(v)>1000000)||row[7])continue;
      let m=mobs.find(m=>m.networkId===row[0]);
      if(m&&m.type!==row[1])continue;
      if(!m){m=spawn(row[1],row[2],row[3],row[4]);m.networkId=row[0];}
      if(row[6]<m.hp){m.hurtT=.18;flash(m,true);}
      m.hp=Math.max(0,Math.min(m.def.hp,row[6]));m.pos.set(row[2],row[3],row[4]);m.yaw=row[5];m.moving=!!row[8];m.fuseT=Number.isFinite(row[9])?Math.max(0,Math.min(1.5,row[9])):0;keep.add(m.networkId);
    }
    for(let i=mobs.length-1;i>=0;i--)if(!keep.has(mobs[i].networkId))removeMob(i);
    const arrowRows=Array.isArray(snapshot.arrows)?snapshot.arrows.slice(0,64):[],arrowIds=new Set();
    for(const row of arrowRows){
      if(!Array.isArray(row)||row.length!==7||!row.every(Number.isFinite)||!Number.isSafeInteger(row[0])||row[0]<1||row.slice(1).some(v=>Math.abs(v)>1000000))continue;
      let a=arrows.find(a=>a.networkId===row[0]);
      if(!a){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.55),mat(0x9a7a4a));mesh.position.set(row[1],row[2],row[3]);group.add(mesh);a={networkId:row[0],mesh,pos:new THREE.Vector3(),vel:new THREE.Vector3()};arrows.push(a);}
      a.pos.set(row[1],row[2],row[3]);a.vel.set(row[4],row[5],row[6]);arrowIds.add(a.networkId);
    }
    for(let i=arrows.length-1;i>=0;i--)if(!arrowIds.has(arrows[i].networkId))removeArrow(i);
    // One lightweight event for each explosion, not one network object per particle.
    const rows=Array.isArray(snapshot.explosions)?snapshot.explosions.slice(0,12):[];
    for(const row of rows){
      if(!Array.isArray(row)||row.length!==4||!Number.isSafeInteger(row[0])||row[0]<1||
         !row.slice(1).every(Number.isFinite)||row.slice(1).some(v=>Math.abs(v)>1000000)||
         seenRemoteExplosions.has(row[0]))continue;
      seenRemoteExplosions.add(row[0]);
      const pos=new THREE.Vector3(row[1],row[2],row[3]);
      spawnExplosionEffect(pos,true);
      if(pos.distanceTo(Player.pos)<35)onEvent?.('explode',{pos,type:'creeper'});
    }
    if(seenRemoteExplosions.size>240){
      // Insertion-order Set keeps a rolling cap for long multiplayer sessions.
      for(const id of seenRemoteExplosions){
        if(seenRemoteExplosions.size<=120)break;
        seenRemoteExplosions.delete(id);
      }
    }
  }
  function updateReplica(dt){
    if(!group)return;
    for(const m of mobs){
      m.mesh.position.lerp(m.pos,Math.min(1,dt*14));m.mesh.rotation.y=lerpAngle(m.mesh.rotation.y,m.yaw,Math.min(1,dt*12));
      if(m.type==='creeper'){
        if(m.fuseT>0&&!m.fuseStarted&&onEvent)onEvent('fuse',m);
        m.fuseStarted=m.fuseT>0;
        const p=Math.min(1,m.fuseT/1.5);
        m.mesh.scale.set(1+p*.21,1+p*.30,1+p*.21);
        updateFuseWarning(m);
      }else if(m.type==='slime'){
        m.mesh.scale.set(1+Math.sin(m.animT*10)*.035,1-Math.sin(m.animT*10)*.065,1+Math.sin(m.animT*10)*.035);
      }
      m.animT+=dt;const step=m.moving?Math.sin(m.animT*9)*.5:0;
      m.parts.legs.forEach((leg,i)=>{
        const phase=m.parts.legs.length===4?(i===0||i===3?1:-1):(i%2?-1:1);
        leg.rotation.x=step*phase;
      });
      m.parts.spiderLegs.forEach((leg,i)=>{
        const phase=i%4===0||i%4===3?1:-1;
        leg.rotation.y=leg.userData.spiderSide*step*.35*phase;
      });
      m.parts.arms.forEach((arm,i)=>arm.rotation.x=step*(i%2?1:-1));
      m.hurtT=Math.max(0,m.hurtT-dt);if(!m.hurtT&&m.flashed)flash(m,false);
    }
    for(const a of arrows){a.mesh.position.lerp(a.pos,Math.min(1,dt*14));a.mesh.lookAt(a.pos.x+a.vel.x,a.pos.y+a.vel.y,a.pos.z+a.vel.z);}
  }
  function networkAttack(id,eye,direction,amount){
    const m=mobs.find(m=>m.networkId===id&&!m.dead);
    if(!m||!['x','y','z'].every(k=>Number.isFinite(eye?.[k])&&Number.isFinite(direction?.[k]))||
      !Number.isFinite(amount)||amount<1||amount>20)return false;
    const half=m.def.width/2,t=rayBox(eye,direction,{x:m.pos.x-half,y:m.pos.y,z:m.pos.z-half},{x:m.pos.x+half,y:m.pos.y+m.def.height,z:m.pos.z+half});
    return t!==null&&t<4.5&&hasLineOfSight(eye,{x:m.pos.x,y:m.pos.y+m.def.height*.64,z:m.pos.z})&&hurtMob(m,amount,eye);
  }

  return {
    init, reset, spawn, update, tryAttack, firePlayerArrow, interactRay, getAttackCharge, getLastAttackResult,
    setEnv, setMode, counts,networkSnapshot,applyNetwork,networkAttack,
    setNetwork:value=>{network=value;},
    set onEvent(fn) { onEvent = fn; }
  };
})();
