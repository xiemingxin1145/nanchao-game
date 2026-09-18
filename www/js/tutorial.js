// ============================================================
// tutorial.js — 教程系统（V9.5 深化版：20 步 / 分章节 / 模式）
// ------------------------------------------------------------
// V9.5：从 8 步扩充到 20 步，分 6 章（基础/内政/武将/战斗/外交/高级）。
//   - 每步带 chapter 章节标记，气泡顶部显示「第 X 章 · n/20」进度。
//   - 模式：new（首次自动）/ chapter（指定章节）/ all（全教程）。
//   - 高亮遮罩 + 文字说明 + 跳过按钮 + 上一步/下一步。
//   - 游戏指南（GameGuide）为独立静态说明，由 ui.js 调用 openGameGuide()。
// 技术参考：onboarding 通用模式 —— spotlight 高亮（裁洞）+ toolip 气泡 +
//   箭头指示；步骤用数据驱动数组渲染，便于扩展。
// ============================================================

const DONE_KEY = 'nanchao_tutorial_done';

// 章节元数据
export const TUTORIAL_CHAPTERS = [
  { id: 'base',    name: '基础操作' },
  { id: 'interior',name: '内政经营' },
  { id: 'general', name: '武将之道' },
  { id: 'battle',  name: '战斗兵法' },
  { id: 'diplo',   name: '外交纵横' },
  { id: 'advanced',name: '王霸之业' }
];

export class Tutorial {
  constructor(ui) {
    this.ui = ui;
    this.step = 0;
    this._destroyed = false;
    this.mode = 'all';          // 'new' | 'chapter' | 'all'
    this._chapterId = null;
    this._steps = this._buildSteps();
    // 章节子集：startStep/endStep（按 chapterId 过滤后重排）
    this._chapterRange = null;
  }

  _buildSteps() {
    return [
      // ===== 第一章：基础操作 =====
      { chapter: 'base',
        title: '欢迎来到南北朝',
        text: '东晋末年，天下分裂为南北。你将扮演一方之主，发展经济、征兵练武、招揽名将，最终一统天下。点击「下一步」开始你的霸业。',
        targetSelector: null, position: 'center' },
      { chapter: 'base',
        title: '这是你的城池',
        text: '右侧面板显示选中城市的详情：人口、农业、商业、防御、民心、驻军。点击地图上你的都城查看详情。',
        targetSelector: '#right-panel', position: 'left' },
      { chapter: 'base',
        title: '结束回合',
        text: '完成本回合行动后，点击右下角「结束回合」。AI 势力随之行动，季节流转、钱粮结算皆在此时进行。',
        targetSelector: '#btn-end-turn', position: 'top' },

      // ===== 第二章：内政经营 =====
      { chapter: 'interior',
        title: '发展城市',
        text: '在城市面板中点击「发展农业」「发展商业」提升产出；「修缮防御」增强城防。善用金钱，国方能富。',
        targetSelector: '#panel-content', position: 'left' },
      { chapter: 'interior',
        title: '征兵备战',
        text: '点击「征兵 步/骑/弓」招募士兵。金钱是征兵与发展的保障，注意收支平衡。',
        targetSelector: '#panel-content', position: 'left' },
      { chapter: 'interior',
        title: '建造建筑',
        text: '城市可建造太学、校场、将作监等建筑，解锁科举、进阶兵种、徭役等高级功能。建筑需消耗回合建成。',
        targetSelector: '#panel-content', position: 'left' },
      { chapter: 'interior',
        title: '赋税与徭役',
        text: '「税率±」可调赋税：税高则钱多但民心降；徭役可征发民力大兴土木，但会折损民心与人口。量力而行。',
        targetSelector: '#panel-content', position: 'left' },

      // ===== 第三章：武将之道 =====
      { chapter: 'general',
        title: '招募武将',
        text: '在野武将可招募。武将有统帅、武力、智力、政治、忠诚五维。统帅高者善带兵，政治高者善治城。',
        targetSelector: '#panel-content', position: 'left' },
      { chapter: 'general',
        title: '武将升级',
        text: '武将通过战斗获得经验升级，属性随之提升。任命太守治理城市，率军出征攻城略地。',
        targetSelector: '#panel-content', position: 'left' },
      { chapter: 'general',
        title: '装备与技能',
        text: '武将可装备武器、铠甲、坐骑、宝物，习得技能。技能在战斗中提供兵种/阵法加成。忠诚过低的武将可能下野，务必善待。',
        targetSelector: '#panel-content', position: 'left' },

      // ===== 第四章：战斗兵法 =====
      { chapter: 'battle',
        title: '兵种克制',
        text: '兵种相克：骑兵克弓兵、弓兵克步兵、步兵克骑兵（+25%）。水战专用楼船/蒙冲/斗舰。出征前善用克制。',
        targetSelector: '#game-canvas', position: 'top' },
      { chapter: 'battle',
        title: '阵型选择',
        text: '军队可切换阵型（鹤翼/方圆/雁行等），不同阵型影响攻防与移动。积攒阵型经验解锁更强阵法。',
        targetSelector: '#game-canvas', position: 'top' },
      { chapter: 'battle',
        title: '多回合会战',
        text: '大会战为多回合厮杀，可释放武将技能、调度援军。组建军团可集结多军协同，形成决定性打击。',
        targetSelector: '#game-canvas', position: 'top' },

      // ===== 第五章：外交纵横 =====
      { chapter: 'diplo',
        title: '外交手段',
        text: '可与他国缔结同盟、停战、联姻、贸易协定。同盟共御强敌，联姻稳固关系并加成经济，贸易协定互通有无。',
        targetSelector: '.top-bar', position: 'bottom' },
      { chapter: 'diplo',
        title: '关系与制衡',
        text: '国家关系随互动增减。背盟会大幅降低关系并招致报复。远交近攻，方为长策。',
        targetSelector: '.top-bar', position: 'bottom' },

      // ===== 第六章：王霸之业 =====
      { chapter: 'advanced',
        title: '科技研究',
        text: '研究军事/经济/政治/阵法科技线，解锁进阶兵种、建筑与制度。科技是长治久安之本。',
        targetSelector: '.top-bar', position: 'bottom' },
      { chapter: 'advanced',
        title: '科举取士',
        text: '太学建成后可开科举，选拔贤才。状元门生治国，文治大兴。',
        targetSelector: '.top-bar', position: 'bottom' },
      { chapter: 'advanced',
        title: '王朝正统',
        text: '积累威望可登基称王、受禅建号，改元建国。正统所在，人心归之。',
        targetSelector: '.top-bar', position: 'bottom' },
      { chapter: 'advanced',
        title: '水战与宗教',
        text: '长江天堑需建造楼船、蒙冲、斗舰以水战争锋；佛道二教影响民心与文化，可因势利导。此外还有历法、天文、后宫等系统，待你自行探索。',
        targetSelector: '.top-bar', position: 'bottom' },
      { chapter: 'advanced',
        title: '一统天下',
        text: '当城市数达到 16 座或消灭所有敌对势力，便可统一天下！此外还有文化胜利、宗教、海战等多条王霸之路。祝你武运昌隆！',
        targetSelector: '.top-bar', position: 'bottom' }
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

  // 启动教程
  // mode: 'all' 全教程 | 'chapter' 指定章节 | 'new' 首次
  start(autoSelectCapital = true, opts = {}) {
    this.mode = opts.mode || 'all';
    this._chapterId = opts.chapterId || null;
    // 章节过滤
    if (this.mode === 'chapter' && this._chapterId) {
      this._steps = this._buildSteps().filter(s => s.chapter === this._chapterId);
    } else {
      this._steps = this._buildSteps();
    }
    this._chapterRange = null;

    if (autoSelectCapital && this.ui.game) {
      try {
        const fac = this.ui.game.playerFaction;
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

  restart() { this.start(false, { mode: this.mode, chapterId: this._chapterId }); }

  _buildOverlay() {
    this.destroy();
    const ov = document.createElement('div');
    ov.className = 'tutorial-layer';
    ov.innerHTML = `
      <div class="tutorial-highlight" id="tut-highlight"></div>
      <div class="tutorial-bubble" id="tut-bubble">
        <div class="tutorial-chapter" id="tut-chapter"></div>
        <div class="tutorial-title" id="tut-title"></div>
        <div class="tutorial-text" id="tut-text"></div>
        <div class="tutorial-progress" id="tut-progress"></div>
        <div class="tutorial-footer">
          <button class="btn-small" id="tut-skip">跳过教程</button>
          <span style="flex:1"></span>
          <button class="btn-small" id="tut-prev">上一步</button>
          <button class="btn-ancient btn-tut-next" id="tut-next">下一步</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById('tut-skip').onclick = () => this.skip();
    document.getElementById('tut-next').onclick = () => this.next();
    document.getElementById('tut-prev').onclick = () => this.prev();
    if (this.ui.audio) this.ui.audio.playClick();
  }

  _showStep() {
    if (this._destroyed) return;
    const s = this._steps[this.step];
    if (!s) { this.finish(); return; }

    const titleEl = document.getElementById('tut-title');
    const textEl = document.getElementById('tut-text');
    const chapterEl = document.getElementById('tut-chapter');
    const progressEl = document.getElementById('tut-progress');
    const bubble = document.getElementById('tut-bubble');
    const hl = document.getElementById('tut-highlight');
    const nextBtn = document.getElementById('tut-next');
    const prevBtn = document.getElementById('tut-prev');
    if (!titleEl) return;

    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    if (chapterEl) {
      const ch = TUTORIAL_CHAPTERS.find(c => c.id === s.chapter);
      chapterEl.textContent = ch ? `◆ ${ch.name} ◆` : '';
    }
    if (progressEl) {
      progressEl.textContent = `第 ${this.step + 1} / ${this._steps.length} 步`;
    }
    nextBtn.textContent = this.step === this._steps.length - 1 ? '开始征战' : '下一步';
    if (prevBtn) prevBtn.style.visibility = this.step === 0 ? 'hidden' : 'visible';

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
    const bw = 340, bh = bubble.offsetHeight || 200;
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
    if (this.step >= this._steps.length) { this.finish(); return; }
    this._showStep();
  }

  prev() {
    if (this.step <= 0) return;
    this.step--;
    this._showStep();
  }

  skip() {
    this.finish();
  }

  finish() {
    if (this.mode !== 'chapter') Tutorial.markDone();
    this.destroy();
    if (this.ui.audio) this.ui.audio.playCoin();
  }

  destroy() {
    this._destroyed = true;
    document.querySelectorAll('.tutorial-layer').forEach(n => n.remove());
  }
}

// ============================================================
// 游戏指南（静态说明文档）——供 ui.js 渲染为模态
// ============================================================
export const GAME_GUIDE = [
  { title: '概览', body: '《南北朝》是一款回合制历史策略游戏。你扮演一方势力之主，通过内政、军事、外交、科技、文化等手段发展壮大，最终一统天下。游戏以「结束回合」推进时间，四季流转，钱粮结算。' },
  { title: '城市与内政', body: '城市有农业、商业、防御、人口、民心、驻军六项。发展农业/商业提升产出，征兵补充军力，建造建筑解锁高级系统。税率越高钱粮越多，但民心下降；民心过低会引发叛乱。' },
  { title: '武将', body: '武将五维：统帅（带兵）、武力（斗将）、智力（计略）、政治（治城）、忠诚。武将通过战斗升级，可装备武器/铠甲/坐骑/宝物并习得技能。忠诚过低会下野或被策反。' },
  { title: '战斗', body: '兵种相克：骑克弓、弓克步、步克骑。可组建军队、选择阵型、释放武将技能。大会战为多回合厮杀，组建军团可集结多军协同。水战需建造楼船等水军。' },
  { title: '外交', body: '与他国可同盟、停战、联姻、贸易。同盟共同御敌，联姻加成经济，贸易互通有无。背盟大幅降低关系。善用远交近攻。' },
  { title: '科技与制度', body: '研究军事/经济/政治/阵法四条科技线，解锁进阶兵种、建筑与制度。太学建成后开科举取士；将作监建成后可征发徭役大兴土木。' },
  { title: '王朝与文化', body: '积累威望可登基称王、受禅建号。宗教（佛/道）影响民心与文化；文化繁荣可达成文化胜利。此外还有后宫、历法、天文异象等丰富系统。' },
  { title: '新手建议', body: '① 先稳住经济，再图扩张；② 注意兵种克制，勿以步兵硬撼骑兵；③ 善待武将，保持忠诚；④ 多结盟少树敌；⑤ 善用科技与建筑提升国力。' },
  { title: '常见问题', body: 'Q: 没钱征兵？A: 提升商业与税率、开辟商路。Q: 武将忠诚低？A: 封赏、联姻、减少败仗。Q: 如何统一？A: 控制16城或消灭所有敌对势力，亦可走文化胜利。' }
];
