// 🎮 THE ULTIMATE 10 VS 10 BATTLE ARENA - FEATURING LINAN, GOOBALL, ZIGGY & ZAG (THE PINK TWIN)!
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Virtual Resolution
const V_WIDTH = 900;
const V_HEIGHT = 600;
canvas.width = V_WIDTH;
canvas.height = V_HEIGHT;

// Game States
const STATE = {
  TITLE: 'TITLE',
  HERO_SELECT: 'HERO_SELECT',
  WORLD_SELECT: 'WORLD_SELECT',
  PLAYING: 'PLAYING',
  STAGE_CLEAR: 'STAGE_CLEAR',
  SECRET_SHOP: 'SECRET_SHOP',
  VICTORY: 'VICTORY',
  GAME_OVER: 'GAME_OVER'
};

let currentState = STATE.TITLE;
let currentWorld = 1;      // 1 to 10
let maxUnlockedWorld = 1;  // Highest world unlocked
let currentSubLevel = 1;   // 1, 2, or 3 (3 is Boss Stage!)
let score = 0;

// Normal adventure progression: heroes and worlds unlock by defeating bosses.
const UNLOCK_ALL_HEROES_FOR_DEVELOPMENT = true;
if (UNLOCK_ALL_HEROES_FOR_DEVELOPMENT) {
  HEROES.forEach((hero) => {
    if (!hero.isKingston) hero.unlocked = true;
  });
  maxUnlockedWorld = 10;
}

let selectedHero = HEROES[0];
let currentBoss = null;
let newlyUnlockedHero = null;

// Controls & Inputs
const keys = {};
const mouse = { x: 0, y: 0, down: false };

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'e') {
    handleSpecialTrigger();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener('mousedown', (e) => {
  mouse.down = true;
  sounds.init();
  handleScreenClick();
});

canvas.addEventListener('mouseup', () => {
  mouse.down = false;
});

// Game Entities
let player = null;
let bullets = [];
let enemyBullets = [];
let minions = [];
let totalMinionsToSpawn = 0;
let minionsDefeated = 0;
let stars = [];
let particles = [];
let floatingTexts = [];
let confetti = [];
let gooBuddies = [];
let levelObstacles = [];
let starsCollected = 0;
let gameTimer = 0;
let globalMinionShootCooldown = 0;
let secretCash = 0;
let secretSpotFound = false;
let shopStars = 0;
let shopBeforeBoss = false;
let shopSpeedBoost = 0;
let shopHeartBoost = 0;
let shopSpecialBoost = 0;

function getBossLine(data, lineNumber = 0) {
  const lines = data.isVolcanicGiant ? ["WHERE'S MY BABIES?!", "I'LL GET YOU!", "STOMP! STOMP! YOU CAN'T STOP ME!"]
    : data.isDeerOctopus ? ["DJ OCTOPUS IN THE HOUSE!", "I'LL GET YOU WITH MY BEAT!", "LASER DANCE! YOU'RE IN TROUBLE!"]
    : data.isMeteorCannon ? ["BOOM FROM THE VOLCANO!", "I'LL GET YOU!", "KABOOM! RUN AWAY!"]
    : data.isElectricBot ? ["ZZZT! POWERING UP!", "YOU CAN'T STOP MY MACHINE!", "ELECTRIC ATTACK! I'LL GET YOU!"]
    : ["YOU FOUND ME!", "I'LL GET YOU!", "YOU CAN'T STOP ME!"];
  return lines[lineNumber % lines.length];
}

function getLevelIntro(data, isBossLevel) {
  if (isBossLevel) return `${data.name} says: ${getBossLine(data, 0)}`;
  if (data.isElectricBush) return "The little shock bushes whisper: BZZZT! You cannot catch us!";
  return `The ${data.minionName}s say: We are ready to battle!`;
}

class Player {
  constructor(heroData) {
    this.hero = heroData;
    this.x = 100;
    this.y = V_HEIGHT / 2;
    this.radius = 24;
    this.speed = heroData.speed + shopSpeedBoost;
    this.hp = heroData.maxHp + shopHeartBoost;
    this.maxHp = heroData.maxHp + shopHeartBoost;
    this.invulnerableTimer = 0;
    this.specialTimer = 0;
    this.specialCooldown = Math.max(25, heroData.specialCooldown - shopSpecialBoost);
    this.shootTimer = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.animWalk = 0;
    this.bouncePhase = 0;
    this.poisonTimer = 0;
    this.gooChargeTimer = 0;
    this.gooChargeCooldown = 0;
    this.gooChargeVx = 0;
    this.gooChargeVy = 0;
    this.gooChargeDamage = 1;
    this.gooChargeDuration = 0;
    this.gooBounceHeight = 0;
    // World 2's goo pads give every hero a friendly, springy hop.
    this.gooPadBounceTimer = 0;
    this.gooPadBounceDuration = 0;
    this.gooPadBounceHeight = 0;
    this.gooPadVx = 0;
    this.gooPadVy = 0;
    this.jinxyChargeTimer = 0;
    this.jinxyChargeDuration = 72;
    this.jinxyClownOut = false;
    this.jinxyClownTimer = 0;
    this.jinxyHuntTimer = 0;
    this.jinxyHeartsRemaining = 0;
  }

  update() {
    let dx = 0;
    let dy = 0;

    if (this.hero.isJinxyLissy) {
      if (this.jinxyClownOut) {
        this.jinxyClownTimer--;
        this.jinxyHuntTimer--;
        const huntTarget = currentBoss || minions.find((enemy) => !enemy.jinxyDead);
        if (huntTarget && this.jinxyHuntTimer > 0) {
          const huntAngle = Math.atan2(huntTarget.y - this.y, huntTarget.x - this.x);
          this.x += Math.cos(huntAngle) * 4.8;
          this.y += Math.sin(huntAngle) * 4.8;
          if (Math.hypot(huntTarget.x - this.x, huntTarget.y - this.y) < 58 && this.jinxyHeartsRemaining > 0) {
            if (currentBoss) {
              currentBoss.hp -= 1;
              this.jinxyHeartsRemaining--;
              addFloatingText(currentBoss.x, currentBoss.y - 30, "MONSTER BITE! -1 ❤️", "#facc15");
              if (currentBoss.hp <= 0) finishBossFight();
            } else {
              huntTarget.jinxyDead = true;
              this.jinxyHeartsRemaining--;
              score += 300;
              addFloatingText(huntTarget.x, huntTarget.y - 30, "GOTCHA! 👹", "#facc15");
              for (let p = 0; p < 18; p++) spawnParticle(huntTarget.x, huntTarget.y, "#22c55e", 7, 28);
              minions = minions.filter((enemy) => !enemy.jinxyDead);
              if (minions.length === 0) {
                currentState = STATE.STAGE_CLEAR;
                sounds.playVictory();
              }
            }
            if (this.jinxyHeartsRemaining <= 0) this.jinxyClownOut = false;
          }
        }
        if (this.jinxyClownTimer <= 0) this.jinxyClownOut = false;
      } else if (this.jinxyChargeTimer <= 0) {
        const nearbyEnemies = currentBoss ? [currentBoss] : minions;
        const enemyNearby = nearbyEnemies.some((enemy) => Math.hypot(enemy.x - this.x, enemy.y - this.y) < 180);
        if (enemyNearby) {
          this.jinxyChargeTimer = this.jinxyChargeDuration;
          addFloatingText(this.x, this.y - 55, "🔔 ring... ring... RIIIIING!", "#fef08a");
        }
      }
    }

    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.animWalk += 0.25;
      this.bouncePhase += 0.25;
    } else {
      this.bouncePhase += 0.08;
    }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    if (this.jinxyChargeTimer > 0) {
      this.jinxyChargeTimer--;
      dx = 0;
      dy = 0;
      if (this.jinxyChargeTimer === 0) {
        this.jinxyClownOut = true;
        this.jinxyClownTimer = 180;
        this.jinxyHuntTimer = 180;
        this.jinxyHeartsRemaining = 3;
        this.jinxyScareEnemies();
      }
    }

    if (this.gooChargeTimer > 0) {
      this.gooChargeTimer--;
      this.bouncePhase += 0.7;
      const bounceProgress = 1 - (this.gooChargeTimer / this.gooChargeDuration);
      const bounceSize = this.gooChargeDamage === 2 ? 105 : 72;
      this.gooBounceHeight = Math.sin(bounceProgress * Math.PI) * bounceSize;
      this.x += this.gooChargeVx;
      this.y += this.gooChargeVy;
      for (let puff = 0; puff < 2; puff++) {
        spawnParticle(this.x, this.y, "#2ecc71", 6, 18);
      }
    } else {
      this.gooBounceHeight = 0;
      this.x += dx * this.speed;
      this.y += dy * this.speed;
    }

    if (this.gooPadBounceTimer > 0) {
      this.gooPadBounceTimer--;
      const hopProgress = 1 - (this.gooPadBounceTimer / this.gooPadBounceDuration);
      this.gooPadBounceHeight = Math.sin(hopProgress * Math.PI) * 54;
      this.x += this.gooPadVx;
      this.y += this.gooPadVy;
      this.gooPadVx *= 0.9;
      this.gooPadVy *= 0.9;
    } else {
      this.gooPadBounceHeight = 0;
    }

    this.x = Math.max(this.radius + 10, Math.min(V_WIDTH - this.radius - 10, this.x));
    this.y = Math.max(this.radius + 60, Math.min(V_HEIGHT - this.radius - 10, this.y));
    resolvePlayerObstacleCollision(this);

    if (this.invulnerableTimer > 0) this.invulnerableTimer--;
    if (this.specialTimer > 0) this.specialTimer--;
    if (this.shootTimer > 0) this.shootTimer--;
    if (this.gooChargeCooldown > 0) this.gooChargeCooldown--;
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) this.shieldActive = false;
    }

    if (this.poisonTimer > 0) {
      this.poisonTimer--;
      if (Math.random() < 0.3) {
        spawnParticle(this.x, this.y, "#9b59b6", 4, 15);
      }
    }

    if ((keys[' '] || mouse.down) && this.shootTimer <= 0) {
      this.shoot();
      this.shootTimer = this.hero.isKingston ? 4 : (this.hero.isGooball ? 12 : ((this.hero.isZiggyTwin || this.hero.isPinkTwin) ? 10 : 13));
    }

    if ((dx !== 0 || dy !== 0) && Math.random() < 0.35) {
      const trailColor = this.hero.isAlaska
        ? ["#60a5fa", "#fef08a", "#c4b5fd"][Math.floor(Math.random() * 3)]
        : this.hero.color;
      spawnParticle(this.x, this.y, trailColor, this.hero.isAlaska ? 5 : 4, 15);
    }
  }

  shoot() {
    const angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    if (this.hero.isHandman) {
      const angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * 12, vy: Math.sin(angle) * 12,
        radius: 15, color: "#22c55e", damage: 1, type: "hand_slap",
        isHandSlap: true
      });
      sounds.playShoot();
      return;
    } else if (this.hero.isKingston) {
      // Kingston's crown fires a sharp golden leader laser beam.
      bullets.push({
        x: this.x, y: this.y - 30,
        vx: Math.cos(angle) * 22, vy: Math.sin(angle) * 22,
        radius: 11, color: "#fef08a", damage: 1, type: "crown_laser_beam",
        isThunderLaser: true
      });
      sounds.playShoot();
      return;
    } else if (this.hero.isClawman) {
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * 12, vy: Math.sin(angle) * 12,
        radius: 16, color: "#93c5fd", damage: 1, type: "claw_pinch",
        isClawPinch: true
      });
      sounds.playShoot();
      return;
    } else if (this.hero.isAlaska) {
      // Alash fires a big blue-and-yellow electric bolt.
      bullets.push({
        x: this.x, y: this.y - 12,
        vx: Math.cos(angle) * 13, vy: Math.sin(angle) * 13,
        radius: 15, color: "#60a5fa", damage: 1, type: "giant_electric_bolt",
        isElectricBolt: true
      });
      sounds.playShoot();
      return;
    } else if (this.hero.isGooball) {
      this.startGooCharge(angle);
      return;
    }

    sounds.playShoot();
    if (this.hero.isPinkTwin) {
      // Zag shoots pink zigzag cross bolts!
      bullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * 12.5,
        vy: Math.sin(angle) * 12.5,
        radius: 10,
        color: this.hero.color,
        damage: 1,
        type: "pink_zigzag_bolt",
        isZiggyCross: true
      });
    } else if (this.hero.isZiggyTwin) {
      bullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * 12,
        vy: Math.sin(angle) * 12,
        radius: 9,
        color: "#00d2ff",
        damage: 1,
        type: "zigzag_bolt",
        isZiggyCross: true
      });
    } else {
      bullets.push({
        x: this.x,
        y: this.y - 14,
        vx: Math.cos(angle) * 10,
        vy: Math.sin(angle) * 10,
        radius: 9,
        color: "#d980fa",
        damage: 1,
        type: this.hero.attackType,
        isLanternZap: true
      });
    }
  }

  startGooCharge(angle, isMega = false) {
    if (this.gooChargeTimer > 0 || this.gooChargeCooldown > 0) return;
    this.gooChargeTimer = isMega ? 34 : 22;
    this.gooChargeDuration = this.gooChargeTimer;
    this.gooChargeCooldown = isMega ? 95 : 42;
    this.gooChargeDamage = isMega ? 2 : 1;
    const chargeSpeed = isMega ? 16 : 13;
    this.gooChargeVx = Math.cos(angle) * chargeSpeed;
    this.gooChargeVy = Math.sin(angle) * chargeSpeed;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, this.gooChargeTimer);
    sounds.playShoot();
    addFloatingText(this.x, this.y - 30, isMega ? "MEGA HEAD-BOUNCE! 💥" : "HEAD-BOUNCE! 🟢", "#a8ff78");
  }

  stopGooCharge() {
    this.gooChargeTimer = 0;
    this.gooChargeDamage = 1;
    this.gooBounceHeight = 0;
  }

  canHeadBonk() {
    // Every part of Gooball's bounce can bonk a boss for exactly one heart.
    return this.hero.isGooball && this.gooChargeTimer > 0;
  }

  getClosestBadGuyAngle() {
    const targets = currentBoss ? [currentBoss] : minions;
    if (targets.length === 0) {
      return Math.atan2(mouse.y - this.y, mouse.x - this.x);
    }

    let closest = targets[0];
    let closestDistance = Infinity;
    targets.forEach(target => {
      const distance = Math.hypot(target.x - this.x, target.y - this.y);
      if (distance < closestDistance) {
        closest = target;
        closestDistance = distance;
      }
    });
    return Math.atan2(closest.y - this.y, closest.x - this.x);
  }

  jinxyScareEnemies() {
    const targets = currentBoss ? [currentBoss] : minions;
    targets.forEach((enemy) => {
      const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
      enemy.runAwayVx = Math.cos(angle) * 7;
      enemy.runAwayVy = Math.sin(angle) * 7;
      enemy.runAwayTimer = 90;
      enemy.gooeyTimer = 0;
      addFloatingText(enemy.x, enemy.y - 35, "😱 AAAAA!", "#fef08a");
    });
    for (let i = 0; i < 32; i++) {
      const angle = (i * Math.PI * 2) / 32;
      spawnParticle(this.x + Math.cos(angle) * 24, this.y + Math.sin(angle) * 24, i % 2 ? "#22c55e" : "#facc15", 7, 32);
    }
    addFloatingText(this.x, this.y - 70, "AAAA! HAIR FRIGHT! 🤡", "#86efac");

    addFloatingText(this.x, this.y - 92, "THE MONSTER IS HUNTING! 👹", "#facc15");
  }

  triggerSpecial() {
    if (this.specialTimer > 0) return;
    this.specialTimer = this.specialCooldown;
    sounds.playSpecial();

    addFloatingText(this.x, this.y - 35, this.hero.specialName + "!", "#ffd166");

    if (this.hero.isPinkTwin) {
      // ZAG'S PINK STARBURST BLITZ: 10 pink criss-crossing bolts!
      for (let i = 0; i < 10; i++) {
        const ang = (i * 2 * Math.PI) / 10;
        bullets.push({
          x: this.x, y: this.y,
          vx: Math.cos(ang) * 10.5, vy: Math.sin(ang) * 10.5,
          radius: 12, color: this.hero.color, damage: 1, type: "pink_zigzag_bolt",
          isZiggyCross: true
        });
      }
      for (let p = 0; p < 25; p++) spawnParticle(this.x, this.y, this.hero.color, 7, 25);
    } else if (this.hero.isZiggyTwin) {
      // Ziggy's special now hits one target for one heart instead of striking the whole arena.
      const ang = this.getClosestBadGuyAngle();
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(ang) * 10, vy: Math.sin(ang) * 10,
        radius: 11, color: "#00d2ff", damage: 1, type: "zigzag_bolt",
        isZiggyCross: true, singleTargetSpecial: true
      });
      for (let p = 0; p < 8; p++) spawnParticle(this.x, this.y, "#00d2ff", 6, 25);
    } else if (this.hero.isKingston) {
      // One dangerous tornado hunts an enemy and blasts away five hearts on impact.
      const centerAngle = this.getClosestBadGuyAngle();
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(centerAngle) * 10, vy: Math.sin(centerAngle) * 10,
        radius: 48, color: "#fef08a", damage: 5,
        type: "crazy_thunder_laser_tornado", isWinstonTornado: true
      });
      addFloatingText(this.x, this.y - 58, "CRAZY LASER TORNADO! ⚡", "#fef08a");
      for (let p = 0; p < 38; p++) spawnParticle(this.x, this.y, p % 2 ? "#60a5fa" : "#fef08a", 9, 36);
    } else if (this.hero.isGooball) {
      // This bouncy helper keeps looking for a target until it hits something.
      gooBuddies.push({
        x: this.x,
        y: this.y,
        radius: 12,
        life: Infinity,
        bob: 0
      });
      addFloatingText(this.x, this.y - 58, "GOO SHOT, ATTACK! 🟢", "#a8ff78");
      for (let p = 0; p < 12; p++) spawnParticle(this.x, this.y, "#2ecc71", 7, 25);
    } else if (this.hero.isAlaska) {
      // A huge spinning bolt travels forward like a bright electric tornado.
      const ang = this.getClosestBadGuyAngle();
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6,
        radius: 46, color: "#60a5fa", damage: 3, type: "electric_tornado",
        isElectricTornado: true, spin: 0
      });
      addFloatingText(this.x, this.y - 58, "GIANT ELECTRIC TORNADO! ⚡", "#bfdbfe");
      for (let p = 0; p < 32; p++) spawnParticle(this.x, this.y, p % 2 ? "#60a5fa" : "#fef08a", 8, 34);
    } else if (this.hero.isClawman) {
      const ang = this.getClosestBadGuyAngle();
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(ang) * 15, vy: Math.sin(ang) * 15,
        radius: 30, color: "#93c5fd", damage: 3, type: "giant_claw_snap",
        isGiantClaw: true
      });
      addFloatingText(this.x, this.y - 55, "GIANT SKY-SNAP! 🦾", "#dbeafe");
      for (let p = 0; p < 30; p++) spawnParticle(this.x, this.y, "#93c5fd", 8, 32);
    } else if (this.hero.isHandman) {
      const ang = this.getClosestBadGuyAngle();
      // The special is a weird, cool fan of spinning hand slaps.
      for (let slap = -2; slap <= 2; slap++) {
        const slapAngle = ang + slap * 0.24;
        bullets.push({
          x: this.x, y: this.y,
          vx: Math.cos(slapAngle) * 13, vy: Math.sin(slapAngle) * 13,
          radius: 19, color: "#22c55e", damage: 1, type: "cool_hand_slap",
          isHandSlap: true
        });
      }
      addFloatingText(this.x, this.y - 55, "WEIRD COOL SLAP STORM! 🖐️", "#bbf7d0");
      for (let p = 0; p < 24; p++) spawnParticle(this.x, this.y, "#22c55e", 7, 28);
    } else if (this.hero.isJinxyLissy) {
      // Jinxy is trapped in her tinkling box until the clown pops out.
      this.jinxyChargeTimer = this.jinxyChargeDuration;
      this.jinxyClownOut = false;
      addFloatingText(this.x, this.y - 55, "🔔 tinkle... tinkle... TINKLE!", "#fef08a");
    } else if (this.hero.id === 1) {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        bullets.push({
          x: this.x, y: this.y - 14,
          vx: Math.cos(ang) * 9, vy: Math.sin(ang) * 9,
          radius: 12, color: "#d980fa", damage: 1, type: "purple_zap",
          isLanternZap: true
        });
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        bullets.push({
          x: this.x, y: this.y,
          vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8,
          radius: 11, color: this.hero.color, damage: 1, type: "special"
        });
      }
    }
  }

  takeDamage(amount = 1, isPoison = false) {
    if (this.invulnerableTimer > 0 || this.shieldActive) return;
    this.hp -= amount;
    this.invulnerableTimer = 60;
    sounds.playHit();

    if (isPoison) {
      this.poisonTimer = 90;
      addFloatingText(this.x, this.y - 20, "☠️ POISONED! -1 ❤️", "#9b59b6");
    } else {
      addFloatingText(this.x, this.y - 20, "-1 ❤️", "#ff4757");
    }

    if (this.hp <= 0) {
      currentState = STATE.GAME_OVER;
      sounds.playBossExplode();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.hero.isGooball && this.gooChargeTimer > 0) ctx.translate(0, -this.gooBounceHeight);
    if (this.gooPadBounceTimer > 0) ctx.translate(0, -this.gooPadBounceHeight);

    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.shadowBlur = 18;
    ctx.shadowColor = this.hero.color;

    if (this.hero.isKingston) {
      // Kingston is a big golden robot whose crown channels thunder lasers.
      const pulse = (Math.sin(gameTimer * 0.18) + 1) / 2;
      ctx.fillStyle = "#ca8a04";
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(-23, -12, 46, 37, [7]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.arc(0, -17, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath(); ctx.arc(-7, -19, 4, 0, Math.PI * 2); ctx.arc(7, -19, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#854d0e"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI); ctx.stroke();
      // Crown points spark with electricity.
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.moveTo(-17, -32); ctx.lineTo(-14, -50); ctx.lineTo(-5, -38); ctx.lineTo(0, -56); ctx.lineTo(6, -38); ctx.lineTo(16, -50); ctx.lineTo(18, -31); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 3 + pulse * 2;
      ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(8, -65); ctx.lineTo(2, -75); ctx.stroke();
      ctx.strokeStyle = "#ca8a04"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-13, 23); ctx.lineTo(-17, 43); ctx.moveTo(13, 23); ctx.lineTo(17, 43); ctx.stroke();

    } else if (this.hero.isAlaska) {
      // Alaska is an electric human with bright blue hair and little lightning sparks.
      const flicker = Math.sin(gameTimer * 0.22) * 4;
      ctx.translate(0, Math.sin(gameTimer * 0.15) * 6);
      ctx.scale(1.15, 1.15);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 10); ctx.lineTo(-9, 22 + flicker * 0.35);
      ctx.moveTo(0, 10); ctx.lineTo(9, 22 - flicker * 0.35);
      ctx.moveTo(-12, 0); ctx.lineTo(-27, 10);
      ctx.moveTo(12, 0); ctx.lineTo(27, 10);
      ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(-28, 10, 7, 0, Math.PI * 2);
      ctx.arc(28, 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.arc(0, -8, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(-8, -19, 6, 0, Math.PI * 2);
      ctx.arc(0, -24, 7, 0, Math.PI * 2);
      ctx.arc(8, -19, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-5, -7, 3, 0, Math.PI * 2); ctx.arc(5, -7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI); ctx.stroke();
      ctx.lineWidth = 3;
      for (let spark = 0; spark < 5; spark++) {
        const a = gameTimer * 0.18 + spark * (Math.PI * 2 / 5);
        ctx.strokeStyle = ["#60a5fa", "#fef08a", "#c4b5fd"][spark % 3];
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 19, Math.sin(a) * 19);
        ctx.lineTo(Math.cos(a + 0.28) * 24, Math.sin(a + 0.28) * 24);
        ctx.lineTo(Math.cos(a) * 31, Math.sin(a) * 31);
        ctx.stroke();
      }

    } else if (this.hero.isClawman) {
      // Clawman is a blue robot with long red legs and a huge mechanical claw.
      const legSwing = Math.sin(this.animWalk) * 7;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-10, 15); ctx.lineTo(-18, 32 + legSwing); ctx.lineTo(-13, 48 + legSwing);
      ctx.moveTo(10, 15); ctx.lineTo(18, 32 - legSwing); ctx.lineTo(13, 48 - legSwing);
      ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-20, -19, 40, 38, [8]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#dbeafe";
      ctx.beginPath(); ctx.arc(-7, -5, 4, 0, Math.PI * 2); ctx.arc(7, -5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(-7, -5, 1.8, 0, Math.PI * 2); ctx.arc(7, -5, 1.8, 0, Math.PI * 2); ctx.fill();
      // Long arm and a huge three-pronged claw.
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(37, -7); ctx.stroke();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(37, -7); ctx.lineTo(51, -24);
      ctx.moveTo(37, -7); ctx.lineTo(57, -7);
      ctx.moveTo(37, -7); ctx.lineTo(51, 10);
      ctx.stroke();

    } else if (this.hero.isHandman) {
      const sway = Math.sin(gameTimer * 0.14) * 6;
      // Pink legs beneath Hand Man's one pink smiling head.
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, 16); ctx.lineTo(-17, 39 + sway * 0.15);
      ctx.moveTo(9, 16); ctx.lineTo(17, 39 - sway * 0.15);
      ctx.stroke();
      ctx.fillStyle = "#f472b6";
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fce7f3";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Green hair reaches out and becomes Hand Man's green hand.
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-14, -10); ctx.quadraticCurveTo(-8 + sway, -43, 0, -21);
      ctx.quadraticCurveTo(11 - sway, -45, 17, -10);
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(17, -14, 16, 22, [6]); ctx.fill(); ctx.stroke();
      for (let finger = 0; finger < 4; finger++) {
        ctx.beginPath(); ctx.roundRect(17 + finger * 4, -28 - (finger % 2) * 3, 4, 16, [2]); ctx.fill(); ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-7, -2, 4, 0, Math.PI * 2); ctx.arc(7, -2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(-7, -2, 1.8, 0, Math.PI * 2); ctx.arc(7, -2, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 6, 8, 0, Math.PI); ctx.stroke();

    } else if (this.hero.isJinxyLissy) {
      if (this.jinxyChargeTimer > 0 || !this.jinxyClownOut) {
        // The box stays still while its handle rattles and the music-box toot builds.
        const isRinging = this.jinxyChargeTimer > 0;
        const tinkle = isRinging ? 1 + Math.sin(gameTimer * 0.8) * 2 : 0;
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 12 + tinkle * 3;
        ctx.fillStyle = "#2563eb";
        ctx.beginPath();
        ctx.roundRect(-20, -18, 40, 34, [5]);
        ctx.fill();
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -19, 10, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#fef08a";
        ctx.font = `bold ${isRinging ? 12 + tinkle * 2 : 10}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(isRinging ? "🔔" : "🤡", 0, 4);
        ctx.fillStyle = "#fff7ed";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText(isRinging ? "TINKLE" : "JINXY", 0, 12);
      } else {
      // Jinxy is a yellow toy box clown: her legs pop out and her huge green hair bends.
      const hairWiggle = Math.sin(gameTimer * 0.16) * 8;
      const legPop = Math.max(0, Math.sin(gameTimer * 0.2)) * 5;
      ctx.strokeStyle = this.jinxyClownOut ? "#2563eb" : "#14532d";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, 14); ctx.quadraticCurveTo(-18, 23 + legPop, -13 + hairWiggle * 0.2, 34 + legPop);
      ctx.moveTo(9, 14); ctx.quadraticCurveTo(18, 23 - legPop, 13 - hairWiggle * 0.2, 34 - legPop);
      ctx.stroke();

      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.roundRect(-19, -16, 38, 34, [5]);
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -19, 10, Math.PI, 0);
      ctx.stroke();

      if (this.jinxyClownOut) {
        // The clown wakes as a giant yellow round face while the blue box remains below.
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(0, -1, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.moveTo(-17, -12);
      ctx.bezierCurveTo(-30 + hairWiggle, -28, -25, -37, -12 + hairWiggle, -24);
      ctx.bezierCurveTo(-7, -43, 3 + hairWiggle, -31, 2, -22);
      ctx.bezierCurveTo(9, -40, 25 - hairWiggle, -31, 16, -13);
      ctx.lineTo(12, -5); ctx.lineTo(-13, -5); ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(-7, -2, 4, 0, Math.PI * 2);
      ctx.arc(7, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(-7, -2, 1.7, 0, Math.PI * 2);
      ctx.arc(7, -2, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(0, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TOOT", 0, 14);
      }

    // Twin heroes share this design; their configured colors keep each one distinct.
    } else if (this.hero.isPinkTwin) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = this.hero.color;

      const legBob = Math.sin(this.animWalk) * 6;

      ctx.strokeStyle = this.hero.legsColor || "#e84393";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Left zigzag leg
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(-16, 18 + legBob);
      ctx.lineTo(-6, 24 + legBob);
      ctx.lineTo(-15, 31 + legBob);
      ctx.stroke();

      // Right zigzag leg
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(16, 18 - legBob);
      ctx.lineTo(6, 24 - legBob);
      ctx.lineTo(15, 31 - legBob);
      ctx.stroke();

      // Twin body
      ctx.fillStyle = this.hero.color;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Right Eye: Cute round white eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(6, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(7, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Left Eye: THE "X" ON HIS FACE!
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(-3, -1);
      ctx.moveTo(-3, -8);
      ctx.lineTo(-9, -1);
      ctx.stroke();

      // Big Happy Smiling Mouth! (:D)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (this.hero.isZiggyTwin) {
      // 🟣 ZIGGY (PURPLE TWIN)
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#00d2ff";

      const legBob = Math.sin(this.animWalk) * 6;

      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(-16, 18 + legBob);
      ctx.lineTo(-6, 24 + legBob);
      ctx.lineTo(-15, 31 + legBob);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(16, 18 - legBob);
      ctx.lineTo(6, 24 - legBob);
      ctx.lineTo(15, 31 - legBob);
      ctx.stroke();

      ctx.fillStyle = "#8e44ad";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(6, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(7, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(-3, -1);
      ctx.moveTo(-3, -8);
      ctx.lineTo(-9, -1);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (this.hero.isGooball) {
      // 🟢 GOOBALL
      const squishY = 1 + Math.sin(this.bouncePhase) * 0.15;
      const squishX = 1 - Math.sin(this.bouncePhase) * 0.12;

      ctx.scale(squishX, squishY);

      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#a8ff78";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.beginPath();
      ctx.arc(-7, -8, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-6, 0, 5, 0, Math.PI * 2);
      ctx.arc(6, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(-5, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(7, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 5, 4, 0, Math.PI);
      ctx.stroke();

    } else if (this.hero.isStickman) {
      // 🟣 LINAN
      ctx.strokeStyle = "#a55eea";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";

      const legSwing = Math.sin(this.animWalk) * 8;

      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(-7 - legSwing, 22);
      ctx.moveTo(0, 10);
      ctx.lineTo(7 + legSwing, 22);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 10);
      ctx.stroke();

      const aimAng = Math.atan2(mouse.y - this.y, mouse.x - this.x);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(aimAng) * 14, Math.sin(aimAng) * 14);
      ctx.stroke();

      ctx.fillStyle = "#8854d0";
      ctx.beginPath();
      ctx.arc(0, -12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#d980fa";
      ctx.lineWidth = 3;
      const wiggle = Math.sin(gameTimer * 0.1) * 3;

      ctx.beginPath();
      ctx.moveTo(-6, -20);
      ctx.quadraticCurveTo(-15 + wiggle, -14, -14, -4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(wiggle * 2, -30, 4 + wiggle, -15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(6, -20);
      ctx.quadraticCurveTo(15 - wiggle, -14, 14, -4);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-3, -13, 2.5, 0, Math.PI * 2);
      ctx.arc(3, -13, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2c3e50";
      ctx.beginPath();
      ctx.arc(-3, -13, 1.2, 0, Math.PI * 2);
      ctx.arc(3, -13, 1.2, 0, Math.PI * 2);
      ctx.fill();

    } else {
      ctx.fillStyle = this.hero.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.hero.symbol, 0, 1);
    }

    if (this.shieldActive) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Minion {
  constructor(worldData) {
    this.data = worldData;
    this.x = 220 + Math.random() * (V_WIDTH - 300);
    this.y = 100 + Math.random() * (V_HEIGHT - 180);
    this.radius = 18;
    this.hp = 1;
    this.maxHp = 1;
    this.speed = 1.4;
    const ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * this.speed;
    this.vy = Math.sin(ang) * this.speed;
    this.bob = Math.random() * Math.PI * 2;
  }

  update() {
    this.bob += 0.05;

    if (this.data.isPoisonBall) {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 120) { this.x = 120; this.vx = Math.abs(this.vx); }
      if (this.x > V_WIDTH - 80) { this.x = V_WIDTH - 80; this.vx = -Math.abs(this.vx); }
      if (this.y < 80) { this.y = 80; this.vy = Math.abs(this.vy); }
      if (this.y > V_HEIGHT - 60) { this.y = V_HEIGHT - 60; this.vy = -Math.abs(this.vy); }

      if (globalMinionShootCooldown <= 0 && Math.random() < 0.008) {
        globalMinionShootCooldown = 120;
        const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        enemyBullets.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(toPlayer) * 2.2,
          vy: Math.sin(toPlayer) * 2.2,
          radius: 7,
          color: "#9b59b6",
          isPoisonDrop: true
        });
      }
    } else if (this.data.isMineMan) {
      const mineAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(mineAngle) * this.speed * 0.32;
      this.y += Math.sin(mineAngle) * this.speed * 0.22;
      this.y += Math.sin(gameTimer * 0.12) * 1.8;
      this.x = Math.max(120, Math.min(V_WIDTH - 100, this.x));
      this.y = Math.max(110, Math.min(V_HEIGHT - 100, this.y));

    } else if (this.data.isElectricBot) {
      // Little electric cars drive straight toward the hero.
      const chaseAngle = Math.atan2(player.y - this.y, player.x - this.x);
      const distanceToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distanceToPlayer > 42) {
        this.x += Math.cos(chaseAngle) * this.speed * 1.35;
        this.y += Math.sin(chaseAngle) * this.speed * 1.35;
      }
      this.x = Math.max(110, Math.min(V_WIDTH - 60, this.x));
      this.y = Math.max(85, Math.min(V_HEIGHT - 55, this.y));

    } else if (this.data.isDeerOctopus) {
      // Baby DJ octopuses dance in place and fire a disco ball from their faces.
      this.x += this.vx * 0.45;
      this.y += this.vy * 0.45;
      if (this.x < 120 || this.x > V_WIDTH - 70) this.vx *= -1;
      if (this.y < 90 || this.y > V_HEIGHT - 65) this.vy *= -1;
      if (globalMinionShootCooldown <= 0 && Math.random() < 0.011) {
        globalMinionShootCooldown = 80;
        const faceAngle = Math.atan2(player.y - this.y, player.x - this.x);
        enemyBullets.push({
          x: this.x + Math.cos(faceAngle) * 16,
          y: this.y + Math.sin(faceAngle) * 16,
          vx: Math.cos(faceAngle) * 3.5, vy: Math.sin(faceAngle) * 3.5,
          radius: 11, color: "#f0abfc", isDiscoBall: true
        });
      }

    } else if (this.data.isMeteorCannon) {
      // Little volcano cannons roll around and point their lava barrels at the hero.
      const cannonAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(cannonAngle) * this.speed * 0.38;
      this.y += Math.sin(cannonAngle) * this.speed * 0.38;
      this.x = Math.max(110, Math.min(V_WIDTH - 70, this.x));
      this.y = Math.max(90, Math.min(V_HEIGHT - 65, this.y));

    } else if (this.data.isVolcanicGiant) {
      // Tiny Baby Giants stomp slowly toward the player across the volcanic lands.
      const chaseAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(chaseAngle) * this.speed * 0.7;
      this.y += Math.sin(chaseAngle) * this.speed * 0.7;
      this.x = Math.max(110, Math.min(V_WIDTH - 70, this.x));
      this.y = Math.max(90, Math.min(V_HEIGHT - 65, this.y));

    } else if (this.data.isVolcanicFridge) {
      // Baby refrigerators skitter normally, but flee when Jinxy scares them.
      if (this.runAwayTimer > 0) {
        this.runAwayTimer--;
        this.x += this.runAwayVx;
        this.y += this.runAwayVy;
      } else {
        this.x += this.vx;
        this.y += this.vy;
      }
      if (this.x < 120 || this.x > V_WIDTH - 70) this.vx *= -1;
      if (this.y < 80 || this.y > V_HEIGHT - 55) this.vy *= -1;

    } else if (this.data.isVacuum) {
      // Baby Slissies actively roll toward the hero instead of standing still.
      const chaseAngle = Math.atan2(player.y - this.y, player.x - this.x);
      const distanceToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distanceToPlayer > 55) {
        this.x += Math.cos(chaseAngle) * this.speed * 0.7;
        this.y += Math.sin(chaseAngle) * this.speed * 0.7;
      }
      this.x = Math.max(110, Math.min(V_WIDTH - 50, this.x));
      this.y = Math.max(80, Math.min(V_HEIGHT - 45, this.y));

    } else if (this.data.isEggSquid) {
      this.x += this.vx * 0.8;
      this.y += Math.sin(this.bob * 3) * 2;

      if (this.x < 140 || this.x > V_WIDTH - 90) this.vx *= -1;
    }

    resolveEnemyObstacleCollision(this);
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.data.isElectricBush) {
      const charge = (Math.sin(this.bob * 5) + 1) / 2;
      ctx.shadowBlur = 18 + charge * 10;
      ctx.shadowColor = "#ffd32a";

      ctx.strokeStyle = `rgba(134, 239, 255, ${0.45 + charge * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -this.bob * 12;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + charge * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      ctx.fillStyle = "#27ae60";
      ctx.beginPath();
      ctx.arc(-8, 4, 12, 0, Math.PI * 2);
      ctx.arc(8, 4, 12, 0, Math.PI * 2);
      ctx.arc(0, -6, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffd32a";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = "#fff7a1";
      ctx.lineWidth = 2;
      for (let spark = 0; spark < 3; spark++) {
        const a = this.bob * 4 + spark * (Math.PI * 2 / 3);
        const sx = Math.cos(a) * 17;
        const sy = Math.sin(a) * 17;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a + 0.5) * 7, sy + Math.sin(a + 0.5) * 7);
        ctx.lineTo(sx + Math.cos(a - 0.25) * 13, sy + Math.sin(a - 0.25) * 13);
        ctx.stroke();
      }

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.arc(4, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(-4, -4, 1.5, 0, Math.PI * 2);
      ctx.arc(4, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.data.isVolcanicFridge) {
      const heat = (Math.sin(gameTimer * 0.18) + 1) * 0.5;
      ctx.scale(0.58, 0.58);
      ctx.fillStyle = "#9a3412";
      ctx.beginPath();
      ctx.moveTo(-24, -42); ctx.lineTo(-9, -70); ctx.lineTo(0, -52); ctx.lineTo(12, -76); ctx.lineTo(25, -42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(-4, -67, 5, 0, Math.PI * 2);
      ctx.arc(11, -79, 4, 0, Math.PI * 2);
      ctx.fill();
      // Lava glow and a grimy, old appliance body.
      ctx.shadowColor = "#fb4b18";
      ctx.shadowBlur = 24 + heat * 16;
      ctx.fillStyle = "#4a1d12";
      ctx.beginPath();
      ctx.roundRect(-36, -47, 72, 94, [8, 8, 12, 12]);
      ctx.fill();
      ctx.fillStyle = "#8f2d14";
      ctx.beginPath();
      ctx.roundRect(-30, -41, 60, 78, [5, 5, 10, 10]);
      ctx.fill();
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 3;
      ctx.stroke();

      // The top freezer seam and hot magma leaks make it look volcanic.
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-29, -18);
      ctx.lineTo(29, -18);
      ctx.moveTo(-18, 39);
      ctx.lineTo(-9, 24);
      ctx.lineTo(0, 42);
      ctx.lineTo(12, 22);
      ctx.lineTo(22, 38);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 236, 153, ${0.35 + heat * 0.45})`;
      ctx.beginPath();
      ctx.arc(-18, 39, 4, 0, Math.PI * 2);
      ctx.arc(0, 42, 4, 0, Math.PI * 2);
      ctx.arc(22, 38, 4, 0, Math.PI * 2);
      ctx.fill();

      // Gross, fuzzy moss clumps crawl down the sides.
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#4d7c0f";
      [[-33, -28, 9], [-29, -6, 7], [-33, 16, 9], [29, 22, 8], [25, -34, 6]].forEach(([x, y, size]) => {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.arc(x + 5, y + 4, size * 0.72, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#84cc16";
      [[-34, -30], [-30, 15], [29, 21]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Angry glowing eyes above the refrigerator's toothy door-mouth.
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.ellipse(-13, -5, 10, 8, -0.22, 0, Math.PI * 2);
      ctx.ellipse(13, -5, 10, 8, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(-11, -4, 4, 0, Math.PI * 2);
      ctx.arc(11, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#160b08";
      ctx.beginPath();
      ctx.roundRect(-24, 9, 48, 23, [4, 4, 8, 8]);
      ctx.fill();
      ctx.fillStyle = "#fff7d6";
      for (let tooth = 0; tooth < 5; tooth++) {
        const x = -19 + tooth * 9.5;
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x + 7, 10);
        ctx.lineTo(x + 3.5, 19 + (tooth % 2) * 3);
        ctx.closePath();
        ctx.fill();
      }
      for (let tooth = 0; tooth < 4; tooth++) {
        const x = -15 + tooth * 10;
        ctx.beginPath();
        ctx.moveTo(x, 31);
        ctx.lineTo(x + 7, 31);
        ctx.lineTo(x + 3.5, 23);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#2d160d";
      ctx.fillRect(-24, 44, 12, 7);
      ctx.fillRect(12, 44, 12, 7);

    } else if (this.data.isVacuum) {
      // Baby Slissies are small, active versions of the green vacuum boss.
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(-4, -12, 19, 22, [6]);
      ctx.fill();
      ctx.strokeStyle = "#dcfce7";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(-12, 1, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dcfce7";
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(2, -5, 3.5, 0, Math.PI * 2);
      ctx.arc(10, -5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.arc(3, -5, 1.5, 0, Math.PI * 2);
      ctx.arc(11, -5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(0, 12, 3.5, 0, Math.PI * 2);
      ctx.arc(11, 12, 3.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.data.isPoisonBall) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#9b59b6";

      ctx.fillStyle = "#8e44ad";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#e056fd";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.arc(5, 3, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🟣", 0, 4);

    } else if (this.data.isMineMan) {
      // Tiny baby versions of Mine Man: small red boxes with blue outlines and little legs.
      const hop = Math.sin(this.bob * 3) * 2;
      ctx.translate(0, hop);
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-13, -14, 26, 25, [4]);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-7, 11); ctx.lineTo(-11, 19);
      ctx.moveTo(7, 11); ctx.lineTo(11, 19);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("mine", 0, 2);

    } else if (this.data.isElectricBot) {
      // A teeny electric car with a glowing lightning roof-light.
      const buzz = (Math.sin(this.bob * 6) + 1) / 2;
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 8 + buzz * 10;
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(-17, -9, 34, 18, [5]);
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(-10, 10, 5, 0, Math.PI * 2); ctx.arc(10, 10, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fef08a";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡", 0, 4);

    } else if (this.data.isDeerOctopus) {
      // Tiny baby DJ octopuses dance while serving their DJ boss.
      const dance = Math.sin(this.bob * 7) * 5;
      ctx.translate(0, dance);
      const tentacleColors = ["#f472b6", "#60a5fa", "#22c55e", "#facc15"];
      ctx.lineCap = "round";
      ctx.lineWidth = 4;
      for (let leg = -2; leg <= 2; leg++) {
        ctx.strokeStyle = tentacleColors[(leg + 2) % tentacleColors.length];
        ctx.beginPath();
        ctx.moveTo(leg * 5, 7);
        ctx.quadraticCurveTo(leg * 7 + dance, 16, leg * 7 - dance, 22);
        ctx.stroke();
      }
      ctx.shadowColor = "#ec4899";
      ctx.shadowBlur = 13;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f0abfc"; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      ctx.fillStyle = "#93c5fd";
      ctx.beginPath(); ctx.arc(-5, -2, 3, 0, Math.PI * 2); ctx.arc(5, -2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#172554"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(1, 6, 5, 0.2, Math.PI - 0.2); ctx.stroke();

    } else if (this.data.isMeteorCannon) {
      // A tiny volcano with a glowing cannon barrel sticking out of its crater.
      ctx.shadowColor = "#fb923c"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath(); ctx.moveTo(-18, 13); ctx.lineTo(0, -20); ctx.lineTo(18, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath(); ctx.ellipse(0, -12, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.rotate(Math.atan2(player.y - this.y, player.x - this.x));
      ctx.fillStyle = "#475569";
      ctx.beginPath(); ctx.roundRect(0, -6, 24, 12, [4]); ctx.fill();
      ctx.fillStyle = "#fed7aa";
      ctx.beginPath(); ctx.arc(24, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

    } else if (this.data.isVolcanicGiant) {
      const stomp = Math.sin(this.bob * 5) * 3;
      ctx.strokeStyle = "#5b2a13"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-7, 9); ctx.lineTo(-10, 20 + stomp); ctx.moveTo(7, 9); ctx.lineTo(10, 20 - stomp); ctx.stroke();
      ctx.fillStyle = "#b45309";
      ctx.beginPath(); ctx.arc(0, -2, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#78350f"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#86efac";
      ctx.beginPath(); ctx.arc(-5, -5, 3, 0, Math.PI * 2); ctx.arc(5, -5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff7d6";
      ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(-3, 5); ctx.lineTo(-5.5, 11); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3, 5); ctx.lineTo(8, 5); ctx.lineTo(5.5, 11); ctx.closePath(); ctx.fill();

    } else if (this.data.isEggSquid) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff7979";

      ctx.fillStyle = "#f9ca24";
      ctx.beginPath();
      ctx.arc(-6, 12, 4, 0, Math.PI * 2);
      ctx.arc(6, 12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f5f6fa";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#dcdde1";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#2f3640";
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();

    } else {
      ctx.fillStyle = this.data.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Boss {
  constructor(data) {
    this.data = data;
    this.x = V_WIDTH - 160;
    this.y = V_HEIGHT / 2;
    this.radius = data.isVolcanicGiant ? 72 : 42;
    this.hp = data.maxHp;
    this.maxHp = data.maxHp;
    this.speed = data.speed;
    this.direction = 1;
    this.shockPulse = 0;
    this.runAwayTimer = 0;
    this.runAwayVx = 0;
    this.runAwayVy = 0;
    this.attackTimer = 0;
    this.gooeyTimer = 0;

    const ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * this.speed;
    this.vy = Math.sin(ang) * this.speed;
    this.toxicDripTimer = 0;

    this.isHatched = false;
    this.squidChaseSpeed = 3.6;
    this.inkTimer = 0;
    this.eggWobble = 0;
    this.suctionPulse = 0;
    this.suctionAttackTimer = 0;
    this.fridgeHop = Math.random() * Math.PI * 2;
    this.lanternTimer = 0;
    this.hasEmerged = !data.isVolcanicGiant;
    this.emergeTalkTimer = 0;
    if (data.isVolcanicGiant) {
      this.x = V_WIDTH - 165;
      this.y = V_HEIGHT / 2;
    }
  }

  update() {
    this.shockPulse += 0.08;
    this.eggWobble += 0.05;
    this.suctionPulse += 0.14;
    this.suctionAttackTimer++;
    this.fridgeHop += 0.16;
    if (this.gooeyTimer > 0) this.gooeyTimer--;

    const speedMultiplier = this.gooeyTimer > 0 ? 0.45 : 1.0;

    if (this.data.isEggSquid) {
      if (this.hp <= 3) {
        this.isHatched = true;
      }

      if (this.isHatched) {
        const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(toPlayer) * this.squidChaseSpeed * speedMultiplier;
        this.y += Math.sin(toPlayer) * this.squidChaseSpeed * speedMultiplier;

        this.inkTimer++;
        if (this.inkTimer >= 55) {
          this.inkTimer = 0;
          for (let i = -1; i <= 1; i++) {
            const spreadAng = toPlayer + (i * 0.35);
            enemyBullets.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(spreadAng) * 3.8,
              vy: Math.sin(spreadAng) * 3.8,
              radius: 9,
              color: "#ff4757"
            });
          }
        }
      } else {
        this.y += Math.sin(this.eggWobble) * 1.5;
        this.x += Math.cos(this.eggWobble * 0.5) * 1.2;

        this.x = Math.max(200, Math.min(V_WIDTH - 80, this.x));
        this.y = Math.max(100, Math.min(V_HEIGHT - 80, this.y));
      }

    } else if (this.data.isMineMan) {
      const mineAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(mineAngle) * this.speed * 0.32 * speedMultiplier;
      this.y += Math.sin(mineAngle) * this.speed * 0.22 * speedMultiplier;
      this.y += Math.sin(gameTimer * 0.12) * 1.8;
      this.x = Math.max(120, Math.min(V_WIDTH - 100, this.x));
      this.y = Math.max(110, Math.min(V_HEIGHT - 100, this.y));
      this.attackTimer++;
      if (this.attackTimer >= 70) {
        this.attackTimer = 0;
        enemyBullets.push({ x: this.x, y: this.y + 30, vx: Math.cos(mineAngle) * 3.2, vy: Math.sin(mineAngle) * 3.2, radius: 12, color: "#ef4444", isMine: true });
        addFloatingText(this.x, this.y - 62, "MINE! MINE! MINE!", "#fca5a5");
      }

    } else if (this.data.isDeerOctopus) {
      // It floats toward the hero and shoots three colourful DJ lasers.
      const octopusAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(octopusAngle) * this.speed * 0.25 * speedMultiplier;
      this.y += Math.sin(octopusAngle) * this.speed * 0.18 * speedMultiplier;
      this.y += Math.sin(gameTimer * 0.12) * 1.8;
      this.x = Math.max(110, Math.min(V_WIDTH - 100, this.x));
      this.y = Math.max(110, Math.min(V_HEIGHT - 105, this.y));
      this.attackTimer++;
      if (this.attackTimer >= 78) {
        this.attackTimer = 0;
        for (let bubble = -1; bubble <= 1; bubble++) {
          const angle = octopusAngle + bubble * 0.3;
          enemyBullets.push({ x: this.x, y: this.y, vx: Math.cos(angle) * 4.5, vy: Math.sin(angle) * 4.5, radius: 8, color: ["#ec4899", "#60a5fa", "#22c55e"][bubble + 1], isDjLaser: true });
        }
        addFloatingText(this.x, this.y - 64, "DJ LASERS!", "#f0abfc");
      }

    } else if (this.data.isVolcanicGiant) {
      // He waits inside his volcano until the hero walks close enough to wake him.
      if (!this.hasEmerged) {
        if (Math.hypot(player.x - this.x, player.y - this.y) < 190) {
          this.hasEmerged = true;
          this.emergeTalkTimer = 60;
          addFloatingText(this.x, this.y - 108, "WHERE'S MY BABIES?!", "#fed7aa");
        }
        return;
      }
      if (this.emergeTalkTimer > 0) {
        this.emergeTalkTimer--;
        return;
      }
      // The huge giant comes outside his volcano and chases at a heavy medium pace.
      const giantAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(giantAngle) * this.speed * 0.72 * speedMultiplier;
      this.y += Math.sin(giantAngle) * this.speed * 0.58 * speedMultiplier;
      this.y += Math.sin(gameTimer * 0.08) * 0.7;
      this.x = Math.max(130, Math.min(V_WIDTH - 110, this.x));
      this.y = Math.max(125, Math.min(V_HEIGHT - 130, this.y));
      this.attackTimer++;
      if (this.attackTimer >= 88) {
        this.attackTimer = 0;
        // The final boss launches a tiny erupting volcano from his open mouth.
        // A small spread makes the asteroid feel like a big, dangerous spit attack.
        for (let rock = -1; rock <= 1; rock++) {
          const spitAngle = giantAngle + rock * 0.16;
          const mouthX = this.x + Math.cos(spitAngle) * 42;
          const mouthY = this.y - 30 + Math.sin(spitAngle) * 18;
          enemyBullets.push({
            x: mouthX,
            y: mouthY,
            vx: Math.cos(spitAngle) * 4.35,
            vy: Math.sin(spitAngle) * 4.35,
            radius: 20,
            color: "#f97316",
            isVolcanoAsteroid: true
          });
        }
        addFloatingText(this.x, this.y - 94, "VOLCANO ASTEROID SPIT! ☄️🌋", "#fed7aa");
        for (let spark = 0; spark < 14; spark++) spawnParticle(this.x, this.y - 30, "#fb923c", 7, 26);
      }

    } else if (this.data.isMeteorCannon) {
      // Meteor Cannon rises, swoops, and fires explosive meteor-bullets at the hero.
      const meteorAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(meteorAngle) * this.speed * 0.28 * speedMultiplier;
      this.y += Math.sin(gameTimer * 0.08) * 2.8;
      this.x = Math.max(120, Math.min(V_WIDTH - 100, this.x));
      this.y = Math.max(100, Math.min(V_HEIGHT - 110, this.y));
      this.attackTimer++;
      if (this.attackTimer >= 75) {
        this.attackTimer = 0;
        enemyBullets.push({
          x: this.x, y: this.y,
          vx: Math.cos(meteorAngle) * 4.6, vy: Math.sin(meteorAngle) * 4.6,
          radius: 15, color: "#f97316", isMeteorBlast: true
        });
        addFloatingText(this.x, this.y - 58, "BOOM! ☄️", "#fed7aa");
        for (let p = 0; p < 12; p++) spawnParticle(this.x, this.y, "#fb923c", 7, 25);
      }

    } else if (this.data.isElectricBot) {
      // Electric Bot cruises around the arena like a robotic car.
      this.x += this.vx * speedMultiplier;
      this.y += this.vy * speedMultiplier;
      if (this.x < 130 || this.x > V_WIDTH - 110) this.vx *= -1;
      if (this.y < 110 || this.y > V_HEIGHT - 105) this.vy *= -1;
      this.lanternTimer++;
      if (this.lanternTimer >= 95) {
        this.lanternTimer = 0;
        sounds.playLanternBuzz();
        addFloatingText(this.x, this.y - 100, "zzzt! ⚡", "#fef08a");
      }

    } else if (this.data.isVolcanicFridge) {
      if (this.runAwayTimer > 0) {
        this.runAwayTimer--;
        this.x += this.runAwayVx;
        this.y += this.runAwayVy;
      } else {
        const fridgeAngle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(fridgeAngle) * this.speed * 0.38 * speedMultiplier;
        this.y += Math.sin(fridgeAngle) * this.speed * 0.38 * speedMultiplier;
        this.attackTimer++;
        if (this.attackTimer >= 85) {
          this.attackTimer = 0;
          for (let flame = -1; flame <= 1; flame++) {
            const angle = fridgeAngle + flame * 0.24;
            enemyBullets.push({ x: this.x, y: this.y + 12, vx: Math.cos(angle) * 4.2, vy: Math.sin(angle) * 4.2, radius: 9, color: "#fb923c" });
          }
          addFloatingText(this.x, this.y - 58, "LAVA BREATH! 🌋", "#fef08a");
        }
      }
      this.x = Math.max(100, Math.min(V_WIDTH - 80, this.x));
      this.y = Math.max(95, Math.min(V_HEIGHT - 80, this.y));

    } else if (this.data.isVacuum) {
      const suctionAngle = Math.atan2(player.y - this.y, player.x - this.x);
      const distanceToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      const isSuctionAttacking = this.suctionAttackTimer % 180 >= 75;
      const preferredDistance = 210;

      // Slissy Missy roams toward the hero instead of waiting in one spot.
      if (distanceToPlayer > preferredDistance) {
        this.x += Math.cos(suctionAngle) * this.speed * 0.6 * speedMultiplier;
        this.y += Math.sin(suctionAngle) * this.speed * 0.6 * speedMultiplier;
      }
      this.x = Math.max(110, Math.min(V_WIDTH - 70, this.x));
      this.y = Math.max(90, Math.min(V_HEIGHT - 70, this.y));

      // Her timed suction attack pulls the hero in, then damages them at the nozzle.
      if (isSuctionAttacking && distanceToPlayer < 400 && distanceToPlayer > this.radius + player.radius) {
        const pullStrength = (1 - distanceToPlayer / 400) * 1.5 * speedMultiplier;
        // suctionAngle points from Slissy Missy to the hero, so move the hero back toward her.
        player.x -= Math.cos(suctionAngle) * pullStrength;
        player.y -= Math.sin(suctionAngle) * pullStrength;
        player.x = Math.max(player.radius + 10, Math.min(V_WIDTH - player.radius - 10, player.x));
        player.y = Math.max(player.radius + 60, Math.min(V_HEIGHT - player.radius - 10, player.y));

        if (Math.random() < 0.18) {
          const puffDistance = Math.max(this.radius + 20, distanceToPlayer * 0.55);
          spawnParticle(this.x + Math.cos(suctionAngle) * puffDistance, this.y + Math.sin(suctionAngle) * puffDistance, "#bbf7d0", 4, 16);
        }
      }

      if (isSuctionAttacking && distanceToPlayer < this.radius + player.radius + 14) {
        player.takeDamage(1, false);
      }

    } else if (this.data.isPoisonBall) {
      this.x += this.vx * speedMultiplier;
      this.y += this.vy * speedMultiplier;

      if (this.x < 120) { this.x = 120; this.vx = Math.abs(this.vx); sounds.playHit(); }
      else if (this.x > V_WIDTH - 60) { this.x = V_WIDTH - 60; this.vx = -Math.abs(this.vx); sounds.playHit(); }

      if (this.y < 80) { this.y = 80; this.vy = Math.abs(this.vy); sounds.playHit(); }
      else if (this.y > V_HEIGHT - 60) { this.y = V_HEIGHT - 60; this.vy = -Math.abs(this.vy); sounds.playHit(); }

      this.toxicDripTimer++;
      if (this.toxicDripTimer >= 50) {
        this.toxicDripTimer = 0;
        enemyBullets.push({
          x: this.x, y: this.y,
          vx: (Math.random() - 0.5) * 2.2,
          vy: (Math.random() - 0.5) * 2.2,
          radius: 9, color: "#9b59b6",
          isPoisonDrop: true
        });
      }

    } else if (this.data.isElectricBush) {
      if (this.runAwayTimer > 0) {
        this.runAwayTimer--;
        this.x += this.runAwayVx;
        this.y += this.runAwayVy;

        this.x = Math.max(150, Math.min(V_WIDTH - 80, this.x));
        this.y = Math.max(100, Math.min(V_HEIGHT - 80, this.y));
      } else {
        this.y += this.speed * speedMultiplier * this.direction;
        if (this.y > V_HEIGHT - 90 || this.y < 120) {
          this.direction *= -1;
        }
      }
    }

    if (!this.data.isVolcanicGiant) resolveEnemyObstacleCollision(this);
  }

  getHit(isGoo = false, damage = 1) {
    this.hp -= damage;
    sounds.playHit();

    if (this.data.isEggSquid) {
      if (this.hp === 3) {
        this.isHatched = true;
        sounds.playBossExplode();
        addFloatingText(this.x, this.y - 45, "💥 POP! 🦑 SQUID HATCHED!", "#ff4757");
        for (let p = 0; p < 35; p++) spawnParticle(this.x, this.y, "#f5f6fa", 8, 35);
      } else if (this.hp > 3) {
        const cracks = 8 - this.hp;
        addFloatingText(this.x, this.y - 35, `🥚 CRACK LEVEL ${cracks}! (${this.hp} ❤️ left)`, "#ffd166");
        for (let p = 0; p < 15; p++) spawnParticle(this.x, this.y, "#f5f6fa", 5, 20);
      } else {
        addFloatingText(this.x, this.y - 35, `🦑 OUCH! (${this.hp} ❤️ left)`, "#ff4757");
        for (let p = 0; p < 15; p++) spawnParticle(this.x, this.y, "#ff6b81", 6, 25);
      }
    } else {
      if (isGoo) {
        this.gooeyTimer = 140;
        addFloatingText(this.x, this.y - 35, `🟢 SPLAT! COVERED IN GOO! (${this.hp} ❤️ left)`, "#2ecc71");
      } else {
        addFloatingText(this.x, this.y - 35, `⚡ OUCH! (${this.hp} ❤️ left)`, "#ffd32a");
      }

      if (this.data.isPoisonBall) {
        this.vx = -this.vx + (Math.random() - 0.5);
        this.vy = -this.vy + (Math.random() - 0.5);
      } else {
        const ang = Math.atan2(this.y - player.y, this.x - player.x) + (Math.random() - 0.5) * 0.5;
        this.runAwayVx = Math.cos(ang) * 5.5;
        this.runAwayVy = Math.sin(ang) * 5.5;
        this.runAwayTimer = 35;
      }
    }

    for (let p = 0; p < 12; p++) spawnParticle(this.x, this.y, isGoo ? "#2ecc71" : this.data.color, 6, 25);
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.data.isEggSquid) {
      if (this.isHatched) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#ff4757";

        const tentTime = gameTimer * 0.2;
        ctx.strokeStyle = "#ff6b81";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";

        for (let t = -3; t <= 3; t++) {
          const tx = t * 9;
          const wave = Math.sin(tentTime + t * 0.8) * 14;
          ctx.beginPath();
          ctx.moveTo(tx, 15);
          ctx.quadraticCurveTo(tx + wave, 35, tx - wave, 55);
          ctx.stroke();
        }

        ctx.fillStyle = "#ff4757";
        ctx.beginPath();
        ctx.ellipse(0, 0, 32, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-12, -4, 11, 0, Math.PI * 2);
        ctx.arc(12, -4, 11, 0, Math.PI * 2);
        ctx.fill();

        const pupilAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const px = Math.cos(pupilAngle) * 4;
        const py = Math.sin(pupilAngle) * 4;

        ctx.fillStyle = "#111111";
        ctx.beginPath();
        ctx.arc(-12 + px, -4 + py, 5.5, 0, Math.PI * 2);
        ctx.arc(12 + px, -4 + py, 5.5, 0, Math.PI * 2);
        ctx.fill();

      } else {
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#f5f6fa";

        ctx.fillStyle = "#f5f6fa";
        ctx.beginPath();
        ctx.ellipse(0, 0, 36, 48, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#dcdde1";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#e056fd";
        ctx.beginPath();
        ctx.arc(-15, -15, 4, 0, Math.PI * 2);
        ctx.arc(14, -8, 5, 0, Math.PI * 2);
        ctx.arc(-10, 20, 6, 0, Math.PI * 2);
        ctx.arc(12, 22, 4, 0, Math.PI * 2);
        ctx.fill();

        const crackCount = 8 - this.hp;

        if (crackCount >= 1) {
          ctx.strokeStyle = "#2f3640";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -42);
          ctx.lineTo(-8, -25);
          ctx.lineTo(6, -10);
          ctx.lineTo(-4, 8);
          ctx.stroke();
        }

        if (crackCount >= 3) {
          ctx.strokeStyle = "#ff4757";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(6, -10);
          ctx.lineTo(24, 0);
          ctx.lineTo(16, 25);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-8, -25);
          ctx.lineTo(-26, -12);
          ctx.lineTo(-20, 15);
          ctx.stroke();

          ctx.fillStyle = "rgba(255, 71, 87, 0.7)";
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (this.gooeyTimer > 0) {
        ctx.fillStyle = "rgba(46, 204, 113, 0.75)";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (this.data.isVacuum) {
      const suctionAngle = player ? Math.atan2(player.y - this.y, player.x - this.x) : Math.PI;
      ctx.save();
      ctx.rotate(suctionAngle + Math.PI);

      // The translucent cone shows exactly where Slissy Missy is trying to suck the hero in.
      const isSuctionAttacking = this.suctionAttackTimer % 180 >= 75;
      const conePulse = isSuctionAttacking ? 0.2 + (Math.sin(this.suctionPulse) + 1) * 0.08 : 0.06;
      ctx.fillStyle = `rgba(187, 247, 208, ${conePulse})`;
      ctx.beginPath();
      ctx.moveTo(-36, -18);
      ctx.lineTo(-330, -105);
      ctx.lineTo(-330, 105);
      ctx.lineTo(-36, 18);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      for (let ring = 0; ring < 4; ring++) {
        const x = -88 - ring * 58 + Math.sin(this.suctionPulse + ring) * 8;
        ctx.beginPath();
        ctx.arc(x, 0, 10 + ring * 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(-20, -32, 64, 64, [16]);
      ctx.fill();
      ctx.strokeStyle = "#dcfce7";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(-38, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dcfce7";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(10, -10, 7, 0, Math.PI * 2);
      ctx.arc(28, -10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.arc(11, -10, 3, 0, Math.PI * 2);
      ctx.arc(29, -10, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(19, 8, 9, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.fillRect(-8, 30, 16, 10);
      ctx.fillRect(28, 30, 16, 10);
      ctx.restore();

    } else if (this.data.isPoisonBall) {
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#9b59b6";

      ctx.fillStyle = "#8e44ad";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(-14, -12, 7, 0, Math.PI * 2);
      ctx.arc(16, -10, 8, 0, Math.PI * 2);
      ctx.arc(-10, 16, 9, 0, Math.PI * 2);
      ctx.arc(14, 14, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#e056fd";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-10, -4, 8, 0, Math.PI * 2);
      ctx.arc(10, -4, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2c003e";
      ctx.beginPath();
      ctx.arc(-8, -4, 4, 0, Math.PI * 2);
      ctx.arc(12, -4, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2ecc71";
      const drip = Math.sin(gameTimer * 0.15) * 6;
      ctx.beginPath();
      ctx.arc(0, 20 + drip, 6, 0, Math.PI * 2);
      ctx.fill();

      if (this.gooeyTimer > 0) {
        ctx.fillStyle = "rgba(46, 204, 113, 0.75)";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (this.data.isElectricBush) {
      const shockR = this.data.shockRadius + Math.sin(this.shockPulse) * 6;
      ctx.strokeStyle = "rgba(255, 230, 0, 0.45)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, shockR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 230, 0, 0.08)";
      ctx.beginPath();
      ctx.arc(0, 0, shockR, 0, Math.PI * 2);
      ctx.fill();

      // A faster blue-white charge ring makes the bush feel energized.
      ctx.strokeStyle = `rgba(134, 239, 255, ${0.35 + Math.sin(this.shockPulse * 2) * 0.18})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 8]);
      ctx.lineDashOffset = -this.shockPulse * 18;
      ctx.beginPath();
      ctx.arc(0, 0, shockR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      ctx.shadowBlur = 30;
      ctx.shadowColor = "#ffd32a";

      ctx.fillStyle = "#27ae60";
      [-18, 0, 18].forEach(ox => {
        [-12, 12].forEach(oy => {
          ctx.beginPath();
          ctx.arc(ox, oy, 20, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffd32a";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.strokeStyle = "#fff7a1";
      ctx.lineWidth = 3;
      const sparkAng = gameTimer * 0.15;
      for (let s = 0; s < 7; s++) {
        const a = sparkAng + (s * Math.PI * 2 / 7);
        const sx = Math.cos(a) * 32;
        const sy = Math.sin(a) * 32;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a + 0.42) * 10, sy + Math.sin(a + 0.42) * 10);
        ctx.lineTo(sx + Math.cos(a - 0.25) * 19, sy + Math.sin(a - 0.25) * 19);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";

      if (this.runAwayTimer > 0) {
        ctx.beginPath();
        ctx.arc(-10, -4, 7, 0, Math.PI * 2);
        ctx.arc(10, -4, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(-10, -4, 3, 0, Math.PI * 2);
        ctx.arc(10, -4, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(-10, -4, 5, 0, Math.PI * 2);
        ctx.arc(10, -4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(-8, -4, 2.5, 0, Math.PI * 2);
        ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.gooeyTimer > 0) {
        ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
        ctx.beginPath();
        ctx.arc(-8, -12, 10, 0, Math.PI * 2);
        ctx.arc(12, -8, 12, 0, Math.PI * 2);
        ctx.arc(0, 10, 14, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (this.data.isMineMan) {
      const hover = Math.sin(gameTimer * 0.12) * 5;
      ctx.translate(0, hover);
      ctx.shadowColor = "#3b82f6";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "#dc2626";
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(-30, -35, 60, 62, [6]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(-40, -20, 10, 33);
      ctx.fillRect(30, -20, 10, 33);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-16, 27); ctx.lineTo(-24, 41); ctx.lineTo(-16, 50);
      ctx.moveTo(16, 27); ctx.lineTo(24, 41); ctx.lineTo(16, 50);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.fillRect(-17, -14, 13, 8);
      ctx.fillRect(4, -14, 13, 8);
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MINE!", 0, 12);

    } else if (this.data.isVolcanicGiant) {
      const stomp = Math.sin(gameTimer * 0.1) * 5;
      if (!this.hasEmerged) {
        // Before he wakes, the player can only see his huge home volcano.
        ctx.fillStyle = "#431407";
        ctx.beginPath(); ctx.moveTo(-110, 88); ctx.lineTo(0, -128); ctx.lineTo(110, 88); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(-37, -76); ctx.lineTo(0, -104); ctx.lineTo(38, -74); ctx.stroke();
        ctx.fillStyle = "#f97316";
        ctx.beginPath(); ctx.ellipse(0, -75, 31, 12, 0, 0, Math.PI * 2); ctx.fill();
      } else {
      // Outside the volcano, every part of him is huge because he is the Volcanic Giant.
      ctx.scale(1.28, 1.28);
      ctx.strokeStyle = "#4a2412"; ctx.lineWidth = 21; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-27, 42); ctx.lineTo(-43, 91 + stomp); ctx.moveTo(27, 42); ctx.lineTo(43, 91 - stomp); ctx.stroke();
      // Giant feet with human toes, and big human-shaped arms and hands.
      ctx.fillStyle = "#f4b183";
      ctx.beginPath(); ctx.ellipse(-47, 94 + stomp, 25, 11, 0, 0, Math.PI * 2); ctx.ellipse(47, 94 - stomp, 25, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4a2412"; ctx.lineWidth = 6;
      ctx.beginPath();
      [-59, -49, -39].forEach(x => { ctx.moveTo(x, 91 + stomp); ctx.lineTo(x - 3, 101 + stomp); });
      [35, 47, 59].forEach(x => { ctx.moveTo(x, 91 - stomp); ctx.lineTo(x + 3, 101 - stomp); });
      ctx.moveTo(-57, -2); ctx.lineTo(-93, 28); ctx.lineTo(-84, 58);
      ctx.moveTo(57, -2); ctx.lineTo(93, 28); ctx.lineTo(84, 58);
      ctx.stroke();
      ctx.fillStyle = "#f4b183";
      ctx.beginPath(); ctx.arc(-84, 58, 18, 0, Math.PI * 2); ctx.arc(84, 58, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4a2412"; ctx.lineWidth = 5;
      for (let finger = -1; finger <= 1; finger++) {
        ctx.beginPath(); ctx.moveTo(-87 + finger * 7, 61); ctx.lineTo(-91 + finger * 7, 74); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(87 + finger * 7, 61); ctx.lineTo(91 + finger * 7, 74); ctx.stroke();
      }
      ctx.fillStyle = "#f4b183";
      ctx.beginPath(); ctx.roundRect(-48, -5, 96, 80, [24]); ctx.fill();
      ctx.strokeStyle = "#4a2412"; ctx.lineWidth = 7; ctx.stroke();
      // A huge separate human head sits above his huge body.
      ctx.fillStyle = "#f4b183";
      ctx.beginPath(); ctx.arc(0, -52, 52, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4a2412"; ctx.lineWidth = 7; ctx.stroke();
      ctx.fillStyle = "#b45309";
      [[-31, -8, 12], [27, 18, 10], [-10, 33, 8], [24, -24, 9]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#f97316";
      ctx.beginPath(); ctx.arc(-28, -59, 16, 0, Math.PI * 2); ctx.arc(28, -59, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#86efac";
      ctx.beginPath(); ctx.arc(-28, -59, 8, 0, Math.PI * 2); ctx.arc(28, -59, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.beginPath(); ctx.arc(-28, -59, 3, 0, Math.PI * 2); ctx.arc(28, -59, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b1108";
      ctx.beginPath(); ctx.roundRect(-33, -35, 66, 29, [8]); ctx.fill();
      ctx.fillStyle = "#fff7d6";
      // Three teeth on top and two teeth on the bottom.
      [-21, -4, 13].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x + 10, -34); ctx.lineTo(x + 5, -23); ctx.closePath(); ctx.fill(); });
      [-13, 9].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x + 11, -6); ctx.lineTo(x + 5.5, -17); ctx.closePath(); ctx.fill(); });
      }

    } else if (this.data.isDeerOctopus) {
      // Colourful octopus feet curl underneath his round green face.
      const wobble = Math.sin(gameTimer * 0.16) * 9;
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      for (let leg = -3; leg <= 3; leg++) {
        const x = leg * 14;
        ctx.strokeStyle = ["#f472b6", "#60a5fa", "#22c55e", "#facc15"][Math.abs(leg) % 4];
        ctx.beginPath();
        ctx.moveTo(x, 27);
        ctx.quadraticCurveTo(x + wobble, 51, x - wobble * 0.5, 72);
        ctx.stroke();
        ctx.fillStyle = "#f9a8d4";
        ctx.beginPath(); ctx.ellipse(x - wobble * 0.5, 74, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Big round green face with a pink-covered heart.
      ctx.shadowColor = "#ec4899";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#86efac"; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = "#ec4899";
      ctx.beginPath(); ctx.arc(-9, 10, 10, 0, Math.PI * 2); ctx.arc(9, 10, 10, 0, Math.PI * 2); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill();

      // DJ headphones and blue headlight eyes.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, -2, 42, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath(); ctx.arc(-43, 4, 10, 0, Math.PI * 2); ctx.arc(43, 4, 10, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 15; ctx.fillStyle = "#93c5fd";
      ctx.beginPath(); ctx.arc(-18, -7, 8, 0, Math.PI * 2); ctx.arc(18, -7, 8, 0, Math.PI * 2); ctx.fill();

      // Two little nostrils, then an odd happy mouth.
      ctx.shadowBlur = 0; ctx.fillStyle = "#14532d";
      ctx.beginPath(); ctx.arc(-5, 3, 3, 0, Math.PI * 2); ctx.arc(5, 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#172554"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(3, 17, 16, 0.15, Math.PI - 0.16); ctx.stroke();

      // A disco brain sits on top of his big hammer.
      ctx.strokeStyle = "#92400e"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(39, 15); ctx.lineTo(67, -33); ctx.stroke();
      ctx.fillStyle = "#a855f7";
      ctx.beginPath(); ctx.arc(74, -43, 18, 0, Math.PI * 2); ctx.fill();
      ["#facc15", "#60a5fa", "#ec4899", "#22c55e"].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(63 + (i % 2) * 17, -51 + Math.floor(i / 2) * 15, 5, 0, Math.PI * 2); ctx.fill();
      });

    } else if (this.data.isMeteorCannon) {
      // A huge meteor is shaped like a cannon bullet and rises from the lava planet.
      const heat = (Math.sin(gameTimer * 0.16) + 1) / 2;
      ctx.shadowColor = "#fb923c";
      ctx.shadowBlur = 24 + heat * 18;
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath();
      ctx.ellipse(0, 0, 58, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.ellipse(5, -2, 50, 35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cannon-bullet tip and fiery cannon opening.
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.moveTo(42, -26); ctx.lineTo(75, 0); ctx.lineTo(42, 26); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(254, 215, 170, ${0.5 + heat * 0.4})`;
      ctx.beginPath(); ctx.arc(54, 0, 13, 0, Math.PI * 2); ctx.fill();
      // One big cannon eye.
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath(); ctx.ellipse(-12, -8, 17, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath(); ctx.arc(-10, -8, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-43, 20); ctx.lineTo(-58, 38); ctx.moveTo(-25, 31); ctx.lineTo(-35, 50); ctx.stroke();

    } else if (this.data.isElectricBot) {
      // Electric Bot is a huge robot-car powered by a lantern and hauling a dangerous package.
      const charge = (Math.sin(gameTimer * 0.2) + 1) / 2;
      ctx.scale(1.25, 1.25);
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 22 + charge * 18;
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(-58, -32, 116, 64, [14]);
      ctx.fill();
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 5;
      ctx.stroke();
      // Robot head and two car wheels.
      ctx.fillStyle = "#475569";
      ctx.fillRect(-25, -62, 50, 34);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 4;
      ctx.strokeRect(-25, -62, 50, 34);
      ctx.fillStyle = "#0f172a";
      [-36, 36].forEach(x => { ctx.beginPath(); ctx.arc(x, 34, 17, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#94a3b8";
      [-36, 36].forEach(x => { ctx.beginPath(); ctx.arc(x, 34, 7, 0, Math.PI * 2); ctx.fill(); });
      // Giant glowing lantern on top.
      ctx.fillStyle = `rgba(254, 240, 138, ${0.65 + charge * 0.3})`;
      ctx.beginPath(); ctx.roundRect(-16, -102, 32, 39, [7]); ctx.fill();
      ctx.strokeStyle = "#facc15"; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -104, 12, Math.PI, 0); ctx.stroke();
      // The package is bolted to the car and clearly says DEATH.
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(28, -19, 34, 31);
      ctx.strokeStyle = "#fecaca"; ctx.lineWidth = 2; ctx.strokeRect(28, -19, 34, 31);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText("DEATH", 45, 0);
      ctx.fillStyle = "#fef08a";
      ctx.beginPath(); ctx.arc(-10, -47, 5, 0, Math.PI * 2); ctx.arc(10, -47, 5, 0, Math.PI * 2); ctx.fill();
      // The electric field shows that close-range shots cannot reach the machine.
      ctx.strokeStyle = `rgba(147, 197, 253, ${0.35 + charge * 0.45})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.arc(0, -20, 91, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

    } else if (this.data.isVolcanicFridge) {
      const heat = (Math.sin(gameTimer * 0.18) + 1) / 2;
      const hopHeight = Math.max(0, Math.sin(this.fridgeHop)) * 15;
      ctx.translate(0, -hopHeight);
      // The boss is a giant version of the baby refrigerator enemies.
      ctx.scale(1.35, 1.35);
      ctx.shadowColor = "#fb4b18";
      ctx.shadowBlur = 28 + heat * 16;
      ctx.fillStyle = "#4a1d12";
      ctx.beginPath();
      ctx.roundRect(-38, -48, 76, 96, [8, 8, 12, 12]);
      ctx.fill();
      ctx.fillStyle = "#8f2d14";
      ctx.beginPath();
      ctx.roundRect(-31, -42, 62, 80, [5, 5, 10, 10]);
      ctx.fill();
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 3;
      ctx.stroke();
      // Freezer seam and bright lava cracks.
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-30, -18); ctx.lineTo(30, -18);
      ctx.moveTo(-18, 40); ctx.lineTo(-9, 24); ctx.lineTo(0, 42); ctx.lineTo(12, 22); ctx.lineTo(22, 39);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Wet-looking moss clumps on the old refrigerator.
      ctx.fillStyle = "#4d7c0f";
      [[-34, -29, 9], [-31, -7, 7], [-33, 17, 9], [29, 22, 8], [25, -34, 6]].forEach(([x, y, size]) => {
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.arc(x + 5, y + 4, size * 0.72, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.ellipse(-13, -5, 10, 8, -0.22, 0, Math.PI * 2);
      ctx.ellipse(13, -5, 10, 8, 0.22, 0, Math.PI * 2);
      ctx.fill();
      // Deep brown eyes make the refrigerator look old, mossy, and unsettling.
      ctx.fillStyle = "#4a2b19";
      ctx.beginPath(); ctx.arc(-11, -4, 4.5, 0, Math.PI * 2); ctx.arc(11, -4, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1c100a";
      ctx.beginPath(); ctx.arc(-10, -4, 2, 0, Math.PI * 2); ctx.arc(12, -4, 2, 0, Math.PI * 2); ctx.fill();
      // The lower door opens into a black mouth packed with jagged, creepy teeth.
      ctx.fillStyle = "#160b08";
      ctx.beginPath(); ctx.roundRect(-25, 9, 50, 24, [4, 4, 8, 8]); ctx.fill();
      ctx.fillStyle = "#fff7d6";
      for (let tooth = 0; tooth < 5; tooth++) {
        const x = -20 + tooth * 10;
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 7, 10); ctx.lineTo(x + 3.5, 20 + (tooth % 2) * 3); ctx.closePath(); ctx.fill();
      }
      for (let tooth = 0; tooth < 4; tooth++) {
        const x = -15 + tooth * 10;
        ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 7, 32); ctx.lineTo(x + 3.5, 23); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#2d160d";
      ctx.fillRect(-25, 45, 12, 7); ctx.fillRect(13, 45, 12, 7);

    } else {
      ctx.shadowBlur = 24;
      ctx.shadowColor = this.data.color;

      ctx.fillStyle = this.data.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.data.symbol, 0, 2);
    }

    const heartSpacing = 22;
    const startHx = -((this.maxHp - 1) * heartSpacing) / 2;
    for (let h = 0; h < this.maxHp; h++) {
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(h < this.hp ? "❤️" : "🖤", startHx + h * heartSpacing, -52);
    }

    ctx.restore();
  }
}

function spawnParticle(x, y, color, size = 5, life = 20) {
  particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4,
    size,
    color,
    life,
    maxLife: life
  });
}

function addFloatingText(x, y, text, color = "#fff") {
  floatingTexts.push({ x, y, text, color, life: 45 });
}

const WORLD_OBSTACLE_THEMES = [
  { type: "bramble", color: "#22c55e", accent: "#fef08a", symbol: "⚡" },
  // World 2 is a playground of giant, harmless goo pads—not death hazards.
  { type: "bouncyGoo", color: "#a855f7", accent: "#dcfce7", symbol: "🟢" },
  { type: "egg", color: "#f8fafc", accent: "#fca5a5", symbol: "🥚" },
  { type: "vacuum", color: "#22c55e", accent: "#bbf7d0", symbol: "🧹" },
  { type: "volcano", color: "#c2410c", accent: "#fb923c", symbol: "🌋" },
  { type: "frostStatue", color: "#60a5fa", accent: "#fed7aa", symbol: "🗿" },
  { type: "thunder", color: "#f1c40f", accent: "#fef08a", symbol: "⚡" },
  { type: "volcano", color: "#c2410c", accent: "#fb923c", symbol: "🌋" },
  { type: "discoBall", color: "#ec4899", accent: "#60a5fa", symbol: "🪩" },
  { type: "volcano", color: "#7c2d12", accent: "#fb923c", symbol: "🌋" }
];

const WORLD_OBSTACLE_LAYOUTS = [
  [[330, 190, 34], [500, 410, 38], [670, 260, 35]],
  [[330, 385, 58], [515, 240, 66], [700, 390, 60]],
  [[325, 390, 50], [515, 210, 52], [700, 310, 48]],
  [[345, 170, 34], [530, 350, 38], [700, 230, 35]],
  [[330, 270, 58], [520, 170, 64], [685, 420, 60]],
  [[350, 390, 58], [535, 250, 54], [700, 160, 56]],
  [[325, 180, 34], [520, 430, 38], [690, 125, 35]],
  [[350, 280, 35], [540, 160, 34], [700, 420, 38]],
  [[300, 400, 72], [520, 235, 82], [720, 170, 70]],
  [[320, 175, 76], [525, 405, 88], [715, 260, 78]]
];

function getLevelObstacles(world) {
  const theme = WORLD_OBSTACLE_THEMES[world - 1];
  const layout = WORLD_OBSTACLE_LAYOUTS[world - 1];
  return layout.map(([x, y, radius], index) => ({ ...theme, x, y, radius, phase: world * 0.8 + index * 2.1 }));
}

function resolvePlayerObstacleCollision(playerEntity) {
  levelObstacles.forEach((obstacle) => {
    let dx = playerEntity.x - obstacle.x;
    let dy = playerEntity.y - obstacle.y;
    let distance = Math.hypot(dx, dy);
    // World 2 pads are safe, squishy launchers. They bounce heroes outward and upward.
    if (obstacle.type === "bouncyGoo") {
      const launchDistance = playerEntity.radius + obstacle.radius - 6;
      if (distance < launchDistance) {
        if (distance === 0) {
          dx = 1;
          dy = 0;
          distance = 1;
        }
        const nx = dx / distance;
        const ny = dy / distance;
        playerEntity.x = obstacle.x + nx * launchDistance;
        playerEntity.y = obstacle.y + ny * launchDistance;
        if (playerEntity.gooPadBounceTimer <= 0) {
          playerEntity.gooPadBounceDuration = 30;
          playerEntity.gooPadBounceTimer = playerEntity.gooPadBounceDuration;
          playerEntity.gooPadVx = nx * 6;
          playerEntity.gooPadVy = ny * 6;
          addFloatingText(obstacle.x, obstacle.y - obstacle.radius - 16, "BOING! 🟢", "#dcfce7");
          for (let puff = 0; puff < 12; puff++) spawnParticle(obstacle.x, obstacle.y, "#a855f7", 6, 24);
        }
      }
      return;
    }

    // Heroes can push through an obstacle's soft outer decoration before reaching its solid core.
    const safeDistance = playerEntity.radius + obstacle.radius - 10;

    if (distance < safeDistance) {
      if (distance === 0) {
        dx = 1;
        dy = 0;
        distance = 1;
      }
      playerEntity.x = obstacle.x + (dx / distance) * safeDistance;
      playerEntity.y = obstacle.y + (dy / distance) * safeDistance;
    }
  });
}

function resolveEnemyObstacleCollision(enemyEntity) {
  levelObstacles.forEach((obstacle) => {
    let dx = enemyEntity.x - obstacle.x;
    let dy = enemyEntity.y - obstacle.y;
    let distance = Math.hypot(dx, dy);
    const safeDistance = enemyEntity.radius + obstacle.radius + 4;

    if (distance < safeDistance) {
      if (distance === 0) {
        dx = 1;
        dy = 0;
        distance = 1;
      }
      enemyEntity.x = obstacle.x + (dx / distance) * safeDistance;
      enemyEntity.y = obstacle.y + (dy / distance) * safeDistance;
      if (typeof enemyEntity.vx === "number") enemyEntity.vx *= -1;
      if (typeof enemyEntity.vy === "number") enemyEntity.vy *= -1;
      if (typeof enemyEntity.runAwayVx === "number") enemyEntity.runAwayVx *= -1;
      if (typeof enemyEntity.runAwayVy === "number") enemyEntity.runAwayVy *= -1;
    }
  });
}

function getObstacleAt(x, y, radius = 0) {
  return levelObstacles.find((obstacle) => Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + radius);
}

function spawnObstacleImpact(x, y, color) {
  addFloatingText(x, y - 20, "BLOCKED! ⚡", "#fef08a");
  for (let spark = 0; spark < 8; spark++) {
    spawnParticle(x, y, color, 5, 18);
  }
}

function getOpenStarPosition() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = 180 + Math.random() * (V_WIDTH - 360);
    const y = 90 + Math.random() * (V_HEIGHT - 160);
    if (!getObstacleAt(x, y, 24)) return { x, y };
  }
  return { x: V_WIDTH / 2, y: 100 };
}

function startSubLevel(world, subLvl) {
  currentWorld = world;
  currentSubLevel = subLvl;
  newlyUnlockedHero = null;
  starsCollected = 0;
  bullets = [];
  enemyBullets = [];
  minions = [];
  gooBuddies = [];
  particles = [];
  floatingTexts = [];
  minionsDefeated = 0;
  globalMinionShootCooldown = 60;
  secretSpotFound = true;

  player = new Player(selectedHero);
  levelObstacles = getLevelObstacles(currentWorld);

  const worldData = VILLAINS[currentWorld - 1];

  if (currentSubLevel === 3) {
    currentBoss = new Boss(worldData);
    sounds.playBossMusic(currentWorld === 2);
    totalMinionsToSpawn = 0;
  } else {
    currentBoss = null;
    totalMinionsToSpawn = currentSubLevel === 1 ? 4 : 6;
    for (let i = 0; i < totalMinionsToSpawn; i++) {
      minions.push(new Minion(worldData));
    }
  }

  stars = [];
  for (let i = 0; i < 10; i++) {
    const position = getOpenStarPosition();
    stars.push({
      x: position.x,
      y: position.y,
      radius: 12,
      collected: false,
      pulse: Math.random() * Math.PI * 2
    });
  }

  currentState = STATE.PLAYING;
  if (currentWorld === 2 && currentSubLevel !== 3) sounds.playWorldTwoMusic();
  else if (currentWorld === 3 && currentSubLevel !== 3) sounds.playWorldThreeMusic();
  else if (currentSubLevel !== 3) sounds.playMainMusic();
}

function handleSpecialTrigger() {
  if (currentState === STATE.PLAYING && player) {
    player.triggerSpecial();
  }
}

function getWorldShopItem() {
  const items = [
    ["⚡ ZAP BOOTS", "12 stars: +2 speed", "speed"],
    ["🟢 GOO HEART", "12 stars: +2 hearts", "heart"],
    ["🥚 QUICK HATCH", "12 stars: special recharges faster", "special"],
    ["🧹 VACUUM CHARM", "12 stars: +1 heart", "heart"],
    ["🌋 LAVA RUNNERS", "12 stars: +2 speed", "speed"],
    ["🗿 ICE CLOCK", "12 stars: special recharges faster", "special"],
    ["⚡ BATTERY PACK", "12 stars: +2 speed", "speed"],
    ["☄️ METEOR CHARM", "12 stars: +1 heart", "heart"],
    ["🪩 DJ BOOSTER", "12 stars: special recharges faster", "special"],
    ["🌋 GIANT BOOTS", "12 stars: +2 speed", "speed"]
  ];
  return items[currentWorld - 1];
}

function buyWorldShopItem() {
  if (shopStars < 12) return;
  const [, , effect] = getWorldShopItem();
  shopStars -= 12;
  if (effect === "speed") { shopSpeedBoost += 2; player.speed += 2; }
  else if (effect === "heart") { shopHeartBoost += 2; player.maxHp += 2; player.hp += 2; }
  else { shopSpecialBoost += 35; player.specialCooldown = Math.max(25, player.specialCooldown - 35); }
  addFloatingText(player.x, player.y - 30, "WORLD UPGRADE!", "#fef08a");
}

function handleScreenClick() {
  if (currentState === STATE.TITLE) {
    currentState = STATE.HERO_SELECT;
    // Keep the splash screen silent. The main track starts after the first click.
    sounds.playMainMusic();
  } else if (currentState === STATE.HERO_SELECT) {
    const cols = 5;
    const cardW = 150;
    const cardH = 180;
    const startX = 60;
    const startY = 100;

    for (let i = 0; i < HEROES.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * 160;
      const y = startY + row * 195;

      if (mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y && mouse.y <= y + cardH) {
        const heroIsAvailable = HEROES[i].unlocked || (UNLOCK_ALL_HEROES_FOR_DEVELOPMENT && !HEROES[i].isKingston);
        if (heroIsAvailable) {
          selectedHero = HEROES[i];
          sounds.playStarCollect();
          if (maxUnlockedWorld > 1) {
            currentState = STATE.WORLD_SELECT;
          } else {
            startSubLevel(1, 1);
          }
        } else {
          sounds.playHit();
          addFloatingText(x + cardW / 2, y + 50, "🔒 LOCKED!", "#ff4757");
        }
        break;
      }
    }
  } else if (currentState === STATE.WORLD_SELECT) {
    for (let w = 1; w <= 10; w++) {
      const col = (w - 1) % 5;
      const row = Math.floor((w - 1) / 5);
      const bx = 80 + col * 155;
      const by = 130 + row * 175;
      const bw = 140;
      const bh = 145;

      if (mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + bh) {
        if (w <= maxUnlockedWorld) {
          sounds.playStarCollect();
          startSubLevel(w, 1);
        } else {
          sounds.playHit();
          addFloatingText(bx + bw / 2, by + 50, "🔒 BEAT EARLIER WORLDS!", "#ff4757");
        }
        break;
      }
    }

    if (mouse.x >= V_WIDTH / 2 - 100 && mouse.x <= V_WIDTH / 2 + 100 && mouse.y >= 515 && mouse.y <= 560) {
      currentState = STATE.HERO_SELECT;
    }

  } else if (currentState === STATE.STAGE_CLEAR) {
    if (currentSubLevel === 2 && mouse.x >= V_WIDTH / 2 - 150 && mouse.x <= V_WIDTH / 2 + 150 && mouse.y >= 435 && mouse.y <= 485) {
      shopBeforeBoss = true;
      currentState = STATE.SECRET_SHOP;
      return;
    }
    const heroBtnY = 435;
    if (newlyUnlockedHero || currentSubLevel === 3) {
      if (mouse.x >= V_WIDTH / 2 - 150 && mouse.x <= V_WIDTH / 2 + 150 && mouse.y >= heroBtnY && mouse.y <= heroBtnY + 50) {
        currentState = STATE.HERO_SELECT;
        return;
      }
    }

    const btnY = 360;
    if (mouse.x >= V_WIDTH / 2 - 150 && mouse.x <= V_WIDTH / 2 + 150 && mouse.y >= btnY && mouse.y <= btnY + 60) {
      if (currentSubLevel < 3) {
        startSubLevel(currentWorld, currentSubLevel + 1);
      } else {
        if (currentWorld < 10) {
          currentWorld++;
          if (currentWorld > maxUnlockedWorld) maxUnlockedWorld = currentWorld;
          startSubLevel(currentWorld, 1);
        } else {
          currentState = STATE.VICTORY;
          sounds.playVictory();
        }
      }
    }
  } else if (currentState === STATE.SECRET_SHOP) {
    if (mouse.x >= 180 && mouse.x <= 390 && mouse.y >= 310 && mouse.y <= 410 && shopStars >= 10) {
      shopStars -= 10;
      shopSpeedBoost += 1;
      player.speed += 1;
      addFloatingText(player.x, player.y - 30, "SPEED UPGRADE!", "#60a5fa");
    } else if (mouse.x >= 510 && mouse.x <= 720 && mouse.y >= 310 && mouse.y <= 410 && shopStars >= 8) {
      shopStars -= 8;
      shopHeartBoost += 1;
      player.maxHp += 1;
      player.hp += 1;
      addFloatingText(player.x, player.y - 30, "EXTRA HEART!", "#f472b6");
    } else if (mouse.x >= 345 && mouse.x <= 555 && mouse.y >= 425 && mouse.y <= 505) {
      buyWorldShopItem();
    } else if (mouse.y >= 535 && mouse.y <= 590) {
      if (shopBeforeBoss) {
        shopBeforeBoss = false;
        startSubLevel(currentWorld, 3);
      } else currentState = STATE.PLAYING;
    }
  } else if (currentState === STATE.GAME_OVER) {
    startSubLevel(currentWorld, currentSubLevel);
  } else if (currentState === STATE.VICTORY) {
    currentState = STATE.HERO_SELECT;
  }
}

function finishBossFight() {
  sounds.playBossExplode();
  sounds.playMainMusic();
  score += 2000;
  for (let c = 0; c < 50; c++) {
    spawnParticle(currentBoss.x, currentBoss.y, currentBoss.data.color, 8, 50);
  }

  if (currentWorld + 1 > maxUnlockedWorld) {
    maxUnlockedWorld = Math.min(10, currentWorld + 1);
  }

  if (currentWorld === 1) {
    HEROES[1].unlocked = true;
    newlyUnlockedHero = HEROES[1];
  } else if (currentWorld === 2) {
    HEROES[2].unlocked = true;
    newlyUnlockedHero = HEROES[2];
  } else if (currentWorld === 3) {
    HEROES[3].unlocked = true;
    newlyUnlockedHero = HEROES[3];
  } else if (currentWorld === 5) {
    HEROES[5].unlocked = true;
    newlyUnlockedHero = HEROES[5];
  } else if (currentWorld < HEROES.length) {
    const heroToUnlock = HEROES[currentWorld];
    if (!heroToUnlock.unlocked) {
      heroToUnlock.unlocked = true;
      newlyUnlockedHero = heroToUnlock;
    }
  }

  currentState = STATE.STAGE_CLEAR;
  sounds.playVictory();
}

function getClosestGooTarget(x, y) {
  if (currentBoss) return currentBoss;
  if (minions.length === 0) return null;
  return minions.reduce((closest, minion) => {
    return Math.hypot(minion.x - x, minion.y - y) < Math.hypot(closest.x - x, closest.y - y)
      ? minion
      : closest;
  });
}

function update() {
  gameTimer++;
  if (globalMinionShootCooldown > 0) globalMinionShootCooldown--;

  if (currentState === STATE.PLAYING) {
    player.update();

    if (currentBoss) {
      currentBoss.update();

      const distToBoss = Math.hypot(player.x - currentBoss.x, player.y - currentBoss.y);
      if (distToBoss < currentBoss.radius + player.radius) {
        if (player.canHeadBonk()) {
          const slamDamage = player.gooChargeDamage;
          currentBoss.getHit(true, slamDamage);
          addFloatingText(currentBoss.x, currentBoss.y - 50, `HEAD BONK! -${slamDamage} ❤️`, "#a8ff78");
          for (let p = 0; p < 22; p++) spawnParticle(currentBoss.x, currentBoss.y, "#2ecc71", 7, 24);
          player.stopGooCharge();
          if (currentBoss.hp <= 0) finishBossFight();
        } else if (currentBoss.data.isPoisonBall) {
          player.takeDamage(1, true);
        } else {
          player.takeDamage(1, false);
        }
      }
    } else {
      minions.forEach(m => {
        m.update();
        const distToMinion = Math.hypot(player.x - m.x, player.y - m.y);
        if (distToMinion < m.radius + player.radius) {
          if (player.hero.isGooball && player.gooChargeTimer > 0) {
            minions.splice(minions.indexOf(m), 1);
            minionsDefeated++;
            score += 200;
            sounds.playHit();
            addFloatingText(m.x, m.y, "HEAD BONK! 🟢", "#a8ff78");
            for (let p = 0; p < 16; p++) spawnParticle(m.x, m.y, "#2ecc71", 6, 22);
            player.stopGooCharge();
            if (minions.length === 0) {
              currentState = STATE.STAGE_CLEAR;
              sounds.playVictory();
            }
          } else {
            player.takeDamage(1, m.data.isPoisonBall);
          }
        }
      });
    }

    stars.forEach(star => {
      if (!star.collected) {
        star.pulse += 0.08;
        const dist = Math.hypot(player.x - star.x, player.y - star.y);
        if (dist < player.radius + star.radius) {
          star.collected = true;
          starsCollected++;
          shopStars++;
          score += 100;
          sounds.playStarCollect();
          addFloatingText(star.x, star.y, "+100 ⭐", "#ffd166");
          for (let i = 0; i < 10; i++) spawnParticle(star.x, star.y, "#ffd166", 6, 20);
        }
      }
    });

    for (let buddyIndex = gooBuddies.length - 1; buddyIndex >= 0; buddyIndex--) {
      const buddy = gooBuddies[buddyIndex];
      buddy.life--;
      buddy.bob += 0.25;
      const target = getClosestGooTarget(buddy.x, buddy.y);
      if (!target || buddy.life <= 0 || currentState !== STATE.PLAYING) {
        gooBuddies.splice(buddyIndex, 1);
        continue;
      }

      const angle = Math.atan2(target.y - buddy.y, target.x - buddy.x);
      // Goo Ball's special moves at 25% of its former speed (8 → 2).
      buddy.x += Math.cos(angle) * 2;
      buddy.y += Math.sin(angle) * 2;

      const obstacle = getObstacleAt(buddy.x, buddy.y, buddy.radius);
      if (obstacle) {
        spawnObstacleImpact(buddy.x, buddy.y, "#2ecc71");
        gooBuddies.splice(buddyIndex, 1);
        continue;
      }

      if (Math.hypot(target.x - buddy.x, target.y - buddy.y) < target.radius + buddy.radius) {
        if (currentBoss) {
          currentBoss.getHit(true);
          addFloatingText(target.x, target.y - 42, "GOO SHOT! 🟢", "#a8ff78");
          for (let p = 0; p < 10; p++) spawnParticle(target.x, target.y, "#2ecc71", 5, 18);
          gooBuddies.splice(buddyIndex, 1);
          if (currentBoss.hp <= 0) finishBossFight();
        } else {
          const minionIndex = minions.indexOf(target);
          if (minionIndex >= 0) {
            minions.splice(minionIndex, 1);
            minionsDefeated++;
            score += 200;
            addFloatingText(target.x, target.y, "GOO SHOT! 🟢", "#a8ff78");
            for (let p = 0; p < 10; p++) spawnParticle(target.x, target.y, "#2ecc71", 5, 18);
          }
          gooBuddies.splice(buddyIndex, 1);
          if (minions.length === 0) {
            currentState = STATE.STAGE_CLEAR;
            sounds.playVictory();
          }
        }
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      // The electric tornado hunts for a bad guy and stays active until it hits one.
      if (b.isElectricTornado || b.isWinstonTornado) {
        const targets = currentBoss ? [currentBoss] : minions;
        if (targets.length > 0) {
          let target = targets[0];
          let nearest = Math.hypot(target.x - b.x, target.y - b.y);
          for (const candidate of targets) {
            const distance = Math.hypot(candidate.x - b.x, candidate.y - b.y);
            if (distance < nearest) { target = candidate; nearest = distance; }
          }
          const huntAngle = Math.atan2(target.y - b.y, target.x - b.x);
          b.vx = b.vx * 0.82 + Math.cos(huntAngle) * 1.08;
          b.vy = b.vy * 0.82 + Math.sin(huntAngle) * 1.08;
        }
      }
      b.x += b.vx;
      b.y += b.vy;

      let bulletRemoved = false;
      const obstacle = getObstacleAt(b.x, b.y, b.radius);
      if (obstacle) {
        spawnObstacleImpact(b.x, b.y, b.color);
        bullets.splice(i, 1);
        continue;
      }

      if (currentBoss) {
        if (currentBoss.data.isVolcanicGiant && !currentBoss.hasEmerged) continue;
        const dist = Math.hypot(b.x - currentBoss.x, b.y - currentBoss.y);
        const playerTooClose = Math.hypot(player.x - currentBoss.x, player.y - currentBoss.y) < 190;
        if (currentBoss.data.isElectricBot && playerTooClose && dist < currentBoss.radius + 90) {
          addFloatingText(b.x, b.y, "⚡ TOO CLOSE!", "#fef08a");
          spawnParticle(b.x, b.y, "#60a5fa", 7, 20);
          bullets.splice(i, 1);
          continue;
        }
        if (dist < b.radius + currentBoss.radius) {
          currentBoss.getHit(b.isGoo, b.damage || 1);
          if (b.isGiantClaw) {
            currentBoss.y = Math.max(100, currentBoss.y - 85);
            addFloatingText(currentBoss.x, currentBoss.y - 45, "LAUNCHED! ☁️", "#dbeafe");
          }
          for (let p = 0; p < 8; p++) spawnParticle(b.x, b.y, b.color, 5, 18);
          bullets.splice(i, 1);
          bulletRemoved = true;

          if (currentBoss.hp <= 0) {
            finishBossFight();
            break;
          }
        }
      } else {
        for (let mIdx = minions.length - 1; mIdx >= 0; mIdx--) {
          const m = minions[mIdx];
          const dist = Math.hypot(b.x - m.x, b.y - m.y);
          if (dist < b.radius + m.radius) {
            minions.splice(mIdx, 1);
            minionsDefeated++;
            score += 200;
            sounds.playHit();
            addFloatingText(m.x, m.y, b.isGoo ? "SPLAT! 🟢" : (b.isZiggyCross ? "ZAP! ⚡" : "POOF! 💥"), "#ffd32a");
            for (let p = 0; p < 10; p++) spawnParticle(m.x, m.y, m.data.color, 5, 18);
            bullets.splice(i, 1);
            bulletRemoved = true;

            if (minions.length === 0) {
              currentState = STATE.STAGE_CLEAR;
              sounds.playVictory();
            }
            break;
          }
        }
      }

      if (bulletRemoved) continue;

      if ((b.isElectricTornado || b.isWinstonTornado) && (b.x < b.radius || b.x > V_WIDTH - b.radius)) {
        b.vx *= -1;
        b.x = Math.max(b.radius, Math.min(V_WIDTH - b.radius, b.x));
      }
      if ((b.isElectricTornado || b.isWinstonTornado) && (b.y < 65 + b.radius || b.y > V_HEIGHT - b.radius)) {
        b.vy *= -1;
        b.y = Math.max(65 + b.radius, Math.min(V_HEIGHT - b.radius, b.y));
      }

      if (!b.isElectricTornado && !b.isWinstonTornado && (b.x < 0 || b.x > V_WIDTH || b.y < 0 || b.y > V_HEIGHT)) {
        bullets.splice(i, 1);
      }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      eb.x += eb.vx;
      eb.y += eb.vy;

      // Enemy shots obey the same obstacle walls as the hero's shots.
      if (getObstacleAt(eb.x, eb.y, eb.radius)) {
        spawnObstacleImpact(eb.x, eb.y, eb.color);
        enemyBullets.splice(i, 1);
        continue;
      }

      const dist = Math.hypot(eb.x - player.x, player.y - eb.y);
      if (dist < eb.radius + player.radius) {
        player.takeDamage(1, eb.isPoisonDrop);
        enemyBullets.splice(i, 1);
        continue;
      }

      if (eb.x < 0 || eb.x > V_WIDTH || eb.y < 0 || eb.y > V_HEIGHT) {
        enemyBullets.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 1;
      ft.life--;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  if (currentState === STATE.VICTORY) {
    if (Math.random() < 0.4) {
      confetti.push({
        x: Math.random() * V_WIDTH,
        y: -10,
        vy: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 3,
        color: ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6', '#00f0ff', '#fd79a8'][Math.floor(Math.random() * 7)],
        size: 6 + Math.random() * 6
      });
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      if (c.y > V_HEIGHT + 20) confetti.splice(i, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

  if (currentState === STATE.TITLE) {
    drawTitleScreen();
  } else if (currentState === STATE.HERO_SELECT) {
    drawHeroSelectScreen();
  } else if (currentState === STATE.WORLD_SELECT) {
    drawWorldSelectScreen();
  } else if (currentState === STATE.PLAYING) {
    drawPlayingScreen();
  } else if (currentState === STATE.STAGE_CLEAR) {
    drawStageClearScreen();
  } else if (currentState === STATE.SECRET_SHOP) {
    drawSecretShopScreen();
  } else if (currentState === STATE.VICTORY) {
    drawVictoryScreen();
  } else if (currentState === STATE.GAME_OVER) {
    drawGameOverScreen();
  }
}

function drawTitleScreen() {
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  ctx.textAlign = "center";
  ctx.shadowColor = "#fd79a8";
  ctx.shadowBlur = 25;
  ctx.fillStyle = "#fd79a8";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText("⭐ 10 VS 10 HERO BATTLE ⭐", V_WIDTH / 2, 160);

  ctx.shadowColor = "#ffd166";
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("Defeat bosses to discover new heroes!", V_WIDTH / 2, 220);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a0c4ff";
  ctx.font = "16px sans-serif";
  ctx.fillText("Every new world holds a secret enemy.", V_WIDTH / 2, 280);

  const btnY = 390;
  ctx.fillStyle = "#fd79a8";
  ctx.shadowColor = "#fd79a8";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.roundRect(V_WIDTH / 2 - 150, btnY, 300, 65, [14]);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000000";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("🚀 START ADVENTURE! 🚀", V_WIDTH / 2, btnY + 42);
}

function drawHeroSelectScreen() {
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 15;
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("🦸 STEP 1: CHOOSE YOUR HERO 🦸", V_WIDTH / 2, 45);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a0c4ff";
  ctx.font = "15px sans-serif";
  ctx.fillText("Locked heroes are revealed when you defeat their boss.", V_WIDTH / 2, 75);

  const cols = 5;
  const cardW = 150;
  const cardH = 180;
  const startX = 60;
  const startY = 100;

  for (let i = 0; i < HEROES.length; i++) {
    const h = HEROES[i];
    const isDevelopmentPlaceholder = UNLOCK_ALL_HEROES_FOR_DEVELOPMENT && h.name.includes("(Locked)");
    const heroName = isDevelopmentPlaceholder ? h.name.replace(" (Locked)", "") : h.name;
    const heroTitle = isDevelopmentPlaceholder ? "✨ Dev-ready" : h.title;
    const heroSymbol = isDevelopmentPlaceholder ? "✨" : h.symbol;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * 160;
    const y = startY + row * 195;

    const isHover = mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y && mouse.y <= y + cardH;

    const heroIsAvailable = h.unlocked || (UNLOCK_ALL_HEROES_FOR_DEVELOPMENT && !h.isKingston);
    ctx.fillStyle = heroIsAvailable ? (isHover ? "#1e293b" : "#131b24") : "#0a0e14";
    ctx.strokeStyle = heroIsAvailable ? (isHover ? h.color : "#3d4e61") : "#1f2937";
    ctx.lineWidth = isHover && heroIsAvailable ? 3 : 2;
    ctx.shadowColor = isHover && heroIsAvailable ? h.color : "transparent";
    ctx.shadowBlur = isHover && heroIsAvailable ? 15 : 0;

    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, [12]);
    ctx.fill();
    ctx.stroke();

    if (heroIsAvailable) {
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.arc(x + cardW / 2, y + 42, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = "20px sans-serif";
      ctx.fillText(heroSymbol, x + cardW / 2, y + 50);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(heroName, x + cardW / 2, y + 90);

      ctx.fillStyle = "#ffd166";
      ctx.font = "11px sans-serif";
      ctx.fillText(heroTitle, x + cardW / 2, y + 110);

      ctx.fillStyle = "#a0c4ff";
      ctx.font = "11px sans-serif";
      ctx.fillText(`❤️ HP: ${h.maxHp} | ⚡ Spd: ${h.speed}`, x + cardW / 2, y + 135);
      ctx.fillText(`✨ ${h.specialName.substring(0, 16)}`, x + cardW / 2, y + 155);
    } else {
      ctx.fillStyle = "#374151";
      ctx.beginPath();
      ctx.arc(x + cardW / 2, y + 50, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "24px sans-serif";
      ctx.fillText("🔒", x + cardW / 2, y + 58);

      ctx.fillStyle = "#6b7280";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("??? HERO ???", x + cardW / 2, y + 105);

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.fillText("Defeat more bosses", x + cardW / 2, y + 130);
    }
  }
}

function drawWorldSelectScreen() {
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#00f0ff";
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 15;
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`🗺️ STEP 2: SELECT YOUR WORLD (${selectedHero.name}) 🗺️`, V_WIDTH / 2, 50);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a0c4ff";
  ctx.font = "15px sans-serif";
  ctx.fillText("Click any unlocked world to start playing!", V_WIDTH / 2, 85);

  for (let w = 1; w <= 10; w++) {
    const v = VILLAINS[w - 1];
    const isUnlocked = w <= maxUnlockedWorld;
    const col = (w - 1) % 5;
    const row = Math.floor((w - 1) / 5);
    const bx = 80 + col * 155;
    const by = 130 + row * 175;
    const bw = 140;
    const bh = 145;

    const isHover = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + bh;

    ctx.fillStyle = isUnlocked ? (isHover ? "#1e293b" : "#131b24") : "#090d12";
    ctx.strokeStyle = isUnlocked ? (isHover ? "#00f0ff" : v.color) : "#1f2937";
    ctx.lineWidth = isHover && isUnlocked ? 3 : 2;
    ctx.shadowColor = isHover && isUnlocked ? "#00f0ff" : "transparent";
    ctx.shadowBlur = isHover && isUnlocked ? 15 : 0;

    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, [12]);
    ctx.fill();
    ctx.stroke();

    if (isUnlocked) {
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(bx + bw / 2, by + 40, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = "24px sans-serif";
      ctx.fillText(v.symbol, bx + bw / 2, by + 48);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`WORLD ${w}`, bx + bw / 2, by + 85);

      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(v.name.substring(0, 16), bx + bw / 2, by + 105);

      ctx.fillStyle = "#a0c4ff";
      ctx.font = "11px sans-serif";
      ctx.fillText(`❤️ ${v.maxHp} Hearts`, bx + bw / 2, by + 125);
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#374151";
      ctx.font = "26px sans-serif";
      ctx.fillText("🔒", bx + bw / 2, by + 50);

      ctx.fillStyle = "#6b7280";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`WORLD ${w}`, bx + bw / 2, by + 90);
      ctx.fillText("Locked", bx + bw / 2, by + 115);
    }
  }

  ctx.fillStyle = "#4b6584";
  ctx.beginPath();
  ctx.roundRect(V_WIDTH / 2 - 100, 515, 200, 45, [10]);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("⬅️ BACK TO HEROES", V_WIDTH / 2, 543);
}

const WORLD_BACKDROPS = [
  { sky: "#143a1c", nebula: "#1f6b35", planet: "#277a37", planetDark: "#0f3d24", accent: "#b7f28a" },
  { sky: "#1e1035", nebula: "#6b217d", planet: "#7e22ce", planetDark: "#3b0764", accent: "#f0abfc" },
  { sky: "#172038", nebula: "#4b5563", planet: "#d1d5db", planetDark: "#475569", accent: "#f8fafc" },
  { sky: "#082f16", nebula: "#166534", planet: "#22c55e", planetDark: "#14532d", accent: "#bbf7d0" },
  { sky: "#3b0b08", nebula: "#9a3412", planet: "#c2410c", planetDark: "#431407", accent: "#fed7aa" },
  { sky: "#0c2d5a", nebula: "#1d4ed8", planet: "#2563eb", planetDark: "#172554", accent: "#bfdbfe" },
  { sky: "#3f2e00", nebula: "#ca8a04", planet: "#facc15", planetDark: "#713f12", accent: "#fef08a" },
  { sky: "#3b0b08", nebula: "#9a3412", planet: "#ea580c", planetDark: "#431407", accent: "#fed7aa" },
  { sky: "#21103d", nebula: "#7e22ce", planet: "#ec4899", planetDark: "#172554", accent: "#60a5fa" },
  { sky: "#3b0b08", nebula: "#9a3412", planet: "#c2410c", planetDark: "#431407", accent: "#fed7aa" }
];

function drawPlanetBackground() {
  const theme = WORLD_BACKDROPS[(currentWorld - 1) % WORLD_BACKDROPS.length];
  const planetSurface = ctx.createLinearGradient(0, 0, V_WIDTH, V_HEIGHT);
  planetSurface.addColorStop(0, theme.planetDark);
  planetSurface.addColorStop(0.42, theme.planet);
  planetSurface.addColorStop(1, theme.planetDark);
  ctx.fillStyle = planetSurface;
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  // The whole arena is now the planet's surface, so every enemy and boss fights on it.
  const sunlight = ctx.createRadialGradient(V_WIDTH * 0.18, V_HEIGHT * 0.08, 20, V_WIDTH * 0.18, V_HEIGHT * 0.08, V_WIDTH * 0.9);
  sunlight.addColorStop(0, `${theme.accent}9c`);
  sunlight.addColorStop(0.45, `${theme.planet}55`);
  sunlight.addColorStop(1, `${theme.planetDark}00`);
  ctx.fillStyle = sunlight;
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  if (currentWorld === 1) {
    // World 1 is a living Electric Bush planet covered in overlapping green growth.
    ctx.save();
    for (let patch = 0; patch < 42; patch++) {
      const x = (patch * 137 + 41) % V_WIDTH;
      const y = 70 + ((patch * 83 + 29) % (V_HEIGHT - 105));
      const size = 18 + (patch % 4) * 8;
      ctx.fillStyle = patch % 2 === 0 ? "rgba(22, 101, 52, 0.34)" : "rgba(134, 239, 172, 0.20)";
      ctx.beginPath();
      ctx.arc(x - size * 0.35, y + size * 0.18, size * 0.55, 0, Math.PI * 2);
      ctx.arc(x + size * 0.32, y + size * 0.12, size * 0.62, 0, Math.PI * 2);
      ctx.arc(x, y - size * 0.35, size * 0.68, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (currentWorld === 9) {
    // DJ Octopus's planet is a sparkling dance floor.
    const danceColors = ["rgba(244, 114, 182, 0.28)", "rgba(96, 165, 250, 0.28)", "rgba(34, 197, 94, 0.24)", "rgba(250, 204, 21, 0.24)"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 12; col++) {
        ctx.fillStyle = danceColors[(row + col + Math.floor(gameTimer / 12)) % danceColors.length];
        ctx.fillRect(col * 80 + 3, 72 + row * 72, 74, 66);
      }
    }
  }

  // Broad curved bands and craters give the surface a clear planetary texture.
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 26;
  for (let band = -2; band <= 3; band++) {
    ctx.beginPath();
    ctx.ellipse(V_WIDTH * 0.52 + band * 80, V_HEIGHT * 0.26 + band * 105, V_WIDTH * 0.72, 62, -0.16, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let crater = 0; crater < 12; crater++) {
    const x = (crater * 173 + currentWorld * 97) % V_WIDTH;
    const y = 72 + ((crater * 113 + currentWorld * 61) % (V_HEIGHT - 110));
    const radius = 12 + (crater % 4) * 9;
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.55, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${theme.accent}80`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `${theme.accent}b3`;
  ctx.lineWidth = 5;
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 24;
  ctx.strokeRect(3, 55, V_WIDTH - 6, V_HEIGHT - 58);
  ctx.beginPath();
  ctx.moveTo(0, 76);
  ctx.quadraticCurveTo(V_WIDTH * 0.5, 38, V_WIDTH, 76);
  ctx.stroke();
  ctx.restore();
}

function drawLevelObstacles() {
  levelObstacles.forEach((obstacle) => {
    const pulse = (Math.sin(gameTimer * 0.14 + obstacle.phase) + 1) / 2;
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.shadowColor = obstacle.accent;
    ctx.shadowBlur = 14 + pulse * 14;

    if (obstacle.type === "bramble") {
      ctx.fillStyle = "#166534";
      [-16, 0, 16].forEach((x) => {
        [-10, 10].forEach((y) => {
          ctx.beginPath();
          ctx.arc(x, y, 17, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.fillStyle = obstacle.color;
      ctx.beginPath();
      ctx.arc(0, -8, 21, 0, Math.PI * 2);
      ctx.fill();

    } else if (obstacle.type === "bouncyGoo") {
      // World 2: a lopsided, hand-drawn goo puddle—not a plain circle.
      const squish = Math.sin(gameTimer * 0.18 + obstacle.phase) * 5;
      const r = obstacle.radius;
      ctx.fillStyle = "#581c87";
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, r * 0.28);
      ctx.bezierCurveTo(-r * 1.08, -r * 0.3, -r * 0.42, -r * 0.8, -r * 0.08, -r * 0.56 + squish);
      ctx.bezierCurveTo(r * 0.24, -r * 1.04, r * 0.9, -r * 0.62, r * 0.83, -r * 0.12);
      ctx.bezierCurveTo(r * 1.12, r * 0.28, r * 0.46, r * 0.78, r * 0.05, r * 0.62 - squish);
      ctx.bezierCurveTo(-r * 0.5, r * 0.92, -r * 0.95, r * 0.68, -r * 0.92, r * 0.28);
      ctx.fill();
      ctx.fillStyle = obstacle.color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, r * 0.22);
      ctx.bezierCurveTo(-r * 0.9, -r * 0.22, -r * 0.35, -r * 0.65, -r * 0.03, -r * 0.43 + squish);
      ctx.bezierCurveTo(r * 0.24, -r * 0.84, r * 0.72, -r * 0.5, r * 0.7, -r * 0.08);
      ctx.bezierCurveTo(r * 0.94, r * 0.2, r * 0.39, r * 0.6, r * 0.02, r * 0.47 - squish);
      ctx.bezierCurveTo(-r * 0.42, r * 0.74, -r * 0.8, r * 0.55, -r * 0.78, r * 0.22);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.26, -r * 0.27, r * 0.2, r * 0.09, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dcfce7";
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BOING", 0, r * 0.12);

    } else if (obstacle.type === "vacuum") {
      // World 4: an odd, layered Slissy-style vacuum creature made from body parts and a hose.
      const r = obstacle.radius;
      const wobble = Math.sin(gameTimer * 0.12 + obstacle.phase) * 4;
      ctx.strokeStyle = "#064e3b";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, r * 0.32);
      ctx.quadraticCurveTo(-r * 1.05, r * 0.78 + wobble, -r * 0.96, -r * 0.22);
      ctx.quadraticCurveTo(-r * 0.92, -r * 0.78, -r * 0.42, -r * 0.65);
      ctx.stroke();
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.roundRect(-r * 0.55, -r * 0.52, r * 1.12, r * 1.22, [r * 0.28]);
      ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(-r * 0.42, -r * 0.42, r * 0.84, r * 0.94, [r * 0.22]);
      ctx.fill();
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#052e16";
      ctx.beginPath();
      ctx.roundRect(-r * 0.28, -r * 0.16, r * 0.56, r * 0.28, [6]);
      ctx.fill();
      ctx.strokeStyle = "#86efac";
      ctx.lineWidth = 3;
      [-0.14, 0, 0.14].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x * r, -r * 0.1);
        ctx.lineTo(x * r, r * 0.04);
        ctx.stroke();
      });
      ctx.fillStyle = "#dcfce7";
      ctx.beginPath();
      ctx.arc(r * 0.32, -r * 0.28, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#166534";
      ctx.beginPath();
      ctx.arc(r * 0.34, -r * 0.28, r * 0.045, 0, Math.PI * 2);
      ctx.fill();

    } else if (obstacle.type === "frostStatue") {
      // World 6: massive statues that are icy blue on the outside and warm within.
      const r = obstacle.radius;
      const warmth = (Math.sin(gameTimer * 0.12 + obstacle.phase) + 1) / 2;
      ctx.shadowColor = "#fed7aa";
      ctx.shadowBlur = 12 + warmth * 18;
      ctx.fillStyle = "#1e3a8a";
      ctx.beginPath();
      ctx.roundRect(-r * 0.5, -r * 0.8, r, r * 1.55, [r * 0.18]);
      ctx.fill();
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.roundRect(-r * 0.4, -r * 0.7, r * 0.8, r * 1.34, [r * 0.14]);
      ctx.fill();
      ctx.strokeStyle = "#dbeafe";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Warm glowing cracks make the statues look both frozen and heated from inside.
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.45 + warmth * 0.5})`;
      ctx.lineWidth = Math.max(3, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.52); ctx.lineTo(0, -r * 0.2); ctx.lineTo(-r * 0.12, r * 0.12); ctx.lineTo(r * 0.16, r * 0.48);
      ctx.moveTo(r * 0.22, -r * 0.42); ctx.lineTo(r * 0.06, -r * 0.04); ctx.lineTo(r * 0.27, r * 0.28);
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-r * 0.16, -r * 0.25, r * 0.08, 0, Math.PI * 2);
      ctx.arc(r * 0.16, -r * 0.25, r * 0.08, 0, Math.PI * 2);
      ctx.fill();

    } else if (obstacle.type === "volcano") {
      // World 5: giant volcanoes with glowing lava mouths block the arena.
      const r = obstacle.radius;
      const heat = (Math.sin(gameTimer * 0.16 + obstacle.phase) + 1) / 2;
      ctx.shadowColor = "#fb4b18";
      ctx.shadowBlur = 18 + heat * 18;

      ctx.fillStyle = "#431407";
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, r * 0.72);
      ctx.lineTo(-r * 0.42, -r * 0.32);
      ctx.lineTo(-r * 0.18, -r * 0.82);
      ctx.lineTo(0, -r * 0.58);
      ctx.lineTo(r * 0.2, -r * 0.88);
      ctx.lineTo(r * 0.42, -r * 0.28);
      ctx.lineTo(r * 0.98, r * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#9a3412";
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, r * 0.7);
      ctx.lineTo(-r * 0.3, -r * 0.22);
      ctx.lineTo(-r * 0.1, -r * 0.58);
      ctx.lineTo(r * 0.12, -r * 0.4);
      ctx.lineTo(r * 0.38, -r * 0.18);
      ctx.lineTo(r * 0.8, r * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(255, 236, 153, ${0.65 + heat * 0.3})`;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = Math.max(3, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, -r * 0.58);
      ctx.lineTo(-r * 0.06, -r * 0.22);
      ctx.lineTo(-r * 0.28, r * 0.26);
      ctx.moveTo(r * 0.13, -r * 0.46);
      ctx.lineTo(r * 0.08, -r * 0.05);
      ctx.lineTo(r * 0.32, r * 0.42);
      ctx.stroke();
      ctx.fillStyle = "#160b08";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.62, r * 0.22, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(251, 146, 60, ${0.45 + heat * 0.4})`;
      ctx.beginPath();
      ctx.arc(-r * 0.05, -r * 0.78, r * 0.13, 0, Math.PI * 2);
      ctx.arc(r * 0.14, -r * 1.02, r * 0.09, 0, Math.PI * 2);
      ctx.fill();

    } else if (obstacle.type === "discoBall") {
      const r = obstacle.radius;
      ctx.shadowColor = "#f0abfc";
      ctx.shadowBlur = 34 + pulse * 28;
      ctx.fillStyle = "#475569";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      const tileColors = ["#f472b6", "#60a5fa", "#22c55e", "#facc15", "#c084fc"];
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
          const x = col * r * 0.32 + (row % 2) * 3;
          const y = row * r * 0.28;
          if (x * x + y * y < r * r * 0.76) {
            ctx.fillStyle = tileColors[(row + col + 8) % tileColors.length];
            ctx.fillRect(x - 5, y - 5, 10, 10);
          }
        }
      }
      // Bright beams make the giant disco ball look lit up.
      ctx.globalAlpha = 0.22 + pulse * 0.2;
      for (let beam = 0; beam < 8; beam++) {
        const angle = obstacle.phase + gameTimer * 0.055 + beam * Math.PI / 4;
        ctx.strokeStyle = tileColors[beam % tileColors.length];
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
        ctx.lineTo(Math.cos(angle) * r * 1.7, Math.sin(angle) * r * 1.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.78); ctx.lineTo(-r * 0.52, -r * 1.18); ctx.lineTo(r * 0.52, -r * 1.18); ctx.lineTo(r * 0.34, -r * 0.78); ctx.stroke();

    } else if (obstacle.type === "egg") {
      // Egg World uses large, solid white eggs rather than the green foliage from World 1.
      const eggScale = obstacle.radius / 38;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(-12 * eggScale, 5 * eggScale, 20 * eggScale, 29 * eggScale, -0.2, 0, Math.PI * 2);
      ctx.ellipse(14 * eggScale, 3 * eggScale, 21 * eggScale, 30 * eggScale, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2.5 * eggScale;
      ctx.stroke();
      ctx.strokeStyle = obstacle.accent;
      ctx.lineWidth = 3 * eggScale;
      ctx.beginPath();
      ctx.moveTo(-12 * eggScale, -18 * eggScale);
      ctx.lineTo(-2 * eggScale, -4 * eggScale);
      ctx.lineTo(-10 * eggScale, 8 * eggScale);
      ctx.lineTo(2 * eggScale, 23 * eggScale);
      ctx.moveTo(15 * eggScale, -19 * eggScale);
      ctx.lineTo(7 * eggScale, -4 * eggScale);
      ctx.lineTo(18 * eggScale, 10 * eggScale);
      ctx.stroke();

    } else {
      ctx.fillStyle = obstacle.color;
      ctx.beginPath();
      ctx.arc(0, 0, obstacle.radius - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
      ctx.beginPath();
      ctx.arc(-8, 8, obstacle.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = obstacle.accent;
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obstacle.symbol, 0, 2);
    }

    // Keep the handmade World 2 and 4 silhouettes free of the generic circular outline.
    if (obstacle.type !== "bouncyGoo" && obstacle.type !== "vacuum" && obstacle.type !== "frostStatue") {
      ctx.strokeStyle = obstacle.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, obstacle.radius + 2 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (obstacle.type === "bramble" || obstacle.type === "thunder") {
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2.5;
      for (let bolt = 0; bolt < 4; bolt++) {
        const angle = obstacle.phase + gameTimer * 0.12 + bolt * (Math.PI / 2);
        const x = Math.cos(angle) * 25;
        const y = Math.sin(angle) * 25;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle + 0.55) * 9, y + Math.sin(angle + 0.55) * 9);
        ctx.lineTo(x + Math.cos(angle - 0.25) * 17, y + Math.sin(angle - 0.25) * 17);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function drawSecretShopScreen() {
  ctx.fillStyle = "#120b22";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0abfc";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("🧙 SECRET SHOP OLD MAN 🧙", V_WIDTH / 2, 95);
  ctx.fillStyle = "#fef08a";
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 16;
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`⭐ YOUR STARS: ${shopStars} ⭐`, V_WIDTH / 2, 145);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a78bfa";
  ctx.beginPath(); ctx.arc(V_WIDTH / 2, 218, 48, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "50px sans-serif"; ctx.fillText("🧓", V_WIDTH / 2, 235);
  ctx.fillStyle = "#e9d5ff"; ctx.font = "16px sans-serif";
  ctx.fillText("Spend your collected stars before the boss battle!", V_WIDTH / 2, 285);
  [[180, "⚡ FAST BOOTS", "10 stars: move faster"], [510, "❤️ EXTRA HEART", "8 stars: gain 1 heart"]].forEach(([x, title, detail]) => {
    ctx.fillStyle = "#312e81"; ctx.beginPath(); ctx.roundRect(x, 310, 210, 100, [14]); ctx.fill();
    ctx.strokeStyle = "#f0abfc"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 17px sans-serif"; ctx.fillText(title, x + 105, 348);
    ctx.fillStyle = "#c4b5fd"; ctx.font = "13px sans-serif"; ctx.fillText(detail, x + 105, 375);
  });
  const [worldItemTitle, worldItemDetail] = getWorldShopItem();
  ctx.fillStyle = "#7c2d12"; ctx.beginPath(); ctx.roundRect(345, 425, 210, 80, [14]); ctx.fill();
  ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px sans-serif"; ctx.fillText(worldItemTitle, V_WIDTH / 2, 455);
  ctx.fillStyle = "#fed7aa"; ctx.font = "13px sans-serif"; ctx.fillText(worldItemDetail, V_WIDTH / 2, 480);
  ctx.fillStyle = "#4c1d95"; ctx.beginPath(); ctx.roundRect(350, 535, 200, 55, [12]); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px sans-serif"; ctx.fillText("FIGHT THE BOSS", V_WIDTH / 2, 570);
}

function drawPlayingScreen() {
  drawPlanetBackground();
  if (!secretSpotFound) {
    const secretX = V_WIDTH - 68;
    const secretY = 108;
    ctx.save();
    ctx.globalAlpha = 0.32 + Math.sin(gameTimer * 0.15) * 0.15;
    ctx.shadowColor = "#f0abfc"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#7e22ce";
    ctx.beginPath(); ctx.arc(secretX, secretY, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fef08a"; ctx.font = "15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", secretX, secretY + 5);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < V_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, V_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < V_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(V_WIDTH, y);
    ctx.stroke();
  }

  drawLevelObstacles();

  stars.forEach(star => {
    if (!star.collected) {
      const pulseSize = star.radius + Math.sin(star.pulse) * 3;
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ffd166";
      ctx.font = `${Math.floor(pulseSize * 1.8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⭐", 0, 0);
      ctx.restore();
    }
  });

  bullets.forEach(b => {
    ctx.save();
    if (b.isWinstonTornado) {
      ctx.translate(b.x, b.y);
      ctx.rotate(-gameTimer * 0.26);
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 30;
      // A tall, glowing tornado of blue thunder, gold lasers, and pink danger sparks.
      for (let ring = 0; ring < 7; ring++) {
        const width = b.radius - ring * 6;
        ctx.strokeStyle = ring % 3 === 0 ? "#f472b6" : (ring % 2 ? "#fef08a" : "#60a5fa");
        ctx.lineWidth = 10 - ring * 0.55;
        ctx.beginPath();
        ctx.ellipse(0, 34 - ring * 14, width, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-16, -52); ctx.lineTo(10, -69); ctx.lineTo(-3, -83); ctx.lineTo(16, -102);
      ctx.stroke();
      for (let laser = 0; laser < 4; laser++) {
        const angle = laser * Math.PI / 2 + gameTimer * 0.1;
        ctx.strokeStyle = laser % 2 ? "#fef08a" : "#f472b6";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 14 - 24);
        ctx.lineTo(Math.cos(angle) * 61, Math.sin(angle) * 61 - 24);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (b.isThunderVolcano) {
      ctx.translate(b.x, b.y);
      ctx.shadowColor = "#fef08a";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#9a3412";
      ctx.beginPath(); ctx.moveTo(-b.radius, b.radius); ctx.lineTo(0, -b.radius); ctx.lineTo(b.radius, b.radius); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, -b.radius); ctx.lineTo(8, -b.radius - 16); ctx.lineTo(-3, -b.radius - 27); ctx.stroke();
      ctx.restore();
      return;
    }
    if (b.isElectricTornado) {
      ctx.translate(b.x, b.y);
      ctx.rotate(gameTimer * 0.25);
      ctx.strokeStyle = "#fef08a";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 20;
      ctx.lineWidth = 8;
      // A tall cone of spinning electric rings, not a flat circle.
      for (let ring = 0; ring < 6; ring++) {
        const width = b.radius - ring * 6.5;
        ctx.beginPath();
        ctx.ellipse(0, 28 - ring * 13, width, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    if (b.isElectricBolt) {
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2);
      ctx.lineTo(b.x - b.vx * 0.5 + 8, b.y - b.vy * 0.5 - 7);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (b.isThunderLaser) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx, b.y - b.vy);
      ctx.lineTo(b.x - b.vx * 0.45 + 8, b.y - b.vy * 0.45 - 8);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.restore();
  });

  gooBuddies.forEach(buddy => {
    const squish = 1 + Math.sin(buddy.bob) * 0.16;
    ctx.save();
    ctx.translate(buddy.x, buddy.y - Math.abs(Math.sin(buddy.bob)) * 10);
    ctx.scale(1 / squish, squish);
    ctx.fillStyle = "#2ecc71";
    ctx.shadowColor = "#a8ff78";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, buddy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8ff78";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-3.5, -1.5, 3, 0, Math.PI * 2);
    ctx.arc(3.5, -1.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(-3.5, -1.5, 1.2, 0, Math.PI * 2);
    ctx.arc(3.5, -1.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 3, 3, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  });

  enemyBullets.forEach(eb => {
    ctx.save();
    if (eb.isVolcanoAsteroid) {
      // A spinning meteor rock carrying its own tiny erupting volcano.
      ctx.translate(eb.x, eb.y);
      ctx.rotate(Math.atan2(eb.vy, eb.vx) + gameTimer * 0.18);
      ctx.shadowColor = "#fb923c";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#431407";
      ctx.beginPath(); ctx.arc(0, 0, eb.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9a3412";
      ctx.beginPath(); ctx.arc(-4, 3, eb.radius * 0.72, 0, Math.PI * 2); ctx.fill();
      // Volcano cone and its glowing lava crater sit on top of the asteroid.
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(0, -25); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath(); ctx.ellipse(0, -21, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, -32); ctx.lineTo(-2, -39); ctx.stroke();
      ctx.restore();
      return;
    }
    if (eb.isDiscoBall) {
      ctx.translate(eb.x, eb.y);
      ctx.rotate(gameTimer * 0.24);
      ctx.shadowColor = "#f0abfc";
      ctx.shadowBlur = 18;
      const colors = ["#f472b6", "#60a5fa", "#22c55e", "#facc15"];
      for (let tile = 0; tile < 8; tile++) {
        ctx.fillStyle = colors[tile % colors.length];
        const angle = tile * Math.PI / 4;
        ctx.fillRect(Math.cos(angle) * 5 - 4, Math.sin(angle) * 5 - 4, 8, 8);
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, eb.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle = eb.color;
    ctx.shadowColor = eb.color;
    ctx.shadowBlur = 12;
    if (eb.isDjLaser) {
      ctx.strokeStyle = eb.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(eb.x, eb.y);
      ctx.lineTo(eb.x - eb.vx * 7, eb.y - eb.vy * 7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  if (currentBoss) {
    currentBoss.draw();
  } else {
    minions.forEach(m => m.draw());
  }

  player.draw();

  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.fillStyle = ft.color;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });

  drawHUD();
}

function drawHUD() {
  ctx.fillStyle = "rgba(10, 15, 25, 0.88)";
  ctx.fillRect(0, 0, V_WIDTH, 52);
  ctx.strokeStyle = "#1f2937";
  ctx.strokeRect(0, 0, V_WIDTH, 52);

  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  let heartsStr = "";
  for (let i = 0; i < player.hp; i++) heartsStr += "❤️";
  ctx.fillText(heartsStr, 15, 33);

  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(`⭐ Stars: ${starsCollected}/10`, 160, 33);

  ctx.fillStyle = "#00f0ff";
  ctx.fillText(`🏆 Score: ${score}`, 300, 33);

  ctx.fillStyle = currentSubLevel === 3 ? "#ff4757" : "#a0c4ff";
  const stageName = currentSubLevel === 3 ? `WORLD ${currentWorld} [${VILLAINS[currentWorld - 1].name.toUpperCase()} BOSS]` : `WORLD ${currentWorld} - LEVEL ${currentSubLevel}/3`;
  ctx.fillText(stageName, 430, 33);

  if (currentBoss) {
    ctx.fillStyle = currentBoss.data.color;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "right";
    let bossHearts = "";
    for (let h = 0; h < currentBoss.hp; h++) bossHearts += "❤️";
    for (let h = currentBoss.hp; h < currentBoss.maxHp; h++) bossHearts += "🖤";
    const bossLabel = currentBoss.data.isMineMan ? "💣 MINE MAN" : (currentBoss.isHatched ? "🦑 WEIRD SQUID" : "🥚 CRACK-EGG");
    ctx.fillText(`${bossLabel}: ${bossHearts}`, V_WIDTH - 20, 33);
  } else {
    ctx.fillStyle = "#2ecc71";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`👾 Enemies: ${minions.length}`, V_WIDTH - 20, 33);
  }

  const gaugeW = 200;
  const gaugeH = 14;
  const gaugeX = 20;
  const gaugeY = V_HEIGHT - 25;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);

  const spReady = player.specialTimer <= 0;
  const spPercent = spReady ? 1 : 1 - (player.specialTimer / player.specialCooldown);
  ctx.fillStyle = spReady ? "#ffd166" : "#4b6584";
  ctx.fillRect(gaugeX, gaugeY, gaugeW * spPercent, gaugeH);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(spReady ? `✨ ${player.hero.name.toUpperCase()} SPECIAL READY! [E]` : `⏳ Charging Special...`, gaugeX + 5, gaugeY - 5);
}

function drawStageClearScreen() {
  ctx.fillStyle = "rgba(10, 15, 25, 0.92)";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  const worldData = VILLAINS[currentWorld - 1];

  ctx.textAlign = "center";
  ctx.fillStyle = "#2ecc71";
  ctx.shadowColor = "#2ecc71";
  ctx.shadowBlur = 20;
  ctx.font = "bold 42px sans-serif";

  if (currentSubLevel === 1) {
    ctx.fillText("🎉 LEVEL 1 CLEARED! 🎉", V_WIDTH / 2, 140);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`${selectedHero.name} beat the first gauntlet stage!`, V_WIDTH / 2, 195);
  } else if (currentSubLevel === 2) {
    ctx.fillText("⚡ LEVEL 2 CLEARED! ⚡", V_WIDTH / 2, 140);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff4757";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`⚠️ WARNING: ${worldData.name} IS WAITING! ⚠️`, V_WIDTH / 2, 195);
  } else {
    ctx.fillText("👑 BOSS DEFEATED! 👑", V_WIDTH / 2, 130);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`You defeated ${worldData.name}!`, V_WIDTH / 2, 180);

    if (newlyUnlockedHero) {
      ctx.fillStyle = newlyUnlockedHero.color;
      ctx.shadowColor = newlyUnlockedHero.color;
      ctx.shadowBlur = 15;
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(`🎉 NEW HERO UNLOCKED: ${newlyUnlockedHero.name} ${newlyUnlockedHero.symbol}!`, V_WIDTH / 2, 230);
      ctx.shadowBlur = 0;
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.fillText(`Total Score: ${score} Points ⭐`, V_WIDTH / 2, 280);

  const btnY = 360;
  ctx.fillStyle = currentSubLevel === 2 ? "#ff4757" : "#00f0ff";
  ctx.shadowColor = currentSubLevel === 2 ? "#ff4757" : "#00f0ff";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(V_WIDTH / 2 - 150, btnY, 300, 55, [12]);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000000";
  ctx.font = "bold 20px sans-serif";

  let nextBtnText = "";
  if (currentSubLevel === 1) nextBtnText = `➡️ GO TO LEVEL 2/3`;
  else if (currentSubLevel === 2) nextBtnText = `👾 FIGHT ${worldData.name.toUpperCase()} (3/3)!`;
  else if (currentWorld < 10) nextBtnText = `🚀 GO TO WORLD ${currentWorld + 1}!`;
  else nextBtnText = `👑 FINAL VICTORY!`;

  ctx.fillText(nextBtnText, V_WIDTH / 2, btnY + 35);

  if (newlyUnlockedHero || currentSubLevel === 3) {
    const heroBtnY = 435;
    ctx.fillStyle = "#a55eea";
    ctx.shadowColor = "#a55eea";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(V_WIDTH / 2 - 150, heroBtnY, 300, 50, [12]);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("🦸 CHOOSE / SWITCH HERO", V_WIDTH / 2, heroBtnY + 32);
  }

  if (currentSubLevel === 2) {
    const shopY = 435;
    ctx.fillStyle = "#7e22ce";
    ctx.shadowColor = "#f0abfc";
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.roundRect(V_WIDTH / 2 - 150, shopY, 300, 50, [12]); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`🧙 SECRET SHOP — ${shopStars} ⭐`, V_WIDTH / 2, shopY + 32);
  }
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(15, 5, 5, 0.92)";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff4757";
  ctx.shadowColor = "#ff4757";
  ctx.shadowBlur = 20;
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("💥 OH NO! TRY AGAIN! 💥", V_WIDTH / 2, 200);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a0c4ff";
  ctx.font = "20px sans-serif";
  const lvlText = currentSubLevel === 3 ? `${VILLAINS[currentWorld - 1].name} Boss Battle` : `World ${currentWorld} - Level ${currentSubLevel}`;
  ctx.fillText(`${selectedHero.name} needs another try against ${lvlText}!`, V_WIDTH / 2, 260);

  const btnY = 360;
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(V_WIDTH / 2 - 130, btnY, 260, 60, [12]);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("🔄 RETRY LEVEL", V_WIDTH / 2, btnY + 38);
}

function drawVictoryScreen() {
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

  confetti.forEach(c => {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.size, c.size);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 25;
  ctx.font = "bold 44px sans-serif";
  ctx.fillText("🏆 ALL 10 WORLDS CONQUERED! 🏆", V_WIDTH / 2, 160);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2ecc71";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("Your squad conquered ALL 10 BOSSES!", V_WIDTH / 2, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "22px sans-serif";
  ctx.fillText(`Final Grand Score: ${score} Points! ⭐`, V_WIDTH / 2, 275);

  const btnY = 380;
  ctx.fillStyle = "#fd79a8";
  ctx.shadowColor = "#fd79a8";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(V_WIDTH / 2 - 140, btnY, 280, 60, [12]);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("🎮 PLAY AGAIN!", V_WIDTH / 2, btnY + 38);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
