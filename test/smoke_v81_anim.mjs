// ============================================================
// smoke_v81_anim.mjs — V8.1 战斗动画系统冒烟测试
// 验证：新公共API存在性 / timeScale慢动作 / 受击反馈参数 / 暴击触发 /
//       六类战场环境粒子 / 对象池复用 / 默认值 / 粒子上限氛围优先淘汰
// ============================================================
import { CharacterAnimator, Animator } from '../src/js/animation.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}
const near = (a, b) => Math.abs(a - b) < 1e-6;

console.log('=== V8.1 战斗动画系统冒烟测试 ===\n');

// ===== 1. 默认值 =====
console.log('--- 1. 新字段默认值 ---');
const a = new CharacterAnimator();
assert(a.timeScale === 1, 'timeScale 默认 = 1');
assert(a.battleEnv === 'plain', 'battleEnv 默认 = plain');
assert(a._maxParticles === 150, '粒子上限保持 150');
assert(Array.isArray(a.damageNumbers) && a.damageNumbers.length === 0, 'damageNumbers 初始为空');
assert(Array.isArray(a.knockbacks) && a.knockbacks.length === 0, 'knockbacks 初始为空');

// ===== 2. 新公共方法存在性 =====
console.log('\n--- 2. 新公共 API 存在性 ---');
const newMethods = ['setTimeScale', 'triggerCinematic', 'setBattleEnvironment',
  'playHitEffect', 'playSlash', 'playCharge', 'playShot', 'playSkill',
  'playVictoryPose', 'playDefeatPose', 'getShakeOffset',
  'drawDamageNumbers', 'drawCinematicFX', 'getKnockbackOffset'];
for (const m of newMethods) {
  assert(typeof a[m] === 'function', `方法存在: ${m}()`);
}
// 单例 Animator 也应具备这些方法
assert(typeof Animator.setTimeScale === 'function', '单例 Animator.setTimeScale 可用');

// ===== 3. timeScale 影响 update 步进 =====
console.log('\n--- 3. timeScale 时间缩放 ---');
const b = new CharacterAnimator();
b.time = 0;
b.setTimeScale(0.5);
b.update(0.1); // 真实 0.1 → 缩放后 0.05
assert(near(b.time, 0.05), `time 按 0.5 缩放前进 (实际 ${b.time})`);
b.setTimeScale(1);
b.update(0.1);
assert(near(b.time, 0.15), '恢复 1.0 后正常步进');

// ===== 4. 暴击慢动作触发与自动恢复 =====
console.log('\n--- 4. triggerCinematic 慢动作特写 ---');
const c = new CharacterAnimator();
c.triggerCinematic(0.1);
assert(c.timeScale === 0.3, 'triggerCinematic 后 timeScale=0.3');
assert(c._critText.time > 0, '「暴击!」弹字计时启动');
c.update(0.25); // 真实 0.25 > 0.1 特写时长
assert(c.timeScale === 1, '特写结束后自动恢复 timeScale=1');

// ===== 5. 受击反馈参数 =====
console.log('\n--- 5. playHitEffect 受击反馈 ---');
const d = new CharacterAnimator();
d.playHitEffect(100, 100, 250, false);
assert(d.damageNumbers.length === 1, '生成 1 个伤害飘字');
assert(d.damageNumbers[0].text === '250', '伤害数字文本 = 250');
assert(d.damageNumbers[0].isCrit === false, '普通命中 isCrit=false');
assert(d.damageNumbers[0].maxLife === 0.8, '飘字持续 0.8s');
assert(d.knockbacks.length === 1, '生成 1 条击退记录');
const kb = d.knockbacks[0];
assert(kb.distance >= 5 && kb.distance <= 8, `击退距离 5~8px (实际 ${kb.distance.toFixed(2)})`);
assert(kb.maxLife === 0.3, '击退持续 0.3s 回位');
assert(d.particles.some(p => p.type === 'hitflash'), '受击闪白粒子已生成');
assert(d._shake.time <= 0, '普通命中不触发屏幕抖动');

// 暴击
d.playHitEffect(200, 200, 999, true);
assert(d.damageNumbers[d.damageNumbers.length - 1].isCrit === true, '暴击飘字 isCrit=true');
assert(d._shake.time > 0, '暴击触发屏幕抖动');
assert(d._shake.magnitude === 3, '抖动幅度 ±3px');
assert(near(d._shake.duration, 0.15), '抖动持续 0.15s');
// 抖动偏移衰减
const off1 = d.getShakeOffset();
assert(Math.abs(off1.dx) <= 3 && Math.abs(off1.dy) <= 3, '抖动偏移在 ±3px 内');

// ===== 6. 武将战斗动作增强 =====
console.log('\n--- 6. 战斗动作粒子 ---');
const e = new CharacterAnimator();
e.particles.length = 0;
e.playSlash(50, 50, -Math.PI / 4);
assert(e.particles.some(p => p.type === 'slash_arc'), '挥砍金弧粒子(slash_arc)');
const arc = e.particles.find(p => p.type === 'slash_arc');
assert(arc.maxLife === 0.2, '斩击轨迹持续 0.2s');

e.particles.length = 0;
e.playCharge(0, 0, 1);
const lines = e.particles.filter(p => p.type === 'speedline');
assert(lines.length >= 3 && lines.length <= 5, `冲锋速度线 3~5 条 (实际 ${lines.length})`);
assert(e.lunges.length === 1, '冲锋前冲记录已生成');
assert(e.lunges[0].distance >= 8 && e.lunges[0].distance <= 12, `冲锋位移 8~12px (实际 ${e.lunges[0].distance.toFixed(2)})`);

e.particles.length = 0;
e.playShot(0, 0, 100, 50);
assert(e.particles.some(p => p.type === 'arrow_trail'), '射击弹道尾迹(arrow_trail)');
assert(e.particles.some(p => p.type === 'spark'), '射击命中点火花');

e.particles.length = 0;
e.playSkill(0, 0, 'fire');
assert(e.particles.some(p => p.type === 'element_fire'), '火系橙红爆裂');
e.playSkill(0, 0, 'water');
assert(e.particles.some(p => p.type === 'element_water'), '水系蓝色波纹');
e.playSkill(0, 0, 'wind');
assert(e.particles.some(p => p.type === 'element_wind'), '风系青色旋风');

// ===== 7. 战场环境粒子类型 =====
console.log('\n--- 7. setBattleEnvironment 六类氛围 ---');
const f = new CharacterAnimator();
const envMap = [
  ['plain', 'dust'], ['forest', 'leaf'], ['river', 'mist'],
  ['desert', 'sand'], ['snow', 'snow'], ['night', 'firefly']
];
for (const [env, ptype] of envMap) {
  f.setBattleEnvironment(env);
  f.particles.length = 0;
  f._spawnAmbient();
  const last = f.particles[f.particles.length - 1];
  assert(last && last.type === ptype, `环境 ${env} 生成粒子类型 ${ptype}`);
  assert(last._isAmbient === true, `环境 ${env} 粒子标记为 _isAmbient`);
}

// ===== 8. 对象池复用 =====
console.log('\n--- 8. 粒子对象池复用 ---');
const g = new CharacterAnimator();
const p1 = g._getParticle();
p1.x = 123;
g._releaseParticle(p1);
const p2 = g._getParticle();
assert(p1 === p2, '回收后再取为同一对象（对象池复用）');
assert(p2.x === 0 && p2._isAmbient === false, '复用对象字段已重置');

// ===== 9. 暂停时不更新氛围粒子 =====
console.log('\n--- 9. 暂停行为 ---');
const h = new CharacterAnimator();
h.setBattleEnvironment('snow');
h.setPaused(true);
const cntBefore = h.particles.length;
h.update(1.0);
assert(h.particles.length === cntBefore, '_paused=true 时不生成/更新粒子');
h.setPaused(false);

// ===== 10. 粒子上限边界：氛围粒子优先淘汰 =====
console.log('\n--- 10. 粒子上限：氛围优先淘汰 ---');
const i = new CharacterAnimator();
i._maxParticles = 2;
// 填充 2 个战斗(非氛围)粒子
const cA = i._getParticle(); cA._isAmbient = false; cA.type = 'combatA';
const cB = i._getParticle(); cB._isAmbient = false; cB.type = 'combatB';
i._pushParticle(cA); i._pushParticle(cB);
// 推入 1 个氛围粒子：满且无氛围→淘汰最老战斗粒子 A
i.battleEnv = 'snow';
i._spawnAmbient();
assert(i.particles.length === 2, '达到上限后仍为 2');
assert(!i.particles.some(p => p.type === 'combatA'), '无氛围时淘汰最老战斗粒子 A');
assert(i.particles.some(p => p.type === 'combatB'), '战斗粒子 B 保留');
// 此时含 1 个氛围粒子；再推入战斗粒子 D → 应优先淘汰氛围而非战斗 B
const cD = i._getParticle(); cD._isAmbient = false; cD.type = 'combatD';
i._pushParticle(cD);
assert(i.particles.some(p => p.type === 'combatD') && i.particles.some(p => p.type === 'combatB'),
  '超限时优先淘汰氛围粒子，战斗粒子 B/D 保留');
assert(!i.particles.some(p => p._isAmbient), '氛围粒子已被淘汰');

// ===== 11. 战斗结算姿势 =====
console.log('\n--- 11. 战斗结算动画 ---');
const j = new CharacterAnimator();
j.playVictoryPose('left');
assert(j._poseState.left && j._poseState.left.pose === 'victory', '胜利姿势已记录');
assert(j.particles.some(p => p.type === 'victory_gold'), '胜利金光粒子爆发');
j.playDefeatPose('right');
assert(j._poseState.right && j._poseState.right.pose === 'defeat', '失败倒地姿势已记录');
assert(j.particles.some(p => p.type === 'defeat_ash'), '失败灰化余烬粒子');

// ===== 12. 粒子生命周期结束回收 =====
console.log('\n--- 12. 粒子到期回收 ---');
const k = new CharacterAnimator();
k.playHitEffect(0, 0, 10, false);
const poolBefore = k._particlePool.length;
// 闪白仅 0.1s，更新 0.5s 后该粒子应回收
k.update(0.5);
assert(k._particlePool.length > poolBefore, '短寿命粒子到期后回收到对象池');
assert(!k.particles.some(p => p.type === 'hitflash'), '闪白粒子已消亡');
// 伤害飘字 0.8s 后也回收
k.update(1.0);
assert(k.damageNumbers.length === 0, '伤害飘字 0.8s 后清空');

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
