// Flope & Dope - Sketchbook Platformer Engine

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Screens & Buttons
const charSelectScreen = document.getElementById('character-select-screen');
const gameplayScreen = document.getElementById('gameplay-screen');
const startGameBtn = document.getElementById('start-game-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverOverlay = document.getElementById('game-over-overlay');

// HUD Elements
const hudHeroName = document.getElementById('hud-hero-name');
const hudHearts = document.getElementById('hud-hearts');

// State Variables
let activeHero = null;
let gameRunning = false;
let cameraX = 0;
let shakeTimer = 0;
let currentLevel = 1; // 1 = World 1-1, 2 = 1-2, 3 = 1-3 (Boss Level)
let levelWidth = 2400; // Multi-screen scrolling
const levelHeight = canvas.height;
let bossIntroTimer = 0;

// Tabs references
const notebookTabs = document.querySelector('.notebook-tabs');
const tabPlay = document.getElementById('tab-play');
const tabGuide = document.getElementById('tab-guide');
const monsterGuideScreen = document.getElementById('monster-guide-screen');

// Preload character images
const heroImages = {};
const heroTypes = ['giant-dad', 'hip-p', 'tuskanty', 'among-us-ben', 'hosco'];
heroTypes.forEach(type => {
    const img = new Image();
    img.src = `assets/characters/${type}.png`;
    // Art is optional: every renderer has a sketch fallback, so never retain a
    // broken image that Canvas would reject in drawImage().
    img.onerror = () => { heroImages[type] = null; };
    heroImages[type] = img;
});

// Preload enemy images
const enemyImages = {};
const enemyTypes = ['dragon-wing', 'dungeon-king', 'blood-shark', 'star-shell-bug', 'dungeon-emperor'];
enemyTypes.forEach(type => {
    const img = new Image();
    img.src = `assets/enemies/${type}.png`;
    img.onerror = () => { enemyImages[type] = null; };
    enemyImages[type] = img;
});

// Keyboard Input State
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

// Physics Constants
const GRAVITY = 0.5;
const FRICTION = 0.85;

// Player Class
class Player {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Stats based on character selection
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 4;
        this.jumpForce = -11;
        this.grounded = false;
        this.hearts = 6;
        this.invulnerableFrame = 0;
        
        // Ground Pound Mechanic
        this.isGroundPounding = false;
        
        // Sneak Mechanic (Hip-P)
        this.isSneaking = false;
        
        // Digging Mechanic (Tuskanty)
        this.isDigging = false;
        
        // Double jump / box spawn (Hosco)
        this.canSpawnBox = false;

        // Space/Lava level properties
        this.gravityMultiplier = 1.0;
        this.lavaShieldTimer = 0;

        // Squash & stretch / rotation animation properties
        this.scaleX = 1;
        this.scaleY = 1;
        this.angle = 0;
        this.wasGrounded = false;
        this.airplaneSpawned = false;

        this.applyStats();
    }

    applyStats() {
        switch(this.type) {
            case 'giant-dad':
                this.speed = 3.5;
                this.jumpForce = -10.5;
                this.width = 40;
                this.height = 56;
                break;
            case 'hip-p':
                this.speed = 4.2;
                this.jumpForce = -9.5;
                this.width = 24;
                this.height = 32;
                break;
            case 'tuskanty':
                this.speed = 4.0;
                this.jumpForce = -11.0;
                break;
            case 'among-us-ben':
                this.speed = 6.0; // SUPER SPEED
                this.jumpForce = -10.5;
                break;
            case 'hosco':
                this.speed = 4.0;
                this.jumpForce = -12.0; // High jumper
                this.canSpawnBox = true;
                break;
            case 'electro':
                this.speed = 4.5;
                this.jumpForce = -11.0;
                break;
        }
    }

    resolveCollisionsX() {
        // Keep inside bounds
        if (this.x < 0) this.x = 0;
        if (this.x > levelWidth - this.width) this.x = levelWidth - this.width;

        // Collide with platforms
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.width > p.x &&
                this.y < p.y + p.h && this.y + this.height > p.y) {
                
                if (this.vx > 0) {
                    this.x = p.x - this.width;
                    this.vx = 0;
                } else if (this.vx < 0) {
                    this.x = p.x + p.w;
                    this.vx = 0;
                }
            }
        });

        // Collide with pushable boxes
        pushableBoxes.forEach(box => {
            if (this.x < box.x + box.w && this.x + this.width > box.x &&
                this.y < box.y + box.h && this.y + this.height > box.y) {
                
                // Push the box!
                if (this.vx > 0) {
                    box.vx = this.vx;
                    this.x = box.x - this.width;
                } else if (this.vx < 0) {
                    box.vx = this.vx;
                    this.x = box.x + box.w;
                }
            }
        });
    }

    resolveCollisionsY() {
        this.grounded = false;

        // Collide with platforms
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.width > p.x &&
                this.y < p.y + p.h && this.y + this.height > p.y) {
                
                if (this.vy > 0) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                    
                    // Ground pound landing detail
                    if (this.isGroundPounding) {
                        this.isGroundPounding = false;
                        let shake = 8;
                        if (this.type === 'giant-dad') {
                            shake = 16;
                            enemies.forEach(e => {
                                if (Math.abs(e.x - this.x) < 150 && e.type !== 'electro') {
                                    e.y = 999;
                                }
                            });
                        }
                        if (this.type === 'electro') {
                            shake = 10;
                            projectiles.push(new Projectile(this.x, this.y + this.height - 15, -6, 0, 'hero'));
                            projectiles.push(new Projectile(this.x + this.width, this.y + this.height - 15, 6, 0, 'hero'));
                        }
                        triggerScreenShake(shake);
                    }
                } else if (this.vy < 0) {
                    this.y = p.y + p.h;
                    this.vy = 0;
                }
            }
        });

        // Collide with pushable boxes
        pushableBoxes.forEach(box => {
            if (this.x < box.x + box.w && this.x + this.width > box.x &&
                this.y < box.y + box.h && this.y + this.height > box.y) {
                
                if (this.vy > 0) {
                    this.y = box.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                } else if (this.vy < 0) {
                    this.y = box.y + box.h;
                    this.vy = 0;
                }
            }
        });

        // Bottom pit check (respawn player)
        if (this.y > levelHeight) {
            this.takeDamage(1);
            if (this.hearts > 0) {
                this.x = 80;
                this.y = levelHeight - 150;
                this.vx = 0;
                this.vy = 0;
                this.grounded = false;
            }
        }
    }

    update() {
        // Invulnerability blinking timer
        if (this.invulnerableFrame > 0) this.invulnerableFrame--;

        // Handle Sneak for Hip-P
        if (this.type === 'hip-p' && keys.down && this.grounded) {
            this.isSneaking = true;
            this.height = 18; // Shrink
        } else if (this.isSneaking) {
            this.isSneaking = false;
            this.height = 32; // Unshrink
            this.y -= 14;
        }

        // Handle Digging for Tuskanty
        if (this.type === 'tuskanty' && keys.down && this.grounded) {
            // Check if standing on soft diggable ground
            const standBlock = getBlockAt(this.x + this.width/2, this.y + this.height + 5);
            if (standBlock && standBlock.type === 'dirt') {
                this.isDigging = true;
            }
        }
        if (this.isDigging && (!keys.down || !this.grounded)) {
            // Stop digging if keys released or left block
            this.isDigging = false;
        }

        // Horizontal Movement
        let currentSpeed = this.speed;
        if (this.isSneaking) currentSpeed *= 0.4;
        if (this.isDigging) currentSpeed *= 0.5;

        if (keys.left) {
            this.vx = -currentSpeed;
        } else if (keys.right) {
            this.vx = currentSpeed;
        } else {
            this.vx *= FRICTION;
        }

        // Jump
        if (keys.up && this.grounded && !this.isDigging) {
            this.vy = this.jumpForce;
            this.grounded = false;
            this.scaleX = 0.78;
            this.scaleY = 1.35; // stretch on jump
            
            // Hosco resets box capability when hitting floor, but if he jumped, he can double jump once
            if (this.type === 'hosco') {
                this.canSpawnBox = true;
            }
        } 
        // Hosco double-jump box spawn
        else if (keys.up && !this.grounded && this.type === 'hosco' && this.canSpawnBox && this.vy > -2) {
            this.vy = this.jumpForce * 0.85;
            this.canSpawnBox = false;
            this.scaleX = 0.78;
            this.scaleY = 1.35;
            // Spawn a temporary platform block directly beneath him
            platforms.push(new Platform(this.x - 8, this.y + this.height, 48, 16, 'box'));
        }

        // Ground Pound Trigger
        if (keys.down && !this.grounded && !this.isGroundPounding && !this.isDigging && this.vy > -1) {
            this.isGroundPounding = true;
            this.vy = 12; // Slam down!
            this.vx = 0;
            this.scaleX = 0.75;
            this.scaleY = 1.4; // super stretch on slam!
        }

        // Decrement Lava Shield Timer if active
        if (this.lavaShieldTimer && this.lavaShieldTimer > 0) {
            this.lavaShieldTimer--;
        }

        // Apply Gravity
        if (this.isGroundPounding) {
            this.vy += 1.2; // Extra heavy drop
        } else if (this.isDigging) {
            this.vy = 0; // Don't fall through while digging!
        } else {
            this.vy += GRAVITY * (this.gravityMultiplier || 1.0);
        }

        // Separate axis movement & collision resolution
        this.x += this.vx;
        this.resolveCollisionsX();

        this.y += this.vy;
        this.resolveCollisionsY();

        // Squash/Stretch & tilt animation updates
        if (this.grounded) {
            // Wobble/rotate slightly while running
            if (Math.abs(this.vx) > 0.5) {
                this.angle = Math.sin(Date.now() / 90) * 0.08 * (Math.abs(this.vx) / this.speed);
                // Run dust spawn
                if (Math.random() < 0.2) {
                    particles.push(new Particle(this.x + this.width/2, this.y + this.height, -this.vx*0.2, (Math.random()-0.5)*1, 'rgba(120, 130, 140, 0.45)', 2.5 + Math.random()*2, 15, 'dust'));
                }
            } else {
                this.angle *= 0.8;
            }

            // If we just landed on the ground, trigger squash!
            if (!this.wasGrounded) {
                this.scaleX = 1.3;
                this.scaleY = 0.7;
                // Landing dust particles
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(this.x + this.width/2, this.y + this.height, (Math.random()-0.5)*4, -Math.random()*1.5, 'rgba(120, 130, 140, 0.45)', 2.5 + Math.random()*3, 20, 'dust'));
                }
            }
        } else {
            // Stretch when in mid-air
            this.angle = this.vx * 0.02;
            if (this.vy < 0) {
                this.scaleX = 0.88;
                this.scaleY = 1.15;
            } else {
                this.scaleX = 0.92;
                this.scaleY = 1.1;
            }
        }

        // Return scale gradually to 1
        this.scaleX += (1 - this.scaleX) * 0.15;
        this.scaleY += (1 - this.scaleY) * 0.15;
        this.wasGrounded = this.grounded;
        this.checkSignposts();
    }

    checkSignposts() {
        // Level 1 Signposts
        if (currentLevel === 1) {
            // 1. RUN! signpost at x = 180
            if (Math.abs(this.x + this.width/2 - 180) < 60) {
                this.speed = 6.5; // boost speed
                if (Math.random() < 0.3) {
                    particles.push(new Particle(this.x + this.width/2, this.y + this.height, -this.vx * 0.4, (Math.random()-0.5)*2, 'rgba(77, 171, 247, 0.5)', 2 + Math.random()*2, 12, 'dust'));
                }
            } else {
                this.applyStats(); // revert speed to normal
            }

            // 2. JUMP! signpost at x = 680
            if (Math.abs(this.x + this.width/2 - 680) < 40) {
                this.jumpForce = -14.5;
            } else {
                this.applyStats(); // revert jump force to normal
            }

            // 3. SECRET? signpost at x = 1050
            const secretX = 1100;
            const secretY = levelHeight - 40;
            const hasPlatform = platforms.some(p => p.x === secretX && p.y === secretY);
            if (Math.abs(this.x + this.width/2 - 1050) < 80) {
                if (!hasPlatform) {
                    platforms.push(new Platform(secretX, secretY, 150, 40, 'grass'));
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(secretX + 75, secretY + 10, (Math.random()-0.5)*5, -Math.random()*3, '#ffd43b', 12 + Math.random()*6, 25, 'star'));
                    }
                }
            }
        }
        else if (currentLevel === 2) {
            // 4. LOOK UP! signpost at x = 520
            if (Math.abs(this.x + this.width/2 - 520) < 50 && !this.airplaneSpawned) {
                this.airplaneSpawned = true;
                spawnPaperAirplane();
            }

            // 5. DIG HERE! signpost at x = 1140
            if (Math.abs(this.x + this.width/2 - 1140) < 45 && keys.down && this.grounded) {
                const standBlock = getBlockAt(this.x + this.width/2, this.y + this.height + 5);
                if (standBlock && standBlock.type === 'dirt') {
                    platforms = platforms.filter(p => p !== standBlock);
                    triggerScreenShake(6);
                    collectibles.push(new Collectible(this.x, this.y - 20, 'heart'));
                    for (let i = 0; i < 6; i++) {
                        particles.push(new Particle(this.x + this.width/2, this.y + this.height, (Math.random()-0.5)*6, -2 - Math.random()*3, '#a67c52', 3 + Math.random()*3, 20, 'dust'));
                    }
                }
            }
        }
        else if (currentLevel === 5) {
            // 6. PUSH! signpost at x = 180
            pushableBoxes.forEach(box => {
                if (box.x > 320 && !box.activated) {
                    box.activated = true;
                    collectibles.push(new Collectible(box.x + 12, box.y - 30, 'heart'));
                    for (let i = 0; i < 10; i++) {
                        particles.push(new Particle(box.x + 24, box.y, (Math.random()-0.5)*8, -2 - Math.random()*4, '#ffd43b', 14 + Math.random()*6, 30, 'star'));
                    }
                    triggerScreenShake(5);
                }
            });
        }
        else if (currentLevel === 7) {
            // Low gravity signpost at x = 300, extends across the chasm to the right shore (x = 200 to 1050)
            if (this.x + this.width/2 >= 200 && this.x + this.width/2 <= 1050) {
                this.gravityMultiplier = 0.36; // 0.5 * 0.36 = 0.18 gravity
                if (Math.random() < 0.15) {
                    particles.push(new Particle(this.x + (Math.random() - 0.5) * 40, this.y + this.height, (Math.random() - 0.5) * 1, -Math.random() * 2, 'rgba(77, 171, 247, 0.4)', 3 + Math.random() * 3, 40, 'star'));
                }
            } else {
                this.gravityMultiplier = 1.0;
            }
        }
        else if (currentLevel === 8) {
            // Portal teleportation at x = 380 -> x = 1050
            if (Math.abs(this.x + this.width/2 - 380) < 30 && Math.abs(this.y + this.height/2 - (levelHeight - 90)) < 40) {
                this.x = 1050;
                this.y = levelHeight - 150;
                triggerScreenShake(10);
                // Spawn particles at entry
                for (let i = 0; i < 15; i++) {
                    particles.push(new Particle(380, levelHeight - 90, (Math.random()-0.5)*6, (Math.random()-0.5)*6, '#4dabf7', 8 + Math.random()*8, 20, 'star'));
                }
                // Spawn particles at exit
                for (let i = 0; i < 15; i++) {
                    particles.push(new Particle(1050, levelHeight - 90, (Math.random()-0.5)*6, (Math.random()-0.5)*6, '#4dabf7', 8 + Math.random()*8, 20, 'star'));
                }
            }
        }
        else if (currentLevel === 10) {
            // Lava shield bubble signpost at x = 320
            if (Math.abs(this.x + this.width/2 - 320) < 40 && (!this.lavaShieldTimer || this.lavaShieldTimer <= 0)) {
                this.lavaShieldTimer = 900; // 15 seconds at 60fps
                triggerScreenShake(6);
                for (let i = 0; i < 12; i++) {
                    particles.push(new Particle(320, levelHeight - 80, (Math.random()-0.5)*5, -Math.random()*5, '#4dabf7', 8 + Math.random()*6, 30, 'dust'));
                }
            }
        }
        else if (currentLevel === 11) {
            // Box demolition bomb signpost at x = 700
            if (Math.abs(this.x + this.width/2 - 700) < 60 && !this.bombExploded) {
                this.bombExploded = true;
                triggerScreenShake(30);
                // Explode wall of boxes at x = 1150
                platforms = platforms.filter(p => !(p.x >= 1150 && p.x <= 1250 && p.type === 'box'));
                for (let i = 0; i < 20; i++) {
                    particles.push(new Particle(750, levelHeight - 80, (Math.random()-0.5)*12, -Math.random()*8, '#ff922b', 10 + Math.random()*10, 35, 'dust'));
                    particles.push(new Particle(1180, levelHeight - 100, (Math.random()-0.5)*15, (Math.random()-0.5)*10 - 3, '#ff6b6b', 12 + Math.random()*12, 40, 'dust'));
                }
            }
        }
        else if (currentLevel === 13) {
            // Enemy freeze trigger signpost at x = 400
            if (Math.abs(this.x + this.width/2 - 400) < 50 && !this.freezeTriggered) {
                this.freezeTriggered = true;
                enemies.forEach(e => {
                    e.freezeTimer = 480; // 8 seconds
                });
                triggerScreenShake(10);
                for (let i = 0; i < 25; i++) {
                    particles.push(new Particle(this.x + (Math.random()-0.5)*300, this.y + (Math.random()-0.5)*200, (Math.random()-0.5)*4, (Math.random()-0.5)*4, '#4dabf7', 4 + Math.random()*4, 30, 'star'));
                }
            }
        }
        else if (currentLevel === 14) {
            // Clone helper signpost at x = 400
            if (Math.abs(this.x + this.width/2 - 400) < 50 && !this.cloneSpawned) {
                this.cloneSpawned = true;
                clones.push(new Clone(this.x + 20, this.y, activeHero));
                triggerScreenShake(6);
                for (let i = 0; i < 12; i++) {
                    particles.push(new Particle(this.x, this.y, (Math.random()-0.5)*5, (Math.random()-0.5)*5, '#4dabf7', 8 + Math.random()*6, 25, 'star'));
                }
            }
        }
    }

    takeDamage(amount) {
        if (this.invulnerableFrame > 0) return;
        this.hearts -= amount;
        this.invulnerableFrame = 60; // 1 second invuln
        triggerScreenShake(10);
        
        // Spawn red ink particles when player takes damage
        for (let i = 0; i < 12; i++) {
            particles.push(new Particle(this.x + this.width/2, this.y + this.height/2, (Math.random()-0.5)*8, (Math.random()-0.5)*8 - 2, 'rgba(255, 107, 107, 0.85)', 3 + Math.random()*4, 25, 'dust'));
        }

        updateHUD();
        if (this.hearts <= 0) {
            endGame();
        }
    }

    draw() {
        if (this.invulnerableFrame > 0 && Math.floor(this.invulnerableFrame / 6) % 2 === 0) {
            return; // Flash effect
        }

        ctx.save();
        ctx.translate(-cameraX, 0);

        // Center point translations for squash/stretch & rotation
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);

        // Apply running waddle animation factor stacked with landing/jumping scale
        let drawScaleX = this.scaleX;
        let drawScaleY = this.scaleY;
        if (this.grounded && Math.abs(this.vx) > 0.5) {
            const waddlePulse = Math.sin(Date.now() / 60) * 0.07 * (Math.abs(this.vx) / this.speed);
            drawScaleX *= (1 + waddlePulse);
            drawScaleY *= (1 - waddlePulse);
        }
        ctx.scale(drawScaleX, drawScaleY);
        ctx.translate(-cx, -cy);

        const img = heroImages[this.type];
        if (img && img.complete && img.naturalWidth > 0) {
            // Flip image horizontally if running left
            if (this.vx < -0.1) {
                ctx.save();
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, this.width, this.height);
                ctx.restore();
            } else {
                ctx.drawImage(img, this.x, this.y, this.width, this.height);
            }
        } else {
            // Fallback shape if image is still loading
            const seed = Math.floor(this.x * 2 + this.y * 3);
            drawSketchyRect(this.x, this.y, this.width, this.height, '#ffe066', '#2b2b2b', 2.5, seed);
        }

        // Draw Ground Pound shockwave/smoke under player
        if (this.isGroundPounding) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(this.x - 5, this.y - 10);
            ctx.lineTo(this.x + this.width + 5, this.y - 10);
            ctx.stroke();
        }

        // Draw Lava Shield Bubble if active!
        if (this.lavaShieldTimer && this.lavaShieldTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(77, 171, 247, 0.85)';
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            // A sketchy shifting shield circle
            const r = Math.max(this.width, this.height) * 0.75;
            const shieldSeed = Math.floor(Date.now() / 150);
            const wX = (Math.sin(shieldSeed) * 2);
            const wY = (Math.cos(shieldSeed) * 2);
            ctx.arc(this.x + this.width/2 + wX, this.y + this.height/2 + wY, r, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw a subtle translucent inner fill
            ctx.fillStyle = 'rgba(77, 171, 247, 0.15)';
            ctx.fill();
            ctx.restore();
            
            // Draw floating timer text above player
            ctx.save();
            ctx.fillStyle = '#4dabf7';
            ctx.font = 'bold 15px Patrick Hand';
            ctx.textAlign = 'center';
            ctx.fillText(`🛡️ ${(this.lavaShieldTimer/60).toFixed(1)}s`, this.x + this.width/2, this.y - 15);
            ctx.restore();
        }

        ctx.restore();
    }
}

// Hand-Drawn Helper Functions (shaky outline generator)
let currentSketchFrame = 0;
let frameCount = 0;

function drawSketchyLine(x1, y1, x2, y2, strokeColor, width = 2.5, seed = 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getWiggle(offset) {
        // Deterministic pseudo-random based on seed, offset and current sketchy frame
        const val = Math.sin(seed * 12.9898 + offset * 78.233 + currentSketchFrame * 23.11) * 43758.5453;
        return (val - Math.floor(val)) - 0.5; // range [-0.5, 0.5]
    }

    for (let pass = 0; pass < 2; pass++) {
        ctx.save();
        ctx.lineWidth = pass === 0 ? width : width * 0.7;
        ctx.globalAlpha = pass === 0 ? 0.85 : 0.45;
        
        ctx.beginPath();
        // Slightly shift the second pass to look like a double sketchy stroke
        const shiftX = pass === 0 ? 0 : getWiggle(99) * 1.5;
        const shiftY = pass === 0 ? 0 : getWiggle(100) * 1.5;
        
        ctx.moveTo(x1 + shiftX, y1 + shiftY);
        
        const midX = (x1 + x2) / 2 + getWiggle(pass * 10 + 1) * 3.5 + shiftX;
        const midY = (y1 + y2) / 2 + getWiggle(pass * 10 + 2) * 3.5 + shiftY;
        
        const endWiggleX = getWiggle(pass * 10 + 3) * 1.5;
        const endWiggleY = getWiggle(pass * 10 + 4) * 1.5;
        
        ctx.lineTo(midX, midY);
        ctx.lineTo(x2 + endWiggleX + shiftX, y2 + endWiggleY + shiftY);
        ctx.stroke();
        ctx.restore();
    }
}

function fillCrayonRect(x, y, w, h, color, seed = 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip(); // Restrict crayon scribbles to the block bounds
    
    // 1. Soft solid background fill
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, y, w, h);
    
    // 2. Colored-pencil diagonal hatching scribbles
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.0;
    ctx.globalAlpha = 0.65;
    ctx.lineCap = 'round';
    
    function getWiggle(offset) {
        const val = Math.sin(seed * 9.81 + offset * 43.17 + currentSketchFrame * 7.5) * 23117.89;
        return (val - Math.floor(val)) - 0.5;
    }

    const step = 8; // Scribble spacing
    ctx.beginPath();
    for (let offset = -h; offset < w; offset += step) {
        const startX = x + offset + getWiggle(offset) * 4;
        const startY = y + getWiggle(offset + 1) * 4;
        const endX = x + offset + h + getWiggle(offset + 2) * 4;
        const endY = y + h + getWiggle(offset + 3) * 4;
        
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    }
    ctx.stroke();
    ctx.restore();
}

function drawSketchyRect(x, y, w, h, fillColor, strokeColor, width = 2.5, seed = 0) {
    if (fillColor) {
        fillCrayonRect(x, y, w, h, fillColor, seed);
    }
    
    if (strokeColor) {
        drawSketchyLine(x, y, x + w, y, strokeColor, width, seed + 1);
        drawSketchyLine(x + w, y, x + w, y + h, strokeColor, width, seed + 2);
        drawSketchyLine(x + w, y + h, x, y + h, strokeColor, width, seed + 3);
        drawSketchyLine(x, y + h, x, y, strokeColor, width, seed + 4);
    }
}

function drawSketchyCircle(cx, cy, r, fillColor, strokeColor, seed = 0) {
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fill();
    }
    
    if (strokeColor) {
        function getWiggle(offset) {
            const val = Math.sin(seed * 12.9898 + offset * 78.233 + currentSketchFrame * 23.11) * 43758.5453;
            return (val - Math.floor(val)) - 0.5;
        }

        for (let pass = 0; pass < 2; pass++) {
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = pass === 0 ? 2.5 : 1.5;
            ctx.globalAlpha = pass === 0 ? 0.85 : 0.45;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            
            const steps = 16;
            for (let i = 0; i <= steps; i++) {
                const theta = (i / steps) * Math.PI * 2;
                const wiggle = getWiggle(i + pass * 20) * 3;
                const rx = cx + (r + wiggle) * Math.cos(theta);
                const ry = cy + (r + wiggle) * Math.sin(theta);
                if (i === 0) ctx.moveTo(rx, ry);
                else ctx.lineTo(rx, ry);
            }
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawSketchyHair(x1, y1, x2, y2, color, seed = 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    function getWiggle(offset) {
        const val = Math.sin(seed * 14.123 + offset * 45.67 + currentSketchFrame * 17.1) * 43758.5453;
        return (val - Math.floor(val)) - 0.5;
    }

    const cx = (x1 + x2)/2 + getWiggle(1) * 3;
    ctx.lineTo(cx - 5, y1 - 8 + getWiggle(2) * 3);
    ctx.lineTo(cx, y1 - 4 + getWiggle(3) * 3);
    ctx.lineTo(cx + 5, y1 - 8 + getWiggle(4) * 3);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawWildHair(cx, cy, radius, color, seed = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const spikes = 20;
    
    function getWiggle(offset) {
        const val = Math.sin(seed * 31.2 + offset * 63.8 + currentSketchFrame * 11.4) * 12345.67;
        return (val - Math.floor(val)) - 0.5;
    }

    for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        const dist = radius + (getWiggle(i) * 5) + 3;
        const sx = cx + dist * Math.cos(angle);
        const sy = cy + dist * Math.sin(angle);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
}

function drawSketchySignpost(x, y, text, seed = 0) {
    // Draw wooden post
    drawSketchyLine(x, y, x, y + 40, '#a67c52', 3, seed);
    // Draw paper sign board
    drawSketchyRect(x - 45, y - 24, 90, 24, '#faf6ee', '#2b2b2b', 2.0, seed + 1);
    // Draw handwritten text
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '14px Gochi Hand';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 8);
}

function spawnPaperAirplane() {
    const plane = new Enemy(-50, 60, 'dragon-wing'); // use dragon-wing stats but let's override its type/draw
    plane.type = 'paper-airplane';
    plane.vx = 4.0;
    plane.vy = 0;
    plane.w = 40;
    plane.h = 24;
    plane.droppedHeart = false;
    enemies.push(plane);
}

// Platforms & Environment blocks
class Platform {
    constructor(x, y, w, h, type = 'grass') {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type; // 'grass', 'dirt', 'brick', 'box'
    }

    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        let fill = '#51cf66'; // Grass green
        let stroke = '#2b2b2b';

        if (this.type === 'dirt') fill = '#a67c52';
        if (this.type === 'brick') fill = '#ff8787';
        if (this.type === 'box') fill = '#ffd8a8';
        if (this.type === 'bridge') fill = '#ffd8a8'; // wood brown

        const seed = Math.floor(this.x * 17 + this.y * 31);
        drawSketchyRect(this.x, this.y, this.w, this.h, fill, stroke, 2.5, seed);
        
        // Dynamic sketchy block interiors
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.5;

        if (this.type === 'grass') {
            // Draw sketchy blades of grass on top
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.85)';
            for (let gx = this.x + 4; gx < this.x + this.w - 4; gx += 12) {
                const seedG = seed + gx;
                function getWiggleG(offset) {
                    const val = Math.sin(seedG * 12.9898 + offset * 78.233 + currentSketchFrame * 15.0) * 43758.5453;
                    return (val - Math.floor(val)) - 0.5;
                }
                ctx.beginPath();
                ctx.moveTo(gx, this.y);
                ctx.lineTo(gx - 2 + getWiggleG(1)*4, this.y - 6 - getWiggleG(2)*5);
                ctx.moveTo(gx + 3, this.y);
                ctx.lineTo(gx + 1 + getWiggleG(3)*4, this.y - 4 - getWiggleG(4)*4);
                ctx.stroke();
            }
        } 
        else if (this.type === 'brick') {
            // Draw a brick wall grid pattern inside the platform
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.22)';
            ctx.lineWidth = 1.5;
            // Horizontal brick lines
            for (let by = this.y + 10; by < this.y + this.h; by += 10) {
                drawSketchyLine(this.x, by, this.x + this.w, by, 'rgba(43, 43, 43, 0.25)', 1.5, seed + by);
            }
            // Vertical brick lines (staggered)
            let row = 0;
            for (let by = this.y; by < this.y + this.h; by += 10) {
                let offset = (row % 2) * 10;
                for (let bx = this.x + offset; bx < this.x + this.w; bx += 20) {
                    drawSketchyLine(bx, by, bx, by + 10, 'rgba(43, 43, 43, 0.25)', 1.5, seed + bx + by);
                }
                row++;
            }
        } 
        else if (this.type === 'box') {
            // Draw wooden crate diagonals and planks
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.3)';
            ctx.lineWidth = 1.5;
            // Crossbars
            drawSketchyRect(this.x + 4, this.y + 4, this.w - 8, this.h - 8, null, 'rgba(43, 43, 43, 0.4)', 1.5, seed);
            drawSketchyLine(this.x + 4, this.y + 4, this.x + this.w - 4, this.y + this.h - 4, 'rgba(43, 43, 43, 0.3)', 1.5, seed + 1);
            drawSketchyLine(this.x + this.w - 4, this.y + 4, this.x + 4, this.y + this.h - 4, 'rgba(43, 43, 43, 0.3)', 1.5, seed + 2);
        } 
        else if (this.type === 'bridge') {
            // Draw sketchy wooden planks
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.5)';
            ctx.lineWidth = 1.8;
            for (let px = this.x + 16; px < this.x + this.w; px += 16) {
                drawSketchyLine(px, this.y, px, this.y + this.h, 'rgba(43, 43, 43, 0.4)', 1.5, seed + px);
            }
            for (let py = this.y + 4; py < this.y + this.h - 2; py += 6) {
                drawSketchyLine(this.x + 2, py, this.x + this.w - 2, py, 'rgba(43, 43, 43, 0.15)', 1.0, seed + py);
            }
        }
        else if (this.type === 'dirt') {
            // Draw sketchy pebbles and organic patterns
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.35)';
            ctx.fillStyle = 'rgba(43, 43, 43, 0.2)';
            // Little pebbles
            for (let px = this.x + 10; px < this.x + this.w - 10; px += 24) {
                const seedP = seed + px;
                function getWiggleP(offset) {
                    const val = Math.sin(seedP * 12.9898 + offset * 78.233) * 43758.5453;
                    return (val - Math.floor(val)); // [0, 1]
                }
                const py = this.y + 10 + getWiggleP(1) * (this.h - 20);
                drawSketchyCircle(px, py, 2 + getWiggleP(2)*2, 'rgba(43, 43, 43, 0.15)', '#2b2b2b', seedP);
            }
        }

        // Crayon scribble detail inside blocks
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 2.2;
        for (let ix = this.x + 8; ix < this.x + this.w; ix += 20) {
            ctx.beginPath();
            ctx.moveTo(ix, this.y + 4);
            ctx.lineTo(ix - 5, this.y + this.h - 4);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// Enemy Base Class & Subclasses
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'dragon-wing', 'electro', 'blood-shark'
        this.w = 32;
        this.h = 32;
        this.vx = -1.5;
        this.vy = 0;
        this.grounded = false;
        
        // Dragon Wing specifics
        this.spitCooldown = 120;
        
        // Electro specifics
        this.zapState = 0;

        // Blood Shark specifics
        this.wiggleTimer = Math.random() * 10;
        this.state = 'walk'; // 'walk', 'bend', 'whack'
        this.actionTimer = 0;

        // Walking animation timer
        this.animTimer = Math.random() * 100;
        
        this.freezeTimer = 0; // Frozen state timer
        
        this.applyStats();
    }
    applyStats() {
        const isEasy = (currentLevel <= 2);
        if (this.type === 'dragon-wing') {
            this.w = 48;
            this.h = 48;
            this.vx = isEasy ? -0.6 : -1.0;
        } else if (this.type === 'nippin') {
            this.w = 32;
            this.h = 32;
            this.vx = isEasy ? -0.7 : -1.2;
        } else if (this.type === 'star-shell-bug') {
            this.w = 34;
            this.h = 30;
            this.vx = isEasy ? -0.5 : -0.8;
        } else if (this.type === 'blood-shark') {
            this.w = 34;
            this.h = 36;
            this.vx = isEasy ? -0.8 : -1.5;
        } else if (this.type === 'spark-ball') {
            this.w = 24;
            this.h = 24;
            this.vx = isEasy ? -1.0 : -1.8;
        }
    }

    update() {
        if (this.freezeTimer && this.freezeTimer > 0) {
            this.freezeTimer--;
            return;
        }

        if (this.type === 'paper-airplane') {
            this.x += this.vx;
            this.y += this.vy;
            // Drop a heart when it reaches the middle of the screen (x = 350)
            if (this.x > 350 && !this.droppedHeart) {
                this.droppedHeart = true;
                collectibles.push(new Collectible(this.x, this.y + 10, 'heart'));
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(this.x, this.y + 10, (Math.random()-0.5)*3, Math.random()*2, '#4dabf7', 2+Math.random()*2, 20, 'dust'));
                }
            }
            return;
        }

        // Apply Gravity
        this.vy += GRAVITY;
        
        // Move horizontally
        this.x += this.vx;
        this.y += this.vy;

        // Increment animation waddle timer
        this.animTimer += (this.type === 'dragon-wing') ? 0.22 : 0.12;

        // Turn around when hitting level bounds
        if (this.x < 100 || this.x > levelWidth - 100) {
            this.vx = -this.vx;
        }

        // Dragon Wing Spit
        if (this.type === 'dragon-wing') {
            this.spitCooldown--;
            if (this.spitCooldown <= 0) {
                const isEasy = (currentLevel <= 2);
                this.spitCooldown = isEasy ? (200 + Math.random()*120) : (120 + Math.random()*80);
                // Spit electric yellow zaps
                projectiles.push(new Projectile(this.x, this.y + this.h - 10, -3, 3));
                projectiles.push(new Projectile(this.x + this.w, this.y + this.h - 10, 3, 3));
            }
        }

        // Blood Shark behavior
        if (this.type === 'blood-shark' && player) {
            this.wiggleTimer += 0.12;

            const dist = Math.abs((player.x + player.width/2) - (this.x + this.w/2));
            const playerInFront = (player.x < this.x && this.vx <= 0) || (player.x > this.x && this.vx >= 0);

            if (this.state === 'walk') {
                // If player is close, stop and bend down to charge whack
                if (dist < 80 && playerInFront) {
                    this.state = 'bend';
                    this.actionTimer = 35; // charge frames
                    this.vx = 0;
                }
            } 
            else if (this.state === 'bend') {
                this.actionTimer--;
                if (this.actionTimer <= 0) {
                    this.state = 'whack';
                    this.actionTimer = 18; // active whack frames
                    
                    // Whack damage check!
                    if (dist < 75) {
                        player.takeDamage(1);
                    }
                }
            } 
            else if (this.state === 'whack') {
                this.actionTimer--;
                if (this.actionTimer <= 0) {
                    this.state = 'walk';
                    // Walk in player direction
                    this.vx = (player.x < this.x) ? -1.5 : 1.5;
                }
            }
        }
    }

    draw() {
        if (this.type === 'paper-airplane') {
            ctx.save();
            ctx.translate(-cameraX, 0);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 2;
            
            // Draw sketchy triangle airplane
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 10);
            ctx.lineTo(this.x + 30, this.y);
            ctx.lineTo(this.x + 10, this.y + 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y + 15);
            ctx.lineTo(this.x + 8, this.y + 22);
            ctx.lineTo(this.x + 18, this.y + 11);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Spark trails
            if (Math.random() < 0.3) {
                const seedVal = Math.floor(this.x * 2 + this.y * 3);
                particles.push(new Particle(this.x, this.y + 10, -1, (Math.random()-0.5)*0.5, 'rgba(255,212,59,0.5)', 8, 15, 'star'));
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(-cameraX, 0);

        const cx = this.x + this.w/2;
        const cy = this.y + this.h/2;

        const img = enemyImages[this.type];

        // Animated squash and stretch variables
        let scaleX = 1;
        let scaleY = 1;
        let angle = 0;

        if (this.type === 'nippin') {
            // Waddles back and forth squishing
            scaleY = 1 + Math.sin(this.animTimer) * 0.08;
            scaleX = 1 - Math.sin(this.animTimer) * 0.08;
            angle = Math.sin(this.animTimer) * 0.05;
        } else if (this.type === 'star-shell-bug') {
            // Little horizontal crawls
            scaleY = 1 + Math.sin(this.animTimer * 1.5) * 0.05;
            scaleX = 1 - Math.sin(this.animTimer * 1.5) * 0.04;
        } else if (this.type === 'dragon-wing') {
            // Flapping tilts
            angle = Math.sin(this.animTimer * 1.5) * 0.12;
            scaleY = 1 + Math.cos(this.animTimer * 1.5) * 0.08;
        } else if (this.type === 'blood-shark') {
            if (this.state === 'bend') {
                scaleY = 0.65;
                scaleX = 1.2;
            } else if (this.state === 'walk') {
                angle = Math.sin(this.wiggleTimer) * 0.22;
            }
        } else if (this.type === 'nippin') {
            // Purple Nippins bounce with a friendly little wobble.
            scaleY = 1 + Math.sin(this.animTimer * 1.4) * 0.1;
            scaleX = 1 - Math.sin(this.animTimer * 1.4) * 0.1;
        } else if (this.type === 'spark-ball') {
            // Wiggles rapidly
            const seedVal = Math.floor(this.x * 2 + this.y * 3);
            function getWiggle(offset) {
                const val = Math.sin(seedVal + offset + currentSketchFrame) * 12345.67;
                return (val - Math.floor(val)) - 0.5;
            }
            scaleX = 1 + getWiggle(1) * 0.12;
            scaleY = 1 + getWiggle(2) * 0.12;
        }

        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-cx, -cy);

        if (this.type === 'blood-shark') {
            let drawHeight = this.h;
            let drawY = this.y;

            if (this.state === 'bend') {
                drawHeight = this.h * 0.65;
                drawY = this.y + this.h * 0.35;
            }

            if (img && img.complete && img.naturalWidth > 0) {
                if (this.vx > 0) {
                    ctx.save();
                    ctx.translate(this.x + this.w, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0, this.w, drawHeight);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, this.x, drawY, this.w, drawHeight);
                }
            } else {
                const seed = Math.floor(this.x * 2 + this.y * 3);
                drawSketchyRect(this.x, drawY, this.w, drawHeight, '#ff6b6b', '#2b2b2b', 2.5, seed);
            }

            // Draw whacking claw hand if whacking
            if (this.state === 'whack') {
                let whackOffset = (this.vx <= 0) ? -16 : 16;
                const clawX = (this.vx <= 0) ? (this.x - 8 + whackOffset) : (this.x + this.w - 4 + whackOffset);
                const seed = Math.floor(this.x * 5 + this.y * 7);
                drawSketchyRect(clawX, drawY + drawHeight/2 - 6, 12, 12, '#ced4da', '#2b2b2b', 2.0, seed);
            }
        } else if (this.type === 'nippin') {
            const pulse = Math.sin(Date.now() / 160) * 1.5;
            const seed = Math.floor(this.x * 11 + this.y * 13);
            drawSketchyCircle(cx, cy + pulse, 14, '#9b5de5', '#3b1f66', seed);
            drawSketchyCircle(cx - 5, cy - 3 + pulse, 2.5, '#ffffff', '#2b2b2b', seed + 1);
            drawSketchyCircle(cx + 5, cy - 3 + pulse, 2.5, '#ffffff', '#2b2b2b', seed + 2);
            drawSketchyCircle(cx - 5, cy - 3 + pulse, 1, '#2b2b2b', '#2b2b2b', seed + 3);
            drawSketchyCircle(cx + 5, cy - 3 + pulse, 1, '#2b2b2b', '#2b2b2b', seed + 4);
            drawSketchyLine(cx - 4, cy + 6 + pulse, cx + 4, cy + 6 + pulse, '#3b1f66', 1.5, seed + 5);
        } else if (this.type === 'spark-ball') {
            // Draw a wiggling/crackling yellow electric spark ball
            const pulse = Math.sin(Date.now() / 80) * 3;
            const seed = Math.floor(this.x * 11 + this.y * 13);
            drawWildHair(cx, cy, 11 + pulse, '#ffd43b', seed);
            drawSketchyCircle(cx, cy, 7, '#ffffff', '#2b2b2b', seed + 1);
            
            // Little cute sketchy angry face
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Angry eyes
            ctx.moveTo(cx - 3, cy - 2);
            ctx.lineTo(cx - 1, cy - 1);
            ctx.moveTo(cx + 3, cy - 2);
            ctx.lineTo(cx + 1, cy - 1);
            // Angry brow
            ctx.moveTo(cx - 4, cy - 4);
            ctx.lineTo(cx + 4, cy - 4);
            // Little mouth
            ctx.moveTo(cx - 2, cy + 2);
            ctx.lineTo(cx + 2, cy + 2);
            ctx.stroke();
        } else {
            if (img && img.complete && img.naturalWidth > 0) {
                if (this.vx > 0) {
                    ctx.save();
                    ctx.translate(this.x + this.w, this.y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0, this.w, this.h);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, this.x, this.y, this.w, this.h);
                }
            } else {
                let color = '#ff6b6b';
                if (this.type === 'nippin') color = '#9b5de5';
                if (this.type === 'star-shell-bug') color = '#4dabf7';
                const seed = Math.floor(this.x * 17 + this.y * 19);
                drawSketchyRect(this.x, this.y, this.w, this.h, color, '#2b2b2b', 2.5, seed);
            }
        }

        // Draw a wiggling sketchy blue ice block over the enemy if frozen!
        if (this.freezeTimer && this.freezeTimer > 0) {
            ctx.save();
            const seed = Math.floor(this.x * 2 + this.y * 3 + this.freezeTimer);
            drawSketchyRect(this.x - 4, this.y - 4, this.w + 8, this.h + 8, 'rgba(77, 171, 247, 0.4)', '#4dabf7', 2.5, seed);
            ctx.restore();
        }

        ctx.restore();
    }
}

// Projectiles thrown by Dragon Wings claw-legs
class Projectile {
    constructor(x, y, vx, vy, owner = 'enemy', type = 'spark') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.r = 8;
        this.active = true;
        this.owner = owner;
        this.type = type;
        this.bounceCount = 0;
    }

    update() {
        this.x += this.vx;

        if (this.type === 'electric-wave') {
            // Bouncing electric projectile: apply gravity
            this.vy += 0.22;
            this.y += this.vy;

            // Bounce off static platforms
            platforms.forEach(p => {
                if (this.active &&
                    this.x > p.x && this.x < p.x + p.w &&
                    this.y + this.r > p.y && this.y - this.r < p.y + p.h) {
                    
                    if (this.vy > 0) {
                        this.y = p.y - this.r;
                        this.vy = -4.5; // bounce up
                        this.bounceCount++;
                    }
                }
            });

            // Bounce off the pond bottom or screen bottom
            let insidePond = false;
            ponds.forEach(pond => {
                if (this.x > pond.x && this.x < pond.x + pond.w) {
                    insidePond = true;
                    if (this.y + this.r > levelHeight) {
                        this.y = levelHeight - this.r;
                        this.vy = -4.5;
                        this.bounceCount++;
                    }
                }
            });

            if (!insidePond && this.y + this.r > levelHeight - 40) {
                // Ground bounce for early levels or outside pond
                this.y = levelHeight - 40 - this.r;
                this.vy = -4.5;
                this.bounceCount++;
            }
        } 
        else if (this.type === 'laser') {
            this.y += this.vy;

            // Lasers check deflection off platforms (including Hosco's boxes)
            if (this.owner === 'enemy') {
                platforms.forEach(p => {
                    if (this.active &&
                        this.x > p.x && this.x < p.x + p.w &&
                        this.y > p.y && this.y < p.y + p.h) {
                        
                        // Deflect laser!
                        this.owner = 'hero';
                        this.vx = -this.vx * 1.35; // reverse and speed up
                        if (currentLevel === 6 && Math.abs(this.x - 150) < 160) {
                            this.r = 16; // make giant
                            this.vx *= 1.35;
                            triggerScreenShake(8);
                        } else {
                            triggerScreenShake(3);
                        }
                    }
                });

                // Lasers check deflection off pushable boxes
                pushableBoxes.forEach(box => {
                    if (this.active &&
                        this.x > box.x && this.x < box.x + box.w &&
                        this.y > box.y && this.y < box.y + box.h) {
                        
                        // Deflect laser!
                        this.owner = 'hero';
                        this.vx = -this.vx * 1.35; // reverse and speed up
                        if (currentLevel === 6 && Math.abs(this.x - 150) < 160) {
                            this.r = 16; // make giant
                            this.vx *= 1.35;
                            triggerScreenShake(10);
                        } else {
                            triggerScreenShake(4);
                        }
                    }
                });
            }
        } 
        else if (this.type === 'bomb') {
            this.vy += 0.15; // slow gravity drop
            this.y += this.vy;
            
            // Check collision with platforms or floor
            let hit = false;
            platforms.forEach(p => {
                if (this.active &&
                    this.x > p.x && this.x < p.x + p.w &&
                    this.y + this.r > p.y && this.y - this.r < p.y + p.h) {
                    hit = true;
                }
            });
            if (this.y + this.r > levelHeight - 40) {
                hit = true;
            }
            
            if (hit) {
                this.active = false;
                // Explode! Spawn 4 standard zaps going out
                projectiles.push(new Projectile(this.x, this.y - 10, -4, 0, 'enemy', 'spark'));
                projectiles.push(new Projectile(this.x, this.y - 10, 4, 0, 'enemy', 'spark'));
                projectiles.push(new Projectile(this.x, this.y - 10, -2.5, -2, 'enemy', 'spark'));
                projectiles.push(new Projectile(this.x, this.y - 10, 2.5, -2, 'enemy', 'spark'));
                triggerScreenShake(8);
                // particles
                for (let i = 0; i < 8; i++) {
                    particles.push(new Particle(this.x, this.y, (Math.random()-0.5)*5, -Math.random()*4, '#ffd43b', 8+Math.random()*6, 20, 'star'));
                }
            }
        }
        else if (this.type === 'boulder') {
            this.vy += 0.2; // heavy gravity
            this.y += this.vy;
            
            // Check collision with platforms or floor
            let hit = false;
            platforms.forEach(p => {
                if (this.active &&
                    this.x > p.x && this.x < p.x + p.w &&
                    this.y + this.r > p.y && this.y - this.r < p.y + p.h) {
                    hit = true;
                }
            });
            if (this.y + this.r > levelHeight - 40) {
                hit = true;
            }
            
            if (hit) {
                this.active = false;
                // Smash! Spawn gray debris particles
                triggerScreenShake(4);
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(this.x, this.y, (Math.random()-0.5)*6, -Math.random()*4, '#868e96', 4+Math.random()*4, 20, 'dust'));
                }
            }
        }
        else {
            this.y += this.vy;
        }
        
        // Remove if off-screen (with padding to allow high bounces/deflections)
        if (this.y > levelHeight + 100 || this.y < -150 || this.x < -150 || this.x > levelWidth + 150) {
            this.active = false;
        }
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(-cameraX, 0);

        if (this.type === 'laser') {
            // Draw a horizontal bright neon red laser bolt (or blue if deflected)
            ctx.fillStyle = (this.owner === 'hero') ? '#4dabf7' : '#ff4d4d';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            const scale = this.r / 8; // scale by radius (default is 8)
            ctx.rect(this.x - 14 * scale, this.y - 3 * scale, 28 * scale, 6 * scale);
            ctx.fill();
            ctx.stroke();
            
            // Draw crackling sparks around it
            drawWildHair(this.x, this.y, 9 * scale, (this.owner === 'hero') ? '#4dabf7' : '#ff4d4d');
        } else if (this.type === 'bomb') {
            // Draw a sketchy bomb circle with a lit fuse
            ctx.fillStyle = '#2b2b2b';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            
            // Fuse sparks
            drawWildHair(this.x, this.y - this.r - 2, 6, '#ffd43b');
        } else if (this.type === 'boulder') {
            // Draw a sketchy gray stone circle
            ctx.fillStyle = '#868e96';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r + 2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            
            // Draw some inner sketchy cracks
            ctx.strokeStyle = '#495057';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x - 3, this.y - 3);
            ctx.lineTo(this.x + 1, this.y + 2);
            ctx.moveTo(this.x + 2, this.y - 2);
            ctx.lineTo(this.x - 1, this.y + 3);
            ctx.stroke();
        } else {
            // Yellow/blue electric sparks for standard zaps
            const sparkColor = (this.owner === 'hero') ? '#4dabf7' : '#ffd43b'; // blue if deflected
            drawWildHair(this.x, this.y, this.r + Math.random()*3, sparkColor);
            drawSketchyCircle(this.x, this.y, 4, '#ffffff', '#2b2b2b');
        }
        ctx.restore();
    }
}

// Helper Clone Class for World 5-2
class Clone {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 32;
        this.height = 48;
        this.vx = 4;
        this.vy = 0;
        this.grounded = false;
        this.life = 300; // 5 seconds at 60fps
        
        // Adjust size to match hero
        if (this.type === 'giant-dad') { 
            this.width = 40; 
            this.height = 56; 
        } else if (this.type === 'hip-p') { 
            this.width = 24; 
            this.height = 32; 
        }
    }
    
    update() {
        this.life--;
        this.vy += GRAVITY;
        this.x += this.vx;
        
        // Basic platform X collision
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.width > p.x &&
                this.y < p.y + p.h && this.y + this.height > p.y) {
                
                if (this.vx > 0 && this.x + this.width - this.vx <= p.x) {
                    this.x = p.x - this.width;
                    this.vy = -9; // Jump over obstacles!
                }
            }
        });
        
        this.y += this.vy;
        
        // Basic platform Y collision
        this.grounded = false;
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.width > p.x &&
                this.y < p.y + p.h && this.y + this.height > p.y) {
                if (this.vy > 0) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                }
            }
        });
        
        // Stomping enemies
        enemies.forEach(e => {
            if (e.type !== 'paper-airplane' &&
                this.x < e.x + e.w && this.x + this.width > e.x &&
                this.y < e.y + e.h && this.y + this.height > e.y) {
                
                // Squash enemy
                enemies = enemies.filter(item => item !== e);
                triggerScreenShake(4);
                this.vy = -6; // bounce slightly
                for (let i = 0; i < 6; i++) {
                    particles.push(new Particle(e.x + e.w/2, e.y + e.h/2, (Math.random()-0.5)*4, (Math.random()-0.5)*4 - 1.5, '#ffd43b', 14 + Math.random()*6, 25, 'star'));
                }
            }
        });
        
        // Spawn trail particles
        if (Math.random() < 0.2) {
            particles.push(new Particle(this.x + this.width/2, this.y + this.height/2, -this.vx*0.5, (Math.random()-0.5)*2, 'rgba(77, 171, 247, 0.3)', 4 + Math.random()*4, 15, 'dust'));
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.globalAlpha = 0.55; // translucent clone look
        
        const img = heroImages[this.type];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            const seed = Math.floor(this.x * 2 + this.y * 3);
            drawSketchyRect(this.x, this.y, this.width, this.height, '#4dabf7', '#2b2b2b', 2.0, seed);
        }
        ctx.restore();
    }
}

// Collectible Items Class (Hearts for extra lives!)
class Collectible {
    constructor(x, y, type = 'heart') {
        this.x = x;
        this.y = y;
        this.w = 24;
        this.h = 24;
        this.type = type;
        this.active = true;
        this.bobTimer = Math.random() * 100;
    }

    update() {
        this.bobTimer += 0.08;
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(-cameraX, 0);
        
        // Bobbing up and down
        const bobY = this.y + Math.sin(this.bobTimer) * 5;

        // Draw sketchy heart symbol
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '24px Patrick Hand';
        ctx.textAlign = 'center';
        ctx.fillText('❤️', this.x + this.w/2, bobY + 18);

        ctx.restore();
    }
}

// Pond Class (represents a pool of gray water with swimming shark fin!)
class Pond {
    constructor(x, y, w, h, type = 'gray') {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        
        // Swimming shark inside this pond
        this.sharkX = x + w/2;
        this.sharkVx = 2.0;
        this.sharkWiggle = 0;
    }

    update() {
        this.sharkWiggle += 0.15;
        this.sharkX += this.sharkVx;
        if (this.sharkX < this.x + 30 || this.sharkX > this.x + this.w - 50) {
            this.sharkVx = -this.sharkVx;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        const seed = Math.floor(this.x * 5 + this.y * 7);
        
        let fillColor = 'rgba(128, 138, 148, 0.65)'; // default gray
        let outlineColor = '#2b2b2b';
        let finColor = '#6e7a8a';
        
        if (this.type === 'lava') {
            fillColor = 'rgba(255, 107, 107, 0.75)'; // orange/red lava crayon
            outlineColor = '#ff6b6b';
            finColor = '#ff922b'; // orange fin!
        }
        
        fillCrayonRect(this.x, this.y, this.w, this.h, fillColor, seed);
        
        // Draw sketchy wavy surface
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const steps = 24;
        
        function getWiggle(offset) {
            const val = Math.sin(seed * 7.11 + offset * 13.9 + currentSketchFrame * 5.4) * 12345.67;
            return (val - Math.floor(val)) - 0.5;
        }

        for (let i = 0; i <= steps; i++) {
            const px = this.x + (i / steps) * this.w;
            // Wave height is a combination of sine wave + sketchy wiggle
            const py = this.y + Math.sin(i * 0.8 + Date.now()/180) * 3.5 + getWiggle(i) * 1.5;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Draw swimming shark fin
        const finX = this.sharkX;
        const finWiggle = getWiggle(99) * 2;
        const finY = this.y - 12 + Math.sin(this.sharkWiggle) * 3 + finWiggle;
        
        ctx.fillStyle = finColor;
        ctx.beginPath();
        if (this.sharkVx > 0) {
            // Fin facing right
            ctx.moveTo(finX, finY + 16);
            ctx.quadraticCurveTo(finX + 10, finY - 5, finX + 22, finY - 2);
            ctx.quadraticCurveTo(finX + 15, finY + 12, finX + 25, finY + 16);
        } else {
            // Fin facing left
            ctx.moveTo(finX + 25, finY + 16);
            ctx.quadraticCurveTo(finX + 15, finY - 5, finX + 3, finY - 2);
            ctx.quadraticCurveTo(finX + 10, finY + 12, finX, finY + 16);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw outline of shark fin sketchily using sketchy lines
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2.5;
        if (this.sharkVx > 0) {
            drawSketchyLine(finX, finY + 16, finX + 22, finY - 2, outlineColor, 2.2, seed + 10);
            drawSketchyLine(finX + 22, finY - 2, finX + 25, finY + 16, outlineColor, 2.2, seed + 11);
        } else {
            drawSketchyLine(finX + 25, finY + 16, finX + 3, finY - 2, outlineColor, 2.2, seed + 10);
            drawSketchyLine(finX + 3, finY - 2, finX, finY + 16, outlineColor, 2.2, seed + 11);
        }

        ctx.restore();
    }
}

// Pushable Box Class (represents the pushable cube / crate in World 2-1)
class PushableBox {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
    }

    update() {
        // Apply gravity
        this.vy += GRAVITY;
        this.y += this.vy;
        
        // Collisions with static platforms
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.w > p.x &&
                this.y < p.y + p.h && this.y + this.h > p.y) {
                
                const overlapX = Math.min(this.x + this.w - p.x, p.x + p.w - this.x);
                const overlapY = Math.min(this.y + this.h - p.y, p.y + p.h - this.y);

                if (overlapX > overlapY) {
                    if (this.vy > 0 && this.y + this.h - this.vy <= p.y + 4) {
                        this.y = p.y - this.h;
                        this.vy = 0;
                    }
                }
            }
        });

        // If inside any pond area, stop at the bottom of the screen (pond floor)
        ponds.forEach(pond => {
            if (this.x < pond.x + pond.w && this.x + this.w > pond.x) {
                if (this.y + this.h > levelHeight) {
                    this.y = levelHeight - this.h;
                    this.vy = 0;
                }
            }
        });

        // Apply friction to horizontal speed and update position
        this.x += this.vx;

        // Resolve X collisions with static platforms
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.w > p.x &&
                this.y < p.y + p.h && this.y + this.h > p.y) {
                if (this.vx > 0) {
                    this.x = p.x - this.w;
                    this.vx = 0;
                } else if (this.vx < 0) {
                    this.x = p.x + p.w;
                    this.vx = 0;
                }
            }
        });

        this.vx *= 0.82; // quick deceleration when not pushed
    }

    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        const seed = Math.floor(this.x * 23 + this.y * 29);
        // Draw sketchy orange/yellow crate
        drawSketchyRect(this.x, this.y, this.w, this.h, '#ffd8a8', '#2b2b2b', 3, seed);
        
        // Crate crossbars/crayon detail
        drawSketchyRect(this.x + 8, this.y + 8, this.w - 16, this.h - 16, null, 'rgba(43, 43, 43, 0.4)', 1.5, seed + 1);
        drawSketchyLine(this.x + 8, this.y + 8, this.x + this.w - 8, this.y + this.h - 8, 'rgba(43, 43, 43, 0.3)', 1.5, seed + 2);
        drawSketchyLine(this.x + this.w - 8, this.y + 8, this.x + 8, this.y + this.h - 8, 'rgba(43, 43, 43, 0.3)', 1.5, seed + 3);

        ctx.restore();
    }
}

// Boss Class - Poster (Spawns in Level 1-3) & Blood Shark Boss (Spawns in Level 2-1)
class Boss {
    constructor(x, y, type = 'poster') {
        this.x = x;
        this.y = y;
        this.type = type; // 'poster', 'nippin-king', or 'blood-shark'
        this.w = 110;
        this.h = 100;
        this.hearts = 5;
        this.vy = 0;
        this.vx = 2.5; // for Blood Shark walking speed
        
        this.actionState = 'float'; // 'float', 'target', 'drop', 'smashed', 'rise'
        this.timer = 120;
        this.targetX = 0;
        
        this.invulnerableFrame = 0;
        this.isElectrified = false;
        this.smashedTimer = 0;
        this.wobbleTimer = Math.random() * 10;

        if (this.type === 'nippin-king') {
            this.w = 128;
            this.h = 128;
            this.hearts = 7;
            this.actionState = 'patrol';
            this.timer = 100;
            this.vx = 2.2;
        } else if (this.type === 'blood-shark') {
            this.w = 90;
            this.h = 96;
            this.hearts = 6; // Blood Shark boss has 6 hearts
            this.actionState = 'patrol'; // 'patrol', 'bend', 'whack'
            this.timer = 120;
            this.wiggleTimer = Math.random() * 10;
        } else if (this.type === 'dragon-emperor') {
            this.w = 100;
            this.h = 100;
            this.hearts = 6;
            this.actionState = 'patrol';
            this.timer = 120;
            this.vx = 2.0;
        } else if (this.type === 'star-empress') {
            this.w = 90;
            this.h = 80;
            this.hearts = 5;
            this.actionState = 'idle';
            this.timer = 90;
            this.vx = 0;
            this.angle = 0;
        } else if (this.type === 'dungeon-overlord') {
            this.w = 140;
            this.h = 120;
            this.hearts = 8;
            this.actionState = 'float';
            this.timer = 120;
        }
    }

    update(player) {
        if (this.invulnerableFrame > 0) {
            this.invulnerableFrame--;
        } else {
            this.isElectrified = false;
        }

        if (this.type === 'poster') {
            if (this.actionState !== 'smashed') {
                this.timer--;
            }
            
            if (this.actionState === 'float') {
                // Hover in air, bob up and down
                this.y = 80 + Math.sin(Date.now()/300)*10;
                if (this.timer <= 0) {
                    this.actionState = 'target';
                    this.timer = 60; // target lock-on phase
                }
            } 
            else if (this.actionState === 'target') {
                // Lock on player's position
                const diff = player.x - (this.x + this.w/2);
                this.x += diff * 0.08;
                this.y = 70 + Math.sin(Date.now()/150)*5;
                
                if (this.timer <= 0) {
                    this.actionState = 'drop';
                    this.vy = 0;
                }
            } 
            else if (this.actionState === 'drop') {
                // Smash downward!
                this.vy += GRAVITY * 1.5;
                this.y += this.vy;
                
                // Check crash with ground level
                if (this.y + this.h >= levelHeight - 40) {
                    this.y = levelHeight - 40 - this.h;
                    this.actionState = 'smashed';
                    this.smashedTimer = 90; // Stunned flat on the floor for 1.5 seconds
                    triggerScreenShake(20); // Massive screen shake!
                    
                    // Deal damage to player if on the floor and not jumping
                    if (player.grounded && !player.isSneaking && Math.abs((player.x + player.width/2) - (this.x + this.w/2)) < 240) {
                        player.takeDamage(1);
                    }
                }
            } 
            else if (this.actionState === 'smashed') {
                this.smashedTimer--;
                if (this.smashedTimer <= 0) {
                    this.actionState = 'rise';
                    this.timer = 60; // short rise delay
                }
            }
            else if (this.actionState === 'rise') {
                // Return upward
                this.y -= 3;
                if (this.y <= 90) {
                    this.actionState = 'float';
                    this.timer = 120;
                }
            }
        }
        else if (this.type === 'nippin-king') {
            // The Nippin King guards the dungeon by bouncing between the walls.
            this.wobbleTimer += 0.16;
            this.x += this.vx;
            if (this.x < 110 || this.x > levelWidth - 110 - this.w) {
                this.vx = -this.vx;
            }

            this.vy += GRAVITY;
            this.y += this.vy;
            if (this.y + this.h >= levelHeight - 40) {
                this.y = levelHeight - 40 - this.h;
                this.vy = -7.2;
                this.timer--;
                if (this.timer <= 0) {
                    this.timer = 90 + Math.random() * 60;
                    // A short purple warning shot keeps the dungeon fight moving.
                    const dir = player.x < this.x ? -4.5 : 4.5;
                    projectiles.push(new Projectile(this.x + this.w / 2, this.y + 28, dir, -3, 'enemy', 'spark'));
                }
            }
        }
        else if (this.type === 'blood-shark') {
            this.wiggleTimer += 0.15;
            
            if (this.actionState === 'patrol') {
                // Move back and forth
                this.x += this.vx;
                
                // Turn around at screen bounds
                if (this.x < 100 || this.x > levelWidth - 100 - this.w) {
                    this.vx = -this.vx;
                }

                // Turn around at pond edge if no bridge is present in Level 6
                if (currentLevel === 6) {
                    const hasBridge = platforms.some(p => p.type === 'bridge');
                    if (!hasBridge) {
                        if (this.vx > 0 && this.x + this.w >= 446 && this.x + this.w <= 455) {
                            this.vx = -this.vx;
                            this.x = 446 - this.w;
                        } else if (this.vx < 0 && this.x <= 654 && this.x >= 645) {
                            this.vx = -this.vx;
                            this.x = 654;
                        }
                    }
                }
                
                // Hop/bounce occasionally during patrol (will check grounded below)
                if (Math.random() < 0.015) {
                    this.wantsToHop = true;
                }

                // Count down to attack phase
                this.timer--;
                if (this.timer <= 0) {
                    if (Math.random() < 0.5) {
                        this.actionState = 'bend';
                        this.timer = 45; // charge whack frames
                    } else {
                        this.actionState = 'laser-charge';
                        this.timer = 50; // charge laser frames
                    }
                    this.savedVx = this.vx;
                    this.vx = 0;
                }
            }
            else if (this.actionState === 'bend') {
                this.timer--;

                if (this.timer <= 0) {
                    this.actionState = 'whack';
                    this.timer = 25; // active whack frames
                    triggerScreenShake(10);
                    
                    // Whack shockwave: Spawn a bouncing electric projectile moving towards the player
                    const dir = (player.x < this.x) ? -6 : 6;
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h - 30, dir, -4, 'enemy', 'electric-wave'));
                }
            }
            else if (this.actionState === 'whack') {
                this.timer--;

                if (this.timer <= 0) {
                    this.actionState = 'stunned';
                    this.timer = 90; // Stunned for 1.5 seconds
                    this.vx = 0;
                }
            }
            else if (this.actionState === 'laser-charge') {
                this.timer--;

                if (this.timer <= 0) {
                    this.actionState = 'laser-fire';
                    this.timer = 50; // active laser fire frames
                }
            }
            else if (this.actionState === 'laser-fire') {
                this.timer--;

                // Fire laser projectile every 10 frames
                if (this.timer % 10 === 0) {
                    const dir = (player.x < this.x) ? -8 : 8;
                    projectiles.push(new Projectile(
                        this.x + (dir > 0 ? this.w : 0), 
                        this.y + this.h - 30, 
                        dir, 
                        0, 
                        'enemy', 
                        'laser'
                    ));
                    triggerScreenShake(2);
                }

                if (this.timer <= 0) {
                    this.actionState = 'stunned';
                    this.timer = 90; // Stunned for 1.5 seconds
                    this.vx = 0;
                }
            }
            else if (this.actionState === 'stunned') {
                this.timer--;

                if (this.timer <= 0) {
                    this.actionState = 'patrol';
                    this.timer = 120 + Math.random() * 80;
                    // Walk in player direction
                    this.vx = (player.x < this.x) ? -3.0 : 3.0;
                }
            }

            // Apply Gravity & buoyancy if in a pond
            let insidePond = false;
            ponds.forEach(pond => {
                if (this.x < pond.x + pond.w && this.x + this.w > pond.x &&
                    this.y < pond.y + pond.h && this.y + this.h > pond.y) {
                    insidePond = true;
                }
            });

            if (insidePond) {
                this.vy = Math.min(this.vy + GRAVITY * 0.5, 1.2); // Slower fall / buoyancy inside pond water
            } else {
                this.vy += GRAVITY;
            }
            this.y += this.vy;

            // Resolve Y collisions with platforms
            let grounded = false;
            platforms.forEach(p => {
                if (this.x < p.x + p.w && this.x + this.w > p.x &&
                    this.y < p.y + p.h && this.y + this.h > p.y) {
                    
                    const overlapX = Math.min(this.x + this.w - p.x, p.x + p.w - this.x);
                    const overlapY = Math.min(this.y + this.h - p.y, p.y + p.h - this.y);

                    if (overlapX > overlapY) {
                        if (this.vy > 0 && this.y + this.h - this.vy <= p.y + 10) {
                            this.y = p.y - this.h;
                            this.vy = 0;
                            grounded = true;
                        }
                    }
                }
            });

            // Resolve Y collisions with pushable boxes
            pushableBoxes.forEach(box => {
                if (this.x < box.x + box.w && this.x + this.w > box.x &&
                    this.y < box.y + box.h && this.y + this.h > box.y) {
                    
                    const overlapX = Math.min(this.x + this.w - box.x, box.x + box.w - this.x);
                    const overlapY = Math.min(this.y + this.h - box.y, box.y + box.h - this.y);

                    if (overlapX > overlapY) {
                        if (this.vy > 0 && this.y + this.h - this.vy <= box.y + 10) {
                            this.y = box.y - this.h;
                            this.vy = 0;
                            grounded = true;
                        }
                    }
                }
            });

            // Resolve bottom of screen (pond floor) or regular floor height
            if (insidePond) {
                if (this.y + this.h >= levelHeight) {
                    this.y = levelHeight - this.h;
                    this.vy = 0;
                    grounded = true;
                }
            } else {
                if (this.y + this.h >= levelHeight - 40) {
                    this.y = levelHeight - 40 - this.h;
                    this.vy = 0;
                    grounded = true;
                }
            }

            // Execute hop if patrol wants to hop and we are grounded
            if (this.actionState === 'patrol' && this.wantsToHop) {
                if (grounded) {
                    this.vy = -4.5;
                }
                this.wantsToHop = false;
            }
        }
        else if (this.type === 'dragon-emperor') {
            this.timer--;
            
            if (this.actionState === 'patrol') {
                // Fly in a sine wave
                this.x += this.vx;
                if (this.x < 100 || this.x > levelWidth - 100 - this.w) {
                    this.vx = -this.vx;
                }
                this.y = 80 + Math.sin(Date.now() / 250) * 45;
                
                if (this.timer <= 0) {
                    // Choose next action
                    if (Math.random() < 0.5) {
                        this.actionState = 'zap-charge';
                        this.timer = 50;
                    } else {
                        this.actionState = 'bomb-charge';
                        this.timer = 60;
                    }
                    this.savedVx = this.vx;
                    this.vx = 0;
                }
            }
            else if (this.actionState === 'zap-charge') {
                this.y = 80 + Math.sin(Date.now() / 120) * 10; // wiggle slightly
                if (this.timer <= 0) {
                    this.actionState = 'zap-fire';
                    this.timer = 30;
                    // Fire 3-way fan of zaps
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h, -3, 3));
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h, 0, 4.5));
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h, 3, 3));
                    triggerScreenShake(8);
                }
            }
            else if (this.actionState === 'zap-fire') {
                if (this.timer <= 0) {
                    this.actionState = 'patrol';
                    this.timer = 120 + Math.random() * 80;
                    this.vx = this.savedVx || 2.0;
                }
            }
            else if (this.actionState === 'bomb-charge') {
                // Fly to get above player
                const diffX = (player.x + player.width/2) - (this.x + this.w/2);
                this.x += diffX * 0.05;
                this.y = 70 + Math.sin(Date.now() / 150) * 5;
                
                if (this.timer <= 0) {
                    this.actionState = 'bomb-drop';
                    this.timer = 20;
                    // Drop a lightning bomb
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h, 0, 5, 'enemy', 'bomb'));
                }
            }
            else if (this.actionState === 'bomb-drop') {
                if (this.timer <= 0) {
                    this.actionState = 'patrol';
                    this.timer = 120 + Math.random() * 80;
                    this.vx = (player.x < this.x) ? -2.2 : 2.2;
                }
            }
        }
        else if (this.type === 'star-empress') {
            this.timer--;
            
            if (this.actionState === 'idle') {
                this.vx = 0;
                this.angle = 0;
                // Shaking prep
                this.x = this.x + Math.sin(Date.now() / 40) * 1.5;
                
                if (this.timer <= 0) {
                    this.actionState = 'roll';
                    this.timer = 150;
                    this.vx = (player.x < this.x) ? -7.0 : 7.0;
                }
            }
            else if (this.actionState === 'roll') {
                this.x += this.vx;
                this.angle += this.vx * 0.08; // roll rotation!
                
                // Check wall bounds
                let hitWall = false;
                if (this.x < 100) {
                    this.x = 100;
                    hitWall = true;
                } else if (this.x > levelWidth - 100 - this.w) {
                    this.x = levelWidth - 100 - this.w;
                    hitWall = true;
                }
                
                if (hitWall || this.timer <= 0) {
                    this.actionState = 'stunned';
                    this.timer = 200; // stunned for 3.3s (was 90)
                    this.vx = 0;
                    this.angle = 0;
                    triggerScreenShake(20);
                    
                    // Drop 3 boulders from the sky, but keep the left side (x < 320) safe!
                    for (let i = 0; i < 3; i++) {
                        const dropX = player.x + (Math.random() - 0.5) * 250;
                        const clampedX = Math.max(320, Math.min(levelWidth - 100, dropX));
                        projectiles.push(new Projectile(clampedX, 0, 0, 5.5, 'enemy', 'boulder'));
                    }
                }
            }
            else if (this.actionState === 'stunned') {
                this.x = this.x + Math.sin(Date.now() / 100) * 1.0;
                if (this.timer <= 0) {
                    this.actionState = 'idle';
                    this.timer = 90;
                }
            }
            
            // Apply gravity to stay on ground
            this.vy += GRAVITY;
            this.y += this.vy;
            
            // Resolve platform Y collisions
            platforms.forEach(p => {
                if (this.x < p.x + p.w && this.x + this.w > p.x &&
                    this.y < p.y + p.h && this.y + this.h > p.y) {
                    if (this.vy > 0 && this.y + this.h - this.vy <= p.y + 10) {
                        this.y = p.y - this.h;
                        this.vy = 0;
                    }
                }
            });
            if (this.y + this.h >= levelHeight - 40) {
                this.y = levelHeight - 40 - this.h;
                this.vy = 0;
            }
        }
        else if (this.type === 'dungeon-overlord') {
            if (this.actionState !== 'smashed') {
                this.timer--;
            }
            
            if (this.actionState === 'float') {
                this.y = 70 + Math.sin(Date.now()/300)*10;
                if (this.timer <= 0) {
                    const r = Math.random();
                    if (r < 0.4) {
                        this.actionState = 'target';
                        this.timer = 50; // target lock-on phase
                    } else if (r < 0.7) {
                        this.actionState = 'laser-prep';
                        this.timer = 45;
                    } else {
                        this.actionState = 'zap-prep';
                        this.timer = 45;
                    }
                }
            }
            else if (this.actionState === 'target') {
                const diff = player.x - (this.x + this.w/2);
                this.x += diff * 0.09;
                this.y = 60 + Math.sin(Date.now()/150)*5;
                
                if (this.timer <= 0) {
                    this.actionState = 'drop';
                    this.vy = 0;
                }
            }
            else if (this.actionState === 'drop') {
                this.vy += GRAVITY * 1.6;
                this.y += this.vy;
                
                if (this.y + this.h >= levelHeight - 40) {
                    this.y = levelHeight - 40 - this.h;
                    this.actionState = 'smashed';
                    this.smashedTimer = 110; // vulnerable for 1.8s
                    triggerScreenShake(25);
                    
                    if (player.grounded && !player.isSneaking && Math.abs((player.x + player.width/2) - (this.x + this.w/2)) < 300) {
                        player.takeDamage(1);
                    }
                }
            }
            else if (this.actionState === 'smashed') {
                this.smashedTimer--;
                if (this.smashedTimer <= 0) {
                    this.actionState = 'rise';
                    this.timer = 60;
                }
            }
            else if (this.actionState === 'rise') {
                this.y -= 3.5;
                if (this.y <= 80) {
                    this.actionState = 'float';
                    this.timer = 90;
                }
            }
            else if (this.actionState === 'laser-prep') {
                const targetY = 140;
                this.y += (targetY - this.y) * 0.1;
                
                if (this.timer <= 0) {
                    this.actionState = 'laser-fire';
                    this.timer = 40;
                }
            }
            else if (this.actionState === 'laser-fire') {
                if (this.timer % 12 === 0) {
                    const dir = (player.x < this.x) ? -9 : 9;
                    projectiles.push(new Projectile(
                        this.x + (dir > 0 ? this.w : 0), 
                        this.y + this.h/2 + 10, 
                        dir, 
                        0, 
                        'enemy', 
                        'laser'
                    ));
                    triggerScreenShake(3);
                }
                if (this.timer <= 0) {
                    this.actionState = 'rise';
                    this.timer = 40;
                }
            }
            else if (this.actionState === 'zap-prep') {
                const targetY = 100;
                this.y += (targetY - this.y) * 0.1;
                if (this.timer <= 0) {
                    this.actionState = 'zap-fire';
                    this.timer = 30;
                    
                    const dirX = (player.x < this.x) ? -5.5 : 5.5;
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h - 10, dirX, -2, 'enemy', 'spark'));
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h - 10, dirX * 0.8, -4, 'enemy', 'spark'));
                    projectiles.push(new Projectile(this.x + this.w/2, this.y + this.h - 10, dirX * 1.2, 0, 'enemy', 'spark'));
                    triggerScreenShake(6);
                }
            }
            else if (this.actionState === 'zap-fire') {
                if (this.timer <= 0) {
                    this.actionState = 'rise';
                    this.timer = 40;
                }
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        if (this.type === 'poster') {
            const img = enemyImages['dungeon-king'];
            let drawHeight = this.h;
            let drawY = this.y;
            
            if (this.actionState === 'smashed') {
                // Draw Poster smashed flat on the floor
                drawHeight = this.h * 0.4;
                drawY = levelHeight - 40 - drawHeight;
            }

            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, this.x, drawY, this.w, drawHeight);
            } else {
                // Fallback block
                const seed = Math.floor(this.x * 2 + this.y * 3);
                drawSketchyRect(this.x, drawY, this.w, drawHeight, '#ced4da', '#2b2b2b', 3.0, seed);
            }
        }
        else if (this.type === 'nippin-king') {
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h / 2;
            const pulse = Math.sin(this.wobbleTimer) * 3;

            drawSketchyCircle(cx, cy + pulse, 52, '#9b5de5', '#3b1f66', Math.floor(this.x * 3));
            drawSketchyCircle(cx - 18, cy - 10 + pulse, 8, '#ffffff', '#2b2b2b', 21);
            drawSketchyCircle(cx + 18, cy - 10 + pulse, 8, '#ffffff', '#2b2b2b', 22);
            drawSketchyCircle(cx - 18, cy - 10 + pulse, 3, '#2b2b2b', '#2b2b2b', 23);
            drawSketchyCircle(cx + 18, cy - 10 + pulse, 3, '#2b2b2b', '#2b2b2b', 24);
            drawSketchyLine(cx - 16, cy + 18 + pulse, cx + 16, cy + 18 + pulse, '#3b1f66', 3, 25);

            // Crooked crown: this is the dungeon king's new, smaller role.
            ctx.fillStyle = '#ffd43b';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 48, cy - 43 + pulse);
            ctx.lineTo(cx - 35, cy - 72 + pulse);
            ctx.lineTo(cx - 12, cy - 50 + pulse);
            ctx.lineTo(cx, cy - 80 + pulse);
            ctx.lineTo(cx + 14, cy - 50 + pulse);
            ctx.lineTo(cx + 42, cy - 70 + pulse);
            ctx.lineTo(cx + 48, cy - 42 + pulse);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        else if (this.type === 'blood-shark') {
            const img = enemyImages['blood-shark'];
            let drawHeight = this.h;
            let drawY = this.y;
            let angle = 0;

            if (this.actionState === 'bend') {
                drawHeight = this.h * 0.7;
                drawY = this.y + this.h * 0.3;
            } else if (this.actionState === 'patrol') {
                angle = Math.sin(this.wiggleTimer) * 0.18;
            } else if (this.actionState === 'stunned') {
                angle = Math.sin(Date.now() / 50) * 0.12; // fast wobble
            }

            // If charging laser, draw a red sketchy warning line
            if (this.actionState === 'laser-charge') {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 77, 77, 0.7)';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(0, this.y + this.h - 30);
                ctx.lineTo(levelWidth, this.y + this.h - 30);
                ctx.stroke();
                ctx.restore();
            }

            const cx = this.x + this.w/2;
            const cy = this.y + this.h/2;
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.translate(-cx, -cy);

            if (img && img.complete && img.naturalWidth > 0) {
                if (this.vx > 0) {
                    ctx.save();
                    ctx.translate(this.x + this.w, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0, this.w, drawHeight);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, this.x, drawY, this.w, drawHeight);
                }
            } else {
                const seed = Math.floor(this.x * 4 + this.y * 5);
                drawSketchyRect(this.x, drawY, this.w, drawHeight, '#ff6b6b', '#2b2b2b', 3.0, seed);
            }

            // Draw whacking blade/claw hand
            if (this.actionState === 'whack') {
                let whackOffset = (this.vx <= 0) ? -30 : 30;
                const clawX = (this.vx <= 0) ? (this.x - 20 + whackOffset) : (this.x + this.w + whackOffset);
                const seed = Math.floor(this.x * 6 + this.y * 8);
                drawSketchyRect(clawX, drawY + drawHeight/2 - 12, 24, 24, '#ced4da', '#2b2b2b', 2.5, seed);
            }

            // If stunned, draw dizzy stars/sweat drops
            if (this.actionState === 'stunned') {
                ctx.fillStyle = '#4dabf7';
                ctx.font = '24px Patrick Hand';
                ctx.textAlign = 'center';
                const pulse = Math.sin(Date.now() / 100) * 5;
                ctx.fillText('💦', this.x + 20, this.y - 10 + pulse);
                ctx.fillText('💦', this.x + this.w - 20, this.y - 15 - pulse);
                ctx.fillText('💫', this.x + this.w/2, this.y - 25);
            }
        }
        else if (this.type === 'dragon-emperor') {
            const img = enemyImages['dragon-wing'];
            let angle = Math.sin(Date.now() / 150) * 0.1;
            
            // Draw sketchy laser charge indicator if charging
            if (this.actionState === 'zap-charge') {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 212, 59, 0.7)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x + this.w/2, this.y + this.h, 25 + Math.sin(Date.now()/30)*5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            
            ctx.save();
            ctx.translate(this.x + this.w/2, this.y + this.h/2);
            ctx.rotate(angle);
            if (img && img.complete && img.naturalWidth > 0) {
                if (this.vx > 0) {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, -this.w/2, -this.h/2, this.w, this.h);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, -this.w/2, -this.h/2, this.w, this.h);
                }
            } else {
                const seed = Math.floor(this.x * 2 + this.y * 3);
                drawSketchyRect(-this.w/2, -this.h/2, this.w, this.h, '#ffd43b', '#2b2b2b', 3.0, seed);
            }
            ctx.restore();
        }
        else if (this.type === 'star-empress') {
            const img = enemyImages['star-shell-bug'];
            let angle = this.angle || 0;
            
            if (this.actionState === 'stunned') {
                angle = Math.sin(Date.now() / 50) * 0.15; // stun wobble
            }
            
            ctx.save();
            ctx.translate(this.x + this.w/2, this.y + this.h/2);
            ctx.rotate(angle);
            
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, -this.w/2, -this.h/2, this.w, this.h);
            } else {
                const seed = Math.floor(this.x * 2 + this.y * 3);
                drawSketchyRect(-this.w/2, -this.h/2, this.w, this.h, '#ff8787', '#2b2b2b', 3.0, seed);
            }
            ctx.restore();
            
            // Draw dizzy stars if stunned
            if (this.actionState === 'stunned') {
                const starsCount = 3;
                for (let i = 0; i < starsCount; i++) {
                    const offsetAngle = (Date.now() / 200) + (i * Math.PI * 2 / starsCount);
                    const starX = this.x + this.w/2 + Math.cos(offsetAngle) * 35;
                    const starY = this.y - 15 + Math.sin(offsetAngle) * 10;
                    ctx.save();
                    ctx.fillStyle = '#ffd43b';
                    ctx.font = '16px Patrick Hand';
                    ctx.fillText('⭐', starX, starY);
                    ctx.restore();
                }
            }
        }
        else if (this.type === 'dungeon-overlord') {
            const img = enemyImages['dungeon-emperor'];
            let drawHeight = this.h;
            let drawY = this.y;
            
            if (this.actionState === 'smashed') {
                drawHeight = this.h * 0.45;
                drawY = levelHeight - 40 - drawHeight;
            }

            ctx.save();
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, this.x, drawY, this.w, drawHeight);
            } else {
                const seed = Math.floor(this.x * 2 + this.y * 3);
                drawSketchyRect(this.x, drawY, this.w, drawHeight, '#212529', '#ff3333', 3.5, seed);
            }
            ctx.restore();
            
            // Draw glowing eye laser sights if preping laser
            if (this.actionState === 'laser-prep') {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 77, 77, 0.8)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(this.x + this.w/2, this.y + this.h/2 + 10);
                ctx.lineTo(player.x < this.x ? 0 : levelWidth, this.y + this.h/2 + 10);
                ctx.stroke();
                ctx.restore();
            }
        }

        // If electrified, draw yellow crackling shock overlay
        if (this.isElectrified || (this.invulnerableFrame > 0 && Math.floor(this.invulnerableFrame / 5) % 2 === 0)) {
            let drawHeight = this.h;
            let drawY = this.y;
            if ((this.type === 'poster' || this.type === 'dungeon-overlord') && this.actionState === 'smashed') {
                drawHeight = this.h * (this.type === 'dungeon-overlord' ? 0.45 : 0.4);
                drawY = levelHeight - 40 - drawHeight;
            } else if (this.type === 'blood-shark' && this.actionState === 'bend') {
                drawHeight = this.h * 0.7;
                drawY = this.y + this.h * 0.3;
            }

            const seed = Math.floor(this.x * 12 + this.y * 14);
            // Draw crackling sparks around the bounding box
            for (let s = 0; s < 12; s++) {
                const angle = (s / 12) * Math.PI * 2;
                const sx = this.x + this.w/2 + (this.w/2 + 15) * Math.cos(angle);
                const sy = drawY + drawHeight/2 + (drawHeight/2 + 15) * Math.sin(angle);
                drawWildHair(sx, sy, 8 + Math.random()*5, '#ffd43b', seed + s);
            }
            // Outline
            ctx.strokeStyle = '#ffd43b';
            ctx.lineWidth = 3.5;
            ctx.strokeRect(this.x - 4, drawY - 4, this.w + 8, drawHeight + 8);
        }

        ctx.restore();
    }
}

// Particle effects for visual juice
class Particle {
    constructor(x, y, vx, vy, color, size, life, type = 'dust') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.maxLife = life;
        this.life = life;
        this.type = type; // 'dust', 'star', 'splash', 'bubble'
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (this.type === 'bubble') {
            this.vy = -0.5; // rise up
            this.vx += (Math.random() - 0.5) * 0.1;
        } else if (this.type === 'splash') {
            this.vy += 0.2; // gravity
        }
    }
    draw() {
        ctx.save();
        ctx.translate(-cameraX, 0);
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha;
        if (this.type === 'dust') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fill();
        } else if (this.type === 'star') {
            ctx.font = `bold ${this.size}px Gochi Hand`;
            ctx.fillText('★', this.x, this.y);
        } else if (this.type === 'splash') {
            ctx.fillRect(this.x, this.y, this.size, this.size);
        } else if (this.type === 'bubble') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Arrays for loaded game elements
let platforms = [];
let enemies = [];
let projectiles = [];
let particles = [];
let collectibles = []; // collectible items like hearts!
let boss = null;
let player = null;
let ponds = [];
let pushableBoxes = [];
let clones = []; // Spawning helper clones in World 5-2

// Screen Shake helper
function triggerScreenShake(duration) {
    shakeTimer = duration;
}

function getLevelName(levelNum) {
    if (levelNum === 1) return "World 1-1";
    if (levelNum === 2) return "World 1-2";
    if (levelNum === 3) return "World 1-3 (Boss)";
    if (levelNum === 4) return "World 2-1";
    if (levelNum === 5) return "World 2-2";
    if (levelNum === 6) return "World 2-3 (Boss)";
    if (levelNum === 7) return "World 3-1";
    if (levelNum === 8) return "World 3-2";
    if (levelNum === 9) return "World 3-3 (Boss)";
    if (levelNum === 10) return "World 4-1";
    if (levelNum === 11) return "World 4-2";
    if (levelNum === 12) return "World 4-3 (Boss)";
    if (levelNum === 13) return "World 5-1";
    if (levelNum === 14) return "World 5-2";
    if (levelNum === 15) return "World 5-3 (Challenge)";
    if (levelNum === 16) return "World 6-1";
    if (levelNum === 17) return "World 6-2";
    if (levelNum === 18) return "World 6-3 (Final Boss)";
    return "World " + levelNum;
}

function progressToNextLevel(nextLevelNum) {
    gameRunning = false;
    
    // Stop player movement
    if (player) {
        player.vx = 0;
        player.vy = 0;
    }
    
    // Draw transition message
    ctx.fillStyle = 'rgba(250, 246, 238, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let title = "BOSS DEFEATED!";
    let subtitle = "Preparing next level...";
    
    if (currentLevel === 3) {
        title = "POSTER DEFEATED! 👹";
        subtitle = "Prepare for World 2-1: The Gray Pond!";
    } else if (currentLevel === 6) {
        title = "BLOOD SHARK DEFEATED! 🦈👑";
        subtitle = "Prepare for World 3-1: Space & Gravity!";
    } else if (currentLevel === 9) {
        title = "DRAGON EMPEROR DEFEATED! 🐉";
        subtitle = "Prepare for World 4-1: The Volcano Pool!";
    } else if (currentLevel === 12) {
        title = "STAR-SHELL EMPRESS DEFEATED! 🐞";
        subtitle = "Prepare for World 5-1: Ink & Creators!";
    } else if (currentLevel === 18) {
        title = "DUNGEON EMPEROR DEFEATED! 👑";
        subtitle = "YOU HAVE SAVED THE SKETCHBOOK ADVENTURE!";
    }
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '36px Gochi Hand';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 25);
    
    ctx.fillStyle = '#2b2b2b';
    ctx.font = '22px Patrick Hand';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
    
    setTimeout(() => {
        if (currentLevel === 18) {
            startCelebration();
        } else {
            currentLevel = nextLevelNum;
            loadLevel(currentLevel);
            gameRunning = true;
            gameLoop();
        }
    }, 3000);
}

// Setup Level Layouts
function loadLevel(levelNum) {
    platforms = [];
    enemies = [];
    projectiles = [];
    collectibles = []; // Clear collectibles list on level load!
    boss = null;
    ponds = [];
    pushableBoxes = [];
    clones = []; // clear active clones
    currentLevel = levelNum;

    // Synchronize HUD dropdown selector if it exists
    const hudLevelSelect = document.getElementById('hud-level-select');
    if (hudLevelSelect) {
        hudLevelSelect.value = levelNum;
    }

    // Floor along whole level width (except where we manually override)
    if (levelNum !== 4 && levelNum !== 5 && levelNum !== 6 && levelNum !== 7 && levelNum !== 8 && levelNum !== 10) {
        platforms.push(new Platform(0, levelHeight - 40, 600, 40, 'grass'));
    }
    
    if (levelNum === 1) {
        levelWidth = 1800;
        // Level 1-1: Grass fields, simple pits and brick blocks
        platforms.push(new Platform(700, levelHeight - 40, 400, 40, 'grass'));
        platforms.push(new Platform(1250, levelHeight - 40, 600, 40, 'grass'));

        // High platforms (floating bricks)
        platforms.push(new Platform(300, levelHeight - 140, 120, 20, 'brick'));
        platforms.push(new Platform(480, levelHeight - 220, 100, 20, 'brick'));
        
        platforms.push(new Platform(800, levelHeight - 160, 160, 20, 'brick'));
        platforms.push(new Platform(1020, levelHeight - 240, 60, 20, 'box'));

        platforms.push(new Platform(1400, levelHeight - 150, 150, 20, 'brick'));

        // Add easy enemies
        enemies.push(new Enemy(400, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(900, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1450, levelHeight - 100, 'nippin'));

        // Collectible Hearts (World 1-1)
        collectibles.push(new Collectible(350, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1040, levelHeight - 280, 'heart'));
    } 
    else if (levelNum === 2) {
        levelWidth = 2000;
        // Level 1-2: Floating islands & dragon spit
        platforms.push(new Platform(0, levelHeight - 40, 400, 40, 'grass'));
        platforms.push(new Platform(550, levelHeight - 100, 180, 20, 'grass'));
        platforms.push(new Platform(850, levelHeight - 160, 150, 20, 'grass'));
        platforms.push(new Platform(1100, levelHeight - 80, 220, 20, 'dirt')); // Diggable dirt!
        platforms.push(new Platform(1450, levelHeight - 40, 600, 40, 'grass'));

        // Hazards
        enemies.push(new Enemy(600, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1200, levelHeight - 150, 'nippin'));
        enemies.push(new Enemy(1600, levelHeight - 100, 'dragon-wing'));

        // Collectible Hearts (World 1-2)
        collectibles.push(new Collectible(620, levelHeight - 140, 'heart'));
        collectibles.push(new Collectible(1200, levelHeight - 120, 'heart')); // Hidden in diggable dirt!
    } 
    else if (levelNum === 3) {
        levelWidth = 1000; // shorter boss room arena
        platforms.push(new Platform(0, levelHeight - 40, 1000, 40, 'brick')); // solid brick floor
        platforms.push(new Platform(150, levelHeight - 140, 120, 20, 'box'));
        platforms.push(new Platform(730, levelHeight - 140, 120, 20, 'box'));

        // Spawn the Nippin King in a dungeon packed with purple Nippins.
        enemies.push(new Enemy(180, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(300, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(620, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(760, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(220, levelHeight - 180, 'nippin'));
        enemies.push(new Enemy(680, levelHeight - 180, 'nippin'));
        boss = new Boss(440, 110, 'nippin-king');
        bossIntroTimer = 300; // 5-second intro hint

        // Collectible Hearts in Boss Level
        collectibles.push(new Collectible(200, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(780, levelHeight - 180, 'heart'));
    }
    else if (levelNum === 4) {
        levelWidth = 1800; // Large level for World 2-1
        platforms.push(new Platform(0, levelHeight - 40, 450, 40, 'brick')); // left shore
        platforms.push(new Platform(950, levelHeight - 40, 850, 40, 'brick')); // right shore
        
        platforms.push(new Platform(250, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(500, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(750, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(1100, levelHeight - 140, 120, 20, 'box'));

        // Spawn gray pond and pushable cube ("Blood Shark Cube")
        ponds.push(new Pond(450, levelHeight - 110, 500, 110));
        pushableBoxes.push(new PushableBox(300, levelHeight - 88, 48, 48));

        // Spawn submerged enemies inside the pond
        enemies.push(new Enemy(600, levelHeight - 80, 'star-shell-bug'));
        enemies.push(new Enemy(800, levelHeight - 80, 'nippin'));

        // Normal enemies
        enemies.push(new Enemy(1300, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1500, levelHeight - 180, 'dragon-wing'));

        // Collectible Hearts (World 2-1)
        collectibles.push(new Collectible(300, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(750, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1200, levelHeight - 180, 'heart'));
        bossIntroTimer = 300; // 5-second intro hint
    }
    else if (levelNum === 5) {
        levelWidth = 2000; // Twin Ponds level for World 2-2
        platforms.push(new Platform(0, levelHeight - 40, 400, 40, 'brick')); // left shore
        platforms.push(new Platform(750, levelHeight - 40, 350, 40, 'brick')); // middle shore
        platforms.push(new Platform(1500, levelHeight - 40, 500, 40, 'brick')); // right shore

        platforms.push(new Platform(200, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(520, levelHeight - 130, 80, 20, 'box'));
        platforms.push(new Platform(900, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(1250, levelHeight - 130, 80, 20, 'box'));
        platforms.push(new Platform(1650, levelHeight - 140, 120, 20, 'box'));

        // Spawn Ponds
        ponds.push(new Pond(400, levelHeight - 110, 350, 110));
        ponds.push(new Pond(1100, levelHeight - 110, 400, 110));

        // Pushable Cubes
        pushableBoxes.push(new PushableBox(250, levelHeight - 88, 48, 48));
        pushableBoxes.push(new PushableBox(950, levelHeight - 88, 48, 48));

        // Submerged Enemies
        enemies.push(new Enemy(500, levelHeight - 80, 'nippin'));
        enemies.push(new Enemy(1200, levelHeight - 80, 'star-shell-bug'));
        enemies.push(new Enemy(1350, levelHeight - 80, 'nippin'));

        // Normal Enemies
        enemies.push(new Enemy(850, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1600, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(600, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1300, levelHeight - 180, 'dragon-wing'));

        // Collectibles
        collectibles.push(new Collectible(520, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1250, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1750, levelHeight - 180, 'heart'));
        bossIntroTimer = 300; // 5-second intro hint
    }
    else if (levelNum === 6) {
        levelWidth = 1100; // World 2-3 Final Boss arena
        platforms.push(new Platform(0, levelHeight - 40, 450, 40, 'brick')); // solid brick floor left
        platforms.push(new Platform(650, levelHeight - 40, 450, 40, 'brick')); // solid brick floor right
        
        platforms.push(new Platform(250, levelHeight - 140, 120, 20, 'box'));
        platforms.push(new Platform(730, levelHeight - 140, 120, 20, 'box'));

        // Center pond and pushable cube
        ponds.push(new Pond(450, levelHeight - 110, 200, 110));
        pushableBoxes.push(new PushableBox(200, levelHeight - 88, 48, 48));

        // Spawn Blood Shark Boss standing on ground!
        boss = new Boss(750, levelHeight - 136, 'blood-shark');
        bossIntroTimer = 300; // 5-second intro hint

        // Collectible Hearts (World 2-3)
        collectibles.push(new Collectible(300, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(780, levelHeight - 180, 'heart'));
    }
    else if (levelNum === 7) {
        levelWidth = 1800; // Space low-gravity stage
        platforms.push(new Platform(0, levelHeight - 40, 500, 40, 'grass'));
        platforms.push(new Platform(1000, levelHeight - 40, 800, 40, 'grass'));

        // Elevated platforms to bridge the gap
        platforms.push(new Platform(580, levelHeight - 140, 140, 20, 'brick'));
        platforms.push(new Platform(800, levelHeight - 200, 100, 20, 'brick'));

        // Space theme enemies
        enemies.push(new Enemy(1200, levelHeight - 100, 'dragon-wing'));
        enemies.push(new Enemy(1450, levelHeight - 100, 'nippin'));

        // Collectibles
        collectibles.push(new Collectible(800, levelHeight - 240, 'heart'));
        collectibles.push(new Collectible(1350, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 8) {
        levelWidth = 2000; // Portal stage
        platforms.push(new Platform(0, levelHeight - 40, 450, 40, 'grass'));
        platforms.push(new Platform(1000, levelHeight - 40, 1000, 40, 'grass'));

        // A trick platform over the pit
        platforms.push(new Platform(680, levelHeight - 160, 120, 20, 'brick'));

        // Enemies
        enemies.push(new Enemy(1150, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1400, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1650, levelHeight - 180, 'dragon-wing'));

        // Collectibles
        collectibles.push(new Collectible(680, levelHeight - 200, 'heart'));
        collectibles.push(new Collectible(1500, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 9) {
        levelWidth = 1000; // Dragon Emperor Boss Arena
        platforms.push(new Platform(0, levelHeight - 40, 1000, 40, 'brick'));
        platforms.push(new Platform(300, levelHeight - 140, 400, 20, 'brick'));

        boss = new Boss(450, 80, 'dragon-emperor');
        bossIntroTimer = 300;

        collectibles.push(new Collectible(200, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(800, levelHeight - 180, 'heart'));
    }
    else if (levelNum === 10) {
        levelWidth = 1800; // Lava stage
        platforms.push(new Platform(0, levelHeight - 40, 450, 40, 'brick'));
        ponds.push(new Pond(450, levelHeight - 110, 500, 110, 'lava'));
        platforms.push(new Platform(950, levelHeight - 40, 850, 40, 'brick'));

        // Safe floating islands
        platforms.push(new Platform(520, levelHeight - 145, 120, 20, 'box'));
        platforms.push(new Platform(760, levelHeight - 145, 120, 20, 'box'));

        // Submerged Lava Fin / enemy
        enemies.push(new Enemy(680, levelHeight - 80, 'star-shell-bug'));

        // Normal enemies
        enemies.push(new Enemy(1150, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1400, levelHeight - 180, 'dragon-wing'));

        // Collectibles
        collectibles.push(new Collectible(300, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1300, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 11) {
        levelWidth = 2000; // Demolition bomb stage
        platforms.push(new Platform(0, levelHeight - 40, 2000, 40, 'brick'));

        // Wall of boxes blocking the flag at x = 1150
        platforms.push(new Platform(1150, levelHeight - 80, 50, 40, 'box'));
        platforms.push(new Platform(1150, levelHeight - 120, 50, 40, 'box'));
        platforms.push(new Platform(1150, levelHeight - 160, 50, 40, 'box'));
        platforms.push(new Platform(1200, levelHeight - 80, 50, 40, 'box'));
        platforms.push(new Platform(1200, levelHeight - 120, 50, 40, 'box'));
        platforms.push(new Platform(1200, levelHeight - 160, 50, 40, 'box'));

        // Enemies
        enemies.push(new Enemy(550, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(900, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1450, levelHeight - 100, 'blood-shark'));

        // Collectibles
        collectibles.push(new Collectible(800, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1500, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 12) {
        levelWidth = 1100; // Star Shell Empress Boss Arena
        platforms.push(new Platform(0, levelHeight - 40, 1100, 40, 'brick'));
        platforms.push(new Platform(400, levelHeight - 140, 300, 20, 'brick'));

        boss = new Boss(500, levelHeight - 120, 'star-empress');
        bossIntroTimer = 300;

        collectibles.push(new Collectible(200, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(900, levelHeight - 180, 'heart'));
    }
    else if (levelNum === 13) {
        levelWidth = 1800; // Freeze signpost stage
        platforms.push(new Platform(0, levelHeight - 40, 1800, 40, 'grass'));

        // Pack of enemies to be frozen
        enemies.push(new Enemy(550, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(630, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(710, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(790, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1050, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1250, levelHeight - 100, 'blood-shark'));

        // Collectibles
        collectibles.push(new Collectible(600, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1200, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 14) {
        levelWidth = 2000; // Clone helper stage
        platforms.push(new Platform(0, levelHeight - 40, 2000, 40, 'grass'));

        // Enemies for clone to run into
        enemies.push(new Enemy(600, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(800, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1000, levelHeight - 100, 'blood-shark'));
        enemies.push(new Enemy(1200, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1450, levelHeight - 100, 'star-shell-bug'));

        // Collectibles
        collectibles.push(new Collectible(800, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1300, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 15) {
        levelWidth = 2200; // Large scrolling platforming stage!
        platforms.push(new Platform(0, levelHeight - 40, 500, 40, 'brick'));
        platforms.push(new Platform(650, levelHeight - 40, 400, 40, 'brick'));
        platforms.push(new Platform(1200, levelHeight - 40, 400, 40, 'brick'));
        platforms.push(new Platform(1750, levelHeight - 40, 450, 40, 'brick'));

        // Elevated platforms
        platforms.push(new Platform(300, levelHeight - 140, 120, 20, 'box'));
        platforms.push(new Platform(500, levelHeight - 220, 100, 20, 'box'));
        platforms.push(new Platform(800, levelHeight - 140, 150, 20, 'box'));
        platforms.push(new Platform(1100, levelHeight - 200, 100, 20, 'box'));
        platforms.push(new Platform(1400, levelHeight - 150, 150, 20, 'box'));
        platforms.push(new Platform(1600, levelHeight - 240, 100, 20, 'box'));
        platforms.push(new Platform(1850, levelHeight - 140, 120, 20, 'box'));

        // Ponds (Lava pool in the middle!)
        ponds.push(new Pond(500, levelHeight - 110, 150, 110, 'lava'));
        ponds.push(new Pond(1600, levelHeight - 110, 150, 110, 'lava'));

        // Pushable boxes
        pushableBoxes.push(new PushableBox(200, levelHeight - 88, 48, 48));

        // Normal enemies
        enemies.push(new Enemy(400, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(750, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1100, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1350, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1900, levelHeight - 100, 'blood-shark'));

        // Collectibles
        collectibles.push(new Collectible(300, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(850, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1450, levelHeight - 190, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 16) {
        levelWidth = 2000; // World 6-1 platforming
        platforms.push(new Platform(0, levelHeight - 40, 500, 40, 'brick'));
        platforms.push(new Platform(650, levelHeight - 40, 500, 40, 'brick'));
        platforms.push(new Platform(1300, levelHeight - 40, 700, 40, 'brick'));

        // High platforms
        platforms.push(new Platform(250, levelHeight - 140, 140, 20, 'box'));
        platforms.push(new Platform(450, levelHeight - 220, 120, 20, 'box'));
        platforms.push(new Platform(800, levelHeight - 150, 150, 20, 'box'));
        platforms.push(new Platform(1100, levelHeight - 240, 100, 20, 'box'));
        platforms.push(new Platform(1500, levelHeight - 140, 160, 20, 'box'));

        // Enemies
        enemies.push(new Enemy(350, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(850, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1000, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1400, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1700, levelHeight - 100, 'blood-shark'));

        // Collectibles
        collectibles.push(new Collectible(450, levelHeight - 260, 'heart'));
        collectibles.push(new Collectible(1100, levelHeight - 280, 'heart'));
        collectibles.push(new Collectible(1550, levelHeight - 180, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 17) {
        levelWidth = 2400; // World 6-2 Obstacle Course
        platforms.push(new Platform(0, levelHeight - 40, 400, 40, 'brick'));
        platforms.push(new Platform(500, levelHeight - 40, 300, 40, 'brick'));
        ponds.push(new Pond(400, levelHeight - 110, 100, 110, 'lava'));

        platforms.push(new Platform(950, levelHeight - 40, 400, 40, 'brick'));
        ponds.push(new Pond(800, levelHeight - 110, 150, 110, 'lava'));

        platforms.push(new Platform(1500, levelHeight - 40, 900, 40, 'brick'));

        // Elevated platforms
        platforms.push(new Platform(200, levelHeight - 140, 100, 20, 'box'));
        platforms.push(new Platform(600, levelHeight - 150, 120, 20, 'box'));
        platforms.push(new Platform(1100, levelHeight - 140, 150, 20, 'box'));
        platforms.push(new Platform(1650, levelHeight - 150, 120, 20, 'box'));
        platforms.push(new Platform(1900, levelHeight - 220, 120, 20, 'box'));

        // Pushable box
        pushableBoxes.push(new PushableBox(250, levelHeight - 88, 48, 48));

        // Enemies
        enemies.push(new Enemy(600, levelHeight - 100, 'blood-shark'));
        enemies.push(new Enemy(1150, levelHeight - 100, 'star-shell-bug'));
        enemies.push(new Enemy(1300, levelHeight - 100, 'nippin'));
        enemies.push(new Enemy(1600, levelHeight - 180, 'dragon-wing'));
        enemies.push(new Enemy(1800, levelHeight - 100, 'blood-shark'));

        // Collectibles
        collectibles.push(new Collectible(600, levelHeight - 190, 'heart'));
        collectibles.push(new Collectible(1150, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(1900, levelHeight - 260, 'heart'));
        bossIntroTimer = 300;
    }
    else if (levelNum === 18) {
        levelWidth = 1200; // Final Boss Arena (Dungeon Emperor)
        platforms.push(new Platform(0, levelHeight - 40, 1200, 40, 'brick'));
        platforms.push(new Platform(200, levelHeight - 140, 200, 20, 'brick'));
        platforms.push(new Platform(800, levelHeight - 140, 200, 20, 'brick'));

        boss = new Boss(500, 70, 'dungeon-overlord');
        bossIntroTimer = 300;

        collectibles.push(new Collectible(300, levelHeight - 180, 'heart'));
        collectibles.push(new Collectible(900, levelHeight - 180, 'heart'));
    }

    // Spawn player at start
    if (player) {
        player.x = 80;
        player.y = levelHeight - 150;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.isGroundPounding = false;
        player.airplaneSpawned = false; // reset airplane state
        player.bombExploded = false;
        player.freezeTriggered = false;
        player.cloneSpawned = false;
        player.gravityMultiplier = 1.0;
        player.lavaShieldTimer = 0;
        player.applyStats();
    } else {
        player = new Player(80, levelHeight - 150, activeHero);
        player.bombExploded = false;
        player.freezeTriggered = false;
        player.cloneSpawned = false;
        player.gravityMultiplier = 1.0;
        player.lavaShieldTimer = 0;
    }

    updateHUD();
}

// Collisions engine
function checkCollisions() {
    // Submerged Swimming Physics & Shark Fin collision
    ponds.forEach(pond => {
        // Player swimming check
        if (player.x < pond.x + pond.w && player.x + player.width > pond.x &&
            player.y < pond.y + pond.h && player.y + player.height > pond.y) {
            
            // Swim physics: cap falling speed (buoyancy)
            player.vy = Math.min(player.vy, 1.5);
            
            // Swim up
            if (keys.up) {
                player.vy = -5.5;
                // Swim bubbles
                if (Math.random() < 0.25) {
                    const bubbleColor = pond.type === 'lava' ? 'rgba(255, 146, 43, 0.75)' : 'rgba(255,255,255,0.75)';
                    particles.push(new Particle(player.x + Math.random()*player.width, player.y + player.height - 5, (Math.random()-0.5)*0.8, -0.5, bubbleColor, 1.5 + Math.random()*2, 35, 'bubble'));
                }
            }
            
            // Splash particles at surface
            if (Math.abs(player.vy) > 0.5 && Math.random() < 0.15) {
                const splashColor = pond.type === 'lava' ? 'rgba(255, 107, 107, 0.8)' : 'rgba(150, 170, 190, 0.7)';
                particles.push(new Particle(player.x + Math.random()*player.width, pond.y, (Math.random()-0.5)*2, -1 - Math.random()*2, splashColor, 3 + Math.random()*3, 15, 'splash'));
            }

            // Prevent sinking below screen bottom (pond floor)
            if (player.y + player.height > levelHeight) {
                player.y = levelHeight - player.height;
                if (player.vy > 0) player.vy = 0;
            }

            // Lava damage check
            if (pond.type === 'lava') {
                if (!player.lavaShieldTimer || player.lavaShieldTimer <= 0) {
                    player.takeDamage(1);
                    player.vy = -6.0; // pop player up out of lava
                    triggerScreenShake(8);
                }
            }

            // Shark Fin collision
            const sharkFinX = pond.sharkX + 12;
            const sharkFinY = pond.y - 12;
            const playerCenterX = player.x + player.width/2;
            const playerCenterY = player.y + player.height/2;
            const dist = Math.hypot(playerCenterX - sharkFinX, playerCenterY - sharkFinY);
            if (dist < 40) {
                player.takeDamage(1);
                player.vy = -9.0; // pop player up
                player.vx = (playerCenterX > sharkFinX) ? 4.5 : -4.5; // horizontal knockback
                triggerScreenShake(8);
            }
        }

        // Enemies swimming check
        enemies.forEach(e => {
            if (e.x < pond.x + pond.w && e.x + e.w > pond.x &&
                e.y < pond.y + pond.h && e.y + e.h > pond.y) {
                
                // Cap sinking speed
                e.vy = Math.min(e.vy, 1.0);
                
                // Prevent sinking below bottom of pond
                if (e.y + e.h > levelHeight) {
                    e.y = levelHeight - e.h;
                    if (e.vy > 0) e.vy = 0;
                }

                // Bounce off pond edges to stay submerged
                if (e.x < pond.x + 10) {
                    e.x = pond.x + 10;
                    e.vx = Math.abs(e.vx); // Move right
                } else if (e.x + e.w > pond.x + pond.w - 10) {
                    e.x = pond.x + pond.w - 10 - e.w;
                    e.vx = -Math.abs(e.vx); // Move left
                }
            }
        });
    });

    // Enemy to Platforms
    enemies.forEach(e => {
        platforms.forEach(p => {
            if (e.x < p.x + p.w &&
                e.x + e.w > p.x &&
                e.y < p.y + p.h &&
                e.y + e.h > p.y) {
                
                const overlapX = Math.min(e.x + e.w - p.x, p.x + p.w - e.x);
                const overlapY = Math.min(e.y + e.h - p.y, p.y + p.h - e.y);

                if (overlapX > overlapY) {
                    if (e.vy > 0) {
                        e.y = p.y - e.h;
                        e.vy = 0;
                    }
                }
            }
        });
    });

    // Player to Enemies (Combat/Hurt)
    enemies.forEach(e => {
        const pad = 4;
        if (player.x < e.x + e.w - pad &&
            player.x + player.width > e.x + pad &&
            player.y < e.y + e.h - pad &&
            player.y + player.height > e.y + pad) {
            
            // If player falls on top OR ground pounds: kill enemy!
            if (player.vy > 0 && player.y + player.height - player.vy <= e.y + 10) {
                if (e.type !== 'electro') {
                    // Squash enemy!
                    enemies = enemies.filter(item => item !== e);
                    player.vy = -6; // bounce up
                    player.isGroundPounding = false;
                    triggerScreenShake(5);

                    // Defeat star particles
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(e.x + e.w/2, e.y + e.h/2, (Math.random()-0.5)*5, (Math.random()-0.5)*5 - 1.5, '#ffd43b', 14 + Math.random()*8, 25, 'star'));
                    }
                } else {
                    // Electro hazard zaps even if you jump on him!
                    player.takeDamage(1);
                }
            } else {
                // Side collision: player takes damage (unless Hip-P is sneaking/underground)
                if (player.type === 'hip-p' && player.isSneaking) {
                    // Hip-P sneaks past safely!
                } else {
                    player.takeDamage(1);
                }
            }
        }
    });

    // Player to Projectiles
    projectiles.forEach(proj => {
        if (proj.active && proj.owner !== 'hero' &&
            player.x < proj.x + proj.r &&
            player.x + player.width > proj.x - proj.r &&
            player.y < proj.y + proj.r &&
            player.y + player.height > proj.y - proj.r) {
            
            // Check if player is falling onto the projectile (bounce deflection)
            const playerBottom = player.y + player.height;
            const isAbove = (playerBottom - player.vy <= proj.y + 2);
            
            if (player.vy > 0 && isAbove) {
                // Bounce deflection!
                player.vy = -7.5;
                player.isGroundPounding = false;
                
                proj.owner = 'hero';
                proj.vx = -proj.vx * 1.4; // reverse and speed up
                proj.vy = -3.5; // push slightly up
                
                // Check if near DEFLECT LASERS! sign (x = 150 in Level 6)
                if (currentLevel === 6 && Math.abs(proj.x - 150) < 160) {
                    proj.r = 16; // make it giant!
                    proj.vx *= 1.35; // extra speed!
                    triggerScreenShake(10); // massive shake!
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(proj.x, proj.y, (Math.random()-0.5)*8, (Math.random()-0.5)*8 - 2, '#ffd43b', 16, 25, 'star'));
                    }
                } else {
                    triggerScreenShake(6);
                }
                
                // Spawn cool deflection spark particles
                for (let i = 0; i < 5; i++) {
                    projectiles.push(new Projectile(
                        proj.x,
                        proj.y,
                        (Math.random() - 0.5) * 6,
                        (Math.random() - 0.5) * 6 - 2,
                        'hero'
                    ));
                }
            } else {
                // Take damage if touched from side or below
                proj.active = false;
                player.takeDamage(1);
            }
        }
    });

    // Enemy Projectiles to Platforms (Spawns Spark-Balls)
    projectiles.forEach(proj => {
        if (proj.active && proj.owner === 'enemy') {
            platforms.forEach(p => {
                if (proj.x > p.x && proj.x < p.x + p.w &&
                    proj.y + proj.r > p.y && proj.y - proj.r < p.y + p.h) {
                    
                    proj.active = false;
                    
                    // Spawn spark-ball enemy just above platform top
                    const sparkBall = new Enemy(proj.x - 12, p.y - 24, 'spark-ball');
                    // Move in player's direction
                    if (player) {
                        sparkBall.vx = (player.x < sparkBall.x) ? -1.8 : 1.8;
                    }
                    enemies.push(sparkBall);
                    triggerScreenShake(3);
                }
            });
        }
    });

    // Projectiles to Enemies (Hero sparks damaging bad guys)
    projectiles.forEach(proj => {
        if (proj.active && proj.owner === 'hero') {
            enemies.forEach(e => {
                if (proj.x + proj.r > e.x && proj.x - proj.r < e.x + e.w &&
                    proj.y + proj.r > e.y && proj.y - proj.r < e.y + e.h) {
                    proj.active = false;
                    enemies = enemies.filter(item => item !== e);
                    triggerScreenShake(4);

                    // Defeat star particles
                    for (let i = 0; i < 6; i++) {
                        particles.push(new Particle(e.x + e.w/2, e.y + e.h/2, (Math.random()-0.5)*4, (Math.random()-0.5)*4 - 1.5, '#ffd43b', 14 + Math.random()*6, 25, 'star'));
                    }
                }
            });
            // Also can hit boss
            if (boss && proj.x + proj.r > boss.x && proj.x - proj.r < boss.x + boss.w &&
                proj.y + proj.r > boss.y && proj.y - proj.r < boss.y + boss.h) {
                proj.active = false;
                if (boss.invulnerableFrame <= 0) {
                    let dmg = 1;
                    let invul = 40;
                    if (boss.type === 'star-empress') {
                        if (boss.actionState === 'stunned') {
                            dmg = 2; // double damage when stunned!
                            invul = 15; // shorter invulnerability
                        } else {
                            invul = 40;
                        }
                    }
                    boss.hearts -= dmg;
                    boss.isElectrified = true;
                    boss.invulnerableFrame = invul;
                    triggerScreenShake(8);
                    
                    // If hitting Blood Shark, trigger stun!
                    if (boss.type === 'blood-shark') {
                        boss.actionState = 'stunned';
                        boss.timer = 90; // Stun for 1.5 seconds
                        boss.vx = 0;
                    }

                    if (boss.hearts <= 0) {
                        if (boss.type === 'poster') {
                            progressToNextLevel(4);
                        } else if (boss.type === 'nippin-king') {
                            progressToNextLevel(4);
                        } else if (boss.type === 'blood-shark') {
                            progressToNextLevel(7);
                        } else if (boss.type === 'dragon-emperor') {
                            progressToNextLevel(10);
                        } else if (boss.type === 'star-empress') {
                            progressToNextLevel(13);
                        } else if (boss.type === 'dungeon-overlord') {
                            progressToNextLevel(19);
                        } else {
                            winGame();
                        }
                    }
                }
            }
        }
    });

    // Boss Collisions (Level 3 and 4)
    if (boss) {
        // Simple AABB overlap check for player touching boss
        if (player.x < boss.x + boss.w &&
            player.x + player.width > boss.x &&
            player.y < boss.y + boss.h &&
            player.y + player.height > boss.y) {
            
            if (boss.type === 'poster') {
                if (boss.actionState === 'smashed') {
                    // If Poster is smashed on the floor: touching him ELECTRIFIES and hurts him!
                    if (boss.invulnerableFrame <= 0) {
                        boss.hearts--;
                        boss.invulnerableFrame = 60; // 1 second invulnerability
                        boss.isElectrified = true;   // Trigger spark visuals
                        triggerScreenShake(14);
                        
                        // Spawn cool yellow electric spark particles!
                        for (let i = 0; i < 8; i++) {
                            projectiles.push(new Projectile(
                                boss.x + boss.w/2, 
                                boss.y + boss.h/2 + (Math.random()-0.5)*30, 
                                (Math.random()-0.5)*10, 
                                (Math.random()-0.5)*10 - 2, 
                                'hero'
                            ));
                        }
                        
                        if (boss.hearts <= 0) {
                            progressToNextLevel(4);
                        }
                    }
                } else {
                    // Touching Poster while floating or rising damages the player!
                    player.takeDamage(1);
                }
            } 
            else if (boss.type === 'nippin-king') {
                // The Nippin King can be stomped while he is bouncing.
                if (player.vy > 0 && player.y + player.height - player.vy <= boss.y + 28) {
                    if (boss.invulnerableFrame <= 0) {
                        boss.hearts--;
                        boss.invulnerableFrame = 45;
                        boss.isElectrified = true;
                        player.vy = -9;
                        player.isGroundPounding = false;
                        triggerScreenShake(12);
                        for (let i = 0; i < 8; i++) {
                            particles.push(new Particle(boss.x + boss.w / 2, boss.y + boss.h / 2, (Math.random() - 0.5) * 6, -2 - Math.random() * 4, '#c084fc', 10 + Math.random() * 6, 25, 'star'));
                        }
                        if (boss.hearts <= 0) {
                            progressToNextLevel(4);
                        }
                    }
                } else {
                    player.takeDamage(1);
                }
            }
            else if (boss.type === 'blood-shark') {
                // To defeat Blood Shark: Jump on his head when he is NOT whacking!
                if (player.vy > 0 && player.y + player.height - player.vy <= boss.y + 20) {
                    if (boss.actionState !== 'whack' && boss.invulnerableFrame <= 0) {
                        boss.hearts--;
                        boss.invulnerableFrame = 50;
                        boss.isElectrified = true;
                        player.vy = -8; // bounce up
                        player.isGroundPounding = false;
                        triggerScreenShake(12);
                        
                        // Spawn cool particles!
                        for (let i = 0; i < 6; i++) {
                            projectiles.push(new Projectile(
                                boss.x + boss.w/2, 
                                boss.y + 15, 
                                (Math.random()-0.5)*8, 
                                -2 - Math.random()*4, 
                                'hero'
                            ));
                        }

                        if (boss.hearts <= 0) {
                            progressToNextLevel(7);
                        }
                    } else {
                        // Whacking state: zaps player if they jump on him!
                        player.takeDamage(1);
                    }
                } else {
                    // Side touch: player takes damage (unless Hip-P is sneaking)
                    if (player.type === 'hip-p' && player.isSneaking) {
                        // Can sneak past him safely!
                    } else {
                        player.takeDamage(1);
                    }
                }
            }
            else if (boss.type === 'dragon-emperor') {
                // To defeat Dragon Emperor: jump on his head or zap him
                if (player.vy > 0 && player.y + player.height - player.vy <= boss.y + 25) {
                    if (boss.invulnerableFrame <= 0) {
                        boss.hearts--;
                        boss.invulnerableFrame = 40;
                        boss.isElectrified = true;
                        player.vy = -8.5; // bounce up
                        player.isGroundPounding = false;
                        triggerScreenShake(12);
                        
                        for (let i = 0; i < 6; i++) {
                            particles.push(new Particle(boss.x + boss.w/2, boss.y + boss.h - 15, (Math.random()-0.5)*6, -2 - Math.random()*4, '#ffd43b', 10 + Math.random()*6, 25, 'star'));
                        }
                        
                        if (boss.hearts <= 0) {
                            progressToNextLevel(10);
                        }
                    }
                } else {
                    player.takeDamage(1);
                }
            }
            else if (boss.type === 'star-empress') {
                // To defeat Star Shell Empress: only vulnerable when stunned
                if (boss.actionState === 'stunned') {
                    if (player.vy > 0 && player.y + player.height - player.vy <= boss.y + 20) {
                        if (boss.invulnerableFrame <= 0) {
                            boss.hearts -= 2; // double damage when stomped!
                            boss.invulnerableFrame = 15; // shorter invulnerability frames
                            boss.isElectrified = true;
                            player.vy = -8.5; // bounce up
                            player.isGroundPounding = false;
                            triggerScreenShake(12);
                            
                            for (let i = 0; i < 8; i++) {
                                particles.push(new Particle(boss.x + boss.w/2, boss.y + 15, (Math.random()-0.5)*6, -2 - Math.random()*4, '#ffd43b', 10 + Math.random()*6, 25, 'star'));
                            }
                            
                            if (boss.hearts <= 0) {
                                progressToNextLevel(13);
                            }
                        }
                    }
                } else {
                    player.takeDamage(1);
                }
            }
            else if (boss.type === 'dungeon-overlord') {
                // To defeat Dungeon Emperor: only vulnerable when smashed flat
                if (boss.actionState === 'smashed') {
                    if (boss.invulnerableFrame <= 0) {
                        boss.hearts--;
                        boss.invulnerableFrame = 60;
                        boss.isElectrified = true;
                        triggerScreenShake(15);
                        
                        for (let i = 0; i < 10; i++) {
                            projectiles.push(new Projectile(
                                boss.x + boss.w/2, 
                                boss.y + boss.h/2 + (Math.random()-0.5)*30, 
                                (Math.random()-0.5)*10, 
                                (Math.random()-0.5)*10 - 2, 
                                'hero'
                            ));
                        }
                        
                        if (boss.hearts <= 0) {
                            progressToNextLevel(19);
                        }
                    }
                } else {
                    player.takeDamage(1);
                }
            }
        }
    }

    // Player to Collectibles
    collectibles.forEach(c => {
        if (c.active &&
            player.x < c.x + c.w &&
            player.x + player.width > c.x &&
            player.y < c.y + c.h &&
            player.y + player.height > c.y) {
            
            c.active = false;
            if (c.type === 'heart') {
                if (player.hearts < 7) {
                    player.hearts++;
                }
                updateHUD();
                triggerScreenShake(3);
                // Electric spark particles on pickup
                for (let i = 0; i < 5; i++) {
                    projectiles.push(new Projectile(player.x + player.width/2, player.y + player.height/2, (Math.random()-0.5)*6, (Math.random()-0.5)*6, 'hero'));
                }
            }
        }
    });

    // Clean up squashed enemies
    enemies = enemies.filter(e => e.y < 900);
}

// HUD Updates
function updateHUD() {
    if (!player) return;
    hudHeroName.textContent = activeHero.toUpperCase().replace(/-/g, ' ');
    hudHearts.textContent = '❤️'.repeat(player.hearts);
}

function startGame(heroType) {
    window.BlakeTelemetry?.track('game_start', { hero: heroType, level: selectedStartLevel });
    activeHero = heroType;
    charSelectScreen.classList.remove('active');
    monsterGuideScreen.classList.remove('active');
    gameplayScreen.classList.add('active');
    gameOverOverlay.classList.remove('active');
    notebookTabs.style.display = 'none';
    
    loadLevel(selectedStartLevel);
    
    gameRunning = true;
    gameLoop();
}

function endGame() {
    // Keep gameRunning = true so loop continues rendering, but player is dead
    gameOverOverlay.classList.add('active');
}

function winGame() {
    gameRunning = false;
    window.BlakeTelemetry?.track('game_complete', { level: selectedStartLevel });
    alert("🌟 Huzzah! You beat Blood Shark Boss and completed Flope & Dope! You saved the day! 🌟");
    backToMenu();
}

function backToMenu() {
    gameRunning = false;
    gameplayScreen.classList.remove('active');
    charSelectScreen.classList.add('active');
    monsterGuideScreen.classList.remove('active');
    notebookTabs.style.display = 'flex';
    switchTab('play');
    // No static label to reset
    // Deselect cards
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('selected'));
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Select a Hero First!';
}

// Celebration Outro Screen State and Functions
let isCelebrating = false;
let celebrationHeroes = [];
let celebrationBalloons = [];
let celebrationConfetti = [];

function startCelebration() {
    isCelebrating = true;
    gameRunning = true;
    
    // Show celebration UI overlay on top
    let celebOverlay = document.getElementById('celebration-overlay');
    if (!celebOverlay) {
        celebOverlay = document.createElement('div');
        celebOverlay.id = 'celebration-overlay';
        celebOverlay.className = 'canvas-overlay active';
        celebOverlay.style.display = 'flex';
        celebOverlay.innerHTML = `
            <h2 class="victory-title">VICTORY! 🎉</h2>
            <p class="victory-subtitle">You beat the Dungeon Emperor and saved the sketchbook!</p>
            <button id="victory-menu-btn" class="crayon-button">Back to Menu</button>
        `;
        document.querySelector('.canvas-frame').appendChild(celebOverlay);
        
        document.getElementById('victory-menu-btn').addEventListener('click', () => {
            celebOverlay.classList.remove('active');
            celebOverlay.style.display = 'none';
            isCelebrating = false;
            backToMenu();
        });
    } else {
        celebOverlay.classList.add('active');
        celebOverlay.style.display = 'flex';
    }

    // Initialize heroes
    celebrationHeroes = [];
    heroTypes.forEach((type, idx) => {
        const heroNames = {
            'giant-dad': 'Giant Dad',
            'hip-p': 'Hip-P',
            'tuskanty': 'Tuskanty',
            'among-us-ben': 'Ben',
            'hosco': 'Hosco',
            'electro': 'Electro'
        };
        const dialogue = [
            "THE LEGEND NEVER DIES! ⚔️",
            "Sneaking is the best! 🥷",
            "I dug all the way here! ⛏️",
            "Super speed, baby! ⚡",
            "Love bouncing on boxes! 📦",
            "Shocking victory! ⚡"
        ];
        celebrationHeroes.push({
            type: type,
            name: heroNames[type] || type,
            x: 80 + idx * 110,
            y: levelHeight - 40 - 48,
            w: 32,
            h: 48,
            vy: 0,
            bounceOffset: idx * 0.7,
            jumpTimer: 30 + Math.random() * 40,
            dialogue: dialogue[idx],
            bubbleTimer: 90 + Math.random() * 60,
            color: ['#ff6b6b', '#cc5de8', '#ff922b', '#4dabf7', '#ffd43b', '#51cf66'][idx]
        });
    });

    // Initialize balloons
    celebrationBalloons = [];
    for (let i = 0; i < 8; i++) {
        celebrationBalloons.push({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 200,
            vy: -1.0 - Math.random() * 1.5,
            color: ['#ff6b6b', '#ffd43b', '#4dabf7', '#51cf66', '#ff922b', '#cc5de8'][Math.floor(Math.random() * 6)],
            w: 20,
            h: 26,
            swingSpeed: 0.02 + Math.random() * 0.03,
            swingAngle: Math.random() * Math.PI * 2,
            swingRange: 15 + Math.random() * 20
        });
    }

    // Initialize confetti
    celebrationConfetti = [];
    for (let i = 0; i < 70; i++) {
        celebrationConfetti.push({
            x: Math.random() * canvas.width,
            y: -Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: 1.5 + Math.random() * 2,
            color: ['#ff6b6b', '#ffd43b', '#4dabf7', '#51cf66', '#ff922b', '#cc5de8', '#ff8787', '#94d82d'][Math.floor(Math.random() * 8)],
            size: 4 + Math.random() * 6,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.1
        });
    }

    gameLoop(); // trigger loop continuation
}

function updateCelebration() {
    // Update Heroes
    celebrationHeroes.forEach(hero => {
        hero.jumpTimer--;
        if (hero.jumpTimer <= 0) {
            hero.vy = -6 - Math.random() * 5;
            hero.jumpTimer = 80 + Math.random() * 80;
            hero.bubbleTimer = 90 + Math.random() * 90;
        }

        hero.vy += 0.4; // gravity
        hero.y += hero.vy;

        if (hero.y + hero.h >= levelHeight - 40) {
            hero.y = levelHeight - 40 - hero.h;
            hero.vy = 0;
        }

        if (hero.bubbleTimer > 0) {
            hero.bubbleTimer--;
        }
    });

    // Update Balloons
    celebrationBalloons.forEach(b => {
        b.y += b.vy;
        b.swingAngle += b.swingSpeed;
        if (b.y < -50) {
            b.y = canvas.height + 40;
            b.x = Math.random() * canvas.width;
        }
    });

    // Update Confetti
    celebrationConfetti.forEach(c => {
        c.y += c.vy;
        c.x += c.vx;
        c.rot += c.rotSpeed;

        if (c.y > canvas.height + 20) {
            c.y = -20;
            c.x = Math.random() * canvas.width;
        }
    });
}

function drawCelebration() {
    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rainbow notebook lines
    const colors = ['rgba(255, 107, 107, 0.15)', 'rgba(255, 146, 43, 0.15)', 'rgba(255, 212, 59, 0.15)', 'rgba(81, 207, 102, 0.15)', 'rgba(77, 171, 247, 0.15)', 'rgba(204, 93, 232, 0.15)'];
    let lineIdx = 0;
    for (let y = 30; y < canvas.height; y += 24) {
        ctx.strokeStyle = colors[lineIdx % colors.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        lineIdx++;
    }

    // Red margin line
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.28)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.lineTo(70, canvas.height);
    ctx.stroke();

    // Ground platform
    drawSketchyRect(0, levelHeight - 40, canvas.width, 40, '#e9ecef', '#2b2b2b', 2.0, 42);

    // Draw Balloons
    celebrationBalloons.forEach(b => {
        ctx.save();
        const swingX = b.x + Math.sin(b.swingAngle) * b.swingRange;
        ctx.translate(swingX, b.y);

        ctx.strokeStyle = 'rgba(43, 43, 43, 0.28)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, b.h);
        ctx.quadraticCurveTo(-5, b.h + 12, 5, b.h + 30);
        ctx.stroke();

        ctx.fillStyle = b.color;
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.w, b.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-3, b.h - 2);
        ctx.lineTo(3, b.h - 2);
        ctx.lineTo(0, b.h + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    });

    // Draw Heroes
    celebrationHeroes.forEach(hero => {
        const img = heroImages[hero.type];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, hero.x, hero.y, hero.w, hero.h);
        } else {
            drawSketchyRect(hero.x, hero.y, hero.w, hero.h, hero.color, '#2b2b2b', 2.0, 9);
        }

        ctx.fillStyle = '#2b2b2b';
        ctx.font = '14px Patrick Hand';
        ctx.textAlign = 'center';
        ctx.fillText(hero.name, hero.x + hero.w / 2, hero.y + hero.h + 16);

        if (hero.bubbleTimer > 0) {
            ctx.save();
            const bx = hero.x + hero.w / 2;
            const by = hero.y - 20;

            ctx.font = '14px Gochi Hand';
            const textWidth = ctx.measureText(hero.dialogue).width;
            const bw = textWidth + 16;
            const bh = 24;

            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(bx - bw / 2, by - bh, bw, bh, 6);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(bx - 4, by);
            ctx.lineTo(bx + 4, by);
            ctx.lineTo(bx, by + 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#2b2b2b';
            ctx.textAlign = 'center';
            ctx.fillText(hero.dialogue, bx, by - 7);
            ctx.restore();
        }
    });

    // Draw Confetti
    celebrationConfetti.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        ctx.restore();
    });
}

// Main Game Loop (runs 60 times a second)
// Main Game Loop (runs 60 times a second)
function gameLoop() {
    if (!gameRunning) return;

    if (isCelebrating) {
        updateCelebration();
        drawCelebration();
        requestAnimationFrame(gameLoop);
        return;
    }

    // Update sketchy frame cycle (approx 6.6fps)
    frameCount++;
    if (frameCount % 9 === 0) {
        currentSketchFrame = (currentSketchFrame + 1) % 3;
    }

    // 1. Update Game Engine
    if (player && player.hearts > 0) {
        // Manage bridge platform dynamically in Level 6
        if (currentLevel === 6) {
            const hasBoxInPond = pushableBoxes.some(box => box.x + box.w > 450 && box.x < 650 && box.y > 300);
            const bridgePlatformIndex = platforms.findIndex(p => p.type === 'bridge');
            
            if (hasBoxInPond) {
                if (bridgePlatformIndex === -1) {
                    // Spawn bridge platform!
                    platforms.push(new Platform(450, levelHeight - 40, 200, 15, 'bridge'));
                }
            } else {
                if (bridgePlatformIndex !== -1) {
                    // Remove bridge platform!
                    platforms.splice(bridgePlatformIndex, 1);
                }
            }
        }

        player.update();
        clones.forEach(c => c.update());
        ponds.forEach(p => p.update());
        pushableBoxes.forEach(box => box.update());
        enemies.forEach(e => e.update());
        projectiles.forEach(p => p.update());
        particles.forEach(p => p.update());
        collectibles.forEach(c => c.update());
        if (boss) boss.update(player);
        checkCollisions();
    } else {
        // Player is dead: still update projectiles & particles so they fly away
        projectiles.forEach(p => p.update());
        particles.forEach(p => p.update());
    }

    // Clean inactive projectiles, particles & clones
    projectiles = projectiles.filter(p => p.active);
    particles = particles.filter(p => p.life > 0);
    clones = clones.filter(c => c.life > 0 && c.y < 900);

    // Level progression scrolling check
    if (player.x > levelWidth - 50) {
        const platformingLevels = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 15, 16, 17];
        if (platformingLevels.includes(currentLevel)) {
            currentLevel++;
            loadLevel(currentLevel);
        }
    }

    // Camera scrolling logic
    const targetCamX = player.x - canvas.width / 2 + player.width / 2;
    cameraX = Math.max(0, Math.min(levelWidth - canvas.width, targetCamX));

    // Screen Shake apply
    let offsetX = 0;
    let offsetY = 0;
    if (shakeTimer > 0) {
        offsetX = (Math.random() - 0.5) * 8;
        offsetY = (Math.random() - 0.5) * 8;
        shakeTimer--;
    }

    // 2. Draw everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw background sketchbook clouds/sun (hand-drawn style)
    drawBackgroundElements();

    // Draw static environment objects
    platforms.forEach(p => p.draw());
    ponds.forEach(p => p.draw());

    // Draw drop shadows first so they appear behind entities on the floor/platform/water surface
    pushableBoxes.forEach(box => drawDropShadow(box.x, box.y, box.w));
    collectibles.forEach(c => drawDropShadow(c.x, c.y, c.w));
    enemies.forEach(e => drawDropShadow(e.x, e.y, e.w));
    clones.forEach(c => drawDropShadow(c.x, c.y, c.width));
    if (boss) drawDropShadow(boss.x, boss.y, boss.w);
    if (player && player.hearts > 0) drawDropShadow(player.x, player.y, player.width);

    // Draw moving entities and items
    pushableBoxes.forEach(box => box.draw());
    collectibles.forEach(c => c.draw());
    enemies.forEach(e => e.draw());
    clones.forEach(c => c.draw());
    projectiles.forEach(p => p.draw());
    particles.forEach(p => p.draw());
    if (boss) boss.draw();

    // Draw flagpole for platforming levels
    const hasFlagpole = [4, 5, 7, 8, 10, 11, 13, 14];
    if (hasFlagpole.includes(currentLevel)) {
        drawFlagPole(levelWidth - 100, levelHeight - 160);
    }
    
    if (player && player.hearts > 0) {
        player.draw();
    }

    ctx.restore();

    // 3. Draw a gorgeous radial gradient paper overlay (simulating page curvature/ambient shading)
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width / 3,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.75
    );
    vignette.addColorStop(0, 'rgba(250, 246, 238, 0)');
    vignette.addColorStop(1, 'rgba(43, 43, 43, 0.12)'); // soft warm shading vignette
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw sketchy page borders around the canvas bounds to lock in the sketchbook clipping look
    ctx.strokeStyle = 'rgba(43, 43, 43, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.strokeStyle = 'rgba(43, 43, 43, 0.15)';
    ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);

    // Draw Screen-space UI (Poster Health Bar & Level Hint Banner)
    if (boss) {
        // Draw Boss health bar
        const barWidth = 240;
        const barHeight = 22;
        const barX = canvas.width / 2 - barWidth / 2;
        const barY = 25;

        // Draw white crayon-ish background
        ctx.fillStyle = '#faf6ee';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        drawSketchyRect(barX, barY, barWidth, barHeight, null, '#2b2b2b', 2.5);

        // Draw red health hearts
        const totalHearts = boss.type === 'nippin-king' ? 7 : (boss.type === 'blood-shark' ? 6 : 5);
        const heartWidth = barWidth / totalHearts;
        for (let i = 0; i < boss.hearts; i++) {
            ctx.fillStyle = '#ff6b6b';
            ctx.font = '16px Patrick Hand';
            ctx.fillText('❤️', barX + i * heartWidth + heartWidth / 2, barY + 16);
        }

        // Draw title
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '22px Gochi Hand';
        ctx.textAlign = 'center';
        const bossTitle = boss.type === 'nippin-king' ? 'NIPPIN KING' : (boss.type === 'blood-shark' ? 'BLOOD SHARK BOSS' : 'POSTER');
        ctx.fillText(bossTitle, canvas.width / 2, barY - 6);
    }

    if (bossIntroTimer > 0) {
        bossIntroTimer--;
        ctx.fillStyle = 'rgba(250, 246, 238, 0.9)';
        const bannerY = canvas.height / 2 - 35;
        ctx.fillRect(50, bannerY, canvas.width - 100, 70);
        drawSketchyRect(50, bannerY, canvas.width - 100, 70, null, '#ff6b6b', 3);

        ctx.fillStyle = '#2b2b2b';
        ctx.font = '22px Patrick Hand';
        ctx.textAlign = 'center';
        
        if (currentLevel === 3) {
            ctx.fillText('👑 BOSS BATTLE: NIPPIN KING!', canvas.width / 2, bannerY + 28);
            ctx.font = '18px Patrick Hand';
            ctx.fillStyle = '#ff922b';
            ctx.fillText('Defeat the purple Nippins, then stomp the king while he bounces!', canvas.width / 2, bannerY + 52);
        } else if (currentLevel === 4) {
            ctx.fillText('🦈 WORLD 2-1: THE GRAY POND!', canvas.width / 2, bannerY + 28);
            ctx.font = '18px Patrick Hand';
            ctx.fillStyle = '#ff922b';
            ctx.fillText('Press and hold UP to swim! Watch out for the wiggling shark fin!', canvas.width / 2, bannerY + 52);
        } else if (currentLevel === 5) {
            ctx.fillText('💧 WORLD 2-2: TWIN PONDS!', canvas.width / 2, bannerY + 28);
            ctx.font = '18px Patrick Hand';
            ctx.fillStyle = '#ff922b';
            ctx.fillText('Slide the pushable cubes and clear the path to the flag!', canvas.width / 2, bannerY + 52);
        } else if (currentLevel === 6) {
            ctx.fillText('🦈 WORLD 2-3 FINAL BOSS: BLOOD SHARK!', canvas.width / 2, bannerY + 28);
            ctx.font = '18px Patrick Hand';
            ctx.fillStyle = '#ff922b';
            ctx.fillText('Push the cube or spawn boxes to deflect his lasers and stun him!', canvas.width / 2, bannerY + 52);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Sketchy flagpole drawer
function drawFlagPole(x, y) {
    ctx.save();
    ctx.translate(-cameraX, 0);

    const seed = Math.floor(x * 13 + y * 19);

    // Draw flagpole (thick gray pencil line)
    drawSketchyLine(x, y, x, y + 120, '#495057', 4, seed);

    // Draw flag knob on top
    drawSketchyCircle(x, y - 2, 5, '#ffd43b', '#2b2b2b', seed + 1);

    // Draw sketchy green triangular flag
    ctx.fillStyle = '#51cf66';
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    function getWiggle(offset) {
        const val = Math.sin(seed * 9.8 + offset * 14.2 + currentSketchFrame * 8.1) * 43758.5453;
        return (val - Math.floor(val)) - 0.5;
    }

    const p1x = x;
    const p1y = y + 10 + getWiggle(1) * 2;
    const p2x = x + 35 + getWiggle(2) * 3;
    const p2y = y + 25 + getWiggle(3) * 3;
    const p3x = x;
    const p3y = y + 40 + getWiggle(4) * 2;

    fillCrayonRect(x, y + 10, 35, 30, '#51cf66', seed + 2);

    drawSketchyLine(p1x, p1y, p2x, p2y, '#2b2b2b', 2.5, seed + 3);
    drawSketchyLine(p2x, p2y, p3x, p3y, '#2b2b2b', 2.5, seed + 4);
    drawSketchyLine(p3x, p3y, p1x, p1y, '#2b2b2b', 2.5, seed + 5);

    ctx.restore();
}

function drawBackgroundElements() {
    const worldNum = Math.ceil(currentLevel / 3);

    // DRAW BASE PAPER
    if (currentLevel === 3) {
        // World 1-3 is the Nippin King's dungeon, not another open field.
        ctx.fillStyle = '#27233a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(190, 155, 230, 0.2)';
        ctx.lineWidth = 2;
        for (let row = 0; row < 7; row++) {
            const y = 42 + row * 42;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            const offset = row % 2 ? 34 : 0;
            for (let x = offset; x < canvas.width; x += 68) {
                ctx.beginPath();
                ctx.moveTo(x, y - 42);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
        ctx.fillStyle = 'rgba(155, 93, 229, 0.18)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 210, 105, Math.PI, 0);
        ctx.lineTo(canvas.width / 2 + 105, 320);
        ctx.lineTo(canvas.width / 2 - 105, 320);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 212, 59, 0.55)';
        ctx.lineWidth = 3;
        ctx.stroke();
    } else if (worldNum === 3) {
        // Space Graph Paper Grid
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.12)';
        ctx.lineWidth = 1.0;
        // Horizontal lines
        for (let y = 24; y < canvas.height; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        // Vertical lines
        for (let x = 24; x < canvas.width; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    } else if (worldNum === 4) {
        // Volcano Red grid
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.12)';
        ctx.lineWidth = 1.0;
        // Horizontal lines
        for (let y = 28; y < canvas.height; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        // Vertical lines
        for (let x = 28; x < canvas.width; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    } else if (worldNum === 5) {
        // Ink/Creator: plain paper with ruler ticks at the margins
        ctx.strokeStyle = 'rgba(43, 43, 43, 0.15)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(canvas.width, 14);
        ctx.moveTo(0, canvas.height - 14);
        ctx.lineTo(canvas.width, canvas.height - 14);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(43, 43, 43, 0.35)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        for (let tx = 0; tx < canvas.width; tx += 20) {
            // top ticks
            ctx.beginPath();
            ctx.moveTo(tx, 14);
            ctx.lineTo(tx, tx % 100 === 0 ? 4 : 9);
            ctx.stroke();
            if (tx % 100 === 0) {
                ctx.fillText(tx + Math.floor(cameraX), tx, 22);
            }
            // bottom ticks
            ctx.beginPath();
            ctx.moveTo(tx, canvas.height - 14);
            ctx.lineTo(tx, tx % 100 === 0 ? canvas.height - 4 : canvas.height - 9);
            ctx.stroke();
        }
    } else if (worldNum === 6) {
        // Rainbow Notebook lines!
        const colors = ['rgba(255, 107, 107, 0.22)', 'rgba(255, 146, 43, 0.22)', 'rgba(255, 212, 59, 0.22)', 'rgba(81, 207, 102, 0.22)', 'rgba(77, 171, 247, 0.22)', 'rgba(204, 93, 232, 0.22)'];
        let lineIdx = 0;
        for (let y = 30; y < canvas.height; y += 24) {
            ctx.strokeStyle = colors[lineIdx % colors.length];
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            lineIdx++;
        }
        // Red vertical margin line
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.35)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(70, 0);
        ctx.lineTo(70, canvas.height);
        ctx.stroke();
    } else {
        // Worlds 1 & 2 Lined Notebook Paper
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.15)'; // soft blue lines
        ctx.lineWidth = 1.2;
        for (let y = 30; y < canvas.height; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        // Red vertical margin line
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.22)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(70, 0);
        ctx.lineTo(70, canvas.height);
        ctx.stroke();
    }

    // DRAW THEMED ASSETS
    if (currentLevel === 3) {
        // Dungeon torches behind the arena.
        ctx.save();
        ctx.translate(-cameraX * 0.05, 0);
        for (const torchX of [160, 820]) {
            ctx.strokeStyle = '#2b2b2b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(torchX, 280);
            ctx.lineTo(torchX, 220);
            ctx.stroke();
            drawWildHair(torchX, 205 + Math.sin(Date.now() / 150) * 3, 18, '#ffd43b', torchX);
        }
        ctx.restore();
    } else if (worldNum === 3) {
        // Space Theme Details
        // Constellations in the sky
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(120 - cameraX * 0.05, 50);
        ctx.lineTo(200 - cameraX * 0.05, 110);
        ctx.lineTo(340 - cameraX * 0.05, 80);
        ctx.moveTo(550 - cameraX * 0.05, 40);
        ctx.lineTo(620 - cameraX * 0.05, 100);
        ctx.lineTo(800 - cameraX * 0.05, 90);
        ctx.stroke();

        // Stars
        ctx.save();
        ctx.translate(-cameraX * 0.05, 0);
        ctx.fillStyle = 'rgba(255, 212, 59, 0.55)';
        ctx.font = '16px Gochi Hand';
        const stars = [
            [120, 50], [200, 110], [340, 80], [550, 40], [620, 100], 
            [800, 90], [1050, 60], [1300, 75], [1550, 50]
        ];
        // add wiggling offset
        const wAngle = Date.now() / 200;
        stars.forEach((st, idx) => {
            const wx = st[0] + Math.sin(wAngle + idx) * 2;
            const wy = st[1] + Math.cos(wAngle + idx) * 2;
            ctx.fillText('★', wx, wy);
        });
        ctx.restore();

        // Saturn
        const saturnX = 190 - cameraX * 0.12;
        const saturnY = 90;
        ctx.save();
        ctx.translate(saturnX, saturnY);
        drawSketchyCircle(0, 0, 18, '#ffd8a8', '#2b2b2b', 1.8, 99);
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, 36, 6, -Math.PI / 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Crescent Moon
        const moonX = canvas.width - 90 + cameraX * 0.08;
        const moonY = 80;
        ctx.save();
        ctx.translate(moonX, moonY);
        ctx.fillStyle = '#ffd43b';
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, Math.PI / 2, false);
        ctx.quadraticCurveTo(-12, 0, 0, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

    } else if (worldNum === 4) {
        // Volcano Theme Details
        // Draw outline of smoking volcanoes in the background
        ctx.save();
        ctx.translate(-cameraX * 0.12, 0);
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)';
        ctx.lineWidth = 2.5;
        const drawVolcano = (x, w, h) => {
            ctx.beginPath();
            ctx.moveTo(x - w/2, levelHeight - 40);
            ctx.lineTo(x - w/6, levelHeight - 40 - h);
            ctx.lineTo(x + w/6, levelHeight - 40 - h);
            ctx.lineTo(x + w/2, levelHeight - 40);
            ctx.stroke();
            
            // Smoke lines rising
            ctx.strokeStyle = 'rgba(255, 146, 43, 0.28)';
            ctx.lineWidth = 1.5;
            for (let s = 0; s < 3; s++) {
                const sx = x + (s - 1) * 8 + Math.sin(Date.now() / 250 + s) * 2;
                const sy = levelHeight - 45 - h;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(sx - 10, sy - 20, sx + 10, sy - 40, sx, sy - 60);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)';
            ctx.lineWidth = 2.5;
        };
        drawVolcano(250, 180, 110);
        drawVolcano(700, 240, 150);
        drawVolcano(1250, 200, 125);
        ctx.restore();

        // Ash/Lava clouds
        ctx.save();
        ctx.fillStyle = 'rgba(255, 146, 43, 0.15)';
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.35)';
        ctx.lineWidth = 1.5;
        const drawAshCloud = (cx, cy, r) => {
            const sx = cx - cameraX * 0.2;
            ctx.beginPath();
            ctx.arc(sx, cy, r, 0, Math.PI*2);
            ctx.arc(sx + r*0.8, cy - r*0.4, r*1.1, 0, Math.PI*2);
            ctx.arc(sx + r*1.6, cy, r, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        };
        drawAshCloud(150, 65, 16);
        drawAshCloud(620, 80, 20);
        drawAshCloud(1100, 70, 18);
        ctx.restore();

    } else if (worldNum === 5) {
        // Ink/Creator Theme Details
        // Ink splatters
        ctx.save();
        ctx.translate(-cameraX * 0.15, 0);
        const drawInkSplat = (x, y, r) => {
            ctx.fillStyle = 'rgba(43, 43, 43, 0.08)'; // grey transparent ink blot
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                const bx = x + Math.cos(a) * r * (1 + Math.random() * 0.5);
                const by = y + Math.sin(a) * r * (1 + Math.random() * 0.5);
                ctx.lineTo(bx, by);
                if (Math.random() < 0.25) {
                    ctx.arc(bx + Math.cos(a)*12, by + Math.sin(a)*12, r * 0.2, 0, Math.PI*2);
                }
            }
            ctx.closePath();
            ctx.fill();
        };
        drawInkSplat(300, 110, 22);
        drawInkSplat(650, 85, 18);
        drawInkSplat(1000, 120, 28);
        ctx.restore();

        // Creator Doodles (Pencil, lightbulb, scissors, coffee cup)
        ctx.save();
        const dx1 = 150 - cameraX * 0.1;
        const dx2 = 450 - cameraX * 0.1;
        const dx3 = 850 - cameraX * 0.1;
        
        // 1. Lightbulb at dx1, 75
        ctx.save();
        ctx.translate(dx1, 75);
        ctx.strokeStyle = 'rgba(43, 43, 43, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0.7 * Math.PI, 2.3 * Math.PI);
        ctx.lineTo(5, 14);
        ctx.lineTo(-5, 14);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(-2, -6); ctx.lineTo(2, -6); ctx.lineTo(4, 0);
        ctx.stroke();
        drawSketchyLine(-5, 16, 5, 16, 'rgba(43, 43, 43, 0.22)', 1.2, 1);
        drawSketchyLine(-3, 19, 3, 19, 'rgba(43, 43, 43, 0.22)', 1.2, 2);
        ctx.restore();

        // 2. Scissors at dx2, 110
        ctx.save();
        ctx.translate(dx2, 110);
        ctx.strokeStyle = 'rgba(43, 43, 43, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-15, -4); ctx.lineTo(10, 4);
        ctx.moveTo(-15, 4); ctx.lineTo(10, -4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(14, 6, 5, 0, Math.PI*2);
        ctx.arc(14, -6, 5, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();

        // 3. Coffee Cup at dx3, 85
        ctx.save();
        ctx.translate(dx3, 85);
        ctx.strokeStyle = 'rgba(43, 43, 43, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, -8); ctx.lineTo(-8, 10);
        ctx.quadraticCurveTo(0, 12, 8, 10); ctx.lineTo(10, -8);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(10, 0, 5, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-3, -12); ctx.bezierCurveTo(-5, -16, -1, -19, -3, -23);
        ctx.moveTo(3, -12); ctx.bezierCurveTo(1, -16, 5, -19, 3, -23);
        ctx.stroke();
        ctx.restore();
        ctx.restore();

    } else if (worldNum === 6) {
        // World 6 Theme Details (Rainbow Celebration Doodles)
        ctx.save();
        ctx.translate(-cameraX * 0.1, 0);

        // 1. Rainbow arcs in the sky!
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.15)';
        ctx.lineWidth = 4.0;
        ctx.beginPath();
        ctx.arc(300, 180, 80, Math.PI, 2 * Math.PI);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 212, 59, 0.15)';
        ctx.beginPath();
        ctx.arc(300, 180, 76, Math.PI, 2 * Math.PI);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.15)';
        ctx.beginPath();
        ctx.arc(300, 180, 72, Math.PI, 2 * Math.PI);
        ctx.stroke();

        // 2. Large Gold Crown/Trophy doodle in the background
        const trophyX = 650;
        const trophyY = 85;
        ctx.save();
        ctx.translate(trophyX, trophyY);
        ctx.strokeStyle = 'rgba(255, 212, 59, 0.35)'; // gold
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, -12);
        ctx.lineTo(12, 8); ctx.quadraticCurveTo(0, 15, -12, 8);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, 15); ctx.lineTo(-4, 22);
        ctx.moveTo(-10, 22); ctx.lineTo(10, 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-14, -2, 5, Math.PI/2, 3*Math.PI/2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(14, -2, 5, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        ctx.restore();

        // 3. Floating party balloons doodles in the background
        const drawBalloonDoodle = (bx, by, color) => {
            ctx.save();
            ctx.translate(bx, by);
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(43, 43, 43, 0.15)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(0, 16);
            ctx.quadraticCurveTo(5, 26, -2, 40);
            ctx.stroke();
            ctx.restore();
        };
        drawBalloonDoodle(100, 90, 'rgba(255, 107, 107, 0.15)'); // Red
        drawBalloonDoodle(480, 110, 'rgba(77, 171, 247, 0.15)'); // Blue
        drawBalloonDoodle(900, 75, 'rgba(255, 212, 59, 0.15)'); // Yellow
        drawBalloonDoodle(1150, 100, 'rgba(81, 207, 102, 0.15)'); // Green

        ctx.restore();

    } else {
        // Worlds 1 & 2 Parallax Hills, Sun & Clouds
        ctx.save();
        ctx.translate(-cameraX * 0.12, 0); // moves slower for depth
        ctx.strokeStyle = 'rgba(180, 185, 195, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, levelHeight - 40);
        let px = 0;
        while (px < levelWidth + 400) {
            ctx.quadraticCurveTo(px + 160, levelHeight - 110, px + 320, levelHeight - 40);
            px += 320;
        }
        ctx.stroke();
        ctx.restore();

        // Drawn sun with rays
        const sunX = canvas.width - 80 + cameraX * 0.1;
        const sunY = 70;
        drawSketchyCircle(sunX, sunY, 24, '#ffd43b', '#2b2b2b');
        
        ctx.strokeStyle = 'rgba(255, 212, 59, 0.7)';
        ctx.lineWidth = 2.0;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            const startX = sunX + 28 * Math.cos(a);
            const startY = sunY + 28 * Math.sin(a);
            const endX = sunX + 42 * Math.cos(a);
            const endY = sunY + 42 * Math.sin(a);
            drawSketchyLine(startX, startY, endX, endY, 'rgba(255, 212, 59, 0.75)', 2, Math.floor(a * 100));
        }
        
        // Cloud 1
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const cx1 = 200 - cameraX * 0.2;
        const cy1 = 80;
        ctx.arc(cx1, cy1, 20, 0, Math.PI*2);
        ctx.arc(cx1 + 18, cy1 - 10, 22, 0, Math.PI*2);
        ctx.arc(cx1 + 36, cy1, 20, 0, Math.PI*2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(43, 43, 43, 0.25)';
        ctx.lineWidth = 1.0;
        for (let hx = cx1 - 10; hx < cx1 + 46; hx += 6) {
            ctx.beginPath();
            ctx.moveTo(hx, cy1 + 15);
            ctx.lineTo(hx - 4, cy1 + 22);
            ctx.stroke();
        }

        // Cloud 2
        const cx2 = 600 - cameraX * 0.2;
        const cy2 = 120;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx2, cy2, 15, 0, Math.PI*2);
        ctx.arc(cx2 + 15, cy2 - 8, 18, 0, Math.PI*2);
        ctx.arc(cx2 + 30, cy2, 15, 0, Math.PI*2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2b2b2b';
        ctx.stroke();

        for (let hx = cx2 - 8; hx < cx2 + 38; hx += 5) {
            ctx.beginPath();
            ctx.moveTo(hx, cy2 + 12);
            ctx.lineTo(hx - 3, cy2 + 18);
            ctx.stroke();
        }

        // Stars
        ctx.save();
        ctx.translate(-cameraX * 0.05, 0); // slow scroll
        ctx.fillStyle = 'rgba(255, 212, 59, 0.4)';
        ctx.font = '16px Gochi Hand';
        ctx.fillText('★', 120, 50);
        ctx.fillText('★', 340, 80);
        ctx.fillText('★', 550, 40);
        ctx.fillText('★', 800, 90);
        ctx.fillText('★', 1050, 60);
        ctx.fillText('★', 1300, 75);
        ctx.fillText('★', 1550, 50);
        ctx.restore();
    }

    // Draw target marker / Goal Flag at end of levels 1 and 2
    if (currentLevel < 3) {
        ctx.save();
        ctx.translate(-cameraX, 0);
        // Goal Pole
        drawSketchyLine(levelWidth - 60, levelHeight - 200, levelWidth - 60, levelHeight - 40, '#2b2b2b', 4);
        // Flag
        drawSketchyRect(levelWidth - 60, levelHeight - 200, 40, 30, '#ff6b6b', '#2b2b2b');
        ctx.restore();
    }

    // 4. Handwritten notebook annotations / Interactive Signposts
    ctx.save();
    ctx.translate(-cameraX, 0);
    
    if (currentLevel === 1) {
        drawSketchySignpost(180, levelHeight - 80, 'RUN! ➔', 180);
        drawSketchySignpost(680, levelHeight - 80, 'JUMP!', 680);
        drawSketchySignpost(1050, levelHeight - 80, 'SECRET? 🕳️', 1050);
    } else if (currentLevel === 2) {
        drawSketchySignpost(520, levelHeight - 140, 'LOOK UP! 🛩️', 520);
        drawSketchySignpost(1140, levelHeight - 120, 'DIG HERE! ⛏️', 1140);
    } else if (currentLevel === 4) {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.7)'; // red marker
        ctx.font = '22px Gochi Hand';
        ctx.fillText('DANGER ZONE! 🦈', 500, levelHeight - 150);
        // Draw sketchy red arrow pointing down to the pond
        drawSketchyLine(530, levelHeight - 130, 500, levelHeight - 110, 'rgba(255, 107, 107, 0.7)', 2, 456);
        drawSketchyLine(500, levelHeight - 110, 510, levelHeight - 125, 'rgba(255, 107, 107, 0.7)', 2, 457);
        drawSketchyLine(500, levelHeight - 110, 515, levelHeight - 115, 'rgba(255, 107, 107, 0.7)', 2, 458);
    } else if (currentLevel === 5) {
        drawSketchySignpost(180, levelHeight - 80, 'PUSH! ➔', 180);
        ctx.fillStyle = 'rgba(77, 171, 247, 0.7)'; // blue marker
        ctx.font = '22px Gochi Hand';
        ctx.fillText('DOUBLE POND!', 760, levelHeight - 160);
    } else if (currentLevel === 6) {
        drawSketchySignpost(150, levelHeight - 80, 'DEFLECT! ⚡', 150);
        ctx.fillStyle = 'rgba(255, 107, 107, 0.7)'; // red marker
        ctx.font = '22px Gochi Hand';
        ctx.fillText('BOSS ARENA 🥊', 460, 60);
    } else if (currentLevel === 7) {
        drawSketchySignpost(300, levelHeight - 80, 'LOW GRAVITY! 🌌', 300);
    } else if (currentLevel === 8) {
        drawSketchySignpost(320, levelHeight - 80, 'PORTAL! 🌀', 320);
        // Draw Entry and Exit Portals
        const portalSeed = Math.floor(Date.now() / 150);
        drawSketchyCircle(380, levelHeight - 90, 24, '#4dabf7', '#2b2b2b', 2.0, portalSeed);
        ctx.fillStyle = 'rgba(77, 171, 247, 0.2)';
        ctx.beginPath();
        ctx.arc(380, levelHeight - 90, 24, 0, Math.PI * 2);
        ctx.fill();
        
        drawSketchyCircle(1050, levelHeight - 90, 24, '#4dabf7', '#2b2b2b', 2.0, portalSeed + 5);
        ctx.fillStyle = 'rgba(77, 171, 247, 0.2)';
        ctx.beginPath();
        ctx.arc(1050, levelHeight - 90, 24, 0, Math.PI * 2);
        ctx.fill();
    } else if (currentLevel === 9) {
        ctx.fillStyle = 'rgba(255, 212, 59, 0.75)';
        ctx.font = '22px Gochi Hand';
        ctx.fillText('DRAGON EMPEROR ARENA 🐉', 380, 50);
    } else if (currentLevel === 10) {
        drawSketchySignpost(320, levelHeight - 80, 'COOL SHIELD! 🛡️', 320);
        if (!player || !player.lavaShieldTimer || player.lavaShieldTimer <= 0) {
            // Draw wobbly sketchy shield bubble pickup
            const bob = Math.sin(Date.now() / 200) * 4;
            const shieldSeed = Math.floor(Date.now() / 150);
            drawSketchyCircle(320, levelHeight - 110 + bob, 12, '#4dabf7', '#2b2b2b', 2.0, shieldSeed);
            ctx.fillStyle = 'rgba(77, 171, 247, 0.35)';
            ctx.beginPath();
            ctx.arc(320, levelHeight - 110 + bob, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (currentLevel === 11) {
        drawSketchySignpost(700, levelHeight - 80, 'EXPLODE! 💣', 700);
        if (player && !player.bombExploded) {
            // Draw sketchy black bomb circle at fuse x = 750
            const bombSeed = Math.floor(Date.now() / 120);
            drawSketchyCircle(750, levelHeight - 55, 10, '#2b2b2b', '#2b2b2b', 2.0, bombSeed);
            ctx.fillStyle = '#2b2b2b';
            ctx.beginPath();
            ctx.arc(750, levelHeight - 55, 10, 0, Math.PI * 2);
            ctx.fill();
            drawWildHair(750, levelHeight - 65, 8, '#ff922b', bombSeed + 1);
        }
    } else if (currentLevel === 12) {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.75)';
        ctx.font = '22px Gochi Hand';
        ctx.fillText('STAR-SHELL EMPRESS ARENA 🐞', 360, 50);
    } else if (currentLevel === 13) {
        drawSketchySignpost(400, levelHeight - 80, 'FREEZE! ❄️', 400);
    } else if (currentLevel === 14) {
        drawSketchySignpost(400, levelHeight - 80, 'CLONE! 👥', 400);
    } else if (currentLevel === 15) {
        ctx.fillStyle = 'rgba(177, 151, 252, 0.8)';
        ctx.font = '24px Gochi Hand';
        ctx.fillText('FINAL BOSS: DUNGEON EMPEROR 👑', 360, 50);
    }
    ctx.restore();
}

// Drop shadows for depth/visual polish
function drawDropShadow(x, y, w) {
    // Find ground below
    let groundY = levelHeight - 40;
    
    // Check platforms
    platforms.forEach(p => {
        if (x + w > p.x && x < p.x + p.w) {
            if (p.y >= y && p.y < groundY) {
                groundY = p.y;
            }
        }
    });
    
    // Check ponds (shadow on water surface)
    ponds.forEach(pond => {
        if (x + w > pond.x && x < pond.x + pond.w) {
            if (pond.y >= y && pond.y < groundY) {
                groundY = pond.y;
            }
        }
    });
    
    // Draw shadow oval
    const dist = groundY - y;
    if (dist >= 0 && dist < 220) {
        const shadowW = Math.max(8, w * (1 - dist / 220));
        const alpha = Math.max(0, 0.16 * (1 - dist / 220));
        
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.fillStyle = `rgba(43, 43, 43, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(x + w/2, groundY, shadowW/2, 3, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

// Helpers for block searching (Tuskanty digging check)
function getBlockAt(x, y) {
    return platforms.find(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

// Event Listeners for Character select
const cards = document.querySelectorAll('.character-card');
cards.forEach(card => {
    card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        const selectedHero = card.dataset.hero;
        startGameBtn.disabled = false;
        startGameBtn.textContent = `Start as ${card.querySelector('h3').textContent}!`;
        startGameBtn.style.backgroundColor = 'var(--crayon-green)';
        startGameBtn.style.color = '#fff';
    });
});

// Level select selector handler
let selectedStartLevel = 3; // default starting level
const levelBtns = document.querySelectorAll('.level-select-btn');
levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedStartLevel = parseInt(btn.dataset.level, 10);
    });
});

// Gameplay HUD Level select listener
const hudLevelSelect = document.getElementById('hud-level-select');
if (hudLevelSelect) {
    hudLevelSelect.addEventListener('change', (e) => {
        const targetLevel = parseInt(e.target.value, 10);
        loadLevel(targetLevel);
        hudLevelSelect.blur(); // Remove focus so arrow keys don't trigger select options
    });
}

startGameBtn.addEventListener('click', () => {
    const selectedHeroCard = document.querySelector('.character-card.selected');
    if (selectedHeroCard) {
        startGame(selectedHeroCard.dataset.hero);
    }
    startGameBtn.blur();
});

backToMenuBtn.addEventListener('click', () => {
    backToMenu();
    backToMenuBtn.blur();
});

restartBtn.addEventListener('click', () => {
    startGame(activeHero);
    restartBtn.blur();
});

// Keyboard controls handler
window.addEventListener('keydown', (e) => {
    // Prevent default scroll behavior for game control keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D', ' '].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
});

window.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D', ' '].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
});

// Notebook Tabs Navigation Handler
function switchTab(tab) {
    if (tab === 'play') {
        tabPlay.classList.add('active');
        tabGuide.classList.remove('active');
        charSelectScreen.classList.add('active');
        monsterGuideScreen.classList.remove('active');
    } else if (tab === 'guide') {
        tabPlay.classList.remove('active');
        tabGuide.classList.add('active');
        charSelectScreen.classList.remove('active');
        monsterGuideScreen.classList.add('active');
    }
}

tabPlay.addEventListener('click', () => {
    switchTab('play');
    tabPlay.blur();
});

tabGuide.addEventListener('click', () => {
    switchTab('guide');
    tabGuide.blur();
});
