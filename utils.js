// Utility functions

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function randRange(a, b) {
    return Math.random() * (b - a) + a;
}

function loadImageWithFallback(src, fallbackFn) {
    return new Promise(resolve => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(fallbackFn());
        img.src = src;
    });
}

function pointDistance(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

window.utils = {
    clamp,
    randRange,
    loadImageWithFallback,
    pointDistance
};