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
  }

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

  // 便捷：绘制所有激活中的覆盖层（每帧一次调用）
  drawOverlayFX(ctx, w, h) {
    this.drawAchievementFX(ctx);
    this.drawTierUpFX(ctx);
    this.drawEndingAnimation(ctx);
  }

  // 查询当前是否有覆盖层动画在播放
  hasOverlayFX() {
    return !!(this._achFX || this._tierFX || this._endingFX);
  }
}

// 全局单例，供 map.js / ui.js 共用
export const Animator = new CharacterAnimator();
