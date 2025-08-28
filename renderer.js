class Renderer {
    constructor(ctx, game) {
        this.ctx = ctx;
        this.game = game;
    }
    render() {
        const ctx = this.ctx;
        const { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PLATFORM_HEIGHT } = window.constants;

        // --- Side-scroller: camera scroll offset ---
        const scrollX = this.game.sceneScrollX || 0;
        const sceneIndex = this.game.sceneIndex || 0;
        const bgImgs = this.game.sceneBGs || window.AssetLoader.getSideScrollerBGs();
        const bgImg = bgImgs[sceneIndex % bgImgs.length];

        // --- Draw background image for current scene, scrolling with camera ---
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (bgImg && (bgImg instanceof window.HTMLImageElement || bgImg instanceof window.HTMLCanvasElement)) {
            // If BG is larger than GAME_WIDTH, scroll it with camera
            if (bgImg.width > GAME_WIDTH) {
                ctx.drawImage(bgImg, scrollX, 0, GAME_WIDTH, GAME_HEIGHT, 0, 0, GAME_WIDTH, GAME_HEIGHT);
            } else {
                // BG is exactly GAME_WIDTH: just draw at 0,0
                ctx.drawImage(bgImg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
            }
        } else {
            // fallback: gradient sky
            let sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            sky.addColorStop(0, 'hsl(210 80% 92%)');
            sky.addColorStop(0.6, 'hsl(120 60% 90%)');
            sky.addColorStop(1, 'hsl(120 70% 80%)');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        // --- Parallax clouds (optional, comment out if you want only BGs) ---
        // for (let i = 0; i < 3; ++i) {
        //     ctx.save();
        //     ctx.globalAlpha = 0.20 + i*0.11;
        //     ctx.beginPath();
        //     let cx = 120 + Math.sin(Date.now()/1800 + i)*110 + i*200;
        //     let cy = 80 + i*32;
        //     ctx.ellipse(cx, cy, 58 + i*25, 28 + i*9, 0, 0, 2*Math.PI);
        //     ctx.fillStyle = 'white';
        //     ctx.shadowColor = '#fff';
        //     ctx.shadowBlur = 16;
        //     ctx.fill();
        //     ctx.shadowBlur = 0;
        //     ctx.restore();
        // }

        // --- World objects: platforms, player, enemies ---
        ctx.save();
        ctx.translate(-scrollX, 0);

        // Platforms
        for (let pf of this.game.platforms) {
            pf.render(ctx);
        }

        // Player
        this.game.player.render(ctx);

        // Render all enemies (not just Coinboy)
        for (let enemy of this.game.enemies) {
            if (typeof enemy.render === "function") {
                enemy.render(ctx);
            }
        }

        ctx.restore();

        // --- PLAYER HEALTH BAR at top under timer ---
        // Draw health bar at fixed screen position (centered under timer)
        // Timer is at top left in HUD, so let's draw bar centered at top, under HUD (e.g. y=54)
        const barW = 210;
        const barH = 20;
        const barX = GAME_WIDTH/2 - barW/2;
        const barY = 54; // HUD is at top (15px padding + ~30px height), so 54px is just under

        const player = this.game.player;
        const hpFrac = Math.max(0, Math.min(1, player.hitpoints / player.maxHitpoints));
        // Color: green (full) to yellow to red (low)
        let hpColor;
        if (hpFrac > 0.6) {
            hpColor = "#3ecf3e";
        } else if (hpFrac > 0.3) {
            hpColor = "#ffe066";
        } else {
            hpColor = "#ff4b3e";
        }
        ctx.save();
        // Outer border
        ctx.beginPath();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 3.5;
        ctx.fillStyle = "#fff";
        ctx.roundRect(barX, barY, barW, barH, 10);
        ctx.fill();
        ctx.stroke();
        // Fill portion
        ctx.beginPath();
        ctx.fillStyle = hpColor;
        ctx.roundRect(barX+3, barY+3, (barW-6)*hpFrac, barH-6, 7);
        ctx.fill();
        // Border again for clarity
        ctx.beginPath();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.5;
        ctx.roundRect(barX, barY, barW, barH, 10);
        ctx.stroke();
        // Text: HP value
        ctx.font = "bold 17px Arial";
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Health: ${player.hitpoints}/${player.maxHitpoints}`, barX + barW/2, barY + barH/2 + 0.5);
        ctx.restore();
    }
}
window.Renderer = Renderer;