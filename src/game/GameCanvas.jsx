import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { coins as coinData, feathers as featherData, platforms } from './level.js';
import { getMusicEnabled, setMusicEnabled, sfx, startMusic, stopMusic } from './audio.js';

const BEST_KEY = 'sora-floating-island-best-v1';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makePlatform(def, textures) {
  const group = new THREE.Group();
  const radius = Math.min(def.w, def.d) * 0.5;
  const sides = def.type === 'temple' || def.type === 'secret' ? 8 : 10;
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.3, def.h, sides),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.rock, roughness: 0.92, metalness: 0, flatShading: true }),
  );
  rock.position.y = -def.h * 0.5;
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.96, 0.55, sides),
    new THREE.MeshStandardMaterial({
      color: def.type === 'temple' || def.type === 'secret' ? 0xe2d8bd : 0xffffff,
      map: def.type === 'temple' || def.type === 'secret' ? textures.rock : textures.grass,
      roughness: 0.82,
      flatShading: true,
    }),
  );
  top.position.y = 0.12;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.92, 0.1, 5, sides),
    new THREE.MeshStandardMaterial({ color: def.type === 'temple' || def.type === 'secret' ? 0xe9cf79 : 0x7bce4e, roughness: 0.75 }),
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.42;
  group.add(edge);

  for (let index = 0; index < sides; index += 2) {
    const angle = (index / sides) * Math.PI * 2;
    const detail = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.34, Math.max(0.5, def.h * 0.24), 0.22),
      new THREE.MeshStandardMaterial({ color: index % 4 ? 0x77736a : 0x5c5b56, roughness: 1, flatShading: true }),
    );
    detail.position.set(Math.cos(angle) * radius * 0.78, -def.h * 0.28, Math.sin(angle) * radius * 0.78);
    detail.rotation.y = -angle;
    detail.rotation.z = (index % 3 - 1) * 0.08;
    group.add(detail);
  }

  group.position.set(def.x, def.y + def.h * 0.5, def.z);
  group.userData = { ...def, baseY: def.y + def.h * 0.5, collapsed: false, collapseAt: 0 };
  return group;
}

function makeCoin() {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.12, 7, 18),
    new THREE.MeshToonMaterial({ color: 0xffc928, emissive: 0x7a4100, emissiveIntensity: 0.35 }),
  );
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

function makeFeather() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.7);
  shape.bezierCurveTo(0.55, -0.25, 0.62, 0.45, 0.08, 0.82);
  shape.bezierCurveTo(-0.42, 0.45, -0.38, -0.18, 0, -0.7);
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshToonMaterial({ color: 0xffd23f, emissive: 0x8b4f00, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
  );
  mesh.scale.setScalar(0.9);
  return mesh;
}

function makeCloud(x, y, z, scale) {
  const group = new THREE.Group();
  const material = new THREE.MeshToonMaterial({ color: 0xffffff });
  [[0, 0, 0, 1], [1.1, 0.1, 0, 0.75], [-1.1, -0.05, 0.1, 0.7], [0.2, 0.45, 0, 0.8]].forEach(([cx, cy, cz, s]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), material);
    puff.position.set(cx, cy, cz);
    group.add(puff);
  });
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  return group;
}

function buildTemple(scene) {
  const material = new THREE.MeshToonMaterial({ color: 0xe6dfc4 });
  const gold = new THREE.MeshToonMaterial({ color: 0xe5bc54 });
  const temple = new THREE.Group();
  [-4.2, 4.2].forEach((x) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 6, 8), material);
    pillar.position.set(x, 15.6, -108);
    pillar.castShadow = true;
    temple.add(pillar);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1.2), material);
  lintel.position.set(0, 18.5, -108);
  temple.add(lintel);
  const door = new THREE.Mesh(new THREE.BoxGeometry(6.6, 5.2, 0.7), gold);
  door.position.set(0, 14.8, -107.4);
  door.name = 'templeDoor';
  temple.add(door);
  scene.add(temple);
  return door;
}

function Joystick({ inputRef }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (event) => {
    const rect = baseRef.current.getBoundingClientRect();
    const touch = event.touches?.[0] ?? event;
    const dx = touch.clientX - (rect.left + rect.width / 2);
    const dy = touch.clientY - (rect.top + rect.height / 2);
    const max = rect.width * 0.32;
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / length);
    const x = dx * scale;
    const y = dy * scale;
    setKnob({ x, y });
    inputRef.current.x = x / max;
    inputRef.current.y = y / max;
  };
  const end = () => {
    setKnob({ x: 0, y: 0 });
    inputRef.current.x = 0;
    inputRef.current.y = 0;
  };

  return (
    <div
      ref={baseRef}
      className="joystick"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="移動スティック"
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function GameCanvas({ onReturnToTitle }) {
  const mountRef = useRef(null);
  const inputRef = useRef({ x: 0, y: 0, jump: false });
  const [hud, setHud] = useState({ hearts: 3, coins: 0, feathers: 0, wind: false, message: 'WASD / 矢印キーで移動', stage: '草原の浮島' });
  const [result, setResult] = useState(null);
  const [musicOn, setMusicOn] = useState(getMusicEnabled);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xa9e8ff, 40, 125);
    const camera = new THREE.PerspectiveCamera(54, mount.clientWidth / mount.clientHeight, 0.1, 220);
    camera.position.set(8, 9, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xe8f8ff, 0x445340, 1.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff7d6, 2.8);
    sun.position.set(-18, 30, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    scene.add(sun);

    const loader = new THREE.TextureLoader();
    const grassTexture = loader.load(assetUrl('/assets/grass-texture.png'));
    grassTexture.colorSpace = THREE.SRGBColorSpace;
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(1.6, 1.6);
    const rockTexture = loader.load(assetUrl('/assets/rock-texture.png'));
    rockTexture.colorSpace = THREE.SRGBColorSpace;
    rockTexture.wrapS = THREE.RepeatWrapping;
    rockTexture.wrapT = THREE.RepeatWrapping;
    rockTexture.repeat.set(1.2, 1.3);

    const platformMeshes = platforms.map((def) => makePlatform(def, { grass: grassTexture, rock: rockTexture }));
    platformMeshes.forEach((platform) => scene.add(platform));

    [[-22, 12, -24, 2.4], [20, 17, -55, 2.1], [-18, 19, -79, 1.8], [22, 21, -102, 2.5]].forEach((args) => scene.add(makeCloud(...args)));
    const templeDoor = buildTemple(scene);

    const soraTexture = loader.load(assetUrl('/assets/sora.png'));
    soraTexture.colorSpace = THREE.SRGBColorSpace;
    const playerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: soraTexture, transparent: true, depthWrite: false }));
    playerSprite.scale.set(3.2, 4.8, 1);
    scene.add(playerSprite);

    const enemyTexture = loader.load(assetUrl('/assets/wooden-soldier.png'));
    enemyTexture.colorSpace = THREE.SRGBColorSpace;
    const enemy = new THREE.Sprite(new THREE.SpriteMaterial({ map: enemyTexture, transparent: true, depthWrite: false }));
    enemy.position.set(10, 11.5, -55);
    enemy.scale.set(3.2, 4.8, 1);
    enemy.userData = { alive: true, charging: false, angle: 0 };
    scene.add(enemy);

    const coinMeshes = coinData.map(([x, y, z], index) => {
      const coin = makeCoin();
      coin.position.set(x, y, z);
      coin.userData = { index, collected: false, baseY: y };
      scene.add(coin);
      return coin;
    });

    const featherMeshes = featherData.map((def) => {
      const feather = makeFeather();
      feather.position.set(def.x, def.y, def.z);
      feather.userData = { ...def, collected: false, baseY: def.y };
      feather.visible = !def.hidden;
      scene.add(feather);
      return feather;
    });

    const switchMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.95, 0.18, 12),
      new THREE.MeshToonMaterial({ color: 0x48d8ff, emissive: 0x065c85, emissiveIntensity: 0.45 }),
    );
    switchMesh.position.set(7, 13.52, -96);
    scene.add(switchMesh);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshToonMaterial({ color: 0x62eaff, emissive: 0x159dff, emissiveIntensity: 1.5 }),
    );
    gem.position.set(0, 16.8, -110);
    scene.add(gem);
    const gemLight = new THREE.PointLight(0x61dfff, 8, 22);
    gem.add(gemLight);

    const player = {
      position: new THREE.Vector3(0, 1.8, 5),
      velocity: new THREE.Vector3(),
      onGround: false,
      hearts: 3,
      coins: 0,
      feathers: 0,
      checkpoint: new THREE.Vector3(0, 1.8, 5),
      invulnerableUntil: 0,
      attackUntil: 0,
      jumpHeld: false,
      complete: false,
      startTime: performance.now(),
      secretOpen: false,
    };
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('debugSpawn') === 'enemy') {
      player.position.set(7.4, 8.62, -55);
      player.checkpoint.copy(player.position);
    }
    const keys = new Set();
    const queuedStep = new THREE.Vector2();
    let jumpQueued = false;
    let cameraYaw = 0;
    let previousPosition = player.position.clone();
    let raf = 0;
    let lastHudUpdate = 0;
    let windStarted = false;
    let lastMessage = '';
    let destroyedEnemyAt = 0;
    let previousFrameTime = performance.now();
    const isTouch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;

    const updateHud = (time, message) => {
      if (time - lastHudUpdate < 120 && message === lastMessage) return;
      lastHudUpdate = time;
      lastMessage = message;
      const wind = player.position.z < -58;
      const stage = player.position.z < -89 ? '空の神殿' : wind ? '風の回廊' : player.position.z < -27 ? '天空の滝' : '草原の浮島';
      setHud({ hearts: player.hearts, coins: player.coins, feathers: player.feathers, wind, message, stage });
    };

    const loseHeart = (now) => {
      if (now < player.invulnerableUntil || player.complete) return;
      player.hearts -= 1;
      player.invulnerableUntil = now + 1800;
      sfx.hit();
      if (player.hearts <= 0) player.hearts = 3;
      player.position.copy(player.checkpoint);
      player.velocity.set(0, 0, 0);
      platformMeshes.filter((mesh) => mesh.userData.type === 'collapse').forEach((mesh) => {
        mesh.visible = true;
        mesh.userData.collapsed = false;
        mesh.userData.collapseAt = 0;
        mesh.position.y = mesh.userData.baseY;
      });
    };

    const onKeyDown = (event) => {
      if (!keys.has(event.code)) {
        if (event.code === 'KeyM') {
          const nextMusicOn = !getMusicEnabled();
          setMusicEnabled(nextMusicOn);
          setMusicOn(nextMusicOn);
        }
        if (event.code === 'KeyQ') cameraYaw -= 0.14;
        if (event.code === 'KeyE') cameraYaw += 0.14;
        if (event.code === 'KeyC') cameraYaw = 0;
        if (event.code === 'KeyW' || event.code === 'ArrowUp') queuedStep.y -= 0.38;
        if (event.code === 'KeyS' || event.code === 'ArrowDown') queuedStep.y += 0.38;
        if (event.code === 'KeyA' || event.code === 'ArrowLeft') queuedStep.x -= 0.38;
        if (event.code === 'KeyD' || event.code === 'ArrowRight') queuedStep.x += 0.38;
        if (event.code === 'Space') jumpQueued = true;
      }
      keys.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    };
    const onKeyUp = (event) => keys.delete(event.code);
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    startMusic();
    const onVisibilityChange = () => {
      if (document.hidden) stopMusic();
      else if (!player.complete) startMusic();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    function findLanding(previousY) {
      let best = null;
      let bestTop = -Infinity;
      for (const mesh of platformMeshes) {
        if (!mesh.visible) continue;
        const def = mesh.userData;
        const top = mesh.position.y + 0.42;
        const withinX = Math.abs(player.position.x - mesh.position.x) < def.w * 0.46;
        const withinZ = Math.abs(player.position.z - mesh.position.z) < def.d * 0.46;
        if (withinX && withinZ && player.velocity.y <= 0 && previousY >= top - 0.45 && player.position.y <= top + 0.38 && top > bestTop) {
          best = mesh;
          bestTop = top;
        }
      }
      return best ? { mesh: best, top: bestTop } : null;
    }

    function completeGame(now) {
      player.complete = true;
      player.velocity.set(0, 0, 0);
      templeDoor.visible = false;
      scene.fog.color.set(0xcff7ff);
      sfx.clear();
      stopMusic();
      const stats = {
        time: Math.round((now - player.startTime) / 100) / 10,
        coins: player.coins,
        feathers: player.feathers,
      };
      let best;
      try { best = JSON.parse(localStorage.getItem(BEST_KEY)); } catch { best = null; }
      const nextBest = {
        time: best?.time ? Math.min(best.time, stats.time) : stats.time,
        coins: Math.max(best?.coins ?? 0, stats.coins),
        feathers: Math.max(best?.feathers ?? 0, stats.feathers),
      };
      localStorage.setItem(BEST_KEY, JSON.stringify(nextBest));
      setResult({ ...stats, newBest: !best || stats.time <= nextBest.time || stats.coins >= nextBest.coins || stats.feathers >= nextBest.feathers });
      window.setTimeout(onReturnToTitle, 7200);
    }

    function tick(now) {
      const delta = Math.min((now - previousFrameTime) / 1000, 0.035);
      previousFrameTime = now;
      const elapsed = now * 0.001;
      previousPosition.copy(player.position);

      platformMeshes.forEach((mesh) => {
        const def = mesh.userData;
        if (def.moving) mesh.position.y = def.baseY + Math.sin(elapsed * def.moving.speed + def.moving.phase) * def.moving.amount;
        if (def.type === 'collapse' && def.collapseAt) {
          const progress = (now - def.collapseAt) / 1200;
          mesh.rotation.z = Math.sin(now * 0.05) * Math.min(progress, 1) * 0.035;
          if (progress > 1) {
            mesh.position.y -= delta * 16;
            if (progress > 1.7) mesh.visible = false;
          }
        }
      });

      const mobile = inputRef.current;
      let inputX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + mobile.x;
      let inputZ = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + mobile.y;
      const inputLength = Math.hypot(inputX, inputZ);
      if (inputLength > 1) { inputX /= inputLength; inputZ /= inputLength; }
      const cameraTurn = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
      cameraYaw += cameraTurn * delta * 1.8;
      cameraYaw = THREE.MathUtils.euclideanModulo(cameraYaw + Math.PI, Math.PI * 2) - Math.PI;
      const cameraCos = Math.cos(cameraYaw);
      const cameraSin = Math.sin(cameraYaw);
      const worldInputX = inputX * cameraCos + inputZ * cameraSin;
      const worldInputZ = -inputX * cameraSin + inputZ * cameraCos;
      const targetSpeed = player.complete ? 0 : 7.7;
      player.velocity.x = THREE.MathUtils.damp(player.velocity.x, worldInputX * targetSpeed, 10, delta);
      player.velocity.z = THREE.MathUtils.damp(player.velocity.z, worldInputZ * targetSpeed, 10, delta);
      if (!player.complete) {
        player.position.x += queuedStep.x * cameraCos + queuedStep.y * cameraSin;
        player.position.z += -queuedStep.x * cameraSin + queuedStep.y * cameraCos;
      }
      queuedStep.set(0, 0);

      const jumpPressed = keys.has('Space') || inputRef.current.jump || jumpQueued;
      if (jumpPressed && !player.jumpHeld && player.onGround && !player.complete) {
        player.velocity.y = 9.2;
        player.onGround = false;
        sfx.jump();
      }
      player.jumpHeld = jumpPressed;
      inputRef.current.jump = false;
      jumpQueued = false;

      const inWind = player.position.z < -58 && !player.complete;
      const gustPhase = (elapsed % 5.4);
      const gusting = inWind && gustPhase > 3.45 && gustPhase < 4.95;
      if (gusting) player.velocity.x += Math.sin(elapsed * 1.1) > 0 ? 4.2 * delta : -4.2 * delta;
      if (inWind && !windStarted) {
        windStarted = true;
        player.checkpoint.set(0, 12.3, -61);
        sfx.checkpoint();
      }

      player.velocity.y -= 21 * delta;
      player.position.addScaledVector(player.velocity, delta);
      player.position.x = clamp(player.position.x, -18, 18);
      const landing = findLanding(previousPosition.y);
      player.onGround = false;
      if (landing) {
        player.position.y = landing.top;
        player.velocity.y = Math.max(0, player.velocity.y);
        player.onGround = true;
        if (landing.mesh.userData.type === 'collapse' && !landing.mesh.userData.collapseAt) landing.mesh.userData.collapseAt = now;
      }

      if (player.position.y < -10) loseHeart(now);

      coinMeshes.forEach((coin) => {
        if (coin.userData.collected) return;
        coin.rotation.y += delta * 3.4;
        coin.position.y = coin.userData.baseY + Math.sin(elapsed * 3 + coin.userData.index) * 0.15;
        if (coin.position.distanceTo(player.position) < 1.35) {
          coin.userData.collected = true;
          coin.visible = false;
          player.coins += 1;
          sfx.coin();
        }
      });

      featherMeshes.forEach((feather) => {
        if (feather.userData.collected || !feather.visible) return;
        feather.rotation.y += delta * 2.2;
        feather.rotation.z = Math.sin(elapsed * 2.4) * 0.2;
        feather.position.y = feather.userData.baseY + Math.sin(elapsed * 2) * 0.22;
        if (feather.position.distanceTo(player.position) < 1.45) {
          feather.userData.collected = true;
          feather.visible = false;
          player.feathers += 1;
          sfx.feather();
        }
      });

      if (!player.secretOpen && player.position.distanceTo(switchMesh.position) < 1.35) {
        player.secretOpen = true;
        featherMeshes.find((feather) => feather.userData.id === 'secret').visible = true;
        switchMesh.position.y -= 0.12;
        sfx.checkpoint();
      }

      if (enemy.userData.alive) {
        const dx = player.position.x - enemy.position.x;
        const dz = player.position.z - enemy.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 7) {
          enemy.userData.charging = true;
          enemy.position.x += (dx / Math.max(distance, 0.1)) * delta * 2.1;
          enemy.position.z += (dz / Math.max(distance, 0.1)) * delta * 2.1;
        }
        if (distance < 3.1 && now > player.attackUntil) {
          player.attackUntil = now + 750;
          sfx.sword();
        }
        if (distance < 3.25 && now < player.attackUntil) {
          enemy.userData.alive = false;
          destroyedEnemyAt = now;
        } else if (distance < 1.15 && now > player.invulnerableUntil) {
          loseHeart(now);
        }
      } else if (enemy.visible) {
        const progress = (now - destroyedEnemyAt) / 650;
        enemy.material.rotation += delta * 7;
        enemy.scale.multiplyScalar(0.94);
        enemy.position.y -= delta * 2;
        if (progress > 1) enemy.visible = false;
      }

      if (!player.complete && player.position.distanceTo(gem.position) < 2.2) completeGame(now);

      gem.rotation.y += delta * 1.3;
      gem.position.y = 16.8 + Math.sin(elapsed * 2) * 0.28;
      switchMesh.rotation.y += delta * 0.8;

      playerSprite.position.set(player.position.x, player.position.y + 2.25, player.position.z);
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      playerSprite.material.rotation = Math.sin(elapsed * 12) * Math.min(speed / 35, 0.07);
      playerSprite.material.opacity = now < player.invulnerableUntil && Math.floor(now / 100) % 2 ? 0.35 : 1;
      if (now < player.attackUntil) playerSprite.scale.x = 3.55;
      else playerSprite.scale.x = 3.2;

      const desiredCamera = new THREE.Vector3(
        player.position.x + cameraSin * 12.5,
        player.position.y + 6.4,
        player.position.z + cameraCos * 12.5,
      );
      if (gusting) desiredCamera.x += Math.sin(now * 0.025) * 0.16;
      camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 3.4));
      const lookAt = new THREE.Vector3(
        player.position.x - cameraSin * 6.5,
        player.position.y + 2,
        player.position.z - cameraCos * 6.5,
      );
      camera.lookAt(lookAt);

      let message = '';
      if (player.position.z > -6) message = isTouch ? 'スティックで移動' : '移動: WASD / 矢印　攻撃: 自動　カメラ: Q / E';
      else if (player.position.z > -18) message = isTouch ? 'JUMP でジャンプ' : 'SPACE でジャンプ';
      else if (player.position.z > -28) message = '動く浮島へ飛び移ろう';
      else if (enemy.userData.alive && player.position.z < -49 && player.position.z > -60 && player.position.x > 4) message = '木の兵士に近づくと自動攻撃！';
      else if (player.position.z > -57) message = '滝の上を目指そう';
      else if (gusting) message = '強風！ 足場の中央へ';
      else if (inWind && gustPhase > 2.7) message = '草が揺れている…風が来る！';
      else if (player.position.z > -89) message = '崩れる前に走り抜けよう';
      else if (!player.secretOpen) message = 'コインの先に何かある…';
      else if (player.position.z > -104) message = '隠し扉が開いた！';
      else message = '空の宝石が呼んでいる';
      updateHud(now, message);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stopMusic();
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
      mount.removeChild(renderer.domElement);
    };
  }, [onReturnToTitle]);

  return (
    <main className={`game-shell ${hud.wind ? 'is-windy' : ''}`}>
      <div ref={mountRef} className="game-canvas" aria-label="ソラと浮島の宝石 3Dゲーム画面" />
      <div className="weather-layer" />
      <button
        className="music-button"
        type="button"
        aria-pressed={!musicOn}
        aria-keyshortcuts="M"
        aria-label={musicOn ? 'BGMを止める' : 'BGMを再生する'}
        onClick={() => {
          const next = !musicOn;
          setMusicEnabled(next);
          setMusicOn(next);
        }}
      >{musicOn ? '♪ BGM ON [M]' : '♪ BGM OFF [M]'}</button>
      <div className="keyboard-help" aria-label="PC操作">
        <span>攻撃 <b>AUTO</b></span><span><b>Q E</b> カメラ</span><span><b>C</b> 真後ろへ戻す</span>
      </div>
      <header className="hud">
        <div className="hud-hearts" aria-label={`ハート ${hud.hearts}個`}>
          {[0, 1, 2].map((index) => <span key={index} className={index < hud.hearts ? 'heart active' : 'heart'}>♥</span>)}
        </div>
        <div className="hud-stage"><span>{hud.stage}</span><b>空の宝石を目指せ</b></div>
        <div className="hud-counts"><span><i className="coin-symbol">●</i> <b>{hud.coins}</b></span><span><i className="feather-symbol">◆</i> <b>{hud.feathers}/3</b></span></div>
      </header>
      <div className="game-message">{hud.message}</div>
      {hud.wind ? <div className="wind-meter"><i /><span>WIND</span></div> : null}
      <div className="mobile-controls">
        <Joystick inputRef={inputRef} />
        <button
          className="jump-button"
          onPointerDown={() => { inputRef.current.jump = true; }}
          onPointerUp={() => { inputRef.current.jump = false; }}
          aria-label="ジャンプ"
        >JUMP</button>
      </div>
      {result ? (
        <section className="result-screen" aria-live="polite">
          <div className="result-light" />
          <p className="result-line">「やった！ 空が笑ってる！」</p>
          <h2>空の宝石を解放した！</h2>
          <div className="result-stats">
            <span><small>クリア時間</small><b>{result.time}秒</b></span>
            <span><small>コイン</small><b>{result.coins}枚</b></span>
            <span><small>金の羽根</small><b>{result.feathers}/3</b></span>
          </div>
          {result.newBest ? <p className="new-best">自己ベスト更新！</p> : null}
          <p className="returning">まもなくタイトルへ戻ります</p>
        </section>
      ) : null}
    </main>
  );
}
