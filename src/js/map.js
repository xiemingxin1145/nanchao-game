// ============================================================
// map.js — 等距地图 Canvas 渲染（含人物动画系统）
// 动画：军队棋子待机动画(上下浮动+旗帜飘动)、移动平滑插值、
//       选中金色旋转光环、城市呼吸缩放、都城宫殿旗帜飘动。
// ============================================================
import { TERRAIN, FACTIONS, CITY_LINKS } from './data.js';
import { Animator } from './animation.js';

const TILE_W = 64;   // 等距 tile 宽
const TILE_H = 32;   // 等距 tile 高

export class IsometricMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.game = null;
    this.hoverCity = null;
    this.listeners = [];

    // ---- 动画状态 ----
    this._rafId = null;
    this._animTime = 0;
    this._lastFrame = 0;
    this._armyPosAnims = new Map();   // armyId -> {x,y,fromX,fromY,toX,toY,startTime}
    this._armyBob = new Map();         // armyId -> 浮动相位

    // ---- V5.0 性能优化：静态层离屏缓存 + 自适应帧率 ----
    this.dirty = true;                // 静态层脏标记（城市归属/缩放变化时置真）
    this._staticCanvas = null;        // 离屏静态层（背景+地形+连线）
    this._staticFps = 1000 / 30;      // 待机动画 30fps
    this._fastFps = 1000 / 60;        // 有军队移动时 60fps
    this._accum = 0;

    this._bindEvents();
    this._initView();
  }

  // 启动持续渲染循环（待机动画）
  startLoop() {
    if (this._rafId) return;
    this._lastFrame = performance.now();
    this._accum = 0;
    const loop = (now) => {
      const dt = Math.min((now - this._lastFrame) / 1000, 0.05);
      this._lastFrame = now;
      this._animTime += dt;
      Animator.update(dt);
      // 自适应帧率：有军队正在滑动 -> 60fps；否则 30fps 节能
      const moving = [...this._armyPosAnims.values()].some(a => a.moving);
      const interval = (moving || this.dragging) ? this._fastFps : this._staticFps;
      this._accum += now - (loop._prev || now);
      loop._prev = now;
      if (this._accum >= interval) {
        this._accum = 0;
        this.render();
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }
  stopLoop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _initView() {
    // 初始居中
    this.offsetX = this.canvas.width / 2 - 200;
    this.offsetY = 100;
  }

  // 等距坐标 → 屏幕坐标
  isoToScreen(isoX, isoY) {
    const sx = (isoX - isoY) * (TILE_W / 2);
    const sy = (isoX + isoY) * (TILE_H / 2);
    return {
      x: (sx + this.offsetX) * this.scale,
      y: (sy + this.offsetY) * this.scale
    };
  }

  // 屏幕坐标 → 等距坐标（近似，用于点击检测）
  screenToIso(sx, sy) {
    const x = (sx / this.scale - this.offsetX);
    const y = (sy / this.scale - this.offsetY);
    const isoX = (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2;
    const isoY = (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2;
    return { isoX, isoY };
  }

  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this._moved = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
        this.offsetX += dx / this.scale;
        this.offsetY += dy / this.scale;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.dirty = true; // V5.0：平移使静态层失效
        this.render();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.dragging && !this._moved) {
        this._handleClick(e);
      }
      this.dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(0.5, Math.min(2.0, this.scale * delta));
      this.dirty = true; // V5.0：缩放使静态层失效
      this.render();
    }, { passive: false });
  }

  _handleClick(e) {
    if (!this.game) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 检测点击城市
    let clickedCity = null;
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const r = (18 + city.size * 6) * this.scale;
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < r * r) {
        clickedCity = city;
        break;
      }
    }

    // 检测点击军队
    let clickedArmy = null;
    for (const army of this.game.armies) {
      const city = this.game.cities.get(army.cityId);
      if (!city) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const r = 14 * this.scale;
      const dx = mx - pos.x;
      const dy = my - (pos.y - 20 * this.scale);
      if (dx * dx + dy * dy < r * r) {
        clickedArmy = army;
        break;
      }
    }

    // 回调到 UI
    // V2.5：未探索城市不可选中
    if (clickedCity && typeof this.game.isCityExplored === 'function'
        && !this.game.isCityExplored(clickedCity.id)) {
      clickedCity = null;
    }
    if (this.onSelect) {
      this.onSelect({ city: clickedCity, army: clickedArmy });
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = Math.max(1024, parent.clientWidth);
    const h = Math.max(600, parent.clientHeight);
    this.canvas.width = w;
    this.canvas.height = h;
    this.dirty = true; // 尺寸变化需重建静态层
    this.render();
  }

  // V7.5：切换大地图/小地图缩放（M 键）
  toggleZoom() {
    this.scale = this.scale > 1.2 ? 1.0 : 1.5;
    this.dirty = true;
    this.render();
  }

  // V5.0：视口裁剪 —— 屏幕坐标是否落在可见区域（含余量）
  _onScreen(x, y, margin = 120) {
    return x > -margin && x < this.canvas.width + margin &&
           y > -margin && y < this.canvas.height + margin;
  }

  render() {
    if (!this.game) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // ---- V5.0：静态层（背景+地形+连线）缓存到离屏 Canvas，仅脏时重绘 ----
    if (this.dirty || !this._staticCanvas) {
      this._buildStaticLayer(W, H);
      this.dirty = false;
    }
    ctx.drawImage(this._staticCanvas, 0, 0);

    this._drawCities();
    this._drawArmies();
    this._drawSelection();
  }

  // 构建离屏静态层
  _buildStaticLayer(W, H) {
    if (!this._staticCanvas) {
      this._staticCanvas = document.createElement('canvas');
    }
    this._staticCanvas.width = W;
    this._staticCanvas.height = H;
    const sctx = this._staticCanvas.getContext('2d');
    // 背景
    const bgGrad = sctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a2a1a');
    bgGrad.addColorStop(1, '#0d1a0d');
    sctx.fillStyle = bgGrad;
    sctx.fillRect(0, 0, W, H);
    // 地形与连线绘制到离屏层
    this._drawTerrain(sctx);
    this._drawLinks(sctx);
  }

  _drawTerrain(ctx) {
    // 绘制地形基底（以城市为中心绘制色块）
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      // V5.0：视口裁剪
      if (!this._onScreen(pos.x, pos.y, 80)) continue;
      const t = TERRAIN[city.terrain] || TERRAIN.plain;

      // 绘制等距菱形地形块
      const w = TILE_W * 1.2 * this.scale;
      const h = TILE_H * 1.2 * this.scale;
      ctx.save();
      ctx.translate(pos.x, pos.y);

      // 地形色块
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();

      // 山地高度
      if (city.terrain === 'mountain') {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#8A7B6A';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.8);
        ctx.lineTo(w * 0.3, -h * 0.3);
        ctx.lineTo(-w * 0.3, -h * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawLinks(ctx) {
    const c = ctx || this.ctx;
    c.save();
    c.strokeStyle = 'rgba(200, 180, 120, 0.2)';
    c.lineWidth = 1.5 * this.scale;
    c.setLineDash([5, 5]);

    for (const city of this.game.cities.values()) {
      const links = CITY_LINKS[city.id] || [];
      for (const targetId of links) {
        if (city.id >= targetId) continue; // 只画一次
        const target = this.game.cities.get(targetId);
        if (!target) continue;
        const p1 = this.isoToScreen(city.isoX, city.isoY);
        const p2 = this.isoToScreen(target.isoX, target.isoY);
        // V5.0：视口裁剪
        if (!this._onScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 160)) continue;
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.stroke();
      }
    }
    c.restore();
  }

  _drawCities() {
    const ctx = this.ctx;
    const t = this._animTime;
    const playerFid = this.game.playerFaction;
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      // V5.0：视口裁剪
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      // ---- V2.5：战争迷雾 ----
      const explored = (typeof this.game.isCityExplored === 'function')
        ? this.game.isCityExplored(city.id) : true;
      const visible = (typeof this.game.isCityCurrentlyVisible === 'function')
        ? this.game.isCityCurrentlyVisible(city.id) : true;

      // 未探索：画一个迷雾中的问号
      if (!explored) {
        ctx.save();
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        ctx.font = `${14 * this.scale}px "STSong", serif`;
        ctx.textAlign = 'center';
        ctx.fillText('？', pos.x, pos.y);
        ctx.restore();
        continue;
      }

      const faction = city.owner ? FACTIONS[city.owner] : null;
      const color = faction ? faction.color : '#666666';
      const size = city.size;
      const r = (10 + size * 4) * this.scale;

      // 城市待机动画：轻微呼吸缩放（周期 2.5s，幅度 1~1.04）
      const breathe = 1 + 0.04 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.5 + city.isoX));

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(breathe, breathe);

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.8, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // 城市底座（等距菱形）
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();

      // 边框
      ctx.strokeStyle = '#E8D5A3';
      ctx.lineWidth = 2 * this.scale;
      ctx.stroke();

      // 都城宫殿标识 + 旗帜飘动
      if (city.capital) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, -r - 8 * this.scale);
        ctx.lineTo(6 * this.scale, -r);
        ctx.lineTo(-6 * this.scale, -r);
        ctx.closePath();
        ctx.fill();
        // 宫殿旗帜：随风摆动（三角旗左右晃）
        const flagSwing = Math.sin(t * 3 + city.isoX) * 2 * this.scale;
        ctx.strokeStyle = '#C4A55A';
        ctx.lineWidth = 1.5 * this.scale;
        ctx.beginPath();
        ctx.moveTo(0, -r - 8 * this.scale);
        ctx.lineTo(0, -r - 22 * this.scale);
        ctx.stroke();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, -r - 22 * this.scale);
        ctx.lineTo(10 * this.scale + flagSwing, -r - 19 * this.scale);
        ctx.lineTo(0, -r - 16 * this.scale);
        ctx.closePath();
        ctx.fill();
      }

      // 城市名称
      ctx.fillStyle = '#E8D5A3';
      ctx.font = `${12 * this.scale}px "STSong", "SimSun", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(city.name, 0, -r - 12 * this.scale);

      // 兵力数：仅当前可见时显示实时兵力（已探索但无视野 → 不显示）
      if (visible && city.garrison > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = `${10 * this.scale}px "STSong", "SimSun", serif`;
        ctx.fillText(`${Math.round(city.garrison / 1000)}k`, 0, r + 14 * this.scale);
      }

      ctx.restore();
    }
  }

  _drawArmies() {
    const ctx = this.ctx;
    const now = performance.now();
    const t = this._animTime;
    for (const army of this.game.armies) {
      const city = this.game.cities.get(army.cityId);
      if (!city) continue;
      // ---- V2.5：战争迷雾 —— 非我方军队只在城市当前可见时绘制 ----
      const visibleToPlayer = (typeof this.game.isCityCurrentlyVisible === 'function')
        ? this.game.isCityCurrentlyVisible(city.id) : true;
      if (army.faction !== this.game.playerFaction && !visibleToPlayer) continue;
      const faction = FACTIONS[army.faction];
      const gen = this.game.generals.get(army.generalId);
      const r = 8 * this.scale;

      // ---- 移动插值：自动检测目标位置变化 ----
      const targetPos = this.isoToScreen(city.isoX, city.isoY);
      // V5.0：视口裁剪
      if (!this._onScreen(targetPos.x, targetPos.y - 20 * this.scale, 100)) continue;
      let anim = this._armyPosAnims.get(army.id);
      if (!anim) {
        anim = { x: targetPos.x, y: targetPos.y, fromX: targetPos.x, fromY: targetPos.y,
                 toX: targetPos.x, toY: targetPos.y, startTime: now, moving: false };
        this._armyPosAnims.set(army.id, anim);
      }
      // 目标位置变化 -> 启动新的滑动动画（0.5s）
      if (Math.abs(anim.toX - targetPos.x) > 0.5 || Math.abs(anim.toY - targetPos.y) > 0.5) {
        anim.fromX = anim.x; anim.fromY = anim.y;
        anim.toX = targetPos.x; anim.toY = targetPos.y;
        anim.startTime = now;
        anim.moving = true;
      }
      const dur = 500;
      const prog = Math.min((now - anim.startTime) / dur, 1);
      const e = 0.5 - Math.cos(prog * Math.PI) / 2; // easeInOut
      anim.x = anim.fromX + (anim.toX - anim.fromX) * e;
      anim.y = anim.fromY + (anim.toY - anim.fromY) * e;
      if (prog >= 1) anim.moving = false;

      // 待机浮动 ±2px（周期 2s）；移动时叠加跑步抖动
      let bob = Math.sin(t * Math.PI * 2 / 2 + (army.id % 7)) * 2;
      if (anim.moving) bob += Math.sin(t * 18) * 1.5; // 跑步抖动

      const drawX = anim.x;
      const drawY = anim.y - 20 * this.scale + bob;

      ctx.save();
      ctx.translate(drawX, drawY);

      // 军队棋子（圆形）
      ctx.fillStyle = faction.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E8D5A3';
      ctx.lineWidth = 1.5 * this.scale;
      ctx.stroke();

      // 选中高亮：金色旋转光环（两段圆弧随时间旋转）
      if (this.game.selectedArmy === army.id) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5 * this.scale;
        const ringR = r + 5 * this.scale;
        const ang = t * 2.2; // 旋转速度
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, ang, ang + Math.PI * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, ringR, ang + Math.PI, ang + Math.PI + Math.PI * 0.7);
        ctx.stroke();
        ctx.restore();
      }

      // 上方小旗帜飘动（竖杆 + 三角旗左右摆）
      const flagSwing = Math.sin(t * 4 + army.id) * 2 * this.scale;
      ctx.strokeStyle = '#C4A55A';
      ctx.lineWidth = 1 * this.scale;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, 0);
      ctx.lineTo(r * 0.4, -10 * this.scale);
      ctx.stroke();
      ctx.fillStyle = faction.colorLight || faction.color;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, -10 * this.scale);
      ctx.lineTo(r * 0.4 + 8 * this.scale + flagSwing, -8 * this.scale);
      ctx.lineTo(r * 0.4, -6 * this.scale);
      ctx.closePath();
      ctx.fill();

      // 武将名
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${10 * this.scale}px "STSong", "SimSun", serif`;
      ctx.textAlign = 'center';
      if (gen) {
        ctx.fillText(gen.name, 0, -r - 4 * this.scale);
      }
      ctx.fillText(`${Math.round(army.troops / 1000)}k`, 0, r + 12 * this.scale);

      ctx.restore();
    }
  }

  _drawSelection() {
    const ctx = this.ctx;
    if (this.game.selectedCity) {
      const city = this.game.cities.get(this.game.selectedCity);
      if (city) {
        const pos = this.isoToScreen(city.isoX, city.isoY);
        const r = (16 + city.size * 4) * this.scale;
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3 * this.scale;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 绘制可移动范围
    if (this.game.selectedArmy) {
      const army = this.game.armies.find(a => a.id === this.game.selectedArmy);
      if (army && !army.hasMoved) {
        const links = CITY_LINKS[army.cityId] || [];
        for (const targetId of links) {
          const target = this.game.cities.get(targetId);
          if (!target) continue;
          const pos = this.isoToScreen(target.isoX, target.isoY);
          const r = (14 + target.size * 4) * this.scale;
          ctx.save();
          ctx.fillStyle = target.owner === army.faction
            ? 'rgba(100, 255, 100, 0.15)'
            : (target.owner === null ? 'rgba(255, 255, 100, 0.15)' : 'rgba(255, 80, 80, 0.15)');
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}
