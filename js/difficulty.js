// NPC difficulty presets — HARD is the game's native tuning. EASY/MEDIUM only
// weaken the OPPONENTS: your AI teammate and your own goalie always play full-skill.
const PRESETS = {
  easy: {
    key: 'easy',
    oppSpeed:    0.82,   // opponent skater top-speed multiplier
    oppTurbo:    false,  // opponents never turbo — you can outskate the chase
    checkChance: 0.002,  // per-frame check roll near the carrier
    checkRange:  3.5,
    actCd:       0.7,    // seconds between opponent shoot/pass decisions
    passChance:  0.22,
    shootZone:   40,     // opponents only shoot from inside this range
    saveScale:   0.70,   // opponent goalie save-probability multiplier
    reactDelay:  0.16,
    goalieSpeed: 13,
  },
  medium: {
    key: 'medium',
    oppSpeed:    0.92,
    oppTurbo:    true,
    checkChance: 0.005,  // defense steps up — harder to walk through
    checkRange:  4.0,
    actCd:       0.5,    // offense only a tad better than easy
    passChance:  0.30,
    shootZone:   48,
    saveScale:   0.85,   // goalie play noticeably better
    reactDelay:  0.10,
    goalieSpeed: 16,
  },
  hard: {
    key: 'hard',         // the game as tuned — full-skill NPCs
    oppSpeed:    1.0,
    oppTurbo:    true,
    checkChance: 0.008,
    checkRange:  4.5,
    actCd:       0.35,
    passChance:  0.38,
    shootZone:   55,
    saveScale:   1.0,
    reactDelay:  0.07,
    goalieSpeed: 18,
  },
};

let current = PRESETS.hard;
try { current = PRESETS[localStorage.getItem('hitz_diff')] || PRESETS.hard; } catch {}

export function getDifficulty() { return current; }
export function setDifficulty(key) {
  current = PRESETS[key] || current;
  try { localStorage.setItem('hitz_diff', current.key); } catch {}
}
