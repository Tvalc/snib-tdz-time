class Platform {
    constructor(x, y, w, h) {
        this.x = x; this.y = y;
        this.w = w; this.h = h;
    }
    render(ctx) {
        // Simple ground platform
        ctx.save();
        ctx.translate(this.x, this.y);
        // Main platform
        let grd = ctx.createLinearGradient(0, 0, 0, this.h);
        grd.addColorStop(0, 'hsl(36 70% 60%)');
        grd.addColorStop(1, 'hsl(36 80% 44%)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, this.w, this.h);
        // Edge highlight
        ctx.fillStyle = 'hsl(42 80% 88%)';
        ctx.fillRect(0, 0, this.w, 5);
        // Stones
        ctx.globalAlpha = 0.23;
        for (let i=0; i<5; ++i) {
            ctx.beginPath();
            ctx.ellipse(24+i*50, this.h-7, 10, 6, 0, 0, 2*Math.PI);
            ctx.fillStyle = 'hsl(40 40% 63%)';
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
window.Platform = Platform;