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
// V14.0：补充 F 系音（F3/F4/F5），供内政管理 BGM「F宫调」使用；其余音保持不变，
// 仅新增键，不改动既有频率，不影响历史 BGM 旋律。
const PENTATONIC = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
  F3: 174.61, F4: 349.23, F5: 698.46,
  // V16.0 新增：G羽调战役 BGM 所需的低音区与 A大调开场 BGM 所需的三/六级音
  G2: 98.00, A2: 110.00, B2: 123.47, D2: 73.42, E2: 82.41,
  B3: 246.94, B4: 493.88,
  C4s: 277.18, C5s: 554.37, F3s: 185.00, F4s: 369.99, F5s: 739.99,
  // V18.0 新增：C 小调攻城 BGM 所需的降三级(Eb)与降七级(Bb)音。
  //   C 自然小调：C D Eb F G Ab Bb C；此处补 Eb3/Eb4/Bb3/Bb4，其余音沿用既有键。
  Eb3: 155.56, Eb4: 311.13, Bb3: 233.08, Bb4: 466.16,
  // V22.0 新增：科举殿试 BGM「G大调」所需的高音 B5（B5=987.77Hz，十二平均律），
  //   其余 G/A/D/E 音沿用既有键；翰林院 BGM「D大调」沿用既有 D/E/F#/A/B 键。
  B5: 987.77
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
  },

  // ============================================================
  // V14.0「霸业宏图」新增 2 首 BGM
  // ============================================================
  duel: {   // 单挑场景：G羽调，120BPM，战鼓+号角式锯齿波+不协和紧张感
    // 羽调式音阶（羽=G）：G A C D E G A C D，强调四/五度与小二度不协和张力
    bpm: 120, scale: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 280, hasDrum: true, density: 0.95
  },
  domestic: { // 内政管理：F宫调，66BPM，古琴+笙+磬，宁静雅致
    // 宫调式音阶（宫=F）：F G A C D F G A C
    bpm: 66, scale: ['F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5'],
    wave: 'sine', bassWave: 'sine', stepMs: 760, hasDrum: false, density: 0.45
  },

  // ============================================================
  // V15.0 新增 1 首 BGM：结局画面（宏大交响，按评级变奏）
  //   finale：C 宫交响，66BPM，三角波主旋律 + 正弦低音铺底 + 定音鼓。
  //   由 startEndingBGM(rank) 在播放前按评级(S/B/D)临时调整 bpm/density/音阶，
  //   实现 S 级庆典 / B 级和平 / D 级悲怆 三种变奏。
  // ============================================================
  finale: {
    bpm: 66, scale: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 700, hasDrum: true, density: 0.7
  },

  // ============================================================
  // V16.0「音效扩充」新增 2 首 BGM
  // ============================================================
  campaign: { // 战役模式：G羽调，130BPM，紧张激烈进行曲（锯齿主奏+方波低音+战鼓）
    // 羽调式音阶（羽=G）：G A C D E G A C D E，强调军乐行进感
    bpm: 130, scale: ['G2', 'A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 460, hasDrum: true, density: 0.92
  },
  intro: {    // 开场/过场：A大调，90BPM，宏大史诗（三角主奏+正弦低音+定音鼓）
    // A大调自然音阶近似：A B C# D E F# A B C#
    bpm: 90, scale: ['A2', 'B2', 'C3s', 'D3', 'E3', 'F3s', 'A3', 'B3', 'C4s', 'D4', 'E4', 'F4s', 'A4'],
    wave: 'triangle', bassWave: 'sine', stepMs: 680, hasDrum: true, density: 0.75
  },

  // ============================================================
  // V17.0「音效扩充」新增 2 首 BGM
  // ============================================================
  battleMarch: { // 战斗进行曲：D小调，140BPM，紧张激烈（锯齿主奏+方波低音+快鼓）
    // D 小调五声化音阶：D F G A C D F G（强调二级/小三度的紧张感）
    bpm: 140, scale: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 430, hasDrum: true, density: 0.95
  },
  plainfield: {  // 平原战场：G大调，80BPM，开阔战场感（三角主奏+正弦低音+定音鼓）
    // G 大调自然音阶近似：G A B D E G A B D（明亮开阔，不拥挤）
    bpm: 80, scale: ['G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 560, hasDrum: true, density: 0.7
  },

  // ============================================================
  // V18.0「音效扩充」新增 2 首 BGM
  // ============================================================
  strategy: { // 战略界面：F大调，70BPM，思考氛围——平静但暗藏紧张
    // F 大调五声化音阶：F G A C D F G A C（明亮开阔但不激烈，
    //   正弦主奏+正弦低音，无战鼓， density 压低，营造运筹帷幄的沉思感）
    bpm: 70, scale: ['F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5'],
    wave: 'sine', bassWave: 'sine', stepMs: 857, hasDrum: false, density: 0.45
  },
  siege: {    // 攻城战：C小调，120BPM，紧张激烈（锯齿主奏+方波低音+战鼓）
    // C 自然小调五声化：C D Eb F G Bb C D Eb（降三级/降七级制造压抑紧张感，
    //   快鼓+高 density，模拟云梯蚁附、槌撞城门的攻城节奏）
    bpm: 120, scale: ['C3', 'D3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 280, hasDrum: true, density: 0.92
  },

  // ============================================================
  // V19.0「音效扩充」新增 2 首 BGM
  // ============================================================
  cultureHall: { // 文化界面：D宫调，60BPM，雅致宁静——古琴+箫，文人雅集之境
    // D 宫五声：D E F# A B D E F# A B（F# 用既有 F3s/F4s 键，不新增频率）
    //   正弦主奏+正弦低音，无战鼓，stepMs=1000(=60BPM四分音符)，density 压低，
    //   营造书卷丹青、悠然自得的雅致氛围。
    bpm: 60, scale: ['D3', 'E3', 'F3s', 'A3', 'B3', 'D4', 'E4', 'F4s', 'A4', 'B4', 'D5'],
    wave: 'sine', bassWave: 'sine', stepMs: 1000, hasDrum: false, density: 0.42
  },
  techLab: {     // 科技研究：A小调，80BPM，探索氛围——弦乐铺底+笛音，求索未知
    // A 小调五声：A C D E G A C D E G（小三度暗色调 + 稀疏旋律，
    //   三角主奏温润、正弦低音铺底，无战鼓，stepMs=750(=80BPM四分音符)，
    //   density 0.55，模拟伏案推演、豁然开朗的探索节奏）
    bpm: 80, scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 750, hasDrum: false, density: 0.55
  },

  // ============================================================
  // V20.0「音效扩充」新增 2 首 BGM
  // ============================================================
  turbulent: {  // 灾害/乱世：B小调，90BPM，紧张不安——锯齿主奏+方波低音+缓鼓
    // B 自然小调五声化：B C# D E F# G A B C# D E（小三度暗调 + 小二度
    //   不协和张力，锯齿波主奏制造压迫感，方波低音持续轰鸣，缓鼓点缀不安节奏；
    //   stepMs=667(=90BPM四分音符)，density 0.8，模拟灾荒连年、风雨飘摇的乱世氛围）。
    bpm: 90, scale: ['B2', 'D3', 'E3', 'F3s', 'G3', 'A3', 'B3', 'C4s', 'D4', 'E4', 'F4s', 'G4', 'A4', 'B4'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 667, hasDrum: true, density: 0.8
  },
  goldenAge: {  // 盛世太平：F大调，75BPM，和平繁荣——三角主奏+正弦低音+轻磬
    // F 大调五声化：F G A C D F G A C D（明亮宫调 + 舒缓旋律，
    //   三角主奏温润舒展、正弦低音铺底，轻鼓点缀升平，stepMs=800(=75BPM四分音符)，
    //   density 0.5，density 压低营造五谷丰登、四海升平的治世氛围）。
    bpm: 75, scale: ['F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 800, hasDrum: true, density: 0.5
  },

  // ============================================================
  // V21.0「音效扩充」新增 2 首 BGM
  // ============================================================
  silkRoad: { // 丝路异域：D小调，70BPM，西域风情——都塔尔(锯齿主奏)+手鼓+弹拨低音
    // D 自然小调五声化：D F G A C D F G A（降三级小三度的西域苍凉感，
    //   锯齿波主奏模拟都塔尔的金属弦鸣，方波低音模拟手鼓低频搏动，
    //   stepMs=857(=70BPM四分音符)，density 0.62，营造驼队西行、风沙漫卷的西域行旅感）。
    bpm: 70, scale: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 857, hasDrum: true, density: 0.62
  },
  familyReunion: { // 家族团圆：C大调，80BPM，温馨民乐——古筝(三角主奏)+笛子+正弦低音
    // C 大调五声：C D E G A C D E G A（明亮宫调 + 温润旋律，
    //   三角主奏模拟古筝温润拨弦、正弦低音铺底，无战鼓，
    //   stepMs=750(=80BPM四分音符)，density 0.5，营造阖家团圆、天伦之乐的温馨氛围）。
    bpm: 80, scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 750, hasDrum: false, density: 0.5
  },

  // ============================================================
  // V22.0「音效扩充」新增 2 首 BGM（科举殿试 / 翰林院）
  // ============================================================
  examFinal: { // 科举殿试：G大调，60BPM，庄严典雅——编钟(三角主奏泛音)+古筝(正弦低音)+定音鼓
    // G 大调自然音阶近似：G A B D E G A B D E G A B（明亮宫调 + 舒展旋律，
    //   三角主奏模拟编钟/古筝的温润金石声、正弦低音铺底，轻鼓点缀丹墀庄重，
    //   stepMs=1000(=60BPM四分音符)，density 0.6，营造金銮殿策对、庄严肃穆的殿试氛围）。
    bpm: 60, scale: ['G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5', 'B5'],
    wave: 'triangle', bassWave: 'sine', stepMs: 1000, hasDrum: true, density: 0.6
  },
  academy: { // 翰林院：D大调，55BPM，学术氛围——古琴(正弦主奏)+笛子(三角点缀)+正弦低音
    // D 大调五声：D E F# A B D E F# A B D（F# 用既有 F3s/F4s 键，不新增频率，
    //   正弦主奏模拟古琴的悠远泛音、三角点缀模拟竹笛清越，无战鼓，
    //   stepMs=1091(=55BPM四分音符)，density 0.42，营造崇文馆校书、书卷丹青的学术氛围）。
    bpm: 55, scale: ['D3', 'E3', 'F3s', 'A3', 'B3', 'D4', 'E4', 'F4s', 'A4', 'B4', 'D5'],
    wave: 'sine', bassWave: 'sine', stepMs: 1091, hasDrum: false, density: 0.42
  },

  // ============================================================
  // V23.0「音效扩充」新增 2 首 BGM（军营号角 / 炉火纯青）
  // ============================================================
  militaryCamp: { // 军营号角：C小调，85BPM，雄壮威武——号角(锯齿主奏)+军鼓+方波低音
    // C 自然小调五声化：C D Eb F G Bb C D Eb（降三级/降七级的肃杀军乐感，
    //   锯齿波主奏模拟铜角吹鸣的金属质感、方波低音持续轰鸣，战鼓列阵行进，
    //   stepMs=706(=85BPM四分音符)，density 0.85，营造校场点兵、铁甲林立的雄壮军氛围）。
    bpm: 85, scale: ['C3', 'D3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'Bb4'],
    wave: 'sawtooth', bassWave: 'square', stepMs: 706, hasDrum: true, density: 0.85
  },
  forge: { // 炉火纯青：D小调，70BPM，锻造节奏——金属泛音(三角主奏)+打铁鼓点+方波低音
    // D 自然小调五声化：D F G A Bb C D F G（小三度暗调 + 沉稳锤打节奏，
    //   三角主奏模拟铁器淬火后的金属泛音、方波低音模拟风箱低频搏动，
    //   战鼓按打铁"叮-当"节奏落拍，stepMs=857(=70BPM四分音符)，
    //   density 0.6，营造熔炉烈焰、锤声叮当的冶铸氛围）。
    bpm: 70, scale: ['D3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'F4', 'G4', 'A4', 'Bb4'],
    wave: 'triangle', bassWave: 'square', stepMs: 857, hasDrum: true, density: 0.6
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
  cityManage:     { name: '安居乐业', desc: '城市管理·古琴竹笛' },
  // V14.0 新增
  duel:           { name: '龙争虎斗', desc: '武将单挑·鼓角不协和' },
  domestic:       { name: '垂拱四方', desc: '内政管理·古琴笙磬' },
  // V15.0 新增
  finale:         { name: '四海归颂', desc: '结局·宏大交响（按评级变奏）' },
  // V16.0 新增
  campaign:       { name: '戎马关山', desc: '战役模式·G羽调进行曲' },
  intro:          { name: '开天辟地', desc: '开场过场·A大调史诗' },
  // V17.0 新增
  battleMarch:    { name: '铁马金戈', desc: '战斗进行曲·D小调140BPM' },
  plainfield:     { name: '平野鏖兵', desc: '平原战场·G大调80BPM' },
  // V18.0 新增
  strategy:       { name: '运筹帷幄', desc: '战略界面·F大调70BPM' },
  siege:          { name: '云梯蚁附', desc: '攻城战·C小调120BPM' },
  // V19.0 新增
  cultureHall:    { name: '文渊翰墨', desc: '文化界面·D宫调60BPM雅致宁静' },
  techLab:        { name: '格物致知', desc: '科技研究·A小调80BPM探索氛围' },
  // V20.0 新增
  turbulent:      { name: '风雨如晦', desc: '灾害乱世·B小调90BPM紧张不安' },
  goldenAge:      { name: '河清海晏', desc: '盛世太平·F大调75BPM和平繁荣' },
  // V21.0 新增
  silkRoad:       { name: '丝路驼铃', desc: '丝路异域·D小调70BPM都塔尔手鼓' },
  familyReunion:  { name: '天伦之乐', desc: '家族团圆·C大调80BPM古筝竹笛' },
  // V22.0 新增（科举殿试 / 翰林院）
  examFinal:      { name: '金銮策对', desc: '科举殿试·G大调60BPM编钟古筝' },
  academy:        { name: '崇文校书', desc: '翰林院·D大调55BPM古琴竹笛' },
  // V23.0 新增（军营号角 / 炉火纯青）
  militaryCamp:   { name: '沙场点兵', desc: '军营号角·C小调85BPM号角军鼓' },
  forge:          { name: '炉火纯青', desc: '锻造冶炼·D小调70BPM打铁金属泛音' }
};

// V9.5：初始解锁的 BGM（主菜单/大地图/战斗/事件/内政/结局 + 既有 V8.1 四首）
// V14.0：单挑/内政两首新 BGM 默认解锁（随新系统开放即可用）
// V16.0：战役/开场两首新 BGM 默认解锁（战役模式与开场演出随版本开放即可用）
const DEFAULT_UNLOCKED_BGM = ['menu', 'map', 'battle', 'event', 'interior', 'ending',
  'navy', 'diplomacy', 'victory', 'defeat', 'duel', 'domestic', 'campaign', 'intro',
  // V17.0：两首新战斗 BGM 默认解锁
  'battleMarch', 'plainfield',
  // V18.0：战略界面/攻城战两首新 BGM 默认解锁
  'strategy', 'siege',
  // V19.0：文化界面/科技研究两首新 BGM 默认解锁（随新系统开放即可用）
  'cultureHall', 'techLab',
  // V20.0：灾害乱世/盛世太平两首新 BGM 默认解锁（灾害与治世场景随版本开放即可用）
  'turbulent', 'goldenAge',
  // V21.0：丝路异域/家族团圆两首新 BGM 默认解锁（商路与皇室场景随版本开放即可用）
  'silkRoad', 'familyReunion',
  // V22.0：科举殿试/翰林院两首新 BGM 默认解锁（殿试与崇文馆场景随版本开放即可用）
  'examFinal', 'academy',
  // V23.0：军营号角/炉火纯青两首新 BGM 默认解锁（校场练兵与工坊锻造场景随版本开放即可用）
  'militaryCamp', 'forge'];

export class AudioManager {
  constructor() {
    this.ctx = null;          // AudioContext，首次用户交互后才创建
    this.master = null;       // 主增益节点
    this.bgmGain = null;      // 背景音乐总线
    this.sfxGain = null;      // 音效总线
    this.ambientGain = null;  // V8.1 环境音总线
    this.skillGain = null;    // V13.0 技能音效独立总线
    // V14.0：单挑/内政音效独立总线
    this.duelGain = null;     // 单挑音效总线（连入 sfxGain）
    this.domesticGain = null; // 内政音效总线（连入 sfxGain）
    this._ambientSidechain = null; // V13.0 环境音侧链压缩器
    this.muted = false;
    this.masterVolume = 0.8;
    this.bgmVolume = 0.6;
    this.sfxVolume = 0.8;
    this.ambientVolume = 0.5; // V8.1 环境音默认音量
    this.duelVolume = 0.9;     // V14.0 单挑总线默认音量
    this.domesticVolume = 0.8; // V14.0 内政总线默认音量
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;
    this._currentTrack = null;
    // 性能优化（audio.js #4 多BGM切换资源管理）：记录本首 BGM 正在发声的旋律/低音 osc 节点。
    //   切歌/停止时统一显式 stop+disconnect，避免 Rapid 切歌场景下旧节点残留为「活节点」
    //   （虽会自然自停，但在 0.65~0.85s 收尾前一直占用音频图资源）。
    this._bgmLiveNodes = [];

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

    // ---- V14.0 混音优化 ----
    this._prevSceneBGM = null;        // 单挑 BGM 自动切换前的场景，结束后恢复
    this._sfxWindow = [];             // 近期 SFX 触发时间戳滑动窗（并发 ducking 用）
    this._sfxHead = 0;                // V17.0：环形窗口游标（性能优化#4，避免 O(n) shift）
    this._noiseBufCache = null;      // 噪声 buffer 复用缓存（性能优化：避免每次新建 AudioBuffer）

    // ---- V15.0 音效扩充：新增两条独立混音总线 ----
    // achievementGain：成就/段位等庆典反馈总线（挂在 sfxGain 下游，可独立推高音量）
    this.achievementGain = null;
    this.achievementVolume = 0.9;    // 成就总线默认音量
    // endingGain：结局结算/终局交响总线（挂在 bgmGain 下游，按评级变奏时独立控制）
    this.endingGain = null;
    this.endingVolume = 0.8;         // 结局总线默认音量

    // ---- V16.0 混音扩充：战役/开场两条独立总线 ----
    // campaignGain：战役模式专属音效总线（战役开始/胜负/三星等），挂在 sfxGain 下游，
    //   便于战役高潮时独立推高音量而不影响普通 UI 音效。
    this.campaignGain = null;
    this.campaignVolume = 0.9;       // 战役总线默认音量
    // introGain：开场旁白/过场氛围音总线（低频嗡鸣/风声/翻页），挂在 sfxGain 下游，
    //   与剧情旁白绑定，可独立压低以突出叙事感。
    this.introGain = null;
    this.introVolume = 0.7;          // 开场总线默认音量

    // ---- V17.0 混音扩充：battleGain 战斗音效独立总线 ----
    // battleGain：承载阵型切换/士气崩溃/弓兵齐射/盾墙/水战/天气战斗/连胜号角等
    //   战场音效，挂在 sfxGain 下游，便于战斗高潮时独立推高或压低而不影响 UI/内政音效。
    this.battleGain = null;
    this.battleVolume = 0.9;         // 战斗总线默认音量

    // ---- V15.0 天气氛围音（滤波噪声循环） ----
    this._weatherName = null;        // 当前天气名 rain/snow/wind/sandstorm
    this._weatherNodes = [];         // 天气循环持有节点（停止时统一关闭）
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
        // V14.0：单挑音效独立总线（duelGain）——连入 sfxGain，
        // 便于单挑剧情/特写时单独推高或压低音量而不影响普通音效。
        this.duelGain = this.ctx.createGain();
        this.duelGain.gain.value = this.duelVolume;
        this.duelGain.connect(this.sfxGain);
        // V14.0：内政音效独立总线（domesticGain）——建造/税收/徭役/丰收等
        this.domesticGain = this.ctx.createGain();
        this.domesticGain.gain.value = this.domesticVolume;
        this.domesticGain.connect(this.sfxGain);
        // V15.0：成就庆典总线（achievementGain）→ 挂在 sfxGain 下游
        this.achievementGain = this.ctx.createGain();
        this.achievementGain.gain.value = this.achievementVolume;
        this.achievementGain.connect(this.sfxGain);
        // V15.0：结局结算总线（endingGain）→ 挂在 bgmGain 下游，承载终局交响/评级变奏
        this.endingGain = this.ctx.createGain();
        this.endingGain.gain.value = this.endingVolume;
        this.endingGain.connect(this.bgmGain);
        // V16.0：战役音效总线（campaignGain）→ 挂在 sfxGain 下游
        this.campaignGain = this.ctx.createGain();
        this.campaignGain.gain.value = this.campaignVolume;
        this.campaignGain.connect(this.sfxGain);
        // V16.0：开场/过场旁白总线（introGain）→ 挂在 sfxGain 下游
        this.introGain = this.ctx.createGain();
        this.introGain.gain.value = this.introVolume;
        this.introGain.connect(this.sfxGain);
        // V17.0：战斗音效总线（battleGain）→ 挂在 sfxGain 下游。
        //   所有 V17.0 新增战场音效统一走此总线，可独立混音。
        this.battleGain = this.ctx.createGain();
        this.battleGain.gain.value = this.battleVolume;
        this.battleGain.connect(this.sfxGain);
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
  //
  // 性能优化（audio.js #3 总线查表）：
  //   优化前：tone()/drum()/_noiseBurst() 各自维护一条 ~10 层嵌套三元选择目的节点，
  //   高频战斗音效（弓兵齐射/冲锋每帧数十次）下每次发声都要走一长串三元比较。
  //   优化后：统一收敛到本 _busNode() 方法，switch O(1) 命中；并顺带补齐 'ambient'
  //   路由（原三元无此分支，导致 _startCityAmbient 叫卖声误送 master 总线）。
  _busNode(bus) {
    switch (bus) {
      case 'bgm': return this.bgmGain;
      case 'sfx': return this.sfxGain;
      case 'skill': return this.skillGain;
      case 'duel': return this.duelGain;
      case 'domestic': return this.domesticGain;
      case 'achievement': return this.achievementGain;
      case 'ending': return this.endingGain;
      case 'campaign': return this.campaignGain;
      case 'intro': return this.introGain;
      case 'battle': return this.battleGain;       // V17.0 战斗总线
      case 'ambient': return this.ambientGain;     // 修复：原误路由到 master
      default: return this.master;
    }
  }

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
    // bus 路由：V17.0 起统一走 _busNode() 查表（含 battle/ambient）。
    outNode.connect(this._busNode(bus));
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
    // V17.0：总线路由统一走 _busNode() 查表（含 battle/ambient）。
    g.connect(this._busNode(bus));
    osc.start(t0); osc.stop(t0 + 0.3);
  }

  // ============================================================
  // V8.1 基础合成工具：噪声 buffer / 侧链 ducking / 环境音总线
  // ============================================================
  // 生成一段白噪声 AudioBuffer（秒）。无 ctx 时返回 null。
  // 性能优化#5（内存/GC）：
  //   优化前：每次 noise burst 都按需求秒数新建一个 AudioBuffer（如 0.15s ≈
  //   0.15*48000*4 ≈ 28KB），连续战斗/内政音效下每秒数十次分配，GC 压力明显。
  //   优化后：进程内缓存一个 2s 立体声兼容的单声道噪声 buffer（≈384KB，仅一份），
  //   所有短于 2s 的噪声 burst 复用它（播放时只 stop 在目标时长）。
  //   预期：高频音效场景下临时分配对象数下降 90%+，主线程卡顿减少。
  _noiseBuffer(seconds = 1) {
    if (!this.ctx) return null;
    // 复用缓存：2s 足够覆盖现有所有短时噪声 burst（最长 1s）
    if (!this._noiseBufCache) {
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBufCache = buf;
    }
    if (seconds <= 2) return this._noiseBufCache;
    // 超过 2s 的超长噪声（如未来新增环境音）按需现建
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ============================================================
  // V14.0 通用噪声 burst 工具：带通/高通/低通滤波 + ADSR 包络，
  // 供单挑/内政音效复用（锤击/木屑/金属共振/麦穗沙沙等）。
  // bus: 'duel' | 'domestic' | 'sfx'；sweepTo 可选频率扫频终点。
  // ============================================================
  _noiseBurst({ dur = 0.15, freq = 1000, q = 1, type = 'bandpass', vol = 0.2,
                offset = 0, bus = 'sfx', sweepTo = null, pan = 0 } = {}) {
    if (!this.ctx || this.muted) return null;
    const t0 = this.ctx.currentTime + offset;
    const len = Math.ceil(this.ctx.sampleRate * Math.max(dur, 0.05));
    const nb = this._noiseBuffer(Math.max(dur, 0.05));
    const nsrc = this.ctx.createBufferSource();
    nsrc.buffer = nb;
    nsrc.loop = false;
    const nf = this.ctx.createBiquadFilter();
    nf.type = type;
    nf.frequency.setValueAtTime(freq, t0);
    if (sweepTo) nf.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    nf.Q.value = q;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    nsrc.connect(nf); nf.connect(ng);
    // 立体声定位
    let outNode = ng;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const sp = this.ctx.createStereoPanner();
      sp.pan.value = Math.max(-1, Math.min(1, pan));
      ng.connect(sp); outNode = sp;
    }
    // V17.0：总线路由统一走 _busNode() 查表（含 battle/ambient）。
    outNode.connect(this._busNode(bus));
    nsrc.start(t0); nsrc.stop(t0 + dur + 0.02);
    return { src: nsrc, gain: ng };
  }

  // ============================================================
  // V14.0 SFX 并发 ducking 优化：
  //   多个 SFX 在 200ms 窗口内同时触发时，自动把 sfxGain 临时压到 60%，
  //   避免音效叠加爆音；250ms 无新触发后恢复。duelGain/domesticGain 挂在
  //   sfxGain 下游，因此会一并被合理压低（"非关键音效"）。
  // 调用时机：新音效播放前调用 this._sfxDuck()。
  // ============================================================
  _sfxDuck() {
    if (!this.ctx || !this.sfxGain) return;
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    this._sfxWindow.push(now);
    // 性能优化（audio.js #4 高频战斗音效窗口剪枝）：
    //   基准：原实现用 `while(...) arr.shift()` 剪枝——shift() 是 O(n) 数组搬移。
    //   V17.0 新增弓兵齐射/水战等单次触发即产生 5~7 个音效（playBowVolley 5 矢+噪声），
    //   战斗高潮时每秒数十次发声，每次都搬移整个窗口。
    //   优化：改为环形游标 _sfxHead，只前移游标、不搬移元素；数组长度靠复用旧槽位控制。
    while (this._sfxHead < this._sfxWindow.length &&
           now - this._sfxWindow[this._sfxHead] > 200) {
      this._sfxHead++;
    }
    // 游标已吃掉半数元素且数组过大时，一次性压实，防止数组无限增长
    if (this._sfxHead > 64 && this._sfxHead * 2 > this._sfxWindow.length) {
      this._sfxWindow = this._sfxWindow.slice(this._sfxHead);
      this._sfxHead = 0;
    }
    // 窗口内 ≥3 个并发触发 → 压低非关键音效总线
    const windowCount = this._sfxWindow.length - this._sfxHead;
    if (windowCount >= 3) {
      const t0 = this.ctx.currentTime;
      const normal = this.sfxVolume;
      const ducked = normal * 0.6;
      try {
        this.sfxGain.gain.cancelScheduledValues(t0);
        this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, t0);
        this.sfxGain.gain.linearRampToValueAtTime(ducked, t0 + 0.03);
        this.sfxGain.gain.setValueAtTime(ducked, t0 + 0.25);
        this.sfxGain.gain.linearRampToValueAtTime(normal, t0 + 0.25 + 0.15);
      } catch (e) { /* 调度冲突忽略 */ }
    }
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
    // V17.0：噪声循环总线统一走 _busNode() 查表（默认 ambient）。
    g.connect(this._busNode(bus));
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
  // V14.0「霸业宏图」新增音效（17 种，全部 Web Audio 程序化合成）
  //   6 单挑 + 4 养成 + 5 内政 + 2 进阶；走 duel/domestic/sfx 独立总线。
  //   技术参考：噪声 burst（_noiseBurst）+ 振荡器 ADSR 包络 + 低/高频滤波。
  // ============================================================

  // ---------- 一、武将单挑音效（走 duel 总线） ----------
  // 1. 单挑对峙：低沉战鼓 ×2 + 双方威压低频嗡鸣（55Hz 长音）+ 不协和弦乐
  //    （小二度 220/233Hz 叠加，制造紧张感）
  playDuelStandoff() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    this.drum(0.5, 0, 70, 'duel');
    this.drum(0.45, 0.5, 65, 'duel');
    // 威压低频嗡鸣
    this.tone(55, 1.6, 'sine', 0.16, 0.1, null, 'duel');
    this.tone(58, 1.6, 'sine', 0.12, 0.15, null, 'duel');
    // 紧张感弦乐：小二度不协和（A3 + A#3）
    this.tone(220.00, 1.4, 'sawtooth', 0.08, 0.3, null, 'duel');
    this.tone(233.08, 1.4, 'sawtooth', 0.08, 0.32, null, 'duel');
  }

  // 2. 单挑突进：马蹄急停（低频短鼓）+ 武器破空（带通噪声扫频）+ 战吼（多音失谐）
  playDuelCharge() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 马蹄急停：两声短促低频鼓
    this.drum(0.5, 0, 90, 'duel');
    this.drum(0.4, 0.08, 80, 'duel');
    // 武器破空：2.5kHz → 600Hz 扫频噪声
    this._noiseBurst({ dur: 0.25, freq: 2500, q: 3, type: 'bandpass', vol: 0.18,
      offset: 0.1, bus: 'duel', sweepTo: 600 });
    // 战吼：200~320Hz 失谐锯齿波上滑
    [196, 233, 262, 311].forEach((f, i) =>
      this.tone(f, 0.35, 'sawtooth', 0.1, 0.28 + i * 0.03, f * 1.2, 'duel', (i - 1.5) * 0.15));
  }

  // 3. 单挑重击：低频轰鸣（50Hz 下滑）+ 金属碰撞巨响（高频噪声+方波）+ 震地闷响
  playDuelHeavyHit() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 低频轰鸣
    this.drum(0.7, 0, 60, 'duel');
    this.tone(55, 0.5, 'sine', 0.28, 0, 30, 'duel');
    // 金属碰撞巨响：高频噪声 burst + 2kHz 方波
    this._noiseBurst({ dur: 0.18, freq: 3500, q: 1.5, type: 'highpass', vol: 0.22, bus: 'duel' });
    this.tone(2000, 0.12, 'square', 0.14, 0, null, 'duel');
    // 震地闷响
    this.drum(0.5, 0.15, 45, 'duel');
  }

  // 4. 单挑格挡：金属尖锐碰撞（4kHz 短促正弦）+ 盾牌共振（1.2kHz 衰减）+ 防御者闷哼
  playDuelParry() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 金属尖锐碰撞
    this.tone(4200, 0.06, 'square', 0.18, 0, null, 'duel');
    this.tone(3100, 0.08, 'sine', 0.12, 0.01, null, 'duel');
    // 盾牌共振：1.2kHz 带尾衰减
    this.tone(1200, 0.25, 'triangle', 0.14, 0.02, 800, 'duel');
    // 防御者闷哼：200Hz 短促下滑
    this.tone(200, 0.2, 'sawtooth', 0.1, 0.08, 140, 'duel');
  }

  // 5. 单挑受击：肉体撞击（低频钝响）+ 武将闷哼 + 血量下降音（下行半音）
  playDuelHit() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 肉体撞击：低频钝响
    this.drum(0.55, 0, 110, 'duel');
    this.tone(110, 0.2, 'sine', 0.2, 0, 70, 'duel');
    // 武将闷哼：260→180Hz 下滑
    this.tone(260, 0.3, 'sawtooth', 0.12, 0.05, 180, 'duel');
    // 血量下降：两个下行半音
    this.tone(440, 0.12, 'square', 0.1, 0.15, null, 'duel');
    this.tone(415.3, 0.2, 'square', 0.1, 0.25, null, 'duel');
  }

  // 6a. 单挑胜利：号角长鸣 + 欢呼声 + 金色上行琶音
  playDuelVictory() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 号角长鸣
    this.horn(220.00, 0.9, 0.22, 0, null, -0.1);
    this.horn(329.63, 0.9, 0.2, 0.15, null, 0.1);
    // 欢呼声：中频失谐叠加
    [220, 262, 330, 392].forEach((f, i) =>
      this.tone(f, 0.6, 'sawtooth', 0.07, 0.35 + i * 0.04, f * 1.15, 'duel', (i - 1.5) * 0.18));
    // 金色上行琶音
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.35, 'triangle', 0.2, 0.6 + i * 0.1, null, 'duel'));
    this.drum(0.4, 0.6, 80, 'duel');
  }

  // 6b. 单挑失败：低沉号角 + 叹息声 + 下行音阶
  playDuelDefeat() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    // 低沉号角
    this.tone(130.81, 1.0, 'sawtooth', 0.18, 0, null, 'duel');
    this.tone(98.00, 1.0, 'sawtooth', 0.14, 0.1, null, 'duel');
    // 叹息声：400→250Hz 缓慢下滑
    this.tone(400, 0.8, 'sine', 0.1, 0.3, 250, 'duel');
    // 下行音阶
    [392, 329.63, 261.63, 196].forEach((f, i) =>
      this.tone(f, 0.4, 'sine', 0.16, 0.5 + i * 0.15, null, 'duel'));
  }

  // ---------- 二、武将养成音效（走 sfx 总线） ----------
  // 7. 武将升级：升级光柱（上行音阶 + 金光高频上滑）+ 属性提升叮声×4
  playGeneralUpgrade() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 上行音阶 C-D-E-G-C
    [261.63, 293.66, 329.63, 392.00, 523.25].forEach((f, i) =>
      this.tone(f, 0.25, 'triangle', 0.2, i * 0.09, null, 'sfx'));
    // 金光高频上滑
    this.tone(1200, 0.5, 'sine', 0.1, 0.1, 2400, 'sfx');
    // 属性提升叮声×4（每 0.12s 一声高频）
    for (let i = 0; i < 4; i++) this.bell(1567.98, 0.4, 0.12, 0.55 + i * 0.12);
  }

  // 8. 技能解锁：神秘和弦（小二度叠加）+ 光点汇聚（高频光点）+ 解锁叮声
  playSkillUnlock() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 神秘和弦：E-G-A# 不协和叠加
    [329.63, 392.00, 466.16].forEach((f, i) =>
      this.tone(f, 1.0, 'sine', 0.12, i * 0.08, null, 'sfx'));
    // 光点汇聚：三个高频光点缓慢上行
    [1567.98, 1760.00, 2093.00].forEach((f, i) =>
      this.tone(f, 0.4, 'sine', 0.08, 0.4 + i * 0.12, null, 'sfx'));
    // 解锁叮声
    this.bell(2637.00, 0.8, 0.16, 0.9);
  }

  // 9. 装备穿戴：金属轻响 + 属性加成提示音；音高随品质递增（白/绿/蓝/紫/橙）
  //    rarity: 'common'|'fine'|'rare'|'epic'|'legendary'
  playEquipWear(rarity = 'common') {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 品质 → 基频映射（白 660 → 橙 1320，逐级递增）
    const BASE = { common: 660, fine: 784, rare: 988, epic: 1175, legendary: 1319 };
    const f = BASE[rarity] || 660;
    // 金属轻响：两声短促方波
    this.tone(f, 0.08, 'square', 0.14, 0, null, 'sfx');
    this.tone(f * 1.5, 0.1, 'triangle', 0.12, 0.08, null, 'sfx');
    // 属性加成提示音：高频叮
    this.bell(f * 3, 0.5, 0.1, 0.18);
  }

  // 10. 忠诚度变化：上升→温暖和弦（大三度）；下降→低沉警告音（小二度）
  playLoyaltyChange(up = true) {
    this.resume(); if (!this.ctx) return;
    this._duckBGM();
    if (up) {
      // 温暖和弦：C-E-G 大三和弦
      [261.63, 329.63, 392.00].forEach((f, i) =>
        this.tone(f, 0.6, 'triangle', 0.18, i * 0.06, null, 'sfx'));
    } else {
      // 低沉警告：A + A# 小二度不协和
      this.tone(220.00, 0.6, 'sawtooth', 0.16, 0, null, 'sfx');
      this.tone(233.08, 0.6, 'sawtooth', 0.14, 0.05, null, 'sfx');
      this.tone(110.00, 0.7, 'sine', 0.12, 0.1, null, 'sfx');
    }
  }

  // ---------- 三、内政音效（走 domestic 总线） ----------
  // 11. 城市发展：锤子敲击（低频鼓）+ 木材噪声 + 完成叮声
  playCityDevelop() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 锤子敲击 ×3
    this.drum(0.45, 0, 150, 'domestic');
    this.drum(0.4, 0.18, 150, 'domestic');
    this.drum(0.45, 0.36, 150, 'domestic');
    // 木材噪声：800Hz 带通
    this._noiseBurst({ dur: 0.2, freq: 800, q: 2, type: 'bandpass', vol: 0.12,
      offset: 0.1, bus: 'domestic' });
    // 完成叮声
    this.bell(1567.98, 0.6, 0.14, 0.5);
  }

  // 12. 建筑升级：石材碰撞（低频沉闷）+ 工匠号子（人声音高）+ 完成钟声
  playBuildingUpgrade() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 石材碰撞：两声低频沉闷鼓
    this.drum(0.5, 0, 100, 'domestic');
    this.drum(0.45, 0.25, 90, 'domestic');
    // 工匠号子：300/450Hz 上滑人声感
    this.tone(300, 0.3, 'sawtooth', 0.1, 0.35, 450, 'domestic');
    this.tone(320, 0.3, 'sawtooth', 0.08, 0.6, 480, 'domestic');
    // 完成钟声
    this.bell(1046.5, 1.0, 0.18, 0.9);
  }

  // 13. 税收征收：金币连续碰撞（高频正弦连发）+ 算盘声（中频快速哒哒）
  playTaxCollect() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 金币连续碰撞：5 枚 1.8/2.4kHz 错峰
    for (let i = 0; i < 5; i++) {
      this.tone(1800, 0.08, 'sine', 0.14, i * 0.07, null, 'domestic');
      this.tone(2400, 0.06, 'sine', 0.1, i * 0.07 + 0.03, null, 'domestic');
    }
    // 算盘声：800Hz 短促方波 ×4
    for (let i = 0; i < 4; i++) this.tone(800, 0.04, 'square', 0.08, 0.45 + i * 0.06, null, 'domestic');
  }

  // 14. 徭役征发：人群嘈杂（宽频噪声）+ 劳动号子 + 监工喊声
  playCorveeLevy() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 人群嘈杂：500Hz 宽带噪声
    this._noiseBurst({ dur: 0.8, freq: 500, q: 0.5, type: 'bandpass', vol: 0.12, bus: 'domestic' });
    // 劳动号子：200/240Hz 交替
    [200, 240, 200, 240].forEach((f, i) =>
      this.tone(f, 0.25, 'sawtooth', 0.1, 0.1 + i * 0.25, null, 'domestic'));
    // 监工喊声：高亢 600→800Hz 上滑
    this.tone(600, 0.3, 'sawtooth', 0.12, 1.1, 800, 'domestic');
  }

  // 15. 农业丰收：欢快民乐（五声音阶短旋律）+ 麦穗沙沙（高频细噪）
  playHarvest() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 欢快民乐：G-A-C-D-E 短旋律
    [392, 440, 523.25, 587.33, 659.25].forEach((f, i) =>
      this.tone(f, 0.22, 'triangle', 0.16, i * 0.12, null, 'domestic'));
    // 麦穗沙沙：6kHz 细噪声扫频
    this._noiseBurst({ dur: 0.6, freq: 6000, q: 2, type: 'highpass', vol: 0.06,
      offset: 0.2, bus: 'domestic', sweepTo: 3000 });
  }

  // ---------- 四、兵种进阶音效（走 sfx 总线） ----------
  // 16. 进阶仪式：号角 + 战鼓 + 士兵呐喊 + 金属共鸣收尾
  playUnitAdvance() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 号角
    this.horn(196.00, 0.6, 0.2, 0, null, 0);
    this.horn(293.66, 0.6, 0.18, 0.2, null, 0);
    // 战鼓
    [0, 0.2, 0.4, 0.6].forEach(t => this.drum(0.4, t, 80, 'sfx'));
    // 士兵呐喊
    [220, 262, 330].forEach((f, i) =>
      this.tone(f, 0.4, 'sawtooth', 0.08, 0.5 + i * 0.05, null, 'sfx', (i - 1) * 0.15));
    // 金属共鸣收尾
    this.tone(1567.98, 0.8, 'sine', 0.14, 1.0, null, 'sfx');
    this.tone(2093.00, 0.6, 'sine', 0.08, 1.05, null, 'sfx');
  }

  // 17. 精锐兵种攻击：比普通攻击更厚重（低频增强 + 金属声更亮）
  playEliteStrike() {
    this.resume(); if (!this.ctx) return;
    this._duckBGM(); this._sfxDuck();
    // 低频增强：比普通攻击更深沉
    this.drum(0.65, 0, 55, 'sfx');
    this.tone(50, 0.3, 'sine', 0.22, 0, 30, 'sfx');
    // 金属声更亮：4kHz 尖锐碰撞
    this.tone(4000, 0.1, 'square', 0.18, 0.02, null, 'sfx');
    this._noiseBurst({ dur: 0.12, freq: 3000, q: 1.5, type: 'highpass', vol: 0.18, offset: 0.02, bus: 'sfx' });
    // 重击余韵
    this.drum(0.45, 0.12, 45, 'sfx');
  }

  // ============================================================
  // V14.0：单挑 BGM 自动切换（开始 → 单挑 BGM；结束 → 恢复原场景 BGM）
  // 设计参考：剧情特写音乐切换——进入单挑时记住 _prevSceneBGM，
  //   结束后调用 endDuelBGM() 恢复，避免玩家音乐上下文丢失。
  // ============================================================
  startDuelBGM() {
    this._prevSceneBGM = this._currentTrack;
    this.switchBGM('duel');
  }
  endDuelBGM() {
    const restore = this._prevSceneBGM || 'map';
    this._prevSceneBGM = null;
    this.switchBGM(restore);
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
  // BUG修复（audio.js V21.0 重复方法定义/死代码）：
  //   下列 8 个方法（playLegionForm/playGrandBattleStart/playGrandBattleWin/
  //   playFormationSwitch/playExamHuangbang/playTaxAdjust/playCelestialAnomaly/
  //   playPrinceBorn）曾在本处与下方「V12.5 深化版」区块各定义了一次。
  //   ES class 中同名方法后者覆盖前者，本处这 8 份旧实现（无 _sfxGate 重叠保护）
  //   是永不执行的死代码，且与下方新版语义不一致——一旦有人误删下方区块，
  //   音效会静默退回无保护版本，连击爆音/音量叠加问题回归。
  //   修复：删除本处这 8 份死代码，仅保留下方带 _sfxGate 的深化版；
  //   playCorveeConscript / playSolarTerm 在下方无同名新版，故保留在此处。
  // ============================================================
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
  // 4. 阵法切换音效：金属盾牌碰撞 + 脚步声调整 + 低沉嗡鸣（V17.0 深化，走 battle 总线）
  playFormationSwitch() {
    this.resume(); if (!this.ctx || !this._sfxGate('formation_switch', 200)) return;
    const BUS = 'battle';
    // 金属盾牌碰撞：两声短促金属共振（1.5kHz 高频 + 2.4kHz 泛音）
    this.tone(1500, 0.10, 'triangle', 0.16, 0, 900, BUS);
    this.tone(2400, 0.08, 'square', 0.10, 0.02, null, BUS);
    // 脚步声调整：低频闷响三连（踏步归位），间隔 0.06s
    this.drum(0.30, 0.04, 95, BUS);
    this.drum(0.26, 0.11, 90, BUS);
    this.drum(0.30, 0.18, 95, BUS);
    // 金属摩擦余韵：带通噪声短扫
    this._noiseBurst({ dur: 0.12, freq: 1600, q: 2, type: 'bandpass', vol: 0.10,
      offset: 0.02, bus: BUS, sweepTo: 600 });
    // 低沉嗡鸣尾音
    this.tone(120, 0.25, 'sine', 0.10, 0.1, 70, BUS);
  }
  // 5. 科举放榜音效：扬琴琶音+编钟喜庆
  playExamHuangbang() {
    this.resume(); if (!this.ctx || !this._sfxGate('exam_huangbang', 300)) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    notes.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, i * 0.08, null, 'sfx'));
    this.bell(1046.50, 1.0, 0.15, notes.length * 0.08, 0);
  }

  // ============================================================
  // V22.0「音效扩充」新增 6 个科举/选官事件音效（全部 Web Audio 程序化合成）
  // 技术参考：MDN Web Audio——钟声=基音+非谐泛音长尾(bell)；
  //   人声欢呼/鞭炮/马蹄/叹息/纸张=滤波白噪声 burst(_noiseBurst)；
  //   礼乐/吟诵/民乐=oscillator 序列(tone/horn)；官印/印章=低频重击+木质泛音。
  // ============================================================

  // 5a. 放榜：钟声 + 百姓欢呼 + 鞭炮齐鸣
  //   钟声三响编钟(C4/E4/G4)定调；宽频带通噪声浪潮模拟千人群呼；
  //   高频短促噪声 burst 连续噼啪模拟鞭炮炸响。
  playExamRelease() {
    this.resume(); if (!this.ctx || !this._sfxGate('exam_release', 800)) return;
    const BUS = 'sfx';
    // 钟声三响（金銮殿钟鼓司鸣钟）
    this.bell(261.63, 1.8, 0.20, 0, 0);
    this.bell(329.63, 1.6, 0.16, 0.3, 0);
    this.bell(392.00, 1.8, 0.16, 0.6, 0);
    // 百姓欢呼：宽频噪声浪潮（左右声像散开）
    this._noiseBurst({ dur: 1.0, freq: 700, q: 0.7, type: 'bandpass', vol: 0.16, offset: 0.7, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 1.0, freq: 850, q: 0.7, type: 'bandpass', vol: 0.16, offset: 0.75, bus: BUS, pan: 0.4 });
    this._noiseBurst({ dur: 0.8, freq: 1000, q: 0.9, type: 'bandpass', vol: 0.12, offset: 0.8, bus: BUS, pan: 0 });
    // 鞭炮齐鸣：高频短促噪声 burst 连续噼啪（间隔 ~70ms）
    for (let i = 0; i < 8; i++) {
      this._noiseBurst({ dur: 0.06, freq: 2600 + i * 200, q: 1.2, type: 'highpass', vol: 0.10, offset: 0.9 + i * 0.07, bus: BUS, pan: (i % 2 ? 0.4 : -0.4) });
    }
    // 上扬喜庆琶音收尾
    const arp = [523.25, 659.25, 783.99, 1046.5];
    arp.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14, 1.6 + i * 0.1, null, BUS));
  }

  // 5b. 状元游街：民乐鼓吹 + 马蹄声 + 百姓夹道欢呼
  //   民乐：上扬五声旋律(三角波)模拟鼓吹；马蹄：低频鼓点左右交替模拟马蹄；
  //   百姓欢呼：宽频噪声浪潮。
  playZhuangyuanParade() {
    this.resume(); if (!this.ctx || !this._sfxGate('zhuangyuan_parade', 900)) return;
    const BUS = 'sfx';
    // 民乐鼓吹：上扬五声行进旋律
    const melody = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    melody.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, i * 0.18, null, BUS, (i % 2 ? 0.2 : -0.2)));
    // 马蹄声：低频鼓点 + 高频声像噪声，左右交替（模拟马蹄"的-笃、的-笃"）
    for (let i = 0; i < 10; i++) {
      this.drum(0.22, 0.2 + i * 0.12, 95 - (i % 2) * 10, BUS);
      this._noiseBurst({ dur: 0.04, freq: 1800, q: 1.5, type: 'highpass', vol: 0.06, offset: 0.2 + i * 0.12, bus: BUS, pan: (i % 2 ? 0.5 : -0.5) });
    }
    // 百姓夹道欢呼：宽频噪声浪潮
    this._noiseBurst({ dur: 1.2, freq: 750, q: 0.7, type: 'bandpass', vol: 0.14, offset: 0.3, bus: BUS, pan: -0.5 });
    this._noiseBurst({ dur: 1.2, freq: 900, q: 0.7, type: 'bandpass', vol: 0.14, offset: 0.35, bus: BUS, pan: 0.5 });
  }

  // 5c. 同年宴：酒杯碰撞 + 诗词吟诵
  //   酒杯碰撞：高频短促正弦"叮当"（玻璃/瓷杯）；
  //   诗词吟诵：中低频正弦滑音序列（模拟吟诵平仄起伏）。
  playTongnianBanquet() {
    this.resume(); if (!this.ctx || !this._sfxGate('tongnian_banquet', 700)) return;
    const BUS = 'sfx';
    // 酒杯碰撞：高频短促正弦叮当（左右声像，模拟碰杯）
    for (let i = 0; i < 4; i++) {
      this.tone(1567.98 + (i % 2) * 220, 0.12, 'sine', 0.10, 0.1 + i * 0.15, null, BUS, (i % 2 ? 0.3 : -0.3));
    }
    // 诗词吟诵：中低频正弦滑音序列（模拟文人吟诵"平-平-仄-平"起伏）
    const chant = [293.66, 329.63, 392.0, 329.63, 293.66, 261.63, 329.63];
    chant.forEach((f, i) => this.tone(f, 0.5, 'sine', 0.10, 0.6 + i * 0.28, f * 1.05, BUS));
    // 酒樽倒酒：低频噪声潺潺
    this._noiseBurst({ dur: 0.6, freq: 500, q: 1.2, type: 'bandpass', vol: 0.06, offset: 0.3, bus: BUS, pan: 0 });
  }

  // 5d. 落第：叹息 + 纸张飘落
  //   叹息：低频带通噪声缓慢衰减（人嗟叹）；
  //   纸张飘落：高频高通噪声缓慢衰减（试卷散落风声）。
  playExamFail() {
    this.resume(); if (!this.ctx || !this._sfxGate('exam_fail', 600)) return;
    const BUS = 'sfx';
    // 叹息：低频带通噪声缓慢衰减（"唉——"）
    this._noiseBurst({ dur: 0.9, freq: 220, q: 0.8, type: 'bandpass', vol: 0.16, offset: 0, bus: BUS, pan: 0 });
    // 纸张飘落：高频高通噪声缓慢衰减（试卷簌簌飘落）
    this._noiseBurst({ dur: 1.2, freq: 4000, q: 1.0, type: 'highpass', vol: 0.06, offset: 0.3, bus: BUS, pan: -0.2 });
    this._noiseBurst({ dur: 1.0, freq: 4500, q: 1.0, type: 'highpass', vol: 0.05, offset: 0.5, bus: BUS, pan: 0.2 });
    // 低沉下行尾音（情绪低落）
    this.tone(392.0, 1.0, 'sine', 0.12, 0.2, 261.63, BUS);
  }

  // 5e. 授官：官印声 + 礼乐
  //   官印声：低频重击(钤印)+高频木质共振(印匣)；
  //   礼乐：编钟+号角（朝堂雅乐）。
  playAppointOffice() {
    this.resume(); if (!this.ctx || !this._sfxGate('appoint_office', 700)) return;
    const BUS = 'sfx';
    // 官印声：低频重击（钤印"砰"）+ 高频木质共振（印匣"哒"）
    this.drum(0.5, 0, 120, BUS);
    this._noiseBurst({ dur: 0.12, freq: 2000, q: 1.5, type: 'highpass', vol: 0.12, offset: 0.05, bus: BUS, pan: 0 });
    // 礼乐：编钟列阵（G宫）
    const chimes = [392.0, 523.25, 659.25, 783.99];
    chimes.forEach((f, i) => this.bell(f, 1.8, 0.16, 0.3 + i * 0.15, (i - 1.5) * 0.15));
    // 号角长鸣（庄严）
    this.horn(196.0, 1.4, 0.20, 0.4, null, 0);
  }

  // 5f. 考核：翻卷 + 印章声
  //   翻卷：带通噪声快速抖动（翻阅卷宗）；
  //   印章声：低频重击+木质共振（批卷钤印）。
  playOfficialAssessment() {
    this.resume(); if (!this.ctx || !this._sfxGate('official_assessment', 500)) return;
    const BUS = 'sfx';
    // 翻卷：带通噪声快速抖动（翻阅试卷/卷宗，连续 3 次）
    for (let i = 0; i < 3; i++) {
      this._noiseBurst({ dur: 0.08, freq: 3000, q: 1.2, type: 'bandpass', vol: 0.08, offset: i * 0.12, bus: BUS, pan: (i % 2 ? 0.2 : -0.2) });
    }
    // 印章声：低频重击（朱笔钤印）+ 高频木质共振（印泥/印匣）
    this.drum(0.4, 0.45, 110, BUS);
    this._noiseBurst({ dur: 0.1, freq: 2400, q: 1.5, type: 'highpass', vol: 0.10, offset: 0.48, bus: BUS, pan: 0 });
    // 批阅落笔：中高频轻响（毛笔落纸）
    this.tone(1046.5, 0.15, 'triangle', 0.08, 0.65, null, BUS);
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
      // ---- V17.0 技能音效深化：新增四类独特音色 ----
      case 'arrow': // 箭雨=弓弦+多矢破空（复用 arrowRain）
        this.playArrowRain();
        break;
      case 'buff': // 增益=温暖上行大调琶音（G-B-D-G，明亮）
        [392.00, 493.88, 587.33, 783.99].forEach((f, i) =>
          this.tone(f, 0.45, 'triangle', 0.16, i * 0.1, null, 'skill'));
        this.bell(1046.5, 0.8, 0.10, 0.5, 0);
        break;
      case 'trap': // 陷阱=静默绷弦+突然弹出（高频上跳+低啪）
        this.tone(800, 0.3, 'sine', 0.06, 0, 1600, 'skill');
        this.tone(2400, 0.08, 'square', 0.14, 0.3, null, 'skill');
        this.drum(0.3, 0.3, 120, 'skill');
        break;
      case 'rout': // 摧崩=号角急转直下+噪声溃散
        this.horn(261.63, 0.5, 0.2, 0, 130, 0);
        this._noiseBurst({ dur: 0.6, freq: 800, q: 1, type: 'bandpass', vol: 0.14,
          offset: 0.2, bus: 'skill', sweepTo: 200 });
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
  // V15.0「音效扩充」新增音效（全部 Web Audio 程序化合成）
  // 总线：成就庆典走 achievementGain；结局/终局走 endingGain。
  // 技术参考：MDN Web Audio——琶音=短延迟重复音；金属共鸣=基音+高次非谐泛音；
  //   风声/雨声=滤波白噪声；低频呼啸=低通噪声+LFO 扫频。
  // ============================================================

  // 1) 成就解锁：金色光芒上升琶音 + 清脆叮声 + 奖杯旋转金属声
  playAchievementGain() {
    this.resume(); if (!this.ctx || !this._sfxGate('achievement_gain', 600)) return;
    const BUS = 'achievement';
    // 金色光芒：快速上行琶音（C5→G6），模拟光芒升腾
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    arp.forEach((f, i) => {
      this.tone(f, 0.35, 'triangle', 0.18, i * 0.06, null, BUS);
      this.tone(f * 2, 0.25, 'sine', 0.08, i * 0.06, null, BUS); // 金色泛光
    });
    // 清脆叮声：高音钟鸣（C7/E7 叠非谐泛音）
    this.bell(2093.0, 1.2, 0.20, arp.length * 0.06, 0);
    this.tone(2637.0, 0.9, 'sine', 0.12, arp.length * 0.06 + 0.05, null, BUS);
    // 奖杯旋转金属声：高次金属泛音慢速衰减（基音 3kHz 附近 + 3.4x/5.1x 非谐）
    this.tone(3136.0, 1.4, 'sine', 0.10, arp.length * 0.06 + 0.15, null, BUS);
    this.tone(3136.0 * 3.4, 1.0, 'sine', 0.06, arp.length * 0.06 + 0.15, null, BUS);
    this.tone(3136.0 * 5.1, 0.7, 'sine', 0.04, arp.length * 0.06 + 0.15, null, BUS);
    this.drum(0.35, arp.length * 0.06 + 0.1, 85, BUS);
  }

  // 2) 段位升级：号角 + 和弦上行 + 金光共鸣
  playRankUp() {
    this.resume(); if (!this.ctx || !this._sfxGate('rank_up', 600)) return;
    const BUS = 'achievement';
    // 号角三连（G3→D4→G4），庄严
    this.horn(196.0, 0.5, 0.22, 0, null, 0);
    this.horn(293.66, 0.5, 0.22, 0.22, null, 0);
    this.horn(392.0, 0.7, 0.24, 0.44, null, 0);
    // 和弦上行：C-E-G-C 大三和弦逐拍上行
    const chord = [261.63, 329.63, 392.0, 523.25];
    chord.forEach((f, i) => {
      this.tone(f, 0.6, 'triangle', 0.2, 0.66 + i * 0.12, null, BUS);
      this.tone(f * 2, 0.4, 'sine', 0.08, 0.66 + i * 0.12, null, BUS); // 金光共鸣
    });
    this.drum(0.4, 0.66, 75, BUS);
    this.drum(0.35, 1.0, 70, BUS);
  }

  // ============================================================
  // V19.0「音效扩充」新增音效（全部 Web Audio 程序化合成）
  // 总线：默认走 sfxGain；与既有科技/文化音效风格一致。
  // ============================================================

  // 科技研究完成（V19.0 版）：书卷翻开 + 灵光嗡鸣 + 编钟
  // 设计：
  //   1) 书卷翻开——两缕短促纸感噪声（带通 2.5~4kHz，快速起音），模拟翻页；
  //   2) 灵光嗡鸣——C 大调分解和弦（C5/E5/G5/C6）慢速长音渐起渐落，
  //      叠加高频正弦微光上滑，营造"灵光乍现"的通透感；
  //   3) 编钟——C5/G5 双钟叠非谐泛音，庄严收束。
  playTechResearchEpic() {
    this.resume(); if (!this.ctx || !this._sfxGate('tech_research_epic', 600)) return;
    this._duckBGM(); this._sfxDuck();
    // 1) 书卷翻开：两页纸感噪声（先左后右，立体）
    this._noiseBurst({ dur: 0.12, freq: 2600, q: 1.2, type: 'bandpass', vol: 0.14, offset: 0.0, bus: 'sfx', pan: -0.25 });
    this._noiseBurst({ dur: 0.14, freq: 3200, q: 1.1, type: 'bandpass', vol: 0.13, offset: 0.12, bus: 'sfx', pan: 0.25 });
    // 2) 灵光嗡鸣：分解和弦慢速渐起（0.15s 起音，2.0s 长尾）
    const glow = [523.25, 659.25, 783.99, 1046.5];
    glow.forEach((f, i) => {
      this.tone(f, 1.8, 'sine', 0.10, 0.25 + i * 0.05, null, 'sfx', (i - 1.5) * 0.12);
      this.tone(f * 2, 1.2, 'sine', 0.04, 0.25 + i * 0.05, null, 'sfx', (i - 1.5) * 0.12); // 灵光泛光
    });
    // 高频微光上滑（C6→E6）
    this.tone(2093.0, 1.2, 'sine', 0.07, 0.5, 2637.0, 'sfx');
    // 3) 编钟：C5/G5 双钟齐鸣
    this.bell(523.25, 1.8, 0.20, 0.55, -0.1);
    this.bell(783.99, 1.5, 0.15, 0.7, 0.15);
  }

  // 文化建筑建成（V19.0）：钟声 + 祥云音效
  // 设计：
  //   1) 钟声——编钟 D 宫主音（D4/A4）轻鸣，温润不喧；
  //   2) 祥云——低通噪声缓慢向上扫频（sweep 400→2400Hz），长起音长尾音，
  //      如云气舒卷；叠加一串极轻的五声上行泛音（D-E-#F-A），似祥云升腾。
  playCultureHallBuilt() {
    this.resume(); if (!this.ctx || !this._sfxGate('culture_hall_built', 700)) return;
    this._duckBGM(); this._sfxDuck();
    // 1) 钟声（D 宫主音）
    this.bell(587.33 /*D5*/, 1.6, 0.18, 0.0, 0);
    this.bell(440.00 /*A4*/, 1.4, 0.12, 0.18, 0.2);
    // 2) 祥云：低通噪声缓慢上扫（云气舒卷）
    this._noiseBurst({ dur: 1.6, freq: 400, q: 0.8, type: 'lowpass', vol: 0.10,
                       offset: 0.1, bus: 'sfx', sweepTo: 2400, pan: 0 });
    // 祥云升腾：极轻的 D 宫五声上行泛音
    const cloud = [587.33, 659.25, 739.99 /*F#5*/, 880.00, 1174.66 /*D6*/];
    cloud.forEach((f, i) => this.tone(f, 0.7, 'sine', 0.06, 0.25 + i * 0.16, null, 'sfx', (i % 2 ? 0.15 : -0.15)));
  }

  // 文化值提升（V19.0）：柔和上升音阶
  // 设计：C 宫五声柔和上行（C4-D4-E4-G4-A4-C5），正弦/三角长音、低音量、
  //   相邻音微微交叠，尾音自然消散，营造"涵养渐深、温润而升"的雅致感。
  playCultureRise() {
    this.resume(); if (!this.ctx || !this._sfxGate('culture_rise', 500)) return;
    this._duckBGM();
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    scale.forEach((f, i) => {
      this.tone(f, 0.55, 'sine', 0.11, i * 0.09, null, 'sfx', (i - 2.5) * 0.06);
      this.tone(f * 2, 0.4, 'sine', 0.03, i * 0.09, null, 'sfx'); // 温润泛音
    });
  }

  // 3) 结局结算：按评级变奏（S 级庆典 / B 级和平 / D 级悲怆）。走 endingGain。
  playEndingSfx(rank = 'S') {
    this.resume(); if (!this.ctx || !this._sfxGate('ending_sfx', 1500)) return;
    const BUS = 'ending';
    if (rank === 'S') {
      // S：编钟齐鸣 + 号角辉煌（庆典）
      const chimes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
      chimes.forEach((f, i) => this.bell(f, 2.2, 0.20, i * 0.12, 0));
      this.horn(196.0, 1.6, 0.22, 0.3, null, -0.3);
      this.horn(293.66, 1.6, 0.22, 0.45, null, 0.3);
      [0, 0.25, 0.5, 0.75].forEach((t, i) => this.drum(0.45 - i * 0.05, t, 70 - i * 4, BUS));
    } else if (rank === 'D') {
      // D：悲怆——低音下行弦乐长音 + 低沉号角滑音 + 慢鼓
      const descent = [220.0, 207.65, 196.0, 174.61, 164.81];
      descent.forEach((f, i) => this.tone(f, 1.0, 'sine', 0.16, i * 0.25, null, BUS, (i % 2 ? 0.2 : -0.2)));
      this.horn(130.81, 1.8, 0.22, 0.2, 65, 0);
      this.drum(0.4, 0.2, 55, BUS);
      this.drum(0.35, 0.7, 45, BUS);
      this.drum(0.3, 1.2, 38, BUS);
    } else {
      // B：和平——温润宫和弦铺底 + 编钟轻敲（舒缓）
      const warm = [261.63, 329.63, 392.0, 523.25];
      warm.forEach((f, i) => this.tone(f, 1.6, 'sine', 0.12, i * 0.15, null, BUS, (i - 1.5) * 0.15));
      this.bell(523.25, 2.0, 0.14, 0.6, 0);
      this.bell(659.25, 1.8, 0.10, 0.9, 0.2);
    }
  }

  // 4) 外交音效
  // 4a. 联盟达成：友好和弦（C-E-G 温暖大三和弦，缓缓铺展）
  playDiploAlliance() {
    this.resume(); if (!this.ctx || !this._sfxGate('diplo_alliance', 400)) return;
    const chord = [261.63, 329.63, 392.0, 523.25];
    chord.forEach((f, i) => this.tone(f, 0.9, 'sine', 0.18, i * 0.1, null, 'sfx', (i - 1.5) * 0.2));
    this.tone(1046.5, 0.8, 'triangle', 0.08, 0.5, null, 'sfx');
  }
  // 4b. 宣战：战鼓 + 号角（紧张尖锐）
  playDiploWar() {
    this.resume(); if (!this.ctx || !this._sfxGate('diplo_war', 400)) return;
    this.drum(0.5, 0, 90, 'sfx');
    this.drum(0.45, 0.18, 95, 'sfx');
    this.horn(233.08, 0.6, 0.24, 0.05, null, 0);
    this.horn(233.08 * 1.5, 0.5, 0.2, 0.25, null, 0);
    this.drum(0.5, 0.4, 100, 'sfx');
  }
  // 4c. 联姻：喜庆民乐（五声上扬 + 笛音滑奏，热闹）
  playDiploMarriage() {
    this.resume(); if (!this.ctx || !this._sfxGate('diplo_marriage', 400)) return;
    const seq = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    seq.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, i * 0.08, null, 'sfx', (i % 2 ? 0.2 : -0.2)));
    this.tone(1318.51, 0.4, 'sine', 0.10, seq.length * 0.08, null, 'sfx');
    this.drum(0.3, 0.2, 110, 'sfx'); // 喜庆鼓点
  }
  // 4d. 贸易：金币 + 算盘（钱币高频双音 + 木珠噼啪噪声）
  playDiploTrade() {
    this.resume(); if (!this.ctx || !this._sfxGate('diplo_trade', 300)) return;
    // 金币：三连高频双音
    for (let i = 0; i < 3; i++) {
      this.tone(1567.98, 0.08, 'sine', 0.16, i * 0.09, null, 'sfx', 0.3);
      this.tone(2093.0, 0.10, 'sine', 0.12, i * 0.09 + 0.04, null, 'sfx', 0.3);
    }
    // 算盘：短促木质噪声噼啪（带通短 burst）
    for (let i = 0; i < 4; i++) this._noiseBurst({ dur: 0.04, freq: 1800 + i * 300, q: 2, type: 'bandpass', vol: 0.10, offset: 0.1 + i * 0.06, bus: 'sfx' });
  }

  // 5) 谍报音效
  // 5a. 潜行：低沉紧张弦乐（低音小二度持续脉动，悬疑）
  playSpySneak() {
    this.resume(); if (!this.ctx || !this._sfxGate('spy_sneak', 500)) return;
    // 低长音 C3 与 C#3 小二度叠加 → 紧张感
    this.tone(130.81, 1.4, 'sawtooth', 0.10, 0, null, 'sfx', -0.2);
    this.tone(138.59, 1.4, 'sawtooth', 0.08, 0.05, null, 'sfx', 0.2);
    // 低沉脉动
    this.tone(98.0, 1.4, 'sine', 0.12, 0, 60, 'sfx');
  }
  // 5b. 情报获取：翻书（噪声）+ 墨水（水滴式高频滴声）
  playSpyIntel() {
    this.resume(); if (!this.ctx || !this._sfxGate('spy_intel', 400)) return;
    // 翻书：带通噪声快速抖动
    this._noiseBurst({ dur: 0.18, freq: 2500, q: 1.5, type: 'bandpass', vol: 0.14, offset: 0, bus: 'sfx' });
    this._noiseBurst({ dur: 0.12, freq: 3000, q: 1.5, type: 'bandpass', vol: 0.10, offset: 0.18, bus: 'sfx' });
    // 墨水滴落：两声高频滴
    this.tone(1760.0, 0.15, 'sine', 0.12, 0.3, 1200, 'sfx');
    this.tone(1975.5, 0.12, 'sine', 0.10, 0.45, 1300, 'sfx');
  }
  // 5c. 策反：密谋低语（滤波噪声耳语 + 不协和低音低语）
  playSpyTurn() {
    this.resume(); if (!this.ctx || !this._sfxGate('spy_turn', 600)) return;
    // 耳语：带通中频噪声起伏（模拟低语）
    this._noiseBurst({ dur: 0.8, freq: 900, q: 3, type: 'bandpass', vol: 0.12, offset: 0, bus: 'sfx' });
    this._noiseBurst({ dur: 0.7, freq: 1100, q: 3, type: 'bandpass', vol: 0.10, offset: 0.4, bus: 'sfx' });
    // 密谋低音：不协和微音程
    this.tone(116.54, 1.2, 'triangle', 0.10, 0.1, null, 'sfx', -0.2);
    this.tone(123.47, 1.2, 'triangle', 0.08, 0.25, null, 'sfx', 0.2);
  }

  // 6) 科举：考试钟声 + 金榜题名喜庆乐
  playExamBell() {
    this.resume(); if (!this.ctx || !this._sfxGate('exam_bell', 600)) return;
    // 考试钟声：三响编钟（C4/E4/G4）
    this.bell(261.63, 1.6, 0.20, 0, 0);
    this.bell(329.63, 1.4, 0.16, 0.3, 0);
    this.bell(392.0, 1.6, 0.16, 0.6, 0);
    // 金榜题名喜庆乐：上扬五声旋律
    const seq = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.51];
    seq.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, 1.0 + i * 0.09, null, 'sfx'));
    this.drum(0.3, 1.0, 100, 'sfx');
  }

  // ============================================================
  // V16.0「音效扩充」新增 8 类音效（全部 Web Audio 程序化合成）
  // 总线：战役类走 campaignGain；开场/过场类走 introGain。
  // 技术参考：MDN Web Audio——号角=锯齿波长音+五度泛音；编钟=基音+非谐泛音长尾；
  //   风声=滤波白噪声；翻页=带通噪声快速抖动；男声氛围=低频正弦+低频噪声嗡鸣。
  // ============================================================

  // 1) 战役开始：号角长鸣 + 战鼓滚奏 + 全军呐喊（群噪起伏）
  playCampaignStart() {
    this.resume(); if (!this.ctx || !this._sfxGate('campaign_start', 800)) return;
    const BUS = 'campaign';
    // 号角长鸣：G2→G3 主号角 + 五度泛音，长音 1.6s
    this.horn(98.0, 1.6, 0.26, 0, null, -0.2);
    this.horn(196.0, 1.6, 0.22, 0.1, null, 0.2);
    this.horn(146.83, 1.4, 0.18, 0.2, null, 0);
    // 战鼓滚奏：由弱渐强的连续低频鼓点
    for (let i = 0; i < 6; i++) this.drum(0.3 + i * 0.05, 0.4 + i * 0.12, 60 - i * 3, BUS);
    // 全军呐喊：宽频带通噪声群吼（左右声像散开，模拟千军万马）
    this._noiseBurst({ dur: 0.7, freq: 400, q: 0.8, type: 'bandpass', vol: 0.16, offset: 0.5, bus: BUS, pan: -0.5 });
    this._noiseBurst({ dur: 0.7, freq: 500, q: 0.8, type: 'bandpass', vol: 0.16, offset: 0.55, bus: BUS, pan: 0.5 });
    this._noiseBurst({ dur: 0.5, freq: 700, q: 1.0, type: 'bandpass', vol: 0.12, offset: 0.6, bus: BUS, pan: 0 });
  }

  // 2) 战役胜利：庆典号角 + 编钟齐鸣 + 欢呼声 + 金色琶音
  playCampaignVictory() {
    this.resume(); if (!this.ctx || !this._sfxGate('campaign_victory', 800)) return;
    const BUS = 'campaign';
    // 庆典号角三连（辉煌上行）
    this.horn(196.0, 0.6, 0.24, 0, null, 0);
    this.horn(293.66, 0.6, 0.24, 0.22, null, 0);
    this.horn(392.0, 0.9, 0.26, 0.44, null, 0);
    // 编钟齐鸣：G宫大调编钟列阵
    const chimes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    chimes.forEach((f, i) => this.bell(f, 2.0, 0.18, 0.6 + i * 0.1, (i - 2) * 0.15));
    // 金色琶音：快速上行分解和弦（C5→E6）
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    arp.forEach((f, i) => {
      this.tone(f, 0.3, 'triangle', 0.14, 1.0 + i * 0.06, null, BUS);
      this.tone(f * 2, 0.2, 'sine', 0.06, 1.0 + i * 0.06, null, BUS);
    });
    // 欢呼声：宽频噪声浪潮
    this._noiseBurst({ dur: 1.0, freq: 800, q: 0.7, type: 'bandpass', vol: 0.14, offset: 0.8, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 1.0, freq: 900, q: 0.7, type: 'bandpass', vol: 0.14, offset: 0.85, bus: BUS, pan: 0.4 });
    // 定音鼓收尾
    this.drum(0.5, 0.6, 75, BUS);
    this.drum(0.45, 1.0, 70, BUS);
    this.drum(0.5, 1.4, 65, BUS);
  }

  // 3) 战役失败：低沉号角 + 鼓声渐弱 + 悲怆弦乐下行
  playCampaignDefeat() {
    this.resume(); if (!this.ctx || !this._sfxGate('campaign_defeat', 800)) return;
    const BUS = 'campaign';
    // 低沉号角：Bb1 长音滑向更低，悲怆
    this.horn(116.54, 2.0, 0.22, 0, 58, 0);
    // 鼓声渐弱：每拍音量递减、频率下沉
    for (let i = 0; i < 5; i++) this.drum(0.45 - i * 0.06, i * 0.35, 55 - i * 4, BUS);
    // 悲怆弦乐：A羽小调式下行长音（正弦长音模拟弦乐铺底）
    const descent = [220.0, 207.65, 196.0, 174.61, 164.81, 146.83];
    descent.forEach((f, i) => this.tone(f, 0.9, 'sine', 0.14, 0.5 + i * 0.3, null, BUS, (i % 2 ? 0.25 : -0.25)));
    // 尾音：低音长嗡
    this.tone(98.0, 2.5, 'sine', 0.12, descent.length * 0.3 + 0.5, null, BUS);
  }

  // 4) 三星评级：每星一个叮声（音阶递增：C5→E5→G5）
  // stars: 1~3；已评过的星不重复响（由 UI 按顺序逐星调用即可）。
  playStarRating(stars = 1) {
    this.resume(); if (!this.ctx) return;
    const BUS = 'campaign';
    // 音阶递增：第1星 C5、第2星 E5、第3星 G5（五声宫调上行大三度）
    const starNotes = [523.25, 659.25, 783.99];
    const n = Math.max(1, Math.min(3, stars | 0));
    for (let i = 0; i < n; i++) {
      const f = starNotes[i];
      // 清脆叮声：高频正弦+泛音，带轻微金属感
      this.tone(f, 0.5, 'sine', 0.22, i * 0.25, null, BUS);
      this.tone(f * 2, 0.4, 'sine', 0.10, i * 0.25, null, BUS);
      this.tone(f * 2.76, 0.3, 'sine', 0.05, i * 0.25, null, BUS); // 金属泛音
    }
    // 满三星加一枚金色尾叮
    if (n >= 3) this.tone(1046.5, 0.8, 'triangle', 0.18, n * 0.25, null, BUS);
  }

  // 5) 开场旁白氛围音：低沉男声质感（低频嗡鸣 + 风声）
  // 用于开场/过场演出的底噪，营造史诗叙事的沉郁感。
  playIntroAmbience() {
    this.resume(); if (!this.ctx || !this._sfxGate('intro_ambience', 1500)) return;
    const BUS = 'intro';
    // 低频嗡鸣：60Hz 正弦持续音（模拟胸腔共鸣）+ 55Hz 衬底
    this.tone(60.0, 3.0, 'sine', 0.18, 0, null, BUS);
    this.tone(55.0, 3.0, 'sine', 0.12, 0.1, null, BUS);
    this.tone(82.41, 2.5, 'triangle', 0.08, 0.2, null, BUS);
    // 风声：低通噪声缓起缓落（0.5s 起音 / 2s 维持 / 0.5s 释放）
    this._noiseBurst({ dur: 2.8, freq: 400, q: 0.6, type: 'lowpass', vol: 0.10, offset: 0.2, bus: BUS, sweepTo: 200 });
    this._noiseBurst({ dur: 2.4, freq: 700, q: 0.8, type: 'bandpass', vol: 0.06, offset: 0.6, bus: BUS });
  }

  // 6) 时间线过渡：翻页声 + 风声过渡
  playTimelineTransition() {
    this.resume(); if (!this.ctx || !this._sfxGate('timeline_transition', 400)) return;
    const BUS = 'intro';
    // 翻页声：带通噪声快速抖动两次（模拟书页/卷轴翻动）
    this._noiseBurst({ dur: 0.18, freq: 2200, q: 1.4, type: 'bandpass', vol: 0.16, offset: 0, bus: BUS });
    this._noiseBurst({ dur: 0.14, freq: 2600, q: 1.4, type: 'bandpass', vol: 0.12, offset: 0.18, bus: BUS });
    this._noiseBurst({ dur: 0.22, freq: 1800, q: 1.2, type: 'bandpass', vol: 0.10, offset: 0.36, bus: BUS });
    // 风声过渡：低通噪声滑向低频，营造时空流转
    this._noiseBurst({ dur: 1.2, freq: 1200, q: 0.7, type: 'lowpass', vol: 0.10, offset: 0.3, bus: BUS, sweepTo: 150 });
    // 过渡尾音：轻柔五声上滑（提示新时间线）
    this.tone(392.0, 0.4, 'sine', 0.08, 0.7, 587.33, BUS);
  }

  // 7) NG+ 界面：神秘解锁音效 + 奖励树展开音
  playNGPlusUnlock() {
    this.resume(); if (!this.ctx || !this._sfxGate('ngplus_unlock', 800)) return;
    const BUS = 'achievement';
    // 神秘解锁：不协和微音程缓缓打开（悬疑→揭示）
    this.tone(220.0, 1.2, 'sine', 0.14, 0, null, BUS, -0.2);
    this.tone(233.08, 1.2, 'sine', 0.12, 0.15, null, BUS, 0.2);
    // 奖励树展开：琶音逐级展开（每级一个音符，模拟树枝点亮）
    const bloom = [440.0, 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.51];
    bloom.forEach((f, i) => {
      this.tone(f, 0.35, 'triangle', 0.16, 0.6 + i * 0.09, null, BUS);
      this.tone(f * 2, 0.2, 'sine', 0.06, 0.6 + i * 0.09, null, BUS); // 光点
    });
    // 树顶金光：高音编钟
    this.bell(1567.98, 1.5, 0.16, 0.6 + bloom.length * 0.09, 0);
    this.drum(0.35, 0.6, 70, BUS);
  }

  // 8) 教程提示：轻量提示音（短而不烦人）
  playTutorialHint() {
    this.resume(); if (!this.ctx || !this._sfxGate('tutorial_hint', 500)) return;
    const BUS = 'intro';
    // 双音轻提示：B5→E6 短促明亮，音量压低，不打断沉浸感
    this.tone(987.77, 0.12, 'sine', 0.14, 0, null, BUS);
    this.tone(1318.51, 0.18, 'sine', 0.12, 0.09, null, BUS);
  }

  // ============================================================
  // V17.0「音效扩充」新增战场音效（全部 Web Audio 程序化合成）
  // 总线：统一走 battleGain 独立战斗总线（可独立混音）。
  // 技术参考：金属碰撞=短包络正弦+方波泛音；脚步=低频鼓脉冲；
  //   逃跑嘈杂=宽频带通噪声起伏；水战=低通噪声浪+失谐人声锯齿。
  // ============================================================

  // 1) 士气崩溃：号角慌乱 + 士兵逃跑嘈杂 + 旗帜倒地声
  playMoraleBreak() {
    this.resume(); if (!this.ctx || !this._sfxGate('morale_break', 700)) return;
    this._duckBGM();
    const BUS = 'battle';
    // 号角慌乱：两个不协和号角快速交替下滑（小二度 220 / 207.65）
    this.horn(220.0, 0.4, 0.22, 0, 160, -0.2);
    this.horn(207.65, 0.4, 0.20, 0.18, 145, 0.2);
    // 士兵逃跑嘈杂：宽频带通噪声起伏（左右声像散开，模拟溃兵四散）
    this._noiseBurst({ dur: 1.0, freq: 700, q: 0.6, type: 'bandpass', vol: 0.16,
      offset: 0.3, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 1.0, freq: 900, q: 0.6, type: 'bandpass', vol: 0.16,
      offset: 0.35, bus: BUS, pan: 0.4 });
    // 旗帜倒地：布料闷响（低通噪声）+ 木棍啪嗒
    this._noiseBurst({ dur: 0.35, freq: 300, q: 0.8, type: 'lowpass', vol: 0.18,
      offset: 0.5, bus: BUS, sweepTo: 120 });
    this.tone(300, 0.15, 'square', 0.12, 0.55, 120, BUS);
    // 崩溃尾音：低频下沉
    this.drum(0.4, 0.6, 55, BUS);
  }

  // 2) 弓兵齐射：弓弦声 + 多支箭破空声
  playBowVolley() {
    this.resume(); if (!this.ctx || !this._sfxGate('bow_volley', 350)) return;
    this._duckBGM();
    const BUS = 'battle';
    // 弓弦声：短促高频弹拨（2kHz 方波 + 2.6kHz 正弦泛音）
    this.tone(2000, 0.06, 'square', 0.16, 0, null, BUS);
    this.tone(2600, 0.05, 'sine', 0.10, 0.01, null, BUS);
    // 多支箭破空：5 支 playArrowShoot 错峰（0.045s 间隔）
    for (let i = 0; i < 5; i++) this.playArrowShoot(0.08 + i * 0.045);
    // 叠加破空呼啸（带通噪声扫频）
    this._noiseBurst({ dur: 0.45, freq: 3500, q: 2, type: 'bandpass', vol: 0.12,
      offset: 0.08, bus: BUS, sweepTo: 600 });
  }

  // 3) 盾墙竖起：盾牌竖起碰撞 + 金属共振
  playShieldRaise() {
    this.resume(); if (!this.ctx || !this._sfxGate('shield_raise', 250)) return;
    const BUS = 'battle';
    // 盾牌竖起碰撞：两声厚重低频撞击 + 中高频金属
    this.drum(0.5, 0, 80, BUS);
    this.drum(0.4, 0.09, 75, BUS);
    this.tone(1500, 0.10, 'sine', 0.16, 0, null, BUS);
    this.tone(2100, 0.07, 'square', 0.09, 0.02, null, BUS);
    // 金属共振尾音：1.2kHz 缓慢衰减 + 高八度泛音
    this.tone(1200, 0.35, 'triangle', 0.12, 0.05, 500, BUS);
    this.tone(1800, 0.25, 'sine', 0.06, 0.06, 800, BUS);
    // 盾牌墙排列噪声：宽频金属摩擦
    this._noiseBurst({ dur: 0.2, freq: 2200, q: 1.5, type: 'bandpass', vol: 0.10,
      offset: 0.04, bus: BUS });
  }

  // 4) 水战：战船碰撞 + 浪花 + 水战呐喊
  playNavalBattle() {
    this.resume(); if (!this.ctx || !this._sfxGate('naval_battle', 700)) return;
    this._duckBGM();
    const BUS = 'battle';
    // 战船碰撞：低频木船撞击（鼓 + 木板碎裂噪声）
    this.drum(0.6, 0, 70, BUS);
    this.drum(0.5, 0.25, 60, BUS);
    this._noiseBurst({ dur: 0.25, freq: 500, q: 1, type: 'lowpass', vol: 0.20,
      offset: 0, bus: BUS, sweepTo: 200 });
    // 浪花：低通噪声起伏（浪拍船舷，两段）
    this._noiseBurst({ dur: 1.2, freq: 900, q: 0.7, type: 'lowpass', vol: 0.14,
      offset: 0.2, bus: BUS, sweepTo: 300 });
    this._noiseBurst({ dur: 1.0, freq: 1100, q: 0.7, type: 'lowpass', vol: 0.10,
      offset: 0.6, bus: BUS });
    // 水战呐喊：多音失谐锯齿波叠加
    [180, 220, 260, 300].forEach((f, i) =>
      this.tone(f, 0.6, 'sawtooth', 0.09, 0.4 + i * 0.05, f * 1.2, BUS, (i - 1.5) * 0.18));
    // 水战号角
    this.horn(196.0, 0.7, 0.20, 0.7, null, 0);
  }

  // 5) 天气战斗音效：雨天雨声加大 / 雪地脚步咯吱 / 雾天紧张低频
  // type: 'rain' | 'snow' | 'fog'
  playWeatherCombat(type = 'rain') {
    this.resume(); if (!this.ctx) return;
    const BUS = 'battle';
    if (type === 'rain') {
      // 雨声加大：低通白噪声变密、叠加一层
      this._noiseBurst({ dur: 0.8, freq: 2500, q: 0.6, type: 'lowpass', vol: 0.16, bus: BUS });
      this._noiseBurst({ dur: 0.6, freq: 1800, q: 0.6, type: 'lowpass', vol: 0.12, offset: 0.2, bus: BUS });
    } else if (type === 'snow') {
      // 雪地脚步咯吱：高频细噪声短促断续 ×3
      for (let i = 0; i < 3; i++) {
        this._noiseBurst({ dur: 0.12, freq: 3200, q: 2.5, type: 'highpass', vol: 0.10,
          offset: i * 0.15, bus: BUS, sweepTo: 1800 });
      }
    } else if (type === 'fog') {
      // 雾天紧张低频：持续低沉嗡鸣 + 不协和小二度
      this.tone(70, 1.2, 'sine', 0.16, 0, null, BUS);
      this.tone(74, 1.2, 'sawtooth', 0.08, 0.1, null, BUS);
    }
  }

  // 6) 连胜号角：连胜 n 场以上的特殊号角（n≥5 叠加欢庆琶音）
  playWinStreakHorn(n = 3) {
    this.resume(); if (!this.ctx || !this._sfxGate('win_streak_horn', 800)) return;
    const BUS = 'battle';
    // 三连号角 G3→D4→G4，庄严上行
    this.horn(196.0, 0.5, 0.24, 0, null, 0);
    this.horn(293.66, 0.5, 0.24, 0.2, null, 0);
    this.horn(392.0, 0.8, 0.26, 0.4, null, 0);
    // 鼓点
    this.drum(0.4, 0, 80, BUS);
    this.drum(0.4, 0.2, 80, BUS);
    this.drum(0.45, 0.4, 75, BUS);
    // 连胜≥5 额外叠加欢庆琶音（C5→E6）
    if (n >= 5) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this.tone(f, 0.3, 'triangle', 0.14, 0.7 + i * 0.1, null, BUS));
    }
  }

  // ============================================================
  // V18.0「音效扩充」新增战场/内政音效（全部 Web Audio 程序化合成）
  //   攻城四连（云梯/攻城槌/城墙碎裂/士兵攀爬）+ 伏兵 + 援军 + 溃逃 +
  //   城市建设完成 + 情报获得。战场类走 battleGain 总线，内政/情报走 domesticGain。
  // 技术参考：木质摩擦=带通噪声扫频；槌撞=低频鼓+低通噪声；砖石碎裂=高通短噪声串；
  //   脚步=低频脉冲；号角渐强=gain ADSR 长起音；欢呼=宽频带通噪声群。
  // ============================================================

  // 1a) 攻城音效·云梯架起：木质摩擦（带通噪声缓慢扫频下行）+ 绳索绷紧吱吱声
  playSiegeLadder() {
    this.resume(); if (!this.ctx || !this._sfxGate('siege_ladder', 600)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 云梯拖至城下并斜靠的木质摩擦：中低频带通噪声，频率 800→300 缓降
    this._noiseBurst({ dur: 0.7, freq: 800, q: 2, type: 'bandpass', vol: 0.16,
      offset: 0, bus: BUS, sweepTo: 300, pan: -0.2 });
    // 绳索/梯腿绷紧的吱吱声：中高频短促吱扭（方波下滑）
    this.tone(600, 0.3, 'sawtooth', 0.10, 0.35, 350, BUS, -0.2);
    this.tone(640, 0.25, 'sawtooth', 0.08, 0.5, 380, BUS, 0.1);
    // 梯脚落定闷响
    this.drum(0.3, 0.65, 90, BUS);
  }

  // 1b) 攻城音效·攻城槌撞击：低频巨鼓三连（渐强）+ 厚木震动（低通噪声）
  playSiegeRam() {
    this.resume(); if (!this.ctx || !this._sfxGate('siege_ram', 500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 攻城槌撞门：三声低频闷鼓，第二/三声更重（槌车加速冲势）
    this.drum(0.55, 0, 70, BUS);
    this.drum(0.65, 0.25, 65, BUS);
    this.drum(0.75, 0.5, 60, BUS);
    // 厚木震动：低通噪声随撞击衰减
    this._noiseBurst({ dur: 0.4, freq: 500, q: 1, type: 'lowpass', vol: 0.18,
      offset: 0, bus: BUS, sweepTo: 150 });
    this._noiseBurst({ dur: 0.45, freq: 450, q: 1, type: 'lowpass', vol: 0.20,
      offset: 0.25, bus: BUS, sweepTo: 130 });
    // 撞门后金属门闩震颤
    this.tone(180, 0.3, 'square', 0.10, 0.05, 90, BUS);
  }

  // 1c) 攻城音效·城墙碎裂：砖石崩塌（高通短噪声串 + 低频轰鸣 + 尘土低通噪声）
  playWallCrumble() {
    this.resume(); if (!this.ctx || !this._sfxGate('wall_crumble', 800)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 崩塌低频轰鸣
    this.drum(0.7, 0, 60, BUS);
    this.tone(55, 0.6, 'sine', 0.30, 0, 28, BUS);
    // 砖石滚落：一串高通短噪声（碎石飞溅）
    for (let i = 0; i < 7; i++) {
      this._noiseBurst({ dur: 0.06, freq: 2800 + i * 200, q: 2, type: 'highpass',
        vol: 0.12, offset: 0.15 + i * 0.07, bus: BUS,
        sweepTo: 1200, pan: (i % 2 ? 0.4 : -0.4) });
    }
    // 尘土扬起：低通噪声缓落
    this._noiseBurst({ dur: 0.9, freq: 700, q: 0.8, type: 'lowpass', vol: 0.14,
      offset: 0.3, bus: BUS, sweepTo: 200 });
  }

  // 1d) 攻城音效·士兵攀爬：急促脚步（低频脉冲）+ 云梯吱呀 + 攀爬呐喊
  playSoldierClimb() {
    this.resume(); if (!this.ctx || !this._sfxGate('soldier_climb', 500)) return;
    this._duckBGM();
    const BUS = 'battle';
    // 攀爬急促脚步：6 次低频脉冲渐快
    for (let i = 0; i < 6; i++) {
      this.drum(0.22, i * 0.12, 110, BUS);
      this._noiseBurst({ dur: 0.05, freq: 1200, q: 1.5, type: 'bandpass', vol: 0.07,
        offset: i * 0.12, bus: BUS, pan: (i % 2 ? 0.3 : -0.3) });
    }
    // 云梯受力吱呀
    this.tone(480, 0.4, 'sawtooth', 0.08, 0.2, 300, BUS);
    // 攀爬呐喊：多音失谐锯齿
    [200, 240, 280, 320].forEach((f, i) =>
      this.tone(f, 0.35, 'sawtooth', 0.07, 0.3 + i * 0.04, f * 1.15, BUS, (i - 1.5) * 0.15));
  }

  // 2) 伏兵音效：突然战鼓（重击）+ 呐喊（群噪骤起）+ 金属碰撞（兵刃出鞘）
  playAmbush() {
    this.resume(); if (!this.ctx || !this._sfxGate('ambush', 800)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 骤起战鼓：一声极重低频鼓（伏兵信号）
    this.drum(0.8, 0, 60, BUS);
    this.drum(0.6, 0.12, 70, BUS);
    // 伏兵呐喊：宽频带通噪声群骤然爆发（左右声像散开）
    this._noiseBurst({ dur: 0.6, freq: 500, q: 0.7, type: 'bandpass', vol: 0.20,
      offset: 0.1, bus: BUS, pan: -0.5 });
    this._noiseBurst({ dur: 0.6, freq: 600, q: 0.7, type: 'bandpass', vol: 0.20,
      offset: 0.15, bus: BUS, pan: 0.5 });
    // 金属碰撞：兵刃出鞘/盾牌交击（高频噪声 + 金属泛音）
    this._noiseBurst({ dur: 0.15, freq: 3200, q: 1.5, type: 'highpass', vol: 0.16,
      offset: 0.1, bus: BUS });
    this.tone(2200, 0.1, 'square', 0.12, 0.1, null, BUS);
    this.tone(1500, 0.12, 'sine', 0.10, 0.12, null, BUS);
    // 追击号角急促两短
    this.horn(220.0, 0.25, 0.18, 0.4, null, 0);
    this.horn(220.0, 0.25, 0.18, 0.65, null, 0);
  }

  // 3) 援军到达：远方号角渐强（长起音）+ 马蹄声 + 人声欢呼
  playReinforcements() {
    this.resume(); if (!this.ctx || !this._sfxGate('reinforcements', 1000)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 远方号角：两记长号角，起音缓慢渐强（由远及近）
    this.horn(196.0, 1.2, 0.16, 0, null, -0.3);
    this.horn(293.66, 1.2, 0.18, 0.3, null, 0.3);
    // 马蹄声：低频脉冲序列渐快渐密（骑兵逼近）
    for (let i = 0; i < 8; i++) {
      const t = 0.5 + i * 0.11;
      this.drum(0.18 + i * 0.02, t, 90, BUS);
      this._noiseBurst({ dur: 0.05, freq: 500, q: 1.5, type: 'bandpass', vol: 0.06,
        offset: t, bus: BUS });
    }
    // 人声欢呼：宽频噪声浪潮由弱渐强
    this._noiseBurst({ dur: 1.0, freq: 700, q: 0.7, type: 'bandpass', vol: 0.10,
      offset: 0.6, bus: BUS, sweepTo: 1000, pan: -0.4 });
    this._noiseBurst({ dur: 1.0, freq: 900, q: 0.7, type: 'bandpass', vol: 0.10,
      offset: 0.65, bus: BUS, sweepTo: 1200, pan: 0.4 });
    // 定音鼓收尾
    this.drum(0.45, 1.2, 75, BUS);
  }

  // 4) 军队溃逃：混乱号角（下滑不协和）+ 士兵奔跑声 + 丢弃武器声（金属落地）
  playRout() {
    this.resume(); if (!this.ctx || !this._sfxGate('rout', 800)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'battle';
    // 混乱号角：两个不协和号角急促下滑（惊慌失措）
    this.horn(233.08, 0.4, 0.22, 0, 160, -0.2);
    this.horn(207.65, 0.4, 0.20, 0.2, 140, 0.2);
    // 士兵奔跑杂乱脚步：宽频带通噪声起伏（左右散开）
    this._noiseBurst({ dur: 0.9, freq: 600, q: 0.6, type: 'bandpass', vol: 0.16,
      offset: 0.25, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 0.9, freq: 800, q: 0.6, type: 'bandpass', vol: 0.16,
      offset: 0.3, bus: BUS, pan: 0.4 });
    // 丢弃武器落地：3 声短促金属磕碰（高频方波+噪声）
    for (let i = 0; i < 3; i++) {
      this.tone(1800, 0.08, 'square', 0.12, 0.4 + i * 0.15, 600, BUS);
      this._noiseBurst({ dur: 0.06, freq: 2500, q: 2, type: 'highpass', vol: 0.08,
        offset: 0.4 + i * 0.15, bus: BUS });
    }
    // 崩溃尾音：低频下沉
    this.drum(0.4, 0.6, 50, BUS);
  }

  // 5) 城市建设完成：钟声（编钟）+ 百姓欢呼（宽频噪声群）
  playCityBuilt() {
    this.resume(); if (!this.ctx || !this._sfxGate('city_built', 800)) return;
    const BUS = 'domestic';
    // 建造完成钟声：两响编钟（C4 + G4），庄严喜庆
    this.bell(261.63, 1.8, 0.22, 0, 0);
    this.bell(392.00, 1.6, 0.16, 0.25, 0);
    // 百姓欢呼：宽频带通噪声群（左右散开，模拟全城庆贺）
    this._noiseBurst({ dur: 0.9, freq: 800, q: 0.7, type: 'bandpass', vol: 0.14,
      offset: 0.4, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 0.9, freq: 1000, q: 0.7, type: 'bandpass', vol: 0.14,
      offset: 0.45, bus: BUS, pan: 0.4 });
    this._noiseBurst({ dur: 0.7, freq: 1200, q: 0.8, type: 'bandpass', vol: 0.10,
      offset: 0.5, bus: BUS, pan: 0 });
    // 喜庆鼓点
    this.drum(0.4, 0.4, 80, BUS);
    this.drum(0.35, 0.7, 75, BUS);
  }

  // 6) 情报获得：翻纸声（带通噪声抖动）+ 墨迹声（水滴式高频滴音）
  //    与 playSpyIntel（谍报潜行专用）区分：本方法为通用「获得情报/文书」反馈。
  playIntelGained() {
    this.resume(); if (!this.ctx || !this._sfxGate('intel_gained', 500)) return;
    const BUS = 'sfx';
    // 翻纸：带通噪声快速抖动两次（展开密报/卷轴）
    this._noiseBurst({ dur: 0.16, freq: 2400, q: 1.5, type: 'bandpass', vol: 0.14,
      offset: 0, bus: BUS });
    this._noiseBurst({ dur: 0.12, freq: 2800, q: 1.5, type: 'bandpass', vol: 0.10,
      offset: 0.16, bus: BUS });
    // 墨迹滴落：两声高频滑音滴（笔落砚池/朱砂落纸）
    this.tone(1600, 0.18, 'sine', 0.12, 0.3, 1100, BUS);
    this.tone(1800, 0.15, 'sine', 0.10, 0.48, 1250, BUS);
  }

  // ============================================================
  // V15.0 天气氛围音（滤波白噪声循环，走 ambientGain 总线）
  //   rain：低通 2kHz 柔和雨白噪声；
  //   snow：高频轻柔嘶声（带通 6kHz，低音量）；
  //   wind：带通 800Hz + LFO 缓慢扫频（风的起伏）；
  //   sandstorm：低通 300Hz + LFO 低频呼啸（沙暴压迫感）。
  // ============================================================
  startWeatherAmbient(name) {
    this.resume(); if (!this.ctx) return;
    if (this._weatherName === name && this._weatherNodes.length) return;
    this.stopWeatherAmbient();
    this._weatherName = name;
    if (name === 'rain') {
      const h = this._startNoiseLoop({ freq: 2000, q: 0.7, type: 'lowpass', vol: 0.12, loop: true, bus: 'ambient' });
      this._weatherNodes.push(h);
    } else if (name === 'snow') {
      const h = this._startNoiseLoop({ freq: 6000, q: 1.2, type: 'bandpass', vol: 0.05, loop: true, bus: 'ambient' });
      this._weatherNodes.push(h);
    } else if (name === 'wind') {
      // 带通噪声 + LFO 调制中心频率，模拟风的呼啸起伏
      const h = this._startNoiseLoop({ freq: 800, q: 1.5, type: 'bandpass', vol: 0.12, loop: true, bus: 'ambient' });
      if (h) {
        const lfo = this.ctx.createOscillator();
        const lfoG = this.ctx.createGain();
        lfo.frequency.value = 0.25;
        lfoG.gain.value = 350;            // 中心频率在 450~1150Hz 间起伏
        lfo.connect(lfoG); lfoG.connect(h.filter.frequency);
        lfo.start();
        this._weatherNodes.push({ src: lfo, gain: lfoG });
      }
      this._weatherNodes.push(h);
    } else if (name === 'sandstorm') {
      const h = this._startNoiseLoop({ freq: 300, q: 1.0, type: 'lowpass', vol: 0.18, loop: true, bus: 'ambient' });
      if (h) {
        const lfo = this.ctx.createOscillator();
        const lfoG = this.ctx.createGain();
        lfo.frequency.value = 0.18;
        lfoG.gain.value = 120;
        lfo.connect(lfoG); lfoG.connect(h.filter.frequency);
        lfo.start();
        this._weatherNodes.push({ src: lfo, gain: lfoG });
      }
      this._weatherNodes.push(h);
    } else {
      this._weatherName = null;
    }
  }

  stopWeatherAmbient() {
    this._weatherNodes.forEach(h => this._stopNodes(h));
    this._weatherNodes = [];
    this._weatherName = null;
  }

  // 便捷方法
  playWeatherRain()    { this.startWeatherAmbient('rain'); }
  playWeatherSnow()    { this.startWeatherAmbient('snow'); }
  playWeatherWind()    { this.startWeatherAmbient('wind'); }
  playWeatherSandstorm(){ this.startWeatherAmbient('sandstorm'); }

  // ============================================================
  // V20.0「音效扩充」新增灾害/救灾音效（全部 Web Audio 程序化合成）
  //   地震/洪水/干旱/瘟疫/蝗灾/暴风雪六种灾害事件触发音 + 救灾成功庆典音。
  //   技术参考：低频轰鸣=次正弦波长音+指数下滑；建筑倒塌/碎石=低/高通噪声串；
  //   水流/浪涛=低通噪声扫频；人呻吟/咳嗽=失谐锯齿波短音；乌鸦=方波下滑短促；
  //   翅膀/蚕食=高频噪声脉冲串；狂风呼啸=带通噪声+LFO 扫频；冰粒=高通短点击。
  //   灾害音效走 sfx 总线（与战斗音效同级，可独立 ducking BGM），统一带冷却闸门。
  // ============================================================

  // 1) 地震：低频轰鸣 + 建筑倒塌 + 碎石飞溅
  playEarthquake() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_earthquake', 2500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'sfx';
    // 低频地鸣：35Hz 正弦长音缓慢下沉，持续 2.5s
    this.tone(38, 2.5, 'sine', 0.30, 0, 20, BUS);
    this.tone(55, 2.0, 'sawtooth', 0.10, 0.05, 30, BUS);
    // 主震鼓点：两声渐强低频鼓
    this.drum(0.7, 0, 55, BUS);
    this.drum(0.8, 0.35, 50, BUS);
    // 建筑倒塌：低通厚噪声随震波起伏（两段）
    this._noiseBurst({ dur: 1.0, freq: 500, q: 1, type: 'lowpass', vol: 0.22,
      offset: 0.1, bus: BUS, sweepTo: 150 });
    this._noiseBurst({ dur: 1.2, freq: 400, q: 1, type: 'lowpass', vol: 0.20,
      offset: 0.5, bus: BUS, sweepTo: 120 });
    // 碎石滚落：一串高通短噪声（砖石飞溅，左右声像散开）
    for (let i = 0; i < 8; i++) {
      this._noiseBurst({ dur: 0.05, freq: 2600 + i * 150, q: 2, type: 'highpass',
        vol: 0.10, offset: 0.25 + i * 0.09, bus: BUS,
        sweepTo: 1100, pan: (i % 2 ? 0.4 : -0.4) });
    }
  }

  // 2) 洪水：水流涌动 + 浪涛拍岸 + 呼救声
  playFlood() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_flood', 2500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'sfx';
    // 水流涌动：低通噪声渐起（洪峰逼近），3s 起伏
    this._noiseBurst({ dur: 1.8, freq: 800, q: 0.6, type: 'lowpass', vol: 0.18,
      offset: 0, bus: BUS, sweepTo: 300 });
    // 浪涛拍岸：三段低通噪声涌退
    for (let i = 0; i < 3; i++) {
      this._noiseBurst({ dur: 0.7, freq: 1000, q: 0.7, type: 'lowpass', vol: 0.16,
        offset: 0.4 + i * 0.6, bus: BUS, sweepTo: 250, pan: (i - 1) * 0.3 });
    }
    // 呼救：失谐下滑锯齿波短呼（左右声像，模拟水中挣扎）
    [220, 180, 260].forEach((f, i) =>
      this.tone(f, 0.4, 'sawtooth', 0.10, 0.6 + i * 0.5, f * 0.6, BUS, (i - 1) * 0.3));
    // 水面漩涡低频嗡
    this.tone(48, 1.6, 'sine', 0.18, 0.2, 30, BUS);
  }

  // 3) 干旱：干燥风声 + 枯叶碎裂
  playDrought() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_drought', 2500)) return;
    this._duckBGM();
    const BUS = 'sfx';
    // 干燥热风：带通中高频噪声（干涩、少低频），缓慢起伏
    this._noiseBurst({ dur: 2.0, freq: 1800, q: 1.5, type: 'bandpass', vol: 0.14,
      offset: 0, bus: BUS, sweepTo: 900 });
    // 极低频干燥喘息嗡鸣（土地龟裂的压抑感）
    this.tone(70, 2.0, 'sawtooth', 0.06, 0, null, BUS);
    // 枯叶碎裂：一串高通短促咔啦声（脆、干、散）
    for (let i = 0; i < 6; i++) {
      this._noiseBurst({ dur: 0.04, freq: 3800, q: 2.5, type: 'highpass',
        vol: 0.10, offset: 0.2 + i * 0.28, bus: BUS,
        sweepTo: 2200, pan: (i % 2 ? 0.3 : -0.3) });
    }
  }

  // 4) 瘟疫：低沉呻吟 + 咳嗽 + 乌鸦啼
  playPlague() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_plague', 2500)) return;
    this._duckBGM();
    const BUS = 'sfx';
    // 低沉呻吟：两个失谐低频长音（病患喘息）
    this.tone(90, 1.6, 'sawtooth', 0.10, 0, null, BUS, -0.2);
    this.tone(85, 1.6, 'sine', 0.12, 0.2, null, BUS, 0.2);
    // 咳嗽：带通短促三连（喉间痰咳）
    for (let i = 0; i < 3; i++) {
      this._noiseBurst({ dur: 0.12, freq: 600, q: 2, type: 'bandpass', vol: 0.12,
        offset: 0.4 + i * 0.45, bus: BUS, sweepTo: 350 });
    }
    // 乌鸦啼：方波短促下滑（两声，由远及近）
    this.tone(620, 0.18, 'square', 0.12, 0.5, 380, BUS, -0.3);
    this.tone(580, 0.20, 'square', 0.12, 1.1, 350, BUS, 0.3);
    this.tone(600, 0.16, 'square', 0.10, 1.6, 400, BUS, 0);
  }

  // 5) 蝗灾：密集翅膀声 + 蚕食禾苗
  playLocust() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_locust', 2500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'sfx';
    // 密集翅膀声：高频噪声脉冲串（蝗群振翅，短促密集如雨）
    for (let i = 0; i < 10; i++) {
      this._noiseBurst({ dur: 0.03, freq: 4200, q: 3, type: 'highpass',
        vol: 0.08, offset: i * 0.12, bus: BUS, pan: (i % 2 ? 0.3 : -0.3) });
    }
    // 蚕食禾苗：带通沙沙声（叶片被啃噬），两段
    this._noiseBurst({ dur: 1.0, freq: 2400, q: 2, type: 'bandpass', vol: 0.12,
      offset: 0.2, bus: BUS, sweepTo: 1400 });
    this._noiseBurst({ dur: 0.9, freq: 2600, q: 2, type: 'bandpass', vol: 0.10,
      offset: 0.8, bus: BUS, sweepTo: 1500 });
  }

  // 6) 暴风雪：狂风呼啸 + 冰粒击打
  playBlizzard() {
    this.resume(); if (!this.ctx || !this._sfxGate('disaster_blizzard', 2500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'sfx';
    // 狂风呼啸：带通噪声 + LFO 扫频（风声由低到高卷过）
    this._noiseBurst({ dur: 2.2, freq: 600, q: 1.2, type: 'bandpass', vol: 0.20,
      offset: 0, bus: BUS, sweepTo: 2200 });
    this._noiseBurst({ dur: 1.8, freq: 1500, q: 1.0, type: 'bandpass', vol: 0.14,
      offset: 0.3, bus: BUS, sweepTo: 400, pan: -0.3 });
    // 冰粒击打：高通短促噼啪（冰粒抽打车窗/盔甲）
    for (let i = 0; i < 8; i++) {
      this._noiseBurst({ dur: 0.03, freq: 5000, q: 2, type: 'highpass',
        vol: 0.07, offset: 0.2 + i * 0.18, bus: BUS, pan: (i % 2 ? 0.4 : -0.4) });
    }
    // 严寒低频
    this.tone(50, 2.0, 'sine', 0.12, 0, 35, BUS);
  }

  // 7) 救灾成功：欢快民乐上行 + 编钟庆祝
  playReliefSuccess() {
    this.resume(); if (!this.ctx || !this._sfxGate('relief_success', 1500)) return;
    this._duckBGM(); this._sfxDuck();
    const BUS = 'achievement';
    // 欢快民乐上行琶音（C5 E5 G5 C6，三角波）
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.32, 'triangle', 0.26, i * 0.12, null, BUS));
    // 编钟两声（C4 + G4，庄严喜庆）
    this.bell(523.25, 1.6, 0.20, 0.5, 0);
    this.bell(783.99, 1.4, 0.14, 0.75, 0);
    // 欢庆鼓点
    this.drum(0.4, 0.5, 80, BUS);
    this.drum(0.35, 0.75, 75, BUS);
  }

  // 便捷：按灾害类型名一键播放对应音效
  // type: 'earthquake'|'flood'|'drought'|'plague'|'locust'|'blizzard'
  playDisaster(type) {
    switch (type) {
      case 'earthquake': this.playEarthquake(); break;
      case 'flood':     this.playFlood(); break;
      case 'drought':    this.playDrought(); break;
      case 'plague':    this.playPlague(); break;
      case 'locust':     this.playLocust(); break;
      case 'blizzard':   this.playBlizzard(); break;
      default: break;
    }
  }

  // ============================================================
  // V21.0「音效扩充」新增 6 类程序化合成音效
  // 全部 Web Audio 合成：驼铃/马蹄/风声 / 金币/香料 / 战斗/货物散落 /
  //   喜庆民乐/花灯/同心结 / 婴儿笑/祥云钟 / 哀乐/白幡/落叶。
  // 均经 _sfxGate 重叠保护，峰值音量收敛至 0.1~0.3。
  // ============================================================

  // 1. 商队行进：驼铃声（高频短促交替声像）+ 马蹄声（低频脉冲）+ 风声（低通噪声缓慢扫）
  playCaravanMarch() {
    this.resume(); if (!this.ctx || !this._sfxGate('caravan_march', 600)) return;
    // 驼铃：周期性高频短促音，左右声像交替（模拟驼队左右摇晃）
    for (let i = 0; i < 5; i++) {
      this.tone(1244.51, 0.12, 'sine', 0.12, i * 0.22, null, 'sfx', (i % 2 ? 0.5 : -0.5));
    }
    // 马蹄：低频闷响脉冲，间隔渐密（队伍渐行渐近）
    for (let i = 0; i < 6; i++) {
      this.drum(0.22, i * 0.22, 70 - i * 2, 'sfx');
    }
    // 风声：低通噪声缓慢起伏（风沙扑面）
    this._noiseBurst({ dur: 1.4, freq: 400, q: 0.8, type: 'lowpass', vol: 0.10,
      offset: 0, bus: 'sfx', sweepTo: 180 });
  }

  // 2. 丝路贸易完成：金币叮当（高频短促弹跳）+ 香料香囊声（中频柔和泛音铃）
  playSilkTradeDone() {
    this.resume(); if (!this.ctx || !this._sfxGate('silk_trade_done', 300)) return;
    // 金币叮当：高频短促双音弹跳，左右声像交替
    for (let i = 0; i < 5; i++) {
      this.tone(1567.98 + i * 90, 0.09, 'sine', 0.14, i * 0.08, null, 'sfx', (i % 2 ? 0.35 : -0.35));
    }
    // 香料香囊：中频柔和泛音（模拟香囊轻晃的温润铃音）
    this.tone(880, 0.6, 'triangle', 0.10, 0.4, null, 'sfx', 0);
    this.tone(1174.66, 0.5, 'sine', 0.07, 0.5, null, 'sfx', 0);
    this.tone(1760, 0.3, 'sine', 0.06, 0.55, null, 'sfx', 0);
  }

  // 3. 商队被劫：战斗声（兵刃/呐喊）+ 货物散落（噪声散落 + 低频滚动）
  playCaravanRobbed() {
    this.resume(); if (!this.ctx || !this._sfxGate('caravan_robbed', 500)) return;
    this._duckBGM();
    // 兵刃相交
    this.playSwordClash();
    // 货物散落：高频噪声噼啪散落（带通噪声短扫）
    this._noiseBurst({ dur: 0.35, freq: 2400, q: 1.5, type: 'bandpass', vol: 0.18,
      offset: 0.05, bus: 'sfx', sweepTo: 500 });
    // 货物滚动：低频闷响渐弱
    this.tone(120, 0.6, 'sawtooth', 0.12, 0.15, 50, 'sfx', 0);
    this.drum(0.25, 0.2, 60, 'sfx');
  }

  // 4. 联姻成功：喜庆民乐（上行五声琶音）+ 花灯声（高频铃铛泛音）+ 同心结声（柔和双音）
  playMarriageSuccess() {
    this.resume(); if (!this.ctx || !this._sfxGate('marriage_success', 600)) return;
    // 喜庆民乐：上行五声琶音（扬琴式）
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    notes.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, i * 0.1, null, 'sfx'));
    // 花灯声：高频铃铛泛音（左右摇摆）
    for (let i = 0; i < 3; i++) {
      this.tone(1567.98, 0.5, 'sine', 0.08, notes.length * 0.1 + i * 0.25, null, 'sfx', (i - 1) * 0.3);
    }
    // 同心结声：柔和双音（C+E 三度叠置，温润）
    this.tone(523.25, 0.8, 'sine', 0.10, notes.length * 0.1, null, 'sfx', 0);
    this.tone(659.25, 0.8, 'sine', 0.08, notes.length * 0.1, null, 'sfx', 0);
  }

  // 5. 家族成员出生：婴儿笑声（高频断续笑音）+ 祥云钟声（编钟吉庆）
  playFamilyBorn() {
    this.resume(); if (!this.ctx || !this._sfxGate('family_born', 500)) return;
    // 婴儿笑声：高频短促断续（模拟「咯咯」笑），左右声像微摆
    for (let i = 0; i < 4; i++) {
      this.tone(1318.5, 0.08, 'sine', 0.10, i * 0.12, 900, 'sfx', (i % 2 ? 0.2 : -0.2));
    }
    // 祥云钟声：编钟吉庆（上行双钟）
    this.bell(783.99, 1.2, 0.16, 0.3, 0);
    this.bell(1046.50, 1.0, 0.12, 0.5, 0);
  }

  // 6. 家族成员去世：哀乐（下行慢音）+ 白幡声（低频嗡鸣）+ 落叶声（高通噪声细碎）
  playFamilyDeath() {
    this.resume(); if (!this.ctx || !this._sfxGate('family_death', 600)) return;
    // 哀乐：下行慢音（小三度下行，肃杀）
    this.tone(440, 0.9, 'sine', 0.14, 0, null, 'sfx', 0);
    this.tone(415.30, 0.9, 'sine', 0.12, 0.3, null, 'sfx', 0);
    this.tone(392.00, 1.2, 'sine', 0.12, 0.6, null, 'sfx', 0);
    // 白幡声：低频嗡鸣（白幡随风低哑飘动）
    this.tone(80, 1.5, 'sawtooth', 0.08, 0.2, 50, 'sfx', 0);
    // 落叶声：高通噪声细碎（秋风落叶沙沙）
    this._noiseBurst({ dur: 0.8, freq: 4000, q: 1, type: 'highpass', vol: 0.06,
      offset: 0.4, bus: 'sfx', sweepTo: 2000 });
  }

  // ============================================================
  // V23.0「音效扩充」新增 军事训练/军团整编/装备锻造 深化音效
  // （全部 Web Audio 程序化合成；总线走 sfxGain，与既有军事/内政音效风格一致）
  // 技术参考：MDN Web Audio——
  //   脚步/鼓点=drum 低频敲击；金属碰撞/火花/蒸汽/布帛=_noiseBurst 滤波白噪声；
  //   号角=horn 锯齿长音；编钟=bell 基音+非谐泛音长尾；金光泛音=tone 高音琶音。
  // 注：训练「晋升」音效 playRankUp 已存在（V15.0 段位升级：号角三连+和弦上行+
  //   金光共鸣+军鼓），语义与本版「晋升」要求完全吻合，故复用不重复定义，避免
  //   历史上曾出现的重复方法定义/死代码问题。
  // ============================================================

  // ---- 训练音效 ----

  // 1a. 操练：整齐脚步 + 武器碰撞 + 口令呼喝
  //   整齐脚步——低频鼓点左右脚交替规律落拍；
  //   武器碰撞——中高频金属噪声短促连响（刀枪磕碰）；
  //   口令呼喝——中低频锯齿滑音序列（模拟教头"一-二-一"呼号）。
  playTrainingDrill() {
    this.resume(); if (!this.ctx || !this._sfxGate('training_drill', 700)) return;
    const BUS = 'sfx';
    // 整齐脚步：左右脚交替规律鼓点（"踏-踏、踏-踏"，8 步）
    for (let i = 0; i < 8; i++) {
      this.drum(0.28, i * 0.18, 88 - (i % 2) * 8, BUS);
      this._noiseBurst({ dur: 0.03, freq: 1500, q: 1.4, type: 'highpass', vol: 0.05,
        offset: i * 0.18, bus: BUS, pan: (i % 2 ? 0.35 : -0.35) });
    }
    // 武器碰撞：中高频金属噪声短促连响（刀枪入鞘/磕碰，间隔 ~120ms）
    for (let i = 0; i < 4; i++) {
      this._noiseBurst({ dur: 0.05, freq: 3200 + i * 300, q: 1.6, type: 'bandpass', vol: 0.09,
        offset: 0.3 + i * 0.12, bus: BUS, pan: (i % 2 ? 0.4 : -0.4) });
    }
    // 口令呼喝：中低频锯齿滑音（"一-二-一"，三声呼号）
    const chant = [196.0, 174.61, 196.0];
    chant.forEach((f, i) => this.tone(f, 0.18, 'sawtooth', 0.10, 0.2 + i * 0.28, f * 1.08, BUS));
  }

  // 1b. 授勋：编钟 + 礼炮 + 欢呼
  //   编钟列阵——编钟(C4/E4/G4/C5)定调庄重；
  //   礼炮——低频重击+宽频噪声轰鸣（鸣炮告捷）；
  //   欢呼——宽频带通噪声浪潮（三军山呼）。
  playMeritAward() {
    this.resume(); if (!this.ctx || !this._sfxGate('merit_award', 800)) return;
    const BUS = 'sfx';
    // 编钟列阵（授勋金声）
    this.bell(261.63, 1.8, 0.18, 0, 0);
    this.bell(329.63, 1.6, 0.15, 0.25, -0.15);
    this.bell(392.00, 1.8, 0.15, 0.5, 0.15);
    this.bell(523.25, 2.0, 0.14, 0.75, 0);
    // 礼炮：低频重击 + 宽频噪声轰鸣（两声炮响）
    for (let i = 0; i < 2; i++) {
      this.drum(0.55, 0.4 + i * 0.5, 60, BUS);
      this._noiseBurst({ dur: 0.5, freq: 200, q: 0.8, type: 'lowpass', vol: 0.18,
        offset: 0.4 + i * 0.5, bus: BUS, sweepTo: 60 });
    }
    // 三军欢呼：宽频噪声浪潮（左右声像散开）
    this._noiseBurst({ dur: 1.0, freq: 750, q: 0.7, type: 'bandpass', vol: 0.15, offset: 0.6, bus: BUS, pan: -0.4 });
    this._noiseBurst({ dur: 1.0, freq: 900, q: 0.7, type: 'bandpass', vol: 0.15, offset: 0.65, bus: BUS, pan: 0.4 });
  }

  // ---- 锻造音效 ----

  // 2a. 锻造锤击：铁锤敲打铁砧 + 火花噼啪
  //   锤击——金属重击（低频铁砧共鸣 + 高频金属泛音），连续四锤；
  //   火花噼啪——高频高通噪声短促连响（火星迸溅）。
  playForgeHammer() {
    this.resume(); if (!this.ctx || !this._sfxGate('forge_hammer', 150)) return;
    const BUS = 'sfx';
    // 四锤：铁锤敲打铁砧（低频铁砧共鸣 + 高频金属泛音，间隔 ~160ms）
    for (let i = 0; i < 4; i++) {
      const t = i * 0.16;
      this.drum(0.45, t, 110, BUS);                          // 铁砧低频"当"
      this.tone(1900 + i * 120, 0.12, 'triangle', 0.10, t, null, BUS); // 金属高频泛音
      // 火花噼啪：每锤 2~3 个火星迸溅
      for (let j = 0; j < 2; j++) {
        this._noiseBurst({ dur: 0.04, freq: 3800 + Math.random() * 1500, q: 1.5,
          type: 'highpass', vol: 0.07, offset: t + 0.02 + j * 0.05, bus: BUS,
          pan: (Math.random() - 0.5) * 0.8 });
      }
    }
  }

  // 2b. 淬火：冷水蒸汽嘶嘶 + 金属收缩
  //   蒸汽嘶嘶——高通噪声持续+高频扫频（铁件入水蒸腾）；
  //   金属收缩——低频短促金属泛音衰减（"滋"的收缩声）。
  playForgeQuench() {
    this.resume(); if (!this.ctx || !this._sfxGate('forge_quench', 600)) return;
    const BUS = 'sfx';
    // 冷水蒸汽嘶嘶：高通噪声持续 + 高频扫频（入水瞬间蒸腾扩散）
    this._noiseBurst({ dur: 1.2, freq: 5000, q: 1.0, type: 'highpass', vol: 0.16,
      offset: 0, bus: BUS, sweepTo: 2200 });
    // 水体气泡翻滚：中低频带通噪声（水面沸腾）
    this._noiseBurst({ dur: 1.0, freq: 600, q: 1.2, type: 'bandpass', vol: 0.10,
      offset: 0.1, bus: BUS, sweepTo: 300 });
    // 金属收缩：低频短促金属泛音（"滋——"的冷缩声，滑音下行）
    this.tone(880, 0.9, 'triangle', 0.12, 0.1, 220, BUS);
    this.tone(1760, 0.6, 'sine', 0.06, 0.15, 440, BUS);
  }

  // 2c. 锻造成功：金光泛音 + 编钟
  //   金光泛音——高音分解和弦上行琶音（成品淬炼成型的灵光）；
  //   编钟——编钟收尾（大功告成的金声玉振）。
  playForgeSuccess() {
    this.resume(); if (!this.ctx || !this._sfxGate('forge_success', 700)) return;
    const BUS = 'sfx';
    // 金光泛音：高音分解和弦上行琶音（C5-E5-G5-C6，淬炼成型）
    const arp = [523.25, 659.25, 783.99, 1046.5];
    arp.forEach((f, i) => {
      this.tone(f, 0.4, 'triangle', 0.16, i * 0.1, null, BUS);
      this.tone(f * 2, 0.3, 'sine', 0.07, i * 0.1, null, BUS); // 金光泛音
    });
    // 编钟收尾（金声玉振，大功告成）
    this.bell(523.25, 1.8, 0.16, arp.length * 0.1, 0);
    this.bell(783.99, 1.6, 0.12, arp.length * 0.1 + 0.2, 0.15);
  }

  // ---- 整编音效 ----

  // 3a. 整编：军旗展开 + 士兵集合脚步声
  //   军旗展开——中低频布帛噪声（"哗"的展旗声）；
  //   士兵集合脚步——规律鼓点由疏到密（列队归建）。
  playLegionMerge() {
    this.resume(); if (!this.ctx || !this._sfxGate('legion_merge', 700)) return;
    const BUS = 'sfx';
    // 军旗展开：布帛噪声（"哗——"展旗，中低频带通渐强）
    this._noiseBurst({ dur: 0.8, freq: 900, q: 0.9, type: 'bandpass', vol: 0.14,
      offset: 0, bus: BUS, sweepTo: 1800 });
    // 士兵集合脚步声：规律鼓点由疏到密（列队归建，间隔渐短）
    let t = 0.5;
    for (let i = 0; i < 10; i++) {
      this.drum(0.22, t, 86 - (i % 2) * 6, BUS);
      this._noiseBurst({ dur: 0.03, freq: 1400, q: 1.4, type: 'highpass', vol: 0.04,
        offset: t, bus: BUS, pan: (i % 2 ? 0.3 : -0.3) });
      t += 0.22 - i * 0.012; // 脚步渐密
    }
    // 整编定音：一记低沉军鼓（新旅成军）
    this.drum(0.4, t + 0.1, 70, BUS);
  }

  // 3b. 阅兵：号角齐鸣 + 军鼓隆隆
  //   号角齐鸣——多支号角叠加和声（G-C-G 军乐定调）；
  //   军鼓隆隆——低频鼓列连续滚动（铁甲生辉的阅兵声势）。
  playReviewStart() {
    this.resume(); if (!this.ctx || !this._sfxGate('review_start', 800)) return;
    const BUS = 'sfx';
    // 号角齐鸣：G3→C4→G4 军乐定调（多角叠吹，带轻微声像散开）
    this.horn(196.0, 0.9, 0.22, 0, null, -0.2);
    this.horn(261.63, 0.9, 0.20, 0.05, null, 0.2);
    this.horn(392.0, 1.1, 0.22, 0.1, null, 0);
    // 军鼓隆隆：低频鼓列连续滚动（阅兵行进步伐，8 拍）
    for (let i = 0; i < 8; i++) {
      this.drum(0.32, 0.2 + i * 0.16, 80 - (i % 2) * 6, BUS);
    }
    // 收尾定音：一记重鼓 + 号角长音
    this.drum(0.5, 0.2 + 8 * 0.16, 60, BUS);
    this.horn(392.0, 1.0, 0.18, 0.5 + 8 * 0.16, null, 0);
  }

  // ============================================================
  // V15.0 结局 BGM：宏大交响（finale 曲目按评级变奏）。
  //   S：高密庆典（density 0.9 / 明亮 G 音阶 / 定音鼓）；
  //   B：温润和平（density 0.6 / C 宫 / 无鼓）；
  //   D：悲怆低回（density 0.4 / A 羽小调感 / 慢板无鼓）。
  // 说明：直接改 BGM_TRACKS.finale 的运行时参数再 startBGM，无需新增曲目表项。
  // ============================================================
  startEndingBGM(rank = 'S') {
    const track = BGM_TRACKS.finale;
    if (!track) return;
    // 运行时改了 scale/bpm/density → 标记频率缓存脏，startBGM 会重建
    track._scaleDirty = true;
    if (rank === 'S') {
      track.bpm = 96; track.stepMs = 420; track.density = 0.9;
      track.wave = 'triangle'; track.bassWave = 'sine'; track.hasDrum = true;
      track.scale = ['G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'];
    } else if (rank === 'D') {
      track.bpm = 48; track.stepMs = 1000; track.density = 0.4;
      track.wave = 'sine'; track.bassWave = 'sine'; track.hasDrum = false;
      track.scale = ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4'];
    } else {
      track.bpm = 66; track.stepMs = 760; track.density = 0.6;
      track.wave = 'sine'; track.bassWave = 'sine'; track.hasDrum = false;
      track.scale = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
    }
    this.switchBGM('finale');
  }


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
      'tabSwitch', 'generalLevelUp', 'techResearchComplete', 'achievementUnlock',
      // V14.0 新增：单挑（6）/养成（4）/内政（5）/进阶（2）
      'duelStandoff', 'duelCharge', 'duelHeavyHit', 'duelParry', 'duelHit',
      'duelVictory', 'duelDefeat',
      'generalUpgrade', 'skillUnlock', 'equipWear', 'loyaltyChange',
      'cityDevelop', 'buildingUpgrade', 'taxCollect', 'corveeLevy', 'harvest',
      'unitAdvance', 'eliteStrike',
      // V15.0 新增：成就/段位/结局/外交/谍报/科举
      'achievementGain', 'rankUp', 'endingSfx',
      'diploAlliance', 'diploWar', 'diploMarriage', 'diploTrade',
      'spySneak', 'spyIntel', 'spyTurn', 'examBell',
      // V16.0 新增：战役/开场/过场/NG+/教程
      'campaignStart', 'campaignVictory', 'campaignDefeat', 'starRating',
      'introAmbience', 'timelineTransition', 'ngPlusUnlock', 'tutorialHint',
      // V17.0 新增：战场音效（走 battleGain 总线）
      'moraleBreak', 'bowVolley', 'shieldRaise', 'navalBattle',
      'weatherCombat', 'winStreakHorn',
      // V21.0 新增：丝路商队 / 家族皇室 6 类音效
      'caravanMarch', 'silkTradeDone', 'caravanRobbed',
      'marriageSuccess', 'familyBorn', 'familyDeath',
      // V23.0 新增：军事训练/整编/锻造深化音效（晋升 playRankUp 复用既有）
      'trainingDrill', 'meritAward',
      'forgeHammer', 'forgeQuench', 'forgeSuccess',
      'legionMerge', 'reviewStart'
    ];
  }

  // 返回所有 BGM 轨道名
  listBGM() {
    return Object.keys(BGM_TRACKS);
  }

  // 返回所有环境音名（V15.0：新增 snow/wind/sandstorm 天气音，走 startWeatherAmbient）
  listAmbient() {
    return ['city', 'battle', 'rain', 'palace', 'snow', 'wind', 'sandstorm'];
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
  // V14.0：单挑音效总线音量
  setDuelVolume(v) {
    this.duelVolume = Math.max(0, Math.min(1, v));
    if (this.duelGain && this.ctx) {
      this.duelGain.gain.setValueAtTime(this.duelVolume, this.ctx.currentTime);
    }
  }
  // V14.0：内政音效总线音量
  setDomesticVolume(v) {
    this.domesticVolume = Math.max(0, Math.min(1, v));
    if (this.domesticGain && this.ctx) {
      this.domesticGain.gain.setValueAtTime(this.domesticVolume, this.ctx.currentTime);
    }
  }
  // V15.0：成就庆典总线音量
  setAchievementVolume(v) {
    this.achievementVolume = Math.max(0, Math.min(1, v));
    if (this.achievementGain && this.ctx) {
      this.achievementGain.gain.setValueAtTime(this.achievementVolume, this.ctx.currentTime);
    }
  }
  // V15.0：结局结算总线音量
  setEndingVolume(v) {
    this.endingVolume = Math.max(0, Math.min(1, v));
    if (this.endingGain && this.ctx) {
      this.endingGain.gain.setValueAtTime(this.endingVolume, this.ctx.currentTime);
    }
  }
  // V16.0：战役音效总线音量
  setCampaignVolume(v) {
    this.campaignVolume = Math.max(0, Math.min(1, v));
    if (this.campaignGain && this.ctx) {
      this.campaignGain.gain.setValueAtTime(this.campaignVolume, this.ctx.currentTime);
    }
  }
  // V16.0：开场/过场旁白总线音量
  setIntroVolume(v) {
    this.introVolume = Math.max(0, Math.min(1, v));
    if (this.introGain && this.ctx) {
      this.introGain.gain.setValueAtTime(this.introVolume, this.ctx.currentTime);
    }
  }
  // V17.0：战斗音效总线音量（battleGain，独立控制战场音效）
  setBattleVolume(v) {
    this.battleVolume = Math.max(0, Math.min(1, v));
    if (this.battleGain && this.ctx) {
      this.battleGain.gain.setValueAtTime(this.battleVolume, this.ctx.currentTime);
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
    // BUG修复（audio.js V20.0 startBGM 定时器泄漏/叠音）：
    //   优化前：startBGM 末尾直接 `this._bgmTimer = setInterval(...)`，未先清理可能已存在的
    //   旧定时器。当前唯一入口 switchBGM 虽先 stopBGM()，但若外部直接调用 startBGM 重放/恢复
    //   （如菜单重入、页面 resume、未来新调用点），旧 _bgmTick 仍在跑 → 两套旋律叠加、
    //   节奏加倍，且旧定时器永不被 clearInterval 持有引用而泄漏。
    //   修复：建 interval 前先 clear 旧定时器，保证同一时刻只有一个 BGM 调度循环。
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
    // 性能优化（audio.js V22.0·多BGM切换资源管理加强）：
    //   基准：switchBGM 路径会先 stopBGM()（其内已清空 _bgmLiveNodes），
    //   但若外部直接调用 startBGM(scene)（如恢复播放/重入菜单/未来新调用点），
    //   只 clearInterval 旧 _bgmTimer，上一首曲目正在发声的旋律/低音 osc 仍留在
    //   _bgmLiveNodes 里自然收尾（0.65~0.85s），与新曲目第一拍短暂共存。
    //   优化：建 interval 前，若 _bgmLiveNodes 非空，立即 stop/disconnect/清空，
    //   确保新旧曲目节点零重叠、音频图资源立即释放。
    if (Array.isArray(this._bgmLiveNodes) && this._bgmLiveNodes.length) {
      for (const n of this._bgmLiveNodes) {
        try { n.osc && n.osc.stop(); } catch (e) {}
        try { n.osc && n.osc.disconnect(); } catch (e) {}
        try { n.gain && n.gain.disconnect(); } catch (e) {}
      }
      this._bgmLiveNodes = [];
    }
    this._bgmOn = true;
    this._bgmStep = 0;
    // 性能优化（audio.js #2 多BGM切换资源管理）：
    //   基准：_bgmTick 每拍（stepMs≈280~1000ms）都要对旋律音阶做
    //     `PENTATONIC[scale[rand]]` 属性链查找 + 低音 `PENTATONIC[scale[0]]/2`。
    //     单首 BGM 常驻数小时 → 每秒 1~4 次 × 数千拍，重复查表开销虽小但累积。
    //   优化：startBGM 时一次性把 track.scale 翻译成频率数组 track._freqScale，
    //     低音频率缓存为 track._bassFreq；_bgmTick 直接按下标取数，零属性链查找。
    //   多 BGM 切换时只重算当前曲目缓存，不影响其他曲目（配置不变即缓存命中）。
    if (!track._freqScale || track._scaleDirty) {
      track._freqScale = track.scale.map(n => PENTATONIC[n] || 440);
      track._bassFreq = (PENTATONIC[track.scale[0]] || 110) / 2;
      track._scaleDirty = false;
    }
    // 性能优化（audio.js #4）：多 BGM 切换时的资源管理——
    //   优化前：stopBGM 用 2s 线性淡出，紧接着 startBGM 又从 0 淡入到目标；
    //   若玩家快速连续切歌（如 UI 连点/场景自动切换），bgmGain 上会堆积多条
    //   linearRamp 调度，旧曲线未走完就被 cancelScheduledValues 打断，偶发音量跳变；
    //   且旧曲目 _bgmTick 已经入队的回调仍会再触发 1~2 拍，与新曲目叠音。
    //   优化后：淡入前先 cancelScheduledValues 并立即把 gain 钉在 0.0001，
    //   再线性淡入（2s）；切歌过渡由「长淡出+长淡入」改为「瞬切+长淡入」，
    //   旧曲目残留尾音控制在 ≤1 拍（0.3~0.85s 自然结束），无叠音爆音。
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
    // 性能优化（audio.js #4 多BGM切换资源管理）：切歌/停止时显式停掉上一首 BGM 正在发声的
    //   旋律/低音 osc。此时 bgmGain 正被立刻钉到 0.0001（见 startBGM 瞬切逻辑），旧节点已
    //   听不见，提前 stop+disconnect 不会产生可闻 click，却能立即释放音频图资源，避免 Rapid
    //   切歌场景下旧节点拖到自然收尾（0.65~0.85s）才释放。
    if (Array.isArray(this._bgmLiveNodes)) {
      for (const n of this._bgmLiveNodes) {
        try { n.osc && n.osc.stop(); } catch (e) {}
        try { n.osc && n.osc.disconnect(); } catch (e) {}
        try { n.gain && n.gain.disconnect(); } catch (e) {}
      }
      this._bgmLiveNodes = [];
    }
    // 性能优化（audio.js #4 续）：淡出时长由 2s 缩短为 0.8s——
    //   切歌场景下旧 BGM 无需冗长淡出；常驻停止（如静音退出）仍保留平滑衰减。
    if (this.bgmGain && this.ctx) {
      const t0 = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(t0);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t0);
      this.bgmGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.8);
    }
  }

  _bgmTick(track) {
    if (!this.ctx || this.muted || !this._bgmOn) return;
    const t0 = this.ctx.currentTime;
    // 性能优化（audio.js #4 多BGM切换资源管理）：先裁剪已自然收尾的活节点引用——
    //   旋律/低音 osc 会在 0.65/0.85s 后自停，但引用留在 _bgmLiveNodes 里会阻止 GC。
    //   每拍开头按 stopAt 时间戳丢弃已结束项，保证数组规模有界（≤ 最近 2 拍）。
    // 性能优化（audio.js #4 多BGM切换资源管理 · V21.0 续）：
    //   基准：原写法每拍开头 `this._bgmLiveNodes = this._bgmLiveNodes.filter(...)`——
    //     filter 每拍都新建一个数组，把「仍在发声」的节点拷过去。BGM 常驻数小时，
    //     stepMs=280~1000ms，每秒 1~3.5 拍 → 每分钟数十次临时数组分配，GC 压力累积。
    //   优化：改为从后往前倒序遍历，用 splice 原地删除已收尾项（倒序 splice 不影响未遍历下标），
    //     不再每拍分配新数组；MAX_LIVE 硬帽逻辑保持不变。
    if (this._bgmLiveNodes.length) {
      for (let i = this._bgmLiveNodes.length - 1; i >= 0; i--) {
        if (this._bgmLiveNodes[i].stopAt <= t0) this._bgmLiveNodes.splice(i, 1);
      }
      // V20.0 加强：硬上限兜底——极端 Rapid 切歌/调度时钟漂移场景下，按 stopAt 裁剪
      //   可能仍残留少量活节点（如 osc 被外部 stop 但 stopAt 未到 t0）。此处加一道
      //   MAX_LIVE=32 硬帽：超过即丢弃最旧的一半引用并强制断连，防止 _bgmLiveNodes
      //   在长时间运行后无限膨胀（每拍 push 2~3 个，数月长局累积上千条引用驻留内存）。
      const MAX_LIVE = 32;
      if (this._bgmLiveNodes.length > MAX_LIVE) {
        const stale = this._bgmLiveNodes.splice(0, this._bgmLiveNodes.length - MAX_LIVE);
        for (const n of stale) {
          try { n.osc && n.osc.stop(); } catch (e) {}
          try { n.osc && n.osc.disconnect(); } catch (e) {}
          try { n.gain && n.gain.disconnect(); } catch (e) {}
        }
      }
    }
    // 性能优化（audio.js #2）：直接用 startBGM 预建的频率数组，避免每拍
    //   PENTATONIC 属性链查找。_freqScale 缺省时（理论上不会）兜底现算。
    const freqScale = track._freqScale || track.scale.map(n => PENTATONIC[n] || 440);
    // 旋律：按概率在音阶中选音（密度控制旋律稀疏度）
    if (Math.random() < track.density) {
      const freq = freqScale[Math.floor(Math.random() * freqScale.length)];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = track.wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(t0); osc.stop(t0 + 0.65);
      this._bgmLiveNodes.push({ osc, gain: g, stopAt: t0 + 0.65 }); // 追踪
    }
    // 鼓点
    if (track.hasDrum && this._bgmStep % 4 === 0) this._bgmDrum(t0);
    // 低音：每 4 拍一个低音（用缓存频率，零查找）
    if (this._bgmStep % 4 === 0) {
      const bassFreq = track._bassFreq || ((PENTATONIC[track.scale[0]] || 110) / 2);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = track.bassWave;
      osc.frequency.value = bassFreq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(t0); osc.stop(t0 + 0.85);
      this._bgmLiveNodes.push({ osc, gain: g, stopAt: t0 + 0.85 }); // 追踪
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
