// ============================================================
// map.js — 等距地图 Canvas 渲染
// ============================================================
import { TERRAIN, FACTIONS, CITY_LINKS } from './data.js';

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

    this._bindEvents();
    this._initView();
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
    this.render();
  }

  render() {
    if (!this.game) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 背景
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a2a1a');
    bgGrad.addColorStop(1, '#0d1a0d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    this._drawTerrain();
    this._drawLinks();
    this._drawCities();
    this._drawArmies();
    this._drawSelection();
  }

  _drawTerrain() {
    const ctx = this.ctx;
    // 绘制地形基底（以城市为中心绘制色块）
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
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

  _drawLinks() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 180, 120, 0.2)';
    ctx.lineWidth = 1.5 * this.scale;
    ctx.setLineDash([5, 5]);

    for (const city of this.game.cities.values()) {
      const links = CITY_LINKS[city.id] || [];
      for (const targetId of links) {
        if (city.id >= targetId) continue; // 只画一次
        const target = this.game.cities.get(targetId);
        if (!target) continue;
        const p1 = this.isoToScreen(city.isoX, city.isoY);
        const p2 = this.isoToScreen(target.isoX, target.isoY);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawCities() {
    const ctx = this.ctx;
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const faction = city.owner ? FACTIONS[city.owner] : null;
      const color = faction ? faction.color : '#666666';
      const size = city.size;
      const r = (10 + size * 4) * this.scale;

      ctx.save();
      ctx.translate(pos.x, pos.y);

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

      // 都城宫殿标识
      if (city.capital) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, -r - 8 * this.scale);
        ctx.lineTo(6 * this.scale, -r);
        ctx.lineTo(-6 * this.scale, -r);
        ctx.closePath();
        ctx.fill();
      }

      // 城市名称
      ctx.fillStyle = '#E8D5A3';
      ctx.font = `${12 * this.scale}px "STSong", "SimSun", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(city.name, 0, -r - 12 * this.scale);

      // 兵力数
      if (city.garrison > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = `${10 * this.scale}px "STSong", "SimSun", serif`;
        ctx.fillText(`${Math.round(city.garrison / 1000)}k`, 0, r + 14 * this.scale);
      }

      ctx.restore();
    }
  }

  _drawArmies() {
    const ctx = this.ctx;
    for (const army of this.game.armies) {
      const city = this.game.cities.get(army.cityId);
      if (!city) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const faction = FACTIONS[army.faction];
      const gen = this.game.generals.get(army.generalId);
      const r = 8 * this.scale;

      ctx.save();
      ctx.translate(pos.x, pos.y - 20 * this.scale);

      // 军队棋子（圆形）
      ctx.fillStyle = faction.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E8D5A3';
      ctx.lineWidth = 1.5 * this.scale;
      ctx.stroke();

      // 选中高亮
      if (this.game.selectedArmy === army.id) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3 * this.scale;
        ctx.beginPath();
        ctx.arc(0, 0, r + 4 * this.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

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
