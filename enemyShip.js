class EnemyShip {
    constructor(x, y, platforms) {
        const C = window.constants;
        this.position = { x, y };
        this.size = { w: C.ENEMYSHIP_WIDTH, h: C.ENEMYSHIP_HEIGHT };
        this.velocity = { x: 0, y: 0 }; // Start stationary (will fly after spawn)
        this.physics = false; // Flying enemies do not use platform physics
        this.grounded = false;
        this.facing = 1;
        this.animTimer = 0;
        this.animFrame = 0;
        this.platforms = platforms;
        this._isDead = false;

        // --- SPAWN ANIMATION STATE ---
        this.spawnState = 'spawning'; // 'spawning' | 'done'
        this.spawnAnimTimer = 0;
        this.spawnAnimDuration = 0.7; // seconds for float-in
        // Determine spawn direction: float in from left or right
        const spawnFromLeft = (x < window.constants.GAME_WIDTH / 2);
        this.spawnFloatDir = spawnFromLeft ? 1 : -1;
        this.spawnStartX = spawnFromLeft ? -C.ENEMYSHIP_WIDTH - 24 : window.constants.GAME_WIDTH + 24;
        this.spawnEndX = x;
        this.spawnStartY = y - 180; // Start high above spawn y
        this.spawnEndY = y;
        // Start off-screen and above
        this.position.x = this.spawnStartX;
        this.position.y = this.spawnStartY;
        this.spawnAnimFrame = 0;

        // --- DIVE BOMB AI STATE ---
        this.state = 'idle'; // 'idle', 'diving', 'recovering'
        this.idleTimer = 0;
        this.nextDiveDelay = this._getNextDiveDelay();
        this.diveTarget = null;
        // --- SLOW DOWN DIVE AND RECOVER SPEEDS ---
        this.diveSpeed = 4.2; // was 9.5
        this.recoverSpeed = 1.3; // was 3.2
        this.idleHeight = this.spawnEndY - 160 - Math.random() * 40; // Hover high above ground
        this.maxDiveDistance = 330; // Max horizontal distance to start dive
        this.diveCooldownMin = 1.1;
        this.diveCooldownMax = 2.7;
    }

    _getNextDiveDelay() {
        return window.utils.randRange(this.diveCooldownMin, this.diveCooldownMax);
    }

    update(player, dt) {
        const C = window.constants;

        // --- SPAWN ANIMATION ---
        if (this.spawnState === 'spawning') {
            this.spawnAnimTimer += dt;
            const t = Math.min(this.spawnAnimTimer / this.spawnAnimDuration, 1);
            // Ease out cubic for smooth stop
            const easeT = 1 - Math.pow(1 - t, 3);
            this.position.x = this.spawnStartX + (this.spawnEndX - this.spawnStartX) * easeT;
            this.position.y = this.spawnStartY + (this.spawnEndY - this.spawnStartY) * easeT;
            // Animate ship frames during spawn
            const shipFrames = window.AssetLoader.getEnemyShipFrames();
            this.spawnAnimFrame = Math.floor(easeT * shipFrames.length * 2) % shipFrames.length;
            // Set facing according to float direction
            this.facing = this.spawnFloatDir;
            if (t >= 1) {
                this.spawnState = 'done';
                this.position.x = this.spawnEndX;
                this.position.y = this.idleHeight;
                this.animFrame = 0;
                this.animTimer = 0;
                this.state = 'idle';
                this.idleTimer = 0;
                this.nextDiveDelay = this._getNextDiveDelay();
            }
            return; // Don't update normal logic during spawn
        }

        // --- FLYING ENEMYSHIP AI: DIVE BOMB ATTACK ---
        // Always face the player horizontally
        if (player.position.x > this.position.x) {
            this.facing = 1;
        } else {
            this.facing = -1;
        }

        if (this.state === 'idle') {
            // Hover at idleHeight, slight up/down bob
            const bob = Math.sin(Date.now() / 420 + this.position.x * 0.03) * 10;
            this.position.y = this.idleHeight + bob;

            // Move horizontally to loosely track player, but don't go off screen
            const dx = player.position.x - this.position.x;
            if (Math.abs(dx) > 12) {
                // --- SLOW DOWN HORIZONTAL TRACKING ---
                this.position.x += Math.sign(dx) * Math.min(0.7, Math.abs(dx) * 0.07); // was 2.2, 0.13
                // Clamp to screen bounds
                this.position.x = window.utils.clamp(this.position.x, 8, C.GAME_WIDTH - this.size.w - 8);
            }

            // Wait for dive cooldown
            this.idleTimer += dt;
            // Only dive if player is within horizontal range
            const distToPlayer = Math.abs(player.position.x + player.size.w/2 - (this.position.x + this.size.w/2));
            if (this.idleTimer >= this.nextDiveDelay && distToPlayer < this.maxDiveDistance) {
                // Start dive bomb
                this.state = 'diving';
                // Target player's current position (center)
                this.diveTarget = {
                    x: player.position.x + player.size.w/2 - this.size.w/2,
                    y: player.position.y + player.size.h/2 - this.size.h/2
                };
                // Calculate normalized direction vector
                const dx = this.diveTarget.x - this.position.x;
                const dy = this.diveTarget.y - this.position.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                this.diveDir = { x: dx/len, y: dy/len };
            }
        } else if (this.state === 'diving') {
            // Move toward diveTarget quickly
            this.position.x += this.diveDir.x * this.diveSpeed;
            this.position.y += this.diveDir.y * this.diveSpeed;
            // If passed target Y or hit ground, switch to recovering
            if (
                (this.diveDir.y > 0 && this.position.y >= this.diveTarget.y) ||
                this.position.y + this.size.h >= C.GROUND_Y
            ) {
                // Clamp to just above ground
                if (this.position.y + this.size.h > C.GROUND_Y) {
                    this.position.y = C.GROUND_Y - this.size.h - 2;
                }
                this.state = 'recovering';
            }
        } else if (this.state === 'recovering') {
            // Fly back up to idleHeight, slower
            const dy = this.idleHeight - this.position.y;
            if (Math.abs(dy) > 4) {
                this.position.y += Math.sign(dy) * Math.min(this.recoverSpeed, Math.abs(dy));
            } else {
                this.position.y = this.idleHeight;
                this.state = 'idle';
                this.idleTimer = 0;
                this.nextDiveDelay = this._getNextDiveDelay();
            }
            // Drift horizontally toward player's x while recovering
            const dx = player.position.x - this.position.x;
            if (Math.abs(dx) > 8) {
                // --- SLOW DOWN RECOVERY HORIZONTAL DRIFT ---
                this.position.x += Math.sign(dx) * Math.min(0.5, Math.abs(dx) * 0.03); // was 1.7, 0.09
                this.position.x = window.utils.clamp(this.position.x, 8, C.GAME_WIDTH - this.size.w - 8);
            }
        }

        // Animation
        this.animTimer += dt;
        if (this.animTimer > 1 / C.ENEMYSHIP_ANIM_FPS) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % window.AssetLoader.getEnemyShipFrames().length;
        }
    }

    render(ctx) {
        const C = window.constants;
        ctx.save();
        ctx.translate(this.position.x + C.ENEMYSHIP_WIDTH/2, this.position.y + C.ENEMYSHIP_HEIGHT/2);

        // During spawn, always use spawnFloatDir for facing
        let facingToUse = (this.spawnState === 'spawning') ? this.spawnFloatDir : this.facing;
        ctx.scale(facingToUse, 1);

        let img = null;
        if (this.spawnState === 'spawning') {
            // Use ship frames for spawn animation
            img = window.AssetLoader.getEnemyShipFrames()[this.spawnAnimFrame % window.AssetLoader.getEnemyShipFrames().length];
        } else {
            img = window.AssetLoader.getEnemyShipFrames()[this.animFrame];
        }
        if (img instanceof window.HTMLImageElement || img instanceof window.HTMLCanvasElement) {
            ctx.drawImage(img, -C.ENEMYSHIP_WIDTH/2, -C.ENEMYSHIP_HEIGHT/2, C.ENEMYSHIP_WIDTH, C.ENEMYSHIP_HEIGHT);
        } else {
            // fallback
            ctx.fillStyle = '#444';
            ctx.fillRect(-C.ENEMYSHIP_WIDTH/2, -C.ENEMYSHIP_HEIGHT/2, C.ENEMYSHIP_WIDTH, C.ENEMYSHIP_HEIGHT);
        }
        ctx.restore();
    }
}
window.EnemyShip = EnemyShip;