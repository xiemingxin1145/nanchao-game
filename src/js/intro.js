// ============================================================
// intro.js — V3.5 开场演出
// ------------------------------------------------------------
// 技术参考：
// 1) 状态机开场：INTRO_STATES 数组按顺序播放，每个状态有持续时间，
//    用 requestAnimationFrame 驱动状态切换；任意键/点击跳过。
//    参考：Godot / Unity 开场 cutscene 状态机实现。
// 2) 打字机效果：setInterval 逐字追加文本，3 秒打完。
// 3) Ken Burns 效果：CSS transform scale + translate 缓慢变化，
//    模拟镜头缓慢推进。
// 4) 年份滚动：用插值动画把 534→589 快速滚动，伴随关键事件闪现。
// ============================================================

import { markIntroCompleted } from './ngplus.js';

const INTRO_STATES = [
  { id: 'black',      dur: 1.0 },   // 黑屏 1s
  { id: 'text',       dur: 3.0 },   // 历史背景文字 3s
  { id: 'timeline',   dur: 5.0 },   // 时代变迁 5s
  { id: 'title',      dur: 3.0 },   // 主标题 3s
  { id: 'subtitle',   dur: 1.0 },   // 副标题 1s
  { id: 'fadeout',    dur: 1.0 }    // 渐隐 1s
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

export class IntroPlayer {
  // onComplete: 演出结束回调；onSkip: 跳过回调
  constructor(opts = {}) {
    this.onComplete = opts.onComplete || (() => {});
    this.onSkip = opts.onSkip || null;
    this.root = null;
    this.rafId = null;
    this.startTime = 0;
    this.stateIdx = 0;
    this.stateStart = 0;
    this.skipped = false;
    this._keyHandler = null;
    this._clickHandler = null;
  }

  // 创建全屏 intro 容器并播放
  play() {
    this.root = document.createElement('div');
    this.root.id = 'intro-screen';
    this.root.innerHTML = `
      <div class="intro-bg kenburns"></div>
      <div class="intro-overlay"></div>
      <div class="intro-content">
        <div class="intro-text" id="intro-text"></div>
        <div class="intro-year" id="intro-year">534</div>
        <div class="intro-event" id="intro-event"></div>
        <h1 class="intro-title" id="intro-title">南北朝</h1>
        <p class="intro-subtitle" id="intro-subtitle">—— 乱世英雄起四方 ——</p>
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

    // 初始隐藏所有元素
    if (stateId === 'black') {
      textEl.style.opacity = '0';
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
      titleEl.style.opacity = '0';
      subEl.style.opacity = '0';
      root.style.opacity = '1';
    } else if (stateId === 'text') {
      // 打字机效果：3 秒打完
      const fullText = '公元534年，北魏分裂为东西二魏。' +
        '此后四十余载，江南江北，干戈不息。' +
        '英雄并起，豪杰争锋，天下大势，分合无常。';
      const chars = Math.floor((t / dur) * fullText.length);
      textEl.textContent = fullText.slice(0, chars);
      textEl.style.opacity = '1';
      yearEl.style.opacity = '0';
      titleEl.style.opacity = '0';
    } else if (stateId === 'timeline') {
      textEl.style.opacity = '0';
      // 年份从 534 滚动到 589
      const year = Math.round(534 + (t / dur) * (589 - 534));
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
    } else if (stateId === 'title') {
      yearEl.style.opacity = '0';
      eventEl.style.opacity = '0';
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

  _finish() {
    if (this.skipped) return;
    this.skipped = true;
    this._cleanup();
    markIntroCompleted();
    this.onComplete();
  }
}
