/* ============================================
   SHERWOOD LEGEND — Robin Hood Forest Survival
   3D Top-Down Survival with full animations
   ============================================ */

(() => {
'use strict';

// ============================================
// CONFIG
// ============================================
const CONFIG = {
    ARENA_SIZE: 80,
    PLAYER_SPEED: 0.22,
    PLAYER_MAX_HP: 100,
    PLAYER_RADIUS: 1.2,
    ENEMY_MAX_COUNT: 48,
    PICKUP_RANGE: 3.0,      // reduced — player must walk closer to collect XP
    PICKUP_COLLECT: 1.8,    // auto-collect distance (must be very close)
    LEVEL_GAP: 5,
    BOSS_INTERVAL: 240,     // boss spawns every 4 minutes
    STAGE_DURATION: 25,     // seconds per stage (slower pace)
    MAP_DURATION: 720,      // 12 minutes = victory
    CHEST_STAGES: [8, 20],  // chest spawns at these stages
    BOSS_STAGES: [12, 24],  // boss spawns at these stages (5 min & 10 min)
    CHEST_SPAWN_NEAR: 10,  // chest drops very close to player
};

// ============================================
// GAME STATE
// ============================================
const Game = {
    scene: null, camera: null, renderer: null, clock: null,
    running: false, paused: false, isTouch: false,
    elapsed: 0, killCount: 0, currentStage: 0,
    player: null, enemies: [], projectiles: [], pickups: [],
    particles: [], obstacles: [], trees: [],
    enemySpawnTimer: 0, bossTimer: 0, nextBossTime: 240,
    bossActive: false, bossCount: 0, bossStagesSpawned: [],
    chest: null,          // active chest object
    chestStagesSpawned: [],  // track which chest stages already spawned
    chestNavArrow: null,  // DOM element for navigation arrow
    keys: {},
    joystick: { active: false, dx: 0, dy: 0 },
    windPhase: 0,
    damageScale: 1.0,  // enemy damage multiplier, +2% per 2 min, max 1.10
    lastDamageScaleTime: 0,
};

// ============================================
// WEAPONS POOL — Robin Hood themed
// ============================================
const WEAPONS = {
    longbow: {
        id: 'longbow', name: 'Longbow', type: 'weapon', icon: '🏹',
        desc: 'Robin Hood\'s trusted bow. Single piercing arrow.',
        damage: 34, cooldown: 1.3, range: 15, projectileSpeed: 0.7,
        projectileCount: 1, spread: 0, pierce: true, color: 0xd4af37, level: 1
    },
    crossbow: {
        id: 'crossbow', name: 'Crossbow', type: 'weapon', icon: '🎯',
        desc: 'Rapid-fire bolts. Low damage, high speed.',
        damage: 16, cooldown: 0.55, range: 13, projectileSpeed: 0.85,
        projectileCount: 1, spread: 0.04, color: 0xc4a040, level: 1
    },
    daggers: {
        id: 'daggers', name: 'Throwing Daggers', type: 'weapon', icon: '🗡️',
        desc: 'Hurls 3 daggers in a spread.',
        damage: 22, cooldown: 1.1, range: 10, projectileSpeed: 0.6,
        projectileCount: 3, spread: 0.35, color: 0xddeeff, level: 1
    },
    sling: {
        id: 'sling', name: 'Sling Stones', type: 'weapon', icon: '🪨',
        desc: 'Short-range stone spray. Smooth river stones.',
        damage: 13, cooldown: 0.4, range: 9, projectileSpeed: 0.45,
        projectileCount: 2, spread: 0.4, color: 0xb0b0a0, level: 1
    },
    axes: {
        id: 'axes', name: 'Spinning Axes', type: 'weapon', icon: '🪓',
        desc: 'Axes orbit you, slicing nearby foes.',
        damage: 18, cooldown: 0, range: 6.5, orbit: true,
        orbitCount: 2, color: 0xc0703a, level: 1
    },
    firearrows: {
        id: 'firearrows', name: 'Fire Arrows', type: 'weapon', icon: '🔥',
        desc: 'Explosive arrows that burst on impact.',
        damage: 48, cooldown: 2.0, range: 17, projectileSpeed: 0.5,
        projectileCount: 1, spread: 0, explosive: true, color: 0xff6600, level: 1
    },
};

// ============================================
// ABILITIES POOL — Robin Hood themed
// ============================================
const ABILITIES = {
    speed: { id: 'speed', name: 'Merry Men\'s Swiftness', type: 'ability', icon: '👟',
        desc: '+15% movement speed', apply: (p) => { p.speed *= 1.15; } },
    maxhp: { id: 'maxhp', name: 'Forest Vigor', type: 'ability', icon: '❤️',
        desc: '+25 max HP and full heal', apply: (p) => { p.maxHp += 25; p.hp = p.maxHp; } },
    damage: { id: 'damage', name: 'Sharpshooter', type: 'ability', icon: '💪',
        desc: '+18% weapon damage', apply: (p) => { p.damageMult *= 1.18; } },
    attackspeed: { id: 'attackspeed', name: 'Quick Draw', type: 'ability', icon: '⏱️',
        desc: '-12% attack cooldown', apply: (p) => { p.cooldownMult *= 0.88; } },
    pickup: { id: 'pickup', name: 'Arrow Retrieval', type: 'ability', icon: '🧲',
        desc: '+70% pickup range', apply: (p) => { p.pickupRange *= 1.7; } },
    regen: { id: 'regen', name: 'Nature\'s Blessing', type: 'ability', icon: '💚',
        desc: 'Recover 1.5 HP per second', apply: (p) => { p.regen += 1.5; } },
    multishot: { id: 'multishot', name: 'Arrow Volley', type: 'ability', icon: '🏹',
        desc: '+1 projectile to all weapons (once only)', maxStacks: 1, apply: (p) => { p.bonusProjectiles += 1; } },
    thorns: { id: 'thorns', name: 'Bramble Aura', type: 'ability', icon: '🌿',
        desc: 'Reflect 20% damage to attackers', apply: (p) => { p.thorns += 0.20; } },
    lifesteal: { id: 'lifesteal', name: 'Cursed Arrow', type: 'ability', icon: '🩸',
        desc: 'Heal 7% of damage dealt', apply: (p) => { p.lifesteal += 0.07; } },
    xpboost: { id: 'xpboost', name: 'Legendary Outlaw', type: 'ability', icon: '⭐',
        desc: '+20% XP from kills', apply: (p) => { p.xpMult *= 1.20; } },
};

// ============================================
// INIT SCENE
// ============================================
function initScene() {
    Game.scene = new THREE.Scene();
    Game.scene.background = new THREE.Color(0x2a3a1a);
    Game.scene.fog = new THREE.FogExp2(0x223318, 0.011);

    const aspect = window.innerWidth / window.innerHeight;
    Game.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 300);
    Game.camera.position.set(0, 38, 26);
    Game.camera.lookAt(0, 0, 0);

    Game.renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'), antialias: true,
    });
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Game.renderer.shadowMap.enabled = true;
    Game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    Game.clock = new THREE.Clock();
    setupLights();
    buildForest();
}

// ============================================
// LIGHTING — warm forest daylight
// ============================================
function setupLights() {
    const ambient = new THREE.AmbientLight(0x668855, 0.45);
    Game.scene.add(ambient);

    // Sun through canopy — softer, golden hour
    const sun = new THREE.DirectionalLight(0xffeebb, 0.65);
    sun.position.set(30, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 130;
    Game.scene.add(sun);

    // Dim cool fill from below
    const fill = new THREE.HemisphereLight(0x556644, 0x1a1208, 0.3);
    Game.scene.add(fill);
}

// ============================================
// BUILD SHERWOOD FOREST
// ============================================
function buildForest() {
    const half = CONFIG.ARENA_SIZE;

    // Grass ground
    const groundGeo = new THREE.PlaneGeometry(half * 2, half * 2, 64, 64);
    // Smooth terrain bumps with multiple noise layers
    const gpos = groundGeo.attributes.position;
    for (let i = 0; i < gpos.count; i++) {
        const x = gpos.getX(i), y = gpos.getY(i);
        gpos.setZ(i, Math.sin(x * 0.08) * 0.35 + Math.cos(y * 0.06) * 0.45 + Math.sin(x * 0.2 + y * 0.15) * 0.15);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo,
        new THREE.MeshStandardMaterial({ color: 0x3a5a25, roughness: 0.9, metalness: 0, flatShading: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    Game.scene.add(ground);

    // Dirt path patches
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const path = new THREE.Mesh(
            new THREE.PlaneGeometry(6, half * 1.5),
            new THREE.MeshStandardMaterial({ color: 0x5a4220, roughness: 1, flatShading: true })
        );
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = a;
        path.position.y = 0.06;
        path.receiveShadow = true;
        Game.scene.add(path);
    }

    // Dense tree wall boundary
    const wallCount = 70;
    for (let i = 0; i < wallCount; i++) {
        const a = (i / wallCount) * Math.PI * 2;
        const r = half - 1 + Math.random() * 3;
        makeTree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + Math.random() * 0.3, true);
    }

    // Scattered forest trees, bushes, rocks, logs
    for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 12 + Math.random() * (half - 18);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const pick = Math.random();
        if (pick < 0.5) {
            makeTree(x, z, 0.8 + Math.random() * 0.6, false);
        } else if (pick < 0.7) {
            makeBush(x, z);
        } else if (pick < 0.85) {
            makeRock(x, z);
        } else {
            makeLog(x, z);
        }
    }

    // A few flowers / detail
    for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * (half - 8);
        makeFlower(Math.cos(a) * r, Math.sin(a) * r);
    }
    // Grass tufts — small green patches scattered on ground
    for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * (half - 5);
        makeGrassTuft(Math.cos(a) * r, Math.sin(a) * r);
    }
}

// Oak tree with sway-able foliage
function makeTree(x, z, scale, isWall) {
    const group = new THREE.Group();
    const trunkH = 4 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, trunkH, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.95 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Foliage clusters
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a5a1a, roughness: 0.85, flatShading: false });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.8, flatShading: false });
    const foliages = [];
    for (let i = 0; i < 3; i++) {
        const fs = (2.2 + Math.random() * 1.2) * scale;
        const fol = new THREE.Mesh(new THREE.SphereGeometry(fs, 10, 8), i % 2 ? lightMat : leafMat);
        fol.position.set((Math.random() - 0.5) * 1.5, trunkH + fs * 0.6 + i * 0.8, (Math.random() - 0.5) * 1.5);
        fol.castShadow = true;
        group.add(fol);
        foliages.push(fol);
    }

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    Game.scene.add(group);

    const radius = 1.0 * scale;
    if (!isWall) {
        Game.obstacles.push({ mesh: group, radius: radius, isWall: false });
    }
    Game.trees.push({ group: group, foliages: foliages, baseRot: group.rotation.y, phase: Math.random() * Math.PI * 2, scale: scale });
    return group;
}

function makeBush(x, z) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.88, flatShading: false });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a6a1a, roughness: 0.9, flatShading: false });
    for (let i = 0; i < 5; i++) {
        const s = 0.55 + Math.random() * 0.5;
        const b = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), i % 2 ? darkMat : mat);
        b.position.set((Math.random() - 0.5) * 1.3, s * 0.45, (Math.random() - 0.5) * 1.3);
        b.castShadow = true;
        group.add(b);
    }
    group.position.set(x, 0, z);
    Game.scene.add(group);
    Game.obstacles.push({ mesh: group, radius: 1.3, isWall: false });
}

function makeRock(x, z) {
    const s = 0.8 + Math.random() * 1.2;
    // Smooth moss-covered boulder
    const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(s, 1),
        new THREE.MeshStandardMaterial({ color: 0x808078, roughness: 0.7, metalness: 0.05, flatShading: false })
    );
    rock.position.set(x, s * 0.35, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    Game.scene.add(rock);
    // Moss patch on top — small green sphere
    const moss = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.5, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.95, flatShading: false })
    );
    moss.position.set(x, s * 0.7, z);
    moss.scale.y = 0.3;
    moss.castShadow = true;
    Game.scene.add(moss);
    Game.obstacles.push({ mesh: rock, radius: s * 0.85, isWall: false });
}

function makeLog(x, z) {
    const len = 2.5 + Math.random() * 1.5;
    const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.55, len, 10),
        new THREE.MeshStandardMaterial({ color: 0x7b5433, roughness: 0.85, flatShading: false })
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = Math.random() * Math.PI;
    log.position.set(x, 0.5, z);
    log.castShadow = true;
    log.receiveShadow = true;
    Game.scene.add(log);
    // Moss patch on log
    const moss = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.95 })
    );
    moss.position.set(x, 0.8, z); moss.scale.set(1, 0.3, 0.5);
    Game.scene.add(moss);
    Game.obstacles.push({ mesh: log, radius: 0.8, isWall: false });
}

function makeFlower(x, z) {
    const colors = [0xffe040, 0xff6090, 0x8060ff, 0xff8030, 0xffee44];
    const c = colors[Math.floor(Math.random() * colors.length)];
    // Stem
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.35, 4),
        new THREE.MeshStandardMaterial({ color: 0x3a6a1a, roughness: 0.9 })
    );
    stem.position.set(x, 0.17, z); Game.scene.add(stem);
    // Petals — 5 small spheres around center
    const petalMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.15 });
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), petalMat);
        petal.position.set(x + Math.cos(a) * 0.12, 0.35, z + Math.sin(a) * 0.12);
        Game.scene.add(petal);
    }
    // Center — yellow
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.4, emissive: 0xffcc00, emissiveIntensity: 0.3 })
    );
    center.position.set(x, 0.38, z); Game.scene.add(center);
}

// Grass tuft — small cluster of green blades
function makeGrassTuft(x, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.9, flatShading: false });
    for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.3 + Math.random() * 0.2, 4),
            mat
        );
        blade.position.set(x + (Math.random() - 0.5) * 0.4, 0.15, z + (Math.random() - 0.5) * 0.4);
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        Game.scene.add(blade);
    }
}

// ============================================
// CREATE ROBIN HOOD PLAYER (animated)
// ============================================
function createPlayer() {
    const group = new THREE.Group();

    // ===== ROBIN HOOD — Minecraft-style blocky character =====
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1a, roughness: 0.8, flatShading: true });
    const darkGreenMat = new THREE.MeshStandardMaterial({ color: 0x1a4010, roughness: 0.8, flatShading: true });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85, flatShading: true });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.7, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3, flatShading: true });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9, flatShading: true });

    // Torso — blocky box
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.7), greenMat);
    torso.position.y = 1.8; torso.castShadow = true; group.add(torso);

    // Chest detail — lighter green vest patch
    const chestDetail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x3a6b22, roughness: 0.8, flatShading: true }));
    chestDetail.position.set(0, 1.8, 0.38); group.add(chestDetail);

    // Belt — leather brown band
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 0.75), leatherMat);
    belt.position.y = 1.15; group.add(belt);

    // Belt buckle — gold
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.08), goldMat);
    buckle.position.set(0, 1.15, 0.4); group.add(buckle);

    // Head — blocky box
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), skinMat);
    head.position.y = 3.05; head.castShadow = true; group.add(head);

    // Eyes — two dark blocks (Minecraft face)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), eyeMat);
    eyeL.position.set(-0.2, 3.1, 0.46); group.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.2; group.add(eyeR);

    // Hood — blocky green hat
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), darkGreenMat);
    hood.position.y = 3.65; hood.castShadow = true; group.add(hood);
    const hoodPoint = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), darkGreenMat);
    hoodPoint.position.y = 4.05; group.add(hoodPoint);

    // Feather — red, sticking from hood
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6, flatShading: true }));
    feather.position.set(0.4, 4.1, 0.15); feather.rotation.z = -0.35; group.add(feather);

    // Left arm — green sleeve, swings
    // Left arm — green sleeve box, swings
    const leftArm = new THREE.Group();
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), greenMat);
    leftArmMesh.position.y = -0.5; leftArmMesh.castShadow = true; leftArm.add(leftArmMesh);
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.42), skinMat);
    leftHand.position.y = -1.05; leftArm.add(leftHand);
    leftArm.position.set(-0.8, 2.35, 0); group.add(leftArm);

    // Right arm — holds bow, draws when attacking
    const rightArm = new THREE.Group();
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), greenMat);
    rightArmMesh.position.y = -0.5; rightArmMesh.castShadow = true; rightArm.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.42), skinMat);
    rightHand.position.y = -1.05; rightArm.add(rightHand);
    rightArm.position.set(0.8, 2.35, 0); group.add(rightArm);

    // Bow — held in right hand
    const bow = new THREE.Group();
    const bowMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6, flatShading: true });
    const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 16, Math.PI * 1.1), bowMat);
    bowArc.rotation.z = Math.PI / 2; bow.add(bowArc);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xeeeedd });
    const bowstring = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), stringMat);
    bowstring.position.x = -0.6; bow.add(bowstring);
    bow.position.set(0.55, -0.6, 0.25); bow.rotation.y = -0.3;
    rightArm.add(bow);

    // Legs — brown pants, blocky, swing for walk
    const leftLeg = new THREE.Group();
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.45), leatherMat);
    leftLegMesh.position.y = -0.5; leftLegMesh.castShadow = true; leftLeg.add(leftLegMesh);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.55), bootMat);
    leftBoot.position.y = -1.1; leftLeg.add(leftBoot);
    leftLeg.position.set(-0.32, 1.0, 0); group.add(leftLeg);

    const rightLeg = new THREE.Group();
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.45), leatherMat);
    rightLegMesh.position.y = -0.5; rightLegMesh.castShadow = true; rightLeg.add(rightLegMesh);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.55), bootMat);
    rightBoot.position.y = -1.1; rightLeg.add(rightBoot);
    rightLeg.position.set(0.32, 1.0, 0); group.add(rightLeg);

    // Cape — green, flutters (plane for cloth effect)
    const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.8, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x1a4010, roughness: 0.9, side: THREE.DoubleSide, flatShading: true })
    );
    cape.position.set(0, 2.0, -0.45); cape.castShadow = true; group.add(cape);

    // Quiver on back — brown box with arrow tips poking out
    const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), leatherMat);
    quiver.position.set(-0.4, 2.2, -0.5); group.add(quiver);
    const quivArrowMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, flatShading: true });
    for (let i = 0; i < 3; i++) {
        const qa = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), quivArrowMat);
        qa.position.set(-0.4 + (i - 1) * 0.08, 2.7, -0.5); group.add(qa);
    }

    // Shadow blob under player
    const shadowBlob = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.02; group.add(shadowBlob);

    Game.scene.add(group);

    return {
        mesh: group,
        parts: { torso, head, hood, feather, leftArm, rightArm, bow, bowstring, leftLeg, rightLeg, cape, shadowBlob },
        torsoMat: greenMat,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, 0),
        facing: 0,
        hp: CONFIG.PLAYER_MAX_HP, maxHp: CONFIG.PLAYER_MAX_HP,
        speed: CONFIG.PLAYER_SPEED,
        level: 1, xp: 0, xpToNext: 100,
        damageMult: 1.0, cooldownMult: 1.0,
        pickupRange: CONFIG.PICKUP_RANGE,
        regen: 0, thorns: 0, lifesteal: 0, xpMult: 1.0,
        bonusProjectiles: 0,
        weapons: [], abilities: [],
        regenAccum: 0, invulnTimer: 0,
        walkPhase: 0, moving: false, drawBow: 0, drawTarget: 0,
        idlePhase: 0,
    };
}

// ============================================
// ENEMY TYPES — Robin Hood fiction
// ============================================
const ENEMY_TYPES = [
    { name: 'Royal Guard',  hp: 30,  speed: 0.08, damage: 8,  color: 0x8b1a1a, size: 1.0, xp: 15, tunic: 0x8b1a1a },
    { name: 'Crossbowman',  hp: 22,  speed: 0.14, damage: 6,  color: 0x2a2a5a, size: 0.85, xp: 12, tunic: 0x2a2a5a, ranged: true },
    { name: 'Armored Knight', hp: 85, speed: 0.05, damage: 18, color: 0x6a6a7a, size: 1.5, xp: 30, tunic: 0x5a5a6a },
];

const BOSS_TYPES = [
    { name: 'The Sheriff of Nottingham', hp: 1200, speed: 0.07, damage: 28, color: 0x4a0000, size: 2.8, xp: 200, tunic: 0x6a0000, isBoss: true,
      attacks: ['spreadBolt', 'chargeSlam', 'summonCone'] },
    { name: 'Guy of Gisborne', hp: 1800, speed: 0.09, damage: 34, color: 0x1a1a1a, size: 3.0, xp: 280, tunic: 0x0a0a0a, isBoss: true,
      attacks: ['fanBlades', 'dashStrike', 'darkPulse'] },
    { name: 'Prince John\'s Champion', hp: 2600, speed: 0.06, damage: 42, color: 0x8b6914, size: 3.4, xp: 400, tunic: 0x6b4900, isBoss: true,
      attacks: ['goldenRain', 'earthquake', 'beamSweep'] },
];

// Build a humanoid enemy model — Minecraft-style blocky with flatShading
function buildEnemyModel(type) {
    const group = new THREE.Group();
    const s = type.size;

    const tunicMat = new THREE.MeshStandardMaterial({ color: type.tunic, roughness: 0.85, flatShading: true });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.7, flatShading: true });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9, flatShading: true });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.8, flatShading: true });

    // Torso — blocky box
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 1.4 * s, 0.65 * s), tunicMat);
    torso.position.y = 1.5 * s; torso.castShadow = true; group.add(torso);

    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.15 * s, 0.25 * s, 0.7 * s), beltMat);
    belt.position.y = 1.0 * s; group.add(belt);

    // Head — blocky box
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.8 * s, 0.8 * s), skinMat);
    head.position.y = 2.5 * s; head.castShadow = true; group.add(head);

    // Eyes — dark blocks (Minecraft face)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x110000 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.16 * s, 0.05 * s), eyeMat);
    eyeL.position.set(-0.18 * s, 2.55 * s, 0.41 * s); group.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.18 * s; group.add(eyeR);

    // Helmet/hat — blocky style
    if (type.isBoss || type.name === 'Armored Knight') {
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x888890, metalness: 0.6, roughness: 0.4, flatShading: true });
        const helm = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.5 * s, 0.9 * s), metalMat);
        helm.position.y = 2.85 * s; helm.castShadow = true; group.add(helm);
        // Visor slit glow for boss
        if (type.isBoss) {
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.1 * s, 0.06 * s),
                new THREE.MeshBasicMaterial({ color: 0xff3300 }));
            visor.position.set(0, 2.55 * s, 0.42 * s); group.add(visor);
            // Boss shoulder armor
            const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.5, roughness: 0.5, flatShading: true });
            const slShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.4 * s, 0.5 * s), shoulderMat);
            slShoulder.position.set(-0.7 * s, 2.0 * s, 0); group.add(slShoulder);
            const srShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.4 * s, 0.5 * s), shoulderMat);
            srShoulder.position.set(0.7 * s, 2.0 * s, 0); group.add(srShoulder);
        }
    } else if (type.name === 'Royal Guard') {
        // Red guard cap — blocky
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85 * s, 0.35 * s, 0.85 * s),
            new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.85, flatShading: true }));
        cap.position.y = 2.95 * s; group.add(cap);
    } else if (type.name === 'Crossbowman') {
        // Blue hood — blocky
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.85 * s, 0.4 * s, 0.85 * s),
            new THREE.MeshStandardMaterial({ color: 0x1a1a44, roughness: 0.85, flatShading: true }));
        hood.position.y = 2.95 * s; group.add(hood);
    }

    // Arms — blocky boxes, swing
    const leftArm = new THREE.Group();
    const laMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.85 * s, 0.36 * s), tunicMat);
    laMesh.position.y = -0.42 * s; laMesh.castShadow = true; leftArm.add(laMesh);
    const laHand = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.22 * s, 0.38 * s), skinMat);
    laHand.position.y = -0.9 * s; leftArm.add(laHand);
    leftArm.position.set(-0.68 * s, 2.05 * s, 0); group.add(leftArm);

    const rightArm = new THREE.Group();
    const raMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.85 * s, 0.36 * s), tunicMat);
    raMesh.position.y = -0.42 * s; raMesh.castShadow = true; rightArm.add(raMesh);
    const raHand = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.22 * s, 0.38 * s), skinMat);
    raHand.position.y = -0.9 * s; rightArm.add(raHand);
    rightArm.position.set(0.68 * s, 2.05 * s, 0); group.add(rightArm);

    // Weapon in hand
    if (type.ranged) {
        const cb = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.15 * s, 0.15 * s),
            new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.7, flatShading: true }));
        cb.position.set(0.25 * s, -0.35 * s, 0.2 * s); rightArm.add(cb);
    } else {
        const sword = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 1.0 * s, 0.05 * s),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.3, flatShading: true }));
        blade.position.y = -0.65 * s; sword.add(blade);
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.1 * s, 0.1 * s),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, flatShading: true }));
        hilt.position.y = -0.18 * s; sword.add(hilt);
        sword.position.set(0.1 * s, -0.4 * s, 0); rightArm.add(sword);
    }

    // Legs — blocky boxes, swing
    const leftLeg = new THREE.Group();
    const llMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.85 * s, 0.4 * s), legMat);
    llMesh.position.y = -0.42 * s; llMesh.castShadow = true; leftLeg.add(llMesh);
    const llBoot = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.25 * s, 0.5 * s),
        new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.9, flatShading: true }));
    llBoot.position.y = -0.95 * s; leftLeg.add(llBoot);
    leftLeg.position.set(-0.3 * s, 0.95 * s, 0); group.add(leftLeg);

    const rightLeg = new THREE.Group();
    const rlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.85 * s, 0.4 * s), legMat);
    rlMesh.position.y = -0.42 * s; rlMesh.castShadow = true; rightLeg.add(rlMesh);
    const rlBoot = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.25 * s, 0.5 * s),
        new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.9, flatShading: true }));
    rlBoot.position.y = -0.95 * s; rightLeg.add(rlBoot);
    rightLeg.position.set(0.3 * s, 0.95 * s, 0); group.add(rightLeg);

    // Boss: menacing aura ring + dark fire + crown of spikes
    let aura = null;
    let auraRing2 = null;
    let crown = null;
    if (type.isBoss) {
        // Inner pulsing aura ring
        aura = new THREE.Mesh(
            new THREE.RingGeometry(2.2 * s, 2.7 * s, 32),
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.05;
        group.add(aura);
        // Outer slow rotating ring
        auraRing2 = new THREE.Mesh(
            new THREE.RingGeometry(3.0 * s, 3.3 * s, 32),
            new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        auraRing2.rotation.x = -Math.PI / 2;
        auraRing2.position.y = 0.04;
        group.add(auraRing2);
        // Crown of dark spikes on head
        crown = new THREE.Group();
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.4, flatShading: true });
        for (let i = 0; i < 5; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.6 * s, 6), spikeMat);
            const ang = (i / 5) * Math.PI * 2;
            spike.position.set(Math.cos(ang) * 0.35 * s, 3.4 * s, Math.sin(ang) * 0.35 * s);
            spike.rotation.z = Math.cos(ang) * 0.3;
            spike.rotation.x = Math.sin(ang) * 0.3;
            crown.add(spike);
        }
        group.add(crown);
        // Glowing red eyes (replace normal dark eyes for boss)
        const bossEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        // Find and replace eye materials by adding glowing overlay
        const glowL = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.18 * s, 0.06 * s), bossEyeMat);
        glowL.position.set(-0.18 * s, 2.56 * s, 0.43 * s); group.add(glowL);
        const glowR = glowL.clone(); glowR.position.x = 0.18 * s; group.add(glowR);
    }

    return { group, parts: { torso, head, leftArm, rightArm, leftLeg, rightLeg, aura, auraRing2, crown } };
}

function spawnEnemy(forceBoss) {
    if (Game.enemies.length >= CONFIG.ENEMY_MAX_COUNT && !forceBoss) return;
    const minutes = Game.elapsed / 60;
    const tierBoost = 1 + minutes * 0.10;

    let type;
    if (forceBoss) {
        const bossIdx = Math.min(Game.bossCount, BOSS_TYPES.length - 1);
        type = BOSS_TYPES[bossIdx];
    } else {
        let typeIdx;
        const r = Math.random();
        if (minutes < 1) typeIdx = 0;
        else if (minutes < 3) typeIdx = r < 0.7 ? 0 : 1;
        else typeIdx = r < 0.4 ? 0 : r < 0.8 ? 1 : 2;
        type = ENEMY_TYPES[typeIdx];
    }

    const angle = Math.random() * Math.PI * 2;
    const dist = forceBoss ? CONFIG.ARENA_SIZE - 10 : CONFIG.ARENA_SIZE - 5;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const model = buildEnemyModel(type);
    model.group.position.set(x, 0, z);
    Game.scene.add(model.group);

    // Player-level-based HP boost: +8% per 5 levels (stacks with time scaling)
    const playerLevelBoost = 1 + Math.floor(Game.player ? (Game.player.level - 1) / 5 : 0) * 0.08;
    const hpScale = type.isBoss ? (1 + Game.bossCount * 0.35) * playerLevelBoost : tierBoost * playerLevelBoost;
    const e = {
        mesh: model.group, parts: model.parts, type: type,
        pos: new THREE.Vector3(x, 0, z),
        hp: type.hp * hpScale, maxHp: type.hp * hpScale,
        speed: type.speed * (1 + minutes * 0.02),
        damage: type.damage * (type.isBoss ? 1 : tierBoost),
        radius: type.size * 1.1, xpValue: type.xp,
        ranged: type.ranged || false, isBoss: type.isBoss || false,
        hitFlash: 0, dead: false,
        walkPhase: Math.random() * Math.PI * 2,
        attackAnim: 0, rangedCooldown: 0,
        bossAttackCooldown: 3.0, bossSpecialIdx: 0,
    };
    Game.enemies.push(e);

    if (type.isBoss) {
        Game.bossActive = true;
        Game.bossCount++;
        showBossBanner(type.name);
        showBossHpBar(type.name, e.maxHp);
        spawnParticles(e.pos, 0xff0000, 40);
        // BOSS-ONLY MODE: clear all small enemies for a fair duel
        for (const sm of Game.enemies) {
            if (sm !== e && !sm.isBoss && !sm.dead) {
                spawnParticles(sm.pos, 0x440000, 8);
                Game.scene.remove(sm.mesh);
                sm.dead = true;
            }
        }
    }
    return e;
}

// ============================================
// SPAWN ARROW PROJECTILE (animated arrow shape)
// ============================================
function spawnProjectile(origin, dir, weapon) {
    const group = new THREE.Group();
    const isLongbow = weapon.id === 'longbow';
    const isCrossbow = weapon.id === 'crossbow';
    const isFire = weapon.id === 'firearrows';
    const isArrow = isLongbow || isCrossbow || isFire;

    if (isLongbow) {
        // LONGBOW ARROW — long, elegant, gold shaft + silver tip + cyan fletch
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xe8c46a, roughness: 0.25, metalness: 0.3, emissive: 0x6a5000, emissiveIntensity: 0.25 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), shaftMat);
        shaft.rotation.x = Math.PI / 2; group.add(shaft);
        // Tip — bright silver cone
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8),
            new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 0.9, roughness: 0.1, emissive: 0x8888aa, emissiveIntensity: 0.4 }));
        tip.position.z = 0.9; tip.rotation.x = Math.PI/2; group.add(tip);
        // Fletch — cyan, cross planes
        const fletchMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x1188cc, emissiveIntensity: 0.5 });
        const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.3), fletchMat); f1.position.z = -0.6; group.add(f1);
        const f2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.3), fletchMat); f2.position.z = -0.6; f2.rotation.y = Math.PI/2; group.add(f2);
    } else if (isCrossbow) {
        // CROSSBOW BOLT — short, thick, blocky with red fletch
        const boltMat = new THREE.MeshStandardMaterial({ color: 0xc4a040, roughness: 0.3, metalness: 0.25, emissive: 0x6a5000, emissiveIntensity: 0.2 });
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), boltMat);
        group.add(shaft);
        // Tip — blocky pyramid
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4),
            new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 0.85, roughness: 0.15, emissive: 0x666688, emissiveIntensity: 0.3 }));
        tip.position.z = 0.6; tip.rotation.x = Math.PI/2; group.add(tip);
        // Red fletch — blocky
        const fletchMat = new THREE.MeshStandardMaterial({ color: 0xff4444, side: THREE.DoubleSide, roughness: 0.5, emissive: 0xaa2222, emissiveIntensity: 0.4 });
        const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.25), fletchMat); f1.position.z = -0.4; group.add(f1);
        const f2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.25), fletchMat); f2.position.z = -0.4; f2.rotation.y = Math.PI/2; group.add(f2);
        // Glow trail
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.25 }));
        group.add(glow);
    } else if (isFire) {
        // FIRE ARROW — orange shaft + gold tip + flame glow + ember trail
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.2, metalness: 0.2, emissive: 0xff3300, emissiveIntensity: 0.6 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8), shaftMat);
        shaft.rotation.x = Math.PI / 2; group.add(shaft);
        // Gold tip
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 8),
            new THREE.MeshStandardMaterial({ color: 0xffdd00, metalness: 0.8, roughness: 0.15, emissive: 0xff9900, emissiveIntensity: 0.8 }));
        tip.position.z = 0.85; tip.rotation.x = Math.PI/2; group.add(tip);
        // Flame fletch
        const fletchMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, side: THREE.DoubleSide, roughness: 0.4, emissive: 0xff6600, emissiveIntensity: 0.6 });
        const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35), fletchMat); f1.position.z = -0.55; group.add(f1);
        const f2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35), fletchMat); f2.position.z = -0.55; f2.rotation.y = Math.PI/2; group.add(f2);
        // Big flame glow
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.45 }));
        group.add(glow);
    } else if (weapon.id === 'daggers') {
        // DAGGER — blocky blade + hilt + pommel, smooth shader
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.85, roughness: 0.15, emissive: 0x4466aa, emissiveIntensity: 0.3 });
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.7), bladeMat);
        blade.position.z = 0.35; group.add(blade);
        // Tip — blocky pyramid
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4),
            new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 0.9, roughness: 0.1 }));
        tip.position.z = 0.75; tip.rotation.x = Math.PI/2; group.add(tip);
        // Hilt — brown crossguard
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 }));
        hilt.position.z = -0.02; group.add(hilt);
        // Pommel — gold
        const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3, emissive: 0x4a3a00, emissiveIntensity: 0.2 }));
        pommel.position.z = -0.15; group.add(pommel);
        // Glow
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.15 }));
        group.add(glow);
    } else {
        // SLING STONE — smooth blocky river stone, bigger for visibility
        const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1),
            new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.45, metalness: 0.05, flatShading: false, emissive: 0x444433, emissiveIntensity: 0.1 }));
        group.add(stone);
        // Subtle glow for visibility
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xccccaa, transparent: true, opacity: 0.12 }));
        group.add(glow);
    }

    group.position.copy(origin);
    group.position.y = 1.6;
    const target = new THREE.Vector3().copy(group.position).add(dir);
    group.lookAt(target);
    Game.scene.add(group);

    Game.projectiles.push({
        mesh: group, pos: group.position.clone(),
        dir: dir.clone().normalize(),
        speed: weapon.projectileSpeed || 0.5,
        damage: weapon.damage * Game.player.damageMult,
        range: weapon.range, traveled: 0,
        pierce: weapon.pierce || false, explosive: weapon.explosive || false,
        color: weapon.color, hitEnemies: new Set(), spin: 0,
        weaponId: weapon.id,
    });
}

// ============================================
// XP PICKUP — emerald gem (Minecraft-style smooth)
// ============================================
function spawnXPPickup(pos, value) {
    // XP gem — green emerald octahedron, smooth shader
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: 0x2ecc71, metalness: 0.25, roughness: 0.2, emissive: 0x1a8a4a, emissiveIntensity: 0.55 })
    );
    gem.position.set(pos.x, 0.7, pos.z);
    Game.scene.add(gem);
    // Soft green glow
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.16 })
    );
    glow.position.set(pos.x, 0.7, pos.z);
    Game.scene.add(glow);
    Game.pickups.push({
        mesh: gem, glow: glow, pos: new THREE.Vector3(pos.x, 0.7, pos.z),
        value: value, bobPhase: Math.random() * Math.PI * 2,
    });
}

// ============================================
// HEART PICKUP — red heart that heals 30% max HP
// ============================================
function spawnHeartPickup(pos) {
    const grp = new THREE.Group();
    // Heart shape: two spheres + cone pointing down
    const heartMat = new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xcc1144, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.1 });
    const lobeL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), heartMat);
    lobeL.position.set(-0.12, 0.12, 0); grp.add(lobeL);
    const lobeR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), heartMat);
    lobeR.position.set(0.12, 0.12, 0); grp.add(lobeR);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 12), heartMat);
    tip.position.set(0, -0.15, 0); tip.rotation.x = Math.PI; grp.add(tip);
    // Red glow halo
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.2 })
    );
    grp.add(glow);
    grp.position.set(pos.x, 0.7, pos.z);
    Game.scene.add(grp);
    Game.pickups.push({
        mesh: grp, glow: glow, pos: new THREE.Vector3(pos.x, 0.7, pos.z),
        isHeart: true, bobPhase: Math.random() * Math.PI * 2,
    });
}

// ============================================
// PARTICLES — leaves / dust / sparks
// ============================================
function spawnParticles(pos, color, count) {
    count = count || 8;
    for (let i = 0; i < count; i++) {
        const isLeaf = (color === 0x2d5a1a || color === 0x3a6b22);
        const geo = isLeaf ? new THREE.PlaneGeometry(0.25, 0.15) : new THREE.SphereGeometry(0.15, 5, 5);
        const mesh = new THREE.Mesh(geo,
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1, side: THREE.DoubleSide }));
        mesh.position.copy(pos);
        mesh.position.y = 1 + Math.random() * 0.5;
        Game.scene.add(mesh);
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.04 + Math.random() * 0.1;
        Game.particles.push({
            mesh: mesh, isLeaf: isLeaf,
            vel: new THREE.Vector3(Math.cos(angle) * speed, 0.08 + Math.random() * 0.12, Math.sin(angle) * speed),
            rotVel: (Math.random() - 0.5) * 0.3,
            life: 0.8, maxLife: 0.8,
        });
    }
}

// ============================================
// COMBAT — Player Attack (triggers bow draw animation)
// ============================================
function tryPlayerAttack() {
    const p = Game.player;
    const now = Game.elapsed;
    let fired = false;

    for (const weapon of p.weapons) {
        if (weapon.orbit) continue;
        const cd = weapon.cooldown * p.cooldownMult;
        if (now - (weapon.lastFire || 0) < cd) continue;
        weapon.lastFire = now;

        const nearest = findNearestEnemy(p.pos, weapon.range);
        let aimDir;
        if (nearest) {
            aimDir = new THREE.Vector3().subVectors(nearest.pos, p.pos);
            aimDir.y = 0; aimDir.normalize();
            // Face the target when firing
            p.facing = Math.atan2(aimDir.x, aimDir.z);
        } else {
            aimDir = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
        }

        const count = weapon.projectileCount + p.bonusProjectiles;
        for (let i = 0; i < count; i++) {
            let dir = aimDir.clone();
            if (weapon.spread > 0) {
                const sa = (i - (count - 1) / 2) * weapon.spread;
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), sa);
            }
            spawnProjectile(p.pos, dir, weapon);
        }
        // Trigger bow-draw animation
        p.drawTarget = 1;
        fired = true;
    }
    return fired;
}

function findNearestEnemy(pos, maxDist) {
    let nearest = null, minDist = maxDist;
    for (const e of Game.enemies) {
        if (e.dead) continue;
        const d = e.pos.distanceTo(pos);
        if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
}

// ============================================
// ORBIT WEAPONS — spinning axes
// ============================================
function updateOrbitWeapons() {
    const p = Game.player;
    for (const weapon of p.weapons) {
        if (!weapon.orbit) continue;
        if (!weapon.orbitMeshes) {
            weapon.orbitMeshes = [];
            const total = weapon.orbitCount + p.bonusProjectiles;
            for (let i = 0; i < total; i++) {
                const axe = new THREE.Group();
                const handle = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6),
                    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7 })
                );
                axe.add(handle);
                const head = new THREE.Mesh(
                    new THREE.BoxGeometry(0.4, 0.3, 0.08),
                    new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.7, roughness: 0.3 })
                );
                head.position.set(0.25, 0.25, 0);
                axe.add(head);
                Game.scene.add(axe);
                weapon.orbitMeshes.push(axe);
            }
            weapon.orbitAngle = 0;
            weapon.lastHitMap = new Map();
        }

        weapon.orbitAngle += 0.06;
        const radius = weapon.range;
        weapon.orbitMeshes.forEach((axe, i) => {
            const a = weapon.orbitAngle + (i / weapon.orbitMeshes.length) * Math.PI * 2;
            axe.position.set(p.pos.x + Math.cos(a) * radius, 1.4, p.pos.z + Math.sin(a) * radius);
            axe.rotation.y = -a + Math.PI / 2;
            axe.rotation.x = Game.elapsed * 8; // spin the axe

            for (const e of Game.enemies) {
                if (e.dead) continue;
                // 2D distance for orbit collision too
                const ox = axe.position.x - e.pos.x;
                const oz = axe.position.z - e.pos.z;
                const od = Math.sqrt(ox * ox + oz * oz);
                if (od < e.radius + 1.0) {
                    const last = weapon.lastHitMap.get(e) || 0;
                    if (Game.elapsed - last > 0.4) {
                        damageEnemy(e, weapon.damage * p.damageMult);
                        weapon.lastHitMap.set(e, Game.elapsed);
                    }
                }
            }
        });
    }
}

// ============================================
// DAMAGE & KILL
// ============================================
function damageEnemy(enemy, damage) {
    enemy.hp -= damage;
    enemy.hitFlash = 0.18;
    enemy.attackAnim = 0.3; // recoil
    spawnFloatingText(enemy.pos, Math.ceil(damage), 'damage');
    if (Game.player.lifesteal > 0) {
        Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + damage * Game.player.lifesteal);
    }
    if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
    // Blood/dust burst
    spawnParticles(enemy.pos, enemy.isBoss ? 0xff0000 : 0x8b1a1a, enemy.isBoss ? 40 : 10);
    // Leaves if near trees
    spawnParticles(enemy.pos, 0x3a6b22, 6);
    Game.scene.remove(enemy.mesh);
    enemy.dead = true;
    Game.killCount++;
    spawnXPPickup(enemy.pos, enemy.xpValue * Game.player.xpMult);
    // Heart heal drop: 10% for normal enemies, 25% for bosses — heals 30% max HP
    const heartChance = enemy.isBoss ? 0.15 : 0.05;
    if (Math.random() < heartChance) {
        spawnHeartPickup(enemy.pos);
    }
    if (enemy.isBoss) {
        Game.bossActive = false;
        hideBossBanner();
        hideBossHpBar();
        spawnFloatingText(enemy.pos, 'BOSS DEFEATED!', 'boss');
        // Extra coins
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const off = new THREE.Vector3(enemy.pos.x + Math.cos(a) * 3, 0, enemy.pos.z + Math.sin(a) * 3);
            spawnXPPickup(off, enemy.xpValue * 0.3 * Game.player.xpMult);
        }
    }
}

// ============================================
// BOSS SPECIAL ATTACKS — devastating jutsu
// ============================================
function bossSpecialAttack(enemy) {
    const attacks = enemy.type.attacks || [];
    if (attacks.length === 0) return;
    const idx = enemy.bossSpecialIdx % attacks.length;
    enemy.bossSpecialIdx++;
    const skill = attacks[idx];
    const p = Game.player;
    enemy.attackAnim = 0.5;
    spawnFloatingText(enemy.pos, 'SPECIAL!', 'boss');
    spawnParticles(enemy.pos, 0xff0000, 20);

    if (skill === 'spreadBolt') {
        // Sheriff: 8-way crossbow bolt fan
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            spawnBossProjectile(enemy.pos, dir, enemy.damage * 0.8, 0xff4400, 0.5);
        }
    } else if (skill === 'chargeSlam') {
        // Sheriff: teleport-blink to player and slam
        spawnParticles(enemy.pos, 0xff0000, 25);
        enemy.pos.copy(p.pos);
        enemy.pos.x += (Math.random() - 0.5) * 3;
        enemy.pos.z += (Math.random() - 0.5) * 3;
        enemy.mesh.position.copy(enemy.pos);
        spawnParticles(p.pos, 0xff6600, 30);
        if (p.invulnTimer <= 0) {
            damagePlayer(enemy.damage * 1.5);
            p.invulnTimer = 1.0;
        }
    } else if (skill === 'summonCone') {
        // Sheriff: fire 5 bolts in a cone aimed at player
        const baseDir = new THREE.Vector3().subVectors(p.pos, enemy.pos);
        baseDir.y = 0; baseDir.normalize();
        for (let i = -2; i <= 2; i++) {
            const dir = baseDir.clone();
            dir.applyAxisAngle(new THREE.Vector3(0,1,0), i * 0.25);
            spawnBossProjectile(enemy.pos, dir, enemy.damage, 0xff4400, 0.55);
        }
    } else if (skill === 'fanBlades') {
        // Guy of Gisborne: 12 spinning blades in a circle
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            spawnBossProjectile(enemy.pos, dir, enemy.damage * 0.7, 0xaa00ff, 0.6, 0.25);
        }
    } else if (skill === 'dashStrike') {
        // Guy of Gisborne: fast dash across arena leaving damage trail
        const dashDir = new THREE.Vector3().subVectors(p.pos, enemy.pos);
        dashDir.y = 0; dashDir.normalize();
        for (let i = 0; i < 6; i++) {
            const off = dashDir.clone().multiplyScalar(i * 4);
            spawnParticles(new THREE.Vector3(enemy.pos.x + off.x, 0, enemy.pos.z + off.z), 0x6600aa, 8);
        }
        if (p.invulnTimer <= 0) { damagePlayer(enemy.damage * 1.2); p.invulnTimer = 0.8; }
    } else if (skill === 'darkPulse') {
        // Guy of Gisborne: expanding shockwave ring
        for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            spawnBossProjectile(enemy.pos, dir, enemy.damage * 0.6, 0x440088, 0.45);
        }
    } else if (skill === 'goldenRain') {
        // Prince John's Champion: rain of golden bolts from above
        for (let i = 0; i < 10; i++) {
            const tx = p.pos.x + (Math.random() - 0.5) * 20;
            const tz = p.pos.z + (Math.random() - 0.5) * 20;
            const dir = new THREE.Vector3(0, 0, 1); // falls straight
            const proj = spawnBossProjectile(new THREE.Vector3(tx, 0, tz), dir, enemy.damage * 0.8, 0xffaa00, 0);
            // Make it appear to fall — store as meteor
            if (proj) { proj.isMeteor = true; proj.meteorDelay = i * 0.15; proj.meteorActive = false; proj.meteorPos = new THREE.Vector3(tx, 0, tz); }
        }
    } else if (skill === 'earthquake') {
        // Prince John's Champion: massive AoE burst around self
        spawnParticles(enemy.pos, 0xffaa00, 50);
        const distToP = enemy.pos.distanceTo(p.pos);
        if (distToP < 12 && p.invulnTimer <= 0) {
            damagePlayer(enemy.damage * 1.8);
            p.invulnTimer = 1.2;
        }
        // Visual ring
        for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2;
            spawnParticles(new THREE.Vector3(enemy.pos.x + Math.cos(ang)*8, 0, enemy.pos.z + Math.sin(ang)*8), 0xddaa00, 5);
        }
    } else if (skill === 'beamSweep') {
        // Prince John's Champion: sweeping beam of golden bolts
        const baseAng = Math.atan2(p.pos.x - enemy.pos.x, p.pos.z - enemy.pos.z);
        for (let i = 0; i < 15; i++) {
            const ang = baseAng + (i - 7) * 0.12;
            const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
            spawnBossProjectile(enemy.pos, dir, enemy.damage * 0.7, 0xffdd00, 0.5);
        }
    }
}

function spawnBossProjectile(origin, dir, damage, color, speed, size) {
    const grp = new THREE.Group();
    const r = size || 0.2;
    // Core orb — bright emissive
    const orb = new THREE.Mesh(
        new THREE.SphereGeometry(r, 10, 10),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    grp.add(orb);
    // Glow halo
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.8, 8, 8),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 })
    );
    grp.add(glow);
    grp.position.copy(origin);
    grp.position.y = 1.6;
    Game.scene.add(grp);
    const pr = {
        mesh: grp, pos: grp.position.clone(), dir: dir.clone().normalize(),
        speed: speed, damage: damage, range: 25, traveled: 0,
        pierce: false, explosive: false, color: color, hitEnemies: new Set(),
        fromEnemy: true, spin: 0, isBossAttack: true,
    };
    Game.projectiles.push(pr);
    return pr;
}

// ============================================
// ENEMY RANGED ATTACK
// ============================================
function enemyRangedAttack(enemy) {
    const p = Game.player;
    const dir = new THREE.Vector3().subVectors(p.pos, enemy.pos);
    dir.y = 0; dir.normalize();
    // Group: bright glowing bolt + glow sphere for high visibility
    const grp = new THREE.Group();
    // Bolt body — bright cyan, large, emissive
    const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x00ddff, emissive: 0x00aaff, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.3 })
    );
    bolt.rotation.x = Math.PI / 2;
    grp.add(bolt);
    // Glow halo around bolt — makes it visible from far away
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.35 })
    );
    grp.add(glow);
    // Trail tip — bright point at front
    const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xaaeeff })
    );
    tip.position.z = 0.5;
    grp.add(tip);
    grp.position.copy(enemy.pos);
    grp.position.y = 1.6;
    const target = new THREE.Vector3().copy(grp.position).add(dir);
    grp.lookAt(target);
    Game.scene.add(grp);
    Game.projectiles.push({
        mesh: grp, pos: grp.position.clone(), dir: dir,
        speed: 0.4, damage: enemy.damage * Game.damageScale, range: 20, traveled: 0,
        pierce: false, explosive: false, color: 0x00ddff, hitEnemies: new Set(),
        fromEnemy: true, spin: 0,
    });
}

// ============================================
// CHEST AIRDROP SYSTEM
// ============================================
function spawnChest() {
    if (Game.chest) return;
    const p = Game.player;
    const angle = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * (CONFIG.CHEST_SPAWN_NEAR - 4);  // 4-10 units from player
    let x = p.pos.x + Math.cos(angle) * dist;
    let z = p.pos.z + Math.sin(angle) * dist;
    const b = CONFIG.ARENA_SIZE - 5;
    x = Math.max(-b, Math.min(b, x)); z = Math.max(-b, Math.min(b, z));

    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3, emissive: 0x4a3a00, emissiveIntensity: 0.3, flatShading: true });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.2), woodMat);
    base.position.y = 0.5; base.castShadow = true; group.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), woodMat);
    lid.position.y = 1.25; lid.castShadow = true; group.add(lid);
    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.25), goldMat);
    trim1.position.y = 0.3; group.add(trim1);
    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.25), goldMat);
    trim2.position.y = 0.8; group.add(trim2);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.1), goldMat);
    lock.position.set(0, 1.0, 0.62); group.add(lock);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.0, 20),
        new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; group.add(glow);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.2 }));
    beam.position.y = 5; group.add(beam);

    group.position.set(x, 0, z);
    Game.scene.add(group);
    Game.chest = { mesh: group, pos: new THREE.Vector3(x, 0, z), glow, beam, lid, bobPhase: 0, opened: false };
    spawnFloatingText(new THREE.Vector3(x, 0, z), 'CHEST AIRDROP!', 'levelup');
    spawnParticles(new THREE.Vector3(x, 0, z), 0xd4af37, 20);
    createChestNavArrow();
}

function updateChest(dt) {
    if (!Game.chest) { hideChestNavArrow(); return; }
    const c = Game.chest;
    c.bobPhase += dt * 2;
    c.mesh.position.y = Math.sin(c.bobPhase) * 0.15;
    c.mesh.rotation.y += dt * 0.5;
    c.glow.material.opacity = 0.2 + Math.sin(Game.elapsed * 3) * 0.1;
    c.beam.material.opacity = 0.15 + Math.sin(Game.elapsed * 2) * 0.08;

    const p = Game.player;
    const dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z;
    const d2d = Math.sqrt(dx * dx + dz * dz);
    if (d2d < CONFIG.PLAYER_RADIUS + 2.0) { openChest(); }
    updateChestNavArrow(d2d, Math.atan2(dx, dz));
}

function openChest() {
    const c = Game.chest;
    if (!c || c.opened) return;
    c.opened = true;
    c.lid.rotation.x = -0.8;
    c.lid.position.z = 0.3;
    spawnParticles(c.pos, 0xd4af37, 30);
    spawnFloatingText(c.pos, 'CHEST OPENED!', 'levelup');
    setTimeout(() => {
        if (Game.chest) { Game.scene.remove(Game.chest.mesh); Game.chest = null; hideChestNavArrow(); }
    }, 600);
    showLevelUpChoice(Game.player.level);
}

function createChestNavArrow() {
    if (Game.chestNavArrow) return;
    const el = document.createElement('div');
    el.id = 'chestNavArrow';
    el.innerHTML = '<div class="chest-arrow-chevron"></div>';
    document.body.appendChild(el);
    Game.chestNavArrow = el;
}

function updateChestNavArrow(distance, angleToChest) {
    if (!Game.chestNavArrow || !Game.chest) return;
    if (distance < 12) { Game.chestNavArrow.style.display = 'none'; return; }
    Game.chestNavArrow.style.display = 'flex';
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.32;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const ax = cx + Math.sin(angleToChest) * radius;
    const ay = cy - Math.cos(angleToChest) * radius;
    Game.chestNavArrow.style.left = ax + 'px';
    Game.chestNavArrow.style.top = ay + 'px';
    const rotDeg = (angleToChest * 180 / Math.PI);
    Game.chestNavArrow.style.transform = 'translate(-50%, -50%) rotate(' + rotDeg + 'deg)';
    // Arrow only — no text label
}

function hideChestNavArrow() {
    if (Game.chestNavArrow) Game.chestNavArrow.style.display = 'none';
}

// ============================================
// XP & LEVELING
// ============================================
function collectXP(value) {
    const p = Game.player;
    p.xp += value;
    while (p.xp >= p.xpToNext) { p.xp -= p.xpToNext; levelUp(); }
    updateHUD();
}

function levelUp() {
    const p = Game.player;
    p.level++;
    p.xpToNext = Math.floor(100 * Math.pow(1.18, p.level - 1));
    p.maxHp += 5;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    spawnFloatingText(p.pos, 'LEVEL UP!', 'levelup');
    spawnParticles(p.pos, 0xd4af37, 15);
    if (p.level % CONFIG.LEVEL_GAP === 0) showLevelUpChoice(p.level);
}

function showLevelUpChoice(level) {
    Game.paused = true;
    document.getElementById('modalLevelNum').textContent = level;
    const choices = generateChoices();
    const container = document.getElementById('choiceCards');
    container.innerHTML = '';
    choices.forEach(choice => {
        const card = document.createElement('div');
        card.className = 'choice-card ' + choice.type;
        card.innerHTML =
            '<div class="choice-icon">' + choice.icon + '</div>' +
            '<div class="choice-type">' + choice.type + '</div>' +
            '<div class="choice-name">' + choice.name + '</div>' +
            '<div class="choice-desc">' + choice.desc + '</div>' +
            (choice.isUpgrade ? '<div class="choice-level-tag">UPGRADE Lv.' + (choice.level + 1) + '</div>' : '');
        card.addEventListener('click', () => selectChoice(choice));
        container.appendChild(card);
    });
    document.getElementById('levelUpModal').classList.remove('hidden');
}

function generateChoices() {
    const p = Game.player;
    const pool = [];
    const used = new Set();
    for (const w of p.weapons) {
        if (w.level < 5) {
            pool.push({ ...WEAPONS[w.id], level: w.level, isUpgrade: true,
                desc: getUpgradeDesc(w.id, w.level), apply: () => upgradeWeapon(w.id) });
            used.add(w.id);
        }
    }
    for (const key in WEAPONS) {
        if (!used.has(key) && p.weapons.length < 4) pool.push({ ...WEAPONS[key], isUpgrade: false });
    }
    for (const key in ABILITIES) {
        const owned = p.abilities.find(a => a.id === key);
        const maxS = ABILITIES[key].maxStacks || 3;
        if (!owned || (owned.stacks || 1) < maxS) pool.push({ ...ABILITIES[key], isUpgrade: false });
    }
    shuffle(pool);
    return pool.slice(0, 3);
}

function getUpgradeDesc(id, level) {
    const u = {
        longbow:     ['+15% dmg, +1 arrow', '+20% dmg, faster draw', '+25% dmg, longer range', '+30% dmg, +1 arrow'],
        crossbow:    ['+15% dmg, +1 bolt', '+20% dmg, faster reload', '+25% dmg, longer range', '+30% dmg, +1 bolt'],
        daggers:     ['+1 dagger, +15% dmg', '+1 dagger, wider spread', '+20% dmg, faster throw', '+2 daggers, +20% dmg'],
        sling:       ['+15% dmg, wider spread', '+20% dmg, longer range', '+25% dmg, faster fire', '+30% dmg, +1 stone'],
        axes:        ['+1 axe, +15% dmg', '+1 axe, larger radius', '+20% dmg, faster spin', '+2 axes, +20% dmg'],
        firearrows:  ['+20% dmg, bigger blast', '+25% dmg, faster reload', '+30% dmg, +1 arrow', '+35% dmg, larger blast'],
    };
    const arr = u[id];
    return arr ? arr[Math.min(level - 1, arr.length - 1)] : 'Improved stats';
}

function upgradeWeapon(id) {
    const w = Game.player.weapons.find(x => x.id === id);
    if (!w) return;
    w.level++;
    w.damage *= 1.12;
    w.range *= 1.08;
    if (id === 'daggers' || id === 'sling' || id === 'firearrows') {
        w.projectileCount = (w.projectileCount || 1) + (w.level % 2 === 0 ? 1 : 0);
    }
    if (id === 'axes') {
        w.orbitCount = (w.orbitCount || 2) + 1;
        if (w.orbitMeshes) { w.orbitMeshes.forEach(m => Game.scene.remove(m)); w.orbitMeshes = null; }
    }
    w.cooldown *= 0.9;
}

function selectChoice(choice) {
    const p = Game.player;
    if (choice.type === 'weapon') {
        if (choice.isUpgrade) choice.apply();
        else p.weapons.push({ ...WEAPONS[choice.id], level: 1, lastFire: 0 });
    } else if (choice.type === 'ability') {
        const ex = p.abilities.find(a => a.id === choice.id);
        if (ex) ex.stacks = (ex.stacks || 1) + 1;
        else p.abilities.push({ id: choice.id, name: choice.name, icon: choice.icon, stacks: 1 });
        ABILITIES[choice.id].apply(p);
    }
    document.getElementById('levelUpModal').classList.add('hidden');
    Game.paused = false;
    updateAbilityBar(); updateHUD();
}

// ============================================
// FLOATING TEXT + BOSS BANNER
// ============================================
function spawnFloatingText(worldPos, text, type) {
    const vec = worldPos.clone(); vec.y = 2.5;
    vec.project(Game.camera);
    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = 'float-text ' + type;
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.getElementById('floatingTexts').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function showBossBanner(name) {
    document.getElementById('bossName').textContent = name.toUpperCase();
    document.getElementById('bossBanner').classList.remove('hidden');
    if (Game._bossBannerTimer) clearTimeout(Game._bossBannerTimer);
    Game._bossBannerTimer = setTimeout(() => hideBossBanner(), 5000);
}
function hideBossBanner() {
    document.getElementById('bossBanner').classList.add('hidden');
}

function showBossHpBar(name, maxHp) {
    document.getElementById('bossHpLabel').textContent = name.toUpperCase();
    document.getElementById('bossHpFill').style.width = '100%';
    document.getElementById('bossHpBar').classList.remove('hidden');
}
function updateBossHpBar(enemy) {
    if (!enemy || !enemy.isBoss) return;
    const pct = Math.max(0, enemy.hp / enemy.maxHp * 100);
    document.getElementById('bossHpFill').style.width = pct + '%';
}
function hideBossHpBar() {
    document.getElementById('bossHpBar').classList.add('hidden');
}

// ============================================
// INPUT HANDLING
// ============================================
function setupInput() {
    window.addEventListener('keydown', (e) => {
        Game.keys[e.key.toLowerCase()] = true;
        if (e.key === 'Escape' && Game.running) togglePause();
    });
    window.addEventListener('keyup', (e) => { Game.keys[e.key.toLowerCase()] = false; });

    const zone = document.getElementById('joystickZone');
    const knob = document.getElementById('joystickKnob');
    const baseR = 60;
    function hStart(e) { e.preventDefault(); Game.joystick.active = true; hMove(e); }
    function hMove(e) {
        if (!Game.joystick.active) return;
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        const r = zone.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > baseR) { dx = (dx / d) * baseR; dy = (dy / d) * baseR; }
        Game.joystick.dx = dx / baseR; Game.joystick.dy = dy / baseR;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    function hEnd(e) {
        e.preventDefault(); Game.joystick.active = false;
        Game.joystick.dx = 0; Game.joystick.dy = 0;
        knob.style.transform = 'translate(0px,0px)';
    }
    zone.addEventListener('touchstart', hStart, { passive: false });
    zone.addEventListener('touchmove', hMove, { passive: false });
    zone.addEventListener('touchend', hEnd, { passive: false });
    zone.addEventListener('touchcancel', hEnd, { passive: false });

    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('victoryRestartBtn').addEventListener('click', () => {
        document.getElementById('victoryScreen').classList.add('hidden');
        resetGame();
        Game.running = true;
    });
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('quitBtn').addEventListener('click', quitToMenu);

    // Docs & Guide panel buttons
    document.getElementById('docsBtn').addEventListener('click', () => {
        document.getElementById('docsPanel').classList.remove('hidden');
    });
    document.getElementById('guideBtn').addEventListener('click', () => {
        document.getElementById('guidePanel').classList.remove('hidden');
    });
    // Contract address — click to copy
    const caBox = document.getElementById('caBox');
    if (caBox) {
        caBox.addEventListener('click', () => {
            const ca = document.getElementById('caText').textContent.trim();
            const showCopied = () => {
                caBox.classList.add('copied');
                setTimeout(() => caBox.classList.remove('copied'), 1200);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(ca).then(showCopied).catch(showCopied);
            } else {
                const ta = document.createElement('textarea');
                ta.value = ca; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta); showCopied();
            }
        });
    }
    // Close buttons (data-close attribute)
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-close');
            if (target) document.getElementById(target).classList.add('hidden');
        });
    });

    window.addEventListener('resize', onResize);
}

function togglePause() {
    if (!Game.running) return;
    Game.paused = !Game.paused;
    document.getElementById('pauseScreen').classList.toggle('hidden', !Game.paused);
}

function onResize() {
    Game.camera.aspect = window.innerWidth / window.innerHeight;
    Game.camera.updateProjectionMatrix();
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// PLAYER MOVEMENT + ANIMATION
// ============================================
function updatePlayerMovement(dt) {
    const p = Game.player;
    let mx = 0, mz = 0;
    if (Game.isTouch) { mx = Game.joystick.dx; mz = Game.joystick.dy; }
    else {
        if (Game.keys['w'] || Game.keys['arrowup']) mz -= 1;
        if (Game.keys['s'] || Game.keys['arrowdown']) mz += 1;
        if (Game.keys['a'] || Game.keys['arrowleft']) mx -= 1;
        if (Game.keys['d'] || Game.keys['arrowright']) mx += 1;
    }
    const mag = Math.sqrt(mx * mx + mz * mz);
    p.moving = mag > 0.1;
    if (p.moving) {
        mx /= Math.max(mag, 1); mz /= Math.max(mag, 1);
        p.facing = Math.atan2(mx, mz);
        p.vel.x = mx * p.speed; p.vel.z = mz * p.speed;
    } else { p.vel.x *= 0.8; p.vel.z *= 0.8; }

    let nx = p.pos.x + p.vel.x, nz = p.pos.z + p.vel.z;
    for (const obs of Game.obstacles) {
        if (obs.isWall) continue;
        const dx = nx - obs.mesh.position.x, dz = nz - obs.mesh.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const minD = CONFIG.PLAYER_RADIUS + obs.radius;
        if (d < minD && d > 0.01) { nx = obs.mesh.position.x + (dx / d) * minD; nz = obs.mesh.position.z + (dz / d) * minD; }
    }
    const b = CONFIG.ARENA_SIZE - 2;
    p.pos.x = Math.max(-b, Math.min(b, nx));
    p.pos.z = Math.max(-b, Math.min(b, nz));
    p.mesh.position.set(p.pos.x, 0, p.pos.z);
    p.mesh.rotation.y = p.facing;

    // ===== ANIMATION =====
    const parts = p.parts;
    if (p.moving) {
        p.walkPhase += dt * 12;
    } else {
        p.walkPhase += dt * 2; // idle gentle sway
    }
    const wp = p.walkPhase;

    // Body bob up/down — updated Y bases for new blocky model
    const bobAmt = p.moving ? 0.18 : 0.04;
    parts.torso.position.y = 1.8 + Math.sin(wp * 2) * bobAmt;
    parts.head.position.y = 3.05 + Math.sin(wp * 2) * bobAmt;
    parts.hood.position.y = 3.65 + Math.sin(wp * 2) * bobAmt;
    parts.feather.position.y = 4.1 + Math.sin(wp * 2) * bobAmt;

    // Slight torso lean/sway
    parts.torso.rotation.z = Math.sin(wp) * (p.moving ? 0.06 : 0.02);

    // Arm swing (opposite phases)
    const armSwing = p.moving ? 0.5 : 0.1;
    parts.leftArm.rotation.x = Math.sin(wp) * armSwing;
    parts.rightArm.rotation.x = -Math.sin(wp) * armSwing * 0.4; // right arm steadier (holds bow)

    // Leg swing
    const legSwing = p.moving ? 0.6 : 0.05;
    parts.leftLeg.rotation.x = -Math.sin(wp) * legSwing;
    parts.rightLeg.rotation.x = Math.sin(wp) * legSwing;

    // Cape flutter — based on movement speed + wind
    const capeFlow = Math.sin(Game.elapsed * 4 + p.walkPhase) * (p.moving ? 0.35 : 0.12);
    parts.cape.rotation.x = -0.1 + capeFlow;
    parts.cape.rotation.z = Math.sin(Game.elapsed * 3) * 0.08;

    // Bow draw animation — drawBow lerps toward drawTarget then resets
    p.drawBow += (p.drawTarget - p.drawBow) * 0.3;
    p.drawTarget *= 0.85; // decay back to 0
    parts.rightArm.rotation.x += p.drawBow * 0.8; // pull back when drawing
    parts.bow.rotation.z = -0.3 + p.drawBow * 0.5;
    parts.bowstring.position.x = -0.6 + p.drawBow * 0.3; // string pulls back

    // Idle breathing
    p.idlePhase += dt;
    const breath = Math.sin(p.idlePhase * 2) * 0.02;
    if (!p.moving) parts.torso.scale.y = 1 + breath;
    else parts.torso.scale.y = 1;
}

// ============================================
// TREE SWAY ANIMATION (wind)
// ============================================
function updateTreeSway(dt) {
    Game.windPhase += dt * 1.5;
    for (const t of Game.trees) {
        const sway = Math.sin(Game.windPhase + t.phase) * 0.04 * t.scale;
        t.group.rotation.z = sway;
        // Foliage gentle independent wobble
        t.foliages.forEach((f, i) => {
            f.position.x = f.position.x; // keep base
            f.rotation.z = Math.sin(Game.windPhase * 1.3 + t.phase + i) * 0.05;
        });
    }
}

// ============================================
// ENEMY UPDATE + WALK ANIMATION
// ============================================
function updateEnemies(dt) {
    const p = Game.player;
    for (let i = Game.enemies.length - 1; i >= 0; i--) {
        const e = Game.enemies[i];
        if (e.dead) { Game.enemies.splice(i, 1); continue; }

        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Ranged enemies keep distance
        let moveSpeed = e.speed;
        if (e.ranged && dist < 10) moveSpeed = -e.speed * 0.5; // back away
        if (dist > 0.01) {
            e.pos.x += (dx / dist) * moveSpeed;
            e.pos.z += (dz / dist) * moveSpeed;
        }

        // Face the player
        e.mesh.rotation.y = Math.atan2(dx, dz);

        // Separate from other enemies
        for (let j = i + 1; j < Game.enemies.length; j++) {
            const o = Game.enemies[j];
            if (o.dead) continue;
            const ddx = e.pos.x - o.pos.x, ddz = e.pos.z - o.pos.z;
            const dd = Math.sqrt(ddx * ddx + ddz * ddz);
            const minD = e.radius + o.radius;
            if (dd < minD && dd > 0.01) {
                const push = (minD - dd) * 0.5;
                e.pos.x += (ddx / dd) * push; e.pos.z += (ddz / dd) * push;
                o.pos.x -= (ddx / dd) * push; o.pos.z -= (ddz / dd) * push;
            }
        }

        const b = CONFIG.ARENA_SIZE - 1;
        e.pos.x = Math.max(-b, Math.min(b, e.pos.x));
        e.pos.z = Math.max(-b, Math.min(b, e.pos.z));
        e.mesh.position.set(e.pos.x, 0, e.pos.z);

        // ===== WALK ANIMATION =====
        const moving = Math.abs(moveSpeed) > 0.01;
        if (moving) e.walkPhase += dt * (8 + e.speed * 30);
        const wp = e.walkPhase;
        const s = e.type.size;
        const pa = e.parts;
        const bobAmt = moving ? 0.15 * s : 0.04 * s;
        pa.torso.position.y = 1.5 * s + Math.sin(wp * 2) * bobAmt;
        pa.head.position.y = 2.5 * s + Math.sin(wp * 2) * bobAmt;
        pa.torso.rotation.z = Math.sin(wp) * (moving ? 0.05 : 0.02);
        pa.leftArm.rotation.x = Math.sin(wp) * (moving ? 0.6 : 0.1);
        pa.rightArm.rotation.x = -Math.sin(wp) * (moving ? 0.6 : 0.1);
        pa.leftLeg.rotation.x = -Math.sin(wp) * (moving ? 0.7 : 0.05);
        pa.rightLeg.rotation.x = Math.sin(wp) * (moving ? 0.7 : 0.05);
        // Attack recoil animation
        if (e.attackAnim > 0) {
            e.attackAnim -= dt;
            pa.rightArm.rotation.x += (1 - e.attackAnim / 0.3) * 0.8;
        }
        // Boss aura pulse — double ring + crown glow
        if (pa.aura) {
            pa.aura.scale.setScalar(1 + Math.sin(Game.elapsed * 3) * 0.18);
            pa.aura.material.opacity = 0.35 + Math.sin(Game.elapsed * 3) * 0.2;
        }
        if (pa.auraRing2) {
            pa.auraRing2.rotation.z += dt * 0.8;
            pa.auraRing2.material.opacity = 0.2 + Math.sin(Game.elapsed * 2) * 0.1;
        }
        if (pa.crown) {
            pa.crown.children.forEach((spike, i) => {
                spike.material.emissiveIntensity = 0.2 + Math.sin(Game.elapsed * 5 + i) * 0.2;
            });
        }

        // Ranged attack (normal enemies only)
        if (e.ranged && !e.isBoss) {
            e.rangedCooldown -= dt;
            if (e.rangedCooldown <= 0 && dist < 18 && dist > 4) {
                enemyRangedAttack(e);
                e.rangedCooldown = 2.5;
                e.attackAnim = 0.3;
            }
        }
        // Boss special attacks — devastating jutsu every 3-5 seconds
        if (e.isBoss) {
            e.bossAttackCooldown -= dt;
            if (e.bossAttackCooldown <= 0 && dist < 30) {
                bossSpecialAttack(e);
                e.bossAttackCooldown = 3.5 + Math.random() * 1.5; // 3.5-5s between specials
            }
            // Boss also does occasional ranged attacks
            e.rangedCooldown -= dt;
            if (e.rangedCooldown <= 0 && dist < 20 && dist > 6) {
                enemyRangedAttack(e);
                e.rangedCooldown = 1.8;
            }
        }

        // Contact damage
        if (dist < e.radius + CONFIG.PLAYER_RADIUS && p.invulnTimer <= 0) {
            damagePlayer(e.damage * Game.damageScale);
            p.invulnTimer = 0.8;
            e.attackAnim = 0.3;
            if (p.thorns > 0) damageEnemy(e, e.damage * p.thorns);
        }

        // Hit flash
        if (e.hitFlash > 0) {
            e.hitFlash -= dt;
            pa.torso.material.emissive = new THREE.Color(0xff0000);
            pa.torso.material.emissiveIntensity = e.hitFlash * 3;
        } else {
            pa.torso.material.emissiveIntensity = 0;
        }
    }

    // Player invuln flash
    if (p.invulnTimer > 0) {
        p.invulnTimer -= dt;
        p.torsoMat.opacity = 0.4 + Math.abs(Math.sin(Game.elapsed * 20)) * 0.6;
        p.torsoMat.transparent = true;
    } else { p.torsoMat.opacity = 1; p.torsoMat.transparent = false; }
}

// ============================================
// PROJECTILE UPDATE (with spin)
// ============================================
function updateProjectiles(dt) {
    for (let i = Game.projectiles.length - 1; i >= 0; i--) {
        const pr = Game.projectiles[i];
        pr.pos.add(pr.dir.clone().multiplyScalar(pr.speed));
        pr.traveled += pr.speed;
        pr.mesh.position.copy(pr.pos);
        pr.spin += dt * 15;
        // Spin stones/daggers around travel axis
        if (pr.mesh.children.length > 0 && !pr.pierce) {
            pr.mesh.children[0].rotation.z = pr.spin;
        }

        let remove = false;
        if (pr.traveled > pr.range) remove = true;
        const b = CONFIG.ARENA_SIZE;
        if (Math.abs(pr.pos.x) > b || Math.abs(pr.pos.z) > b) remove = true;

        if (!remove) {
            if (pr.fromEnemy) {
                // Enemy bolt hits player — use 2D distance (X,Z only)
                const ex = pr.pos.x - Game.player.pos.x;
                const ez = pr.pos.z - Game.player.pos.z;
                const d2d = Math.sqrt(ex * ex + ez * ez);
                if (d2d < CONFIG.PLAYER_RADIUS + 0.6 && Game.player.invulnTimer <= 0) {
                    damagePlayer(pr.damage);
                    Game.player.invulnTimer = 0.6;
                    remove = true;
                }
            } else {
                for (const e of Game.enemies) {
                    if (e.dead || pr.hitEnemies.has(e)) continue;
                    // CRITICAL FIX: use 2D distance (X,Z) — ignore Y
                    // because projectile.y=1.5 and enemy.y=0, 3D distance is always >=1.5
                    const ex = pr.pos.x - e.pos.x;
                    const ez = pr.pos.z - e.pos.z;
                    const d2d = Math.sqrt(ex * ex + ez * ez);
                    if (d2d < e.radius + 0.6) {
                        damageEnemy(e, pr.damage);
                        spawnParticles(pr.pos, pr.color, 5);
                        if (pr.explosive) {
                            for (const e2 of Game.enemies) {
                                if (e2.dead || e2 === e) continue;
                                if (e2.pos.distanceTo(pr.pos) < 4) damageEnemy(e2, pr.damage * 0.5);
                            }
                            spawnParticles(pr.pos, 0xff5500, 20);
                            remove = true;
                        }
                        if (pr.pierce) pr.hitEnemies.add(e);
                        else { remove = true; break; }
                    }
                }
            }
        }
        if (remove) { Game.scene.remove(pr.mesh); Game.projectiles.splice(i, 1); }
    }
}

// ============================================
// PICKUP UPDATE (gold coins magnet)
// ============================================
function updatePickups(dt) {
    const p = Game.player;
    for (let i = Game.pickups.length - 1; i >= 0; i--) {
        const pk = Game.pickups[i];
        pk.bobPhase += dt * 3;
        pk.mesh.position.y = 0.7 + Math.sin(pk.bobPhase) * 0.2;
        if (pk.isHeart) {
            // Hearts spin slowly + pulse glow brighter
            pk.mesh.rotation.y += dt * 3;
            if (pk.glow) {
                pk.glow.position.y = pk.mesh.position.y;
                pk.glow.material.opacity = 0.18 + Math.sin(pk.bobPhase * 2) * 0.1;
            }
        } else {
            pk.mesh.rotation.z += dt * 4;
            if (pk.glow) {
                pk.glow.position.y = pk.mesh.position.y;
                pk.glow.material.opacity = 0.15 + Math.sin(pk.bobPhase * 2) * 0.08;
            }
        }

        // 2D distance (X,Z only) — ignore Y since coin.y=0.7 and player.y=0
        let dx = p.pos.x - pk.pos.x, dz = p.pos.z - pk.pos.z;
        let d2d = Math.sqrt(dx * dx + dz * dz);

        // Magnet + auto-collect: when within pickup range, pull coin and collect
        if (d2d < p.pickupRange) {
            if (d2d > 0.01) {
                // Fast magnet — pull coin toward player
                const pullSpeed = Math.min(0.5, d2d * 0.3);
                pk.pos.x += (dx / d2d) * pullSpeed;
                pk.pos.z += (dz / d2d) * pullSpeed;
                pk.mesh.position.set(pk.pos.x, pk.mesh.position.y, pk.pos.z);
                if (pk.glow) pk.glow.position.set(pk.pos.x, pk.mesh.position.y, pk.pos.z);
            }
                        // Auto-collect when close enough
            if (d2d < CONFIG.PICKUP_COLLECT) {
                if (pk.isHeart) {
                    // Heart: heal 30% of max HP
                    const healAmt = Math.floor(Game.player.maxHp * 0.30);
                    Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + healAmt);
                    spawnFloatingText(pk.pos, '+' + healAmt + ' HP', 'heal');
                    spawnParticles(pk.pos, 0xff3366, 8);
                    updateHUD();
                } else {
                    collectXP(pk.value);
                    spawnFloatingText(pk.pos, '+' + Math.floor(pk.value) + ' XP', 'xp');
                    spawnParticles(pk.pos, 0x2ecc71, 4);
                }
                Game.scene.remove(pk.mesh);
                if (pk.glow) Game.scene.remove(pk.glow);
                Game.pickups.splice(i, 1);
            }
        }
    }
}

// ============================================
// PARTICLE UPDATE (leaves spin & fall)
// ============================================
function updateParticles(dt) {
    for (let i = Game.particles.length - 1; i >= 0; i--) {
        const pt = Game.particles[i];
        pt.mesh.position.add(pt.vel);
        pt.vel.y -= pt.isLeaf ? 0.006 : 0.012;
        if (pt.isLeaf) {
            pt.mesh.rotation.z += pt.rotVel;
            pt.mesh.rotation.x += pt.rotVel * 0.5;
            // leaves drift sideways
            pt.vel.x += Math.sin(pt.life * 5) * 0.003;
        }
        pt.life -= dt;
        pt.mesh.material.opacity = pt.life / pt.maxLife;
        if (pt.life <= 0) { Game.scene.remove(pt.mesh); Game.particles.splice(i, 1); }
    }
}

// ============================================
// DAMAGE PLAYER
// ============================================
function damagePlayer(amount) {
    const p = Game.player;
    p.hp -= amount;
    spawnFloatingText(p.pos, '-' + Math.ceil(amount), 'damage');
    if (p.hp <= 0) { p.hp = 0; gameOver(); }
    updateHUD();
}

// ============================================
// CAMERA FOLLOW — smooth lerp with smoothed target
// ============================================
function updateCamera(dt) {
    const p = Game.player;
    // Target camera position follows player with offset
    const tx = p.pos.x;
    const ty = 38;
    const tz = p.pos.z + 26;
    // Delta-independent smoothing (higher = snappier, lower = smoother)
    const smoothX = 1 - Math.pow(0.001, dt);
    const smoothZ = 1 - Math.pow(0.001, dt);
    const smoothY = 1 - Math.pow(0.0005, dt);
    Game.camera.position.x += (tx - Game.camera.position.x) * smoothX;
    Game.camera.position.y += (ty - Game.camera.position.y) * smoothY;
    Game.camera.position.z += (tz - Game.camera.position.z) * smoothZ;
    // Smooth lookAt target too — avoid snapping
    if (!Game._camLook) Game._camLook = new THREE.Vector3(p.pos.x, 0, p.pos.z);
    Game._camLook.x += (p.pos.x - Game._camLook.x) * smoothX;
    Game._camLook.z += (p.pos.z - Game._camLook.z) * smoothZ;
    Game.camera.lookAt(Game._camLook.x, 0, Game._camLook.z);
}

// ============================================
// HUD UPDATE
// ============================================
function updateHUD() {
    const p = Game.player;
    document.getElementById('hpBar').style.width = (p.hp / p.maxHp * 100) + '%';
    document.getElementById('hpText').textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
    document.getElementById('xpBar').style.width = (p.xp / p.xpToNext * 100) + '%';
    document.getElementById('xpText').textContent = Math.floor(p.xp) + ' / ' + p.xpToNext + ' XP';
    document.getElementById('levelNumber').textContent = p.level;
    document.getElementById('killCount').textContent = 'Foes Felled: ' + Game.killCount;
    const m = Math.floor(Game.elapsed / 60), s = Math.floor(Game.elapsed % 60);
    document.getElementById('timerDisplay').textContent =
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    const stageEl = document.getElementById('stageDisplay');
    if (stageEl) stageEl.textContent = 'Stage ' + Game.currentStage;
    // Update boss HP bar if boss is alive
    if (Game.bossActive) {
        const boss = Game.enemies.find(e => e.isBoss && !e.dead);
        if (boss) updateBossHpBar(boss);
        else hideBossHpBar();
    }
}

function updateAbilityBar() {
    const bar = document.getElementById('abilityBar');
    bar.innerHTML = '';
    const p = Game.player;
    for (const w of p.weapons) {
        const ic = document.createElement('div');
        ic.className = 'ability-icon';
        ic.textContent = WEAPONS[w.id] ? WEAPONS[w.id].icon : 'W';
        ic.title = w.name + ' Lv.' + w.level;
        bar.appendChild(ic);
    }
    for (const a of p.abilities) {
        const ic = document.createElement('div');
        ic.className = 'ability-icon';
        ic.textContent = a.icon;
        ic.title = a.name + ' x' + (a.stacks || 1);
        bar.appendChild(ic);
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (!Game.running) return;

    const dt = Math.min(Game.clock.getDelta(), 0.05);

    if (!Game.paused) {
        Game.elapsed += dt;

        const p = Game.player;
        // Regen
        if (p.regen > 0) {
            p.regenAccum += p.regen * dt;
            if (p.regenAccum >= 1) {
                const h = Math.floor(p.regenAccum);
                p.hp = Math.min(p.maxHp, p.hp + h);
                p.regenAccum -= h;
            }
        }

        updatePlayerMovement(dt);
        tryPlayerAttack();
        updateOrbitWeapons();
        updateEnemies(dt);
        updateProjectiles(dt);
        updatePickups(dt);
        updateParticles(dt);
        updateTreeSway(dt);
        updateChest(dt);
        updateCamera(dt);

        // Stage tracking — each stage = STAGE_DURATION seconds
        const newStage = Math.floor(Game.elapsed / CONFIG.STAGE_DURATION) + 1;
        if (newStage !== Game.currentStage) {
            Game.currentStage = newStage;
            // Chest spawns at designated chest stages (before boss)
            if (CONFIG.CHEST_STAGES.includes(newStage) && !Game.chestStagesSpawned.includes(newStage)) {
                Game.chestStagesSpawned.push(newStage);
                spawnChest();
            }
        }

        // Difficulty: +2% enemy damage every 2 minutes, max +10%
        if (Game.elapsed - Game.lastDamageScaleTime >= 120 && Game.damageScale < 1.10) {
            Game.damageScale = Math.min(1.10, Game.damageScale + 0.02);
            Game.lastDamageScaleTime = Game.elapsed;
            spawnFloatingText(Game.player.pos, 'ENEMIES GROW STRONGER!', 'boss');
        }

        // Enemy spawning — STOPED during boss fight (boss-only duel)
        if (!Game.bossActive) {
            Game.enemySpawnTimer += dt;
            const spawnRate = Math.max(0.5, 2.8 - Game.elapsed * 0.007);
            if (Game.enemySpawnTimer >= spawnRate) {
                Game.enemySpawnTimer = 0;
                const count = 1 + Math.floor(Game.elapsed / 45);
                for (let i = 0; i < count; i++) spawnEnemy(false);
            }
        }

        // Boss spawning on timer
        Game.bossTimer += dt;
        if (Game.bossTimer >= Game.nextBossTime && !Game.bossActive) {
            Game.bossTimer = 0;
            Game.nextBossTime = CONFIG.BOSS_INTERVAL;
            spawnEnemy(true);
        }

        // Victory — survive to MAP_DURATION with no boss active
        if (Game.elapsed >= CONFIG.MAP_DURATION && !Game.bossActive) {
            victory();
        }

        updateHUD();
    }

    Game.renderer.render(Game.scene, Game.camera);
}

// ============================================
// START / RESTART / GAME OVER
// ============================================
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (Game.isTouch) document.getElementById('mobileControls').classList.remove('hidden');
    resetGame();
    Game.running = true;
    Game.clock.start();
}

function resetGame() {
    Game.enemies.forEach(e => Game.scene.remove(e.mesh)); Game.enemies = [];
    Game.projectiles.forEach(p => Game.scene.remove(p.mesh)); Game.projectiles = [];
    Game.pickups.forEach(p => { Game.scene.remove(p.mesh); if (p.glow) Game.scene.remove(p.glow); }); Game.pickups = [];
    Game.particles.forEach(p => Game.scene.remove(p.mesh)); Game.particles = [];
    if (Game.player) Game.scene.remove(Game.player.mesh);

    // Clean up chest
    if (Game.chest) { Game.scene.remove(Game.chest.mesh); Game.chest = null; }
    hideChestNavArrow();
    Game.chestStagesSpawned = [];
    Game.currentStage = 0;

    Game.player = createPlayer();
    Game.player.weapons.push({ ...WEAPONS.longbow, level: 1, lastFire: 0 });
    Game.elapsed = 0;
    Game.killCount = 0;
    Game.enemySpawnTimer = 0;
    Game.bossTimer = 0;
    Game.nextBossTime = CONFIG.BOSS_INTERVAL;
    Game.bossActive = false;
    Game.bossCount = 0;
    Game.bossStagesSpawned = [];
    Game.paused = false;
    hideBossBanner();
    hideBossHpBar();
    document.getElementById('victoryScreen').classList.add('hidden');
    updateHUD();
    updateAbilityBar();
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    resetGame();
    Game.running = true;
}

function gameOver() {
    Game.running = false;
    Game.bossActive = false;
    hideBossBanner();
    hideBossHpBar();
    document.getElementById('goLevel').textContent = Game.player.level;
    document.getElementById('goKills').textContent = Game.killCount;
    const m = Math.floor(Game.elapsed / 60), s = Math.floor(Game.elapsed % 60);
    document.getElementById('goTime').textContent =
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function victory() {
    Game.running = false;
    Game.bossActive = false;
    hideBossBanner();
    hideBossHpBar();
    document.getElementById('vLevel').textContent = Game.player.level;
    document.getElementById('vKills').textContent = Game.killCount;
    const m = Math.floor(Game.elapsed / 60), s = Math.floor(Game.elapsed % 60);
    document.getElementById('vTime').textContent =
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.getElementById('victoryScreen').classList.remove('hidden');
}

function quitToMenu() {
    Game.running = false; Game.paused = false;
    Game.bossActive = false;
    hideBossBanner();
    hideBossHpBar();
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobileControls').classList.add('hidden');
    document.getElementById('victoryScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
}

// ============================================
// UTILS
// ============================================
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
}

// ============================================
// DETECT TOUCH
// ============================================
function detectTouch() {
    const isT = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    Game.isTouch = isT;
    if (isT) document.body.classList.add('touch-device');
}

// ============================================
// BOOT
// ============================================
function boot() {
    detectTouch();
    setupInput();  // Attach button listeners FIRST — works even if Three.js fails
    try {
        initScene();
        Game.clock = new THREE.Clock();
        gameLoop();
    } catch (e) {
        console.error('Three.js init failed:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

})();
