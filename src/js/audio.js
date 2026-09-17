// ============================================================
// audio.js — 程序化音效 + 古风背景音乐（Web Audio API）
// 不依赖任何外部音频文件，全部用振荡器+增益节点合成
// ============================================================

export class AudioManager {
  constructor() {
    this.ctx = null;          // AudioContext，首次用户交互后才创建
    this.master = null;       // 主增益节点
    this.bgmGain = null;      // 背景音乐总线（压得很低）
    this.muted = false;
    this.volume = 0.8;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;

    // 五声音阶：宫 商 角 徵 羽（以 A3=220 为基）
    // A  C# D  E  F# G# —— 这里用宫调式 C D E G A 的相对音程
    this.pentatonic = [0, 2, 4, 7, 9];            // 半音偏移
    this.baseFreq = 220;                            // A3
  }

  // 首次用户交互时调用，解锁 AudioContext
  resume() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.06;            // 背景音乐整体压低
        this.bgmGain.connect(this.master);
      } catch (e) { /* 环境不支持音频时静默降级 */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ---------- 基础发声原语 ----------
  // 单个音：频率 freq，时长 dur，波形 type，峰值增益 vol，起始偏移 offset，滑音目标 glide
  tone(freq, dur, type = 'sine', vol = 0.3, offset = 0, glide = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    // 简单 ADSR 包络，避免爆音
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // 鼓：低频敲击（方波+快速衰减）
  drum(vol = 0.5, offset = 0, freq = 90) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.3);
  }

  // ---------- 具体音效 ----------
  playClick()   { this.resume(); this.tone(880, 0.08, 'triangle', 0.25); this.tone(1320, 0.06, 'sine', 0.12, 0.02); }
  playHover()   { this.resume(); this.tone(660, 0.04, 'sine', 0.06); }

  playBattle() {
    this.resume();
    this.drum(0.7, 0, 70);
    this.drum(0.6, 0.18, 70);
    this.drum(0.8, 0.36, 60);
    this.tone(196, 0.4, 'sawtooth', 0.15, 0.1);
  }

  playVictory() {
    this.resume();
    const seq = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    seq.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, i * 0.12));
    this.drum(0.4, seq.length * 0.12, 80);
  }

  playDefeat() {
    this.resume();
    const seq = [392, 329.63, 261.63, 196];      // G4 E4 C4 G3
    seq.forEach((f, i) => this.tone(f, 0.45, 'sine', 0.28, i * 0.18));
  }

  playCoin() {
    this.resume();
    this.tone(1567.98, 0.12, 'sine', 0.2);        // G6 清脆
    this.tone(2093, 0.18, 'sine', 0.15, 0.08);    // C7
  }

  playRecruit() {
    this.resume();
    // 号角：锯齿波 + 缓慢颤音
    this.tone(233.08, 0.5, 'sawtooth', 0.18);
    this.tone(293.66, 0.5, 'sawtooth', 0.16, 0.05);
    this.tone(466.16, 0.6, 'triangle', 0.14, 0.1);
  }

  playEvent() {
    this.resume();
    // 神秘和弦：小三和弦缓慢叠加
    this.tone(220, 1.2, 'sine', 0.18);
    this.tone(261.63, 1.2, 'sine', 0.14, 0.1);
    this.tone(311.13, 1.2, 'sine', 0.14, 0.2);
  }

  playAchievement() {
    this.resume();
    // 辉煌铜管：叠加大三度与五度
    const seq = [392, 523.25, 659.25, 783.99];
    seq.forEach((f, i) => {
      this.tone(f, 0.4, 'sawtooth', 0.2, i * 0.1);
      this.tone(f * 1.5, 0.4, 'triangle', 0.12, i * 0.1);
    });
    this.drum(0.5, seq.length * 0.1, 90);
  }

  playSeason() {
    this.resume();
    this.tone(440, 0.5, 'sine', 0.12);
    this.tone(554.37, 0.5, 'sine', 0.1, 0.15);
    this.tone(659.25, 0.7, 'sine', 0.1, 0.3);
  }

  // ---------- 静音 / 音量 ----------
  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : this.volume * this.volume, this.ctx.currentTime);
    }
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  // ---------- 背景音乐（五声音阶随机旋律 + 低音鼓点）----------
  _noteFromPentatonic(octaveUp = 0) {
    const semi = this.pentatonic[Math.floor(Math.random() * this.pentatonic.length)] + octaveUp * 12;
    return this.baseFreq * Math.pow(2, semi / 12);
  }

  startBGM() {
    if (this._bgmOn) return;
    this.resume();
    if (!this.ctx) return;
    this._bgmOn = true;
    this._bgmStep = 0;
    this._bgmTimer = setInterval(() => this._bgmTick(), 360);
  }

  stopBGM() {
    this._bgmOn = false;
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
  }

  _bgmTick() {
    if (!this.ctx || this.muted || !this._bgmOn) return;
    // 旋律：在背景音乐总线上放轻柔拨弦音
    const t0 = this.ctx.currentTime;
    const freq = this._noteFromPentatonic(Math.random() < 0.25 ? 1 : 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(g); g.connect(this.bgmGain);
    osc.start(t0); osc.stop(t0 + 0.45);

    // 每 4 拍一个低音鼓点
    if (this._bgmStep % 4 === 0) this._bgmDrum(t0);
    // 每 8 拍加一声泛音
    if (this._bgmStep % 8 === 6) {
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o2.type = 'sine'; o2.frequency.value = freq * 2;
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(0.15, t0 + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o2.connect(g2); g2.connect(this.bgmGain);
      o2.start(t0); o2.stop(t0 + 0.55);
    }
    this._bgmStep++;
  }

  _bgmDrum(t0) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.2);
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(g); g.connect(this.bgmGain);
    osc.start(t0); osc.stop(t0 + 0.3);
  }
}
