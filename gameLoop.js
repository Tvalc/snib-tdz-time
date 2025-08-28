class GameLoop {
    constructor(game, renderer, ui) {
        this.game = game;
        this.renderer = renderer;
        this.ui = ui;
        this.lastTimestamp = undefined;
        this.running = false;
        this._boundLoop = (ts) => this.gameLoop(ts);
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
        this.game.update(dt);
        this.renderer.render();
        this.ui.showHUD(this.game.getScore(), this.game.player.lives);
        if (this.game.state === window.StateManager.STATE_GAMEPLAY) {
            requestAnimationFrame(this._boundLoop);
        }
    }
}
window.GameLoop = GameLoop;