const PhysicsEngine = {
    gravity: 0.77,
    maxFallSpeed: 14,
    updateEntityPhysics(entity, platforms) {
        if (!entity.physics) return;
        // Apply gravity
        entity.velocity.y += this.gravity;
        entity.velocity.y = Math.min(entity.velocity.y, this.maxFallSpeed);

        // X movement
        entity.position.x += entity.velocity.x;

        // Y movement
        entity.position.y += entity.velocity.y;

        // Ground collision
        let grounded = false;
        for (let platform of platforms) {
            if (this.rectsCollide({
                x: entity.position.x,
                y: entity.position.y,
                w: entity.size.w,
                h: entity.size.h
            }, {
                x: platform.x,
                y: platform.y,
                w: platform.w,
                h: platform.h
            })) {
                if (entity.velocity.y > 0 && entity.position.y + entity.size.h - platform.y < 26) {
                    // On top of platform
                    entity.position.y = platform.y - entity.size.h;
                    entity.velocity.y = 0;
                    grounded = true;
                }
            }
        }
        entity.grounded = grounded;
    },
    rectsCollide(a, b) {
        return (a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y);
    }
};

window.PhysicsEngine = PhysicsEngine;