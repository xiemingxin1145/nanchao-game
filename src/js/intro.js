// ============================================================
// intro.js — V16.0 开场演出深化版
// ------------------------------------------------------------
// V16.0：从 4 状态扩展到 10+ 状态：
//   black → narration → timeline → factionShowcase → mapZoom →
//   protagonist → prologueBattle → title → subtitle → fadeout
// 每个状态有持续时间 + 视觉效果（Ken Burns / 打字机 / 粒子 / 地图缩放）。
// 新增：
//   - factionShowcase：各势力旗帜依次闪现
//   - mapZoom：地图从全局缩放到主角势力
//   - prologueBattle：序幕战斗剪影（粒子尘烟 + 剪影交错）
//   - 任意键/点击跳过
//   - 新 API：skipIntro() / getIntroState() / onIntroComplete callback
//   - 按剧本定制开场（不同剧本不同旁白文本与视觉）
// 技术参考：Godot / Unity 开场 cutscene 状态机；
//   粒子系统用 canvas requestAnimationFrame 驱动；
//   Ken Burns 用 CSS transform scale+translate 插值。
// ============================================================

import { markIntroCompleted } from './ngplus.js';

// ---------- 状态表（10 个状态，含 dur 秒数） ----------
const INTRO_STATES = [
  { id: 'black',            dur: 1.0 },  // 黑屏
  { id: 'narration',        dur: 3.5 },  // 历史旁白（打字机）
  { id: 'timeline',         dur: 5.0 },  // 时代变迁时间线（年份滚动）
  { id: 'factionShowcase',  dur: 4.0 },  // 主要势力旗帜闪现
  { id: 'mapZoom',          dur: 3.5 },  // 地图从全局缩放到主角势力
  { id: 'protagonist',      dur: 2.5 },  // 主角选择
  { id: 'prologueBattle',   dur: 4.0 },  // 序幕战斗剪影
  { id: 'title',            dur: 2.5 },  // 主标题浮现
  { id: 'subtitle',         dur: 1.5 },  // 副标题
  { id: 'fadeout',          dur: 1.0 }   // 渐隐
];

// 时间线关键事件（与年份同步闪现）
const TIMELINE_EVENTS = [
  { year: 534, text: '北魏分裂 · 东西二魏对峙' },
  { year: 537, text: '沙苑之战 · 宇文泰大破高欢' },
  { year: 548, text: '侯景之乱 · 江南涂炭' },
  { year: 550, text: '高洋代魏 · 北齐建立' },
  { year: 557, text: '陈霸先建陈 · 宇文觉建周' },
  { year: 577, text: '北周灭齐 · 北方一统' },
  { year: 581, text: '杨坚代周 · 隋朝肇建' },
  { year: 589, text: '隋灭陈 · 天下重归一统' }
];

// 势力旗帜闪现序列（id, 名称, 色, 描述）
const FACTION_FLASH = [
  { id: 'dongwei',   name: '北齐 · 高氏',   color: '#A0522D', desc: '河北铁骑，名将如云' },
  { id: 'xiwei',     name: '北周 · 宇文氏', color: '#2C3E6B', desc: '关中府兵，耕战一体' },
  { id: 'nanchao',   name: '南陈 · 陈氏',   color: '#1B7A5A', desc: '江东天堑，水军横江' },
  { id: 'hou_liang', name: '后梁 · 萧氏',   color: '#6B4C7A', desc: '江陵附庸，守国一隅' },
  { id: 'wang_lin',  name: '王琳 · 湘郢',   color: '#8B6914', desc: '南朝孤忠，志在匡复' },
  { id: 'xiao_zhuang',name: '萧庄 · 豫州',   color: '#4A6B5A', desc: '宗室遗脉，徘徊齐魏' }
];

// 剧本定制开场文本（不同剧本不同旁白/时间线区间）
const SCENARIO_INTRO = {
  '534': {
    narration: '公元534年，孝武帝西奔长安，高欢另立新主。' +
      '自此魏分东西，洛京丘墟。江南梁武在位，文治极盛而武备渐弛。' +
      '英雄并起，豪杰争锋，天下大势，分合无常。',
    yearFrom: 534, yearTo: 550,
    title: '南北朝', subtitle: '—— 魏分东西 · 鼎峙之初 ——'
  },
  '550': {
    narration: '公元550年，高洋代魏建齐。西魏宇文氏虎踞关中，' +
      '江南陈霸先崛起。六雄并起，干戈不息四十余载。' +
      '英雄并起，豪杰争锋，天下大势，分合无常。',
    yearFrom: 550, yearTo: 580,
    title: '南北朝', subtitle: '—— 六雄并起 · 王霸之秋 ——'
  },
  '575': {
    narration: '公元575年，北周武帝亲征北齐。齐主昏乱，斛律光冤死，' +
      '庙堂瓦解。江左陈室偏安，后梁附庸江陵。' +
      '北方一统之机，在此一举。',
    yearFrom: 575, yearTo: 589,
    title: '南北朝', subtitle: '—— 周武伐齐 · 混一前夕 ——'
  },
  '581': {
    narration: '公元581年，杨坚代周建隋。八年生聚，文武兼修，' +
      '长江天堑，终难独守。江南陈氏，主昏臣惰。' +
      '天下一统之势，已不可逆转。',
    yearFrom: 581, yearTo: 589,
    title: '南北朝', subtitle: '—— 隋文肇建 · 六合将同 ——'
  }
};

// 默认（无剧本）开场
const DEFAULT_INTRO = {
  narration: '公元534年，北魏分裂为东西二魏。' +
    '此后四十余载，江南江北，干戈不息。' +
    '英雄并起，豪杰争锋，天下大势，分合无常。',
  yearFrom: 534, yearTo: 589,
  title: '南北朝', subtitle: '—— 乱世英雄起四方 ——'
};

export class IntroPlayer {
  // onComplete: 演出结束回调；onSkip: 跳过回调
  // opts.scenario: 剧本 id（'534'/'550'/'575'/'581'），按剧本定制开场
  constructor(opts = {}) {
    this.onComplete = opts.onComplete || (() => {});
    this.onSkip = opts.onSkip || null;
    this.scenario = opts.scenario || null;
    // 剧本定制文本
    const sc = (this.scenario && SCENARIO_INTRO[this.scenario]) || DEFAULT_INTRO;
    this._narration = sc.narration;
    this._yearFrom = sc.yearFrom;
    this._yearTo = sc.yearTo;
    this._titleText = sc.title;
    this._subtitleText = sc.subtitle;

    this.root = null;
    this.rafId = null;
    this.startTime = 0;
    this.stateIdx = 0;
    this.stateStart = 0;
    this.skipped = false;
    this._keyHandler = null;
    this._clickHandler = null;
    this._particles = [];     // 序幕战斗粒子
    this._mapZoomPct = 0;     // 地图缩放进度 0~1
  }

  // 创建全屏 intro 容器并播放
  play() {
    this.root = document.createElement('div');
    this.root.id = 'intro-screen';
    this.root.innerHTML = `
      <div class="intro-bg kenburns"></div>
      <div class="intro-overlay"></div>
      <div class="intro-faction-flash" id="intro-faction" style="display:none"></div>
      <div class="intro-mapzoom" id="intro-mapzoom" style="display:none">
        <div class="intro-map-globe" id="intro-globe"></div>
        <div class="intro-map-spot" id="intro-spot"></div>
      </div>
      <canvas class="intro-battle-canvas" id="intro-battle" style="display:none"></canvas>
      <div class="intro-content">
        <div class="intro-text" id="intro-text"></div>
        <div class="intro-year" id="intro-year">${this._yearFrom}</div>
        <div class="intro-event" id="intro-event"></div>
        <h1 class="intro-title" id="intro-title">${this._titleText}</h1>
        <p class="intro-subtitle" id="intro-subtitle">${this._subtitleText}</p>
      </div>
      <div class="intro-skip">点击任意处跳过</div>
    `;
    document.body.appendChild(this.root);

    this.startTime = performance.now();
    this.stateIdx = 0;
    this.stateStart = this.startTime;

    // 跳过监听
    this._keyHandler = () => this.skip();
    this._clickHandler = () => this.skip();
    document.addEventListener('keydown', this._keyHandler);
    this.root.addEventListener('click', this._clickHandler);

    this._loop();
  }

  // ---------- 新 API ----------
  // 跳过当前开场（供外部按钮调用）
  skipIntro() { this.skip(); }
  // 返回当前状态信息（供 UI/测试查询）
  getIntroState() {
    const st = INTRO_STATES[this.stateIdx];
    return {
      stateIdx: this.stateIdx,
      stateId: st ? st.id : 'done',
      totalStates: INTRO_STATES.length,
      skipped: this.skipped,
      scenario: this.scenario
    };
  }

  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this._cleanup();
    markIntroCompleted();
    if (this.onSkip) this.onSkip();
    this.onComplete();
  }

  _cleanup() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._clickHandler && this.root) this.root.removeEventListener('click', this._clickHandler);
    if (this.root) { this.root.classList.add('fade-out'); setTimeout(() => { if (this.root) this.root.remove(); }, 600); }
    this.root = null;
  }

  _loop() {
    const now = performance.now();
    const state = INTRO_STATES[this.stateIdx];
    if (!state) { this._finish(); return; }
    const elapsed = (now - this.stateStart) / 1000;
    const total = (now - this.startTime) / 1000;

    this._render(state.id, elapsed, state.dur, total);

    if (elapsed >= state.dur) {
      this.stateIdx++;
      this.stateStart = now;
      if (this.stateIdx >= INTRO_STATES.length) { this._finish(); return; }
    }
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _render(stateId, t, dur, total) {
    const root = this.root;
    if (!root) return;
    const textEl = root.querySelector('#intro-text');
    const yearEl = root.querySelector('#intro-year');
    const eventEl = root.querySelector('#intro-event');
    const titleEl = root.querySelector('#intro-title');
    const subEl = root.querySelector('#intro-subtitle');
    const factionEl = root.querySelector('#intro-faction');
    const mapEl = root.querySelector('#intro-mapzoom');
    const battleCv = root.querySelector('#intro-battle');

    // 统一隐藏各状态专属层
    if (stateId !== 'factionShowcase') factionEl.style.display = 'none';
    if (stateId !== 'mapZoom') mapEl.style.display = 'none';
    if (stateId !== 'prologueBattle') battleCv.style.display = 'none';

    if (stateId === 'black') {
      textEl.style.opacity = '0';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      subEl.style.opacity = '0';
      root.style.opacity = '1';
    } else if (stateId === 'narration') {
      // 打字机效果：dur 秒打完旁白
      const fullText = this._narration;
      const chars = Math.floor((t / dur) * fullText.length);
      textEl.textContent = fullText.slice(0, chars);
      textEl.style.opacity = '1';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
    } else if (stateId === 'timeline') {
      textEl.style.opacity = '0';
      // 年份从 yearFrom 滚动到 yearTo
      const year = Math.round(this._yearFrom + (t / dur) * (this._yearTo - this._yearFrom));
      yearEl.textContent = year;
      yearEl.style.opacity = '1';
      // 找当前最近的事件
      let currentEvent = '';
      let nearestDiff = Infinity;
      for (const e of TIMELINE_EVENTS) {
        const diff = Math.abs(e.year - year);
        if (diff < nearestDiff) { nearestDiff = diff; currentEvent = e.text; }
      }
      eventEl.textContent = currentEvent;
      eventEl.style.opacity = '1';
      titleEl.style.opacity = '0';
    } else if (stateId === 'factionShowcase') {
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      textEl.style.opacity = '0';
      factionEl.style.display = 'flex';
      // 6 个势力，每个 (dur/6) 秒闪现一个
      const seg = dur / FACTION_FLASH.length;
      const idx = Math.min(FACTION_FLASH.length - 1, Math.floor(t / seg));
      const f = FACTION_FLASH[idx];
      const localT = (t - idx * seg) / seg; // 0~1
      factionEl.innerHTML = `
        <div class="faction-banner" style="border-color:${f.color};opacity:${Math.min(1, localT * 2)}">
          <div class="faction-flag" style="background:${f.color}"></div>
          <div class="faction-name" style="color:${f.color}">${f.name}</div>
          <div class="faction-desc">${f.desc}</div>
        </div>
      `;
    } else if (stateId === 'mapZoom') {
      factionEl.style.display = 'none';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      textEl.style.opacity = '0';
      mapEl.style.display = 'block';
      // 地图从全局（scale 1）缩放到主角势力（scale 3.2）
      const p = Math.min(1, t / dur);
      this._mapZoomPct = p;
      const globe = mapEl.querySelector('#intro-globe');
      const spot = mapEl.querySelector('#intro-spot');
      if (globe) {
        const scale = 1 + p * 2.2;
        globe.style.transform = `scale(${scale})`;
        globe.style.opacity = String(0.4 + p * 0.6);
      }
      if (spot) {
        // 主角势力高亮圈随缩放放大再收缩
        const r = 20 + p * 60;
        spot.style.width = r + 'px';
        spot.style.height = r + 'px';
        spot.style.opacity = String(0.3 + p * 0.5);
      }
    } else if (stateId === 'protagonist') {
      mapEl.style.display = 'none';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      textEl.style.opacity = '1';
      // 主角选择提示（打字机）
      const protText = '四方群雄，皆可称孤道寡。\n择一明主，承继大统，开万世之业。';
      const chars = Math.floor((t / dur) * protText.length);
      textEl.textContent = protText.slice(0, chars);
      textEl.style.whiteSpace = 'pre-line';
    } else if (stateId === 'prologueBattle') {
      textEl.style.opacity = '0';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      battleCv.style.display = 'block';
      this._renderBattle(battleCv, t, dur);
    } else if (stateId === 'title') {
      mapEl.style.display = 'none';
      battleCv.style.display = 'none';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      textEl.style.opacity = '0';
      // 主标题从模糊到清晰
      const prog = t / dur;
      titleEl.style.opacity = Math.min(1, prog * 1.5);
      titleEl.style.filter = `blur(${(1 - Math.min(1, prog * 1.5)) * 20}px)`;
      titleEl.style.transform = `scale(${1 + (1 - Math.min(1, prog)) * 0.3})`;
      subEl.style.opacity = '0';
    } else if (stateId === 'subtitle') {
      titleEl.style.opacity = '1';
      titleEl.style.filter = 'blur(0)';
      titleEl.style.transform = 'scale(1)';
      subEl.style.opacity = '1';
    } else if (stateId === 'fadeout') {
      root.style.opacity = String(1 - t / dur);
    }
  }

  // 序幕战斗剪影：canvas 绘制两列剪影交错 + 粒子尘烟
  _renderBattle(cv, t, dur) {
    const w = cv.width = window.innerWidth;
    const h = cv.height = window.innerHeight;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const p = Math.min(1, t / dur);
    // 地平线剪影
    ctx.fillStyle = 'rgba(10,10,18,0.85)';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    // 双方旗帜剪影（左右交错推进）
    const march = p * w * 0.3;
    ctx.fillStyle = '#1a1a26';
    for (let i = 0; i < 12; i++) {
      const bx = w * 0.2 + i * 30 - march * 0.4;
      const by = h * 0.6 + (i % 3) * 4;
      // 人影剪影
      ctx.fillRect(bx, by - 40, 8, 40);
      ctx.beginPath();
      ctx.arc(bx + 4, by - 46, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const bx = w * 0.8 - i * 30 + march * 0.4;
      const by = h * 0.6 + (i % 3) * 4;
      ctx.fillStyle = '#221a1a';
      ctx.fillRect(bx, by - 40, 8, 40);
      ctx.beginPath();
      ctx.arc(bx + 4, by - 46, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 粒子尘烟（碰撞区域）
    const cx = w / 2 + Math.sin(p * Math.PI) * w * 0.05;
    const cy = h * 0.6;
    if (Math.random() < 0.6) {
      this._particles.push({
        x: cx + (Math.random() - 0.5) * 120,
        y: cy - Math.random() * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.2 - 0.5,
        life: 1.0,
        size: 2 + Math.random() * 3
      });
    }
    this._particles = this._particles.filter(pt => pt.life > 0);
    for (const pt of this._particles) {
      pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.02;
      ctx.fillStyle = `rgba(180,150,110,${pt.life * 0.6})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 中央血日
    const sunR = 60 + Math.sin(p * Math.PI) * 10;
    const grad = ctx.createRadialGradient(w / 2, h * 0.35, 5, w / 2, h * 0.35, sunR);
    grad.addColorStop(0, 'rgba(200,60,40,0.8)');
    grad.addColorStop(1, 'rgba(200,60,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.35, sunR, 0, Math.PI * 2);
    ctx.fill();
  }

  _finish() {
    if (this.skipped) return;
    this.skipped = true;
    this._cleanup();
    markIntroCompleted();
    this.onComplete();
  }
}
