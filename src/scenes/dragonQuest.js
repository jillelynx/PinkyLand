// Jacinta's Dragon Quest: find every kind of dragon. Shared by Pinky Land and
// Snowdrop Island (Frost the snow dragon lives on Snowdrop Island).
export const DRAGON_KINDS = [
  { key: 'dragon-ember', name: 'Sir Ember', kind: 'Castle-story dragon' },
  { key: 'dragon-long', name: 'Lóng Mei', kind: 'Chinese dragon' },
  { key: 'dragon-quetzi', name: 'Quetzi', kind: 'Feathered serpent' },
  { key: 'dragon-fjola', name: 'Fjola', kind: 'Sea serpent' },
  { key: 'dragon-frost', name: 'Frost', kind: 'Snow dragon' },
];

const PINKY = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
const J = { who: 'Jacinta', color: '#ff6fa8', pitch: 1.2 };

/** keys of every dragon met, on either island */
export function dragonsMet(state) {
  const met = new Set([...(state.pinky?.met || []), ...(state.snow?.met || [])]);
  return DRAGON_KINDS.filter((k) => met.has(k.key));
}

/** call right after a dragon is met for the first time */
export function dragonFound(level, key) {
  const g = level.game, st = g.state, n = dragonsMet(st).length, kind = DRAGON_KINDS.find((k) => k.key === key);
  if (!kind) return;
  if (!st.journal.includes('dragonquest')) st.journal.push('dragonquest');
  g.ui.toast('🐉', `Dragon Quest: <b>${kind.kind}</b> found! (${n} / ${DRAGON_KINDS.length})`);
  if (n === DRAGON_KINDS.length && !st.dragonMaster) {
    st.dragonMaster = true; g.saveGame();
    setTimeout(() => g.ui.dialogue([
      { ...J, text: 'Pinky! I found them ALL! Every kind of dragon!' },
      { ...PINKY, text: 'You’re a real Dragon Explorer! The dragons each gave you a scale… look, a shiny Dragon Explorer Badge! ✨' },
    ]), 2500);
    level.journalCheck('dragonbadge', 'Dragon Explorer Badge');
  } else if (n === 1) {
    setTimeout(() => g.ui.say(`Jacinta wants to find every kind of dragon! ${DRAGON_KINDS.length - n} more to go. 🐉`, 5), 2500);
  } else if (n === DRAGON_KINDS.length - 1) {
    const left = DRAGON_KINDS.find((k) => !dragonsMet(st).includes(k));
    setTimeout(() => g.ui.say(`Just one dragon left to find: ${left.name}${left.key === 'dragon-frost' ? ', somewhere cold and snowy… ❄️' : '!'}`, 5), 2500);
  }
}
