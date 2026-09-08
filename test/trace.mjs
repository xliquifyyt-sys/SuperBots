import { Match } from '../src/core/match.js';
const [,, a='phantom', b='volt', mapId='frozenkeel', seed='7', diff='hard'] = process.argv;
const m = new Match([{name:'A',botId:a,team:0,isAI:true},{name:'B',botId:b,team:1,isAI:true}], { mode:'ffa', map:mapId, aiDifficulty:diff }, Number(seed));
m.start();
let guard=0;
while (m.phase !== 'over' && guard++ < 200) {
  if (m.phase === 'announce') m.beginPlan();
  else if (m.phase === 'plan') {
    const acts = m.world.bots.map(bt => { const ac = m.pendingActions[bt.id]; return bt.alive ? `${bt.botId}(${bt.hp}) @${bt.x.toFixed(1)},${bt.y.toFixed(1)} -> ${ac?ac.type:'-'} ${ac&&ac.debug?ac.debug:''} ${ac&&ac.aim?`ang ${(Math.atan2(ac.aim.dy,ac.aim.dx)*180/Math.PI).toFixed(0)} pw ${ac.aim.power.toFixed(2)}`:''}` : `${bt.botId} dead`; });
    console.log(`T${m.turn} wind=${m.world.windX} ann=[${m.world.hazardAnnounce.map(x=>x.text).join('; ')}]\n   ` + acts.join('\n   '));
    m.beginResolve();
  }
  else if (m.phase === 'resolve') { m.world.runToEnd(); const ev = m.world.events.filter(e => ['damage','eliminated','pickup','explosion','suddenDeath'].includes(e.type)).map(e => e.type==='damage'?`dmg ${e.amount} to ${m.world.bots[e.bot].botId} (${e.label})`: e.type==='explosion'?`boom@${e.x.toFixed(1)},${e.y.toFixed(1)}`: e.type==='eliminated'?`ELIM ${m.world.bots[e.bot].botId} ${e.cause}`: e.type==='pickup'?`pickup ${e.name}`: e.type); console.log('   => ' + (ev.join(', ') || 'nothing') + ` [simtime ${m.world.time.toFixed(2)}]`); m.beginCleanup(); }
  else if (m.phase === 'cleanup') m.beginAnnounce();
}
console.log('WINNER', JSON.stringify(m.winner), 'turns', m.turn);
