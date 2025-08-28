class UIManager {
    constructor() {
        this.overlay = document.getElementById('ui-overlay');
        this._hud = null;
        this.clearUI();
    }
    clearUI() {
        this.overlay.innerHTML = '';
        this._hud = null; // Ensure HUD reference is reset when UI is cleared
    }
    showMainMenu(onStart) {
        this.clearUI();
        const panel = document.createElement('div');
        panel.className = 'ui-panel';
        panel.innerHTML = `<h1>Coinboy Platformer</h1>
            <div style="margin-bottom:16px;font-size:1.13rem;">Arrow keys or A/D to move, Space to jump.<br>
            Avoid Coinboy when he rolls at you!</div>
            <button id="start-btn">Start Game</button>`;
        this.overlay.appendChild(panel);
        // Ensure pointer events are enabled for the overlay and panel
        this.overlay.style.pointerEvents = 'auto';
        panel.style.pointerEvents = 'auto';
        // Use addEventListener instead of .onclick to avoid event loss
        const startBtn = panel.querySelector('#start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Disable pointer events after click to avoid double starts
                this.overlay.style.pointerEvents = 'none';
                onStart();
            });
        }
    }
    showGameOver(score, onRestart) {
        this.clearUI();
        const panel = document.createElement('div');
        panel.className = 'ui-panel';
        panel.innerHTML = `<h1>Game Over</h1>
            <div style="margin-bottom:16px;">You survived for <b>${score.toFixed(1)}</b> seconds!</div>
            <button id="restart-btn">Restart</button>`;
        this.overlay.appendChild(panel);
        // Ensure pointer events are enabled for the overlay and panel
        this.overlay.style.pointerEvents = 'auto';
        panel.style.pointerEvents = 'auto';
        const restartBtn = panel.querySelector('#restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.overlay.style.pointerEvents = 'none';
                onRestart();
            });
        }
    }
    showHUD(score, lives) {
        if (!this._hud) {
            this._hud = document.createElement('div');
            this._hud.id = 'hud';
            this.overlay.appendChild(this._hud);
        }
        // Remove HP from HUD (now shown as health bar above player)
        this._hud.innerHTML = `
            <div class="hud-section">⏱ Time: ${score.toFixed(1)}s</div>
            <div class="hud-section">❤️ Lives: ${lives}</div>
        `;
    }
    hideHUD() {
        if (this._hud && this._hud.parentNode) {
            this._hud.parentNode.removeChild(this._hud);
            this._hud = null;
        }
    }
}
window.UIManager = UIManager;