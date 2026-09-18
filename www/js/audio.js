// ============================================================
// audio.js — 程序化音效 + 古风背景音乐（Web Audio API）
// ------------------------------------------------------------
// V8.1 程序化音效与环境氛围音大扩充：
//   - 新增 8 种战斗音效（兵刃相交/马蹄冲锋/箭矢破空/火攻爆裂/
//     士兵呐喊/盾牌格挡/弓兵齐射/将领单挑）
//   - 新增 7 种 UI 反馈音（按钮/面板开合/金币/建造/错误/通知）
//   - 新增 4 种循环环境氛围音（市井/战场/风雨/宫廷）
//   - 新增 4 首 BGM（navy 海战 / diplomacy 外交 /
//     victory 胜利 / defeat 失败）
//   - 混音分层：master → bgmGain + sfxGain + ambientGain
//   - SFX 触发时 BGM 自动侧链 ducking（降至 70%，0.3s 恢复）
// V3.5 技术参考：
// 1) Web Audio API 程序化音乐：用 OscillatorNode 生成音符，
//    GainNode 做 ADSR 包络，AudioContext.currentTime 调度音符序列。
//    五声音阶频率（十二平均律）：
//    C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00
//    参考：MDN Web Audio API 教程 + 中国音乐学院五声调式理论。
// 2) 场景化 BGM：每首 BGM 用 setInterval 调度旋律，切换时
//    先淡出旧 BGM（2秒），再淡入新 BGM。
// 3) 音量分层：masterGain（总输出）→ bgmGain（背景音乐）+
//    sfxGain（音效）+ ambientGain（环境音总线），互不干扰。
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
  },
  // ---- V8.1 新增 4 首 BGM ----
  navy: {   // 海战：D商调，90BPM，波浪起伏 + 号角
    bpm: 90, scale: ['D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
    wave: 'triangle', bassWave: 'sine', stepMs: 400, hasDrum: true, density: 0.7
  },
  diplomacy: { // 外交：C宫调，66BPM，古琴+箫，优雅从容
    bpm: 66, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    wave: 'sine', bassWave: 'sine', stepMs: 750, hasDrum: false, density: 0.5
  },
  victory: { // 胜利：G宫调，100BPM，编钟+大鼓，辉煌庄严
    bpm: 100, scale: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 350, hasDrum: true, density: 0.85
  },
  defeat: { // 失败：A羽调，48BPM，箫+古琴低回，悲伤肃穆
    bpm: 48, scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    wave: 'sine', bassWave: 'sine', stepMs: 1000, hasDrum: false, density: 0.4
  },

  // ============================================================
  // V9.5 新增 5 首 BGM（音乐系统深化）
  // 历史参考：南北朝音乐承汉魏清商三调（平/清/瑟），融吴声西曲，
  //   南朝尚丝竹（古琴/筝/笛/笙），北朝杂鼓吹（胡角/鼓/筚篥）。
  //   清乐"慷慨吐清音，明转出天然"，故旋律走五声宫/羽调式。
  //   参考：《通典·乐六》清商三调；云冈石窟乐器图像学研究。
  // ============================================================
  dynasty: {  // 王朝：登基/禅让，C宫，66BPM，编钟+弦乐铺底，庄严
    bpm: 66, scale: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 700, hasDrum: true, density: 0.6
  },
  exam: {     // 科举：放榜，G宫，96BPM，扬琴+笛，喜庆明快
    bpm: 96, scale: ['G4', 'A4', 'B4' /*7*/, 'C5', 'D5', 'E5', 'G5', 'A5'],
    wave: 'triangle', bassWave: 'triangle', stepMs: 360, hasDrum: true, density: 0.85
  },
  grandbattle: { // 会战：D商，132BPM，快鼓+号角，激昂
    bpm: 132, scale: ['D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'D5'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 240, hasDrum: true, density: 0.95
  },
  culture: {  // 文化：清商，A羽，66BPM，古筝+箫，悠扬清越
    bpm: 66, scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    wave: 'sine', bassWave: 'sine', stepMs: 850, hasDrum: false, density: 0.55
  },
  harem: {    // 后宫：C宫，58BPM，琵琶+笛，柔美婉转
    bpm: 58, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
    wave: 'sine', bassWave: 'sine', stepMs: 900, hasDrum: false, density: 0.5
  },

  // ============================================================
  // V13.0 新增 2 首 BGM
  // ============================================================
  scenarioSelect: { // 剧本选择：C宫调，72BPM，古筝+箫，古风悠扬
    bpm: 72, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 600, hasDrum: false, density: 0.65
  },
  cityManage: {     // 城市管理：D商调，60BPM，古琴+竹笛，宁静雅致
    bpm: 60, scale: ['D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
    wave: 'sine', bassWave: 'sine', stepMs: 800, hasDrum: false, density: 0.45
  }
};

// V9.5：BGM 元信息（中文名/乐器描述/解锁条件描述），供音乐播放列表 UI
export const BGM_INFO = {
  menu:        { name: '玄圃琴音',   desc: '主菜单·古琴箫声' },
  map:         { name: '山河壮阔',   desc: '大地图·古筝鼓角' },
  battle:      { name: '金戈铁马',   desc: '战斗·鼓角争鸣' },
  event:       { name: '夜雨对谈',   desc: '事件·箫声叙事' },
  interior:    { name: '垂拱而治',   desc: '内政·扬琴笛声' },
  ending:      { name: '鼎定山河',   desc: '结局·编钟史诗' },
  navy:        { name: '横江楼船',   desc: '水战·波浪号角' },
  diplomacy:   { name: '折冲樽俎',   desc: '外交·古琴雅乐' },
  victory:     { name: '凯旋',       desc: '胜利·编钟鼓乐' },
  defeat:      { name: '秋风悲扇',   desc: '失败·箫声低回' },
  dynasty:     { name: '开国韶乐',   desc: '王朝·编钟庄严' },
  exam:        { name: '金榜题名',   desc: '科举·扬琴喜庆' },
  grandbattle: { name: '会战雷霆',   desc: '会战·鼓角激昂' },
  culture:     { name: '清商雅韵',   desc: '文化·古筝箫声' },
  harem:       { name: '后庭花影',   desc: '后宫·琵琶柔美' },
  // V13.0 新增
  scenarioSelect: { name: '宏图待展', desc: '剧本选择·古筝箫声' },
  cityManage:     { name: '安居乐业', desc: '城市管理·古琴竹笛' }
};

// V9.5：初始解锁的 BGM（主菜单/大地图/战斗/事件/内政/结局 + 既有 V8.1 四首）
const DEFAULT_UNLOCKED_BGM = ['menu', 'map', 'battle', 'event', 'interior', 'ending',
  'navy', 'diplomacy', 'victory', 'defeat'];

export class AudioManager {
  constructor() {
    this.ctx = null;          // AudioContext，首次用户交互后才创建
    this.master = null;       // 主增益节点
    this.bgmGain = null;      // 背景音乐总线
    this.sfxGain = null;      // 音效总线
    this.ambientGain = null;  // V8.1 环境音总线
    this.skillGain = null;    // V13.0 技能音效独立总线
    this._ambientSidechain = null; // V13.0 环境音侧链压缩器
    this.muted = false;
    this.masterVolume = 0.8;
    this.bgmVolume = 0.6;
    this.sfxVolume = 0.8;
    this.ambientVolume = 0.5; // V8.1 环境音默认音量
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;
    this._currentTrack = null;

    // V8.1 环境音状态
    this._ambientTimer = null;
    this._ambientNodes = [];  // 持续发声的节点（噪声源/振荡器），停止时统一关闭
    this._ambientName = null;
    this._ambientStep = 0;

    // V8.1 BGM 侧链 ducking 状态
    this._duckingOn = false;
    // V13.0：ducking 优化——压至 65%（原70%），0.25s 恢复（原0.3s），响应更快
    this._duckFactor = 0.65;   // ducking 时 BGM 音量降至 65%
    this._duckDuration = 0.25;  // ducking 持续秒数

    // 五声音阶：宫 商 角 徵 羽
    this.pentatonic = [0, 2, 4, 7, 9];
    this.baseFreq = 220;

    // ---- V9.5 音乐播放列表 / 解锁系统 ----
    this.unlockedBGMs = DEFAULT_UNLOCKED_BGM.slice(); // 已解锁 BGM id
    this.favoriteBGMs = new Set();                     // 收藏的 BGM id
    this.playMode = 'sequential';                      // 'sequential' | 'random'
    this._playlistPos = 0;                             // 播放列表游标（解锁序列内）
    this._prefSceneBGM = null;                          // 场景自动 BGM（用户手动切歌前的目标）

    // ---- V10.5 音效重叠保护 ----
    // 同一命名音效在 _sfxCooldown(ms) 内重复触发直接丢弃，避免连击/高频事件下
    // 多组 osc/gain 节点叠加导致的音量爆音与 GC 压力。
    this._sfxLastPlay = new Map();   // name -> 上次播放时间戳(ms)
    this._sfxCooldown = 100;         // 默认 0.1s 内不重复
  }

  // V10.5：音效重叠保护闸门。
  // 返回 true 表示允许本次播放（并记录时间）；返回 false 表示在冷却期内应丢弃。
  // name 为音效名；cooldown 可覆盖默认 100ms。
  _sfxGate(name, cooldown) {
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const cd = (typeof cooldown === 'number') ? cooldown : this._sfxCooldown;
    const last = this._sfxLastPlay.get(name) || 0;
    if (now - last < cd) return false;   // 冷却期内，丢弃
    this._sfxLastPlay.set(name, now);
    return true;
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
        // V8.1 环境音总线
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = this.ambientVolume;
        this.ambientGain.connect(this.master);
        // V13.0：技能音效独立总线（skillGain）——武将技/连携技等
        // 技能音效走独立增益节点，便于单独控制音量而不影响普通 SFX。
        this.skillGain = this.ctx.createGain();
        this.skillGain.gain.value = this.sfxVolume * 0.9;
        this.skillGain.connect(this.sfxGain);
        // V13.0：环境音与 BGM 侧链压缩优化
        // 当 BGM 播放时，通过侧链压缩器轻微压低环境音，避免两者互相掩蔽。
        if (this.ctx.createDynamicsCompressor) {
          this._ambientSidechain = this.ctx.createDynamicsCompressor();
          this._ambientSidechain.threshold.value = -24;
          this._ambientSidechain.knee.value = 12;
          this._ambientSidechain.ratio.value = 2;
          this._ambientSidechain.attack.value = 0.01;
          this._ambientSidechain.release.value = 0.3;
          // 旁路：ambientGain → compressor → master（不直接连 master）
          this.ambientGain.disconnect();
          this.ambientGain.connect(this._ambientSidechain);
          this._ambientSidechain.connect(this.master);
        }
      } catch (e) { /* 环境不支持音频时静默降级 */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ---------- 基础发声原语 ----------
  // 单个音：频率 freq，时长 dur，波形 type，峰值增益 vol，起始偏移 offset，滑音目标 glide
  // bus: 'master' | 'bgm' | 'sfx'
  // pan: 立体声定位 -1(左)~1(右)~0(中)。技术参考：MDN StereoPannerNode 等功率定位。
  //       参考: https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode
  // V7.5：为音色添加 ADSR 包络（Attack 起音 / Decay 衰减 / Sustain 维持 / Release 释放），
  //       所有音效峰值音量统一收敛到 0.1~0.3，避免刺耳。
  tone(freq, dur, type = 'sine', vol = 0.2, offset = 0, glide = null, bus = 'master', pan = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    // ADSR 包络：A=0.01 快起音，D 到 70%，S 维持，R 末尾释放
    const peak = Math.max(0.05, Math.min(0.3, vol));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);            // Attack
    g.gain.exponentialRampToValueAtTime(peak * 0.7, t0 + 0.08);    // Decay
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);          // Release
    osc.connect(g);
    // 立体声：若 pan 非零且支持则插入 StereoPannerNode
    let outNode = g;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const sp = this.ctx.createStereoPanner();
      sp.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(sp);
      outNode = sp;
    }
    const dest = bus === 'bgm' ? this.bgmGain : (bus === 'sfx' ? this.sfxGain : (bus === 'skill' ? this.skillGain : this.master));
    outNode.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // V7.5：钟声/编钟 —— 金属敲击，高频泛音叠加 + 长尾衰减
  // freq 基频；bells 叠加泛音数；vol 峰值
  bell(freq, dur = 1.2, vol = 0.22, offset = 0, pan = 0) {
    if (!this.ctx || this.muted) return;
    // 基音 + 第二/第三泛音（钟声非整数比泛音更真实）
    this.tone(freq, dur, 'sine', vol, offset, null, 'sfx', pan);
    this.tone(freq * 2.76, dur * 0.6, 'sine', vol * 0.4, offset, null, 'sfx', pan); // 非谐泛音
    this.tone(freq * 5.40, dur * 0.3, 'sine', vol * 0.2, offset, null, 'sfx', pan);
  }

  // V7.5：号角 —— 锯齿波长音（庄严/军乐感），可带轻微滑音
  horn(freq, dur = 0.8, vol = 0.22, offset = 0, glide = null, pan = 0) {
    this.tone(freq, dur, 'sawtooth', vol, offset, glide, 'sfx', pan);
    this.tone(freq * 1.5, dur * 0.8, 'triangle', vol * 0.5, offset + 0.05, null, 'sfx', pan);
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
    const out = bus === 'bgm' ? this.bgmGain : (bus === 'sfx' ? this.sfxGain : (bus === 'skill' ? this.skillGain : this.master));
    g.connect(out);
    osc.start(t0); osc.stop(t0 + 0.3);
  }

  // ============================================================
  // V8.1 基础合成工具：噪声 buffer / 侧链 ducking / 环境音总线
  // ============================================================
  // 生成一段白噪声 AudioBuffer（秒）。无 ctx 时返回 null。
  _noiseBuffer(seconds = 1) {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 启动一个噪声源（可循环），返回 {src, gain, filter} 节点句柄，供环境音持有
  _startNoiseLoop({ freq = 1000, q = 1, type = 'bandpass', vol = 0.1, loop = true, bus = 'ambient' } = {}) {
    if (!this.ctx) return null;
    const buf = this._noiseBuffer(2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g);
    const out = bus === 'bgm' ? this.bgmGain : (bus === 'sfx' ? this.sfxGain : this.ambientGain);
    g.connect(out);
    src.start();
    return { src, gain: g, filter };
  }

  // 关闭一组节点句柄（环境音停止时调用）
  _stopNodes(handle) {
    if (!handle) return;
    try { handle.src && handle.src.stop(); } catch (e) {}
    try { handle.src && handle.src.disconnect(); } catch (e) {}
    try { handle.gain && handle.gain.disconnect(); } catch (e) {}
  }

  // BGM 侧链 ducking：SFX 触发时把 BGM 音量压到 70%，0.3s 后恢复
  // 用 setValueAtTime / linearRampToValueAtTime 实现，不影响正在播放的音符
  _duckBGM() {
    if (!this.ctx || !this.bgmGain || !this._bgmOn) return;
    const t0 = this.ctx.currentTime;
    const target = this.bgmVolume * 0.5;       // 正常 BGM 目标音量
    const ducked = target * this._duckFactor;  // 压低到 70%
    try {
      this.bgmGain.gain.cancelScheduledValues(t0);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t0);
      this.bgmGain.gain.linearRampToValueAtTime(ducked, t0 + 0.05);
      this.bgmGain.gain.setValueAtTime(ducked, t0 + this._duckDuration);
      this.bgmGain.gain.linearRampToValueAtTime(target, t0 + this._duckDuration + 0.1);
    } catch (e) { /* 忽略调度冲突 */ }
  }

  // V8.1 环境音音量
  setAmbientVolume(v) {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
    }
  }

  // ---------- 具体音效（复用原有 + V3.5 新增） ----------
  // V10.5：高频 UI 音效加 0.1s 重叠保护，防止连击/滚动时爆音
  playClick()   { this.resume(); if (!this._sfxGate('click')) return; this.tone(880, 0.08, 'triangle', 0.25, 0, null, 'sfx'); this.tone(1320, 0.06, 'sine', 0.12, 0.02, null, 'sfx'); }
  playHover()   { this.resume(); if (!this._sfxGate('hover', 60)) return; this.tone(660, 0.04, 'sine', 0.06, 0, null, 'sfx'); }

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

  // ============================================================
  // V7.5 新增音效（10个）：登基/禅让/官职/爵位/贸易/商队/文化/科举/亡国/统一
  // 全部 OscillatorNode + GainNode 合成，带 ADSR 包络，音量 0.1~0.3
  // 技术参考：Web Audio API 合成打击乐/铃声——
  //   钟声=基频+非谐泛音(2.76x/5.40x)长尾；号角=锯齿波长音+五度泛音；
  //   钱币=高频正弦快速双音；驼铃=高频短促正弦周期性重复。
  //   参考: MDN Web Audio API Advanced techniques（噪声/铃声合成）
  // ============================================================
  // 1. 登基音效：钟声 + 号角（庄严）
  playAccession() {
    this.resume();
    this.bell(261.63, 2.0, 0.25, 0, 0);          // 主钟 C4
    this.bell(392.00, 1.8, 0.18, 0.15, 0);       // 和钟 G4
    this.horn(196.00, 1.2, 0.22, 0.3, null, 0);  // 号角 G3
    this.horn(293.66, 1.0, 0.18, 0.5, null, 0);  // 号角 D4
    this.drum(0.5, 0.4, 60, 'sfx');
    this.drum(0.4, 0.9, 65, 'sfx');
  }
  // 2. 禅让音效：钟声 + 弦乐（肃穆）
  playAbdication() {
    this.resume();
    this.bell(220.00, 2.2, 0.22, 0, 0);           // 低沉钟 A3
    this.bell(261.63, 2.0, 0.16, 0.3, 0);         // C4
    // 弦乐（长音正弦铺底）
    this.tone(174.61, 2.0, 'sine', 0.12, 0.2, null, 'sfx', -0.3);
    this.tone(220.00, 2.0, 'sine', 0.12, 0.25, null, 'sfx', 0.3);
    this.drum(0.3, 0.5, 50, 'sfx');
  }
  // 3. 官职任命：印章声（低频短促）+ 古琴（泛音）
  playAppointOffice() {
    this.resume();
    // 印章：低频方波短促敲击
    this.tone(180, 0.12, 'square', 0.22, 0, null, 'sfx');
    this.tone(120, 0.15, 'sine', 0.18, 0.02, null, 'sfx');
    // 古琴：散音（正弦长音 + 泛音）
    this.tone(523.25, 0.8, 'sine', 0.16, 0.15, null, 'sfx', 0.2);
    this.tone(783.99, 0.6, 'sine', 0.10, 0.2, null, 'sfx', 0.2);
  }
  // 4. 爵位封赏：号角 + 鼓声
  playGrantTitle() {
    this.resume();
    this.horn(329.63, 0.4, 0.22, 0, null, 0);
    this.horn(440.00, 0.5, 0.22, 0.2, null, 0);
    this.drum(0.5, 0.3, 75, 'sfx');
    this.drum(0.45, 0.5, 70, 'sfx');
  }
  // 5. 贸易收入：钱币声（高频双音）+ 古琴尾音
  playTradeIncome() {
    this.resume();
    this.tone(1567.98, 0.1, 'sine', 0.18, 0, null, 'sfx', 0.3);
    this.tone(2093.00, 0.16, 'sine', 0.14, 0.07, null, 'sfx', 0.3);
    this.tone(2637.00, 0.12, 'sine', 0.08, 0.14, null, 'sfx', 0.3);
    this.tone(523.25, 0.5, 'sine', 0.10, 0.2, null, 'sfx', -0.2);
  }
  // 6. 商队出发：驼铃声（高频短促重复）+ 风声（低频噪声感）
  playCaravanDepart() {
    this.resume();
    // 驼铃：周期性高频短促音
    for (let i = 0; i < 4; i++) {
      this.tone(1244.51, 0.1, 'sine', 0.12, i * 0.18, null, 'sfx', (i % 2 ? 0.4 : -0.4));
    }
    // 风声：低频缓慢滑音
    this.tone(120, 1.2, 'sawtooth', 0.08, 0, 80, 'sfx', 0);
    this.tone(90, 1.0, 'sine', 0.08, 0.1, 60, 'sfx', 0);
  }
  // 7. 文化繁荣：编钟声 + 弦乐
  playCultureBoom() {
    this.resume();
    const notes = [523.25, 587.33, 659.25, 783.99];
    notes.forEach((f, i) => this.bell(f, 1.0, 0.16, i * 0.15, (i - 1.5) * 0.15));
    this.tone(261.63, 1.5, 'sine', 0.10, 0.3, null, 'sfx', 0);
    this.tone(329.63, 1.5, 'sine', 0.10, 0.35, null, 'sfx', 0);
  }
  // 8. 科举选拔：古琴 + 鼓声
  playExamSelect() {
    this.resume();
    // 古琴泛音
    this.tone(659.25, 0.7, 'sine', 0.14, 0, null, 'sfx', 0);
    this.tone(880.00, 0.6, 'sine', 0.12, 0.1, null, 'sfx', 0);
    this.tone(1046.5, 0.5, 'sine', 0.10, 0.2, null, 'sfx', 0);
    this.drum(0.4, 0.35, 65, 'sfx');
  }
  // 9. 王朝灭亡：低沉号角 + 鼓声（渐弱下行）
  playDynastyFall() {
    this.resume();
    this.horn(130.81, 1.5, 0.24, 0, 65, 0);   // 低频号角滑音下行
    this.drum(0.5, 0, 55, 'sfx');
    this.drum(0.45, 0.25, 45, 'sfx');
    this.drum(0.4, 0.55, 38, 'sfx');
    this.tone(98.00, 1.5, 'sine', 0.16, 0.2, 49, 'sfx', 0);
  }
  // 10. 统一全国：盛大号角 + 编钟 + 鼓声
  playUnifyChina() {
    this.resume();
    // 编钟齐鸣
    const chimes = [261.63, 329.63, 392.00, 523.25, 659.25];
    chimes.forEach((f, i) => this.bell(f, 2.0, 0.20, i * 0.1, 0));
    // 号角
    this.horn(196.00, 1.5, 0.22, 0.2, null, -0.3);
    this.horn(293.66, 1.5, 0.22, 0.3, null, 0.3);
    this.horn(392.00, 1.8, 0.24, 0.5, null, 0);
    // 鼓点进行曲
    [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((t, i) =>
      this.drum(0.45 - i * 0.03, t, 70 - i * 4, 'sfx'));
    this.tone(1046.5, 1.5, 'triangle', 0.15, 0.8, null, 'sfx', 0);
  }

  // ============================================================
  // V8.1 新增：战斗音效（8 种）
  // 全部 Web Audio 程序化合成：噪声 burst + 振荡器 + BiquadFilter
  // ============================================================

  // 1. 兵刃相交：高频噪声 burst + 2kHz 快速衰减正弦，0.15s
  playSwordClash() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    const t0 = this.ctx.currentTime;
    // 高频噪声 burst
    const nb = this._noiseBuffer(0.15);
    const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.25, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    nsrc.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
    nsrc.start(t0); nsrc.stop(t0 + 0.15);
    // 2kHz 金属正弦
    this.tone(2000, 0.15, 'square', 0.15, 0, null, 'sfx');
    this.tone(2600, 0.1, 'sine', 0.1, 0, null, 'sfx');
  }

  // 2. 马蹄冲锋：低频脉冲序列 60-80Hz，间隔 0.1s 渐快 + 噪声，0.8s
  playCavalryCharge() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    // 8 个脉冲，间隔从 0.12s 渐快到 0.06s
    let t = 0;
    for (let i = 0; i < 8; i++) {
      const f = 60 + (i % 2) * 15;
      this.drum(0.4, t, f, 'sfx');
      // 马蹄噪声
      const t0 = this.ctx.currentTime + t;
      const nb = this._noiseBuffer(0.05);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 1.5;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.15, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      nsrc.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.05);
      t += 0.12 - i * 0.008;
    }
  }

  // 3. 箭矢破空：带通滤波噪声 4kHz→800Hz 扫频，0.2s
  playArrowShoot(offset = 0) {
    this.resume(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime + offset;
    const nb = this._noiseBuffer(0.2);
    const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 3;
    nf.frequency.setValueAtTime(4000, t0);
    nf.frequency.exponentialRampToValueAtTime(800, t0 + 0.2);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    nsrc.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
    nsrc.start(t0); nsrc.stop(t0 + 0.2);
  }

  // 4. 火攻爆裂：低频 boom 80Hz 快速衰减 + 中高频 crackle，0.5s
  playFireBurst() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    // 低频 boom
    this.drum(0.7, 0, 80, 'sfx');
    this.tone(80, 0.4, 'sine', 0.3, 0, 40, 'sfx');
    // 中高频 crackle：一串短噪声
    for (let i = 0; i < 6; i++) {
      const t0 = this.ctx.currentTime + 0.05 + i * 0.07;
      const nb = this._noiseBuffer(0.04);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1500;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      nsrc.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.04);
    }
  }

  // 5. 士兵呐喊：多个中频振荡器 200-400Hz 失谐叠加 + 振幅调制，0.6s
  playBattleCry() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    const freqs = [200, 240, 290, 340, 380];
    freqs.forEach((f, i) => {
      const detune = (i - 2) * 8; // 失谐
      this.tone(f, 0.6, 'sawtooth', 0.08, 0, f * 1.2, 'sfx', (i - 2) * 0.15);
      // 振幅调制（LFO）
      if (this.ctx) {
        const t0 = this.ctx.currentTime;
        const lfo = this.ctx.createOscillator();
        const lfoG = this.ctx.createGain();
        lfo.frequency.value = 8 + i;
        lfoG.gain.value = 0.04;
        lfo.connect(lfoG);
        // LFO 调制挂到主 tone 的 gain 上（这里仅触发，不做精细路由）
        lfo.start(t0); lfo.stop(t0 + 0.6);
      }
    });
  }

  // 6. 盾牌格挡：中高频短促金属 1.5kHz 正弦 0.08s + 低频闷响
  playShieldBlock() {
    this.resume(); if (!this.ctx) return;
    this.tone(1500, 0.08, 'sine', 0.2, 0, null, 'sfx');
    this.tone(1800, 0.06, 'square', 0.08, 0, null, 'sfx');
    // 低频闷响
    this.drum(0.35, 0, 120, 'sfx');
    this.tone(90, 0.12, 'sine', 0.15, 0, null, 'sfx');
  }

  // 7. 弓兵齐射：3-5 支 arrowShoot 错开 0.05s
  playVolley() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    const n = 4;
    for (let i = 0; i < n; i++) this.playArrowShoot(i * 0.05);
  }

  // 8. 将领单挑：swordClash 重低音增强版 + 回声（DelayNode）
  playDuelClash() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    // 主体兵刃声
    this.playSwordClash();
    // 重低音增强
    this.drum(0.5, 0, 70, 'sfx');
    this.tone(120, 0.25, 'square', 0.18, 0, null, 'sfx');
    // 回声：DelayNode 反馈
    if (this.ctx) {
      const t0 = this.ctx.currentTime;
      const nb = this._noiseBuffer(0.15);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2500;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.18, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      // 回声链路：ng → delay → feedback → delay → sfxGain
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.18;
      const fb = this.ctx.createGain(); fb.gain.value = 0.35;
      const wet = this.ctx.createGain(); wet.gain.value = 0.5;
      nsrc.connect(nf); nf.connect(ng);
      ng.connect(this.sfxGain);
      ng.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(this.sfxGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.15);
    }
  }

  // ============================================================
  // V8.1 新增：UI 反馈音（7 种）
  // ============================================================

  // 按钮点击：短促高频 1.2kHz 正弦快衰减，0.05s
  playButtonClick() {
    this.resume(); if (!this.ctx) return;
    this.tone(1200, 0.05, 'sine', 0.18, 0, null, 'sfx');
  }

  // 面板开启：上升音阶（五声音阶 3 音快速上行），0.2s
  playPanelOpen() {
    this.resume(); if (!this.ctx) return;
    const seq = [523.25, 587.33, 659.25]; // C5 D5 E5 上行
    seq.forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.18, i * 0.06, null, 'sfx'));
  }

  // 面板关闭：下降音阶，0.15s
  playPanelClose() {
    this.resume(); if (!this.ctx) return;
    const seq = [659.25, 587.33, 523.25]; // E5 D5 C5 下行
    seq.forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.16, i * 0.05, null, 'sfx'));
  }

  // 金币/收入：高频清脆 1.8kHz + 2.4kHz 双音，0.1s
  playCoinSound() {
    this.resume(); if (!this.ctx) return;
    this.tone(1800, 0.1, 'sine', 0.18, 0, null, 'sfx');
    this.tone(2400, 0.1, 'sine', 0.14, 0.05, null, 'sfx');
  }

  // 征兵/建造：低频敲击 150Hz + 木质噪声，0.15s
  playBuildSound() {
    this.resume(); if (!this.ctx) return;
    this.drum(0.45, 0, 150, 'sfx');
    this.tone(150, 0.15, 'square', 0.15, 0, null, 'sfx');
    // 木质噪声：带通噪声 800Hz
    if (this.ctx) {
      const t0 = this.ctx.currentTime;
      const nb = this._noiseBuffer(0.12);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      nsrc.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.12);
    }
  }

  // 错误/禁止：低频 buzz 100Hz 方波，0.2s
  playError() {
    this.resume(); if (!this.ctx) return;
    this.tone(100, 0.2, 'square', 0.2, 0, null, 'sfx');
    this.tone(105, 0.2, 'square', 0.12, 0.02, null, 'sfx');
  }

  // 通知/成就：上升三音琶音（五声音阶），0.3s
  playNotify() {
    this.resume(); if (!this.ctx) return;
    const seq = [523.25, 659.25, 783.99]; // C5 E5 G5 琶音
    seq.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, i * 0.08, null, 'sfx'));
  }

  // ============================================================
  // V9.5 新增音效（10 个）：军团/会战/阵法/科举/赋税/徭役/节气/异象/皇子
  // 全部 OscillatorNode + GainNode 合成，复用 bell/horn/drum/tone 原语。
  // ============================================================
  // 1. 军团编制：号角 + 整齐鼓点（集结感）
  playLegionForm() {
    this.resume(); if (!this.ctx) return;
    this.horn(220.00, 0.5, 0.2, 0, null, 0);
    this.horn(329.63, 0.5, 0.18, 0.15, null, 0);
    [0, 0.2, 0.4, 0.6].forEach((t) => this.drum(0.4, t, 85, 'sfx'));
  }
  // 2. 会战开始：急促战鼓 + 号角三连（紧张激昂）
  playGrandBattleStart() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    this.horn(196.00, 0.4, 0.24, 0, null, 0);
    this.horn(261.63, 0.4, 0.24, 0.15, null, 0);
    this.horn(329.63, 0.6, 0.26, 0.3, null, 0);
    [0, 0.12, 0.24, 0.36, 0.5, 0.66].forEach((t, i) => this.drum(0.45, t, 90 - i * 4, 'sfx'));
  }
  // 3. 会战胜利：大号角 + 编钟 + 鼓点进行曲（辉煌）
  playGrandBattleWin() {
    this.resume(); if (!this.ctx) return;
    const chimes = [261.63, 329.63, 392.00, 523.25];
    chimes.forEach((f, i) => this.bell(f, 1.6, 0.2, i * 0.12, 0));
    this.horn(392.00, 1.2, 0.24, 0.3, null, 0);
    [0, 0.2, 0.4, 0.6, 0.8].forEach((t) => this.drum(0.45, t, 75, 'sfx'));
  }
  // 4. 阵法切换：兵器轻鸣 + 古琴泛音（利落）
  playFormationSwitch() {
    this.resume(); if (!this.ctx) return;
    this.tone(1500, 0.08, 'sine', 0.16, 0, null, 'sfx');
    this.tone(523.25, 0.4, 'sine', 0.14, 0.08, null, 'sfx');
    this.tone(783.99, 0.3, 'sine', 0.1, 0.16, null, 'sfx');
  }
  // 5. 科举放榜：扬琴琶音 + 小锣（喜庆）
  playExamHuangbang() {
    this.resume(); if (!this.ctx) return;
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, i * 0.09, null, 'sfx'));
    this.bell(2093.00, 0.8, 0.14, seq.length * 0.09, 0);
    this.drum(0.3, seq.length * 0.09, 70, 'sfx');
  }
  // 6. 赋税调整：算盘拨珠（高频短促双音重复）+ 铜钱
  playTaxAdjust() {
    this.resume(); if (!this.ctx) return;
    for (let i = 0; i < 3; i++) {
      this.tone(1760 + i * 120, 0.06, 'square', 0.1, i * 0.08, null, 'sfx');
    }
    this.tone(2093.00, 0.15, 'sine', 0.12, 0.3, null, 'sfx');
  }
  // 7. 徭役征发：号令声（低频号角）+ 沉重脚步鼓点
  playCorveeConscript() {
    this.resume(); if (!this.ctx) return;
    this.horn(146.83, 0.7, 0.22, 0, null, 0);
    [0.3, 0.55, 0.8, 1.05].forEach((t) => this.drum(0.4, t, 60, 'sfx'));
  }
  // 8. 节气变化：风铃（高频泛音渐弱）
  playSolarTerm() {
    this.resume(); if (!this.ctx) return;
    const notes = [880.00, 1046.5, 1174.66, 1318.5];
    notes.forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, i * 0.18, null, 'sfx', (i - 1.5) * 0.1));
  }
  // 9. 天文异象：悬疑下行不协和音 + 低音轰鸣
  playCelestialAnomaly() {
    this.resume(); if (!this.ctx) return;
    this.tone(440.00, 1.0, 'sine', 0.16, 0, null, 'sfx');
    this.tone(415.30, 1.0, 'sine', 0.14, 0.2, null, 'sfx');
    this.tone(392.00, 1.2, 'sine', 0.14, 0.4, null, 'sfx');
    this.drum(0.4, 0.3, 55, 'sfx');
    this.tone(55, 1.2, 'sawtooth', 0.1, 0.3, 40, 'sfx');
  }
  // 10. 皇子出生：编钟吉庆 + 上行琶音（温润）
  playPrinceBorn() {
    this.resume(); if (!this.ctx) return;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.bell(f, 1.0, 0.16, i * 0.12, (i - 1.5) * 0.15));
    this.tone(261.63, 1.2, 'sine', 0.12, 0.4, null, 'sfx');
    this.tone(392.00, 1.2, 'sine', 0.12, 0.45, null, 'sfx');
  }

  // ============================================================
  // V10.5 新增音效（3个）：升级金光 / 贸易钱币 / 登基金箔
  // 均复用 tone/bell/coin 原语，峰值音量经 ADSR 收敛至 0.1~0.3。
  // ============================================================
  // 11. 升级金光：高频上行泛音 + 金粉闪烁（清脆上扬）
  playUpgradeGlow() {
    this.resume(); if (!this.ctx || !this._sfxGate('upgrade_glow')) return;
    const seq = [783.99, 987.77, 1174.66, 1567.98];
    seq.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.18, i * 0.07, null, 'sfx'));
    this.tone(2093.00, 0.4, 'sine', 0.1, seq.length * 0.07, null, 'sfx');
  }
  // 12. 贸易钱币：铜钱连续清脆弹跳（高频短促，左右声像交替）
  playTradeCoins() {
    this.resume(); if (!this.ctx || !this._sfxGate('trade_coins', 120)) return;
    for (let i = 0; i < 4; i++) {
      this.tone(1567.98 + i * 80, 0.09, 'sine', 0.14, i * 0.07, null, 'sfx', (i % 2 === 0 ? -0.3 : 0.3));
    }
  }
  // 13. 登基金箔：恢弘金箔漫天（大编钟 + 长号角 + 铺地鼓），配 0.15s 重叠保护
  playEnthroneGold() {
    this.resume(); if (!this.ctx || !this._sfxGate('enthrone_gold', 400)) return;
    this._duckBGM();
    const chimes = [261.63, 329.63, 392.00, 523.25, 659.25];
    chimes.forEach((f, i) => this.bell(f, 2.0, 0.2, i * 0.1, 0));
    this.horn(196.00, 1.6, 0.22, 0.2, null, 0);
    this.horn(392.00, 1.8, 0.2, 0.4, null, 0);
    [0, 0.3, 0.6, 0.9].forEach((t) => this.drum(0.45, t, 65, 'sfx'));
  }

  // ============================================================
  // V12.5 新增音效（10个）
  // 所有音效统一 ADSR（Attack 0.01s / Decay 至70% / Release 尾音衰减），
  // 音量收敛至0.1~0.3，支持 StereoPannerNode 左右声像定位，
  // 同一音效0.1s内不重复播放（_sfxGate 闸门）。
  // ============================================================

  // 1. 军团编制音效：号角+鼓+金属甲胄碰撞（庄严军乐）
  playLegionForm() {
    this.resume(); if (!this.ctx || !this._sfxGate('legion_form', 200)) return;
    this.horn(196.00, 0.6, 0.2, 0, null, -0.2);
    this.horn(293.66, 0.6, 0.18, 0.15, null, 0.2);
    this.drum(0.4, 0, 80, 'sfx');
    this.tone(880, 0.15, 'square', 0.08, 0.3, null, 'sfx'); // 甲胄碰撞
  }
  // 2. 会战开始音效：急促鼓点+号角齐鸣（紧张激烈）
  playGrandBattleStart() {
    this.resume(); if (!this.ctx || !this._sfxGate('grand_battle_start', 500)) return;
    this._duckBGM();
    [0, 0.12, 0.24, 0.36].forEach((t) => this.drum(0.5, t, 110, 'sfx'));
    this.horn(220.00, 1.0, 0.22, 0.1, null, 0);
    this.horn(440.00, 0.8, 0.18, 0.3, null, 0);
  }
  // 3. 会战胜利音效：编钟+号角+鼓点（辉煌庄严）
  playGrandBattleWin() {
    this.resume(); if (!this.ctx || !this._sfxGate('grand_battle_win', 500)) return;
    this._duckBGM();
    const chimes = [523.25, 659.25, 783.99, 1046.50];
    chimes.forEach((f, i) => this.bell(f, 1.8, 0.2, i * 0.12, 0));
    [0, 0.2, 0.4, 0.6].forEach((t) => this.drum(0.4, t, 90, 'sfx'));
  }
  // 4. 阵法切换音效：短促金属拨弦+低沉嗡鸣
  playFormationSwitch() {
    this.resume(); if (!this.ctx || !this._sfxGate('formation_switch', 150)) return;
    this.tone(1200, 0.12, 'triangle', 0.15, 0, 800, 'sfx');
    this.tone(600, 0.2, 'sine', 0.12, 0.05, 300, 'sfx');
    this.tone(1800, 0.08, 'sine', 0.08, 0.1, null, 'sfx');
  }
  // 5. 科举放榜音效：扬琴琶音+编钟喜庆
  playExamHuangbang() {
    this.resume(); if (!this.ctx || !this._sfxGate('exam_huangbang', 300)) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    notes.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, i * 0.08, null, 'sfx'));
    this.bell(1046.50, 1.0, 0.15, notes.length * 0.08, 0);
  }
  // 6. 赋税调整音效：铜钱轻响+纸张翻动
  playTaxAdjust() {
    this.resume(); if (!this.ctx || !this._sfxGate('tax_adjust', 120)) return;
    for (let i = 0; i < 3; i++) {
      this.tone(1567.98 + i * 60, 0.06, 'sine', 0.1, i * 0.06, null, 'sfx', (i % 2 ? 0.3 : -0.3));
    }
    this.tone(440, 0.15, 'triangle', 0.08, 0.2, 220, 'sfx'); // 纸张声
  }
  // 7. 徭役征发音效：沉重脚步声+号角
  playCorveeCall() {
    this.resume(); if (!this.ctx || !this._sfxGate('corvee_call', 250)) return;
    this.horn(146.83, 0.5, 0.2, 0, null, 0);
    [0, 0.15, 0.3].forEach((t) => this.drum(0.35, t, 70, 'sfx'));
    this.tone(220, 0.3, 'sawtooth', 0.08, 0.4, 110, 'sfx');
  }
  // 8. 节气变化音效：编钟清音+风声
  playSolarTermChange() {
    this.resume(); if (!this.ctx || !this._sfxGate('solar_term', 400)) return;
    this.bell(880.00, 1.5, 0.15, 0, 0);
    this.bell(1174.66, 1.2, 0.1, 0.3, 0.2);
    this.tone(440, 0.8, 'sine', 0.06, 0.1, 220, 'sfx'); // 风声
  }
  // 9. 天文异象音效：低沉不谐和音+高频闪烁
  playCelestialAnomaly() {
    this.resume(); if (!this.ctx || !this._sfxGate('celestial_anomaly', 500)) return;
    this.tone(110, 1.5, 'sawtooth', 0.18, 0, 55, 'sfx');
    this.tone(220, 1.2, 'sine', 0.12, 0.1, 110, 'sfx');
    this.tone(1760, 0.3, 'sine', 0.1, 0.3, 880, 'sfx'); // 高频闪烁
    this.tone(2093, 0.2, 'sine', 0.08, 0.6, null, 'sfx');
  }
  // 10. 皇子出生音效：喜庆编钟+笛声
  playPrinceBorn() {
    this.resume(); if (!this.ctx || !this._sfxGate('prince_born', 500)) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => this.bell(f, 1.5, 0.18, i * 0.15, 0));
    this.tone(1567.98, 0.5, 'triangle', 0.1, notes.length * 0.15, null, 'sfx'); // 笛声
    this.drum(0.3, 0, 100, 'sfx');
  }

  // ============================================================
  // V13.0 新增音效（10个：6战斗 + 4UI）
  // 全部 Web Audio API 程序化合成，技能音效走 skillGain 独立总线。
  // ============================================================

  // ---- 战斗音效（6种，走 skillGain 总线） ----

  // 1. 武将技释放：根据技能类型播放不同音效
  // type: 'charge'(突击) | 'fire'(火攻) | 'water'(水攻) | 'strategy'(谋略) | 'heal'(治疗)
  playSkillCast(type = 'charge') {
    this.resume(); if (!this.ctx || !this._sfxGate('skill_cast_' + type, 300)) return;
    this._duckBGM();
    switch (type) {
      case 'charge': // 突击=战吼+冲击
        this.horn(220, 0.5, 0.22, 0, null, 0);
        this.horn(330, 0.4, 0.18, 0.1, null, 0);
        this.drum(0.6, 0.2, 80, 'skill');
        this.tone(100, 0.3, 'square', 0.2, 0.25, 50, 'skill'); // 冲击
        break;
      case 'fire': // 火攻=燃烧爆裂
        this.drum(0.7, 0, 80, 'skill');
        this.tone(80, 0.5, 'sine', 0.3, 0, 40, 'skill');
        for (let i = 0; i < 6; i++) {
          const t0 = 0.05 + i * 0.07;
          const nb = this._noiseBuffer(0.04);
          const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
          const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1500;
          const ng = this.ctx.createGain();
          const t0abs = this.ctx.currentTime + t0;
          ng.gain.setValueAtTime(0.12, t0abs);
          ng.gain.exponentialRampToValueAtTime(0.0001, t0abs + 0.04);
          nsrc.connect(nf); nf.connect(ng); ng.connect(this.skillGain);
          nsrc.start(t0abs); nsrc.stop(t0abs + 0.04);
        }
        break;
      case 'water': // 水攻=水流冲击
        // 低频水流咆哮
        this.tone(60, 0.8, 'sawtooth', 0.2, 0, 30, 'skill');
        // 水流噪声
        const wb = this._noiseBuffer(0.8);
        const wsrc = this.ctx.createBufferSource(); wsrc.buffer = wb;
        const wf = this.ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 800;
        const wg = this.ctx.createGain();
        const wt0 = this.ctx.currentTime;
        wg.gain.setValueAtTime(0.0001, wt0);
        wg.gain.linearRampToValueAtTime(0.2, wt0 + 0.2);
        wg.gain.linearRampToValueAtTime(0.0001, wt0 + 0.8);
        wsrc.connect(wf); wf.connect(wg); wg.connect(this.skillGain);
        wsrc.start(wt0); wsrc.stop(wt0 + 0.8);
        this.drum(0.5, 0.3, 60, 'skill');
        break;
      case 'strategy': // 谋略=神秘和弦
        const chord = [220, 233.08, 277.18]; // 小二度+增四度，神秘不协和
        chord.forEach((f, i) => this.tone(f, 1.2, 'sine', 0.16, i * 0.15, null, 'skill', (i - 1) * 0.2));
        this.tone(440, 1.0, 'triangle', 0.1, 0.5, null, 'skill'); // 尾音
        break;
      case 'heal': // 治疗=柔和上行音阶
        const seq = [523.25, 587.33, 659.25, 783.99, 880.00];
        seq.forEach((f, i) => this.tone(f, 0.4, 'sine', 0.16, i * 0.12, null, 'skill'));
        this.tone(1046.5, 0.5, 'sine', 0.1, seq.length * 0.12, null, 'skill');
        break;
    }
  }

  // 2. 连携技触发：双音叠加 + 回响 + 上升琶音
  playComboSkill() {
    this.resume(); if (!this.ctx || !this._sfxGate('combo_skill', 500)) return;
    this._duckBGM();
    // 双音叠加（C5+E5 大三度）
    this.tone(523.25, 0.8, 'triangle', 0.22, 0, null, 'skill');
    this.tone(659.25, 0.8, 'triangle', 0.22, 0.05, null, 'skill');
    // 上升琶音
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    arp.forEach((f, i) => this.tone(f, 0.3, 'sine', 0.14, 0.1 + i * 0.08, null, 'skill'));
    // 回响（DelayNode）
    if (this.ctx) {
      const t0 = this.ctx.currentTime;
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.2;
      const fb = this.ctx.createGain(); fb.gain.value = 0.3;
      const wet = this.ctx.createGain(); wet.gain.value = 0.4;
      // 用一个短噪声触发回声链路
      const nb = this._noiseBuffer(0.1);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.1, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      nsrc.connect(ng); ng.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(this.skillGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.1);
    }
    this.drum(0.4, 0.3, 75, 'skill');
  }

  // 3. 盾墙防御：金属碰撞 + 低频闷响（比现有格挡音更厚重）
  playShieldWall() {
    this.resume(); if (!this.ctx || !this._sfxGate('shield_wall', 200)) return;
    // 金属碰撞：多个中高频金属音叠加
    this.tone(1800, 0.1, 'sine', 0.18, 0, null, 'skill');
    this.tone(2400, 0.08, 'square', 0.1, 0.02, null, 'skill');
    this.tone(1200, 0.12, 'sine', 0.14, 0.01, null, 'skill');
    // 低频闷响（比 playShieldBlock 更厚重）
    this.drum(0.5, 0, 70, 'skill');
    this.tone(60, 0.25, 'sine', 0.2, 0, 35, 'skill');
    // 盾牌排列噪声
    const nb = this._noiseBuffer(0.15);
    const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2000; nf.Q.value = 2;
    const ng = this.ctx.createGain();
    const t0 = this.ctx.currentTime;
    ng.gain.setValueAtTime(0.15, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    nsrc.connect(nf); nf.connect(ng); ng.connect(this.skillGain);
    nsrc.start(t0); nsrc.stop(t0 + 0.15);
  }

  // 4. 箭雨齐射：8-10 支箭矢错开 0.03s + 破空声叠加
  playArrowRain() {
    this.resume(); if (!this.ctx || !this._sfxGate('arrow_rain', 400)) return;
    this._duckBGM();
    const n = 9; // 9 支箭矢
    for (let i = 0; i < n; i++) {
      this.playArrowShoot(i * 0.03); // 错开 0.03s
    }
    // 叠加破空声（带通噪声扫频）
    const nb = this._noiseBuffer(0.5);
    const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 2;
    const t0 = this.ctx.currentTime;
    nf.frequency.setValueAtTime(3000, t0);
    nf.frequency.exponentialRampToValueAtTime(500, t0 + 0.5);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.15, t0 + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    nsrc.connect(nf); nf.connect(ng); ng.connect(this.skillGain);
    nsrc.start(t0); nsrc.stop(t0 + 0.5);
  }

  // 5. 骑兵冲锋（宏大版）：马蹄声渐快 + 战鼓 + 士兵呐喊
  playCavalryChargeGrand() {
    this.resume(); if (!this.ctx || !this._sfxGate('cavalry_charge_grand', 600)) return;
    this._duckBGM();
    // 12 个马蹄脉冲，间隔从 0.14s 渐快到 0.05s
    let t = 0;
    for (let i = 0; i < 12; i++) {
      const f = 65 + (i % 2) * 20;
      this.drum(0.45, t, f, 'skill');
      // 马蹄噪声
      const t0 = this.ctx.currentTime + t;
      const nb = this._noiseBuffer(0.05);
      const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 1.5;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.18, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      nsrc.connect(nf); nf.connect(ng); ng.connect(this.skillGain);
      nsrc.start(t0); nsrc.stop(t0 + 0.05);
      t += 0.14 - i * 0.008;
    }
    // 战鼓
    this.drum(0.6, 0.8, 75, 'skill');
    this.drum(0.55, 1.0, 70, 'skill');
    // 士兵呐喊（多振荡器失谐叠加）
    const freqs = [180, 220, 260, 300, 340];
    freqs.forEach((f, i) => {
      this.tone(f, 0.6, 'sawtooth', 0.08, 0.8, f * 1.2, 'skill', (i - 2) * 0.15);
    });
    // 号角
    this.horn(196, 0.8, 0.2, 1.0, null, 0);
  }

  // 6. 城防攻击：投石机轰鸣 + 城墙撞击碎裂声
  playSiegeAttack() {
    this.resume(); if (!this.ctx || !this._sfxGate('siege_attack', 500)) return;
    this._duckBGM();
    // 投石机轰鸣：低频 boom 渐强
    this.drum(0.6, 0, 50, 'skill');
    this.tone(50, 0.6, 'sine', 0.3, 0, 25, 'skill');
    // 城墙撞击：金属+砖石碎裂噪声
    const nb = this._noiseBuffer(0.4);
    const nsrc = this.ctx.createBufferSource(); nsrc.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 2000;
    const ng = this.ctx.createGain();
    const t0 = this.ctx.currentTime + 0.2;
    ng.gain.setValueAtTime(0.25, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    nsrc.connect(nf); nf.connect(ng); ng.connect(this.skillGain);
    nsrc.start(t0); nsrc.stop(t0 + 0.4);
    // 碎裂声：高频短噪声
    for (let i = 0; i < 5; i++) {
      const t1 = this.ctx.currentTime + 0.25 + i * 0.06;
      const nb2 = this._noiseBuffer(0.03);
      const nsrc2 = this.ctx.createBufferSource(); nsrc2.buffer = nb2;
      const nf2 = this.ctx.createBiquadFilter(); nf2.type = 'highpass'; nf2.frequency.value = 3000;
      const ng2 = this.ctx.createGain();
      ng2.gain.setValueAtTime(0.1, t1);
      ng2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.03);
      nsrc2.connect(nf2); nf2.connect(ng2); ng2.connect(this.skillGain);
      nsrc2.start(t1); nsrc2.stop(t1 + 0.03);
    }
  }

  // ---- UI 音效（4种） ----

  // 7. 面板标签切换：清脆短音（不同音高区分标签）
  // idx: 标签索引（0-5），音高随 idx 递增
  playTabSwitch(idx = 0) {
    this.resume(); if (!this.ctx || !this._sfxGate('tab_switch_' + idx, 80)) return;
    // 音高随标签索引递增：每个标签半音+2
    const baseFreq = 880 * Math.pow(1.12, Math.min(idx, 8));
    this.tone(baseFreq, 0.06, 'sine', 0.18, 0, null, 'sfx');
    this.tone(baseFreq * 1.5, 0.04, 'sine', 0.1, 0.02, null, 'sfx');
  }

  // 8. 武将升级（增强版）：上行琶音 + 金光音效
  playGeneralLevelUp() {
    this.resume(); if (!this.ctx || !this._sfxGate('general_level_up', 400)) return;
    // 上行琶音
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    arp.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, i * 0.08, null, 'sfx'));
    // 金光音效：高频上滑
    this.tone(1567.98, 0.4, 'sine', 0.12, 0.3, 2093, 'sfx');
    this.tone(2093.00, 0.3, 'sine', 0.08, 0.4, 2637, 'sfx');
    this.drum(0.35, 0.2, 80, 'sfx');
  }

  // 9. 科技研发完成（增强版）：钟声 + 上行音阶
  playTechResearchComplete() {
    this.resume(); if (!this.ctx || !this._sfxGate('tech_research_complete', 400)) return;
    // 钟声
    this.bell(523.25, 1.5, 0.2, 0, 0);
    this.bell(783.99, 1.2, 0.15, 0.15, 0.2);
    // 上行音阶
    const seq = [261.63, 329.63, 392.00, 523.25, 659.25];
    seq.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, i * 0.1, null, 'sfx'));
    this.tone(1567.98, 0.6, 'sine', 0.12, seq.length * 0.1, null, 'sfx');
  }

  // 10. 成就解锁（庆典版）：编钟 + 琶音
  playAchievementUnlock() {
    this.resume(); if (!this.ctx || !this._sfxGate('achievement_unlock', 500)) return;
    // 编钟齐鸣
    const chimes = [523.25, 659.25, 783.99, 1046.5];
    chimes.forEach((f, i) => this.bell(f, 1.5, 0.18, i * 0.12, (i - 1.5) * 0.15));
    // 琶音
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    arp.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, 0.5 + i * 0.07, null, 'sfx'));
    this.drum(0.4, 0.5, 80, 'sfx');
    this.drum(0.35, 0.8, 75, 'sfx');
  }

  // ============================================================
  // V8.1 新增：环境氛围音（4 种，循环播放，走 ambientGain 总线）
  // ============================================================

  // 通用启动器：根据 name 初始化持续节点 + setInterval 调度层
  startAmbient(name) {
    this.resume(); if (!this.ctx) return;
    if (this._ambientName === name && this._ambientTimer) return;
    this.stopAmbient();
    this._ambientName = name;
    this._ambientStep = 0;
    if (name === 'city') this._startCityAmbient();
    else if (name === 'battle') this._startBattleAmbient();
    else if (name === 'rain') this._startRainAmbient();
    else if (name === 'palace') this._startPalaceAmbient();
    else this._ambientName = null;
  }

  stopAmbient() {
    if (this._ambientTimer) { clearInterval(this._ambientTimer); this._ambientTimer = null; }
    this._ambientNodes.forEach(h => this._stopNodes(h));
    this._ambientNodes = [];
    this._ambientName = null;
  }

  // 1. 城市市井：低频人群嗡嗡（带通噪声 + LFO）+ 偶尔叫卖（中频脉冲）
  _startCityAmbient() {
    const hum = this._startNoiseLoop({ freq: 400, q: 2, type: 'bandpass', vol: 0.08, loop: true, bus: 'ambient' });
    if (hum) {
      // LFO 缓慢调制人群嗡嗡音量
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoG.gain.value = 0.03;
      lfo.connect(lfoG); lfoG.connect(hum.gain.gain);
      lfo.start();
      this._ambientNodes.push({ src: lfo, gain: lfoG });
    }
    this._ambientNodes.push(hum);
    // 叫卖声：每 2.5s 随机一个中频脉冲
    this._ambientTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const f = 300 + Math.random() * 200;
      this.tone(f, 0.3, 'sine', 0.05, 0, f * 1.1, 'ambient', (Math.random() - 0.5) * 0.6);
    }, 2500);
  }

  // 2. 战场环境：低频战鼓循环（2Hz 脉冲，80Hz）+ 远处呐喊
  _startBattleAmbient() {
    this._ambientTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      this.drum(0.25, 0, 80, 'ambient');
      // 远处低音量呐喊（每 4 拍一次）
      if (this._ambientStep % 4 === 0) {
        const f = 180 + Math.random() * 80;
        this.tone(f, 0.5, 'sawtooth', 0.04, 0, f * 1.1, 'ambient', (Math.random() - 0.5) * 0.5);
      }
      this._ambientStep++;
    }, 500); // 2Hz
  }

  // 3. 风雨：白噪声低通滤波（雨声）+ 偶尔雷暴 boom
  _startRainAmbient() {
    const rain = this._startNoiseLoop({ freq: 2000, q: 0.7, type: 'lowpass', vol: 0.12, loop: true, bus: 'ambient' });
    this._ambientNodes.push(rain);
    // 雷暴：每 6-10s 随机一次低频 boom
    this._ambientTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      if (Math.random() < 0.35) {
        this.drum(0.3, 0, 70, 'ambient');
        this.tone(60, 0.8, 'sine', 0.12, 0, 35, 'ambient');
      }
    }, 2000);
  }

  // 4. 宫廷肃穆：极低频持续音 60Hz + 编钟偶尔敲击
  _startPalaceAmbient() {
    if (this.ctx) {
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 60;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.08, t0 + 1.5);
      osc.connect(g); g.connect(this.ambientGain);
      osc.start(t0);
      this._ambientNodes.push({ src: osc, gain: g });
    }
    // 编钟：每 4s 随机一钟
    this._ambientTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const f = [261.63, 329.63, 392.00, 523.25][Math.floor(Math.random() * 4)];
      this.bell(f, 1.5, 0.06, 0, (Math.random() - 0.5) * 0.4);
    }, 4000);
  }

  // 便捷方法（保留语义化命名）
  startCityAmbient()   { this.startAmbient('city'); }
  startBattleAmbient() { this.startAmbient('battle'); }
  startRainAmbient()   { this.startAmbient('rain'); }
  startPalaceAmbient() { this.startAmbient('palace'); }

  // ============================================================
  // V8.1 自省与分发
  // ============================================================
  // 返回所有可用 SFX 名称（不含 play 前缀）
  listSFX() {
    return [
      'click', 'hover', 'battle', 'victory', 'defeat', 'coin', 'recruit', 'event',
      'achievement', 'season', 'build', 'researchDone', 'titleUnlock', 'ngPlus',
      'diploSuccess', 'diploFail', 'buildComplete', 'techComplete', 'levelUp',
      'titleUnlocked', 'battleVictory', 'battleDefeat', 'eventTrigger',
      'diplomacyOk', 'diplomacyBad', 'welcome', 'ngPlusStart',
      'accession', 'abdication', 'appointOffice', 'grantTitle', 'tradeIncome',
      'caravanDepart', 'cultureBoom', 'examSelect', 'dynastyFall', 'unifyChina',
      // V8.1 战斗
      'swordClash', 'cavalryCharge', 'arrowShoot', 'fireBurst', 'battleCry',
      'shieldBlock', 'volley', 'duelClash',
      // V8.1 UI
      'buttonClick', 'panelOpen', 'panelClose', 'coinSound', 'buildSound',
      'error', 'notify',
      // V9.5 新增
      'legionForm', 'grandBattleStart', 'grandBattleWin', 'formationSwitch',
      'examHuangbang', 'taxAdjust', 'corveeConscript', 'solarTerm',
      'celestialAnomaly', 'princeBorn',
      // V13.0 新增战斗音效
      'skillCast', 'comboSkill', 'shieldWall', 'arrowRain',
      'cavalryChargeGrand', 'siegeAttack',
      // V13.0 新增 UI 音效
      'tabSwitch', 'generalLevelUp', 'techResearchComplete', 'achievementUnlock'
    ];
  }

  // 返回所有 BGM 轨道名
  listBGM() {
    return Object.keys(BGM_TRACKS);
  }

  // 返回所有环境音名
  listAmbient() {
    return ['city', 'battle', 'rain', 'palace'];
  }

  // 统一 SFX 分发：playSFX('swordClash') → playSwordClash()
  playSFX(name) {
    if (!name) return;
    const method = 'play' + name.charAt(0).toUpperCase() + name.slice(1);
    if (typeof this[method] === 'function') {
      this[method]();
    }
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
  // V13.0：技能音效独立音量控制
  setSkillVolume(v) {
    if (this.skillGain && this.ctx) {
      this.skillGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)) * 0.9, this.ctx.currentTime);
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

  // ============================================================
  // V9.5 音乐播放列表 / 解锁系统
  // ------------------------------------------------------------
  // 设计参考：常规游戏音乐播放器（如《三国志》系列军乐殿）——
  //   播放列表只列「已解锁」BGM；上一首/下一首在解锁序列内循环；
  //   随机播放从解锁集合等概率抽选；收藏置顶。
  // ============================================================

  // 解锁一首 BGM（重复解锁幂等）。返回 true 表示本次新解锁。
  unlockBGM(id) {
    if (!BGM_TRACKS[id]) return false;
    if (this.unlockedBGMs.includes(id)) return false;
    this.unlockedBGMs.push(id);
    this.pushLogRef && this.pushLogRef(`🎵 新乐谱入库：「${(BGM_INFO[id] && BGM_INFO[id].name) || id}」`);
    return true;
  }

  isBGMUnlocked(id) { return this.unlockedBGMs.includes(id); }

  toggleFavoriteBGM(id) {
    if (this.favoriteBGMs.has(id)) this.favoriteBGMs.delete(id);
    else this.favoriteBGMs.add(id);
    return this.favoriteBGMs.has(id);
  }

  isFavoriteBGM(id) { return this.favoriteBGMs.has(id); }

  setPlayMode(mode) {
    if (mode === 'random' || mode === 'sequential') this.playMode = mode;
    return this.playMode;
  }

  // 当前播放轨道 id
  getCurrentBGM() { return this._currentTrack; }

  // 播放列表：收藏优先，其余按 BGM_TRACKS 顺序
  getPlaylist() {
    const fav = [...this.favoriteBGMs].filter(id => this.unlockedBGMs.includes(id));
    const rest = this.unlockedBGMs.filter(id => !this.favoriteBGMs.has(id));
    return [...fav, ...rest];
  }

  // 切到指定已解锁 BGM（手动选择，覆盖场景自动切换）
  playTrack(id) {
    if (!this.isBGMUnlocked(id)) return false;
    this.switchBGM(id);
    const pl = this.getPlaylist();
    const idx = pl.indexOf(id);
    this._playlistPos = idx >= 0 ? idx : 0;
    return true;
  }

  // 下一首
  nextBGM() {
    const pl = this.getPlaylist();
    if (!pl.length) return;
    let next;
    if (this.playMode === 'random') {
      next = pl[Math.floor(Math.random() * pl.length)];
    } else {
      this._playlistPos = (this._playlistPos + 1) % pl.length;
      next = pl[this._playlistPos];
    }
    this.playTrack(next);
  }

  // 上一首
  prevBGM() {
    const pl = this.getPlaylist();
    if (!pl.length) return;
    this._playlistPos = (this._playlistPos - 1 + pl.length) % pl.length;
    this.playTrack(pl[this._playlistPos]);
  }

  // 序列化音乐状态（解锁/收藏/播放模式）
  serializeMusic() {
    return {
      unlocked: this.unlockedBGMs.slice(),
      favorites: [...this.favoriteBGMs],
      playMode: this.playMode
    };
  }

  // 恢复音乐状态（旧存档缺省则保持默认）
  restoreMusic(state) {
    if (!state) return;
    if (Array.isArray(state.unlocked)) {
      // 合并：只保留 BGM_TRACKS 中存在的，且与默认取并集
      const merged = new Set([...DEFAULT_UNLOCKED_BGM, ...state.unlocked]);
      this.unlockedBGMs = [...merged].filter(id => BGM_TRACKS[id]);
    }
    if (Array.isArray(state.favorites)) {
      this.favoriteBGMs = new Set(state.favorites.filter(id => BGM_TRACKS[id]));
    }
    if (state.playMode === 'random' || state.playMode === 'sequential') {
      this.playMode = state.playMode;
    }
  }
}
