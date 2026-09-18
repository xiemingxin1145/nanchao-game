// ============================================================
// map.js — 等距地图 Canvas 渲染（含人物动画系统）
// 动画：军队棋子待机动画(上下浮动+旗帜飘动)、移动平滑插值、
//       选中金色旋转光环、城市呼吸缩放、都城宫殿旗帜飘动。
// V8.1：昼夜循环 + 四季氛围色调 + 动态氛围(云/河流波纹/炊烟/夜灯)
// ============================================================
import { TERRAIN, FACTIONS, CITY_LINKS, SEASONS } from './data.js';
import { Animator } from './animation.js';

const TILE_W = 64;   // 等距 tile 宽
const TILE_H = 32;   // 等距 tile 高

// V8.1：12 时辰名称（子=23-1点，丑=1-3，寅=3-5，卯=5-7，辰=7-9，
//       巳=9-11，午=11-13，未=13-15，申=15-17，酉=17-19，戌=19-21，亥=21-23）
const SHICHEN_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// V8.1：昼夜色调关键帧 [hour, r, g, b, alpha]
// 相邻关键帧间线性插值，保证昼夜切换平滑不跳变。
const TIME_KEYFRAMES = [
  [0,   15,  25,  70, 0.35],  // 子时深夜蓝
  [3,   40,  55, 100, 0.25],  // 寅时黎明前暗蓝
  [5,  255, 130,  70, 0.15],  // 卯时晨曦橙红
  [7,  255, 200, 160, 0.05],  // 辰时转亮
  [9,  255, 255, 255, 0.00],  // 巳时明亮正常
  [15, 255, 255, 255, 0.00],  // 午未明亮正常
  [17, 200, 150, 210, 0.20],  // 酉时黄昏金紫
  [19,  15,  25,  70, 0.35],  // 戌时深蓝夜
  [23,  15,  25,  70, 0.35],  // 亥时深蓝夜
  [24,  15,  25,  70, 0.35],  // 跨日衔接
];

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

    // ============================================================
    // V8.1：昼夜循环 + 季节氛围 + 动态氛围
    // ============================================================
    this.currentHour = 12;            // 默认午时（明亮正午）
    this._lastSeasonIdx = 1;          // 缓存上次季节（默认夏=1），用于检测换季重绘
    this._turnCount = 0;              // 回合计数（用于 onTurnEnd 推进）

    // 动态氛围元素
    this._clouds = [];                // 飘动云层 3-5 朵
    this._smokeParticles = [];        // 城市炊烟粒子
    this._ambientParticles = [];      // 花瓣/落叶/飘雪粒子
    this._smokeTimer = 0;             // 炊烟发射计时
    this._ambientTimer = 0;           // 氛围粒子发射计时
    this._initClouds();

    // ============================================================
    // V13.0：地图独立粒子系统（与 animation.js 隔离）
    //   上限 80，仅渲染视口内；用于边关烽火/沙漠沙尘/森林落叶/港口波纹
    // V14.0 霸业宏图：上限提升至 120，新增草丛摇曳/水鸟/麦浪/炊烟增强
    // ============================================================
    this._mapParticles = [];
    this._mapParticlePool = [];
    this._mapParticlePools = {};   // V14.0：按类型分池优化（grass/bird/wheat/...）
    this._MAP_PARTICLE_CAP = 120;  // V14.0：80 → 120
    this._warActive = false;          // 战时开关（边关烽火冒烟，外部 setWarActive 设置）
    this._beaconTimer = 0;            // 烽火台冒烟计时
    this._sandstormTimer = 0;        // 沙漠沙尘暴计时
    this._portRippleTimer = 0;        // 港口波纹计时
    this._forestLeafTimer = 0;       // 森林落叶计时
    this._marchDustTimer = 0;        // 行军尘土节流计时
    this._lastMarchDustEmit = 0;     // 上次行军尘土生成时刻（_animTime 基准）
    this._grassTimer = 0;            // V14.0：草丛摇曳计时
    this._birdTimer = 0;             // V14.0：水鸟飞过计时
    this._wheatTimer = 0;            // V14.0：农田麦浪计时

    // V14.0：城市/军队图标离屏缓存（按势力+规模缓存）
    this._cityIconCache = new Map();   // key: `${color}|${sizeLevel}` -> canvas
    this._armyIconCache = new Map();  // key: `${factionColor}` -> canvas

    // ============================================================
    // V15.0：天气系统 + 地图特效增强
    // ------------------------------------------------------------
    // 天气：晴/多云/雨/雪/雾/沙暴；天气粒子独立对象池；
    //      切换时 0.5s 平滑渐变；随季节/地区自动演化。
    // ============================================================
    this.weather = '晴';               // 当前天气
    this._weatherPrev = '晴';          // 过渡前天气（用于平滑切换）
    this._weatherBlend = 1;            // 过渡进度 0→1（1=完成），切换时归零
    this._weatherParticles = [];       // 天气粒子（雨/雪/雾/沙尘）
    this._weatherPool = [];            // 天气粒子对象池
    this._WEATHER_PARTICLE_CAP = 140; // 天气粒子上限保护
    this._weatherEmitTimer = 0;       // 天气粒子发射节流
    this._weatherAutoTimer = 0;       // 天气自动演化计时
    this._weatherRngSeed = Math.random() * 1000;

    // V15.0：贸易路线 / 宗教传播动态特效
    this._religionRipples = [];        // 宗教波纹 {x,y,t,maxLife,color,seed}
    this._religionTimer = 0;
    this._pollenTimer = 0;            // 春季花粉
    this._cicadaTimer = 0;            // 夏季蝉鸣闪光
    this._fxFrameSkip = 0;            // 非关键动画降帧计数

    // ============================================================
    // V16.0：战役模式地图标记 + 视觉增强
    // ------------------------------------------------------------
    // 战役标记：金色旗帜目标点 + 脉冲光环；虚线箭头路径；
    //          势力色覆盖区域；胜利后彩带/烟花庆祝粒子。
    // 视觉增强：水面波纹/反光/倒影；山体阴影；森林三层；
    //          夜晚窗口亮灯 + 萤火虫；交战红色火花 + 武器碰撞光。
    // 性能：战役标记对象池；视口外不渲染；昼夜平滑插值。
    // ============================================================
    this._campTarget = null;          // {isoX,isoY,resolved} 战役目标点
    this._campPath = null;            // [{isoX,isoY},...] 战役路径节点
    this._campArea = null;            // {isoPoints:[{isoX,isoY}],color} 战役势力区域
    this._campWon = false;            // 战役胜利标记（目标点转庆祝粒子）
    this._campParticlePool = [];      // 战役标记对象池（彩带/烟花/火花复用）
    this._campParticles = [];         // 战役庆祝粒子
    this._CAMP_PARTICLE_CAP = 120;    // 战役粒子上限
    this._campWinTimer = 0;           // 胜利庆祝粒子发射计时
    this._fireflyTimer = 0;           // 萤火虫发射计时（夜晚森林）
    this._battleSparks = [];          // 交战红色火花 {x,y,vx,vy,life,maxLife}
    this._battleFlash = [];           // 武器碰撞光 {x,y,t,maxLife}
    this._battleSparkTimer = 0;
    this._lightAngle = Math.PI / 4;   // 光源方向（用于山体阴影；右上 45°）
    this._windowLightCache = new Map(); // 夜晚窗口亮灯离屏缓存 {cityId:canvas}

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
      // V8.1：更新动态氛围（云/粒子）
      this._updateAtmosphere(dt);
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

  // ============================================================
  // V14.0 — 视口缩放公共 API（0.5x ~ 2x）
  // ============================================================
  // 设置缩放级别（自动钳制到 0.5~2.0），触发静态层重绘
  setZoom(level) {
    this.scale = Math.max(0.5, Math.min(2.0, Number(level) || 1.0));
    this.dirty = true;
    return this.scale;
  }
  // 获取当前缩放级别
  getZoom() { return this.scale; }

  // V5.0：视口裁剪 —— 屏幕坐标是否落在可见区域（含余量）
  _onScreen(x, y, margin = 120) {
    return x > -margin && x < this.canvas.width + margin &&
           y > -margin && y < this.canvas.height + margin;
  }

  // ============================================================
  // V8.1：昼夜循环公共 API
  // ============================================================

  // 获取当前时辰名称（子/丑/寅/卯/辰/巳/午/未/申/酉/戌/亥）
  getTimeOfDay() {
    const idx = Math.floor(((this.currentHour + 1) % 24) / 2);
    return SHICHEN_NAMES[((idx % 12) + 12) % 12];
  }

  // 格式化时辰标签（供 UI 顶栏显示）
  getHourLabel() {
    const sc = this.getTimeOfDay();
    return `${sc}时 (${Math.floor(this.currentHour)}:00)`;
  }

  // 设置时辰（小时 0-23，浮点亦可）
  setHour(h) {
    this.currentHour = ((Number(h) % 24) + 24) % 24;
    return this.currentHour;
  }

  // 推进时辰（默认推进 2 个时辰 = 4 小时，6 回合 = 一天）
  advanceHour(amount = 4) {
    this.currentHour = ((this.currentHour + amount) % 24 + 24) % 24;
    return this.currentHour;
  }

  // 外部在回合结束时调用：推进 2 时辰（4 小时）
  onTurnEnd() {
    this._turnCount++;
    return this.advanceHour(4);
  }

  // ============================================================
  // V13.0：战时开关——开启后边关（山地城）烽火台冒烟
  // ============================================================
  setWarActive(b) { this._warActive = !!b; }
  isWarActive() { return this._warActive; }

  // ============================================================
  // V8.1：季节公共 API（读取 game.seasonIdx，不独立维护）
  // ============================================================

  // 获取当前季节名称
  getSeason() {
    const idx = (this.game && typeof this.game.seasonIdx === 'number')
      ? this.game.seasonIdx : 1;
    return SEASONS[((idx % 4) + 4) % 4] || '夏';
  }

  // 设置季节（写入 game.seasonIdx，如果 game 存在）
  setSeason(s) {
    const names = ['春','夏','秋','冬'];
    let idx;
    if (typeof s === 'number') idx = ((s % 4) + 4) % 4;
    else idx = names.indexOf(s);
    if (idx < 0) idx = 1;
    if (this.game && typeof this.game.seasonIdx === 'number') {
      this.game.seasonIdx = idx;
    }
    this._lastSeasonIdx = idx;
    this.dirty = true;
    return SEASONS[idx];
  }

  // 推进季节（写入 game.seasonIdx）
  advanceSeason() {
    const cur = (this.game && typeof this.game.seasonIdx === 'number')
      ? this.game.seasonIdx : 1;
    return this.setSeason((cur + 1) % 4);
  }

  // 当前季节索引（内部用，0=春 1=夏 2=秋 3=冬）
  _seasonIdx() {
    return (this.game && typeof this.game.seasonIdx === 'number')
      ? ((this.game.seasonIdx % 4) + 4) % 4 : 1;
  }

  // ============================================================
  // V8.1：序列化（仅序列化昼夜状态，季节由 game 存档处理）
  // ============================================================
  toJSON() {
    return {
      currentHour: this.currentHour,
      turnCount: this._turnCount
    };
  }
  fromJSON(data) {
    if (!data) return;
    if (typeof data.currentHour === 'number') this.setHour(data.currentHour);
    if (typeof data.turnCount === 'number') this._turnCount = data.turnCount;
  }

  // ============================================================
  // V8.1：昼夜色调插值
  // ============================================================
  _getTimeOverlay(hour) {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < TIME_KEYFRAMES.length - 2 && h >= TIME_KEYFRAMES[i + 1][0]) i++;
    const a = TIME_KEYFRAMES[i];
    const b = TIME_KEYFRAMES[i + 1];
    const span = b[0] - a[0];
    const t = span > 0 ? (h - a[0]) / span : 0;
    return {
      r: Math.round(a[1] + (b[1] - a[1]) * t),
      g: Math.round(a[2] + (b[2] - a[2]) * t),
      b: Math.round(a[3] + (b[3] - a[3]) * t),
      alpha: a[4] + (b[4] - a[4]) * t
    };
  }

  // V8.1：当前是否夜晚（用于夜灯/炊烟判断）
  _isNight() {
    const ov = this._getTimeOverlay(this.currentHour);
    return ov.alpha >= 0.25 && ov.b > ov.r; // 深蓝夜色且 alpha 足够
  }
  _isDaytime() {
    return !this._isNight();
  }

  // ============================================================
  // V8.1：季节地形色调调整
  // ============================================================
  _seasonTerrainColor(hexColor, terrainKey) {
    // 仅草地类（plain/forest）随季节微调
    if (terrainKey !== 'plain' && terrainKey !== 'forest') return hexColor;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    let dr = 0, dg = 0, db = 0;
    const si = this._seasonIdx();
    if (si === 0) {        // 春：+10 绿（嫩绿）
      dg = 10;
    } else if (si === 1) { // 夏：深绿（亮度略+5%）
      dr = 3; dg = 6; db = 3;
    } else if (si === 2) { // 秋：+15红 +5绿 -10蓝（黄褐）
      dr = 15; dg = 5; db = -10;
    } else if (si === 3) { // 冬：-10红 -10绿 +5蓝（灰白）
      dr = -10; dg = -10; db = 5;
    }
    const nr = Math.max(0, Math.min(255, r + dr));
    const ng = Math.max(0, Math.min(255, g + dg));
    const nb = Math.max(0, Math.min(255, b + db));
    return `rgb(${nr},${ng},${nb})`;
  }

  // ============================================================
  // V8.1：动态氛围 —— 云层初始化与更新
  // ============================================================
  _initClouds() {
    this._clouds = [];
    const count = 4; // 3-5 朵
    for (let i = 0; i < count; i++) {
      this._clouds.push({
        x: Math.random() * 2000,
        y: 20 + Math.random() * 180,
        w: 70 + Math.random() * 90,
        h: 12 + Math.random() * 10,
        speed: 6 + Math.random() * 10,  // px/秒
        alpha: 0.12 + Math.random() * 0.1
      });
    }
  }

  _updateClouds(dt) {
    const W = this.canvas.width || 1024;
    for (const c of this._clouds) {
      c.x += c.speed * dt;
      if (c.x - c.w > W) c.x = -c.w; // 循环滚动
    }
  }

  // V8.1：氛围粒子更新总入口
  _updateAtmosphere(dt) {
    this._updateClouds(dt);
    if (!this.game) return;
    this._emitSmoke(dt);
    this._emitAmbient(dt);
    // 更新炊烟粒子
    for (let i = this._smokeParticles.length - 1; i >= 0; i--) {
      const p = this._smokeParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= 0.99;
      if (p.life >= p.maxLife) this._smokeParticles.splice(i, 1);
    }
    // 更新季节氛围粒子
    for (let i = this._ambientParticles.length - 1; i >= 0; i--) {
      const p = this._ambientParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.maxLife || p.y > (this.canvas.height || 600) + 10) {
        this._ambientParticles.splice(i, 1);
      }
    }
    // V13.0：地形动态粒子发射 + 独立粒子系统更新
    this._emitTerrainParticles(dt);
    this._updateMapParticles(dt);

    // V15.0：天气系统更新（平滑过渡 + 天气粒子 + 季节/地区自动演化）
    this.updateWeather(dt);
    // V15.0：季节特效增强（春花粉 / 夏蝉鸣闪光）
    this._emitSeasonFX(dt);
    // V15.0：宗教传播波纹更新
    this._updateReligionRipples(dt);

    // V16.0：战役庆祝粒子 / 萤火虫 / 交战火花 更新
    this._updateCampaignFX(dt);
  }

  // V8.1：城市炊烟（仅白天）
  _emitSmoke(dt) {
    if (!this._isDaytime()) return;
    this._smokeTimer -= dt;
    if (this._smokeTimer > 0) return;
    this._smokeTimer = 0.9;
    // 收集可见城市
    const cities = [];
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (this._onScreen(pos.x, pos.y, 100)) cities.push(city);
    }
    if (cities.length === 0) return;
    const city = cities[Math.floor(Math.random() * cities.length)];
    const pos = this.isoToScreen(city.isoX, city.isoY);
    if (this._smokeParticles.length < 30) {
      this._smokeParticles.push({
        x: pos.x + (Math.random() - 0.5) * 6,
        y: pos.y - 12,
        vx: (Math.random() - 0.5) * 4,
        vy: -14 - Math.random() * 8,
        life: 0, maxLife: 2.5 + Math.random() * 2,
        size: 1.5 + Math.random() * 2
      });
    }
  }

  // V8.1：季节氛围粒子（春花瓣/秋落叶/冬飘雪）
  _emitAmbient(dt) {
    const si = this._seasonIdx();
    if (si === 1) return; // 夏：无氛围粒子（阳光强烈）
    this._ambientTimer -= dt;
    const interval = si === 3 ? 0.18 : 0.5; // 冬雪更密
    if (this._ambientTimer > 0) return;
    this._ambientTimer = interval;
    if (this._ambientParticles.length >= 25) return;
    const W = this.canvas.width || 1024;
    this._ambientParticles.push({
      x: Math.random() * W,
      y: -10,
      vx: (Math.random() - 0.5) * 25,
      vy: (si === 3 ? 28 : 14) + Math.random() * 10,
      life: 0, maxLife: 6 + Math.random() * 4,
      size: 1.5 + Math.random() * 2,
      season: si
    });
  }

  // ============================================================
  // V13.0：地图独立粒子系统（上限 80，仅渲染视口内）
  // ============================================================

  // 从对象池取一个粒子（V14.0：按类型分池，减少 GC）
  _mapGetParticle(type = 'default') {
    const pool = (this._mapParticlePools[type] || (this._mapParticlePools[type] = []));
    const p = pool.pop() || this._mapParticlePool.pop();
    if (p) {
      p.type = ''; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      p.gravity = 0; p.life = 1; p.maxLife = 1; p.size = 2;
      p.color = '#fff'; p.seed = 0;
      return p;
    }
    return { type: '', x: 0, y: 0, vx: 0, vy: 0, gravity: 0,
      life: 1, maxLife: 1, size: 2, color: '#fff', seed: 0 };
  }
  // 回收粒子到对象池（V14.0：按类型分池）
  _mapReleaseParticle(p) {
    const pool = (this._mapParticlePools[p.type] || this._mapParticlePool);
    if (pool.length < 300) pool.push(p);
  }

  // 生成一个地图粒子（带上限保护，超限时淘汰最旧）
  _spawnMapParticle(type, x, y, opts = {}) {
    const p = this._mapGetParticle();
    Object.assign(p, { type, x, y }, opts);
    if (this._mapParticles.length >= this._MAP_PARTICLE_CAP) {
      const old = this._mapParticles.shift();
      if (old) this._mapReleaseParticle(old);
    }
    this._mapParticles.push(p);
    return p;
  }

  // 更新地图粒子（位置/重力/生命周期）
  _updateMapParticles(dt) {
    for (let i = this._mapParticles.length - 1; i >= 0; i--) {
      const p = this._mapParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      // V14.0：超出视口自动回收（避免粒子飘出屏幕仍占内存）
      const outOfView = !this._onScreen(p.x, p.y, 60);
      if (p.life >= p.maxLife || outOfView) {
        this._mapParticles.splice(i, 1);
        this._mapReleaseParticle(p);
      }
    }
  }

  // 绘制地图粒子（仅视口内）
  _drawMapParticles(ctx) {
    if (this._mapParticles.length === 0) return;
    ctx.save();
    for (const p of this._mapParticles) {
      if (!this._onScreen(p.x, p.y, 40)) continue; // 视口裁剪
      const prog = p.life / p.maxLife;             // 0→1
      const alpha = Math.max(0, 1 - prog);
      switch (p.type) {
        case 'beacon_smoke': {
          // 烽火台烟雾：灰黑上升扩散
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillStyle = p.color || '#6a6058';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + prog * 1.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'sandstorm': {
          // 沙漠沙尘暴：黄褐横向短线
          ctx.globalAlpha = alpha * 0.55;
          ctx.strokeStyle = p.color || '#c2a060';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y);
          ctx.stroke();
          break;
        }
        case 'leaf_fall': {
          // 森林落叶：旋转下落椭圆
          const swing = Math.sin(this._animTime * 2 + (p.seed || 0)) * 6;
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = p.color || '#b8862a';
          ctx.save();
          ctx.translate(p.x + swing, p.y);
          ctx.rotate((p.seed || 0) + this._animTime * 3);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'port_ripple': {
          // 港口波纹：扩散圆环
          ctx.globalAlpha = alpha * 0.6;
          ctx.strokeStyle = p.color || '#8fc4e8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size + prog * 16, (p.size + prog * 16) * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'march_dust': {
          // 行军尘土：棕色缓慢扩散
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillStyle = p.color || '#8B7355';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + prog), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'grass_sway': {
          // V14.0：草丛摇曳（小绿短线，随风摆）
          const sway = Math.sin(this._animTime * 3 + (p.seed || 0)) * 2;
          ctx.globalAlpha = alpha * 0.7;
          ctx.strokeStyle = p.color || '#6aa050';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + sway, p.y - 4);
          ctx.stroke();
          break;
        }
        case 'bird': {
          // V14.0：水鸟飞过（V形翅膀，随飞行时间扑翼）
          const flap = Math.sin(this._animTime * 8 + (p.seed || 0)) * 2;
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = p.color || '#3a3a3a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x - 4, p.y);
          ctx.quadraticCurveTo(p.x - 2, p.y - 2 - flap, p.x, p.y);
          ctx.quadraticCurveTo(p.x + 2, p.y - 2 - flap, p.x + 4, p.y);
          ctx.stroke();
          break;
        }
        case 'wheat_wave': {
          // V14.0：农田麦浪（金色小弧线起伏）
          const wave = Math.sin(this._animTime * 2.5 + (p.seed || 0)) * 1.5;
          ctx.globalAlpha = alpha * 0.6;
          ctx.strokeStyle = p.color || '#d4b54a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - 3, p.y);
          ctx.quadraticCurveTo(p.x, p.y - 3 - wave, p.x + 3, p.y);
          ctx.stroke();
          break;
        }
        case 'pollen': {
          // V15.0：春花粉（金色微点，闪烁飘落）
          const tw = 0.5 + 0.5 * Math.sin(this._animTime * 6 + (p.seed || 0));
          ctx.globalAlpha = alpha * 0.7 * tw;
          ctx.fillStyle = p.color || '#fff2a0';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'cicada_flash': {
          // V15.0：夏蝉鸣闪光（林间一瞬高光）
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color || '#ffe066';
          ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'firefly': {
          // V16.0：夜晚萤火虫（绿光闪烁，缓慢漂浮）
          const blink = 0.5 + 0.5 * Math.sin(this._animTime * 4 + (p.seed || 0));
          ctx.globalAlpha = alpha * (0.3 + blink * 0.7);
          ctx.fillStyle = p.color || '#aaff80';
          ctx.shadowColor = p.color || '#aaff80';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
      }
    }
    ctx.restore();
  }

  // V13.0：地形动态发射器总入口（边关烽火/沙漠沙尘/森林落叶/港口波纹）
  _emitTerrainParticles(dt) {
    if (!this.game) return;
    const W = this.canvas.width || 1024;
    const si = this._seasonIdx();

    // 边关烽火（山地城 + 战时）
    this._beaconTimer -= dt;
    if (this._beaconTimer <= 0 && this._warActive) {
      this._beaconTimer = 0.6;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'mountain') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 80)) continue;
        this._spawnMapParticle('beacon_smoke', pos.x + 4, pos.y - 14, {
          vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 8,
          gravity: -4, life: 0, maxLife: 2.2 + Math.random() * 1,
          size: 2 + Math.random() * 2, color: '#5a5048'
        });
      }
    }

    // 沙漠沙尘暴（偶发）
    this._sandstormTimer -= dt;
    if (this._sandstormTimer <= 0) {
      this._sandstormTimer = 2.5 + Math.random() * 2;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'desert') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 120)) continue;
        for (let i = 0; i < 6; i++) {
          this._spawnMapParticle('sandstorm',
            pos.x - 40 + Math.random() * 30, pos.y - 10 + Math.random() * 20, {
              vx: 90 + Math.random() * 60, vy: (Math.random() - 0.5) * 10,
              gravity: 0, life: 0, maxLife: 1.6 + Math.random() * 0.8,
              size: 1.5 + Math.random() * 1.5, color: '#c2a060'
            });
        }
      }
    }

    // 森林落叶（秋季更密，其他季节偶尔）
    this._forestLeafTimer -= dt;
    const leafInterval = si === 2 ? 0.25 : 1.2; // 秋密
    if (this._forestLeafTimer <= 0) {
      this._forestLeafTimer = leafInterval;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'forest') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 80)) continue;
        this._spawnMapParticle('leaf_fall',
          pos.x + (Math.random() - 0.5) * 30, pos.y - 16, {
            vx: (Math.random() - 0.5) * 12, vy: 16 + Math.random() * 8,
            gravity: 8, life: 0, maxLife: 3 + Math.random() * 1.5,
            size: 2 + Math.random() * 2,
            color: si === 2 ? '#b8862a' : '#4a7c3a',
            seed: Math.random() * 10
          });
      }
    }

    // 港口波纹（河流城）
    this._portRippleTimer -= dt;
    if (this._portRippleTimer <= 0) {
      this._portRippleTimer = 0.8;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'river') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 60)) continue;
        this._spawnMapParticle('port_ripple',
          pos.x + (Math.random() - 0.5) * 20, pos.y + 6, {
            vx: 0, vy: 0, gravity: 0,
            life: 0, maxLife: 1.4, size: 3, color: '#8fc4e8',
            seed: Math.random() * 10
          });
      }
    }

    // ---- V14.0 新增：草丛摇曳（平原）----
    this._grassTimer -= dt;
    if (this._grassTimer <= 0) {
      this._grassTimer = 0.7;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'plain') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 60)) continue;
        this._spawnMapParticle('grass_sway',
          pos.x + (Math.random() - 0.5) * 30, pos.y + (Math.random() - 0.5) * 10, {
            vx: 0, vy: 0, gravity: 0,
            life: 0, maxLife: 1.2, size: 2, color: '#6aa050',
            seed: Math.random() * 10
          });
      }
    }

    // ---- V14.0 新增：水鸟飞过（河流城上空）----
    this._birdTimer -= dt;
    if (this._birdTimer <= 0) {
      this._birdTimer = 3.0 + Math.random() * 2.0;
      for (const city of this.game.cities.values()) {
        if (city.terrain !== 'river') continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 100)) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this._spawnMapParticle('bird',
          pos.x - dir * 40, pos.y - 40 - Math.random() * 20, {
            vx: dir * (30 + Math.random() * 20), vy: 0, gravity: 0,
            life: 0, maxLife: 2.0, size: 2, color: '#3a3a3a',
            seed: Math.random() * 10
          });
      }
    }

    // ---- V14.0 新增：农田麦浪（城市周边，size>=2 的城）----
    this._wheatTimer -= dt;
    if (this._wheatTimer <= 0) {
      this._wheatTimer = 1.5;
      for (const city of this.game.cities.values()) {
        if (!city.size || city.size < 2) continue;
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (!this._onScreen(pos.x, pos.y, 80)) continue;
        this._spawnMapParticle('wheat_wave',
          pos.x + (Math.random() - 0.5) * 40, pos.y + 10, {
            vx: (Math.random() - 0.5) * 6, vy: 0, gravity: 0,
            life: 0, maxLife: 1.6, size: 2, color: '#d4b54a',
            seed: Math.random() * 10
          });
      }
    }

    // ---- V14.0：战时战场区域尘土飞扬（军队所在处）----
    if (this._warActive) {
      for (const army of this.game.armies) {
        const c = this.game.cities.get(army.cityId);
        if (!c) continue;
        const pos = this.isoToScreen(c.isoX, c.isoY);
        if (!this._onScreen(pos.x, pos.y, 60)) continue;
        if (Math.random() < 0.3) {
          this._spawnMapParticle('march_dust',
            pos.x + (Math.random() - 0.5) * 20, pos.y - 10, {
              vx: (Math.random() - 0.5) * 10, vy: -5 - Math.random() * 8,
              gravity: 3, life: 0, maxLife: 0.9 + Math.random() * 0.3,
              size: 2 + Math.random() * 2, color: '#8B7355'
            });
        }
      }
    }
  }

  // ============================================================
  // V15.0：天气系统（晴/多云/雨/雪/雾/沙暴）
  // ------------------------------------------------------------
  // 公共 API：setWeather(type) / getWeather() / updateWeather(dt)
  //          / getWeatherModifiers()
  // 天气影响（供外部 army/supply/fog 读取，本文件只负责表现与数据）：
  //   雨：河水暴涨(水军加成)、陆军移动减慢
  //   雪：北方城市、移动减慢、补给消耗增加
  //   雾：视野缩小、伏击概率增加
  //   沙暴：沙漠地区、视野极小、士气下降
  //   晴：正常
  // ============================================================
  static WEATHER_TYPES = ['晴', '多云', '雨', '雪', '雾', '沙暴'];

  // 设置天气（0.5s 平滑渐变到新天气）
  setWeather(type) {
    if (!IsometricMap.WEATHER_TYPES.includes(type)) type = '晴';
    if (type === this.weather) return;
    this._weatherPrev = this.weather;
    this.weather = type;
    this._weatherBlend = 0;            // 开始过渡
    // 切换时清掉一批旧天气粒子，避免雨→雪瞬间混杂
    this._weatherParticles.length = 0;
  }

  // 查询当前天气
  getWeather() { return this.weather; }

  // 天气对玩法的修正数据（外部读取，纯表现层之外的数值契约）
  getWeatherModifiers() {
    switch (this.weather) {
      case '雨':   return { navyBonus: 0.25, armyMoveMult: 0.7, supplyCost: 1.0, visionRange: 1.0, ambushChance: 0.1, morale: 0 };
      case '雪':   return { navyBonus: 0,    armyMoveMult: 0.6, supplyCost: 1.4, visionRange: 0.9, ambushChance: 0.05, morale: -0.05 };
      case '雾':   return { navyBonus: 0,    armyMoveMult: 0.9, supplyCost: 1.0, visionRange: 0.5, ambushChance: 0.3,  morale: -0.05 };
      case '沙暴': return { navyBonus: 0,    armyMoveMult: 0.65, supplyCost: 1.2, visionRange: 0.25, ambushChance: 0.15, morale: -0.15 };
      case '多云': return { navyBonus: 0,    armyMoveMult: 1.0, supplyCost: 1.0, visionRange: 0.95, ambushChance: 0,    morale: 0 };
      default:     return { navyBonus: 0,    armyMoveMult: 1.0, supplyCost: 1.0, visionRange: 1.0, ambushChance: 0,    morale: 0 };
    }
  }

  // 天气粒子对象池取/还
  _weatherGet() {
    const p = this._weatherPool.pop();
    if (p) { p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; p.maxLife = 1; p.size = 2; p.kind = ''; return p; }
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, kind: '' };
  }
  _weatherRelease(p) {
    if (this._weatherPool.length < 400) this._weatherPool.push(p);
  }

  // 每帧更新天气：推进过渡、自动演化、发射天气粒子
  updateWeather(dt) {
    // 0.5s 平滑过渡
    if (this._weatherBlend < 1) {
      this._weatherBlend = Math.min(1, this._weatherBlend + dt / 0.5);
    }
    // 自动演化（随季节与地区）
    this._weatherAutoTimer -= dt;
    if (this._weatherAutoTimer <= 0) {
      this._weatherAutoTimer = 6 + Math.random() * 6;
      const decided = this._weatherAutoDecide();
      if (decided && decided !== this.weather) this.setWeather(decided);
    }
    // 发射天气粒子
    this._emitWeatherParticles(dt);
    // 更新天气粒子
    const W = this.canvas.width || 1024, H = this.canvas.height || 600;
    for (let i = this._weatherParticles.length - 1; i >= 0; i--) {
      const p = this._weatherParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.maxLife || p.y > H + 20 || p.x < -40 || p.x > W + 40) {
        this._weatherParticles.splice(i, 1);
        this._weatherRelease(p);
      }
    }
  }

  // 根据季节与视口所在地区决定天气
  _weatherAutoDecide() {
    if (!this.game) return this.weather;
    const si = this._seasonIdx(); // 0春 1夏 2秋 3冬
    // 统计视口内城市的平均 isoY（大=南方，小=北方）与是否有沙漠
    let sumY = 0, cnt = 0, hasDesert = false;
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 200)) continue;
      sumY += city.isoY; cnt++;
      if (city.terrain === 'desert') hasDesert = true;
    }
    if (cnt === 0) return this.weather;
    const avgY = sumY / cnt;
    const isNorth = avgY < 7;     // 偏北
    const isSouth = avgY > 10;    // 偏南
    // 沙漠随机沙暴
    if (hasDesert && Math.random() < 0.35) return '沙暴';
    if (si === 3) {               // 冬：北方雪，南方多云/雪
      if (isNorth) return '雪';
      return Math.random() < 0.5 ? '多云' : '晴';
    }
    if (si === 1) {               // 夏：南方雨，北方晴/多云
      if (isSouth) return Math.random() < 0.6 ? '雨' : '晴';
      return Math.random() < 0.4 ? '多云' : '晴';
    }
    // 春秋：随机雾/多云/晴
    const r = Math.random();
    if (r < 0.15) return '雾';
    if (r < 0.45) return '多云';
    return '晴';
  }

  // 按天气类型发射粒子
  _emitWeatherParticles(dt) {
    const W = this.canvas.width || 1024, H = this.canvas.height || 600;
    this._weatherEmitTimer -= dt;
    // 降帧：非关键天气粒子隔帧发射（性能优化）
    this._fxFrameSkip = (this._fxFrameSkip + 1) % 2;
    if (this._fxFrameSkip !== 0 && (this.weather === '雾' || this.weather === '多云')) return;

    const intervalMap = { '雨': 0.02, '雪': 0.06, '雾': 0.12, '沙暴': 0.04, '多云': 0.2, '晴': 999 };
    const iv = intervalMap[this.weather] || 999;
    if (this._weatherEmitTimer > 0) return;
    this._weatherEmitTimer = iv;
    if (this._weatherParticles.length >= this._WEATHER_PARTICLE_CAP) return;

    const p = this._weatherGet();
    switch (this.weather) {
      case '雨':
        Object.assign(p, { kind: 'rain', x: Math.random() * W, y: -10,
          vx: -60, vy: 520 + Math.random() * 120, maxLife: 1.2, size: 8 + Math.random() * 6 });
        break;
      case '雪':
        Object.assign(p, { kind: 'snow', x: Math.random() * W, y: -10,
          vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 40, maxLife: 6, size: 1.5 + Math.random() * 2.5 });
        break;
      case '雾':
        Object.assign(p, { kind: 'mist', x: Math.random() * W, y: H * 0.3 + Math.random() * H * 0.6,
          vx: 8 + Math.random() * 12, vy: (Math.random() - 0.5) * 6, maxLife: 6 + Math.random() * 3,
          size: 60 + Math.random() * 80 });
        break;
      case '沙暴':
        Object.assign(p, { kind: 'sand', x: -20, y: Math.random() * H,
          vx: 260 + Math.random() * 160, vy: (Math.random() - 0.5) * 30, maxLife: 2.5, size: 1.5 + Math.random() * 2 });
        break;
      default:
        this._weatherRelease(p);
        return;
    }
    this._weatherParticles.push(p);
  }

  // 绘制天气粒子（最上层，按 blend 透明度过渡）
  _drawWeatherParticles(ctx) {
    const blend = this._weatherBlend;
    if (this._weatherParticles.length === 0 || blend <= 0) return;
    ctx.save();
    for (const p of this._weatherParticles) {
      const prog = p.life / p.maxLife;
      switch (p.kind) {
        case 'rain':
          ctx.globalAlpha = 0.35 * blend * (1 - prog * 0.3);
          ctx.strokeStyle = '#9fc0e8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
          ctx.stroke();
          break;
        case 'snow':
          ctx.globalAlpha = 0.85 * blend;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'mist':
          ctx.globalAlpha = 0.10 * blend * Math.sin(prog * Math.PI);
          ctx.fillStyle = '#dfe6ee';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'sand':
          ctx.globalAlpha = 0.4 * blend;
          ctx.strokeStyle = '#c2a060';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y);
          ctx.stroke();
          break;
      }
    }
    ctx.restore();
  }

  // 天气色调叠加（雨暗、雪白、雾白、沙黄、多云灰）
  _drawWeatherTint(ctx) {
    const blend = this._weatherBlend;
    if (blend <= 0) return;
    let color = null;
    switch (this.weather) {
      case '雨':   color = `rgba(30,45,70,${0.22 * blend})`; break;
      case '雪':   color = `rgba(220,230,245,${0.18 * blend})`; break;
      case '雾':   color = `rgba(210,220,230,${0.30 * blend})`; break;
      case '沙暴': color = `rgba(180,140,70,${0.35 * blend})`; break;
      case '多云': color = `rgba(120,125,135,${0.12 * blend})`; break;
      default: color = null;
    }
    if (!color) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  // 天气指示器：小地图旁绘制当前天气图标 + 文字
  _drawWeatherIndicator(ctx, mmX, mmY, mmW, mmH) {
    const icons = { '晴': '☀', '多云': '☁', '雨': '☂', '雪': '❄', '雾': '≋', '沙暴': '≡' };
    const label = this.weather;
    const ix = mmX, iy = mmY - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(20,30,20,0.85)';
    ctx.fillRect(ix, iy, 86, 22);
    ctx.strokeStyle = '#C4A55A';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix, iy, 86, 22);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '14px "STSong", serif';
    ctx.fillStyle = '#FFE9A8';
    ctx.fillText(icons[label] || '?', ix + 6, iy + 11);
    ctx.font = '13px "STSong", serif';
    ctx.fillStyle = '#e8d5a3';
    ctx.fillText(label, ix + 28, iy + 11);
    ctx.restore();
  }

  // ============================================================
  // V15.0：地图特效增强 — 贸易路线 / 宗教传播 / 战争迷雾 / 城防 / 季节
  // ============================================================

  // 贸易路线：城市间金色光点沿连线移动（表示商队）
  _drawTradeRoutes(ctx) {
    if (!this.game) return;
    const t = this._animTime;
    ctx.save();
    // 仅对同屏连线画移动光点，控制数量
    let drawn = 0;
    for (const city of this.game.cities.values()) {
      if (drawn >= 10) break;
      const links = CITY_LINKS[city.id] || [];
      for (const targetId of links) {
        if (city.id >= targetId) continue;
        const target = this.game.cities.get(targetId);
        if (!target) continue;
        const p1 = this.isoToScreen(city.isoX, city.isoY);
        const p2 = this.isoToScreen(target.isoX, target.isoY);
        if (!this._onScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 180)) continue;
        // 沿路线移动的商队光点（0→1 循环，带相位差）
        const phase = ((t * 0.15 + city.isoX * 0.13) % 1 + 1) % 1;
        const cx = p1.x + (p2.x - p1.x) * phase;
        const cy = p1.y + (p2.y - p1.y) * phase;
        ctx.fillStyle = 'rgba(255,215,0,0.9)';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        drawn++;
        if (drawn >= 10) break;
      }
    }
    ctx.restore();
  }

  // 宗教传播波纹：周期性从城市扩散彩色圆环
  _updateReligionRipples(dt) {
    this._religionTimer -= dt;
    if (this._religionTimer <= 0 && this.game) {
      this._religionTimer = 3.5 + Math.random() * 2.5;
      // 随机选一个可见城市发出宗教波纹（佛金/道青/儒红三色）
      const visible = [];
      for (const city of this.game.cities.values()) {
        const pos = this.isoToScreen(city.isoX, city.isoY);
        if (this._onScreen(pos.x, pos.y, 150)) visible.push(city);
      }
      if (visible.length) {
        const c = visible[Math.floor(Math.random() * visible.length)];
        const pos = this.isoToScreen(c.isoX, c.isoY);
        const colors = ['#FFD700', '#6fe0a0', '#ff8a6a'];
        this._religionRipples.push({
          x: pos.x, y: pos.y, life: 0, maxLife: 2.2,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    }
    for (let i = this._religionRipples.length - 1; i >= 0; i--) {
      const r = this._religionRipples[i];
      r.life += dt;
      if (r.life >= r.maxLife) this._religionRipples.splice(i, 1);
    }
  }
  _drawReligionRipples(ctx) {
    if (this._religionRipples.length === 0) return;
    ctx.save();
    for (const r of this._religionRipples) {
      const prog = r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.6 * (1 - prog);
      ctx.lineWidth = 2;
      const rr = 8 + prog * 60;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // 战争迷雾增强：对已探索但无视野的城市画柔和渐变雾团
  _drawWarFog(ctx) {
    if (!this.game) return;
    ctx.save();
    for (const city of this.game.cities.values()) {
      const explored = (typeof this.game.isCityExplored === 'function')
        ? this.game.isCityExplored(city.id) : true;
      const visible = (typeof this.game.isCityCurrentlyVisible === 'function')
        ? this.game.isCityCurrentlyVisible(city.id) : true;
      if (!explored || visible) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      // 径向渐变雾团（边缘柔和）
      const g = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, 46);
      g.addColorStop(0, 'rgba(10,12,16,0.85)');
      g.addColorStop(0.6, 'rgba(10,12,16,0.55)');
      g.addColorStop(1, 'rgba(10,12,16,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 46, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 城防等级可视化：城墙高度随 defense(0~100) 变化（绘制在城市菱形上方）
  _drawCityWall(ctx, r, defense) {
    const d = Math.max(0, Math.min(100, defense || 0));
    const h = (d / 100) * 10 * this.scale; // 0~10px
    if (h < 2) return;
    ctx.save();
    // 城墙（菱形两侧的矮墙，等距投影）
    ctx.fillStyle = '#8a8a92';
    ctx.strokeStyle = '#5a5a62';
    ctx.lineWidth = 1;
    // 正面墙
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(0, -h); ctx.lineTo(0, -h - r * 0.9); ctx.lineTo(-r, -r * 0.9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 右侧墙
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(0, -h); ctx.lineTo(0, -h - r * 0.9); ctx.lineTo(r, -r * 0.9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 城垛（锯齿）
    ctx.fillStyle = '#9a9aa2';
    const crenels = Math.max(2, Math.floor(r / 6));
    for (let i = 0; i <= crenels; i++) {
      const cx = -r + (2 * r / crenels) * i;
      ctx.fillRect(cx - 1.5, -r * 0.9 - h - 3, 3, 3);
    }
    ctx.restore();
  }

  // 季节特效增强：春花粉 / 夏蝉鸣闪光（秋落叶、冬雪花已有）
  _emitSeasonFX(dt) {
    const si = this._seasonIdx();
    const W = this.canvas.width || 1024;
    if (si === 0) {
      // 春：金色花粉粒子飘落（缓慢闪烁）
      this._pollenTimer -= dt;
      if (this._pollenTimer <= 0 && this._mapParticles.length < this._MAP_PARTICLE_CAP) {
        this._pollenTimer = 0.08;
        this._spawnMapParticle('pollen', Math.random() * W, -5, {
          vx: (Math.random() - 0.5) * 15, vy: 18 + Math.random() * 12,
          gravity: 0, life: 0, maxLife: 4, size: 1.2, color: '#fff2a0',
          seed: Math.random() * 10
        });
      }
    } else if (si === 1) {
      // 夏：蝉鸣视觉——随机闪光粒子（林间一闪）
      this._cicadaTimer -= dt;
      if (this._cicadaTimer <= 0 && this.game && this._mapParticles.length < this._MAP_PARTICLE_CAP) {
        this._cicadaTimer = 0.5 + Math.random() * 0.5;
        const forests = [];
        for (const city of this.game.cities.values()) {
          if (city.terrain === 'forest') {
            const pos = this.isoToScreen(city.isoX, city.isoY);
            if (this._onScreen(pos.x, pos.y, 100)) forests.push(pos);
          }
        }
        if (forests.length) {
          const pos = forests[Math.floor(Math.random() * forests.length)];
          this._spawnMapParticle('cicada_flash',
            pos.x + (Math.random() - 0.5) * 30, pos.y - 10 - Math.random() * 20, {
              vx: 0, vy: 0, gravity: 0, life: 0, maxLife: 0.35, size: 2.5,
              color: '#ffe066', seed: Math.random() * 10
            });
        }
      }
    }
  }

  render() {
    if (!this.game) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // V8.1：检测季节变化 → 置 dirty 重绘静态层
    const curSeason = this._seasonIdx();
    if (curSeason !== this._lastSeasonIdx) {
      this._lastSeasonIdx = curSeason;
      this.dirty = true;
    }

    // ---- V5.0：静态层（背景+地形+连线）缓存到离屏 Canvas，仅脏时重绘 ----
    if (this.dirty || !this._staticCanvas) {
      this._buildStaticLayer(W, H);
      this.dirty = false;
    }
    ctx.drawImage(this._staticCanvas, 0, 0);

    // V8.1：动态地形叠加（河流波纹）
    this._drawRiverRipples(ctx);
    // V16.0：水面增强（波纹+反光+倒影）
    this._drawWaterEnhanced(ctx);
    // V16.0：山地阴影（光源方向）
    this._drawMountainShadows(ctx);
    // V16.0：森林三层（近深/中/远浅）
    this._drawForestLayers(ctx);

    this._drawCities();
    this._drawArmies();
    this._drawSelection();

    // V8.1：昼夜色调叠加（主 ctx 直接叠加，无额外离屏 canvas）
    this._drawTimeTint(ctx);

    // V8.1：夜晚灯火（在色调之上，发光透出）
    this._drawNightLights(ctx);
    // V16.0：夜晚城市窗口亮灯 + 萤火虫粒子
    this._drawCityWindowLights(ctx);

    // V8.1：城市炊烟
    this._drawCitySmoke(ctx);

    // V8.1：季节氛围粒子
    this._drawAmbientParticles(ctx);

    // V13.0：地图独立粒子（烽火/沙尘/落叶/港口波纹/行军尘土，视口内）
    this._drawMapParticles(ctx);

    // V15.0：贸易路线（金色商队光点沿连线移动）
    this._drawTradeRoutes(ctx);

    // V15.0：宗教传播波纹
    this._drawReligionRipples(ctx);

    // V15.0：战争迷雾增强（已探索无视野城市柔和渐变雾团）
    this._drawWarFog(ctx);

    // V15.0：天气色调叠加（雨暗/雪白/雾白/沙黄/多云灰）
    this._drawWeatherTint(ctx);

    // V8.1：飘动云层（最上层，半透明不遮挡）
    this._drawClouds(ctx);

    // V15.0：天气粒子（雨滴/雪花/雾气/沙尘，最上层覆盖）
    this._drawWeatherParticles(ctx);

    // V14.0：小地图（右下角，缩略全图 + 视口框 + 城市/军队点）
    const mmW = 140, mmH = 90;
    const mmX = W - mmW - 12, mmY = H - mmH - 12;
    this.drawMinimap(ctx, mmX, mmY, mmW, mmH);

    // V15.0：天气指示器（小地图上方）
    this._drawWeatherIndicator(ctx, mmX, mmY, mmW, mmH);

    // V16.0：战役模式地图标记（最上层，覆盖一切）
    this._drawCampaignMarkers(ctx);
    this._drawCampaignParticles(ctx);
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

      // V8.1：季节色调叠加（草地类随季节微调）
      ctx.fillStyle = this._seasonTerrainColor(t.color, city.terrain);
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
        // V8.1：冬季高山积雪（白色半透明覆盖山顶）
        if (this._seasonIdx() === 3) {
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.8);
          ctx.lineTo(w * 0.18, -h * 0.48);
          ctx.lineTo(-w * 0.18, -h * 0.48);
          ctx.closePath();
          ctx.fill();
        }
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

  // ============================================================
  // V8.1：动态氛围绘制
  // ============================================================

  // 昼夜色调叠加：半透明矩形覆盖主 ctx
  _drawTimeTint(ctx) {
    const ov = this._getTimeOverlay(this.currentHour);
    if (ov.alpha <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ov.alpha;
    ctx.fillStyle = `rgb(${ov.r},${ov.g},${ov.b})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  // 河流波纹：正弦波动态线（V13.0 增强流动感：3 条流线 + 流速更快）
  _drawRiverRipples(ctx) {
    const t = this._animTime;
    ctx.save();
    for (const city of this.game.cities.values()) {
      if (city.terrain !== 'river') continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 80)) continue;
      const w = TILE_W * 1.2 * this.scale;
      // V13.0：3 条流线，相位错移，模拟水流涌动
      for (let r = 0; r < 3; r++) {
        ctx.strokeStyle = `rgba(180,220,255,${0.3 - r * 0.07})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const px = -w / 2 + (w * i / 20);
          // 流速加快（t*3），叠加城市相位避免同步
          const py = Math.sin(i * 0.8 + t * 3 + city.isoX * 3 + r * 2.1) * 2.2 + r * 5 - 5;
          if (i === 0) ctx.moveTo(pos.x + px, pos.y + py);
          else ctx.lineTo(pos.x + px, pos.y + py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 夜晚灯火：暖黄色光点 + 径向渐变光晕，都城更大更亮
  _drawNightLights(ctx) {
    if (!this._isNight()) return;
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      // 未探索城市不亮灯
      if (typeof this.game.isCityExplored === 'function'
          && !this.game.isCityExplored(city.id)) continue;
      const isCapital = !!city.capital;
      const baseR = (isCapital ? 9 : 4.5) * this.scale;
      const glowR = baseR * (isCapital ? 4 : 3);
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
      grad.addColorStop(0, `rgba(255,220,120,${isCapital ? 0.9 : 0.7})`);
      grad.addColorStop(0.4, `rgba(255,180,80,${isCapital ? 0.4 : 0.25})`);
      grad.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      // 亮核
      ctx.fillStyle = '#FFE080';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, baseR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 城市炊烟：灰色小粒子缓慢上升扩散
  _drawCitySmoke(ctx) {
    if (this._smokeParticles.length === 0) return;
    ctx.save();
    for (const p of this._smokeParticles) {
      const a = (1 - p.life / p.maxLife) * 0.35;
      ctx.fillStyle = `rgba(180,180,180,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + p.life * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 季节氛围粒子：春花瓣 / 秋落叶 / 冬飘雪
  _drawAmbientParticles(ctx) {
    if (this._ambientParticles.length === 0) return;
    ctx.save();
    for (const p of this._ambientParticles) {
      const a = (1 - p.life / p.maxLife) * 0.7;
      if (p.season === 0) {        // 春：粉色花瓣
        ctx.fillStyle = `rgba(255,180,200,${a})`;
      } else if (p.season === 2) { // 秋：棕黄落叶
        ctx.fillStyle = `rgba(200,140,60,${a})`;
      } else if (p.season === 3) { // 冬：白色飘雪
        ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      } else { continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 飘动云层：半透明白色椭圆，横向循环滚动
  _drawClouds(ctx) {
    if (this._clouds.length === 0) return;
    ctx.save();
    for (const c of this._clouds) {
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
      ctx.fill();
      // 附加小云朵
      ctx.beginPath();
      ctx.ellipse(c.x - c.w * 0.3, c.y + c.h * 0.4, c.w * 0.5, c.h * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.25, c.y + c.h * 0.25, c.w * 0.4, c.h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
      // V14.0：城市规模可视化（小/中/大/都城 四档缩放）
      const sizeScale = this.getCityIconScale(city);
      const r = (10 + size * 4) * this.scale * sizeScale;

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

      // 都城宫殿标识 + 王旗飘动（V13.0：王旗为多角飘带，正弦波摆动）
      if (city.capital) {
        // V14.0：都城更大的势力色光圈
        ctx.save();
        const capGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
        capGlow.addColorStop(0, this._factionColorWithAlpha(color, 0.35));
        capGlow.addColorStop(1, this._factionColorWithAlpha(color, 0));
        ctx.fillStyle = capGlow;
        ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, -r - 8 * this.scale);
        ctx.lineTo(6 * this.scale, -r);
        ctx.lineTo(-6 * this.scale, -r);
        ctx.closePath();
        ctx.fill();
        // 王旗旗杆
        const flagSwing = Math.sin(t * 3 + city.isoX) * 2 * this.scale;
        ctx.strokeStyle = '#C4A55A';
        ctx.lineWidth = 1.5 * this.scale;
        ctx.beginPath();
        ctx.moveTo(0, -r - 8 * this.scale);
        ctx.lineTo(0, -r - 24 * this.scale);
        ctx.stroke();
        // 王旗飘带（三段正弦，随风波动 + 随机扰动）
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, -r - 24 * this.scale);
        for (let s = 1; s <= 4; s++) {
          const fx = s * 3 * this.scale;
          const fy = -r - 24 * this.scale + s * 1.5 * this.scale
                   + Math.sin(t * 5 + s * 1.2) * 1.2 * this.scale;
          ctx.lineTo(fx, fy);
        }
        ctx.lineTo(0, -r - 18 * this.scale);
        ctx.closePath();
        ctx.fill();
      }

      // V13.0：港口（河流城）—— 小船只随水波轻微摇晃
      if (city.terrain === 'river') {
        const boatRock = Math.sin(t * 2 + city.isoX) * 0.12; // 摇晃角
        const boatBob = Math.sin(t * 3 + city.isoY) * 1.5 * this.scale;
        ctx.save();
        ctx.translate(r * 0.5, r * 0.4 + boatBob);
        ctx.rotate(boatRock);
        // 船身
        ctx.fillStyle = '#6a4a2a';
        ctx.beginPath();
        ctx.moveTo(-5 * this.scale, 0);
        ctx.lineTo(5 * this.scale, 0);
        ctx.lineTo(3 * this.scale, 2.5 * this.scale);
        ctx.lineTo(-3 * this.scale, 2.5 * this.scale);
        ctx.closePath();
        ctx.fill();
        // 桅杆
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1 * this.scale;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -6 * this.scale);
        ctx.stroke();
        ctx.restore();
      }

      // V13.0：边关（山地城）—— 战时烽火台冒烟
      if (city.terrain === 'mountain' && this._warActive) {
        ctx.fillStyle = '#4a3a2a';
        ctx.beginPath();
        ctx.moveTo(-4 * this.scale, -r);
        ctx.lineTo(4 * this.scale, -r);
        ctx.lineTo(3 * this.scale, -r - 5 * this.scale);
        ctx.lineTo(-3 * this.scale, -r - 5 * this.scale);
        ctx.closePath();
        ctx.fill();
        // 烽火火光（脉动）
        const flame = 0.6 + 0.4 * Math.sin(t * 6 + city.isoX);
        ctx.fillStyle = `rgba(255,${120 + Math.floor(flame * 80)},40,0.9)`;
        ctx.beginPath();
        ctx.arc(0, -r - 6 * this.scale, (1.5 + flame) * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // V15.0：城防等级可视化（城墙高度随 defense 变化）
      this._drawCityWall(ctx, r, city.defense);

      // V15.0：冬季白雪覆盖（城市底座一层薄雪）
      if (this._seasonIdx() === 3) {
        ctx.fillStyle = 'rgba(245,250,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.85, r * 0.4, 0, 0, Math.PI * 2);
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

      // V13.0：行军时画交替摆动的小腿（相位差 π，步频 2Hz）
      if (anim.moving) {
        const stepPhase = (t * 2) * Math.PI * 2; // 步频 2Hz
        const legA = Math.sin(stepPhase) * 2.5 * this.scale;
        const legB = -legA; // 相位差 π
        ctx.strokeStyle = '#3a3028';
        ctx.lineWidth = 1.5 * this.scale;
        ctx.beginPath();
        ctx.moveTo(-2 * this.scale, r * 0.8);
        ctx.lineTo(-2 * this.scale + legA, r * 0.8 + 3 * this.scale);
        ctx.moveTo(2 * this.scale, r * 0.8);
        ctx.lineTo(2 * this.scale + legB, r * 0.8 + 3 * this.scale);
        ctx.stroke();
      }

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

      // V13.0：行军时脚下生成尘土粒子（节流，约每 0.25s 一粒，独立地图粒子系统）
      if (anim.moving && this._animTime - this._lastMarchDustEmit > 0.25) {
        this._lastMarchDustEmit = this._animTime;
        this._spawnMapParticle('march_dust',
          drawX + (Math.random() - 0.5) * 6, drawY + r * 0.6, {
            vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 6,
            gravity: 4, life: 0, maxLife: 0.9 + Math.random() * 0.4,
            size: 1.8 + Math.random() * 1.8, color: '#8B7355'
          });
      }
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

  // 颜色 hex 转 rgba（供都城光圈渐变用）
  _factionColorWithAlpha(hex, a) {
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ============================================================
  // V14.0 霸业宏图 — 城市规模可视化
  // ============================================================
  // 城市规模分级：1-2 小城市(1) / 3 中城市(2) / 4-5 大城市(3)，都城额外+1
  getCitySizeLevel(city) {
    if (!city) return 1;
    const s = city.size || 1;
    let level = 1;
    if (s >= 4) level = 3;
    else if (s >= 3) level = 2;
    else level = 1;
    if (city.capital) level = Math.min(4, level + 1);
    return level;
  }

  // 城市图标缩放系数（小/中/大/都城 四档）
  getCityIconScale(city) {
    const lv = this.getCitySizeLevel(city);
    return [0, 0.75, 1.0, 1.25, 1.5][lv] || 1.0;
  }

  // ============================================================
  // V14.0 — 军队单位绘制（含武将头像 / 兵力条 / 待机晃动）
  // ============================================================
  // 在 (x,y) 绘制军队棋子：圆形底 + 势力色 + 兵力条 + 待机晃动
  drawArmyUnit(ctx, army, x, y, time) {
    if (!ctx || !army) return;
    const faction = (this.game && FACTIONS[army.faction]) || { color: '#666', colorLight: '#888' };
    const t = time || this._animTime;
    const r = 8 * this.scale;

    // 待机轻微晃动（模拟士兵活动）
    const sway = Math.sin(t * 2 + (army.id || 0)) * 0.8 * this.scale;
    ctx.save();
    ctx.translate(x + sway, y);

    // 军队圆形棋子
    ctx.fillStyle = faction.color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#E8D5A3';
    ctx.lineWidth = 1.5 * this.scale;
    ctx.stroke();

    // 兵力条：根据兵力多少显示高度，低兵力红色闪烁
    const troops = army.troops || 0;
    const maxT = army.maxTroops || 100000;
    const ratio = Math.max(0, Math.min(1, troops / maxT));
    const barH = (2 + ratio * 5) * this.scale;
    const barW = r * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW / 2, r + 2 * this.scale, barW, barH);
    // 低兵力红色闪烁
    if (ratio < 0.25) {
      const blink = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = `rgba(255,60,60,${0.5 + blink * 0.5})`;
    } else {
      ctx.fillStyle = ratio > 0.6 ? '#66dd66' : (ratio > 0.3 ? '#e8d040' : '#e88040');
    }
    ctx.fillRect(-barW / 2, r + 2 * this.scale, barW * ratio, barH);

    ctx.restore();
  }

  // 绘制武将头像缩略图（圆形裁剪 + 势力色边框）
  drawArmyPortrait(ctx, general, x, y, size = 16) {
    if (!ctx) return;
    const s = size * this.scale;
    const faction = (this.game && general && FACTIONS[general.faction]) || { color: '#c03030' };
    ctx.save();
    ctx.translate(x, y);
    // 圆形裁剪
    ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.clip();
    // 占位底（势力色渐变）
    const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, faction.color);
    g.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = g;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    // 首字
    ctx.fillStyle = '#FFE9A8';
    ctx.font = `bold ${Math.round(s * 0.55)}px "STSong", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((general && general.name ? general.name : '将').charAt(0), 0, 0);
    ctx.restore();
    // 势力色圆形边框
    ctx.save();
    ctx.strokeStyle = faction.color;
    ctx.lineWidth = 1.5 * this.scale;
    ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ============================================================
  // V14.0 — 地形瓦片绘制（平原/山地/森林/河流/沙漠 视觉提升）
  // ============================================================
  drawTerrainTile(ctx, terrain, x, y, size, time = 0) {
    if (!ctx || !terrain) return;
    const w = size, h = size * 0.5;
    ctx.save();
    ctx.translate(x, y);
    switch (terrain) {
      case 'plain': {
        // 绿色渐变 + 草丛摇曳
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, '#5a8c4a'); g.addColorStop(1, '#3a6c2a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0);
        ctx.closePath(); ctx.fill();
        // 草丛（随时间摇曳）
        ctx.strokeStyle = 'rgba(80,140,60,0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const gx = Math.sin(time + i) * 2;
          ctx.beginPath();
          ctx.moveTo(-w / 4 + i * w / 5, 0);
          ctx.lineTo(-w / 4 + i * w / 5 + gx, -h / 4);
          ctx.stroke();
        }
        break;
      }
      case 'mountain': {
        // 棕色岩石 + 山顶积雪
        ctx.fillStyle = '#7A6B5A';
        ctx.beginPath();
        ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8A7B6A';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.8); ctx.lineTo(w * 0.28, -h * 0.2); ctx.lineTo(-w * 0.28, -h * 0.2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.8); ctx.lineTo(w * 0.16, -h * 0.5); ctx.lineTo(-w * 0.16, -h * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'forest': {
        // 深绿 + 多层树木
        ctx.fillStyle = '#2D5A2D';
        ctx.beginPath();
        ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a4a1a';
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(-w / 5 + i * w / 3, -h / 8, h / 5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'river': {
        // 蓝色水流波纹（3条流线）+ 反光
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, '#4A8BC0'); g.addColorStop(1, '#2A5B9C');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(200,230,255,0.5)';
        ctx.lineWidth = 1;
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) {
            const px = -w / 2 + (w * i / 8);
            const py = Math.sin(i * 0.9 + time * 3 + r * 2) * 2 + (r - 1) * 4;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }
      case 'desert': {
        // 黄色渐变 + 沙丘纹理
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, '#d4b56a'); g.addColorStop(1, '#b4954a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,130,80,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 3, -h / 8);
        ctx.quadraticCurveTo(0, h / 6, w / 3, -h / 8);
        ctx.stroke();
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  // ============================================================
  // V14.0 — 小地图（右下角缩略全图 + 视口框 + 城市点 + 军队点）
  // ============================================================
  drawMinimap(ctx, x, y, w, h) {
    if (!ctx || !this.game) return;
    ctx.save();
    // 背景
    ctx.fillStyle = 'rgba(20,30,20,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#C4A55A';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // 计算全图包围盒
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const city of this.game.cities.values()) {
      if (city.isoX < minX) minX = city.isoX;
      if (city.isoX > maxX) maxX = city.isoX;
      if (city.isoY < minY) minY = city.isoY;
      if (city.isoY > maxY) maxY = city.isoY;
    }
    if (!isFinite(minX)) { ctx.restore(); return; }
    const pad = 1;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const sx = w / (maxX - minX);
    const sy = h / (maxY - minY);
    const toMini = (isoX, isoY) => ({
      mx: x + (isoX - minX) * sx,
      my: y + (isoY - minY) * sy
    });

    // 城市点
    for (const city of this.game.cities.values()) {
      const { mx, my } = toMini(city.isoX, city.isoY);
      const faction = city.owner ? FACTIONS[city.owner] : null;
      ctx.fillStyle = faction ? faction.color : '#888';
      const r = city.capital ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    }
    // 军队点
    for (const army of this.game.armies) {
      const c = this.game.cities.get(army.cityId);
      if (!c) continue;
      const { mx, my } = toMini(c.isoX, c.isoY);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(mx, my, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // 视口框（当前 offset/scale 对应的等距范围近似）
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    const corners = [
      this.screenToIso(0, 0),
      this.screenToIso(this.canvas.width, 0),
      this.screenToIso(this.canvas.width, this.canvas.height),
      this.screenToIso(0, this.canvas.height)
    ];
    ctx.beginPath();
    corners.forEach((c, i) => {
      const { mx, my } = toMini(c.isoX, c.isoY);
      if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // V16.0 — 战役模式地图标记 公共 API
  // ============================================================

  // 设置战役目标点（等距坐标）
  // {isoX, isoY} 或城市对象；null 清除
  setCampaignTarget(target) {
    if (!target) { this._campTarget = null; return; }
    if (typeof target === 'object' && (target.isoX != null)) {
      this._campTarget = { isoX: target.isoX, isoY: target.isoY };
    } else {
      this._campTarget = null;
    }
  }

  // 设置战役路径（起点→目标的节点数组 [{isoX,isoY},...]）
  setCampaignPath(points) {
    if (!Array.isArray(points) || points.length < 2) { this._campPath = null; return; }
    this._campPath = points.filter(p => p && p.isoX != null).slice(0, 12);
  }

  // 设置战役势力覆盖区域（多边形等距点 + 颜色）
  // {isoPoints:[{isoX,isoY}], color:'#hex'}
  setCampaignArea(area) {
    if (!area || !Array.isArray(area.isoPoints) || area.isoPoints.length < 3) {
      this._campArea = null; return;
    }
    this._campArea = {
      isoPoints: area.isoPoints.slice(0, 24),
      color: area.color || '#c04040'
    };
  }

  // 战役胜利：目标点转为庆祝粒子（彩带/烟花）
  markCampaignVictory() {
    this._campWon = true;
    if (this._campTarget) {
      const pos = this.isoToScreen(this._campTarget.isoX, this._campTarget.isoY);
      this._spawnCelebrationBurst(pos.x, pos.y);
    }
  }

  // 清除战役标记（进入普通模式）
  clearCampaignMarkers() {
    this._campTarget = null;
    this._campPath = null;
    this._campArea = null;
    this._campWon = false;
    this._campParticles.length = 0;
  }

  // 触发一次交战火花（军队交战时由外部调用）
  // x,y: 屏幕坐标；count: 火花数量
  triggerBattleSparks(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      if (this._battleSparks.length >= 80) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      this._battleSparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        size: 1 + Math.random() * 2,
        color: Math.random() < 0.3 ? '#FFD700' : '#ff5a3a'
      });
    }
    // 武器碰撞光效（白色闪一下）
    if (this._battleFlash.length < 6) {
      this._battleFlash.push({ x, y, t: 0, maxLife: 0.18 });
    }
  }

  // ============================================================
  // V16.0 — 战役标记绘制
  // ============================================================

  // 绘制战役标记（目标旗 + 路径虚线 + 势力区域）
  _drawCampaignMarkers(ctx) {
    if (!this.game) return;
    ctx.save();
    // 1) 战役势力覆盖区域（最底层，半透明）
    if (this._campArea) {
      this._drawCampaignArea(ctx, this._campArea);
    }
    // 2) 战役路径虚线箭头
    if (this._campPath && this._campPath.length >= 2) {
      this._drawCampaignPath(ctx, this._campPath);
    }
    // 3) 战役目标点（金色旗帜 + 脉冲光环；胜利后变庆祝点）
    if (this._campTarget) {
      const pos = this.isoToScreen(this._campTarget.isoX, this._campTarget.isoY);
      if (this._onScreen(pos.x, pos.y, 120)) {
        if (this._campWon) {
          this._drawVictoryPlaque(ctx, pos.x, pos.y);
        } else {
          this._drawGoalFlag(ctx, pos.x, pos.y);
        }
      }
    }
    ctx.restore();
  }

  // 战役势力覆盖区域：半透明势力色多边形
  _drawCampaignArea(ctx, area) {
    const pts = area.isoPoints.map(p => this.isoToScreen(p.isoX, p.isoY));
    if (pts.length < 3) return;
    // 视口粗裁剪（取包围盒中心）
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    if (!this._onScreen(cx, cy, 400)) return;
    ctx.save();
    // 解析颜色 + alpha
    const col = area.color;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath(); ctx.fill();
    // 边框虚线
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -this._animTime * 20;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 战役路径：虚线箭头动画（沿路径流动的光点 + 虚线）
  _drawCampaignPath(ctx, path) {
    const pts = path.map(p => this.isoToScreen(p.isoX, p.isoY));
    if (pts.length < 2) return;
    // 视口粗裁剪
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    if (!this._onScreen(cx, cy, 400)) return;
    ctx.save();
    // 路径虚线（金色，流动）
    ctx.strokeStyle = 'rgba(255,215,0,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this._animTime * 30;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.setLineDash([]);
    // 沿路径移动的箭头光点（一个光点循环跑）
    const total = pts.length - 1;
    const segT = (this._animTime * 0.4) % total;
    const i0 = Math.floor(segT);
    const f = segT - i0;
    const a = pts[i0], b = pts[Math.min(i0 + 1, pts.length - 1)];
    const ax = a.x + (b.x - a.x) * f;
    const ay = a.y + (b.y - a.y) * f;
    // 光点
    const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 10);
    glow.addColorStop(0, 'rgba(255,240,180,0.9)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ax, ay, 10, 0, Math.PI * 2); ctx.fill();
    // 箭头三角（指向终点方向）
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(ang) * 8, ay + Math.sin(ang) * 8);
    ctx.lineTo(ax + Math.cos(ang + 2.5) * 6, ay + Math.sin(ang + 2.5) * 6);
    ctx.lineTo(ax + Math.cos(ang - 2.5) * 6, ay + Math.sin(ang - 2.5) * 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 战役目标点：金色旗帜 + 脉冲光环
  _drawGoalFlag(ctx, x, y) {
    const pulse = 0.5 + 0.5 * Math.sin(this._animTime * 3);
    // 外层脉冲光环
    const ringR = 18 + pulse * 8;
    const grad = ctx.createRadialGradient(x, y, ringR * 0.6, x, y, ringR);
    grad.addColorStop(0, 'rgba(255,215,0,0)');
    grad.addColorStop(0.7, `rgba(255,215,0,${0.35 + pulse * 0.25})`);
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.fill();
    // 旗杆
    ctx.fillStyle = '#8a6a20';
    ctx.fillRect(x - 1.5, y - 24, 3, 30);
    // 旗帜（飘动小三角，随风摆动）
    const wave = Math.sin(this._animTime * 5) * 2;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y - 24);
    ctx.quadraticCurveTo(x + 14, y - 22 + wave, x + 22, y - 20 + wave);
    ctx.quadraticCurveTo(x + 14, y - 16 + wave, x + 1.5, y - 14);
    ctx.closePath(); ctx.fill();
    // 旗杆顶金珠
    ctx.fillStyle = '#FFF3B0';
    ctx.beginPath(); ctx.arc(x, y - 25, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 战役胜利后：目标点变为金色奖牌/庆祝牌
  _drawVictoryPlaque(ctx, x, y) {
    const pulse = 0.5 + 0.5 * Math.sin(this._animTime * 4);
    // 金色光晕
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 36);
    glow.addColorStop(0, `rgba(255,220,120,${0.7 + pulse * 0.2})`);
    glow.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill();
    // 小金牌
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(x, y - 6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y - 6, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a4a00';
    ctx.font = 'bold 12px "STSong", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('胜', x, y - 6);
  }

  // ============================================================
  // V16.0 — 战役庆祝粒子（彩带/烟花）对象池
  // ============================================================

  _campGetParticle() {
    const p = this._campParticlePool.pop();
    if (p) {
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      p.life = 0; p.maxLife = 1; p.size = 2;
      p.color = '#fff'; p.type = 'confetti'; p.seed = 0; p.gravity = 0;
      return p;
    }
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 2, color: '#fff', type: 'confetti', seed: 0, gravity: 0 };
  }
  _campReleaseParticle(p) {
    if (this._campParticlePool.length < 200) this._campParticlePool.push(p);
  }
  _spawnCampParticle(type, x, y, opts) {
    if (this._campParticles.length >= this._CAMP_PARTICLE_CAP) {
      const old = this._campParticles.shift();
      if (old) this._campReleaseParticle(old);
    }
    const p = this._campGetParticle();
    Object.assign(p, { type, x, y }, opts);
    this._campParticles.push(p);
    return p;
  }

  // 一次性彩带/烟花爆发（胜利时调用）
  _spawnCelebrationBurst(x, y) {
    const colors = ['#FFD700', '#ff5a5a', '#5aff8a', '#5ab0ff', '#ffb0e0', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 220;
      this._spawnCampParticle(
        Math.random() < 0.5 ? 'confetti' : 'spark',
        x, y, {
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 120,
          gravity: 180,
          life: 0, maxLife: 1.6 + Math.random() * 1.6,
          size: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          seed: Math.random() * Math.PI * 2
        });
    }
  }

  // 更新战役粒子 + 萤火虫 + 交战火花
  _updateCampaignFX(dt) {
    // 战役庆祝粒子
    for (let i = this._campParticles.length - 1; i >= 0; i--) {
      const p = this._campParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.type === 'confetti') p.vx += Math.sin(this._animTime * 4 + p.seed) * 20 * dt;
      if (p.life >= p.maxLife || !this._onScreen(p.x, p.y, 80)) {
        this._campParticles.splice(i, 1);
        this._campReleaseParticle(p);
      }
    }
    // 胜利后持续小礼花
    if (this._campWon && this._campTarget) {
      this._campWinTimer -= dt;
      if (this._campWinTimer <= 0) {
        this._campWinTimer = 0.6 + Math.random() * 0.5;
        const pos = this.isoToScreen(this._campTarget.isoX, this._campTarget.isoY);
        this._spawnCelebrationBurst(pos.x, pos.y);
      }
    }
    // 交战红色火花
    for (let i = this._battleSparks.length - 1; i >= 0; i--) {
      const p = this._battleSparks[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      if (p.life <= 0) this._battleSparks.splice(i, 1);
    }
    // 武器碰撞光
    for (let i = this._battleFlash.length - 1; i >= 0; i--) {
      this._battleFlash[i].t += dt;
      if (this._battleFlash[i].t >= this._battleFlash[i].maxLife) {
        this._battleFlash.splice(i, 1);
      }
    }
    // 夜晚萤火虫（森林/草丛附近）
    if (this._isNight() && this.game) {
      this._fireflyTimer -= dt;
      if (this._fireflyTimer <= 0) {
        this._fireflyTimer = 0.25;
        // 找一个森林/平原城市作为发射点
        const candidates = [];
        for (const city of this.game.cities.values()) {
          if (city.terrain === 'forest' || city.terrain === 'plain') {
            const pos = this.isoToScreen(city.isoX, city.isoY);
            if (this._onScreen(pos.x, pos.y, 150)) candidates.push(pos);
          }
        }
        if (candidates.length && this._mapParticles.length < this._MAP_PARTICLE_CAP) {
          const c = candidates[Math.floor(Math.random() * candidates.length)];
          this._spawnMapParticle('firefly',
            c.x + (Math.random() - 0.5) * 40,
            c.y + (Math.random() - 0.5) * 20, {
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 8,
              life: 0, maxLife: 3 + Math.random() * 3,
              size: 1.5 + Math.random() * 1.5,
              color: '#aaff80', seed: Math.random() * 100
            });
        }
      }
    }
  }

  // 绘制战役粒子（彩带/烟花/萤火虫/交战火花/武器闪光）
  _drawCampaignParticles(ctx) {
    if (!this.game) return;
    ctx.save();
    // 战役庆祝粒子
    for (const p of this._campParticles) {
      if (!this._onScreen(p.x, p.y, 60)) continue;
      const prog = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - prog);
      if (p.type === 'confetti') {
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.seed + this._animTime * 6);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        // 烟花火花
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - prog * 0.5), 0, Math.PI * 2); ctx.fill();
      }
    }
    // 交战红色火花
    for (const p of this._battleSparks) {
      if (!this._onScreen(p.x, p.y, 40)) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    // 武器碰撞白光闪
    for (const f of this._battleFlash) {
      if (!this._onScreen(f.x, f.y, 40)) continue;
      const a = 1 - f.t / f.maxLife;
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, 16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // V16.0 — 地图视觉继续提升（水面/山影/森林三层/夜窗/萤火虫）
  // ============================================================

  // 水面增强：在河流波纹基础上叠加反光 + 倒影
  // 在 _drawRiverRipples 之后调用（render 中已在 _drawRiverRipples 后串联）
  _drawWaterEnhanced(ctx) {
    if (!this.game) return;
    const t = this._animTime;
    ctx.save();
    for (const city of this.game.cities.values()) {
      if (city.terrain !== 'river') continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 80)) continue;
      const w = TILE_W * 1.2 * this.scale;
      // 反光：斜向高光带（随时间流动）
      const sheenX = ((t * 20 + city.isoX * 30) % (w * 2)) - w / 2;
      const sheenGrad = ctx.createLinearGradient(pos.x - w / 2, pos.y, pos.x + w / 2, pos.y);
      sheenGrad.addColorStop(0, 'rgba(200,230,255,0)');
      sheenGrad.addColorStop(0.5, 'rgba(220,240,255,0.35)');
      sheenGrad.addColorStop(1, 'rgba(200,230,255,0)');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(pos.x - w / 2 + sheenX - 10, pos.y - 3, 20, 6);
      // 倒影：下方轻微拉长的蓝色暗斑（模拟天空/山体倒影）
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#4a7a9a';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 4, w * 0.35, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // 山地阴影：根据光源方向（右上）在山体左下侧画暗色三角
  // 在 _drawTerrain 中已绘制山体；此处叠加动态阴影层（在主 ctx）
  _drawMountainShadows(ctx) {
    if (!this.game) return;
    ctx.save();
    for (const city of this.game.cities.values()) {
      if (city.terrain !== 'mountain') continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 80)) continue;
      const h = TILE_H * 1.2 * this.scale;
      const w = TILE_W * 1.2 * this.scale;
      // 光源右上 → 阴影投向左下
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = 'rgba(20,30,40,1)';
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.8);
      ctx.lineTo(-w * 0.3, -h * 0.3);
      ctx.lineTo(-w * 0.55, -h * 0.1);
      ctx.lineTo(-w * 0.25, -h * 0.25);
      ctx.closePath();
      ctx.translate(pos.x, pos.y);
      ctx.fill();
      ctx.translate(-pos.x, -pos.y);
    }
    ctx.restore();
  }

  // 森林层次：近景深色 / 中景中色 / 远景浅色（按距离视口中心的远近分三层）
  _drawForestLayers(ctx) {
    if (!this.game) return;
    const t = this._animTime;
    ctx.save();
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    for (const city of this.game.cities.values()) {
      if (city.terrain !== 'forest') continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      let baseColor, size;
      if (dist < 260) { baseColor = '#1f4a1a'; size = 5; }      // 近景深
      else if (dist < 520) { baseColor = '#3a7a2a'; size = 4; }  // 中景中
      else { baseColor = '#6aa050'; size = 3; }                   // 远景浅
      // 树冠（2~3 个圆簇）
      const sway = Math.sin(t * 1.5 + city.isoX) * 1;
      ctx.fillStyle = baseColor;
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * size * 1.2;
        const oy = (k % 2) * -2;
        ctx.beginPath();
        ctx.arc(pos.x + ox + sway, pos.y + oy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 夜晚城市窗口亮灯：在 _drawNightLights 基础上叠加小窗口光点（缓存）
  _drawCityWindowLights(ctx) {
    if (!this._isNight() || !this.game) return;
    ctx.save();
    for (const city of this.game.cities.values()) {
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      if (typeof this.game.isCityExplored === 'function'
          && !this.game.isCityExplored(city.id)) continue;
      // 小窗格（3~4 个金色小方块，按城市 seed 分布）
      const seed = city.id * 7;
      const n = 3 + (city.size || 1);
      for (let i = 0; i < n; i++) {
        const wx = pos.x + ((Math.sin(seed + i * 13) + 1) / 2 - 0.5) * 18;
        const wy = pos.y - 4 + ((Math.cos(seed + i * 7) + 1) / 2 - 0.5) * 10;
        ctx.fillStyle = 'rgba(255,220,120,0.85)';
        ctx.fillRect(wx, wy, 2.5, 2.5);
      }
    }
    ctx.restore();
  }
}
