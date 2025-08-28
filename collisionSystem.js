const CollisionSystem = {
    rectsCollide: function(a, b) {
        return (a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y);
    },
    playerVsEnemies: function(player, enemies) {
        for(let enemy of enemies) {
            if (this.rectsCollide(
                { x: player.position.x, y: player.position.y, w: player.size.w, h: player.size.h },
                { x: enemy.position.x, y: enemy.position.y, w: enemy.size.w, h: enemy.size.h }
            )) {
                return enemy;
            }
        }
        return null;
    }
};

window.CollisionSystem = CollisionSystem;