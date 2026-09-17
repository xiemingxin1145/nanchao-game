// ============================================================
// tutorial.js — 新手教程系统（高亮遮罩 + 提示气泡）
// ============================================================

const DONE_KEY = 'nanchao_tutorial_done';

export class Tutorial {
  constructor(ui) {
    this.ui = ui;
    this.step = 0;
    this._destroyed = false;
    this.steps = [
      {
        title: '欢迎来到南北朝',
        text: '东晋末年，天下分裂为南北三朝。你将扮演一方之主，发展经济、征兵练武、招揽名将，最终一统天下。点击「下一步」开始你的霸业。',
        targetSelector: null, position: 'center'
      },
      {
        title: '这是你的城池',
        text: '右侧面板显示选中城市的详情：人口、农业、商业、防御、民心、驻军等。点击地图上你的都城查看详情。',
        targetSelector: '#right-panel', position: 'left'
      },
      {
        title: '征兵备战',
        text: '在城市面板中，点击「征兵 步 / 骑 / 弓」按钮招募士兵。金钱是征兵与发展的保障，注意收支平衡。',
        targetSelector: '#panel-content', position: 'left'
      },
      {
        title: '发展经济',
        text: '点击「发展农业」「发展商业」提升城市产出；「修缮防御」增强城防，「税率±」可调节税收。善用金钱，国方能富。',
        targetSelector: '#panel-content', position: 'left'
      },
      {
        title: '行军打仗',
        text: '在己方城市「组建军队」后，点击地图上的己方军队，可选择移动到友方城市、占领空城或进攻敌城。攻城略地，方能扩张版图。',
        targetSelector: '#game-canvas', position: 'top'
      },
      {
        title: '结束回合',
        text: '完成本回合所有行动后，点击右下角「结束回合」。AI 势力将随之行动，季节流转、钱粮结算、武将忠诚变化都会在此进行。',
        targetSelector: '#btn-end-turn', position: 'top'
      },
      {
        title: '善用武将',
        text: '武将有统帅、武力、智力、政治、忠诚五维属性。任命太守治理城市，率军出征攻城略地。忠诚过低的武将可能下野或被策反，务必善待。',
        targetSelector: '#panel-content', position: 'left'
      },
      {
        title: '一统天下',
        text: '当你的势力城市数达到 16 座，或彻底消灭敌对势力，便可统一天下，成就不世霸业！祝你武运昌隆！',
        targetSelector: '.top-bar', position: 'bottom'
      }
    ];
  }

  static isDone() {
    try { return localStorage.getItem(DONE_KEY) === 'true'; } catch (e) { return false; }
  }

  static markDone() {
    try { localStorage.setItem(DONE_KEY, 'true'); } catch (e) {}
  }

  static reset() {
    try { localStorage.removeItem(DONE_KEY); } catch (e) {}
  }

  // 启动教程（fromFirst = 首次游戏）
  start(autoSelectCapital = true) {
    // 教程开始前，自动选中玩家都城，让面板内容有意义
    if (autoSelectCapital && this.ui.game) {
      try {
        const fac = this.ui.game.playerFaction;
        const capitalId = (window.FACTIONS_REF && window.FACTIONS_REF[fac] && window.FACTIONS_REF[fac].capital)
          || (this.ui.game && this.ui.game.cities && [...this.ui.game.cities.values()].find(c => c.owner === fac && c.name));
        // 用更稳妥的方式：找玩家第一个城市
        const mine = this.ui.game.getFactionCities ? this.ui.game.getFactionCities(fac) : [];
        if (mine.length > 0) {
          const cap = mine.find(c => c.size >= 4) || mine[0];
          this.ui.game.selectedCity = cap.id;
          this.ui.game.selectedArmy = null;
          this.ui.showCityPanel(cap);
          if (this.ui.map) this.ui.map.render();
        }
      } catch (e) {}
    }
    this.step = 0;
    this._buildOverlay();
    this._showStep();
  }

  restart() { this.start(false); }

  _buildOverlay() {
    this.destroy();
    const ov = document.createElement('div');
    ov.className = 'tutorial-layer';
    ov.innerHTML = `
      <div class="tutorial-highlight" id="tut-highlight"></div>
      <div class="tutorial-bubble" id="tut-bubble">
        <div class="tutorial-title" id="tut-title"></div>
        <div class="tutorial-text" id="tut-text"></div>
        <div class="tutorial-footer">
          <button class="btn-small" id="tut-skip">跳过教程</button>
          <button class="btn-ancient btn-tut-next" id="tut-next">下一步</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById('tut-skip').onclick = () => this.skip();
    document.getElementById('tut-next').onclick = () => this.next();
    if (this.ui.audio) this.ui.audio.playClick();
  }

  _showStep() {
    if (this._destroyed) return;
    const s = this.steps[this.step];
    if (!s) { this.finish(); return; }

    const titleEl = document.getElementById('tut-title');
    const textEl = document.getElementById('tut-text');
    const bubble = document.getElementById('tut-bubble');
    const hl = document.getElementById('tut-highlight');
    const nextBtn = document.getElementById('tut-next');
    if (!titleEl) return;

    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    nextBtn.textContent = this.step === this.steps.length - 1 ? '开始征战' : '下一步';

    // 目标高亮
    let target = null;
    if (s.targetSelector) {
      target = document.querySelector(s.targetSelector);
    }
    if (hl) {
      if (target) {
        const r = target.getBoundingClientRect();
        hl.style.display = 'block';
        hl.style.left = (r.left - 6) + 'px';
        hl.style.top = (r.top - 6) + 'px';
        hl.style.width = (r.width + 12) + 'px';
        hl.style.height = (r.height + 12) + 'px';
      } else {
        hl.style.display = 'none';
      }
    }
    this._positionBubble(bubble, target, s.position);
    if (this.ui.audio) this.ui.audio.playHover();
  }

  _positionBubble(bubble, target, position) {
    if (!bubble) return;
    bubble.style.left = '';
    bubble.style.top = '';
    bubble.style.transform = '';
    bubble.classList.remove('pos-center', 'pos-top', 'pos-bottom', 'pos-left', 'pos-right');

    if (!target || position === 'center') {
      bubble.classList.add('pos-center');
      return;
    }
    const r = target.getBoundingClientRect();
    const bw = 320, bh = bubble.offsetHeight || 180;
    let left, top;
    switch (position) {
      case 'top':
        left = Math.max(20, Math.min(window.innerWidth - bw - 20, r.left + r.width / 2 - bw / 2));
        top = Math.max(20, r.top - bh - 20);
        if (top < 20) { left = r.right + 16; top = Math.max(20, r.top); }
        break;
      case 'bottom':
        left = Math.max(20, Math.min(window.innerWidth - bw - 20, r.left + r.width / 2 - bw / 2));
        top = Math.min(window.innerHeight - bh - 20, r.bottom + 20);
        break;
      case 'left':
        left = Math.max(20, r.left - bw - 20);
        if (left < 20) left = Math.max(20, r.right + 16);
        top = Math.max(20, Math.min(window.innerHeight - bh - 20, r.top + r.height / 2 - bh / 2));
        break;
      case 'right':
        left = r.right + 20;
        if (left + bw > window.innerWidth - 20) left = Math.max(20, r.left - bw - 20);
        top = Math.max(20, Math.min(window.innerHeight - bh - 20, r.top + r.height / 2 - bh / 2));
        break;
      default:
        left = (window.innerWidth - bw) / 2;
        top = (window.innerHeight - bh) / 2;
    }
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  next() {
    this.step++;
    if (this.step >= this.steps.length) { this.finish(); return; }
    this._showStep();
  }

  skip() {
    this.finish();
  }

  finish() {
    Tutorial.markDone();
    this.destroy();
    if (this.ui.audio) this.ui.audio.playCoin();
  }

  destroy() {
    this._destroyed = true;
    document.querySelectorAll('.tutorial-layer').forEach(n => n.remove());
  }
}
