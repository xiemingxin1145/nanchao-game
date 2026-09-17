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
    // 战斗场景粒子上限（V7.5：提升为 150，配合对象池，非战斗场景不更新）
    this._particlePool = [];
    this._maxParticles = 150;
    this._paused = false;   // V5.5：非战斗场景暂停粒子更新
  }

  // V5.5：暂停/恢复粒子更新（非战斗场景调用，节省 CPU）
  setPaused(p) { this._paused = !!p; }

  // 从对象池取一个粒子对象
  _getParticle() {
    const p = this._particlePool.pop();
    if (p) {
      // 重置字段
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      p.gravity = 0; p.drag = 0; p.life = 0.5; p.maxLife = 0.5;
      p.size = 3; p.color = '#fff'; p.type = '';
      p.angle = 0; p.seed = 0;
      return p;
    }
    return { x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff', type: '' };
  }
  // 回收粒子到对象池
  _releaseParticle(p) {
    if (this._particlePool.length < 500) this._particlePool.push(p);
  }

  // ---------- 主更新 ----------
  // deltaTime: 秒。驱动粒子生命周期与全局时钟。
  update(deltaTime) {
    if (!deltaTime || deltaTime <= 0) return;
    if (this._paused) return;   // V5.5：非战斗场景暂停粒子更新
    this.time += deltaTime;
    this.frame += deltaTime * 12; // ~12fps 的逻辑帧步进
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      if (p.gravity) p.vy += p.gravity * deltaTime;
      if (p.drag) { p.vx *= (1 - p.drag * deltaTime); p.vy *= (1 - p.drag * deltaTime); }
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        this._releaseParticle(p);
      }
    }
  }

  // 添加粒子（带上限保护）
  _pushParticle(p) {
    if (this.particles.length >= this._maxParticles) {
      // 超出上限：回收最老的粒子
      const old = this.particles.shift();
      if (old) this._releaseParticle(old);
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
      default:
        this.particles.push({ type, x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff' });
    }
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
      default: {
        ctx.globalAlpha = t;
        ctx.fillStyle = extra.color || '#fff';
        ctx.beginPath(); ctx.arc(x, y, extra.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ============================================================
  // 待机动画武将立绘（Canvas 绘制）
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

  // 颜色变暗工具
  _darken(hex, amt) {
    if (!hex || hex[0] !== '#') return '#555';
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * amt); g = Math.round(g * amt); b = Math.round(b * amt);
    return `rgb(${r},${g},${b})`;
  }
}

// 全局单例，供 map.js / ui.js 共用
export const Animator = new CharacterAnimator();
