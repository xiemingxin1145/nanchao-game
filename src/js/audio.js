// ============================================================
// audio.js — 程序化音效 + 古风背景音乐（Web Audio API）
// ------------------------------------------------------------
// V3.5 技术参考：
// 1) Web Audio API 程序化音乐：用 OscillatorNode 生成音符，
//    GainNode 做 ADSR 包络，AudioContext.currentTime 调度音符序列。
//    五声音阶频率（十二平均律）：
//    C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00
//    参考：MDN Web Audio API 教程 + 中国音乐学院五声调式理论。
// 2) 场景化 BGM：每首 BGM 用 setInterval 调度旋律，切换时
//    先淡出旧 BGM（2秒），再淡入新 BGM。
// 3) 音量分层：masterGain（总输出）→ bgmGain（背景音乐）+
//    sfxGain（音效），互不干扰。
// ============================================================

// 五声音阶频率表（C宫调式）
const PENTATONIC = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00
};

// 各场景 BGM 配置
// mode: 音阶类型（pentatonic 五声）
// bpm: 速度；wave: 主旋律波形；bassWave: 低音波形；scale: 音阶数组
const BGM_TRACKS = {
  menu: {   // 主菜单：古琴+箫，C宫，60BPM，悠远宁静
    bpm: 60, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    wave: 'sine', bassWave: 'sine', stepMs: 800, hasDrum: false, density: 0.6
  },
  map: {    // 大地图：古筝+笛子+轻鼓，G宫，72BPM，悠扬大气
    bpm: 72, scale: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 500, hasDrum: true, density: 0.7
  },
  battle: { // 战斗：琵琶+大鼓+号角，D商，120BPM，紧张激烈
    bpm: 120, scale: ['D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 280, hasDrum: true, density: 0.9
  },
  event: {  // 事件：箫+古琴，A羽，54BPM，悬疑/抒情
    bpm: 54, scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    wave: 'sine', bassWave: 'sine', stepMs: 900, hasDrum: false, density: 0.5
  },
  interior:{ // 内政：扬琴+笛子，C宫，84BPM，轻快明亮
    bpm: 84, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    wave: 'triangle', bassWave: 'triangle', stepMs: 400, hasDrum: true, density: 0.75
  },
  ending: { // 结局：编钟+古琴+箫，G宫，60BPM，庄严史诗
    bpm: 60, scale: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    wave: 'sine', bassWave: 'sine', stepMs: 800, hasDrum: false, density: 0.65
  }
};

export class AudioManager {
  constructor() {
    this.ctx = null;          // AudioContext，首次用户交互后才创建
    this.master = null;       // 主增益节点
    this.bgmGain = null;      // 背景音乐总线
    this.sfxGain = null;      // 音效总线
    this.muted = false;
    this.masterVolume = 0.8;
    this.bgmVolume = 0.6;
    this.sfxVolume = 0.8;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;
    this._currentTrack = null;

    // 五声音阶：宫 商 角 徵 羽
    this.pentatonic = [0, 2, 4, 7, 9];
    this.baseFreq = 220;
  }

  // 首次用户交互时调用，解锁 AudioContext
  resume() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        // 总线架构：master → destination；bgm/sfx → master
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.masterVolume;
        this.master.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmVolume * 0.5;
        this.bgmGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.sfxGain.connect(this.master);
      } catch (e) { /* 环境不支持音频时静默降级 */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ---------- 基础发声原语 ----------
  // 单个音：频率 freq，时长 dur，波形 type，峰值增益 vol，起始偏移 offset，滑音目标 glide
  // bus: 'master' | 'bgm' | 'sfx'
  tone(freq, dur, type = 'sine', vol = 0.3, offset = 0, glide = null, bus = 'master') {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    const out = bus === 'bgm' ? this.bgmGain : (bus === 'sfx' ? this.sfxGain : this.master);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // 鼓：低频敲击
  drum(vol = 0.5, offset = 0, freq = 90, bus = 'master') {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(g);
    const out = bus === 'bgm' ? this.bgmGain : (bus === 'sfx' ? this.sfxGain : this.master);
    g.connect(out);
    osc.start(t0); osc.stop(t0 + 0.3);
  }

  // ---------- 具体音效（复用原有 + V3.5 新增） ----------
  playClick()   { this.resume(); this.tone(880, 0.08, 'triangle', 0.25, 0, null, 'sfx'); this.tone(1320, 0.06, 'sine', 0.12, 0.02, null, 'sfx'); }
  playHover()   { this.resume(); this.tone(660, 0.04, 'sine', 0.06, 0, null, 'sfx'); }

  playBattle() {
    this.resume();
    this.drum(0.7, 0, 70, 'sfx');
    this.drum(0.6, 0.18, 70, 'sfx');
    this.drum(0.8, 0.36, 60, 'sfx');
    this.tone(196, 0.4, 'sawtooth', 0.15, 0.1, null, 'sfx');
  }

  playVictory() {
    this.resume();
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, i * 0.12, null, 'sfx'));
    this.drum(0.4, seq.length * 0.12, 80, 'sfx');
  }

  playDefeat() {
    this.resume();
    const seq = [392, 329.63, 261.63, 196];
    seq.forEach((f, i) => this.tone(f, 0.45, 'sine', 0.28, i * 0.18, null, 'sfx'));
  }

  playCoin() {
    this.resume();
    this.tone(1567.98, 0.12, 'sine', 0.2, 0, null, 'sfx');
    this.tone(2093, 0.18, 'sine', 0.15, 0.08, null, 'sfx');
  }

  playRecruit() {
    this.resume();
    this.tone(233.08, 0.5, 'sawtooth', 0.18, 0, null, 'sfx');
    this.tone(293.66, 0.5, 'sawtooth', 0.16, 0.05, null, 'sfx');
    this.tone(466.16, 0.6, 'triangle', 0.14, 0.1, null, 'sfx');
  }

  playEvent() {
    this.resume();
    this.tone(220, 1.2, 'sine', 0.18, 0, null, 'sfx');
    this.tone(261.63, 1.2, 'sine', 0.14, 0.1, null, 'sfx');
    this.tone(311.13, 1.2, 'sine', 0.14, 0.2, null, 'sfx');
  }

  playAchievement() {
    this.resume();
    const seq = [392, 523.25, 659.25, 783.99];
    seq.forEach((f, i) => {
      this.tone(f, 0.4, 'sawtooth', 0.2, i * 0.1, null, 'sfx');
      this.tone(f * 1.5, 0.4, 'triangle', 0.12, i * 0.1, null, 'sfx');
    });
    this.drum(0.5, seq.length * 0.1, 90, 'sfx');
  }

  playSeason() {
    this.resume();
    this.tone(440, 0.5, 'sine', 0.12, 0, null, 'sfx');
    this.tone(554.37, 0.5, 'sine', 0.1, 0.15, null, 'sfx');
    this.tone(659.25, 0.7, 'sine', 0.1, 0.3, null, 'sfx');
  }

  // ---- V3.5 新增音效 ----
  // 城市建造：锤子敲击（低频方波+快速衰减）
  playBuild() {
    this.resume();
    this.drum(0.5, 0, 180, 'sfx');
    this.drum(0.4, 0.15, 180, 'sfx');
    this.tone(120, 0.15, 'square', 0.2, 0, null, 'sfx');
  }
  // 科技研究完成：铃铛（高频正弦+泛音）
  playResearchDone() {
    this.resume();
    this.tone(1567.98, 0.5, 'sine', 0.25, 0, null, 'sfx');
    this.tone(2093, 0.4, 'sine', 0.18, 0.05, null, 'sfx');
    this.tone(2637, 0.3, 'sine', 0.12, 0.1, null, 'sfx');
  }
  // 称号解锁：号角+和弦
  playTitleUnlock() {
    this.resume();
    this.tone(233.08, 0.6, 'sawtooth', 0.2, 0, null, 'sfx');
    this.tone(349.23, 0.6, 'sawtooth', 0.18, 0.05, null, 'sfx');
    this.tone(466.16, 0.6, 'sawtooth', 0.18, 0.1, null, 'sfx');
    this.drum(0.4, 0.3, 80, 'sfx');
  }
  // 周目继承：史诗和弦
  playNGPlus() {
    this.resume();
    const chord = [261.63, 329.63, 392.00, 523.25];
    chord.forEach((f, i) => this.tone(f, 1.2, 'sine', 0.25, i * 0.08, null, 'sfx'));
    this.drum(0.5, 0.5, 60, 'sfx');
  }
  // 外交成功
  playDiploSuccess() {
    this.resume();
    this.tone(523.25, 0.3, 'triangle', 0.25, 0, null, 'sfx');
    this.tone(659.25, 0.3, 'triangle', 0.2, 0.1, null, 'sfx');
    this.tone(783.99, 0.4, 'triangle', 0.2, 0.2, null, 'sfx');
  }
  // 外交失败
  playDiploFail() {
    this.resume();
    this.tone(329.63, 0.3, 'sawtooth', 0.2, 0, null, 'sfx');
    this.tone(261.63, 0.4, 'sawtooth', 0.2, 0.15, null, 'sfx');
  }

  // ============================================================
  // V4.5 新增音效（全部 OscillatorNode + GainNode 包络合成）
  // ============================================================
  // 城市建造完成：锤子敲击（低频木槌×3）+ 铃铛（高频正弦泛音）
  playBuildComplete() {
    this.resume();
    this.drum(0.5, 0, 160, 'sfx');
    this.drum(0.45, 0.18, 160, 'sfx');
    this.drum(0.5, 0.36, 160, 'sfx');
    // 铃铛泛音
    this.tone(1567.98, 0.5, 'sine', 0.22, 0.42, null, 'sfx');
    this.tone(2093.00, 0.4, 'sine', 0.14, 0.48, null, 'sfx');
    this.tone(2637.00, 0.3, 'sine', 0.08, 0.54, null, 'sfx');
  }
  // 科技研究完成：上升音阶（C-E-G-C）+ 铃铛尾音
  playTechComplete() {
    this.resume();
    const seq = [261.63, 329.63, 392.00, 523.25];
    seq.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.25, i * 0.1, null, 'sfx'));
    this.tone(1567.98, 0.6, 'sine', 0.2, seq.length * 0.1, null, 'sfx');
    this.tone(2093.00, 0.5, 'sine', 0.12, seq.length * 0.1 + 0.06, null, 'sfx');
  }
  // 武将升级：金光闪烁（高频泛音上滑）+ 大三和弦
  playLevelUp() {
    this.resume();
    // 金光：高频快速上滑
    this.tone(880, 0.4, 'sine', 0.18, 0, 1760, 'sfx');
    this.tone(1174.66, 0.4, 'sine', 0.12, 0.1, 2349, 'sfx');
    // C-E-G 大三和弦
    const chord = [261.63, 329.63, 392.00];
    chord.forEach(f => this.tone(f, 0.7, 'triangle', 0.2, 0.2, null, 'sfx'));
    this.drum(0.35, 0.25, 80, 'sfx');
  }
  // 称号解锁：低沉号角（锯齿波长音）+ 大三和弦
  playTitleUnlocked() {
    this.resume();
    // 号角：F3 长音
    this.tone(174.61, 0.8, 'sawtooth', 0.22, 0, null, 'sfx');
    this.tone(220.00, 0.8, 'sawtooth', 0.18, 0.08, null, 'sfx');
    // 大三和弦 C-E-G-C
    const chord = [261.63, 329.63, 392.00, 523.25];
    chord.forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.2, 0.25 + i * 0.06, null, 'sfx'));
    this.drum(0.4, 0.4, 70, 'sfx');
  }
  // 战斗胜利：号角（B♭类号角音）+ 鼓点进行曲
  playBattleVictory() {
    this.resume();
    // 号角三连
    this.tone(293.66, 0.35, 'sawtooth', 0.22, 0, null, 'sfx');
    this.tone(369.99, 0.35, 'sawtooth', 0.22, 0.18, null, 'sfx');
    this.tone(440.00, 0.5, 'sawtooth', 0.24, 0.36, null, 'sfx');
    // 鼓点
    this.drum(0.5, 0, 75, 'sfx');
    this.drum(0.45, 0.2, 75, 'sfx');
    this.drum(0.5, 0.4, 70, 'sfx');
    this.drum(0.6, 0.6, 65, 'sfx');
  }
  // 战斗失败：低沉鼓点（渐弱下行）
  playBattleDefeat() {
    this.resume();
    this.drum(0.5, 0, 60, 'sfx');
    this.drum(0.45, 0.25, 50, 'sfx');
    this.drum(0.4, 0.55, 42, 'sfx');
    this.drum(0.35, 0.85, 36, 'sfx');
    this.tone(196.00, 1.0, 'sine', 0.18, 0.1, 98, 'sfx');
  }
  // 事件触发：悬疑音效（不协和小二度缓慢上行）
  playEventTrigger() {
    this.resume();
    this.tone(220.00, 1.0, 'sine', 0.16, 0, null, 'sfx');
    this.tone(233.08, 1.0, 'sine', 0.14, 0.15, null, 'sfx');
    this.tone(261.63, 1.0, 'sine', 0.14, 0.3, null, 'sfx');
    this.tone(311.13, 1.2, 'sine', 0.12, 0.45, null, 'sfx');
  }
  // 外交成功：轻快上行三和弦
  playDiplomacyOk() {
    this.resume();
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.22, i * 0.09, null, 'sfx'));
    this.tone(2093.00, 0.4, 'sine', 0.1, seq.length * 0.09, null, 'sfx');
  }
  // 外交失败：低沉不协和音（增四度）
  playDiplomacyBad() {
    this.resume();
    this.tone(246.94, 0.5, 'sawtooth', 0.18, 0, null, 'sfx');
    this.tone(349.23, 0.6, 'sawtooth', 0.16, 0.12, null, 'sfx');
    this.tone(196.00, 0.7, 'sine', 0.15, 0.3, null, 'sfx');
  }
  // 招募成功：欢迎音效（明亮琶音）
  playWelcome() {
    this.resume();
    const seq = [392.00, 523.25, 659.25, 783.99];
    seq.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.22, i * 0.08, null, 'sfx'));
    this.drum(0.3, 0.3, 90, 'sfx');
  }
  // 周目继承启动：史诗和弦（全音阶大和弦+大鼓）
  playNGPlusStart() {
    this.resume();
    const chord = [130.81, 196.00, 261.63, 329.63, 392.00, 523.25];
    chord.forEach((f, i) => this.tone(f, 1.5, 'sine', 0.22, i * 0.1, null, 'sfx'));
    this.tone(1046.5, 1.2, 'triangle', 0.15, 0.6, null, 'sfx');
    this.drum(0.5, 0.3, 55, 'sfx');
    this.drum(0.4, 0.8, 60, 'sfx');
  }

  // ---------- 静音 / 音量 ----------
  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.muted;
  }

  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }
  setBGMVolume(v) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume * 0.5, this.ctx.currentTime);
    }
  }
  setSFXVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }
  // 兼容旧接口
  setVolume(v) { this.setMasterVolume(v); }

  // ---------- 场景化 BGM ----------
  // 切换 BGM 场景：menu/map/battle/event/interior/ending
  switchBGM(scene) {
    if (this._currentTrack === scene) return;
    this._currentTrack = scene;
    this.stopBGM();
    this.startBGM(scene);
  }

  startBGM(scene) {
    scene = scene || this._currentTrack || 'map';
    this._currentTrack = scene;
    const track = BGM_TRACKS[scene];
    if (!track) return;
    this.resume();
    if (!this.ctx) return;
    this._bgmOn = true;
    this._bgmStep = 0;
    // 淡入：bgmGain 从 0 到目标值（2秒）
    if (this.bgmGain && this.ctx) {
      const t0 = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(t0);
      this.bgmGain.gain.setValueAtTime(0.0001, t0);
      this.bgmGain.gain.linearRampToValueAtTime(this.bgmVolume * 0.5, t0 + 2.0);
    }
    this._bgmTimer = setInterval(() => this._bgmTick(track), track.stepMs);
  }

  stopBGM() {
    this._bgmOn = false;
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
    // 淡出：bgmGain 到 0（2秒）
    if (this.bgmGain && this.ctx) {
      const t0 = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(t0);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t0);
      this.bgmGain.gain.linearRampToValueAtTime(0.0001, t0 + 2.0);
    }
  }

  _bgmTick(track) {
    if (!this.ctx || this.muted || !this._bgmOn) return;
    const t0 = this.ctx.currentTime;
    const scale = track.scale;
    // 旋律：按概率在音阶中选音（密度控制旋律稀疏度）
    if (Math.random() < track.density) {
      const noteName = scale[Math.floor(Math.random() * scale.length)];
      const freq = PENTATONIC[noteName] || 440;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = track.wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(t0); osc.stop(t0 + 0.65);
    }
    // 鼓点
    if (track.hasDrum && this._bgmStep % 4 === 0) this._bgmDrum(t0);
    // 低音：每 4 拍一个低音
    if (this._bgmStep % 4 === 0) {
      const bassNote = scale[0];
      const bassFreq = PENTATONIC[bassNote] || 110;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = track.bassWave;
      osc.frequency.value = bassFreq / 2;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(t0); osc.stop(t0 + 0.85);
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
