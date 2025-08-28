class Game {
    constructor() {
        this.input = new window.InputHandler();
        this.state = window.StateManager.STATE_GAMEPLAY;
        this.score = 0;
        this.wave = 0; // 0-based, wave 1 = 0
        this.maxWaves = 10;
        this.platforms = this._createPlatforms();
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
        this._waveSpawnDelay = 1.1; // seconds between batches
        this._waveSpawnTimer = 0;

        // Spawn enemies for the first scene
        this._prepareWaveEnemies();
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
        this.player.position.y = window.constants.GROUND_Y - window.constants.PLAYER_HEIGHT;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
    }
    _getAvailableEnemyTypes() {
        // Always include Coinboy and DoomShroom if available
        const types = [];
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
        // Always use both Coinboy and DoomShroom if available
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
    }

    _spawnEnemyBatch() {
        // Spawn 2-4 enemies from the queue (or fewer if less left)
        const batchMin = this._waveSpawnBatchMin;
        const batchMax = this._waveSpawnBatchMax;
        const batchSize = Math.min(
            Math.floor(window.utils.randRange(batchMin, batchMax + 1)),
            this._waveEnemyQueue.length
        );
        const { GAME_WIDTH, GROUND_Y } = window.constants;
        let spawned = 0;
        for (let i = 0; i < batchSize; ++i) {
            if (this._waveEnemyQueue.length === 0) break;
            const type = this._waveEnemyQueue.shift();
            // Spawn at random X, spread out, avoid player start
            let tries = 0;
            let spawnX;
            do {
                spawnX = Math.floor(window.utils.randRange(60, GAME_WIDTH - 60));
                tries++;
            } while (
                Math.abs(spawnX - 110) < 80 && tries < 10 // avoid player start
            );
            // Y depends on enemy type
            let y;
            // Try to use size.h if available, else use Coinboy height
            let sizeH = (type.ctor.prototype && type.ctor.prototype.size && type.ctor.prototype.size.h) ||
                (type.ctor === window.Coinboy ? window.constants.COINBOY_HEIGHT : 54);
            y = GROUND_Y - sizeH;
            // Instantiate enemy
            let enemy;
            if (type.ctor === window.Coinboy) {
                enemy = new type.ctor(spawnX, y, this.platforms);
            } else if (type.ctor === window.DoomShroom) {
                enemy = new type.ctor(spawnX, y, this.platforms);
            } else {
                // Fallback: try to instantiate with (x, y, platforms)
                enemy = new type.ctor(spawnX, y, this.platforms);
            }
            this.enemies.push(enemy);
            this._waveEnemiesSpawned++;
            spawned++;
        }
    }

    _spawnWaveEnemies() {
        // Called at the start of a wave (scene)
        this._prepareWaveEnemies();
        // Immediately spawn the first batch
        this._spawnEnemyBatch();
        this._waveSpawnTimer = 0;
    }

    update(dt) {
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
        if (this.enemies.length === 0 && this._waveEnemyQueue.length === 0 && !this.waitingForSceneAdvance) {
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
                    msg.innerHTML = "Wave cleared!<br>Walk to the right edge to continue.";
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
                this._spawnWaveEnemies();
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
        if (this._waveEnemyQueue.length > 0) {
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
            this.player.lives -= 1;
            this.player.invulnTimer = 1.3;
            window.AudioManager.hit();
            if (this.player.lives <= 0) {
                this.state = window.StateManager.STATE_GAMEOVER;
                if (this.onGameOver) this.onGameOver(this.score);
            }
        }
    }
    getScore() {
        return this.score;
    }
}
window.Game = Game;