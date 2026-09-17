// ============================================================
// ui.js — UI 渲染、面板、弹窗、交互（表现层强化版）
// ============================================================
import { FACTIONS, SEASONS, SEASON_ICON, UNIT_TYPES, IMG, CITY_LINKS, TERRAIN } from './data.js';
import { Game } from './game.js';
import { IsometricMap } from './map.js';
import { saveGame, loadGame, hasSave, getSaveInfo } from './save.js';
import { AudioManager } from './audio.js';
import { Tutorial } from './tutorial.js';

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
  }

  // ---------- 启动 ----------
  start() {
    this._installGlobalAudio();
    this.showMainMenu();
    // 隐藏 loading 卷轴
    const ls = document.getElementById('loading-screen');
    if (ls) setTimeout(() => ls.classList.add('hide'), 500);
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
    this.container.innerHTML = `
      <div class="main-menu">
        <div class="title-screen">
          <img src="${IMG.titleBg}" class="title-bg" onerror="this.style.display='none'">
          <div class="title-overlay">
            <h1 class="game-title">南北朝</h1>
            <p class="subtitle">—— 乱世英雄起四方 ——</p>
            <div class="menu-buttons">
              <button class="btn-ancient" id="btn-start">开始游戏</button>
              <button class="btn-ancient" id="btn-load" ${hasSave() ? '' : 'disabled'}>读取存档</button>
              <button class="btn-ancient" id="btn-tutorial">重看教程</button>
              <button class="btn-ancient" id="btn-quit">退出</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-start').onclick = () => this.showFactionSelect();
    document.getElementById('btn-tutorial').onclick = () => this._replayTutorial();
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
  }

  // 主菜单「重看教程」：开一局新游戏后播放教程
  _replayTutorial() {
    this.game = new Game();
    this.game.initGame('nanchao');
    this.initGameUI();
    this.tutorial.restart();
  }

  // ---------- 势力选择 ----------
  showFactionSelect() {
    const factions = Object.values(FACTIONS);
    this.container.innerHTML = `
      <div class="faction-select">
        <h2 class="panel-title">—— 选择你的霸业 ——</h2>
        <div class="faction-cards">
          ${factions.map(f => `
            <div class="faction-card" data-fid="${f.id}">
              <div class="faction-color-bar" style="background:${f.color}"></div>
              <h3 style="color:${f.color}">${f.name}</h3>
              <p class="faction-capital">都城：${f.capital === 'jiankang' ? '建康' : f.capital === 'yecheng' ? '邺城' : '长安'}</p>
              <p class="faction-desc">${f.description}</p>
              <p class="faction-bonus"><b>特色：</b>${f.bonus}</p>
              <p class="faction-cities"><b>初始城市：</b>${f.startCities.length} 座</p>
            </div>
          `).join('')}
        </div>
        <button class="btn-ancient" id="btn-back-menu">返回</button>
      </div>
    `;

    document.querySelectorAll('.faction-card').forEach(card => {
      card.onmouseenter = () => card.classList.add('selected');
      card.onmouseleave = () => card.classList.remove('selected');
      card.onclick = () => {
        const fid = card.dataset.fid;
        this.game = new Game();
        this.game.initGame(fid);
        this.initGameUI();
        // 首次游戏触发新手教程
        if (!Tutorial.isDone()) {
          setTimeout(() => this.tutorial.start(), 600);
        }
      };
    });
    document.getElementById('btn-back-menu').onclick = () => this.showMainMenu();
  }

  // ---------- 游戏主界面 ----------
  initGameUI() {
    const myFac = FACTIONS[this.game.playerFaction];
    this.container.innerHTML = `
      <div class="game-screen">
        <!-- 顶部栏 -->
        <div class="top-bar">
          <div class="top-item faction-title-click" id="top-faction" title="点击查看势力情报">
            <b style="color:${myFac.color}">${myFac.name}</b>
          </div>
          <div class="top-item">回合 <b id="hdr-turn">1</b></div>
          <div class="top-item">季节 <b id="hdr-season">春</b></div>
          <div class="top-item">金 <b id="hdr-money">0</b></div>
          <div class="top-item">粮 <b id="hdr-food">0</b></div>
          <div class="top-item">兵 <b id="hdr-army">0</b></div>
          <div class="top-item">民心 <b id="hdr-morale">60</b></div>
          <div class="top-bar-btns">
            <button class="btn-icon" id="btn-mute" title="静音">🔊</button>
            <button class="btn-icon" id="btn-tech" title="科技树">📜</button>
            <button class="btn-icon" id="btn-ach" title="成就">🏆</button>
            <button class="btn-small" id="btn-save">存档</button>
            <button class="btn-small" id="btn-diplomacy">外交</button>
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

    window.addEventListener('resize', () => { if (this.map) { this.map.resize(); this._updateMapMarker(); } });

    // 绑定按钮
    document.getElementById('btn-end-turn').onclick = () => this.endTurn();
    document.getElementById('btn-save').onclick = () => {
      const r = saveGame(this.game);
      this.toast(r.msg);
    };
    document.getElementById('btn-diplomacy').onclick = () => this.showDiplomacy();
    document.getElementById('btn-recruit').onclick = () => this.showRecruitPanel();
    document.getElementById('btn-menu').onclick = () => this.showSettings();
    document.getElementById('btn-tech').onclick = () => this.showTechTree();
    document.getElementById('btn-ach').onclick = () => this.showAchievements();
    document.getElementById('btn-mute').onclick = () => this.toggleMute();
    document.getElementById('top-faction').onclick = () => this.showFactionIntel();

    // 启动背景音乐
    this.audio.resume();
    this.audio.startBGM();

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
          ${availableGenerals.length > 0 ? `
            <select id="mayor-select" class="select-small">
              ${availableGenerals.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
            </select>
            <button class="btn-small" onclick="__ui_.assignMayor('${city.id}')">任命太守</button>
          ` : ''}
          <button class="btn-small" onclick="__ui_.createArmy('${city.id}')">组建军队</button>
        </div>
      ` : ''}
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

    slot.innerHTML = `
      <div class="general-detail">
        <img src="${IMG.portrait(gen.portrait)}" class="gen-portrait" style="width:56px;height:56px;float:left;margin:0 8px 4px 0" onerror="this.style.display='none'">
        <div style="font-size:15px;color:#FFD700">${gen.name} <small style="color:#9A8B6A">Lv.${level}</small></div>
        <div class="general-meta-row"><span>身份</span><b>${gen.role}</b></div>
        <div class="general-meta-row"><span>忠诚</span><b>${Math.round(gen.loyalty)}</b></div>
        <div class="radar-wrap"><canvas id="gen-radar" width="160" height="160"></canvas></div>
        <div class="general-meta-row"><span>经验</span><b>${exp}/${expNeed}</b></div>
        <div class="exp-bar-wrap"><div class="exp-bar" style="width:${Math.min(100, exp / expNeed * 100)}%"></div></div>
        ${skills.length > 0 ? `<div>${skills.map(s => `<span class="skill-chip">${typeof s === 'string' ? s : (s.name || '技能')}</span>`).join('')}</div>` : ''}
      </div>
    `;
    const cv = document.getElementById('gen-radar');
    if (cv) this.drawRadar(cv, gen);
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
      <div class="action-buttons">
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
    this._renderBattleState(st, true);
  }

  _renderBattleShell(modal, st, sceneKey) {
    modal.innerHTML = `
      <div class="modal battle-modal">
        <div class="battle-round-badge" id="bt-round">第 1 / ${st.maxRounds || 5} 回合</div>
        <div class="battle-arena">
          <div class="battle-scene" style="background-image:url('${IMG.battle(sceneKey)}')" onerror="this.style.display='none'"></div>
          <div class="battle-side-box">
            <img class="battle-portrait att" src="${IMG.portrait((st.attacker && st.attacker.portrait) || 'yang_kan')}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div class="battle-gen-name">${(st.attacker && st.attacker.name) || '我军'}</div>
              <div class="troop-bar-wrap"><div class="troop-bar" id="bt-att-bar"></div></div>
              <div class="troop-num" id="bt-att-num">0</div>
            </div>
          </div>
          <div class="battle-vs-big">VS</div>
          <div class="battle-side-box right">
            <img class="battle-portrait def" src="${IMG.portrait((st.defender && st.defender.portrait) || 'gao_aocao')}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div class="battle-gen-name">${(st.defender && st.defender.name) || '守军'}</div>
              <div class="troop-bar-wrap"><div class="troop-bar" id="bt-def-bar"></div></div>
              <div class="troop-num" id="bt-def-num">0</div>
            </div>
          </div>
        </div>
        <div class="siege-wrap" id="bt-siege-wrap" style="display:none">
          <div class="siege-label">破城进度 —— ${st.cityName || ''}</div>
          <div class="siege-bar"><div class="siege-fill" id="bt-siege-fill"></div></div>
        </div>
        <div class="battle-log" id="bt-log"></div>
        <div class="battle-actions" id="bt-actions"></div>
      </div>
    `;
  }

  _renderBattleState(st, isFirst) {
    const setBar = (barId, numId, cur, max) => {
      const bar = document.getElementById(barId);
      const num = document.getElementById(numId);
      if (!bar || !num) return;
      const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
      this.animateNumber(num, parseInt(num.textContent, 10) || 0, cur, 400);
      bar.style.width = pct + '%';
    };
    if (st.attacker) setBar('bt-att-bar', 'bt-att-num', st.attacker.troops, st._attMax || st.attacker.troops);
    if (st.defender) setBar('bt-def-bar', 'bt-def-num', st.defender.troops, st._defMax || st.defender.troops);
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

    // 动作按钮
    const actionsEl = document.getElementById('bt-actions');
    if (actionsEl) {
      // 战斗结束
      if (st.over || st.result) {
        this._renderBattleResult(st);
        return;
      }
      const avail = Array.isArray(st.availableActions) ? st.availableActions : ['attack', 'strong', 'defend', 'retreat'];
      const labels = {
        attack: '稳攻', strong: '猛攻', defend: '防御', retreat: '撤退'
      };
      actionsEl.innerHTML = avail.map(a => {
        if (a.startsWith('skill:')) {
          const sid = a.slice(6);
          return `<button class="btn-small skill-btn" onclick="__ui_.battleDoAction('${a}')">✦ ${sid}</button>`;
        }
        return `<button class="btn-small" onclick="__ui_.battleDoAction('${a}')">${labels[a] || a}</button>`;
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

    const logEl = document.getElementById('bt-log');
    if (logEl) {
      logEl.innerHTML += `<div class="log-crit">—— ${titleTxt} ——</div>`;
      if (result.attackerLoss !== undefined) logEl.innerHTML += `<div>攻方伤亡：${result.attackerLoss}</div>`;
      if (result.defenderLoss !== undefined) logEl.innerHTML += `<div>守方伤亡：${result.defenderLoss}</div>`;
      if (result.conquered) logEl.innerHTML += `<div class="log-crit">★ 城池已陷落！</div>`;
    }
    const actionsEl = document.getElementById('bt-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `<button class="btn-ancient" onclick="__ui_.closeBattle()">继续</button>`;
    }
  }

  // ---------- 旧版战斗结算弹窗（兼容降级） ----------
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
  }

  // ---------- 外交面板 ----------
  showDiplomacy() {
    const otherFactions = Object.values(FACTIONS).filter(f => f.id !== this.game.playerFaction);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">外交</h2>
        ${otherFactions.map(f => {
          const rel = this.game.diplomacy.getRelation(this.game.playerFaction, f.id);
          const bribable = this.game.getFactionGenerals(f.id).filter(g => g.loyalty < 40);
          return `
            <div class="diplo-row" style="border-left:4px solid ${f.color}">
              <b style="color:${f.color}">${f.name}</b>
              <span>关系：${rel.relation > 20 ? '友好' : rel.relation < -20 ? '敌对' : '中立'} ${rel.alliance ? '[同盟]' : ''} ${rel.ceasefire ? '[停战]' : ''}</span>
              <div class="diplo-actions">
                <button class="btn-small" onclick="__ui_.diploAction('alliance','${f.id}')">同盟</button>
                <button class="btn-small" onclick="__ui_.diploAction('ceasefire','${f.id}')">停战</button>
                <button class="btn-small" onclick="__ui_.diploAction('tribute','${f.id}')">进贡500金</button>
                ${bribable.length > 0 ? `<button class="btn-small" onclick="__ui_.diploAction('bribe','${f.id}','${bribable[0].id}')">策反${bribable[0].name}</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
        <button class="btn-ancient" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
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

  // ---------- 招募在野武将 ----------
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
              <img src="${IMG.portrait(g.portrait)}" class="gen-portrait" onerror="this.style.display='none'">
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
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
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
    if (typeof this.game.getAchievements !== 'function') {
      this.toast('成就系统尚未开放');
      return;
    }
    let list;
    try { list = this.game.getAchievements() || []; } catch (e) { this.toast('成就数据异常'); return; }
    const unlocked = list.filter(a => a.unlocked).length;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal ach-modal">
        <h2 class="modal-title">成就</h2>
        <div class="ach-progress-bar">已解锁 ${unlocked} / ${list.length}</div>
        <div class="ach-grid">
          ${list.map(a => `
            <div class="ach-item ${a.unlocked ? '' : 'locked'}">
              <div class="ach-icon">${a.icon || '🏆'}</div>
              <div class="ach-name">${a.name || '???'}</div>
              <div class="ach-desc">${a.description || ''}</div>
              ${a.unlocked && a.unlockTurn ? `<div class="ach-turn">第 ${a.unlockTurn} 回合</div>` : ''}
            </div>
          `).join('')}
        </div>
        <button class="btn-ancient" style="margin-top:14px" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 右上角成就通知横幅
  showAchToast(a) {
    if (!a) return;
    const t = document.createElement('div');
    t.className = 'ach-toast';
    t.innerHTML = `
      <div class="ach-toast-icon">${a.icon || '🏆'}</div>
      <div>
        <div class="ach-toast-title">★ 成就解锁 ★</div>
        <div class="ach-toast-name">${a.name || ''}</div>
        <div class="ach-toast-desc">${a.description || ''}</div>
      </div>
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    this.audio.playAchievement();
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 600);
    }, 3200);
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
          <span>音量</span>
          <input type="range" id="set-volume" min="0" max="100" value="${Math.round(this.audio.volume * 100)}">
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

    document.getElementById('set-volume').oninput = (e) => {
      this.audio.setVolume(e.target.value / 100);
    };
    document.getElementById('set-mute').onclick = (e) => {
      const m = this.audio.toggleMute();
      e.target.textContent = m ? '已静音' : '未静音';
      const topBtn = document.getElementById('btn-mute');
      if (topBtn) { topBtn.textContent = m ? '🔇' : '🔊'; topBtn.classList.toggle('muted', m); }
    };
    document.getElementById('set-bgm').onclick = (e) => {
      if (this.audio._bgmOn) { this.audio.stopBGM(); e.target.textContent = '已暂停'; }
      else { this.audio.startBGM(); e.target.textContent = '播放中'; }
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
    this.showMainMenu();
  }

  // ---------- 结束回合 ----------
  endTurn() {
    if (this.game.state !== 'playing') return;
    this.game.endTurn();
    this.map.render();
    this._updateMapMarker();
    this.refreshUI();
    this.checkGameOver();

    // 检查是否有待处理事件
    if (this.game.eventSystem.pendingEvents && this.game.eventSystem.pendingEvents.length > 0) {
      this.showEventModal(this.game.eventSystem.pendingEvents.shift());
    }
  }

  showEventModal(event) {
    this.audio.playEvent();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal event-modal">
        <h2 class="modal-title">📜 ${event.name}</h2>
        <img src="${IMG.event(event.illustration)}" class="event-img" onerror="this.style.display='none'">
        <p class="event-desc">${event.description}</p>
        <div class="event-options">
          ${event.options.map((opt, i) =>
            `<button class="btn-ancient" onclick="__ui_.chooseEvent(${i})">${opt.text}</button>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this._currentEvent = event;
  }

  chooseEvent(idx) {
    if (this._currentEvent) {
      this.game.eventSystem.applyEvent(this.game, this._currentEvent, idx);
      this._currentEvent = null;
    }
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    this.refreshUI();
    if (this.game.eventSystem.pendingEvents && this.game.eventSystem.pendingEvents.length > 0) {
      setTimeout(() => this.showEventModal(this.game.eventSystem.pendingEvents.shift()), 300);
    }
  }

  closeBattle() {
    // 关闭多回合战斗弹窗
    const bm = document.getElementById('battle-modal-root');
    if (bm) bm.remove();
    // 关闭旧版战斗结算弹窗
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      if (ov.querySelector('.battle-modal')) ov.remove();
    });
    this._battleMode = 'old';
    if (this.game && this.game.state === 'battle') this.game.state = 'playing';
    this.refreshUI();
    this.checkGameOver();
  }

  // ---------- 胜负判定 ----------
  checkGameOver() {
    if (this.game.gameOver) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal gameover-modal">
          <h2 class="modal-title ${this.game.gameOver.win ? 'win' : 'lose'}">
            ${this.game.gameOver.win ? '★ 天下一统 ★' : '霸业成空'}
          </h2>
          <p class="gameover-text">${this.game.gameOver.text}</p>
          <p class="gameover-sub">历经 ${this.game.turn} 回合</p>
          <button class="btn-ancient" onclick="__ui_.showMainMenu()">返回主菜单</button>
        </div>
      `;
      document.body.appendChild(modal);
      if (this.game.gameOver.win) this.audio.playVictory();
      else this.audio.playDefeat();
    }
  }

  // ---------- 数字滚动动画 ----------
  animateNumber(el, from, to, duration = 500) {
    if (!el) return;
    from = Number(from); to = Number(to);
    if (isNaN(from) || isNaN(to)) { el.textContent = to; return; }
    if (from === to) { el.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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

    // 数字滚动
    const moneyEl = document.getElementById('hdr-money');
    const foodEl = document.getElementById('hdr-food');
    if (moneyEl && res) this.animateNumber(moneyEl, this._prevRes.money, Math.round(res.money), 500);
    if (foodEl && res) this.animateNumber(foodEl, this._prevRes.food, Math.round(res.food), 500);

    const totalTroops = this.game.getFactionArmies(this.game.playerFaction)
      .reduce((s, a) => s + a.troops, 0);
    const armyEl = document.getElementById('hdr-army');
    if (armyEl) this.animateNumber(armyEl, this._prevRes.army, totalTroops, 500);

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

    // 待弹出成就
    if (this.game.pendingAchievements && this.game.pendingAchievements.length > 0) {
      [...this.game.pendingAchievements].forEach(a => this.showAchToast(a));
      this.game.pendingAchievements.length = 0;
    }

    if (this.map) this.map.render();
    this._updateMapMarker();
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
}
