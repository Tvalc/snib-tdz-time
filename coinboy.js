class Coinboy {
    constructor(x, y, platforms) {
        const C = window.constants;
        this.position = { x, y };
        this.size = { w: C.COINBOY_WIDTH, h: C.COINBOY_HEIGHT };
        this.velocity = { x: C.COINBOY_WALK_SPEED, y: 0 };
        this.physics = true;
        this.grounded = false;
        this.facing = 1;
        this.mode = 'walk'; // 'walk' or 'roll'
        this.animTimer = 0;
        this.animFrame = 0;
        this.attackCooldown = this._getNextAttackInterval();
        this.rollTarget = null;
        this.platforms = platforms;

        // --- SPAWN ANIMATION STATE ---
        this.spawnState = 'spawning'; // 'spawning' | 'done'
        this.spawnAnimTimer = 0;
        this.spawnAnimDuration = 0.65; // seconds for roll-in
        // Determine spawn direction: roll in from left or right
        // If spawned on left half, roll from left; else from right
        const spawnFromLeft = (x < window.constants.GAME_WIDTH / 2);
        this.spawnRollDir = spawnFromLeft ? 1 : -1;
        this.spawnStartX = spawnFromLeft ? -C.COINBOY_WIDTH - 24 : window.constants.GAME_WIDTH + 24;
        this.spawnEndX = x;
        this.spawnStartY = y;
        // Start off-screen
        this.position.x = this.spawnStartX;
        this.position.y = this.spawnStartY;
        this.spawnAnimFrame = 0;
    }
    _getNextAttackInterval() {
        const { COINBOY_ATTACK_INTERVAL_MIN: min, COINBOY_ATTACK_INTERVAL_MAX: max } = window.constants;
        return window.utils.randRange(min, max);
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
            // Animate roll frames during spawn
            const rollFrames = window.AssetLoader.getCoinboyRollFrames();
            this.spawnAnimFrame = Math.floor(easeT * rollFrames.length * 2) % rollFrames.length;
            // Set facing according to roll direction
            this.facing = this.spawnRollDir;
            if (t >= 1) {
                this.spawnState = 'done';
                this.position.x = this.spawnEndX;
                this.position.y = this.spawnStartY;
                // After spawn, start in walk mode as normal
                this.animFrame = 0;
                this.animTimer = 0;
            }
            return; // Don't update normal logic during spawn
        }

        // --- NORMAL LOGIC ---
        // Attack logic
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0 && this.mode === 'walk') {
            this.mode = 'roll';
            this.animFrame = 0;
            this.animTimer = 0;
            this.rollTarget = { x: player.position.x, y: player.position.y };
            this.facing = this.rollTarget.x > this.position.x ? 1 : -1;
            window.AudioManager.coinboyRoll();
        }
        if (this.mode === 'roll') {
            // Roll at player
            const dx = this.facing * 1;
            this.velocity.x = this.facing * C.COINBOY_ROLL_SPEED;
            // Jump a little if about to go off ledge
            // (stay on the same platform)
            let willFall = false;
            const nextX = this.position.x + this.velocity.x * 0.16;
            let onPlatform = false;
            for (let pf of this.platforms) {
                if (
                    nextX + this.size.w > pf.x &&
                    nextX < pf.x + pf.w &&
                    this.position.y + this.size.h <= pf.y + 6 &&
                    this.position.y + this.size.h + 6 >= pf.y
                ) {
                    onPlatform = true;
                    break;
                }
            }
            if (!onPlatform) {
                this.velocity.x = 0;
            }
        } else {
            // Walking
            this.velocity.x = this.facing * C.COINBOY_WALK_SPEED;
            // Turn around at platform edges or screen bounds
            const margin = 4;
            let onPlatform = false;
            let platformSide = 0;
            for (let pf of this.platforms) {
                // Is coinboy on this platform?
                if (
                    this.position.x + this.size.w > pf.x &&
                    this.position.x < pf.x + pf.w &&
                    this.position.y + this.size.h <= pf.y + 6 &&
                    this.position.y + this.size.h + 6 >= pf.y
                ) {
                    onPlatform = true;
                    // Detect if at edge
                    if (this.facing === 1 && this.position.x + this.size.w + margin >= pf.x + pf.w) {
                        platformSide = 1;
                    }
                    if (this.facing === -1 && this.position.x - margin <= pf.x) {
                        platformSide = -1;
                    }
                    break;
                }
            }
            // Reverse at edges
            if (!onPlatform || platformSide !== 0) {
                this.facing *= -1;
                this.velocity.x = this.facing * C.COINBOY_WALK_SPEED;
            }
        }

        // Physics
        window.PhysicsEngine.updateEntityPhysics(this, this.platforms);

        // Animation
        if (this.mode === 'walk') {
            this.animTimer += dt;
            if (this.animTimer > 1 / C.COINBOY_WALK_ANIM_FPS) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % window.AssetLoader.getCoinboyWalkFrames().length;
            }
        } else if (this.mode === 'roll') {
            this.animTimer += dt;
            if (this.animTimer > 1 / C.COINBOY_ROLL_ANIM_FPS) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % window.AssetLoader.getCoinboyRollFrames().length;
            }
            // End roll if reached player's last position or off screen
            if (
                (this.facing === 1 && this.position.x > this.rollTarget.x + 90) ||
                (this.facing === -1 && this.position.x < this.rollTarget.x - 90) ||
                this.position.x < 0 || this.position.x > C.GAME_WIDTH
            ) {
                this.mode = 'walk';
                this.attackCooldown = this._getNextAttackInterval();
            }
        }
    }
    render(ctx) {
        const C = window.constants;
        ctx.save();
        ctx.translate(this.position.x + C.COINBOY_WIDTH/2, this.position.y + C.COINBOY_HEIGHT/2);

        // During spawn, always use spawnRollDir for facing
        let facingToUse = (this.spawnState === 'spawning') ? this.spawnRollDir : this.facing;
        ctx.scale(facingToUse, 1);

        let img = null;
        if (this.spawnState === 'spawning') {
            // Use roll frames for spawn animation
            img = window.AssetLoader.getCoinboyRollFrames()[this.spawnAnimFrame % window.AssetLoader.getCoinboyRollFrames().length];
        } else if (this.mode === 'walk') {
            img = window.AssetLoader.getCoinboyWalkFrames()[this.animFrame];
        } else if (this.mode === 'roll') {
            img = window.AssetLoader.getCoinboyRollFrames()[this.animFrame];
        }
        if (img instanceof window.HTMLImageElement || img instanceof window.HTMLCanvasElement) {
            ctx.drawImage(img, -C.COINBOY_WIDTH/2, -C.COINBOY_HEIGHT/2, C.COINBOY_WIDTH, C.COINBOY_HEIGHT);
        } else {
            // fallback
            ctx.fillStyle = 'gold';
            ctx.fillRect(-C.COINBOY_WIDTH/2, -C.COINBOY_HEIGHT/2, C.COINBOY_WIDTH, C.COINBOY_HEIGHT);
        }
        ctx.restore();
    }
}
window.Coinboy = Coinboy;