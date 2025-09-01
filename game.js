class Game {
    constructor() {
        this.input = new window.InputHandler();
        this.state = window.StateManager.STATE_GAMEPLAY;
        this.score = 0;
        this.wave = 0; // 0-based, wave 1 = 0
        this.maxWaves = 10;
        this.platforms = this._createPlatforms();
        // --- FIX: Player Y spawn so feet align with ground like Coinboy/DoomShroom ---
        this.player = new window.Player(110, window.constants.GROUND_Y - window.constants.PLAYER_HEIGHT);
        // We'll spawn enemies in _spawnWaveEnemies
        this.enemies = [];
        this.spawnTimer = 0;
        this.onGameOver = null;

        // --- Side scroller camera/scene state ---
        this.sceneBGs = window.AssetLoader.getSideScrollerBGs();
        this.sceneIndex = 0; // which BG/scene (wave) we're in
        this.sceneScrollX = 0; // camera scroll offset
        this.sceneWidth = window.constants.GAME_WIDTH; // Each scene is one screen wide
        this.waitingForSceneAdvance = false; // true when wave cleared, waiting for player to advance
        this._sceneAdvancePromptShown = false;

        // Enemy types for this scene
        this._currentSceneEnemyTypes = [];

        // --- ENEMY WAVE SPAWNING STATE ---
        this._waveEnemyQueue = []; // Array of {ctor, name}
        this._waveEnemiesTotal = 0;
        this._waveEnemiesSpawned = 0;
        this._waveEnemiesKilled = 0;
        this._waveSpawnBatchMin = 2;
        this._waveSpawnBatchMax = 4;
        this._waveSpawnDelay = 2.2; // seconds between batches (was 1.1)
        this._waveSpawnTimer = 0;

        // --- BOSS/MINIBOSS STATE ---
        this._bossActive = false;
        this._bossType = null; // 'miniboss' or 'boss'
        this._bossDefeated = false;

        // --- NARRATIVE STATE ---
        this._narrativePending = true; // Show narrative at start
        this._narrativeShownForScene = -1; // Track which sceneIndex we've shown narrative for

        // --- ENEMY FIRST BATCH DELAY STATE ---
        this._firstBatchDelayActive = false;
        this._firstBatchDelayTimer = 0;

        // Spawn enemies for the first scene
        // (Do NOT spawn enemies here; will be done after narrative.)
        // this._prepareWaveEnemies();
    }
    _createPlatforms() {
        const { GROUND_Y, GAME_WIDTH, PLATFORM_HEIGHT } = window.constants;
        // Main ground only, remove air platforms
        let platforms = [ new window.Platform(0, GROUND_Y, GAME_WIDTH, PLATFORM_HEIGHT) ];
        return platforms;
    }
    _resetPlayerPositionForScene() {
        // Place player at left edge of new scene
        this.player.position.x = 80;
        // --- FIX: Reset player Y so feet align with ground like Coinboy/DoomShroom ---
        this.player.position.y = window.constants.GROUND_Y - window.constants.PLAYER_HEIGHT;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
    }
    _getAvailableEnemyTypes() {
        // Always include EnemyShip, Coinboy and DoomShroom if available
        const types = [];
        if (window.EnemyShip) {
            types.push({ ctor: window.EnemyShip, name: "EnemyShip" });
        }
        if (window.Coinboy) {
            types.push({ ctor: window.Coinboy, name: "Coinboy" });
        }
        if (window.DoomShroom) {
            types.push({ ctor: window.DoomShroom, name: "DoomShroom" });
        }
        // Add more as you implement more enemy classes
        return types;
    }
    _randomSample(arr, n) {
        // Fisher-Yates shuffle, then take first n
        let a = arr.slice();
        for (let i = a.length - 1; i > 0; --i) {
            let j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
    }

    _prepareWaveEnemies() {
        // Called at the start of a wave (scene)
        // Choose a random number of enemies for this scene: 10-20
        const numEnemies = Math.floor(window.utils.randRange(10, 21));
        // Always use all available types
        const availableTypes = this._getAvailableEnemyTypes();
        const chosenTypes = availableTypes;
        this._currentSceneEnemyTypes = chosenTypes;

        // Distribute enemies among types
        let enemiesPerType = [];
        let remaining = numEnemies;
        for (let i = 0; i < chosenTypes.length; ++i) {
            if (i === chosenTypes.length - 1) {
                enemiesPerType.push(remaining);
            } else {
                // At least 1 per type, random split
                let maxForThis = remaining - (chosenTypes.length - i - 1);
                let n = Math.floor(window.utils.randRange(1, Math.max(2, maxForThis)));
                enemiesPerType.push(n);
                remaining -= n;
            }
        }

        // Build the enemy queue for this wave (randomize order)
        let queue = [];
        for (let i = 0; i < chosenTypes.length; ++i) {
            const type = chosenTypes[i];
            for (let j = 0; j < enemiesPerType[i]; ++j) {
                queue.push(type);
            }
        }
        // Shuffle queue
        for (let i = queue.length - 1; i > 0; --i) {
            let j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        this._waveEnemyQueue = queue;
        this._waveEnemiesTotal = queue.length;
        this._waveEnemiesSpawned = 0;
        this._waveEnemiesKilled = 0;
        this.enemies = [];
        this._waveSpawnTimer = 0;

        // --- BOSS/MINIBOSS SETUP ---
        this._bossActive = false;
        this._bossType = null;
        this._bossDefeated = false;
        // If wave 5 (sceneIndex==4): miniboss, wave 10 (sceneIndex==9): boss
        if (this.sceneIndex === 4) {
            this._bossType = 'miniboss';
        } else if (this.sceneIndex === 9) {
            this._bossType = 'boss';
        }
    }

    _spawnEnemyBatch(options = {}) {
        // Spawn 2-4 enemies from the queue (or fewer if less left)
        const batchMin = this._waveSpawnBatchMin;
        const batchMax = this._waveSpawnBatchMax;
        const batchSize = Math.min(
            Math.floor(window.utils.randRange(batchMin, batchMax + 1)),
            this._waveEnemyQueue.length
        );
        const { GAME_WIDTH, GROUND_Y } = window.constants;
        let spawned = 0;

        // --- Determine player position for spawn safety ---
        let playerX = this.player.position.x;
        let playerW = this.player.size.w;
        let playerY = this.player.position.y;
        let playerH = this.player.size.h;

        // For the first batch after narrative, use a wider "no spawn" zone around the player
        let avoidPlayerZone = {
            x: playerX - 120,
            y: playerY - 24,
            w: playerW + 240,
            h: playerH + 48
        };
        // For subsequent batches, use a smaller avoid zone
        if (!options.firstBatch) {
            avoidPlayerZone = {
                x: playerX - 60,
                y: playerY - 12,
                w: playerW + 120,
                h: playerH + 24
            };
        }

        for (let i = 0; i < batchSize; ++i) {
            if (this._waveEnemyQueue.length === 0) break;
            const type = this._waveEnemyQueue.shift();

            // --- SPAWN POSITION LOGIC ---
            let tries = 0;
            let spawnX;
            let spawnY;
            let sizeW, sizeH;

            // Determine size for this enemy type
            if (type.ctor === window.Coinboy) {
                sizeW = window.constants.COINBOY_WIDTH;
                sizeH = window.constants.COINBOY_HEIGHT;
            } else if (type.ctor === window.EnemyShip) {
                sizeW = window.constants.ENEMYSHIP_WIDTH;
                sizeH = window.constants.ENEMYSHIP_HEIGHT;
            } else if (type.ctor === window.DoomShroom) {
                sizeW = window.constants.DOOMSHROOM_WIDTH;
                sizeH = window.constants.DOOMSHROOM_HEIGHT;
            } else {
                // fallback
                sizeW = 54;
                sizeH = 54;
            }

            // Try up to 16 times to find a safe spawn location
            let safe = false;
            let maxTries = 16;
            let minX = 60, maxX = GAME_WIDTH - 60 - sizeW;

            while (tries < maxTries && !safe) {
                spawnX = Math.floor(window.utils.randRange(minX, maxX));
                // Y depends on enemy type
                spawnY = GROUND_Y - sizeH;

                // 1. Avoid spawning inside the "avoidPlayerZone"
                let enemyRect = { x: spawnX, y: spawnY, w: sizeW, h: sizeH };
                let overlapPlayer =
                    !(enemyRect.x + enemyRect.w < avoidPlayerZone.x ||
                      enemyRect.x > avoidPlayerZone.x + avoidPlayerZone.w ||
                      enemyRect.y + enemyRect.h < avoidPlayerZone.y ||
                      enemyRect.y > avoidPlayerZone.y + avoidPlayerZone.h);

                // 2. Avoid spawning so close that the player cannot dodge (i.e., not within 60px left/right of player)
                let tooCloseX = (spawnX + sizeW > playerX - 60) && (spawnX < playerX + playerW + 60);

                // 3. Avoid spawning at the very left edge where player starts (110)
                let nearPlayerStart = Math.abs(spawnX - 110) < 80;

                // 4. For ground enemies, ensure not spawning directly on top of player (vertical overlap)
                let verticalOverlap = (spawnY < playerY + playerH && spawnY + sizeH > playerY);

                // 5. For flying enemies, allow more Y flexibility (but still avoid direct overlap horizontally)
                let isFlying = (type.ctor === window.EnemyShip);
                let allowVerticalOverlap = isFlying;

                // --- Final spawn safety check ---
                if (
                    !overlapPlayer &&
                    !nearPlayerStart &&
                    (!tooCloseX || isFlying) &&
                    (!verticalOverlap || allowVerticalOverlap)
                ) {
                    safe = true;
                }
                tries++;
            }

            // If couldn't find a "safe" spot, fallback to random but still avoid direct overlap
            if (!safe) {
                spawnX = Math.floor(window.utils.randRange(minX, maxX));
                spawnY = GROUND_Y - sizeH;
            }

            // Instantiate enemy
            let enemy;
            if (type.ctor === window.Coinboy) {
                enemy = new window.Coinboy(spawnX, spawnY, this.platforms);
            } else if (type.ctor === window.DoomShroom) {
                enemy = new window.DoomShroom(spawnX, spawnY, this.platforms);
            } else if (type.ctor === window.EnemyShip) {
                enemy = new window.EnemyShip(spawnX, spawnY, this.platforms);
            } else {
                // Fallback: try to instantiate with (x, y, platforms)
                enemy = new type.ctor(spawnX, spawnY, this.platforms);
            }
            this.enemies.push(enemy);
            this._waveEnemiesSpawned++;
            spawned++;
        }
    }

    _spawnWaveEnemies() {
        // Called at the start of a wave (scene)
        this._prepareWaveEnemies();

        // --- BOSS/MINIBOSS SPAWN LOGIC ---
        if (this._bossType === 'miniboss') {
            // Spawn miniboss and set _bossActive
            this._spawnMiniboss();
            this._bossActive = true;
            this._bossDefeated = false;
            // Do NOT spawn regular enemies for this wave
            this._waveEnemyQueue = [];
        } else if (this._bossType === 'boss') {
            // Spawn boss and set _bossActive
            this._spawnBoss();
            this._bossActive = true;
            this._bossDefeated = false;
            // Do NOT spawn regular enemies for this wave
            this._waveEnemyQueue = [];
        } else {
            // --- DELAY FIRST ENEMY BATCH BY 1 SECOND AFTER NARRATIVE ---
            this._firstBatchDelayActive = true;
            this._firstBatchDelayTimer = 1.0; // 1 second delay
            // Do NOT spawn the first batch yet; will be done in update()
            this._waveSpawnTimer = 0; // Don't start spawn timer yet
        }
    }

    _spawnMiniboss() {
        // Miniboss: use a big DoomShroom with more HP and different color (was Coinboy)
        const { GAME_WIDTH, GROUND_Y, DOOMSHROOM_WIDTH, DOOMSHROOM_HEIGHT } = window.constants;
        const x = GAME_WIDTH / 2 - DOOMSHROOM_WIDTH;
        // --- FIX: Miniboss Y so feet align with ground ---
        const y = GROUND_Y - DOOMSHROOM_HEIGHT * 1.7;
        const miniboss = new DoomShroomMiniboss(x, y, this.platforms);
        this.enemies = [miniboss];
    }

    _spawnBoss() {
        // Boss: use a big Coinboy with more HP and different color (was DoomShroom)
        const { GAME_WIDTH, GROUND_Y, COINBOY_WIDTH, COINBOY_HEIGHT } = window.constants;
        const x = GAME_WIDTH / 2 - COINBOY_WIDTH;
        // --- FIX: Boss Y so feet align with ground ---
        const y = GROUND_Y - COINBOY_HEIGHT * 2.2;
        const boss = new CoinboyBoss(x, y, this.platforms);
        this.enemies = [boss];
    }

    // --- NARRATIVE BLOCKS ---
    _getNarrativeForScene(sceneIdx) {
        // Wave 1 (sceneIdx==0): original intro
        if (sceneIdx === 0) {
            // Four screens as requested
            return [
                "The night market is in chaos. Lanterns swing, neon sputters, and civilians scatter in terror as monstrous shapes rampage: Coinboys slicing through stalls, Doomshrooms spewing poison clouds",
                "Coop shakes with fear — until a whisper rises in his chest.",
                "“You are the Avalanche.”",
                "A crimson glow ignites around his fists. Red triangles spark into being, crackling with energy. Fear becomes fire.",
                "Doomshrooms burst from the ground, spraying spores. Coop trembles, throws a wild punch — and a red triangle bolt erupts, exploding the mushroom in a flash of light. He stares at his fists: the Avalanche is inside him."
            ].join('\n---PAGE---\n');
        }
        // Wave 2 (sceneIdx==1)
        if (sceneIdx === 1) {
            return [
                "Wave 2 – Coinboys Attack:",
                "Coinboys roll through the alleys, blades spinning. Civilians shriek as stalls collapse. Coop sidesteps, then hurls a triangle bolt like a spear. It pierces a Coinboy, splitting it in half. The crowd gasps — hope flickers."
            ].join('\n---PAGE---\n');
        }
        // Wave 3 (sceneIdx==2)
        if (sceneIdx === 2) {
            return [
                "Wave 3 – Skyfall:",
                "UFOs scream down, vapor beams tearing through lantern strings. Coop weaves, vaults off a cart, and fires twin triangle bolts skyward. Two UFOs burst in crimson arcs, raining molten shards onto empty stalls."
            ].join('\n---PAGE---\n');
        }
        // Wave 4 (sceneIdx==3)
        if (sceneIdx === 3) {
            return [
                "Wave 4 – Swarm of Doubt:",
                "Coinboys and Doomshrooms surge together, overwhelming the street. Coop steadies his stance, fists glowing, and unleashes a flurry of triangles like arrows. Enemies collapse in showers of sparks and spores. The crowd sees him not just fighting — but leading."
            ].join('\n---PAGE---\n');
        }
        // Wave 5 (sceneIdx==4) - Miniboss
        if (sceneIdx === 4) {
            return [
                "Wave 5 – Mini-Boss: Doomshroom Hulk",
                "The ground shatters. A Doomshroom Hulk towers over the rooftops, cap splitting open, spewing toxic clouds. Coop coughs, knees buckling. Then the Avalanche roars in his chest. He leaps, red triangles orbiting his fists, and drives them upward in a storm. The Hulk’s cap explodes like a cannon, its body collapsing into ash. The people cheer. Coop breathes hard — but the glow does not fade."
            ].join('\n---PAGE---\n');
        }
        // Wave 6 (sceneIdx==5)
        if (sceneIdx === 5) {
            return [
                "Wave 6 – The Counterattack:",
                "More UFOs swarm, trying to pen Coop into alleys. He pivots, spinning like a storm, loosing triangles in every direction. Each bolt carves the night like firecrackers, blasting ships from the sky."
            ].join('\n---PAGE---\n');
        }
        // Wave 7 (sceneIdx==6)
        if (sceneIdx === 6) {
            return [
                "Wave 7 – The Golden Tide:",
                "Coinboys roll in formation, a glimmering wave of spinning gold. Coop plants his feet, draws on the Avalanche, and slams his fists together. A shockwave of red triangles bursts outward, shattering the wave in a thunder of metal."
            ].join('\n---PAGE---\n');
        }
        // Wave 8 (sceneIdx==7)
        if (sceneIdx === 7) {
            return [
                "Wave 8 – Inferno Market:",
                "Lanterns fall, fire spreads. Doomshrooms rise glowing red, mutated by the blaze. Coop launches triangle bolts rapid-fire, each detonation snuffing out spores before they reach civilians. His fear has turned into precision."
            ].join('\n---PAGE---\n');
        }
        // Wave 9 (sceneIdx==8)
        if (sceneIdx === 8) {
            return [
                "Wave 9 – Silence of the Gate:",
                "The enemies retreat. Fires burn. Civilians huddle, staring at Coop glowing faintly in crimson light. He exhales, whispering to himself: “I am the Avalanche.” The ground shakes. The final terror approaches."
            ].join('\n---PAGE---\n');
        }
        // Wave 10 (sceneIdx==9) - Main Boss
        if (sceneIdx === 9) {
            return [
                "Wave 10 – Main Boss: The Coin Collector",
                "The market gate explodes inward. The Coin Collector steps through — a giant of fused gold, body dripping molten currency, UFOs orbiting him like vultures. His voice grinds like metal:\n“All wealth returns to me. The Avalanche dies tonight.”."
            ].join('\n---PAGE---\n');
        }
        // Add more narrative blocks for other scenes/waves/levels as needed
        return null;
    }

    update(dt) {
        // --- ENEMY FIRST BATCH DELAY HANDLING ---
        if (this._firstBatchDelayActive) {
            this._firstBatchDelayTimer -= dt;
            if (this._firstBatchDelayTimer <= 0) {
                // Spawn the first batch, with special "firstBatch" flag for safe spawn
                this._spawnEnemyBatch({ firstBatch: true });
                this._waveSpawnTimer = this._waveSpawnDelay;
                this._firstBatchDelayActive = false;
            }
            // Allow player to move during this delay
            this.player.update(this.input, this.platforms, dt, []);
            return;
        }

        if (this.state !== window.StateManager.STATE_GAMEPLAY) return;
        this.score += dt;

        // --- Side scroller camera logic ---
        // Camera scrolls to follow player, but clamps to scene bounds
        const { GAME_WIDTH, PLAYER_WIDTH } = window.constants;
        let playerCenter = this.player.position.x + PLAYER_WIDTH/2;
        let camScroll = playerCenter - GAME_WIDTH/2;
        camScroll = Math.max(0, Math.min(camScroll, this.sceneWidth - GAME_WIDTH));
        this.sceneScrollX = camScroll;

        // --- Scene/wave progression logic ---
        // If all enemies are dead AND queue is empty, prompt to advance
        // For boss/miniboss waves, only advance if boss defeated
        let waveCleared = false;
        if (this._bossActive) {
            if (this.enemies.length === 0) {
                waveCleared = true;
                this._bossDefeated = true;
            }
        } else {
            if (this.enemies.length === 0 && this._waveEnemyQueue.length === 0) {
                waveCleared = true;
            }
        }
        if (waveCleared && !this.waitingForSceneAdvance) {
            this.waitingForSceneAdvance = true;
            this._sceneAdvancePromptShown = false;
        }

        // If waiting for advance, show prompt and wait for player to walk to right edge
        if (this.waitingForSceneAdvance) {
            // Show prompt only once
            if (!this._sceneAdvancePromptShown && typeof window.UIManager === "function") {
                // Use overlay directly (minimal, so as not to interfere with HUD)
                let overlay = document.getElementById('ui-overlay');
                if (overlay && !document.getElementById('advance-scene-msg')) {
                    let msg = document.createElement('div');
                    msg.id = 'advance-scene-msg';
                    msg.style.position = 'absolute';
                    msg.style.left = '50%';
                    msg.style.top = '72%';
                    msg.style.transform = 'translateX(-50%)';
                    msg.style.background = 'rgba(255,255,255,0.93)';
                    msg.style.borderRadius = '12px';
                    msg.style.padding = '22px 44px';
                    msg.style.fontSize = '1.45rem';
                    msg.style.fontWeight = 'bold';
                    msg.style.color = '#a96c1a';
                    msg.style.boxShadow = '0 2px 12px rgba(0,0,0,0.13)';
                    msg.style.zIndex = 100;
                    // Boss/miniboss message
                    if (this._bossType === 'miniboss') {
                        msg.innerHTML = "Miniboss defeated!<br>Walk to the right edge to continue.";
                    } else if (this._bossType === 'boss') {
                        msg.innerHTML = "Main Boss defeated!<br>Walk to the right edge to finish!";
                    } else {
                        msg.innerHTML = "Wave cleared!<br>Walk to the right edge to continue.";
                    }
                    overlay.appendChild(msg);
                }
                this._sceneAdvancePromptShown = true;
            }
            // Wait for player to reach right edge
            if (this.player.position.x + this.player.size.w >= this.sceneWidth - 20) {
                // Advance to next scene/wave
                this.sceneIndex++;
                if (this.sceneIndex >= this.maxWaves) {
                    // Game completed (for now: restart at wave 1)
                    this.sceneIndex = 0;
                }
                // Remove prompt
                let overlay = document.getElementById('ui-overlay');
                let msg = document.getElementById('advance-scene-msg');
                if (msg && overlay) overlay.removeChild(msg);
                this.waitingForSceneAdvance = false;
                this._sceneAdvancePromptShown = false;
                this._resetPlayerPositionForScene();
                // --- NARRATIVE: Show narrative for new scene ---
                this._narrativePending = true;
                // (Do not set _narrativeShownForScene yet; will be set after narrative shown)
                // Do NOT spawn enemies here; will be done after narrative closes.
                // this._spawnWaveEnemies();
            }
            // Don't update player/enemy/game logic while waiting EXCEPT allow player to move
            this.player.update(this.input, this.platforms, dt, []);
            return;
        } else {
            // Remove prompt if present
            let overlay = document.getElementById('ui-overlay');
            let msg = document.getElementById('advance-scene-msg');
            if (msg && overlay) overlay.removeChild(msg);
        }

        // --- ENEMY BATCH SPAWNING LOGIC ---
        // Only spawn more if there are enemies left in the queue
        if (!this._bossActive && this._waveEnemyQueue.length > 0) {
            this._waveSpawnTimer -= dt;
            if (this._waveSpawnTimer <= 0) {
                this._spawnEnemyBatch();
                this._waveSpawnTimer = this._waveSpawnDelay;
            }
        }

        // Player
        this.player.update(this.input, this.platforms, dt, this.enemies);

        // Remove dead enemies (from player attack)
        const prevEnemyCount = this.enemies.length;
        this.enemies = this.enemies.filter(e => !e._isDead);
        // Optionally track kills for future features
        if (prevEnemyCount > this.enemies.length) {
            this._waveEnemiesKilled += (prevEnemyCount - this.enemies.length);
        }

        // Update all enemies (not just Coinboy)
        for (let enemy of this.enemies) {
            if (typeof enemy.update === "function") {
                enemy.update(this.player, dt);
            }
        }

        // Remove off-screen enemies
        this.enemies = this.enemies.filter(e => e.position.x > -120 && e.position.x < window.constants.GAME_WIDTH + 120);

        // Collisions: player vs enemies
        const hitEnemy = window.CollisionSystem.playerVsEnemies(this.player, this.enemies);
        if (hitEnemy && this.player.invulnTimer <= 0) {
            // --- HITPOINTS LOGIC ---
            // Instead of losing a life, lose hitpoints
            let DAMAGE = 34; // Default
            // Boss/miniboss deal more damage
            if (hitEnemy.isBossEnemy) {
                DAMAGE = hitEnemy.contactDamage || 50;
            }
            this.player.hitpoints -= DAMAGE;
            this.player.invulnTimer = 1.3;
            window.AudioManager.hit();
            if (this.player.hitpoints <= 0) {
                this.player.lives -= 1;
                if (this.player.lives > 0) {
                    // Respawn with full HP
                    this.player.hitpoints = this.player.maxHitpoints;
                } else {
                    this.state = window.StateManager.STATE_GAMEOVER;
                    if (this.onGameOver) this.onGameOver(this.score);
                }
            }
        }
    }
    getScore() {
        return this.score;
    }
}

// --- Miniboss: Big DoomShroom ---
class DoomShroomMiniboss extends window.DoomShroom {
    constructor(x, y, platforms) {
        super(x, y, platforms);
        // Make it bigger
        this.size = {
            w: window.constants.DOOMSHROOM_WIDTH * 1.7,
            h: window.constants.DOOMSHROOM_HEIGHT * 1.7
        };
        this.isBossEnemy = true;
        this.maxHP = 10;
        this.hp = this.maxHP;
        this.contactDamage = 50;
        // Make it slower but more dangerous
        this.velocity.x = window.constants.DOOMSHROOM_WALK_SPEED * 0.7;
        this.mode = 'walk';
        // For visual: color tint
        this._minibossColor = 'hsl(280 80% 60%)';
    }

    update(player, dt) {
        if (this._isDead) return;
        // Standard DoomShroom logic
        super.update(player, dt);
        // If hit by player/projectile, lose HP
        if (this._justHit) {
            this.hp -= 1;
            this._justHit = false;
            if (this.hp <= 0) {
                this._isDead = true;
            }
        }
    }

    // Called by player attack/projectile
    _playerHit() {
        this._justHit = true;
    }

    render(ctx) {
        const C = window.constants;
        ctx.save();
        // During spawn, apply shake offset
        let shakeX = (this.spawnState === 'spawning') ? (this.spawnShakeOffset || 0) : 0;
        ctx.translate(this.position.x + this.size.w/2 + shakeX, this.position.y + this.size.h/2);
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
            ctx.drawImage(img, -this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
            ctx.globalAlpha = 0.32;
            ctx.fillStyle = this._minibossColor;
            ctx.fillRect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = this._minibossColor;
            ctx.fillRect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
        }
        // HP bar above
        ctx.save();
        ctx.translate(0, -this.size.h/2 - 18);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-38, 0, 76, 13, 6);
        ctx.fill();
        ctx.stroke();
        // Fill portion
        let frac = Math.max(0, Math.min(1, this.hp/this.maxHP));
        ctx.fillStyle = "#b700ff";
        ctx.beginPath();
        ctx.roundRect(-36, 2, 72*frac, 9, 4);
        ctx.fill();
        // Text
        ctx.font = "bold 12px Arial";
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Miniboss`, 0, 6.5);
        ctx.restore();
        ctx.restore();
    }
}

// --- Boss: Big Coinboy ---
class CoinboyBoss extends window.Coinboy {
    constructor(x, y, platforms) {
        super(x, y, platforms);
        // Make it bigger
        this.size = {
            w: window.constants.COINBOY_WIDTH * 2.2,
            h: window.constants.COINBOY_HEIGHT * 2.2
        };
        this.isBossEnemy = true;
        this.maxHP = 18;
        this.hp = this.maxHP;
        this.contactDamage = 60;
        // Make it slower but more dangerous
        this.velocity.x = window.constants.COINBOY_WALK_SPEED * 0.7;
        this.mode = 'walk';
        // For visual: color tint
        this._bossColor = 'hsl(39 100% 50%)';
    }

    update(player, dt) {
        // If dead, do nothing
        if (this._isDead) return;
        // Standard Coinboy logic
        super.update(player, dt);
        // If hit by player/projectile, lose HP
        if (this._justHit) {
            this.hp -= 1;
            this._justHit = false;
            if (this.hp <= 0) {
                this._isDead = true;
            }
        }
    }

    // Called by player attack/projectile
    _playerHit() {
        this._justHit = true;
    }

    render(ctx) {
        const C = window.constants;
        ctx.save();
        ctx.translate(this.position.x + this.size.w/2, this.position.y + this.size.h/2);

        // Always face player
        ctx.scale(this.facing, 1);

        // Draw: use Coinboy frame, but scale up and tint
        let img = null;
        if (this.spawnState === 'spawning') {
            img = window.AssetLoader.getCoinboyRollFrames()[this.spawnAnimFrame % window.AssetLoader.getCoinboyRollFrames().length];
        } else if (this.mode === 'walk') {
            img = window.AssetLoader.getCoinboyWalkFrames()[this.animFrame];
        } else if (this.mode === 'roll') {
            img = window.AssetLoader.getCoinboyRollFrames()[this.animFrame];
        }
        if (img instanceof window.HTMLImageElement || img instanceof window.HTMLCanvasElement) {
            // Tint: draw image, then overlay color
            ctx.drawImage(img, -this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
            ctx.globalAlpha = 0.26;
            ctx.fillStyle = this._bossColor;
            ctx.fillRect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = this._bossColor;
            ctx.fillRect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
        }
        // HP bar above
        ctx.save();
        ctx.translate(0, -this.size.h/2 - 22);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-54, 0, 108, 17, 8);
        ctx.fill();
        ctx.stroke();
        // Fill portion
        let frac = Math.max(0, Math.min(1, this.hp/this.maxHP));
        ctx.fillStyle = "#ffb300";
        ctx.beginPath();
        ctx.roundRect(-52, 2, 104*frac, 13, 6);
        ctx.fill();
        // Text
        ctx.font = "bold 14px Arial";
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`MAIN BOSS`, 0, 8.5);
        ctx.restore();
        ctx.restore();
    }
}

window.Game = Game;
window.DoomShroomMiniboss = DoomShroomMiniboss;
window.CoinboyBoss = CoinboyBoss;