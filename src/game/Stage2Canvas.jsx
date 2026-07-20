import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getMusicEnabled, setMusicEnabled, sfx, startMusic, startTitanMusic, stopMusic } from './audio.js';

const BEST_KEY = 'sora-twilight-ruins-best-v1';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const PLATFORM_DEFS = [
  ['start', 0, 1, 5, 14, 16, 'round'], ['approach', 0, 2, -9, 8, 14],
  ['stairs', 0, 3, -21, 8, 10], ['causeway', 0, 4, -34, 9, 20],
  ['side', 8, 4.5, -35, 6, 6, 'round'], ['yard', 0, 6, -51, 16, 14],
  ['hidden', 8, 6.5, -54, 5, 7], ['upper', 0, 8, -65, 8, 14],
  ['gate', 0, 10, -78, 14, 11], ['arena', 0, 11, -96, 23, 23, 'round'],
].map(([id, x, y, z, w, d, shape = 'box']) => ({ id, x, y, z, w, d, shape }));
const COINS = [[0,-3],[0,-9],[0,-16],[0,-22],[0,-29],[-2,-35],[2,-40],[-4,-47],[0,-51],[4,-52],[0,-59],[0,-65],[0,-72],[-3,-78],[3,-81],[0,-89]];

const topAt = (x, z) => {
  let found = null;
  for (const p of PLATFORM_DEFS) {
    const inside = p.shape === 'round'
      ? Math.hypot((x - p.x) / (p.w / 2), (z - p.z) / (p.d / 2)) <= 1
      : Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2;
    if (inside && (!found || p.y > found.y)) found = p;
  }
  return found?.y ?? null;
};

function makePlayer(texture) {
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .08 }));
  sprite.scale.set(2.35, 3.2, 1); sprite.position.y = 1.55; group.add(sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 24), new THREE.MeshBasicMaterial({ color: 0x20132e, transparent: true, opacity: .28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; group.add(shadow);
  group.userData.sprite = sprite; return group;
}

function addPlatform(scene, p, stone, gold) {
  const group = new THREE.Group();
  const geometry = p.shape === 'round' ? new THREE.CylinderGeometry(p.w / 2, p.w * .38, 2.8, 40) : new THREE.BoxGeometry(p.w, 2.8, p.d);
  const base = new THREE.Mesh(geometry, stone); base.position.y = p.y - 1.4; base.castShadow = base.receiveShadow = true; group.add(base);
  const rim = p.shape === 'round'
    ? new THREE.Mesh(new THREE.TorusGeometry(p.w / 2 - .22, .15, 8, 48), gold)
    : new THREE.Mesh(new THREE.BoxGeometry(p.w + .14, .18, p.d + .14), gold);
  rim.rotation.x = p.shape === 'round' ? Math.PI / 2 : 0; rim.position.y = p.y + .04; group.add(rim);
  const top = p.shape === 'round'
    ? new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2 - .28, p.w / 2 - .28, .2, 40), stone)
    : new THREE.Mesh(new THREE.BoxGeometry(p.w - .25, .2, p.d - .25), stone);
  top.position.y = p.y + .12; top.receiveShadow = true; group.add(top);
  group.position.set(p.x, 0, p.z); scene.add(group);
}

function makeCoin(x, z, gold) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(.28, .11, 8, 20), gold);
  mesh.position.set(x, (topAt(x, z) ?? 1) + 1.25, z); mesh.rotation.y = Math.PI / 2; mesh.userData.collected = false; return mesh;
}

function makeFeather(x, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe86a, emissive: 0xaa6200, emissiveIntensity: .8 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.15, 8), mat); stem.rotation.z = -.35; group.add(stem);
  for (let i = 0; i < 5; i += 1) {
    const barb = new THREE.Mesh(new THREE.ConeGeometry(.16, .48, 8), mat); barb.scale.x = .35; barb.position.set((i % 2 ? .14 : -.14), .33 - i * .17, 0); barb.rotation.z = i % 2 ? -.8 : .8; group.add(barb);
  }
  group.position.set(x, (topAt(x, z) ?? 1) + 1.45, z); group.userData.collected = false; return group;
}

function makeCheckpoint(x, z) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xeee7d4, roughness: .65 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x66efff, emissive: 0x11aadd, emissiveIntensity: 2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, .5, 8), stone); group.add(base);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.28, 1.2, 12), cyan); flame.position.y = .9; flame.userData.flame = true; group.add(flame);
  const light = new THREE.PointLight(0x44ddff, 3, 7); light.position.y = 1.2; group.add(light);
  group.position.set(x, (topAt(x, z) ?? 1) + .25, z); group.userData.active = false; return group;
}

function makeEnemy(type, x, z) {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: type === 'sand' ? 0xd7a74e : 0xe8dfc9, roughness: .8 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x71efff, emissive: 0x13b8e8, emissiveIntensity: 2 });
  if (type === 'sand') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(.75, 2.1, 10), white); body.position.y = 1.1; group.add(body);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.45, .85), white); body.position.y = 1.05; group.add(body);
    [-.65,.65].forEach((dx) => { const arm = new THREE.Mesh(new THREE.BoxGeometry(.45, 1.05, .45), white); arm.position.set(dx, 1.05, 0); group.add(arm); });
  }
  [-.22,.22].forEach((dx) => { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 8), eye); e.position.set(dx, 1.38, .48); group.add(e); });
  group.position.set(x, (topAt(x, z) ?? 1) + .1, z); group.userData = { alive: true, type, originX: x }; return group;
}

function makeTitan() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xece3cf, roughness: .68, transparent: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a72e, metalness: .55, roughness: .3, transparent: true });
  const gem = new THREE.MeshStandardMaterial({ color: 0xffd65b, emissive: 0x6d2b00, emissiveIntensity: .4, transparent: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.1, 2.5), white); body.position.y = 4.6; group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.25, 2.1), white); head.position.y = 8.15; group.add(head);
  [-2.65,2.65].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 10), white); shoulder.scale.y=.72; shoulder.position.set(x,6.1,0); group.add(shoulder);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.72,.9,5.2,10), white); arm.position.set(x,3.65,0); group.add(arm);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.78,.12,7,20),gold); band.rotation.x=Math.PI/2; band.position.set(x,3.3,0); group.add(band);
  });
  [-1.25,1.25].forEach((x) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 1.7), white); leg.position.set(x, 1.7, 0); group.add(leg); });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.5, 5), gold); crown.position.y = 9.85; group.add(crown);
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.45,.3,2.18),new THREE.MeshStandardMaterial({color:0x18213d,emissive:0x12395a,emissiveIntensity:1})); face.position.set(0,8.28,.03); group.add(face);
  [-.42,.42].forEach((x)=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),gem);eye.position.set(x,8.3,1.12);group.add(eye);});
  const chestFrame = new THREE.Mesh(new THREE.TorusGeometry(1.25,.18,8,28), gold); chestFrame.position.set(0,5.15,1.28); group.add(chestFrame);
  const chest = new THREE.Mesh(new THREE.OctahedronGeometry(.78), gem); chest.position.set(0, 5.15, 1.4); chest.userData.chest = true; group.add(chest);
  group.position.set(0, 11, -102); group.userData = { health: 3, waves: 0, weakUntil: 0, nextSlam: 0, noDamage: true, defeatedAt: 0, chest, materials: [white, gold, gem] }; return group;
}

function saveBest(result) {
  let old = null; try { old = JSON.parse(localStorage.getItem(BEST_KEY)); } catch { /* ignore */ }
  const record = old ? { time: Math.min(old.time ?? 9999, result.time), coins: Math.max(old.coins ?? 0, result.coins), feathers: Math.max(old.feathers ?? 0, result.feathers) } : result;
  localStorage.setItem(BEST_KEY, JSON.stringify(record));
  return !old || result.time < (old.time ?? 9999);
}

export default function Stage2Canvas({ onComplete, onExit }) {
  const mountRef = useRef(null);
  const [musicOn, setMusicOn] = useState(getMusicEnabled());
  const [hud, setHud] = useState({ hearts: 3, coins: 0, feathers: 0, message: '夕焼けの遺跡を進もう', checkpoint: 0, warning: false, boss: false, bossHealth: 3, weak: false });
  const [result, setResult] = useState(null);
  const jumpRef = useRef(false);
  const moveRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef(null);

  const moveJoystick = (event) => {
    const pad = event.currentTarget;
    if (event.type === 'pointerdown') pad.setPointerCapture(event.pointerId);
    const rect = pad.getBoundingClientRect();
    const x = THREE.MathUtils.clamp((event.clientX - rect.left - rect.width / 2) / (rect.width * .36), -1, 1);
    const y = THREE.MathUtils.clamp((event.clientY - rect.top - rect.height / 2) / (rect.height * .36), -1, 1);
    moveRef.current = { x, y };
    if (knobRef.current) knobRef.current.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  };
  const releaseJoystick = () => {
    moveRef.current = { x: 0, y: 0 };
    if (knobRef.current) knobRef.current.style.transform = '';
  };

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x59305f, .012);
    const camera = new THREE.PerspectiveCamera(54, mount.clientWidth / mount.clientHeight, .1, 240);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(mount.clientWidth, mount.clientHeight); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffd29b, 0x211449, 2.3));
    const sun = new THREE.DirectionalLight(0xffbe72, 4); sun.position.set(-12, 28, 15); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const moon = new THREE.DirectionalLight(0x789cff, 1.8); moon.position.set(16, 18, -40); scene.add(moon);
    const stone = new THREE.MeshStandardMaterial({ color: 0xeee5d2, roughness: .76, metalness: .02 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd6a32c, emissive: 0x4b2200, emissiveIntensity: .24, roughness: .32, metalness: .58 });
    PLATFORM_DEFS.forEach((p) => addPlatform(scene, p, stone, gold));

    const columns = [[-5,-49],[5,-49],[-5,-54],[5,-54],[-5,-75],[5,-75]];
    columns.forEach(([x,z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.55,.72,5.5,12), stone); c.position.set(x,(topAt(x,z) ?? 6)+2.75,z); c.rotation.z = (x+z)%3*.03; scene.add(c); });
    const statue = new THREE.Group();
    const statueBody = new THREE.Mesh(new THREE.BoxGeometry(3.2,5.8,2.1), stone); statueBody.position.y=3; statue.add(statueBody);
    const statueHead = new THREE.Mesh(new THREE.BoxGeometry(2.2,2.1,2), stone); statueHead.position.y=6.4; statue.add(statueHead); statue.position.set(5.2,6.2,-53); statue.rotation.y=-.2; scene.add(statue);

    const texture = new THREE.TextureLoader().load(assetUrl('assets/sora.png')); texture.colorSpace = THREE.SRGBColorSpace;
    const player = makePlayer(texture); player.position.set(0, 2.05, 8); scene.add(player);
    const coinMeshes = COINS.map(([x,z]) => { const c=makeCoin(x,z,gold); scene.add(c); return c; });
    const featherMeshes = [makeFeather(8,-35), makeFeather(8,-55)]; featherMeshes.forEach((f) => scene.add(f));
    const checkpoints = [makeCheckpoint(0,-43), makeCheckpoint(0,-79)]; checkpoints.forEach((c) => scene.add(c));
    const enemies = [makeEnemy('sand',3,-49), makeEnemy('golem',-2,-66)]; enemies.forEach((e)=>scene.add(e));
    const titan = makeTitan(); scene.add(titan);
    const waves=[]; const particles=[];
    const keys = new Set(); const velocity = new THREE.Vector3();
    let yaw=0, grounded=false, checkpoint={x:0,y:2.05,z:8}, invulnerableUntil=0, attackUntil=0, last=performance.now(), startAt=last, animation, boulder=null, warningAt=0, nextBoulder=last+4500, bouldersPassed=0, completed=false, bossStarted=false, lastHud='';
    const stats={coins:0,feathers:0};
    const debug = import.meta.env.DEV ? new URLSearchParams(location.search).get('stage2Debug') : null;
    if (debug === 'boulder') { player.position.set(0,5.05,-23); checkpoint={x:0,y:5.05,z:-23}; nextBoulder=last+800; }
    if (debug === 'boss' || debug === 'clear') {
      player.position.set(0,12.05,debug==='clear'?-95:-88); checkpoint={x:0,y:12.05,z:-82};
      if(debug==='clear'){titan.userData.health=1;titan.userData.weakUntil=last+2500;}
    }

    const updateHud = (patch={}) => setHud((h) => ({...h,...patch}));
    const say = (message) => updateHud({message});
    const loseHeart = (cause='ダメージを受けた！') => {
      const now=performance.now(); if(now<invulnerableUntil || completed) return; invulnerableUntil=now+1600; sfx.hit(); if (bossStarted) titan.userData.noDamage=false;
      setHud((h)=>{ const hearts=h.hearts-1; if(hearts<=0){ player.position.set(checkpoint.x,checkpoint.y,checkpoint.z); velocity.set(0,0,0); return {...h,hearts:3,message:'チェックポイントから再開'}; } return {...h,hearts,message:cause}; });
    };
    const spawnBoulder=()=>{ const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1.55,2),new THREE.MeshStandardMaterial({color:0xb8a98e,roughness:.92})); mesh.position.set(0,(topAt(0,player.position.z-15)??4)+1.6,player.position.z-15); mesh.castShadow=true; scene.add(mesh); boulder={mesh}; updateHud({warning:false,message:'ジャンプ！ 大岩を飛び越えろ'}); };
    const spawnWave=(now)=>{ const mesh=new THREE.Mesh(new THREE.TorusGeometry(1,.12,8,64),new THREE.MeshStandardMaterial({color:0xffd653,emissive:0xff7b11,emissiveIntensity:2,transparent:true,opacity:.9})); mesh.rotation.x=Math.PI/2; mesh.position.set(0,11.35,-96); scene.add(mesh); waves.push({mesh,start:now,hit:false}); say('地面の光をジャンプで越えろ！'); };
    const finish=()=>{ if(completed)return; completed=true; stopMusic(); sfx.clear(); let feathers=stats.feathers; if(titan.userData.noDamage) feathers=Math.min(3,feathers+1); const data={time:Math.round((performance.now()-startAt)/100)/10,coins:stats.coins,feathers}; const isBest=saveBest(data); setResult({...data,isBest,noDamage:titan.userData.noDamage}); };
    const onKeyDown=(e)=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault(); keys.add(e.code); if(e.code==='Space')jumpRef.current=true; if(e.code==='KeyQ')yaw-=.2; if(e.code==='KeyE')yaw+=.2; if(e.code==='KeyC')yaw=0; if(e.code==='KeyM'){const v=!getMusicEnabled();setMusicEnabled(v);setMusicOn(v);if(v&&bossStarted)startTitanMusic();} if(e.code==='Escape')onExit(); };
    const onKeyUp=(e)=>keys.delete(e.code); window.addEventListener('keydown',onKeyDown,{passive:false}); window.addEventListener('keyup',onKeyUp);
    startMusic();

    const frame=(now)=>{
      const dt=Math.min((now-last)/1000,.04); last=now;
      const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-moveRef.current.y;
      const side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveRef.current.x;
      const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw); let mx=fx*forward+rx*side,mz=fz*forward+rz*side; const ml=Math.hypot(mx,mz)||1; mx/=ml;mz/=ml;
      velocity.x=THREE.MathUtils.damp(velocity.x,mx*7.4,11,dt); velocity.z=THREE.MathUtils.damp(velocity.z,mz*7.4,11,dt); velocity.y-=21*dt;
      if(jumpRef.current&&grounded){velocity.y=9.3;grounded=false;sfx.jump();} jumpRef.current=false;
      player.position.addScaledVector(velocity,dt); const top=topAt(player.position.x,player.position.z); grounded=false;
      if(top!==null&&player.position.y<=top+1.08&&player.position.y>=top-.6&&velocity.y<=0){player.position.y=top+1.05;velocity.y=0;grounded=true;}
      if(player.position.y<-8){player.position.set(checkpoint.x,checkpoint.y,checkpoint.z);velocity.set(0,0,0);loseHeart('足場から落ちた！');}
      player.userData.sprite.material.opacity=now<invulnerableUntil&&Math.floor(now/100)%2? .25:1; player.userData.sprite.position.y=1.55+Math.sin(now*.012)*.035;
      if(Math.hypot(mx,mz)>.1) player.userData.sprite.material.rotation=THREE.MathUtils.damp(player.userData.sprite.material.rotation,-side*.12,8,dt);
      coinMeshes.forEach((c)=>{if(c.userData.collected)return;c.rotation.z+=dt*3;c.position.y+=Math.sin(now*.004+c.position.z)*.002;if(c.position.distanceTo(player.position)<1.25){c.userData.collected=true;c.visible=false;stats.coins++;sfx.coin();setHud(h=>({...h,coins:stats.coins}));}});
      featherMeshes.forEach((f)=>{if(f.userData.collected)return;f.rotation.y+=dt*1.8;if(f.position.distanceTo(player.position)<1.45){f.userData.collected=true;f.visible=false;stats.feathers++;sfx.feather();setHud(h=>({...h,feathers:stats.feathers,message:'黄金の羽根を見つけた！'}));}});
      checkpoints.forEach((c,i)=>{const flame=c.children.find(o=>o.userData.flame);if(flame)flame.scale.y=.8+Math.sin(now*.01)*.18;if(!c.userData.active&&c.position.distanceTo(player.position)<1.8){c.userData.active=true;checkpoint={x:c.position.x,y:(topAt(c.position.x,c.position.z)??1)+1.05,z:c.position.z};sfx.checkpoint();if(i===1)setHud(h=>({...h,hearts:3,checkpoint:2,message:'巨像の門：体力が回復した'}));else updateHud({checkpoint:1,message:'青い炎の祭壇を灯した'});}});
      enemies.forEach((e,idx)=>{if(!e.userData.alive)return;e.position.x=e.userData.originX+Math.sin(now*.0015+idx)*1.1;e.rotation.y=Math.atan2(player.position.x-e.position.x,player.position.z-e.position.z);const d=e.position.distanceTo(player.position);if(d<3&&now>attackUntil){attackUntil=now+650;sfx.sword();e.userData.alive=false;e.scale.set(.01,.01,.01);say(`${e.userData.type==='sand'?'砂の精霊':'小さな石像'}を自動攻撃で倒した！`);}else if(d<1.25)loseHeart();});
      const inBoulderZone=player.position.z<-16&&player.position.z>-70;
      if(inBoulderZone&&!boulder&&now>nextBoulder&&!warningAt){warningAt=now;updateHud({warning:true,message:'ゴゴゴ… 大岩が来る！'});}
      if(warningAt&&now-warningAt>1500){warningAt=0;spawnBoulder();}
      if(boulder){const m=boulder.mesh;m.position.z+=8.3*dt;m.rotation.x+=dt*5;const dx=Math.abs(m.position.x-player.position.x),dz=Math.abs(m.position.z-player.position.z);if(dx<1.5&&dz<1.55&&player.position.y<m.position.y+1.15)loseHeart('大岩にぶつかった！');if(m.position.z>player.position.z+12||m.position.z>8){scene.remove(m);m.geometry.dispose();boulder=null;bouldersPassed++;nextBoulder=now+(bouldersPassed%2?4000:6000);say('大岩を飛び越えた！');}}
      const bossActive=player.position.z<-86&&!titan.userData.defeatedAt;
      if(bossActive&&!bossStarted){bossStarted=true;updateHud({boss:true,message:'黄昏の巨像タイタン'});startTitanMusic();titan.userData.nextSlam=now+1800;}
      if(bossActive&&now>titan.userData.nextSlam&&!titan.userData.weakUntil){spawnWave(now);const interval=[1900,2300,2800][Math.max(0,titan.userData.health-1)];titan.userData.nextSlam=now+interval;}
      waves.forEach((w)=>{const age=(now-w.start)/1000,r=age*5.6;w.mesh.scale.setScalar(r);w.mesh.material.opacity=Math.max(0,1-age/2.2);const pd=Math.hypot(player.position.x,player.position.z+96);if(!w.hit&&Math.abs(pd-r)<.7&&player.position.y<12.4){w.hit=true;loseHeart('衝撃波を受けた！');}if(age>2.2){scene.remove(w.mesh);w.mesh.geometry.dispose();w.dead=true;titan.userData.waves++;if(titan.userData.waves>=3){titan.userData.waves=0;titan.userData.weakUntil=now+5000;titan.userData.chest.material.emissiveIntensity=3;updateHud({weak:true,message:'胸の核が開いた！ 近づけ！'});}}});
      for(let i=waves.length-1;i>=0;i--)if(waves[i].dead)waves.splice(i,1);
      if(titan.userData.weakUntil&&now>titan.userData.weakUntil){titan.userData.weakUntil=0;titan.userData.chest.material.emissiveIntensity=.4;updateHud({weak:false,message:'核が閉じた…衝撃波を3回越えよう'});titan.userData.nextSlam=now+600;}
      if(titan.userData.weakUntil&&player.position.distanceTo(titan.position)<8.2&&now>attackUntil){attackUntil=now+900;sfx.sword();titan.userData.health--;titan.userData.weakUntil=0;titan.userData.chest.material.emissiveIntensity=.4;updateHud({bossHealth:titan.userData.health,weak:false,message:'タイタンの核に一撃！'});if(titan.userData.health<=0){titan.userData.defeatedAt=now;for(let i=0;i<70;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.08,5,5),gold);p.position.copy(titan.position).add(new THREE.Vector3((Math.random()-.5)*5,Math.random()*9,(Math.random()-.5)*3));p.userData.v=new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3);scene.add(p);particles.push(p);}say('タイタンが黄金の光に還っていく…');}else titan.userData.nextSlam=now+900;}
      if(titan.userData.defeatedAt){const age=(now-titan.userData.defeatedAt)/1000;titan.scale.setScalar(Math.max(.01,1-age*.45));titan.userData.materials.forEach(m=>m.opacity=Math.max(0,1-age*.55));particles.forEach(p=>{p.position.addScaledVector(p.userData.v,dt);p.userData.v.y-=dt*.8;p.material.opacity=Math.max(0,1-age*.3);});if(age>2.1)finish();}
      const target=new THREE.Vector3(player.position.x+Math.sin(yaw)*9.5,player.position.y+4.6,player.position.z+Math.cos(yaw)*9.5);camera.position.lerp(target,.075);if(bossStarted)camera.lookAt(0,15.5,-101);else camera.lookAt(player.position.x-Math.sin(yaw)*4.2,player.position.y+1.2,player.position.z-Math.cos(yaw)*4.2);
      const messageKey=`${Math.round(player.position.z/8)}-${bossStarted}`;if(messageKey!==lastHud){lastHud=messageKey;if(player.position.z<-52&&player.position.z>-60)say('巨像の裏側に何かある… Q / Eで見回そう');}
      renderer.render(scene,camera);animation=requestAnimationFrame(frame);
    };
    animation=requestAnimationFrame(frame);
    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);}; window.addEventListener('resize',resize);
    return()=>{cancelAnimationFrame(animation);stopMusic();window.removeEventListener('resize',resize);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);renderer.dispose();texture.dispose();mount.removeChild(renderer.domElement);};
  }, [onExit]);

  return <main className={`game-shell stage2-shell ${hud.warning?'is-boulder-warning':''}`}>
    <div className="stage2-tint"/><div className="game-canvas" ref={mountRef}/>
    <div className="hud"><div className="hud-hearts">{[1,2,3].map(n=><span className={`heart ${n<=hud.hearts?'active':''}`} key={n}>♥</span>)}</div><div className="hud-stage"><span>STAGE 2</span><b>夕焼けの古代遺跡</b></div><div className="hud-counts"><span><i className="coin-symbol">●</i> {hud.coins}</span><span><i className="feather-symbol">◆</i> {hud.feathers}/3</span></div></div>
    <div className="keyboard-help"><span><b>WASD / 矢印</b> 移動</span><span><b>SPACE</b> ジャンプ</span><span><b>Q / E</b> カメラ</span><span><b>C</b> 正面</span><span>攻撃は自動</span></div>
    <button className="music-button" onClick={()=>{const v=!musicOn;setMusicOn(v);setMusicEnabled(v);if(v&&hud.boss)startTitanMusic();}}>BGM {musicOn?'ON':'OFF'} <small>(M)</small></button>
    {hud.boss?<div className="boss-hud"><span>黄昏の巨像タイタン</span><div>{[0,1,2].map(i=><i className={i<hud.bossHealth?'alive':''} key={i}/>)}</div>{hud.weak?<b>WEAK POINT OPEN</b>:null}</div>:null}
    {hud.warning?<div className="boulder-warning">⚠ 大岩接近</div>:null}<div className="game-message">{hud.message}</div>
    <div className="mobile-controls"><div className="joystick" onPointerDown={moveJoystick} onPointerMove={(e)=>{if(e.buttons)moveJoystick(e)}} onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick}><div className="joystick-knob" ref={knobRef}/></div><button className="jump-button" onPointerDown={()=>{jumpRef.current=true}}>JUMP</button></div>
    {result?<section className="result-screen stage2-result"><p className="result-line">「この光が、次の空へ導いてくれる！」</p><h2>夕日の宝石を解放した！</h2><div className="sunset-gem">◆</div><div className="result-stats"><span><small>TIME</small><b>{result.time}秒</b></span><span><small>COIN</small><b>{result.coins}</b></span><span><small>FEATHER</small><b>{result.feathers}/3</b></span></div>{result.noDamage?<p className="new-best">NO DAMAGE 羽根を獲得！</p>:result.isBest?<p className="new-best">NEW BEST!</p>:null}<p>新たな道が開いた</p><button className="result-button" onClick={onComplete}>ステージ選択へ</button></section>:null}
  </main>;
}
