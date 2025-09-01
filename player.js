class Player {
    constructor(x, y) {
        const { PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPAWN_Y_OFFSET } = window.constants;
        // --- SPAWN HIGHER: Move player up by PLAYER_SPAWN_Y_OFFSET ---
        // The default y is GROUND_Y - PLAYER_HEIGHT (so feet at platform top).
        // We want to spawn 75px higher than that.
        this.position = { x, y: y - (PLAYER_SPAWN_Y_OFFSET || 0) };
        this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
        this.velocity = { x: 0, y: 0 };
        this.grounded = false;
        this.lives = 3;
        this.physics = true;
        this.invulnTimer = 0;
        this.facing = 1;
        // Animation state
        this.animTimer = 0;
        this.animFrame = 0;
        this.animState = 'idle'; // 'walk', 'jump', 'idle', 'attack'
        this.lastMove = 0;
        this.lastAnimState = undefined; // Ensure this is initialized

        // Track if player is actively holding left/right for animation
        this.isMoving = false;

        // --- Attack state ---
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackFrame = 0;
        this.ATTACK_DURATION = 0.45; // seconds, matches anim length
        this.ATTACK_ANIM_FPS = 7; // SLOWED DOWN: was 13, now 7 frames/sec for attack animation

        // Track which enemies have been hit during the current attack
        this._alreadyHitEnemies = [];

        // --- Projectiles ---
        this.projectiles = [];
        this._projectileFiredThisAttack = false; // Prevent multiple projectiles per attack

        // --- Hitpoints ---
        this.maxHitpoints = 100;
        this.hitpoints = this.maxHitpoints;

        // --- Track attack direction for projectiles ---
        this._attackProjectileDir = 1; // 1 = right, -1 = left, 0 = up
    }
    update(input, platforms, dt, enemies) {
        const { PLAYER_MOVE_SPEED, PLAYER_JUMP_VELOCITY, GAME_WIDTH } = window.constants;

        // --- Handle attack input ---
        // Start attack if J pressed and not already attacking
        if (!this.isAttacking && (input.isDown('KeyJ') || input.isDown('Keyj'))) {
            // Determine projectile direction: if W is held, fire up, else normal facing
            if (input.isDown('KeyW')) {
                this._attackProjectileDir = 0; // up
            } else {
                this._attackProjectileDir = this.facing; // left/right
            }
            this.isAttacking = true;
            this.attackTimer = 0;
            this.attackFrame = 0;
            this.animState = 'attack';
            this._alreadyHitEnemies = []; // Reset hit enemies for this attack
            this._projectileFiredThisAttack = false; // Reset projectile fire flag
        }

        // If attacking, override movement and animation
        if (this.isAttacking) {
            this.attackTimer += dt;
            // Advance attack animation frames
            let attackFrames = window.AssetLoader.getPlayerAttackFrames(this.facing);
            if (this.attackTimer > (this.attackFrame + 1) / this.ATTACK_ANIM_FPS && this.attackFrame < attackFrames.length - 1) {
                this.attackFrame++;
            }
            // --- Fire projectile at start of attack ---
            if (!this._projectileFiredThisAttack && this.attackFrame === 0 && this.attackTimer < 0.15) {
                this._fireProjectile();
                this._projectileFiredThisAttack = true;
            }
            // End attack after duration or when animation finishes
            if (this.attackTimer >= this.ATTACK_DURATION || this.attackFrame >= attackFrames.length - 1) {
                this.isAttacking = false;
                // After attack, go back to correct state
                if (!this.grounded) {
                    this.animState = 'jump';
                } else if (Math.abs(this.velocity.x) > 0.1 && this.isMoving) {
                    this.animState = 'walk';
                } else {
                    this.animState = 'idle';
                }
                this.animFrame = 0;
                this.animTimer = 0;
            }
        }

        // Only allow movement/jump if not attacking
        let move = 0;
        if (!this.isAttacking) {
            if (input.isDown('ArrowLeft') || input.isDown('KeyA')) move -= 1;
            if (input.isDown('ArrowRight') || input.isDown('KeyD')) move += 1;
            this.velocity.x = move * PLAYER_MOVE_SPEED;
            if (move !== 0) this.facing = move;
        } else {
            // During attack, freeze horizontal movement
            this.velocity.x = 0;
        }

        // Track if player is actively pressing left/right for walk animation
        this.isMoving = (input.isDown('ArrowLeft') || input.isDown('KeyA') || input.isDown('ArrowRight') || input.isDown('KeyD'));

        // --- Prevent walking off screen except during scene transition ---
        // We need to clamp the player's position.x so they cannot walk off the left or right edge,
        // unless the game is currently waiting for a scene advance (handled in game.js via waitingForSceneAdvance).
        // We'll check for this flag on the global game object if available.
        let waitingForSceneAdvance = false;
        if (window.game && typeof window.game.waitingForSceneAdvance === "boolean") {
            waitingForSceneAdvance = window.game.waitingForSceneAdvance;
        }
        // Only clamp if NOT waiting for scene advance
        if (!waitingForSceneAdvance) {
            // Prevent moving off left
            if (this.position.x < 0) {
                this.position.x = 0;
                if (this.velocity.x < 0) this.velocity.x = 0;
            }
            // Prevent moving off right
            if (this.position.x + this.size.w > GAME_WIDTH) {
                this.position.x = GAME_WIDTH - this.size.w;
                if (this.velocity.x > 0) this.velocity.x = 0;
            }
        }
        // (If waitingForSceneAdvance, allow walking off right edge for scene transition.)

        // Jump
        // MODIFIED: Only Space and ArrowUp trigger jump, NOT W
        if (!this.isAttacking && (input.isDown('Space') || input.isDown('ArrowUp')) && this.grounded) {
            this.velocity.y = PLAYER_JUMP_VELOCITY;
            this.grounded = false;
            window.AudioManager.jump();
        }

        // Update physics
        window.PhysicsEngine.updateEntityPhysics(this, platforms);

        // Invulnerable time after hit
        if (this.invulnTimer > 0) {
            this.invulnTimer -= dt;
            if (this.invulnTimer < 0) this.invulnTimer = 0;
        }

        // Animation state (only update if not attacking)
        if (!this.isAttacking) {
            if (!this.grounded) {
                this.animState = 'jump';
            } else if (Math.abs(this.velocity.x) > 0.1 && this.isMoving) {
                this.animState = 'walk';
            } else {
                this.animState = 'idle';
            }
        } else {
            this.animState = 'attack';
        }

        // Reset frame if state changed (except for attack, which is handled separately)
        if (this.lastAnimState !== this.animState && this.animState !== 'attack') {
            this.animFrame = 0;
            this.animTimer = 0;
        }

        // Animation frame update (not for attack)
        if (!this.isAttacking) {
            let animFps = 10;
            if (this.animState === 'walk') animFps = 11;
            if (this.animState === 'jump') animFps = 7;
            this.animTimer += dt;
            let frames = this._getCurrentAnimFrames();
            if (this.animState === 'walk') {
                // Always advance through all walk frames when walking
                if (this.animTimer > 1 / animFps) {
                    this.animTimer = 0;
                    this.animFrame = (this.animFrame + 1) % frames.length;
                }
            } else {
                // For other states, only advance if there is more than one frame
                if (this.animTimer > 1 / animFps && frames.length > 1) {
                    this.animTimer = 0;
                    this.animFrame = (this.animFrame + 1) % frames.length;
                }
            }
        }
        this.lastAnimState = this.animState;

        // --- ATTACK COLLISION & DAMAGE ---
        if (this.isAttacking && Array.isArray(enemies)) {
            // Define attack hitbox (in front of player, larger than player)
            // We'll use a rectangle extending from the player's center in the facing direction
            const { PLAYER_WIDTH, PLAYER_HEIGHT } = window.constants;
            const scale = 1.6;
            const attackW = Math.round(PLAYER_WIDTH * scale * 0.75);
            const attackH = Math.round(PLAYER_HEIGHT * scale * 0.75);

            // FLIP: The hitbox should now be on the *opposite* side of facing
            let hitbox = {
                x: this.position.x + (this.facing === -1 ? this.size.w/2 : -attackW + this.size.w/2),
                y: this.position.y + this.size.h/2 - attackH/2,
                w: attackW,
                h: attackH
            };
            for (let enemy of enemies) {
                // Only hit each enemy once per attack
                if (this._alreadyHitEnemies.includes(enemy)) continue;
                // Use basic AABB collision
                if (window.CollisionSystem.rectsCollide(
                    hitbox,
                    { x: enemy.position.x, y: enemy.position.y, w: enemy.size.w, h: enemy.size.h }
                )) {
                    // Damage enemy (remove it)
                    if (typeof enemy._playerHit !== "function") {
                        // If enemy doesn't have a _playerHit method, just remove it (handled in game.js)
                        enemy._playerHit = function() {}; // dummy
                    }
                    // Knockback: apply velocity to enemy
                    if ('velocity' in enemy) {
                        // FLIP: Knockback should also be in the opposite direction
                        enemy.velocity.x = -this.facing * 9.5;
                        enemy.velocity.y = -7.5;
                    }
                    // Mark as hit so we don't hit again this attack
                    this._alreadyHitEnemies.push(enemy);
                    // Mark for removal (handled in game.js)
                    enemy._isDead = true;
                }
            }
        }

        // --- PROJECTILES UPDATE ---
        // Remove dead projectiles first
        this.projectiles = this.projectiles.filter(p => !p.dead);

        // Update all projectiles
        for (let proj of this.projectiles) {
            proj.update(dt, platforms, enemies);
        }
    }

    _fireProjectile() {
        // Fire a projectile in the direction the player is facing or up if W is held
        // Spawn from player's center, slightly ahead of player
        // --- FIX: Use this.size.w and this.size.h instead of PLAYER_WIDTH/HEIGHT ---
        const w = this.size.w;
        const h = this.size.h;
        let projX, projY, projDir;
        if (this._attackProjectileDir === 0) {
            // Fire up
            projX = this.position.x + w / 2;
            projY = this.position.y + h / 2 - h * 0.55;
            projDir = 0; // up
        } else {
            // Fire left/right
            projX = this.position.x + w / 2 + this.facing * (w * 0.55);
            projY = this.position.y + h / 2 - 8;
            projDir = this.facing;
        }
        this.projectiles.push(new PlayerProjectile(projX, projY, projDir));
    }

    _getCurrentAnimFrames() {
        if (this.animState === 'walk') {
            // Use ALL walk frames when walking
            return window.AssetLoader.getPlayerWalkFrames(this.facing);
        } else if (this.animState === 'jump') {
            return window.AssetLoader.getPlayerJumpFrames(this.facing);
        } else if (this.animState === 'attack') {
            // FLIP: Use attack frames for the *opposite* facing
            return window.AssetLoader.getPlayerAttackFrames(-this.facing);
        } else {
            // idle: use first walk frame only
            return window.AssetLoader.getPlayerWalkFrames(this.facing).slice(0,1);
        }
    }
    render(ctx) {
        // Player: use Coop sprite animation frames
        const { w, h } = this.size;
        ctx.save();
        // --- Apply vertical render offset so feet are always at platform top ---
        // Coinboy and DoomShroom render at (x + w/2, y + h/2)
        // Player should do the same, with no extra Y offset
        ctx.translate(this.position.x + w/2, this.position.y + h/2);

        // --- MIRROR ATTACK ANIMATION if facing LEFT (was RIGHT) ---
        // FLIP: Mirror for left-facing attack, not for right
        let doMirror = false;
        if (this.animState === 'attack' && this.isAttacking && this.facing === -1) {
            doMirror = true;
        }
        if (doMirror) {
            ctx.scale(-1, 1);
        }
        // Invulnerability flash
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer*12)%2 === 0) {
            ctx.globalAlpha = 0.35;
        }

        // Choose frame
        let frames = this._getCurrentAnimFrames();
        let frame;
        if (this.animState === 'attack' && this.isAttacking) {
            // Use attackFrame index during attack
            frame = frames[this.attackFrame % frames.length];
        } else {
            frame = frames[this.animFrame % frames.length];
        }
        if (frame instanceof window.HTMLImageElement || frame instanceof window.HTMLCanvasElement) {
            // --- SCALE PLAYER SPRITES TO 75% (ALL STATES) ---
            // Always draw at PLAYER_WIDTH/PLAYER_HEIGHT (already 75% of original)
            ctx.drawImage(
                frame,
                -w/2, -h/2,
                w, h
            );
        } else {
            // fallback: blue ellipse
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.ellipse(0, 0, w/2-7, h/2-6, 0, 0, 2*Math.PI);
            ctx.fill();
        }
        ctx.restore();

        // --- PROJECTILES RENDER ---
        for (let proj of this.projectiles) {
            proj.render(ctx);
        }

        // --- HEALTH BAR RENDER ---
        // (REMOVED: health bar above player. Now drawn at top of screen in renderer.js)
        // (No code here for health bar.)
    }
}

// --- PlayerProjectile class ---
class PlayerProjectile {
    constructor(x, y, dir) {
        this.position = { x, y };
        this.size = { w: 18, h: 12 };
        // SLOW DOWN PROJECTILE: reduce velocity.x from 13.5 to 6.5
        // If dir is 0, fire up
        if (dir === 0) {
            this.velocity = { x: 0, y: -6.5 };
        } else {
            this.velocity = { x: dir * 6.5, y: 0 };
        }
        this.dir = dir;
        this.lifetime = 1.3; // seconds
        this.dead = false;
        this._hitEnemies = [];
        // For spinning animation
        this._angle = 0;
    }

    update(dt, platforms, enemies) {
        if (this.dead) return;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.dead = true;
            return;
        }
        // Remove if off screen
        if (
            this.position.x < -80 ||
            this.position.x > window.constants.GAME_WIDTH + 80 ||
            this.position.y < -60 ||
            this.position.y > window.constants.GAME_HEIGHT + 60
        ) {
            this.dead = true;
            return;
        }
        // Platform collision (stop at ground)
        for (let pf of platforms) {
            if (
                this.position.x + this.size.w > pf.x &&
                this.position.x < pf.x + pf.w &&
                this.position.y + this.size.h > pf.y &&
                this.position.y < pf.y + pf.h
            ) {
                this.dead = true;
                return;
            }
        }
        // Enemy collision
        if (Array.isArray(enemies)) {
            for (let enemy of enemies) {
                if (enemy._isDead) continue;
                if (this._hitEnemies.includes(enemy)) continue;
                if (
                    window.CollisionSystem.rectsCollide(
                        { x: this.position.x, y: this.position.y, w: this.size.w, h: this.size.h },
                        { x: enemy.position.x, y: enemy.position.y, w: enemy.size.w, h: enemy.size.h }
                    )
                ) {
                    // Mark enemy as dead (same as melee)
                    if (typeof enemy._playerHit !== "function") {
                        enemy._playerHit = function() {};
                    }
                    if ('velocity' in enemy) {
                        // Knockback direction: for up, knock up; else left/right
                        if (this.dir === 0) {
                            enemy.velocity.x = 0;
                            enemy.velocity.y = -11;
                        } else {
                            enemy.velocity.x = this.dir * 9.5;
                            enemy.velocity.y = -7.5;
                        }
                    }
                    enemy._isDead = true;
                    this._hitEnemies.push(enemy);
                    this.dead = true;
                    break;
                }
            }
        }
        // Spin the triangle
        this._angle += dt * 10; // 10 radians/sec = ~1.6 rotations/sec
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        // Rotate for spinning effect
        ctx.rotate(this._angle);

        // Draw a red equilateral triangle, pointing in the direction of travel
        // Side length = 22, center at (0,0)
        const side = 22;
        const h = side * Math.sqrt(3) / 2; // height of equilateral triangle

        // Orient so that the triangle points in the direction of travel
        if (this.dir === -1) {
            ctx.scale(-1, 1);
        } else if (this.dir === 0) {
            ctx.rotate(-Math.PI/2);
        }

        ctx.beginPath();
        // Top vertex
        ctx.moveTo(0, -h/2);
        // Bottom right
        ctx.lineTo(side/2, h/2);
        // Bottom left
        ctx.lineTo(-side/2, h/2);
        ctx.closePath();

        // Red fill, white border, shadow
        ctx.fillStyle = "#e53935";
        ctx.shadowColor = "#ffb3b3";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();

        ctx.restore();
    }
}

window.Player = Player;