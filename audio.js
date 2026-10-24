/**
 * WEDDING AUDIO ENGINE - ARIEF & WARDANI
 * Background Music (Looping MP3) & Procedural Sound Effects
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.isPlaying = false;
        
        // Background Music Audio Element
        this.bgm = new Audio('assets/bgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.65;
        this.bgm.preload = 'auto';

        // Listen for audio events
        this.bgm.addEventListener('play', () => {
            this.isPlaying = true;
        });
        this.bgm.addEventListener('pause', () => {
            this.isPlaying = false;
        });
    }

    initCtx() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startBgm() {
        if (this.isMuted) return;
        this.initCtx();
        
        const playPromise = this.bgm.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
            }).catch(err => {
                console.log('Autoplay prevented, awaiting user gesture:', err);
                // Bind one-time unlock on next user interaction
                const unlock = () => {
                    if (!this.isMuted) {
                        this.bgm.play();
                    }
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('touchstart', unlock);
                };
                window.addEventListener('pointerdown', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
            });
        }
    }

    stopBgm() {
        this.bgm.pause();
        this.isPlaying = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBgm();
        } else {
            this.startBgm();
        }
        return !this.isMuted;
    }

    // Sound effects using Web Audio API
    playChime() {
        if (this.isMuted) return;
        this.initCtx();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [587.33, 880.00]; // D5, A5
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);
            gain.gain.setValueAtTime(0.08, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.35);
        });
    }

    playHeart() {
        if (this.isMuted) return;
        this.initCtx();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // Sparkle C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.07);
            gain.gain.setValueAtTime(0.07, now + i * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.07);
            osc.stop(now + i * 0.07 + 0.4);
        });
    }

    playStep() {
        if (this.isMuted) return;
        this.initCtx();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    }
}

window.soundEngine = new SoundEngine();
