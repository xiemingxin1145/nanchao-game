// ============================================================
// ui.js — UI 渲染、面板、弹窗、交互
// ============================================================
import { FACTIONS, SEASONS, SEASON_ICON, UNIT_TYPES, IMG, CITY_LINKS } from './data.js';
import { Game } from './game.js';
import { IsometricMap } from './map.js';
import { saveGame, loadGame, hasSave, getSaveInfo } from './save.js';

export class UI {
  constructor() {
    this.game = null;
    this.map = null;
    this.container = document.getElementById('app');
    this.modalQueue = [];
  }

  // ---------- 启动 ----------
  start() {
    this.showMainMenu();
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
              <button class="btn-ancient" id="btn-quit">退出</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-start').onclick = () => this.showFactionSelect();
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
      card.onclick = () => {
        const fid = card.dataset.fid;
        this.game = new Game();
        this.game.initGame(fid);
        this.initGameUI();
      };
    });
    document.getElementById('btn-back-menu').onclick = () => this.showMainMenu();
  }

  // ---------- 游戏主界面 ----------
  initGameUI() {
    this.container.innerHTML = `
      <div class="game-screen">
        <!-- 顶部栏 -->
        <div class="top-bar">
          <div class="top-item">回合 <b id="hdr-turn">1</b></div>
          <div class="top-item">季节 <b id="hdr-season">春</b></div>
          <div class="top-item">金 <b id="hdr-money">0</b></div>
          <div class="top-item">粮 <b id="hdr-food">0</b></div>
          <div class="top-item">兵 <b id="hdr-army">0</b></div>
          <div class="top-item">民心 <b id="hdr-morale">60</b></div>
          <div class="top-bar-btns">
            <button class="btn-small" id="btn-save">存档</button>
            <button class="btn-small" id="btn-diplomacy">外交</button>
            <button class="btn-small" id="btn-recruit">招募</button>
            <button class="btn-small" id="btn-menu">菜单</button>
          </div>
        </div>

        <!-- 主区域 -->
        <div class="main-area">
          <div class="map-container">
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

    window.addEventListener('resize', () => this.map && this.map.resize());

    // 绑定按钮
    document.getElementById('btn-end-turn').onclick = () => this.endTurn();
    document.getElementById('btn-save').onclick = () => {
      const r = saveGame(this.game);
      this.toast(r.msg);
    };
    document.getElementById('btn-diplomacy').onclick = () => this.showDiplomacy();
    document.getElementById('btn-recruit').onclick = () => this.showRecruitPanel();
    document.getElementById('btn-menu').onclick = () => this.showGameMenu();

    this.refreshUI();
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
        <div class="stat-row"><span>太守</span><b>${mayor ? mayor.name : '空缺'}</b></div>
      </div>
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
        break;
      case 'recruit_cavalry':
        result = this.game.cityRecruit(cityId, 'cavalry', 200);
        break;
      case 'recruit_archer':
        result = this.game.cityRecruit(cityId, 'archer', 300);
        break;
      case 'agri':
        result = this.game.cityDevelopAgri(cityId);
        break;
      case 'comm':
        result = this.game.cityDevelopComm(cityId);
        break;
      case 'repair':
        result = this.game.cityRepair(cityId);
        break;
      case 'tax_up':
        result = this.game.citySetTax(cityId, city.taxRate + 5);
        break;
      case 'tax_down':
        result = this.game.citySetTax(cityId, city.taxRate - 5);
        break;
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
      this.game.selectedArmy = result.army.id;
      this.showArmyPanel(result.army);
    }
    this.refreshUI();
  }

  // ---------- 军队面板 ----------
  showArmyPanel(army) {
    const panel = document.getElementById('panel-content');
    const gen = this.game.getGeneral(army.generalId);
    const city = this.game.cities.get(army.cityId);

    panel.innerHTML = `
      <h3 class="panel-subtitle" style="border-left:4px solid ${FACTIONS[army.faction].color}">
        ${gen ? gen.name : '军队'}
      </h3>
      <div class="stat-grid">
        <div class="stat-row"><span>兵力</span><b>${army.troops}</b></div>
        <div class="stat-row"><span>所在</span><b>${city ? city.name : '未知'}</b></div>
        <div class="stat-row"><span>状态</span><b>${army.hasMoved ? '已行动' : '可行动'}</b></div>
      </div>
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
        <button class="btn-small" onclick="__ui_.disbandArmy('${army.id}')">解散</button>
      </div>
    `;
  }

  armyMove(armyId, targetCityId) {
    const result = this.game.moveArmy(armyId, targetCityId);
    if (!result.ok) {
      this.toast(result.msg);
    } else if (result.result) {
      // 战斗结果
      this.showBattleModal(result.result);
    }
    const army = this.game.armies.find(a => a.id === armyId);
    if (army) this.showArmyPanel(army);
    this.map.render();
    this.refreshUI();
  }

  disbandArmy(armyId) {
    this.game.disbandArmy(armyId);
    document.getElementById('panel-content').innerHTML = '<p class="hint">军队已解散</p>';
    this.refreshUI();
  }

  // ---------- 战斗结算弹窗 ----------
  showBattleModal(result) {
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
          ${result.tactics.map(t => `<p class="tactic">◆ ${t}</p>`).join('')}
          ${result.battleLog.map(l => `<p>${l}</p>`).join('')}
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
    this.toast(result.msg);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  }

  // ---------- 游戏菜单 ----------
  showGameMenu() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">菜单</h2>
        <div class="menu-buttons">
          <button class="btn-ancient" onclick="__ui_.doSave()">保存游戏</button>
          <button class="btn-ancient" onclick="__ui_.doExit()">返回主菜单</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  doSave() {
    const r = saveGame(this.game);
    this.toast(r.msg);
  }

  doExit() {
    this.showMainMenu();
  }

  // ---------- 结束回合 ----------
  endTurn() {
    if (this.game.state !== 'playing') return;
    this.game.endTurn();
    this.map.render();
    this.refreshUI();
    this.checkGameOver();

    // 检查是否有待处理事件
    if (this.game.eventSystem.pendingEvents.length > 0) {
      this.showEventModal(this.game.eventSystem.pendingEvents.shift());
    }
  }

  showEventModal(event) {
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
    // 继续处理剩余事件
    if (this.game.eventSystem.pendingEvents.length > 0) {
      setTimeout(() => this.showEventModal(this.game.eventSystem.pendingEvents.shift()), 300);
    }
  }

  closeBattle() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    if (this.game.state === 'battle') this.game.state = 'playing';
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
    }
  }

  // ---------- 刷新 UI ----------
  refreshUI() {
    if (!this.game) return;
    const res = this.game.getPlayerRes();
    document.getElementById('hdr-turn').textContent = this.game.turn;
    document.getElementById('hdr-season').textContent =
      `${SEASON_ICON[this.game.getSeason()]} ${this.game.getSeason()}`;
    document.getElementById('hdr-money').textContent = res ? Math.round(res.money) : 0;
    document.getElementById('hdr-food').textContent = res ? Math.round(res.food) : 0;
    const totalTroops = this.game.getFactionArmies(this.game.playerFaction)
      .reduce((s, a) => s + a.troops, 0);
    document.getElementById('hdr-army').textContent = totalTroops;
    const cities = this.game.getFactionCities(this.game.playerFaction);
    const avgMorale = cities.length > 0
      ? Math.round(cities.reduce((s, c) => s + c.morale, 0) / cities.length) : 0;
    document.getElementById('hdr-morale').textContent = avgMorale;

    // 消息日志
    const logEl = document.getElementById('message-log');
    if (logEl) {
      logEl.innerHTML = this.game.log.slice(-30).map(l => `<div class="log-line">${l}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    this.map.render();
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
