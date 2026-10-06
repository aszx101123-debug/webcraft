const c=document.getElementById("game"),ctx=c.getContext("2d");
const keys={};addEventListener("keydown",e=>{keys[e.key]=true;if([" ","ArrowLeft","ArrowRight"].includes(e.key))e.preventDefault();handleKey(e.key)});addEventListener("keyup",e=>keys[e.key]=false);
const jobs={전사:{hp:150,dmg:15,skill:"파워 슬래시",skillDmg:55},마법사:{hp:90,dmg:25,skill:"파이어볼",skillDmg:75},궁수:{hp:110,dmg:20,skill:"멀티샷",skillDmg:65},도적:{hp:120,dmg:22,skill:"대시 베기",skillDmg:60}};
let state="job",job=null,world=0,inv=[],meso=0,exp=0,level=1,damage=10,defense=0,skillCd=0,attackCd=0,msg="직업을 선택하세요: 1 전사 · 2 마법사 · 3 궁수 · 4 도적";
let player={x:120,y:380,w:38,h:60,vy:0,hp:100,maxHp:100,onGround:false,dir:1};
let slime={x:700,y:410,w:46,h:40,hp:60,maxHp:60,alive:true};
let boss={x:720,y:340,w:90,h:100,hp:1000,maxHp:1000,alive:true};
let coins=[],quest={active:false,count:0,goal:5,complete:false},inventoryOpen=false,dungeon=false;
const maps=[{name:"초보자 마을",sky:"#9fe1ff",ground:"#67b55a"},{name:"슬라임 숲",sky:"#8fd8ff",ground:"#4eaa58"},{name:"어둠의 동굴",sky:"#25283d",ground:"#383b55"}];
function handleKey(k){
 if(state==="job"){if(["1","2","3","4"].includes(k)){const a=jobs[["1","2","3","4"].indexOf(k)===0?"전사":["전사","마법사","궁수","도적"][+k-1]];job=["전사","마법사","궁수","도적"][+k-1];player.maxHp=a.hp;player.hp=a.hp;damage=a.dmg;state="play";msg=job+" 선택 완료!";}return}
 if(k==="i")inventoryOpen=!inventoryOpen;
 if(k==="q")talk();
 if(k==="d"&&!dungeon&&world===2){dungeon=true;boss.alive=true;boss.hp=boss.maxHp;boss.x=720;msg="어둠의 던전에 입장했다!";}
 if(k==="s")save();
 if(k==="l")load();
 if(k==="z")basicAttack();
 if(k==="x")skill();
}
function basicAttack(){if(attackCd||state!=="play")return;attackCd=15;const target=dungeon?boss:slime;if(target.alive&&Math.abs(player.x-target.x)<95){target.hp-=damage;if(target.hp<=0)kill(target);}}
function skill(){if(skillCd||state!=="play")return;skillCd=90;const target=dungeon?boss:slime;if(target.alive&&Math.abs(player.x-target.x)<180){target.hp-=jobs[job].skillDmg;if(job==="도적")player.x=Math.min(900,player.x+80);if(target.hp<=0)kill(target);msg=jobs[job].skill+"!";}}
function kill(t){t.alive=false;if(t===slime){coins.push({x:t.x,y:t.y-10,v:20+Math.floor(Math.random()*50)});addExp(30);if(quest.active&&!quest.complete){quest.count++;if(quest.count>=quest.goal){quest.complete=true;msg="퀘스트 완료! NPC에게 돌아가세요.";}}setTimeout(()=>{slime.hp=slime.maxHp;slime.alive=true;slime.x=650+Math.random()*180},700)}else{meso+=1000;addExp(300);msg="보스 처치! 1000 메소 + 300 EXP";setTimeout(()=>{dungeon=false;boss.alive=false},1000)}}
function addExp(n){exp+=n;while(exp>=level*100){exp-=level*100;level++;player.maxHp+=20;player.hp=player.maxHp;damage+=5;msg="LEVEL UP! Lv."+level}}
function talk(){if(world!==0){msg="마을로 돌아가 NPC에게 퀘스트를 받으세요.";return}if(!quest.active){quest.active=true;quest.count=0;msg="퀘스트: 슬라임 5마리를 처치하세요!";return}if(quest.complete){quest.active=false;quest.complete=false;quest.count=0;meso+=300;addExp(100);msg="퀘스트 보상: 300 메소 + 100 EXP";return}msg="퀘스트 진행: "+quest.count+"/"+quest.goal}
function save(){localStorage.setItem("miniMapleSave",JSON.stringify({job,level,exp,meso,damage,playerHp:player.hp,inv,world}));msg="게임을 저장했습니다."}
function load(){const d=JSON.parse(localStorage.getItem("miniMapleSave")||"null");if(!d){msg="저장된 게임이 없습니다.";return}job=d.job;level=d.level;exp=d.exp;meso=d.meso;damage=d.damage;inv=d.inv||[];world=d.world||0;player.maxHp=jobs[job]?.hp||100;player.hp=d.playerHp||player.maxHp;state="play";msg="게임을 불러왔습니다."}
function update(){
 if(state!=="play")return;
 if(skillCd)skillCd--;if(attackCd)attackCd--;
 if(keys.ArrowRight){player.x+=4;player.dir=1}if(keys.ArrowLeft){player.x-=4;player.dir=-1}
 if(keys[" "]&&player.onGround){player.vy=-11;player.onGround=false}
 player.vy+=.5;player.y+=player.vy;if(player.y>=390){player.y=390;player.vy=0;player.onGround=true}
 if(player.x>920){if(world<2){world++;player.x=30;msg=maps[world].name+"으로 이동했습니다."}else player.x=920}
 if(player.x<0){if(world>0){world--;player.x=880;msg=maps[world].name+"으로 이동했습니다."}else player.x=0}
 if(world===0){slime.alive=false}else if(!dungeon)slime.alive=true;
 coins.forEach((m,i)=>{if(Math.abs(player.x-m.x)<35){meso+=m.v;coins.splice(i,1)}});
}
function drawBar(x,y,w,h,val,max,fill){ctx.fillStyle="#222";ctx.fillRect(x,y,w,h);ctx.fillStyle=fill;ctx.fillRect(x,y,w*Math.max(0,val/max),h)}
function draw(){
 const m=maps[world];ctx.fillStyle=m.sky;ctx.fillRect(0,0,960,540);ctx.fillStyle=m.ground;ctx.fillRect(0,450,960,90);
 if(world===2){ctx.fillStyle="#55586f";for(let i=0;i<8;i++)ctx.fillRect(i*140,100+(i%2)*45,90,20)}
 ctx.fillStyle="#111";ctx.font="22px Arial";ctx.fillText(dungeon?"어둠의 던전":m.name,390,30);
 drawBar(20,20,180,14,player.hp,player.maxHp,"#e74c3c");drawBar(20,40,180,12,exp,level*100,"#36d16d");
 ctx.fillStyle="#fff";ctx.font="16px Arial";ctx.fillText("Lv."+level+" "+(job||"")+"  HP "+player.hp+"/"+player.maxHp,20,75);ctx.fillText("Meso: "+meso,20,98);
 ctx.fillStyle="#f5a25d";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.fillStyle="#222";ctx.fillRect(player.x+10+(player.dir>0?15:0),player.y+15,5,5);
 if(!dungeon&&slime.alive&&world>0){ctx.fillStyle="#39d77b";ctx.fillRect(slime.x,slime.y,slime.w,slime.h);drawBar(slime.x,slime.y-10,slime.w,5,slime.hp,slime.maxHp,"#e74c3c")}
 if(dungeon&&boss.alive){ctx.fillStyle="#6d2b86";ctx.fillRect(boss.x,boss.y,boss.w,boss.h);drawBar(250,55,460,16,boss.hp,boss.maxHp,"#e74c3c");ctx.fillStyle="#fff";ctx.fillText("검은 슬라임 왕",405,48)}
 coins.forEach(m=>{ctx.fillStyle="#ffd43b";ctx.beginPath();ctx.arc(m.x,m.y,9,0,Math.PI*2);ctx.fill()});
 if(quest.active){ctx.fillStyle="#fff";ctx.fillText("퀘스트: 슬라임 "+quest.count+"/"+quest.goal,680,30)}
 ctx.fillStyle="#fff";ctx.font="16px Arial";ctx.fillText(msg,250,510);
 if(inventoryOpen){ctx.fillStyle="rgba(0,0,0,.9)";ctx.fillRect(230,100,500,330);ctx.fillStyle="#fff";ctx.font="25px Arial";ctx.fillText("인벤토리",260,140);ctx.font="18px Arial";inv.forEach((it,i)=>ctx.fillText((i+1)+". "+it,270,180+i*28));ctx.fillText("메소 "+meso,550,140)}
 if(state==="job"){ctx.fillStyle="rgba(0,0,0,.82)";ctx.fillRect(170,100,620,330);ctx.fillStyle="#fff";ctx.font="34px Arial";ctx.fillText("Mini Maple RPG",350,160);ctx.font="22px Arial";ctx.fillText("직업을 선택하세요",380,205);ctx.fillText("1 전사 ⚔   2 마법사 🔮",315,255);ctx.fillText("3 궁수 🏹   4 도적 🗡",315,300);ctx.font="16px Arial";ctx.fillText("각 직업은 HP·공격력·스킬이 다릅니다.",315,345)}
}
function loop(){update();draw();requestAnimationFrame(loop)}loop();