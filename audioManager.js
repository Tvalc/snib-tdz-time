const AudioManager = {
    jump: () => { AudioManager._playOsc(329, 0.19, 0.09, 'triangle'); },
    hit: () => { AudioManager._playOsc(110, 0.22, 0.13, 'sawtooth'); },
    coinboyRoll: () => { AudioManager._playOsc(480, 0.19, 0.13, 'square'); },
    gameover: () => { AudioManager._playOsc(60, 0.6, 0.4, 'triangle'); },
    _playOsc: (freq, dur, fade, type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.10;
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
            osc.stop(ctx.currentTime + dur);
            osc.onended = () => ctx.close();
        } catch (e) {}
    }
};
window.AudioManager = AudioManager;