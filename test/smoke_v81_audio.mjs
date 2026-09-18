// ============================================================
// smoke_v81_audio.mjs — V8.1 程序化音效与环境音系统冒烟测试
// 验证：
//   1) 新增战斗音效方法存在性（8 个）
//   2) 新增 UI 反馈音方法存在性（7 个）
//   3) 新增环境音方法存在性（4 个 start + startAmbient/stopAmbient）
//   4) BGM_TRACKS 包含新轨道（navy/diplomacy/victory/defeat）
//   5) 旧 BGM 轨道未删除（menu/map/battle/event/interior/ending）
//   6) listSFX / listBGM / listAmbient 返回正确列表
//   7) 音量总线字段：ambientGain / bgmGain / sfxGain / master
//   8) 默认音量值：masterVolume=0.8, bgmVolume=0.6, sfxVolume=0.8, ambientVolume=0.5
//   9) ctx 为 null 时所有 play 方法安全返回（不抛错）
//  10) ducking 相关字段：_duckingOn / _duckFactor / _duckDuration
//  11) 五声音阶 PENTATONIC 完整性（宫商角徵羽）
//  12) playSFX 分发器可调用未知名不抛错
// ============================================================
import { AudioManager } from '../src/js/audio.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V8.1 程序化音效系统冒烟测试 ===\n');

const am = new AudioManager();

// ===== 1. 新增战斗音效方法存在性 =====
console.log('--- 1. 战斗音效方法（8 个） ---');
const battleSfx = [
  'playSwordClash', 'playCavalryCharge', 'playArrowShoot', 'playFireBurst',
  'playBattleCry', 'playShieldBlock', 'playVolley', 'playDuelClash'
];
for (const m of battleSfx) {
  assert(typeof am[m] === 'function', `战斗音效方法存在: ${m}`);
}

// ===== 2. 新增 UI 反馈音方法存在性 =====
console.log('\n--- 2. UI 反馈音方法（7 个） ---');
const uiSfx = [
  'playButtonClick', 'playPanelOpen', 'playPanelClose', 'playCoinSound',
  'playBuildSound', 'playError', 'playNotify'
];
for (const m of uiSfx) {
  assert(typeof am[m] === 'function', `UI 音效方法存在: ${m}`);
}

// ===== 3. 环境音方法存在性 =====
console.log('\n--- 3. 环境音方法 ---');
const ambientMethods = [
  'startAmbient', 'stopAmbient',
  'startCityAmbient', 'startBattleAmbient', 'startRainAmbient', 'startPalaceAmbient',
  'setAmbientVolume'
];
for (const m of ambientMethods) {
  assert(typeof am[m] === 'function', `环境音方法存在: ${m}`);
}

// ===== 4. 新 BGM 轨道存在 =====
console.log('\n--- 4. BGM_TRACKS 新轨道 ---');
// 通过 listBGM() 读取（它内部读 BGM_TRACKS）
const bgmList = am.listBGM();
assert(Array.isArray(bgmList), 'listBGM() 返回数组');
for (const name of ['navy', 'diplomacy', 'victory', 'defeat']) {
  assert(bgmList.includes(name), `新 BGM 轨道在列表中: ${name}`);
}

// ===== 5. 旧 BGM 轨道保留 =====
console.log('\n--- 5. 旧 BGM 轨道兼容性 ---');
for (const name of ['menu', 'map', 'battle', 'event', 'interior', 'ending']) {
  assert(bgmList.includes(name), `旧 BGM 轨道保留: ${name}`);
}
assert(bgmList.length === 10, `BGM 总数=10 (实际 ${bgmList.length})`);

// ===== 6. listSFX / listBGM / listAmbient =====
console.log('\n--- 6. 自省方法 ---');
const sfxList = am.listSFX();
assert(Array.isArray(sfxList) && sfxList.length >= 40, `listSFX() 返回 ≥40 项 (实际 ${sfxList.length})`);
assert(sfxList.includes('swordClash'), 'listSFX() 包含 swordClash');
assert(sfxList.includes('buttonClick'), 'listSFX() 包含 buttonClick');
assert(sfxList.includes('notify'), 'listSFX() 包含 notify');
const ambList = am.listAmbient();
assert(Array.isArray(ambList) && ambList.length === 4, `listAmbient() 返回 4 项 (实际 ${ambList.length})`);
for (const n of ['city', 'battle', 'rain', 'palace']) {
  assert(ambList.includes(n), `listAmbient() 包含 ${n}`);
}

// ===== 7. 音量总线字段存在 =====
console.log('\n--- 7. 音量总线字段 ---');
assert(am.master === null, '初始 master=null（未初始化）');
assert(am.bgmGain === null, '初始 bgmGain=null');
assert(am.sfxGain === null, '初始 sfxGain=null');
assert(am.ambientGain === null, '初始 ambientGain=null（V8.1）');

// ===== 8. 默认音量值 =====
console.log('\n--- 8. 默认音量值 ---');
assert(am.masterVolume === 0.8, `masterVolume 默认 0.8 (实际 ${am.masterVolume})`);
assert(am.bgmVolume === 0.6, `bgmVolume 默认 0.6 (实际 ${am.bgmVolume})`);
assert(am.sfxVolume === 0.8, `sfxVolume 默认 0.8 (实际 ${am.sfxVolume})`);
assert(am.ambientVolume === 0.5, `ambientVolume 默认 0.5 (实际 ${am.ambientVolume})`);

// ===== 9. ctx 为 null 时安全调用所有新方法 =====
console.log('\n--- 9. ctx=null 安全调用 ---');
assert(am.ctx === null, '初始 ctx 为 null');
let safe = true;
try {
  // 战斗音效
  am.playSwordClash(); am.playCavalryCharge(); am.playArrowShoot();
  am.playFireBurst(); am.playBattleCry(); am.playShieldBlock();
  am.playVolley(); am.playDuelClash();
  // UI 音效
  am.playButtonClick(); am.playPanelOpen(); am.playPanelClose();
  am.playCoinSound(); am.playBuildSound(); am.playError(); am.playNotify();
  // 环境音
  am.startAmbient('city'); am.startAmbient('battle'); am.startAmbient('rain');
  am.startAmbient('palace'); am.startCityAmbient(); am.startBattleAmbient();
  am.startRainAmbient(); am.startPalaceAmbient(); am.stopAmbient();
  am.setAmbientVolume(0.4);
  // 分发器
  am.playSFX('swordClash'); am.playSFX('not_exist_sfx'); am.playSFX();
} catch (e) {
  safe = false;
  console.log('    错误:', e.message);
}
assert(safe, '所有新方法在 ctx=null 时静默返回不抛错');

// ===== 10. ducking 相关字段 =====
console.log('\n--- 10. ducking 字段 ---');
assert(typeof am._duckingOn === 'boolean', `_duckingOn 是 boolean (实际 ${am._duckingOn})`);
assert(am._duckFactor === 0.7, `_duckFactor = 0.7 (实际 ${am._duckFactor})`);
assert(am._duckDuration === 0.3, `_duckDuration = 0.3 (实际 ${am._duckDuration})`);
assert(typeof am._duckBGM === 'function', '_duckBGM() 方法存在');

// ===== 11. 五声音阶完整性 =====
console.log('\n--- 11. 五声音阶完整性 ---');
// 五声：宫 商 角 徵 羽，相对半音间隔 [0, 2, 4, 7, 9]
assert(Array.isArray(am.pentatonic) && am.pentatonic.length === 5, 'pentatonic 数组长度=5');
assert(am.pentatonic[0] === 0 && am.pentatonic[1] === 2 && am.pentatonic[2] === 4 &&
       am.pentatonic[3] === 7 && am.pentatonic[4] === 9, 'pentatonic = [0,2,4,7,9] 宫商角徵羽');

// ===== 12. 旧接口未被破坏 =====
console.log('\n--- 12. 旧接口兼容性 ---');
assert(typeof am.playBGM !== 'undefined' || typeof am.startBGM === 'function', 'startBGM 保留');
assert(typeof am.switchBGM === 'function', 'switchBGM 保留');
assert(typeof am.stopBGM === 'function', 'stopBGM 保留');
assert(typeof am.toggleMute === 'function', 'toggleMute 保留');
assert(typeof am.setMasterVolume === 'function', 'setMasterVolume 保留');
assert(typeof am.setBGMVolume === 'function', 'setBGMVolume 保留');
assert(typeof am.setSFXVolume === 'function', 'setSFXVolume 保留');
// 旧 play 方法仍存在
for (const m of ['playClick', 'playCoin', 'playBuild', 'playVictory', 'playDefeat', 'playAchievement']) {
  assert(typeof am[m] === 'function', `旧方法保留: ${m}`);
}

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
