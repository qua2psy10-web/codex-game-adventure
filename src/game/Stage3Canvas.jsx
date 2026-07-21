import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getMusicEnabled, setMusicEnabled, sfx, startNoxMusic, startStormMusic, stopMusic } from './audio.js';

const BEST_KEY = 'sora-storm-castle-best-v1';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const PLATFORM_DEFS = [
  {id:'entry',x:0,y:1,z:7,w:13,d:14,round:true},
  {id:'hub',x:0,y:2,z:-7,w:15,d:14},
  {id:'blue-entry',x:-3,y:3,z:-18,w:9,d:8},
  {id:'flash-a',x:-5,y:4,z:-28,w:5,d:5,lightning:true,period:9,visibleFor:7,phase:0},
  {id:'flash-b',x:0,y:5,z:-36,w:5,d:5,lightning:true,period:8,visibleFor:5,phase:1},
  {id:'spirit-a',x:4,y:6,z:-44,w:10,d:8,round:true},
  {id:'purple-entry',x:0,y:6.5,z:-52,w:11,d:8},
  {id:'tower-a',x:-3,y:8,z:-61,w:7,d:7},
  {id:'tower-b',x:3,y:9.5,z:-68,w:7,d:7},
  {id:'secret-door',x:7,y:8,z:-61,w:5,d:6},
  {id:'spirit-b',x:0,y:10.5,z:-75,w:12,d:8,round:true},
  {id:'gold-entry',x:0,y:10.5,z:-82,w:8,d:7},
  {id:'orbit-a',x:0,y:11.5,z:-88,w:5,d:5,orbit:{cx:0,cz:-91,r:5,phase:0,speed:.38}},
  {id:'orbit-b',x:0,y:12.5,z:-91,w:5,d:5,orbit:{cx:0,cz:-91,r:5,phase:2.1,speed:-.32}},
  {id:'orbit-c',x:0,y:13.5,z:-94,w:5,d:5,orbit:{cx:0,cz:-91,r:5,phase:4.2,speed:.3}},
  {id:'gold-cloud-hidden',x:-7,y:12,z:-90,w:5,d:5,round:true},
  {id:'spirit-c',x:0,y:14,z:-101,w:12,d:9,round:true},
  {id:'bridge',x:0,y:14,z:-111,w:6,d:15,locked:true},
  {id:'deck',x:0,y:14,z:-130,w:24,d:25,deck:true},
];

const COINS = [[0,1],[-2,-7],[2,-10],[-3,-18],[-5,-28],[0,-36],[4,-44],[-2,-52],[-3,-61],[3,-68],[0,-75],[2,-82],[-4,-88],[4,-91],[0,-96],[0,-101],[0,-109],[-4,-122],[4,-128],[0,-136]];

function topAt(x,z) {
  let found=null;
  for(const p of PLATFORM_DEFS){
    if(p.locked&&!p.active) continue;
    if(p.lightning&&!p.active) continue;
    const inside=p.round?Math.hypot((x-p.x)/(p.w/2),(z-p.z)/(p.d/2))<=1:Math.abs(x-p.x)<=p.w/2&&Math.abs(z-p.z)<=p.d/2;
    if(inside&&(!found||p.y>found.y)) found=p;
  }
  return found?.y??null;
}

function platformGroup(p, silver, trim) {
  const g=new THREE.Group();
  const shape=p.round?new THREE.CylinderGeometry(p.w/2,p.w*.4,2.5,36):new THREE.BoxGeometry(p.w,2.5,p.d);
  const base=new THREE.Mesh(shape,silver);base.position.y=p.y-1.25;base.castShadow=base.receiveShadow=true;g.add(base);
  const top=p.round?new THREE.Mesh(new THREE.CylinderGeometry(p.w/2-.22,p.w/2-.22,.18,36),silver):new THREE.Mesh(new THREE.BoxGeometry(p.w-.22,.18,p.d-.22),silver);top.position.y=p.y+.1;top.receiveShadow=true;g.add(top);
  const rim=p.round?new THREE.Mesh(new THREE.TorusGeometry(p.w/2-.12,.12,8,40),trim):new THREE.Mesh(new THREE.BoxGeometry(p.w+.08,.12,p.d+.08),trim);rim.position.y=p.y+.02;if(p.round)rim.rotation.x=Math.PI/2;g.add(rim);
  g.position.set(p.x,0,p.z);g.visible=!p.locked;g.userData.def=p;return g;
}

function makePlayer(texture){const g=new THREE.Group();const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.08}));sprite.scale.set(2.35,3.2,1);sprite.position.y=1.55;g.add(sprite);const sh=new THREE.Mesh(new THREE.CircleGeometry(.62,24),new THREE.MeshBasicMaterial({color:0x050916,transparent:true,opacity:.36,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.03;g.add(sh);g.userData.sprite=sprite;return g;}

function makeCheckpoint(x,z,color){const g=new THREE.Group();const silver=new THREE.MeshStandardMaterial({color:0xaebdcc,metalness:.5,roughness:.35});const glow=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2});const base=new THREE.Mesh(new THREE.CylinderGeometry(.85,1,.45,8),silver);g.add(base);const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.42),glow);crystal.position.y=1;crystal.userData.glow=true;g.add(crystal);const light=new THREE.PointLight(color,4,8);light.position.y=1.1;g.add(light);g.position.set(x,(topAt(x,z)??1)+.24,z);g.userData.active=false;return g;}

function makeSpirit(color){const g=new THREE.Group();const glow=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2,transparent:true});const body=new THREE.Mesh(new THREE.SphereGeometry(.46,16,12),glow);body.position.y=.65;g.add(body);const tail=new THREE.Mesh(new THREE.ConeGeometry(.3,.9,12),glow);tail.position.y=.05;g.add(tail);[-.16,.16].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.06,8,8),new THREE.MeshBasicMaterial({color:0xffffff}));e.position.set(x,.72,.42);g.add(e);});const cage=new THREE.Mesh(new THREE.TorusGeometry(.9,.06,8,20),new THREE.MeshStandardMaterial({color:0xd8b95d,metalness:.8}));cage.rotation.x=Math.PI/2;cage.position.y=.55;g.add(cage);g.userData={rescued:false,glow};return g;}

function makeEnemy(type,x,z,crystalDrop=false){const g=new THREE.Group();const dark=new THREE.MeshStandardMaterial({color:type==='bat'?0x293b6e:0x8d9aab,metalness:.55,roughness:.35});const cyan=new THREE.MeshStandardMaterial({color:0x66ecff,emissive:0x169bff,emissiveIntensity:2});if(type==='bat'){const b=new THREE.Mesh(new THREE.SphereGeometry(.48,12,8),dark);b.position.y=1;g.add(b);[-1,1].forEach(s=>{const wing=new THREE.Mesh(new THREE.ConeGeometry(.72,1.4,3),dark);wing.position.set(s*.78,1,0);wing.rotation.z=s*1.25;g.add(wing);});}else{const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.7,.75),dark);body.position.y=1.1;g.add(body);const sword=new THREE.Mesh(new THREE.BoxGeometry(.12,1.7,.12),cyan);sword.position.set(.8,1.1,.2);sword.rotation.z=-.35;g.add(sword);}[-.16,.16].forEach(dx=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),cyan);e.position.set(dx,1.25,.5);g.add(e);});g.position.set(x,(topAt(x,z)??1)+.05,z);g.userData={type,alive:true,originX:x,crystalDrop,nextBolt:0};return g;}

function makeCrystal(x,z,hidden=false){const mat=new THREE.MeshStandardMaterial({color:0x70e9ff,emissive:0x197cff,emissiveIntensity:2,metalness:.2,transparent:true});const m=new THREE.Mesh(new THREE.OctahedronGeometry(.42),mat);m.position.set(x,(topAt(x,z)??6)+1.4,z);m.userData={collected:false,hidden};m.visible=!hidden;return m;}

function makeNox(){const g=new THREE.Group();const armor=new THREE.MeshStandardMaterial({color:0x111528,metalness:.88,roughness:.2,transparent:true});const violet=new THREE.MeshStandardMaterial({color:0x9a65ff,emissive:0x6a22ff,emissiveIntensity:2.2,transparent:true});const body=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.5,3.8,10),armor);body.position.y=3.2;g.add(body);const head=new THREE.Mesh(new THREE.CylinderGeometry(.72,.9,1.25,8),armor);head.position.y=5.65;g.add(head);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.15,1.7,6),armor);crown.position.y=6.9;g.add(crown);[-1.45,1.45].forEach(x=>{const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.78,12,8),armor);shoulder.position.set(x,4.5,0);g.add(shoulder);});const sword=new THREE.Mesh(new THREE.BoxGeometry(.22,4.8,.25),violet);sword.position.set(.5,2.2,1.15);sword.rotation.z=-.18;g.add(sword);const core=new THREE.Mesh(new THREE.OctahedronGeometry(.4),violet);core.position.set(0,4,1.25);g.add(core);const light=new THREE.PointLight(0x8a55ff,5,12);light.position.set(0,4,1);g.add(light);g.position.set(0,14,-138);g.userData={armor,violet,sword,health:5,maxHealth:5,defeatedAt:0,nextAttack:0,hitReady:false};return g;}

function saveBest(result){let old=null;try{old=JSON.parse(localStorage.getItem(BEST_KEY));}catch{/*ignore*/}const record=old?{time:Math.min(old.time??9999,result.time),coins:Math.max(old.coins??0,result.coins),crystals:Math.max(old.crystals??0,result.crystals),spirits:Math.max(old.spirits??0,result.spirits),falls:Math.min(old.falls??999,result.falls)}:result;localStorage.setItem(BEST_KEY,JSON.stringify(record));return !old||result.time<(old.time??9999);}

export default function Stage3Canvas({onComplete,onExit}){
  const mountRef=useRef(null),jumpRef=useRef(false),moveRef=useRef({x:0,y:0}),knobRef=useRef(null);
  const [musicOn,setMusicOn]=useState(getMusicEnabled());
  const [hud,setHud]=useState({hearts:3,coins:0,crystals:0,spirits:0,falls:0,message:'光の階段を登り、精霊を探そう',area:'青白い雷の回廊',warning:false,boss:false,bossHealth:5,bossMax:5});
  const [result,setResult]=useState(null);

  const moveJoystick=(e)=>{const pad=e.currentTarget;if(e.type==='pointerdown')pad.setPointerCapture(e.pointerId);const r=pad.getBoundingClientRect();const x=THREE.MathUtils.clamp((e.clientX-r.left-r.width/2)/(r.width*.36),-1,1),y=THREE.MathUtils.clamp((e.clientY-r.top-r.height/2)/(r.height*.36),-1,1);moveRef.current={x,y};if(knobRef.current)knobRef.current.style.transform=`translate(${x*28}px,${y*28}px)`;};
  const releaseJoystick=()=>{moveRef.current={x:0,y:0};if(knobRef.current)knobRef.current.style.transform='';};

  useEffect(()=>{
    const mount=mountRef.current,scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x111429,.011);
    const camera=new THREE.PerspectiveCamera(53,mount.clientWidth/mount.clientHeight,.1,260);camera.position.set(0,7,20);camera.lookAt(0,3,-2);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0x9ebcff,0x090b18,1.9));const key=new THREE.DirectionalLight(0x9edfff,3.4);key.position.set(-12,28,10);key.castShadow=true;scene.add(key);
    const silver=new THREE.MeshStandardMaterial({color:0xaeb8c7,metalness:.52,roughness:.34});const blue=new THREE.MeshStandardMaterial({color:0x5deaff,emissive:0x156dff,emissiveIntensity:1.5,metalness:.3});const purple=new THREE.MeshStandardMaterial({color:0xb05cff,emissive:0x6422ca,emissiveIntensity:1.3});const gold=new THREE.MeshStandardMaterial({color:0xffd45f,emissive:0x9d5700,emissiveIntensity:.8,metalness:.7,roughness:.25});
    const platformMeshes=PLATFORM_DEFS.map(p=>{p.active=!p.locked&&!p.lightning;const color=p.deck||p.id.includes('gold')||p.id.includes('orbit')?gold:p.id.includes('purple')||p.id.includes('tower')?purple:blue;const g=platformGroup(p,silver,color);scene.add(g);return g;});
    const spires=[];[[-6,-8],[6,-8],[-5,-53],[5,-53],[-5,-75],[5,-75]].forEach(([x,z],i)=>{const g=new THREE.Group();const tower=new THREE.Mesh(new THREE.CylinderGeometry(.62,.9,5.8,12),silver);tower.position.y=2.9;g.add(tower);const roof=new THREE.Mesh(new THREE.ConeGeometry(1,2,8),i>3?gold:i>1?purple:blue);roof.position.y=6.6;g.add(roof);g.position.set(x,(topAt(x,z)??2),z);scene.add(g);spires.push(g);});
    const tex=new THREE.TextureLoader().load(assetUrl('assets/sora.png'));tex.colorSpace=THREE.SRGBColorSpace;const player=makePlayer(tex);player.position.set(0,2.05,10);scene.add(player);
    const checkpoints=[makeCheckpoint(-3,-18,0x5deaff),makeCheckpoint(0,-52,0xb05cff),makeCheckpoint(0,-82,0xffd45f)];checkpoints.forEach(c=>scene.add(c));
    const spirits=[makeSpirit(0x5deaff),makeSpirit(0xb05cff),makeSpirit(0xffd45f)];[[4,-44],[0,-75],[0,-101]].forEach(([x,z],i)=>{spirits[i].position.set(x,(topAt(x,z)??6)+.4,z);scene.add(spirits[i]);});
    const enemies=[makeEnemy('bat',-1,-22,true),makeEnemy('guard',-3,-60,true),makeEnemy('bat',3,-66,true),makeEnemy('guard',2,-72,false)];enemies.forEach(e=>scene.add(e));
    const coinMeshes=COINS.map(([x,z])=>{const m=new THREE.Mesh(new THREE.TorusGeometry(.25,.1,8,18),gold);m.position.set(x,(topAt(x,z)??2)+1.25,z);m.rotation.y=Math.PI/2;m.userData.collected=false;scene.add(m);return m;});
    const crystals=[makeCrystal(-1,-22,true),makeCrystal(-3,-60,true),makeCrystal(3,-66,true),makeCrystal(7,-61,true),makeCrystal(-7,-90,true)];crystals.forEach(c=>scene.add(c));
    const nox=makeNox();nox.userData.armor.color.setHex(0x4b5578);nox.userData.armor.metalness=.4;nox.userData.armor.roughness=.38;nox.userData.armor.emissive.setHex(0x28145f);nox.userData.armor.emissiveIntensity=.9;
    const noxPlate=new THREE.MeshStandardMaterial({color:0xb9cae6,metalness:.3,roughness:.38,emissive:0x344472,emissiveIntensity:.75});
    const chestPlate=new THREE.Mesh(new THREE.BoxGeometry(1.75,2.2,.3),noxPlate);chestPlate.position.set(0,4,1.35);nox.add(chestPlate);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(1,.38,.3),purple);visor.position.set(0,5.75,1.02);nox.add(visor);
    [-1.45,1.45].forEach(x=>{const plate=new THREE.Mesh(new THREE.SphereGeometry(.82,12,8),noxPlate);plate.scale.set(1.35,.62,.8);plate.position.set(x,4.55,.32);nox.add(plate);});
    nox.children.forEach(o=>{if(o.isMesh)o.visible=false;});const noxTex=new THREE.TextureLoader().load(assetUrl('assets/stage3/nox.png'));noxTex.colorSpace=THREE.SRGBColorSpace;const noxSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:noxTex,transparent:true,alphaTest:.04}));noxSprite.scale.set(8.2,12,1);noxSprite.position.set(0,6.4,0);nox.add(noxSprite);nox.userData.sprite=noxSprite;scene.add(nox);
    [-10,10].forEach(x=>{for(let z=-140;z<=-121;z+=4){const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,1.8,8),gold);post.position.set(x,15,z);scene.add(post);}const rail=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,20),gold);rail.position.set(x,15.8,-130);scene.add(rail);});
    const bossSteps=[{p:{id:'boss-step-1',x:-3,y:15.7,z:-129,w:5,d:5,lightning:true,active:false},mesh:null},{p:{id:'boss-step-2',x:2,y:17.2,z:-134,w:5,d:5,lightning:true,active:false},mesh:null}];bossSteps.forEach(s=>{PLATFORM_DEFS.push(s.p);s.mesh=platformGroup(s.p,silver,gold);s.mesh.visible=false;scene.add(s.mesh);});
    const lightning=[],particles=[],keys=new Set(),velocity=new THREE.Vector3();let yaw=0,grounded=false,last=performance.now(),startAt=last,animation,checkpoint={x:0,y:2.05,z:10},invulnerableUntil=0,attackUntil=0,nextStrike=last+2200,bossStarted=false,completed=false,lastArea='',bossDeaths=0,damageTaken=0,bossPlatformUntil=0;
    const stats={coins:0,crystals:0,spirits:0,falls:0};
    const debug=import.meta.env.DEV?new URLSearchParams(location.search).get('stage3Debug'):null;
    if(debug==='boss'||debug==='clear'){stats.spirits=3;PLATFORM_DEFS.find(p=>p.id==='bridge').active=true;platformMeshes.find(g=>g.userData.def.id==='bridge').visible=true;player.position.set(debug==='clear'?2:0,debug==='clear'?18.25:15.05,debug==='clear'?-134:-120);checkpoint={x:0,y:15.05,z:-120};}
    const patchHud=(patch)=>setHud(h=>({...h,...patch}));
    const say=(message)=>patchHud({message});
    const respawn=(boss=false)=>{velocity.set(0,0,0);player.position.set(checkpoint.x,checkpoint.y,checkpoint.z);if(boss){bossDeaths++;const hearts=stats.crystals>=4?3:stats.crystals>=2?2:1;nox.userData.health=nox.userData.maxHealth;nox.userData.hitReady=false;nox.userData.nextAttack=performance.now()+1200;bossSteps.forEach(s=>{s.p.active=false;s.mesh.visible=false;});patchHud({hearts,bossHealth:nox.userData.health,message:'収集物を維持してノクス戦を再開'});}else patchHud({hearts:3,message:'安全な足場から再開'});};
    const hurt=(message='雷を受けた！')=>{const now=performance.now();if(now<invulnerableUntil||completed)return;invulnerableUntil=now+1500;damageTaken++;sfx.hit();setHud(h=>{const hearts=h.hearts-1;if(hearts<=0){setTimeout(()=>respawn(bossStarted),0);return {...h,hearts:0,message};}return {...h,hearts,message};});};
    const spawnStrike=(x,z,color=0x66eaff,delay=900,radius=1.2)=>{const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.7,radius,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;const y=topAt(x,z)??14;ring.position.set(x,y+.06,z);scene.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,13,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.45}));beam.position.set(x,y+6.5,z);scene.add(beam);lightning.push({ring,beam,x,z,y,at:performance.now()+delay,radius,hit:false,done:false,color});};
    const rescue=(i)=>{if(spirits[i].userData.rescued||stats.spirits!==i)return;if(i===1&&enemies.some(e=>e.userData.alive&&e.position.z<-54&&e.position.z>-75)){say('塔の番兵をすべて倒そう');return;}spirits[i].userData.rescued=true;stats.spirits++;sfx.checkpoint();spirits[i].children.forEach(o=>{if(o.material?.transparent)o.material.opacity=.2;});patchHud({spirits:stats.spirits,hearts:3,message:`雷の精霊を救出した！ ${stats.spirits}/3`});if(stats.spirits===3){const p=PLATFORM_DEFS.find(d=>d.id==='bridge');p.active=true;platformMeshes.find(g=>g.userData.def.id==='bridge').visible=true;say('3体の光が中央塔へ橋を架けた！');}};
    const awardCrystal=(index)=>{const c=crystals[index];if(c.userData.collected)return;c.userData.hidden=false;c.visible=true;};
    const finish=()=>{if(completed)return;completed=true;stopMusic();sfx.clear();const data={time:Math.round((performance.now()-startAt)/100)/10,coins:stats.coins,crystals:stats.crystals,spirits:stats.spirits,falls:stats.falls};const isBest=saveBest(data);setResult({...data,isBest});};
    const onKeyDown=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space')jumpRef.current=true;if(e.code==='KeyQ')yaw-=.2;if(e.code==='KeyE')yaw+=.2;if(e.code==='KeyC')yaw=0;if(e.code==='KeyM'){const on=!getMusicEnabled();setMusicEnabled(on);setMusicOn(on);if(on&&bossStarted)startNoxMusic();else if(on)startStormMusic();}if(e.code==='Escape')onExit();};const onKeyUp=e=>keys.delete(e.code);window.addEventListener('keydown',onKeyDown,{passive:false});window.addEventListener('keyup',onKeyUp);startStormMusic();
    const frame=now=>{const dt=Math.min((now-last)/1000,.04);last=now;
      PLATFORM_DEFS.forEach((p,i)=>{if(p.orbit){const a=now*.001*p.orbit.speed+p.orbit.phase;p.x=p.orbit.cx+Math.cos(a)*p.orbit.r;p.z=p.orbit.cz+Math.sin(a)*p.orbit.r;platformMeshes[i].position.x=p.x;platformMeshes[i].position.z=p.z;platformMeshes[i].rotation.y=-a;}if(p.lightning&&p.id.startsWith('flash')){const t=(now/1000+p.phase)%p.period;p.active=t<p.visibleFor;platformMeshes[i].visible=p.active;platformMeshes[i].children.forEach(o=>{if(o.material)o.material.opacity=p.active?1:.12;});}});
      const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-moveRef.current.y,side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveRef.current.x;const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let mx=fx*forward+rx*side,mz=fz*forward+rz*side;const ml=Math.hypot(mx,mz)||1;mx/=ml;mz/=ml;velocity.x=THREE.MathUtils.damp(velocity.x,mx*7.7,11,dt);velocity.z=THREE.MathUtils.damp(velocity.z,mz*7.7,11,dt);velocity.y-=21*dt;if(jumpRef.current&&grounded){velocity.y=9.5;grounded=false;sfx.jump();}jumpRef.current=false;
      if(bossStarted){const deckTilt=Math.sin(now*.0012)*(nox.userData.health<=Math.ceil(nox.userData.maxHealth/3)?.17:.08);platformMeshes.find(g=>g.userData.def.deck).rotation.z=deckTilt;velocity.x-=deckTilt*8*dt;}
      player.position.addScaledVector(velocity,dt);const top=topAt(player.position.x,player.position.z);grounded=false;if(top!==null&&player.position.y<=top+1.08&&player.position.y>=top-.75&&velocity.y<=0){player.position.y=top+1.05;velocity.y=0;grounded=true;}
      if(player.position.y<-9){stats.falls++;patchHud({falls:stats.falls});player.position.set(checkpoint.x,checkpoint.y,checkpoint.z);velocity.set(0,0,0);hurt('天空城から落下した！');}
      player.userData.sprite.material.opacity=now<invulnerableUntil&&Math.floor(now/100)%2?.25:1;player.userData.sprite.position.y=1.55+Math.sin(now*.012)*.035;
      coinMeshes.forEach(c=>{if(c.userData.collected)return;c.rotation.z+=dt*3;if(c.position.distanceTo(player.position)<1.25){c.userData.collected=true;c.visible=false;stats.coins++;sfx.coin();patchHud({coins:stats.coins});}});
      crystals.forEach(c=>{if(c.userData.collected||!c.visible)return;c.rotation.y+=dt*2.5;if(c.position.distanceTo(player.position)<1.3){c.userData.collected=true;c.visible=false;stats.crystals++;sfx.feather();patchHud({crystals:stats.crystals,message:'雷の結晶を手に入れた！'});}});
      checkpoints.forEach((c,i)=>{const glow=c.children.find(o=>o.userData.glow);if(glow)glow.rotation.y+=dt*2;if(!c.userData.active&&c.position.distanceTo(player.position)<1.7){c.userData.active=true;checkpoint={x:c.position.x,y:(topAt(c.position.x,c.position.z)??2)+1.05,z:c.position.z};sfx.checkpoint();patchHud({hearts:3,message:`第${i+1}精霊エリアの入口を記録した`});}});
      spirits.forEach((s,i)=>{if(s.userData.rescued){s.position.y+=dt*.8;s.rotation.y+=dt*2;if(s.position.y>22)s.visible=false;return;}s.position.y+=Math.sin(now*.004+i)*.002;if(s.position.distanceTo(player.position)<1.8)rescue(i);});
      enemies.forEach((e,i)=>{if(!e.userData.alive)return;e.position.x=e.userData.originX+Math.sin(now*.0015+i)*1.2;if(e.userData.type==='bat')e.position.y=(topAt(e.position.x,e.position.z)??6)+2.2+Math.sin(now*.004+i)*.5;const d=e.position.distanceTo(player.position);if(e.userData.type==='bat'&&now>e.userData.nextBolt){e.userData.nextBolt=now+3200;spawnStrike(player.position.x,player.position.z,0x5deaff,750,.85);}if(d<3&&now>attackUntil){attackUntil=now+650;sfx.sword();e.userData.alive=false;e.visible=false;if(e.userData.crystalDrop)awardCrystal(i<3?i:2);say(`${e.userData.type==='bat'?'雷コウモリ':'鎧の番兵'}を自動攻撃で倒した！`);}else if(d<1.2)hurt('番兵の剣を受けた！');});
      if(stats.spirits>=1&&!crystals[3].userData.collected&&player.position.z<-56&&player.position.z>-67){const hint=Math.max(0,1-Math.abs(player.position.x-7)/10);document.documentElement.style.setProperty('--crystal-hint',hint);if(player.position.x>4.8)crystals[3].visible=true;}else if(stats.spirits>=2&&!crystals[4].userData.collected&&player.position.z<-84&&player.position.z>-96){const hint=Math.max(0,1-Math.abs(player.position.x+7)/10);document.documentElement.style.setProperty('--crystal-hint',hint);if(player.position.x<-4.8)crystals[4].visible=true;}else document.documentElement.style.setProperty('--crystal-hint',0);
      const area=player.position.z>-48?'青白い雷の回廊':player.position.z>-78?'紫電の番兵塔':player.position.z>-108?'金雷の回転迷路':'中央塔への光の橋';if(area!==lastArea){lastArea=area;patchHud({area});}
      const bossActive=player.position.z<-117&&!nox.userData.defeatedAt;if(bossActive&&!bossStarted){bossStarted=true;const errors=stats.falls+damageTaken;const maxHealth=debug==='clear'?1:errors>=5?3:errors>=2?4:5;nox.userData.health=maxHealth;nox.userData.maxHealth=maxHealth;nox.userData.nextAttack=now+1500;checkpoint={x:0,y:15.05,z:-119};startNoxMusic();patchHud({boss:true,bossHealth:maxHealth,bossMax:maxHealth,spirits:stats.spirits,message:'黒騎士ノクス'});if(debug==='clear'){nox.userData.hitReady=true;bossPlatformUntil=now+1500;bossSteps.forEach(s=>{s.p.active=true;s.mesh.visible=true;});}}
      if(!bossStarted&&now>nextStrike&&player.position.z<-15&&player.position.z>-108){nextStrike=now+3400;spawnStrike(player.position.x+(Math.random()-.5)*3,player.position.z-1,area.includes('紫')?0xb05cff:area.includes('金')?0xffd45f:0x5deaff,900,1.1);patchHud({warning:true});}
      if(bossActive&&now>nox.userData.nextAttack&&!nox.userData.hitReady){const lost=nox.userData.maxHealth-nox.userData.health,count=lost>=Math.ceil(nox.userData.maxHealth*2/3)?6:lost>=1?5:3;for(let i=0;i<count;i++)spawnStrike((Math.random()-.5)*14,-126-Math.random()*11,i%3===0?0xffd45f:i%2?0xb05cff:0x5deaff,1050,1.05);nox.userData.nextAttack=now+4800;bossPlatformUntil=now+4800;nox.userData.hitReady=true;bossSteps.forEach((s,i)=>{s.p.active=true;s.mesh.visible=true;s.mesh.scale.setScalar(.01);setTimeout(()=>s.mesh.scale.setScalar(1),i*180);});say('落雷の足場を2つ渡り、上空から飛び込め！');}
      lightning.forEach(l=>{const remain=l.at-now;l.ring.material.opacity=Math.max(.15,Math.min(.9,remain/900));l.ring.scale.setScalar(1+Math.sin(now*.012)*.08);if(remain<=0&&!l.done){l.beam.scale.x=l.beam.scale.z=6;l.beam.material.opacity=1;l.ring.material.opacity=1;if(!l.hit&&Math.hypot(player.position.x-l.x,player.position.z-l.z)<l.radius&&player.position.y<l.y+1.4){l.hit=true;hurt('予告された落雷を受けた！');}if(now-l.at>260){l.done=true;scene.remove(l.ring,l.beam);}}});for(let i=lightning.length-1;i>=0;i--)if(lightning[i].done)lightning.splice(i,1);if(!lightning.length)setHud(h=>h.warning?{...h,warning:false}:h);
      if(nox.userData.hitReady&&now>bossPlatformUntil){nox.userData.hitReady=false;bossSteps.forEach(s=>{s.p.active=false;s.mesh.visible=false;});say('足場が消えた。次の落雷に備えよう');}
      if(nox.userData.hitReady&&player.position.y>16.2&&Math.hypot(player.position.x,player.position.z+138)<6&&now>attackUntil){attackUntil=now+900;sfx.sword();nox.userData.health--;nox.userData.hitReady=false;bossSteps.forEach(s=>{s.p.active=false;s.mesh.visible=false;});patchHud({bossHealth:nox.userData.health,message:'上空からノクスへ一撃！'});if(nox.userData.health<=0){nox.userData.defeatedAt=now;for(let i=0;i<90;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.06,5,5),i%3===0?gold:i%2?purple:blue);p.position.copy(nox.position).add(new THREE.Vector3((Math.random()-.5)*4,Math.random()*7,(Math.random()-.5)*3));p.userData.v=new THREE.Vector3((Math.random()-.5)*4,Math.random()*4,(Math.random()-.5)*4);scene.add(p);particles.push(p);}say('雷雲がノクスを飲み込んでいく…');}else nox.userData.nextAttack=now+800;}
      if(nox.userData.defeatedAt){const age=(now-nox.userData.defeatedAt)/1000;nox.scale.setScalar(Math.max(.01,1-age*.45));nox.userData.armor.opacity=nox.userData.violet.opacity=Math.max(0,1-age*.5);particles.forEach(p=>{p.position.addScaledVector(p.userData.v,dt);p.userData.v.y-=dt*.7;});if(age>2.3)finish();}
      const target=new THREE.Vector3(player.position.x+Math.sin(yaw)*10,player.position.y+4.8,player.position.z+Math.cos(yaw)*10);camera.position.lerp(target,.07);if(bossStarted)camera.lookAt(0,18,-137);else camera.lookAt(player.position.x-Math.sin(yaw)*4.5,player.position.y+1.2,player.position.z-Math.cos(yaw)*4.5);renderer.render(scene,camera);animation=requestAnimationFrame(frame);
    };animation=requestAnimationFrame(frame);
    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener('resize',resize);
    return()=>{cancelAnimationFrame(animation);stopMusic();document.documentElement.style.removeProperty('--crystal-hint');window.removeEventListener('resize',resize);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);renderer.dispose();tex.dispose();noxTex.dispose();PLATFORM_DEFS.splice(-2);mount.removeChild(renderer.domElement);};
  },[onExit]);

  return <main className={`game-shell stage3-shell ${hud.warning?'is-lightning-warning':''} ${result?'is-storm-cleared':''}`}>
    <div className="stage3-tint"/><div className="crystal-direction-hint"/><div className="game-canvas" ref={mountRef}/>
    <div className="hud stage3-hud"><div className="hud-hearts">{[1,2,3].map(n=><span className={`heart ${n<=hud.hearts?'active':''}`} key={n}>♥</span>)}</div><div className="hud-stage"><span>STAGE 3</span><b>嵐を抱く天空城</b><small>{hud.area}</small></div><div className="hud-counts"><span>◎ {hud.coins}</span><span className="crystal-count">◆ {hud.crystals}/5</span></div></div>
    <div className="spirit-counter"><span>✦</span><b>精霊 {hud.spirits}/3</b><i>{[0,1,2].map(i=><em className={i<hud.spirits?'saved':''} key={i}/>)}</i></div>
    <div className="keyboard-help"><span><b>WASD / 矢印</b> 移動</span><span><b>SPACE</b> ジャンプ</span><span><b>Q / E</b> カメラ</span><span><b>C</b> 正面</span><span>攻撃は自動</span></div>
    <button className="music-button" onClick={()=>{const on=!musicOn;setMusicOn(on);setMusicEnabled(on);if(on&&hud.boss)startNoxMusic();else if(on)startStormMusic();}}>BGM {musicOn?'ON':'OFF'} <small>(M)</small></button>
    {hud.boss?<div className="boss-hud nox-hud"><span>黒騎士ノクス</span><div>{Array.from({length:hud.bossMax},(_,i)=><i className={i<hud.bossHealth?'alive':''} key={i}/>)}</div></div>:null}
    {hud.warning?<div className="lightning-warning">⚡ 落雷地点から離れろ！</div>:null}<div className="game-message">{hud.message}</div>
    <div className="mobile-controls"><div className="joystick" onPointerDown={moveJoystick} onPointerMove={e=>{if(e.buttons)moveJoystick(e)}} onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick}><div className="joystick-knob" ref={knobRef}/></div><button className="jump-button" onPointerDown={()=>{jumpRef.current=true}}>JUMP</button></div>
    {result?<section className="result-screen stage3-result"><p className="result-line">「嵐は終わった。みんなで次の空へ行こう！」</p><h2>雷の精霊の力を解放した！</h2><div className="storm-power">⚡</div><div className="result-stats"><span><small>TIME</small><b>{result.time}秒</b></span><span><small>COIN</small><b>{result.coins}</b></span><span><small>CRYSTAL</small><b>{result.crystals}/5</b></span><span><small>FALL</small><b>{result.falls}</b></span></div>{result.isBest?<p className="new-best">NEW BEST!</p>:null}<p className="dash-unlocked">空中ダッシュ解放：空中でジャンプを再入力（着地まで3回）</p><button className="result-button" onClick={onComplete}>ステージ選択へ</button></section>:null}
  </main>;
}
