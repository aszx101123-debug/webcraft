'use strict';
// Original 16x16 pixel-art redraw for WebCraft inventory/held items.
// Draws onto the existing atlas; does not change item IDs or gameplay stats.
const ItemArt=(()=>{
  const TS=16;
  const materials=[
    {base:'#a67b48',light:'#d7af71',dark:'#604326',edge:'#362b20'},
    {base:'#90969a',light:'#c4cbd0',dark:'#5a6066',edge:'#34383e'},
    {base:'#b8cbd1',light:'#f1f7f8',dark:'#667f8b',edge:'#3d505a'},
    {base:'#e8b83e',light:'#fff3a2',dark:'#98701f',edge:'#674b21'},
    {base:'#38b8ca',light:'#b2f8ff',dark:'#14798c',edge:'#124c61'}
  ];
  const px=(g,x,y,color)=>{g.fillStyle=color;g.fillRect(x,y,1,1)};
  const line=(g,x,y,xx,yy,color)=>{
    const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));
    for(let i=0;i<=n;i++)px(g,Math.round(x+(xx-x)*i/(n||1)),Math.round(y+(yy-y)*i/(n||1)),color);
  };
  const rect=(g,x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
  function tool(g,kind,p){
    // Deep border and reflected edges make each tier readable at 16 pixels.
    const wood='#735030',wrap='#b38b53';
    if(kind==='sword'){
      line(g,3,13,11,5,p.edge);line(g,4,13,12,5,p.dark);
      line(g,7,9,13,3,p.base);line(g,8,9,13,4,p.light);
      line(g,9,6,13,2,p.base);px(g,13,2,p.light);
      line(g,4,9,9,14,p.edge);line(g,5,9,9,13,p.dark);
      line(g,2,12,5,15,p.edge);line(g,3,12,5,14,wrap);
      line(g,3,13,7,9,wood);px(g,4,12,wrap);px(g,6,10,wrap);
      return;
    }
    if(kind==='pickaxe'){
      line(g,5,13,10,4,p.edge);line(g,6,13,11,4,wood);
      line(g,7,11,10,5,wrap);
      line(g,3,5,12,3,p.edge);line(g,3,4,12,2,p.dark);
      line(g,4,4,11,2,p.base);line(g,5,4,10,3,p.light);
      px(g,2,6,p.dark);px(g,13,3,p.light);return;
    }
    if(kind==='axe'){
      line(g,5,13,10,3,p.edge);line(g,6,13,11,4,wood);
      line(g,7,11,10,5,wrap);
      rect(g,6,2,6,7,p.edge);rect(g,7,3,5,5,p.base);
      rect(g,8,3,3,2,p.light);rect(g,6,6,2,3,p.dark);
      px(g,11,7,p.dark);return;
    }
    if(kind==='shovel'){
      line(g,5,13,10,5,p.edge);line(g,6,13,11,6,wood);
      line(g,7,11,10,7,wrap);
      rect(g,9,2,4,5,p.edge);rect(g,10,2,3,4,p.base);
      rect(g,10,3,2,2,p.light);px(g,9,6,p.dark);return;
    }
    if(kind==='hoe'){
      line(g,5,13,10,4,p.edge);line(g,6,13,11,5,wood);
      line(g,7,11,10,6,wrap);
      rect(g,5,2,7,3,p.edge);rect(g,6,2,6,2,p.base);
      line(g,6,2,11,2,p.light);px(g,5,4,p.dark);
    }
  }
  function armor(g,kind,p){
    const O=p.edge,D=p.dark,B=p.base,L=p.light;
    if(kind==='head'){
      rect(g,3,3,10,9,O);rect(g,4,3,8,7,B);
      rect(g,4,3,8,2,L);rect(g,3,10,10,2,D);
      rect(g,6,8,4,3,O);rect(g,7,8,2,2,D);
      px(g,4,6,L);px(g,11,6,L);
    }else if(kind==='chest'){
      rect(g,4,2,8,12,O);rect(g,5,3,6,10,B);
      rect(g,2,4,3,6,O);rect(g,11,4,3,6,O);
      rect(g,3,5,2,4,D);rect(g,11,5,2,4,D);
      rect(g,5,3,6,2,L);rect(g,6,7,4,3,D);
      rect(g,7,8,2,2,L);rect(g,5,12,6,2,D);
    }else if(kind==='legs'){
      rect(g,4,2,8,5,O);rect(g,5,3,6,3,L);
      rect(g,4,7,3,7,O);rect(g,9,7,3,7,O);
      rect(g,5,7,2,6,B);rect(g,9,7,2,6,B);
      rect(g,5,11,1,2,D);rect(g,10,11,1,2,D);
    }else{
      rect(g,3,6,5,8,O);rect(g,9,6,5,8,O);
      rect(g,4,6,3,6,B);rect(g,10,6,3,6,B);
      rect(g,3,12,5,2,D);rect(g,9,12,5,2,D);
      rect(g,4,6,3,2,L);rect(g,10,6,3,2,L);
    }
  }
  function utility(g,kind){
    const edge='#302a2b',iron='#9caeb7',bright='#edf8ff',wood='#9a6033',gold='#e9c259';
    if(kind==='bow'){
      for(let y=2;y<=13;y++){
        const x=y<5?6:y<10?4:6;
        px(g,x,y,edge);px(g,x+1,y,wood);
      }
      line(g,8,2,8,13,bright);px(g,8,7,gold);return;
    }
    if(kind==='arrow'){
      line(g,3,13,12,4,edge);line(g,4,12,11,5,wood);
      rect(g,10,2,3,4,iron);px(g,12,2,bright);
      line(g,2,10,5,13,'#e4e5df');return;
    }
    if(kind==='shield'){
      rect(g,3,2,10,10,edge);rect(g,4,3,8,8,wood);
      rect(g,5,4,6,6,'#aa7441');rect(g,6,3,4,8,iron);
      rect(g,7,4,2,5,bright);rect(g,4,11,8,2,iron);
      rect(g,6,13,4,1,edge);return;
    }
    if(kind==='shears'){
      line(g,4,12,11,3,iron);line(g,11,12,4,3,bright);
      rect(g,2,11,4,3,edge);rect(g,10,11,4,3,edge);
      rect(g,3,12,2,1,wood);rect(g,11,12,2,1,wood);
      px(g,8,8,gold);return;
    }
    if(kind==='fishing'){
      line(g,4,14,11,2,wood);line(g,5,14,12,2,gold);
      line(g,12,2,13,10,bright);line(g,13,10,11,12,iron);return;
    }
    if(kind==='bucket'){
      rect(g,3,5,10,8,edge);rect(g,4,6,8,6,iron);
      rect(g,5,7,5,3,'#5c7787');rect(g,5,11,6,1,bright);
      line(g,4,4,11,4,bright);line(g,4,4,6,2,iron);
      line(g,9,2,11,4,iron);return;
    }
  }
  function paint(canvas,items){
    if(!canvas||!items)return 0;
    const ctx=canvas.getContext('2d');if(!ctx)return 0;
    const scratch=document.createElement('canvas');scratch.width=scratch.height=16;
    const g=scratch.getContext('2d');g.imageSmoothingEnabled=false;
    let count=0;const painted=new Set();
    for(const [raw,def] of Object.entries(items)){
      const id=Number(raw),tile=def?.tiles?.all;
      if(!Array.isArray(tile))continue;
      let draw=null;
      if(id>=200&&id<=219){
        const type=['pickaxe','axe','shovel','hoe'][Math.floor((id-200)/5)];
        const mat=materials[(id-200)%5];draw=()=>tool(g,type,mat);
      }else if(id>=220&&id<=239){
        const type=['head','chest','legs','feet'][(id-220)%4];
        const tier=Math.floor((id-220)/4);
        const mat=tier===0?{base:'#9b6843',light:'#ce9d69',dark:'#60402a',edge:'#35291e'}:materials[tier];
        draw=()=>armor(g,type,mat);
      }else if(id>=240&&id<=244){
        draw=()=>tool(g,'sword',materials[id-240]);
      }else if([326,327,328,329,330,331,334,335].includes(id)){
        const kind=({326:'bucket',327:'bucket',328:'bucket',329:'bow',330:'arrow',331:'shears',334:'fishing',335:'shield'})[id];
        draw=()=>utility(g,kind);
      }
      if(!draw||painted.has(tile.join(',')))continue;
      painted.add(tile.join(','));g.clearRect(0,0,16,16);draw();
      if(id===327||id===328){
        rect(g,5,6,6,3,id===327?'#3289d3':'#f5eee0');
        line(g,5,6,10,6,id===327?'#9bd9ff':'#ffffff');
      }
      ctx.clearRect(tile[0]*TS,tile[1]*TS,TS,TS);
      ctx.drawImage(scratch,tile[0]*TS,tile[1]*TS);count++;
    }
    return count;
  }
  return {paint};
})();