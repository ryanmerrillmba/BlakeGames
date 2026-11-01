// Simple, fun Web Audio synthesizer for arcade sound effects
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.mainMusic = new Audio('assets/main-song.mp3');
    this.levelTwoMusic = new Audio('assets/level-two-song.mp3');
    this.worldThreeMusic = new Audio('assets/world-three-song.mp3');
    this.bossMusic = new Audio('assets/boss-song.mp3');
    this.worldTwoBossMusic = new Audio('assets/world-two-boss-song.mp3');
    this.mainMusic.loop = true;
    this.levelTwoMusic.loop = true;
    this.worldThreeMusic.loop = true;
    this.bossMusic.loop = true;
    this.worldTwoBossMusic.loop = true;
    this.mainMusic.preload = 'auto';
    this.levelTwoMusic.preload = 'auto';
    this.worldThreeMusic.preload = 'auto';
    this.bossMusic.preload = 'auto';
    this.worldTwoBossMusic.preload = 'auto';
    this.mainMusic.volume = 0.8;
    this.levelTwoMusic.volume = 0.8;
    this.worldThreeMusic.volume = 0.8;
    this.bossMusic.volume = 0.8;
    this.worldTwoBossMusic.volume = 0.8;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch(e) {}
  }

  playSpecial() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch(e) {}
  }

  playStarCollect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const start = now + i * 0.04;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      });
    } catch(e) {}
  }

  playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch(e) {}
  }

  playLanternBuzz() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(310, now + 0.1);
      osc.frequency.linearRampToValueAtTime(210, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch(e) {}
  }

  playMainMusic() {
    if (!this.enabled) return;
    if (this.mainMusic === this.currentBackgroundMusic && !this.mainMusic.paused) return;
    // Preserve the main track's position when a boss temporarily takes over.
    this.levelTwoMusic.pause();
    this.levelTwoMusic.currentTime = 0;
    this.worldThreeMusic.pause();
    this.worldThreeMusic.currentTime = 0;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
    this.worldTwoBossMusic.pause();
    this.worldTwoBossMusic.currentTime = 0;
    this.mainMusic.play().catch(() => {});
    this.currentBackgroundMusic = this.mainMusic;
  }

  playWorldTwoMusic() {
    if (!this.enabled) return;
    if (this.levelTwoMusic === this.currentBackgroundMusic && !this.levelTwoMusic.paused) return;
    this.mainMusic.pause();
    this.worldThreeMusic.pause();
    this.worldThreeMusic.currentTime = 0;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
    this.worldTwoBossMusic.pause();
    this.worldTwoBossMusic.currentTime = 0;
    this.levelTwoMusic.currentTime = 0;
    this.levelTwoMusic.play().catch(() => {});
    this.currentBackgroundMusic = this.levelTwoMusic;
  }

  playWorldThreeMusic() {
    if (!this.enabled) return;
    if (this.worldThreeMusic === this.currentBackgroundMusic && !this.worldThreeMusic.paused) return;
    this.mainMusic.pause();
    this.levelTwoMusic.pause();
    this.levelTwoMusic.currentTime = 0;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
    this.worldTwoBossMusic.pause();
    this.worldTwoBossMusic.currentTime = 0;
    this.worldThreeMusic.currentTime = 0;
    this.worldThreeMusic.play().catch(() => {});
    this.currentBackgroundMusic = this.worldThreeMusic;
  }

  playBossMusic(isWorldTwoBoss = false) {
    if (!this.enabled) return;
    this.mainMusic.pause();
    this.levelTwoMusic.pause();
    this.worldThreeMusic.pause();
    this.bossMusic.pause();
    this.worldTwoBossMusic.pause();
    const bossTrack = isWorldTwoBoss ? this.worldTwoBossMusic : this.bossMusic;
    bossTrack.currentTime = 0;
    bossTrack.play().catch(() => {});
    this.currentBackgroundMusic = bossTrack;
  }

  playLevelMusic() {
    // Kept as an alias for older game calls; normal gameplay uses the main track.
    this.playMainMusic();
  }

  speakBoss(text) {
    // Bosses are silent. Keep this method for compatibility with older call sites.
    return;
  }

  playBossExplode() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.6);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch(e) {}
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [440, 554.37, 659.25, 880];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const start = now + idx * 0.12;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === 3 ? 0.6 : 0.2));
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + (idx === 3 ? 0.6 : 0.2));
      });
    } catch(e) {}
  }
}

window.sounds = new SoundController();
