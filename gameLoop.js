class GameLoop {
    constructor(game, renderer, ui) {
        this.game = game;
        this.renderer = renderer;
        this.ui = ui;
        this.lastTimestamp = undefined;
        this.running = false;
        this._boundLoop = (ts) => this.gameLoop(ts);
        // --- Track if narrative is being shown ---
        this._narrativeActive = false;
    }
    start() {
        this.running = true;
        requestAnimationFrame(this._boundLoop);
    }
    stop() {
        this.running = false;
    }
    gameLoop(ts) {
        if (!this.running) return;
        if (!this.lastTimestamp) this.lastTimestamp = ts;
        const dt = Math.min((ts - this.lastTimestamp) / 1000, 0.045);
        this.lastTimestamp = ts;

        // --- NARRATIVE HANDLING (move narrative display here for reliability) ---
        // Only show narrative at the beginning of each scene (wave) if narrative is provided
        // and not already being shown
        if (
            this.game._narrativePending &&
            this.game._narrativeShownForScene !== this.game.sceneIndex &&
            !this._narrativeActive
        ) {
            const narrative = this.game._getNarrativeForScene(this.game.sceneIndex);
            if (narrative && typeof window.UIManager === "function") {
                // Pause game logic, show narrative
                this.game.state = window.StateManager.STATE_MAINMENU; // Pause updates
                // Hide HUD while narrative is up
                if (window.UIManager.instance) window.UIManager.instance.hideHUD?.();
                // Actually show narrative
                let ui = window.UIManager.instance;
                if (!ui && window.ui) ui = window.ui;
                if (!ui && window.UIManager && typeof window.UIManager === "function") {
                    let overlay = document.getElementById('ui-overlay');
                    if (overlay) {
                        ui = new window.UIManager();
                        window.UIManager.instance = ui;
                    }
                }
                if (ui) {
                    // Support multi-page narrative with explicit page breaks
                    let narrativePages;
                    if (narrative.indexOf('---PAGE---') !== -1) {
                        narrativePages = narrative.split('---PAGE---').map(s => s.trim());
                    } else {
                        narrativePages = [narrative];
                    }
                    let pageIdx = 0;
                    this._narrativeActive = true;
                    const showNext = () => {
                        if (pageIdx < narrativePages.length) {
                            ui.showNarrative(narrativePages[pageIdx], {
                                onComplete: () => {
                                    pageIdx++;
                                    if (pageIdx < narrativePages.length) {
                                        setTimeout(showNext, 10);
                                    } else {
                                        // Resume game
                                        this.game.state = window.StateManager.STATE_GAMEPLAY;
                                        ui.showHUD(this.game.getScore(), this.game.player.lives);
                                        this.game._narrativePending = false;
                                        this.game._narrativeShownForScene = this.game.sceneIndex;
                                        // Actually spawn enemies after narrative closes
                                        this.game._spawnWaveEnemies();
                                        this._narrativeActive = false;
                                    }
                                },
                                allowSkip: true
                            });
                        }
                    };
                    showNext();
                    // Do not update game logic or render while narrative is up
                    // But keep the loop running for UI responsiveness
                    requestAnimationFrame(this._boundLoop);
                    return;
                }
            } else {
                // No narrative for this scene, continue as normal
                this.game._narrativePending = false;
                this.game._narrativeShownForScene = this.game.sceneIndex;
                // If there was no narrative, spawn enemies immediately
                this.game._spawnWaveEnemies();
            }
        }

        // Only update/render gameplay if not in narrative
        if (this.game.state === window.StateManager.STATE_GAMEPLAY) {
            this.game.update(dt);
            this.renderer.render();
            this.ui.showHUD(this.game.getScore(), this.game.player.lives);
        } else {
            // Still render (so UI overlays, narrative, etc. are visible)
            this.renderer.render();
        }

        // --- FIX: Always keep the loop running unless game over ---
        if (this.game.state !== window.StateManager.STATE_GAMEOVER) {
            requestAnimationFrame(this._boundLoop);
        }
    }
}
window.GameLoop = GameLoop;