// ============================================================
// map.js — 等距地图 Canvas 渲染（含人物动画系统）
// 动画：军队棋子待机动画(上下浮动+旗帜飘动)、移动平滑插值、
//       选中金色旋转光环、城市呼吸缩放、都城宫殿旗帜飘动。
// V8.1：昼夜循环 + 四季氛围色调 + 动态氛围(云/河流波纹/炊烟/夜灯)
// ============================================================
import { TERRAIN, FACTIONS, CITY_LINKS, SEASONS } from './data.js';
import { Animator } from './animation.js';
import { getOffice } from './office.js';   // V23.0：高军衔武将将旗判定

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

    // ============================================================
    // V17.0 — 动画与地图增强：交互与视觉
    // 平滑缩放 / 拖拽 rAF / 小地图离屏缓存+点击跳转 / flyTo /
    // 悬停高亮 / 战斗交叉剑标记 / 增援虚线箭头 / 天气粒子随缩放调节
    // ============================================================
    this._targetScale = this.scale;       // 平滑缩放目标值（wheel/setZoom 写入）
    this._minimapCanvas = null;           // 小地图离屏缓存 canvas
    this._minimapDirty = true;            // 小地图脏标记（城市归属/军队变化时置真）
    this._hoverCity = null;               // 悬停城市 id
    this._hoverArmy = null;                // 悬停军队 id
    this._flyToAnim = null;               // {fromX,fromY,toX,toY,startTime,dur} 平滑飞行动画
    this._reinforcementPaths = [];        // 增援路线 [{pts:[{isoX,isoY}...], color}]
    this._battleMarkers = [];             // 战斗中军队标记 [{x,y,seed}]（屏幕坐标，每帧重算）
    this._mMouseX = 0;                    // 鼠标位置（悬停用）
    this._mMouseY = 0;
    this._hoverPulse = 0;                 // 悬停脉冲计时

    // ============================================================
    // V18.0 — 动画与地图增强：城市规模建筑 / 势力边境虚线 / 道路系统 /
    //        河上商船战船 / 季节森林细节 / 夜间灯笼 / 交战城市火焰烟雾
    // 设计：河流船只对象池定期生成；交战火焰按 setBattles 城市 stateless 渲染；
    //      视觉细节按距离视口中心 LOD 降级；夜间效果仅 _isNight() 时绘制。
    // ============================================================
    this._riverShips = [];          // 河上船只 [{x,y,dir,speed,type,life,seed}]
    this._riverShipPool = [];       // 船只对象池
    this._RIVER_SHIP_CAP = 8;       // 同时存在河船上限
    this._riverShipTimer = 0;       // 船只生成节流计时

    // ============================================================
    // V20.0 — 动画与地图增强：灾害可视化
    // 设计：读取 city.disasterState = { type, severity, turnsLeft, warning }
    //   - type: 'earthquake'|'flood'|'drought'|'plague'|'locust'|'snowstorm'
    //   - severity: 0~1（损坏/污染程度，半毁~全毁）
    //   - warning: true 表示即将发生（闪烁警告标记）
    // 新灾害出现时调用 Animator.play* 触发一次性动画；
    // 持续灾害在 _drawCityDisaster 中按类型绘制静态/半静态标记。
    // 性能：_disasterTriggered Map 记录已触发签名，避免重复播放；
    //       远离屏幕中心的灾害降低绘制复杂度（LOD）。
    // ============================================================
    this._disasterTriggered = new Map();  // cityId -> signature 字符串
    this._DISASTER_VISIBLE_CAP = 24;      // 同屏最多绘制灾害标记数量保护

    // ============================================================
    // V21.0 — 动画与地图增强：丝绸之路可视化 + 家族联姻线
    // 设计：
    //   - 丝路路线：金色虚线 + 沿路线流动光点（stateless，按 _animTime 计算）
    //   - 丝路节点标记：沿线城市画骆驼小图标
    //   - 商队动画：2~3 支商队沿整条丝路往返循环（stateless）
    //   - 家族关系线：联姻城市间红色脉冲连线
    // 性能：
    //   - 丝路城市序列由 setSilkRoadCities 注入；缺省按地名关键字自动识别
    //   - 离屏不绘制（_onScreen 裁剪）；光点/商队数量硬上限
    //   - 商队沿折线位置按时间分段插值，无逐帧可变状态
    // ============================================================
    this._silkRoadCities = null;        // 外部注入的丝路城市 id 序列（有序）
    this._silkPathCache = null;         // 计算好的等距折线 [{isoX,isoY}]
    this._silkPathScreen = null;        // 屏幕坐标折线缓存（每帧按 zoom 重算）
    this._marriageLinks = [];           // 联姻城市对 [[idA,idB],...]
    this._SILK_DOT_CAP = 14;            // 丝路流动光点上限
    this._SILK_CARAVAN_CAP = 3;         // 同屏商队数量上限
    this._SILK_NODE_CAP = 40;           // 丝路节点标记数量上限
    // 默认丝路地名关键字（南北朝西北边地常见丝路重镇）
    this._SILK_NAME_KEYS = ['长安','洛阳','敦煌','楼兰','龟兹','于阗','疏勒',
      '张掖','酒泉','武威','凉州','高昌','伊吾','碎叶','阳关','玉门',
      '甘州','肃州','瓜州','鄯善','且末','蒲昌','焉耆','轮台'];

    // ============================================================
    // V23.0 — 地图可视化：军事训练 / 装备锻造 / 高军衔将旗
    // 设计：
    //   - 训练城市(city.training>=50)：城内小士兵持矛踏步标记
    //   - 锻造城市(city.buildings.workshop>=1)：铁匠炉烟囱冒烟+火花
    //   - 高军衔武将所在城市：金色将旗（脉动）
    // 性能：高军衔城市集合每 0.5s 重建一次（避免每帧遍历全部武将）；
    //       距离 LOD（scale<0.7）简化绘制；视口裁剪 + 战争迷雾判定。
    // ============================================================
    this._v23HighRankCityIds = [];   // 高军衔武将所在城市 id 缓存
    this._v23RankRebuildAt = 0;      // 上次重建高军衔城市集合时刻
    this._V23_HIGH_RANK_OFFICE = 2;  // 官职 rank<=2 视为高军衔（大将军/三公/柱国/骠骑/车骑）
    this._V23_TRAIN_THRESHOLD = 50;  // 训练等级阈值

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

      // V17.0：平滑缩放插值（this.scale → this._targetScale）
      if (Math.abs(this.scale - this._targetScale) > 0.001) {
        this.scale += (this._targetScale - this.scale) * Math.min(1, dt * 8);
        this.dirty = true;
        this._minimapDirty = true;
      } else if (this.scale !== this._targetScale) {
        this.scale = this._targetScale;
      }

      // V17.0：flyTo 平滑飞行动画推进
      if (this._flyToAnim) {
        const fa = this._flyToAnim;
        const prog = Math.min(1, (now - fa.startTime) / fa.dur);
        // easeInOutCubic
        const e = prog < 0.5 ? 4 * prog * prog * prog
                             : 1 - Math.pow(-2 * prog + 2, 3) / 2;
        this.offsetX = fa.fromX + (fa.toX - fa.fromX) * e;
        this.offsetY = fa.fromY + (fa.toY - fa.fromY) * e;
        this.dirty = true;
        this._minimapDirty = true;
        if (prog >= 1) this._flyToAnim = null;
      }

      // V17.0：悬停脉冲推进
      this._hoverPulse = Math.sin(this._animTime * 4) * 0.5 + 0.5;

      // V8.1：更新动态氛围（云/粒子）
      this._updateAtmosphere(dt);
      // 自适应帧率：有军队正在滑动 -> 60fps；否则 30fps 节能
      const moving = [...this._armyPosAnims.values()].some(a => a.moving);
      const interacting = moving || this.dragging || this._flyToAnim
                          || Math.abs(this.scale - this._targetScale) > 0.001;
      const interval = interacting ? this._fastFps : this._staticFps;
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
      // V17.0：若点击落在小地图区域内，则跳转而非开始拖拽
      const mm = this._lastMinimapRect;
      if (mm && e.clientX >= mm.x && e.clientX <= mm.x + mm.w
          && e.clientY >= mm.y && e.clientY <= mm.y + mm.h) {
        this._handleMinimapClick(e);
        return;
      }
      this.dragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this._moved = false;
    });

    window.addEventListener('mousemove', (e) => {
      // V17.0：记录鼠标位置（悬停检测 + 小地图热区）
      const rect = canvas.getBoundingClientRect();
      this._mMouseX = e.clientX - rect.left;
      this._mMouseY = e.clientY - rect.top;

      if (this.dragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
        this.offsetX += dx / this.scale;
        this.offsetY += dy / this.scale;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.dirty = true; // V5.0：平移使静态层失效
        // V17.0：拖拽时不立即 render，由 rAF loop 统一绘制（平滑）
      }
      // V17.0：悬停检测（节流：在 render 中每帧根据 _mMouseX/Y 计算，这里只记录）
    });

    window.addEventListener('mouseup', (e) => {
      if (this.dragging && !this._moved) {
        this._handleClick(e);
      }
      this.dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // V17.0：平滑缩放——只更新目标值，在 loop 中插值过渡
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this._targetScale = Math.max(0.5, Math.min(2.0, this._targetScale * delta));
      this._minimapDirty = true;   // 缩放变化使小地图视口框失效
    }, { passive: false });
  }

  // V17.0：小地图点击跳转——点击位置对应到世界等距坐标，平滑飞过去
  _handleMinimapClick(e) {
    if (!this.game || !this._lastMinimapRect) return;
    const mm = this._lastMinimapRect;
    // 重新计算小地图使用的包围盒（与 drawMinimap 一致）
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const city of this.game.cities.values()) {
      if (city.isoX < minX) minX = city.isoX;
      if (city.isoX > maxX) maxX = city.isoX;
      if (city.isoY < minY) minY = city.isoY;
      if (city.isoY > maxY) maxY = city.isoY;
    }
    if (!isFinite(minX)) return;
    const pad = 1; minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - mm.x;
    const my = e.clientY - rect.top - mm.y;
    const isoX = minX + (mx / mm.w) * (maxX - minX);
    const isoY = minY + (my / mm.h) * (maxY - minY);
    // 计算该等距点对应的屏幕中心坐标（使点击点落到视口中心）
    const sx = (isoX - isoY) * (TILE_W / 2);
    const sy = (isoX + isoY) * (TILE_H / 2);
    // 求解 offsetX/offsetY 使 isoToScreen(isoX,isoY) = (canvasW/2, canvasH/2)
    // (sx + offsetX) * scale = W/2  => offsetX = W/(2*scale) - sx
    // (sy + offsetY) * scale = H/2  => offsetY = H/(2*scale) - sy
    const W = this.canvas.width, H = this.canvas.height;
    const toX = W / (2 * this.scale) - sx;
    const toY = H / (2 * this.scale) - sy;
    this._startFlyTo(this.offsetX, this.offsetY, toX, toY, 0.8);
  }

  // V17.0：启动一段平滑飞行动画
  _startFlyTo(fromX, fromY, toX, toY, dur = 0.8) {
    this._flyToAnim = {
      fromX, fromY, toX, toY,
      startTime: performance.now(), dur: dur * 1000
    };
  }

  // V17.0：公共 API——平滑飞到指定城市
  // cityId: 城市 id（this.game.cities 的 key）
  flyTo(cityId) {
    if (!this.game) return;
    const city = this.game.cities.get(cityId);
    if (!city) return;
    const sx = (city.isoX - city.isoY) * (TILE_W / 2);
    const sy = (city.isoX + city.isoY) * (TILE_H / 2);
    const W = this.canvas.width, H = this.canvas.height;
    const toX = W / (2 * this.scale) - sx;
    const toY = H / (2 * this.scale) - sy;
    this._startFlyTo(this.offsetX, this.offsetY, toX, toY, 0.9);
  }

  // V17.0：设置增援路线（己方援军出发时调用）
  // points: [{isoX,isoY},...] 从出发地到目的地的节点；null 清除
  setReinforcementRoute(points, color) {
    if (!Array.isArray(points) || points.length < 2) {
      this._reinforcementRoutes = [];
      return;
    }
    this._reinforcementRoutes = [{
      pts: points.filter(p => p && p.isoX != null).slice(0, 16),
      color: color || '#7ec8ff'
    }];
    this._minimapDirty = true;
  }

  // V17.0：追加一条增援路线（多支援军同时出发）
  addReinforcementRoute(points, color) {
    if (!Array.isArray(points) || points.length < 2) return;
    this._reinforcementRoutes.push({
      pts: points.filter(p => p && p.isoX != null).slice(0, 16),
      color: color || '#7ec8ff'
    });
    if (this._reinforcementRoutes.length > 4) this._reinforcementRoutes.shift();
    this._minimapDirty = true;
  }

  // V17.0：清除增援路线
  clearReinforcementRoutes() {
    this._reinforcementRoutes = [];
    this._minimapDirty = true;
  }

  // V17.0：标记战斗中军队（交战双方显示红色交叉剑标记）
  // battles: [{armyIdA, armyIdB}]  调用方每帧传入当前交战对；空数组清除
  setBattles(battles) {
    this._battleMarkers = Array.isArray(battles) ? battles.slice(0, 12) : [];
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
    // V17.0：平滑缩放——只改目标值，loop 中插值
    this._targetScale = this._targetScale > 1.2 ? 1.0 : 1.5;
    this._minimapDirty = true;
  }

  // ============================================================
  // V14.0 — 视口缩放公共 API（0.5x ~ 2x）
  // ============================================================
  // 设置缩放级别（自动钳制到 0.5~2.0），V17.0 平滑过渡
  setZoom(level) {
    this._targetScale = Math.max(0.5, Math.min(2.0, Number(level) || 1.0));
    this._minimapDirty = true;
    return this._targetScale;
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

    // V18.0：河上商船/战船 生成与移动（对象池）
    this._updateRiverShips(dt);
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
    let iv = intervalMap[this.weather] || 999;
    // V17.0：缩放级别调节——放大时粒子更少更稀（聚焦局部），缩小时粒子更多
    // scale∈[0.5,2.0]：scale=2 → iv×1.8（少）；scale=0.5 → iv×0.6（多）
    const zoomFactor = this.scale || 1.0;
    iv = iv * (0.6 + zoomFactor * 0.6);
    if (this._weatherEmitTimer > 0) return;
    this._weatherEmitTimer = iv;
    // V17.0：粒子上限也随缩放微调（放大时上限降低，减少 fillrate 压力）
    const cap = Math.round(this._WEATHER_PARTICLE_CAP * (zoomFactor > 1.4 ? 0.6 : zoomFactor < 0.8 ? 1.2 : 1.0));
    if (this._weatherParticles.length >= cap) return;

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

  // ============================================================
  // V21.0 — 丝绸之路可视化 + 家族联姻线
  // ============================================================

  // 外部注入丝路城市 id 序列（有序，决定路线走向）。
  // 传入 null/空数组时回退到按地名关键字自动识别。
  setSilkRoadCities(ids) {
    this._silkRoadCities = (Array.isArray(ids) && ids.length) ? ids.slice() : null;
    this._silkPathCache = null;   // 使缓存失效
  }

  // 外部注入联姻城市对：pairs = [[idA,idB], ...]
  setMarriageLinks(pairs) {
    this._marriageLinks = Array.isArray(pairs) ? pairs.slice() : [];
  }

  // 解析丝路折线（等距坐标）。有外部注入用注入序列；否则按地名关键字自动识别。
  // 返回 [{isoX,isoY}]，不足两点返回 null。
  _resolveSilkPath() {
    if (this._silkPathCache) return this._silkPathCache;
    if (!this.game) return null;
    let seq = null;
    if (Array.isArray(this._silkRoadCities) && this._silkRoadCities.length) {
      seq = this._silkRoadCities
        .map(id => this.game.cities.get(id))
        .filter(c => c && c.isoX != null);
    } else {
      // 自动识别：名字命中丝路关键字的城市
      const hit = [];
      for (const c of this.game.cities.values()) {
        const nm = String(c.name || '');
        if (this._SILK_NAME_KEYS.some(k => nm.includes(k))) hit.push(c);
      }
      // 按经度（isoX+isoY 近似东西向）排序，形成一条自东向西的折线
      hit.sort((a, b) => (a.isoX + a.isoY) - (b.isoX + b.isoY));
      seq = hit;
    }
    if (!seq || seq.length < 2) { this._silkPathCache = null; return null; }
    // 数量硬上限保护
    if (seq.length > this._SILK_NODE_CAP) seq = seq.slice(0, this._SILK_NODE_CAP);
    this._silkPathCache = seq.map(c => ({ isoX: c.isoX, isoY: c.isoY, city: c }));
    return this._silkPathCache;
  }

  // 折线总长（屏幕坐标，用于按距离调整光点速度）
  _polylineScreenLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  }

  // 在折线上按累计距离比例 f(0~1) 取点（屏幕坐标）
  _pointOnPolyline(pts, f) {
    const L = this._polylineScreenLength(pts);
    if (L <= 0 || pts.length < 2) return pts[0] || { x: 0, y: 0 };
    let target = f * L;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (target <= seg) {
        const t = seg > 0 ? target / seg : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
        };
      }
      target -= seg;
    }
    return pts[pts.length - 1];
  }

  // 丝路路线：金色虚线 + 流动光点 + 节点骆驼标记 + 行进商队
  _drawSilkRoad(ctx) {
    if (!this.game) return;
    const path = this._resolveSilkPath();
    if (!path || path.length < 2) return;
    // 转屏幕坐标
    const pts = path.map(p => this.isoToScreen(p.isoX, p.isoY));
    // 视口裁剪：整条折线都在视口外则跳过
    let anyVisible = false;
    for (const p of pts) {
      if (this._onScreen(p.x, p.y, 200)) { anyVisible = true; break; }
    }
    if (!anyVisible) return;

    const t = this._animTime;
    const lineW = Math.max(1.5, 2.2 * this.scale);
    ctx.save();

    // 1) 金色虚线路线
    ctx.strokeStyle = 'rgba(212,175,55,0.55)';
    ctx.lineWidth = lineW;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -t * 20;   // 虚线流动
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2) 流动光点（沿折线匀速移动，多个相位错开）
    const L = this._polylineScreenLength(pts);
    const dots = Math.min(this._SILK_DOT_CAP, Math.max(3, Math.floor(L / 60)));
    for (let d = 0; d < dots; d++) {
      // 光点速度按距离调整：折线越长速度越快，保证视觉周期稳定
      const f = ((t * 0.12 + d / dots) % 1 + 1) % 1;
      const pt = this._pointOnPolyline(pts, f);
      if (!this._onScreen(pt.x, pt.y, 40)) continue;
      ctx.fillStyle = 'rgba(255,225,130,0.95)';
      ctx.shadowColor = '#ffd24a';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(1.6, 2.4 * this.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3) 节点骆驼标记（沿丝路城市顶部）
    for (let i = 0; i < pts.length && i < this._SILK_NODE_CAP; i++) {
      const p = pts[i];
      if (!this._onScreen(p.x, p.y, 60)) continue;
      this._drawCamelIcon(ctx, p.x, p.y - 14 * this.scale, t + i * 0.7);
    }

    // 4) 行进商队（沿整条丝路往返，数量按长度自适应，硬上限）
    const caravanN = Math.min(this._SILK_CARAVAN_CAP, Math.max(1, Math.floor(L / 260)));
    for (let c = 0; c < caravanN; c++) {
      // 0→1→0 往返三角波
      const raw = (t * 0.05 + c / caravanN) % 1;
      const f = raw < 0.5 ? raw * 2 : 2 - raw * 2;
      const pt = this._pointOnPolyline(pts, f);
      if (!this._onScreen(pt.x, pt.y, 60)) continue;
      this._drawCamelIcon(ctx, pt.x, pt.y, t + c * 2.0, true);
    }

    ctx.restore();
  }

  // 骆驼小图标（节点用静态版，商队用行进版带步态起伏）
  _drawCamelIcon(ctx, x, y, time, walking = false) {
    const bob = walking ? Math.sin(time * 9) * 1.0 : Math.sin(time * 2) * 0.6;
    const s = Math.max(0.8, this.scale);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    ctx.fillStyle = '#7a5a34';
    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 双峰
    ctx.beginPath(); ctx.arc(-1.6, -1.6, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1.6, -1.6, 1.3, 0, Math.PI * 2); ctx.fill();
    // 头
    ctx.beginPath(); ctx.arc(4.4, -1.0, 1.0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 家族联姻关系线：联姻城市间红色脉冲连线
  _drawMarriageLines(ctx) {
    if (!this.game || !this._marriageLinks.length) return;
    const t = this._animTime;
    ctx.save();
    let drawn = 0;
    const CAP = 12;   // 同屏联姻线上限保护
    for (const pair of this._marriageLinks) {
      if (drawn >= CAP) break;
      const cA = this.game.cities.get(pair[0]);
      const cB = this.game.cities.get(pair[1]);
      if (!cA || !cB || cA.isoX == null || cB.isoX == null) continue;
      const p1 = this.isoToScreen(cA.isoX, cA.isoY);
      const p2 = this.isoToScreen(cB.isoX, cB.isoY);
      if (!this._onScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 200)) continue;
      const pulse = 0.4 + 0.3 * Math.sin(t * 3 + drawn);
      ctx.strokeStyle = `rgba(220,60,70,${pulse})`;
      ctx.lineWidth = Math.max(1.2, 1.8 * this.scale);
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // 中点一颗红心/喜点
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.fillStyle = 'rgba(255,90,100,0.9)';
      ctx.shadowColor = '#ff5060';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(1.6, 2.2 * this.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      drawn++;
    }
    ctx.restore();
  }

  // ============================================================
  // V22.0 — 地图可视化：同年关系线 / 京城科举标记 / 翰林院标记
  // ============================================================

  // 同年关系线：同榜（科举出身）进士所在城市间的金色脉冲连线。
  // 数据来源：this.game.generals 中带 examTitle 者的 location 城市。
  // 性能：同年城市集合按 this._animTime 每 0.5s 重建一次（避免每帧遍历全部武将）；
  //       连线成对枚举并硬上限 CAP；中点离屏用 _onScreen 裁剪；未探索不连。
  _drawTongnianLines(ctx) {
    if (!this.game || !this.game.generals) return;
    const t = this._animTime;
    // 节流重建同年城市集合
    if (!this._tongnianRebuildAt || t - this._tongnianRebuildAt > 0.5) {
      this._tongnianRebuildAt = t;
      const citySet = new Set();
      for (const gen of this.game.generals.values()) {
        if (gen && gen.examTitle && gen.location != null) citySet.add(gen.location);
      }
      this._tongnianCityIds = Array.from(citySet);
    }
    const ids = this._tongnianCityIds;
    if (!ids || ids.length < 2) return;
    ctx.save();
    const CAP = 10;             // 同屏同年线上限保护
    const LIMIT = 6;            // 至多取前 6 个同年城市参与连线
    let drawn = 0;
    const limited = ids.slice(0, LIMIT);
    for (let i = 0; i < limited.length && drawn < CAP; i++) {
      for (let j = i + 1; j < limited.length && drawn < CAP; j++) {
        const cA = this.game.cities.get(limited[i]);
        const cB = this.game.cities.get(limited[j]);
        if (!cA || !cB || cA.isoX == null || cB.isoX == null) continue;
        const p1 = this.isoToScreen(cA.isoX, cA.isoY);
        const p2 = this.isoToScreen(cB.isoX, cB.isoY);
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        if (!this._onScreen(mx, my, 200)) continue;   // 距离/视口裁剪
        const pulse = 0.45 + 0.25 * Math.sin(t * 2.5 + drawn);
        ctx.strokeStyle = `rgba(255,205,80,${pulse})`;
        ctx.lineWidth = Math.max(1.2, 1.8 * this.scale);
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 16;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // 中点金色节点
        ctx.fillStyle = 'rgba(255,220,120,0.9)';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1.6, 2.2 * this.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        drawn++;
      }
    }
    ctx.restore();
  }

  // 京城科举标记 + 翰林院建筑标记（叠加在玩家首都之上）。
  // 科举城市标记：首都正上方脉动小「榜」卷轴；翰林院标记：首都左上小殿宇「翰」匾。
  // 性能：视口裁剪 + 战争迷雾判定 + 随 this.scale 缩放。
  _drawCapitalExamMarkers(ctx) {
    if (!this.game || !this.game.playerFaction) return;
    const fid = this.game.playerFaction;
    const capId = FACTIONS[fid] && FACTIONS[fid].capital;
    if (!capId) return;
    const cap = this.game.cities.get(capId);
    if (!cap || cap.isoX == null) return;
    // 战争迷雾：未探索京城不画
    if (typeof this.game.isCityExplored === 'function' && !this.game.isCityExplored(capId)) return;
    const pos = this.isoToScreen(cap.isoX, cap.isoY);
    if (!this._onScreen(pos.x, pos.y, 90)) return;   // 距离/视口裁剪
    const t = this._animTime;
    const s = this.scale;
    ctx.save();

    // ---- 翰林院建筑标记（京城偏左上，小殿宇 + 「翰」匾）----
    ctx.save();
    ctx.translate(pos.x - 16 * s, pos.y - 6 * s);
    // 殿身
    ctx.fillStyle = '#5a4a7a';
    ctx.fillRect(-6 * s, -4 * s, 12 * s, 6 * s);
    // 歇山顶
    ctx.fillStyle = '#7a6aa0';
    ctx.beginPath();
    ctx.moveTo(-8 * s, -4 * s);
    ctx.lineTo(0, -10 * s);
    ctx.lineTo(8 * s, -4 * s);
    ctx.closePath();
    ctx.fill();
    // 匾额
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `${Math.max(8, 9 * s)}px "STSong", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('翰', 0, -1 * s);
    ctx.restore();

    // ---- 科举金榜标记（京城正上方，脉动小卷轴）----
    ctx.save();
    const pulse = 1 + 0.12 * Math.sin(t * 3);
    ctx.translate(pos.x, pos.y - 26 * s);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f3e2a8';
    ctx.fillRect(-7 * s, -5 * s, 14 * s, 10 * s);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b82828';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7 * s, -5 * s, 14 * s, 10 * s);
    ctx.fillStyle = '#b82828';
    ctx.font = `bold ${Math.max(8, 9 * s)}px "STSong", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('榜', 0, 0.5 * s);
    ctx.restore();

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
    // V18.0：势力边境虚线（不同归属城市间流动虚线）
    this._drawFactionBorders(ctx);
    // V21.0：丝绸之路路线（金色虚线+流动光点+节点骆驼+行进商队）
    this._drawSilkRoad(ctx);
    // V21.0：家族联姻关系线（联姻城市间红色脉冲连线）
    this._drawMarriageLines(ctx);
    // V22.0：同年关系线（同榜进士所在城市间金色连线）
    this._drawTongnianLines(ctx);
    // V18.0：河上商船/战船（河流城市附近定期经过）
    this._drawRiverShips(ctx);

    this._drawCities();
    // V22.0：京城科举金榜标记 + 翰林院建筑标记（叠加在首都之上）
    this._drawCapitalExamMarkers(ctx);
    // V18.0：交战城市周围火焰/烟雾
    this._drawCityBattleFire(ctx);
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

    // V17.0：悬停高亮（鼠标悬停城市/军队时金色脉冲圈）
    this._updateHover();
    this._drawHoverHighlight(ctx);

    // V17.0：战斗中军队标记（红色交叉剑）
    this._drawBattleMarkers(ctx);

    // V17.0：增援路线（主地图上的蓝色虚线箭头）
    this._drawReinforcementRoutes(ctx);

    // V14.0：小地图（右下角，缩略全图 + 视口框 + 城市/军队点）
    const mmW = 140, mmH = 90;
    const mmX = W - mmW - 12, mmY = H - mmH - 12;
    this.drawMinimap(ctx, mmX, mmY, mmW, mmH);

    // V15.0：天气指示器（小地图上方）
    this._drawWeatherIndicator(ctx, mmX, mmY, mmW, mmH);

    // V16.0：战役模式地图标记（最上层，覆盖一切）
    this._drawCampaignMarkers(ctx);
    this._drawCampaignParticles(ctx);

    // V17.0：战斗动画深化 FX（阵型环/旗帜倒下/齐射命中/盾墙闪光/水战环）
    Animator.drawBattleFX(ctx);

    // V20.0：自然灾害动画 FX（地震裂缝/洪水波纹/干旱干裂/瘟疫绿雾/蝗群遮天/暴风雪冰雾）
    // 距离衰减中心设为屏幕中心，远离者透明度衰减
    if (typeof Animator.setDisasterFocus === 'function') {
      Animator.setDisasterFocus(W / 2, H / 2, Math.max(W, H) * 0.75);
    }
    if (typeof Animator.drawDisasterFX === 'function') {
      Animator.drawDisasterFX(ctx);
    }
    // V21.0：丝绸之路动画 FX（商队行进/贸易爆发/被劫烟雾/驿站建成）
    if (typeof Animator.drawSilkFX === 'function') {
      Animator.drawSilkFX(ctx);
    }
    // V21.0：家族动画 FX（联姻红绸/出生祥云/去世白幡）
    if (typeof Animator.drawFamilyFX === 'function') {
      Animator.drawFamilyFX(ctx);
    }
    // V22.0：科举/选官动画 FX（游街/宴饮/落第/授官/考核/贬官）
    if (typeof Animator.drawExamFX === 'function') {
      Animator.drawExamFX(ctx);
    }
    // V22.0：放榜全屏覆盖层（金榜展开 + 金光闪耀）
    if (typeof Animator.drawExamResultsFX === 'function') {
      Animator.drawExamResultsFX(ctx);
    }
    // V23.0：军事训练/整编/锻造动画 FX（操练/晋升/授奖/锻造武器甲马/整编/阅兵）
    if (typeof Animator.drawV23FX === 'function') {
      Animator.drawV23FX(ctx);
    }
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
    // V18.0：道路系统——先画一条柔和土黄道路底（细线），再叠原有虚线连线
    c.strokeStyle = 'rgba(150,120,70,0.30)';
    c.lineWidth = 3.5 * this.scale;
    c.setLineDash([]);
    for (const city of this.game.cities.values()) {
      const links = CITY_LINKS[city.id] || [];
      for (const targetId of links) {
        if (city.id >= targetId) continue; // 只画一次
        const target = this.game.cities.get(targetId);
        if (!target) continue;
        const p1 = this.isoToScreen(city.isoX, city.isoY);
        const p2 = this.isoToScreen(target.isoX, target.isoY);
        if (!this._onScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 160)) continue;
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.stroke();
      }
    }

    // 原有连线（金色虚线）
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

  // V18.0：道路行军速度加成（沿 CITY_LINKS 道路行军更快；供外部移动计算读取）
  getRoadSpeedMultiplier() { return 1.25; }

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
    this._disasterVisibleCount = 0;   // V20.0：每帧重置灾害标记计数
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

      // V18.0：城市规模可视化——大城市多几栋建筑，小城市精简
      this._drawCityBuildings(ctx, r, this.getCitySizeLevel(city));

      // V20.0：自然灾害可视化（损坏标记/水痕/干旱/雾气/蝗群/预警闪烁）
      this._drawCityDisaster(ctx, city, r, t, visible, pos);

      // V19.0：文化建筑标记 / 科技完成金星 / 高文化装饰（彩旗·灯笼·书卷）
      this._drawV19CultureTechMarkers(ctx, city, r, t);

      // V23.0：军事训练小兵 / 锻造烟囱火花 / 高军衔金色将旗 城市标记
      this._drawV23MilitaryMarkers(ctx, city, r, t);

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

  // ============================================================
  // V20.0 — 灾害可视化：按 city.disasterState 绘制静态/半静态标记
  // 约定数据契约：
  //   city.disasterState = {
  //     type: 'earthquake'|'flood'|'drought'|'plague'|'locust'|'snowstorm',
  //     severity: 0~1,          // 损坏/污染程度
  //     turnsLeft: number,     // 剩余持续回合（>0 表示正在持续）
  //     warning: bool           // true = 即将发生（闪烁预警）
  //   }
  // 性能：同屏灾害标记数量上限 _DISASTER_VISIBLE_CAP；
  //      远离屏幕中心的灾害降低绘制复杂度（LOD）；
  //      新灾害出现时调用 Animator.play* 触发一次性动画（去重）。
  // ============================================================
  _drawCityDisaster(ctx, city, r, t, visible, pos) {
    const ds = city && city.disasterState;
    if (!ds) {
      // 灾害结束：清理触发记录，避免下次同类型重播时漏触发
      if (this._disasterTriggered.has(city.id)) this._disasterTriggered.delete(city.id);
      return;
    }
    // 同屏灾害标记数量保护（超出则跳过最远离屏幕中心的）
    if (this._disasterVisibleCount >= this._DISASTER_VISIBLE_CAP) return;
    this._disasterVisibleCount = (this._disasterVisibleCount || 0) + 1;

    const type = ds.type;
    const sev = typeof ds.severity === 'number' ? Math.max(0, Math.min(1, ds.severity)) : 1;

    // ---- 1) 新灾害出现 → 触发一次性动画（去重：按 cityId+type+turnsLeft 签名）----
    const sig = `${type}|${ds.turnsLeft != null ? Math.floor(ds.turnsLeft) : 0}`;
    if (this._disasterTriggered.get(city.id) !== sig) {
      this._disasterTriggered.set(city.id, sig);
      this._triggerDisasterFX(type, pos.x, pos.y, r);
    }

    // ---- 2) 灾害预警（warning=true）：闪烁警告标记（三角感叹号，2Hz 闪烁）----
    if (ds.warning) {
      const blink = (Math.sin(t * Math.PI * 4) > 0) ? 1 : 0.35;
      ctx.save();
      ctx.globalAlpha = blink;
      // 警告三角（位于城市上方）
      ctx.fillStyle = '#ff5030';
      ctx.strokeStyle = '#ffd0a0';
      ctx.lineWidth = 1.5;
      const wy = -r - 22 * this.scale;
      const wsize = 6 * this.scale;
      ctx.beginPath();
      ctx.moveTo(0, wy - wsize);
      ctx.lineTo(wsize, wy + wsize * 0.6);
      ctx.lineTo(-wsize, wy + wsize * 0.6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 感叹号
      ctx.fillStyle = '#fff';
      ctx.fillRect(-0.8 * this.scale, wy - wsize * 0.3, 1.6 * this.scale, wsize * 0.9);
      ctx.beginPath(); ctx.arc(0, wy + wsize * 0.35, 1.1 * this.scale, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return; // 预警状态只画警告标记，不画灾害本体
    }

    // ---- 3) 正在持续：按类型绘制灾害标记 ----
    switch (type) {
      case 'earthquake': {
        // 地震后城市：建筑损坏标记（半毁/全毁）
        // severity<0.5 半毁（裂缝+倾斜）；>=0.5 全毁（废墟剪影）
        ctx.save();
        // 地面裂缝（2~3 条短裂纹穿过底座）
        ctx.strokeStyle = 'rgba(30,20,10,0.85)';
        ctx.lineWidth = 1.2 * this.scale;
        const crackN = sev >= 0.5 ? 3 : 2;
        for (let i = 0; i < crackN; i++) {
          const ang = (i / crackN) * Math.PI + sev * 0.7;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * -r * 0.6, Math.sin(ang) * r * 0.3);
          ctx.lineTo(Math.cos(ang + 0.3) * r * 0.7, Math.sin(ang + 0.3) * r * 0.3);
          ctx.lineTo(Math.cos(ang + 0.5) * r * 0.9, Math.sin(ang + 0.5) * r * 0.3);
          ctx.stroke();
        }
        // 全毁：绘制倒塌建筑剪影（灰色三角废墟）
        if (sev >= 0.5) {
          ctx.fillStyle = 'rgba(60,50,40,0.85)';
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, -r * 0.2);
          ctx.lineTo(-r * 0.2, -r * 0.7);
          ctx.lineTo(0, -r * 0.3);
          ctx.lineTo(r * 0.3, -r * 0.8);
          ctx.lineTo(r * 0.5, -r * 0.2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'flood': {
        // 洪水后城市：蓝色水痕 + 漂浮物
        ctx.save();
        // 蓝色水痕（半透明椭圆覆盖底座下半部）
        ctx.fillStyle = 'rgba(70,140,210,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // 水纹边线
        ctx.strokeStyle = 'rgba(160,210,245,0.8)';
        ctx.lineWidth = 1 * this.scale;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 漂浮物（2~3 块棕色小木板，随波起伏）
        const floatN = sev >= 0.5 ? 3 : 2;
        ctx.fillStyle = '#7a5a3a';
        for (let i = 0; i < floatN; i++) {
          const fx = Math.sin(t * 1.5 + i * 1.7 + city.isoX) * r * 0.5;
          const fy = r * 0.1 + Math.cos(t * 2 + i) * 1.5 * this.scale;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(Math.sin(t * 2 + i * 0.9) * 0.2);
          ctx.fillRect(-3 * this.scale, -1 * this.scale, 6 * this.scale, 2 * this.scale);
          ctx.restore();
        }
        ctx.restore();
        break;
      }
      case 'drought': {
        // 干旱地区：棕色土地 + 枯黄
        ctx.save();
        // 棕色干旱底色
        ctx.fillStyle = 'rgba(170,120,50,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // 干裂细纹
        ctx.strokeStyle = 'rgba(90,60,20,0.6)';
        ctx.lineWidth = 0.8 * this.scale;
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI + sev * 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * -r * 0.5, Math.sin(ang) * r * 0.25);
          ctx.lineTo(Math.cos(ang + 0.2) * r * 0.3, Math.sin(ang + 0.2) * r * 0.15);
          ctx.lineTo(Math.cos(ang + 0.4) * r * 0.6, Math.sin(ang + 0.4) * r * 0.3);
          ctx.stroke();
        }
        // 枯黄植物（2 株黄色小草）
        ctx.strokeStyle = '#b89a3a';
        ctx.lineWidth = 1 * this.scale;
        for (let i = -1; i <= 1; i += 2) {
          const gx = i * r * 0.6;
          ctx.beginPath();
          ctx.moveTo(gx, r * 0.2);
          ctx.lineTo(gx + i * 1.5 * this.scale, r * 0.2 - 4 * this.scale);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'plague': {
        // 瘟疫城市：绿色雾气笼罩（半透明绿团脉动）
        ctx.save();
        const pulse = 0.35 + 0.15 * Math.sin(t * 2 + city.isoX);
        ctx.globalAlpha = pulse * (0.6 + sev * 0.4);
        for (let i = 0; i < 3; i++) {
          const rR = (10 + i * 6) * this.scale * (0.8 + sev * 0.4);
          const ox = Math.sin(t * 1.2 + i * 1.3 + city.isoX) * 4 * this.scale;
          const g = ctx.createRadialGradient(ox, -i * 3 * this.scale, 2, ox, -i * 3 * this.scale, rR);
          g.addColorStop(0, 'rgba(90,200,90,0.6)');
          g.addColorStop(1, 'rgba(60,160,60,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(ox, -i * 3 * this.scale, rR, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'locust': {
        // 蝗灾地区：蝗虫群飞过（几个深色小影掠过城市上方）
        ctx.save();
        ctx.fillStyle = '#4a3a1a';
        const n = sev >= 0.5 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const speed = 60 + i * 15;
          const lx = ((t * speed + i * 40 + city.isoX * 10) % (r * 2.4)) - r * 1.2;
          const ly = -r * 0.5 - i * 3 * this.scale + Math.sin(t * 8 + i) * 2 * this.scale;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 2.2 * this.scale, 1 * this.scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'snowstorm': {
        // 暴风雪：白色冰雾薄纱 + 加大雪花
        ctx.save();
        ctx.globalAlpha = 0.35 * (0.7 + sev * 0.3);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 1.3);
        g.addColorStop(0, 'rgba(235,248,255,0.8)');
        g.addColorStop(1, 'rgba(235,248,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fill();
        // 几片加大雪花
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 4; i++) {
          const fx = Math.sin(t * 1.5 + i * 1.7 + city.isoX) * r * 0.7;
          const fy = ((t * 20 + i * 15 + city.isoY * 5) % (r * 2)) - r;
          ctx.beginPath(); ctx.arc(fx, fy, 1.6 * this.scale, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        break;
      }
    }
  }

  // V20.0：按灾害类型触发对应的一次性 Animator 动画
  _triggerDisasterFX(type, x, y, r) {
    if (typeof Animator.playEarthquake !== 'function') return;
    const scale = this.scale || 1;
    switch (type) {
      case 'earthquake':
        // 全屏地震（w/h 取视口尺寸，震中落在城市附近）
        Animator.playEarthquake(this.ctx, this.canvas.width, this.canvas.height);
        break;
      case 'flood':
        Animator.playFlood(this.ctx, x, y);
        break;
      case 'drought':
        Animator.playDrought(this.ctx, x, y);
        break;
      case 'plague':
        Animator.playPlague(this.ctx, x, y);
        break;
      case 'locust':
        Animator.playLocust(this.ctx, this.canvas.width, this.canvas.height);
        break;
      case 'snowstorm':
        if (typeof Animator.playSnowstorm === 'function') {
          Animator.playSnowstorm(this.ctx, this.canvas.width, this.canvas.height);
        }
        break;
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
  // 小地图：V17.0 离屏渲染缓存 + 军队/城市/战争迷雾/视口框 + 点击跳转热区
  drawMinimap(ctx, x, y, w, h) {
    if (!ctx || !this.game) return;
    // 记录热区（供 mousedown 检测点击跳转）
    this._lastMinimapRect = { x, y, w, h };

    // V17.0：离屏缓存——仅在脏标记时重建小地图底图（城市/军队/战争迷雾）
    if (this._minimapDirty || !this._minimapCanvas) {
      this._renderMinimapToCache(w, h);
      this._minimapDirty = false;
    }

    ctx.save();
    // 绘制缓存底图
    if (this._minimapCanvas) {
      ctx.drawImage(this._minimapCanvas, x, y, w, h);
    }
    // 视口框（每帧重画，随缩放/平移实时更新）
    this._drawMinimapViewport(ctx, x, y, w, h);
    // 增援路线（小地图上用势力色虚线）
    this._drawMinimapReinforcements(ctx, x, y, w, h);
    ctx.restore();
  }

  // V17.0：把小地图底图渲染到离屏 canvas（城市/军队/战争迷雾）
  _renderMinimapToCache(w, h) {
    if (!this._minimapCanvas) {
      this._minimapCanvas = document.createElement('canvas');
    }
    // 离屏 canvas 用 2x 分辨率提升清晰度
    const DPR = 2;
    this._minimapCanvas.width = w * DPR;
    this._minimapCanvas.height = h * DPR;
    const c = this._minimapCanvas.getContext('2d');
    c.scale(DPR, DPR);

    // 背景
    c.fillStyle = 'rgba(20,30,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#C4A55A';
    c.lineWidth = 1;
    c.strokeRect(0, 0, w, h);

    // 计算全图包围盒
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const city of this.game.cities.values()) {
      if (city.isoX < minX) minX = city.isoX;
      if (city.isoX > maxX) maxX = city.isoX;
      if (city.isoY < minY) minY = city.isoY;
      if (city.isoY > maxY) maxY = city.isoY;
    }
    if (!isFinite(minX)) return;
    const pad = 1;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const sx = w / (maxX - minX);
    const sy = h / (maxY - minY);
    const toMini = (isoX, isoY) => ({
      mx: (isoX - minX) * sx,
      my: (isoY - minY) * sy
    });

    // 战争迷雾：未探索城市画灰雾点
    for (const city of this.game.cities.values()) {
      const explored = (typeof this.game.isCityExplored === 'function')
        ? this.game.isCityExplored(city.id) : true;
      const { mx, my } = toMini(city.isoX, city.isoY);
      if (!explored) {
        c.fillStyle = 'rgba(80,80,80,0.6)';
        c.beginPath(); c.arc(mx, my, 2, 0, Math.PI * 2); c.fill();
        continue;
      }
      const faction = city.owner ? FACTIONS[city.owner] : null;
      c.fillStyle = faction ? faction.color : '#888';
      const r = city.capital ? 2.5 : 1.5;
      c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
    }
    // 军队点（白色小三角/圆点）
    for (const army of this.game.armies) {
      const city = this.game.cities.get(army.cityId);
      if (!city) continue;
      const { mx, my } = toMini(city.isoX, city.isoY);
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.arc(mx, my, 1.8, 0, Math.PI * 2); c.fill();
      // V17.0：战斗中军队画红色小点
      if (this._isArmyInBattle(army.id)) {
        c.fillStyle = '#ff3030';
        c.beginPath(); c.arc(mx, my, 2.6, 0, Math.PI * 2); c.fill();
      }
    }
    // 保存包围盒供视口框计算
    this._minimapBounds = { minX, minY, sx, sy, w, h };
  }

  // V17.0：判断某军队是否在战斗中（由 setBattles 提供）
  _isArmyInBattle(armyId) {
    for (const b of this._battleMarkers) {
      if (b.armyIdA === armyId || b.armyIdB === armyId) return true;
    }
    return false;
  }

  // V17.0：小地图视口框（每帧重画）
  _drawMinimapViewport(ctx, x, y, w, h) {
    if (!this._minimapBounds) return;
    const b = this._minimapBounds;
    const toMini = (isoX, isoY) => ({
      mx: x + (isoX - b.minX) * b.sx,
      my: y + (isoY - b.minY) * b.sy
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
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
  }

  // V17.0：小地图上的增援路线（势力色虚线）
  _drawMinimapReinforcements(ctx, x, y, w, h) {
    if (!this._minimapBounds || this._reinforcementRoutes.length === 0) return;
    const b = this._minimapBounds;
    ctx.save();
    for (const route of this._reinforcementRoutes) {
      ctx.strokeStyle = route.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      route.pts.forEach((p, i) => {
        const mx = x + (p.isoX - b.minX) * b.sx;
        const my = y + (p.isoY - b.minY) * b.sy;
        if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
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
    const si = this._seasonIdx();   // 0春 1夏 2秋 3冬
    for (const city of this.game.cities.values()) {
      if (city.terrain !== 'forest') continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 120)) continue;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      // V18.0：距离 LOD 决定绘制数量，远景只画 1 簇
      const clusters = dist < 520 ? 3 : 1;
      const size = dist < 260 ? 5 : dist < 520 ? 4 : 3;
      // V18.0：季节森林色彩——春嫩绿/夏浓绿/秋金黄/冬灰青
      let baseColor;
      if (si === 0) {          // 春：嫩绿
        baseColor = dist < 260 ? '#3a7a2a' : dist < 520 ? '#5a9a4a' : '#8ac070';
      } else if (si === 2) {   // 秋：黄褐
        baseColor = dist < 260 ? '#8a6a20' : dist < 520 ? '#a88a30' : '#c8a850';
      } else if (si === 3) {   // 冬：灰青（落叶稀疏）
        baseColor = dist < 260 ? '#4a5a5a' : dist < 520 ? '#6a7a7a' : '#9aa8a8';
      } else {                 // 夏：浓绿
        baseColor = dist < 260 ? '#1f4a1a' : dist < 520 ? '#3a7a2a' : '#6aa050';
      }
      // 树冠（近/中景 2~3 簇，远景 1 簇；冬季稀疏）
      const sway = Math.sin(t * 1.5 + city.isoX) * 1;
      ctx.fillStyle = baseColor;
      for (let k = 0; k < clusters; k++) {
        const ox = (k - (clusters - 1) / 2) * size * 1.2;
        const oy = (k % 2) * -2;
        ctx.beginPath();
        ctx.arc(pos.x + ox + sway, pos.y + oy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // V18.0：春季花开——树冠点缀粉色小花（仅近/中景）
      if (si === 0 && dist < 520) {
        ctx.fillStyle = 'rgba(255,170,200,0.9)';
        for (let k = 0; k < clusters; k++) {
          const ox = (k - (clusters - 1) / 2) * size * 1.2;
          ctx.beginPath();
          ctx.arc(pos.x + ox + sway - size * 0.3, pos.y - 1, size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
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
      // V18.0：夜间灯笼——城市下方悬挂 1~2 盏暖黄灯笼，轻微摇曳
      const lanternN = (city.capital || (city.size || 1) >= 4) ? 2 : 1;
      const flicker = 0.8 + 0.2 * Math.sin(this._animTime * 6 + seed);
      for (let i = 0; i < lanternN; i++) {
        const lx = pos.x + (i === 0 ? -6 : 6) * this.scale;
        const ly = pos.y + (8 + i * 3) * this.scale;
        // 灯笼光晕
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 7 * this.scale);
        lg.addColorStop(0, `rgba(255,200,90,${0.8 * flicker})`);
        lg.addColorStop(1, 'rgba(255,160,50,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(lx, ly, 7 * this.scale, 0, Math.PI * 2); ctx.fill();
        // 灯笼本体
        ctx.fillStyle = '#ffd060';
        ctx.beginPath(); ctx.arc(lx, ly, 2 * this.scale, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ============================================================
  // V17.0：悬停高亮 / 战斗标记 / 增援路线
  // ============================================================

  // 每帧根据鼠标位置检测悬停城市/军队（节流：render 中调用）
  _updateHover() {
    this._hoverCity = null;
    this._hoverArmy = null;
    if (!this.game) return;
    const mx = this._mMouseX, my = this._mMouseY;
    // 小地图区域内不触发悬停
    const mm = this._lastMinimapRect;
    if (mm && mx >= mm.x && mx <= mm.x + mm.w && my >= mm.y && my <= mm.y + mm.h) return;

    // 检测城市
    let bestCity = null, bestCityD = Infinity;
    for (const city of this.game.cities.values()) {
      if (typeof this.game.isCityExplored === 'function'
          && !this.game.isCityExplored(city.id)) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const r = (20 + city.size * 6) * this.scale;
      const dx = mx - pos.x, dy = my - pos.y;
      const d = dx * dx + dy * dy;
      if (d < r * r && d < bestCityD) { bestCityD = d; bestCity = city; }
    }
    this._hoverCity = bestCity ? bestCity.id : null;

    // 检测军队
    let bestArmy = null, bestArmyD = Infinity;
    for (const army of this.game.armies) {
      const city = this.game.cities.get(army.cityId);
      if (!city) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      const r = 16 * this.scale;
      const dx = mx - pos.x, dy = my - (pos.y - 20 * this.scale);
      const d = dx * dx + dy * dy;
      if (d < r * r && d < bestArmyD) { bestArmyD = d; bestArmy = army; }
    }
    this._hoverArmy = bestArmy ? bestArmy.id : null;
  }

  // 绘制悬停高亮（金色脉冲圈）
  _drawHoverHighlight(ctx) {
    if (!this.game) return;
    const pulse = 0.6 + this._hoverPulse * 0.4;
    ctx.save();
    if (this._hoverCity) {
      const city = this.game.cities.get(this._hoverCity);
      if (city) {
        const pos = this.isoToScreen(city.isoX, city.isoY);
        const r = (20 + city.size * 6) * this.scale;
        ctx.globalAlpha = 0.7 * pulse;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = -this._animTime * 15;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (this._hoverArmy && !this._hoverCity) {
      const army = this.game.armies.find(a => a.id === this._hoverArmy);
      if (army) {
        const city = this.game.cities.get(army.cityId);
        if (city) {
          const pos = this.isoToScreen(city.isoX, city.isoY);
          ctx.globalAlpha = 0.7 * pulse;
          ctx.strokeStyle = '#FFE080';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 20 * this.scale, 14 * this.scale + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // 战斗中军队标记：在交战双方军队上方画红色交叉剑
  _drawBattleMarkers(ctx) {
    if (!this.game || this._battleMarkers.length === 0) return;
    ctx.save();
    for (const b of this._battleMarkers) {
      // 找到两支军队的屏幕位置，在其中点画交叉剑
      const armyA = this.game.armies.find(a => a.id === b.armyIdA);
      const armyB = this.game.armies.find(a => a.id === b.armyIdB);
      if (!armyA || !armyB) continue;
      const cityA = this.game.cities.get(armyA.cityId);
      const cityB = this.game.cities.get(armyB.cityId);
      if (!cityA || !cityB) continue;
      const pa = this.isoToScreen(cityA.isoX, cityA.isoY);
      const pb = this.isoToScreen(cityB.isoX, cityB.isoY);
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2 - 20 * this.scale;
      if (!this._onScreen(mx, my, 100)) continue;
      // 红色脉冲外圈
      const pulse = 0.6 + Math.sin(this._animTime * 6) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(200,30,30,0.25)';
      ctx.beginPath(); ctx.arc(mx, my, 12 * this.scale, 0, Math.PI * 2); ctx.fill();
      // 交叉剑（红色）
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 2 * this.scale;
      ctx.lineCap = 'round';
      const s = 7 * this.scale;
      ctx.beginPath();
      ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s);
      ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 增援路线：主地图上的蓝色虚线箭头（流动光点）
  _drawReinforcementRoutes(ctx) {
    if (!this.game || this._reinforcementRoutes.length === 0) return;
    ctx.save();
    for (const route of this._reinforcementRoutes) {
      const pts = route.pts.map(p => this.isoToScreen(p.isoX, p.isoY));
      if (pts.length < 2) continue;
      // 视口粗裁剪
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      if (!this._onScreen(cx, cy, 400)) continue;
      // 虚线（流动）
      ctx.strokeStyle = route.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this._animTime * 30;
      ctx.beginPath();
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      // 沿路径流动的箭头光点
      const total = pts.length - 1;
      const segT = (this._animTime * 0.5) % total;
      const i0 = Math.floor(segT);
      const f = segT - i0;
      const a = pts[i0], b = pts[Math.min(i0 + 1, pts.length - 1)];
      const ax = a.x + (b.x - a.x) * f;
      const ay = a.y + (b.y - a.y) * f;
      const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 10);
      glow.addColorStop(0, 'rgba(200,230,255,0.9)');
      glow.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ax, ay, 10, 0, Math.PI * 2); ctx.fill();
      // 箭头三角
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.fillStyle = route.color;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(ang) * 8, ay + Math.sin(ang) * 8);
      ctx.lineTo(ax + Math.cos(ang + 2.5) * 6, ay + Math.sin(ang + 2.5) * 6);
      ctx.lineTo(ax + Math.cos(ang - 2.5) * 6, ay + Math.sin(ang - 2.5) * 6);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // V18.0 — 动画与地图增强：城市规模建筑 / 势力边境 / 河上船只 / 交战火焰
  // ============================================================

  // 城市规模可视化：大城市多几栋小建筑，小城市精简
  // sizeLevel: 1小 / 2中 / 3大 / 4都城
  _drawCityBuildings(ctx, r, sizeLevel) {
    const count = [0, 0, 2, 4, 6][sizeLevel] || 0;
    if (count === 0) return;
    ctx.save();
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + 0.5;
        const bx = Math.cos(ang) * r * 0.45;
        const by = Math.sin(ang) * r * 0.3;
        // 房身
        ctx.fillStyle = '#caa96a';
        ctx.fillRect(bx - 2.5 * this.scale, by - 2.5 * this.scale, 5 * this.scale, 4 * this.scale);
        // 屋顶
        ctx.fillStyle = '#8a5a3a';
        ctx.beginPath();
        ctx.moveTo(bx - 3 * this.scale, by - 2.5 * this.scale);
        ctx.lineTo(bx, by - 5 * this.scale);
        ctx.lineTo(bx + 3 * this.scale, by - 2.5 * this.scale);
        ctx.closePath(); ctx.fill();
      }
    ctx.restore();
  }

  // ============================================================
  // V19.0 — 动画与地图增强：文化建筑 / 科技完成 / 高文化城市 视觉标记
  // 设计：
  //   1) 文化建筑（学府/太学·书院/佛寺/道观/石窟）在城市上方画小图标；
  //   2) 玩家势力已完成科技 → 玩家城市头顶金色星标；
  //   3) 高文化城市（culture 阈值）→ 彩旗/灯笼/书卷装饰环绕；
  //   4) 距离 LOD：scale 越小（视野越远）装饰越简化，96 座城市不会过载。
  // 性能：所有装饰在 ctx 已 translate 到城市原点后绘制，无额外坐标计算；
  //      远处城市仅画最小星标/文化点，跳过彩旗/灯笼动画。
  // ============================================================

  // 读取城市文化值（兼容 religion.culture 字段）
  _v19CityCulture(city) {
    if (!city || !city.religion) return 0;
    return city.religion.culture || 0;
  }

  // 读取城市是否拥有某文化建筑（level>=1）
  _v19HasBuilding(city, bid) {
    return !!(city && city.buildings && city.buildings[bid] && city.buildings[bid] >= 1);
  }

  // 是否有任意文化类建筑
  _v19CultureBuildingKind(city) {
    if (!city || !city.buildings) return null;
    const b = city.buildings;
    if (b['v14_academy'] >= 1) return 'academy';   // 学府
    if (b['taixue'] >= 1) return 'academy';         // 太学≈书院
    if (b['buddhist_temple'] >= 1) return 'temple'; // 佛寺
    if (b['daoist_temple'] >= 1) return 'daoist';   // 道观
    if (b['grotto'] >= 1) return 'grotto';          // 石窟
    if (b['temple'] >= 1) return 'shrine';         // 庙宇
    return null;
  }

  // 主入口：在城市原点（已 translate）绘制 V19 文化/科技标记
  _drawV19CultureTechMarkers(ctx, city, r, t) {
    if (!city) return;
    const s = this.scale;
    // ---- LOD：远处（scale<0.7）只画极简标记，跳过动画装饰 ----
    const farLOD = s < 0.7;

    // ---- 1) 科技完成金色星标（仅玩家势力城市）----
    const playerFid = this.game && this.game.playerFaction;
    const techs = (this.game && Array.isArray(this.game.techs)) ? this.game.techs : null;
    if (playerFid && city.owner === playerFid && techs && techs.length > 0) {
      const starY = -r - (farLOD ? 6 : 14) * s;
      const pulse = 1 + 0.12 * Math.sin(t * 3 + city.isoX);
      const starR = (farLOD ? 3 : 5) * s * pulse;
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = farLOD ? 0 : 6 * s;
      this._v19DrawStar(ctx, starR, '#FFD700');
      ctx.restore();
    }

    // ---- 2) 文化建筑小图标（学府/寺庙/书院）----
    const kind = this._v19CultureBuildingKind(city);
    if (kind && !farLOD) {
      const iconY = -r - 24 * s;
      const iconR = 4.5 * s;
      ctx.save();
      ctx.translate(0, iconY);
      // 底圈
      ctx.fillStyle = 'rgba(255,245,210,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, iconR + 1.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.arc(0, 0, iconR + 1.5 * s, 0, Math.PI * 2); ctx.stroke();
      // 按类型画小符号
      if (kind === 'academy') {
        // 学府：书卷
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(-iconR * 0.7, -iconR * 0.5, iconR * 1.4, iconR);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(-iconR * 0.55, -iconR * 0.35, iconR * 1.1, iconR * 0.7);
      } else if (kind === 'temple' || kind === 'shrine') {
        // 佛寺/庙宇：塔刹小三角
        ctx.fillStyle = '#B83A2A';
        ctx.beginPath();
        ctx.moveTo(-iconR * 0.7, iconR * 0.4);
        ctx.lineTo(0, -iconR * 0.6);
        ctx.lineTo(iconR * 0.7, iconR * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-iconR * 0.15, -iconR * 0.8, iconR * 0.3, iconR * 0.3);
      } else if (kind === 'daoist') {
        // 道观：太极阴阳（简化）
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(0, 0, iconR * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5f0e0';
        ctx.beginPath(); ctx.arc(0, -iconR * 0.35, iconR * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'grotto') {
        // 石窟：小佛龛
        ctx.fillStyle = '#7a6a5a';
        ctx.beginPath(); ctx.arc(0, iconR * 0.1, iconR * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFE9A8';
        ctx.beginPath(); ctx.arc(0, 0, iconR * 0.25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ---- 3) 高文化城市装饰：彩旗/灯笼/书卷 ----
    const culture = this._v19CityCulture(city);
    const HIGH_CULTURE = 60;     // 高文化阈值
    const MID_CULTURE = 25;      // 中文化阈值
    if (culture >= MID_CULTURE && !farLOD) {
      const isHigh = culture >= HIGH_CULTURE;
      // 彩旗（左右两侧，随风摆动）
      const flagSwing = Math.sin(t * 4 + city.isoX) * 1.2 * s;
      for (const side of [-1, 1]) {
        const fx = side * r * 0.9;
        const fy = -r * 0.3;
        ctx.strokeStyle = '#c4a55a';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 10 * s);
        ctx.stroke();
        // 彩旗（朱红）
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(fx, fy - 10 * s);
        ctx.lineTo(fx + side * (6 * s + flagSwing), fy - 8 * s);
        ctx.lineTo(fx, fy - 6 * s);
        ctx.closePath();
        ctx.fill();
      }
      // 高文化：额外加灯笼（左右，暖黄光晕）+ 书卷小图标
      if (isHigh) {
        for (const side of [-1, 1]) {
          const lx = side * r * 0.5;
          const ly = r * 0.2;
          const glow = 0.6 + 0.4 * Math.sin(t * 2.5 + city.isoY + side);
          ctx.save();
          ctx.shadowColor = '#ffb84a';
          ctx.shadowBlur = (4 + glow * 4) * s;
          ctx.fillStyle = `rgba(255,${180 + Math.floor(glow * 40)},80,0.95)`;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 2.5 * s, 3.2 * s, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // 灯笼底座
          ctx.fillStyle = '#6a4a2a';
          ctx.fillRect(lx - 1 * s, ly + 3 * s, 2 * s, 1 * s);
        }
        // 书卷（城顶右侧小卷轴）
        ctx.save();
        ctx.translate(r * 0.6, -r * 0.6);
        ctx.rotate(0.2);
        ctx.fillStyle = '#f0e0b0';
        ctx.fillRect(-3 * s, -1.5 * s, 6 * s, 3 * s);
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(-3.5 * s, -2 * s, 1 * s, 4 * s);
        ctx.fillRect(2.5 * s, -2 * s, 1 * s, 4 * s);
        ctx.restore();
      }
    }
  }

  // 画一颗五角星（绕 (0,0)，半径 R）
  _v19DrawStar(ctx, R, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const ang2 = ang + Math.PI / 5;
      ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
      ctx.lineTo(Math.cos(ang2) * R * 0.45, Math.sin(ang2) * R * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ============================================================
  // V23.0 — 军事训练 / 装备锻造 / 高军衔将旗 城市标记
  // 传入的 ctx 已 translate 到城市原点、按 scale 缩放（r 为城市半径）。
  // ============================================================

  // 重建高军衔武将所在城市集合（每 0.5s 一次，避免每帧遍历武将）
  _v23RebuildHighRankCities() {
    if (!this.game || !this.game.generals) { this._v23HighRankCityIds = []; return; }
    const set = new Set();
    for (const gen of this.game.generals.values()) {
      if (!gen || !gen.office || gen.location == null) continue;
      const off = getOffice(gen.office);
      if (off && off.type === 'military' && (off.rank || 99) <= this._V23_HIGH_RANK_OFFICE) {
        set.add(gen.location);
      }
    }
    this._v23HighRankCityIds = Array.from(set);
  }

  _v23HasHighRankGeneral(cityId) {
    if (this._animTime - this._v23RankRebuildAt > 0.5) {
      this._v23RankRebuildAt = this._animTime;
      this._v23RebuildHighRankCities();
    }
    return this._v23HighRankCityIds.indexOf(cityId) >= 0;
  }

  // V23 城市标记总入口（由 _drawCities 在 V19 标记后调用）
  _drawV23MilitaryMarkers(ctx, city, r, t) {
    if (!city) return;
    const s = this.scale;
    const farLOD = s < 0.7;   // 距离 LOD：远视野简化绘制

    // ---- 1) 训练中的城市：城内小士兵持矛操练标记 ----
    const trainLv = city.training || 0;
    if (trainLv >= this._V23_TRAIN_THRESHOLD) {
      const n = farLOD ? 1 : 2;   // 远景只画 1 个小人
      ctx.save();
      for (let i = 0; i < n; i++) {
        const sx = (i === 0 ? -r * 0.45 : r * 0.45);
        const step = Math.abs(Math.sin(t * 5 + city.isoX + i * 2)) * 1.2 * s;
        // 小兵身体（灰甲）
        ctx.fillStyle = '#3a4a5a';
        ctx.fillRect(sx - 1.4 * s, -r * 0.1 + step * 0.3, 2.8 * s, 3.6 * s);
        // 头
        ctx.fillStyle = '#e0c8a0';
        ctx.beginPath(); ctx.arc(sx, -r * 0.1 - 1.6 * s + step * 0.3, 1.2 * s, 0, Math.PI * 2); ctx.fill();
        // 长矛
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 0.8 * s;
        ctx.beginPath();
        ctx.moveTo(sx + 1 * s, -r * 0.1 + 1 * s);
        ctx.lineTo(sx + 3 * s, -r * 0.1 - 5 * s + step);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- 2) 锻造中的城市：铁匠炉烟囱冒烟 + 火花 ----
    const ws = (city.buildings && city.buildings.workshop) || 0;
    if (ws >= 1) {
      ctx.save();
      const cx = r * 0.5, cy = -r * 0.3;
      // 小烟囱（梯形）
      ctx.fillStyle = '#6a4a3a';
      ctx.beginPath();
      ctx.moveTo(cx - 2.5 * s, cy + 3 * s);
      ctx.lineTo(cx + 2.5 * s, cy + 3 * s);
      ctx.lineTo(cx + 1.5 * s, cy - 3 * s);
      ctx.lineTo(cx - 1.5 * s, cy - 3 * s);
      ctx.closePath(); ctx.fill();
      // 炉口火光（脉动）
      const glow = 0.6 + 0.4 * Math.sin(t * 6 + city.isoY);
      ctx.fillStyle = `rgba(255,${140 + Math.floor(glow * 80)},40,0.95)`;
      ctx.beginPath(); ctx.arc(cx, cy + 2.5 * s, (1.2 + glow) * s, 0, Math.PI * 2); ctx.fill();
      if (!farLOD) {
        // 烟囱白烟（循环上升变淡）
        const smoke = (t * 0.5 + city.isoX) % 1;
        ctx.fillStyle = `rgba(200,200,200,${0.45 * (1 - smoke)})`;
        ctx.beginPath();
        ctx.arc(cx, cy - 4 * s - smoke * 8 * s, (1.2 + smoke * 1.6) * s, 0, Math.PI * 2);
        ctx.fill();
        // 偶发锻造火花（橙金，周期）
        const sparkPulse = (Math.sin(t * 9 + city.isoY) + 1) / 2;
        if (sparkPulse > 0.7) {
          ctx.fillStyle = '#ffd040';
          ctx.beginPath();
          ctx.arc(cx + (Math.sin(t * 13) * 2) * s, cy - 2 * s, 0.8 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ---- 3) 高军衔武将所在城市：金色将旗（脉动）----
    if (this._v23HasHighRankGeneral(city.id)) {
      ctx.save();
      const pulse = 1 + 0.14 * Math.sin(t * 3 + city.isoX);
      const fx = -r * 0.7;
      const fy = -r * 0.2;
      // 旗杆
      ctx.strokeStyle = '#c4a55a';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(fx, fy + 4 * s); ctx.lineTo(fx, fy - 12 * s * pulse); ctx.stroke();
      // 将旗（金边红底，飘扬）
      const wave = Math.sin(t * 5 + city.isoY) * 1.4 * s;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = farLOD ? 0 : 5 * s;
      ctx.fillStyle = '#c82828';
      ctx.beginPath();
      ctx.moveTo(fx, fy - 12 * s * pulse);
      ctx.lineTo(fx + 7 * s + wave, fy - 10 * s * pulse + wave * 0.5);
      ctx.lineTo(fx, fy - 8 * s * pulse);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      // 旗面金边
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 12 * s * pulse);
      ctx.lineTo(fx + 7 * s + wave, fy - 10 * s * pulse + wave * 0.5);
      ctx.lineTo(fx, fy - 8 * s * pulse);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 河流船只更新：定期从河流城市旁生成商船/战船，沿水平方向巡航
  _updateRiverShips(dt) {
    this._riverShipTimer -= dt;
    if (this._riverShipTimer > 0 || !this.game) {
      // 仍需更新在途船只位置
      this._stepRiverShips(dt);
      return;
    }
    this._riverShipTimer = 2.5 + Math.random() * 2.5;   // 2.5~5s 一艘
    if (this._riverShips.length < this._RIVER_SHIP_CAP) {
      // 收集可见的河流城市作为生成点
      const riverCities = [];
      for (const c of this.game.cities.values()) {
        if (c.terrain !== 'river') continue;
        const pos = this.isoToScreen(c.isoX, c.isoY);
        if (this._onScreen(pos.x, pos.y, 200)) riverCities.push(c);
      }
      if (riverCities.length) {
        const city = riverCities[Math.floor(Math.random() * riverCities.length)];
        const pos = this.isoToScreen(city.isoX, city.isoY);
        // 复用对象池
        const sh = this._riverShipPool.pop() || {};
        const dir = Math.random() < 0.5 ? 1 : -1;
        Object.assign(sh, {
          x: pos.x - dir * (40 + Math.random() * 30),
          y: pos.y + (Math.random() - 0.5) * 8,
          dir, speed: 14 + Math.random() * 10,
          type: Math.random() < 0.7 ? 'merchant' : 'warship',
          life: 0, maxLife: 6 + Math.random() * 3,
          seed: Math.random() * 100
        });
        this._riverShips.push(sh);
      }
    }
    this._stepRiverShips(dt);
  }

  _stepRiverShips(dt) {
    for (let i = this._riverShips.length - 1; i >= 0; i--) {
      const sh = this._riverShips[i];
      sh.x += sh.dir * sh.speed * dt;
      sh.life += dt;
      if (sh.life >= sh.maxLife || !this._onScreen(sh.x, sh.y, 120)) {
        this._riverShips.splice(i, 1);
        if (this._riverShipPool.length < 40) this._riverShipPool.push(sh);
      }
    }
  }

  // 绘制河上商船/战船（小船身 + 桅杆/帆，随波轻微起伏）
  _drawRiverShips(ctx) {
    if (!this._riverShips.length) return;
    const t = this._animTime;
    ctx.save();
    for (const sh of this._riverShips) {
      const bob = Math.sin(t * 3 + sh.seed) * 1.5 * this.scale;
      ctx.save();
        ctx.translate(sh.x, sh.y + bob);
        if (sh.dir < 0) ctx.scale(-1, 1);   // 朝左则翻转船向
        // 船身
        ctx.fillStyle = sh.type === 'warship' ? '#5a3a2a' : '#7a5a30';
        ctx.beginPath();
        ctx.moveTo(-6 * this.scale, 0);
        ctx.lineTo(6 * this.scale, 0);
        ctx.lineTo(4 * this.scale, 2.5 * this.scale);
        ctx.lineTo(-4 * this.scale, 2.5 * this.scale);
        ctx.closePath(); ctx.fill();
        // 桅杆
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1 * this.scale;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7 * this.scale); ctx.stroke();
        if (sh.type === 'merchant') {
          // 商船：白帆
          ctx.fillStyle = 'rgba(240,230,200,0.9)';
          ctx.beginPath();
          ctx.moveTo(0, -7 * this.scale);
          ctx.lineTo(4 * this.scale, -5 * this.scale);
          ctx.lineTo(0, -3 * this.scale);
          ctx.closePath(); ctx.fill();
        } else {
          // 战船：红旗
          ctx.fillStyle = '#b03030';
          ctx.fillRect(1 * this.scale, -6 * this.scale, 3 * this.scale, 2 * this.scale);
        }
      ctx.restore();
    }
    ctx.restore();
  }

  // 势力边境：相邻不同归属城市间画势力色流动虚线
  _drawFactionBorders(ctx) {
    if (!this.game) return;
    const t = this._animTime;
    ctx.save();
    let drawn = 0;
    for (const city of this.game.cities.values()) {
      if (drawn >= 40) break;
      if (!city.owner) continue;
      const links = CITY_LINKS[city.id] || [];
      for (const tid of links) {
        if (city.id >= tid) continue;
        const target = this.game.cities.get(tid);
        if (!target || !target.owner) continue;
        if (target.owner === city.owner) continue;   // 同势力不画边界
        const p1 = this.isoToScreen(city.isoX, city.isoY);
        const p2 = this.isoToScreen(target.isoX, target.isoY);
        if (!this._onScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 200)) continue;
        const col = (FACTIONS[city.owner] && FACTIONS[city.owner].color) || '#888';
        ctx.strokeStyle = this._factionColorWithAlpha(col, 0.6);
        ctx.lineWidth = 1.5 * this.scale;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 6;   // 边界虚线缓慢流动
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        drawn++;
        if (drawn >= 40) break;
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 交战城市周围火焰/烟雾（按 setBattles 推导城市；LOD 控制火焰数量）
  _drawCityBattleFire(ctx) {
    if (!this.game || this._battleMarkers.length === 0) return;
    const t = this._animTime;
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    ctx.save();
    for (const b of this._battleMarkers) {
      const armyA = this.game.armies.find(a => a.id === b.armyIdA);
      if (!armyA) continue;
      const city = this.game.cities.get(armyA.cityId);
      if (!city) continue;
      const pos = this.isoToScreen(city.isoX, city.isoY);
      if (!this._onScreen(pos.x, pos.y, 140)) continue;
      // LOD：距离视口中心越远，火焰点越少
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      const flames = dist < 300 ? 3 : dist < 600 ? 2 : 1;
      const r = (10 + (city.size || 1) * 4) * this.scale;
      for (let i = 0; i < flames; i++) {
        const fx = pos.x + Math.sin(t * 5 + i * 2.1 + city.isoX) * r * 0.7;
        const fy = pos.y - r * 0.4 - (i % 2) * 4;
        const fl = 0.6 + 0.4 * Math.sin(t * 9 + i * 3 + city.isoY);
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 8 * this.scale);
        g.addColorStop(0, `rgba(255,${140 + Math.floor(fl * 80)},40,0.85)`);
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fx, fy, 8 * this.scale, 0, Math.PI * 2); ctx.fill();
      }
      // 烟雾（灰黑上升，仅中近景）
      if (dist < 500) {
        ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2 + city.isoX);
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - r - 6 - Math.sin(t * 1.5) * 3, 5 * this.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}
