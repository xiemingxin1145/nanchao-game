// ============================================================
// animation.js — 《南北朝》人物动画系统核心引擎
// ------------------------------------------------------------
// 设计思路（来自开源实践调研，记录备查）：
// 1) 待机呼吸（William Malone, "Create a Game Character with
//    HTML5 Canvas"）：用呼吸方向增量(breathInc/breathDir)驱动身体
//    上下起伏；本文改用正弦函数 sin(time*ω) 直接驱动 scale/translate，
//    周期 3s，幅度 1.0~1.02，更平滑。
//    参考: https://www.williammalone.com/articles/create-html5-canvas-javascript-game-character/1/
// 2) 精灵逐帧（Kirupa / William Malone sprite 教程）：用
//    drawImage 裁剪 sprite sheet，帧切换由时间戳差值驱动而非固定
//    setInterval，配合 requestAnimationFrame。本项目无 sprite sheet，
//    改用 Canvas 几何图形程序化绘制 2.5D 角色，用 frame 计数驱动
//    腿部/武器摆动相位。
//    参考: https://www.kirupa.com/canvas/sprite_animations_canvas.htm
// 3) 粒子系统（MDN Advanced animations / Canvas Engine FX 预设）：
//    维护 particles 数组，每个粒子 {x,y,vx,vy,life,maxLife,size,type}，
//    每帧 update 位置 + 衰减 life，绘制时 alpha = life/maxLife 实现渐隐；
//    burst 型（斩击/冲击）一次生成一批，rate 型（火焰/环绕）持续生成。
//    参考: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Advanced_animations
//          https://canvasengine.net/presets/fx
// 4) CSS 立绘呼吸（CSSShowcase "Breathe" / Motion Reference）：
//    @keyframes breathe { 0%,100%{scale(1)} 50%{scale(1.02)} } ease-in-out
//    infinite，叠加 translateY(-2px) 模拟悬浮，用 transform/opacity 不影响布局。
//    参考: https://www.cssshowcase.com/snippets/animation/breathe
//
// 本文件不依赖任何外部动画库，纯 Canvas 2D + 数学计算。
//
// ============================================================
// V8.1 — 战斗动画系统深度打磨
// ------------------------------------------------------------
// 1) 武将战斗动作增强：挥砍金弧/冲锋速度线+尘土/射击弹道尾迹/
//    元素法术(火橙爆·水蓝波·风青旋)。
// 2) 受击反馈：闪白覆盖、屏幕抖动(衰减)、击退回弹、伤害飘字
//    (红色上飘+渐隐，暴击金色放大+「暴击!」标签)。
// 3) 暴击慢动作：timeScale=0.3 特写，径向暗角 vignette +
//    「暴击!」弹字(scale 0→1.5→1)。
// 4) 战场氛围粒子：plain/forest/river/desert/snow/night 六类环境，
//    复用 _particlePool，氛围粒子优先级最低、超限先淘汰。
// 5) 战斗结算：胜利举武器金光爆发 / 失败倒地灰化渐隐。
// 6) 性能：粒子上限 150 不变；timeScale/battleEnv 均有默认值；
//    不改动现有公共方法签名。
// ============================================================

export class CharacterAnimator {
  constructor() {
    this.particles = [];
    this.time = 0;          // 累计秒
    this.frame = 0;         // 累计帧计数（连续浮点）
    // ---- V3.5：粒子对象池（避免频繁 GC） ----
    // 技术参考：对象池模式（object pool pattern）——
    // const pool = []; function getParticle(){ return pool.pop() || {}; }
    // function releaseParticle(p){ pool.push(p); }
    // V13.0：粒子上限分档——战斗场景 200，非战斗场景 50（按 _paused 自动切换）
    this._particlePool = [];
    this._maxParticles = 200;       // V13.0 战斗场景粒子上限
    this._maxParticlesPeace = 50;   // V13.0 非战斗场景粒子上限（地图/UI 待机）
    this._paused = false;   // V5.5：非战斗场景暂停粒子更新

    // ---- V13.0 待机动画深化状态 ----
    // 待机状态机：idle(默认) / idle_combat(战斗准备) / idle_victory(胜利) / idle_defeat(失败)
    this._idleState = 'idle';
    this._blinkTimer = 2.5 + Math.random() * 2.5; // 距下次眨眼倒计时（首次 2.5~5s）
    this._blinkTime = 0;          // 当前眨眼进行中剩余时间（0=未眨眼）
    this._blinkDuration = 0.15;   // 单次眨眼时长（快速闭合+睁开）
    this._idleClock = 0;          // 待机动画本地时钟（不受慢动作影响，跟随 update 累计）
    this._moveDustTimer = 0;      // 行军尘土生成节流计时器
    this._lastMoveDustEmit = 0;   // 上次行军尘土生成时刻（this.time 基准）

    // ---- V8.1 战斗动画增强状态 ----
    this.timeScale = 1;         // 全局时间缩放（暴击慢动作=0.3）
    this.battleEnv = 'plain';   // 战场环境类型 plain/forest/river/desert/snow/night
    this._ambientTimer = 0;     // 氛围粒子生成倒计时
    this._battleW = 900;        // 氛围粒子生成的虚拟战场宽
    this._battleH = 420;        // 氛围粒子生成的虚拟战场高
    this.damageNumbers = [];    // 伤害飘字 {x,y,text,life,maxLife,isCrit}
    this.knockbacks = [];       // 受击击退记录 {x,y,distance,life,maxLife}
    this.lunges = [];           // 冲锋前冲记录 {x,y,distance,dir,life,maxLife}
    this._shake = { time: 0, duration: 0.15, magnitude: 3 };  // 屏幕抖动
    this._cinematic = { time: 0, duration: 0.5 };             // 暴击慢动作计时
    this._critText = { time: 0, duration: 0.4 };              // 「暴击!」弹字计时
    this._poseState = {};       // 结算姿势状态 {side:{pose,life,maxLife}}

    // ============================================================
    // V15.0 — 动画与地图增强：成就解锁 / 段位升级 / 结局结算 覆盖层状态
    // 设计：play* 方法只写入状态机 + 触发一次性粒子爆发；
    //      时间线由 update(dt) 用 delta time 推进；绘制由各 draw* 方法按
    //      当前进度渲染（rAF 驱动，与主循环一致）。
    // ============================================================
    this._achFX = null;        // 成就解锁 {name,x,y,t,dur}
    this._tierFX = null;       // 段位升级 {oldTier,newTier,x,y,t,dur}
    this._endingFX = null;     // 结局结算 {rank,type,t,dur,W,H,chars}
    this._achTrophyCache = null;   // 奖杯静态帧离屏缓存
    this._endingPalaceCache = {};  // 各等级宫殿剪影离屏缓存 {rank:canvas}
    this._achParticleCap = 120;    // 成就/结局覆盖层粒子上限保护

    // ============================================================
    // V16.0 — 动画与地图增强：开场/过场/战役关卡片头/目标/结算
    // 设计：与 V15 覆盖层一致——play* 只写入状态机 + 触发一次性粒子；
    //      update(dt) 用真实时间推进 t；draw* 按 t/dur 渲染。
    //      预渲染：战场剪影/时间线背景等静态帧离屏缓存，避免每帧重算。
    // ============================================================
    this._prologueFX = null;       // 开场序幕 {t,dur,W,H,seed}
    this._timelineFX = null;        // 时代变迁 {eventName,t,dur,W,H,phase}
    this._campaignIntroFX = null;  // 战役片头 {campaignName,difficulty,t,dur,W,H}
    this._campaignObjFX = null;    // 战役目标 {objectiveText,t,dur,W,H}
    this._campaignVicFX = null;    // 战役结算 {stars,rewards,t,dur,W,H}
    this._prologueSilhouetteCache = null; // 战场剪影预渲染帧
    this._timelineBgCache = {};              // 时间线关键事件预渲染缓存 {eventName:canvas}
    this._campMarkerPool = [];          // 战役标记对象池（map.js 复用）

    // ============================================================
    // V17.0 — 动画与地图增强：战斗动画深化
    // 设计：play* 触发一次性粒子爆发 + 在 ctx 上直接绘制即时特效；
    //      连续形变用 FX 列表 + update(dt) 推进 t，draw*BattleFX 渲染。
    //      粒子上限仍受 _maxParticles / _achParticleCap 约束。
    // ============================================================
    this._battleFXs = [];          // 战斗FX列表 [{type,t,dur,x,y,...}]
    this._battleFXCap = 24;        // 同时存活的战斗FX上限
    this._moraleBars = new Map();   // 军队士气条 {key:{x,y,morale,t}}  供 map.js 每帧绘制
    this._V17_CHARGE_HORN = false;  // 预留：马蹄声视觉标记（不接音频，仅视觉）

    // ============================================================
    // V19.0 — 动画与地图增强：科技研究 / 文化建筑 / 文化值提升 覆盖层
    // 设计：与 V15/V16/V17 一致——play* 只写入状态机 + 触发一次性粒子；
    //      update(dt) 用真实时间推进 t；draw* 按 t/dur 渲染。
    //      粒子仍走 _getParticle/_pushParticle 对象池 + 统一上限。
    // ============================================================
    this._techFX = null;       // 科技研究完成 {techName,x,y,t,dur}
    this._cultureBuildFX = null; // 文化建筑建成 {x,y,t,dur}
    this._cultureRiseFX = null;  // 文化值提升 {x,y,t,dur}
    this._v19FXCap = 3;        // 同时存活的 V19 覆盖层上限（同类型后到替换前到）

    // ============================================================
    // V20.0 — 动画与地图增强：自然灾害动画系统
    // 设计：与 V15~V19 一致——play* 只写入 _disasterFXs 状态机 + 触发一次性粒子；
    //      update(dt) 用真实时间推进 t；drawDisasterFX(ctx) 按 t/dur 渲染。
    //      粒子仍走 _getParticle/_pushParticle 对象池，受 _maxParticles 上限保护；
    //      灾害专属粒子另设 _disasterParticleBudget 预算，避免与战斗粒子争抢。
    //      距离衰减：_disasterFocus={x,y} 为当前镜头/关注点，远离者透明度衰减。
    // ============================================================
    this._disasterFXs = [];        // 灾害FX列表 [{type,x,y,w,h,t,dur,seed,intensity}]
    this._disasterFXCap = 8;       // 同时存活的灾害FX上限（超出淘汰最老）
    this._disasterParticleBudget = 120; // 灾害专属粒子预算（独立于战斗粒子池统计）
    this._disasterFocus = { x: 0, y: 0 };   // 距离衰减中心（map.js 每帧更新）
    this._disasterFocusRadius = 600;       // 距离衰减半径（像素）
    this._disasterShakeMag = 0;     // 地震期间持续震屏强度（draw 时由 map.js 读取）
    this._disasterShakeDur = 0;     // 剩余震屏时间（真实秒）
    this._disasterEmitAcc = 0;     // 灾害持续粒子生成累计器（按 dt 节流）

    // ============================================================
    // V21.0 — 动画与地图增强：丝绸之路动画 + 家族动画
    // 设计：与 V15~V20 一致——play* 只写入 _silkFXs / _familyFXs 状态机
    //      + 触发一次性粒子；update(dt) 用真实时间推进 t；
    //      drawSilkFX / drawFamilyFX 按 t/dur 渲染。
    //      粒子走 _getParticle/_pushParticle 对象池 + 统一上限；
    //      丝路/家族专属粒子另设预算，避免与战斗粒子争抢；
    //      FX 列表有硬上限（超出淘汰最老）。
    // ============================================================
    this._silkFXs = [];            // 丝路FX [{type,x,y,x2,y2,goodsType,t,dur,seed}]
    this._silkFXCap = 8;           // 同时存活丝路FX上限
    this._silkParticleBudget = 100; // 丝路专属粒子预算（独立统计 _silk 标记）
    this._silkEmitAcc = 0;         // 丝路持续粒子生成累计器
    this._familyFXs = [];          // 家族FX [{type,x,y,t,dur,seed}]
    this._familyFXCap = 6;         // 同时存活家族FX上限
    this._familyParticleBudget = 90; // 家族专属粒子预算
    this._familyEmitAcc = 0;        // 家族持续粒子生成累计器

    // ============================================================
    // V22.0 — 动画与地图增强：科举动画 + 选官动画
    // 设计：与 V21.0 一致——play* 只写入 _examResultFX（全屏放榜）/
    //      _examFXs（点FX）状态机 + 触发一次性粒子；
    //      update(dt) 用真实时间推进 t；drawExamFX / drawExamResultsFX
    //      按 t/dur 渲染（均由 map.js 每帧调用）。
    //      粒子走 _getParticle/_pushParticle 对象池 + 专属预算；
    //      点 FX 列表硬上限（超出淘汰最老）；
    //      游街/宴饮等持续粒子按 dt 节流生成，受预算保护。
    // ============================================================
    this._examResultFX = null;      // 放榜全屏覆盖层 {x,y,w,h,t,dur,seed}
    this._examFXs = [];             // 点FX [{type,x,y,... ,t,dur,seed}]
    this._examFXCap = 8;            // 同时存活科举/选观点FX上限
    this._examParticleBudget = 90;  // 科举/选官专属粒子预算（_exam 标记）
    this._examEmitAcc = 0;          // 持续粒子生成累计器（游街欢呼/宴饮）
  }

  // V5.5：暂停/恢复粒子更新（非战斗场景调用，节省 CPU）
  setPaused(p) { this._paused = !!p; }

  // ============================================================
  // V13.0 — 待机动画深化 / 行军 / 技能 / 兵种 / 连携 公共 API
  // ============================================================

  // ---- 待机状态机 ----
  // state: 'idle' | 'idle_combat' | 'idle_victory' | 'idle_defeat'
  // - idle：默认自然站立（呼吸+眨眼+武器微动）
  // - idle_combat：战斗准备，身体微侧、武器微抬
  // - idle_victory：胜利姿态，昂首挺胸、武器上指
  // - idle_defeat：失败姿态，低头垂肩、武器下垂
  setIdleState(state) {
    if (!state) return;
    this._idleState = String(state);
  }

  // 当前待机状态查询
  getIdleState() { return this._idleState; }

  // 眨眼状态机内部推进：每 3~5 秒随机触发一次 0.15s 快速闭合
  _updateBlink(deltaTime) {
    if (this._blinkTime > 0) {
      // 正在眨眼：倒计时结束后重置，随机安排下次眨眼（3~5s）
      this._blinkTime -= deltaTime;
      if (this._blinkTime <= 0) {
        this._blinkTime = 0;
        this._blinkTimer = 3 + Math.random() * 2;
      }
    } else {
      this._blinkTimer -= deltaTime;
      if (this._blinkTimer <= 0) this._blinkTime = this._blinkDuration;
    }
  }

  // 当前眨眼闭合度（0=睁眼，1=完全闭合），供绘制眼部时叠加
  _blinkClose() {
    if (this._blinkTime <= 0) return 0;
    // 0.15s 内：前 1/3 闭合，中 1/3 闭合保持，后 1/3 睁开（三角形曲线）
    const p = 1 - this._blinkTime / this._blinkDuration; // 0→1
    return p < 0.33 ? p / 0.33
         : p < 0.66 ? 1
         : 1 - (p - 0.66) / 0.34;
  }

  // ============================================================
  // V8.1 公共 API
  // ============================================================

  // ---- 时间缩放 / 暴击慢动作特写 ----
  // 直接设置全局时间缩放（默认 1）。update() 开头 dt *= timeScale。
  setTimeScale(scale) { this.timeScale = Math.max(0, scale || 1); }

  // 触发暴击特写：全局时间缩放至 0.3，持续 duration(默认0.5s) 后自动恢复 1。
  // 同时开启径向暗角 vignette 与「暴击!」弹字。
  triggerCinematic(duration = 0.5) {
    this.setTimeScale(0.3);
    this._cinematic.time = duration;
    this._cinematic.duration = duration;
    this._critText.time = 0.4;
    this._critText.duration = 0.4;
  }

  // ---- 战场环境 ----
  // type: 'plain'|'forest'|'river'|'desert'|'snow'|'night'
  setBattleEnvironment(type) {
    this.battleEnv = type || 'plain';
    this._ambientTimer = 0; // 立即尝试生成，便于观察
  }

  // ---- 受击反馈 ----
  // 闪白(0.6α,0.1s渐隐) + 迸溅火花 + 击退(5~8px,0.3s回位) +
  // 伤害飘字(红色上飘渐隐0.8s；暴击金色放大+「暴击!」标签) + 重击屏幕抖动。
  playHitEffect(x, y, damage = 0, isCrit = false) {
    // 1) 闪白覆盖粒子（alpha 0.6，0.1s 渐隐）
    const flash = this._getParticle();
    Object.assign(flash, { type: 'hitflash', x, y, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 0.1, maxLife: 0.1, size: 14, color: '#ffffff' });
    this._pushParticle(flash);
    // 2) 迸溅火花（暴击用 critical_hit 红金碎片）
    this.spawnParticle(x, y, isCrit ? 'critical_hit' : 'impact');
    // 3) 击退：向后 5~8px，0.3s 内弹性回位
    this.knockbacks.push({ x, y, distance: 5 + Math.random() * 3, life: 0.3, maxLife: 0.3 });
    // 4) 伤害飘字
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 8, y: y - 20,
      text: String(Math.round(damage)), life: 0.8, maxLife: 0.8, isCrit: !!isCrit
    });
    // 5) 重击/暴击屏幕抖动（±3px，0.15s，衰减）
    if (isCrit) this._shakeFX(3, 0.15);
  }

  // 屏幕抖动内部触发
  _shakeFX(mag, dur) {
    this._shake.magnitude = mag; this._shake.duration = dur; this._shake.time = dur;
  }

  // 当前抖动偏移（调用方在绘制战斗 canvas 前 translate）。无抖动返回 0。
  getShakeOffset() {
    if (this._shake.time <= 0) return { dx: 0, dy: 0 };
    const decay = Math.max(0, this._shake.time / this._shake.duration);
    const m = this._shake.magnitude * decay;
    return { dx: (Math.random() * 2 - 1) * m, dy: (Math.random() * 2 - 1) * m };
  }

  // 缓动 ease-out-back（用于击退回位）
  _easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // 取某点附近受击击退的水平偏移（ease-out-back 回位），无则返回 0
  getKnockbackOffset(x, y) {
    let best = null, bd = Infinity;
    for (const kb of this.knockbacks) {
      const d = (kb.x - x) ** 2 + (kb.y - y) ** 2;
      if (d < bd) { bd = d; best = kb; }
    }
    if (!best) return 0;
    const prog = 1 - best.life / best.maxLife; // 0→1
    return best.distance * this._easeOutBack(1 - prog);
  }

  // ---- 武将战斗动作增强 ----
  // 挥砍：金/白弧形斩击轨迹（0.2s）+ 武器发光碎屑
  playSlash(x, y, angle = -Math.PI / 4) {
    const p = this._getParticle();
    Object.assign(p, { type: 'slash_arc', x, y, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 0.2, maxLife: 0.2, size: 36,
      color: '#ffe9a8', angle });
    this._pushParticle(p);
    // 武器发光碎屑
    for (let i = 0; i < 4; i++) {
      const s = this._getParticle();
      const a = angle + (Math.random() - 0.5) * 0.8;
      Object.assign(s, { type: 'spark',
        x: x + Math.cos(angle) * 30, y: y + Math.sin(angle) * 30,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        gravity: 0, drag: 1, life: 0.25, maxLife: 0.25,
        size: 1.5, color: '#fff2b0' });
      this._pushParticle(s);
    }
  }

  // 冲锋：前冲 8~12px 回弹 + 速度线(3~5条) + 尘土
  playCharge(x, y, dir = 1) {
    const n = 3 + Math.floor(Math.random() * 3); // 3~5 条速度线
    for (let i = 0; i < n; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'speedline',
        x: x - dir * 20, y: y - 10 - Math.random() * 30,
        vx: -dir * (180 + Math.random() * 120), vy: 0,
        gravity: 0, drag: 0, life: 0.18 + Math.random() * 0.12, maxLife: 0.3,
        size: 14 + Math.random() * 10, color: 'rgba(255,255,255,0.7)' });
      this._pushParticle(s);
    }
    this.spawnParticle(x, y, 'dust');
    // 前冲位移 8~12px 后回弹
    this.lunges.push({ x, y, dir, distance: 8 + Math.random() * 4, life: 0.3, maxLife: 0.3 });
  }

  // 射击：箭矢弹道（射手→目标快速直线+尾迹）+ 命中点火花
  playShot(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(3, Math.min(8, Math.round(dist / 12)));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const s = this._getParticle();
      Object.assign(s, { type: 'arrow_trail',
        x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t,
        vx: 0, vy: 0, gravity: 0, drag: 0,
        life: 0.22, maxLife: 0.22, size: 2, color: '#fff6c8' });
      this._pushParticle(s);
    }
    // 命中点迸溅火花
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 100;
      const s = this._getParticle();
      Object.assign(s, { type: 'spark', x: x2, y: y2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 120, drag: 1.2, life: 0.25 + Math.random() * 0.2, maxLife: 0.45,
        size: 1.5 + Math.random() * 1.5, color: '#ffe980' });
      this._pushParticle(s);
    }
  }

  // 法术/技能：按元素着色  fire=橙红爆裂 / water=蓝色波纹 / wind=青色旋风
  playSkill(x, y, element = 'fire') {
    if (element === 'water') {
      this.spawnParticle(x, y, 'ripple');
      for (let i = 0; i < 8; i++) {
        const s = this._getParticle();
        Object.assign(s, { type: 'element_water',
          x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15,
          gravity: 0, drag: 0.4, life: 0.7 + Math.random() * 0.3, maxLife: 1.0,
          size: 2.5 + Math.random() * 2, color: '#6ab0e8' });
        this._pushParticle(s);
      }
    } else if (element === 'wind') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + this.time * 3;
        const s = this._getParticle();
        Object.assign(s, { type: 'element_wind',
          x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8,
          vx: Math.cos(a) * 50, vy: Math.sin(a) * 50 - 10,
          gravity: 0, drag: 0.8, life: 0.45 + Math.random() * 0.25, maxLife: 0.7,
          size: 2 + Math.random() * 2, color: '#8fe8d8', angle: a });
        this._pushParticle(s);
      }
    } else { // fire 默认橙红爆裂
      this.spawnParticle(x, y, 'fire');
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 90;
        const s = this._getParticle();
        Object.assign(s, { type: 'element_fire', x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          gravity: -30, drag: 0.6, life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
          size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? '#ff5a2a' : '#ffaa22' });
        this._pushParticle(s);
      }
    }
  }

  // ---- 战斗结算 ----
  // 胜利方：记录庆祝姿势 + 金色光芒粒子爆发
  playVictoryPose(side = 'left', x = 0, y = 0) {
    this._poseState[side] = { pose: 'victory', life: 2.0, maxLife: 2.0 };
    for (let i = 0; i < 16; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'victory_gold',
        x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 50,
        gravity: -20, drag: 0.3, life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
        size: 2 + Math.random() * 3, color: '#FFD700', angle: Math.random() * Math.PI * 2 });
      this._pushParticle(s);
    }
  }

  // 失败方：记录倒地姿势 + 灰化余烬粒子
  playDefeatPose(side = 'left', x = 0, y = 0) {
    this._poseState[side] = { pose: 'defeat', life: 1.5, maxLife: 1.5 };
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'defeat_ash',
        x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 10,
        gravity: 20, drag: 0.4, life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
        size: 2 + Math.random() * 2, color: '#888888' });
      this._pushParticle(s);
    }
  }

  // 从对象池取一个粒子对象
  _getParticle() {
    const p = this._particlePool.pop();
    if (p) {
      // 重置字段
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      p.gravity = 0; p.drag = 0; p.life = 0.5; p.maxLife = 0.5;
      p.size = 3; p.color = '#fff'; p.type = '';
      p.angle = 0; p.seed = 0;
      p._isAmbient = false;   // V8.1：回收后默认非氛围粒子
      return p;
    }
    return { x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff', type: '', angle: 0, seed: 0, _isAmbient: false };
  }
  // 回收粒子到对象池
  _releaseParticle(p) {
    if (this._particlePool.length < 500) this._particlePool.push(p);
  }

  // ---------- 主更新 ----------
  // deltaTime: 秒。驱动粒子生命周期与全局时钟。
  // V8.1：开头将 dt *= timeScale，暴击慢动作时整体降速。
  update(deltaTime) {
    if (!deltaTime || deltaTime <= 0) return;
    if (this._paused) return;   // V5.5：非战斗场景暂停粒子更新（含氛围粒子）
    // V8.1：全局时间缩放（暴击慢动作）
    const dt = deltaTime * (this.timeScale || 1);
    this.time += dt;
    this.frame += dt * 12; // ~12fps 的逻辑帧步进

    // ---- V13.0：待机本地时钟与眨眼状态机 ----
    // 待机时钟用真实时间 deltaTime 推进（不受暴击慢动作影响，否则眨眼会卡顿）
    this._idleClock += deltaTime;
    this._updateBlink(deltaTime);

    // ---- V8.1：战场氛围粒子低速生成 ----
    if (this.battleEnv) this._updateAmbient(dt);

    // ---- V8.1：伤害飘字（上飘 + 渐隐）----
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      dn.y -= 36 * dt;
      if (dn.life <= 0) this.damageNumbers.splice(i, 1);
    }
    // ---- V8.1：击退 / 冲锋记录到期回收 ----
    for (let i = this.knockbacks.length - 1; i >= 0; i--) {
      this.knockbacks[i].life -= dt;
      if (this.knockbacks[i].life <= 0) this.knockbacks.splice(i, 1);
    }
    for (let i = this.lunges.length - 1; i >= 0; i--) {
      this.lunges[i].life -= dt;
      if (this.lunges[i].life <= 0) this.lunges.splice(i, 1);
    }
    // ---- V8.1：结算姿势状态到期 ----
    for (const k in this._poseState) {
      this._poseState[k].life -= dt;
      if (this._poseState[k].life <= 0) delete this._poseState[k];
    }

    // ---- V8.1：屏幕抖动 / 暴击特写用真实时间衰减（不受慢动作影响）----
    if (this._shake.time > 0) this._shake.time -= deltaTime;
    if (this._cinematic.time > 0) {
      this._cinematic.time -= deltaTime;
      if (this._cinematic.time <= 0) this.setTimeScale(1);
    }
    if (this._critText.time > 0) this._critText.time -= deltaTime;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) { p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); }
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        this._releaseParticle(p);
      }
    }

    // ---- V15.0：成就/段位/结局覆盖层时间线推进（用真实时间，不受慢动作影响）----
    if (this._achFX) {
      this._achFX.t += deltaTime;
      if (this._achFX.t >= this._achFX.dur) this._achFX = null;
    }
    if (this._tierFX) {
      this._tierFX.t += deltaTime;
      if (this._tierFX.t >= this._tierFX.dur) this._tierFX = null;
    }
    if (this._endingFX) {
      this._endingFX.t += deltaTime;
      if (this._endingFX.t >= this._endingFX.dur) this._endingFX = null;
    }

    // ---- V16.0：开场/过场/战役覆盖层时间线推进（真实时间，不受慢动作影响）----
    if (this._prologueFX) {
      this._prologueFX.t += deltaTime;
      if (this._prologueFX.t >= this._prologueFX.dur) this._prologueFX = null;
    }
    if (this._timelineFX) {
      this._timelineFX.t += deltaTime;
      if (this._timelineFX.t >= this._timelineFX.dur) this._timelineFX = null;
    }
    if (this._campaignIntroFX) {
      this._campaignIntroFX.t += deltaTime;
      if (this._campaignIntroFX.t >= this._campaignIntroFX.dur) this._campaignIntroFX = null;
    }
    if (this._campaignObjFX) {
      this._campaignObjFX.t += deltaTime;
      if (this._campaignObjFX.t >= this._campaignObjFX.dur) this._campaignObjFX = null;
    }
    if (this._campaignVicFX) {
      this._campaignVicFX.t += deltaTime;
      if (this._campaignVicFX.t >= this._campaignVicFX.dur) this._campaignVicFX = null;
    }

    // ---- V17.0：战斗FX时间线推进（真实时间，不受慢动作影响）----
    for (let i = this._battleFXs.length - 1; i >= 0; i--) {
      const fx = this._battleFXs[i];
      fx.t += deltaTime;
      if (fx.t >= fx.dur) this._battleFXs.splice(i, 1);
    }
    // ---- V19.0：科技/文化覆盖层时间线推进（真实时间，不受慢动作影响）----
    if (this._techFX) {
      this._techFX.t += deltaTime;
      if (this._techFX.t >= this._techFX.dur) this._techFX = null;
    }
    if (this._cultureBuildFX) {
      this._cultureBuildFX.t += deltaTime;
      if (this._cultureBuildFX.t >= this._cultureBuildFX.dur) this._cultureBuildFX = null;
    }
    if (this._cultureRiseFX) {
      this._cultureRiseFX.t += deltaTime;
      if (this._cultureRiseFX.t >= this._cultureRiseFX.dur) this._cultureRiseFX = null;
    }
    // ---- V20.0：灾害 FX 时间线推进（真实时间，不受慢动作影响）----
    this._updateDisasterFXs(deltaTime);
    // 地震持续震屏衰减
    if (this._disasterShakeDur > 0) this._disasterShakeDur -= deltaTime;
    // ---- V21.0：丝路 / 家族 FX 时间线推进（真实时间，不受慢动作影响）----
    this._updateSilkFXs(deltaTime);
    this._updateFamilyFXs(deltaTime);
    // ---- V22.0：科举/选官 FX 时间线推进（真实时间，不受慢动作影响）----
    this._updateExamFXs(deltaTime);
    if (this._examResultFX) {
      this._examResultFX.t += deltaTime;
      if (this._examResultFX.t >= this._examResultFX.dur) this._examResultFX = null;
    }
    // 士气条淡入淡出推进
    for (const [k, m] of this._moraleBars) {
      m.t += deltaTime;
      if (m.t > 3.0) this._moraleBars.delete(k);
    }
  }

  // V17.0：推入战斗FX（带上限保护）
  _pushBattleFX(fx) {
    if (this._battleFXs.length >= this._battleFXCap) this._battleFXs.shift();
    fx.t = 0;
    this._battleFXs.push(fx);
  }

  // V17.0：缓动函数集合
  _v17EaseOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  _v17EaseInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  _v17Lerp(a, b, t) { return a + (b - a) * t; }

  // V15.0：覆盖层一次性粒子（带上限保护，复用 _pushParticle 队列）
  _burstFXParticles(x, y, count, opts) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this._achParticleCap && !this.particles.some(p => p._isAmbient)) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = (opts.minSpeed || 40) + Math.random() * (opts.spread || 120);
      const s = this._getParticle();
      Object.assign(s, {
        type: opts.type || 'spark',
        x: x + (Math.random() - 0.5) * (opts.rangeX || 10),
        y: y + (Math.random() - 0.5) * (opts.rangeY || 10),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (opts.upBias || 0),
        gravity: opts.gravity != null ? opts.gravity : 60,
        drag: 0.4,
        life: (opts.lifeMin || 0.6) + Math.random() * ((opts.lifeMax || 1.2) - (opts.lifeMin || 0.6)),
        size: (opts.sizeMin || 2) + Math.random() * ((opts.sizeMax || 4) - (opts.sizeMin || 2)),
        color: Array.isArray(opts.colors)
          ? opts.colors[Math.floor(Math.random() * opts.colors.length)]
          : (opts.color || '#FFD700')
      });
      this._pushParticle(s);
    }
  }

  // V8.1：氛围粒子按战场环境低速生成（每 0.5~1s 生成 1~2 个）
  _updateAmbient(dt) {
    this._ambientTimer -= dt;
    if (this._ambientTimer > 0) return;
    this._ambientTimer = 0.5 + Math.random() * 0.5;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) this._spawnAmbient();
  }

  // V8.1：按环境类型生成单个氛围粒子（复用对象池，标记 _isAmbient）
  _spawnAmbient() {
    const W = this._battleW, H = this._battleH;
    const p = this._getParticle();
    p._isAmbient = true;
    switch (this.battleEnv) {
      case 'plain':
        // 偶尔尘土飞扬
        Object.assign(p, { type: 'dust', x: Math.random() * W, y: H - Math.random() * 30,
          vx: -10 - Math.random() * 20, vy: -8 - Math.random() * 10,
          gravity: 10, drag: 0.6, life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
          size: 3 + Math.random() * 4, color: '#8B7355' });
        break;
      case 'forest':
        // 飘落树叶（绿/黄，旋转下落）
        Object.assign(p, { type: 'leaf', x: Math.random() * W, y: -10,
          vx: -8 + Math.random() * 16, vy: 20 + Math.random() * 15,
          gravity: 15, drag: 0.2, life: 4 + Math.random() * 2, maxLife: 6,
          size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? '#4a7c3a' : '#b8a030',
          angle: Math.random() * Math.PI * 2, seed: Math.random() * 10 });
        break;
      case 'river':
        // 水雾（白色半透明，上升）
        Object.assign(p, { type: 'mist', x: Math.random() * W, y: H - Math.random() * 20,
          vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 10,
          gravity: -5, drag: 0.1, life: 2 + Math.random() * 1.5, maxLife: 3.5,
          size: 6 + Math.random() * 8, color: '#e8f0f5' });
        break;
      case 'desert':
        // 飞沙（黄褐，横向快速移动）
        Object.assign(p, { type: 'sand', x: -20, y: Math.random() * H * 0.6,
          vx: 120 + Math.random() * 80, vy: (Math.random() - 0.5) * 20,
          gravity: 0, drag: 0, life: 2 + Math.random() * 1, maxLife: 3,
          size: 2 + Math.random() * 3, color: '#c2a060' });
        break;
      case 'snow':
        // 飘雪（白色，缓慢下落摇摆）
        Object.assign(p, { type: 'snow', x: Math.random() * W, y: -10,
          vx: (Math.random() - 0.5) * 10, vy: 18 + Math.random() * 12,
          gravity: 0, drag: 0, life: 5 + Math.random() * 3, maxLife: 8,
          size: 2 + Math.random() * 2.5, color: '#ffffff', seed: Math.random() * 100 });
        break;
      case 'night':
        // 萤火/光点（暗绿，缓慢漂浮）
        Object.assign(p, { type: 'firefly', x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
          gravity: 0, drag: 0, life: 3 + Math.random() * 2, maxLife: 5,
          size: 2, color: '#7aff8a', seed: Math.random() * 100 });
        break;
      default:
        return;
    }
    this._pushParticle(p);
  }

  // 添加粒子（带上限保护）
  // V8.1：超限时优先淘汰氛围粒子（_isAmbient），无氛围粒子时再淘汰最老
  // V13.0：粒子上限分档——战斗(非暂停) 200 / 非战斗(暂停) 50
  _pushParticle(p) {
    const cap = this._paused ? this._maxParticlesPeace : this._maxParticles;
    if (this.particles.length >= cap) {
      let idx = -1;
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i]._isAmbient) { idx = i; break; }
      }
      if (idx >= 0) {
        const old = this.particles.splice(idx, 1)[0];
        if (old) this._releaseParticle(old);
      } else {
        const old = this.particles.shift();
        if (old) this._releaseParticle(old);
      }
    }
    this.particles.push(p);
  }

  // ---------- 粒子生成 ----------
  // type: 'slash'|'fire'|'lightning'|'heal'|'impact'|'spark'
  spawnParticle(x, y, type, opts = {}) {
    const now = this.time;
    switch (type) {
      case 'fire':
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            type, x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 40,
            gravity: -10, drag: 0.5,
            life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
            size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#ff6a2a' : '#ffcc33'
          });
        }
        break;
      case 'heal':
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            type, x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 20,
            gravity: 0, drag: 0.3,
            life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
            size: 2 + Math.random() * 2.5, color: '#66ff88'
          });
        }
        break;
      case 'impact':
        this.particles.push({
          type, x, y, vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 0.45, maxLife: 0.45, size: 6, color: '#ffe680'
        });
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 120;
          this.particles.push({
            type: 'spark', x, y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            gravity: 120, drag: 1.2,
            life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
            size: 1.5 + Math.random() * 2, color: '#ffdd66'
          });
        }
        break;
      case 'slash':
        this.particles.push({
          type, x, y, vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 0.25, maxLife: 0.25, size: 40,
          color: '#ffffff', angle: opts.angle || -Math.PI / 4
        });
        break;
      case 'lightning':
        this.particles.push({
          type, x, y, vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 0.3, maxLife: 0.3, size: 50, color: '#bfeaff',
          seed: Math.random() * 1000
        });
        break;
      // ---- V3.5 新粒子效果 ----
      case 'dust':
        // 骑兵冲锋尘土：棕色粒子从马蹄下向后扩散
        for (let i = 0; i < 10; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'dust', x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 8,
            vx: -20 - Math.random() * 40, vy: -10 - Math.random() * 15,
            gravity: 20, drag: 0.8,
            life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
            size: 4 + Math.random() * 6, color: '#8B7355'
          });
          this._pushParticle(p);
        }
        break;
      case 'arrow':
        // 箭矢雨：多支箭矢从空中落下
        for (let i = 0; i < 8; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'arrow', x: x + (Math.random() - 0.5) * 80, y: y - 100 - Math.random() * 60,
            vx: (Math.random() - 0.5) * 10, vy: 150 + Math.random() * 80,
            gravity: 200, drag: 0,
            life: 1.0 + Math.random() * 0.3, maxLife: 1.3,
            size: 8, color: '#D4C49A'
          });
          this._pushParticle(p);
        }
        break;
      case 'debris':
        // 破城碎石：城墙被攻破时碎石飞溅
        for (let i = 0; i < 14; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 80 + Math.random() * 180;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'debris', x, y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80,
            gravity: 250, drag: 0.3,
            life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
            size: 2 + Math.random() * 4, color: '#9A8B7A'
          });
          this._pushParticle(p);
        }
        break;
      case 'aura':
        // 技能觉醒光环：旋转光环（用多个半透明圆环粒子模拟）
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'aura', x: x + Math.cos(ang) * 30, y: y + Math.sin(ang) * 30,
            vx: 0, vy: 0, gravity: 0, drag: 0,
            life: 0.8, maxLife: 0.8,
            size: 3, color: '#FFD700', angle: ang,
            seed: this.time
          });
          this._pushParticle(p);
        }
        break;
      case 'levelup':
        // 升级金光：金色光柱冲天
        for (let i = 0; i < 16; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'levelup', x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 10,
            vx: (Math.random() - 0.5) * 10, vy: -80 - Math.random() * 60,
            gravity: -20, drag: 0.2,
            life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
            size: 2 + Math.random() * 3, color: '#FFD700'
          });
          this._pushParticle(p);
        }
        break;

      // ---- V6.5 新增粒子效果 ----
      case 'ripple':
        // 水波纹：从中心向外扩散的圆环
        for (let i = 0; i < 3; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'ripple', x: x + i * 8, y: y + i * 4,
            vx: 0, vy: 0, gravity: 0, drag: 0,
            life: 1.0 + i * 0.2, maxLife: 1.0 + i * 0.2,
            size: 5, color: '#6ab0e8', angle: i * 0.5
          });
          this._pushParticle(p);
        }
        break;
      case 'buddhist_glow':
        // 佛光：金色温暖光芒，缓慢上升扩散
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'buddhist_glow', x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * 8, vy: -15 - Math.random() * 10,
            gravity: -5, drag: 0.5,
            life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
            size: 3 + Math.random() * 2, color: '#FFD700'
          });
          this._pushParticle(p);
        }
        break;
      case 'daoist_qi':
        // 道气：青绿灵气，螺旋上升
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + this.time * 0.5;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'daoist_qi', x: x + Math.cos(ang) * 15, y: y + Math.sin(ang) * 15,
            vx: Math.cos(ang + 0.5) * 12, vy: -20 - Math.random() * 15,
            gravity: -8, drag: 0.3,
            life: 1.0 + Math.random() * 0.5, maxLife: 1.5,
            size: 2.5 + Math.random() * 2, color: '#7AE0C0'
          });
          this._pushParticle(p);
        }
        break;
      case 'culture_gold':
        // 文化繁荣金光：温暖的金色粒子从城市中心上升
        for (let i = 0; i < 14; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'culture_gold', x: x + (Math.random() - 0.5) * 40, y: y + Math.random() * 20,
            vx: (Math.random() - 0.5) * 8, vy: -30 - Math.random() * 25,
            gravity: -10, drag: 0.2,
            life: 1.5 + Math.random() * 0.8, maxLife: 2.3,
            size: 2 + Math.random() * 3, color: '#FFE9A8'
          });
          this._pushParticle(p);
        }
        break;
      case 'critical_hit':
        // 暴击特效：红色冲击 + 金色碎片
        this.particles.push({
          type: 'impact', x, y, vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 0.4, maxLife: 0.4, size: 10, color: '#FF4444'
        });
        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 80 + Math.random() * 160;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'spark', x, y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            gravity: 150, drag: 1.0,
            life: 0.35 + Math.random() * 0.25, maxLife: 0.6,
            size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#FF4444' : '#FFD700'
          });
          this._pushParticle(p);
        }
        break;

      // ---- V7.5 新增粒子效果 ----
      case 'accession_gold':
        // 登基金光：金色光柱冲天 + 四散金箔（庄严盛大）
        for (let i = 0; i < 20; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'accession_gold', x: x + (Math.random() - 0.5) * 30, y: y + Math.random() * 15,
            vx: (Math.random() - 0.5) * 15, vy: -100 - Math.random() * 80,
            gravity: -30, drag: 0.15,
            life: 1.5 + Math.random() * 0.8, maxLife: 2.3,
            size: 2.5 + Math.random() * 3.5, color: '#FFD700',
            angle: Math.random() * Math.PI * 2
          });
          this._pushParticle(p);
        }
        // 中心大光柱
        this.particles.push({
          type: 'accession_beam', x, y, vx: 0, vy: -60, gravity: 0, drag: 0,
          life: 1.2, maxLife: 1.2, size: 24, color: '#FFE9A8'
        });
        break;
      case 'trade_coin':
        // 贸易钱币：金币从天而降 + 旋转下落
        for (let i = 0; i < 12; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'trade_coin', x: x + (Math.random() - 0.5) * 50, y: y - 60 - Math.random() * 30,
            vx: (Math.random() - 0.5) * 20, vy: 40 + Math.random() * 40,
            gravity: 60, drag: 0.2,
            life: 1.0 + Math.random() * 0.5, maxLife: 1.5,
            size: 3 + Math.random() * 2, color: '#D4AF37',
            angle: Math.random() * Math.PI * 2, seed: Math.random() * 10
          });
          this._pushParticle(p);
        }
        break;

      // ---- V12.5 新增粒子类型 ----
      case 'enthrone_gold':
        // 登基金箔：金色箔片漫天飘落（不规则形状，旋转下落）
        for (let i = 0; i < 24; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'enthrone_gold',
            x: x + (Math.random() - 0.5) * 120, y: y - 80 - Math.random() * 60,
            vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 30,
            gravity: 40, drag: 0.1,
            life: 2.0 + Math.random() * 1.0, maxLife: 3.0,
            size: 2 + Math.random() * 3,
            color: Math.random() < 0.5 ? '#FFD700' : '#FFE8A0',
            angle: Math.random() * Math.PI * 2, seed: Math.random() * 20
          });
          this._pushParticle(p);
        }
        break;
      case 'cavalry_dust':
        // V12.5 骑兵尘土（增强版）：更浓更宽的马蹄扬尘
        for (let i = 0; i < 14; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'cavalry_dust',
            x: x + (Math.random() - 0.5) * 30, y: y + Math.random() * 10,
            vx: -30 - Math.random() * 50, vy: -15 - Math.random() * 20,
            gravity: 15, drag: 0.6,
            life: 0.7 + Math.random() * 0.5, maxLife: 1.2,
            size: 5 + Math.random() * 7, color: '#9A8B6A'
          });
          this._pushParticle(p);
        }
        break;
      case 'victory_glow':
        // V12.5 胜利金光：从中心爆发的金色光芒
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2;
          const sp = 40 + Math.random() * 60;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'victory_glow', x, y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            gravity: 0, drag: 0.5,
            life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
            size: 3 + Math.random() * 3, color: '#FFD700'
          });
          this._pushParticle(p);
        }
        break;

      // ---- V13.0 新增粒子类型 ----
      case 'fire_trail':
        // 火焰拖尾：橙色渐变火球向上飘散并渐隐（用于技能尾迹/武器回火）
        for (let i = 0; i < 10; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'fire_trail',
            x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 14, vy: -40 - Math.random() * 30,
            gravity: -25, drag: 0.7,
            life: 0.45 + Math.random() * 0.35, maxLife: 0.8,
            size: 2.5 + Math.random() * 3.5,
            color: Math.random() < 0.5 ? '#ff7a2a' : '#ffc240'
          });
          this._pushParticle(p);
        }
        break;
      case 'water_ripple':
        // 水波扩散：从中心向外扩散的圆环，透明度随扩散衰减（可多层叠加）
        for (let i = 0; i < 3; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'water_ripple',
            x: x + i * 6, y: y + i * 3,
            vx: 0, vy: 0, gravity: 0, drag: 0,
            life: 0.9 + i * 0.25, maxLife: 0.9 + i * 0.25,
            size: 4, color: '#5aa8e0', angle: i * 0.4
          });
          this._pushParticle(p);
        }
        break;
      case 'rune_glow':
        // 符文光晕：旋转光环粒子 + 环绕光点（谋略/觉醒类技能）
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'rune_glow',
            x: x + Math.cos(ang) * 10, y: y + Math.sin(ang) * 10,
            vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6,
            gravity: 0, drag: 0.2,
            life: 0.9 + Math.random() * 0.4, maxLife: 1.3,
            size: 2.5 + Math.random() * 2,
            color: Math.random() < 0.5 ? '#b080ff' : '#e0c0ff',
            angle: ang, seed: this.time
          });
          this._pushParticle(p);
        }
        break;
      case 'leaf_fall':
        // 落叶飘落：旋转下落 + 左右摇摆（秋季森林氛围/战败萧瑟）
        for (let i = 0; i < 8; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'leaf_fall',
            x: x + (Math.random() - 0.5) * 60, y: y - Math.random() * 20,
            vx: (Math.random() - 0.5) * 20, vy: 18 + Math.random() * 14,
            gravity: 12, drag: 0.15,
            life: 3.5 + Math.random() * 2, maxLife: 5.5,
            size: 2.5 + Math.random() * 2.5,
            color: Math.random() < 0.5 ? '#b8862a' : '#8a5a2a',
            angle: Math.random() * Math.PI * 2, seed: Math.random() * 10
          });
          this._pushParticle(p);
        }
        break;
      case 'spark_burst':
        // 火花爆发：金色小粒子四散 + 重力下落（武器碰撞/命中迸溅）
        for (let i = 0; i < 14; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 140;
          const p = this._getParticle();
          Object.assign(p, {
            type: 'spark_burst', x, y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
            gravity: 180, drag: 0.8,
            life: 0.35 + Math.random() * 0.3, maxLife: 0.65,
            size: 1.5 + Math.random() * 2, color: '#FFD700'
          });
          this._pushParticle(p);
        }
        break;
      case 'battle_dust':
        // 战斗尘土：棕色大粒子缓慢扩散（行军/马蹄/盾墙推进）
        for (let i = 0; i < 8; i++) {
          const p = this._getParticle();
          Object.assign(p, {
            type: 'battle_dust',
            x: x + (Math.random() - 0.5) * 24, y: y + Math.random() * 6,
            vx: (Math.random() - 0.5) * 24, vy: -8 - Math.random() * 12,
            gravity: 12, drag: 0.5,
            life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
            size: 5 + Math.random() * 6, color: '#8B7355'
          });
          this._pushParticle(p);
        }
        break;

      default:
        this.particles.push({ type, x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff' });
    }
  }

  // ============================================================
  // V9.0 — 军团会战特效序列（列阵→交锋→决战→追击）
  // 在主 canvas 上喷发四阶段粒子，模拟军团冲锋与交锋。
  // cx/cy: 战场中心；w/h: 画布尺寸
  // ============================================================
  playLegionBattleFX(cx, cy, w, h) {
    if (!cx) { cx = (w || 800) / 2; cy = (h || 500) / 2; }
    // 阶段1 列阵：两侧军旗肃立，烟尘
    for (let i = 0; i < 30; i++) {
      this._spawnSmoke(cx - w * 0.25 + (Math.random() - 0.5) * w * 0.2, cy + (Math.random()-0.5)*h*0.3);
      this._spawnSmoke(cx + w * 0.25 + (Math.random() - 0.5) * w * 0.2, cy + (Math.random()-0.5)*h*0.3);
    }
    // 阶段2 交锋：骑兵冲锋火星
    for (let i = 0; i < 24; i++) {
      this._spawnCharge(cx - w*0.2, cy, 1);
      this._spawnCharge(cx + w*0.2, cy, -1);
    }
    // 阶段3 决战：密集冲击火花
    for (let i = 0; i < 40; i++) {
      this._spawnImpact(cx + (Math.random()-0.5)*w*0.3, cy + (Math.random()-0.5)*h*0.25);
    }
    // 阶段4 追击：溃败烟尘
    for (let i = 0; i < 20; i++) {
      this._spawnSmoke(cx + (Math.random()-0.5)*w*0.4, cy + (Math.random()-0.5)*h*0.3);
    }
  }
  _spawnSmoke(x, y) {
    const p = this._getParticle();
    Object.assign(p, { type: 'fire', x, y, vx: (Math.random()-0.5)*15, vy: -10 - Math.random()*15,
      life: 1.4, maxLife: 1.4, size: 12 + Math.random()*10, color: 'rgba(120,110,100,0.5)' });
    this._pushParticle(p);
  }
  _spawnCharge(x, y, dir) {
    const p = this._getParticle();
    Object.assign(p, { type: 'fire', x, y, vx: dir * (120 + Math.random()*80), vy: (Math.random()-0.5)*30,
      life: 0.6, maxLife: 0.6, size: 4 + Math.random()*3, color: '#ffaa44' });
    this._pushParticle(p);
  }
  _spawnImpact(x, y) {
    const p = this._getParticle();
    Object.assign(p, { type: 'impact', x, y, vx: 0, vy: 0,
      life: 0.7, maxLife: 0.7, size: 6, color: '#ffe680' });
    this._pushParticle(p);
  }

  // 在 ctx 上绘制全部存活粒子
  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife); // 1 -> 0
      this.drawParticle(ctx, p.x, p.y, p.type, t, p);
    }
  }

  // 绘制单个粒子（t: 1 新生 ~ 0 消亡）
  drawParticle(ctx, x, y, type, t, extra = {}) {
    ctx.save();
    switch (type) {
      case 'fire': {
        ctx.globalAlpha = t;
        const r = extra.size * (0.5 + t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, extra.color || '#ffcc33');
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'heal': {
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#66ff88';
        ctx.shadowColor = '#66ff88';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, extra.size * t, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'impact': {
        // 扩散圆环
        const prog = 1 - t;
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#ffe680';
        ctx.lineWidth = 3 * t + 1;
        ctx.beginPath(); ctx.arc(x, y, extra.size + prog * 55, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,180,' + (t * 0.5) + ')';
        ctx.beginPath(); ctx.arc(x, y, extra.size * (1 + prog * 2), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'spark': {
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#ffdd66';
        ctx.lineWidth = extra.size;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - extra.vx * 0.02, y - extra.vy * 0.02); ctx.stroke();
        break;
      }
      case 'slash': {
        // 白色弧形斩击轨迹，沿角度 sweep，渐隐
        const prog = 1 - t;
        ctx.globalAlpha = t;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 6 * t + 2;
        ctx.lineCap = 'round';
        const startA = extra.angle || -Math.PI / 3;
        ctx.beginPath();
        ctx.arc(x, y, extra.size, startA, startA + Math.PI * 0.8 * prog);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 10 * t;
        ctx.beginPath();
        ctx.arc(x, y, extra.size + 4, startA, startA + Math.PI * 0.8 * prog);
        ctx.stroke();
        break;
      }
      case 'lightning': {
        // 锯齿折线
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#bfeaff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#66bbff'; ctx.shadowBlur = 10;
        ctx.beginPath();
        let lx = x, ly = y;
        ctx.moveTo(lx, ly);
        const seg = 5;
        for (let i = 0; i < seg; i++) {
          lx += (Math.sin(extra.seed + i * 1.7) * 10) + 6;
          ly += (Math.cos(extra.seed + i * 2.3) * 12) - 4;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        break;
      }
      // ---- V3.5 新粒子绘制 ----
      case 'dust': {
        ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = extra.color || '#8B7355';
        ctx.beginPath(); ctx.arc(x, y, extra.size * (1 + (1-t)), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'arrow': {
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#D4C49A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - extra.vx * 0.02, y - extra.vy * 0.02);
        ctx.stroke();
        break;
      }
      case 'debris': {
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#9A8B7A';
        ctx.beginPath();
        ctx.rect(x - extra.size/2, y - extra.size/2, extra.size, extra.size);
        ctx.fill();
        break;
      }
      case 'aura': {
        // 旋转光环粒子
        const ang = (extra.angle || 0) + (extra.seed || 0) * 2;
        const r = 30 * (1 + (1 - t) * 0.5);
        ctx.globalAlpha = t * 0.7;
        ctx.fillStyle = extra.color || '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, extra.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'levelup': {
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, extra.size, 0, Math.PI * 2); ctx.fill();
        break;
      }
      // ---- V6.5 新增粒子绘制 ----
      case 'ripple': {
        // 水波纹：扩散圆环
        const prog = 1 - t;
        ctx.globalAlpha = t * 0.6;
        ctx.strokeStyle = extra.color || '#6ab0e8';
        ctx.lineWidth = 2 * t + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, extra.size + prog * 50, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'buddhist_glow': {
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = extra.color || '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y, extra.size * (0.5 + t), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'daoist_qi': {
        ctx.globalAlpha = t * 0.7;
        ctx.fillStyle = extra.color || '#7AE0C0';
        ctx.shadowColor = '#7AE0C0'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.ellipse(x, y, extra.size * 0.7, extra.size * 1.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'culture_gold': {
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#FFE9A8';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, extra.size, 0, Math.PI * 2); ctx.fill();
        break;
      }
      // ---- V7.5 新粒子绘制 ----
      case 'accession_gold': {
        // 金箔：旋转小菱形 + 光晕
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(extra.angle || 0);
        const s = extra.size * (0.6 + t * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'accession_beam': {
        // 登极大光柱：垂直金色光柱
        ctx.globalAlpha = t * 0.7;
        const g = ctx.createLinearGradient(x, y - 80, x, y);
        g.addColorStop(0, 'rgba(255,233,168,0)');
        g.addColorStop(1, 'rgba(255,215,0,0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(x - extra.size / 2, y - 80, extra.size, 80);
        break;
      }
      case 'trade_coin': {
        // 金币：圆形 + 方孔（古钱样式），随下落旋转
        const spin = (extra.seed || 0) + this.time * 6;
        const squash = Math.abs(Math.sin(spin)); // 模拟旋转时的椭圆变形
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#D4AF37';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(squash * 0.7 + 0.3, 1);
        ctx.beginPath(); ctx.arc(0, 0, extra.size, 0, Math.PI * 2); ctx.fill();
        // 方孔
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-extra.size * 0.3, -extra.size * 0.3, extra.size * 0.6, extra.size * 0.6);
        ctx.restore();
        break;
      }
      // ---- V8.1 新粒子绘制 ----
      case 'hitflash': {
        // 受击闪白：白色覆盖层，alpha 0.6 → 0 渐隐
        ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, extra.size * (1 + (1 - t)), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'speedline': {
        // 冲锋速度线：横向半透明白线
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = extra.color || 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + extra.size, y);
        ctx.stroke();
        break;
      }
      case 'arrow_trail': {
        // 箭矢弹道尾迹：金色小线段
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#fff6c8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - extra.vx * 0.02, y - extra.vy * 0.02);
        ctx.stroke();
        break;
      }
      case 'slash_arc': {
        // 金色弧形斩击轨迹
        const prog = 1 - t;
        ctx.globalAlpha = t;
        ctx.strokeStyle = 'rgba(255,233,168,0.95)';
        ctx.lineWidth = 5 * t + 2;
        ctx.lineCap = 'round';
        const startA = extra.angle || -Math.PI / 4;
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, extra.size, startA, startA + Math.PI * 0.9 * prog);
        ctx.stroke();
        break;
      }
      case 'element_fire': {
        // 火系：橙红爆裂火球
        ctx.globalAlpha = t;
        const r = extra.size * (0.5 + t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, extra.color || '#ffaa22');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'element_water': {
        // 水系：蓝色水珠
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#6ab0e8';
        ctx.shadowColor = '#6ab0e8'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.ellipse(x, y, extra.size * 0.7, extra.size, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'element_wind': {
        // 风系：青色旋风光点沿切向散开
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = extra.color || '#8fe8d8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#8fe8d8'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y, extra.size + (1 - t) * 14, extra.angle || 0, (extra.angle || 0) + Math.PI * 0.6);
        ctx.stroke();
        break;
      }
      case 'leaf': {
        // 树叶：旋转绿/黄椭圆下落
        const spin = (extra.seed || 0) + this.time * 3;
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#4a7c3a';
        ctx.save();
        ctx.translate(x, y); ctx.rotate(spin);
        ctx.beginPath(); ctx.ellipse(0, 0, extra.size, extra.size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'mist': {
        // 水雾：白色半透明柔球上升
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = extra.color || '#e8f0f5';
        ctx.beginPath(); ctx.arc(x, y, extra.size * (1 + (1 - t)), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'sand': {
        // 飞沙：黄褐横向短线
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = extra.color || '#c2a060';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - extra.vx * 0.03, y);
        ctx.stroke();
        break;
      }
      case 'snow': {
        // 飘雪：白色圆点，缓慢摇摆下落
        const sway = Math.sin(this.time * 2 + (extra.seed || 0)) * 4;
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#ffffff';
        ctx.beginPath(); ctx.arc(x + sway, y, extra.size, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'firefly': {
        // 萤火：暗绿缓慢漂浮光点（脉动）
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + (extra.seed || 0));
        ctx.globalAlpha = t * (0.4 + 0.5 * pulse);
        ctx.fillStyle = extra.color || '#7aff8a';
        ctx.shadowColor = '#7aff8a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, extra.size * (0.6 + 0.4 * pulse), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'victory_gold': {
        // 胜利金箔：旋转小菱形
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(extra.angle || 0);
        const s = extra.size * (0.6 + t * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'defeat_ash': {
        // 失败余烬：灰色渐隐点
        ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = extra.color || '#888888';
        ctx.beginPath(); ctx.arc(x, y, extra.size, 0, Math.PI * 2); ctx.fill();
        break;
      }
      // ---- V13.0 新粒子绘制 ----
      case 'fire_trail': {
        // 火焰拖尾：橙色径向渐变火球，向上飘散随生命衰减
        ctx.globalAlpha = t;
        const r = extra.size * (0.6 + t * 0.6);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, extra.color || '#ffc240');
        g.addColorStop(0.6, 'rgba(255,120,30,0.6)');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'water_ripple': {
        // 水波扩散：圆环向外扩散 + 透明度衰减
        const prog = 1 - t; // 0→1 扩散进度
        ctx.globalAlpha = t * 0.65;
        ctx.strokeStyle = extra.color || '#5aa8e0';
        ctx.lineWidth = 2 * t + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, extra.size + prog * 46, 0, Math.PI * 2);
        ctx.stroke();
        // 内层淡蓝填充
        ctx.globalAlpha = t * 0.15;
        ctx.fillStyle = extra.color || '#5aa8e0';
        ctx.beginPath();
        ctx.arc(x, y, (extra.size + prog * 46) * 0.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rune_glow': {
        // 符文光晕：旋转光环上的紫色光点（环绕缓慢旋转）
        const ang = (extra.angle || 0) + (extra.seed || 0) * 1.5;
        const r = 10 + (1 - t) * 18;
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#e0c0ff';
        ctx.shadowColor = '#b080ff'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, extra.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'leaf_fall': {
        // 落叶飘落：旋转椭圆 + 左右正弦摇摆
        const swing = Math.sin(this.time * 2.2 + (extra.seed || 0)) * 5;
        const spin = (extra.seed || 0) + this.time * 3.2;
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#b8862a';
        ctx.save();
        ctx.translate(x + swing, y);
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, extra.size, extra.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'spark_burst': {
        // 火花爆发：金色短线（沿速度方向），带重力下落
        ctx.globalAlpha = t;
        ctx.strokeStyle = extra.color || '#FFD700';
        ctx.lineWidth = extra.size;
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - extra.vx * 0.03, y - extra.vy * 0.03);
        ctx.stroke();
        break;
      }
      case 'battle_dust': {
        // 战斗尘土：棕色大颗粒，缓慢扩散变大并渐隐
        ctx.globalAlpha = t * 0.55;
        ctx.fillStyle = extra.color || '#8B7355';
        ctx.beginPath();
        ctx.arc(x, y, extra.size * (1 + (1 - t) * 1.2), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // ---- V17.0 战斗动画深化粒子绘制 ----
      case 'form_soldier': {
        // 阵型切换中的士兵小方块（金色甲士）
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#d8c890';
        ctx.fillRect(x - extra.size / 2, y - extra.size / 2, extra.size, extra.size);
        break;
      }
      case 'rout_soldier': {
        // 士气崩溃：四散逃跑士兵（小棕点，越跑越淡）
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = extra.color || '#7a6a5a';
        ctx.beginPath();
        ctx.ellipse(x, y, extra.size, extra.size * 1.3, Math.atan2(extra.vy, extra.vx), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'volley_trail': {
        // 齐射弹道尾迹：金色小线段（沿角度）
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = extra.color || '#e8d8a0';
        ctx.lineWidth = 1.5;
        const a = extra.angle || 0;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
        ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        ctx.stroke();
        break;
      }
      case 'shield': {
        // 盾墙盾牌：灰蓝小矩形（竖直盾牌），随生命升起
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#7a8a9a';
        ctx.strokeStyle = '#c0c8d0';
        ctx.lineWidth = 0.8;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(extra.angle || 0);
        ctx.fillRect(-extra.size / 2, -extra.size, extra.size, extra.size * 1.4);
        ctx.strokeRect(-extra.size / 2, -extra.size, extra.size, extra.size * 1.4);
        ctx.restore();
        break;
      }
      case 'splash': {
        // 水花：蓝色小水滴
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#6ab0e8';
        ctx.beginPath();
        ctx.ellipse(x, y, extra.size * 0.7, extra.size, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'footprint': {
        // 雪地脚印：白色椭圆渐隐
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = extra.color || '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, extra.size, extra.size * 0.6, (extra.seed || 0) * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // ---- V20.0 灾害粒子绘制 ----
      case 'quake_debris': {
        // 地震碎石：旋转小方块
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#6a5a48';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((extra.seed || 0) + this.time * 8);
        ctx.fillRect(-extra.size / 2, -extra.size / 2, extra.size, extra.size);
        ctx.restore();
        break;
      }
      case 'flood_float': {
        // 洪水漂浮物：小木板（棕色椭圆，随波起伏）
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = extra.color || '#7a5a3a';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(this.time * 2 + (extra.seed || 0)) * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, extra.size * 1.4, extra.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'drought_wither': {
        // 干旱枯黄：小枯草叶（黄褐色，旋转下落）
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#b89a4a';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((extra.seed || 0) + this.time * 3);
        ctx.beginPath();
        ctx.moveTo(0, -extra.size);
        ctx.quadraticCurveTo(extra.size * 0.5, 0, 0, extra.size);
        ctx.quadraticCurveTo(-extra.size * 0.5, 0, 0, -extra.size);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'plague_mist': {
        // 瘟疫毒雾：绿色半透明团
        ctx.globalAlpha = t * 0.7;
        ctx.fillStyle = extra.color || 'rgba(90,200,90,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, extra.size * (1.2 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'plague_sick': {
        // 病弱士兵：绿色踉跄小人
        ctx.globalAlpha = t * 0.85;
        ctx.fillStyle = extra.color || '#6aaa5a';
        ctx.save();
        ctx.translate(x, y);
        // 踉跄左右摇晃
        ctx.rotate(Math.sin(this.time * 3 + (extra.seed || 0)) * 0.25);
        // 头
        ctx.beginPath(); ctx.arc(0, -extra.size * 1.6, extra.size * 0.5, 0, Math.PI * 2); ctx.fill();
        // 身体（佝偻）
        ctx.beginPath();
        ctx.moveTo(-extra.size * 0.6, -extra.size);
        ctx.quadraticCurveTo(0, extra.size * 0.2, extra.size * 0.6, -extra.size * 0.6);
        ctx.lineTo(extra.size * 0.6, extra.size);
        ctx.lineTo(-extra.size * 0.6, extra.size);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'locust_bug': {
        // 蝗虫：深色小飞虫（双翅震动）
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#5a4a2a';
        const wing = Math.sin(this.time * 40 + (extra.seed || 0)) * 0.6 + 0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(extra.vx > 0 ? 0 : Math.PI);
        // 身体
        ctx.beginPath(); ctx.ellipse(0, 0, extra.size, extra.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        // 翅膀（震动）
        ctx.fillStyle = 'rgba(180,160,100,0.7)';
        ctx.beginPath();
        ctx.ellipse(-extra.size * 0.2, -extra.size * 0.4 * wing, extra.size * 0.7, extra.size * 0.5 * wing, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'snowstorm_fog': {
        // 暴风雪冰雾：淡青白弥漫
        ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = extra.color || 'rgba(220,240,255,0.35)';
        ctx.beginPath();
        ctx.arc(x, y, extra.size * (1.3 - t * 0.3), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'snowstorm_flake': {
        // 暴风雪大雪花：白色六角/圆点，摇摆下落
        ctx.globalAlpha = t * 0.95;
        ctx.fillStyle = extra.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(x + Math.sin(this.time * 2 + (extra.seed || 0)) * 3, y, extra.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#fff';
        ctx.beginPath(); ctx.arc(x, y, extra.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ============================================================
  // V8.1：伤害飘字绘制（红色上飘渐隐；暴击金色放大+「暴击!」标签）
  // ============================================================
  drawDamageNumbers(ctx) {
    for (const dn of this.damageNumbers) {
      const t = Math.max(0, dn.life / dn.maxLife); // 1→0
      ctx.save();
      ctx.globalAlpha = t;
      if (dn.isCrit) {
        // 暴击：金色大字 + 描边
        ctx.font = 'bold 22px "STSong", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#7a4a00';
        ctx.strokeText(dn.text, dn.x, dn.y);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(dn.text, dn.x, dn.y);
        // 「暴击!」小标签
        ctx.font = 'bold 12px "STSong", serif';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#7a4a00';
        ctx.strokeText('暴击!', dn.x, dn.y - 22);
        ctx.fillStyle = '#ffcf40';
        ctx.fillText('暴击!', dn.x, dn.y - 22);
      } else {
        // 普通：红色大字
        ctx.font = 'bold 16px "STSong", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#5a0000';
        ctx.strokeText(dn.text, dn.x, dn.y);
        ctx.fillStyle = '#ff4040';
        ctx.fillText(dn.text, dn.x, dn.y);
      }
      ctx.restore();
    }
  }

  // ============================================================
  // V8.1：暴击特写绘制——径向暗角 vignette + 「暴击!」弹字
  // scale 0→1.5→1，持续 0.4s，金色描边
  // ============================================================
  drawCinematicFX(ctx, w, h) {
    // 径向暗角（暴击进行期间）
    if (this._cinematic.time > 0) {
      const prog = 1 - this._cinematic.time / this._cinematic.duration; // 0→1
      const a = 0.5 * Math.sin(Math.min(1, prog) * Math.PI); // 淡入淡出
      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // 「暴击!」弹字
    if (this._critText.time > 0) {
      const prog = 1 - this._critText.time / this._critText.duration; // 0→1
      // scale 0→1.5→1：前半冲到1.5，后半回落至1
      let sc;
      if (prog < 0.5) sc = (prog / 0.5) * 1.5;
      else sc = 1.5 - ((prog - 0.5) / 0.5) * 0.5;
      const alpha = prog < 0.8 ? 1 : (1 - (prog - 0.8) / 0.2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(w / 2, h / 2);
      ctx.scale(sc, sc);
      ctx.font = 'bold 40px "STSong", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#7a4a00';
      ctx.strokeText('暴击!', 0, 0);
      ctx.fillStyle = '#FFD700';
      ctx.fillText('暴击!', 0, 0);
      ctx.restore();
    }
  }
  // 若 portraitImg 加载失败，绘制古风占位头像（势力色底+首字）
  // ============================================================
  drawIdlePortrait(ctx, x, y, w, h, portraitImg, time, name, factionColor) {
    time = time || this.time;
    ctx.save();
    // 光晕脉动（0.1~0.3，周期 2s）
    const glowAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(time * Math.PI));
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    glow.addColorStop(0, `rgba(255,215,0,${glowAlpha})`);
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - w * 0.2, y - h * 0.2, w * 1.4, h * 1.4);

    // 呼吸缩放（1.0~1.02，周期 3s）
    const breath = 1.0 + 0.02 * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / 3));
    // 底部阴影随呼吸缩放
    ctx.save();
    ctx.translate(x + w / 2, y + h * 0.96);
    ctx.scale(breath, breath);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.36, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 立绘本体：整体呼吸 + 上半头部轻微左右摆（±1px，周期4s）
    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(breath, breath);
    // 头部摆动（仅上半区，用 clip 近似：整体微摆 ±1px）
    const swayX = Math.sin(time * Math.PI * 2 / 4) * 1;
    ctx.translate(swayX, 0);

    if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
      // 图片填充（cover）
      ctx.drawImage(portraitImg, -w / 2, -h, w, h);
    } else {
      // 古风占位：势力色底圆 + 武将名首字
      const c = factionColor || '#8B7A4A';
      const grad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
      grad.addColorStop(0, c);
      grad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = grad;
      // 圆形头像底
      ctx.beginPath();
      ctx.arc(0, -h * 0.5, Math.min(w, h) * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#C4A55A';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 首字
      ctx.fillStyle = '#FFE9A8';
      ctx.font = `bold ${Math.round(Math.min(w, h) * 0.45)}px "STSong", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ch = (name || '将').charAt(0);
      ctx.fillText(ch, 0, -h * 0.5);
    }
    ctx.restore();
    ctx.restore();
  }

  // ============================================================
  // 战斗中的角色精灵（Canvas 几何图形程序化绘制，非静态图）
  // 角色以脚为原点 (0,0)，朝右；调用方可 ctx.scale(-1,1) 翻转
  // action: idle | charge | slash | shoot | skill | hurt | victory | defeat
  // unitType: infantry | cavalry | archer
  // ============================================================
  drawBattleCharacter(ctx, x, y, factionColor, action, frame, unitType) {
    frame = frame || 0;
    ctx.save();
    ctx.translate(x, y);

    const fc = factionColor || '#8B2500';

    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

    // ---- 动作姿态参数 ----
    let bobY = 0;          // 身体浮动
    let lean = 0;          // 身体前倾（弧度）
    let legSwing = 0;      // 腿部摆动
    let weaponAng = -Math.PI / 2.2; // 武器角度（默认斜持）
    let capeWave = Math.sin(frame * 0.3) * 0.08; // 披风摆动
    let flashRed = 0;      // 受击闪红
    let glow = 0;          // 技能发光
    let fallRot = 0;       // 倒地旋转
    let bodyScaleY = 1;

    switch (action) {
      case 'idle':
        bobY = Math.sin(frame * 0.25) * 2;
        capeWave = Math.sin(frame * 0.3) * 0.08;
        break;
      case 'charge':
        bobY = Math.abs(Math.sin(frame * 0.5)) * -3;
        legSwing = Math.sin(frame * 0.5) * 5;
        lean = 0.25;
        capeWave = Math.sin(frame * 0.6) * 0.25;
        weaponAng = -Math.PI / 2; // 武器前指
        break;
      case 'slash': {
        // 3 帧：高举 -> 挥下 -> 收
        const f3 = (frame % 3);
        if (f3 < 1) { weaponAng = -Math.PI * 0.9; lean = -0.1; }
        else if (f3 < 2) { weaponAng = -Math.PI * 0.1; lean = 0.2; }
        else { weaponAng = Math.PI * 0.3; lean = 0.15; }
        break;
      }
      case 'shoot': {
        // 弓臂拉伸：frame 0.5 周期
        const draw = Math.max(0, Math.sin(frame * 0.4));
        lean = 0.05;
        weaponAng = -Math.PI * 0.15;
        break;
      }
      case 'skill':
        glow = 0.5 + 0.5 * Math.sin(frame * 0.8);
        weaponAng = -Math.PI * 1.1; // 高举
        bobY = Math.sin(frame * 0.6) * 2;
        break;
      case 'hurt':
        lean = -0.35;
        flashRed = 1;
        break;
      case 'victory':
        weaponAng = -Math.PI * 1.2; // 高举欢呼
        bobY = Math.abs(Math.sin(frame * 0.4)) * -6;
        break;
      case 'defeat':
        fallRot = Math.min(1, frame * 0.06) * Math.PI / 2; // 旋转倒下
        bodyScaleY = Math.max(0.1, 1 - Math.min(1, frame * 0.05));
        break;
    }

    ctx.save();
    ctx.translate(0, bobY);
    ctx.rotate(lean);
    if (fallRot) ctx.rotate(-fallRot);
    ctx.scale(1, bodyScaleY);

    // 技能光晕
    if (glow > 0) {
      ctx.save();
      const gg = ctx.createRadialGradient(0, -28, 4, 0, -28, 36);
      gg.addColorStop(0, `rgba(255,215,0,${0.5 * glow})`);
      gg.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, -28, 36, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 受击闪红覆盖
    // （在角色绘制后用红色 globalAlpha 叠加）

    // ---- 披风（三角形，在身后）----
    ctx.save();
    ctx.rotate(capeWave);
    ctx.fillStyle = this._darken(fc, 0.55);
    ctx.beginPath();
    ctx.moveTo(-3, -44);
    ctx.lineTo(-14, -18 + capeWave * 10);
    ctx.lineTo(-4, -16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ---- 腿部 ----
    const legLen = 16;
    const legW = 4;
    const leg1X = -3 + legSwing * 0.5;
    const leg2X = 3 - legSwing * 0.5;
    ctx.fillStyle = this._darken(fc, 0.75);
    // 左腿
    ctx.fillRect(leg1X - legW / 2, -legLen, legW, legLen);
    // 右腿
    ctx.fillRect(leg2X - legW / 2, -legLen, legW, legLen);
    // 靴子
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(leg1X - legW / 2 - 1, -3, legW + 2, 4);
    ctx.fillRect(leg2X - legW / 2 - 1, -3, legW + 2, 4);

    // ---- 躯干（梯形）----
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.moveTo(-7, -legLen);       // 左下
    ctx.lineTo(7, -legLen);        // 右下
    ctx.lineTo(5, -42);           // 右上
    ctx.lineTo(-5, -42);          // 左上
    ctx.closePath();
    ctx.fill();
    // 躯干高光边
    ctx.strokeStyle = 'rgba(255,235,180,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ---- 头部 ----
    ctx.fillStyle = '#e8c99a';
    ctx.beginPath();
    ctx.arc(0, -49, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // 头盔/发束（势力色）
    ctx.fillStyle = this._darken(fc, 0.85);
    ctx.beginPath();
    ctx.arc(0, -50, 6.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-6.5, -50, 13, 2.5);

    // ---- 武器/兵种差异 ----
    ctx.save();
    ctx.translate(5, -34); // 手的位置
    ctx.rotate(weaponAng);
    if (unitType === 'archer') {
      // 弓：弧线
      ctx.strokeStyle = '#8a5a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();
      // 弓弦
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      const bowDraw = (action === 'shoot') ? Math.max(0, Math.sin(frame * 0.4)) * 3 : 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-Math.PI / 2.5) * 12 + bowDraw, Math.sin(-Math.PI / 2.5) * 12);
      ctx.lineTo(Math.cos(Math.PI / 2.5) * 12 + bowDraw, Math.sin(Math.PI / 2.5) * 12);
      ctx.stroke();
    } else if (unitType === 'cavalry') {
      // 长槊
      ctx.strokeStyle = '#c0a060';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
      // 槊尖
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(0, -30); ctx.lineTo(-2.5, -25); ctx.lineTo(2.5, -25);
      ctx.closePath(); ctx.fill();
    } else {
      // 步兵：长矛
      ctx.strokeStyle = '#a07840';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke();
      // 矛尖
      ctx.fillStyle = '#d8d8d8';
      ctx.beginPath();
      ctx.moveTo(0, -28); ctx.lineTo(-2, -23); ctx.lineTo(2, -23);
      ctx.closePath(); ctx.fill();
      // 盾牌（左手）
      ctx.fillStyle = this._darken(fc, 0.6);
      ctx.beginPath();
      ctx.ellipse(-9, -32, 4.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#C4A55A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // ---- 骑兵附加：马身 ----
    if (unitType === 'cavalry') {
      ctx.save();
      ctx.translate(0, -8);
      ctx.fillStyle = this._darken(fc, 0.7);
      // 马身椭圆
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // 马颈马头
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(18, -10);
      ctx.lineTo(20, -4);
      ctx.lineTo(14, 0);
      ctx.closePath();
      ctx.fill();
      // 马腿（随跑动摆动）
      const mLeg = Math.sin(frame * 0.5) * 3;
      ctx.strokeStyle = this._darken(fc, 0.6);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, 4); ctx.lineTo(-8 + mLeg, 12);
      ctx.moveTo(8, 4); ctx.lineTo(8 - mLeg, 12);
      ctx.stroke();
      ctx.restore();
      // 把骑手脚提到马上
      // （上方已画人，这里简单叠加即可）
    }

    // 受击红闪
    if (flashRed > 0) {
      ctx.globalAlpha = 0.4 * flashRed;
      ctx.fillStyle = '#ff3030';
      ctx.beginPath();
      ctx.ellipse(0, -25, 14, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.restore();
  }

  // ============================================================
  // V13.0：武将待机动画深化
  // updateIdle(timestamp, ctx, x, y, generalData)
  //   - timestamp: 可选时间戳（缺省用内置 _idleClock）
  //   - x,y: 脚底原点；generalData: { weaponType:'blade'|'spear'|'sword',
  //     hasCape:bool, factionColor, name }
  //   绘制：呼吸起伏 + 肩部微动 + 头部摆动 + 眨眼 + 武器微动 + 披风飘动
  //   叠加当前待机状态机姿态（idle/idle_combat/idle_victory/idle_defeat）
  // ============================================================
  updateIdle(timestamp, ctx, x, y, generalData) {
    if (!ctx) return;
    const t = (typeof timestamp === 'number' && !isNaN(timestamp))
      ? timestamp : this._idleClock;
    const g = generalData || {};
    const fc = g.factionColor || '#8B2500';
    const weaponType = g.weaponType || 'blade'; // blade刀 / spear枪 / sword剑
    const hasCape = !!g.hasCape;
    const st = this._idleState;

    ctx.save();
    ctx.translate(x, y);

    // ---- 状态机姿态参数 ----
    let lean = 0;            // 身体前倾/后仰弧度
    let headUp = 0;          // 抬头/低头（像素偏移）
    let weaponBase = -Math.PI / 2.4; // 武器基础持角
    if (st === 'idle_combat')      { lean = 0.12; weaponBase = -Math.PI / 2.6; headUp = -1; }
    else if (st === 'idle_victory'){ lean = -0.05; headUp = -4; weaponBase = -Math.PI * 1.15; }
    else if (st === 'idle_defeat') { lean = 0.18; headUp = 5; weaponBase = Math.PI * 0.15; }

    // ---- 呼吸：身体上下起伏（周期 3s）----
    const breath = Math.sin(t * Math.PI * 2 / 3);
    const bobY = breath * 1.6;
    // 肩部微动（与呼吸同相，幅度略小）
    const shoulderBob = breath * 0.8;
    // 头部轻微摆动（周期 4.5s，幅度 ±0.6px）
    const headSway = Math.sin(t * Math.PI * 2 / 4.5) * 0.6;

    // 地面阴影（随呼吸轻微缩放）
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 10 + breath * 0.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, bobY);
    ctx.rotate(lean);

    // ---- 披风/衣摆飘动（0.8Hz 正弦波动，幅度 3~5px）----
    if (hasCape) {
      const capeWave = Math.sin(t * 0.8 * Math.PI * 2) * 4; // 0.8Hz, 幅度4px
      ctx.save();
      ctx.translate(-2, -40 + shoulderBob);
      ctx.rotate(capeWave * 0.02);
      ctx.fillStyle = this._darken(fc, 0.5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8 + capeWave, -6);
      ctx.lineTo(-4 + capeWave * 0.6, -20);
      ctx.lineTo(2, -18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ---- 腿部（站立，随呼吸轻微张力）----
    ctx.fillStyle = this._darken(fc, 0.72);
    ctx.fillRect(-3.5, -14, 3.5, 14);
    ctx.fillRect(0, -14, 3.5, 14);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(-4, -3, 4.5, 3);
    ctx.fillRect(-0.5, -3, 4.5, 3);

    // ---- 躯干（梯形）----
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.moveTo(-5.5, -14);
    ctx.lineTo(5.5, -14);
    ctx.lineTo(4, -34 + shoulderBob * 0.5);
    ctx.lineTo(-4, -34 + shoulderBob * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,180,0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ---- 头部（含头部摆动 + 眨眼）----
    ctx.save();
    ctx.translate(headSway, -40 + headUp + shoulderBob * 0.3);
    // 脸
    ctx.fillStyle = '#e8c99a';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    // 头盔/发束
    ctx.fillStyle = this._darken(fc, 0.85);
    ctx.beginPath(); ctx.arc(0, -0.5, 5, Math.PI, 0); ctx.fill();
    ctx.fillRect(-5, -0.5, 10, 2);
    // 眨眼：闭合度 0=睁眼 1=闭眼
    const close = this._blinkClose();
    if (close < 0.5) {
      // 睁眼：两个小瞳孔
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-1.8, 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1.8, 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
    } else {
      // 闭眼/半闭：画两条弧线
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-2.6, 0.5); ctx.lineTo(-1, 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, 0.5); ctx.lineTo(2.6, 0.5); ctx.stroke();
    }
    ctx.restore();

    // ---- 武器微动（刀/枪/剑不同摆动模式）----
    // 刀：低频大摆（随呼吸晃）；枪：高频小颤；剑：中频微颤
    let weaponSway = 0;
    if (weaponType === 'spear')      weaponSway = Math.sin(t * 3.2) * 0.03;
    else if (weaponType === 'sword') weaponSway = Math.sin(t * 2.1) * 0.04;
    else                             weaponSway = Math.sin(t * 1.3) * 0.05; // 刀
    ctx.save();
    ctx.translate(4, -28 + shoulderBob * 0.6);
    ctx.rotate(weaponBase + weaponSway);
    if (weaponType === 'spear') {
      // 长枪：长杆 + 枪缨
      ctx.strokeStyle = '#a07840'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
      ctx.fillStyle = '#d8d8d8';
      ctx.beginPath(); ctx.moveTo(0, -29); ctx.lineTo(-1.6, -24); ctx.lineTo(1.6, -24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c03030'; // 枪缨
      ctx.fillRect(-1.5, -23, 3, 3);
    } else if (weaponType === 'sword') {
      // 剑：直刃 + 护手
      ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke();
      ctx.strokeStyle = '#C4A55A'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(3, -2); ctx.stroke();
    } else {
      // 刀：弧形刀身
      ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2, -10, 0, -20);
      ctx.stroke();
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 3); ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }

  // ============================================================
  // V13.0：移动/行军动画
  // playMoveAnim(ctx, x, y, direction, progress, unitType)
  //   - direction: 1=向右 -1=向左
  //   - progress: 步频相位（0~1 循环），步频 2Hz 由调用方按时间推进
  //   - unitType: 'infantry'|'cavalry'|'archer'|'navy'
  //   绘制：腿部交替摆动（相位差 π）+ 旗帜飘动；
  //   副作用：脚下低频生成尘土粒子，水军生成水面波纹
  // ============================================================
  playMoveAnim(ctx, x, y, direction = 1, progress = 0, unitType = 'infantry') {
    if (!ctx) return;
    const dir = direction >= 0 ? 1 : -1;
    // 步频 2Hz：progress 每 0.5s 一个周期；两腿相位差 π
    const phase = progress * Math.PI * 2;
    const legSwing = Math.sin(phase) * 4;
    const bobY = Math.abs(Math.cos(phase)) * -1.5; // 跑动起伏

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1); // 朝右绘制，按方向翻转

    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 1, 9, 2.4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, bobY);

    // ---- 腿部交替摆动（相位差 π）----
    const leg1 = legSwing;
    const leg2 = -legSwing;
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(-3 + leg1 * 0.4, -12, 3, 12);
    ctx.fillRect(0 - leg2 * 0.4, -12, 3, 12);
    // 靴子
    ctx.fillStyle = '#201810';
    ctx.fillRect(-3.5 + leg1 * 0.4, -2.5, 4, 2.5);
    ctx.fillRect(-0.5 - leg2 * 0.4, -2.5, 4, 2.5);

    // ---- 躯干 ----
    ctx.fillStyle = '#6a5a4a';
    ctx.beginPath();
    ctx.moveTo(-5, -12); ctx.lineTo(5, -12);
    ctx.lineTo(3.5, -28); ctx.lineTo(-3.5, -28);
    ctx.closePath(); ctx.fill();

    // ---- 头部 ----
    ctx.fillStyle = '#e8c99a';
    ctx.beginPath(); ctx.arc(0, -33, 4.5, 0, Math.PI * 2); ctx.fill();

    // ---- 兵种差异：武器随跑动前指 ----
    ctx.strokeStyle = '#a07840'; ctx.lineWidth = 1.6;
    if (unitType === 'archer') {
      // 弓兵：背弓跑动
      ctx.beginPath(); ctx.arc(3, -24, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    } else if (unitType === 'cavalry') {
      // 骑兵：长槊前指
      ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(16, -30); ctx.stroke();
    } else {
      // 步兵/水军：长矛前指
      ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(14, -28); ctx.stroke();
    }

    // ---- 头顶势力旗帜飘动（正弦波 + 随机扰动）----
    const t = this._idleClock;
    const flagWave = Math.sin(t * 6) * 1.5 + Math.sin(t * 13.7) * 0.6;
    ctx.strokeStyle = '#C4A55A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -46); ctx.stroke();
    ctx.fillStyle = '#c03030';
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(7 + flagWave, -44.5);
    ctx.lineTo(0, -43);
    ctx.closePath(); ctx.fill();

    ctx.restore();

    // ---- 副作用：行军尘土（低频生成，约每 0.25s 一粒）----
    if (this.time - this._lastMoveDustEmit > 0.25) {
      this._lastMoveDustEmit = this.time;
      this.spawnParticle(x - dir * 4, y, 'battle_dust');
      // 水军：水面扩散波纹
      if (unitType === 'navy') this.spawnParticle(x, y, 'water_ripple');
    }
  }

  // ============================================================
  // V13.0：武将技特效
  // playSkillAnim(skillType, ctx, x, y, targetX, targetY)
  //   skillType: 'assault'突击 | 'fire'火攻 | 'water'水攻 | 'strategy'谋略 | 'heal'治疗
  //   直接在 ctx 上绘制一次性轨迹/光环，并生成持续粒子
  // ============================================================
  playSkillAnim(skillType, ctx, x, y, targetX = x, targetY = y) {
    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    switch (skillType) {
      case 'assault': {
        // 突击：冲锋轨迹线 + 速度线 + 终点爆发火花
        if (ctx) {
          ctx.save();
          // 冲锋轨迹（虚线箭头）
          ctx.strokeStyle = 'rgba(255,240,180,0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(targetX, targetY); ctx.stroke();
          ctx.setLineDash([]);
          // 箭头
          ctx.fillStyle = 'rgba(255,240,180,0.9)';
          ctx.beginPath();
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(targetX - Math.cos(ang - 0.4) * 10, targetY - Math.sin(ang - 0.4) * 10);
          ctx.lineTo(targetX - Math.cos(ang + 0.4) * 10, targetY - Math.sin(ang + 0.4) * 10);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // 速度线粒子
        for (let i = 0; i < 5; i++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'speedline',
            x: x + (Math.random() - 0.5) * 10, y: y - Math.random() * 20,
            vx: Math.cos(ang) * (200 + Math.random() * 120), vy: Math.sin(ang) * 40,
            gravity: 0, drag: 0, life: 0.2, maxLife: 0.2,
            size: 16, color: 'rgba(255,255,255,0.7)' });
          this._pushParticle(s);
        }
        // 终点爆发
        this.spawnParticle(targetX, targetY, 'spark_burst');
        this.spawnParticle(targetX, targetY, 'impact');
        break;
      }
      case 'fire': {
        // 火攻：火焰粒子喷射 + 热浪扭曲（用多层 fire_trail 模拟）
        for (let i = 0; i < 3; i++) this.spawnParticle(x, y, 'fire_trail');
        this.spawnParticle(x, y, 'element_fire');
        if (ctx) {
          ctx.save();
          const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
          g.addColorStop(0, 'rgba(255,150,40,0.4)');
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'water': {
        // 水攻：水波扩散 + 水花飞溅
        this.spawnParticle(x, y, 'water_ripple');
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = this._getParticle();
          Object.assign(s, { type: 'element_water', x, y,
            vx: Math.cos(a) * (40 + Math.random() * 60), vy: Math.sin(a) * 40 - 30,
            gravity: 60, drag: 0.5, life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
            size: 2.5 + Math.random() * 2, color: '#6ab0e8' });
          this._pushParticle(s);
        }
        break;
      }
      case 'strategy': {
        // 谋略：符文光环 + 光点汇聚
        this.spawnParticle(x, y, 'rune_glow');
        if (ctx) {
          ctx.save();
          ctx.strokeStyle = 'rgba(180,120,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 22, this.time * 2, this.time * 2 + Math.PI * 1.4); ctx.stroke();
          ctx.strokeStyle = 'rgba(220,180,255,0.4)';
          ctx.beginPath(); ctx.arc(x, y, 30, -this.time * 1.5, -this.time * 1.5 + Math.PI); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'heal': {
        // 治疗：绿色光点上升 + 柔光
        this.spawnParticle(x, y, 'heal');
        if (ctx) {
          ctx.save();
          const g = ctx.createRadialGradient(x, y, 0, x, y, 30);
          g.addColorStop(0, 'rgba(120,255,150,0.4)');
          g.addColorStop(1, 'rgba(80,220,120,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        break;
      }
    }
  }

  // ============================================================
  // V13.0：兵种特色攻击动画
  // playUnitAttack(unitType, ctx, x, y, dir)
  //   unitType: 'infantry'步兵 | 'cavalry'骑兵 | 'archer'弓兵 | 'navy'水军
  //   dir: 攻击方向（1 右 / -1 左）
  // ============================================================
  playUnitAttack(unitType, ctx, x, y, dir = 1) {
    switch (unitType) {
      case 'infantry': {
        // 步兵：盾墙推进（前方矩形光墙）+ 长矛突刺（直线轨迹）
        this.spawnParticle(x, y, 'battle_dust');
        if (ctx) {
          ctx.save();
          // 盾墙光墙
          const grad = ctx.createLinearGradient(x, y - 20, x + dir * 24, y - 20);
          grad.addColorStop(0, 'rgba(180,180,200,0.5)');
          grad.addColorStop(1, 'rgba(180,180,200,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(Math.min(x, x + dir * 24), y - 34, 24, 28);
          // 长矛突刺线
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + dir * 30, y - 24); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'cavalry': {
        // 骑兵：马蹄扬尘 + 冲锋弧线 + 马刀劈砍
        this.spawnParticle(x, y, 'cavalry_dust');
        this.spawnParticle(x, y, 'battle_dust');
        if (ctx) {
          ctx.save();
          // 冲锋弧线
          ctx.strokeStyle = 'rgba(255,220,150,0.7)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x + dir * 8, y - 10, 14, dir > 0 ? Math.PI * 0.2 : Math.PI * 0.8, dir > 0 ? Math.PI * 0.9 : Math.PI * 1.6);
          ctx.stroke();
          ctx.restore();
        }
        this.spawnParticle(x + dir * 20, y - 10, 'spark_burst');
        break;
      }
      case 'archer': {
        // 弓兵：拉弓动作 + 箭矢弹道 + 命中箭雨
        this.spawnParticle(x + dir * 40, y - 20, 'arrow');
        if (ctx) {
          ctx.save();
          // 弓弦拉开示意（弧线）
          ctx.strokeStyle = 'rgba(200,160,100,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y - 24, 8, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
          // 箭矢轨迹
          ctx.strokeStyle = 'rgba(255,246,200,0.9)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - 24);
          ctx.quadraticCurveTo(x + dir * 20, y - 40, x + dir * 40, y - 20);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'navy': {
        // 水军：楼船撞击水波 + 火箭齐射
        this.spawnParticle(x, y, 'water_ripple');
        this.spawnParticle(x + dir * 30, y - 10, 'fire_trail');
        if (ctx) {
          ctx.save();
          // 撞击水波环
          ctx.strokeStyle = 'rgba(120,200,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, 18, 7, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        break;
      }
    }
  }

  // ============================================================
  // V13.0：连携技动画（羁绊武将同时出战触发）
  // playComboSkill(generalA, generalB, ctx, x, y)
  //   - generalA/generalB: { name, color }（取双方势力色）
  //   双色光芒交织旋转 + 组合文字浮字
  // ============================================================
  playComboSkill(generalA, generalB, ctx, x, y) {
    const ca = (generalA && generalA.color) || '#c03030';
    const cb = (generalB && generalB.color) || '#3060c0';
    const nameA = (generalA && generalA.name) || '武';
    const nameB = (generalB && generalB.name) || '将';
    // 双色光环粒子：A 色绕内圈，B 色绕外圈，方向相反
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const p = this._getParticle();
      Object.assign(p, { type: 'rune_glow',
        x: x + Math.cos(ang) * 12, y: y + Math.sin(ang) * 12,
        vx: Math.cos(ang) * 10, vy: Math.sin(ang) * 10,
        gravity: 0, drag: 0.3, life: 1.0, maxLife: 1.0,
        size: 3, color: ca, angle: ang, seed: this.time });
      this._pushParticle(p);
    }
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + Math.PI;
      const p = this._getParticle();
      Object.assign(p, { type: 'rune_glow',
        x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 20,
        vx: -Math.cos(ang) * 12, vy: -Math.sin(ang) * 12,
        gravity: 0, drag: 0.3, life: 1.1, maxLife: 1.1,
        size: 3, color: cb, angle: ang, seed: -this.time });
      this._pushParticle(p);
    }
    // 双色交织光柱
    if (ctx) {
      ctx.save();
      // A 色内光柱
      const gA = ctx.createLinearGradient(x, y - 50, x, y);
      gA.addColorStop(0, this._withAlpha(ca, 0));
      gA.addColorStop(1, this._withAlpha(ca, 0.5));
      ctx.fillStyle = gA;
      ctx.fillRect(x - 6, y - 50, 12, 50);
      // B 色外光柱（错开）
      const gB = ctx.createLinearGradient(x + 6, y - 50, x + 6, y);
      gB.addColorStop(0, this._withAlpha(cb, 0));
      gB.addColorStop(1, this._withAlpha(cb, 0.5));
      ctx.fillStyle = gB;
      ctx.fillRect(x + 0, y - 50, 12, 50);
      // 组合文字浮字（渐隐上飘）
      this.damageNumbers.push({
        x: x, y: y - 60,
        text: `${nameA}·${nameB} 连携`,
        life: 1.4, maxLife: 1.4, isCrit: true
      });
      ctx.restore();
    }
  }

  // 颜色 hex 转 rgba 字符串（供渐变用）
  _withAlpha(hex, a) {
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // 颜色变暗工具
  _darken(hex, amt) {
    if (!hex || hex[0] !== '#') return '#555';
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * amt); g = Math.round(g * amt); b = Math.round(b * amt);
    return `rgb(${r},${g},${b})`;
  }

  // ============================================================
  // V14.0 霸业宏图 — 武将单挑动画系统
  // ============================================================

  // 单挑对峙：双武将左右站立，中间 VS 能量碰撞，势力色呼吸光晕
  // progress: 0~1 对峙进度（用于 VS 文字脉冲与光晕缩放）
  playDuelStandoff(ctx, xA, yA, xB, yB, generalA, generalB, progress = 0) {
    if (!ctx) return;
    const t = this.time;
    const ca = (generalA && generalA.color) || '#c03030';
    const cb = (generalB && generalB.color) || '#3060c0';
    const mx = (xA + xB) / 2, my = (yA + yB) / 2;
    ctx.save();

    // ---- 双方威压气场（势力色径向渐变光晕，呼吸式缩放）----
    const breathe = 0.85 + 0.15 * Math.sin(t * 3);
    for (const [px, py, col] of [[xA, yA, ca], [xB, yB, cb]]) {
      const g = ctx.createRadialGradient(px, py - 20, 4, px, py - 20, 40 * breathe);
      g.addColorStop(0, this._withAlpha(col, 0.35));
      g.addColorStop(1, this._withAlpha(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py - 20, 40 * breathe, 0, Math.PI * 2); ctx.fill();
    }

    // ---- 中央 VS 能量碰撞：双色交织闪电 + 脉冲文字 ----
    const pulse = 1 + 0.2 * Math.sin(t * 8);
    // 双色电弧
    ctx.strokeStyle = this._withAlpha(ca, 0.7);
    ctx.lineWidth = 2;
    ctx.shadowColor = ca; ctx.shadowBlur = 10;
    ctx.beginPath();
    let lx = xA + 10, ly = yA - 30;
    ctx.moveTo(lx, ly);
    for (let i = 0; i < 4; i++) {
      lx += (mx - lx) / 4;
      ly += (Math.random() - 0.5) * 8;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.strokeStyle = this._withAlpha(cb, 0.7);
    ctx.shadowColor = cb;
    ctx.beginPath();
    lx = xB - 10; ly = yB - 30;
    ctx.moveTo(lx, ly);
    for (let i = 0; i < 4; i++) {
      lx += (mx - lx) / 4;
      ly += (Math.random() - 0.5) * 8;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // VS 文字（金色描边，脉冲缩放）
    ctx.translate(mx, my - 34);
    ctx.scale(pulse, pulse);
    ctx.font = 'bold 28px "STSong", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#7a4a00';
    ctx.strokeText('VS', 0, 0);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('VS', 0, 0);
    ctx.restore();
  }

  // 单挑攻击：突进/重击/技能 三类
  // attackType: 'charge'突进 | 'heavy'重击 | 'skill'技能
  // general: { color, skillType? }
  playDuelAttack(ctx, x, y, targetX, targetY, attackType, general) {
    const col = (general && general.color) || '#c03030';
    switch (attackType) {
      case 'charge': {
        // 突进：位移 + 速度线 + 残影 + 金色弧光
        const dx = targetX - x, dy = targetY - y;
        const dist = Math.hypot(dx, dy) || 1;
        const dirX = dx / dist, dirY = dy / dist;
        // 速度线（5条）
        for (let i = 0; i < 5; i++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'speedline',
            x: x + (Math.random() - 0.5) * 16, y: y - 10 - Math.random() * 24,
            vx: -dirX * (220 + Math.random() * 120), vy: -dirY * 40 + (Math.random()-0.5)*20,
            gravity: 0, drag: 0, life: 0.18, maxLife: 0.25,
            size: 18, color: 'rgba(255,255,255,0.7)' });
          this._pushParticle(s);
        }
        // 金色挥砍弧光（从攻击者指向目标）
        const ang = Math.atan2(dy, dx);
        this.playSlash(targetX, targetY, ang - Math.PI / 3);
        // 终点尘土
        this.spawnParticle(targetX, targetY, 'battle_dust');
        break;
      }
      case 'heavy': {
        // 重击：武器高举发光（蓄力视觉）+ 下劈震地尘土
        if (ctx) {
          ctx.save();
          // 蓄力发光
          const g = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 30);
          g.addColorStop(0, 'rgba(255,220,120,0.6)');
          g.addColorStop(1, 'rgba(255,180,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y - 30, 30, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // 下劈震地：尘土飞溅 + 冲击环
        this.spawnParticle(targetX, targetY, 'impact');
        this.spawnParticle(targetX, targetY, 'battle_dust');
        // 震地屏幕抖动
        this._shakeFX(4, 0.2);
        break;
      }
      case 'skill': {
        // 技能：根据 skillType 释放对应特效（复用 playSkillAnim）
        const st = (general && general.skillType) || 'fire';
        this.playSkillAnim(st, ctx, x, y, targetX, targetY);
        break;
      }
    }
  }

  // 格挡防御：金属碰撞火花 + 击退小位移 + 防御光圈
  playDuelBlock(ctx, x, y, general) {
    const col = (general && general.color) || '#c03030';
    // 金属火花迸溅
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 100;
      const s = this._getParticle();
      Object.assign(s, { type: 'spark_burst', x, y: y - 24,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        gravity: 180, drag: 0.8, life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        size: 1.5, color: Math.random() < 0.5 ? '#ffffff' : '#FFD700' });
      this._pushParticle(s);
    }
    // 击退小位移（3~5px，ease-out-back 回位）
    this.knockbacks.push({ x, y, distance: 3 + Math.random() * 2, life: 0.25, maxLife: 0.25 });
    // 防御光圈（势力色半透明圆环）
    if (ctx) {
      ctx.save();
      ctx.strokeStyle = this._withAlpha(col, 0.6);
      ctx.lineWidth = 2.5;
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y - 20, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // 单挑受击反馈：闪白 + 击退(8~12px ease-out-back) + 大伤害飘字 + 屏幕抖动
  playDuelHit(ctx, x, y, damage, isCrit = false) {
    // 1) 闪白（α0.7 / 0.1s）
    const flash = this._getParticle();
    Object.assign(flash, { type: 'hitflash', x, y: y - 20, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 0.1, maxLife: 0.1, size: 18, color: '#ffffff' });
    this._pushParticle(flash);
    // 2) 击退 8~12px
    this.knockbacks.push({ x, y, distance: 8 + Math.random() * 4, life: 0.35, maxLife: 0.35 });
    // 3) 伤害飘字（单挑更大更醒目）
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 10, y: y - 40,
      text: String(Math.round(damage)), life: 0.9, maxLife: 0.9, isCrit: !!isCrit,
      duel: true
    });
    // 4) 暴击屏幕抖动 + 金色碎片
    if (isCrit) {
      this._shakeFX(5, 0.2);
      this.spawnParticle(x, y - 20, 'critical_hit');
    } else {
      this.spawnParticle(x, y - 20, 'impact');
    }
  }

  // 单挑胜利：举武器朝天 + 金光爆发 + 金箔飞舞 + 「胜利」文字
  playDuelVictory(ctx, x, y, general) {
    const name = (general && general.name) || '武将';
    // 金色光芒爆发
    this.spawnParticle(x, y - 20, 'victory_glow');
    // 金箔粒子飞舞
    for (let i = 0; i < 18; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'victory_gold',
        x: x + (Math.random() - 0.5) * 30, y: y - 20 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 50,
        gravity: -10, drag: 0.3, life: 1.0 + Math.random() * 0.6, maxLife: 1.6,
        size: 2 + Math.random() * 3, color: '#FFD700', angle: Math.random() * Math.PI * 2 });
      this._pushParticle(s);
    }
    // 「胜利」文字
    if (ctx) {
      ctx.save();
      ctx.font = 'bold 32px "STSong", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#7a4a00';
      ctx.strokeText('胜利!', x, y - 60);
      ctx.fillStyle = '#FFD700';
      ctx.fillText('胜利!', x, y - 60);
      ctx.font = 'bold 16px "STSong", serif';
      ctx.fillStyle = '#FFE9A8';
      ctx.fillText(name, x, y - 80);
      ctx.restore();
    }
  }

  // 单挑失败：单膝跪地 + 武器拄地 + 灰色余烬 + 「败北」文字
  playDuelDefeat(ctx, x, y, general) {
    // 灰色余烬飘落
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'defeat_ash',
        x: x + (Math.random() - 0.5) * 20, y: y - 20,
        vx: (Math.random() - 0.5) * 15, vy: -10 - Math.random() * 8,
        gravity: 25, drag: 0.4, life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
        size: 2 + Math.random() * 2, color: '#888888' });
      this._pushParticle(s);
    }
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 28px "STSong", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#333';
      ctx.strokeText('败北', x, y - 50);
      ctx.fillStyle = '#999999';
      ctx.fillText('败北', x, y - 50);
      ctx.restore();
    }
  }

  // 单挑被俘：绳索光圈缠绕 + 投降姿态
  playDuelCapture(ctx, x, y, general) {
    // 绳索光圈（棕色螺旋环）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      const ang = (i / 8) * Math.PI * 2;
      Object.assign(s, { type: 'rune_glow',
        x: x + Math.cos(ang) * 16, y: y - 20 + Math.sin(ang) * 16,
        vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8,
        gravity: 0, drag: 0.2, life: 1.0, maxLife: 1.0,
        size: 2.5, color: '#8a6a3a', angle: ang, seed: this.time });
      this._pushParticle(s);
    }
    if (ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(138,106,58,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(x, y - 20, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 18px "STSong", serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9a86a';
      ctx.fillText('被俘', x, y - 50);
      ctx.restore();
    }
  }

  // ============================================================
  // V14.0 — 兵种进阶仪式动画
  // ============================================================

  // 进阶仪式：兵种图标发光 + 金色扩散圆环 + 粒子爆发 + 属性飘字
  playAdvancementRitual(ctx, x, y, unitType, fromTier, toTier) {
    // 升级光环（从内向外扩散的金色圆环，3层）
    for (let i = 0; i < 3; i++) {
      const p = this._getParticle();
      Object.assign(p, { type: 'levelup',
        x: x + i * 6, y: y + i * 3,
        vx: 0, vy: 0, gravity: 0, drag: 0,
        life: 0.9 + i * 0.2, maxLife: 0.9 + i * 0.2,
        size: 5, color: '#FFD700', angle: i * 0.4, seed: this.time });
      this._pushParticle(p);
    }
    // 金色粒子爆发
    this.spawnParticle(x, y - 10, 'levelup');
    this.spawnParticle(x, y - 10, 'victory_glow');
    // 进阶完成文字
    if (ctx) {
      ctx.save();
      ctx.font = 'bold 22px "STSong", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#7a4a00';
      const label = `进阶! ${fromTier}→${toTier}`;
      ctx.strokeText(label, x, y - 50);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(label, x, y - 50);
      // 属性提升飘字
      ctx.font = 'bold 14px "STSong", serif';
      ctx.fillStyle = '#66ff88';
      ctx.fillText('+攻 +防', x, y - 32);
      ctx.restore();
    }
  }

  // 精锐兵种战斗差异攻击：按兵种与 tier 释放差异化特效
  // unitType: 'heavy_inf'重甲步兵 | 'cavalry'重骑 | 'archer'强弩 | 'warship'五牙舰
  playEliteUnitAttack(ctx, x, y, unitType, tier = 2, dir = 1) {
    switch (unitType) {
      case 'heavy_inf': {
        // 盾墙发光 + 长矛突刺冲击波
        if (ctx) {
          ctx.save();
          // 盾牌发光
          const g = ctx.createRadialGradient(x, y - 16, 2, x, y - 16, 18);
          g.addColorStop(0, 'rgba(200,220,255,0.5)');
          g.addColorStop(1, 'rgba(200,220,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y - 16, 18, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // 长矛突刺冲击波
        this.spawnParticle(x + dir * 20, y - 18, 'impact');
        this.spawnParticle(x, y, 'battle_dust');
        break;
      }
      case 'cavalry': {
        // 马蹄火焰 + 密集速度线 + 武器拖尾
        for (let i = 0; i < 6; i++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'fire_trail',
            x: x - dir * (10 + Math.random() * 10), y: y + Math.random() * 4,
            vx: -dir * (60 + Math.random() * 40), vy: -20 - Math.random() * 20,
            gravity: 0, drag: 0.5, life: 0.4, maxLife: 0.4,
            size: 2.5 + Math.random() * 2, color: Math.random() < 0.5 ? '#ff6a2a' : '#ffcc33' });
          this._pushParticle(s);
        }
        this.spawnParticle(x, y, 'cavalry_dust');
        this.spawnParticle(x + dir * 24, y - 12, 'spark_burst');
        break;
      }
      case 'archer': {
        // 箭矢光尾 + 命中爆裂
        this.spawnParticle(x + dir * 30, y - 10, 'arrow');
        for (let i = 0; i < 6; i++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'arrow_trail',
            x: x + dir * i * 6, y: y - 16,
            vx: 0, vy: 0, gravity: 0, drag: 0,
            life: 0.25, maxLife: 0.25, size: 2.5, color: '#fff6c8' });
          this._pushParticle(s);
        }
        this.spawnParticle(x + dir * 40, y - 12, 'impact');
        break;
      }
      case 'warship': {
        // 撞击大水花 + 船身震动 + 火箭齐射
        this.spawnParticle(x, y, 'water_ripple');
        for (let i = 0; i < 8; i++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'element_water',
            x: x + (Math.random() - 0.5) * 24, y: y,
            vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40,
            gravity: 120, drag: 0.5, life: 0.5, maxLife: 0.5,
            size: 3 + Math.random() * 2, color: '#8fc4e8' });
          this._pushParticle(s);
        }
        // 火箭齐射
        for (let i = 0; i < 4; i++) {
          this.spawnParticle(x + (Math.random() - 0.5) * 30, y - 20 - Math.random() * 10, 'fire_trail');
        }
        this._shakeFX(2, 0.15);
        break;
      }
    }
  }

  // ============================================================
  // V14.0 — 升级 / 技能解锁动画
  // ============================================================

  // 武将升级：金色光柱 + 光环 + 「升级!」+ 属性飘字
  playLevelUp(ctx, x, y, general, newLevel = 1) {
    // 金色光柱（脚下到头顶）
    if (ctx) {
      ctx.save();
      const g = ctx.createLinearGradient(x, y - 80, x, y);
      g.addColorStop(0, 'rgba(255,233,168,0)');
      g.addColorStop(1, 'rgba(255,215,0,0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 8, y - 80, 16, 80);
      ctx.restore();
    }
    // 升级光环 + 金粒
    this.spawnParticle(x, y - 10, 'levelup');
    this.spawnParticle(x, y - 10, 'victory_glow');
    // 文字
    if (ctx) {
      ctx.save();
      ctx.font = 'bold 26px "STSong", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#7a4a00';
      ctx.strokeText(`升级! Lv.${newLevel}`, x, y - 60);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`升级! Lv.${newLevel}`, x, y - 60);
      // 属性飘字
      ctx.font = 'bold 13px "STSong", serif';
      ctx.fillStyle = '#66ff88';
      ctx.fillText('+统 +武 +智 +政', x, y - 40);
      ctx.restore();
    }
  }

  // 技能解锁：灰色变彩 + 旋转符文圆环 + 光点汇聚
  playSkillUnlock(ctx, x, y, skillId = '') {
    // 旋转符文圆环（紫色/金色光点环绕）
    this.spawnParticle(x, y, 'rune_glow');
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const s = this._getParticle();
      Object.assign(s, { type: 'rune_glow',
        x: x + Math.cos(ang) * 14, y: y + Math.sin(ang) * 14,
        vx: -Math.cos(ang) * 10, vy: -Math.sin(ang) * 10,
        gravity: 0, drag: 0.3, life: 0.9, maxLife: 0.9,
        size: 2.5, color: Math.random() < 0.5 ? '#b080ff' : '#FFD700',
        angle: ang, seed: this.time });
      this._pushParticle(s);
    }
    if (ctx) {
      ctx.save();
      // 旋转符文环
      ctx.strokeStyle = 'rgba(180,120,255,0.7)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#b080ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 24, this.time * 2, this.time * 2 + Math.PI * 1.5); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = 'bold 18px "STSong", serif';
      ctx.textAlign = 'center'; ctx.fillStyle = '#e0c0ff';
      ctx.fillText('技能解锁!', x, y - 36);
      if (skillId) {
        ctx.font = 'bold 13px "STSong", serif';
        ctx.fillStyle = '#FFE9A8';
        ctx.fillText(skillId, x, y + 36);
      }
      ctx.restore();
    }
  }

  // ============================================================
  // V15.0 — 成就解锁 / 段位升级 / 结局结算 动画系统
  // ------------------------------------------------------------
  // 统一规则：
  //  * play* 写入状态机（t=0 起步），并触发一次性粒子爆发；
  //  * update(dt) 推进 t（真实时间），到时自动清空；
  //  * draw* 按当前 t/dur 渲染多阶段动画（rAF 驱动）；
  //  * 静态帧（奖杯/宫殿剪影）离屏 Canvas 缓存，避免每帧重算路径；
  //  * 粒子走 _pushParticle 上限保护。
  // ============================================================

  _v15Lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  _v15EaseOutCubic(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
  _v15EaseInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  // 段位归一化：兼容 {name,color} 对象或字符串
  _v15TierInfo(tier) {
    if (!tier) return { name: '无', color: '#999' };
    if (typeof tier === 'object') return { name: tier.name || '段位', color: tier.color || '#FFD700' };
    const palette = { '青铜': '#B8845A', '白银': '#B0BEC5', '黄金': '#FFD54F',
      '白金': '#E0E0E0', '钻石': '#4FC3F7', '传奇': '#FF6A9A' };
    return { name: String(tier), color: palette[tier] || '#FFD700' };
  }

  // ---------- 奖杯静态帧离屏缓存 ----------
  _ensureTrophyCache() {
    if (this._achTrophyCache) return this._achTrophyCache;
    const c = document.createElement('canvas');
    c.width = 96; c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 50);
    // 杯身
    const grad = g.createLinearGradient(0, -30, 0, 20);
    grad.addColorStop(0, '#FFF3B0');
    grad.addColorStop(0.5, '#FFD54F');
    grad.addColorStop(1, '#C8860D');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-22, -26);
    g.lineTo(22, -26);
    g.quadraticCurveTo(20, 6, 0, 10);
    g.quadraticCurveTo(-20, 6, -22, -26);
    g.closePath(); g.fill();
    // 双耳
    g.strokeStyle = '#C8860D'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.arc(-26, -16, 8, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(26, -16, 8, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
    // 杯柄
    g.fillStyle = '#C8860D';
    g.fillRect(-4, 10, 8, 12);
    // 底座
    g.fillStyle = '#8a5a00';
    g.fillRect(-14, 22, 28, 6);
    g.fillStyle = '#C8860D';
    g.fillRect(-10, 18, 20, 4);
    // 高光
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(-8, -14, 5, 10, -0.2, 0, Math.PI * 2); g.fill();
    this._achTrophyCache = c;
    return c;
  }

  // ============================================================
  // 一、成就解锁动画
  // 阶段：金色光柱升起(0~0.6) → 奖杯旋转出现(0.5~1.4) → 金粒爆发(0.9~1.9)
  //       → 成就文字浮现(1.1~2.6)
  // ============================================================
  playAchievementUnlock(ctx, achievementName, x, y, dur = 2.6) {
    this._achFX = { name: String(achievementName || '成就'), x, y, t: 0, dur };
    // 金色粒子爆发（奖杯周围四散 + 上冲）
    this._burstFXParticles(x, y - 20, 26, {
      colors: ['#FFD700', '#FFF3B0', '#FFE9A8', '#ffffff'],
      minSpeed: 30, spread: 160, upBias: 60, gravity: 80,
      lifeMin: 0.6, lifeMax: 1.4, sizeMin: 1.5, sizeMax: 3.5
    });
    // 光柱底部金尘
    this._burstFXParticles(x, y + 40, 12, {
      colors: ['#FFD700', '#FFE9A8'],
      minSpeed: 10, spread: 40, upBias: 90, gravity: -10,
      lifeMin: 0.8, lifeMax: 1.6, sizeMin: 1, sizeMax: 2.5
    });
    if (ctx) this.drawAchievementFX(ctx);
  }

  // 绘制成就解锁覆盖层（每帧调用）
  drawAchievementFX(ctx) {
    const fx = this._achFX;
    if (!fx || !ctx) return;
    const { x, y, t, dur } = fx;
    const H = (ctx.canvas && ctx.canvas.height) || 800;
    ctx.save();

    // 阶段1：金色光柱从屏幕底部升起
    const riseP = this._v15EaseOutCubic(t / 0.6);
    if (riseP > 0 && t < 1.2) {
      const topY = this._v15Lerp(H + 40, y - 30, riseP);
      const beamGrad = ctx.createLinearGradient(x, topY, x, H);
      beamGrad.addColorStop(0, 'rgba(255,233,168,0)');
      beamGrad.addColorStop(0.5, 'rgba(255,215,0,0.55)');
      beamGrad.addColorStop(1, 'rgba(255,240,190,0.85)');
      ctx.fillStyle = beamGrad;
      const bw = this._v15Lerp(6, 18, riseP);
      ctx.fillRect(x - bw / 2, topY, bw, H - topY);
      // 光柱外光晕
      ctx.fillStyle = `rgba(255,215,0,${0.18 * riseP})`;
      ctx.fillRect(x - bw, topY, bw * 2, H - topY);
    }

    // 阶段2：奖杯旋转出现（easeOutBack 弹入 + 自转）
    const trophyP = this._v15EaseOutBack((t - 0.5) / 0.9);
    if (trophyP > 0) {
      const scale = Math.max(0, Math.min(1.2, trophyP));
      const rot = this._v15Lerp(-Math.PI / 2, 0, this._v15EaseOutCubic((t - 0.5) / 0.8))
                + Math.sin(this.time * 3) * 0.08; // 出现后轻微摆动
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 24;
      const img = this._ensureTrophyCache();
      ctx.drawImage(img, -48, -48);
      ctx.restore();
      // 奖杯外圈光环（阶段3后半扩散）
      const ringP = Math.max(0, (t - 1.0) / 0.8);
      if (ringP > 0 && ringP < 1) {
        ctx.strokeStyle = `rgba(255,215,0,${0.7 * (1 - ringP)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 10, 30 + ringP * 50, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // 阶段4：成就文字浮现
    const textP = this._v15EaseOutCubic((t - 1.1) / 0.7);
    if (textP > 0) {
      ctx.globalAlpha = textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7a4a00'; ctx.shadowBlur = 8;
      // 「成就解锁」小标题
      ctx.font = 'bold 16px "STSong", serif';
      ctx.fillStyle = '#FFE9A8';
      ctx.fillText('★ 成就解锁 ★', x, y + 34);
      // 成就名（金底描边）
      ctx.font = 'bold 26px "STSong", serif';
      ctx.lineWidth = 5; ctx.strokeStyle = '#5a3a00';
      ctx.strokeText(fx.name, x, y + 64);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(fx.name, x, y + 64);
    }
    ctx.restore();
  }

  // ============================================================
  // 二、段位升级动画
  // 阶段：旧徽章碎裂(0~0.6) → 新徽章中心放大(0.4~1.3) → 彩色光环扩散(0.8~2.2)
  // ============================================================
  playTierUp(ctx, oldTier, newTier, x, y, dur = 2.2) {
    const oldInfo = this._v15TierInfo(oldTier);
    const newInfo = this._v15TierInfo(newTier);
    this._tierFX = { oldInfo, newInfo, x, y, t: 0, dur };
    // 旧徽章碎片四散（旧段位色小三角）
    this._burstFXParticles(x, y, 22, {
      colors: [oldInfo.color, this._v15LerpColor(oldInfo.color, '#ffffff', 0.4)],
      minSpeed: 50, spread: 200, upBias: 20, gravity: 160,
      lifeMin: 0.5, lifeMax: 1.0, sizeMin: 2, sizeMax: 4, type: 'shard'
    });
    // 新段位色上升光粒
    this._burstFXParticles(x, y, 16, {
      colors: [newInfo.color, '#ffffff'],
      minSpeed: 20, spread: 80, upBias: 100, gravity: -20,
      lifeMin: 0.8, lifeMax: 1.6, sizeMin: 1.5, sizeMax: 3
    });
    if (ctx) this.drawTierUpFX(ctx);
  }

  _v15LerpColor(hex, to, t) {
    const pa = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const pb = [parseInt(to.slice(1, 3), 16), parseInt(to.slice(3, 5), 16), parseInt(to.slice(5, 7), 16)];
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const b = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  // 绘制一个段位徽章（圆牌 + 名称）
  _v15DrawBadge(ctx, x, y, r, info, time) {
    ctx.save();
    // 光晕
    const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.8);
    glow.addColorStop(0, this._withAlpha(info.color, 0.5));
    glow.addColorStop(1, this._withAlpha(info.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
    // 圆牌
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, this._withAlpha('#ffffff', 0.9));
    grad.addColorStop(0.4, info.color);
    grad.addColorStop(1, this._darken(info.color, 0.6));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // 金边
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5;
    ctx.stroke();
    // 内圈
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    // 名称
    ctx.fillStyle = '#3a2a00';
    ctx.font = `bold ${Math.round(r * 0.55)}px "STSong", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.name, x, y);
    ctx.restore();
  }

  // 绘制段位升级覆盖层
  drawTierUpFX(ctx) {
    const fx = this._tierFX;
    if (!fx || !ctx) return;
    const { x, y, t, dur, oldInfo, newInfo } = fx;
    ctx.save();

    // 阶段1：旧徽章先抖动→碎裂缩小消失（0~0.6）
    if (t < 0.6) {
      const shake = Math.sin(this.time * 40) * 3 * (1 - t / 0.6);
      const shrink = 1 - this._v15EaseInOut(t / 0.6) * 0.9;
      this._v15DrawBadge(ctx, x + shake, y + shake * 0.6, 34 * Math.max(0.1, shrink), oldInfo, this.time);
      // 裂纹线
      ctx.strokeStyle = `rgba(0,0,0,${0.5 * (t / 0.6)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 20, y - 18); ctx.lineTo(x + 5, y); ctx.lineTo(x - 8, y + 20);
      ctx.moveTo(x + 18, y - 14); ctx.lineTo(x, y + 6);
      ctx.stroke();
    }

    // 阶段2：新徽章从中心放大弹入（0.4~1.3）
    const newP = this._v15EaseOutBack((t - 0.4) / 0.9);
    if (newP > 0 && t < dur) {
      this._v15DrawBadge(ctx, x, y, 36 * Math.max(0, Math.min(1.2, newP)), newInfo, this.time);
    }

    // 阶段3：彩色光环多圈扩散（0.8~2.2）
    for (let k = 0; k < 3; k++) {
      const ringP = (t - 0.8 - k * 0.25) / 1.1;
      if (ringP > 0 && ringP < 1) {
        const rr = 30 + ringP * 110;
        ctx.strokeStyle = this._withAlpha(newInfo.color, 0.6 * (1 - ringP));
        ctx.lineWidth = 3 - ringP * 2;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // 段位变化文字
    const labelP = this._v15EaseOutCubic((t - 1.0) / 0.6);
    if (labelP > 0) {
      ctx.globalAlpha = labelP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px "STSong", serif';
      ctx.fillStyle = '#FFE9A8';
      ctx.fillText(`段位提升：${oldInfo.name} → ${newInfo.name}`, x, y + 62);
    }
    ctx.restore();
  }

  // ============================================================
  // 三、结局结算动画
  // rank: 'S' | 'A' | 'B' | 'C' | 'D'
  // type: 结局名称/类型字符串（用于叙事前缀，可空）
  // duration: 总时长（秒）
  // ============================================================
  _v15Narrative(rank, type) {
    const head = type ? `【${type}】` : '';
    switch (rank) {
      case 'S': return head + '龙驭归海，万邦来朝。九州一统，四海归一，青史留名。';
      case 'A': return head + '据江左以自守，与民休息。虽未四海归一，亦为一方明主。';
      case 'B': return head + '南北对峙，岁月静好。百姓暂得喘息，天下大势未定。';
      case 'C': return head + '孤城落日，风雨飘摇。余生苟全于一隅，霸业终成空。';
      default:  return head + '宫阙万间都做了土。兴亡谁人定，盛衰岂无凭，灰飞烟灭。';
    }
  }

  // 宫殿剪影离屏缓存（按等级配色）
  _ensurePalaceCache(rank, W, H) {
    const key = rank;
    if (this._endingPalaceCache[key]) return this._endingPalaceCache[key];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const palettes = {
      S: { main: '#1a1206', glow: 'rgba(255,215,0,0.25)' },
      A: { main: '#0e1216', glow: 'rgba(200,220,255,0.22)' },
      B: { main: '#14100a', glow: 'rgba(220,180,120,0.18)' },
      C: { main: '#160e08', glow: 'rgba(255,140,60,0.18)' },
      D: { main: '#0a0a0c', glow: 'rgba(120,120,130,0.12)' }
    };
    const pal = palettes[rank] || palettes.B;
    g.fillStyle = pal.main;
    const baseY = H * 0.78;
    // 主殿
    g.fillRect(W * 0.38, baseY - H * 0.16, W * 0.24, H * 0.16);
    // 屋顶（歇山顶）
    g.beginPath();
    g.moveTo(W * 0.34, baseY - H * 0.16);
    g.lineTo(W * 0.5, baseY - H * 0.26);
    g.lineTo(W * 0.66, baseY - H * 0.16);
    g.closePath(); g.fill();
    // 左右偏殿
    g.fillRect(W * 0.26, baseY - H * 0.10, W * 0.10, H * 0.10);
    g.beginPath();
    g.moveTo(W * 0.24, baseY - H * 0.10);
    g.lineTo(W * 0.31, baseY - H * 0.16);
    g.lineTo(W * 0.38, baseY - H * 0.10);
    g.closePath(); g.fill();
    g.fillRect(W * 0.64, baseY - H * 0.10, W * 0.10, H * 0.10);
    g.beginPath();
    g.moveTo(W * 0.62, baseY - H * 0.10);
    g.lineTo(W * 0.69, baseY - H * 0.16);
    g.lineTo(W * 0.76, baseY - H * 0.10);
    g.closePath(); g.fill();
    // 城门（暗色缺口）
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(W * 0.47, baseY - H * 0.08, W * 0.06, H * 0.08);
    this._endingPalaceCache[key] = c;
    return c;
  }

  playEndingAnimation(ctx, rank, type, duration = 6) {
    rank = String(rank || 'B').toUpperCase();
    const W = ctx && ctx.canvas ? ctx.canvas.width : 1280;
    const H = ctx && ctx.canvas ? ctx.canvas.height : 720;
    this._endingFX = { rank, type: String(type || ''), t: 0, dur: duration, W, H, chars: 0 };
    // 开场粒子（按等级配色爆发）
    const bursts = { S: ['#FFD700', '#FFF3B0', '#ff6a3a'],
      A: ['#dfe8ff', '#ffffff', '#a0c0ff'],
      B: ['#d0a860', '#e8d0a0', '#b89050'],
      C: ['#c07030', '#e09050', '#805030'],
      D: ['#606068', '#808088', '#303038'] };
    const colors = bursts[rank] || bursts.B;
    this._burstFXParticles(W / 2, H * 0.5, 30, {
      colors, minSpeed: 40, spread: 260, upBias: 80, gravity: 40,
      lifeMin: 1.0, lifeMax: 2.4, sizeMin: 1.5, sizeMax: 3.5
    });
    if (ctx) this.drawEndingAnimation(ctx);
  }

  // S级：龙纹盘旋（金色蛇形曲线随时间游动）
  _v15DrawDragon(ctx, cx, cy, len, amp, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const px = cx - len / 2 + u * len;
      const py = cy + Math.sin(u * Math.PI * 3 - time * 2) * amp;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 龙首（前端亮点）
    const u = 1;
    const hx = cx + len / 2;
    const hy = cy + Math.sin(Math.PI * 3 - time * 2) * amp;
    ctx.fillStyle = '#FFF3B0';
    ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 万民朝拜粒子（S级下半部人群小点，起伏如朝拜）
  _v15DrawCrowd(ctx, W, H, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(40,30,15,0.85)';
    const rows = 6, cols = 28;
    for (let r = 0; r < rows; r++) {
      const y = H * 0.82 + r * H * 0.035;
      const sway = Math.sin(time * 2 + r) * 2;
      for (let c = 0; c < cols; c++) {
        const x = W * 0.08 + c * (W * 0.84 / cols) + (r % 2) * (W * 0.84 / cols) / 2;
        ctx.beginPath(); ctx.arc(x + sway, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // 绘制结局结算覆盖层（每帧调用）
  drawEndingAnimation(ctx) {
    const fx = this._endingFX;
    if (!fx || !ctx) return;
    const { rank, t, dur, W, H } = fx;
    const p = t / dur; // 0→1
    ctx.save();

    // 各等级基础底色
    const baseTint = {
      S: 'rgba(60,40,0,1)', A: 'rgba(20,30,45,1)', B: 'rgba(35,28,18,1)',
      C: 'rgba(40,22,10,1)', D: 'rgba(8,8,10,1)'
    }[rank] || 'rgba(20,20,20,1)';

    // 阶段0：全屏光芒渐入
    const glowP = this._v15EaseOutCubic(p / 0.22);
    const glowColors = {
      S: [255, 215, 90], A: [210, 225, 255], B: [210, 170, 100],
      C: [180, 100, 50], D: [90, 90, 100]
    }[rank];
    const glowGrad = ctx.createRadialGradient(W / 2, H * 0.5, 10, W / 2, H * 0.5, Math.max(W, H) * 0.7);
    glowGrad.addColorStop(0, `rgba(${glowColors[0]},${glowColors[1]},${glowColors[2]},${0.85 * glowP})`);
    glowGrad.addColorStop(1, baseTint);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // 阶段1：宫殿剪影浮现（0.18~0.5）
    const palaceP = this._v15EaseOutCubic((p - 0.18) / 0.3);
    if (palaceP > 0) {
      ctx.globalAlpha = Math.min(1, palaceP);
      const pal = this._ensurePalaceCache(rank, W, H);
      ctx.drawImage(pal, 0, 0);
      ctx.globalAlpha = 1;
    }

    // 阶段2：等级专属主体动画
    if (rank === 'S') {
      // 龙纹盘旋（0.45~0.85）
      const dragonP = Math.max(0, Math.min(1, (p - 0.45) / 0.2));
      if (dragonP > 0) {
        this._v15DrawDragon(ctx, W / 2, H * 0.42, W * 0.7, H * 0.05, this.time, dragonP * 0.95);
      }
      // 万民朝拜粒子（0.65~1）
      const crowdP = Math.max(0, Math.min(1, (p - 0.65) / 0.25));
      if (crowdP > 0) this._v15DrawCrowd(ctx, W, H, this.time, crowdP);
    } else if (rank === 'A') {
      // 和平景象：缓慢飘落花瓣 + 祥云
      const peacefulP = Math.max(0, Math.min(1, (p - 0.4) / 0.3));
      ctx.globalAlpha = peacefulP * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 12; i++) {
        const cx = ((i * 173 + this.time * 12) % (W + 100)) - 50;
        const cy = H * 0.25 + (i % 5) * H * 0.06;
        ctx.beginPath(); ctx.ellipse(cx, cy, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (rank === 'C') {
      // 残阳：地平线低角度橙红光
      const sunP = Math.max(0, Math.min(1, (p - 0.35) / 0.3));
      const sunGrad = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.85);
      sunGrad.addColorStop(0, `rgba(255,120,40,0)`);
      sunGrad.addColorStop(1, `rgba(255,90,30,${0.7 * sunP})`);
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, H * 0.5, W, H * 0.35);
    } else if (rank === 'D') {
      // 余烬：上升火星 + 逐渐黑屏
      const emberP = Math.max(0, Math.min(1, (p - 0.3) / 0.3));
      ctx.fillStyle = `rgba(120,60,40,${0.35 * emberP})`;
      for (let i = 0; i < 18; i++) {
        const ex = (i * 251) % W;
        const ey = H - ((this.time * 30 + i * 40) % H);
        ctx.globalAlpha = 0.5 * emberP;
        ctx.fillRect(ex, ey, 2, 2);
      }
      ctx.globalAlpha = 1;
      // 收尾黑屏（0.85~1）
      const fadeP = Math.max(0, Math.min(1, (p - 0.85) / 0.15));
      ctx.fillStyle = `rgba(0,0,0,${fadeP})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 等级徽章大字（中央）
    const badgeP = this._v15EaseOutBack((p - 0.1) / 0.25);
    if (badgeP > 0) {
      ctx.save();
      ctx.translate(W / 2, H * 0.32);
      ctx.scale(Math.max(0, badgeP), Math.max(0, badgeP));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 16;
      ctx.font = 'bold 72px "STSong", serif';
      const badgeColor = { S: '#FFD700', A: '#dfe8ff', B: '#d0a860', C: '#e09050', D: '#909098' }[rank];
      ctx.fillStyle = badgeColor;
      ctx.fillText(`${rank} 级`, 0, 0);
      ctx.restore();
    }

    // 结局名称
    if (fx.type) {
      ctx.globalAlpha = this._v15EaseOutCubic((p - 0.25) / 0.2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px "STSong", serif';
      ctx.fillStyle = '#FFF3D0';
      ctx.fillText(fx.type, W / 2, H * 0.45);
      ctx.globalAlpha = 1;
    }

    // 结局叙事文字（打字机逐字显示，0.3~0.9）
    const narrative = this._v15Narrative(rank, '');
    const typeP = (p - 0.3) / 0.5;
    if (typeP > 0) {
      const totalChars = narrative.length;
      const shown = Math.floor(this._v15Lerp(0, totalChars, this._v15EaseOutCubic(typeP)));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '18px "STSong", serif';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,245,220,0.95)';
      // 简单居中换行（每 18 字一行）
      const lineLen = Math.max(14, Math.floor(W / 26));
      const sub = narrative.slice(0, shown);
      const lines = [];
      for (let i = 0; i < sub.length; i += lineLen) lines.push(sub.slice(i, i + lineLen));
      lines.forEach((line, idx) => {
        ctx.fillText(line, W / 2, H * 0.68 + idx * 28);
      });
    }
    ctx.restore();
  }

  // ============================================================
  // V16.0 — 开场/过场/战役动画系统
  // ============================================================

  // 预渲染战场剪影（士兵冲锋/旗帜飘扬/骑兵疾驰 黑色剪影）
  _ensurePrologueSilhouette(W, H) {
    if (this._prologueSilhouetteCache
        && this._prologueSilhouetteCache.width === W
        && this._prologueSilhouetteCache.height === H) return this._prologueSilhouetteCache;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    const horizonY = H * 0.62;
    // 远处山脊线（多层）
    g.beginPath();
    g.moveTo(0, horizonY);
    for (let x = 0; x <= W; x += 40) {
      g.lineTo(x, horizonY - 20 - Math.sin(x * 0.01) * 18 - Math.sin(x * 0.03) * 8);
    }
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    // 中景：一排士兵冲锋剪影（横排小三角+身体）
    const n = Math.floor(W / 46);
    for (let i = 0; i < n; i++) {
      const bx = 20 + i * 46;
      const by = horizonY + 10;
      // 身体
      g.fillRect(bx - 3, by - 18, 6, 18);
      // 头
      g.beginPath(); g.arc(bx, by - 21, 3, 0, Math.PI * 2); g.fill();
      // 长矛
      g.fillRect(bx + 3, by - 30, 1.5, 22);
      // 旗帜（部分士兵）
      if (i % 3 === 0) {
        g.fillRect(bx - 8, by - 32, 1.5, 26);
        g.beginPath();
        g.moveTo(bx - 6.5, by - 32);
        g.lineTo(bx + 4, by - 29);
        g.lineTo(bx - 6.5, by - 26);
        g.closePath(); g.fill();
      }
    }
    // 近景：骑兵剪影（更大，2~3 个）
    for (let k = 0; k < 3; k++) {
      const cx = W * 0.15 + k * W * 0.32;
      const cy = horizonY + 30;
      // 马身
      g.beginPath();
      g.ellipse(cx, cy, 26, 9, 0, 0, Math.PI * 2); g.fill();
      // 马腿（4 条）
      g.fillRect(cx - 18, cy, 3, 14);
      g.fillRect(cx - 12, cy + 2, 3, 14);
      g.fillRect(cx + 10, cy, 3, 14);
      g.fillRect(cx + 16, cy + 2, 3, 14);
      // 马头
      g.beginPath();
      g.ellipse(cx + 26, cy - 6, 6, 8, -0.3, 0, Math.PI * 2); g.fill();
      // 骑手
      g.fillRect(cx - 4, cy - 18, 7, 12);
      g.beginPath(); g.arc(cx - 1, cy - 21, 3.5, 0, Math.PI * 2); g.fill();
      // 长枪
      g.fillRect(cx + 4, cy - 34, 1.5, 30);
      // 飘动旗
      g.beginPath();
      g.moveTo(cx + 5.5, cy - 34);
      g.lineTo(cx + 18, cy - 30);
      g.lineTo(cx + 5.5, cy - 26);
      g.closePath(); g.fill();
    }
    this._prologueSilhouetteCache = c;
    return c;
  }

  // 一、开场序幕动画：战场剪影横移 + 旗帜飘动 + 烟尘粒子
  // ctx/canvas 用于取尺寸；w/h 为可选覆盖尺寸
  playPrologueBattle(ctx, w, h) {
    const W = w || (ctx && ctx.canvas ? ctx.canvas.width : 1280);
    const H = h || (ctx && ctx.canvas ? ctx.canvas.height : 720);
    this._prologueFX = { t: 0, dur: 5.5, W, H, seed: Math.random() * 100 };
    // 开场烟尘粒子（黑褐，从地面涌起）
    this._burstFXParticles(W / 2, H * 0.7, 30, {
      colors: ['#3a2a1a', '#5a4a3a', '#2a1a0a', '#6a5a4a'],
      minSpeed: 20, spread: 120, upBias: 80, gravity: -30,
      lifeMin: 1.2, lifeMax: 2.6, sizeMin: 3, sizeMax: 7
    });
    // 金戈铁马火星
    this._burstFXParticles(W / 2, H * 0.55, 18, {
      colors: ['#FFD700', '#ff8a3a', '#FFF3B0'],
      minSpeed: 40, spread: 200, upBias: 40, gravity: 60,
      lifeMin: 0.6, lifeMax: 1.4, sizeMin: 1.5, sizeMax: 3
    });
    if (ctx) this.drawPrologueBattle(ctx);
  }

  // 绘制开场序幕（每帧调用）
  drawPrologueBattle(ctx) {
    const fx = this._prologueFX;
    if (!fx || !ctx) return;
    const { W, H, t, dur, seed } = fx;
    const p = t / dur;
    ctx.save();
    // 阶段0：全屏黑幕渐入
    const fadeIn = this._v15EaseOutCubic(p / 0.15);
    ctx.fillStyle = `rgba(8,6,4,${fadeIn})`;
    ctx.fillRect(0, 0, W, H);

    // 阶段1：战场剪影缓慢横移（0.1~0.9）
    if (p > 0.1 && p < 0.95) {
      const scroll = (p - 0.1) / 0.85;
      const img = this._ensurePrologueSilhouette(W, H);
      // 横向位移：从右滑入再缓停
      const dx = this._v15Lerp(W * 0.3, -W * 0.05, this._v15EaseInOut(scroll));
      ctx.globalAlpha = Math.min(1, (p - 0.1) / 0.2);
      ctx.drawImage(img, dx, 0);
      // 远处烟尘微光（橙红地平线战火）
      const warGlow = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.7);
      warGlow.addColorStop(0, 'rgba(255,100,40,0)');
      warGlow.addColorStop(1, `rgba(255,90,30,${0.35 * Math.sin(this.time * 2)})`);
      ctx.fillStyle = warGlow;
      ctx.fillRect(0, H * 0.55, W, H * 0.15);
      ctx.globalAlpha = 1;
    }

    // 阶段2：序幕文字浮现（0.4~0.9）
    const textP = this._v15EaseOutCubic((p - 0.4) / 0.25);
    if (textP > 0) {
      ctx.globalAlpha = textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFE9B0';
      ctx.font = 'bold 44px "STSong", serif';
      ctx.fillText('南北烽烟  百年乱世', W / 2, H * 0.30);
      ctx.font = '18px "STSong", serif';
      ctx.fillStyle = 'rgba(255,230,180,0.85)';
      ctx.fillText('—— 自永嘉之乱，天下分崩，南北对峙，英雄辈出 ——', W / 2, H * 0.38);
      ctx.globalAlpha = 1;
    }

    // 阶段3：收尾黑屏（0.9~1）
    const fadeOut = Math.max(0, Math.min(1, (p - 0.9) / 0.1));
    if (fadeOut > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeOut})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // 预渲染时间线关键事件背景（火焰/刀剑/宫殿 剪影）
  _ensureTimelineBg(eventName, W, H) {
    const key = eventName + '_' + W + 'x' + H;
    if (this._timelineBgCache[key]) return this._timelineBgCache[key];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0)';
    // 暗色背景
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1020');
    grad.addColorStop(1, '#0a0608');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    // 按事件类型绘制中央图标剪影
    if (/火|焚|战|乱|火/.test(eventName)) {
      // 火焰剪影（橙红渐变三角簇）
      for (let i = 0; i < 5; i++) {
        const fx = cx + (i - 2) * 30;
        const fh = 60 + Math.sin(i * 1.7) * 30;
        const fg = g.createLinearGradient(fx, cy + 40, fx, cy - fh);
        fg.addColorStop(0, '#ff6a2a');
        fg.addColorStop(1, 'rgba(255,200,80,0.2)');
        g.fillStyle = fg;
        g.beginPath();
        g.moveTo(fx - 20, cy + 40);
        g.quadraticCurveTo(fx, cy - fh, fx + 20, cy + 40);
        g.closePath(); g.fill();
      }
    } else if (/剑|刀|兵|戈|伐/.test(eventName)) {
      // 交叉刀剑
      g.strokeStyle = '#c0c8d0'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - 50, cy + 50); g.lineTo(cx + 50, cy - 50);
      g.moveTo(cx + 50, cy + 50); g.lineTo(cx - 50, cy - 50);
      g.stroke();
      // 剑柄
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx - 60, cy - 40); g.lineTo(cx - 40, cy - 60);
      g.moveTo(cx + 60, cy - 40); g.lineTo(cx + 40, cy - 60);
      g.stroke();
    } else {
      // 默认：宫殿剪影
      g.fillStyle = '#2a1a0a';
      g.fillRect(cx - 70, cy - 10, 140, 50);
      g.beginPath();
      g.moveTo(cx - 90, cy - 10);
      g.lineTo(cx, cy - 50);
      g.lineTo(cx + 90, cy - 10);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,200,100,0.25)';
      g.fillRect(cx - 12, cy + 10, 24, 30);
    }
    this._timelineBgCache[key] = c;
    return c;
  }

  // 二、时代变迁动画：时间线粒子流动 + 关键事件闪现
  // eventName: 事件名（如「永嘉南渡」「肥水之战」「孝文改制」）
  playTimelineTransition(ctx, eventName, w, h) {
    const W = w || (ctx && ctx.canvas ? ctx.canvas.width : 1280);
    const H = h || (ctx && ctx.canvas ? ctx.canvas.height : 720);
    this._timelineFX = {
      eventName: String(eventName || '时代变迁'),
      t: 0, dur: 3.2, W, H,
      seed: Math.random() * 100
    };
    // 时间流金色粒子（横向流动）
    for (let i = 0; i < 24; i++) {
      this._burstFXParticles(Math.random() * W, H * 0.5 + (Math.random() - 0.5) * 120, 1, {
        colors: ['#FFD700', '#FFF3B0', '#e8c060'],
        minSpeed: 60, spread: 140, upBias: 0, gravity: 0,
        lifeMin: 1.2, lifeMax: 2.4, sizeMin: 1, sizeMax: 2.5
      });
    }
    if (ctx) this.drawTimelineTransition(ctx);
  }

  // 绘制时代变迁（每帧调用）
  drawTimelineTransition(ctx) {
    const fx = this._timelineFX;
    if (!fx || !ctx) return;
    const { W, H, t, dur, eventName, seed } = fx;
    const p = t / dur;
    ctx.save();
    // 背景淡入
    const bgP = this._v15EaseOutCubic(p / 0.2);
    ctx.globalAlpha = bgP * 0.9;
    const bg = this._ensureTimelineBg(eventName, W, H);
    ctx.drawImage(bg, 0, 0);
    ctx.globalAlpha = 1;

    // 横向时间线（金色光带流动）
    const lineY = H * 0.5;
    const flow = (this.time * 80 + seed * 10) % 40;
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -flow;
    ctx.beginPath();
    ctx.moveTo(W * 0.1, lineY);
    ctx.lineTo(W * 0.9, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 光带中心亮点移动
    const dotX = this._v15Lerp(W * 0.1, W * 0.9, this._v15EaseInOut(p));
    const dotGrad = ctx.createRadialGradient(dotX, lineY, 0, dotX, lineY, 30);
    dotGrad.addColorStop(0, 'rgba(255,240,180,0.9)');
    dotGrad.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = dotGrad;
    ctx.beginPath(); ctx.arc(dotX, lineY, 30, 0, Math.PI * 2); ctx.fill();

    // 事件名大字浮现（0.25~0.7）
    const textP = this._v15EaseOutBack((p - 0.25) / 0.25);
    if (textP > 0) {
      ctx.save();
      ctx.translate(W / 2, H * 0.32);
      ctx.scale(Math.max(0, textP), Math.max(0, textP));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 24;
      ctx.font = 'bold 48px "STSong", serif';
      ctx.fillStyle = '#FFF3D0';
      ctx.fillText(eventName, 0, 0);
      ctx.restore();
    }
    // 收尾淡出（0.85~1）
    const fadeOut = Math.max(0, Math.min(1, (p - 0.85) / 0.15));
    if (fadeOut > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeOut})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // 三、战役关卡片头：战役名称大字浮现 + 副标题 + 难度星级
  // difficulty: 1~5 星
  playCampaignIntro(ctx, campaignName, difficulty = 3) {
    const W = ctx && ctx.canvas ? ctx.canvas.width : 1280;
    const H = ctx && ctx.canvas ? ctx.canvas.height : 720;
    const diff = Math.max(1, Math.min(5, Math.round(difficulty)));
    this._campaignIntroFX = {
      campaignName: String(campaignName || '战役'),
      difficulty: diff, t: 0, dur: 3.0, W, H
    };
    // 金粉粒子从两侧汇聚中央
    this._burstFXParticles(W / 2, H * 0.45, 30, {
      colors: ['#FFD700', '#FFF3B0', '#e8c060'],
      minSpeed: 60, spread: 220, upBias: 30, gravity: 20,
      lifeMin: 0.8, lifeMax: 1.8, sizeMin: 1.5, sizeMax: 3
    });
    if (ctx) this.drawCampaignIntro(ctx);
  }

  // 绘制战役关卡片头（每帧调用）
  drawCampaignIntro(ctx) {
    const fx = this._campaignIntroFX;
    if (!fx || !ctx) return;
    const { W, H, t, dur, campaignName, difficulty } = fx;
    const p = t / dur;
    ctx.save();
    // 背景暗化渐入
    const bgP = this._v15EaseOutCubic(p / 0.2);
    ctx.fillStyle = `rgba(10,8,18,${bgP * 0.85})`;
    ctx.fillRect(0, 0, W, H);

    // 战役名大字（0.15~0.6 弹入）
    const titleP = this._v15EaseOutBack((p - 0.15) / 0.3);
    if (titleP > 0) {
      ctx.save();
      ctx.translate(W / 2, H * 0.40);
      ctx.scale(Math.max(0, titleP), Math.max(0, titleP));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7a1010'; ctx.shadowBlur = 24;
      ctx.font = 'bold 72px "STSong", serif';
      ctx.lineWidth = 6; ctx.strokeStyle = '#3a0808';
      ctx.strokeText(campaignName, 0, 0);
      ctx.fillStyle = '#FFE9B0';
      ctx.fillText(campaignName, 0, 0);
      ctx.restore();
    }

    // 副标题「—— 战役 ——」(0.35~0.6)
    const subP = this._v15EaseOutCubic((p - 0.35) / 0.2);
    if (subP > 0) {
      ctx.globalAlpha = subP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '22px "STSong", serif';
      ctx.fillStyle = 'rgba(255,220,180,0.85)';
      ctx.fillText('— 战 役 —', W / 2, H * 0.40 + 70);
      ctx.globalAlpha = 1;
    }

    // 难度星级（0.5~0.8 依次点亮）
    for (let i = 0; i < 5; i++) {
      const starP = Math.max(0, Math.min(1, (p - 0.5 - i * 0.06) / 0.15));
      if (starP <= 0) continue;
      const sx = W / 2 + (i - 2) * 44;
      const sy = H * 0.40 + 110;
      const lit = i < difficulty;
      const scale = this._v15Lerp(0.5, 1.0, starP);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = starP;
      ctx.shadowColor = lit ? '#FFD700' : 'transparent';
      ctx.shadowBlur = lit ? 16 : 0;
      ctx.fillStyle = lit ? '#FFD700' : 'rgba(120,110,90,0.5)';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        ctx.lineTo(Math.cos(a2) * 6, Math.sin(a2) * 6);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 收尾淡出
    const fadeOut = Math.max(0, Math.min(1, (p - 0.85) / 0.15));
    if (fadeOut > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeOut})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // 四、战役目标提示：目标图标 + 文字从右侧滑入
  // objectiveText: 目标描述
  playCampaignObjective(ctx, objectiveText) {
    const W = ctx && ctx.canvas ? ctx.canvas.width : 1280;
    const H = ctx && ctx.canvas ? ctx.canvas.height : 720;
    this._campaignObjFX = {
      objectiveText: String(objectiveText || '攻占目标城池'),
      t: 0, dur: 3.0, W, H
    };
    if (ctx) this.drawCampaignObjective(ctx);
  }

  // 绘制战役目标提示（每帧调用）
  drawCampaignObjective(ctx) {
    const fx = this._campaignObjFX;
    if (!fx || !ctx) return;
    const { W, H, t, dur, objectiveText } = fx;
    const p = t / dur;
    ctx.save();
    // 滑入滑出：0~0.25 从右滑入；0.75~1 滑出
    let offsetX;
    if (p < 0.25) offsetX = (1 - this._v15EaseOutCubic(p / 0.25)) * (W * 0.5 + 200);
    else if (p > 0.75) offsetX = this._v15EaseInOut((p - 0.75) / 0.25) * (W * 0.5 + 200);
    else offsetX = 0;

    const bx = W - 320 - offsetX;   // 面板左上 x
    const by = 80;
    const bw = 300, bh = 70;
    // 半透明深色面板
    ctx.fillStyle = 'rgba(20,18,10,0.85)';
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
    this._v15RoundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill(); ctx.stroke();
    // 目标图标（金色小旗帜）
    const ix = bx + 28, iy = by + bh / 2;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(ix - 2, iy - 20, 3, 40);
    ctx.beginPath();
    ctx.moveTo(ix + 1, iy - 20);
    ctx.lineTo(ix + 22, iy - 13);
    ctx.lineTo(ix + 1, iy - 6);
    ctx.closePath(); ctx.fill();
    // 脉冲光环（图标周围）
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.strokeStyle = `rgba(255,215,0,${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ix, iy, 24 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    // 文字
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFE9B0';
    ctx.font = 'bold 16px "STSong", serif';
    ctx.fillText('战役目标', bx + 52, by + 22);
    ctx.fillStyle = 'rgba(255,240,210,0.92)';
    ctx.font = '14px "STSong", serif';
    // 简单换行（按宽度截断为两行）
    const maxChars = 14;
    const line1 = objectiveText.slice(0, maxChars);
    const line2 = objectiveText.slice(maxChars, maxChars * 2);
    ctx.fillText(line1, bx + 52, by + 42);
    if (line2) ctx.fillText(line2, bx + 52, by + 58);
    ctx.restore();
  }

  // 五、战役结算：三星依次点亮 + 奖励图标飞入
  // stars: 1~3；rewards: ['粮草','兵器','银两',...] 字符串数组
  playCampaignVictory(ctx, stars = 3, rewards = []) {
    const W = ctx && ctx.canvas ? ctx.canvas.width : 1280;
    const H = ctx && ctx.canvas ? ctx.canvas.height : 720;
    const s = Math.max(1, Math.min(3, Math.round(stars)));
    this._campaignVicFX = {
      stars: s, rewards: Array.isArray(rewards) ? rewards.slice(0, 6) : [],
      t: 0, dur: 4.0, W, H
    };
    // 彩带/烟花爆发
    this._burstFXParticles(W / 2, H * 0.4, 40, {
      colors: ['#FFD700', '#ff5a5a', '#5aff8a', '#5ab0ff', '#ffb0e0', '#ffffff'],
      minSpeed: 60, spread: 260, upBias: 120, gravity: 120,
      lifeMin: 1.2, lifeMax: 2.6, sizeMin: 2, sizeMax: 4
    });
    if (ctx) this.drawCampaignVictory(ctx);
  }

  // 绘制战役结算（每帧调用）
  drawCampaignVictory(ctx) {
    const fx = this._campaignVicFX;
    if (!fx || !ctx) return;
    const { W, H, t, dur, stars, rewards } = fx;
    const p = t / dur;
    ctx.save();
    // 背景金光渐入
    const bgGrad = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, Math.max(W, H) * 0.6);
    bgGrad.addColorStop(0, `rgba(255,220,120,${0.7 * this._v15EaseOutCubic(p / 0.25)})`);
    bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 「战役胜利」大字（0.1~0.4 弹入）
    const titleP = this._v15EaseOutBack((p - 0.1) / 0.25);
    if (titleP > 0) {
      ctx.save();
      ctx.translate(W / 2, H * 0.25);
      ctx.scale(Math.max(0, titleP), Math.max(0, titleP));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7a4a00'; ctx.shadowBlur = 20;
      ctx.font = 'bold 60px "STSong", serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('战役胜利', 0, 0);
      ctx.restore();
    }

    // 三星依次点亮（0.3~0.8）
    for (let i = 0; i < 3; i++) {
      const starP = Math.max(0, Math.min(1, (p - 0.3 - i * 0.12) / 0.2));
      if (starP <= 0) continue;
      const sx = W / 2 + (i - 1) * 80;
      const sy = H * 0.42;
      const lit = i < stars;
      const scale = this._v15Lerp(0.3, 1.0, this._v15EaseOutBack(starP));
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      ctx.shadowColor = lit ? '#FFD700' : 'transparent';
      ctx.shadowBlur = lit ? 24 : 0;
      ctx.fillStyle = lit ? '#FFD700' : 'rgba(120,110,90,0.4)';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
        ctx.lineTo(Math.cos(a2) * 9, Math.sin(a2) * 9);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 奖励图标飞入（0.5~1.0，从两侧飞入排成一排）
    rewards.forEach((r, i) => {
      const rp = Math.max(0, Math.min(1, (p - 0.5 - i * 0.08) / 0.2));
      if (rp <= 0) return;
      const ex = W / 2 + (i - (rewards.length - 1) / 2) * 90;
      const ey = H * 0.62;
      // 从下方飞入
      const yOff = (1 - this._v15EaseOutBack(rp)) * 120;
      ctx.save();
      ctx.globalAlpha = rp;
      // 奖励方块
      ctx.fillStyle = 'rgba(40,30,10,0.85)';
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
      this._v15RoundRect(ctx, ex - 32, ey + yOff - 20, 64, 40, 6);
      ctx.fill(); ctx.stroke();
      // 奖励文字
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFE9B0';
      ctx.font = 'bold 14px "STSong", serif';
      ctx.fillText(r, ex, ey + yOff);
      ctx.restore();
    });

    // 收尾淡出
    const fadeOut = Math.max(0, Math.min(1, (p - 0.92) / 0.08));
    if (fadeOut > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeOut})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // V16.0：圆角矩形辅助
  _v15RoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ============================================================
  // V19.0 — 科技研究完成 / 文化建筑建成 / 文化值提升 覆盖层动画
  // 设计：play* 写入状态机 + 触发一次性粒子爆发（走对象池+上限）；
  //      draw* 按 t/dur 用 delta time 推进渲染；rAF 驱动。
  // ============================================================

  // ---- 科技研究完成：金色光环 + 书本翻开 + 粒子上升 ----
  // techName: 科技名（用于底部文字显示）
  playTechResearch(ctx, x, y, techName = '科技研究') {
    x = x || 0; y = y || 0;
    this._techFX = { techName: String(techName || '科技研究'), x, y, t: 0, dur: 2.6 };
    // 金色上升粒子（书页/光尘）
    this._burstFXParticles(x, y, 22, {
      colors: ['#FFD700', '#FFF3B0', '#FFE9A8', '#ffffff'],
      minSpeed: 20, spread: 90, upBias: 110, gravity: -10,
      lifeMin: 0.9, lifeMax: 1.8, sizeMin: 1.5, sizeMax: 3.5
    });
    // 书本翻页碎片（暖黄小三角）
    this._burstFXParticles(x, y - 10, 10, {
      colors: ['#FFF6D0', '#F5E6A8', '#FFD700'],
      minSpeed: 30, spread: 130, upBias: 40, gravity: 90,
      lifeMin: 0.6, lifeMax: 1.2, sizeMin: 1.5, sizeMax: 3
    });
    if (ctx) this.drawTechResearchFX(ctx);
  }

  // 绘制科技研究完成覆盖层（每帧调用）
  drawTechResearchFX(ctx) {
    const fx = this._techFX;
    if (!fx || !ctx) return;
    const { x, y, t, dur } = fx;
    ctx.save();
    // 阶段1：金色光环扩散（0~1.0s 展开，1.0~2.0s 衰减）
    const ringP = Math.max(0, t / 1.0);
    if (ringP > 0 && ringP < 1) {
      const ringR = this._v15EaseOutCubic(ringP) * 70;
      ctx.strokeStyle = `rgba(255,215,0,${0.85 * (1 - ringP)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
      // 第二圈细环
      const ringP2 = Math.max(0, (t - 0.15) / 0.9);
      if (ringP2 > 0 && ringP2 < 1) {
        const ringR2 = this._v15EaseOutCubic(ringP2) * 55;
        ctx.strokeStyle = `rgba(255,240,180,${0.6 * (1 - ringP2)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, ringR2, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 阶段2：书本翻开（0.3~1.3s 书本从中心弹出，左右翻开）
    const bookP = this._v15EaseOutBack((t - 0.3) / 0.8);
    if (bookP > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(bookP, bookP);
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 18;
      // 书本底座
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-18, -4, 36, 8);
      // 左页（向左翻开，翻转角 0→0.6π）
      const openL = this._v15EaseOutCubic(Math.max(0, (t - 0.5) / 0.7));
      const openR = this._v15EaseOutCubic(Math.max(0, (t - 0.5) / 0.7));
      ctx.fillStyle = '#FFF6D8';
      ctx.save();
      ctx.translate(0, -4);
      ctx.scale(1 - openL * 0.85, 1);
      ctx.fillRect(-18, 0, 18, 9);
      ctx.restore();
      // 右页
      ctx.save();
      ctx.translate(0, -4);
      ctx.scale(1 - openR * 0.85, 1);
      ctx.fillRect(0, 0, 18, 9);
      ctx.restore();
      // 中缝
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 5); ctx.stroke();
      ctx.restore();
    }
    // 阶段3：科技名浮现（1.2s 后淡入）
    const textP = this._v15EaseOutCubic((t - 1.2) / 0.6);
    if (textP > 0) {
      ctx.globalAlpha = textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7a4a00'; ctx.shadowBlur = 8;
      ctx.font = 'bold 15px "STSong", serif';
      ctx.fillStyle = '#FFE9A8';
      ctx.fillText('★ 科技研究完成 ★', x, y + 28);
      ctx.font = 'bold 18px "STSong", serif';
      ctx.lineWidth = 4; ctx.strokeStyle = '#5a3a00';
      ctx.strokeText(fx.techName, x, y + 48);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(fx.techName, x, y + 48);
    }
    ctx.restore();
  }

  // ---- 文化建筑建成：光芒扩散 + 祥云 ----
  playCultureBuild(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._cultureBuildFX = { x, y, t: 0, dur: 2.4 };
    // 暖金光芒粒子（向外扩散+上升）
    this._burstFXParticles(x, y, 20, {
      colors: ['#FFE9A8', '#FFD700', '#FFF6D8', '#f0e0c0'],
      minSpeed: 20, spread: 120, upBias: 30, gravity: 30,
      lifeMin: 0.8, lifeMax: 1.6, sizeMin: 2, sizeMax: 4
    });
    // 祥云微粒（奶白，缓慢飘散）
    this._burstFXParticles(x, y - 10, 12, {
      colors: ['#ffffff', '#f5f0e0', '#e8e0d0'],
      minSpeed: 8, spread: 50, upBias: 10, gravity: -5,
      lifeMin: 1.2, lifeMax: 2.0, sizeMin: 3, sizeMax: 6
    });
    if (ctx) this.drawCultureBuildFX(ctx);
  }

  // 绘制文化建筑建成覆盖层（每帧调用）
  drawCultureBuildFX(ctx) {
    const fx = this._cultureBuildFX;
    if (!fx || !ctx) return;
    const { x, y, t, dur } = fx;
    ctx.save();
    // 阶段1：光芒从中心向外扩散（3 层同心环，依次展开）
    for (let k = 0; k < 3; k++) {
      const ringP = Math.max(0, (t - k * 0.18) / 0.8);
      if (ringP > 0 && ringP < 1) {
        const ringR = this._v15EaseOutCubic(ringP) * (50 + k * 15);
        ctx.strokeStyle = `rgba(255,220,140,${(0.7 - k * 0.15) * (1 - ringP)})`;
        ctx.lineWidth = (2.5 - k * 0.5);
        ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 阶段2：祥云（4 朵奶白云团从底部升起并左右飘开）
    const cloudP = this._v15EaseOutCubic(t / 1.2);
    if (cloudP > 0 && t < 1.8) {
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const cx = x + Math.cos(ang) * cloudP * 35;
        const cy = y - cloudP * (20 + (i % 2) * 10);
        const cr = (5 + (i % 2) * 3) * (0.6 + cloudP * 0.4);
        ctx.fillStyle = `rgba(255,250,235,${0.85 * (1 - Math.max(0, (t - 1.2) / 0.6))})`;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.arc(cx + cr * 0.7, cy + 1, cr * 0.7, 0, Math.PI * 2);
        ctx.arc(cx - cr * 0.7, cy + 1, cr * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 阶段3：建筑小图（简笔飞檐亭）从地面升起
    const riseP = this._v15EaseOutBack((t - 0.2) / 0.9);
    if (riseP > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(riseP, riseP);
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14;
      // 基座
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-12, 2, 24, 4);
      // 飞檐屋顶
      ctx.fillStyle = '#B83A2A';
      ctx.beginPath();
      ctx.moveTo(-14, 2); ctx.lineTo(0, -8); ctx.lineTo(14, 2);
      ctx.closePath(); ctx.fill();
      // 屋脊
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, -6); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- 文化值提升：文化粒子（书卷/毛笔/香炉）上升 ----
  playCultureRise(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._cultureRiseFX = { x, y, t: 0, dur: 2.0 };
    // 书卷/毛笔/香炉 三色粒子上升
    this._burstFXParticles(x, y, 18, {
      colors: ['#c9a86a', '#8a6a3a', '#d4b87a', '#6a8a6a'],
      minSpeed: 15, spread: 50, upBias: 80, gravity: -8,
      lifeMin: 1.0, lifeMax: 1.8, sizeMin: 2, sizeMax: 4
    });
    if (ctx) this.drawCultureRiseFX(ctx);
  }

  // 绘制文化值提升覆盖层（每帧调用）
  drawCultureRiseFX(ctx) {
    const fx = this._cultureRiseFX;
    if (!fx || !ctx) return;
    const { x, y, t } = fx;
    ctx.save();
    // 阶段1：上升的文化小图标（书卷/毛笔/香炉 三选一轮换）
    const iconTypes = ['scroll', 'brush', 'censer'];
    const fade = 1 - Math.max(0, (t - 1.2) / 0.8); // 1.2s 后渐隐
    if (fade > 0) {
      ctx.globalAlpha = fade;
      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.6 + i * 0.17) % 1;   // 0→1 上升循环
        const ix = x + Math.sin(i * 1.7 + t * 1.2) * 14;
        const iy = y - phase * 50;
        const s = (0.7 + 0.3 * Math.sin(i));
        const type = iconTypes[i % 3];
        ctx.save();
        ctx.translate(ix, iy);
        ctx.scale(s, s);
        if (type === 'scroll') {
          // 书卷（卷轴）
          ctx.fillStyle = '#f0e0b0';
          ctx.fillRect(-4, -2, 8, 4);
          ctx.fillStyle = '#8a6a3a';
          ctx.fillRect(-5, -2.5, 1.5, 5);
          ctx.fillRect(3.5, -2.5, 1.5, 5);
        } else if (type === 'brush') {
          // 毛笔
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 2); ctx.stroke();
          ctx.fillStyle = '#3a2a1a';
          ctx.beginPath(); ctx.moveTo(-1.5, 2); ctx.lineTo(1.5, 2); ctx.lineTo(0, 4.5);
          ctx.closePath(); ctx.fill();
        } else {
          // 香炉（小鼎）
          ctx.fillStyle = '#7a5a3a';
          ctx.fillRect(-3, -1, 6, 3);
          ctx.fillStyle = '#9a7a4a';
          ctx.beginPath(); ctx.arc(0, -1.5, 2, 0, Math.PI * 2); ctx.fill();
          // 香烟
          ctx.strokeStyle = `rgba(220,210,190,${0.6 * fade})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.quadraticCurveTo(1.5, -5, 0, -7);
          ctx.quadraticCurveTo(-1.5, -9, 0, -11);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    // 阶段2：底部文化值光晕（暖金）
    const glowP = this._v15EaseOutCubic(Math.min(1, t / 0.5));
    if (glowP > 0) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(255,220,140,${0.4 * glowP * fade})`);
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 便捷：绘制所有激活中的覆盖层（每帧一次调用）
  drawOverlayFX(ctx, w, h) {
    this.drawAchievementFX(ctx);
    this.drawTierUpFX(ctx);
    this.drawEndingAnimation(ctx);
    // V16.0：开场/过场/战役覆盖层
    this.drawPrologueBattle(ctx);
    this.drawTimelineTransition(ctx);
    this.drawCampaignIntro(ctx);
    this.drawCampaignObjective(ctx);
    this.drawCampaignVictory(ctx);
    // V19.0：科技/文化覆盖层
    this.drawTechResearchFX(ctx);
    this.drawCultureBuildFX(ctx);
    this.drawCultureRiseFX(ctx);
  }

  // 查询当前是否有覆盖层动画在播放
  hasOverlayFX() {
    return !!(this._achFX || this._tierFX || this._endingFX
      || this._prologueFX || this._timelineFX
      || this._campaignIntroFX || this._campaignObjFX || this._campaignVicFX
      || this._techFX || this._cultureBuildFX || this._cultureRiseFX);
  }

  // ============================================================
  // V17.0 — 战斗动画深化：阵型 / 士气 / 天气 / 技能 / 冲锋 / 齐射 /
  //         盾墙 / 水战 / 崩溃
  // 设计：每个 play* 方法触发粒子爆发 + 在 ctx 上立即绘制一帧即时特效；
  //      连续形变由 _battleFXs 驱动，drawBattleFX(ctx) 每帧渲染。
  //      粒子上限受 _pushParticle 统一约束。
  // ============================================================

  // ---- 阵型切换动画：方阵 → 锋矢/雁行/方阵 ----
  // fromF/toF: 'square'(方阵) | 'arrow'(锋矢) | 'wildgoose'(雁行) | 'line'(横队)
  // 在 (x,y) 处绘制 1.0s 的阵型形变过渡（士兵粒子从旧位飞到新位）
  playFormationSwitch(ctx, fromF, toF, x, y) {
    x = x || 0; y = y || 0;
    // 士兵粒子从旧阵型目标位置飞向新阵型目标位置
    const fromShape = this._v17FormationPoints(fromF || 'square', 60);
    const toShape = this._v17FormationPoints(toF || 'arrow', 60);
    const n = Math.min(12, fromShape.length, toShape.length);
    for (let i = 0; i < n; i++) {
      const a = fromShape[i], b = toShape[i];
      const s = this._getParticle();
      Object.assign(s, {
        type: 'form_soldier',
        x: x + a[0], y: y + a[1],
        vx: (b[0] - a[0]) * 1.6, vy: (b[1] - a[1]) * 1.6,
        gravity: 0, drag: 2.0,
        life: 0.7, maxLife: 0.7,
        size: 2.2, color: '#d8c890',
        seed: Math.random() * 100
      });
      this._pushParticle(s);
    }
    // 地面冲击波环（阵型切换完成时的气势）
    this._pushBattleFX({ type: 'formation_ring', x, y, dur: 0.9,
      color: '#FFD700', maxR: 48 });
    // 立即绘制一帧光环
    if (ctx) this._drawFormationRing(ctx, x, y, 0, 0.9, '#FFD700', 48);
  }

  // 按阵型名返回 N 个相对坐标点
  _v17FormationPoints(name, spread = 60) {
    const pts = [];
    if (name === 'arrow') {           // 锋矢：三角箭头
      for (let row = 0; row < 4; row++) {
        const cnt = 4 + row;
        for (let i = 0; i < cnt; i++) {
          pts.push([(i - cnt / 2) * 8, -row * 8]);
        }
      }
    } else if (name === 'wildgoose') { // 雁行：V 字斜列
      for (let i = -5; i <= 5; i++) {
        pts.push([i * 10, Math.abs(i) * -6]);
      }
    } else if (name === 'line') {      // 横队：一排
      for (let i = -6; i <= 6; i++) pts.push([i * 8, 0]);
    } else {                            // square 方阵（默认）
      for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) {
        pts.push([c * 8, (r - 1) * 8]);
      }
    }
    return pts;
  }

  _drawFormationRing(ctx, x, y, t, dur, color, maxR) {
    const p = Math.min(1, t / dur);
    const r = this._v17EaseOutCubic(p) * maxR;
    const alpha = (1 - p) * 0.8;
    ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ---- 士气可视化：在军队上方画士气条（绿→黄→红）----
  // morale: 0~1。key 用于追踪同一军队（如 army.id），外部每帧调用以刷新位置
  drawMoraleBar(ctx, x, y, morale, key = 'default') {
    const m = Math.max(0, Math.min(1, morale));
    const w = 28, h = 4;
    // 颜色：高(>0.6)绿 / 中(0.3~0.6)黄 / 低(<0.3)红
    const color = m > 0.6 ? '#4caf50' : m > 0.3 ? '#ffb300' : '#e53935';
    ctx.save();
      // 底板
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
      // 填充
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, y, w * m, h);
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x - w / 2, y, w * m, 1);
    ctx.restore();
    // 记录供 update 推进淡入淡出
    this._moraleBars.set(key, { x, y, morale: m, t: 0 });
  }

  // ---- 士气崩溃动画：士兵四散逃跑 + 旗帜倒下 ----
  playMoraleBreak(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 四散逃跑士兵粒子（向 8 个方向跑，渐隐）
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const sp = 60 + Math.random() * 90;
      const s = this._getParticle();
      Object.assign(s, {
        type: 'rout_soldier',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
        gravity: 80, drag: 0.6,
        life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
        size: 2 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#7a6a5a' : '#9a8a7a'
      });
      this._pushParticle(s);
    }
    // 2) 旗帜倒下 FX（1.2s）
    this._pushBattleFX({ type: 'flag_fall', x, y, dur: 1.2 });
    // 3) 尘土扬起
    this.spawnParticle(x, y, 'dust');
    // 4) 立即绘制旗帜倒下第一帧
    if (ctx) this._drawFlagFall(ctx, x, y, 0, 1.2);
  }

  _drawFlagFall(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    const rot = p * Math.PI / 2.2;     // 旗帜倒下旋转角度
    const alpha = 1 - Math.max(0, (p - 0.7) / 0.3); // 末尾渐隐
    ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      // 旗杆
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.stroke();
      // 旗帜（绕旗杆顶旋转倒下）
      ctx.translate(0, -16);
      ctx.rotate(rot);
      ctx.fillStyle = '#a03030';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(8, 2, 14, 0);
      ctx.quadraticCurveTo(8, 6, 0, 6);
      ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---- 弓兵齐射动画：多支箭同时射出 + 轨迹 + 命中效果 ----
  // dir: 1 向右 / -1 向左。在 (x,y) 处从弓兵阵位射出 N 支箭
  playVolley(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    const N = 10 + Math.floor(Math.random() * 4); // 10~13 支
    for (let i = 0; i < N; i++) {
      const sx = x + (Math.random() - 0.5) * 30;
      const sy = y - 10 - Math.random() * 15;
      const tx = x + dir * (120 + Math.random() * 60);
      const ty = y - 5 + Math.random() * 20;
      // 弹道尾迹（一串点）
      const segs = 6;
      for (let k = 0; k < segs; k++) {
        const tt = k / segs;
        const s = this._getParticle();
        // 抛物线高度
        const arc = Math.sin(tt * Math.PI) * 25;
        Object.assign(s, {
          type: 'volley_trail',
          x: this._v17Lerp(sx, tx, tt),
          y: this._v17Lerp(sy, ty, tt) - arc,
          vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 0.28, maxLife: 0.28,
          size: 1.8, color: '#e8d8a0', angle: Math.atan2(ty - sy, tx - sx)
        });
        this._pushParticle(s);
      }
      // 命中火花
      this._pushBattleFX({ type: 'volley_hit', x: tx, y: ty, dur: 0.35 });
    }
    // 弓兵阵位的开弓闪光
    if (ctx) {
      ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#fff2b0';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y - 8, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 步兵盾墙动画：盾牌竖起 + 金属碰撞光效 ----
  playShieldWall(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 盾牌竖起：一圈半透明盾牌（竖直矩形）从地面升起
    const N = 7;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI - Math.PI;  // 面向前半圆
      const sx = x + Math.cos(ang) * 22;
      const sy = y + Math.sin(ang) * 6;
      const s = this._getParticle();
      Object.assign(s, {
        type: 'shield',
        x: sx, y: sy + 12,
        vx: 0, vy: -8, gravity: 0, drag: 2,
        life: 0.5, maxLife: 0.5,
        size: 6, color: '#7a8a9a', angle: ang
      });
      this._pushParticle(s);
    }
    // 金属碰撞闪光（金色星形）
    this._pushBattleFX({ type: 'shield_glint', x, y, dur: 0.45 });
    // 立即绘制一帧金属闪光
    if (ctx) {
      ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#fff8c0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.moveTo(x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 6);
          ctx.lineTo(x + Math.cos(a) * 14, y - 6 + Math.sin(a) * 14);
        }
        ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 水军水战动画：战船碰撞 + 水花 + 箭雨 ----
  playNavalBattle(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 水花（蓝色水滴从碰撞点向四周溅起）
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      const s = this._getParticle();
      Object.assign(s, {
        type: 'splash',
        x, y: y + 4,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80,
        gravity: 260, drag: 0.3,
        life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
        size: 2 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#6ab0e8' : '#a8d8f0'
      });
      this._pushParticle(s);
    }
    // 2) 涟漪环
    for (let i = 0; i < 3; i++) {
      const s = this._getParticle();
      Object.assign(s, {
        type: 'ripple', x: x + i * 6, y: y + i * 2,
        vx: 0, vy: 0, gravity: 0, drag: 0,
        life: 0.9 + i * 0.2, maxLife: 0.9 + i * 0.2,
        size: 5, color: '#6ab0e8', angle: i * 0.5
      });
      this._pushParticle(s);
    }
    // 3) 箭雨（复用 arrow 粒子）
    this.spawnParticle(x, y - 10, 'arrow');
    // 4) 战船碰撞冲击环
    this._pushBattleFX({ type: 'naval_ring', x, y, dur: 0.7 });
    if (ctx) this._drawNavalRing(ctx, x, y, 0, 0.7);
  }

  _drawNavalRing(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    const r = this._v17EaseOutCubic(p) * 40;
    ctx.save();
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = '#a8d8f0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ---- 骑兵冲锋动画：速度线 + 尘土 + 马蹄视觉 ----
  // dir: 1 向右 / -1 向左
  playCavalryCharge(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 速度线（5~8 条白色短线，沿冲锋方向向后）
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const s = this._getParticle();
      Object.assign(s, {
        type: 'speedline',
        x: x - dir * (10 + Math.random() * 30),
        y: y - 6 - Math.random() * 22,
        vx: -dir * (220 + Math.random() * 160),
        vy: 0, gravity: 0, drag: 0,
        life: 0.18 + Math.random() * 0.15, maxLife: 0.33,
        size: 16 + Math.random() * 12,
        color: 'rgba(255,255,255,0.75)', angle: dir > 0 ? 0 : Math.PI
      });
      this._pushParticle(s);
    }
    // 尘土（马蹄下）
    this.spawnParticle(x, y + 4, 'dust');
    // 前冲位移
    this.lunges.push({ x, y, dir, distance: 14 + Math.random() * 6, life: 0.35, maxLife: 0.35 });
  }

  // ---- 天气战斗效果：雨中溅水 / 雪中脚印 / 雾中模糊 ----
  // weather: '雨' | '雪' | '雾'。在 (x,y) 处触发对应天气战斗粒子
  playWeatherBattle(ctx, weather, x, y) {
    x = x || 0; y = y || 0;
    if (weather === '雨') {
      // 雨滴击打地面溅起小水花
      for (let i = 0; i < 10; i++) {
        const s = this._getParticle();
        Object.assign(s, {
          type: 'splash',
          x: x + (Math.random() - 0.5) * 30, y: y,
          vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30,
          gravity: 200, drag: 0.3,
          life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
          size: 1.5 + Math.random() * 1.5, color: '#9fc0e8'
        });
        this._pushParticle(s);
      }
    } else if (weather === '雪') {
      // 雪中脚印（白色椭圆渐隐）
      for (let i = 0; i < 5; i++) {
        const s = this._getParticle();
        Object.assign(s, {
          type: 'footprint',
          x: x + (Math.random() - 0.5) * 24,
          y: y + (Math.random() - 0.5) * 10,
          vx: 0, vy: 0, gravity: 0, drag: 0,
          life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
          size: 2.5 + Math.random() * 1.5, color: '#ffffff',
          seed: Math.random() * 100
        });
        this._pushParticle(s);
      }
    } else if (weather === '雾') {
      // 雾中战斗：一团朦胧白雾扩散
      for (let i = 0; i < 6; i++) {
        const s = this._getParticle();
        Object.assign(s, {
          type: 'mist',
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 8,
          gravity: 0, drag: 0.2,
          life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
          size: 14 + Math.random() * 12, color: '#e8eef2'
        });
        this._pushParticle(s);
      }
    }
  }

  // ---- 技能释放动画深化：每个技能独特视觉（范围更大/粒子更多）----
  // 复用 playSkill，但针对 V17 增加更大范围与更多粒子的深化版本
  playSkillDeep(ctx, x, y, element = 'fire', power = 1) {
    const k = Math.max(0.5, Math.min(2.5, power));  // 威力倍率
    x = x || 0; y = y || 0;
    if (element === 'water') {
      // 巨浪：蓝色水墙扩散 + 大量水花
      for (let i = 0; i < Math.round(14 * k); i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 120 * k;
        const s = this._getParticle();
        Object.assign(s, { type: 'element_water',
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          gravity: 120, drag: 0.5,
          life: 0.7 + Math.random() * 0.5, maxLife: 1.2,
          size: 3 + Math.random() * 3, color: '#6ab0e8' });
        this._pushParticle(s);
      }
      this._pushBattleFX({ type: 'water_ring', x, y, dur: 0.8, maxR: 60 * k });
    } else if (element === 'wind') {
      // 飓风：旋转青色旋风（16 个粒子绕中心转）
      for (let i = 0; i < Math.round(16 * k); i++) {
        const a = (i / (16 * k)) * Math.PI * 2 + this.time * 4;
        const r = 10 + Math.random() * 20 * k;
        const s = this._getParticle();
        Object.assign(s, { type: 'element_wind',
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: Math.cos(a + Math.PI / 2) * 80, vy: Math.sin(a + Math.PI / 2) * 80 - 20,
          gravity: 0, drag: 0.8,
          life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
          size: 2 + Math.random() * 2, color: '#8fe8d8', angle: a });
        this._pushParticle(s);
      }
    } else if (element === 'thunder') {
      // 雷霆：闪电分叉（白色折线粒子 + 冲击环）
      this.spawnParticle(x, y, 'lightning');
      for (let i = 0; i < Math.round(10 * k); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = this._getParticle();
        Object.assign(s, { type: 'spark',
          x, y, vx: Math.cos(a) * 120 * k, vy: Math.sin(a) * 120 * k,
          gravity: 0, drag: 0.5,
          life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
          size: 2, color: '#bfeaff' });
        this._pushParticle(s);
      }
    } else { // fire 默认
      this.spawnParticle(x, y, 'fire');
      for (let i = 0; i < Math.round(16 * k); i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 140 * k;
        const s = this._getParticle();
        Object.assign(s, { type: 'element_fire', x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          gravity: -40, drag: 0.5,
          life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
          size: 3 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#ff5a2a' : '#ffaa22' });
        this._pushParticle(s);
      }
      this._pushBattleFX({ type: 'fire_ring', x, y, dur: 0.7, maxR: 50 * k });
    }
  }

  // ============================================================
  // V18.0 — 动画与地图增强：战斗动画继续深化
  // 单挑新动作(横劈/直刺/闪避/反击) / 溃逃收尾 / 攻城(云梯·撞槌·墙裂·攀爬) /
  // 水战深化(对冲·接舷·火船) / 伏兵突袭 / 援军到达
  // 设计：play* 触发对象池粒子爆发 + 一次性 ctx 即时绘制；
  //      连续形变走 _battleFXs（drawBattleFX 渲染），受 _battleFXCap 上限保护；
  //      所有粒子经 _getParticle/_pushParticle（对象池+统一上限）。
  // ============================================================

  // ---- 单挑·横劈：宽大横扫斩弧 + 刀风速度线 + 刃风火花 ----
  // dir: 1 向右 / -1 向左。在 (x,y) 挥出一道横向横扫弧光
  playDuelSlash(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 1) 横扫斩弧（复用 slash 粒子，沿水平大半圆扫过）
    const arc = this._getParticle();
    Object.assign(arc, { type: 'slash',
      x, y: y - 18, vx: 0, vy: 0, gravity: 0, drag: 0,
      life: 0.22, maxLife: 0.22, size: 26, color: '#ffffff',
      angle: dir > 0 ? Math.PI * 0.15 : Math.PI * 0.85 });
    this._pushParticle(arc);
    // 2) 刀风速度线（3 条，沿横劈方向向后）
    for (let i = 0; i < 3; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'speedline',
        x: x - dir * (14 + Math.random() * 10),
        y: y - 22 - Math.random() * 10,
        vx: dir * (260 + Math.random() * 80), vy: 0,
        gravity: 0, drag: 0, life: 0.16, maxLife: 0.2,
        size: 14, color: 'rgba(255,255,255,0.7)',
        angle: dir > 0 ? 0 : Math.PI });
      this._pushParticle(s);
    }
    // 3) 刃风火花（劈砍末端溅出）
    const tipX = x + dir * 26;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this._getParticle();
      Object.assign(s, { type: 'spark_burst',
        x: tipX, y: y - 18,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20,
        gravity: 160, drag: 0.8,
        life: 0.25 + Math.random() * 0.15, maxLife: 0.4,
        size: 1.4, color: Math.random() < 0.5 ? '#ffffff' : '#FFD700' });
      this._pushParticle(s);
    }
    // 4) 即时绘制一帧宽刀光（横向扫过）
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffe9a8'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y - 18, 24,
        dir > 0 ? Math.PI * 0.2 : Math.PI * 0.8,
        dir > 0 ? Math.PI * 0.8 : Math.PI * 1.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 单挑·直刺：前突穿刺光枪 + 剑尖穿透火花 ----
  playDuelThrust(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 1) 前冲刺位移（小步前送）
    this.lunges.push({ x, y, dir, distance: 10 + Math.random() * 4, life: 0.22, maxLife: 0.22 });
    // 2) 穿刺光枪（细长白色直线，沿 dir 方向）
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#cfe8ff'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - dir * 4, y - 22);
      ctx.lineTo(x + dir * 30, y - 22);
      ctx.stroke();
      ctx.restore();
    }
    // 3) 剑尖穿透火花（在枪尖处迸射，沿前方扇形）
    const tipX = x + dir * 30;
    for (let i = 0; i < 6; i++) {
      const a = dir > 0 ? (Math.PI * 0.1 + Math.random() * Math.PI * 0.8)
                        : (Math.PI * 1.1 + Math.random() * Math.PI * 0.8);
      const s = this._getParticle();
      Object.assign(s, { type: 'spark_burst',
        x: tipX, y: y - 22,
        vx: Math.cos(a) * (80 + Math.random() * 60),
        vy: Math.sin(a) * (80 + Math.random() * 60),
        gravity: 120, drag: 0.7,
        life: 0.22 + Math.random() * 0.15, maxLife: 0.37,
        size: 1.3, color: '#eaf6ff' });
      this._pushParticle(s);
    }
  }

  // ---- 单挑·闪避：侧移残影 + 脚下尘土 ----
  playDuelDodge(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 侧移残影（渐隐半透明人影虚影）
    for (let i = 0; i < 3; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'afterimage',
        x: x + (Math.random() - 0.5) * 20, y: y - 16,
        vx: (Math.random() - 0.5) * 30, vy: 0,
        gravity: 0, drag: 1.5,
        life: 0.3 + i * 0.08, maxLife: 0.3 + i * 0.08,
        size: 6, color: 'rgba(200,220,255,0.5)' });
      this._pushParticle(s);
    }
    // 2) 脚下闪避尘土
    this.spawnParticle(x, y, 'dust');
  }

  // ---- 单挑·反击：闪避后立刻反手快斩 + 重火花 + 「反击!」 ----
  playDuelCounter(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 反手横劈（方向反向以体现反击）
    this.playDuelSlash(ctx, x, y, -dir);
    // 反击重击火花（更密）
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this._getParticle();
      Object.assign(s, { type: 'spark_burst',
        x: x - dir * 20, y: y - 20,
        vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30,
        gravity: 160, drag: 0.8,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        size: 1.6, color: Math.random() < 0.5 ? '#FFD700' : '#ffffff' });
      this._pushParticle(s);
    }
    if (ctx) {
      ctx.save();
      ctx.font = 'bold 16px "STSong", serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#7a4a00';
      ctx.strokeText('反击!', x, y - 46);
      ctx.fillStyle = '#FFD700';
      ctx.fillText('反击!', x, y - 46);
      ctx.restore();
    }
  }

  // ---- 军队溃逃收尾：败军四散 + 丢弃旗帜 + 盔甲兵器掉落 ----
  playRoutComplete(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 更多败兵四散（12~16 个，朝外圈逃窜渐隐）
    const N = 12 + Math.floor(Math.random() * 4);
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 70 + Math.random() * 110;
      const s = this._getParticle();
      Object.assign(s, { type: 'rout_soldier',
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
        gravity: 90, drag: 0.6,
        life: 1.0 + Math.random() * 0.6, maxLife: 1.6,
        size: 2 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#6a5a4a' : '#8a7a6a' });
      this._pushParticle(s);
    }
    // 2) 丢弃的旗帜（倒地红布，2~3 面抛物线落地）
    for (let i = 0; i < 3; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'form_soldier',
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 8 + 2,
        vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 10,
        gravity: 180, drag: 0.5,
        life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
        size: 4, color: '#a03030', angle: Math.random() * Math.PI });
      this._pushParticle(s);
    }
    // 3) 盔甲/兵器掉落（灰褐碎片，抛物线落地）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'armor_bit',
        x: x + (Math.random() - 0.5) * 16, y: y - 6,
        vx: Math.cos(Math.random() * Math.PI * 2) * (30 + Math.random() * 50),
        vy: -60 - Math.random() * 40,
        gravity: 220, drag: 0.2,
        life: 0.7 + Math.random() * 0.4, maxLife: 1.1,
        size: 1.8 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#8a8a8a' : '#6a6a5a' });
      this._pushParticle(s);
    }
    // 4) 卷起尘土 + 一面旗帜倒下 FX + 败溃尘土扩散环
    this.spawnParticle(x, y, 'dust');
    this._pushBattleFX({ type: 'flag_fall', x, y, dur: 1.2 });
    this._pushBattleFX({ type: 'rout_dust_ring', x, y, dur: 1.0 });
  }

  // ---- 攻城动画：云梯搭建 + 攻城槌撞击 + 城墙碎裂 + 士兵攀爬 ----
  playSiegeWall(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 云梯搭建 FX（梯子从竖直放倒到斜靠城墙，1.0s）
    const ladderDir = Math.random() < 0.5 ? 1 : -1;
    this._pushBattleFX({ type: 'siege_ladder', x, y, dur: 1.0, dir: ladderDir });
    // 2) 攻城槌撞击 FX（往复撞击 + 墙根尘土，0.4s）
    this._pushBattleFX({ type: 'siege_ram', x, y, dur: 0.45 });
    // 3) 城墙碎裂 FX（裂纹随撞击蔓延，1.4s）
    this._pushBattleFX({ type: 'wall_crack', x, y, dur: 1.4, seed: Math.random() * 100 });
    // 4) 攀爬士兵（5~6 个小卒沿云梯向上攀）
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'form_soldier',
        x: x + (Math.random() - 0.5) * 6,
        y: y + 6 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 6, vy: -(30 + Math.random() * 20),
        gravity: 0, drag: 0.5,
        life: 1.0 + Math.random() * 0.5, maxLife: 1.5,
        size: 2, color: Math.random() < 0.5 ? '#c0a060' : '#a08050',
        seed: Math.random() * 100 });
      this._pushParticle(s);
    }
    // 5) 飞石碎屑撞击飞溅（灰色碎石，重力下落）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'stone_chunk',
        x: x + (Math.random() - 0.5) * 20, y: y - 10,
        vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60,
        gravity: 260, drag: 0.15,
        life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
        size: 1.6 + Math.random() * 1.6,
        color: Math.random() < 0.5 ? '#9a9a9a' : '#7a7a7a' });
      this._pushParticle(s);
    }
    // 6) 撞击震屏 + 地面尘土
    this._shakeFX(4, 0.25);
    this.spawnParticle(x, y, 'battle_dust');
    // 7) 立即绘制第一帧斜靠云梯
    if (ctx) this._drawSiegeLadder(ctx, x, y, 0, 1.0, ladderDir);
  }

  // 云梯绘制：从竖直放倒到斜靠（p: 0→1）
  _drawSiegeLadder(ctx, x, y, t, dur, dir = 1) {
    const p = Math.min(1, t / dur);
    const alpha = 1 - Math.max(0, (p - 0.85) / 0.15);
    const len = 36 * this._v17EaseOutCubic(p);
    const lean = 0.5 * p * dir;             // 倾斜角（弧度）
    const topX = Math.sin(lean) * len;
    const topY = -Math.cos(lean) * len;
    ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      // 两轨
      ctx.strokeStyle = '#7a5a30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2.5, 0);
      ctx.lineTo(topX - 2.5 * Math.cos(lean), topY + 2.5 * Math.sin(lean));
      ctx.moveTo(2.5, 0);
      ctx.lineTo(topX + 2.5 * Math.cos(lean), topY - 2.5 * Math.sin(lean));
      ctx.stroke();
      // 横档
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const f = i / 6;
        ctx.beginPath();
        ctx.moveTo(topX * f - 2.5, topY * f);
        ctx.lineTo(topX * f + 2.5, topY * f);
        ctx.stroke();
      }
    ctx.restore();
  }

  // 攻城槌撞击绘制：横梁往复前伸 + 墙根尘土
  _drawSiegeRam(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    const alpha = 1 - Math.max(0, (p - 0.7) / 0.3);
    const reach = Math.sin(p * Math.PI) * 8;   // 前伸再弹回
    ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      // 横梁
      ctx.strokeStyle = '#6a4a28';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(14 + reach, 0);
      ctx.stroke();
      // 槌头金属包头
      ctx.fillStyle = '#9a9a8a';
      ctx.beginPath(); ctx.arc(14 + reach, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      // 撞击点尘土
      if (p > 0.4 && p < 0.7) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#8B7355';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(18 + Math.sin(t * 30 + i) * 4, -2 - i * 3, 2 + i, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    ctx.restore();
  }

  // 城墙碎裂绘制：撞击点向外蔓延的锯齿裂纹
  _drawWallCrack(ctx, x, y, t, dur, seed = 0) {
    const p = Math.min(1, t / dur);
    const alpha = (1 - p) * 0.8;
    const maxLen = 30;
    ctx.save();
      ctx.translate(x, y - 12);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(40,30,20,0.9)';
      ctx.lineWidth = 1.5;
      for (let b = 0; b < 3; b++) {
        const ang = -Math.PI / 2 + (b - 1) * 0.7 + Math.sin(seed + b) * 0.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let i = 1; i <= 4; i++) {
          const f = (i / 4) * p;
          const cx = Math.cos(ang) * maxLen * f + Math.sin(seed + b * 3 + i * 1.7) * 3;
          const cy = Math.sin(ang) * maxLen * f + Math.cos(seed + b * 2 + i) * 2;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    ctx.restore();
  }

  // ---- 伏兵突袭：从森林/山地杀出 + 烟尘 + 「!」突袭标识 ----
  playAmbush(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 伏击烟尘 FX（棕色烟尘从地面腾起扩散）
    this._pushBattleFX({ type: 'ambush_smoke', x, y, dur: 1.2 });
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'mist',
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 15,
        gravity: -6, drag: 0.3,
        life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
        size: 8 + Math.random() * 8, color: '#7a6a4a' });
      this._pushParticle(s);
    }
    // 2) 伏兵杀出（士兵从中心向四周冲出）
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const sp = 80 + Math.random() * 70;
      const s = this._getParticle();
      Object.assign(s, { type: 'form_soldier',
        x, y: y - 6,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
        gravity: 60, drag: 0.7,
        life: 0.7 + Math.random() * 0.4, maxLife: 1.1,
        size: 2.4, color: '#3a5a3a', seed: Math.random() * 100 });
      this._pushParticle(s);
    }
    // 3) 地面尘土爆
    this.spawnParticle(x, y, 'dust');
    // 4) 突袭震屏
    this._shakeFX(3, 0.18);
    // 5) 突袭标识「!」（脉冲放大）
    if (ctx) {
      ctx.save();
        const pop = 1 + 0.3 * Math.sin(this.time * 10);
        ctx.translate(x, y - 44);
        ctx.scale(pop, pop);
        ctx.font = 'bold 26px "STSong", serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = '#5a1a1a';
        ctx.strokeText('!', 0, 0);
        ctx.fillStyle = '#ff4a3a';
        ctx.fillText('!', 0, 0);
      ctx.restore();
    }
  }

  // ---- 援军到达：远方尘土 + 军旗升起 + 号角声波纹 ----
  playReinforcementArrive(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 1) 远方尘土 FX（烟尘升起并扩散，由淡到浓）
    this._pushBattleFX({ type: 'reinforce_dust', x, y, dur: 1.6 });
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'dust',
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20, vy: -18 - Math.random() * 12,
        gravity: 6, drag: 0.5,
        life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
        size: 4 + Math.random() * 5, color: '#9a8a6a' });
      this._pushParticle(s);
    }
    // 2) 军旗出现 FX（旗杆升起 + 旗帜展开）
    this._pushBattleFX({ type: 'reinforce_banner', x, y, dur: 1.4 });
    // 3) 号角声波纹（同心圆弧向外扩散，3 圈错峰）
    for (let i = 0; i < 3; i++) {
      const horn = { type: 'reinforce_horn', x, y: y - 30, dur: 1.0 };
      this._pushBattleFX(horn);
      horn.t = -0.25 * i;   // 负起点实现错峰
    }
    // 4) 到达金光点缀
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'victory_gold',
        x: x + (Math.random() - 0.5) * 24, y: y - 10,
        vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20,
        gravity: -8, drag: 0.3,
        life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
        size: 2, color: '#FFD700' });
      this._pushParticle(s);
    }
  }

  // ---- 水战深化·战船对冲撞击：船首对撞 + 大水花 + 碎木片 ----
  playNavalRamming(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 撞击冲击环
    this._pushBattleFX({ type: 'naval_ring', x, y, dur: 0.7 });
    // 大水花
    for (let i = 0; i < 14; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'splash',
        x: x + dir * 6, y: y,
        vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 100,
        gravity: 280, drag: 0.3,
        life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
        size: 2 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#6ab0e8' : '#c8e8f8' });
      this._pushParticle(s);
    }
    // 碎木片
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'form_soldier',
        x: x + dir * 6, y: y - 4,
        vx: (Math.random() - 0.5) * 120, vy: -30 - Math.random() * 40,
        gravity: 240, drag: 0.2,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        size: 2.5, color: '#7a5a30', angle: Math.random() * Math.PI });
      this._pushParticle(s);
    }
    this._shakeFX(3, 0.18);
  }

  // ---- 水战深化·接舷战：士兵跳帮跃过 + 甲板短兵相接火花 ----
  playBoarding(ctx, x, y) {
    x = x || 0; y = y || 0;
    // 跳帮士兵（抛物线跃向敌船）
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'form_soldier',
        x: x - 10, y: y - 6,
        vx: 40 + Math.random() * 30, vy: -70 - Math.random() * 30,
        gravity: 160, drag: 0.1,
        life: 0.7 + Math.random() * 0.3, maxLife: 1.0,
        size: 2.2, color: '#c0a060', seed: Math.random() * 100 });
      this._pushParticle(s);
    }
    // 甲板短兵相接金属火花
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this._getParticle();
      Object.assign(s, { type: 'spark_burst',
        x: x + 10, y: y - 8,
        vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 20,
        gravity: 150, drag: 0.8,
        life: 0.25 + Math.random() * 0.15, maxLife: 0.4,
        size: 1.3, color: Math.random() < 0.5 ? '#fff' : '#FFD700' });
      this._pushParticle(s);
    }
  }

  // ---- 水战深化·火船冲撞：火船拖焰冲撞 + 火焰爆燃 ----
  playFireShip(ctx, x, y, dir = 1) {
    x = x || 0; y = y || 0;
    // 拖焰尾迹（一串火球向后）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fire',
        x: x - dir * i * 6, y: y - 2 - Math.random() * 4,
        vx: -dir * (30 + Math.random() * 20), vy: -10 - Math.random() * 10,
        gravity: -30, drag: 0.4,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        size: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ff5a2a' : '#ffaa22' });
      this._pushParticle(s);
    }
    // 撞击爆燃 + 水花
    this.spawnParticle(x + dir * 8, y - 4, 'fire');
    this.spawnParticle(x + dir * 8, y, 'splash');
    this._pushBattleFX({ type: 'fire_ring', x: x + dir * 8, y: y - 4, dur: 0.7, maxR: 36 });
    this._shakeFX(4, 0.22);
  }

  // ============================================================
  // V18.0 — 新增战斗 FX 绘制辅助
  // ============================================================
  _drawRoutDustRing(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    ctx.save();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 10 + p * 40, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  _drawAmbushSmoke(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    ctx.save();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillStyle = '#7a6a4a';
      for (let i = 0; i < 3; i++) {
        const r = (8 + p * 22) * (1 + i * 0.4);
        ctx.beginPath(); ctx.arc(x, y - p * 10, r, 0, Math.PI * 2); ctx.fill();
      }
    ctx.restore();
  }
  _drawReinforceDust(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    ctx.save();
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle = '#9a8a6a';
      for (let i = 0; i < 4; i++) {
        const off = i * 5;
        const r = 10 + p * 18 + off;
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(t * 3 + i) * 4, y - p * 14 - off * 0.5, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.restore();
  }
  _drawReinforceBanner(ctx, x, y, t, dur) {
    const p = Math.min(1, t / dur);
    const rise = this._v17EaseOutCubic(p);
    ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = Math.min(1, p * 2);
      const hgt = 26 * rise;
      // 旗杆（升起）
      ctx.strokeStyle = '#C4A55A';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hgt); ctx.stroke();
      // 旗帜展开
      ctx.fillStyle = '#d8b040';
      const w = 12 * Math.min(1, p * 2);
      ctx.beginPath();
      ctx.moveTo(0, -hgt);
      ctx.quadraticCurveTo(w, -hgt + 2, w, -hgt + 4);
      ctx.quadraticCurveTo(w, -hgt + 8, 0, -hgt + 8);
      ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  _drawReinforceHorn(ctx, x, y, t, dur) {
    const p = Math.min(1, Math.max(0, t / dur));
    ctx.save();
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(x, y, 10 + p * 40,
          side > 0 ? -Math.PI * 0.8 : Math.PI * 0.2,
          side > 0 ? -Math.PI * 0.2 : Math.PI * 0.8);
        ctx.stroke();
      }
    ctx.restore();
  }

  // ---- 每帧绘制所有激活的战斗 FX（外部 render 循环调用）----
  drawBattleFX(ctx) {
    if (!ctx || this._battleFXs.length === 0) return;
    ctx.save();
    for (const fx of this._battleFXs) {
      const p = fx.t / fx.dur;
      if (p < 0) continue;   // 负起点（错峰音效环）尚未到达
      switch (fx.type) {
        case 'formation_ring':
          this._drawFormationRing(ctx, fx.x, fx.y, fx.t, fx.dur, fx.color, fx.maxR);
          break;
        case 'flag_fall':
          this._drawFlagFall(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'volley_hit': {
          // 命中点金色火花
          const alpha = (1 - p) * 0.9;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#fff2b0';
          ctx.beginPath(); ctx.arc(fx.x, fx.y, 3 + p * 6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'shield_glint': {
          const alpha = (1 - p) * 0.9;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#fff8c0';
          ctx.lineWidth = 1.5;
          const R = 8 + p * 18;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + p * 2;
            ctx.moveTo(fx.x + Math.cos(a) * R * 0.4, fx.y - 6 + Math.sin(a) * R * 0.4);
            ctx.lineTo(fx.x + Math.cos(a) * R, fx.y - 6 + Math.sin(a) * R);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'naval_ring':
          this._drawNavalRing(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'water_ring': {
          const r = this._v17EaseOutCubic(p) * (fx.maxR || 60);
          ctx.globalAlpha = (1 - p) * 0.7;
          ctx.strokeStyle = '#6ab0e8';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'fire_ring': {
          const r = this._v17EaseOutCubic(p) * (fx.maxR || 50);
          ctx.globalAlpha = (1 - p) * 0.8;
          ctx.strokeStyle = '#ff8a3a';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        // ---- V18.0 新增战斗 FX ----
        case 'rout_dust_ring':
          this._drawRoutDustRing(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'siege_ladder':
          this._drawSiegeLadder(ctx, fx.x, fx.y, fx.t, fx.dur, fx.dir || 1);
          break;
        case 'siege_ram':
          this._drawSiegeRam(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'wall_crack':
          this._drawWallCrack(ctx, fx.x, fx.y, fx.t, fx.dur, fx.seed || 0);
          break;
        case 'ambush_smoke':
          this._drawAmbushSmoke(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'reinforce_dust':
          this._drawReinforceDust(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'reinforce_banner':
          this._drawReinforceBanner(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
        case 'reinforce_horn':
          this._drawReinforceHorn(ctx, fx.x, fx.y, fx.t, fx.dur);
          break;
      }
    }
    ctx.restore();
  }

  // ============================================================
  // V20.0 — 动画与地图增强：自然灾害动画系统
  // ------------------------------------------------------------
  // 公共 API（5 个必备 + 1 个暴雪辅助）：
  //   playEarthquake(ctx, w, h)  地震：全屏地面震动+裂缝+建筑摇晃+碎石
  //   playFlood(ctx, x, y)       洪水：水流涌入+波纹+漂浮物
  //   playDrought(ctx, x, y)     干旱：土地干裂+枯黄植物
  //   playPlague(ctx, x, y)      瘟疫：绿色雾气+病弱士兵
  //   playLocust(ctx, w, h)      蝗灾：蝗虫群遮天蔽日
  //   playSnowstorm(ctx, w, h)   暴风雪：雪花加大+冰雾
  // 性能：粒子走对象池 _getParticle/_pushParticle；灾害 FX 列表上限 8；
  //       灾害专属粒子预算 120；距离衰减按 _disasterFocus 计算；
  //       持续粒子生成按 dt 节流，避免每帧瞬时爆发。
  // ============================================================

  // 由 map.js 每帧调用：设置灾害效果距离衰减中心与半径
  setDisasterFocus(x, y, radius) {
    this._disasterFocus.x = x || 0;
    this._disasterFocus.y = y || 0;
    if (radius && radius > 0) this._disasterFocusRadius = radius;
  }

  // 距离衰减系数：0（远）~1（近焦点）。无焦点信息时恒为 1。
  _disasterIntensityAt(x, y) {
    const dx = x - this._disasterFocus.x;
    const dy = y - this._disasterFocus.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const r = this._disasterFocusRadius || 600;
    const f = 1 - d / r;
    return f < 0 ? 0 : (f > 1 ? 1 : f);
  }

  // 推入灾害 FX（带上限保护，超出淘汰最老）
  _pushDisasterFX(fx) {
    if (this._disasterFXs.length >= this._disasterFXCap) this._disasterFXs.shift();
    fx.t = 0;
    if (fx.seed == null) fx.seed = Math.random() * 1000;
    if (fx.intensity == null) fx.intensity = 1;
    this._disasterFXs.push(fx);
  }

  // 剩余震屏偏移（地震期间）。无震屏返回 0。
  getDisasterShakeOffset() {
    if (this._disasterShakeDur <= 0) return { dx: 0, dy: 0 };
    const decay = Math.max(0, this._disasterShakeDur);
    const m = this._disasterShakeMag * decay;
    return { dx: (Math.random() * 2 - 1) * m, dy: (Math.random() * 2 - 1) * m };
  }

  // ---- 地震：全屏震动 + 地面裂缝 + 建筑摇晃 + 碎石飞溅 ----
  // w/h：画布尺寸。震屏 1.2s，裂缝 FX 持续 2.5s，碎石一次性爆发。
  playEarthquake(ctx, w, h) {
    w = w || 900; h = h || 600;
    this._pushDisasterFX({ type: 'earthquake', x: w / 2, y: h / 2, w, h, dur: 2.5 });
    // 震屏
    this._disasterShakeMag = 4;
    this._disasterShakeDur = 1.2;
    // 碎石飞溅（地面烟尘 + 土块）
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 18; i++) {
      const s = this._getParticle();
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      Object.assign(s, { type: 'quake_debris',
        x: cx + (Math.random() - 0.5) * w * 0.6,
        y: cy + (Math.random() - 0.5) * h * 0.4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        gravity: 220, drag: 0.5,
        life: 0.8 + Math.random() * 0.6, maxLife: 1.4,
        size: 2 + Math.random() * 3.5,
        color: Math.random() < 0.5 ? '#6a5a48' : '#8a7a66',
        seed: Math.random() * 10 });
      this._pushParticle(s);
    }
    // 地面烟尘
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'dust',
        x: Math.random() * w, y: h * 0.6 + Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25,
        gravity: -5, drag: 0.3,
        life: 0.9 + Math.random() * 0.6, maxLife: 1.5,
        size: 6 + Math.random() * 8, color: '#7a6a55' });
      this._pushParticle(s);
    }
  }

  // ---- 洪水：水流涌入 + 波纹扩散 + 漂浮物 ----
  // x,y：洪水中心（通常是被淹城市屏幕坐标）。
  playFlood(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushDisasterFX({ type: 'flood', x, y, dur: 3.5 });
    // 初始水涌：一圈扩散波纹 + 水花
    for (let i = 0; i < 4; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'ripple',
        x, y: y + i * 2, vx: 0, vy: 0,
        gravity: 0, drag: 0,
        life: 1.4 + i * 0.3, maxLife: 1.4 + i * 0.3,
        size: 8 + i * 6, color: '#4a9ad8' });
      this._pushParticle(s);
    }
    // 漂浮木/物
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'flood_float',
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 24, vy: -4 - Math.random() * 6,
        gravity: 0, drag: 0.1,
        life: 2.5 + Math.random(), maxLife: 3.5,
        size: 3 + Math.random() * 4, color: '#7a5a3a',
        seed: Math.random() * 10 });
      this._pushParticle(s);
    }
  }

  // ---- 干旱：土地干裂 + 枯黄植物 ----
  // x,y：干旱中心。
  playDrought(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushDisasterFX({ type: 'drought', x, y, dur: 4.0 });
    // 干裂扬尘（暖黄色，缓慢上升）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'drought_wither',
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 8,
        gravity: -2, drag: 0.2,
        life: 2.0 + Math.random() * 1.2, maxLife: 3.2,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#b89a4a' : '#8a6a2a',
        seed: Math.random() * 10 });
      this._pushParticle(s);
    }
  }

  // ---- 瘟疫：绿色雾气 + 病弱士兵 ----
  // x,y：瘟疫中心（城市坐标）。
  playPlague(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushDisasterFX({ type: 'plague', x, y, dur: 4.5 });
    // 绿色毒雾（半透明，上升飘散）
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'plague_mist',
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 10,
        gravity: -4, drag: 0.15,
        life: 2.2 + Math.random() * 1.5, maxLife: 3.7,
        size: 10 + Math.random() * 12,
        color: Math.random() < 0.5 ? 'rgba(90,200,90,0.55)' : 'rgba(120,220,120,0.45)' });
      this._pushParticle(s);
    }
    // 病弱士兵（绿色半透明小人，踉跄）
    for (let i = 0; i < 5; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'plague_sick',
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 16, vy: -2 - Math.random() * 4,
        gravity: 0, drag: 0.2,
        life: 2.5 + Math.random(), maxLife: 3.5,
        size: 2.4, color: '#6aaa5a', seed: Math.random() * 100 });
      this._pushParticle(s);
    }
  }

  // ---- 蝗灾：蝗虫群遮天蔽日 ----
  // w/h：画布尺寸。蝗虫从一侧横扫，遮顶。
  playLocust(ctx, w, h) {
    w = w || 900; h = h || 600;
    this._pushDisasterFX({ type: 'locust', x: w / 2, y: h / 3, w, h, dur: 5.0 });
    // 初始虫群一次性铺满屏幕上半部
    this._spawnLocustBurst(w, h, 24);
  }

  // ---- 暴风雪：雪花加大 + 冰雾 ----
  // w/h：画布尺寸。
  playSnowstorm(ctx, w, h) {
    w = w || 900; h = h || 600;
    this._pushDisasterFX({ type: 'snowstorm', x: w / 2, y: h / 2, w, h, dur: 4.5 });
    // 冰雾（淡青白色，弥漫）
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'snowstorm_fog',
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 8,
        gravity: 0, drag: 0.05,
        life: 2.5 + Math.random() * 1.5, maxLife: 4.0,
        size: 14 + Math.random() * 16, color: 'rgba(220,240,255,0.35)' });
      this._pushParticle(s);
    }
  }

  // 蝗虫爆发一波（从左向右飞入，遮顶）
  _spawnLocustBurst(w, h, count) {
    count = Math.min(count, 30); // 单次硬上限
    for (let i = 0; i < count; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'locust_bug',
        x: -10 - Math.random() * 60,
        y: Math.random() * h * 0.55,
        vx: 180 + Math.random() * 140,
        vy: (Math.random() - 0.5) * 40,
        gravity: 0, drag: 0,
        life: 3.5 + Math.random() * 1.5, maxLife: 5.0,
        size: 1.8 + Math.random() * 2.2,
        color: Math.random() < 0.5 ? '#5a4a2a' : '#7a6a3a',
        seed: Math.random() * 100 });
      this._pushParticle(s);
    }
  }

  // 灾害 FX 时间线推进 + 持续粒子生成（按 dt 节流）
  _updateDisasterFXs(dt) {
    if (!dt || dt <= 0) return;
    for (let i = this._disasterFXs.length - 1; i >= 0; i--) {
      const fx = this._disasterFXs[i];
      fx.t += dt;
      if (fx.t >= fx.dur) { this._disasterFXs.splice(i, 1); continue; }
      // 距离衰减：远离焦点则降低生成速率与强度
      const inten = fx.intensity * this._disasterIntensityAt(fx.x, fx.y);
      if (inten <= 0.05) continue;
      // 持续粒子生成（按 dt 节流，每 ~0.12s 生成一批）
      this._disasterEmitAcc += dt * inten;
      const step = 0.12;
      if (this._disasterEmitAcc >= step) {
        this._disasterEmitAcc = 0;
        this._spawnDisasterAmbient(fx, inten);
      }
    }
  }

  // 按 FX 类型生成持续灾害氛围粒子
  _spawnDisasterAmbient(fx, inten) {
    const cap = this._disasterParticleBudget;
    // 估算灾害粒子数量（粗略）：只统计 _disaster 标记粒子
    let counted = 0;
    for (const p of this.particles) {
      if (p._disaster) counted++;
    }
    if (counted >= cap) return;
    const n = Math.max(1, Math.round(2 * inten));
    switch (fx.type) {
      case 'earthquake': {
        // 余震碎石
        for (let k = 0; k < n; k++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'quake_debris', _disaster: true,
            x: fx.x + (Math.random() - 0.5) * fx.w * 0.7,
            y: fx.y + (Math.random() - 0.5) * fx.h * 0.3,
            vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 60,
            gravity: 200, drag: 0.4,
            life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
            size: 1.5 + Math.random() * 2.5, color: '#6a5a48', seed: Math.random() * 10 });
          this._pushParticle(s);
        }
        break;
      }
      case 'flood': {
        // 持续波纹
        for (let k = 0; k < n; k++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'ripple', _disaster: true,
            x: fx.x + (Math.random() - 0.5) * 30,
            y: fx.y + (Math.random() - 0.5) * 10,
            vx: 0, vy: 0, gravity: 0, drag: 0,
            life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
            size: 6 + Math.random() * 8, color: '#4a9ad8' });
          this._pushParticle(s);
        }
        break;
      }
      case 'drought': {
        // 干裂扬尘
        for (let k = 0; k < n; k++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'drought_wither', _disaster: true,
            x: fx.x + (Math.random() - 0.5) * 40,
            y: fx.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 6,
            gravity: -1, drag: 0.2,
            life: 1.6 + Math.random() * 1.0, maxLife: 2.6,
            size: 1.5 + Math.random() * 2.5,
            color: Math.random() < 0.5 ? '#b89a4a' : '#8a6a2a',
            seed: Math.random() * 10 });
          this._pushParticle(s);
        }
        break;
      }
      case 'plague': {
        // 毒雾
        for (let k = 0; k < n; k++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'plague_mist', _disaster: true,
            x: fx.x + (Math.random() - 0.5) * 36,
            y: fx.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 8,
            gravity: -3, drag: 0.15,
            life: 1.8 + Math.random() * 1.2, maxLife: 3.0,
            size: 8 + Math.random() * 10,
            color: Math.random() < 0.5 ? 'rgba(90,200,90,0.5)' : 'rgba(120,220,120,0.4)' });
          this._pushParticle(s);
        }
        break;
      }
      case 'locust': {
        // 持续补虫（从左入）
        this._spawnLocustBurst(fx.w, fx.h, Math.max(1, Math.round(3 * inten)));
        break;
      }
      case 'snowstorm': {
        // 加大雪花 + 冰雾
        for (let k = 0; k < n; k++) {
          const s = this._getParticle();
          Object.assign(s, { type: 'snowstorm_flake', _disaster: true,
            x: Math.random() * fx.w, y: -8,
            vx: -30 - Math.random() * 30, vy: 120 + Math.random() * 80,
            gravity: 0, drag: 0,
            life: 3 + Math.random() * 2, maxLife: 5,
            size: 2.5 + Math.random() * 3.5, color: '#ffffff',
            seed: Math.random() * 100 });
          this._pushParticle(s);
        }
        break;
      }
    }
  }

  // ---- 绘制所有激活的灾害 FX（外部 render 循环调用）----
  drawDisasterFX(ctx) {
    if (!ctx || this._disasterFXs.length === 0) return;
    ctx.save();
    for (const fx of this._disasterFXs) {
      const p = fx.t / fx.dur;
      if (p < 0 || p > 1) continue;
      const inten = fx.intensity * this._disasterIntensityAt(fx.x, fx.y);
      if (inten <= 0.03) continue;
      switch (fx.type) {
        case 'earthquake': this._drawQuakeGround(ctx, fx, p, inten); break;
        case 'flood': this._drawFloodWater(ctx, fx, p, inten); break;
        case 'drought': this._drawDroughtCrack(ctx, fx, p, inten); break;
        case 'plague': this._drawPlagueMist(ctx, fx, p, inten); break;
        case 'locust': this._drawLocustSky(ctx, fx, p, inten); break;
        case 'snowstorm': this._drawSnowstormFog(ctx, fx, p, inten); break;
      }
    }
    ctx.restore();
  }

  // 地震：地面裂缝（锯齿折线从中心蔓延）+ 红色警示尘幕
  _drawQuakeGround(ctx, fx, p, inten) {
    const alpha = (p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3) * 0.8 * inten;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(30,20,10,0.9)';
    ctx.lineWidth = 2.5;
    const cx = fx.x, cy = fx.y;
    const maxR = Math.min(fx.w, fx.h) * 0.35 * p;
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2 + fx.seed;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let lx = cx, ly = cy;
      for (let i = 1; i <= 5; i++) {
        const f = i / 5;
        lx = cx + Math.cos(ang) * maxR * f + Math.sin(fx.seed + b * 3 + i * 1.7) * 6;
        ly = cy + Math.sin(ang) * maxR * f + Math.cos(fx.seed + b * 2 + i) * 6;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    // 建筑摇晃提示：中心区域轻微抖动矩形
    ctx.strokeStyle = 'rgba(80,50,30,0.6)';
    ctx.lineWidth = 1.5;
    const jx = (Math.random() - 0.5) * 3 * inten;
    const jy = (Math.random() - 0.5) * 2 * inten;
    ctx.strokeRect(cx - 14 + jx, cy - 18 + jy, 28, 22);
    ctx.restore();
  }

  // 洪水：蓝色半透明水幕覆盖 + 边缘波纹
  _drawFloodWater(ctx, fx, p, inten) {
    const alpha = Math.min(0.55, p * 0.8) * inten;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(fx.x, fx.y, 4, fx.x, fx.y, 70);
    g.addColorStop(0, 'rgba(80,160,220,0.85)');
    g.addColorStop(1, 'rgba(60,130,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 70, 0, Math.PI * 2); ctx.fill();
    // 边缘流动波纹
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#a8d8f0';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const rr = 24 + i * 18 + Math.sin(this.time * 4 + i) * 3;
      ctx.beginPath();
      ctx.ellipse(fx.x, fx.y, rr, rr * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 干旱：棕色龟裂地面（网状裂纹）+ 枯黄光斑
  _drawDroughtCrack(ctx, fx, p, inten) {
    const alpha = (0.4 + p * 0.4) * inten;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 地面枯黄底色
    ctx.fillStyle = 'rgba(180,140,70,0.35)';
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 46, 18, 0, 0, Math.PI * 2); ctx.fill();
    // 网状干裂
    ctx.strokeStyle = 'rgba(80,50,20,0.8)';
    ctx.lineWidth = 1.2;
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2 + fx.seed;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      let lx = fx.x, ly = fx.y;
      for (let i = 1; i <= 3; i++) {
        lx = fx.x + Math.cos(ang) * (10 + i * 8) + Math.sin(fx.seed + b * 2 + i) * 3;
        ly = fx.y + Math.sin(ang) * (4 + i * 4) + Math.cos(fx.seed + b + i) * 2;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 瘟疫：绿色雾气笼罩（多层半透明绿团）
  _drawPlagueMist(ctx, fx, p, inten) {
    const alpha = (0.35 + 0.3 * Math.sin(this.time * 2 + fx.seed)) * inten;
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, alpha);
    for (let i = 0; i < 4; i++) {
      const r = 14 + i * 8;
      const ox = Math.sin(this.time * 1.2 + i * 1.3 + fx.seed) * 6;
      const oy = -i * 4;
      const g = ctx.createRadialGradient(fx.x + ox, fx.y + oy, 2, fx.x + ox, fx.y + oy, r);
      g.addColorStop(0, 'rgba(90,200,90,0.5)');
      g.addColorStop(1, 'rgba(60,160,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx.x + ox, fx.y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 蝗灾：顶部深色遮幕 + 飞掠阴影
  _drawLocustSky(ctx, fx, p, inten) {
    // 遮顶暗幕（从顶部向下渐隐）
    const alpha = Math.sin(p * Math.PI) * 0.35 * inten;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, fx.h * 0.6);
    g.addColorStop(0, `rgba(40,30,10,${alpha})`);
    g.addColorStop(1, 'rgba(40,30,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, fx.w, fx.h * 0.6);
    ctx.restore();
  }

  // 暴风雪：淡青白弥漫雾层
  _drawSnowstormFog(ctx, fx, p, inten) {
    const alpha = 0.18 * inten;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(fx.x, fx.y, 10, fx.x, fx.y, Math.min(fx.w, fx.h) * 0.6);
    g.addColorStop(0, 'rgba(230,245,255,0.6)');
    g.addColorStop(1, 'rgba(230,245,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, Math.min(fx.w, fx.h) * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ============================================================
  // V21.0 — 动画与地图增强：丝绸之路动画 + 家族动画
  // ------------------------------------------------------------
  // 公共 API：
  //   playCaravanMarch(ctx, x1, y1, x2, y2)  商队沿丝路行进（骆驼/马队+尘土）
  //   playSilkRoadTrade(ctx, x, y, goodsType) 丝路贸易完成（金币/宝石/香料粒子）
  //   playCaravanRaided(ctx, x, y)            商队被劫（战斗+烟雾+货物散落）
  //   playStationBuilt(ctx, x, y)             驿站建成（旗帜升起+建筑完成）
  //   playMarriageSuccess(ctx, x, y)          联姻成功（红绸+花灯+同心结）
  //   playFamilyBirth(ctx, x, y)              家族成员出生（婴儿光效+祥云）
  //   playFamilyDeath(ctx, x, y)               家族成员去世（白幡+落叶+丧钟）
  // 性能：粒子走 _getParticle/_pushParticle 对象池；FX 列表硬上限；
  //       专属粒子预算独立统计；持续粒子按 dt 节流；行进时长按距离自适应。
  // ============================================================

  // 推入丝路 FX（带上限保护，超出淘汰最老）
  _pushSilkFX(fx) {
    if (this._silkFXs.length >= this._silkFXCap) this._silkFXs.shift();
    fx.t = 0;
    if (fx.seed == null) fx.seed = Math.random() * 1000;
    this._silkFXs.push(fx);
  }

  // 推入家族 FX（带上限保护，超出淘汰最老）
  _pushFamilyFX(fx) {
    if (this._familyFXs.length >= this._familyFXCap) this._familyFXs.shift();
    fx.t = 0;
    if (fx.seed == null) fx.seed = Math.random() * 1000;
    this._familyFXs.push(fx);
  }

  // 统计专属标记粒子数量（预算保护用）
  _countTaggedParticles(tag) {
    let n = 0;
    for (const p of this.particles) if (p[tag]) n++;
    return n;
  }

  // ---- 商队行进：骆驼/马队沿 (x1,y1)->(x2,y2) 移动，时长按距离自适应 ----
  playCaravanMarch(ctx, x1, y1, x2, y2) {
    x1 = x1 || 0; y1 = y1 || 0; x2 = x2 || 0; y2 = y2 || 0;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    // 距离越远走得越久，限制在 1.8~4.5 秒之间
    const dur = Math.max(1.8, Math.min(4.5, dist / 110));
    this._pushSilkFX({ type: 'march', x1, y1, x2, y2, dur });
    // 出发处一阵起步尘土
    for (let i = 0; i < 5; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'silk_dust', _silk: true,
        x: x1 + (Math.random() - 0.5) * 16, y: y1 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10,
        gravity: -4, drag: 0.3,
        life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
        size: 3 + Math.random() * 4, color: '#b89a6a' });
      this._pushParticle(s);
    }
  }

  // ---- 丝路贸易完成：按货物类型喷金/宝石/香料粒子 ----
  // goodsType: 'gold' | 'gem' | 'spice'（缺省 gold）
  playSilkRoadTrade(ctx, x, y, goodsType) {
    x = x || 0; y = y || 0;
    const gt = String(goodsType || 'gold').toLowerCase();
    this._pushSilkFX({ type: 'trade', x, y, goodsType: gt, dur: 1.6 });
    // 一次性爆发货物粒子
    let colors, count, upBias;
    if (gt === 'gem') {
      colors = ['#7fe0d0', '#a88aff', '#ff8ad0', '#8affc0']; count = 16; upBias = 90;
    } else if (gt === 'spice') {
      colors = ['#d8a04a', '#a86a2a', '#e8c060', '#8a5a2a']; count = 14; upBias = 60;
    } else {
      colors = ['#FFD700', '#fff2b0', '#ffcf40', '#f0e090']; count = 18; upBias = 110;
    }
    for (let i = 0; i < count; i++) {
      const s = this._getParticle();
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      Object.assign(s, { type: 'silk_goods', _silk: true,
        x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - upBias,
        gravity: 160, drag: 0.4,
        life: 0.8 + Math.random() * 0.7, maxLife: 1.5,
        size: 2 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        seed: Math.random() * 10 });
      this._pushParticle(s);
    }
    // 贸易完成光环（扩散圆环）
    const ring = this._getParticle();
    Object.assign(ring, { type: 'silk_trade_ring', x, y, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 1.2, maxLife: 1.2, size: 6,
      color: gt === 'gem' ? '#8affc0' : (gt === 'spice' ? '#e8c060' : '#FFD700') });
    this._pushParticle(ring);
  }

  // ---- 商队被劫：战斗火花 + 黑烟 + 货物散落 ----
  playCaravanRaided(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushSilkFX({ type: 'raid', x, y, dur: 2.2 });
    // 战斗红橙火花
    this.spawnParticle(x, y, 'spark_burst');
    // 黑烟团（半透明灰黑，上升飘散）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'silk_smoke', _silk: true,
        x: x + (Math.random() - 0.5) * 22, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 16, vy: -18 - Math.random() * 14,
        gravity: -6, drag: 0.2,
        life: 1.6 + Math.random() * 1.0, maxLife: 2.6,
        size: 7 + Math.random() * 9,
        color: Math.random() < 0.5 ? 'rgba(50,45,40,0.6)' : 'rgba(80,72,64,0.5)' });
      this._pushParticle(s);
    }
    // 散落货物（木箱/布袋，抛物下落）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'silk_cargo', _silk: true,
        x: x + (Math.random() - 0.5) * 14, y: y - 6,
        vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 70,
        gravity: 220, drag: 0.3,
        life: 1.2 + Math.random() * 0.6, maxLife: 1.8,
        size: 2.5 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#8a6a3a' : '#a8854a',
        seed: Math.random() * 10 });
      this._pushParticle(s);
    }
  }

  // ---- 驿站建成：旗帜升起 + 建筑完成光效 ----
  playStationBuilt(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushSilkFX({ type: 'station', x, y, dur: 2.0 });
    // 落成金色碎屑
    for (let i = 0; i < 10; i++) {
      const s = this._getParticle();
      const a = Math.random() * Math.PI * 2;
      Object.assign(s, { type: 'silk_gold', _silk: true,
        x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(a) * 30, vy: -40 - Math.random() * 50,
        gravity: 90, drag: 0.3,
        life: 0.9 + Math.random() * 0.6, maxLife: 1.5,
        size: 1.8 + Math.random() * 2, color: '#FFD700' });
      this._pushParticle(s);
    }
  }

  // ---- 联姻成功：红色彩带 + 花灯 + 同心结 ----
  playMarriageSuccess(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushFamilyFX({ type: 'marriage', x, y, dur: 2.6 });
    // 红色彩带飘落
    for (let i = 0; i < 14; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fam_ribbon', _family: true,
        x: x + (Math.random() - 0.5) * 60, y: y - 30 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 30, vy: 18 + Math.random() * 22,
        gravity: 6, drag: 0.1,
        life: 1.8 + Math.random() * 1.0, maxLife: 2.8,
        size: 2.5 + Math.random() * 2,
        color: Math.random() < 0.6 ? '#d83a3a' : '#ff6a5a',
        angle: Math.random() * Math.PI * 2, seed: Math.random() * 10 });
      this._pushParticle(s);
    }
    // 暖红灯花（向上漂浮发光）
    for (let i = 0; i < 6; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fam_lantern', _family: true,
        x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 12, vy: -16 - Math.random() * 12,
        gravity: -3, drag: 0.1,
        life: 1.6 + Math.random() * 0.8, maxLife: 2.4,
        size: 3 + Math.random() * 2, color: '#ffb04a', seed: Math.random() * 100 });
      this._pushParticle(s);
    }
  }

  // ---- 家族成员出生：婴儿柔光 + 祥云 ----
  playFamilyBirth(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushFamilyFX({ type: 'birth', x, y, dur: 2.4 });
    // 柔和金光（婴儿光晕）
    const glow = this._getParticle();
    Object.assign(glow, { type: 'fam_baby_glow', x, y, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 1.6, maxLife: 1.6, size: 8, color: '#fff2c0' });
    this._pushParticle(glow);
    // 白色祥云团（蓬松上升）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fam_cloud', _family: true,
        x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 8,
        gravity: -2, drag: 0.1,
        life: 1.8 + Math.random() * 0.8, maxLife: 2.6,
        size: 8 + Math.random() * 8,
        color: Math.random() < 0.5 ? 'rgba(255,250,235,0.7)' : 'rgba(255,245,220,0.6)' });
      this._pushParticle(s);
    }
    // 金粉星星（细碎闪光上飘）
    for (let i = 0; i < 8; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fam_sparkle', _family: true,
        x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 16, vy: -20 - Math.random() * 16,
        gravity: -2, drag: 0.2,
        life: 1.2 + Math.random() * 0.8, maxLife: 2.0,
        size: 1.5 + Math.random() * 1.5, color: '#ffe9a8' });
      this._pushParticle(s);
    }
  }

  // ---- 家族成员去世：白幡 + 落叶 + 丧钟 ----
  playFamilyDeath(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushFamilyFX({ type: 'death', x, y, dur: 2.8 });
    // 灰白落叶/纸钱（缓缓飘落）
    for (let i = 0; i < 14; i++) {
      const s = this._getParticle();
      Object.assign(s, { type: 'fam_leaf', _family: true,
        x: x + (Math.random() - 0.5) * 50, y: y - 20 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 18, vy: 14 + Math.random() * 16,
        gravity: 4, drag: 0.15,
        life: 2.0 + Math.random() * 1.2, maxLife: 3.2,
        size: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#d8d0c0' : '#b0a898',
        angle: Math.random() * Math.PI * 2, seed: Math.random() * 10 });
      this._pushParticle(s);
    }
    // 丧钟暗灰光环（低沉灰雾扩散）
    const bell = this._getParticle();
    Object.assign(bell, { type: 'fam_bell_ring', x, y, vx: 0, vy: 0,
      gravity: 0, drag: 0, life: 2.0, maxLife: 2.0, size: 6, color: '#8a8578' });
    this._pushParticle(bell);
  }

  // ---- 丝路 FX 时间线推进 + 持续粒子生成（行军途中持续尘土）----
  _updateSilkFXs(dt) {
    if (!dt || dt <= 0) return;
    for (let i = this._silkFXs.length - 1; i >= 0; i--) {
      const fx = this._silkFXs[i];
      fx.t += dt;
      if (fx.t >= fx.dur) { this._silkFXs.splice(i, 1); continue; }
      // 行军途中持续撒尘土（按 dt 节流，受预算保护）
      if (fx.type === 'march') {
        this._silkEmitAcc += dt;
        const step = 0.18;
        if (this._silkEmitAcc >= step) {
          this._silkEmitAcc = 0;
          if (this._countTaggedParticles('_silk') < this._silkParticleBudget) {
            const prog = fx.t / fx.dur;
            const cx = fx.x1 + (fx.x2 - fx.x1) * prog;
            const cy = fx.y1 + (fx.y2 - fx.y1) * prog;
            const s = this._getParticle();
            Object.assign(s, { type: 'silk_dust', _silk: true,
              x: cx + (Math.random() - 0.5) * 10, y: cy + 2,
              vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 6,
              gravity: -3, drag: 0.3,
              life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
              size: 2.5 + Math.random() * 3, color: '#b89a6a' });
            this._pushParticle(s);
          }
        }
      }
    }
  }

  // ---- 家族 FX 时间线推进 ----
  _updateFamilyFXs(dt) {
    if (!dt || dt <= 0) return;
    for (let i = this._familyFXs.length - 1; i >= 0; i--) {
      const fx = this._familyFXs[i];
      fx.t += dt;
      if (fx.t >= fx.dur) this._familyFXs.splice(i, 1);
    }
  }

  // ---- 绘制所有激活的丝路 FX（map.js 每帧调用）----
  drawSilkFX(ctx) {
    if (!ctx || this._silkFXs.length === 0) return;
    ctx.save();
    for (const fx of this._silkFXs) {
      const p = fx.t / fx.dur;
      if (p < 0 || p > 1) continue;
      switch (fx.type) {
        case 'march': this._drawMarchCaravan(ctx, fx, p); break;
        case 'trade': this._drawTradeBurst(ctx, fx, p); break;
        case 'raid': this._drawRaidScene(ctx, fx, p); break;
        case 'station': this._drawStationBuilt(ctx, fx, p); break;
      }
    }
    ctx.restore();
  }

  // 行进中的骆驼商队剪影（沿路线插值，带起伏步态）
  _drawMarchCaravan(ctx, fx, p) {
    const cx = fx.x1 + (fx.x2 - fx.x1) * p;
    const cy = fx.y1 + (fx.y2 - fx.y1) * p;
    const dirX = fx.x2 - fx.x1;
    const dirY = fx.y2 - fx.y1;
    const ang = Math.atan2(dirY, dirX);
    const walking = Math.sin(this.time * 10 + fx.seed);
    ctx.save();
    ctx.translate(cx, cy + walking * 1.2);
    ctx.rotate(0); // 等距俯视角不旋转，保持剪影
    // 3 头骆驼/马，前后错落
    for (let i = 0; i < 3; i++) {
      const back = i * 5;
      const bx = -Math.cos(ang) * back;
      const by = -Math.sin(ang) * back * 0.5;
      ctx.save();
      ctx.translate(bx, by + Math.sin(this.time * 10 + fx.seed + i * 1.3) * 1.0);
      ctx.fillStyle = i === 1 ? '#6a4a2a' : '#7a5a3a';
      // 身体（双驼峰轮廓）
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); // 双峰
      ctx.arc(-1.8, -1.8, 1.5, 0, Math.PI * 2);
      ctx.arc(1.8, -1.8, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // 头
      ctx.beginPath();
      ctx.arc(4.2, -1.2, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 贸易完成：扩散金光圆环 + 货物色晕
  _drawTradeBurst(ctx, fx, p) {
    const colors = { gold: '#FFD700', gem: '#8affc0', spice: '#e8c060' };
    const col = colors[fx.goodsType] || '#FFD700';
    ctx.save();
    // 扩散圆环（ease-out）
    const rr = 8 + p * 46 * (1 - p * 0.3);
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5 * (1 - p) + 0.5;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, rr, rr * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    // 中心光晕
    ctx.globalAlpha = (1 - p) * 0.5;
    const g = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, 30);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 被劫：红闪 + 烟尘漩涡 + 散落物轮廓
  _drawRaidScene(ctx, fx, p) {
    ctx.save();
    // 红色战斗闪光（前 0.3s 快速闪过）
    if (p < 0.35) {
      ctx.globalAlpha = (1 - p / 0.35) * 0.6;
      ctx.fillStyle = '#ff4030';
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 16, 0, Math.PI * 2); ctx.fill();
    }
    // 烟灰漩涡（半透明灰团旋升）
    ctx.globalAlpha = 0.5 * (1 - p);
    ctx.fillStyle = 'rgba(60,55,50,0.6)';
    for (let i = 0; i < 3; i++) {
      const ang = this.time * 2 + fx.seed + i * 2.1;
      const rr = 6 + i * 5;
      ctx.beginPath();
      ctx.arc(fx.x + Math.cos(ang) * rr * 0.6, fx.y - 6 - i * 5, 5 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 驿站建成：旗杆 + 红旗升起 + 底座建筑完成
  _drawStationBuilt(ctx, fx, p) {
    ctx.save();
    ctx.translate(fx.x, fx.y);
    // 底座（建筑轮廓随时间升高）
    const buildH = 10 * Math.min(1, p * 2);
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(-8, -buildH, 16, buildH);
    // 旗杆
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -buildH); ctx.lineTo(0, -buildH - 18); ctx.stroke();
    // 旗帜升起（从底部升到顶，带飘动）
    const flagProg = Math.min(1, Math.max(0, (p - 0.3) / 0.5));
    const flagY = -buildH - (1 - flagProg) * 16;
    if (flagProg > 0) {
      ctx.fillStyle = '#d83a3a';
      const wave = Math.sin(this.time * 8 + fx.seed) * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, flagY);
      ctx.lineTo(10 + wave, flagY + 2);
      ctx.lineTo(0, flagY + 5);
      ctx.closePath();
      ctx.fill();
    }
    // 完成闪光（最后阶段）
    if (p > 0.8) {
      ctx.globalAlpha = (p - 0.8) / 0.2 * 0.7;
      const g = ctx.createRadialGradient(0, -buildH - 8, 2, 0, -buildH - 8, 24);
      g.addColorStop(0, '#ffe9a8');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -buildH - 8, 24, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---- 绘制所有激活的家族 FX（map.js 每帧调用）----
  drawFamilyFX(ctx) {
    if (!ctx || this._familyFXs.length === 0) return;
    ctx.save();
    for (const fx of this._familyFXs) {
      const p = fx.t / fx.dur;
      if (p < 0 || p > 1) continue;
      switch (fx.type) {
        case 'marriage': this._drawMarriageFX(ctx, fx, p); break;
        case 'birth': this._drawBirthFX(ctx, fx, p); break;
        case 'death': this._drawDeathFX(ctx, fx, p); break;
      }
    }
    ctx.restore();
  }

  // 联姻：同心结（红色双环相扣）+ 光晕
  _drawMarriageFX(ctx, fx, p) {
    ctx.save();
    const fade = p < 0.2 ? p / 0.2 : (p > 0.8 ? (1 - p) / 0.2 : 1);
    ctx.globalAlpha = fade;
    // 光晕
    const g = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, 40);
    g.addColorStop(0, 'rgba(255,120,110,0.5)');
    g.addColorStop(1, 'rgba(255,120,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 40, 0, Math.PI * 2); ctx.fill();
    // 同心结：两个相扣的红环
    ctx.strokeStyle = '#e03030';
    ctx.lineWidth = 2.5;
    const s = 1 + Math.sin(p * Math.PI) * 0.2; // 呼吸放大
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(-6, 0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // 出生：婴儿柔光 + 祥云托举
  _drawBirthFX(ctx, fx, p) {
    ctx.save();
    const fade = p < 0.2 ? p / 0.2 : (p > 0.8 ? (1 - p) / 0.2 : 1);
    ctx.globalAlpha = fade;
    // 中心暖光
    const g = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, 30);
    g.addColorStop(0, 'rgba(255,245,200,0.85)');
    g.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 30, 0, Math.PI * 2); ctx.fill();
    // 底部祥云（两朵蓬松云团）
    ctx.fillStyle = 'rgba(255,252,240,0.8)';
    for (let i = 0; i < 2; i++) {
      const ox = (i - 0.5) * 18;
      ctx.beginPath();
      ctx.arc(fx.x + ox, fx.y + 8, 7, 0, Math.PI * 2);
      ctx.arc(fx.x + ox + 5, fx.y + 6, 5, 0, Math.PI * 2);
      ctx.arc(fx.x + ox - 5, fx.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 去世：白幡垂挂 + 灰雾
  _drawDeathFX(ctx, fx, p) {
    ctx.save();
    const fade = p < 0.2 ? p / 0.2 : (p > 0.8 ? (1 - p) / 0.2 : 1);
    ctx.globalAlpha = fade * 0.9;
    // 低沉灰雾
    const g = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, 36);
    g.addColorStop(0, 'rgba(150,145,135,0.5)');
    g.addColorStop(1, 'rgba(150,145,135,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 36, 0, Math.PI * 2); ctx.fill();
    // 两侧白幡（三角幡布随微风摆动）
    ctx.fillStyle = 'rgba(240,238,232,0.9)';
    for (let i = 0; i < 2; i++) {
      const sx = (i === 0 ? -1 : 1) * 14;
      const sway = Math.sin(this.time * 2 + fx.seed + i) * 2;
      ctx.beginPath();
      ctx.moveTo(fx.x + sx, fx.y - 18);
      ctx.lineTo(fx.x + sx + sway + (i === 0 ? 6 : -6), fx.y - 6);
      ctx.lineTo(fx.x + sx, fx.y - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // V22.0 — 科举动画（放榜 / 状元游街 / 同年宴 / 落第）
  //        选官动画（授官 / 考核 / 贬官）
  // 公共 API：
  //   playExamResults(ctx, w, h)              放榜（金榜展开 + 金光闪耀，全屏）
  //   playZhuangyuanParade(ctx, x, y)         状元游街（红袍骑马 + 百姓欢呼）
  //   playTongnianFeast(ctx, x, y)            同年宴（聚餐 + 酒杯碰撞 + 诗词）
  //   playFailedExam(ctx, x, y)               落第（书生叹息 + 飘落纸张）
  //   playAppointOffice(ctx, x, y)            授官（官印授予 + 彩带）
  //   playOfficialReview(ctx, x, y, passed)   考核（考卷 + 印章通过/不通过）
  //   playDemoteOffice(ctx, x, y)             贬官（官服脱下 + 叹息）
  // 性能：粒子走 _getParticle/_pushParticle 对象池，统一打 _exam 标记并受
  //       _examParticleBudget 预算保护；点 FX 列表 _examFXCap 硬上限；
  //       持续粒子（欢呼/宴饮）按 dt 节流生成；放榜全屏 FX 单例不重复叠加。
  // ============================================================

  // 推入科举/选观点 FX（带上限保护，超出淘汰最老）
  _pushExamFX(fx) {
    if (this._examFXs.length >= this._examFXCap) this._examFXs.shift();
    fx.t = 0;
    if (fx.seed == null) fx.seed = Math.random() * 1000;
    this._examFXs.push(fx);
  }

  // 科举/选观点状粒子爆发（对象池 + 专属预算保护）
  _examBurst(x, y, count, opts) {
    for (let i = 0; i < count; i++) {
      if (this._countTaggedParticles('_exam') >= this._examParticleBudget) break;
      const s = this._getParticle();
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.minSpeed || 30) + Math.random() * (opts.spread || 120);
      Object.assign(s, {
        type: opts.type || 'exam_spark',
        _exam: true,
        x: x + (Math.random() - 0.5) * (opts.rangeX || 10),
        y: y + (Math.random() - 0.5) * (opts.rangeY || 10),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.upBias || 0),
        gravity: opts.gravity != null ? opts.gravity : 60,
        drag: opts.drag != null ? opts.drag : 0.4,
        life: (opts.lifeMin || 0.6) + Math.random() * ((opts.lifeMax || 1.3) - (opts.lifeMin || 0.6)),
        size: (opts.sizeMin || 1.6) + Math.random() * ((opts.sizeMax || 3.2) - (opts.sizeMin || 1.6)),
        color: Array.isArray(opts.colors)
          ? opts.colors[Math.floor(Math.random() * opts.colors.length)]
          : (opts.color || '#FFD700'),
        angle: Math.random() * Math.PI * 2,
        seed: Math.random() * 10
      });
      this._pushParticle(s);
    }
  }

  // ---- 放榜（全屏）：金榜展开 + 金光闪耀 ----
  // w/h：画布尺寸（缺省按 ctx.canvas 推断）
  playExamResults(ctx, w, h) {
    if (!w || w <= 0) w = (ctx && ctx.canvas && ctx.canvas.width) || 800;
    if (!h || h <= 0) h = (ctx && ctx.canvas && ctx.canvas.height) || 600;
    // 单例覆盖：新放榜替换旧的，避免多重叠
    this._examResultFX = {
      x: w / 2, y: h * 0.36, w, h,
      t: 0, dur: 3.8,
      seed: Math.random() * 1000
    };
    // 金榜金光：中心金色碎屑向上迸发 + 光柱底尘
    this._examBurst(w / 2, h * 0.36, 26, {
      colors: ['#FFD700', '#FFF3B0', '#FFE9A8', '#ffffff'],
      minSpeed: 30, spread: 150, upBias: 120, gravity: 70,
      lifeMin: 0.7, lifeMax: 1.6, sizeMin: 1.6, sizeMax: 3.4
    });
    this._examBurst(w / 2, h * 0.5, 12, {
      colors: ['#FFD700', '#FFE9A8'],
      minSpeed: 8, spread: 30, upBias: 100, gravity: -10,
      lifeMin: 0.9, lifeMax: 1.8, sizeMin: 1, sizeMax: 2.4
    });
  }

  // ---- 状元游街：红袍状元骑马游街 + 百姓欢呼 ----
  playZhuangyuanParade(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'parade', x, y, dur: 3.0 });
    // 红绸彩带 + 欢呼花瓣
    this._examBurst(x, y - 10, 16, {
      colors: ['#e03030', '#ff6a5a', '#ffd76a'],
      minSpeed: 20, spread: 110, upBias: 80, gravity: 50,
      drag: 0.2, lifeMin: 1.0, lifeMax: 2.0, sizeMin: 2, sizeMax: 3
    });
    // 欢呼金纸屑
    this._examBurst(x, y - 16, 10, {
      colors: ['#FFD700', '#fff2b0'],
      minSpeed: 40, spread: 90, upBias: 130, gravity: 120,
      lifeMin: 0.6, lifeMax: 1.2, sizeMin: 1.4, sizeMax: 2.4
    });
  }

  // ---- 同年宴：聚餐 + 酒杯碰撞 + 诗词 ----
  playTongnianFeast(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'feast', x, y, dur: 2.8 });
    // 酒花金珠（杯中溅起）
    this._examBurst(x, y - 8, 12, {
      colors: ['#ffcf40', '#fff2b0', '#ffe9a8'],
      minSpeed: 20, spread: 70, upBias: 110, gravity: 150,
      lifeMin: 0.5, lifeMax: 1.0, sizeMin: 1.4, sizeMax: 2.4
    });
    // 席间落花（粉白缓落）
    this._examBurst(x, y - 20, 8, {
      colors: ['#ffd0d8', '#ffe6ec', '#fff0f3'],
      minSpeed: 8, spread: 24, upBias: 6, gravity: 14,
      drag: 0.1, lifeMin: 1.6, lifeMax: 2.6, sizeMin: 2, sizeMax: 3
    });
  }

  // ---- 落第：书生叹息 + 飘落纸张 ----
  playFailedExam(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'failed', x, y, dur: 2.8 });
    // 飘落试卷（灰白纸片，摇摆下落）
    for (let i = 0; i < 12; i++) {
      if (this._countTaggedParticles('_exam') >= this._examParticleBudget) break;
      const s = this._getParticle();
      Object.assign(s, { type: 'exam_paper', _exam: true,
        x: x + (Math.random() - 0.5) * 50, y: y - 30 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 16, vy: 16 + Math.random() * 18,
        gravity: 5, drag: 0.12,
        life: 2.0 + Math.random() * 1.2, maxLife: 3.2,
        size: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#e8e4da' : '#cfc9bc',
        angle: Math.random() * Math.PI * 2, seed: Math.random() * 10 });
      this._pushParticle(s);
    }
    // 叹息灰雾（低沉上升）
    const sigh = this._getParticle();
    Object.assign(sigh, { type: 'exam_sigh', _exam: true, x, y: y - 14,
      vx: 0, vy: -12, gravity: -2, drag: 0.2,
      life: 1.8, maxLife: 1.8, size: 7, color: 'rgba(150,148,140,0.5)' });
    this._pushParticle(sigh);
  }

  // ---- 授官：官印授予 + 彩带 ----
  playAppointOffice(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'appoint', x, y, dur: 2.6 });
    // 朱红彩带飘落
    this._examBurst(x, y - 16, 14, {
      colors: ['#d83a3a', '#ff7a6a', '#ffd76a'],
      minSpeed: 14, spread: 60, upBias: 10, gravity: 30,
      drag: 0.1, lifeMin: 1.6, lifeMax: 2.6, sizeMin: 2.2, sizeMax: 3.2
    });
    // 授印金光
    this._examBurst(x, y - 8, 10, {
      colors: ['#FFD700', '#fff2b0'],
      minSpeed: 30, spread: 90, upBias: 120, gravity: 90,
      lifeMin: 0.6, lifeMax: 1.2, sizeMin: 1.4, sizeMax: 2.4
    });
  }

  // ---- 考核：考卷 + 印章通过/不通过 ----
  // passed：true 取/通过（朱印），false 落/不通过（灰红印）
  playOfficialReview(ctx, x, y, passed) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'review', x, y, passed: !!passed, dur: 2.4 });
    if (passed) {
      // 通过：金色印泥溅点 + 绿光
      this._examBurst(x, y, 12, {
        colors: ['#FFD700', '#8affc0', '#fff2b0'],
        minSpeed: 24, spread: 80, upBias: 90, gravity: 80,
        lifeMin: 0.6, lifeMax: 1.2, sizeMin: 1.5, sizeMax: 2.6
      });
    } else {
      // 不通过：灰暗墨点 + 褐红
      this._examBurst(x, y, 10, {
        colors: ['#8a8578', '#6a5a4a', '#9a4a3a'],
        minSpeed: 18, spread: 60, upBias: 50, gravity: 70,
        lifeMin: 0.7, lifeMax: 1.3, sizeMin: 1.5, sizeMax: 2.4
      });
    }
  }

  // ---- 贬官：官服脱下 + 叹息 ----
  playDemoteOffice(ctx, x, y) {
    x = x || 0; y = y || 0;
    this._pushExamFX({ type: 'demote', x, y, dur: 2.6 });
    // 卸下的灰褐官服碎片（飘落）
    this._examBurst(x, y - 12, 10, {
      colors: ['#9a8f7a', '#7a6f5a', '#b0a898'],
      minSpeed: 10, spread: 40, upBias: 8, gravity: 26,
      drag: 0.1, lifeMin: 1.6, lifeMax: 2.6, sizeMin: 2, sizeMax: 3.2
    });
    // 一声叹息灰雾
    const sigh = this._getParticle();
    Object.assign(sigh, { type: 'exam_demote_sigh', _exam: true, x, y: y - 16,
      vx: 0, vy: -10, gravity: -2, drag: 0.2,
      life: 2.0, maxLife: 2.0, size: 8, color: 'rgba(120,118,110,0.5)' });
    this._pushParticle(sigh);
  }

  // ---- 科举/选观点 FX 时间线推进 + 持续粒子生成 ----
  _updateExamFXs(dt) {
    if (!dt || dt <= 0) return;
    for (let i = this._examFXs.length - 1; i >= 0; i--) {
      const fx = this._examFXs[i];
      fx.t += dt;
      if (fx.t >= fx.dur) { this._examFXs.splice(i, 1); continue; }
      // 游街途中百姓持续撒花/欢呼（按 dt 节流，受预算保护）
      if (fx.type === 'parade') {
        this._examEmitAcc += dt;
        const step = 0.22;
        if (this._examEmitAcc >= step) {
          this._examEmitAcc = 0;
          if (this._countTaggedParticles('_exam') < this._examParticleBudget) {
            this._examBurst(fx.x, fx.y - 6, 2, {
              colors: ['#ff6a5a', '#ffd76a'],
              minSpeed: 14, spread: 40, upBias: 70, gravity: 60,
              lifeMin: 0.6, lifeMax: 1.0, sizeMin: 1.6, sizeMax: 2.4
            });
          }
        }
      }
      // 同年宴席间持续飘落花
      if (fx.type === 'feast') {
        this._examEmitAcc += dt;
        const step = 0.3;
        if (this._examEmitAcc >= step) {
          this._examEmitAcc = 0;
          if (this._countTaggedParticles('_exam') < this._examParticleBudget) {
            this._examBurst(fx.x, fx.y - 22, 1, {
              colors: ['#ffd0d8', '#fff0f3'],
              minSpeed: 6, spread: 16, upBias: 4, gravity: 12,
              drag: 0.1, lifeMin: 1.4, lifeMax: 2.2, sizeMin: 2, sizeMax: 2.8
            });
          }
        }
      }
    }
  }

  // ---- 绘制所有激活的科举/选观点 FX（map.js 每帧调用）----
  drawExamFX(ctx) {
    if (!ctx || this._examFXs.length === 0) return;
    ctx.save();
    for (const fx of this._examFXs) {
      const p = fx.t / fx.dur;
      if (p < 0 || p > 1) continue;
      switch (fx.type) {
        case 'parade':  this._drawZhuangyuanParade(ctx, fx, p); break;
        case 'feast':   this._drawTongnianFeast(ctx, fx, p); break;
        case 'failed':  this._drawFailedExam(ctx, fx, p); break;
        case 'appoint': this._drawAppointOffice(ctx, fx, p); break;
        case 'review':  this._drawOfficialReview(ctx, fx, p); break;
        case 'demote':  this._drawDemoteOffice(ctx, fx, p); break;
      }
    }
    ctx.restore();
  }

  // ---- 放榜全屏覆盖层：金榜展开 + 金光闪耀（map.js 每帧调用）----
  drawExamResultsFX(ctx) {
    const fx = this._examResultFX;
    if (!fx || !ctx) return;
    const { x, y, w, h, t, dur } = fx;
    const p = t / dur;
    ctx.save();
    // 暗色帷幕淡入淡出
    const veil = p < 0.2 ? (p / 0.2) : (p > 0.8 ? (1 - p) / 0.2 : 1);
    ctx.fillStyle = `rgba(20,14,6,${0.55 * Math.max(0, Math.min(1, veil))})`;
    ctx.fillRect(0, 0, w, h);

    // 金榜展开：卷轴高度由 0 拉开（easeOutCubic），左右两轴卷起
    const openP = this._v15EaseOutCubic((p - 0.15) / 0.55);
    if (openP > 0) {
      const scrW = 180, scrH = 220;
      const drawH = scrH * openP;
      // 卷轴底（暗红绢布）
      ctx.fillStyle = '#7a2020';
      ctx.fillRect(x - scrW / 2, y - drawH / 2, scrW, drawH);
      // 绢面（金笺）
      ctx.fillStyle = '#f3e2a8';
      ctx.fillRect(x - scrW / 2 + 6, y - drawH / 2 + 6, scrW - 12, Math.max(0, drawH - 12));
      // 上下轴杆
      ctx.fillStyle = '#8a6a2a';
      ctx.fillRect(x - scrW / 2 - 6, y - drawH / 2 - 4, scrW + 12, 8);
      ctx.fillRect(x - scrW / 2 - 6, y + drawH / 2 - 4, scrW + 12, 8);

      // 金光闪耀：随展开扫过的高光 + 边缘光晕
      if (drawH > 20) {
        const sweep = ((t * 0.6) % 1.6) / 1.6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - scrW / 2 + 6, y - drawH / 2 + 6, scrW - 12, Math.max(0, drawH - 12));
        ctx.clip();
        const grad = ctx.createLinearGradient(x - scrW / 2 + sweep * scrW - 40, 0, x - scrW / 2 + sweep * scrW + 40, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,220,0.65)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - scrW / 2, y - drawH / 2, scrW, drawH);
        ctx.restore();
      }

      // 金榜题名文字（展开到 60% 后浮现）
      const textP = this._v15EaseOutCubic((openP - 0.6) / 0.4);
      if (textP > 0 && drawH > 60) {
        ctx.globalAlpha = textP;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(120,70,0,0.6)'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#b82828';
        ctx.font = 'bold 30px "STSong", serif';
        ctx.fillText('金榜题名', x, y - drawH * 0.18);
        ctx.font = '16px "STSong", serif';
        ctx.fillStyle = '#5a4a2a';
        ctx.fillText('春风得意马蹄疾', x, y + drawH * 0.08);
        ctx.fillText('一日看尽长安花', x, y + drawH * 0.08 + 22);
      }
    }
    ctx.restore();
  }

  // 状元游街：红袍骑马沿小弧线行进，两侧百姓欢呼
  _drawZhuangyuanParade(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    // 行进小幅度横向位移 + 上下颠簸
    const travel = this._v15EaseInOut(p) * 40 - 20;
    const bob = Math.sin(this.time * 10 + fx.seed) * 1.5;
    const cx = fx.x + travel, cy = fx.y + bob;
    // 两侧百姓（三对小人，举手欢呼，随节拍起伏）
    for (let i = 0; i < 3; i++) {
      const sideX = (i + 1) * 14;
      for (const sgn of [-1, 1]) {
        const cheer = Math.abs(Math.sin(this.time * 6 + fx.seed + i * 1.7)) * 3;
        const bx = fx.x + sgn * sideX * 1.6;
        const by = fx.y + 12;
        ctx.fillStyle = sgn < 0 ? '#4a5a6a' : '#5a4a3a';
        // 头
        ctx.beginPath(); ctx.arc(bx, by - 8 - cheer, 2.2, 0, Math.PI * 2); ctx.fill();
        // 身体
        ctx.fillRect(bx - 1.5, by - 6 - cheer, 3, 7);
        // 举起的手
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by - 5 - cheer);
        ctx.lineTo(bx + sgn * 3, by - 10 - cheer);
        ctx.stroke();
      }
    }
    // 马身（棕色剪影，椭圆）
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.ellipse(cx, cy, 7, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    // 马头
    ctx.beginPath(); ctx.ellipse(cx + 7, cy - 2, 2.6, 1.8, 0.3, 0, Math.PI * 2); ctx.fill();
    // 红袍状元（红身 + 冠）
    ctx.fillStyle = '#d82828';
    ctx.fillRect(cx - 2, cy - 9, 4, 6);
    ctx.fillStyle = '#f0d090';
    ctx.beginPath(); ctx.arc(cx, cy - 10.5, 1.8, 0, Math.PI * 2); ctx.fill();
    // 状元乌纱帽翅
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(cx - 3, cy - 12.5, 6, 1.4);
    // 身后小红旗
    ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 6, cy - 8); ctx.stroke();
    const wave = Math.sin(this.time * 7 + fx.seed) * 1.2;
    ctx.fillStyle = '#ffcf40';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 8); ctx.lineTo(cx - 2, cy - 7 + wave); ctx.lineTo(cx - 6, cy - 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 同年宴：圆桌聚坐 + 双杯相碰溅酒 + 诗句浮现
  _drawTongnianFeast(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    // 圆桌（俯视椭圆）
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 1.5; ctx.stroke();
    // 四位同年围坐（背影小圆 + 发髻）
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = fx.x + Math.cos(a) * 19;
      const py = fx.y + Math.sin(a) * 8;
      ctx.fillStyle = i % 2 ? '#3a5a6a' : '#5a4a3a';
      ctx.beginPath(); ctx.arc(px, py - 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath(); ctx.arc(px, py - 4.4, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // 双杯相碰（中央两只酒杯，举到中央相碰，溅酒点）
    const clink = Math.sin(this.time * 4 + fx.seed);
    const cupLx = fx.x - 6 + clink * 2, cupRx = fx.x + 6 - clink * 2;
    const cupY = fx.y - 14;
    ctx.fillStyle = '#d8b060';
    ctx.beginPath(); ctx.moveTo(cupLx - 2, cupY); ctx.lineTo(cupLx + 2, cupY); ctx.lineTo(cupLx, cupY + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cupRx - 2, cupY); ctx.lineTo(cupRx + 2, cupY); ctx.lineTo(cupRx, cupY + 4); ctx.closePath(); ctx.fill();
    // 碰杯处酒花高光
    ctx.fillStyle = '#fff2b0';
    const glint = 0.5 + 0.5 * Math.sin(this.time * 9 + fx.seed);
    ctx.globalAlpha = fade * glint;
    ctx.beginPath(); ctx.arc(fx.x, cupY - 1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = fade;
    // 诗句浮现（举杯属文）
    const textP = this._v15EaseOutCubic((p - 0.3) / 0.4);
    if (textP > 0) {
      ctx.globalAlpha = fade * textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '13px "STSong", serif';
      ctx.fillStyle = '#fff0d0';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3;
      ctx.fillText('同榜题名，把酒言欢', fx.x, fx.y - 26);
    }
    ctx.restore();
  }

  // 落第：伏案书生叹息（垂头 + 肩塌）+ 飘落试卷
  _drawFailedExam(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade * 0.95;
    // 书生伏案剪影（灰蓝）
    const droop = this._v15EaseOutCubic(Math.min(1, p * 2)); // 逐渐垂头
    const headY = fx.y - 14 + droop * 4;
    ctx.fillStyle = '#4a4f5a';
    // 躯干（伏案前倾）
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 4, 6, 4.5, 0.2, 0, Math.PI * 2); ctx.fill();
    // 头部（低垂）
    ctx.beginPath(); ctx.arc(fx.x + 4, headY, 2.6, 0, Math.PI * 2); ctx.fill();
    // 叹气（两缕浅灰气，随时间上升变淡）
    const breathe = (this.time * 0.6 + fx.seed) % 1;
    ctx.strokeStyle = `rgba(200,200,200,${0.5 * (1 - breathe)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fx.x + 8, headY - 2 - breathe * 8, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    // 「落第」小字（灰暗）
    const textP = this._v15EaseOutCubic((p - 0.4) / 0.3);
    if (textP > 0) {
      ctx.globalAlpha = fade * textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "STSong", serif';
      ctx.fillStyle = '#9a9a92';
      ctx.fillText('名落孙山…', fx.x, fx.y - 26);
    }
    ctx.restore();
  }

  // 授官：官印（朱红方印）自上落下授予 + 两侧彩带
  _drawAppointOffice(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    // 下方官告文书（横笺）
    ctx.fillStyle = '#f0e2b0';
    ctx.fillRect(fx.x - 16, fx.y - 2, 32, 12);
    ctx.strokeStyle = '#b09050'; ctx.lineWidth = 1;
    ctx.strokeRect(fx.x - 16, fx.y - 2, 32, 12);
    // 官印自上落下（easeOut 下落，到位后轻弹）
    const dropP = this._easeOutBack(Math.min(1, p / 0.45));
    const sealY = this._v15Lerp(fx.y - 30, fx.y - 2, dropP);
    const sealSize = 9;
    ctx.save();
    ctx.translate(fx.x, sealY);
    ctx.shadowColor = '#d82828';
    ctx.shadowBlur = p > 0.45 ? 12 : 0;
    ctx.fillStyle = '#c82828';
    ctx.fillRect(-sealSize / 2, -sealSize / 2, sealSize, sealSize);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff0e0'; ctx.lineWidth = 1.2;
    ctx.strokeRect(-sealSize / 2 + 1.5, -sealSize / 2 + 1.5, sealSize - 3, sealSize - 3);
    // 印文（篆意十字）
    ctx.strokeStyle = '#fff0e0';
    ctx.beginPath();
    ctx.moveTo(-2.2, 0); ctx.lineTo(2.2, 0);
    ctx.moveTo(0, -2.2); ctx.lineTo(0, 2.2);
    ctx.stroke();
    ctx.restore();
    // 到位金光扩散
    if (p > 0.45 && p < 0.85) {
      const ringP = (p - 0.45) / 0.4;
      ctx.strokeStyle = `rgba(255,215,0,${0.7 * (1 - ringP)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fx.x, fx.y + 4, 6 + ringP * 22, 0, Math.PI * 2); ctx.stroke();
    }
    // 授官文字
    const textP = this._v15EaseOutCubic((p - 0.5) / 0.3);
    if (textP > 0) {
      ctx.globalAlpha = fade * textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "STSong", serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.shadowColor = '#7a4a00'; ctx.shadowBlur = 4;
      ctx.fillText('钦授官职', fx.x, fx.y - 26);
    }
    ctx.restore();
  }

  // 考核：考卷展开 + 印章通过/不通过（passed 决定颜色与印文）
  _drawOfficialReview(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    // 考卷（白笺，横线）
    ctx.fillStyle = '#f5efdd';
    ctx.fillRect(fx.x - 16, fx.y - 12, 32, 24);
    ctx.strokeStyle = '#b0a888'; ctx.lineWidth = 1;
    ctx.strokeRect(fx.x - 16, fx.y - 12, 32, 24);
    ctx.strokeStyle = '#c8bfa0';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(fx.x - 12, fx.y - 6 + i * 6); ctx.lineTo(fx.x + 12, fx.y - 6 + i * 6); ctx.stroke();
    }
    // 印章盖下（0.35 后砸下，缩放弹入）
    if (p > 0.3) {
      const stampP = this._easeOutBack((p - 0.3) / 0.25);
      const s = Math.max(0, Math.min(1.2, stampP));
      const ok = !!fx.passed;
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.scale(s, s);
      ctx.rotate(ok ? -0.12 : 0.15);
      ctx.shadowColor = ok ? '#2a8a4a' : '#8a3a2a';
      ctx.shadowBlur = 8;
      ctx.fillStyle = ok ? 'rgba(60,160,90,0.85)' : 'rgba(150,60,50,0.85)';
      const ss = 11;
      ctx.fillRect(-ss / 2, -ss / 2, ss, ss);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff8f0';
      ctx.font = 'bold 9px "STSong", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ok ? '通过' : '不第', 0, 0.5);
      ctx.restore();
      // 评语文案
      const textP = this._v15EaseOutCubic((p - 0.6) / 0.25);
      if (textP > 0) {
        ctx.globalAlpha = fade * textP;
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "STSong", serif';
        ctx.fillStyle = ok ? '#8affc0' : '#d89a8a';
        ctx.fillText(ok ? '考核：称职 ▲' : '考核：不称 ▼', fx.x, fx.y - 22);
      }
    }
    ctx.restore();
  }

  // 贬官：官服脱下（红袍滑落）+ 身形佝偻叹息
  _drawDemoteOffice(ctx, fx, p) {
    const fade = p < 0.12 ? p / 0.12 : (p > 0.88 ? (1 - p) / 0.12 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    // 人物（灰蓝素衣，佝偻）
    ctx.fillStyle = '#5a5a60';
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 4, 5, 4, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx.x - 1, fx.y - 11, 2.4, 0, Math.PI * 2); ctx.fill();
    // 脱下的红袍自肩部滑落（随时间下移 + 半透明）
    const slideP = Math.max(0, Math.min(1, (p - 0.2) / 0.5));
    const robeY = this._v15Lerp(fx.y - 9, fx.y + 6, slideP);
    ctx.globalAlpha = fade * (1 - slideP * 0.5);
    ctx.fillStyle = '#b83838';
    ctx.beginPath();
    ctx.moveTo(fx.x - 5, robeY - 3);
    ctx.lineTo(fx.x + 5, robeY - 3);
    ctx.lineTo(fx.x + 4, robeY + 4);
    ctx.lineTo(fx.x - 4, robeY + 4);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = fade;
    // 叹气气缕
    const breathe = (this.time * 0.5 + fx.seed) % 1;
    ctx.strokeStyle = `rgba(190,190,185,${0.5 * (1 - breathe)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fx.x - 4, fx.y - 14 - breathe * 8, 2.2, 0, Math.PI * 2);
    ctx.stroke();
    // 贬官文字
    const textP = this._v15EaseOutCubic((p - 0.45) / 0.3);
    if (textP > 0) {
      ctx.globalAlpha = fade * textP;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "STSong", serif';
      ctx.fillStyle = '#c0b8a8';
      ctx.fillText('贬官降职…', fx.x, fx.y - 26);
    }
    ctx.restore();
  }
}

// 全局单例，供 map.js / ui.js 共用
export const Animator = new CharacterAnimator();
