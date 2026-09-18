// ============================================================
// ui.js — UI 渲染、面板、弹窗、交互（表现层强化版）  [V8.1]
// V8.1：数字滚动 easeOutCubic + 红绿闪烁 / 通用 Tooltip / 面板过渡动画 /
//       顶部通知横幅 / 武将卡片微交互 + 负伤暗角 / 事件抉择结果弹窗。
// ============================================================
import { FACTIONS, SEASONS, SEASON_ICON, UNIT_TYPES, IMG, CITY_LINKS, TERRAIN, SCENARIOS, DEFAULT_SCENARIO, GENERALS, TAX_LEVELS, CORVEE_TYPES, EXAM_SUBJECTS, SOLAR_TERMS, HAREM_RANKS, ADVANCEMENT_TREE } from './data.js';
// V14.0「霸业宏图」：武将养成 / 装备 / 技能树 所需数据
import { getItem, RARITIES, EQUIP_SLOTS } from './equipment.js';
import { getSkill } from './skills.js';
import { Game } from './game.js';
import { IsometricMap } from './map.js';
import { saveGame, loadGame, hasSave, getSaveInfo, getCurrentNGPlusLevel } from './save.js';
import { AudioManager } from './audio.js';
import { Tutorial } from './tutorial.js';
import { Animator } from './animation.js';
import { IntroPlayer } from './intro.js';
import { isIntroCompleted, markIntroCompleted, loadNGPlusData } from './ngplus.js';
import { TITLES, MAX_ACTIVE_TITLES } from './titles.js';
import { ACH_CATEGORIES, getAchievementPoints, getAchievementTier } from './achievements.js';
import { BGM_INFO } from './audio.js';
import { GAME_GUIDE, TUTORIAL_CHAPTERS } from './tutorial.js';
import { OFFICES, TITLES as RANKS, getOffice } from './office.js'; // V7.0 官职爵位
import { FORMATIONS, availableFormations, maxFormationLevel } from './formation.js'; // V9.0 阵法
import { computeSupplyStatus } from './supply.js'; // V17.0 补给状态（军队面板深化）
import { formatPlayTime } from './stats.js';
// V4.0: 模组系统
import { modManager } from './modding.js';
// V5.5: 局域网对战
import { LANManager, parseStateMessage, LAN_DEFAULTS } from './network.js';

export class UI {
  constructor() {
    this.game = null;
    this.map = null;
    this.container = document.getElementById('app');
    this.modalQueue = [];
    this.audio = new AudioManager();
    this.tutorial = new Tutorial(this);
    this._prevRes = { money: null, food: null, army: null };
    this._prevSeason = null;
    this._pendingTechId = null;
    this._battleMode = 'old';   // 'old' | 'multi'
    this._boundGlobal = false;
    // ---- 战斗动画状态 ----
    this._battleAnim = null;     // 多回合战斗动画循环状态
    this._oldBattleAnim = null;  // 旧版战报动画状态
    this._prevAttTroops = null;
    this._prevDefTroops = null;
    // ---- V5.5 局域网对战状态 ----
    this.lan = new LANManager();
    this._lanScenario = DEFAULT_SCENARIO;
    this._lanHostFaction = null;
    this._lanBoundKeys = false;  // 键盘快捷键是否已绑定
  }

  // ---------- 启动 ----------
  async start() {
    this._installGlobalAudio();
    // V4.0: 先加载模组数据（异步），再初始化游戏
    try {
      await modManager.loadMods('mods/');
      Game.applyMods();
    } catch (e) {
      console.warn('[UI] 模组加载失败，使用基础数据', e);
    }
    // V3.5：首次启动播放开场演出
    if (!isIntroCompleted()) {
      this._playIntro();
    } else {
      this.showMainMenu();
    }
    // 隐藏 loading 卷轴
    const ls = document.getElementById('loading-screen');
    if (ls) setTimeout(() => ls.classList.add('hide'), 500);
  }

  // V3.5：播放开场演出（V16.0：委托给史诗长卷版开场演出）
  _playIntro() {
    if (typeof this._playIntroV16 === 'function') { this._playIntroV16(); return; }
    const intro = new IntroPlayer({
      onComplete: () => this.showMainMenu(),
      onSkip: () => this.showMainMenu()
    });
    intro.play();
  }

  // V3.5：从主菜单重看开场
  _replayIntro() {
    this._playIntro();
  }

  // 全局：首次点击解锁音频 + 按钮悬停/点击音
  _installGlobalAudio() {
    if (this._boundGlobal) return;
    this._boundGlobal = true;
    document.addEventListener('click', (e) => {
      this.audio.resume();
      const t = e.target;
      if (t && t.closest && t.closest('.btn-ancient, .btn-small, .btn-icon, .tech-tab, .faction-card')) {
        this.audio.playClick();
      }
    });
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('.btn-ancient, .btn-small, .btn-icon')) {
        const now = performance.now();
        if (!this._lastHover || now - this._lastHover > 450) {
          this._lastHover = now;
          this.audio.playHover();
        }
      }
    });
  }

  // ---------- 主菜单 ----------
  showMainMenu() {
    // V13.0：清掉上一次主菜单的 Canvas 粒子循环与视差监听，避免泄漏
    this._v13StopMenuParticles();
    const ngLevel = getCurrentNGPlusLevel();
    // V7.5：生成 10 个金色飘浮粒子（萤火虫/星光）
    const particles = Array.from({ length: 10 }, (_, i) => {
      const left = Math.random() * 100;
      const top = 20 + Math.random() * 70;
      const dx = (Math.random() - 0.5) * 80;
      const dy = -30 - Math.random() * 60;
      const dur = 6 + Math.random() * 8;
      const delay = Math.random() * 6;
      return `<span class="menu-particle" style="left:${left}%;top:${top}%;` +
        `--dx:${dx}px;--dy:${dy}px;--dur:${dur}s;--delay:${delay}s"></span>`;
    }).join('');
    this.container.innerHTML = `
      <div class="main-menu v13-main-menu">
        <div class="title-screen v13-title-screen">
          <img src="${IMG.titleBg}" class="title-bg kenburns" onerror="this.style.display='none'">
          <!-- V13.0：Canvas 古风粒子背景（花瓣/墨点/星光），全屏层 -->
          <canvas class="v13-menu-canvas"></canvas>
          <div class="menu-particles">${particles}</div>
          <div class="title-overlay v13-title-overlay">
            <h1 class="game-title title-glow v13-game-title v14-game-title">南北朝</h1>
            <p class="subtitle">—— 乱世英雄起四方 ——</p>
            ${ngLevel > 0 ? `<p class="ngplus-badge">当前周目：第 ${ngLevel} 周目</p>` : ''}
            <div class="menu-buttons v13-menu-buttons">
              <button class="btn-ancient v13-btn" id="btn-start">开始游戏</button>
              <button class="btn-ancient v13-btn v16-menu-btn" id="btn-campaign">战役模式</button>
              <button class="btn-ancient v13-btn v16-menu-btn" id="btn-ngplus">多周目</button>
              <button class="btn-ancient v13-btn" id="btn-load" ${hasSave() ? '' : 'disabled'}>读取存档</button>
              <button class="btn-ancient v13-btn" id="btn-mods">模组管理</button>
              <button class="btn-ancient v13-btn" id="btn-ach">成就</button>
              <button class="btn-ancient v13-btn" id="btn-codex">图鉴</button>
              <button class="btn-ancient v13-btn" id="btn-stats">统计</button>
              <button class="btn-ancient v13-btn" id="btn-tutorial">重看教程</button>
              <button class="btn-ancient v13-btn" id="btn-guide">游戏指南</button>
              <button class="btn-ancient v13-btn" id="btn-replay-intro">重看开场</button>
              <button class="btn-ancient v13-btn" id="btn-quit">退出</button>
            </div>
          </div>
          <div class="version-badge v13-version-badge v14-version-badge v15-version-badge v16-version-badge v17-version-badge">V17.0 · 血战沙场版</div>
        </div>
      </div>
    `;

    // V13.0：启动 Canvas 粒子背景 + 视差滚动 + 按钮涟漪
    this._v13StartMenuParticles();
    this._v13BindMenuParallax();
    this._v13BindRipple();

    document.getElementById('btn-start').onclick = () => this.showModeSelect();
    // V16.0：战役模式 / 多周目 入口
    const v16CampBtn = document.getElementById('btn-campaign');
    if (v16CampBtn) v16CampBtn.onclick = () => this.showCampaignSelectV16();
    const v16NgBtn = document.getElementById('btn-ngplus');
    if (v16NgBtn) v16NgBtn.onclick = () => this.showNGPlusV16();
    document.getElementById('btn-tutorial').onclick = () => this.showTutorialSettingsV16();
    document.getElementById('btn-guide').onclick = () => this.openGameGuide();
    document.getElementById('btn-replay-intro').onclick = () => this._replayIntro();
    document.getElementById('btn-stats').onclick = () => this.showStatsPanel();
    document.getElementById('btn-mods').onclick = () => this.showModPanel();
    // V14.0：主菜单「成就」「图鉴」入口
    const mmAch = document.getElementById('btn-ach');
    if (mmAch) mmAch.onclick = () => { if (this.game) this.showAchievements(); else this.toast('开始游戏后可查看成就'); };
    const mmCodex = document.getElementById('btn-codex');
    if (mmCodex) mmCodex.onclick = () => this.showCodex();
    document.getElementById('btn-load').onclick = () => {
      const g = loadGame();
      if (g) {
        this.game = g;
        this.game.state = 'playing';
        this.initGameUI();
      }
    };
    document.getElementById('btn-quit').onclick = () => {
      if (window.electronAPI) window.electronAPI.quitGame();
      else window.close();
    };
    // V3.5：主菜单 BGM
    try { this.audio.resume(); this.audio.switchBGM('menu'); } catch (e) {}
  }

  // ============================================================
  // V13.0 主菜单视觉增强：Canvas 粒子背景 / 视差 / 按钮涟漪
  // 性能保护：粒子数 ≤50，requestAnimationFrame 驱动，页面隐藏自动暂停
  // ============================================================

  // 启动主菜单 Canvas 古风粒子背景
  _v13StartMenuParticles() {
    const canvas = this.container.querySelector('.v13-menu-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    // 尺寸跟随窗口
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };
    resize();
    this._v13MenuResize = () => resize();
    window.addEventListener('resize', this._v13MenuResize);

    // 粒子类型：0=花瓣(飘落) 1=墨点(漂移) 2=星光(闪烁)
    const MAX = 50; // 粒子上限
    const parts = [];
    const spawn = (warm) => {
      const roll = Math.random();
      const type = roll < 0.4 ? 0 : (roll < 0.7 ? 1 : 2);
      return {
        type,
        x: Math.random() * canvas.width,
        // 暖机时随机散布，避免开场粒子从同一处冒出
        y: warm ? Math.random() * canvas.height : (type === 0 ? -10 : Math.random() * canvas.height),
        vx: type === 0 ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 0.3,
        vy: type === 0 ? 0.5 + Math.random() * 0.6 : (Math.random() - 0.5) * 0.25,
        size: type === 0 ? 3 + Math.random() * 3 : (type === 1 ? 1.5 + Math.random() * 2 : 1 + Math.random() * 1.5),
        alpha: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        sway: Math.random() * 0.5 + 0.3
      };
    };
    for (let i = 0; i < MAX; i++) parts.push(spawn(true));

    let rafId = 0;
    let running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = now / 1000;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.phase += dt;
        // 花瓣：左右摇摆下落；墨点：缓慢漂移；星光：闪烁
        p.x += (p.vx + Math.sin(p.phase * p.sway) * 0.3) * (dt * 60);
        p.y += p.vy * (dt * 60);
        // 出界回收
        if (p.y > canvas.height + 12 || p.x < -12 || p.x > canvas.width + 12) {
          parts[i] = spawn(false);
          continue;
        }
        if (p.type === 0) {
          // 花瓣：粉色半透明椭圆
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase) * 0.6);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = 'rgba(232, 150, 160, 0.85)';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 1) {
          // 墨点：深墨圆
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.7;
          ctx.fillStyle = 'rgba(30, 26, 22, 0.8)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // 星光：金色十字闪烁
          const tw = 0.5 + 0.5 * Math.sin(p.phase * 2.2);
          ctx.save();
          ctx.globalAlpha = p.alpha * tw;
          ctx.fillStyle = 'rgba(255, 224, 150, 0.95)';
          ctx.shadowColor = 'rgba(255, 215, 0, 0.9)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // 页面隐藏时暂停，可见时恢复（性能保护）
    this._v13VisHandler = () => {
      if (document.hidden) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', this._v13VisHandler);

    this._v13MenuAnim = { rafId, running };
  }

  // 停止主菜单 Canvas 粒子循环（离开主菜单时调用）
  _v13StopMenuParticles() {
    if (this._v13MenuAnim) {
      this._v13MenuAnim.running = false;
      if (this._v13MenuAnim.rafId) {
        try { cancelAnimationFrame(this._v13MenuAnim.rafId); } catch (e) {}
      }
      this._v13MenuAnim = null;
    }
    if (this._v13MenuResize) {
      window.removeEventListener('resize', this._v13MenuResize);
      this._v13MenuResize = null;
    }
    if (this._v13VisHandler) {
      document.removeEventListener('visibilitychange', this._v13VisHandler);
      this._v13VisHandler = null;
    }
    if (this._v13ParallaxHandler) {
      const sc = this.container.querySelector('.v13-title-screen');
      if (sc) sc.removeEventListener('mousemove', this._v13ParallaxHandler);
      this._v13ParallaxHandler = null;
    }
  }

  // 主菜单视差：鼠标移动时背景层/画布/前景轻微反向偏移
  _v13BindMenuParallax() {
    const sc = this.container.querySelector('.v13-title-screen');
    if (!sc) return;
    const bg = sc.querySelector('.title-bg');
    const cv = sc.querySelector('.v13-menu-canvas');
    const ov = sc.querySelector('.v13-title-overlay');
    let raf = 0;
    this._v13ParallaxHandler = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = sc.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 ~ 0.5
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        // 背景偏移最大 14px，画布 8px，前景 4px（越远移动越多，营造层次）
        if (bg) bg.style.translate = `${(-nx * 14).toFixed(1)}px ${(-ny * 10).toFixed(1)}px`;
        if (cv) cv.style.translate = `${(-nx * 8).toFixed(1)}px ${(-ny * 6).toFixed(1)}px`;
        if (ov) ov.style.translate = `${(nx * 4).toFixed(1)}px ${(ny * 3).toFixed(1)}px`;
      });
    };
    sc.addEventListener('mousemove', this._v13ParallaxHandler);
  }

  // 古风按钮点击涟漪效果
  _v13BindRipple() {
    if (this._v13RippleBound) return; // 容器元素复用，避免重复绑定监听器
    this._v13RippleBound = true;
    this.container.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.v13-btn');
      if (!btn || btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const rip = document.createElement('span');
      rip.className = 'v13-ripple';
      const size = Math.max(rect.width, rect.height) * 2;
      rip.style.width = rip.style.height = size + 'px';
      rip.style.left = (e.clientX - rect.left - size / 2) + 'px';
      rip.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 700);
    });
  }

  // V13.0：战斗伤害飘字（DOM 浮字）。kind: 'dmg' | 'crit' | 'heal'
  _spawnDamageFloat(arena, sideBox, amount, kind) {
    if (!arena || !sideBox || !amount) return;
    const float = document.createElement('div');
    float.className = 'v13-dmg-float v13-dmg-' + kind;
    const sign = kind === 'heal' ? '+' : '-';
    float.textContent = kind === 'crit' ? `暴击 ${amount}` : `${sign}${amount}`;
    const boxRect = sideBox.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    // 定位到武将立绘上方
    float.style.left = (boxRect.left - arenaRect.left + boxRect.width * 0.3) + 'px';
    float.style.top = (boxRect.top - arenaRect.top - 6) + 'px';
    arena.appendChild(float);
    setTimeout(() => float.remove(), 1100);
  }

  // V13.0：战斗结算动态特效（胜利金色粒子爆发 / 失败灰色余烬）
  _v13BattleResultFX(modal, win, draw) {
    if (!modal) return;
    const fx = document.createElement('div');
    fx.className = win ? 'v13-result-fx v13-fx-win' : (draw ? 'v13-result-fx v13-fx-draw' : 'v13-result-fx v13-fx-lose');
    const n = win ? 26 : 16;
    let html = '';
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100;
      const delay = (Math.random() * 0.6).toFixed(2);
      const dur = (1.6 + Math.random() * 1.6).toFixed(2);
      const size = (3 + Math.random() * 5).toFixed(1);
      html += `<span class="v13-fx-p" style="left:${left}%;--fx-dur:${dur}s;--fx-delay:${delay}s;--fx-size:${size}px"></span>`;
    }
    fx.innerHTML = html;
    modal.appendChild(fx);
  }

  // V13.0：顶栏资源浮动提示（+金钱/-粮食 等）
  _spawnResourceFloat(targetEl, delta, label) {
    if (!targetEl || !delta) return;
    const wrap = targetEl.parentElement;
    if (!wrap) return;
    wrap.style.position = wrap.style.position || 'relative';
    const fl = document.createElement('span');
    fl.className = 'v13-res-float ' + (delta > 0 ? 'v13-res-up' : 'v13-res-down');
    fl.textContent = `${delta > 0 ? '+' : ''}${delta} ${label || ''}`;
    const rect = targetEl.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    fl.style.left = (rect.left - wrapRect.left + rect.width / 2 - 10) + 'px';
    fl.style.top = '2px';
    wrap.appendChild(fl);
    setTimeout(() => fl.remove(), 1100);
  }

  // V3.5：统计面板（主菜单入口）
  showStatsPanel() {
    // 如果有进行中的游戏，用游戏内统计；否则用全局存档统计
    const stats = this.game ? this.game.getStats() : null;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let rows = '';
    if (stats) {
      rows = `
        <div class="stats-section"><h3>本局统计</h3>
          <div class="stats-row"><span>回合数</span><b>${stats.currentTurn}</b></div>
          <div class="stats-row"><span>战斗/胜利/胜率</span><b>${stats.battles} / ${stats.victories} / ${stats.winRate}%</b></div>
          <div class="stats-row"><span>杀敌/损兵</span><b>${stats.kills} / ${stats.losses}</b></div>
          <div class="stats-row"><span>占领城市/最大城市</span><b>${stats.citiesConquered} / ${stats.maxCities}</b></div>
          <div class="stats-row"><span>招募武将</span><b>${stats.recruited}</b></div>
          <div class="stats-row"><span>建造建筑</span><b>${stats.buildingsBuilt}</b></div>
          <div class="stats-row"><span>研究科技</span><b>${stats.researched}</b></div>
          <div class="stats-row"><span>触发事件</span><b>${stats.eventsTriggered}</b></div>
          <div class="stats-row"><span>当前金钱/粮草</span><b>${stats.currentMoney} / ${stats.currentFood}</b></div>
        </div>`;
    } else {
      rows = '<p class="hint">暂无游戏统计数据，开始一局游戏后可查看详细统计。</p>';
    }
    modal.innerHTML = `
      <div class="modal stats-modal">
        <h2 class="modal-title">游戏统计</h2>
        ${rows}
        <button class="btn-ancient" style="margin-top:14px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // V4.0: 模组管理面板
  showModPanel() {
    const modList = modManager.getModList();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let modRows = '';
    if (modList.length === 0) {
      modRows = '<p class="hint">未发现模组文件。将 JSON 模组文件放入 mods/ 目录后重启游戏即可加载。</p>';
    } else {
      modRows = modList.map(m => `
        <div class="mod-item" data-mod-id="${m.id}">
          <div class="mod-header">
            <h3 style="color:${m.enabled ? '#4CAF50' : '#888'}">${m.name}</h3>
            <label class="mod-toggle">
              <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="window.__ui_.toggleMod('${m.id}', this.checked)">
              <span>${m.enabled ? '已启用' : '已禁用'}</span>
            </label>
          </div>
          <p class="mod-meta">v${m.version} · ${m.author}</p>
          <p class="mod-desc">${m.description}</p>
          ${m.loadError ? `<p class="mod-error">加载错误: ${m.loadError}</p>` : ''}
        </div>
      `).join('');
    }
    modal.innerHTML = `
      <div class="modal mods-modal">
        <h2 class="modal-title">模组管理</h2>
        <p class="hint" style="margin-bottom:12px">启用/禁用模组后需重启游戏生效。模组文件位于 <code>mods/</code> 目录。</p>
        ${modRows}
        <button class="btn-ancient" style="margin-top:14px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // V4.0: 切换模组启用状态
  toggleMod(modId, enabled) {
    modManager.setModEnabled(modId, enabled);
    // 刷新面板显示
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    this.showModPanel();
  }
  _replayTutorial() {
    this.game = new Game();
    this.game.initGame('nanchao');
    this.initGameUI();
    this.tutorial.restart();
  }

  // V5.0：开始游戏 → 模式选择（单人 / 热座多人 / 局域网对战）
  showModeSelect() {
    const lanAvailable = this.lan.isAvailable();
    this.container.innerHTML = `
      <div class="mode-select">
        <h2 class="panel-title">—— 选择游戏模式 ——</h2>
        <div class="mode-cards">
          <div class="mode-card" id="mode-single">
            <h3>单人模式</h3>
            <p class="mode-desc">你操控一方势力，其余由 AI 执政。逐鹿天下，问鼎九州。</p>
          </div>
          <div class="mode-card" id="mode-hotseat">
            <h3>热座多人模式</h3>
            <p class="mode-desc">2~6 名玩家同坐一机，轮流操控不同势力。
              每位玩家结束回合后切换视角，私密信息互不窥探。</p>
          </div>
          <div class="mode-card ${lanAvailable ? '' : 'disabled'}" id="mode-lan">
            <h3>局域网对战</h3>
            <p class="mode-desc">${lanAvailable
              ? '两台电脑通过局域网连线，各控一方势力。主机权威结算，客机镜像同步。支持文字聊天。'
              : '局域网对战需在桌面版（Electron）中运行。当前环境不可用。'}</p>
          </div>
        </div>
        <button class="btn-ancient" id="btn-back-menu2">返回</button>
      </div>
    `;
    document.getElementById('mode-single').onclick = () => this.showFactionSelect({ hotSeat: false });
    document.getElementById('mode-hotseat').onclick = () => this.showFactionSelect({ hotSeat: true });
    const lanCard = document.getElementById('mode-lan');
    if (lanAvailable) {
      lanCard.onclick = () => this.showLanSetup();
    }
    document.getElementById('btn-back-menu2').onclick = () => this.showMainMenu();
  }

  // ============================================================
  // V5.5 局域网对战：设置界面（主机/客机）
  // ============================================================
  showLanSetup() {
    const port = LAN_DEFAULTS.port;
    this.container.innerHTML = `
      <div class="lan-setup">
        <h2 class="panel-title">—— 局域网对战 ——</h2>
        <div class="lan-cards">
          <div class="mode-card" id="lan-host">
            <h3>创建主机</h3>
            <p class="mode-desc">创建房间并监听端口 <b>${port}</b>。
              客机连接你的 IP 后开始。主机先选势力，为权威服务器。</p>
            <button class="btn-ancient" id="lan-host-btn">创建主机</button>
          </div>
          <div class="mode-card" id="lan-join">
            <h3>加入游戏</h3>
            <p class="mode-desc">输入主机的局域网 IP 地址，连接后等待主机开局。</p>
            <div class="lan-join-form">
              <input type="text" id="lan-ip" placeholder="主机 IP（如 192.168.1.100）" value="127.0.0.1">
              <input type="number" id="lan-port" placeholder="端口" value="${port}" min="1024" max="65535">
              <button class="btn-ancient" id="lan-join-btn">连接</button>
            </div>
          </div>
        </div>
        <div class="lan-status" id="lan-status"></div>
        <button class="btn-ancient" id="btn-back-lan">返回</button>
      </div>
    `;

    this._bindLanEvents();
    document.getElementById('btn-back-lan').onclick = () => this.showModeSelect();
    document.getElementById('lan-host-btn').onclick = () => this._lanCreateHost();
    document.getElementById('lan-join-btn').onclick = () => {
      const ip = document.getElementById('lan-ip').value.trim();
      const p = parseInt(document.getElementById('lan-port').value, 10) || port;
      this._lanJoinClient(ip, p);
    };
  }

  _bindLanEvents() {
    // 防止重复绑定
    if (this._lanBound) return;
    this._lanBound = true;
    const status = () => document.getElementById('lan-status');
    this.lan.onStatusChange = (evt) => {
      const el = status();
      if (!el) return;
      switch (evt.type) {
        case 'listening':
          el.innerHTML = `<span class="lan-ok">✓ 主机已启动，监听端口 ${evt.data.port}，等待客机连接…</span>`;
          break;
        case 'connected':
        case 'client-connected':
          el.innerHTML = `<span class="lan-ok">✓ 已连接！等待选择势力…</span>`;
          if (this.lan.isHost) this._lanHostChooseFaction();
          else this._lanClientChooseFaction();
          break;
        case 'disconnected':
        case 'client-disconnect':
          el.innerHTML = `<span class="lan-err">✗ 连接已断开</span>`;
          break;
        case 'error':
          el.innerHTML = `<span class="lan-err">✗ 错误：${evt.data}</span>`;
          break;
        case 'timeout':
          el.innerHTML = `<span class="lan-err">✗ 网络超时（${evt.data.after}ms 无响应），已断开</span>`;
          break;
      }
    };
    this.lan.onMessage = (msg) => this._lanHandleMessage(msg);
  }

  _lanCreateHost() {
    const r = this.lan.host(LAN_DEFAULTS.port);
    const el = document.getElementById('lan-status');
    if (el) el.innerHTML = r.ok ? '<span class="lan-info">正在启动主机…</span>' : `<span class="lan-err">${r.msg}</span>`;
  }

  _lanJoinClient(ip, port) {
    const r = this.lan.join(ip, port);
    const el = document.getElementById('lan-status');
    if (el) el.innerHTML = r.ok ? '<span class="lan-info">正在连接主机…</span>' : `<span class="lan-err">${r.msg}</span>`;
  }

  // ---- 主机选择势力（剧本 + 势力）----
  _lanHostChooseFaction() {
    const sc = SCENARIOS[this._lanScenario] || SCENARIOS[DEFAULT_SCENARIO];
    const factions = sc.factions.map(id => FACTIONS[id]).filter(Boolean);
    this.container.innerHTML = `
      <div class="faction-select lan-select">
        <h2 class="panel-title">—— 主机：选择你的势力 ——</h2>
        <div class="scenario-tabs">
          ${Object.values(SCENARIOS).map(s => `
            <button class="scenario-tab ${s.id === this._lanScenario ? 'active' : ''}" data-sc="${s.id}">
              <b>${s.name}</b><small>${s.year}年</small>
            </button>
          `).join('')}
        </div>
        <p class="scenario-desc hint">${sc.description}</p>
        <p class="hint" style="color:#E8D5A3">你先选。客机将从剩余势力中选择。</p>
        <div class="faction-cards" id="lan-faction-cards">
          ${factions.map(f => `
            <div class="faction-card" data-fid="${f.id}">
              <div class="faction-color-bar" style="background:${f.color}"></div>
              <h3 style="color:${f.color}">${f.name}</h3>
              <p class="faction-desc">${f.description}</p>
              <p class="faction-bonus"><b>特色：</b>${f.bonus}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.querySelectorAll('.scenario-tab').forEach(tab => {
      tab.onclick = () => { this._lanScenario = tab.dataset.sc; this._lanHostChooseFaction(); };
    });
    document.querySelectorAll('#lan-faction-cards .faction-card').forEach(card => {
      card.onclick = () => {
        const fid = card.dataset.fid;
        // 通知客机主机选了哪个势力 + 剧本
        this.lan.send({ type: 'handshake', hostFaction: fid, scenarioId: this._lanScenario });
        this._lanStartHostGame(fid);
      };
    });
  }

  // ---- 主机开局（自己选完，等客机选）----
  _lanStartHostGame(hostFid) {
    this.game = new Game();
    this.game.netRole = 'host';
    this._lanHostFaction = hostFid;
    // 主机先用自己势力初始化游戏（客机选完后再补客机势力）
    this.game.initGame(hostFid, this._lanScenario);
    // 等待客机 factionPick 消息后再开始游戏 UI
    this.toast('已选势力，等待客机选择…');
  }

  // ---- 客机选择势力 ----
  _lanClientChooseFaction() {
    // 客机已经收到 handshake 消息（含 hostFaction / scenarioId），在 _lanHandleMessage 里记录
    const hostFid = this._lanHostFaction; // 由 handshake 填入
    const scId = this._lanScenario;
    const sc = SCENARIOS[scId] || SCENARIOS[DEFAULT_SCENARIO];
    const avail = sc.factions.filter(id => id !== hostFid);
    const factions = avail.map(id => FACTIONS[id]).filter(Boolean);
    this.container.innerHTML = `
      <div class="faction-select lan-select">
        <h2 class="panel-title">—— 客机：选择你的势力 ——</h2>
        <p class="hint">主机已选择：<b style="color:${FACTIONS[hostFid] ? FACTIONS[hostFid].color : '#fff'}">${FACTIONS[hostFid] ? FACTIONS[hostFid].name : hostFid}</b></p>
        <p class="hint" style="color:#E8D5A3">请从剩余势力中选择一方。</p>
        <div class="faction-cards">
          ${factions.map(f => `
            <div class="faction-card" data-fid="${f.id}">
              <div class="faction-color-bar" style="background:${f.color}"></div>
              <h3 style="color:${f.color}">${f.name}</h3>
              <p class="faction-desc">${f.description}</p>
              <p class="faction-bonus"><b>特色：</b>${f.bonus}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.querySelectorAll('.faction-card').forEach(card => {
      card.onclick = () => {
        const fid = card.dataset.fid;
        this.lan.send({ type: 'factionPick', factionId: fid });
        this._lanStartClientGame(fid, hostFid, scId);
      };
    });
  }

  _lanStartClientGame(clientFid, hostFid, scId) {
    this.game = new Game();
    this.game.netRole = 'client';
    this.game.netOpponentFaction = clientFid;
    // 客机先用自己势力初始化占位，等主机广播初始状态
    this.game.initGame(clientFid, scId);
    this.initGameUI();
    this._showLanOverlay('等待主机开局…');
  }

  // ---- 主机收到客机 factionPick → 正式开局并广播初始状态 ----
  _lanHostStartGame(clientFid) {
    const hostFid = this._lanHostFaction;
    // 重新初始化：把客机势力加入 humanFactions（类似热座，但走网络）
    this.game = new Game();
    this.game.netRole = 'host';
    this.game.netOpponentFaction = clientFid;
    this.game.initGame(hostFid, this._lanScenario);
    this.initGameUI();
    // 广播初始状态，轮到主机
    this._lanBroadcastState('host');
    this._showLanOverlay('');
    this.toast('客机已加入！轮到你行动。');
  }

  // ---- 广播完整状态到对方 ----
  _lanBroadcastState(yourTurn) {
    if (!this.game) return;
    this.lan.sendState(this.game.serialize(), yourTurn);
  }

  // ---- 统一处理收到的网络消息 ----
  _lanHandleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'handshake':
        // 客机收到：主机的势力 + 剧本
        this._lanHostFaction = msg.hostFaction;
        this._lanScenario = msg.scenarioId || DEFAULT_SCENARIO;
        break;
      case 'factionPick':
        // 主机收到：客机选了势力
        if (this.lan.isHost) this._lanHostStartGame(msg.factionId);
        break;
      case 'state': {
        // 双方收到：完整状态快照
        const snap = parseStateMessage(msg);
        if (snap && this.game) {
          this.game.applyNetworkState(snap, msg.yourTurn);
          this.refreshUI();
          if (this.map) { this.map.dirty = true; this.map.render(); }
          this._updateMapMarker();
          if (msg.yourTurn === (this.lan.isHost ? 'host' : 'client')) {
            this._showLanOverlay('');
            this.toast('轮到你行动！');
          } else {
            this._showLanOverlay('等待对方行动…');
          }
        }
        break;
      }
      case 'endTurn':
        // 主机收到客机的结束回合：执行结算并广播
        if (this.lan.isHost && this.game) {
          this.game.endTurn();
          this._lanBroadcastState('host');
          this.refreshUI();
          if (this.map) { this.map.dirty = true; this.map.render(); }
          this._updateMapMarker();
          this._showLanOverlay('');
        }
        break;
      case 'chat':
        this._lanAppendChat(msg.from, msg.text);
        break;
      case 'disconnected':
      case 'bye':
        this._showLanOverlay('对方已断开连接');
        break;
      case 'ping':
        this.lan.send({ type: 'pong', timestamp: Date.now() });
        break;
    }
  }

  // ---- 局域网覆盖层（等待/断开提示）----
  _showLanOverlay(text) {
    let ov = document.getElementById('lan-overlay');
    if (!text) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'lan-overlay';
      ov.className = 'lan-overlay';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="lan-overlay-card">${text}</div>`;
  }

  // ---- 聊天 ----
  _showLanChatPanel() {
    let modal = document.getElementById('lan-chat-modal');
    if (modal) { modal.remove(); return; }
    modal = document.createElement('div');
    modal.id = 'lan-chat-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal lan-chat-modal">
        <h2 class="modal-title">💬 对战聊天</h2>
        <div class="lan-chat-log" id="lan-chat-log"></div>
        <div class="lan-chat-input-row">
          <input type="text" id="lan-chat-input" placeholder="输入消息…" maxlength="120">
          <button class="btn-ancient" id="lan-chat-send">发送</button>
        </div>
        <button class="btn-ancient" style="margin-top:10px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    // 渲染历史
    const logEl = document.getElementById('lan-chat-log');
    if (logEl) logEl.innerHTML = this.lan._chatLog.map(c =>
      `<div class="lan-chat-line"><b style="color:${c.from === 'host' ? '#C07840' : '#4A90D9'}">${c.from === 'host' ? '主机' : '客机'}:</b> ${this._escHtml(c.text)}</div>`
    ).join('');
    const send = () => {
      const inp = document.getElementById('lan-chat-input');
      if (!inp || !inp.value.trim()) return;
      this.lan.sendChat(inp.value.trim());
      inp.value = '';
    };
    document.getElementById('lan-chat-send').onclick = send;
    document.getElementById('lan-chat-input').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }

  _lanAppendChat(from, text) {
    this.lan._chatLog.push({ from, text });
    if (this.lan._chatLog.length > 200) this.lan._chatLog.shift();
    const logEl = document.getElementById('lan-chat-log');
    if (logEl) {
      const div = document.createElement('div');
      div.className = 'lan-chat-line';
      div.innerHTML = `<b style="color:${from === 'host' ? '#C07840' : '#4A90D9'}">${from === 'host' ? '主机' : '客机'}:</b> ${this._escHtml(text)}`;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  _escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // V7.5：都城 ID → 中文名
  _capitalName(cid) {
    const map = { jiankang: '建康', yecheng: '邺城', changan: '长安', luoyang: '洛阳',
                  jinyang: '晋阳', jiangling: '江陵', yingcheng: '郢城', yuzhou: '豫州',
                  pingcheng: '平城', chengdu: '成都', guangzhou: '广州' };
    return map[cid] || cid;
  }

  // ---------- 势力选择（含剧本选择 / 热座多选） ----------
  // opts: { hotSeat:boolean, scenario?:string }
  showFactionSelect(opts = {}) {
    const hotSeat = !!opts.hotSeat;
    let scenarioId = opts.scenario || DEFAULT_SCENARIO;
    const render = () => {
      const sc = SCENARIOS[scenarioId] || SCENARIOS[DEFAULT_SCENARIO];
      // 剧本激活的势力卡片
      const activeFactions = sc.factions.map(id => FACTIONS[id]).filter(Boolean);
      const ngLevel = getCurrentNGPlusLevel();
      const ngBonus = (!hotSeat && ngLevel > 0) ? `
        <div class="ngplus-banner">◆ 周目继承：第 ${ngLevel} 周目 ◆<br>
          <small>AI兵力+${ngLevel*10}% · AI经济+${ngLevel*5}% · 继承武将忠诚+20</small>
        </div>` : '';
      this.container.innerHTML = `
        <div class="faction-select">
          <h2 class="panel-title">—— ${hotSeat ? '热座多人 · 选择执政势力' : '选择你的霸业'} ——</h2>
          ${ngBonus}
          <!-- 剧本选择 -->
          <div class="scenario-tabs">
            ${Object.values(SCENARIOS).map(s => `
              <button class="scenario-tab ${s.id === scenarioId ? 'active' : ''}" data-sc="${s.id}">
                <b>${s.name}</b><small>${s.year}年</small>
              </button>
            `).join('')}
          </div>
          <p class="scenario-desc hint">${sc.description}</p>
          ${hotSeat ? '<p class="hint" style="color:#E8D5A3">勾选 2~6 个由人类操控的势力，其余自动由 AI 执政。</p>' : ''}
          <div class="faction-cards" id="faction-cards">
            ${activeFactions.map(f => {
              // V7.5：难度星级（按初始城市数估算，城多=简单）
              const cityCount = (f.startCities || []).length;
              const diff = cityCount >= 8 ? 2 : cityCount >= 4 ? 3 : 4;
              const stars = '★'.repeat(diff) + '<span class="star-dim">' + '★'.repeat(5 - diff) + '</span>';
              // V7.5：该势力前3位核心武将头像预览
              const topGens = GENERALS.filter(g => g.faction === f.id).slice(0, 3);
              const genThumbs = topGens.map(g =>
                `<img class="gen-thumb" src="${IMG.portrait(g.portrait || g.id)}" title="${g.name}" onerror="this.style.display='none'">`
              ).join('');
              // V10.5：初始城市数 / 武将数 / 兵力（按每城初始驻军估算）
              const genCount = GENERALS.filter(g => g.faction === f.id).length;
              const estTroops = cityCount * 3000;
              return `
              <div class="faction-card ${hotSeat ? 'multi-select' : ''}" data-fid="${f.id}">
                ${hotSeat ? '<div class="multi-check">□</div>' : ''}
                <div class="faction-color-bar" style="background:${f.color}"></div>
                <h3 style="color:${f.color}">${f.name}</h3>
                <p class="faction-capital">都城：${this._capitalName(f.capital)}</p>
                <p class="faction-stars">难度 ${stars}</p>
                <p class="faction-desc">${f.description}</p>
                <p class="faction-bonus"><b>特色：</b>${f.bonus}</p>
                <p class="faction-stats">🏙 ${cityCount} 城 · ⚔ ${genCount} 将 · 🛡 约 ${(estTroops/10000).toFixed(1)} 万兵</p>
                <div class="faction-generals-preview">${genThumbs}</div>
              </div>`;
            }).join('')}
          </div>
          ${hotSeat ? `<button class="btn-ancient" id="btn-hotseat-start" disabled>开始热座（已选 <span id="hs-count">0</span> 方）</button>` : ''}
          <button class="btn-ancient" id="btn-back-menu">返回</button>
        </div>
      `;

      // 剧本切换
      document.querySelectorAll('.scenario-tab').forEach(tab => {
        tab.onclick = () => { scenarioId = tab.dataset.sc; render(); };
      });
      document.getElementById('btn-back-menu').onclick = () =>
        hotSeat ? this.showModeSelect() : this.showMainMenu();

      const selected = new Set();
      document.querySelectorAll('#faction-cards .faction-card').forEach(card => {
        card.onclick = () => {
          const fid = card.dataset.fid;
          if (!hotSeat) {
            // 单人：直接开局
            this.game = new Game();
            this.game.initGame(fid, scenarioId);
            this.initGameUI();
            if (!Tutorial.isDone()) setTimeout(() => this.tutorial.start(), 600);
            return;
          }
          // 热座：多选
          if (selected.has(fid)) {
            selected.delete(fid);
            card.classList.remove('selected');
            card.querySelector('.multi-check').textContent = '□';
          } else {
            if (selected.size >= 6) { this.toast('最多选择 6 个人类势力'); return; }
            selected.add(fid);
            card.classList.add('selected');
            card.querySelector('.multi-check').textContent = '■';
          }
          document.getElementById('hs-count').textContent = selected.size;
          const startBtn = document.getElementById('btn-hotseat-start');
          startBtn.disabled = !(selected.size >= 2 && selected.size <= 6);
        };
      });
      if (hotSeat) {
        document.getElementById('btn-hotseat-start').onclick = () => {
          const humans = [...selected];
          if (humans.length < 2) return;
          this.game = new Game();
          // 第一个选择的势力为首回合行动方
          this.game.initGame(humans[0], scenarioId, humans);
          this.initGameUI();
          // 热座开局：先请首位玩家就位
          setTimeout(() => this._showPlayerTransition(true), 300);
        };
      }
    };
    render();
  }

  // ---------- 游戏主界面 ----------
  initGameUI() {
    // V13.0：离开主菜单，停止 Canvas 粒子循环与视差监听
    this._v13StopMenuParticles();
    const myFac = FACTIONS[this.game.playerFaction];
    this.container.innerHTML = `
      <div class="game-screen">
        <!-- 顶部栏 -->
        <div class="top-bar">
          <div class="top-item faction-title-click" id="top-faction" title="点击查看势力情报">
            <b style="color:${myFac.color}">${myFac.name}</b>
          </div>
          <div class="top-item">回合 <b id="hdr-turn">1</b></div>
          <div class="top-item" id="era-wrap" title="点击查看王朝"> <b id="hdr-era" class="era-click">—</b></div>
          <div class="top-item" title="正统性">正统 <b id="hdr-legit" style="color:#e8c060">0</b>
            <span class="legit-bar-wrap"><span class="legit-bar-fill" id="hdr-legit-bar" style="width:0%"></span></span>
          </div>
          <div class="top-item">季节 <b id="hdr-season">春</b></div>
          <div class="top-item" id="hdr-solar-wrap" title="点击查看历法节气">节气 <b id="hdr-solar" class="era-click">立春</b></div>
          <div class="top-item" title="昼夜时辰">时辰 <b id="hdr-hour">午</b></div>
          <div class="top-item"><span class="res-icon">金</span><b id="hdr-money">0</b></div>
          <div class="top-item"><span class="res-icon">粮</span><b id="hdr-food">0</b></div>
          <div class="top-item"><span class="res-icon">兵</span><b id="hdr-army">0</b></div>
          <div class="top-item" title="点击查看军团">军团 <b id="hdr-legion" class="era-click">0</b></div>
          <div class="top-item">民心 <b id="hdr-morale">60</b></div>
          <div class="top-bar-btns">
            <button class="btn-icon" id="btn-mute" title="静音">🔊</button>
            <button class="btn-icon" id="btn-music" title="乐府·音乐">🎵</button>
            <button class="btn-icon" id="btn-tech" title="科技树">📜</button>
            <button class="btn-icon" id="btn-legion" title="军团会战">⚔</button>
            <button class="btn-icon" id="btn-ach" title="成就">🏆</button>
            <button class="btn-icon" id="btn-stats" title="统计">📊</button>
            ${this.game.netRole ? '<button class="btn-icon" id="btn-lan-chat" title="聊天">💬</button>' : ''}
            <button class="btn-small" id="btn-dynasty" title="王朝/禅让">王朝</button>
            <button class="btn-small" id="btn-office" title="官职/爵位">官职</button>
            <button class="btn-small" id="btn-trade" title="贸易商路">贸易</button>
            <button class="btn-small" id="btn-exam" title="科举取士">科举</button>
            <button class="btn-small" id="btn-calendar" title="历法节气/天文">历法</button>
            <button class="btn-small" id="btn-harem" title="后宫/皇室/子嗣">后宫</button>
            <button class="btn-small" id="btn-save">存档</button>
            <button class="btn-small" id="btn-diplomacy">外交</button>
            <button class="btn-small" id="btn-espionage">谍报</button>
            <button class="btn-small" id="btn-religion">宗教</button>
            <button class="btn-small" id="btn-recruit">招募</button>
            <button class="btn-small" id="btn-menu">菜单</button>
          </div>
        </div>

        <!-- 主区域 -->
        <div class="main-area">
          <div class="map-container" id="map-container">
            <canvas id="game-canvas"></canvas>
          </div>
          <div class="right-panel" id="right-panel">
            <div class="panel-content" id="panel-content">
              <p class="hint">点击地图上的城市或军队查看详情</p>
            </div>
          </div>
        </div>

        <!-- 底部栏 -->
        <div class="bottom-bar">
          <div class="message-log" id="message-log"></div>
          <button class="btn-ancient btn-end-turn" id="btn-end-turn">结束回合</button>
        </div>
      </div>
    `;

    // 初始化地图
    const canvas = document.getElementById('game-canvas');
    this.map = new IsometricMap(canvas);
    this.map.game = this.game;
    this.map.onSelect = (sel) => this.handleMapSelect(sel);
    this.map.resize();
    this.map.startLoop(); // 启动待机动画渲染循环
    // V17.0：地图交互增强（缩放控件/搜索/小地图/双击/右键菜单）
    this._v17InitMapExtras(canvas);

    window.addEventListener('resize', () => { if (this.map) { this.map.resize(); this._updateMapMarker(); this._v17RenderMinimap(); } });

    // 绑定按钮
    document.getElementById('btn-end-turn').onclick = () => this.endTurn();
    document.getElementById('btn-save').onclick = () => {
      const r = saveGame(this.game);
      this.toast(r.msg);
    };
    document.getElementById('btn-diplomacy').onclick = () => this.showDiplomacyV15();
    const v15SpyBtn = document.getElementById('btn-espionage');
    if (v15SpyBtn) v15SpyBtn.onclick = () => this.showEspionagePanel();
    const v15RelBtn = document.getElementById('btn-religion');
    if (v15RelBtn) v15RelBtn.onclick = () => this.showReligionPanel();
    document.getElementById('btn-recruit').onclick = () => this.showRecruitPanel();
    document.getElementById('btn-menu').onclick = () => this.showSettings();
    document.getElementById('btn-tech').onclick = () => this.showTechTree();
    const legionBtn = document.getElementById('btn-legion');
    if (legionBtn) legionBtn.onclick = () => this.showLegionPanel();
    const legionHdr = document.getElementById('hdr-legion');
    if (legionHdr) legionHdr.onclick = () => this.showLegionPanel();
    document.getElementById('btn-ach').onclick = () => this.showAchievements();
    const muBtn = document.getElementById('btn-music');
    if (muBtn) muBtn.onclick = () => this.showMusicPanel();
    document.getElementById('btn-stats').onclick = () => this.showStatsPanel();
    document.getElementById('btn-mute').onclick = () => this.toggleMute();
    document.getElementById('top-faction').onclick = () => this.showFactionIntel();
    // V7.0：王朝/官职/贸易面板
    const bd = document.getElementById('btn-dynasty'); if (bd) bd.onclick = () => this.showDynastyPanel();
    const bo = document.getElementById('btn-office'); if (bo) bo.onclick = () => this.showOfficePanel();
    const bt = document.getElementById('btn-trade'); if (bt) bt.onclick = () => this.showTradePanel();
    const be = document.getElementById('btn-exam'); if (be) be.onclick = () => this.showExamPanel();
    const bc = document.getElementById('btn-calendar'); if (bc) bc.onclick = () => this.showCalendarPanel();
    const bh = document.getElementById('btn-harem'); if (bh) bh.onclick = () => this.showHaremPanel();
    const sw = document.getElementById('hdr-solar-wrap'); if (sw) sw.onclick = () => this.showCalendarPanel();
    const era = document.getElementById('era-wrap'); if (era) era.onclick = () => this.showDynastyPanel();
    const chatBtn = document.getElementById('btn-lan-chat');
    if (chatBtn) chatBtn.onclick = () => this._showLanChatPanel();

    // V5.5：键盘快捷键（空格=结束回合，ESC=关闭面板，1-6=快速切换面板）
    this._bindShortcuts();

    // V9.5：恢复音乐解锁/收藏状态，再启动大地图 BGM
    try { this.restoreMusicState(); } catch (e) {}
    try { this.audio.resume(); this.audio.switchBGM('map'); } catch (e) {}

    this._prevRes = { money: null, food: null, army: null };
    this._prevSeason = null;
    this.refreshUI();
  }

  // ---------- 静音切换 ----------
  toggleMute() {
    const muted = this.audio.toggleMute();
    const btn = document.getElementById('btn-mute');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', muted);
    }
    this.toast(muted ? '已静音' : '声音开启');
  }

  // ---------- 地图选中 ----------
  handleMapSelect(sel) {
    if (this.game.state !== 'playing') return;

    if (sel.army && sel.army.faction === this.game.playerFaction) {
      this.game.selectedArmy = sel.army.id;
      this.game.selectedCity = null;
      this.showArmyPanel(sel.army);
    } else if (sel.city) {
      this.game.selectedCity = sel.city.id;
      this.game.selectedArmy = null;
      this.showCityPanel(sel.city);
    } else {
      this.game.selectedCity = null;
      this.game.selectedArmy = null;
      document.getElementById('panel-content').innerHTML =
        '<p class="hint">点击地图上的城市或军队查看详情</p>';
    }
    this.map.render();
    this._updateMapMarker();
  }

  // 地图选中城市呼吸光晕
  _updateMapMarker() {
    let marker = document.getElementById('map-pulse-marker');
    const container = document.getElementById('map-container');
    if (!this.game || !this.map || !container) { if (marker) marker.remove(); return; }
    if (!this.game.selectedCity) { if (marker) marker.remove(); return; }
    const city = this.game.cities.get(this.game.selectedCity);
    if (!city) { if (marker) marker.remove(); return; }
    const pos = this.map.isoToScreen(city.isoX, city.isoY);
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'map-pulse-marker';
      marker.className = 'map-pulse-marker';
      container.appendChild(marker);
    }
    marker.style.left = pos.x + 'px';
    marker.style.top = pos.y + 'px';
  }

  // ---------- 城市面板 ----------
  showCityPanel(city) {
    const panel = document.getElementById('panel-content');
    const isMine = city.owner === this.game.playerFaction;
    const faction = city.owner ? FACTIONS[city.owner] : null;
    const mayor = city.mayor ? this.game.getGeneral(city.mayor) : null;
    const availableGenerals = isMine ?
      this.game.getFactionGenerals(this.game.playerFaction).filter(g => !g.inArmy && g.id !== city.mayor) : [];

    panel.innerHTML = `
      <div class="v13-city-card" style="--v13-faction:${faction ? faction.color : '#8B7A4A'}">
      <h3 class="panel-subtitle" style="border-left:4px solid ${faction ? faction.color : '#888'}">${city.name}</h3>
      <div class="stat-grid">
        <div class="stat-row"><span>归属</span><b style="color:${faction ? faction.color : '#888'}">${faction ? faction.name : '无主'}</b></div>
        <div class="stat-row"><span>人口</span><b>${city.pop}</b></div>
        <div class="stat-row"><span>农业</span><b>${city.agri}</b></div>
        <div class="stat-row"><span>商业</span><b>${city.comm}</b></div>
        <div class="stat-row"><span>防御</span><b>${city.defense}</b></div>
        <div class="stat-row"><span>繁荣</span><b>${city.prosperity}</b></div>
        <div class="stat-row"><span>民心</span><b style="color:${city.morale < 30 ? '#e05555' : city.morale > 70 ? '#55cc55' : '#e8d5a3'}">${Math.round(city.morale)}</b></div>
        <div class="stat-row"><span>税率</span><b>${city.taxRate}%</b></div>
        <div class="stat-row"><span>赋税</span><b class="tax-current lvl-${city.taxLevel||2}">${TAX_LEVELS[(city.taxLevel||2)-1]?.name || '正常'}</b></div>
        <div class="stat-row"><span>徭役</span><b>${city.corvee ? `${CORVEE_TYPES[city.corvee.type]?.name||''}(${city.corvee.turnsLeft}回合)` : '无'}</b></div>
        <div class="stat-row"><span>驻军</span><b>${city.garrison}</b></div>
        <div class="stat-row"><span>太守</span><b class="general-name-link" onclick="__ui_.showGeneralDetail('${city.mayor || ''}')">${mayor ? mayor.name : '空缺'}</b></div>
      </div>
      <div id="general-detail-slot"></div>
      ${isMine ? `
        <div class="action-buttons">
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','recruit_infantry')">征兵 步</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','recruit_cavalry')">征兵 骑</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','recruit_archer')">征兵 弓</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','agri')">发展农业</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','comm')">发展商业</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','repair')">修缮防御</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','tax_up')">税率+</button>
          <button class="btn-small" onclick="__ui_.cityAction('${city.id}','tax_down')">税率-</button>
          <button class="btn-small" onclick="__ui_.showTaxPanel()">赋税</button>
          <button class="btn-small" onclick="__ui_.showCorveePanel()">徭役</button>
          <!-- V14.0：内政总览 / 兵种进阶 入口 -->
          <button class="btn-small" onclick="__ui_.showInternalAffairs('${city.id}')">🏛 内政</button>
          <button class="btn-small" onclick="__ui_.showUnitAdvance('${city.id}')">🎖 进阶</button>
          ${availableGenerals.length > 0 ? `
            <select id="mayor-select" class="select-small">
              ${availableGenerals.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
            </select>
            <button class="btn-small" onclick="__ui_.assignMayor('${city.id}')">任命太守</button>
          ` : ''}
          <button class="btn-small" onclick="__ui_.createArmy('${city.id}')">组建军队</button>
        </div>
      ` : ''}
      </div>
    `;
  }

  cityAction(cityId, action) {
    const city = this.game.cities.get(cityId);
    if (!city) return;
    let result;
    switch (action) {
      case 'recruit_infantry':
        result = this.game.cityRecruit(cityId, 'infantry', 500);
        this.audio.playRecruit(); break;
      case 'recruit_cavalry':
        result = this.game.cityRecruit(cityId, 'cavalry', 200);
        this.audio.playRecruit(); break;
      case 'recruit_archer':
        result = this.game.cityRecruit(cityId, 'archer', 300);
        this.audio.playRecruit(); break;
      case 'agri':
        result = this.game.cityDevelopAgri(cityId);
        this.audio.playCoin(); break;
      case 'comm':
        result = this.game.cityDevelopComm(cityId);
        this.audio.playCoin(); break;
      case 'repair':
        result = this.game.cityRepair(cityId);
        this.audio.playCoin(); break;
      case 'tax_up':
        result = this.game.citySetTax(cityId, city.taxRate + 5);
        this.audio.playCoin(); break;
      case 'tax_down':
        result = this.game.citySetTax(cityId, city.taxRate - 5);
        this.audio.playCoin(); break;
    }
    if (result && result.msg) this.toast(result.msg);
    this.showCityPanel(city);
    this.refreshUI();
  }

  assignMayor(cityId) {
    const sel = document.getElementById('mayor-select');
    if (!sel) return;
    const result = this.game.cityAssignMayor(cityId, sel.value);
    this.toast(result.msg);
    const city = this.game.cities.get(cityId);
    this.showCityPanel(city);
  }

  createArmy(cityId) {
    const city = this.game.cities.get(cityId);
    const availableGenerals = this.game.getFactionGenerals(this.game.playerFaction)
      .filter(g => !g.inArmy);
    if (availableGenerals.length === 0) {
      this.toast('无可用武将');
      return;
    }
    const gen = availableGenerals[0];
    const troops = Math.min(gen.getMaxTroops(), city.garrison);
    if (troops < 500) {
      this.toast('驻军不足');
      return;
    }
    const result = this.game.createArmyFromGarrison(cityId, gen.id, troops);
    if (result.ok) {
      this.toast(`${gen.name} 起兵，兵力 ${troops}`);
      this.audio.playRecruit();
      this.game.selectedArmy = result.army.id;
      this.showArmyPanel(result.army);
    }
    this.refreshUI();
  }

  // ---------- 武将详情（雷达图 + 经验 + 技能） ----------
  showGeneralDetail(genId) {
    if (!genId) return;
    const gen = this.game.getGeneral(genId);
    if (!gen) return;
    const slot = document.getElementById('general-detail-slot');
    if (!slot) return;
    // 再次点击收起
    if (slot.dataset.open === genId) {
      slot.innerHTML = '';
      slot.dataset.open = '';
      return;
    }
    slot.dataset.open = genId;

    const level = gen.level || 1;
    const exp = gen.exp || 0;
    const expNeed = 100;
    const skills = Array.isArray(gen.skills) ? gen.skills : [];
    // V7.5：五维属性进度条（V13：动画填充）
    const aptBar = (label, val) => {
      const v = Math.max(0, Math.min(100, Math.round(val || 0)));
      return `<div class="apt-bar-wrap v13-apt-wrap"><span class="apt-label">${label}</span>` +
        `<span class="apt-track"><span class="apt-fill v13-apt-fill" style="width:${v}%"></span></span>` +
        `<span class="apt-val">${v}</span></div>`;
    };
    // V7.5：武将历史简介（按ID查找，50字以内）
    const intro = this._generalIntro(gen.id);
    // V8.1：负伤暗角
    const genWounded = (gen.wounded || 0) > 0;

    slot.innerHTML = `
      <div class="general-detail v13-gen-card panel-enter">
        <div class="portrait-anim-wrap gen-detail-portrait ${genWounded ? 'v81-wounded' : ''}" style="width:96px;height:128px;float:left;margin:0 10px 6px 0">
          <img src="${IMG.portrait(gen.portrait)}" class="gen-portrait portrait-anim" style="width:96px;height:128px;object-fit:cover" onerror="this.style.display='none'">
          ${genWounded ? '<div class="wounded-overlay"></div>' : ''}
        </div>
        <div style="font-size:15px;color:#FFD700" class="name-glow">${gen.name} <small style="color:#9A8B6A">Lv.${level}</small></div>
        <div class="general-meta-row"><span>身份</span><b>${gen.role}</b></div>
        <div class="general-meta-row"><span>官职</span><b style="color:#e8c060">${gen.office ? (getOffice(gen.office).name) : '—'}</b></div>
        <div class="general-meta-row"><span>爵位</span><b style="color:#c98be0">${gen.title ? (RANKS.find(t=>t.id===gen.title)||{}).name : '—'}</b></div>
        ${aptBar('统', gen.command)}
        ${aptBar('武', gen.force)}
        ${aptBar('智', gen.intel)}
        ${aptBar('政', gen.politics)}
        ${aptBar('忠', gen.loyalty)}
        <div class="radar-wrap"><canvas id="gen-radar" width="160" height="160"></canvas></div>
        <div class="exp-bar-label"><span>经验</span><b>${exp}/${expNeed}</b></div>
        <div class="exp-bar-wrap"><div class="exp-bar" style="width:${Math.min(100, exp / expNeed * 100)}%"></div></div>
        ${skills.length > 0 ? `<div class="skill-chips">${skills.map(s => `<span class="skill-chip">${typeof s === 'string' ? s : (s.name || '技能')}</span>`).join('')}</div>` : ''}
        ${this._renderGeneralTitles(gen)}
        ${intro ? `<p class="hint" style="margin-top:6px;font-size:11px;line-height:1.5">${intro}</p>` : ''}
        <!-- V14.0：武将养成 / 单挑 入口 -->
        <div class="v14-gen-entry">
          <button class="btn-small v14-btn-flat" onclick="__ui_.showGeneralGrowth('${gen.id}')">🎖 养成</button>
          <button class="btn-small v14-btn-flat" onclick="__ui_.showDuel('${gen.id}')">⚔ 单挑</button>
        </div>
      </div>
    `;
    const cv = document.getElementById('gen-radar');
    if (cv) this.drawRadar(cv, gen);
    // V8.1：技能图标 tooltip
    slot.querySelectorAll('.skill-chip').forEach(chip => {
      const s = [...skills].find(x => (typeof x === 'string' ? x : (x.name || '技能')) === chip.textContent.trim());
      this._bindTooltip(chip, () => {
        const desc = (s && typeof s === 'object' && (s.desc || s.description)) ? (s.desc || s.description) : '武将特技';
        return `<div class="v81-tip-title">${chip.textContent.trim()}</div><div class="v81-tip-line">${desc}</div>`;
      });
    });
  }

  // V7.5：武将历史简介（50字以内）
  _generalIntro(genId) {
    const intros = {
      chen_baxian: '陈朝开国之君，起于江东，定祸乱，建陈社稷。',
      wang_sengbian: '梁朝名将，与陈霸先共平侯景之乱，后为霸先所杀。',
      wei_rui: '梁朝儒将，善战有谋，钟离大捷以少胜多。',
      yang_kan: '梁朝猛将，善守城，侯景之乱中坚守台城。',
      chen_qian: '陈文帝，起自布衣，知民疾苦，治国清明。',
      chen_xu: '陈宣帝，太建北伐，一度收复淮南。',
      chen_qingzhi: '白袍统帅，七千白袍军北伐，四十七战皆捷。',
      wu_mingche: '陈朝名将，太建北伐主力，后吕梁兵败。',
      hou_andu: '陈朝猛将，从陈霸先定天下，性忠勇。',
      hou_zhen: '陈朝名将，治军严整，屡立战功。',
      zhang_zhaoda: '陈朝名将，平定湘郢，屡破周师。',
      hu_luguang: '北齐名将，落雕都督，守城百战百胜，后被冤杀。',
      gao_huan: '北齐神武帝，起于怀朔，挟魏帝令诸侯，奠定齐基。',
      gao_cheng: '北齐文襄帝，高欢长子，继父业，后遇刺。',
      gao_yang: '北齐文宣帝，代魏建齐，初期英明，后昏暴。',
      gao_yan: '北齐孝昭帝，在位短暂，文治尚可。',
      gao_zhan: '北齐武成帝，宠信奸佞，朝政渐坏。',
      gao_rui: '北齐宗室名将，宗室贤王，后被冤死。',
      gao_changgong: '兰陵王，戴面具冲阵，邙山大捷，后被鸩死。',
      gao_aocao: '北齐猛将，从高欢起义，勇冠三军。',
      duan_xiaoxian: '北齐名将，与斛律光并称，治军严明。',
      duan_shao: '北齐名将，善谋能战，镇守晋阳。',
      he_shikai: '北齐佞臣，和士开，宠信于齐后主。',
      wang_lin: '南朝忠臣之后，据郢州，志在匡复梁室。',
      xiao_mohe: '陈朝猛将，勇力过人，从吴明彻北伐。',
      xiao_zhuang: '南朝宗室，北齐所立的梁主。',
      xiao_cha: '后梁宣帝，附庸于西魏/北周。',
      xiao_kui: '后梁明帝，守江陵一隅。',
      li_hu: '北周开国功臣，八柱国之一，唐高祖李渊祖父。',
      yuwen_tai: '北周奠基人，据关中，创府兵制，行苏绰六条诏书。',
      yuwen_jue: '北周孝闵帝，代西魏建周。',
      yuwen_hu: '北周权臣，连废三帝，后被武帝诛。',
      yuwen_yong: '北周武帝，灭佛强国，灭北齐，统一北方。',
      yuwen_yu: '北周明帝，聪敏有器量，被宇文护毒杀。',
      yang_jian: '隋文帝，代周建隋，后灭陈统一全国。',
      yang_zhong: '北周名将，隋文帝之父，封隋国公。',
      yu_chijiong: '北周名将，后起兵反杨坚，败死。',
      dugu_xin: '北周名将，八柱国之一，三朝外戚。',
      wei_xiaokuan: '北周名将，玉璧守城战之名将。',
      wei_xuan: '北周将领。',
      li_bi: '北周名将，沙苑之战献计横击。',
      wang_xiong: '北周猛将，以忠勇闻。',
      pan_chuntuo: '北周猛将。',
      zhao_gui: '北周将领。',
      zhou_wenyuan: '北周将领。',
      yu_jin: '北周名将，于谨，破江陵，谋略过人。',
      du_sengming: '南陈水军将领。',
      fan_yi: '南朝文人，官员。',
      lei_cizong: '南陈将领。',
      ren_zhong: '南陈将领。',
      he_ruodun: '北周/隋名将，贺若敦。',
      hu_luxian: '北齐将领，斛律光之弟。',
      yuan_jingshan: '北齐/北周将领。',
      wang_cao: '北齐将领。',
      wang_lin: '南朝忠臣之后，据郢州抗陈。',
      shen_ke: '南陈将领。',
      hu_ruodun: '北周名将，善射。',
      pan_chuntuo: '北周猛将。',
    };
    return intros[genId] || '';
  }

  // V3.5：渲染武将称号区
  _renderGeneralTitles(gen) {
    if (!this.game || !this.game.unlockedTitles) return '';
    const unlocked = this.game.unlockedTitles[gen.id] || [];
    const active = this.game.activeTitles[gen.id] || [];
    if (unlocked.length === 0) return '<div class="titles-row"><span class="hint">暂无称号</span></div>';
    const chips = unlocked.map(tid => {
      const t = TITLES.find(x => x.id === tid);
      if (!t) return '';
      const isActive = active.includes(tid);
      return `<span class="title-chip ${isActive ? 'equipped' : ''}" 
        onclick="__ui_.toggleTitle('${gen.id}','${tid}')" title="${t.desc}">
        ${t.name}
      </span>`;
    }).join('');
    return `<div class="titles-row"><span class="titles-label">称号(${active.length}/${MAX_ACTIVE_TITLES}):</span>${chips}</div>`;
  }

  // V3.5：切换称号装备
  toggleTitle(generalId, titleId) {
    if (typeof this.game.equipTitleOnGeneral !== 'function') return;
    const r = this.game.equipTitleOnGeneral(generalId, titleId);
    this.toast(r.msg);
    // 重新渲染武将详情
    this.showGeneralDetail(generalId);
  }

  // 五边形雷达图（统帅/武力/智力/政治/忠诚）
  drawRadar(canvas, gen) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 18;
    const labels = ['统帅', '武力', '智力', '政治', '忠诚'];
    const vals = [
      (gen.command || 0) / 100,
      (gen.force || 0) / 100,
      (gen.intel || 0) / 100,
      (gen.politics || 0) / 100,
      (gen.loyalty || 0) / 100
    ];
    const n = 5;
    ctx.clearRect(0, 0, W, H);
    const pt = (i, r) => {
      const ang = -Math.PI / 2 + (Math.PI * 2 * i) / n;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    };
    // 背景网格
    ctx.strokeStyle = 'rgba(196,165,90,0.4)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [x, y] = pt(i % n, (R * ring) / 3);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 轴线
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    }
    // 数值多边形
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const v = Math.max(0.05, Math.min(1, vals[i % n]));
      const [x, y] = pt(i % n, R * v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 标签
    ctx.fillStyle = '#C8B890';
    ctx.font = '11px "STSong", serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, R + 12);
      ctx.fillText(labels[i], x, y + 3);
    }
  }

  // ---------- 军队面板 ----------
  showArmyPanel(army) {
    const panel = document.getElementById('panel-content');
    const gen = this.game.getGeneral(army.generalId);
    const city = this.game.cities.get(army.cityId);

    panel.innerHTML = `
      <h3 class="panel-subtitle" style="border-left:4px solid ${FACTIONS[army.faction].color}">
        <span class="general-name-link" onclick="__ui_.showGeneralDetail('${army.generalId || ''}')">${gen ? gen.name : '军队'}</span>
      </h3>
      <div class="stat-grid">
        <div class="stat-row"><span>兵力</span><b>${army.troops}</b></div>
        <div class="stat-row"><span>所在</span><b>${city ? city.name : '未知'}</b></div>
        <div class="stat-row"><span>状态</span><b>${army.hasMoved ? '已行动' : '可行动'}</b></div>
      </div>
      <div id="general-detail-slot"></div>
      ${gen ? `
        <div class="stat-grid" style="margin-top:8px">
          <div class="stat-row"><span>统帅</span><b>${gen.command}</b></div>
          <div class="stat-row"><span>武力</span><b>${gen.force}</b></div>
          <div class="stat-row"><span>智力</span><b>${gen.intel}</b></div>
          <div class="stat-row"><span>忠诚</span><b>${Math.round(gen.loyalty)}</b></div>
        </div>
      ` : ''}
      <!-- V17.0：军队信息深化（士气/阵型/兵种/补给/天气修正/武将详情/战斗预览） -->
      ${this._v17ArmyDeepHTML(army, gen, city)}
      <div class="action-buttons">
        ${this._legionButtons(army)}
        ${!army.hasMoved ? `
          ${(CITY_LINKS[army.cityId] || []).map(targetId => {
            const target = this.game.cities.get(targetId);
            if (!target) return '';
            const isFriendly = target.owner === army.faction;
            const isNeutral = target.owner === null;
            return `<button class="btn-small" onclick="__ui_.armyMove('${army.id}','${targetId}')">
              ${isFriendly ? '→' : ''}${isNeutral ? '占' : '攻'} ${target.name}
            </button>`;
          }).join('')}
        ` : '<p class="hint">本回合已行动</p>'}
        ${(gen && Array.isArray(gen.skills) && gen.skills.length > 0) ?
          gen.skills.map((s, i) => {
            const sid = typeof s === 'string' ? s : (s.id || 'skill_' + i);
            const sname = typeof s === 'string' ? s : (s.name || s);
            return `<button class="btn-small" onclick="__ui_.useArmySkill('${army.id}','${sid}')">✦ ${sname}</button>`;
          }).join('') : ''}
        <button class="btn-small" onclick="__ui_.disbandArmy('${army.id}')">解散</button>
      </div>
    `;
  }

  // ---- V9.0：军团编制按钮组（嵌入军队面板）----
  _legionButtons(army) {
    if (!army || army.faction !== this.game.playerFaction) return '';
    const L = army.legionId ? this.game.legions.get(army.legionId) : null;
    if (L) {
      const fmName = (FORMATIONS[L.formation] || {}).name || L.formation;
      return `
        <div class="legion-tag">隶属【${L.name}】｜军团长：${this._genName(L.commanderId)}｜总兵 ${L.totalTroops(this.game.armies)}｜${fmName} ${L.formationLevel}级</div>
        <button class="btn-small" onclick="__ui_.showLegionDetail('${L.id}')">⚔ 军团详情/阵法</button>
        <button class="btn-small" onclick="__ui_.leaveLegion('${L.id}','${army.id}')">脱离军团</button>
      `;
    }
    return `<button class="btn-small" onclick="__ui_.formLegion('${army.id}')">编为军团</button>`;
  }

  _genName(gid) { const g = this.game.generals.get(gid); return g ? g.name : '—'; }

  // 编为军团
  formLegion(armyId) {
    const r = this.game.createLegionFromArmy(armyId, null);
    if (!r.ok) { this.toast(r.msg); return; }
    this.audio && this.audio.playEvent && this.audio.playEvent();
    const army = this.game.armies.find(a => a.id === armyId);
    if (army) this.showArmyPanel(army);
    this.refreshUI();
  }
  // 加入军团（同城其他军队）
  joinLegion(legionId, armyId) {
    const r = this.game.addToLegion(legionId, armyId);
    this.toast(r.msg);
    const army = this.game.armies.find(a => a.id === armyId);
    if (army) this.showArmyPanel(army);
    this.refreshUI();
  }
  leaveLegion(legionId, armyId) {
    const r = this.game.removeFromLegion(legionId, armyId);
    this.toast(r.msg);
    const army = this.game.armies.find(a => a.id === armyId);
    if (army) this.showArmyPanel(army);
    this.refreshUI();
  }
  disbandLegionUI(legionId) {
    const r = this.game.disbandLegionById(legionId);
    this.toast(r.msg);
    this.showLegionPanel();
    this.refreshUI();
  }
  setLegionFormationUI(legionId, fmId) {
    const r = this.game.setLegionFormation(legionId, fmId);
    this.toast(r.msg);
    this.showLegionDetail(legionId);
    this.refreshUI();
  }
  upgradeLegionFormationUI(legionId) {
    const r = this.game.upgradeLegionFormationLevel(legionId);
    this.toast(r.msg);
    this.showLegionDetail(legionId);
    this.refreshUI();
  }

  // 军团总览面板
  showLegionPanel() {
    const panel = document.getElementById('panel-content');
    const myLegions = this.game.getFactionLegions(this.game.playerFaction);
    const myArmies = this.game.getFactionArmies(this.game.playerFaction);
    const freeArmies = myArmies.filter(a => !a.legionId && a.troops >= 1500);
    let html = `<h3 class="panel-subtitle" style="border-left:4px solid #6B3FA0">⚔ 军团会战</h3>`;
    html += `<p class="hint">最多 5 支同势力军队合编一军团，总兵力上限 50000。双方军团同驻一城且总兵≥10000 触发大会战。</p>`;
    if (!myLegions.length) {
      html += `<p class="hint">尚无军团。在军队面板点击「编为军团」起编。</p>`;
    } else {
      html += `<div class="legion-list">`;
      for (const L of myLegions) {
        const total = L.totalTroops(this.game.armies);
        html += `<div class="legion-card">
          <b>${L.name}</b>（${L.size()}军 / ${total}人）<br/>
          军团长：${this._genName(L.commanderId)}｜${(FORMATIONS[L.formation]||{}).name||L.formation} ${L.formationLevel}级｜胜 ${L.wins}/${L.battles}<br/>
          <button class="btn-small" onclick="__ui_.showLegionDetail('${L.id}')">详情/阵法</button>
          <button class="btn-small" onclick="__ui_.disbandLegionUI('${L.id}')">解散</button>
        </div>`;
      }
      html += `</div>`;
    }
    // 可编入的自由军队
    if (freeArmies.length) {
      html += `<h4>可编军团的军队：</h4>`;
      for (const a of freeArmies) {
        const g = this.game.generals.get(a.generalId);
        html += `<div class="stat-row"><span>${g ? g.name : '军'}（${a.troops}人）</span>
          <button class="btn-small" onclick="__ui_.formLegion('${a.id}')">编军团</button></div>`;
      }
    }
    panel.innerHTML = html;
  }

  // 单个军团详情：阵法选择/升级/编入军队
  showLegionDetail(legionId) {
    const panel = document.getElementById('panel-content');
    const L = this.game.legions.get(legionId);
    if (!L) { this.showLegionPanel(); return; }
    const techs = this.game.techs || [];
    const total = L.totalTroops(this.game.armies);
    const avail = availableFormations(techs);
    const maxLv = maxFormationLevel(L.formation, techs);
    let html = `<h3 class="panel-subtitle" style="border-left:4px solid #6B3FA0">⚔ ${L.name}</h3>`;
    html += `<div class="stat-grid">
      <div class="stat-row"><span>军团长</span><b>${this._genName(L.commanderId)}</b></div>
      <div class="stat-row"><span>副将</span><b>${L.lieutenantIds.map(g=>this._genName(g)).join('、')||'—'}</b></div>
      <div class="stat-row"><span>总兵力</span><b>${total}</b></div>
      <div class="stat-row"><span>战绩</span><b>${L.wins}胜/${L.battles}战</b></div>
      <div class="stat-row"><span>经验</span><b>${Math.floor(L.exp)}</b></div>
      <div class="stat-row"><span>当前阵型</span><b>${(FORMATIONS[L.formation]||{}).name||L.formation} ${L.formationLevel}级（上限${maxLv}）</b></div>
    </div>`;
    // 阵型选择
    html += `<h4>选择阵型：</h4><div class="formation-grid">`;
    for (const fid of avail) {
      const f = FORMATIONS[fid];
      const cur = fid === L.formation;
      html += `<button class="btn-small ${cur?'fm-active':''}" title="${f.description}"
        onclick="__ui_.setLegionFormationUI('${L.id}','${fid}')">${f.name}${cur?' ●':''}</button>`;
    }
    html += `</div>`;
    // 升级
    html += `<div class="action-buttons">
      <button class="btn-small" onclick="__ui_.upgradeLegionFormationUI('${L.id}')">升级阵型（需经验+金钱）</button>
    </div>`;
    // 可编入同城军队
    const freeInCity = this.game.getFactionArmies(this.game.playerFaction)
      .filter(a => !a.legionId && a.cityId === L.cityId && a.troops >= 1000);
    if (freeInCity.length) {
      html += `<h4>同城可编入：</h4>`;
      for (const a of freeInCity) {
        const g = this.game.generals.get(a.generalId);
        html += `<div class="stat-row"><span>${g?g.name:'军'}（${a.troops}人）</span>
          <button class="btn-small" onclick="__ui_.joinLegion('${L.id}','${a.id}')">编入</button></div>`;
      }
    }
    panel.innerHTML = html;
  }

  // 会战结果全屏战报
  showLegionBattle(result) {
    if (!result) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay legion-battle-overlay';
    const win = result.attackerWin && !result.draw;
    const title = win ? '★ 大会战大捷！' : (result.draw ? '两军相持' : '大会战失利…');
    let phaseHtml = result.phases.map(p =>
      `<div class="lb-phase lb-${p.phase}"><b>${p.name}</b>：${p.text}</div>`).join('');
    let counterHtml = (result.counterNote || []).map(c =>
      `<div class="lb-counter">${c}</div>`).join('');
    overlay.innerHTML = `
      <div class="modal-card legion-battle-card">
        <h2 class="lb-title">${title}</h2>
        <div class="lb-vs">
          <div class="lb-side"><b>${result.attackerCommander}</b><br/>攻方战力 ${result.attackerPower}<br/>余 ${result.attackerRemain} 人</div>
          <div class="lb-vs-vs">VS</div>
          <div class="lb-side"><b>${result.defenderCommander}</b><br/>守方战力 ${result.defenderPower}<br/>余 ${result.defenderRemain} 人</div>
        </div>
        ${counterHtml}
        <div class="lb-phases">${phaseHtml}</div>
        <div class="lb-summary">我方损 ${result.attackerLoss}，敌损 ${result.defenderLoss}</div>
        <button class="btn-ancient" onclick="__ui_.closeLegionBattle(this)">收兵</button>
      </div>`;
    document.body.appendChild(overlay);
    try { this.audio && this.audio.switchBGM && this.audio.switchBGM('battle'); } catch(e){}
    // V9.0：会战粒子特效（列阵→交锋→决战→追击）
    try {
      const cv = document.getElementById('game-canvas');
      if (this.map && this.map.animator && cv) {
        this.map.animator.playLegionBattleFX(cv.width/2, cv.height/2, cv.width, cv.height);
      }
    } catch(e){}
  }
  closeLegionBattle(btn) {
    const ov = btn.closest('.legion-battle-overlay');
    if (ov) ov.remove();
    this.game.activeLegionBattle = null;
    this.map && this.map.render();
    this.refreshUI();
  }

  useArmySkill(armyId, skillId) {
    if (typeof this.game.useSkill !== 'function') {
      this.toast('技能系统尚未开放');
      return;
    }
    try {
      const r = this.game.useSkill(armyId, skillId);
      if (r && r.msg) this.toast(r.msg);
      this.audio.playEvent();
      const army = this.game.armies.find(a => a.id === armyId);
      if (army) this.showArmyPanel(army);
      this.refreshUI();
    } catch (e) { this.toast('技能使用失败'); }
  }

  armyMove(armyId, targetCityId) {
    const result = this.game.moveArmy(armyId, targetCityId);
    if (!result.ok) {
      this.toast(result.msg);
    } else if (result.result) {
      // 优先多回合战斗界面
      if (typeof this.game.getBattleState === 'function') {
        const st = this.game.getBattleState();
        if (st) { this.showMultiBattle(); return; }
      }
      this.showBattleModal(result.result);
    }
    // V9.0：军团大会战战报
    if (result.legionBattle) {
      setTimeout(() => this.showLegionBattle(result.legionBattle), 200);
    }
    const army = this.game.armies.find(a => a.id === armyId);
    if (army) this.showArmyPanel(army);
    this.map.render();
    this._updateMapMarker();
    this.refreshUI();
  }

  disbandArmy(armyId) {
    this.game.disbandArmy(armyId);
    document.getElementById('panel-content').innerHTML = '<p class="hint">军队已解散</p>';
    this.refreshUI();
  }

  // ============================================================
  // 多回合战斗界面
  // ============================================================
  showMultiBattle() {
    const st = typeof this.game.getBattleState === 'function' ? this.game.getBattleState() : null;
    if (!st) return;
    this._battleMode = 'multi';
    this.audio.playBattle();

    // 战斗插画背景
    const terrain = (st.terrain) || 'plain';
    const sceneKey = terrain === 'river' ? 'river_battle'
      : (st.siege || (st.cityName && st.defender && st.defender.troops !== undefined)) ? 'city_siege'
      : 'cavalry_charge';

    let modal = document.getElementById('battle-modal-root');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'battle-modal-root';
      document.body.appendChild(modal);
    }
    this._renderBattleShell(modal, st, sceneKey);
    this._startBattleAnim(st);
    this._prevAttTroops = st.attacker ? st.attacker.troops : null;
    this._prevDefTroops = st.defender ? st.defender.troops : null;
    this._renderBattleState(st, true);
  }

  // ============================================================
  // 多回合战斗动画系统（Canvas 角色 + 粒子 + 屏幕震动）
  // ============================================================
  _startBattleAnim(st) {
    this._stopBattleAnim();
    const canvas = document.getElementById('battle-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const attColor = (st.attackerFaction && FACTIONS[st.attackerFaction] && FACTIONS[st.attackerFaction].color) || '#A0522D';
    const defColor = (st.defenderFaction && FACTIONS[st.defenderFaction] && FACTIONS[st.defenderFaction].color) || '#2C3E6B';
    this._battleAnim = {
      canvas, ctx,
      rafId: null,
      time: 0,
      lastTime: performance.now(),
      // 双方角色：intro 阶段从两侧冲入
      attacker: {
        x: -60, targetX: 210, action: 'charge', frame: 0,
        faction: attColor, unitType: (st.attacker && st.attacker.unitType) || 'infantry'
      },
      defender: {
        x: canvas.width + 60, targetX: canvas.width - 210, action: 'charge', frame: 0,
        faction: defColor, unitType: (st.defender && st.defender.unitType) || 'infantry'
      },
      particles: [],
      shake: 0,
      introT: 0,           // 冲锋入场进度 0~1
      finished: false,
      resultShown: false
    };
    const loop = (now) => this._battleLoop(now);
    this._battleAnim.rafId = requestAnimationFrame(loop);
  }

  _stopBattleAnim() {
    if (this._battleAnim) {
      if (this._battleAnim.rafId) cancelAnimationFrame(this._battleAnim.rafId);
      this._battleAnim = null;
    }
  }

  _battleLoop(now) {
    const ba = this._battleAnim;
    if (!ba) return;
    const dt = Math.min((now - ba.lastTime) / 1000, 0.05);
    ba.lastTime = now;
    ba.time += dt;

    // 入场冲锋：双方滑到目标位置
    if (ba.introT < 1) {
      ba.introT = Math.min(1, ba.introT + dt * 1.8);
      const e = 1 - Math.pow(1 - ba.introT, 2);
      ba.attacker.x = -60 + (ba.attacker.targetX + 60) * e;
      ba.defender.x = ba.canvas.width + 60 - (ba.canvas.width + 60 - ba.defender.targetX) * e;
      if (ba.introT >= 1) {
        ba.attacker.action = 'idle';
        ba.defender.action = 'idle';
      }
    }

    // 更新角色帧与受击计时
    for (const side of [ba.attacker, ba.defender]) {
      side.frame += dt * 10;
      if (side.hurtUntil && ba.time > side.hurtUntil) {
        if (side.action === 'hurt') side.action = 'idle';
        side.hurtUntil = 0;
      }
      if (side.action === 'victory' || side.action === 'defeat') {
        // 终局姿势保持，frame 继续走
      } else if (side.action !== 'skill' && side.action !== 'slash' && side.action !== 'shoot' && side.action !== 'hurt') {
        // 非攻击动作时回到 idle（charge 仅入场）
      }
    }

    // 粒子更新
    for (let i = ba.particles.length - 1; i >= 0; i--) {
      const p = ba.particles[i];
      p.life -= dt;
      if (p.life <= 0) { ba.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
    }

    // 屏幕震动衰减
    if (ba.shake > 0.2) ba.shake *= 0.88; else ba.shake = 0;

    // ---- 绘制 ----
    const ctx = ba.ctx;
    const W = ba.canvas.width, H = ba.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 地面线
    ctx.save();
    if (ba.shake > 0.3) ctx.translate((Math.random() - 0.5) * ba.shake, (Math.random() - 0.5) * ba.shake);

    // 地面
    ctx.strokeStyle = 'rgba(196,165,90,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 30);
    ctx.lineTo(W, H - 30);
    ctx.stroke();

    const groundY = H - 40;

    // 攻方（朝右）
    ctx.save();
    ctx.translate(ba.attacker.x, groundY);
    if (ba.attacker.action === 'hurt') { /* 受击红闪由角色内部处理 */ }
    Animator.drawBattleCharacter(ctx, 0, 0, ba.attacker.faction, ba.attacker.action, ba.attacker.frame, ba.attacker.unitType);
    ctx.restore();

    // 守方（朝左，水平翻转）
    ctx.save();
    ctx.translate(ba.defender.x, groundY);
    ctx.scale(-1, 1);
    Animator.drawBattleCharacter(ctx, 0, 0, ba.defender.faction, ba.defender.action, ba.defender.frame, ba.defender.unitType);
    ctx.restore();

    // 粒子
    for (const p of ba.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      Animator.drawParticle(ctx, p.x, p.y, p.type, t, p);
    }

    ctx.restore(); // shake

    ba.rafId = requestAnimationFrame((t) => this._battleLoop(t));
  }

  // 每回合战斗状态更新后，对比兵力变化 -> 播放受击/攻击动画
  _detectBattleHits(st) {
    if (!this._battleAnim) return;
    const att = st.attacker || {};
    const def = st.defender || {};
    const attTroops = att.troops;
    const defTroops = def.troops;
    const ba = this._battleAnim;

    if (this._prevAttTroops != null && attTroops != null) {
      if (attTroops < this._prevAttTroops) {
        // 攻方被打：攻方 hurt + 在攻方位置出 impact
        ba.attacker.action = 'hurt';
        ba.attacker.hurtUntil = ba.time + 0.25;
        this._spawnBattleParticle('impact', ba.attacker.x, 200);
        ba.shake = Math.max(ba.shake, 6);
      }
      if (defTroops < this._prevDefTroops) {
        // 守方被打：攻方先 slash 一下，守方 hurt
        ba.attacker.action = 'slash';
        // 0.4s 后回到 idle
        setTimeout(() => { if (ba.attacker.action === 'slash') ba.attacker.action = 'idle'; }, 450);
        ba.defender.action = 'hurt';
        ba.defender.hurtUntil = ba.time + 0.25;
        this._spawnBattleParticle('impact', ba.defender.x, 200);
        this._spawnBattleParticle('slash', (ba.attacker.x + ba.defender.x) / 2, 190, { angle: -Math.PI / 4 });
        ba.shake = Math.max(ba.shake, 8);
      }
      // 技能判定：日志含"绝技/技能"
      const recentLog = (st.log || []).slice(-2).join(' ');
      if (/绝技|技能|施展|奇袭/.test(recentLog)) {
        ba.attacker.action = 'skill';
        setTimeout(() => { if (ba.attacker.action === 'skill') ba.attacker.action = 'idle'; }, 900);
        // 粒子飞向守方
        this._spawnSkillParticles(ba.attacker.x, 200, ba.defender.x, 200);
        ba.shake = Math.max(ba.shake, 10);
      }
    }
    this._prevAttTroops = attTroops;
    this._prevDefTroops = defTroops;
  }

  _spawnBattleParticle(type, x, y, extra) {
    if (!this._battleAnim) return;
    for (let i = 0; i < 8; i++) {
      const p = this._makeParticle(type, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, extra);
      this._battleAnim.particles.push(p);
    }
  }

  _spawnSkillParticles(fx, fy, tx, ty) {
    if (!this._battleAnim) return;
    // 火焰粒子从攻方飞向守方
    for (let i = 0; i < 14; i++) {
      const t = Math.random();
      const p = this._makeParticle('fire', fx, fy, {});
      p.vx = (tx - fx) / 0.8 * (0.8 + Math.random() * 0.4);
      p.vy = (ty - fy) / 0.8 + (Math.random() - 0.5) * 30;
      p.life = p.maxLife = 0.7 + Math.random() * 0.3;
      this._battleAnim.particles.push(p);
    }
    // 命中时 impact
    setTimeout(() => {
      if (!this._battleAnim) return;
      for (let i = 0; i < 8; i++) {
        const p = this._makeParticle('impact', tx, ty, {});
        this._battleAnim.particles.push(p);
      }
    }, 600);
  }

  _makeParticle(type, x, y, extra) {
    const base = { x, y, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff' };
    if (type === 'fire') {
      base.vx = (Math.random() - 0.5) * 20;
      base.vy = -30 - Math.random() * 40;
      base.life = base.maxLife = 0.6 + Math.random() * 0.5;
      base.size = 2 + Math.random() * 3;
      base.color = Math.random() < 0.5 ? '#ff6a2a' : '#ffcc33';
      base.gravity = -10;
    } else if (type === 'impact') {
      base.life = base.maxLife = 0.45;
      base.size = 6;
      base.color = '#ffe680';
    } else if (type === 'slash') {
      base.life = base.maxLife = 0.25;
      base.size = 40;
      base.color = '#ffffff';
      base.angle = (extra && extra.angle) || -Math.PI / 4;
    } else if (type === 'heal') {
      base.vx = (Math.random() - 0.5) * 10;
      base.vy = -25 - Math.random() * 20;
      base.life = base.maxLife = 0.8 + Math.random() * 0.4;
      base.size = 2 + Math.random() * 2.5;
      base.color = '#66ff88';
    }
    return base;
  }

  _renderBattleShell(modal, st, sceneKey) {
    // V13.0：按势力色计算立绘动态边框颜色
    const attColor = (st.attackerFaction && FACTIONS[st.attackerFaction] && FACTIONS[st.attackerFaction].color) || '#C44A3A';
    const defColor = (st.defenderFaction && FACTIONS[st.defenderFaction] && FACTIONS[st.defenderFaction].color) || '#3A6B9C';
    modal.innerHTML = `
      <div class="modal battle-modal v13-battle-modal">
        <div class="battle-round-badge v13-round-badge" id="bt-round">第 1 / ${st.maxRounds || 5} 回合</div>
        <!-- V17.0：战场顶部天气图标条 -->
        <div class="v17-battle-weather" id="bt-v17-weather"></div>
        <div class="battle-arena v13-battle-arena" id="bt-arena">
          <!-- V17.0：战场边缘地形标注 -->
          <div class="v17-terrain-tag" id="bt-v17-terrain"></div>
          <div class="battle-scene" style="background-image:url('${IMG.battle(sceneKey)}')" onerror="this.style.display='none'"></div>
          <canvas id="battle-canvas" width="760" height="260"></canvas>
          <div class="battle-side-box" id="bt-att-box" style="--v13-faction:${attColor}">
            <div class="portrait-anim-wrap v13-portrait-frame">
              <img class="battle-portrait att portrait-anim" src="${IMG.portrait((st.attacker && st.attacker.portrait) || 'yang_kan')}" onerror="this.style.display='none'">
            </div>
            <div style="flex:1">
              <div class="battle-gen-name name-glow">${(st.attacker && st.attacker.name) || '我军'}</div>
              <div class="troop-bar-wrap"><div class="troop-bar v13-troop-bar" id="bt-att-bar"></div></div>
              <div class="troop-num" id="bt-att-num">0</div>
              <!-- V17.0：攻方士气条（绿→黄→红渐变） -->
              <div class="v17-morale-track" id="bt-v17-morale-att" title="军心">
                <div class="v17-morale-fill"></div><span class="v17-morale-text">军心 --</span>
              </div>
            </div>
          </div>
          <div class="battle-vs-big">VS</div>
          <div class="battle-side-box right" id="bt-def-box" style="--v13-faction:${defColor}">
            <div class="portrait-anim-wrap v13-portrait-frame">
              <img class="battle-portrait def portrait-anim" src="${IMG.portrait((st.defender && st.defender.portrait) || 'gao_aocao')}" onerror="this.style.display='none'">
            </div>
            <div style="flex:1">
              <div class="battle-gen-name name-glow">${(st.defender && st.defender.name) || '守军'}</div>
              <div class="troop-bar-wrap"><div class="troop-bar v13-troop-bar" id="bt-def-bar"></div></div>
              <div class="troop-num" id="bt-def-num">0</div>
              <!-- V17.0：守方士气条 -->
              <div class="v17-morale-track" id="bt-v17-morale-def" title="军心">
                <div class="v17-morale-fill"></div><span class="v17-morale-text">军心 --</span>
              </div>
            </div>
          </div>
        </div>
        <!-- V17.0：连胜/连败士气影响提示 -->
        <div class="v17-streak-hint" id="bt-v17-streak" style="display:none"></div>
        <div class="siege-wrap" id="bt-siege-wrap" style="display:none">
          <div class="siege-label">破城进度 —— ${st.cityName || ''}</div>
          <div class="siege-bar"><div class="siege-fill" id="bt-siege-fill"></div></div>
        </div>
        <!-- V17.0：当前阵型 + 可切换阵型按钮 -->
        <div class="v17-formation-bar" id="bt-v17-formation"></div>
        <div class="battle-log" id="bt-log"></div>
        <!-- V17.0：技能按钮栏（可用技能 + 冷却进度） -->
        <div class="v17-skill-bar" id="bt-v17-skills"></div>
        <div class="battle-actions v13-scroll-bar" id="bt-actions"></div>
      </div>
    `;
    // V17.0：战斗增强层（天气/地形/士气/阵型/技能/连胜）
    this._v17RenderBattleExtras(st, true);
  }

  // ============================================================
  // V17.0「血战沙场版」战斗界面深化
  //  约定：所有新类名 v17- 前缀；所有模型 API 调用带 typeof 守卫。
  //  统一读取战斗状态，兼容嵌套(st.attacker.troops)与扁平(st.attackerTroops)两种结构。
  // ============================================================
  _v17Att(st) { return (st && st.attacker) || {}; }
  _v17Def(st) { return (st && st.defender) || {}; }
  _v17AttTroops(st) { const a = this._v17Att(st); return a.troops != null ? a.troops : (st.attackerTroops != null ? st.attackerTroops : 0); }
  _v17DefTroops(st) { const d = this._v17Def(st); return d.troops != null ? d.troops : (st.defenderTroops != null ? st.defenderTroops : 0); }

  // 读取一支战斗方的士气（0~100），缺失时由兵力比例派生
  _v17MoraleOf(st, side) {
    const s = side === 'att' ? this._v17Att(st) : this._v17Def(st);
    if (typeof s.morale === 'number') return Math.max(0, Math.min(100, s.morale));
    if (typeof s.armyMorale === 'number') return Math.max(0, Math.min(100, s.armyMorale));
    // 派生：以当前兵力/初始兵力估算军心
    const cur = side === 'att' ? this._v17AttTroops(st) : this._v17DefTroops(st);
    const max = side === 'att' ? (st._attMax || st.startAttackerTroops || cur || 1)
                               : (st._defMax || st.startDefenderTroops || cur || 1);
    return Math.max(10, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)));
  }

  // 天气图标（依据季节 + 随机战场气象）
  _v17BattleWeatherIcon(st) {
    const season = (this.game && typeof this.game.getSeason === 'function') ? this.game.getSeason() : '';
    // 地形衍生天气倾向
    const t = (st && st.terrain) || 'plain';
    const map = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
    let icon = map[season] || '🌤';
    let label = season ? (season + '季') : '晴';
    if (t === 'river') { icon = '🌊'; label = '水泽·风急'; }
    else if (t === 'mountain' || t === 'hill') { icon = '⛰️'; label = '山地·雾霭'; }
    else if (t === 'forest') { icon = '🌲'; label = '林地·阴沉'; }
    else if (t === 'desert') { icon = '🏜️'; label = '荒漠·烈日'; }
    return { icon, label };
  }

  // 集中渲染战斗增强层
  _v17RenderBattleExtras(st, isFirst) {
    if (!st) return;
    // ---- 天气图标（顶部） ----
    const wEl = document.getElementById('bt-v17-weather');
    if (wEl) {
      const w = this._v17BattleWeatherIcon(st);
      wEl.innerHTML = `<span class="v17-wx-icon">${w.icon}</span><span class="v17-wx-label">${w.label}</span>` +
        `<span class="v17-wx-hint">${this._v17WeatherModText(st)}</span>`;
    }
    // ---- 地形标注（战场边缘） ----
    const tEl = document.getElementById('bt-v17-terrain');
    if (tEl) {
      const t = (st.terrain) || 'plain';
      const tName = (TERRAIN && TERRAIN[t] && TERRAIN[t].name) ? TERRAIN[t].name : (t === 'plain' ? '平原' : t);
      tEl.innerHTML = `⛰ ${tName}${st.siege ? ' · 攻城战' : ''}${st.cityName ? ' · ' + st.cityName : ''}`;
    }
    // ---- 双方士气条 ----
    this._v17UpdateMoraleBar('bt-v17-morale-att', this._v17MoraleOf(st, 'att'));
    this._v17UpdateMoraleBar('bt-v17-morale-def', this._v17MoraleOf(st, 'def'));
    // ---- 连胜/连败提示 ----
    this._v17RenderStreakHint(st);
    // ---- 阵型栏 ----
    this._v17RenderFormationBar(st);
    // ---- 技能冷却栏 ----
    this._v17RenderSkillBar(st);
    // 新手指引：首次战斗阵型引导 / 首次天气提示 / 首次士气气泡
    if (isFirst) this._v17FirstBattleGuides(st);
  }

  _v17UpdateMoraleBar(barId, morale) {
    const track = document.getElementById(barId);
    if (!track) return;
    const fill = track.querySelector('.v17-morale-fill');
    const txt = track.querySelector('.v17-morale-text');
    if (fill) fill.style.width = Math.max(0, Math.min(100, morale)) + '%';
    // 绿→黄→红渐变：通过类名切换色相
    track.classList.remove('v17-morale-high', 'v17-morale-mid', 'v17-morale-low');
    track.classList.add(morale >= 66 ? 'v17-morale-high' : (morale >= 33 ? 'v17-morale-mid' : 'v17-morale-low'));
    if (txt) txt.textContent = '军心 ' + Math.round(morale);
  }

  _v17WeatherModText(st) {
    const t = (st && st.terrain) || 'plain';
    const mods = { plain: '野战·无修正', river: '水军/弓兵+，骑兵-', mountain: '弓兵+，重骑-',
      forest: '伏兵+，骑兵-', desert: '补给消耗+' };
    return mods[t] || '地形无修正';
  }

  // 连胜/连败士气影响提示
  _v17RenderStreakHint(st) {
    const el = document.getElementById('bt-v17-streak');
    if (!el) return;
    const stats = (this.game && this.game.stats) || {};
    const ws = stats.winStreak || 0;
    let html = '', cls = '';
    if (ws >= 3) { html = `🔥 我方连胜 ${ws} 场！全军士气高昂，攻防+${Math.min(ws, 10)}%`; cls = 'v17-streak-win'; }
    else if (ws <= -2 || (stats.lossStreak && stats.lossStreak >= 2)) {
      const ls = Math.abs(stats.lossStreak || 2);
      html = `💀 我方连败 ${ls} 场…士气低落，需稳扎稳打`; cls = 'v17-streak-lose';
    }
    if (!html) { el.style.display = 'none'; return; }
    el.className = 'v17-streak-hint ' + cls;
    el.innerHTML = html;
    el.style.display = 'block';
  }

  // 当前阵型 + 可切换阵型按钮
  _v17RenderFormationBar(st) {
    const el = document.getElementById('bt-v17-formation');
    if (!el) return;
    // 尝试从战斗方/当前选中军队读取当前阵型
    let curFid = null;
    const att = this._v17Att(st);
    if (att && att.formation) curFid = att.formation;
    if (!curFid && this.game) {
      const army = this.game.selectedArmy ? this.game.armies.find(a => a.id === this.game.selectedArmy) : null;
      if (army) curFid = army.formation;
    }
    const curName = (curFid && FORMATIONS[curFid] && FORMATIONS[curFid].name) ? FORMATIONS[curFid].name : (curFid || '雁行');
    // 可用阵型（带守卫）
    let avail = [];
    try {
      const techs = (this.game && this.game.techs) || {};
      avail = availableFormations(techs) || Object.keys(FORMATIONS);
    } catch (e) { avail = Object.keys(FORMATIONS); }
    let html = `<span class="v17-fm-label">阵法</span>`;
    html += `<span class="v17-fm-cur">${curName}</span>`;
    html += `<span class="v17-fm-sep">→</span>`;
    html += avail.map(fid => {
      const f = FORMATIONS[fid] || {};
      const active = fid === curFid ? ' on' : '';
      return `<button class="btn-small v17-fm-btn${active}" onclick="__ui_.v17SwitchFormation('${fid}')">${f.name || fid}</button>`;
    }).join('');
    el.innerHTML = html;
  }

  // 切换阵型（带 typeof 守卫；战斗中仅记录偏好，由军团/军队系统实际生效）
  v17SwitchFormation(fid) {
    if (!this.game) return;
    try {
      const army = this.game.selectedArmy ? this.game.armies.find(a => a.id === this.game.selectedArmy) : null;
      if (army && typeof this.game.setArmyFormation === 'function') {
        const r = this.game.setArmyFormation(army.id, fid);
        this.toast(r && r.msg ? r.msg : `阵型切换为 ${(FORMATIONS[fid]||{}).name||fid}`);
      } else if (army) {
        army.formation = fid;
        this.toast(`阵型切换为 ${(FORMATIONS[fid]||{}).name||fid}`);
      } else {
        this.toast(`预备阵型：${(FORMATIONS[fid]||{}).name||fid}`);
      }
      this.audio && this.audio.playClick && this.audio.playClick();
      // 刷新战斗阵型栏
      const st = (typeof this.game.getBattleState === 'function') ? this.game.getBattleState() : null;
      this._v17RenderFormationBar(st);
    } catch (e) { this.toast('阵型切换失败'); }
  }

  // 技能按钮栏：可用技能 + 冷却进度
  _v17RenderSkillBar(st) {
    const el = document.getElementById('bt-v17-skills');
    if (!el) return;
    const skills = (st && st.attackerActiveSkills) || [];
    if (!skills.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<span class="v17-skill-label">绝技</span>' + skills.map(s => {
      const cd = s.cooldown || 0;
      const ready = cd <= 0;
      // 冷却进度条（假定单技能最大冷却 3 回合做相对宽度）
      const pct = ready ? 100 : Math.max(10, Math.round((1 - cd / 3) * 100));
      return `<button class="btn-small v17-skill-chip ${ready ? 'ready' : 'cd'}"
        title="${s.description || ''}" ${ready ? '' : 'disabled'}
        onclick="__ui_.v17UseBattleSkill('${s.id}')">
        <span class="v17-skill-name">✦ ${s.name}</span>
        ${ready ? '' : `<span class="v17-skill-cd">冷却 ${cd} 回合</span><span class="v17-skill-cdbar"><i style="width:${pct}%"></i></span>`}
      </button>`;
    }).join('');
  }

  v17UseBattleSkill(sid) {
    if (!this.game) return;
    try {
      if (typeof this.game.useSkill !== 'function') { this.toast('技能系统暂不可用'); return; }
      const army = this.game.selectedArmy ? this.game.armies.find(a => a.id === this.game.selectedArmy) : null;
      if (!army) { this.toast('未选中我方军队'); return; }
      const r = this.game.useSkill(army.id, sid);
      this.toast(r && r.msg ? r.msg : '绝技已蓄势');
      const st = this.game.getBattleState && this.game.getBattleState();
      if (st) this._renderBattleState(st, false);
    } catch (e) { this.toast('绝技施放失败'); }
  }

  _renderBattleState(st, isFirst) {
    // V13.0：在动画检测前快照兵力，用于计算伤害飘字（不改动画逻辑，仅读值）
    const prevAtt = this._prevAttTroops;
    const prevDef = this._prevDefTroops;
    // 动画：检测兵力变化 -> 播放受击/斩击/技能动画
    if (!isFirst) this._detectBattleHits(st);
    const setBar = (barId, numId, cur, max, prev) => {
      const bar = document.getElementById(barId);
      const num = document.getElementById(numId);
      if (!bar || !num) return;
      const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
      this.animateNumber(num, parseInt(num.textContent, 10) || 0, cur, 400);
      bar.style.width = pct + '%';
      // V13.0：兵力损耗时红色闪烁动画
      if (prev != null && cur < prev) {
        bar.classList.remove('v13-bar-hit');
        void bar.offsetWidth;
        bar.classList.add('v13-bar-hit');
      }
    };
    if (st.attacker) setBar('bt-att-bar', 'bt-att-num', st.attacker.troops, st._attMax || st.attacker.troops, prevAtt);
    if (st.defender) setBar('bt-def-bar', 'bt-def-num', st.defender.troops, st._defMax || st.defender.troops, prevDef);

    // V13.0：伤害飘字（DOM 浮字）
    const arena = document.getElementById('bt-arena');
    const attBox = document.getElementById('bt-att-box');
    const defBox = document.getElementById('bt-def-box');
    const lastLog = (st.log && st.log.length) ? st.log[st.log.length - 1] : '';
    const isCrit = /暴击|重创|大破|致命|一击/.test(lastLog);
    const isHeal = /治疗|恢复|回血|疗伤/.test(lastLog);
    if (!isFirst && arena && st.attacker && prevAtt != null) {
      const d = prevAtt - st.attacker.troops;
      if (d > 0) this._spawnDamageFloat(arena, attBox, d, isCrit ? 'crit' : 'dmg');
      else if (d < 0) this._spawnDamageFloat(arena, attBox, -d, 'heal');
    }
    if (!isFirst && arena && st.defender && prevDef != null) {
      const d = prevDef - st.defender.troops;
      if (d > 0) this._spawnDamageFloat(arena, defBox, d, isCrit ? 'crit' : 'dmg');
      else if (d < 0) this._spawnDamageFloat(arena, defBox, -d, 'heal');
    }
    // 记录初始最大值
    if (isFirst) {
      st._attMax = st.attacker ? st.attacker.troops : 1;
      st._defMax = st.defender ? st.defender.troops : 1;
    }
    const roundEl = document.getElementById('bt-round');
    if (roundEl) roundEl.textContent = `第 ${st.round || 1} / ${st.maxRounds || 5} 回合 · ${st.cityName || ''}`;

    // 破城进度
    const siegeWrap = document.getElementById('bt-siege-wrap');
    if (siegeWrap) {
      if (typeof st.siegeProgress === 'number') {
        siegeWrap.style.display = 'block';
        const fill = document.getElementById('bt-siege-fill');
        if (fill) fill.style.width = Math.min(100, st.siegeProgress) + '%';
      } else {
        siegeWrap.style.display = 'none';
      }
    }

    // 战斗日志（增量打字机）
    const logEl = document.getElementById('bt-log');
    if (logEl && Array.isArray(st.log)) {
      const existing = logEl.children.length;
      for (let i = existing; i < st.log.length; i++) {
        const line = document.createElement('div');
        const txt = st.log[i];
        line.className = /胜|破|溃|大捷/.test(txt) ? 'log-crit' : (/攻|击|杀/.test(txt) ? 'log-hit' : '');
        this.typeText(line, txt, 18);
        logEl.appendChild(line);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }

    // V17.0：每回合刷新战斗增强层（士气/技能冷却/连胜）
    if (!st.over && !st.result) this._v17RenderBattleExtras(st, isFirst);

    // 动作按钮
    const actionsEl = document.getElementById('bt-actions');
    if (actionsEl) {
      // 战斗结束
      if (st.over || st.result) {
        this._renderBattleResult(st);
        return;
      }
      const avail = Array.isArray(st.availableActions) ? st.availableActions : ['attack', 'strong', 'defend', 'retreat'];
      // V13.0：卷轴风格操作条，按钮带图标+文字
      const labels = {
        attack: { icon: '⚔', text: '稳攻' },
        strong: { icon: '🔥', text: '猛攻' },
        defend: { icon: '🛡', text: '防御' },
        retreat: { icon: '🏳', text: '撤退' }
      };
      actionsEl.innerHTML = avail.map(a => {
        if (a.startsWith('skill:')) {
          const sid = a.slice(6);
          return `<button class="btn-small skill-btn v13-battle-btn" onclick="__ui_.battleDoAction('${a}')"><span class="v13-btn-icon">✦</span><span class="v13-btn-text">${sid}</span></button>`;
        }
        const m = labels[a] || { icon: '·', text: a };
        return `<button class="btn-small v13-battle-btn" onclick="__ui_.battleDoAction('${a}')"><span class="v13-btn-icon">${m.icon}</span><span class="v13-btn-text">${m.text}</span></button>`;
      }).join('');
    }
  }

  battleDoAction(action) {
    if (typeof this.game.battleAction !== 'function') return;
    try {
      this.game.battleAction(action);
      this.audio.playClick();
      const st = this.game.getBattleState();
      if (st) this._renderBattleState(st, false);
    } catch (e) { /* 战斗状态异常时静默 */ }
  }

  _renderBattleResult(st) {
    const modal = document.getElementById('battle-modal-root');
    if (!modal) return;
    const result = st.result || {};
    const win = result.win || st.win;
    const titleCls = win ? 'win' : (result.draw || st.draw) ? 'draw' : 'lose';
    const titleTxt = win ? '★ 胜利 ★' : (result.draw || st.draw) ? '平局' : '败退';
    if (win) this.audio.playVictory();
    else if (titleCls === 'lose') this.audio.playDefeat();

    // V17.0：战斗通知增强
    try {
      if (win) {
        const ws = (this.game && this.game.stats && this.game.stats.winStreak) || 0;
        this._v17BattleNotify('win', `大捷！攻破 ${st.cityName || '敌军'}${ws >= 2 ? ' · 连胜' + ws + '场' : ''}`);
      } else if (titleCls === 'lose') {
        this._v17BattleNotify('lose', `我军败退于 ${st.cityName || '战场'}，望重整旗鼓`);
      }
    } catch (e) {}

    // 动画：胜方胜利姿势，败方倒地
    if (this._battleAnim && !this._battleAnim.resultShown) {
      this._battleAnim.resultShown = true;
      const ba = this._battleAnim;
      if (titleCls === 'win') {
        ba.attacker.action = 'victory';
        ba.defender.action = 'defeat';
        ba.defender.frame = 0;
        // 胜利粒子
        for (let i = 0; i < 12; i++) {
          ba.particles.push(this._makeParticle('impact', ba.attacker.x + (Math.random()-0.5)*30, 180, {}));
        }
      } else if (titleCls === 'lose') {
        ba.defender.action = 'victory';
        ba.attacker.action = 'defeat';
        ba.attacker.frame = 0;
      } else {
        ba.attacker.action = 'idle';
        ba.defender.action = 'idle';
      }
    }

    const logEl = document.getElementById('bt-log');
    if (logEl) {
      logEl.innerHTML += `<div class="log-crit">—— ${titleTxt} ——</div>`;
      if (result.attackerLoss !== undefined) logEl.innerHTML += `<div>攻方伤亡：${result.attackerLoss}</div>`;
      if (result.defenderLoss !== undefined) logEl.innerHTML += `<div>守方伤亡：${result.defenderLoss}</div>`;
      if (result.conquered) logEl.innerHTML += `<div class="log-crit">★ 城池已陷落！</div>`;
    }
    const actionsEl = document.getElementById('bt-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `<button class="btn-ancient v13-btn" onclick="__ui_.closeBattle()">继续</button>`;
    }
    // V13.0：胜利金色粒子爆发 / 失败灰色余烬飘落 / 平局中性
    this._v13BattleResultFX(modal, win, result.draw || st.draw);
  }

  // ---------- 旧版战斗结算弹窗（兼容降级，含冲锋碰撞动画） ----------
  showBattleModal(result) {
    this._battleMode = 'old';
    if (result.attackerWin) this.audio.playVictory();
    else this.audio.playDefeat();
    const battleImg = result.attackerWin ? 'city_siege' : (Math.random() < 0.5 ? 'cavalry_charge' : 'river_battle');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal battle-modal">
        <h2 class="modal-title">⚔ 战报 · ${result.targetCityName}</h2>
        <canvas id="old-battle-canvas" width="700" height="180" style="width:100%;border-radius:6px;border:1px solid #8B7A4A;background:linear-gradient(180deg,#1a2a20,#0d1a12)"></canvas>
        <img src="${IMG.battle(battleImg)}" class="battle-img" onerror="this.style.display='none'">
        <div class="battle-info">
          <div class="battle-side">
            <b>${result.attackerName}</b><br>兵力 ${result.attackerWin ? '胜' : (result.draw ? '平' : '败')}
          </div>
          <div class="battle-vs">VS</div>
          <div class="battle-side">
            <b>${result.defenderName}</b><br>兵力 ${result.attackerWin ? '败' : (result.draw ? '平' : '胜')}
          </div>
        </div>
        <div class="battle-details">
          <p>攻方伤亡：${result.attackerLoss}</p>
          <p>守方伤亡：${result.defenderLoss}</p>
          ${(result.tactics || []).map(t => `<p class="tactic">◆ ${t}</p>`).join('')}
          ${(result.battleLog || []).map(l => `<p>${l}</p>`).join('')}
          ${result.conquered ? '<p class="conquer">★ 城池已陷落！</p>' : ''}
        </div>
        <button class="btn-ancient" onclick="__ui_.closeBattle()">继续</button>
      </div>
    `;
    document.body.appendChild(modal);
    // V13.0：旧版战报也加胜利/失败动态粒子特效
    const inner = modal.querySelector('.battle-modal');
    if (inner) { inner.classList.add('v13-battle-modal'); this._v13BattleResultFX(inner, !!result.attackerWin, !!result.draw); }
    this._startOldBattleAnim(result);
  }

  // 旧版战报：双方冲锋 -> 碰撞 -> 胜负姿势
  _startOldBattleAnim(result) {
    this._stopOldBattleAnim();
    const canvas = document.getElementById('old-battle-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const attFid = result.attackerFaction || 'dongwei';
    const defFid = result.defenderFaction || 'xiwei';
    const attColor = (FACTIONS[attFid] && FACTIONS[attFid].color) || '#A0522D';
    const defColor = (FACTIONS[defFid] && FACTIONS[defFid].color) || '#2C3E6B';
    const win = !!result.attackerWin && !result.draw;
    const draw = !!result.draw;
    this._oldBattleAnim = {
      canvas, ctx, rafId: null, time: 0, last: performance.now(),
      att: { x: -40, tx: canvas.width * 0.3, action: 'charge', frame: 0, faction: attColor, unitType: 'cavalry' },
      def: { x: canvas.width + 40, tx: canvas.width * 0.7, action: 'charge', frame: 0, faction: defColor, unitType: 'infantry' },
      collided: false, shake: 0
    };
    const loop = (now) => this._oldBattleLoop(now, win, draw);
    this._oldBattleAnim.rafId = requestAnimationFrame(loop);
  }

  _stopOldBattleAnim() {
    if (this._oldBattleAnim) {
      if (this._oldBattleAnim.rafId) cancelAnimationFrame(this._oldBattleAnim.rafId);
      this._oldBattleAnim = null;
    }
  }

  _oldBattleLoop(now, win, draw) {
    const ob = this._oldBattleAnim;
    if (!ob) return;
    const dt = Math.min((now - ob.last) / 1000, 0.05);
    ob.last = now;
    ob.time += dt;
    for (const s of [ob.att, ob.def]) s.frame += dt * 10;

    // 冲锋接近
    const speed = 260;
    if (!ob.collided) {
      ob.att.x += speed * dt;
      ob.def.x -= speed * dt;
      if (ob.att.x >= ob.att.tx && ob.def.x <= ob.def.tx) {
        ob.collided = true;
        ob.att.action = 'slash';
        ob.def.action = 'hurt';
        ob.shake = 8;
      }
    } else {
      // 碰撞后 0.6s 进入胜负
      if (ob.time > 1.2) {
        if (draw) { ob.att.action = 'idle'; ob.def.action = 'idle'; }
        else if (win) { ob.att.action = 'victory'; ob.def.action = 'defeat'; }
        else { ob.def.action = 'victory'; ob.att.action = 'defeat'; }
      } else if (ob.time > 0.6) {
        ob.def.action = 'hurt';
      }
    }
    if (ob.shake > 0.3) ob.shake *= 0.88; else ob.shake = 0;

    // 绘制
    const ctx = ob.ctx, W = ob.canvas.width, H = ob.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (ob.shake > 0.3) ctx.translate((Math.random()-0.5)*ob.shake, (Math.random()-0.5)*ob.shake);
    ctx.strokeStyle = 'rgba(196,165,90,0.3)';
    ctx.beginPath(); ctx.moveTo(0, H - 25); ctx.lineTo(W, H - 25); ctx.stroke();
    const gy = H - 35;
    ctx.save(); ctx.translate(ob.att.x, gy);
    Animator.drawBattleCharacter(ctx, 0, 0, ob.att.faction, ob.att.action, ob.att.frame, ob.att.unitType);
    ctx.restore();
    ctx.save(); ctx.translate(ob.def.x, gy); ctx.scale(-1, 1);
    Animator.drawBattleCharacter(ctx, 0, 0, ob.def.faction, ob.def.action, ob.def.frame, ob.def.unitType);
    ctx.restore();
    ctx.restore();

    ob.rafId = requestAnimationFrame((t) => this._oldBattleLoop(t, win, draw));
  }

  // ---------- 外交面板 ----------
  showDiplomacy() {
    // V15.0：委托到盛世华章版外交中枢（关系等级/行动/确认弹窗/通知横幅）
    this.showDiplomacyV15();
  }

  diploAction(action, targetFid, generalId) {
    let result;
    switch (action) {
      case 'alliance':
        result = this.game.diplomacy.proposeAlliance(this.game.playerFaction, targetFid);
        break;
      case 'ceasefire':
        result = this.game.diplomacy.proposeCeasefire(this.game.playerFaction, targetFid);
        break;
      case 'tribute':
        result = this.game.diplomacy.payTribute(this.game, this.game.playerFaction, targetFid, 500);
        break;
      case 'bribe':
        result = this.game.diplomacy.bribeGeneral(this.game, targetFid, generalId, 800);
        break;
    }
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.refreshUI();
  }

  // ============================================================
  // V7.0 — 王朝 / 正统 / 禅让面板
  // ============================================================
  showDynastyPanel() {
    const info = this.game.getDynastyInfo();
    if (!info) { this.toast('王朝数据未初始化'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const canAb = info.canAbdicate.ok;
    const candHtml = this.game.getAbdicateCandidates().map(d =>
      `<button class="btn-small" ${canAb ? '' : 'disabled'} onclick="__ui_.doAbdicate('${d.id}')">受禅建${d.name}</button>`
    ).join('');
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">👑 王朝 · ${this._escHtml(info.dynastyName)}</h2>
        <div class="dynasty-hero">
          <div class="stat-row"><span>当朝年号</span><b>${this._escHtml(info.eraName)} ${info.eraYear}年</b></div>
          <div class="stat-row"><span>正统</span><b style="color:${info.legitimacy>=80?'#e8c060':'#e8d5a3'}">${info.legitimacy}/100</b></div>
          <div class="stat-row"><span>皇帝</span><b>${info.emperor ? info.emperor.name : '—'}（政${info.emperor?info.emperor.politics:0}）</b></div>
          <div class="stat-row"><span>太子</span><b>${info.heir ? info.heir.name : '未定'}</b></div>
        </div>
        <h3 class="panel-subtitle">故都得失（每占一都 +18 正统）</h3>
        <div class="stat-grid">
          ${info.ancientCapitals.map(c =>
            `<div class="stat-row"><span>${c.name}</span><b style="color:${c.owned?'#55cc55':'#888'}">${c.owned?'✓ 据有':'○ 未取'}</b></div>`).join('')}
        </div>
        <h3 class="panel-subtitle">禅让大典</h3>
        <p class="hint">条件：正统≥80、城市≥20、君主政治≥80。</p>
        ${canAb
          ? `<p class="hint" style="color:#55cc55">◆ 天命攸归，可受前朝禅让！</p><div class="action-buttons">${candHtml}</div>`
          : `<p class="hint">${this._escHtml(info.canAbdicate.msg)}</p>`}
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }
  doAbdicate(newDynastyId) {
    const r = this.game.doAbdicate(newDynastyId);
    this.toast(r.msg);
    if (this.audio) try { this.audio.playTitleUnlock(); } catch(e){}
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.refreshUI();
  }

  // ============================================================
  // V8.5 — 历法节气 / 天文异象面板
  // ============================================================
  showCalendarPanel() {
    if (!this.game || !this.game.calendar) { this.toast('历法未初始化'); return; }
    const cal = this.game.calendar;
    const term = cal.term;
    const SEASONS_NAME = ['春', '夏', '秋', '冬'];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    // 24 节气循环展示
    const termsHtml = SOLAR_TERMS.map((t, i) => {
      const cur = i === cal.termIdx;
      const seasonColor = ['#4CAF50', '#FF9800', '#8D6E63', '#42A5F5'][t.season];
      return `<div class="term-cell ${cur ? 'current' : ''}" title="${this._escHtml(t.desc)}"
        style="border-color:${cur ? '#e8c060' : seasonColor}">
        <span class="term-icon">${t.icon}</span>${t.name}</div>`;
    }).join('');
    const an = cal.lastAnomaly;
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">📜 历法 · 二十四节气</h2>
        <div class="dynasty-hero">
          <div class="stat-row"><span>当今历法</span><b>${this._escHtml(cal.getLabel(this.game))}</b></div>
          <div class="stat-row"><span>当前节气</span><b style="color:#e8c060">${term.icon} ${term.name}（${SEASONS_NAME[term.season]}）</b></div>
          <div class="stat-row"><span>节气物候</span><b>${this._escHtml(term.desc)}</b></div>
          <div class="stat-row"><span>最近天象</span><b style="color:${an ? '#e87070' : '#55cc55'}">${an ? `${an.icon} ${an.name}（第${an.turn}回合）` : '无变异'}</b></div>
        </div>
        <h3 class="panel-subtitle">二十四节气图（每季六气）</h3>
        <div class="term-grid">${termsHtml}</div>
        <p class="hint">节气循环往复，岁凡二十四。立春募贤、春分修文、夏至务农、立秋讲武、秋分通商、冬至祭天；大寒苦寒、民心军心皆损。</p>
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // ============================================================
  // V8.5 — 后宫 / 皇室 / 子嗣 / 联姻面板
  // ============================================================
  showHaremPanel() {
    if (!this.game || !this.game.harem) { this.toast('后宫未初始化'); return; }
    try { this.unlockSceneBGM('harem'); } catch(e){}
    const fid = this.game.playerFaction;
    const rec = this.game.harem.get(fid);
    if (!rec) { this.toast('后宫未初始化'); return; }
    const bag = this.game.harem.getHaremBag(fid);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const consortHtml = rec.consorts.map((c, i) =>
      `<div class="harem-row">
        <b class="harem-rank">${c.rankName}</b>
        <span class="harem-name">${this._escHtml(c.name)}</span>
        <span class="hint">年${c.age}</span>
      </div>`).join('');

    const childHtml = rec.children.length ? rec.children.map(ch => {
      const isHeir = rec.heirId === ch.id;
      const canAppoint = ch.gender === 'male' && ch.age >= 15 && !isHeir;
      const canMarry = ch.gender === 'female' && !ch.marriedTo && ch.age >= 12;
      return `<div class="harem-row">
        <b>${ch.gender === 'male' ? '👦' : '👧'} ${this._escHtml(ch.name)}</b>
        <span class="hint">${ch.gender === 'male' ? '皇子' : '皇女'} · 方龄${ch.age} · 母${this._escHtml(ch.motherName)}</span>
        ${isHeir ? '<b style="color:#e8c060">（太子）</b>' : ''}
        ${canAppoint ? `<button class="btn-small" onclick="__ui_.appointHeir('${ch.id}')">立为太子</button>` : ''}
        ${canMarry ? `<button class="btn-small" onclick="__ui_.openPrincessMarry('${ch.id}')">联姻</button>` : ''}
        ${ch.marriedTo ? `<b style="color:#55cc55">已嫁${(typeof FACTIONS!=='undefined'&&FACTIONS[ch.marriedTo])?FACTIONS[ch.marriedTo].name:''}</b>` : ''}
      </div>`;
    }).join('') : '<p class="hint">尚无子嗣。</p>';

    // 纳妃选项（按位分）
    const rankBtns = HAREM_RANKS.map(r => {
      const used = this.game.harem.rankCount(fid, r.id);
      const full = used >= r.max;
      return `<button class="btn-small" ${full ? 'disabled' : ''}
        onclick="__ui_.takeInConsort('${r.id}')">纳${r.name}（${used}/${r.max}）</button>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">🏯 后宫 · 皇室</h2>
        <div class="dynasty-hero">
          <div class="stat-row"><span>妃嫔</span><b>${rec.consorts.length} 人</b></div>
          <div class="stat-row"><span>子嗣</span><b>${rec.children.length} 人</b></div>
          <div class="stat-row"><span>太子</span><b style="color:#e8c060">${rec.heirId ? (rec.children.find(c=>c.id===rec.heirId)||{}).name : '未定'}</b></div>
          <div class="stat-row"><span>后宫加成</span><b>正统+${bag.legit} 民心+${bag.morale}</b></div>
        </div>
        <h3 class="panel-subtitle">妃嫔（${rec.consorts.length}）</h3>
        <div class="harem-list">${consortHtml}</div>
        <h3 class="panel-subtitle">子嗣（${rec.children.length}）</h3>
        <div class="harem-list">${childHtml}</div>
        <h3 class="panel-subtitle">选纳</h3>
        <div class="action-buttons">${rankBtns}</div>
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }

  takeInConsort(rankId) {
    const r = this.game.harem.takeInConsort(this.game.playerFaction, rankId);
    this.toast(r.msg);
    if (r.ok) { if (this.audio) try { this.audio.playTitleUnlock(); } catch(e){} }
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showHaremPanel();
    this.refreshUI();
  }

  appointHeir(childId) {
    const r = this.game.harem.appointHeir(this.game.playerFaction, childId);
    this.toast(r.msg);
    if (r.ok) {
      if (this.game.dynastySystem) {
        // 同步王朝太子指向
        const rec = this.game.dynastySystem.get(this.game.playerFaction);
        if (rec) rec.heirId = 'prince_' + childId;
      }
      if (this.audio) try { this.audio.playTitleUnlock(); } catch(e){}
      this.game.pushLog(`👑 册立太子：${r.child.name}为储君，大赦天下。`);
    }
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showHaremPanel();
    this.refreshUI();
  }

  openPrincessMarry(princessId) {
    // 简易联姻选择：列出可外交的其他势力
    const fid = this.game.playerFaction;
    const rivals = Object.keys(FACTIONS).filter(f => f !== fid && this.game.getFactionCities(f).length > 0);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const btns = rivals.map(rf =>
      `<button class="btn-small" onclick="__ui_.marryPrincessTo('${princessId}','${rf}')">
        下嫁 ${(typeof FACTIONS!=='undefined'&&FACTIONS[rf])?FACTIONS[rf].name:rf}</button>`).join('');
    modal.innerHTML = `<div class="modal"><h2 class="modal-title">💍 皇女联姻</h2>
      <p class="hint">择一势力下嫁皇女。联姻后两国关系+20，互不攻伐。</p>
      <div class="action-buttons">${btns || '<span class="hint">无邻可婚</span>'}</div>
      <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">取消</button></div>`;
    document.body.appendChild(modal);
  }

  marryPrincessTo(princessId, targetFid) {
    const fid = this.game.playerFaction;
    const r = this.game.harem.marryPrincess(this.game, fid, princessId, targetFid);
    if (r.ok) {
      // 外交关系+20
      if (this.game.diplomacy) {
        const rel = this.game.diplomacy.getRelation(fid, targetFid);
        if (rel) rel.relation = Math.min(100, rel.relation + 20);
        this.game.diplomacy.refreshMarriageBag(this.game);
      }
      if (this.audio) try { this.audio.playTitleUnlock(); } catch(e){}
    }
    this.toast(r.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showHaremPanel();
    this.refreshUI();
  }

  // ============================================================
  // V7.0 — 官职 / 爵位面板
  // ============================================================
  showOfficePanel() {
    // V15.0：委托到盛世华章版官职任免（九品品级条/俸禄/兵权）
    this.showOfficePanelV15();
    return;
    const me = this.game.playerFaction;
    const gens = this.game.getFactionGenerals(me).filter(g => !g.inArmy && !g.onHostage && !g.onMission);
    const held = this.game.getOffices(me);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal wide">
        <h2 class="modal-title">🏛 官职 · 爵位</h2>
        <h3 class="panel-subtitle">中央/武官任命（每职仅一人）</h3>
        <div class="office-list">
          ${OFFICES.map(off => {
            const holderId = held[off.id];
            const holder = holderId ? this.game.getGeneral(holderId) : null;
            const cand = gens
              .filter(g => g.id !== holderId)
              .map(g => {
                const ok = g.politics >= (off.req.politics||0) && g.command >= (off.req.command||0);
                return ok ? `<option value="${g.id}">${g.name}</option>` : '';
              }).join('');
            return `
              <div class="office-row" style="border-left:4px solid #c9a86a">
                <b>${off.name}</b> <span class="hint">${this._escHtml(off.desc)}</span>
                <span>现任：<b class="general-name-link" onclick="${holder?`__ui_.showGeneralDetail('${holder.id}')`:''}">${holder?holder.name:'空缺'}</b></span>
                <div class="diplo-actions">
                  <select class="select-small" id="off-sel-${off.id}">${cand}</select>
                  <button class="btn-small" onclick="__ui_.appointOffice('${off.id}')">拜任</button>
                  ${holder ? `<button class="btn-small" onclick="__ui_.dismissOffice('${off.id}')">解任</button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
        <h3 class="panel-subtitle">封赏爵位（六等爵，可多人同爵）</h3>
        <div class="office-list">
          ${gens.map(g => {
            const t = RANKS.find(t => t.id === g.title);
            return `<div class="office-row">
              <b>${g.name}</b>
              <span>现爵：<b>${t ? t.name : '无'}</b>（忠诚${g.loyalty}）</span>
              <div class="diplo-actions">
                <select class="select-small" id="title-sel-${g.id}">
                  ${RANKS.map(t => `<option value="${t.id}">${t.name}(耗${t.level*800}金)</option>`).join('')}
                </select>
                <button class="btn-small" onclick="__ui_.grantTitle('${g.id}')">封赏</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }
  appointOffice(officeId) {
    const sel = document.getElementById(`off-sel-${officeId}`);
    if (!sel || !sel.value) { this.toast('无可拜任武将'); return; }
    const r = this.game.appointOffice(sel.value, officeId);
    this.toast(r.msg);
    this.showOfficePanel(); this.refreshUI();
  }
  dismissOffice(officeId) {
    const r = this.game.dismissOffice(officeId);
    this.toast(r.msg);
    this.showOfficePanel(); this.refreshUI();
  }
  grantTitle(generalId) {
    const sel = document.getElementById(`title-sel-${generalId}`);
    if (!sel) return;
    const r = this.game.grantTitle(generalId, sel.value);
    this.toast(r.msg);
    this.showOfficePanel(); this.refreshUI();
  }

  // ============================================================
  // V7.0 — 贸易商路面板
  // ============================================================
  showTradePanel() {
    // V15.0：委托到盛世华章版贸易商路（路线图光点/收入明细）
    this.showTradePanelV15();
    return;
    const info = this.game.getTradeInfo();
    const me = this.game.playerFaction;
    const cities = this.game.getFactionCities(me);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const cityOpts = (sel) => cities.map(c => `<option value="${c.id}" ${c.id===sel?'selected':''}>${c.name}</option>`).join('');
    modal.innerHTML = `
      <div class="modal wide">
        <h2 class="modal-title">🐫 贸易商路</h2>
        <h3 class="panel-subtitle">长距商路（控制端点即岁入）</h3>
        ${info.longRoutes.length ? info.longRoutes.map(r =>
          `<div class="office-row"><b>${r.name}</b><span>${this._escHtml(r.desc)}</span><b style="color:#e8c060">+${r.income}/回合</b></div>`).join('')
          : '<p class="hint">未控制任何长距商路端点（据长安/洛阳/姑臧开丝路，据广州开海丝路）。</p>'}
        <p class="hint">通商协定加成：+${Math.round(info.agreementMult*100)}%</p>
        <h3 class="panel-subtitle">派遣商队（耗 800金/400粮，3回合抵达）</h3>
        <div class="office-row">
          <select class="select-small" id="caravan-from">${cityOpts(cities[0]?cities[0].id:null)}</select>
          <span>→</span>
          <select class="select-small" id="caravan-to">${cityOpts(cities[1]?cities[1].id:null)}</select>
          <button class="btn-small" onclick="__ui_.dispatchCaravan()">遣使商队</button>
        </div>
        ${info.caravans.length ? `<h3 class="panel-subtitle">在途商队</h3>` + info.caravans.map(c =>
          `<div class="office-row"><b>${c.goodsName}</b><span>${this._escHtml(c.from)}→${this._escHtml(c.to)}</span><b>剩${c.turnsLeft}回合 · 利${c.estProfit}</b></div>`).join('') : ''}
        <h3 class="panel-subtitle">通商互市（外交关系≥40）</h3>
        ${Object.values(FACTIONS).filter(f => f.id !== me).map(f => {
          const rel = this.game.diplomacy.getRelation(me, f.id);
          const has = this.game.tradeSystem.hasAgreement(me, f.id);
          return `<div class="diplo-row" style="border-left:4px solid ${f.color}">
            <b style="color:${f.color}">${f.name}</b><span>关系${rel.relation} ${has?'[已互市]':''}</span>
            ${has?'':`<button class="btn-small" onclick="__ui_.proposeTrade('${f.id}')">通商</button>`}
          </div>`;
        }).join('')}
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }
  dispatchCaravan() {
    const f = document.getElementById('caravan-from').value;
    const t = document.getElementById('caravan-to').value;
    const r = this.game.dispatchCaravan(f, t);
    this.toast(r.msg);
    this.showTradePanel(); this.refreshUI();
  }
  proposeTrade(targetFid) {
    const r = this.game.proposeTradeAgreement(targetFid);
    this.toast(r.msg);
    this.showTradePanel(); this.refreshUI();
  }

  showRecruitPanel() {
    const idle = this.game.getIdleGenerals();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">在野贤士</h2>
        ${idle.length === 0 ? '<p>暂无在野武将</p>' :
          idle.map(g => `
            <div class="general-row">
              <div class="portrait-anim-wrap" style="width:48px;height:48px;flex-shrink:0">
                <img src="${IMG.portrait(g.portrait)}" class="gen-portrait portrait-anim" style="width:48px;height:48px;object-fit:cover" onerror="this.style.display='none'">
              </div>
              <div class="gen-info">
                <b>${g.name}</b>（${g.role}）<br>
                统${g.command} 武${g.force} 智${g.intel} 政${g.politics}
              </div>
              <button class="btn-small" onclick="__ui_.recruitGeneral('${g.id}')">招募</button>
            </div>
          `).join('')
        }
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  recruitGeneral(generalId) {
    const result = this.game.recruitIdleGeneral(generalId);
    this.audio.playRecruit();
    this.audio.playWelcome();
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  }

  // ============================================================
  // V8.0：科举面板
  // ============================================================
  showExamPanel() {
    const ie = this.game.imperialExam;
    if (!ie) { this.toast('科举系统未就绪'); return; }
    const canHold = this.game.canHoldExam();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-exam">
        <h2 class="modal-title">📜 科举取士</h2>
        <div class="exam-info">
          <p class="exam-desc">南北朝末年，九品中正制渐衰，科举萌芽。开科取士，招揽寒门英才。</p>
          <div class="stat-grid">
            <div class="stat-row"><span>下次科举</span><b>第 ${ie.nextExamTurn} 回合</b></div>
            <div class="stat-row"><span>已举办</span><b>${ie.examCount} 次</b></div>
          </div>
          ${canHold
            ? `<p style="color:#55cc55;margin:8px 0">✅ 今岁可开科取士！</p>`
            : `<p style="color:#888;margin:8px 0">⏳ 太学需≥3级，或科举尚未到期</p>`
          }
        </div>
        <div class="exam-subjects">
          <p>选择科目开科：</p>
          ${canHold ? `
            <div class="action-buttons">
              <button class="btn-ancient" onclick="__ui_.doExam('mingjing')">📖 明经科（文臣）</button>
              <button class="btn-ancient" onclick="__ui_.doExam('jinshi')">✍️ 进士科（综合）</button>
              <button class="btn-ancient" onclick="__ui_.doExam('wuju')">⚔️ 武举科（武将）</button>
            </div>
          ` : '<p class="hint">条件未满足，无法开科</p>'}
        </div>
        ${ie.lastResults ? `
          <div class="exam-result">
            <h3>上次放榜（${ie.lastResults.subject}）</h3>
            <div class="exam-honor-list">
              ${ie.lastResults.zhuangyuan ? `<div class="honor-row zhuangyuan">🥇 状元：${ie.lastResults.zhuangyuan.name}（${ie.lastResults.zhuangyuan.score}）</div>` : ''}
              ${ie.lastResults.bangyan ? `<div class="honor-row bangyan">🥈 榜眼：${ie.lastResults.bangyan.name}（${ie.lastResults.bangyan.score}）</div>` : ''}
              ${ie.lastResults.tanhua ? `<div class="honor-row tanhua">🥉 探花：${ie.lastResults.tanhua.name}（${ie.lastResults.tanhua.score}）</div>` : ''}
              ${(ie.lastResults.jinshi||[]).map(j => `<div class="honor-row jinshi">进士：${j.name}（${j.score}）</div>`).join('')}
            </div>
          </div>
        ` : ''}
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  doExam(subjectId) {
    const result = this.game.holdExam(subjectId);
    if (result.ok) {
      this.audio.playRecruit();
      this.toast(result.msg);
      // 展示放榜动画
      this.showExamResultModal(result.result);
    } else {
      this.toast(result.msg);
    }
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.refreshUI();
  }

  showExamResultModal(result) {
    // V15.0：委托到盛世华章版金榜（三甲特殊标识/进士品质）
    this.showExamResultModalV15(result);
    return;
    if (!result) return;
    try { this.unlockSceneBGM('exam'); if (this.audio.playExamHuangbang) this.audio.playExamHuangbang(); } catch(e){}
    const modal = document.createElement('div');
    modal.className = 'modal-overlay exam-glow';
    modal.innerHTML = `
      <div class="modal modal-exam-result">
        <h2 class="modal-title exam-gold-text">🏮 金榜题名 🏮</h2>
        <p class="exam-subject">${result.subject} · 放榜</p>
        <div class="exam-podium">
          ${result.zhuangyuan ? `<div class="podium-first">
            <div class="podium-medal">🥇</div>
            <div class="podium-name">${result.zhuangyuan.name}</div>
            <div class="podium-score">成绩 ${result.zhuangyuan.score}</div>
          </div>` : ''}
          <div class="podium-second-row">
            ${result.bangyan ? `<div class="podium-second">
              <div class="podium-medal">🥈</div>
              <div class="podium-name">${result.bangyan.name}</div>
              <div class="podium-score">${result.bangyan.score}</div>
            </div>` : ''}
            ${result.tanhua ? `<div class="podium-third">
              <div class="podium-medal">🥉</div>
              <div class="podium-name">${result.tanhua.name}</div>
              <div class="podium-score">${result.tanhua.score}</div>
            </div>` : ''}
          </div>
        </div>
        ${(result.jinshi && result.jinshi.length) ? `
          <div class="jinshi-list">
            <p>同进士出身：</p>
            ${result.jinshi.map(j => `<span class="jinshi-tag">${j.name}</span>`).join('')}
          </div>
        ` : ''}
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">御览毕</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ============================================================
  // V8.0：赋税面板
  // ============================================================
  showTaxPanel() {
    const cities = this.game.getFactionCities(this.game.playerFaction);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-tax">
        <h2 class="modal-title">💰 赋税调整</h2>
        <p class="tax-desc">赋税轻重影响民心、人口与叛乱。每城可独立调整，调整后3回合冷却。</p>
        <div class="tax-level-legend">
          ${TAX_LEVELS.map((lv, i) => `<span class="tax-level-tag lvl-${lv.level}" title="${lv.desc}">${lv.level}.${lv.name}</span>`).join('')}
        </div>
        <div class="tax-city-list">
          ${cities.map(c => {
            const lv = TAX_LEVELS[(c.taxLevel||2)-1];
            const cd = c.taxCooldown || 0;
            return `
              <div class="tax-city-row">
                <b>${c.name}</b>
                <span class="tax-current lvl-${c.taxLevel||2}">${lv ? lv.name : '正常'}</span>
                ${cd > 0 ? `<span class="tax-cd">冷却${cd}回合</span>` : `
                  <div class="tax-btns">
                    ${(c.taxLevel||2) > 1 ? `<button class="btn-small" onclick="__ui_.doTax('${c.id}',${(c.taxLevel||2)-1})">−</button>` : ''}
                    ${(c.taxLevel||2) < 5 ? `<button class="btn-small" onclick="__ui_.doTax('${c.id}',${(c.taxLevel||2)+1})">+</button>` : ''}
                  </div>
                `}
              </div>`;
          }).join('')}
        </div>
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  doTax(cityId, level) {
    const result = this.game.adjustTax(cityId, level);
    this.audio.playCoin();
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showTaxPanel();
    this.refreshUI();
  }

  // ============================================================
  // V8.0：徭役面板
  // ============================================================
  showCorveePanel() {
    const cities = this.game.getFactionCities(this.game.playerFaction);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-corvee">
        <h2 class="modal-title">🏗️ 徭役征发</h2>
        <p class="corvee-desc">征发民夫加速营建，但民心-3/回合。每城每3回合可征发一次。需将作监≥3级。</p>
        <div class="corvee-types">
          ${Object.values(CORVEE_TYPES).map(t => `
            <div class="corvee-type-card">
              <b>${t.icon} ${t.name}</b>
              <p>${t.description}</p>
            </div>
          `).join('')}
        </div>
        <div class="corvee-city-list">
          ${cities.map(c => {
            const jzjLv = c.buildings?.jiangzuojian || 0;
            const canDo = jzjLv >= 3 && !c.corvee;
            return `
              <div class="corvee-city-row">
                <b>${c.name}</b>
                ${c.corvee
                  ? `<span class="corvee-active">征发中（${CORVEE_TYPES[c.corvee.type]?.name || ''}，剩${c.corvee.turnsLeft}回合）</span>
                     <button class="btn-small" onclick="__ui_.doCancelCorvee('${c.id}')">取消</button>`
                  : (jzjLv >= 3
                    ? `<div class="corvee-btns">
                        ${Object.values(CORVEE_TYPES).map(t =>
                          `<button class="btn-small" onclick="__ui_.doCorvee('${c.id}','${t.id}')">${t.name}</button>`
                        ).join('')}
                      </div>`
                    : `<span class="corvee-lock">将作监${jzjLv}/3级</span>`)
                }
              </div>`;
          }).join('')}
        </div>
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  doCorvee(cityId, type) {
    const result = this.game.startCorvee(cityId, type);
    this.audio.playRecruit();
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showCorveePanel();
    this.refreshUI();
  }

  doCancelCorvee(cityId) {
    const result = this.game.cancelCorvee(cityId);
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showCorveePanel();
    this.refreshUI();
  }

  // ============================================================
  // 科技树
  // ============================================================
  showTechTree() {
    if (typeof this.game.getTechTree !== 'function') {
      this.toast('科技树系统尚未开放');
      return;
    }
    let tree;
    try { tree = this.game.getTechTree(); } catch (e) { this.toast('科技数据异常'); return; }
    if (!tree) { this.toast('暂无科技数据'); return; }
    this._techCat = this._techCat || 'military';

    const catNames = { military: '军事', economic: '经济', political: '政治' };
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal tech-modal">
        <h2 class="modal-title">科技树</h2>
        <div class="tech-tabs">
          ${Object.keys(catNames).map(c =>
            `<button class="tech-tab ${c === this._techCat ? 'active' : ''}" data-cat="${c}">${catNames[c]}</button>`
          ).join('')}
        </div>
        <div class="tech-grid" id="tech-grid"></div>
        <button class="btn-ancient" style="margin-top:14px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.tech-tab').forEach(tab => {
      tab.onclick = () => {
        this._techCat = tab.dataset.cat;
        modal.querySelectorAll('.tech-tab').forEach(t => t.classList.toggle('active', t === tab));
        this._renderTechGrid(tree);
      };
    });
    this._renderTechGrid(tree);
  }

  _renderTechGrid(tree) {
    const grid = document.getElementById('tech-grid');
    if (!grid) return;
    const list = tree[this._techCat] || [];
    if (list.length === 0) {
      grid.innerHTML = '<p class="hint">该科技线暂无可研项目</p>';
      return;
    }
    const icons = {
      military: '⚔️', economic: '💰', political: '🏛️'
    };
    grid.innerHTML = list.map(t => {
      let cls = 'tech-card locked';
      if (t.researched) cls = 'tech-card researched';
      else if (t.researching) cls = 'tech-card researching';
      else if (t.available) cls = 'tech-card available';
      const pre = (t.prerequisites || []).join('、') || '无';
      const progress = t.researching ? `
        <div class="tech-meta">研究中 · 剩余 ${t.remainingTurns ?? '?'} 回合</div>
        <div class="tech-progress"><div class="tech-progress-fill" style="width:${t.progress ?? 50}%"></div></div>
      ` : `
        <div class="tech-meta">费用 ${t.cost ?? '?'} 金 · 需 ${t.turns ?? '?'} 回合</div>
        <div class="tech-meta">前置：${pre}</div>
      `;
      return `
        <div class="${cls}" data-tid="${t.id}" data-name="${t.name}">
          <div class="tech-head">
            <span class="tech-icon">${icons[this._techCat] || '📜'}</span>
            <span class="tech-name">${t.name}</span>
          </div>
          <div class="tech-desc">${t.description || ''}</div>
          ${progress}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.tech-card.available').forEach(card => {
      card.onclick = () => this._techCardClick(card, tree);
    });
  }

  _techCardClick(card, tree) {
    const tid = card.dataset.tid;
    if (this._pendingTechId === tid) {
      // 二次确认
      if (typeof this.game.researchTech === 'function') {
        try {
          const r = this.game.researchTech(tid);
          this.audio.playCoin();
          this.toast((r && r.msg) || `开始研究 ${card.dataset.name}`);
          this._pendingTechId = null;
          this._renderTechGrid(tree);
          this.refreshUI();
        } catch (e) { this.toast('研究失败'); }
      }
    } else {
      this._pendingTechId = tid;
      this.toast('再次点击确认研究 ' + card.dataset.name);
      setTimeout(() => { if (this._pendingTechId === tid) this._pendingTechId = null; }, 3000);
    }
  }

  // ============================================================
  // 成就面板
  // ============================================================
  showAchievements() {
    if (!this.game) { this.toast('开始游戏后可查看成就'); return; }
    // V15.0：委托到盛世华章版成就殿堂（段位徽章/分类/进度/统计）
    this.showAchievementsV15();
  }

  // 成就奖励文字
  _achRewardText(a) {
    const r = a.reward || {};
    const parts = [];
    if (r.money) parts.push(`金${r.money}`);
    if (r.food) parts.push(`粮${r.food}`);
    if (r.title) parts.push(`称号「${r.title}」`);
    if (r.bgm && BGM_INFO[r.bgm]) parts.push(`乐曲《${BGM_INFO[r.bgm].name}》`);
    return parts.length ? `<span class="ach-reward-label">奖励：</span>${parts.join('、')}` : '';
  }

  // ============================================================
  // V9.5 音乐控制面板（播放列表 / 切歌 / 音量 / 收藏 / 随机）
  // ============================================================
  showMusicPanel() {
    const a = this.audio;
    const cur = a.getCurrentBGM();
    const curInfo = BGM_INFO[cur] || { name: cur || '—', desc: '' };
    const pl = a.getPlaylist();
    const buildRow = (id) => {
      const info = BGM_INFO[id] || { name: id, desc: '' };
      const isCur = id === cur;
      const isFav = a.isFavoriteBGM(id);
      return `
        <div class="music-row ${isCur ? 'playing' : ''}" data-bgm="${id}">
          <span class="music-fav" data-fav="${id}" title="收藏">${isFav ? '★' : '☆'}</span>
          <span class="music-name">${info.name}</span>
          <span class="music-desc">${info.desc}</span>
          ${isCur ? '<span class="music-eq"><i></i><i></i><i></i></span>' : ''}
        </div>`;
    };
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal music-modal">
        <div class="music-hero" style="background-image:url('assets/images/musician.png')">
          <h2 class="modal-title">乐府</h2>
          <div class="music-now">
            <div class="music-now-name">${curInfo.name}</div>
            <div class="music-now-desc">${curInfo.desc}</div>
          </div>
          <div class="music-transport">
            <button class="btn-icon" id="mu-prev" title="上一首">⏮</button>
            <button class="btn-icon" id="mu-play" title="播放/暂停">${a._bgmOn ? '⏸' : '▶'}</button>
            <button class="btn-icon" id="mu-next" title="下一首">⏭</button>
            <button class="btn-icon" id="mu-mode" title="播放模式">${a.playMode === 'random' ? '🔀' : '🔁'}</button>
          </div>
        </div>
        <div class="music-vols">
          <label>主音量 <input type="range" id="mu-master" min="0" max="100" value="${Math.round(a.masterVolume*100)}"></label>
          <label>音乐 <input type="range" id="mu-bgm" min="0" max="100" value="${Math.round(a.bgmVolume*100)}"></label>
          <label>音效 <input type="range" id="mu-sfx" min="0" max="100" value="${Math.round(a.sfxVolume*100)}"></label>
        </div>
        <div class="music-list">
          <div class="music-list-title">已藏乐谱（${pl.length}）</div>
          ${pl.map(buildRow).join('') || '<p class="hint">暂无</p>'}
        </div>
        <button class="btn-ancient" style="margin-top:12px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    // 绑定
    modal.querySelector('#mu-prev').onclick = () => { a.prevBGM(); this.showMusicPanel(); };
    modal.querySelector('#mu-next').onclick = () => { a.nextBGM(); this.showMusicPanel(); };
    modal.querySelector('#mu-play').onclick = (e) => {
      if (a._bgmOn) { a.stopBGM(); e.target.textContent = '▶'; }
      else { a.startBGM(a.getCurrentBGM() || 'map'); e.target.textContent = '⏸'; }
    };
    modal.querySelector('#mu-mode').onclick = (e) => {
      a.setPlayMode(a.playMode === 'random' ? 'sequential' : 'random');
      e.target.textContent = a.playMode === 'random' ? '🔀' : '🔁';
    };
    modal.querySelector('#mu-master').oninput = (e) => a.setMasterVolume(e.target.value/100);
    modal.querySelector('#mu-bgm').oninput = (e) => a.setBGMVolume(e.target.value/100);
    modal.querySelector('#mu-sfx').oninput = (e) => a.setSFXVolume(e.target.value/100);
    // 点选曲目 / 收藏
    modal.querySelectorAll('.music-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.dataset.fav !== undefined) return;
        const id = row.dataset.bgm;
        if (a.playTrack(id)) this.showMusicPanel();
      };
    });
    modal.querySelectorAll('.music-fav').forEach(star => {
      star.onclick = (e) => {
        e.stopPropagation();
        const id = star.dataset.fav;
        a.toggleFavoriteBGM(id);
        this.showMusicPanel();
      };
    });
    this._syncMusicState();
  }

  // 把 AudioManager 的音乐状态同步到 game.musicState 并持久化
  _syncMusicState() {
    if (!this.game) return;
    try {
      this.game.musicState = this.audio.serializeMusic();
    } catch (e) {}
  }

  // 场景化解锁 BGM（首次播放某场景时解锁对应乐谱）
  unlockSceneBGM(id) {
    try {
      if (this.audio.unlockBGM(id)) {
        this.showNotification && this.showNotification(`🎵 新乐谱入库`, 'success');
      }
      this._syncMusicState();
    } catch (e) {}
  }

  // 从存档/开局恢复音乐状态
  restoreMusicState() {
    try {
      if (this.game && this.game.musicState) this.audio.restoreMusic(this.game.musicState);
    } catch (e) {}
  }

  // ============================================================
  // V9.5 游戏指南（静态说明文档）
  // ============================================================
  openGameGuide() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal guide-modal">
        <h2 class="modal-title">游戏指南</h2>
        <img src="assets/images/taixue_lecture.png" class="guide-hero" onerror="this.style.display='none'">
        <div class="guide-body">
          ${GAME_GUIDE.map(g => `
            <div class="guide-section">
              <h3>${g.title}</h3>
              <p>${g.body}</p>
            </div>
          `).join('')}
        </div>
        <button class="btn-ancient" style="margin-top:12px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
    if (this.audio) try { this.audio.playPanelOpen(); } catch(e){}
  }

  // 右上角成就通知横幅
  showAchToast(a) {
    if (!a) return;
    // V15.0：金色闪光 + 奖杯旋转 + 粒子 成就解锁动画
    this._v15AchievementFlash(a);
  }

  // ============================================================
  // 势力情报
  // ============================================================
  showFactionIntel() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const rows = Object.values(FACTIONS).map(f => {
      const cities = this.game.getFactionCities(f.id);
      const armies = this.game.getFactionArmies(f.id);
      const gens = this.game.getFactionGenerals(f.id);
      const totalTroops = armies.reduce((s, a) => s + a.troops, 0);
      let relText = '我方';
      if (f.id !== this.game.playerFaction && this.game.diplomacy) {
        const rel = this.game.diplomacy.getRelation(this.game.playerFaction, f.id);
        relText = rel.relation > 20 ? '友好' : rel.relation < -20 ? '敌对' : '中立';
      }
      return `
        <div class="intel-row" style="border-left-color:${f.color}">
          <b style="color:${f.color}">${f.name}</b>
          <div class="intel-stats">
            <span>城市 <b>${cities.length}</b></span>
            <span>兵力 <b>${totalTroops}</b></span>
            <span>武将 <b>${gens.length}</b></span>
            <span>关系 <b>${relText}</b></span>
          </div>
        </div>
      `;
    }).join('');
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">势力情报</h2>
        ${rows}
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ============================================================
  // 设置 / 菜单面板
  // ============================================================
  showSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'settings-modal';
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">设置</h2>
        <div class="setting-row">
          <span>主音量</span>
          <input type="range" id="set-master-vol" min="0" max="100" value="${Math.round(this.audio.masterVolume * 100)}">
        </div>
        <div class="setting-row">
          <span>音乐音量</span>
          <input type="range" id="set-bgm-vol" min="0" max="100" value="${Math.round(this.audio.bgmVolume * 100)}">
        </div>
        <div class="setting-row">
          <span>音效音量</span>
          <input type="range" id="set-sfx-vol" min="0" max="100" value="${Math.round(this.audio.sfxVolume * 100)}">
        </div>
        <div class="setting-row">
          <span>静音</span>
          <button class="btn-small" id="set-mute">${this.audio.muted ? '已静音' : '未静音'}</button>
        </div>
        <div class="setting-row">
          <span>背景音乐</span>
          <button class="btn-small" id="set-bgm">${this.audio._bgmOn ? '播放中' : '已暂停'}</button>
        </div>
        <div class="setting-row">
          <span>重看教程</span>
          <button class="btn-small" onclick="__ui_.replayTutorialFromSettings()">开始</button>
        </div>
        <div class="menu-buttons" style="margin-top:16px">
          <button class="btn-ancient" onclick="__ui_.doSave()">保存游戏</button>
          <button class="btn-ancient" onclick="__ui_.doExit()">返回主菜单</button>
        </div>
        <button class="btn-small" style="margin-top:10px;width:100%" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('set-master-vol').oninput = (e) => this.audio.setMasterVolume(e.target.value / 100);
    document.getElementById('set-bgm-vol').oninput = (e) => this.audio.setBGMVolume(e.target.value / 100);
    document.getElementById('set-sfx-vol').oninput = (e) => this.audio.setSFXVolume(e.target.value / 100);
    document.getElementById('set-mute').onclick = (e) => {
      const m = this.audio.toggleMute();
      e.target.textContent = m ? '已静音' : '未静音';
      const topBtn = document.getElementById('btn-mute');
      if (topBtn) { topBtn.textContent = m ? '🔇' : '🔊'; topBtn.classList.toggle('muted', m); }
    };
    document.getElementById('set-bgm').onclick = (e) => {
      if (this.audio._bgmOn) { this.audio.stopBGM(); e.target.textContent = '已暂停'; }
      else { this.audio.startBGM('map'); e.target.textContent = '播放中'; }
    };
  }

  replayTutorialFromSettings() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.tutorial.start();
  }

  doSave() {
    const r = saveGame(this.game);
    this.toast(r.msg);
  }

  doExit() {
    this.audio.stopBGM();
    this._stopBattleAnim();
    this._stopOldBattleAnim();
    if (this.map) this.map.stopLoop();
    this.showMainMenu();
    try { this.audio.switchBGM('menu'); } catch (e) {}
  }

  // V5.5：键盘快捷键
  _bindShortcuts() {
    if (this._boundShortcuts) return;
    this._boundShortcuts = true;
    document.addEventListener('keydown', (e) => {
      if (!this.game) return;
      // 输入框中不触发快捷键
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.endTurn();
          break;
        case 'Escape':
          // 关闭最上层弹窗/面板
          const ov = document.querySelector('.modal-overlay:last-of-type');
          if (ov) ov.remove();
          else {
            this.game.selectedCity = null;
            this.game.selectedArmy = null;
            const pc = document.getElementById('panel-content');
            if (pc) pc.innerHTML = '<p class="hint">点击地图上的城市或军队查看详情</p>';
            if (this.map) { this.map.dirty = true; this.map.render(); this._updateMapMarker(); }
          }
          break;
        // V7.5：1-6 快速切换面板（城市/武将/科技/外交/贸易/王朝）
        case '1': this._showCityList(); break;
        case '2': this._showGeneralList(); break;
        case '3': this.showTechTree(); break;
        case '4': this.showDiplomacy(); break;
        case '5': this.showTradePanel(); break;
        case '6': this.showDynastyPanel(); break;
        // V7.5：M=切换大地图/小地图, C=城市列表, W=武将列表, B=战斗记录
        case 'm': case 'M':
          if (this.map && this.map.toggleZoom) { this.map.toggleZoom(); this.toast('切换地图缩放'); }
          break;
        case 'c': case 'C': this._showCityList(); break;
        case 'w': case 'W': this._showGeneralList(); break;
        case 'b': case 'B': this.showStatsPanel(); break;
      }
    });
  }

  // V7.5：城市列表面板
  _showCityList() {
    const cities = this.game.getFactionCities(this.game.playerFaction);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const rows = cities.map(c => `
      <div class="general-row v81-city-card" data-cid="${c.id}" style="cursor:pointer" onclick="__ui_._cityListPick('${c.id}')">
        <div class="gen-info"><b>${c.name}</b>（${c.morale}%民心）<br>驻军 ${c.garrison || 0}</div>
      </div>`).join('');
    modal.innerHTML = `<div class="modal"><h2 class="modal-title">我的城市</h2>
      ${rows || '<p>暂无城市</p>'}
      <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button></div>`;
    document.body.appendChild(modal);
    this._panelEnter(modal.querySelector('.modal'));
    // V8.1：城市卡片 tooltip
    modal.querySelectorAll('.v81-city-card').forEach(el => {
      const cid = el.dataset.cid;
      this._bindTooltip(el, () => {
        const c = this.game.cities.get(cid);
        if (!c) return '';
        return `<div class="v81-tip-title">${c.name}</div>
          <div class="v81-tip-line">民心：${c.morale}　驻军：${c.garrison || 0}</div>
          <div class="v81-tip-line">人口：${c.pop || 0}　商业：${c.comm || 0}</div>`;
      });
    });
  }
  _cityListPick(cid) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    const c = this.game.cities.get(cid);
    if (c) { this.game.selectedCity = cid; this.showCityPanel(c); if (this.map) { this.map.dirty = true; this.map.render(); this._updateMapMarker(); } }
  }
  // V7.5：武将列表面板（V8.1：卡片微交互 + 负伤暗角 + tooltip）
  _showGeneralList() {
    const gens = this.game.getFactionGenerals(this.game.playerFaction);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const rows = gens.map(g => {
      const wounded = (g.wounded || 0) > 0;
      return `
      <div class="general-row v81-gen-card" data-gid="${g.id}" style="cursor:pointer" onclick="__ui_._genListPick('${g.id}')">
        <div class="portrait-anim-wrap ${wounded ? 'v81-wounded' : ''}" style="width:40px;height:40px;flex-shrink:0">
          <img src="${IMG.portrait(g.portrait)}" class="gen-portrait" style="width:40px;height:40px;object-fit:cover" onerror="this.style.display='none'">
          ${wounded ? '<div class="wounded-overlay"></div>' : ''}
        </div>
        <div class="gen-info"><b>${g.name}</b>（${g.role}）<br>统${g.command} 武${g.force} 智${g.intel} 政${g.politics}</div>
      </div>`;
    }).join('');
    modal.innerHTML = `<div class="modal wide"><h2 class="modal-title">我的武将（${gens.length}）</h2>
      ${rows || '<p>暂无武将</p>'}
      <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">关闭</button></div>`;
    document.body.appendChild(modal);
    this._panelEnter(modal.querySelector('.modal'));
    // V8.1：武将卡片 tooltip（悬停显示五维/忠诚/负伤）
    modal.querySelectorAll('.v81-gen-card').forEach(el => {
      const gid = el.dataset.gid;
      this._bindTooltip(el, () => {
        const g = this.game.getGeneral(gid);
        if (!g) return '';
        const wounded = (g.wounded || 0) > 0;
        return `<div class="v81-tip-title">${g.name} <small>Lv.${g.level || 1}</small></div>
          <div class="v81-tip-line">统${g.command} 武${g.force} 智${g.intel} 政${g.politics}</div>
          <div class="v81-tip-line">忠诚：${g.loyalty}　${wounded ? '<span style="color:#e57373">负伤中</span>' : '无恙'}</div>`;
      });
    });
  }
  _genListPick(gid) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.showGeneralDetail(gid);
  }

  // ---------- 结束回合 ----------
  endTurn() {
    if (this.game.state !== 'playing') return;
    // V5.5：客机结束回合 → 发送指令给主机，不本地结算
    if (this.game.netRole === 'client') {
      this.lan.send({ type: 'endTurn' });
      this.game.state = 'waiting';
      this._showLanOverlay('等待对方行动…');
      this.refreshUI();
      return;
    }
    // V5.5：主机结束回合 → 正常结算后广播给客机
    const prevFid = this.game.playerFaction;
    this.game.endTurn();
    // V8.1：推进昼夜时辰（每回合+2时辰）
    if (this.map && typeof this.map.onTurnEnd === 'function') this.map.onTurnEnd();
    this.map.render();
    this._updateMapMarker();
    this.refreshUI();
    this.checkGameOver();
    // 主机：广播新状态给客机，轮到客机
    if (this.game.netRole === 'host') {
      this._lanBroadcastState('client');
      this._showLanOverlay('等待对方行动…');
    }

    // V5.0：热座模式 —— 若换手到新的人类玩家，弹出就位过渡画面
    if (this.game.isHotSeat && !this.game.gameOver
        && this.game.state === 'playing' && this.game.playerFaction !== prevFid) {
      this._showPlayerTransition(false);
    }

    // 检查是否有待处理事件
    if (this.game.eventSystem.pendingEvents && this.game.eventSystem.pendingEvents.length > 0) {
      this.showEventModal(this.game.eventSystem.pendingEvents.shift());
    }
  }

  // V5.0：热座玩家切换过渡画面（覆盖屏幕，隐藏上一位玩家私密信息）
  _showPlayerTransition(firstStart = false) {
    if (!this.game || !this.game.isHotSeat) return;
    const fac = FACTIONS[this.game.playerFaction];
    if (!fac) return;
    // 关闭所有面板/弹窗，清空选中，避免泄露上一位玩家信息
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.game.selectedCity = null;
    this.game.selectedArmy = null;
    const panel = document.getElementById('panel-content');
    if (panel) panel.innerHTML = '<p class="hint">等待新玩家就位……</p>';

    let ov = document.getElementById('hs-transition');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hs-transition';
      ov.className = 'hs-transition-overlay';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div class="hs-transition-card" style="border-color:${fac.color}">
        <p class="hs-turn-label">${firstStart ? '热座开局' : '轮到你了'}</p>
        <h2 class="hs-faction-name" style="color:${fac.color}">${fac.name}</h2>
        <p class="hs-hint">${firstStart ? '请各方玩家确认座位' : '请将键盘鼠标交给下一位玩家'}</p>
        <p class="hs-secret">（上一位玩家的密探与情报已隐藏）</p>
        <button class="btn-ancient" id="hs-ready">我已就位，开始</button>
      </div>
    `;
    ov.classList.add('show');
    this._updateHotSeatIndicator();
    document.getElementById('hs-ready').onclick = () => {
      ov.classList.remove('show');
      // 新玩家视野刷新
      if (this.map) { this.map.dirty = true; this.map.render(); }
      this.refreshUI();
      this._updateMapMarker();
      this.audio.playClick();
    };
  }

  // V5.0：顶栏当前玩家指示器
  _updateHotSeatIndicator() {
    let el = document.getElementById('hs-indicator');
    if (!this.game || !this.game.isHotSeat) { if (el) el.remove(); return; }
    const fac = FACTIONS[this.game.playerFaction];
    if (!fac) return;
    if (!el) {
      const bar = document.querySelector('.top-bar');
      if (!bar) return;
      el = document.createElement('div');
      el.id = 'hs-indicator';
      el.className = 'top-item hs-indicator';
      bar.insertBefore(el, bar.firstChild);
    }
    el.innerHTML = `热座 · <b style="color:${fac.color}">${fac.name}</b>`;
  }

  showEventModal(event) {
    this.audio.playEventTrigger();
    this.audio.switchBGM('event');
    // V7.5：根据事件名称推断类型图标
    const typeIcon = this._eventTypeIcon(event);
    // V7.5：将 effect 对象转为可读的效果预览文本
    const effectPreview = (eff) => {
      if (!eff) return '';
      const parts = [];
      const fmt = (v, label) => (v > 0 ? `${label}+${v}` : v < 0 ? `${label}${v}` : '');
      if (eff.money) parts.push(fmt(eff.money, '金钱'));
      if (eff.food) parts.push(fmt(eff.food, '粮草'));
      if (eff.morale) parts.push(fmt(eff.morale, '民心'));
      if (eff.pop) parts.push(fmt(eff.pop, '人口'));
      if (eff.comm) parts.push(fmt(eff.comm, '商业'));
      if (eff.prosperity) parts.push(fmt(eff.prosperity, '繁荣'));
      if (eff.armyMorale) parts.push(fmt(eff.armyMorale, '军心'));
      if (eff.factionMorale) parts.push(fmt(eff.factionMorale, '民心'));
      if (eff.culture) parts.push(fmt(eff.culture, '文化'));
      if (eff.tech) parts.push(fmt(eff.tech, '科技'));
      if (eff.barbarianRel) parts.push(fmt(eff.barbarianRel, '蛮族关系'));
      if (eff.recruitRandom) parts.push('招募一将');
      if (eff.massBattle) parts.push('触发大战');
      if (eff.garrisonBuff) parts.push('守城buff');
      if (eff.armyLoss) parts.push(`损兵${eff.armyLoss}`);
      if (eff.destroyTemple) parts.push('灭佛');
      if (eff.generalLoyalty && typeof eff.generalLoyalty === 'object')
        parts.push(`忠诚${eff.generalLoyalty.amt > 0 ? '+' : ''}${eff.generalLoyalty.amt}`);
      return parts.join('，') || '';
    };
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal event-modal">
        <h2 class="modal-title"><span class="event-type-icon">${typeIcon}</span>${event.name}</h2>
        <img src="${IMG.event(event.illustration)}" class="event-img kenburns" onerror="this.style.display='none'">
        <p class="event-desc">${event.description}</p>
        <div class="event-options">
          ${event.options.map((opt, i) => {
            const prev = effectPreview(opt.effect);
            return `<button class="btn-ancient event-option" onclick="__ui_.chooseEvent(${i})">${opt.text}
              ${prev ? `<span class="effect-preview">${prev}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this._panelEnter(modal.querySelector('.modal'));
    this._currentEvent = event;
  }

  // V7.5：根据事件名称/ID推断类型图标
  _eventTypeIcon(event) {
    const n = event.name || '';
    const id = event.id || '';
    if (/星/ .test(n) || /sun|eclipse|meteor|comet|taibai|baihong|yinghuo|laoren|kexing|yue_shi/.test(id)) return '☀';
    if (/寺|佛|禅|经|僧|儒|史|书|诗|画|文|学|雅|胡乐/.test(n)) return '📜';
    if (/战|兵|军|马|城|防|练|弩|铠|燧|水/.test(n)) return '⚔';
    if (/商|市|钱|粮|收|价|丰|水|渠|互|贡/.test(n)) return '💰';
    if (/谏|宗室|和睦|拥戴|安定|朝|党|储|位|禅|帝/.test(n)) return '🏛';
    return '✦';
  }

  chooseEvent(idx) {
    let chosen = null, optText = '', effSummary = [];
    if (this._currentEvent) {
      const ev = this._currentEvent;
      const opt = (ev.options || [])[idx];
      this.game.eventSystem.applyEvent(this.game, ev, idx);
      chosen = ev.name;
      optText = opt ? opt.text : '';
      try {
        effSummary = (this.game.eventSystem && typeof this.game.eventSystem.summarizeEffect === 'function')
          ? this.game.eventSystem.summarizeEffect(opt ? opt.effect : null) : [];
      } catch (e) { effSummary = []; }
      this._currentEvent = null;
    }
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.refreshUI();
    // V8.1：事件选择结果弹窗（效果摘要 + 获得/失去资源）+ 顶部通知
    if (chosen) {
      this._showEventResultPopup(chosen, optText, effSummary);
      try { this.showNotification(`【${chosen}】已抉择`, 'info'); } catch (e) {}
    }
    if (this.game.eventSystem.pendingEvents && this.game.eventSystem.pendingEvents.length > 0) {
      setTimeout(() => this.showEventModal(this.game.eventSystem.pendingEvents.shift()), 300);
    }
  }

  // V8.1：事件选择结果弹窗（显示效果摘要 + 资源得失）
  _showEventResultPopup(eventName, optText, summaryParts) {
    const rows = (summaryParts && summaryParts.length > 0)
      ? summaryParts.map(p => {
          const good = /\+/.test(p) && !/损|去势|灭佛|-/.test(p);
          return `<div class="v81-result-row ${good ? 'v81-pos' : 'v81-neg'}">${p}</div>`;
        }).join('')
      : '<div class="v81-result-row">（无直接数值变化）</div>';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v81-result-overlay';
    modal.innerHTML = `
      <div class="modal v81-result-modal">
        <h3 class="modal-title">抉择结果</h3>
        <p class="v81-result-event">${eventName} — ${optText}</p>
        <div class="v81-result-list">${rows}</div>
        <button class="btn-ancient" onclick="this.closest('.modal-overlay').remove()">知晓了</button>
      </div>`;
    document.body.appendChild(modal);
    this._panelEnter(modal.querySelector('.modal'));
    try { this.audio.playClick(); } catch (e) {}
  }

  closeBattle() {
    // 停止战斗动画循环
    this._stopBattleAnim();
    this._stopOldBattleAnim();
    // 关闭多回合战斗弹窗
    const bm = document.getElementById('battle-modal-root');
    if (bm) bm.remove();
    // 关闭旧版战斗结算弹窗
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      if (ov.querySelector('.battle-modal')) ov.remove();
    });
    this._battleMode = 'old';
    if (this.game && this.game.state === 'battle') this.game.state = 'playing';
    this.audio.switchBGM('map');
    this.refreshUI();
    this.checkGameOver();
  }

  // ---------- 胜负判定 ----------
  checkGameOver() {
    if (this.game.gameOver) {
      const g = this.game;
      const stats = (g.getStats && typeof g.getStats === 'function') ? g.getStats() : null;
      // V7.5：S/A/B/C/D 五级评分（基于回合数/战斗胜率/占领城市）
      let rating = 'C', ratingClass = 'rating-c';
      if (g.gameOver.win) {
        const t = g.turn || 50;
        if (t <= 20) { rating = 'S'; ratingClass = 'rating-s'; }
        else if (t <= 30) { rating = 'A'; ratingClass = 'rating-a'; }
        else if (t <= 40) { rating = 'B'; ratingClass = 'rating-b'; }
        else { rating = 'C'; ratingClass = 'rating-c'; }
      } else {
        rating = 'D'; ratingClass = 'rating-d';
      }
      // V7.5：周目继承提示
      const ngLevel = getCurrentNGPlusLevel();
      const ngHint = g.gameOver.win
        ? `<p class="hint" style="margin-top:10px">◆ 周目继承：新周目 AI 兵力+${(ngLevel+1)*10}% · AI经济+${(ngLevel+1)*5}% ◆</p>` : '';
      // V15.0：通关解锁王朝/文化乐谱 + 盛世华章版结局画面
      try { this.unlockSceneBGM('dynasty'); this.unlockSceneBGM('culture'); } catch(e){}
      this._v15ShowEnding(g);
    }
  }

  // ---------- 数字滚动动画 ----------
  // V8.1：easeOutCubic 缓动；增加时绿闪(.num-increase)，减少时红闪(.num-decrease)；
  //       每元素维护 rAF 句柄，面板关闭/重复调用可清理上一次动画。
  animateNumber(el, from, to, duration = 500) {
    if (!el) return;
    from = Number(from); to = Number(to);
    if (isNaN(from) || isNaN(to)) { el.textContent = to; return; }
    // 清理上一次未完成动画
    if (el._numRaf) { try { cancelAnimationFrame(el._numRaf); } catch (e) {} el._numRaf = null; }
    // 方向闪烁
    el.classList.remove('num-increase', 'num-decrease');
    if (to > from) el.classList.add('num-increase');
    else if (to < from) el.classList.add('num-decrease');
    if (el._numFlashTimer) clearTimeout(el._numFlashTimer);
    el._numFlashTimer = setTimeout(() => el.classList.remove('num-increase', 'num-decrease'), 650);
    if (from === to) { el.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) el._numRaf = requestAnimationFrame(step);
      else el._numRaf = null;
    };
    el._numRaf = requestAnimationFrame(step);
  }

  // ---------- V8.1 通用 Tooltip ----------
  // 鼠标悬停详情浮层：showTooltip(x, y, html) / hideTooltip()
  // 超出屏幕边缘自动翻转；深色半透明 + 金色边框。
  showTooltip(x, y, html) {
    let tip = document.getElementById('v81-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'v81-tooltip';
      tip.className = 'v81-tooltip';
      document.body.appendChild(tip);
    }
    tip.innerHTML = html || '';
    tip.style.opacity = '0';
    tip.style.visibility = 'hidden';
    const pad = 14, tw = tip.offsetWidth || 260, th = tip.offsetHeight || 80;
    let left = x + pad, top = y + pad;
    if (left + tw > window.innerWidth - 8) left = x - tw - pad;
    if (top + th > window.innerHeight - 8) top = y - th - pad;
    left = Math.max(4, left); top = Math.max(4, top);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.opacity = '1';
    tip.style.visibility = 'visible';
  }

  hideTooltip() {
    const tip = document.getElementById('v81-tooltip');
    if (tip) { tip.style.opacity = '0'; tip.style.visibility = 'hidden'; }
  }

  // V8.1：为元素绑定 tooltip（mouseover/move 时根据 buildHtml 生成内容）
  _bindTooltip(el, buildHtml) {
    if (!el) return;
    el.addEventListener('mouseenter', (e) => {
      try {
        const html = (typeof buildHtml === 'function') ? buildHtml() : buildHtml;
        if (html) this.showTooltip(e.clientX, e.clientY, html);
      } catch (err) { /* ignore */ }
    });
    el.addEventListener('mousemove', (e) => {
      try {
        const html = (typeof buildHtml === 'function') ? buildHtml() : buildHtml;
        if (html) this.showTooltip(e.clientX, e.clientY, html);
      } catch (err) { /* ignore */ }
    });
    el.addEventListener('mouseleave', () => this.hideTooltip());
  }

  // ---------- V8.1 顶部通知横幅 ----------
  // showNotification(text, type)：type = info|success|warning|danger
  // 从顶部滑入，停留3s，滑出；最多同时3条，超出排队。
  showNotification(text, type = 'info') {
    let box = document.getElementById('v81-notify-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'v81-notify-box';
      box.className = 'v81-notify-box';
      document.body.appendChild(box);
    }
    this._notifyQueue = this._notifyQueue || [];
    // V13.0：按通知类型配图标 + 底部进度条自动消失
    const iconMap = { info: 'ℹ', success: '✔', warning: '⚠', danger: '✖' };
    const icon = iconMap[type] || 'ℹ';
    const spawn = () => {
      const n = document.createElement('div');
      n.className = `v81-notify v81-notify-${type} v13-notify`;
      n.innerHTML = `<span class="v81-notify-bar"></span>` +
        `<span class="v13-notify-icon">${icon}</span>` +
        `<span class="v81-notify-text">${text}</span>` +
        `<span class="v13-notify-progress"><span class="v13-notify-progress-fill"></span></span>`;
      box.appendChild(n);
      requestAnimationFrame(() => n.classList.add('show'));
      setTimeout(() => {
        n.classList.remove('show');
        n.classList.add('leave');
        setTimeout(() => { n.remove(); this._flushNotifyQueue(); }, 260);
      }, 3000);
    };
    const active = box.querySelectorAll('.v81-notify').length;
    if (active >= 3) { this._notifyQueue.push(spawn); return; }
    spawn();
  }

  _flushNotifyQueue() {
    if (this._notifyQueue && this._notifyQueue.length > 0) {
      const box = document.getElementById('v81-notify-box');
      if (!box || box.querySelectorAll('.v81-notify').length < 3) {
        const next = this._notifyQueue.shift();
        if (next) next();
      }
    }
  }

  // ---------- V8.1 面板过渡动画 ----------
  // 给新注入的面板根元素添加滑入+淡入类；关闭时 .panel-leave 反向动画。
  _panelEnter(root) {
    if (!root) return;
    root.classList.remove('panel-leave');
    root.classList.add('panel-enter');
  }

  // ---------- 打字机效果 ----------
  typeText(el, text, speed = 25) {
    if (!el) return;
    let i = 0;
    el.textContent = '';
    const timer = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(timer);
    }, speed);
  }

  // ---------- 刷新 UI ----------
  refreshUI() {
    if (!this.game) return;
    const res = this.game.getPlayerRes();
    const turnEl = document.getElementById('hdr-turn');
    if (turnEl) turnEl.textContent = this.game.turn;

    // V7.0：年号 / 正统显示
    if (this.game.dynastySystem) {
      const rec = this.game.dynastySystem.get(this.game.playerFaction);
      const eraEl = document.getElementById('hdr-era');
      if (rec && eraEl) {
        eraEl.textContent = `${rec.eraName} ${rec.eraYear}`;
        if (this._prevEra !== rec.eraName + rec.eraYear) {
          eraEl.classList.remove('bump'); void eraEl.offsetWidth; eraEl.classList.add('bump');
        }
        this._prevEra = rec.eraName + rec.eraYear;
      }
      const leg = this.game.dynastySystem.calcLegitimacy(this.game, this.game.playerFaction);
      const legEl = document.getElementById('hdr-legit');
      if (legEl) legEl.textContent = leg;
      // V7.5：正统值进度条
      const legBar = document.getElementById('hdr-legit-bar');
      if (legBar) legBar.style.width = Math.max(0, Math.min(100, leg)) + '%';
    }

    // 季节：变化时旋转动画 + 音效
    const season = this.game.getSeason();
    const seasonEl = document.getElementById('hdr-season');
    if (seasonEl) {
      seasonEl.textContent = `${SEASON_ICON[season] || ''} ${season}`;
      if (this._prevSeason && this._prevSeason !== season) {
        seasonEl.classList.remove('bump');
        void seasonEl.offsetWidth;
        seasonEl.classList.add('bump');
        this.audio.playSeason();
      }
      this._prevSeason = season;
    }

    // V8.5：节气显示
    const solarEl = document.getElementById('hdr-solar');
    if (solarEl && this.game.calendar) {
      const term = this.game.calendar.term;
      solarEl.textContent = `${term.icon} ${term.name}`;
      if (this._prevSolar !== term.id) {
        solarEl.classList.remove('bump'); void solarEl.offsetWidth; solarEl.classList.add('bump');
      }
      this._prevSolar = term.id;
    }

    // V8.1：昼夜时辰显示
    const hourEl = document.getElementById('hdr-hour');
    if (hourEl && this.map && typeof this.map.getHourLabel === 'function') {
      hourEl.textContent = this.map.getTimeOfDay();
    }

    // 数字滚动
    const moneyEl = document.getElementById('hdr-money');
    const foodEl = document.getElementById('hdr-food');
    if (moneyEl && res) this.animateNumber(moneyEl, this._prevRes.money, Math.round(res.money), 500);
    if (foodEl && res) this.animateNumber(foodEl, this._prevRes.food, Math.round(res.food), 500);

    const totalTroops = this.game.getFactionArmies(this.game.playerFaction)
      .reduce((s, a) => s + a.troops, 0);
    const armyEl = document.getElementById('hdr-army');
    if (armyEl) this.animateNumber(armyEl, this._prevRes.army, totalTroops, 500);

    // V13.0：资源变化时的浮动提示（+金钱/粮食/兵力）
    if (res && this._prevRes.money != null) {
      const dm = Math.round(res.money) - this._prevRes.money;
      if (dm) this._spawnResourceFloat(moneyEl, dm, '金');
      const df = Math.round(res.food) - this._prevRes.food;
      if (df) this._spawnResourceFloat(foodEl, df, '粮');
    }
    if (this._prevRes.army != null) {
      const da = totalTroops - this._prevRes.army;
      if (da) this._spawnResourceFloat(armyEl, da, '兵');
    }

    // V9.0：军团数量
    const legionEl = document.getElementById('hdr-legion');
    if (legionEl) {
      const lc = this.game.getFactionLegions ? this.game.getFactionLegions(this.game.playerFaction).length : 0;
      legionEl.textContent = lc;
    }

    if (res) {
      this._prevRes.money = Math.round(res.money);
      this._prevRes.food = Math.round(res.food);
    }
    this._prevRes.army = totalTroops;

    const cities = this.game.getFactionCities(this.game.playerFaction);
    const avgMorale = cities.length > 0
      ? Math.round(cities.reduce((s, c) => s + c.morale, 0) / cities.length) : 0;
    const moraleEl = document.getElementById('hdr-morale');
    if (moraleEl) moraleEl.textContent = avgMorale;

    // 消息日志（仅新行滑入）
    const logEl = document.getElementById('message-log');
    if (logEl) {
      const lines = this.game.log.slice(-30);
      const prevCount = this._prevLogCount || 0;
      logEl.innerHTML = lines.map((l, i) =>
        `<div class="log-line ${i >= prevCount - 1 ? 'new' : ''}">${l}</div>`
      ).join('');
      logEl.scrollTop = logEl.scrollHeight;
      this._prevLogCount = lines.length;
    }

    // 待弹出成就（pendingAchievements 存的是成就 id 字符串，需解析为对象）
    if (this.game.pendingAchievements && this.game.pendingAchievements.length > 0) {
      let achList = [];
      try { achList = this.game.getAchievements ? this.game.getAchievements() : []; } catch (e) {}
      const byId = {};
      for (const a of achList) byId[a.id] = a;
      [...this.game.pendingAchievements].forEach(id => {
        const obj = byId[id] || { icon: '🏆', name: id, description: '' };
        this.showAchToast(obj);
      });
      this.game.pendingAchievements.length = 0;
    }
    // V15.0：主菜单/顶栏成就入口红点提示（有待解锁成就）
    try { this._v15UpdateAchBadge(); } catch (e) {}
    // V3.5：待弹出称号通知
    if (this.game.pendingTitles && this.game.pendingTitles.length > 0) {
      [...this.game.pendingTitles].forEach(t => {
        this.showAchToast({ icon: '👑', name: `称号解锁：${t.title.name}`, description: t.title.desc });
        this.audio.playTitleUnlock();
      });
      this.game.pendingTitles.length = 0;
    }
    // V8.0：科举放榜自动弹窗
    if (this.game.pendingExamResult) {
      const res = this.game.pendingExamResult;
      this.game.pendingExamResult = null;
      this.showExamResultModal(res);
      try { this.audio.playRecruit(); } catch(e) {}
    }

    if (this.map) { this.map.dirty = true; this.map.render(); }
    this._updateMapMarker();
    // V5.0：热座当前玩家指示器
    this._updateHotSeatIndicator();
    // V7.5：结束回合按钮脉冲（游戏进行中时可结束回合）
    const endBtn = document.getElementById('btn-end-turn');
    if (endBtn) {
      if (this.game.state === 'playing') endBtn.classList.add('pulse');
      else endBtn.classList.remove('pulse');
    }
  }

  // ============================================================
  // ============== V14.0「霸业宏图」UI 精修 ====================
  //  新增界面：武将养成 / 内政管理 / 武将单挑 / 兵种进阶 / 图鉴
  //  约定：所有新类名使用 v14- 前缀；API 不存在时优雅降级。
  // ============================================================

  // 五级忠诚度解析：返回 {id,name,color,icon,trend}
  _v14LoyaltyInfo(gen) {
    const raw = (gen && typeof gen.loyalty === 'number') ? gen.loyalty : 50;
    // 优先使用模型层 API，否则本地分级
    let lv = null;
    try { if (gen && typeof gen.getLoyaltyLevel === 'function') lv = gen.getLoyaltyLevel(); } catch (e) {}
    if (!lv) {
      if (raw >= 80) lv = { id: 'devoted', name: '死忠' };
      else if (raw >= 60) lv = { id: 'trusted', name: '信赖' };
      else if (raw >= 40) lv = { id: 'normal', name: '普通' };
      else if (raw >= 20) lv = { id: 'discontent', name: '不满' };
      else lv = { id: 'critical', name: '危殆' };
    }
    const map = {
      devoted:     { color: '#FFD700', icon: '♥' },
      trusted:     { color: '#55cc55', icon: '❤' },
      normal:      { color: '#E8D5A3', icon: '·' },
      discontent:  { color: '#e8a33c', icon: '△' },
      critical:    { color: '#e05555', icon: '✖' }
    };
    const m = map[lv.id] || map.normal;
    // 趋势箭头：以 50 为基准，>60 上升，<40 下降
    const trend = raw > 60 ? '▲' : (raw < 40 ? '▼' : '—');
    return { id: lv.id, name: lv.name, color: m.color, icon: m.icon, trend, raw: Math.round(raw) };
  }

  // 单件装备槽位 HTML（品质色边框 + 属性加成）
  _v14EquipSlotHtml(gen, slot) {
    const slotMeta = { weapon: { icon: '⚔', label: '武器' }, armor: { icon: '🛡', label: '护甲' }, mount: { icon: '🐎', label: '坐骑' }, treasure: { icon: '📿', label: '宝物' } }[slot] || { icon: '❔', label: slot };
    const itemId = gen.equipment && gen.equipment[slot];
    const item = itemId ? getItem(itemId) : null;
    const rar = item ? (RARITIES[item.rarity] || RARITIES.common) : null;
    const borderColor = rar ? rar.color : '#5a4a2a';
    // 属性加成摘要
    let bonusText = '';
    if (item && item.stats) {
      const pieces = Object.entries(item.stats).map(([k, v]) => {
        const keyMap = { force: '武', command: '统', intel: '智', politics: '政', defenseMult: '防%', attackMult: '攻%', cavalryMult: '骑%', troopMax: '兵', moveSpeed: '速', loyalty: '忠', morale: '心' };
        const kn = keyMap[k] || k;
        if (typeof v === 'number' && v < 1) return `${kn}+${Math.round(v * 100)}%`;
        return `${kn}+${v}`;
      });
      bonusText = pieces.join(' ');
    }
    return `
      <div class="v14-equip-slot" data-slot="${slot}" style="--v14-rar:${borderColor}"
           onclick="__ui_._v14EquipPick('${gen.id}','${slot}')" title="点击更换${slotMeta.label}">
        <div class="v14-equip-icon">${slotMeta.icon}</div>
        <div class="v14-equip-name" style="color:${borderColor}">${item ? this._escHtml(item.name) : '— 空 —'}</div>
        <div class="v14-equip-bonus">${item ? this._escHtml(bonusText) : '未装备'}</div>
        ${rar ? `<div class="v14-equip-rar">${rar.name}</div>` : ''}
      </div>`;
  }

  // 装备更换弹窗：列出库存中同槽位装备
  _v14EquipPick(genId, slot) {
    const gen = this.game.getGeneral(genId);
    if (!gen) return;
    const inv = (typeof this.game.getPlayerInventory === 'function') ? this.game.getPlayerInventory() : [];
    const candidates = inv.map(getItem).filter(it => it && it.slot === slot);
    const slotLabel = { weapon: '武器', armor: '护甲', mount: '坐骑', treasure: '宝物' }[slot] || slot;
    const rows = candidates.length === 0
      ? '<p class="v14-empty">库存中暂无可用' + slotLabel + '</p>'
      : candidates.map(it => {
          const rar = RARITIES[it.rarity] || RARITIES.common;
          return `<div class="v14-equip-row" style="--v14-rar:${rar.color}"
              onclick="__ui_._v14DoEquip('${genId}','${slot}','${it.id}')">
              <b style="color:${rar.color}">${this._escHtml(it.name)}</b>
              <span class="v14-equip-desc">${this._escHtml(it.description || '')}</span>
            </div>`;
        }).join('');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <h2 class="modal-title v14-modal-title">选择${slotLabel}</h2>
        <div class="v14-equip-list">${rows}</div>
        <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // 执行穿戴（优雅降级：无 equipItem 则提示）
  _v14DoEquip(genId, slot, itemId) {
    let r = { ok: false, msg: '装备功能暂不可用' };
    try { if (typeof this.game.equipItem === 'function') r = this.game.equipItem(genId, slot, itemId); }
    catch (e) { r = { ok: false, msg: String(e.message || e) }; }
    this.toast(r.msg);
    if (r.ok) {
      this.audio && this.audio.playCoin && this.audio.playCoin();
      document.querySelectorAll('.v14-overlay').forEach(m => m.remove());
      this.showGeneralGrowth(genId);
      this.refreshUI();
    }
  }

  // ============================================================
  //  武将养成界面：等级/经验/技能树/装备/忠诚/属性成长
  // ============================================================
  showGeneralGrowth(genId) {
    const gen = this.game.getGeneral(genId);
    if (!gen) { this.toast('武将不存在'); return; }
    // 等级 / 经验（优雅降级：无 getLevel 则本地取值）
    let level = 1, exp = 0, expNeed = 120;
    try {
      if (typeof gen.getLevel === 'function') level = gen.getLevel();
      if (typeof gen.getExp === 'function') exp = gen.getExp();
      if (typeof gen.getExpToNext === 'function') expNeed = gen.getExpToNext();
    } catch (e) {}
    level = gen.level || level; exp = gen.exp || exp;
    const expPct = Math.min(100, Math.round(exp / Math.max(1, expNeed) * 100));
    // 势力色发光边框
    const fac = gen.faction ? FACTIONS[gen.faction] : null;
    const facColor = fac ? fac.color : '#C4A55A';
    // 忠诚度
    const loy = this._v14LoyaltyInfo(gen);
    // 属性分项：基础 / 等级加成 / 装备加成
    const eqBag = (typeof gen.getEquipmentStats === 'function') ? gen.getEquipmentStats() : {};
    const lvlBonus = Math.max(0, level - 1) * 2; // 每级 +2（与模型一致）
    const attrRow = (label, base, eqv) => {
      const b = Math.round(base || 0), e = Math.round(eqv || 0);
      const total = b + lvlBonus + e;
      return `<div class="v14-attr-row">
        <span class="v14-attr-label">${label}</span>
        <span class="v14-attr-base">${b}</span>
        <span class="v14-attr-plus">+${lvlBonus} 级</span>
        <span class="v14-attr-eq">+${e} 装</span>
        <span class="v14-attr-total">${total}</span>
      </div>`;
    };
    // 技能树：3 个槽位（已解锁显示技能，未解锁按等级要求锁定）
    const ownedSkills = Array.isArray(gen.skills) ? gen.skills : [];
    const skillReqs = [0, 10, 25]; // 三槽解锁等级要求
    let skillSlots = '';
    for (let i = 0; i < 3; i++) {
      const sid = ownedSkills[i];
      const reqLv = skillReqs[i];
      const unlocked = !!sid && level >= reqLv;
      const lockedByLevel = !sid && level < reqLv;
      let sdata = sid ? getSkill(sid) : null;
      if (sid && !sdata) sdata = { name: sid, description: '武将特技' };
      skillSlots += `
        <div class="v14-skill-slot ${unlocked ? 'unlocked' : (lockedByLevel ? 'locked' : 'empty')}">
          <div class="v14-skill-icon">${unlocked ? '✦' : '🔒'}</div>
          <div class="v14-skill-name">${unlocked ? this._escHtml(sdata.name) : (lockedByLevel ? `Lv.${reqLv} 解锁` : '空槽')}</div>
          <div class="v14-skill-desc">${unlocked ? this._escHtml(sdata.description || '') : (lockedByLevel ? `达到 ${reqLv} 级解锁技能` : '暂无技能')}</div>
          ${unlocked && sdata.type ? `<div class="v14-skill-type">${sdata.type === 'active' ? '主动' : '被动'}${sdata.cooldown ? ' · 冷却' + sdata.cooldown : ''}</div>` : ''}
        </div>`;
    }
    // 装备四槽
    const equipHtml = ['weapon', 'armor', 'mount', 'treasure'].map(s => this._v14EquipSlotHtml(gen, s)).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll v14-gen-growth" style="--v14-fac:${facColor}">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <!-- 左侧立绘（势力色发光边框） -->
        <div class="v14-growth-left">
          <div class="v14-portrait-glow" style="--v14-fac:${facColor}">
            <img src="${IMG.portrait(gen.portrait)}" class="v14-portrait" onerror="this.style.display='none'">
          </div>
          <div class="v14-loyalty-badge" style="color:${loy.color}">
            <span class="v14-loyalty-icon">${loy.icon}</span>${loy.name}
            <span class="v14-loyalty-trend">${loy.trend}</span>
          </div>
          <div class="v14-loyalty-bar"><div class="v14-loyalty-fill" style="width:${loy.raw}%;background:${loy.color}"></div></div>
          <div class="v14-loyalty-num">忠诚 ${loy.raw}</div>
        </div>
        <!-- 右侧信息区 -->
        <div class="v14-growth-right">
          <h2 class="modal-title v14-modal-title">${this._escHtml(gen.name)}
            <small class="v14-level-chip">Lv.${level}</small></h2>
          <div class="v14-exp-row">
            <span class="v14-exp-label">经验</span>
            <div class="v14-exp-track"><div class="v14-exp-fill" style="width:${expPct}%"></div></div>
            <span class="v14-exp-num">${exp}/${expNeed}</span>
          </div>
          <div class="v14-section-title">属性成长</div>
          <div class="v14-attr-table">
            ${attrRow('统帅', gen.command, eqBag.command)}
            ${attrRow('武力', gen.force, eqBag.force)}
            ${attrRow('智力', gen.intel, eqBag.intel)}
            ${attrRow('政治', gen.politics, eqBag.politics)}
          </div>
          <div class="v14-section-title">技能树</div>
          <div class="v14-skill-tree">${skillSlots}</div>
          <div class="v14-section-title">装备</div>
          <div class="v14-equip-grid">${equipHtml}</div>
          <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">返回</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    this.audio && this.audio.playHover && this.audio.playHover();
  }

  // ============================================================
  //  内政管理面板：发展 / 建筑 / 税收 / 徭役 四标签
  // ============================================================
  showInternalAffairs(cityId) {
    const city = this.game.cities.get(cityId);
    if (!city) { this.toast('城市不存在'); return; }
    if (city.owner !== this.game.playerFaction) { this.toast('非我方城市'); return; }
    this._v14AffairsCityId = cityId;
    this._v14AffairsTab = this._v14AffairsTab || 'develop';
    this._v14RenderAffairs();
  }

  _v14RenderAffairs() {
    const city = this.game.cities.get(this._v14AffairsCityId);
    if (!city) return;
    const tab = this._v14AffairsTab;
    const tabs = [
      { id: 'develop', label: '发展', icon: '🌾' },
      { id: 'build', label: '建筑', icon: '🏛' },
      { id: 'tax', label: '税收', icon: '💰' },
      { id: 'corvee', label: '徭役', icon: '👷' }
    ];
    let body = '';
    if (tab === 'develop') body = this._v14AffairsDevelop(city);
    else if (tab === 'build') body = this._v14AffairsBuild(city);
    else if (tab === 'tax') body = this._v14AffairsTax(city);
    else if (tab === 'corvee') body = this._v14AffairsCorvee(city);

    const old = document.querySelector('.v14-overlay.v14-affairs');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay v14-affairs';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <h2 class="modal-title v14-modal-title">🏛 ${this._escHtml(city.name)} · 内政</h2>
        <div class="v14-tabs">
          ${tabs.map(t => `<button class="v14-tab ${tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.icon} ${t.label}</button>`).join('')}
        </div>
        <div class="v14-tab-body v14-tab-${tab}">${body}</div>
        <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('.v14-tab').forEach(btn => {
      btn.onclick = () => {
        this._v14AffairsTab = btn.dataset.tab;
        this.audio && this.audio.playClick && this.audio.playClick();
        this._v14RenderAffairs();
      };
    });
  }

  // 发展维度：农业/商业/水利/训练
  _v14AffairsDevelop(city) {
    const drillLv = city.buildings && city.buildings['drill'] || 0;
    const dims = [
      { label: '农业', icon: '🌾', val: city.agri, out: `粮 ${city.calcFood ? city.calcFood(this.game.getSeason()) : '—'}`, act: 'agri' },
      { label: '商业', icon: '💰', val: city.comm, out: `金 ${city.calcIncome ? city.calcIncome(this.game.getSeason()) : '—'}`, act: 'comm' },
      { label: '水利', icon: '💧', val: Math.min(100, (city.agri || 0) * 0.4 + (city.buildings && city.buildings['farm'] || 0) * 4), out: '灌溉加成', act: null },
      { label: '训练', icon: '🎯', val: Math.min(100, drillLv * 10), out: `校场 ${drillLv} 级`, act: null }
    ];
    return dims.map(d => `
      <div class="v14-dev-row">
        <div class="v14-dev-head"><span>${d.icon} ${d.label}</span><b>${Math.round(d.val)}</b></div>
        <div class="v14-dev-bar"><div class="v14-dev-fill" style="width:${Math.min(100, d.val)}%"></div></div>
        <div class="v14-dev-out">当前产出：${d.out}</div>
        ${d.act ? `<button class="btn-small v14-up-btn" onclick="__ui_._v14DevUp('${city.id}','${d.act}')">发展 +5</button>` : ''}
      </div>`).join('');
  }

  _v14DevUp(cityId, act) {
    const city = this.game.cities.get(cityId);
    if (!city) return;
    let result = null;
    try {
      if (act === 'agri' && typeof this.game.cityDevelopAgri === 'function') result = this.game.cityDevelopAgri(cityId);
      else if (act === 'comm' && typeof this.game.cityDevelopComm === 'function') result = this.game.cityDevelopComm(cityId);
    } catch (e) { result = { msg: String(e.message || e) }; }
    this.audio && this.audio.playCoin && this.audio.playCoin();
    this.toast(result && result.msg ? result.msg : '发展完成');
    this._v14RenderAffairs();
    this.refreshUI();
  }

  // 建筑网格
  _v14AffairsBuild(city) {
    let opts = [];
    try { opts = (typeof this.game.getBuildingOptions === 'function') ? this.game.getBuildingOptions(city.id) : []; } catch (e) {}
    if (!opts.length) {
      // 优雅降级：直接遍历 city.buildings + 已知建筑
      opts = Object.values((typeof BUILDINGS !== 'undefined') ? BUILDINGS : []).map(b => ({ ...b, level: (city.buildings || {})[b.id] || 0, canBuild: false }));
    }
    return `<div class="v14-build-grid">` + opts.map(b => {
      const lv = b.level || 0;
      const maxed = lv >= b.maxLevel;
      return `<div class="v14-build-card ${maxed ? 'maxed' : ''}">
        <div class="v14-build-name">${this._escHtml(b.name)}</div>
        <div class="v14-build-lv">Lv.${lv}/${b.maxLevel}</div>
        <div class="v14-build-mini"><div class="v14-build-mini-fill" style="width:${lv / b.maxLevel * 100}%"></div></div>
        <div class="v14-build-desc">${this._escHtml(b.description || '')}</div>
        ${maxed ? '<div class="v14-build-max">已满级</div>'
          : `<button class="btn-small v14-up-btn" onclick="__ui_._v14BuildUp('${city.id}','${b.id}')">${lv === 0 ? '建造' : `升级(¥${150 + 120 * lv})`}</button>`}
      </div>`;
    }).join('') + `</div>`;
  }

  _v14BuildUp(cityId, bid) {
    let r = { ok: false, msg: '建造功能暂不可用' };
    try { if (typeof this.game.buildBuilding === 'function') r = this.game.buildBuilding(cityId, bid); }
    catch (e) { r = { ok: false, msg: String(e.message || e) }; }
    this.audio && this.audio.playCoin && this.audio.playCoin();
    this.toast(r.msg);
    if (r.ok) { this._v14RenderAffairs(); this.refreshUI(); }
  }

  // 税收：税率滑块 + 分项预览
  _v14AffairsTax(city) {
    const rate = city.taxRate || 0;
    const estIncome = city.calcIncome ? city.calcIncome(this.game.getSeason()) : '—';
    const moraleEff = rate > 40 ? '民心下降' : (rate < 20 ? '民心安定' : '民心平稳');
    const taxLv = TAX_LEVELS[(city.taxLevel || 2) - 1] || TAX_LEVELS[1];
    return `
      <div class="v14-tax-block">
        <div class="v14-tax-row"><span>税率</span><b class="v14-tax-big">${rate}%</b></div>
        <input type="range" min="0" max="50" value="${rate}" class="v14-slider" id="v14-tax-slider"
               oninput="__ui_._v14TaxPreview(this.value)">
        <div class="v14-tax-preview" id="v14-tax-preview">预计收入：${estIncome} 金　|　民心：${moraleEff}</div>
        <div class="v14-tax-types">
          <div class="v14-tax-type">🌾 农业税 <b>${Math.round(rate * 0.4)}%</b></div>
          <div class="v14-tax-type">💰 商业税 <b>${Math.round(rate * 0.4)}%</b></div>
          <div class="v14-tax-type">👥 人口税 <b>${Math.round(rate * 0.2)}%</b></div>
        </div>
        <div class="v14-tax-level">当前赋税等级：<b>${taxLv ? taxLv.name : '正常'}</b></div>
        <button class="btn-ancient v14-close" onclick="__ui_._v14TaxApply('${city.id}')">应用税率</button>
      </div>`;
  }

  _v14TaxPreview(v) {
    const el = document.getElementById('v14-tax-preview');
    if (el) el.textContent = `税率 ${v}%　|　民心：${v > 40 ? '民心下降' : (v < 20 ? '民心安定' : '民心平稳')}（拖动后点应用）`;
  }

  _v14TaxApply(cityId) {
    const slider = document.getElementById('v14-tax-slider');
    const rate = slider ? Number(slider.value) : 0;
    let r = { ok: false, msg: '税率调整暂不可用' };
    try { if (typeof this.game.citySetTax === 'function') r = this.game.citySetTax(cityId, rate); }
    catch (e) { r = { ok: false, msg: String(e.message || e) }; }
    this.audio && this.audio.playCoin && this.audio.playCoin();
    this.toast(r.msg);
    this._v14RenderAffairs();
    this.refreshUI();
  }

  // 徭役
  _v14AffairsCorvee(city) {
    const jzjLv = (city.buildings && city.buildings['jiangzuojian']) || 0;
    const active = city.corvee;
    const types = Object.values(CORVEE_TYPES).map(t => `
      <div class="v14-corvee-type">
        <b>${t.icon || '🔨'} ${t.name}</b><p>${this._escHtml(t.description || '')}</p>
        <button class="btn-small" onclick="__ui_._v14CorveeDo('${city.id}','${t.id}')"
          ${(active || jzjLv < 3) ? 'disabled' : ''}>征发</button>
      </div>`).join('');
    return `
      <div class="v14-corvee-status">
        ${active ? `<span class="v14-corvee-active">征发中：${CORVEE_TYPES[active.type] ? CORVEE_TYPES[active.type].name : ''}（剩 ${active.turnsLeft} 回合）</span>
          <button class="btn-small" onclick="__ui_._v14CorveeCancel('${city.id}')">取消</button>`
          : (jzjLv < 3 ? `<span class="v14-corvee-lock">需将作监 ≥ 3 级（当前 ${jzjLv}）</span>` : '<span>可征发徭役</span>')}
      </div>
      <div class="v14-corvee-grid">${types}</div>
      <p class="v14-empty">征发徭役将消耗人口并降低民心，但可加速营建。</p>`;
  }

  _v14CorveeDo(cityId, type) {
    let r = { ok: false, msg: '徭役暂不可用' };
    try { if (typeof this.game.startCorvee === 'function') r = this.game.startCorvee(cityId, type); }
    catch (e) { r = { ok: false, msg: String(e.message || e) }; }
    this.audio && this.audio.playRecruit && this.audio.playRecruit();
    this.toast(r.msg);
    if (r.ok) { this._v14RenderAffairs(); this.refreshUI(); }
  }

  _v14CorveeCancel(cityId) {
    let r = { ok: false, msg: '取消徭役暂不可用' };
    try { if (typeof this.game.cancelCorvee === 'function') r = this.game.cancelCorvee(cityId); } catch (e) {}
    this.toast(r.msg);
    this._v14RenderAffairs();
    this.refreshUI();
  }

  // ============================================================
  //  武将单挑界面：三轮比试 + 血条 + 伤害数字 + 胜负特效
  //  说明：当前版本无 army.executeDuel 后端 API，此处为前端对战演示，
  //        依据双方武力/等级推演，不改变游戏状态（优雅降级）。
  // ============================================================
  showDuel(aId, bId) {
    const a = this.game.getGeneral(aId);
    if (!a) return;
    // 若无指定对手，弹出对手选择
    if (!bId) { this._v14DuelPick(aId); return; }
    const b = this.game.getGeneral(bId);
    if (!b) { this.toast('对手不存在'); return; }

    const facA = a.faction ? FACTIONS[a.faction] : null;
    const facB = b.faction ? FACTIONS[b.faction] : null;
    const power = (g) => (typeof g.effForce === 'number' ? g.effForce : (g.force || 50)) + (g.level || 1) * 1.5;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay v14-duel-overlay';
    modal.innerHTML = `
      <div class="modal v14-duel">
        <div class="v14-duel-arena">
          <div class="v14-duel-side left" style="--v14-fac:${facA ? facA.color : '#C4A55A'}">
            <div class="v14-duel-name">${this._escHtml(a.name)} <small>Lv.${a.level || 1}</small></div>
            <div class="v14-duel-portrait"><img src="${IMG.portrait(a.portrait)}" onerror="this.style.display='none'"></div>
            <div class="v14-duel-hp"><div class="v14-duel-hp-fill" data-side="a"></div></div>
            <div class="v14-duel-force">武力 ${Math.round(power(a))}</div>
          </div>
          <div class="v14-duel-vs">VS</div>
          <div class="v14-duel-side right" style="--v14-fac:${facB ? facB.color : '#8B2500'}">
            <div class="v14-duel-name">${this._escHtml(b.name)} <small>Lv.${b.level || 1}</small></div>
            <div class="v14-duel-portrait"><img src="${IMG.portrait(b.portrait)}" onerror="this.style.display='none'"></div>
            <div class="v14-duel-hp"><div class="v14-duel-hp-fill" data-side="b"></div></div>
            <div class="v14-duel-force">武力 ${Math.round(power(b))}</div>
          </div>
        </div>
        <div class="v14-duel-log" id="v14-duel-log"></div>
        <div class="v14-duel-result" id="v14-duel-result"></div>
        <button class="btn-ancient v14-close" id="v14-duel-close" style="display:none"
          onclick="this.closest('.modal-overlay').remove()">收兵</button>
      </div>`;
    document.body.appendChild(modal);
    try { this.audio.playDuelClash && this.audio.playDuelClash(); } catch (e) {}
    this._v14RunDuel(modal, a, b, power);
  }

  // 对手选择（点击我方武将后选敌将）
  _v14DuelPick(aId) {
    const a = this.game.getGeneral(aId);
    if (!a) return;
    const rivals = this.game.getFactionGenerals ? this.game.getFactionGenerals(null) : [];
    // 在野或敌将均可作为演示对手；取武力较高的 6 名
    const list = (this.game.generals ? [...this.game.generals.values()] : [])
      .filter(g => g.id !== a.id)
      .sort((x, y) => (y.force || 0) - (x.force || 0)).slice(0, 6);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <h2 class="modal-title v14-modal-title">选择 ${this._escHtml(a.name)} 的单挑对手</h2>
        <div class="v14-duel-pick">
          ${list.map(g => `<div class="v14-duel-pick-row" onclick="document.querySelectorAll('.v14-overlay').forEach(m=>m.remove());__ui_.showDuel('${aId}','${g.id}')">
            <b>${this._escHtml(g.name)}</b><small>Lv.${g.level || 1} · 武力 ${g.force || '—'}</small></div>`).join('')}
        </div>
        <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">取消</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // 单挑三轮动画推演
  _v14RunDuel(modal, a, b, powerFn) {
    const log = modal.querySelector('#v14-duel-log');
    const resultEl = modal.querySelector('#v14-duel-result');
    const closeBtn = modal.querySelector('#v14-duel-close');
    const hpA = modal.querySelector('.v14-duel-hp-fill[data-side="a"]');
    const hpB = modal.querySelector('.v14-duel-hp-fill[data-side="b"]');
    const sideA = modal.querySelector('.v14-duel-side.left');
    const sideB = modal.querySelector('.v14-duel-side.right');
    let ha = 100, hb = 100;
    const roundLog = (txt, cls) => {
      const line = document.createElement('div');
      line.className = 'v14-duel-line ' + (cls || '');
      line.textContent = txt;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    };
    hpA.style.width = '100%'; hpB.style.width = '100%';
    let round = 0;
    const step = () => {
      round++;
      if (round > 3 || ha <= 0 || hb <= 0) return finish();
      const pa = powerFn(a), pb = powerFn(b);
      // 每轮双方各攻一次，按武力差 + 随机
      const dmgA = Math.max(6, Math.round(14 + (pa - pb) / 8 + Math.random() * 10));
      const dmgB = Math.max(6, Math.round(14 + (pb - pa) / 8 + Math.random() * 10));
      // A 攻击 B
      sideB.classList.remove('v14-hit'); void sideB.offsetWidth; sideB.classList.add('v14-hit');
      sideA.classList.remove('v14-attack'); void sideA.offsetWidth; sideA.classList.add('v14-attack');
      roundLog(`第 ${round} 合：${a.name} 挥刃斩向 ${b.name}，造成 ${dmgA} 点伤害！`, 'atk');
      hb = Math.max(0, hb - dmgA);
      hpB.style.width = hb + '%';
      setTimeout(() => {
        if (hb <= 0) return finish();
        sideA.classList.remove('v14-hit'); void sideA.offsetWidth; sideA.classList.add('v14-hit');
        sideB.classList.remove('v14-attack'); void sideB.offsetWidth; sideB.classList.add('v14-attack');
        roundLog(`　${b.name} 反击！${a.name} 受创 ${dmgB} 点。`, 'hit');
        ha = Math.max(0, ha - dmgB);
        hpA.style.width = ha + '%';
        setTimeout(step, 900);
      }, 700);
    };
    const finish = () => {
      const win = ha >= hb;
      const winner = win ? a : b;
      const loser = win ? b : a;
      resultEl.className = 'v14-duel-result ' + (win ? 'v14-win' : 'v14-lose');
      resultEl.innerHTML = win
        ? `🏆 ${this._escHtml(winner.name)} 获胜！敌将 ${this._escHtml(loser.name)} 败下阵来！<br><small>我方士气 +10</small>`
        : `☠ ${this._escHtml(loser.name)} 不敌 ${this._escHtml(winner.name)}……<br><small>士气 -5</small>`;
      roundLog(`—— 单挑结束：${winner.name} 胜出 ——`, 'end');
      closeBtn.style.display = '';
    };
    setTimeout(step, 600);
  }

  // ============================================================
  //  兵种进阶界面：基础 → 精锐 → 王牌
  // ============================================================
  showUnitAdvance(cityId) {
    const city = this.game.cities.get(cityId);
    if (!city) { this.toast('城市不存在'); return; }
    if (city.owner !== this.game.playerFaction) { this.toast('非我方城市'); return; }
    const drillLv = (city.buildings && city.buildings['drill']) || 0;
    const res = this.game.getPlayerRes ? this.game.getPlayerRes() : { money: 0, food: 0 };
    // 城中我方军队（用于进阶归属）
    const armies = (this.game.getFactionArmies ? this.game.getFactionArmies(this.game.playerFaction) : [])
      .filter(a => a.cityId === cityId);
    const curArmies = armies.length;
    const tree = ADVANCEMENT_TREE;
    const rows = Object.keys(tree).map(ut => {
      const base = UNIT_TYPES[ut] || { name: ut };
      const nodes = tree[ut];
      // 该兵种当前阶（取城中第一支军队，若无则按 0）
      const curTier = (armies[0] && armies[0].unitTier) ? (armies[0].unitTier[ut] || 0) : 0;
      const pathHtml = nodes.map((n, idx) => {
        const tier = idx + 1;
        const unlocked = curTier >= tier;
        const canDo = curTier === idx && drillLv >= n.drillLevel && res.money >= n.costMoney && res.food >= n.costFood && armies.length;
        const locked = curTier < idx;
        return `<div class="v14-adv-node ${unlocked ? 'done' : (canDo ? 'ready' : 'locked')}">
          <div class="v14-adv-tier">${tier === 1 ? '精锐' : '王牌'}</div>
          <div class="v14-adv-name">${this._escHtml(n.name)}</div>
          <div class="v14-adv-mult">战力 ×${n.mult.toFixed(2)}</div>
          <div class="v14-adv-req">校场 ${n.drillLevel} 级 · ¥${n.costMoney} · 粮${n.costFood}</div>
          ${unlocked ? '<div class="v14-adv-state">已进阶</div>'
            : canDo ? `<button class="btn-small v14-up-btn" onclick="__ui_._v14DoAdvance('${cityId}','${ut}')">进阶</button>`
            : `<div class="v14-adv-state">${locked ? '需先进阶上阶' : (drillLv < n.drillLevel ? `校场不足(${drillLv}/${n.drillLevel})` : '资源不足')}</div>`}
        </div>`;
      }).join('');
      return `<div class="v14-adv-row">
        <div class="v14-adv-base"><span class="v14-adv-base-icon">兵</span>${this._escHtml(base.name)}<small>×${base.coefficient}</small></div>
        <div class="v14-adv-path">${pathHtml}</div>
      </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <h2 class="modal-title v14-modal-title">🎖 ${this._escHtml(city.name)} · 兵种进阶</h2>
        <p class="v14-sub">校场等级：${drillLv}/5　|　城中驻军军队：${curArmies} 支　|　金钱 ${res.money} · 粮 ${res.food}</p>
        <div class="v14-adv-tree">${rows}</div>
        <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }

  _v14DoAdvance(cityId, unitType) {
    // 取城中第一支我方军队作为进阶主体
    const armies = (this.game.getFactionArmies ? this.game.getFactionArmies(this.game.playerFaction) : [])
      .filter(a => a.cityId === cityId);
    if (!armies.length) { this.toast('城中无驻军军队'); return; }
    let r = { ok: false, msg: '进阶功能暂不可用' };
    try { if (typeof this.game.advanceUnit === 'function') r = this.game.advanceUnit(cityId, armies[0].id, unitType); }
    catch (e) { r = { ok: false, msg: String(e.message || e) }; }
    this.audio && this.audio.playRecruit && this.audio.playRecruit();
    this.toast(r.msg);
    if (r.ok) {
      document.querySelectorAll('.v14-overlay').forEach(m => m.remove());
      this.showUnitAdvance(cityId);
      this.refreshUI();
    }
  }

  // ============================================================
  //  图鉴（主菜单入口）：三国题材武将名录概览
  // ============================================================
  showCodex() {
    const list = (typeof GENERALS !== 'undefined') ? GENERALS.slice(0, 24) : [];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v14-overlay';
    modal.innerHTML = `
      <div class="modal v14-modal v14-scroll">
        <div class="v14-modal-corner tl"></div><div class="v14-modal-corner tr"></div>
        <div class="v14-modal-corner bl"></div><div class="v14-modal-corner br"></div>
        <h2 class="modal-title v14-modal-title">📜 群雄图鉴</h2>
        <div class="v14-codex-grid">
          ${list.map(g => `<div class="v14-codex-card">
            <img src="${IMG.portrait(g.portrait)}" onerror="this.style.display='none'">
            <b>${this._escHtml(g.name)}</b>
            <small>武${g.force||'—'} 统${g.command||'—'} 智${g.intel||'—'}</small>
          </div>`).join('')}
        </div>
        <button class="btn-ancient v14-close" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // ---------- 提示 ----------
  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ============================================================
  // ============== V15.0「盛世华章」UI 精修 ======================
  //  约定：所有新类名使用 v15- 前缀；所有模型 API 调用带
  //        typeof === 'function' / 存在性守卫，优雅降级。
  // ============================================================

  // ---------- 通用：古风弹窗骨架（四角装饰 + 标题） ----------
  _v15ModalShell(titleHtml, bodyHtml, extraCls = '') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v15-overlay';
    modal.innerHTML = `
      <div class="modal v15-modal v15-scroll ${extraCls}">
        <div class="v15-corner tl"></div><div class="v15-corner tr"></div>
        <div class="v15-corner bl"></div><div class="v15-corner br"></div>
        <h2 class="modal-title v15-title">${titleHtml}</h2>
        <div class="v15-body">${bodyHtml}</div>
        <button class="btn-ancient v15-close" onclick="this.closest('.v15-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
    if (this.audio && this.audio.playPanelOpen) try { this.audio.playPanelOpen(); } catch (e) {}
    return modal;
  }

  // ============================================================
  // 一、成就系统 UI（对接 achievements.js）
  // ============================================================

  // 段位信息（含到下一段位进度）
  _v15TierInfo(pts) {
    const tiers = [
      { id: 'legendary', name: '传奇', min: 1000, color: '#FF4D6D' },
      { id: 'diamond',   name: '钻石', min: 700,  color: '#4FC3F7' },
      { id: 'platinum',  name: '白金', min: 450,  color: '#E0E0E0' },
      { id: 'gold',      name: '黄金', min: 250,  color: '#FFD54F' },
      { id: 'silver',    name: '白银', min: 100,  color: '#B0BEC5' },
      { id: 'bronze',    name: '青铜', min: 0,    color: '#B8845A' }
    ];
    let cur = tiers[tiers.length - 1];
    let next = null;
    for (const t of tiers) { if (pts >= t.min) { cur = t; break; } }
    const idx = tiers.indexOf(cur);
    if (idx > 0) next = tiers[idx - 1];
    let pct = 100, needText = '已达最高段位';
    if (next) {
      const span = next.min - cur.min;
      pct = Math.max(0, Math.min(100, Math.round((pts - cur.min) / Math.max(1, span) * 100)));
      needText = `距「${next.name}」还需 ${next.min - pts} 点`;
    }
    return { cur, next, pct, needText, pts };
  }

  // 成就进度（启发式：已解锁=100%；否则按已知数据估算）
  _v15AchProgress(ach) {
    if (!ach || ach.unlocked) return ach && ach.unlocked ? { pct: 100, text: '已解锁' } : { pct: 0, text: '' };
    let pct = 0, text = '';
    const g = this.game;
    try {
      const res = (g && g.getPlayerRes) ? g.getPlayerRes() : null;
      switch (ach.id) {
        case 'rich': if (res) { pct = Math.min(100, res.money / 100); text = `金钱 ${Math.round(res.money)}/10000`; } break;
        case 'money_100k': if (res) { pct = Math.min(100, res.money / 1000); text = `金钱 ${Math.round(res.money)}/100000`; } break;
        case 'food_50k': if (res) { pct = Math.min(100, res.food / 500); text = `粮草 ${Math.round(res.food)}/50000`; } break;
        case 'first_turn': pct = Math.min(100, (g.turn || 0) / 2 * 100); text = `第 ${g.turn || 1} 回合`; break;
        case 'cities_20': pct = Math.min(100, ((g.stats && g.stats.citiesConquered) || 0) / 20 * 100); text = `占城 ${(g.stats && g.stats.citiesConquered) || 0}/20`; break;
        case 'conquer_first': pct = Math.min(100, ((g.stats && g.stats.citiesConquered) || 0) > 0 ? 100 : 0); break;
        case 'warlord': pct = Math.min(100, (g.turn || 0) / 50 * 100); text = `第 ${g.turn || 0}/50 回合`; break;
        default: pct = 0; text = '未解锁';
      }
    } catch (e) { pct = 0; text = '未解锁'; }
    return { pct: Math.round(pct), text };
  }

  // 成就总览面板（按分类 + 段位徽章 + 统计）
  showAchievementsV15() {
    let list = [];
    try { list = (this.game.getAchievements && typeof this.game.getAchievements === 'function') ? (this.game.getAchievements() || []) : []; }
    catch (e) { list = []; }
    const pts = getAchievementPoints(this.game);
    const tier = this._v15TierInfo(pts);
    const unlocked = list.filter(a => a.unlocked).length;
    const total = list.length;
    const unlockedPts = list.filter(a => a.unlocked).reduce((s, a) => s + (a.points || 10), 0);

    const catOrder = ['military', 'politics', 'economy', 'person', 'special'];
    const groups = catOrder.map(c => ({
      cat: c,
      meta: (typeof ACH_CATEGORIES !== 'undefined' && ACH_CATEGORIES[c]) || { name: c, icon: '•' },
      items: list.filter(a => (a.category || 'special') === c)
    })).filter(g => g.items.length);

    // 分类切换（默认全部分类）
    const tabBar = `<div class="v15-ach-tabs">
        <button class="v15-ach-tab active" data-cat="all">全部</button>
        ${catOrder.map(c => {
          const m = (typeof ACH_CATEGORIES !== 'undefined' && ACH_CATEGORIES[c]) || { name: c, icon: '•' };
          return `<button class="v15-ach-tab" data-cat="${c}">${m.icon} ${m.name}</button>`;
        }).join('')}
      </div>`;

    const hero = `
      <div class="v15-ach-hero" style="--v15-tier:${tier.cur.color}">
        <div class="v15-tier-badge" style="color:${tier.cur.color};border-color:${tier.cur.color}">
          <span class="v15-tier-gem">◆</span>${tier.cur.name}
        </div>
        <div class="v15-tier-progress">
          <div class="v15-tier-track"><div class="v15-tier-fill" style="width:${tier.pct}%;background:${tier.cur.color}"></div></div>
          <div class="v15-tier-num">${pts} 成就点 · ${tier.needText}</div>
        </div>
        <div class="v15-ach-stats">
          <div class="v15-stat"><span>已解锁</span><b>${unlocked}/${total}</b></div>
          <div class="v15-stat"><span>成就总分</span><b>${unlockedPts}</b></div>
          <div class="v15-stat"><span>完成率</span><b>${total ? Math.round(unlocked / total * 100) : 0}%</b></div>
        </div>
      </div>`;

    const grid = groups.map(g => `
      <div class="v15-ach-group" data-cat="${g.cat}">
        <h3 class="v15-ach-cat-title">${g.meta.icon} ${g.meta.name}</h3>
        <div class="v15-ach-grid">
          ${g.items.map(a => {
            const pr = this._v15AchProgress(a);
            return `<div class="v15-ach-item ${a.unlocked ? 'unlocked' : 'locked'}">
              <div class="v15-ach-icon">${a.unlocked ? (a.icon || '🏆') : '🔒'}</div>
              <div class="v15-ach-name">${a.unlocked ? this._escHtml(a.name || '???') : '？？？'}</div>
              <div class="v15-ach-desc">${a.unlocked ? this._escHtml(a.description || '') : '尚未解锁，继续努力'}</div>
              <div class="v15-ach-prog"><div class="v15-ach-prog-track"><div class="v15-ach-prog-fill" style="width:${pr.pct}%"></div></div><span>${pr.text}</span></div>
              <div class="v15-ach-reward">${this._achRewardText(a)}</div>
              <div class="v15-ach-points">+${a.points || 10} 分 ${a.unlocked && a.unlockTurn ? `· 第${a.unlockTurn}回合` : ''}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');

    const modal = this._v15ModalShell('🏆 成就殿堂 · 盛世华章', hero + tabBar + `<div class="v15-ach-groups">${grid}</div>`);
    // 分类切换
    modal.querySelectorAll('.v15-ach-tab').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.v15-ach-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        modal.querySelectorAll('.v15-ach-group').forEach(grp => {
          grp.style.display = (cat === 'all' || grp.dataset.cat === cat) ? '' : 'none';
        });
        if (this.audio && this.audio.playClick) try { this.audio.playClick(); } catch (e) {}
      };
    });
  }

  // 成就解锁弹窗（金色闪光 + 奖杯旋转 + 粒子，性能保护）
  _v15AchievementFlash(ach) {
    if (!ach) return;
    const wrap = document.createElement('div');
    wrap.className = 'v15-ach-flash';
    wrap.innerHTML = `
      <div class="v15-flash-golden"></div>
      <div class="v15-flash-card">
        <div class="v15-flash-trophy">${ach.icon || '🏆'}</div>
        <div class="v15-flash-label">★ 成就解锁 ★</div>
        <div class="v15-flash-name">${this._escHtml(ach.name || '')}</div>
        <div class="v15-flash-desc">${this._escHtml(ach.description || '')}</div>
        <div class="v15-flash-reward">${this._achRewardText(ach)}</div>
      </div>`;
    document.body.appendChild(wrap);
    // 金色粒子（DOM，上限 28 个，自动清理）
    const N = 28;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span');
      p.className = 'v15-flash-particle';
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      wrap.appendChild(p);
    }
    requestAnimationFrame(() => wrap.classList.add('show'));
    if (this.audio && this.audio.playAchievement) try { this.audio.playAchievement(); } catch (e) {}
    try { this.showNotification(`成就解锁：${ach.name || ''}`, 'success'); } catch (e) {}
    setTimeout(() => {
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 700);
    }, 3200);
  }

  // ============================================================
  // 二、结局画面 UI（对接 ending.js / gameOver）
  // ============================================================

  // 结局类型 → 背景风格
  _v15EndingBgClass(endingObj, win) {
    const id = (endingObj && endingObj.id) || '';
    if (id === 'unify' || id === 'abdicate' || id === 'perfect') return 'v15-ending-gold';
    if (id === 'perish') return 'v15-ending-dark';
    if (id === 'refuge') return 'v15-ending-mist';
    if (id === 'standoff' || id === 'history_repeat') return 'v15-ending-twilight';
    if (id === 'usurp' || id === 'barbarian_takeover') return 'v15-ending-crimson';
    return win ? 'v15-ending-gold' : 'v15-ending-dark';
  }

  // 评级颜色 / 动画等级
  _v15RankStyle(rank) {
    const map = {
      S: { color: '#FFD700', cls: 'v15-rank-s' },
      A: { color: '#D9D9D9', cls: 'v15-rank-a' },
      B: { color: '#CD7F32', cls: 'v15-rank-b' },
      C: { color: '#9AA58C', cls: 'v15-rank-c' },
      D: { color: '#8C8C8C', cls: 'v15-rank-d' }
    };
    return map[rank] || map.C;
  }

  // 结局结算画面
  _v15ShowEnding(g) {
    const endingObj = (g.currentEndingObj && typeof g.currentEndingObj === 'object')
      ? g.currentEndingObj : (g.endings && g.endings.current) || null;
    const win = !!(g.gameOver && g.gameOver.win);
    // 结局名称
    const title = (endingObj && endingObj.name) ? endingObj.name : (win ? '一统天下' : '亡国之君');
    // 评级：优先结局自带 rank，否则按回合推算
    let rank = (endingObj && endingObj.rank) ? endingObj.rank : (win ? 'S' : 'D');
    rank = String(rank).toUpperCase();
    const rStyle = this._v15RankStyle(rank);
    // 叙事文本：结局自带文本优先，否则用 gameOver.text
    let narrative = (endingObj && endingObj.text) ? endingObj.text : (g.gameOver.text || '');
    // 战绩统计
    const stats = (g.getStats && typeof g.getStats === 'function') ? g.getStats() : {};
    const playTime = (typeof formatPlayTime === 'function') ? formatPlayTime(stats.playTime) : '—';
    const achCount = Object.keys(g.achievements || {}).length;
    const citiesConq = stats.citiesConquered || 0;
    const genRecruited = stats.recruited || 0;
    const turns = g.turn || 0;
    const bgCls = this._v15EndingBgClass(endingObj, win);

    const statsHtml = `
      <div class="v15-ending-stats">
        <div class="v15-estat"><span>游戏时长</span><b>${playTime}</b></div>
        <div class="v15-estat"><span>回合数</span><b>${turns}</b></div>
        <div class="v15-estat"><span>占领城市</span><b>${citiesConq}</b></div>
        <div class="v15-estat"><span>招募武将</span><b>${genRecruited}</b></div>
        <div class="v15-estat"><span>成就数</span><b>${achCount}</b></div>
        <div class="v15-estat"><span>战斗胜率</span><b>${stats.winRate || 0}%</b></div>
      </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'modal-overlay v15-ending-overlay';
    wrap.innerHTML = `
      <div class="v15-ending-bg ${bgCls}"></div>
      <div class="v15-ending-stage">
        <div class="v15-ending-scroll">
          <div class="v15-ending-title">${this._escHtml(title)}</div>
          <div class="v15-ending-rank ${rStyle.cls}" style="color:${rStyle.color};text-shadow:0 0 24px ${rStyle.color}">${rank}</div>
          <div class="v15-ending-rank-label">${win ? '盛世华章' : '乱世余音'} · 评级</div>
          <div class="v15-ending-narrative">${this._escHtml(narrative)}</div>
          ${statsHtml}
          <div class="v15-ending-actions">
            <button class="btn-ancient v15-btn-again" id="v15-again">重新开始</button>
            <button class="btn-ancient v15-btn-save" id="v15-save-record">保存战绩</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    // 评级金光爆发（按等级）
    this._v15RatingBurst(rank, wrap);
    // 结局配乐
    if (this.audio) {
      try { this.audio.switchBGM && this.audio.switchBGM('ending'); } catch (e) {}
      if (win && this.audio.playUnifyChina) try { this.audio.playUnifyChina(); } catch (e) {}
      if (!win && this.audio.playDynastyFall) try { this.audio.playDynastyFall(); } catch (e) {}
    }
    // 重新开始
    const again = wrap.querySelector('#v15-again');
    if (again) again.onclick = () => {
      wrap.remove();
      this.showFactionSelect && this.showFactionSelect();
    };
    const saveBtn = wrap.querySelector('#v15-save-record');
    if (saveBtn) saveBtn.onclick = () => {
      try {
        if (typeof saveGame === 'function') { saveGame(g); }
        this.toast('战绩已保存至存档');
      } catch (e) { this.toast('保存失败'); }
    };
  }

  // 评级爆发动画：S 金光四射 / A 银辉 / B 铜光 / C / D 灰寂
  _v15RatingBurst(rank, wrap) {
    const rankMap = { S: 36, A: 24, B: 16, C: 8, D: 4 };
    const N = rankMap[rank] || 8;
    const colors = {
      S: 'rgba(255,215,0,0.95)', A: 'rgba(220,225,235,0.9)',
      B: 'rgba(205,127,50,0.9)', C: 'rgba(154,165,140,0.8)', D: 'rgba(140,140,140,0.7)'
    };
    const color = colors[rank] || colors.C;
    const stage = wrap.querySelector('.v15-ending-stage');
    if (!stage) return;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span');
      p.className = 'v15-rank-spark';
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (rank === 'S' ? 180 : 120) + Math.random() * 120;
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      p.style.background = color;
      p.style.boxShadow = `0 0 8px ${color}`;
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      stage.appendChild(p);
    }
    // 3.5s 后清理粒子
    setTimeout(() => { wrap.querySelectorAll('.v15-rank-spark').forEach(p => p.remove()); }, 4000);
  }

  // ============================================================
  // 三、外交面板 UI（对接 diplomacy.js）
  // ============================================================

  // 关系等级 → {name,color,icon}
  _v15RelLevel(rel, flags) {
    const v = (rel == null ? 0 : rel.relation);
    const war = flags && flags.war;
    if (war || v <= -60) return { name: '战争', color: '#B3242A', icon: '⚔' };
    if (v <= -30) return { name: '敌对', color: '#E05555', icon: '☠' };
    if (v < 0) return { name: '紧张', color: '#E8A33C', icon: '⚠' };
    if (v < 20) return { name: '中立', color: '#B8A575', icon: '·' };
    if (v < 50) return { name: '友好', color: '#6FCF6F', icon: '♥' };
    return { name: '亲密', color: '#3FA66A', icon: '❤' };
  }

  // 外交接受概率（启发式，基于关系）
  _v15DiploAcceptProb(relVal, base) {
    const v = (relVal == null ? 0 : relVal);
    const p = (base || 0.5) + v / 200;
    return Math.max(5, Math.min(95, Math.round(p * 100)));
  }

  showDiplomacyV15() {
    const g = this.game;
    const me = g.playerFaction;
    if (!g.diplomacy) { this.toast('外交系统未就绪'); return; }
    const otherFactions = Object.values(FACTIONS).filter(f => f.id !== me);
    const res = g.getPlayerRes ? g.getPlayerRes() : { money: 0 };

    const rows = otherFactions.map(f => {
      const rel = g.diplomacy.getRelation(me, f.id) || { relation: 0, alliance: false, ceasefire: false };
      const lvl = this._v15RelLevel(rel);
      const hasMarriage = (g.diplomacy.getActiveMarriage && typeof g.diplomacy.getActiveMarriage === 'function')
        ? g.diplomacy.getActiveMarriage(g, me, f.id) : null;
      const tradeOk = (g.tradeSystem && g.tradeSystem.hasAgreement) ? g.tradeSystem.hasAgreement(me, f.id) : false;
      // 可策反武将
      let bribable = [];
      try { bribable = g.getFactionGenerals(f.id).filter(x => x.loyalty < 40); } catch (e) {}
      const flags = [];
      if (rel.alliance) flags.push('<span class="v15-dip-flag">同盟</span>');
      if (rel.ceasefire) flags.push('<span class="v15-dip-flag">停战</span>');
      if (hasMarriage) flags.push('<span class="v15-dip-flag">联姻</span>');
      if (tradeOk) flags.push('<span class="v15-dip-flag">互市</span>');

      return `<div class="v15-dip-row" style="--v15-fac:${f.color};border-left-color:${f.color}">
        <div class="v15-dip-head">
          <b style="color:${f.color}">${this._escHtml(f.name)}</b>
          <span class="v15-dip-level" style="color:${lvl.color}">${lvl.icon} ${lvl.name}</span>
          <span class="v15-dip-val">关系 ${rel.relation > 0 ? '+' : ''}${rel.relation}</span>
        </div>
        <div class="v15-dip-flags">${flags.join(' ') || '<span class="v15-dip-flag none">无盟好</span>'}</div>
        <div class="v15-dip-actions">
          <button class="btn-small" onclick="__ui_._v15DiploAsk('marriage','${f.id}')">💍 联姻</button>
          <button class="btn-small" onclick="__ui_._v15DiploAsk('hostage','${f.id}')">🕊 质子</button>
          <button class="btn-small" onclick="__ui_._v15DiploAsk('alliance','${f.id}')">🤝 联合讨伐</button>
          <button class="btn-small" onclick="__ui_._v15DiploAsk('trade','${f.id}')">⚖ 贸易协定</button>
          <button class="btn-small" onclick="__ui_._v15DiploAsk('pass','${f.id}')">🚩 军事通行</button>
          ${bribable.length ? `<button class="btn-small" onclick="__ui_._v15DiploAsk('bribe','${f.id}','${bribable[0].id}')">🗡 策反${this._escHtml(bribable[0].name)}</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const body = `<div class="v15-dip-banner">💰 当前金 ${Math.round(res.money || 0)} · 关系越好，外交越易成功</div>
      <div class="v15-dip-list">${rows}</div>`;
    this._v15ModalShell('🕊 外交中枢', body);
  }

  // 外交提议确认弹窗（内容 + 接受概率 + 消耗）
  _v15DiploAsk(action, targetFid, generalId) {
    const g = this.game;
    const f = FACTIONS[targetFid];
    const rel = g.diplomacy.getRelation(g.playerFaction, targetFid) || { relation: 0 };
    const costMap = { marriage: { money: 0, food: 0 }, hostage: { money: 0, food: 0 },
      alliance: { money: 0, food: 0 }, trade: { money: 0, food: 0 },
      pass: { money: 200, food: 0 }, bribe: { money: 800, food: 0 } };
    const baseMap = { marriage: 0.45, hostage: 0.6, alliance: 0.5, trade: 0.6, pass: 0.65, bribe: 0.3 };
    const cost = costMap[action] || { money: 0, food: 0 };
    const prob = this._v15DiploAcceptProb(rel.relation, baseMap[action] || 0.5);
    const actionName = { marriage: '联姻', hostage: '送人质', alliance: '结盟/联合讨伐', trade: '贸易协定', pass: '军事通行', bribe: '策反' }[action] || action;
    const desc = {
      marriage: `与 ${f.name} 永结两姓之好，关系大增，互不攻伐，通商厚利。`,
      hostage: `遣一名闲居武将赴 ${f.name} 为质，稳固盟好（关系≥0 可召回）。`,
      alliance: `与 ${f.name} 结盟，共同讨伐不臣，关系+30。`,
      trade: `与 ${f.name} 互市通商，双方商税互通（需关系≥40）。`,
      pass: `获准借道 ${f.name} 疆域行军，耗金 200。`,
      bribe: `重金收买 ${f.name} 麾下低忠诚武将，耗金 800。`
    }[action];

    const old = document.querySelector('.v15-overlay.v15-dip-confirm');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v15-overlay v15-dip-confirm';
    modal.innerHTML = `
      <div class="modal v15-modal v15-scroll">
        <div class="v15-corner tl"></div><div class="v15-corner tr"></div>
        <div class="v15-corner bl"></div><div class="v15-corner br"></div>
        <h2 class="modal-title v15-title">确认外交：${actionName}</h2>
        <div class="v15-body">
          <div class="v15-dip-desc">${this._escHtml(desc || '')}</div>
          <div class="v15-dip-prob">
            <span>对方接受概率</span>
            <div class="v15-prob-track"><div class="v15-prob-fill" style="width:${prob}%;background:${prob > 60 ? '#6FCF6F' : prob > 35 ? '#E8A33C' : '#E05555'}"></div></div>
            <b style="color:${prob > 60 ? '#6FCF6F' : prob > 35 ? '#E8A33C' : '#E05555'}">${prob}%</b>
          </div>
          <div class="v15-dip-cost">消耗：${cost.money ? `金 ${cost.money}` : ''}${cost.food ? `粮 ${cost.food}` : ''}${(!cost.money && !cost.food) ? '无' : ''}</div>
          <div class="v15-dip-btns">
            <button class="btn-ancient" id="v15-dip-yes">遣使</button>
            <button class="btn-ancient" onclick="this.closest('.v15-overlay').remove()">作罢</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#v15-dip-yes').onclick = () => {
      modal.remove();
      this._v15DiploDo(action, targetFid, generalId);
    };
  }

  // 执行外交行动（对接 game / diplomacy 接口）
  _v15DiploDo(action, targetFid, generalId) {
    const g = this.game;
    let result = { ok: false, msg: '该外交行动暂不可用' };
    try {
      switch (action) {
        case 'marriage': {
          const cand = g.getFactionGenerals(g.playerFaction).filter(x => !x.married && !x.inArmy && x.role !== '君主')[0];
          if (!cand) { this._v15Notify('联姻', '我方无未婚可联姻武将', 'warn'); return; }
          result = (g.proposeMarriage && typeof g.proposeMarriage === 'function')
            ? g.proposeMarriage(targetFid, cand.id) : { ok: false, msg: '联姻接口未就绪' };
          break;
        }
        case 'hostage': {
          const cand = g.getFactionGenerals(g.playerFaction).filter(x => !x.inArmy && x.role !== '君主')[0];
          if (!cand) { this._v15Notify('质子', '无可用武将为质', 'warn'); return; }
          result = (g.sendHostage && typeof g.sendHostage === 'function')
            ? g.sendHostage(targetFid, cand.id) : { ok: false, msg: '质子接口未就绪' };
          break;
        }
        case 'alliance':
          result = g.diplomacy.proposeAlliance(g.playerFaction, targetFid);
          break;
        case 'trade':
          result = (g.proposeTradeAgreement && typeof g.proposeTradeAgreement === 'function')
            ? g.proposeTradeAgreement(targetFid) : { ok: false, msg: '通商接口未就绪' };
          break;
        case 'pass': {
          const rel = g.diplomacy.getRelation(g.playerFaction, targetFid);
          if (rel) rel.relation = Math.min(100, rel.relation + 5);
          const res = g.getPlayerRes && g.getPlayerRes();
          if (res && res.money >= 200) { res.money -= 200; result = { ok: true, msg: `已获准借道 ${FACTIONS[targetFid].name} 疆域` }; }
          else result = { ok: false, msg: '金钱不足（需 200 金）' };
          break;
        }
        case 'bribe':
          result = g.diplomacy.bribeGeneral(g, targetFid, generalId || '', 800);
          break;
      }
    } catch (e) { result = { ok: false, msg: String(e.message || e) }; }
    this._v15Notify(action === 'marriage' ? '联姻' : action === 'hostage' ? '质子' : action === 'alliance' ? '盟约' : action === 'trade' ? '互市' : '外交', result.msg, result.ok ? 'success' : 'warn');
    if (this.audio && result.ok && this.audio.playCoin) try { this.audio.playCoin(); } catch (e) {}
    // 刷新外交面板
    document.querySelectorAll('.v15-overlay').forEach(m => m.remove());
    if (this.game.state === 'playing') this.showDiplomacyV15();
    this.refreshUI && this.refreshUI();
  }

  // 外交/事件通知横幅
  _v15Notify(title, text, type) {
    const cls = type === 'success' ? 'v15-notify-success' : type === 'warn' ? 'v15-notify-warn' : '';
    const bar = document.createElement('div');
    bar.className = `v15-notify ${cls}`;
    bar.innerHTML = `<b>${this._escHtml(title)}</b><span>${this._escHtml(text || '')}</span>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));
    setTimeout(() => { bar.classList.remove('show'); setTimeout(() => bar.remove(), 600); }, 3200);
  }

  // ============================================================
  // 四、谍报面板 UI（对接 espionage.js）
  // ============================================================
  showEspionagePanel() {
    const g = this.game;
    const me = g.playerFaction;
    const res = g.getPlayerRes ? g.getPlayerRes() : { money: 0 };
    // 候选密探：闲居、非君主
    let spies = [];
    try { spies = g.getFactionGenerals(me).filter(x => !x.inArmy && !x.onHostage && x.role !== '君主')
      .sort((a, b) => (b.effIntel || b.intel || 0) - (a.effIntel || a.intel || 0)); } catch (e) {}
    // 可刺探目标：非我方城市
    let targets = [];
    try { targets = [...g.cities.values()].filter(c => c.owner && c.owner !== me); } catch (e) {}
    const SPY_COST_LOCAL = { intel: 500, sabotage: 1200, defect: 2000 };
    const missions = [
      { id: 'intel', name: '刺探情报', desc: '探明兵力/城防，授予 3 回合临时视野' },
      { id: 'sabotage', name: '破坏', desc: '随机破坏农业/商业/城防（-5~-15）' },
      { id: 'defect', name: '策反', desc: '诱降城中低忠诚武将率部投诚' }
    ];
    const activeSpies = Array.isArray(g.spies) ? g.spies.filter(s => s.faction === me) : [];

    const spyOpts = spies.length ? spies.map(s =>
      `<option value="${s.id}">${this._escHtml(s.name)}（智${s.effIntel || s.intel || 50}）</option>`).join('') : '<option value="">无可用密探</option>';
    const targetOpts = targets.length ? targets.map(t =>
      `<option value="${t.id}">${this._escHtml(t.name)}（${FACTIONS[t.owner] ? FACTIONS[t.owner].name : '敌'}）</option>`).join('') : '<option value="">无可刺探城市</option>';
    const missionOpts = missions.map(m =>
      `<option value="${m.id}">${m.name}（耗${SPY_COST_LOCAL[m.id]}金）</option>`).join('');

    const history = activeSpies.length ? activeSpies.map(s => {
      const city = g.cities.get(s.targetCity);
      const mName = missions.find(m => m.id === s.mission);
      const st = s.status === 'success' ? '<span style="color:#6FCF6F">成功</span>'
        : s.status === 'caught' ? '<span style="color:#E05555">暴露被处决</span>'
        : s.status === 'failed' ? '<span style="color:#E8A33C">未得手</span>'
        : `<span style="color:#B8A575">进行中·剩${s.turnsLeft}回合</span>`;
      return `<div class="v15-spy-row"><b>${this._escHtml(mName ? mName.name : s.mission)}</b>
        <span>→ ${this._escHtml(city ? city.name : s.targetCity)}</span>${st}</div>`;
    }).join('') : '<p class="v15-empty">暂无谍报行动记录。</p>';

    const body = `
      <div class="v15-spy-banner">💰 当前金 ${Math.round(res.money || 0)} · 密探智力越高，成功率越大</div>
      <div class="v15-spy-form">
        <label class="v15-field"><span>密探武将</span><select id="v15-spy-gen">${spyOpts}</select></label>
        <label class="v15-field"><span>目标城市</span><select id="v15-spy-city">${targetOpts}</select></label>
        <label class="v15-field"><span>行动类型</span><select id="v15-spy-mission">${missionOpts}</select></label>
        <div class="v15-spy-prob"><span>预估成功率</span><b id="v15-spy-prob-num">—</b></div>
        <button class="btn-ancient" id="v15-spy-send">遣出密探</button>
      </div>
      <div class="v15-spy-mission-desc" id="v15-spy-mdesc">${missions[0].desc}</div>
      <h3 class="v15-sub">谍报记录</h3>
      <div class="v15-spy-list">${history}</div>`;
    const modal = this._v15ModalShell('🗡 谍报司', body);

    // 任务说明 + 成功率预估联动
    const genSel = modal.querySelector('#v15-spy-gen');
    const citySel = modal.querySelector('#v15-spy-city');
    const misSel = modal.querySelector('#v15-spy-mission');
    const mDesc = modal.querySelector('#v15-spy-mdesc');
    const probNum = modal.querySelector('#v15-spy-prob-num');
    const refreshProb = () => {
      const gen = spies.find(s => s.id === genSel.value);
      const intel = gen ? (gen.effIntel || gen.intel || 50) : 50;
      const mis = misSel.value;
      let p = mis === 'intel' ? Math.min(0.8, intel / 120) : mis === 'sabotage' ? Math.min(0.7, intel / 150) : Math.min(0.6, intel / 200);
      p = Math.round(p * 100);
      if (probNum) { probNum.textContent = p + '%'; probNum.style.color = p > 60 ? '#6FCF6F' : p > 40 ? '#E8A33C' : '#E05555'; }
      const mObj = missions.find(m => m.id === mis);
      if (mDesc) mDesc.textContent = mObj.desc;
    };
    if (misSel) misSel.onchange = refreshProb;
    if (genSel) genSel.onchange = refreshProb;
    refreshProb();
    const sendBtn = modal.querySelector('#v15-spy-send');
    if (sendBtn) sendBtn.onclick = () => {
      const cityId = citySel.value, mission = misSel.value;
      if (!cityId) { this.toast('请选择目标城市'); return; }
      let result = { ok: false, msg: '谍报接口未就绪' };
      try {
        result = (g.sendSpy && typeof g.sendSpy === 'function') ? g.sendSpy(me, cityId, mission) : { ok: false, msg: '谍报接口未就绪' };
      } catch (e) { result = { ok: false, msg: String(e.message || e) }; }
      this._v15Notify('谍报', result.msg, result.ok ? 'success' : 'warn');
      document.querySelectorAll('.v15-overlay').forEach(m => m.remove());
      if (this.game.state === 'playing') this.showEspionagePanel();
      this.refreshUI && this.refreshUI();
    };
  }

  // ============================================================
  // 五、官职 / 科举 UI 增强
  // ============================================================

  // 官职品级可视化（从九品 ~ 正一品 品级条）
  _v15RankBar() {
    const levels = [
      { id: '正一品', cls: 'v15-rk-1' }, { id: '从一品', cls: 'v15-rk-2' },
      { id: '正二品', cls: 'v15-rk-3' }, { id: '从二品', cls: 'v15-rk-4' },
      { id: '正三品', cls: 'v15-rk-5' }, { id: '从三品', cls: 'v15-rk-6' },
      { id: '正四品', cls: 'v15-rk-7' }, { id: '正五品', cls: 'v15-rk-8' },
      { id: '正六品', cls: 'v15-rk-9' }, { id: '正七品', cls: 'v15-rk-10' },
      { id: '正八品', cls: 'v15-rk-11' }, { id: '正九品', cls: 'v15-rk-12' }
    ].reverse();
    return `<div class="v15-rankbar">
      <div class="v15-rankbar-title">官制品级（从九品 → 正一品）</div>
      <div class="v15-rankbar-track">${levels.map(l => `<span class="v15-rankcell ${l.cls}" title="${l.id}">${l.id.replace('正','').replace('从','从')}</span>`).join('')}</div>
    </div>`;
  }

  // 官职任免面板 V15（现职/俸禄/兵权 + 品级条）
  showOfficePanelV15() {
    const g = this.game;
    const me = g.playerFaction;
    let gens = [], held = {};
    try { gens = g.getFactionGenerals(me).filter(x => !x.inArmy && !x.onHostage && !x.onMission); } catch (e) {}
    try { held = (g.getOffices && typeof g.getOffices === 'function') ? g.getOffices(me) : {}; } catch (e) {}
    const offList = (typeof OFFICES !== 'undefined' ? OFFICES : []);

    // 现任官职一览（俸禄=按 rank 估算，兵权=按 type 标识）
    const heldRows = offList.map(off => {
      const holderId = held[off.id];
      const holder = holderId ? (g.getGeneral ? g.getGeneral(holderId) : null) : null;
      const salary = (6 - off.rank) * 200; // 品级越高俸禄越厚
      const power = off.type === 'military' ? '掌兵权' : off.type === 'central' ? '参朝政' : '牧民一方';
      const cand = gens.filter(x => x.id !== holderId).map(x => {
        const req = off.req || {};
        const ok = (x.command || 0) >= (req.command || 0) && (x.politics || 0) >= (req.politics || 0) &&
                   (x.force || 0) >= (req.force || 0) && (x.intel || 0) >= (req.intel || 0);
        return ok ? `<option value="${x.id}">${this._escHtml(x.name)}</option>` : '';
      }).join('');
      return `<div class="v15-off-row v15-rk-${off.rank}">
        <div class="v15-off-head"><b>${this._escHtml(off.name)}</b>
          <span class="v15-off-tag">正${['','一','二','三','四'][off.rank] || off.rank}品</span>
          <span class="v15-off-tag2">${power}</span></div>
        <div class="v15-off-desc">${this._escHtml(off.desc || '')} · 俸禄 ${salary} 金/回合</div>
        <div class="v15-off-cur">现任：<b class="v15-off-holder">${holder ? this._escHtml(holder.name) : '空缺'}</b></div>
        <div class="v15-off-act">
          <select class="select-small" id="off-sel-${off.id}">${cand || '<option value="">无够格者</option>'}</select>
          <button class="btn-small" onclick="__ui_.appointOffice('${off.id}')">拜任</button>
          ${holder ? `<button class="btn-small" onclick="__ui_.dismissOffice('${off.id}')">解任</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const body = this._v15RankBar() + `<div class="v15-off-list">${heldRows}</div>`;
    this._v15ModalShell('🏛 官职任免 · 九品中正', body);
  }

  // 科举结果面板 V15（新科进士：姓名/属性/品质，前三甲特殊标识）
  showExamResultModalV15(result) {
    if (!result) return;
    if (this.audio) {
      try { this.unlockSceneBGM('exam'); } catch (e) {}
      if (this.audio.playExamHuangbang) try { this.audio.playExamHuangbang(); } catch (e) {}
    }
    const honorCard = (entry, rank, medal, cls) => {
      if (!entry) return '';
      return `<div class="v15-exam-honor ${cls}">
        <div class="v15-exam-medal">${medal}</div>
        <div class="v15-exam-name">${this._escHtml(entry.name)}</div>
        <div class="v15-exam-rank">${rank}</div>
        <div class="v15-exam-score">成绩 ${entry.score}</div>
      </div>`;
    };
    const jinshiRows = (result.jinshi || []).map((j, i) => {
      const quality = j.score > 700 ? '<span class="v15-qual s">甲</span>' : j.score > 500 ? '<span class="v15-qual a">乙</span>' : '<span class="v15-qual b">丙</span>';
      return `<div class="v15-exam-row"><span>${i + 4}</span><b>${this._escHtml(j.name)}</b>${quality}<span>成绩 ${j.score}</span></div>`;
    }).join('');

    const body = `
      <div class="v15-exam-subject">【${this._escHtml(result.subject || '进士科')}】金榜题名</div>
      <div class="v15-exam-top3">
        ${honorCard(result.bangyan, '榜眼', '🥈', 'v15-exam-2')}
        ${honorCard(result.zhuangyuan, '状元', '🥇', 'v15-exam-1')}
        ${honorCard(result.tanhua, '探花', '🥉', 'v15-exam-3')}
      </div>
      <div class="v15-exam-list">
        <div class="v15-exam-list-title">新科进士（${(result.jinshi || []).length} 人）</div>
        ${jinshiRows || '<p class="v15-empty">本科无普通进士。</p>'}
      </div>
      <p class="v15-hint">${this._escHtml(result.message || '')}</p>`;
    const modal = this._v15ModalShell('📜 金榜题名', body, 'v15-exam-modal');
    // 金榜展开动画
    if (modal) modal.classList.add('v15-exam-reveal');
  }

  // ============================================================
  // 六、贸易 / 宗教 UI
  // ============================================================

  // 贸易路线图（城市间连线 + 动态光点沿路线移动）
  _v15TradeRouteMap() {
    const g = this.game;
    const me = g.playerFaction;
    let cities = [];
    try { cities = g.getFactionCities(me); } catch (e) {}
    // 取长距商路端点作为固定连线节点；其余按在途商队连线
    const info = (g.getTradeInfo && typeof g.getTradeInfo === 'function') ? g.getTradeInfo() : { longRoutes: [], caravans: [], agreementMult: 0 };
    // 用相对坐标把城市排进环形图（避免依赖地图像素）
    const n = Math.max(4, cities.length);
    const pos = {};
    cities.forEach((c, i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      pos[c.id] = { x: 50 + Math.cos(ang) * 38, y: 50 + Math.sin(ang) * 38, name: c.name };
    });
    // 在途商队连线
    const lines = (info.caravans || []).map((cav, i) => {
      const a = pos[cav.from], b = pos[cav.to];
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="v15-trade-line"/>
        <circle r="2.2" fill="#FFD54F"><animate attributeName="cx" from="${a.x}" to="${b.x}" dur="2.${i}s" repeatCount="indefinite"/>
        <animate attributeName="cy" from="${a.y}" to="${b.y}" dur="2.${i}s" repeatCount="indefinite"/></circle>`;
    }).join('');
    const nodes = Object.values(pos).map(p =>
      `<g><circle cx="${p.x}" cy="${p.y}" r="3" fill="#E8D5A3"/><text x="${p.x}" y="${p.y - 4}" class="v15-trade-city">${this._escHtml(p.name)}</text></g>`).join('');

    return `<div class="v15-trade-map-wrap">
      <div class="v15-trade-map-title">商路图（光点沿商队路线流转）</div>
      <svg class="v15-trade-map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${lines}${nodes}</svg>
    </div>`;
  }

  // 贸易收入面板 V15
  showTradePanelV15() {
    const g = this.game;
    const me = g.playerFaction;
    let cities = [];
    try { cities = g.getFactionCities(me); } catch (e) {}
    const info = (g.getTradeInfo && typeof g.getTradeInfo === 'function') ? g.getTradeInfo() : { longRoutes: [], caravans: [], agreementMult: 0 };
    // 按城市贸易收入明细（商业值估算）
    const cityRows = cities.slice(0, 12).map(c => {
      const comm = c.comm || 0;
      const est = Math.round(comm * 2);
      return `<div class="v15-trow"><span>${this._escHtml(c.name)}</span><span>商业 ${comm}</span><b style="color:#FFD54F">+${est}/回合</b></div>`;
    }).join('');
    const routeRows = (info.longRoutes || []).map(r =>
      `<div class="v15-trow"><span>🐫 ${this._escHtml(r.name)}</span><span>${this._escHtml(r.desc)}</span><b style="color:#6FCF6F">+${r.income}/回合</b></div>`).join('')
      || '<p class="v15-empty">未激活长距商路（据长安/洛阳/姑臧开丝路，据广州开海丝路）。</p>';
    const caravanRows = (info.caravans || []).map(c =>
      `<div class="v15-trow"><span>🐫 ${this._escHtml(c.goodsName)}</span><span>${this._escHtml(c.from)}→${this._escHtml(c.to)}</span><b>剩${c.turnsLeft}回合·利${c.estProfit}</b></div>`).join('')
      || '<p class="v15-empty">暂无在途商队。</p>';

    const body = this._v15TradeRouteMap() + `
      <div class="v15-trade-income">
        <h3 class="v15-sub">长距商路收入</h3>${routeRows}
        <h3 class="v15-sub">在途商队</h3>${caravanRows}
        <h3 class="v15-sub">城市商税明细（前 12）</h3>
        <div class="v15-trow v15-trow-head"><span>城市</span><span>商业</span><b>预估岁入</b></div>${cityRows}
        <p class="v15-hint">通商互市加成：+${Math.round((info.agreementMult || 0) * 100)}%</p>
      </div>`;
    this._v15ModalShell('🐫 贸易商路 · 货通南北', body);
  }

  // 宗教传播面板（各城信仰分布 + 宗教建筑）
  showReligionPanel() {
    const g = this.game;
    const me = g.playerFaction;
    let cities = [];
    try { cities = g.getFactionCities(me); } catch (e) {}
    // 统计佛/道等级
    let bud = 0, dao = 0, grotto = 0, totalCulture = 0;
    const cityRows = cities.map(c => {
      const bLv = (c.buildings && c.buildings.buddhist_temple) || (c.religion && c.religion.buddhist) || 0;
      const dLv = (c.buildings && c.buildings.daoist_temple) || (c.religion && c.religion.daoist) || 0;
      const gLv = (c.buildings && c.buildings.grotto) || 0;
      bud += bLv; dao += dLv; grotto += gLv;
      totalCulture += (c.religion && c.religion.culture) || 0;
      // 饼图比例
      const sum = bLv + dLv;
      const bPct = sum ? Math.round(bLv / sum * 100) : 0;
      const dPct = 100 - bPct;
      return `<div class="v15-rel-row">
        <span class="v15-rel-city">${this._escHtml(c.name)}</span>
        <span class="v15-rel-pie" style="background:conic-gradient(#c9a86a 0 ${bPct}%, #5a7a9a ${bPct}% 100%)" title="佛${bLv}·道${dLv}"></span>
        <span>佛${bLv} 道${dLv}${gLv ? ` 窟${gLv}` : ''}</span>
        <button class="btn-small" onclick="__ui_._v15BuildReligion('${c.id}','buddhist_temple')">建佛寺</button>
        <button class="btn-small" onclick="__ui_._v15BuildReligion('${c.id}','daoist_temple')">建道观</button>
      </div>`;
    }).join('');
    const totalSum = bud + dao || 1;
    const budPct = Math.round(bud / totalSum * 100);

    const body = `
      <div class="v15-rel-overview">
        <div class="v15-rel-grandpie" style="background:conic-gradient(#c9a86a 0 ${budPct}%, #5a7a9a ${budPct}% 100%)">
          <div class="v15-rel-grandcore">佛${budPct}%<br>道${100 - budPct}%</div>
        </div>
        <div class="v15-rel-nums">
          <div class="v15-stat"><span>佛寺</span><b>${bud}</b></div>
          <div class="v15-stat"><span>道观</span><b>${dao}</b></div>
          <div class="v15-stat"><span>石窟</span><b>${grotto}</b></div>
          <div class="v15-stat"><span>总文化值</span><b>${Math.round(totalCulture)}</b></div>
        </div>
      </div>
      <div class="v15-rel-list">${cityRows || '<p class="v15-empty">无据有城市。</p>'}</div>
      <p class="v15-hint">佛寺旺民心文化，道观利科技招募；石窟（仅平城/洛阳/建康）文化最盛。</p>`;
    this._v15ModalShell('☸ 宗教文化 · 梵音道韵', body);
  }

  // 建造宗教建筑（对接 game 建造接口，优雅降级）
  _v15BuildReligion(cityId, buildingId) {
    const g = this.game;
    let result = { ok: false, msg: '建造接口未就绪' };
    try {
      if (g.cityBuild && typeof g.cityBuild === 'function') result = g.cityBuild(cityId, buildingId);
      else if (g.cityDevelop && typeof g.cityDevelop === 'function') result = g.cityDevelop(cityId, buildingId);
      else result = { ok: false, msg: '当前版本暂未开放该建筑建造' };
    } catch (e) { result = { ok: false, msg: String(e.message || e) }; }
    this.toast(result.msg);
    if (result.ok && this.audio && this.audio.playCoin) try { this.audio.playCoin(); } catch (e) {}
    document.querySelectorAll('.v15-overlay').forEach(m => m.remove());
    if (this.game.state === 'playing') this.showReligionPanel();
    this.refreshUI && this.refreshUI();
  }

  // ============================================================
  // 七、通用品质：成就红点提示
  // ============================================================
  _v15UpdateAchBadge() {
    const g = this.game;
    const hasPending = g && Array.isArray(g.pendingAchievements) && g.pendingAchievements.length > 0;
    ['#btn-ach'].forEach(sel => {
      const btn = document.querySelector(sel);
      if (!btn) return;
      let dot = btn.querySelector('.v15-ach-dot');
      if (hasPending) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'v15-ach-dot';
          btn.appendChild(dot);
        }
      } else if (dot) dot.remove();
    });
  }

  // ============================================================
  // ============== V16.0「史诗长卷版」UI 精修 ==================
  //  约定：新类名一律 v16- 前缀；模型 API 调用带 typeof 守卫；
  //        粒子/动画均有性能保护（上限 + 页面隐藏暂停）。
  // ============================================================

  // ---------- 通用：v16 弹窗骨架 ----------
  _v16ModalShell(titleHtml, bodyHtml, extraCls = '') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay v16-overlay';
    modal.innerHTML = `
      <div class="modal v16-modal v16-scroll ${extraCls}">
        <div class="v16-corner tl"></div><div class="v16-corner tr"></div>
        <div class="v16-corner bl"></div><div class="v16-corner br"></div>
        <h2 class="modal-title v16-title">${titleHtml}</h2>
        <div class="v16-body">${bodyHtml}</div>
        <button class="btn-ancient v16-close" onclick="this.closest('.v16-overlay').remove()">关闭</button>
      </div>`;
    document.body.appendChild(modal);
    if (this.audio && typeof this.audio.playPanelOpen === 'function') try { this.audio.playPanelOpen(); } catch (e) {}
    return modal;
  }

  // ---------- 战役模式：本地进度存取 ----------
  _v16CampLoad() {
    try { return JSON.parse(localStorage.getItem('nanchao_v16_campaign') || '{}'); }
    catch (e) { return {}; }
  }
  _v16CampSave(data) {
    try { localStorage.setItem('nanchao_v16_campaign', JSON.stringify(data)); } catch (e) {}
  }

  // 五个战役关卡（名称/年份/描述/难度/奖励/目标/失败条件/回合上限）
  _v16CampaignDefs() {
    return [
      { id: 'camp_liuzhen', name: '六镇烽烟', year: 523, scenario: '523',
        desc: '沃野镇民起义，六镇俱反。于乱军中立足，保全根本之地。',
        difficulty: 2, objective: '据有 3 座城池并存活 20 回合', fail: '都城沦陷或城池数为 0', turns: 20,
        reward: { gold: 2000, fame: 100, item: '精铁战甲' } },
      { id: 'camp_houjing', name: '侯景乱梁', year: 548, scenario: '548',
        desc: '侯景渡江，建康台城被困。于江南烽火中收复失土。',
        difficulty: 3, objective: '攻克建康并据有 5 座城池', fail: '30 回合内未攻克建康', turns: 30,
        reward: { gold: 4000, fame: 200, item: '楼船图纸' } },
      { id: 'camp_zhouranqi', name: '北周伐齐', year: 575, scenario: '575',
        desc: '周武帝御驾亲征，挥师东进。克平阳、下晋阳，一举灭齐。',
        difficulty: 4, objective: '攻陷齐都邺城', fail: '40 回合内未灭北齐', turns: 40,
        reward: { gold: 8000, fame: 350, item: '落雕弓' } },
      { id: 'camp_suiwen', name: '隋文统一', year: 588, scenario: '588',
        desc: '杨隋承周，旌旗南指。五路伐陈，饮马长江。',
        difficulty: 4, objective: '渡江攻克建康，覆灭陈朝', fail: '35 回合内未渡江', turns: 35,
        reward: { gold: 12000, fame: 500, item: '开皇律' } },
      { id: 'camp_world', name: '天下一统', year: 589, scenario: '589',
        desc: '四海纷争四百载，在此一战定乾坤。成就不世之功。',
        difficulty: 5, objective: '统一天下，据有全部城池', fail: '60 回合内未完成统一', turns: 60,
        reward: { gold: 20000, fame: 1000, item: '传国玉玺' } }
    ];
  }

  // 战役选择界面：5 张关卡卡片
  showCampaignSelectV16() {
    this._v13StopMenuParticles();
    const defs = this._v16CampaignDefs();
    const prog = this._v16CampLoad();
    const cards = defs.map((c, i) => {
      const rec = prog[c.id];
      const stars = rec ? (rec.stars || 0) : 0;
      const cleared = !!rec && rec.cleared;
      // 解锁：第一关默认解锁，其余需前一关通关
      const locked = i > 0 ? !(prog[defs[i - 1].id] && prog[defs[i - 1].id].cleared) : false;
      const starHtml = [1, 2, 3].map(n =>
        `<span class="v16-star ${n <= stars ? 'on' : ''}">★</span>`).join('');
      return `
        <div class="v16-camp-card ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}"
             data-camp="${c.id}" data-idx="${i}">
          <div class="v16-camp-year">${c.year} 年</div>
          <h3 class="v16-camp-name">${c.name}</h3>
          <p class="v16-camp-desc">${c.desc}</p>
          <div class="v16-camp-stars">难度 ${'★'.repeat(c.difficulty)}<span class="star-dim">${'★'.repeat(5 - c.difficulty)}</span></div>
          <div class="v16-camp-status">
            ${locked ? '<span class="v16-lock">🔒 未解锁</span>'
              : cleared ? `<span class="v16-clear">✔ 已通关</span> <span class="v16-camp-stars">${starHtml}</span>`
              : '<span class="v16-todo">◈ 待征战</span>'}
          </div>
          <div class="v16-camp-reward">
            <b>奖励预览</b>：金 ${c.reward.gold} · 望 ${c.reward.fame} · ${c.reward.item}
          </div>
        </div>`;
    }).join('');
    this.container.innerHTML = `
      <div class="v16-page v16-camp-page">
        <div class="v16-page-deco"></div>
        <h2 class="v16-page-title">⚔ 战役模式 · 史诗长卷</h2>
        <p class="v16-page-sub">选定一段历史，完成特定战役目标，三星通关可获丰厚奖励。</p>
        <div class="v16-camp-grid">${cards}</div>
        <button class="btn-ancient v16-back" id="v16-camp-back">返回主菜单</button>
      </div>`;
    const back = document.getElementById('v16-camp-back');
    if (back) back.onclick = () => this.showMainMenu();
    this.container.querySelectorAll('.v16-camp-card:not(.locked)').forEach(el => {
      el.onclick = () => this._v16StartCampaign(el.dataset.camp);
    });
    if (this.audio && typeof this.audio.switchBGM === 'function') try { this.audio.switchBGM('menu'); } catch (e) {}
  }

  // 进入战役：以对应剧本开局（前端编排，后端接口带守卫）
  _v16StartCampaign(campId) {
    const def = this._v16CampaignDefs().find(c => c.id === campId);
    if (!def) { this.toast('战役数据缺失'); return; }
    this._v16ActiveCamp = { def, turnsLeft: def.turns, objective: def.objective };
    // 进入剧本选人（复用势力选择流程，携带战役上下文）
    this._v16PendingCamp = campId;
    this.showFactionSelect({ hotSeat: false, scenario: def.scenario, camp: true });
    this.toast(`战役「${def.name}」开启 · 目标：${def.objective}`);
    // 战役进行中 HUD
    setTimeout(() => this._v16ShowCampaignHud(), 800);
  }

  // 战役进行中：顶部目标/失败条件/剩余时间
  _v16ShowCampaignHud() {
    if (!this._v16ActiveCamp) return;
    this._v16RemoveCampaignHud();
    const d = this._v16ActiveCamp.def;
    const hud = document.createElement('div');
    hud.className = 'v16-camp-hud';
    hud.id = 'v16-camp-hud';
    hud.innerHTML = `
      <div class="v16-camp-hud-body">
        <span class="v16-camp-hud-tag">战役</span>
        <b class="v16-camp-hud-name">${d.name}</b>
        <span class="v16-camp-hud-obj">目标：${d.objective}</span>
        <span class="v16-camp-hud-fail">败因：${d.fail}</span>
        <span class="v16-camp-hud-turns">剩余 <b id="v16-camp-turns">${this._v16ActiveCamp.turnsLeft}</b> 回合</span>
      </div>`;
    document.body.appendChild(hud);
    this._v16DrawMapFlags();
  }
  _v16RemoveCampaignHud() {
    const old = document.getElementById('v16-camp-hud');
    if (old) old.remove();
    const of = document.getElementById('v16-map-flags');
    if (of) of.remove();
  }

  // 战役地图：标记目标点（金色旗帜）
  _v16DrawMapFlags() {
    const wrap = document.getElementById('map-container');
    if (!wrap) return;
    this._v16RemoveMapFlagsOnly();
    const layer = document.createElement('div');
    layer.className = 'v16-map-flags';
    layer.id = 'v16-map-flags';
    // 目标点（示意位置，金色旗帜脉冲）
    layer.innerHTML = `
      <div class="v16-flag" style="left:62%;top:42%" title="战役目标">
        <span class="v16-flag-pole"></span><span class="v16-flag-cloth">⚑</span>
      </div>
      <div class="v16-flag v16-flag-home" style="left:30%;top:58%" title="我方根本">
        <span class="v16-flag-pole"></span><span class="v16-flag-cloth">⚑</span>
      </div>`;
    wrap.appendChild(layer);
  }
  _v16RemoveMapFlagsOnly() {
    const of = document.getElementById('v16-map-flags');
    if (of) of.remove();
  }

  // 推进战役回合计数（结束回合时可由外部调用，带守卫）
  v16CampaignTick() {
    if (!this._v16ActiveCamp) return;
    this._v16ActiveCamp.turnsLeft = Math.max(0, this._v16ActiveCamp.turnsLeft - 1);
    const el = document.getElementById('v16-camp-turns');
    if (el) el.textContent = this._v16ActiveCamp.turnsLeft;
    if (this._v16ActiveCamp.turnsLeft <= 0) {
      this._v16FinishCampaign(false);
    }
  }

  // 战役结算：胜利/失败/三星/奖励/下一战役
  _v16FinishCampaign(win, stars = 0) {
    if (!this._v16ActiveCamp) return;
    const d = this._v16ActiveCamp.def;
    if (win) {
      const prog = this._v16CampLoad();
      const prev = prog[d.id] || { stars: 0, cleared: false };
      prog[d.id] = { cleared: true, stars: Math.max(prev.stars, stars || 1) };
      this._v16CampSave(prog);
    }
    this._v16RemoveCampaignHud();
    const defs = this._v16CampaignDefs();
    const nextIdx = defs.findIndex(c => c.id === d.id) + 1;
    const next = defs[nextIdx];
    this._v16RenderCampaignResultV16(win, stars, d, next);
    this._v16ActiveCamp = null;
  }

  v16CampaignWin(stars) { this._v16FinishCampaign(true, stars); }

  _v16RenderCampaignResultV16(win, stars, def, next) {
    const rewards = win ? [
      { icon: '金', text: `${def.reward.gold} 金币` },
      { icon: '望', text: `${def.reward.fame} 声望` },
      { icon: '宝', text: `${def.reward.item}` }
    ] : [];
    const starHtml = [1, 2, 3].map(n =>
      `<span class="v16-star-big ${n <= stars ? 'on' : ''}">★</span>`).join('');
    const body = `
      <div class="v16-result-banner ${win ? 'win' : 'lose'}">
        <div class="v16-result-title">${win ? '大获全胜' : '功败垂成'}</div>
        <div class="v16-result-stars">${win ? starHtml : ''}</div>
      </div>
      ${win ? `
        <h3 class="v16-result-sub">获得奖励</h3>
        <div class="v16-reward-list">
          ${rewards.map(r => `<div class="v16-reward-item"><span class="v16-reward-icon">${r.icon}</span>${r.text}</div>`).join('')}
        </div>
        <div class="v16-result-actions">
          ${next ? `<button class="btn-ancient" id="v16-next-camp">下一战役 · ${next.name}</button>` : '<p class="v16-hint">所有战役已通关，一统之业成矣！</p>'}
          <button class="btn-ancient" id="v16-back-camp">返回战役列表</button>
        </div>`
      : `<div class="v16-result-actions">
          <button class="btn-ancient" id="v16-retry-camp">再战一次</button>
          <button class="btn-ancient" id="v16-back-camp">返回战役列表</button>
        </div>`}`;
    const modal = this._v16ModalShell('⚔ 战役结算 · ' + def.name, body);
    const nxt = modal.querySelector('#v16-next-camp');
    if (nxt) nxt.onclick = () => { modal.remove(); if (next) this._v16StartCampaign(next.id); };
    const retry = modal.querySelector('#v16-retry-camp');
    if (retry) retry.onclick = () => { modal.remove(); this._v16StartCampaign(def.id); };
    const back = modal.querySelector('#v16-back-camp');
    if (back) back.onclick = () => { modal.remove(); this.showCampaignSelectV16(); };
    if (win && this.audio && typeof this.audio.playCoin === 'function') try { this.audio.playCoin(); } catch (e) {}
  }

  // ---------- 开场演出 V16：全屏覆盖打字机 + Ken Burns + 时间轴 + 势力旗帜 + 地图缩放 + 剪影 ----------
  _playIntroV16() {
    const root = document.createElement('div');
    root.className = 'v16-intro';
    root.innerHTML = `
      <div class="v16-intro-bg kenburns"></div>
      <div class="v16-intro-overlay"></div>
      <div class="v16-intro-stage">
        <div class="v16-intro-type" id="v16-itype"></div>
        <div class="v16-intro-year" id="v16-iyear">534</div>
        <div class="v16-intro-timeline" id="v16-itime">
          <div class="v16-tl-track">
            ${[534, 537, 548, 550, 557, 577, 581, 589].map(y =>
              `<span class="v16-tl-node" data-y="${y}">${y}</span>`).join('')}
          </div>
        </div>
        <div class="v16-intro-flags" id="v16-iflags"></div>
        <div class="v16-intro-mapzoom" id="v16-imap"></div>
        <div class="v16-intro-silhouette" id="v16-asilh">
          <div class="v16-solider l"></div><div class="v16-solider r"></div>
          <div class="v16-horse"></div>
        </div>
      </div>
      <button class="v16-intro-skip" id="v16-iskip">跳过 »</button>`;
    document.body.appendChild(root);
    this._v16IntroRoot = root;
    this._v16IntroTimers = [];
    const after = (ms, fn) => this._v16IntroTimers.push(setTimeout(fn, ms));
    const show = (sel) => { const el = root.querySelector(sel); if (el) el.classList.add('on'); };
    const hide = (sel) => { const el = root.querySelector(sel); if (el) el.classList.remove('on'); };

    // 跳过：右下角按钮 / 任意点击
    const skipFn = () => this._v16FinishIntroV16();
    const skipBtn = root.querySelector('#v16-iskip');
    if (skipBtn) skipBtn.onclick = (e) => { e.stopPropagation(); skipFn(); };

    // ① 打字机文本（黑屏后）
    const typeEl = root.querySelector('#v16-itype');
    const fullText = '公元534年，北魏分裂，东西对峙。江南江北，干戈不息四十余载。英雄并起，豪杰争锋——';
    after(600, () => {
      show('#v16-itype');
      let i = 0;
      const typer = setInterval(() => {
        if (!this._v16IntroRoot) { clearInterval(typer); return; }
        i++;
        if (typeEl) typeEl.textContent = fullText.slice(0, i);
        if (i >= fullText.length) clearInterval(typer);
      }, 45);
      this._v16IntroTimers.push(typer);
    });
    // ② 时代变迁时间轴（横向滚动，节点高亮）
    after(4200, () => { hide('#v16-itype'); show('#v16-itime'); show('#v16-iyear'); });
    // 年份滚动 + 节点高亮
    after(4200, () => {
      const nodes = root.querySelectorAll('.v16-tl-node');
      const years = [534, 537, 548, 550, 557, 577, 581, 589];
      let yi = 0;
      const yscroll = setInterval(() => {
        if (!this._v16IntroRoot) { clearInterval(yscroll); return; }
        const y = years[yi];
        const yr = root.querySelector('#v16-iyear'); if (yr) yr.textContent = y;
        nodes.forEach(n => n.classList.toggle('active', Number(n.dataset.y) === y));
        yi++;
        if (yi >= years.length) clearInterval(yscroll);
      }, 600);
      this._v16IntroTimers.push(yscroll);
    });
    // ③ 势力旗帜依次闪现
    after(9200, () => {
      hide('#v16-itime'); hide('#v16-iyear');
      const flagBox = root.querySelector('#v16-iflags');
      const flags = ['魏', '齐', '周', '陈', '梁', '隋'];
      show('#v16-iflags');
      flags.forEach((f, idx) => {
        this._v16IntroTimers.push(setTimeout(() => {
          if (!flagBox) return;
          const s = document.createElement('span');
          s.className = 'v16-flag-flash';
          s.textContent = f;
          flagBox.appendChild(s);
          setTimeout(() => s.classList.add('on'), 20);
        }, idx * 350));
      });
    });
    // ④ 地图缩放：全局 → 玩家势力
    after(12200, () => {
      hide('#v16-iflags'); show('#v16-imap');
      const m = root.querySelector('#v16-imap'); if (m) m.classList.add('zoom');
    });
    // ⑤ 序幕战斗剪影
    after(15200, () => {
      hide('#v16-imap'); show('#v16-asilh');
    });
    // 自动结束
    after(18200, () => this._v16FinishIntroV16());
    if (this.audio && typeof this.audio.switchBGM === 'function') try { this.audio.switchBGM('menu'); } catch (e) {}
  }
  _v16FinishIntroV16() {
    if (!this._v16IntroRoot) return;
    if (this._v16IntroTimers) this._v16IntroTimers.forEach(t => clearTimeout(t));
    this._v16IntroTimers = [];
    const root = this._v16IntroRoot;
    this._v16IntroRoot = null;
    root.classList.add('fade-out');
    setTimeout(() => root.remove(), 600);
    try { if (typeof markIntroCompleted === 'function') markIntroCompleted(); } catch (e) {}
    this.showMainMenu();
  }

  // ---------- 教程 UI 增强：设置面板（重看任意章节） ----------
  showTutorialSettingsV16() {
    let chapters = [];
    try { chapters = TUTORIAL_CHAPTERS; } catch (e) {}
    const items = (chapters || []).map((c, i) => `
      <div class="v16-tut-row">
        <span class="v16-tut-idx">第 ${i + 1} 章</span>
        <b class="v16-tut-name">${c.name}</b>
        <button class="btn-small" data-ch="${c.id}">重看本章</button>
      </div>`).join('') || '<p class="v16-hint">暂无教程章节。</p>';
    const body = `
      <p class="v16-hint">选择任意章节重新进入教程。教程进行时，顶部显示章节进度条，气泡将以箭头指向对应 UI 元素。</p>
      <div class="v16-tut-list">
        <div class="v16-tut-row">
          <span class="v16-tut-idx">全部</span>
          <b class="v16-tut-name">完整教程</b>
          <button class="btn-small" data-ch="__all">从头开始</button>
        </div>
        ${items}
      </div>`;
    const modal = this._v16ModalShell('📖 教程设置 · 章节重温', body);
    modal.querySelectorAll('.btn-small').forEach(btn => {
      btn.onclick = () => {
        const ch = btn.dataset.ch;
        modal.remove();
        this._replayTutorialChapter(ch);
      };
    });
  }
  // 以指定章节重进教程（带守卫）
  _replayTutorialChapter(ch) {
    this.game = new Game();
    try { this.game.initGame('nanchao'); } catch (e) {}
    this.initGameUI();
    if (this.tutorial && typeof this.tutorial.start === 'function') {
      const opts = (ch && ch !== '__all') ? { mode: 'chapter', chapterId: ch } : { mode: 'all' };
      this.tutorial.start(false, opts);
      this._v16InjectTutorialProgress();
    }
  }
  // 教程进度条：顶部章节进度（轻量轮询注入，页面隐藏不占资源）
  _v16InjectTutorialProgress() {
    this._v16RemoveTutorialProgress();
    const bar = document.createElement('div');
    bar.className = 'v16-tut-progress';
    bar.id = 'v16-tut-progress';
    bar.innerHTML = `<span class="v16-tut-pg-label">教程</span><div class="v16-tut-pg-track"><div class="v16-tut-pg-fill" id="v16-tut-pg-fill"></div></div><span class="v16-tut-pg-step" id="v16-tut-pg-step"></span>`;
    document.body.appendChild(bar);
    const poll = () => {
      if (!document.getElementById('tut-bubble')) { this._v16RemoveTutorialProgress(); return; }
      try {
        const st = this.tutorial;
        if (st && st._steps && st.step != null) {
          const total = st._steps.length || 1;
          const pct = Math.round(((st.step + 1) / total) * 100);
          const fill = document.getElementById('v16-tut-pg-fill');
          const step = document.getElementById('v16-tut-pg-step');
          if (fill) fill.style.width = pct + '%';
          if (step) step.textContent = `${st.step + 1}/${total}`;
        }
      } catch (e) {}
      this._v16TutPoll = setTimeout(poll, 500);
    };
    poll();
  }
  _v16RemoveTutorialProgress() {
    if (this._v16TutPoll) { clearTimeout(this._v16TutPoll); this._v16TutPoll = null; }
    const bar = document.getElementById('v16-tut-progress');
    if (bar) bar.remove();
  }

  // ---------- NG+ 界面：主入口 / 选择 / 奖励树 ----------
  showNGPlusV16() {
    let data = null, level = 0, totalRuns = 0;
    try { data = (typeof loadNGPlusData === 'function') ? loadNGPlusData() : null; } catch (e) {}
    level = data ? (data.level || 0) : 0;
    totalRuns = data ? (data.totalRuns || 0) : 0;
    const body = `
      <div class="v16-ng-head">
        <div class="v16-ng-level">当前周目：<b>第 ${level} 周目</b></div>
        <div class="v16-ng-runs">累计通关：${totalRuns} 次</div>
      </div>
      <div class="v16-ng-tree">${this._v16RenderRewardTreeV16(data)}</div>
      <div class="v16-result-actions">
        <button class="btn-ancient" id="v16-ng-start">进入新周目（NG+）</button>
        <button class="btn-ancient" id="v16-ng-tree-only">查看奖励树</button>
      </div>`;
    const modal = this._v16ModalShell('♾ 多周目 · 霸业轮回', body);
    const go = modal.querySelector('#v16-ng-start');
    if (go) go.onclick = () => { modal.remove(); this.showNGPlusSelectV16(); };
    const tree = modal.querySelector('#v16-ng-tree-only');
    if (tree) tree.onclick = () => { modal.remove(); this.showNGPlusSelectV16(true); };
  }

  // 奖励树可视化：节点连接图（已解锁/未解锁/可解锁）
  _v16RenderRewardTreeV16(data) {
    const level = data ? (data.level || 0) : 0;
    const generals = data ? (data.generals || []).length : 0;
    const items = data ? (data.items || []).length : 0;
    const titles = data ? (data.titles || []).length : 0;
    const nodes = [
      { id: 'g', name: '传承武将', val: generals, req: 0 },
      { id: 't', name: '传世称号', val: titles, req: 1 },
      { id: 'i', name: '藏珍装备', val: items, req: 2 },
      { id: 'a', name: '周目加成', val: level + '级', req: 3 },
      { id: 's', name: '剧情补完', val: (data && data.stories || []).length, req: 4 }
    ];
    const html = nodes.map((n, i) => {
      const unlocked = level >= n.req;
      const ready = !unlocked && level >= Math.max(0, n.req - 1);
      const cls = unlocked ? 'unlocked' : (ready ? 'ready' : 'locked');
      return `<div class="v16-tree-node ${cls}">
        <span class="v16-tree-dot"></span>
        <b>${n.name}</b><small>${unlocked ? n.val : (ready ? '下周目可解' : '🔒')}</small>
      </div>${i < nodes.length - 1 ? '<div class="v16-tree-link"></div>' : ''}`;
    }).join('');
    return `<div class="v16-tree">${html}</div>`;
  }

  // NG+ 选择画面：周目数 / 奖励树 / 难度选择
  showNGPlusSelectV16(onlyTree = false) {
    let data = null;
    try { data = (typeof loadNGPlusData === 'function') ? loadNGPlusData() : null; } catch (e) {}
    const level = data ? (data.level || 0) : 0;
    const diffs = [
      { id: 'inherit', name: '继承霸业', desc: '周目加成开启，AI 强化', on: level > 0 },
      { id: 'fresh', name: '全新开局', desc: '重置传承，难度如初', on: true }
    ];
    const body = `
      <div class="v16-ng-level">即将进入：<b>第 ${level + 1} 周目</b></div>
      ${this._v16RenderRewardTreeV16(data)}
      <h3 class="v16-result-sub">选择开局方式</h3>
      <div class="v16-ng-diff">
        ${diffs.map(d => `
          <div class="v16-diff-card ${d.on ? '' : 'disabled'}" data-diff="${d.id}">
            <b>${d.name}</b><p>${d.desc}</p>
          </div>`).join('')}
      </div>`;
    const modal = this._v16ModalShell('♾ 新周目 · 难度与传承', body);
    modal.querySelectorAll('.v16-diff-card:not(.disabled)').forEach(card => {
      card.onclick = () => {
        modal.remove();
        if (onlyTree) { this.showNGPlusV16(); return; }
        this.toast(`以「${card.querySelector('b').textContent}」开启第 ${level + 1} 周目`);
        this.showModeSelect();
      };
    });
  }

  // 通关后结算：周目奖励 + 新解锁内容
  v16PostClearSettlementV16(extraUnlocks = []) {
    let data = null;
    try { data = (typeof loadNGPlusData === 'function') ? loadNGPlusData() : null; } catch (e) {}
    const level = data ? (data.level || 1) : 1;
    const unlocks = (extraUnlocks || []).concat([
      '周目加成 +1', 'AI 兵力/经济强化', '传承槽位扩展'
    ]);
    const body = `
      <div class="v16-result-banner win">
        <div class="v16-result-title">天下一统 · 新周目解锁</div>
        <div class="v16-result-stars"><span class="v16-star-big on">★</span><span class="v16-star-big on">★</span><span class="v16-star-big on">★</span></div>
      </div>
      <h3 class="v16-result-sub">第 ${level} 周目奖励</h3>
      <div class="v16-reward-list">
        ${unlocks.map(u => `<div class="v16-reward-item"><span class="v16-reward-icon">✦</span>${u}</div>`).join('')}
      </div>
      <div class="v16-result-actions">
        <button class="btn-ancient" id="v16-continue-ng">进入第 ${level + 1} 周目</button>
        <button class="btn-ancient" id="v16-view-tree">查看奖励树</button>
      </div>`;
    const modal = this._v16ModalShell('♾ 霸业轮回 · 周目结算', body);
    const cont = modal.querySelector('#v16-continue-ng');
    if (cont) cont.onclick = () => { modal.remove(); this.showNGPlusV16(); };
    const vt = modal.querySelector('#v16-view-tree');
    if (vt) vt.onclick = () => { modal.remove(); this.showNGPlusSelectV16(true); };
  }

  // ============================================================
  // ============== V17.0「血战沙场版」UI 精修 ===================
  //  约定：新类名一律 v17- 前缀；模型 API 调用带 typeof 守卫；
  //        粒子/小地图渲染带性能保护；全程中文。
  // ============================================================

  // ---------- 二、地图交互优化 ----------
  // 注入缩放控件 / 搜索框 / 小地图 / 双击选中 / 右键快速菜单
  _v17InitMapExtras(canvas) {
    const container = document.getElementById('map-container');
    if (!container || !this.map) return;
    // 避免重复注入
    if (document.getElementById('v17-map-controls')) return;

    // 控件骨架
    const ctrl = document.createElement('div');
    ctrl.id = 'v17-map-controls';
    ctrl.className = 'v17-map-controls';
    ctrl.innerHTML = `
      <button class="v17-map-btn" id="v17-zoom-in" title="放大">＋</button>
      <button class="v17-map-btn" id="v17-zoom-out" title="缩小">－</button>
      <button class="v17-map-btn" id="v17-zoom-reset" title="复位视野">⌂</button>
      <span class="v17-zoom-label" id="v17-zoom-label">100%</span>`;
    container.appendChild(ctrl);

    // 搜索框
    const search = document.createElement('input');
    search.id = 'v17-map-search';
    search.className = 'v17-map-search';
    search.type = 'text';
    search.placeholder = '🔍 搜索城市/武将…';
    search.autocomplete = 'off';
    container.appendChild(search);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this._v17LocateQuery(search.value); search.blur(); }
    });

    // 小地图
    const mm = document.createElement('canvas');
    mm.id = 'v17-minimap';
    mm.className = 'v17-minimap';
    mm.width = 180; mm.height = 120;
    container.appendChild(mm);
    mm.addEventListener('click', (e) => this._v17MinimapJump(e));

    // 右键快速菜单容器
    const ctx = document.createElement('div');
    ctx.id = 'v17-ctx-menu';
    ctx.className = 'v17-ctx-menu';
    ctx.style.display = 'none';
    document.body.appendChild(ctx);

    // 缩放按钮
    const bindZoom = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { fn(); this._v17UpdateZoomLabel(); }; };
    bindZoom('v17-zoom-in', () => { if (this.map && typeof this.map.setZoom === 'function') this.map.setZoom(this.map.getZoom() * 1.25); });
    bindZoom('v17-zoom-out', () => { if (this.map && typeof this.map.setZoom === 'function') this.map.setZoom(this.map.getZoom() * 0.8); });
    bindZoom('v17-zoom-reset', () => { if (this.map && typeof this.map.setZoom === 'function') this.map.setZoom(1.0); });
    this._v17UpdateZoomLabel();

    // 双击城市快速选中
    if (canvas) {
      canvas.addEventListener('dblclick', (e) => this._v17DblClickSelect(e));
      // 右键军队快速操作菜单
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this._v17ContextMenu(e); });
      // 点击空白处关闭右键菜单
      canvas.addEventListener('mousedown', () => this._v17HideCtxMenu());
    }
    // 小地图首绘
    this._v17RenderMinimap();
  }

  _v17UpdateZoomLabel() {
    const el = document.getElementById('v17-zoom-label');
    if (el && this.map && typeof this.map.getZoom === 'function') {
      el.textContent = Math.round(this.map.getZoom() * 100) + '%';
    }
  }

  // 命中检测：复用 map 的坐标换算，返回 {city, army}
  _v17PickAt(clientX, clientY) {
    if (!this.map || !this.game) return { city: null, army: null };
    const rect = this.map.canvas.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    let city = null, army = null;
    for (const c of this.game.cities.values()) {
      if (typeof this.game.isCityExplored === 'function' && !this.game.isCityExplored(c.id)) continue;
      const pos = this.map.isoToScreen(c.isoX, c.isoY);
      const r = (18 + (c.size || 1) * 6) * this.map.scale;
      const dx = mx - pos.x, dy = my - pos.y;
      if (dx * dx + dy * dy < r * r) { city = c; break; }
    }
    for (const a of this.game.armies) {
      const c = this.game.cities.get(a.cityId);
      if (!c) continue;
      const pos = this.map.isoToScreen(c.isoX, c.isoY);
      const r = 14 * this.map.scale;
      const dx = mx - pos.x, dy = my - (pos.y - 20 * this.map.scale);
      if (dx * dx + dy * dy < r * r) { army = a; break; }
    }
    return { city, army };
  }

  // 双击城市快速选中
  _v17DblClickSelect(e) {
    const { city, army } = this._v17PickAt(e.clientX, e.clientY);
    if (army && army.faction === (this.game && this.game.playerFaction)) {
      this.game.selectedArmy = army.id; this.game.selectedCity = null;
      this.showArmyPanel(army); this.toast('已选中：' + (this._genName(army.generalId) || '军队'));
    } else if (city) {
      this.game.selectedCity = city.id; this.game.selectedArmy = null;
      this.showCityPanel(city); this.toast('已定位：' + city.name);
    }
    this.map && this.map.render && this.map.render();
    this._updateMapMarker();
  }

  // 右键军队快速操作菜单
  _v17ContextMenu(e) {
    const { city, army } = this._v17PickAt(e.clientX, e.clientY);
    const menu = document.getElementById('v17-ctx-menu');
    if (!menu) return;
    if (!army && !city) { this._v17HideCtxMenu(); return; }
    let items = [];
    if (army) {
      const mine = this.game && army.faction === this.game.playerFaction;
      items.push({ label: '📋 查看详情', fn: () => { this.game.selectedArmy = army.id; this.showArmyPanel(army); } });
      if (mine) {
        items.push({ label: '⚔ 军团详情', fn: () => { if (army.legionId) this.showLegionDetail(army.legionId); else this.toast('此军未编入军团'); } });
        items.push({ label: '🎒 武将详情', fn: () => this.showGeneralDetail(army.generalId || '') });
      }
    } else if (city) {
      items.push({ label: '📋 查看城池', fn: () => { this.game.selectedCity = city.id; this.showCityPanel(city); } });
      items.push({ label: '📐 聚焦此处', fn: () => this._v17FocusCity(city) });
    }
    if (!items.length) { this._v17HideCtxMenu(); return; }
    menu.innerHTML = items.map((it, i) => `<div class="v17-ctx-item" data-i="${i}">${it.label}</div>`).join('');
    menu.querySelectorAll('.v17-ctx-item').forEach(el => {
      el.onclick = () => { const it = items[Number(el.dataset.i)]; this._v17HideCtxMenu(); it.fn && it.fn(); };
    });
    menu.style.display = 'block';
    // 边界防溢出
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.min(e.clientX, window.innerWidth - mw - 8) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
  }
  _v17HideCtxMenu() { const m = document.getElementById('v17-ctx-menu'); if (m) m.style.display = 'none'; }

  // 聚焦某城市到屏幕中心
  _v17FocusCity(city) {
    if (!this.map || !city) return;
    try {
      // isoToScreen: x = (isoX + offsetX) * scale → 反解 offset 使城市居中
      const cx = this.map.canvas.width / 2, cy = this.map.canvas.height / 2;
      this.map.offsetX = cx / this.map.scale - city.isoX;
      this.map.offsetY = cy / this.map.scale - city.isoY;
      this.map.dirty = true; this.map.render && this.map.render();
      this._updateMapMarker(); this._v17RenderMinimap();
    } catch (e) {}
  }

  // 搜索定位（城市 / 武将名）
  _v17LocateQuery(q) {
    if (!q || !q.trim() || !this.game) return;
    const kw = q.trim();
    // 1) 匹配城市
    for (const c of this.game.cities.values()) {
      if (c.name && c.name.indexOf(kw) >= 0) {
        if (typeof this.game.isCityExplored === 'function' && !this.game.isCityExplored(c.id)) { this.toast('该城尚未探明'); continue; }
        this.game.selectedCity = c.id; this.game.selectedArmy = null;
        this._v17FocusCity(c); this.showCityPanel(c);
        this.toast('已定位：' + c.name);
        return;
      }
    }
    // 2) 匹配武将（找其所在军队/城池）
    for (const g of this.game.generals.values()) {
      if (g.name && g.name.indexOf(kw) >= 0) {
        const army = this.game.armies.find(a => a.generalId === g.id);
        if (army) {
          const c = this.game.cities.get(army.cityId);
          if (c) { this.game.selectedArmy = army.id; this._v17FocusCity(c); this.showArmyPanel(army); this.toast('已定位武将：' + g.name); return; }
        }
        this.toast('武将【' + g.name + '】在野/未在地图'); return;
      }
    }
    this.toast('未找到「' + kw + '」');
  }

  // 小地图：战争迷雾 + 视口框 + 可点击跳转（节流保护）
  _v17RenderMinimap() {
    const mm = document.getElementById('v17-minimap');
    if (!mm || !this.map || !this.game) return;
    // 性能保护：16ms 内不重绘
    const now = performance.now();
    if (this._v17mmLast && now - this._v17mmLast < 60) return;
    this._v17mmLast = now;
    const ctx = mm.getContext('2d');
    const W = mm.width, H = mm.height;
    ctx.clearRect(0, 0, W, H);
    // 计算整张地图 iso 范围
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const cities = Array.from(this.game.cities.values());
    if (!cities.length) return;
    for (const c of cities) {
      minX = Math.min(minX, c.isoX); maxX = Math.max(maxX, c.isoX);
      minY = Math.min(minY, c.isoY); maxY = Math.max(maxY, c.isoY);
    }
    const pad = 4;
    const gw = Math.max(1, maxX - minX), gh = Math.max(1, maxY - minY);
    const sx = (W - pad * 2) / gw, sy = (H - pad * 2) / gh;
    const k = Math.min(sx, sy);
    const px = (isoX, isoY) => [pad + (isoX - minX) * k, pad + (isoY - minY) * k];
    // 底
    ctx.fillStyle = 'rgba(20,30,24,0.9)';
    ctx.fillRect(0, 0, W, H);
    // 城市点（迷雾：未探索画灰，已探索按势力色）
    for (const c of cities) {
      const [x, y] = px(c.isoX, c.isoY);
      const explored = typeof this.game.isCityExplored !== 'function' || this.game.isCityExplored(c.id);
      ctx.beginPath();
      ctx.arc(x, y, c.size >= 3 ? 2.6 : 1.8, 0, Math.PI * 2);
      if (!explored) { ctx.fillStyle = 'rgba(90,90,90,0.5)'; }
      else if (c.owner && FACTIONS[c.owner]) { ctx.fillStyle = FACTIONS[c.owner].color; }
      else { ctx.fillStyle = '#cfc090'; }
      ctx.fill();
    }
    // 当前选中城高亮
    if (this.game.selectedCity) {
      const sc = this.game.cities.get(this.game.selectedCity);
      if (sc) { const [x, y] = px(sc.isoX, sc.isoY); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.4; ctx.stroke(); }
    }
    // 视口框：主画布四角对应的 iso 坐标
    try {
      const tl = this.map.screenToIso(0, 0), br = this.map.screenToIso(this.map.canvas.width, this.map.canvas.height);
      const [x1, y1] = px(tl.x, tl.y), [x2, y2] = px(br.x, br.y);
      ctx.strokeStyle = 'rgba(255,215,0,0.85)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } catch (e) {}
  }

  // 点击小地图跳转
  _v17MinimapJump(e) {
    if (!this.map || !this.game) return;
    const mm = e.currentTarget;
    const rect = mm.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    // 反算 iso 坐标：找最近城市
    let best = null, bd = Infinity;
    for (const c of this.game.cities.values()) {
      // 与 _v17RenderMinimap 相同的投影
      // 直接用屏幕差近似：跳过，改用点击位置找最近已探索城
      if (typeof this.game.isCityExplored === 'function' && !this.game.isCityExplored(c.id)) continue;
      // 把 iso 转小地图坐标需范围；简化：遍历求最近（数据量小可接受）
      best = best || c; bd = bd; // no-op
    }
    // 复用：把小地图点击 -> 屏幕坐标 -> 找最近城市
    // 直接调用主画布命中：将小地图点击换算为主画布中心缩放
    // 简化实现：找距离小地图点击最近的已探索城市
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of this.game.cities.values()) {
      minX = Math.min(minX, c.isoX); maxX = Math.max(maxX, c.isoX);
      minY = Math.min(minY, c.isoY); maxY = Math.max(maxY, c.isoY);
    }
    const pad = 4, gw = Math.max(1, maxX - minX), gh = Math.max(1, maxY - minY);
    const k = Math.min((mm.width - pad * 2) / gw, (mm.height - pad * 2) / gh);
    const clickIsoX = (mx - pad) / k + minX, clickIsoY = (my - pad) / k + minY;
    let near = null, nd = Infinity;
    for (const c of this.game.cities.values()) {
      if (typeof this.game.isCityExplored === 'function' && !this.game.isCityExplored(c.id)) continue;
      const d = (c.isoX - clickIsoX) ** 2 + (c.isoY - clickIsoY) ** 2;
      if (d < nd) { nd = d; near = c; }
    }
    if (near) {
      this.game.selectedCity = near.id; this.game.selectedArmy = null;
      this._v17FocusCity(near); this.showCityPanel(near);
      this.toast('跳转：' + near.name);
    }
  }

  // ---------- 四、新手指引（阵型/天气/士气） ----------
  _v17GuideFlag(key) {
    try { return localStorage.getItem('nanchao_v17_' + key) === '1'; } catch (e) { return false; }
  }
  _v17MarkGuide(key) { try { localStorage.setItem('nanchao_v17_' + key, '1'); } catch (e) {} }

  // 通用气泡提示
  _v17Bubble(html, anchorSelector, key) {
    if (key && this._v17GuideFlag(key)) return;
    const anchor = anchorSelector ? document.querySelector(anchorSelector) : document.body;
    if (!anchor) return;
    const bub = document.createElement('div');
    bub.className = 'v17-guide-bubble';
    bub.innerHTML = html + `<div class="v17-guide-close">知道了 ✕</div>`;
    anchor.style.position = anchor.style.position || 'relative';
    anchor.appendChild(bub);
    const close = () => { bub.remove(); if (key) this._v17MarkGuide(key); };
    bub.querySelector('.v17-guide-close').onclick = close;
    setTimeout(close, 8000); // 8 秒自动消失
  }

  // 首次战斗时的引导集合（本次会话内去重，避免 shell/state 重复触发）
  _v17FirstBattleGuides(st) {
    if (this._v17Guided) return;
    this._v17Guided = true;
    // 阵型选择引导（首次战斗）
    this._v17Bubble(
      '<b>⚔ 阵法可切换</b><br>战斗下方「阵法」栏可即时切换阵型：雁行善包抄、方圆善守、锋矢善突击。不同阵型克制不同兵种。',
      '#bt-v17-formation', 'fm_guide');
    // 天气效果提示（首次遇到天气）
    this._v17Bubble(
      '<b>🌤 战场天气</b><br>顶部天气图标随季节/地形变化：水泽利水军、山地利弓兵、荒漠耗补给。善用地形可事半功倍。',
      '#bt-v17-weather', 'wx_guide');
    // 士气系统首次说明
    this._v17Bubble(
      '<b>❤ 军心士气</b><br>军队下方绿→黄→红即军心：绿（高昂）攻防加成，红（崩溃）可能溃退。连胜涨士气，连败则低落。',
      '#bt-v17-morale-att', 'morale_guide');
  }

  // ---------- 三、军队信息面板深化 ----------
  // 生成军队深化区块 HTML（士气/阵型/兵种/补给/天气修正/武将详情/战斗预览）
  _v17ArmyDeepHTML(army, gen, city) {
    if (!army) return '';
    const parts = [];
    // 1) 士气条：以武将忠诚派生（无独立士气字段时），绿黄红渐变
    const morale = Math.max(0, Math.min(100, Math.round((gen && typeof gen.loyalty === 'number') ? gen.loyalty : 60)));
    const mCls = morale >= 66 ? 'v17-morale-high' : (morale >= 33 ? 'v17-morale-mid' : 'v17-morale-low');
    parts.push(`
      <div class="v17-army-block">
        <div class="v17-army-row"><span class="v17-army-k">军心</span>
          <span class="v17-morale-track ${mCls}" style="width:120px"><span class="v17-morale-fill" style="width:${morale}%"></span></span>
          <b>${morale}</b>
        </div>`);
    // 2) 阵型
    const fmName = (FORMATIONS[army.formation] && FORMATIONS[army.formation].name) || army.formation || '—';
    parts.push(`<div class="v17-army-row"><span class="v17-army-k">阵法</span><b>${fmName}</b></div>`);
    // 3) 兵种构成（unitMix 按占比横条）
    if (army.unitMix && typeof army.unitMix === 'object') {
      const mix = army.unitMix;
      const total = Object.values(mix).reduce((s, v) => s + (Number(v) || 0), 0) || 1;
      const order = ['infantry', 'cavalry', 'archer'];
      const labels = { infantry: '步', cavalry: '骑', archer: '弓' };
      const segs = order.filter(t => mix[t]).map(t => {
        const pct = Math.round((Number(mix[t]) || 0) / total * 100);
        return `<span class="v17-mix-seg" style="flex:${Number(mix[t]) || 0}">${labels[t] || t}${pct}%</span>`;
      }).join('');
      parts.push(`<div class="v17-army-row"><span class="v17-army-k">兵种</span><span class="v17-mix-bar">${segs}</span></div>`);
    }
    // 4) 补给状态（带守卫）
    let supplyTxt = '未知', supplyCls = '';
    try {
      if (typeof computeSupplyStatus === 'function') {
        const st = computeSupplyStatus(this.game, army);
        if (st.cut) { supplyTxt = '✖ 补给线被切断！战力-30%'; supplyCls = 'v17-bad'; }
        else if (st.long) { supplyTxt = '⚠ 补给线过长，粮草消耗+50%'; supplyCls = 'v17-warn'; }
        else { supplyTxt = '✓ 补给畅通'; supplyCls = 'v17-good'; }
      }
    } catch (e) { supplyTxt = '补给未知'; }
    parts.push(`<div class="v17-army-row"><span class="v17-army-k">补给</span><b class="${supplyCls}">${supplyTxt}</b></div>`);
    // 5) 天气/地形修正
    const season = (this.game && typeof this.game.getSeason === 'function') ? this.game.getSeason() : '';
    const terr = (city && city.terrain) || 'plain';
    const tName = (TERRAIN && TERRAIN[terr] && TERRAIN[terr].name) ? TERRAIN[terr].name : terr;
    parts.push(`<div class="v17-army-row"><span class="v17-army-k">地形/季节</span><b>${tName} · ${season || ''}季</b></div>`);
    parts.push(`</div>`);

    // 6) 武将详情：等级/忠诚/装备/技能
    if (gen) {
      const eq = gen.equipment || {};
      const eqNames = ['weapon', 'armor', 'mount', 'treasure'].map(s => eq[s]).filter(Boolean).join('、') || '无';
      const skills = (Array.isArray(gen.skills) ? gen.skills : []).map(s => typeof s === 'string' ? s : (s.name || '?')).join('、') || '无';
      parts.push(`
        <div class="v17-army-block">
          <div class="v17-army-row"><span class="v17-army-k">等级</span><b>Lv.${gen.level || 1}</b>
            <span class="v17-army-k">忠诚</span><b class="${(gen.loyalty || 0) < 30 ? 'v17-bad' : ''}">${Math.round(gen.loyalty || 0)}</b></div>
          <div class="v17-army-row"><span class="v17-army-k">装备</span><b>${eqNames}</b></div>
          <div class="v17-army-row"><span class="v17-army-k">绝技</span><b>${skills}</b></div>
        </div>`);
    }

    // 7) 战斗预览：相邻可攻击目标，估算胜率/预计伤亡
    const preview = this._v17BattlePreview(army);
    if (preview) parts.push(preview);
    return parts.join('');
  }

  // 战斗预览：基于兵力/统帅的简易胜率估计
  _v17BattlePreview(army) {
    if (!army || army.faction !== (this.game && this.game.playerFaction)) return '';
    const links = CITY_LINKS[army.cityId] || [];
    const myGen = this.game.getGeneral(army.generalId);
    const myPow = (army.troops || 0) * (1 + ((myGen && myGen.command) || 50) / 200);
    let html = '<div class="v17-army-block v17-preview"><div class="v17-army-title">⚔ 接敌预览</div>';
    let has = false;
    for (const tid of links) {
      const tc = this.game.cities.get(tid);
      if (!tc || tc.owner === army.faction) continue; // 仅演示敌对/中立目标
      const enemyTroops = tc.garrison || 0;
      if (enemyTroops <= 0) continue;
      has = true;
      const enemyPow = enemyTroops * 1.0;
      const winRate = Math.max(5, Math.min(95, Math.round(myPow / (myPow + enemyPow) * 100)));
      const estLoss = Math.round(enemyPow / (myPow + enemyPow) * (army.troops || 0) * 0.4);
      const rateCls = winRate >= 60 ? 'v17-good' : (winRate >= 40 ? 'v17-warn' : 'v17-bad');
      html += `<div class="v17-army-row"><span class="v17-army-k">${tc.name}</span>
        <b class="${rateCls}">胜率约 ${winRate}%</b>
        <span class="v17-army-k">预估自损</span><b class="v17-bad">~${estLoss}</b></div>`;
    }
    if (!has) html += `<div class="v17-army-row"><span class="v17-army-k">接敌</span><b>邻近无敌对驻军</b></div>`;
    html += '</div>';
    return html;
  }

  // ---------- 五、通知系统增强（战斗相关） ----------
  // type: 'win' | 'lose' | 'streak' | 'skill' | 'supply' | 'info'
  _v17BattleNotify(type, msg) {
    let box = document.getElementById('v17-battle-notify');
    if (!box) {
      box = document.createElement('div');
      box.id = 'v17-battle-notify';
      box.className = 'v17-battle-notify';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    const icon = { win: '★', lose: '✖', streak: '🔥', skill: '✦', supply: '🎒', info: 'ℹ' }[type] || 'ℹ';
    item.className = 'v17-notify-item ' + (type || 'info');
    item.innerHTML = `<span class="v17-notify-icon">${icon}</span><span class="v17-notify-text">${msg}</span>`;
    box.appendChild(item);
    // 性能保护：通知最多保留 4 条
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 400); }, 3200);
  }
}
