window.addEventListener('DOMContentLoaded', async function() {
    // Asset loading
    const ui = new window.UIManager();
    ui.clearUI();
    const ctx = document.getElementById('game-canvas').getContext('2d');
    ui.overlay.innerHTML = `<div class="ui-panel">Loading assets...</div>`;
    await window.AssetLoader.loadAssets();
    let game, renderer, loop;

    function startGame() {
        ui.clearUI();
        game = new window.Game();
        renderer = new window.Renderer(ctx, game);
        loop = new window.GameLoop(game, renderer, ui);
        game.onGameOver = function(score) {
            ui.hideHUD();
            window.AudioManager.gameover();
            ui.showGameOver(score, () => {
                startGame();
            });
        };
        ui.hideHUD();
        ui.showHUD(game.getScore(), game.player.lives);
        loop.start();
    }

    ui.showMainMenu(startGame);
});