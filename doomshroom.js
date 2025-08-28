class DoomShroom {
    constructor(x, y, platforms) {
        const C = window.constants;
        this.position = { x, y };
        this.size = { w: C.DOOMSHROOM_WIDTH, h: C.DOOMSHROOM_HEIGHT };
        this.velocity = { x: (Math.random() < 0.5 ? -1 : 1) * C.DOOMSHROOM_WALK_SPEED, y: 0 };
        this.physics = true;
        this.grounded = false;
        this.facing = this.velocity.x >= 0 ? 1 : -1;
        this.mode = 'walk'; // 'walk' or 'heal'
        this.animTimer = 0;
        this.animFrame = 0;
        this.healCooldown = this._getNextHealInterval();
        this.platforms = platforms;
        this._isDead = false;

        // --- SPAWN ANIMATION STATE ---
        this.spawnState = 'spawning'; // 'spawning' | 'done'
        this.spawnAnimTimer = 0;
        this.spawnAnimDuration = 0.7; // seconds for rise-up
        this.spawnStartY = y + C.DOOMSHROOM_HEIGHT + 18;
        this.spawnEndY = y;
        this.position.y = this.spawnStartY;
        this.spawnShakeMag = 4.5; // pixels
        this.spawnAnimFrame = 0;
    }
    _getNextHealInterval() {
        const { DOOMSHROOM_HEAL_INTERVAL_MIN: min, DOOMSHROOM_HEAL_INTERVAL_MAX: max } = window.constants;
        return window.utils.randRange(min, max);
    }
    update(player, dt) {
        const C = window.constants;
        if (this._isDead) return;

        // --- SPAWN ANIMATION ---
        if (this.spawnState === 'spawning') {
            this.spawnAnimTimer += dt;
            const t = Math.min(this.spawnAnimTimer / this.spawnAnimDuration, 1);
            // Ease out for smooth finish
            const easeT = 1 - Math.pow(1 - t, 2.5);
            // Y rises from below ground to normal
            this.position.y = this.spawnStartY + (this.spawnEndY - this.spawnStartY) * easeT;
            // Shake: horizontal offset, sinusoidal
            this.spawnShakeOffset = Math.sin(this.spawnAnimTimer * 32 + this.position.x * 0.13) * this.spawnShakeMag * (1 - easeT * 0.8);
            // Flash through all walk frames and heal frames rapidly
            const walkFrames = window.AssetLoader.getDoomShroomWalkFrames();
            const healFrames = window.AssetLoader.getDoomShroomHealFrames();
            const totalFrames = walkFrames.length + healFrames.length;
            // Cycle through all frames at 22fps
            this.spawnAnimFrame = Math.floor(this.spawnAnimTimer * 22) % totalFrames;
            if (t >= 1) {
                this.spawnState = 'done';
                this.position.y = this.spawnEndY;
                this.spawnShakeOffset = 0;
                this.animFrame = 0;
                this.animTimer = 0;
            }
            return; // Don't update normal logic during spawn
        }

        // Heal logic
        this.healCooldown -= dt;
        if (this.healCooldown <= 0 && this.mode === 'walk') {
            this.mode = 'heal';
            this.animFrame = 0;
            this.animTimer = 0;
            this.healAnimTimer = 0;
            this.healAnimFrame = 0;
            // After heal anim, go back to walk
        }

        if (this.mode === 'heal') {
            // Stand still, play heal anim
            this.velocity.x = 0;
            this.animTimer += dt;
            if (this.animTimer > 1 / C.DOOMSHROOM_HEAL_ANIM_FPS) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % window.AssetLoader.getDoomShroomHealFrames().length;
            }
            // Heal animation lasts for 0.7s
            if (!this._healAnimDuration) this._healAnimDuration = 0.7;
            if (!this._healAnimElapsed) this._healAnimElapsed = 0;
            this._healAnimElapsed += dt;
            if (this._healAnimElapsed >= this._healAnimDuration) {
                this.mode = 'walk';
                this.healCooldown = this._getNextHealInterval();
                this._healAnimElapsed = 0;
            }
        } else {
            // Walking
            this.velocity.x = this.facing * C.DOOMSHROOM_WALK_SPEED;
            // Turn around at platform edges or screen bounds
            const margin = 4;
            let onPlatform = false;
            let platformSide = 0;
            for (let pf of this.platforms) {
                // Is doomshroom on this platform?
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
                this.velocity.x = this.facing * C.DOOMSHROOM_WALK_SPEED;
            }
            // Animation
            this.animTimer += dt;
            if (this.animTimer > 1 / C.DOOMSHROOM_WALK_ANIM_FPS) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % window.AssetLoader.getDoomShroomWalkFrames().length;
            }
        }

        // Physics
        window.PhysicsEngine.updateEntityPhysics(this, this.platforms);
    }
    render(ctx) {
        const C = window.constants;
        ctx.save();
        // During spawn, apply shake offset
        let shakeX = (this.spawnState === 'spawning') ? (this.spawnShakeOffset || 0) : 0;
        ctx.translate(this.position.x + C.DOOMSHROOM_WIDTH/2 + shakeX, this.position.y + C.DOOMSHROOM_HEIGHT/2);
        ctx.scale(this.facing, 1);

        let img = null;
        if (this.spawnState === 'spawning') {
            // Flash through all walk and heal frames
            const walkFrames = window.AssetLoader.getDoomShroomWalkFrames();
            const healFrames = window.AssetLoader.getDoomShroomHealFrames();
            const totalFrames = walkFrames.length + healFrames.length;
            let frameIdx = this.spawnAnimFrame % totalFrames;
            if (frameIdx < walkFrames.length) {
                img = walkFrames[frameIdx];
            } else {
                img = healFrames[frameIdx - walkFrames.length];
            }
        } else if (this.mode === 'walk') {
            img = window.AssetLoader.getDoomShroomWalkFrames()[this.animFrame];
        } else if (this.mode === 'heal') {
            img = window.AssetLoader.getDoomShroomHealFrames()[this.animFrame];
        }
        if (img instanceof window.HTMLImageElement || img instanceof window.HTMLCanvasElement) {
            ctx.drawImage(img, -C.DOOMSHROOM_WIDTH/2, -C.DOOMSHROOM_HEIGHT/2, C.DOOMSHROOM_WIDTH, C.DOOMSHROOM_HEIGHT);
        } else {
            // fallback
            ctx.fillStyle = 'purple';
            ctx.fillRect(-C.DOOMSHROOM_WIDTH/2, -C.DOOMSHROOM_HEIGHT/2, C.DOOMSHROOM_WIDTH, C.DOOMSHROOM_HEIGHT);
        }
        ctx.restore();
    }
}
window.DoomShroom = DoomShroom;