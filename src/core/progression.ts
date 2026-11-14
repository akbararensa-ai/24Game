import {
  AchievementDefinition,
  DailyStatsState,
  DifficultyTier,
  GameHistoryEntry,
  GameMode,
  GameSessionResult,
  GameStatEntry,
  PrimaryCategory,
  UnlockedAchievement,
  XPState,
} from '../types/arcade';
import { DatabaseManager, getLocalDateKey } from './database';
import { GAME_REGISTRY, getGameById } from './registry';

export const DIFFICULTY_TIERS: DifficultyTier[] = [
  'EASY',
  'NORMAL',
  'HARD',
  'EXPERT',
  'MASTER',
  'INSANE',
  'INFINITE',
];

export function skillToTier(skill: number): DifficultyTier {
  const idx = Math.max(0, Math.min(DIFFICULTY_TIERS.length - 1, Math.floor(skill)));
  return DIFFICULTY_TIERS[idx];
}

export function tierToBaseSkill(tier: DifficultyTier): number {
  return Math.max(0, DIFFICULTY_TIERS.indexOf(tier));
}

export const MODE_LABELS: Record<GameMode, string> = {
  classic: 'Classic',
  endless: 'Endless',
  time_attack: 'Time Attack',
  challenge: 'Challenge',
};

export function xpRequiredForLevel(level: number): number {
  return Math.round(120 * Math.pow(level, 1.35));
}

export function getLevelProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
} {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level++;
  }
  const nextReq = xpRequiredForLevel(level);
  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: nextReq,
    percent: Math.min(100, Math.round((remaining / nextReq) * 100)),
  };
}

export function calculateEarnedXp(
  result: GameSessionResult,
  difficulty: DifficultyTier,
  mode: GameMode
): number {
  if (result.score <= 0 && result.durationSec < 2) return 0;
  const diffMult = 1 + tierToBaseSkill(difficulty) * 0.22;
  const modeMult =
    mode === 'challenge' ? 1.35 : mode === 'endless' ? 1.2 : mode === 'time_attack' ? 1.15 : 1.0;
  const scorePart = Math.min(240, Math.floor(result.score / 18));
  const accuracyBonus = result.accuracy >= 90 ? 35 : result.accuracy >= 75 ? 18 : 5;
  const levelBonus = Math.min(120, result.levelReached * 8);
  const completionBonus = result.completed ? 25 : 0;
  return Math.max(10, Math.round((scorePart + accuracyBonus + levelBonus + completionBonus) * diffMult * modeMult));
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_game',
    name: 'First Spark',
    description: 'Selesaikan mini-game pertamamu di INFINITE ARCADE.',
    requirementLabel: '1 Sesi Selesai',
    iconKey: 'Sparkles',
    xpBonus: 50,
  },
  {
    id: 'memory_master',
    name: 'Memory Master',
    description: 'Capai Level 7 atau lebih di salah satu game Memory Lab.',
    requirementLabel: 'Memory Lv. 7+',
    iconKey: 'Brain',
    xpBonus: 120,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Catat waktu reaksi rata-rata di bawah 240 ms pada Reaction Time.',
    requirementLabel: 'Reaksi < 240 ms',
    iconKey: 'Zap',
    xpBonus: 130,
  },
  {
    id: 'math_genius',
    name: 'Math Genius',
    description: 'Kumpulkan total 10 sesi di Calculate Arena.',
    requirementLabel: '10 Game Math',
    iconKey: 'Calculator',
    xpBonus: 120,
  },
  {
    id: 'perfect_run',
    name: 'Perfect Run',
    description: 'Selesaikan sesi game dengan akurasi 100% (skor minimal 300).',
    requirementLabel: 'Akurasi 100%',
    iconKey: 'Award',
    xpBonus: 150,
  },
  {
    id: 'explorer',
    name: 'Quad Explorer',
    description: 'Mainkan minimal 1 game dari keempat kategori utama (Memory, Math, Logic, Reflex).',
    requirementLabel: '4 Kategori Utama',
    iconKey: 'Compass',
    xpBonus: 140,
  },
  {
    id: 'no_limit',
    name: 'No Limit',
    description: 'Capai Level 10 atau lebih dalam mode Endless.',
    requirementLabel: 'Endless Lv. 10+',
    iconKey: 'Infinity',
    xpBonus: 180,
  },
  {
    id: 'solver_24',
    name: '24 Architect',
    description: 'Selesaikan minimal 3 ronde dalam 24 Game.',
    requirementLabel: '24 Game Lv. 3+',
    iconKey: 'Sigma',
    xpBonus: 110,
  },
  {
    id: 'titan_2048',
    name: 'Tile Tactician',
    description: 'Raih skor 2.500+ dalam permainan 2048.',
    requirementLabel: '2048 Skor 2.500+',
    iconKey: 'Grid3x3',
    xpBonus: 140,
  },
  {
    id: 'sudoku_adept',
    name: 'Sudoku Savant',
    description: 'Menangkan satu papan penuh Sudoku 9×9.',
    requirementLabel: 'Selesaikan Sudoku',
    iconKey: 'CheckSquare',
    xpBonus: 160,
  },
  {
    id: 'streak_3',
    name: 'Daily Momentum',
    description: 'Pertahankan streak bermain harian selama 3 hari.',
    requirementLabel: '3 Hari Streak',
    iconKey: 'Flame',
    xpBonus: 150,
  },
  {
    id: 'all_rounder',
    name: 'Arcade Collector',
    description: 'Coba minimal 12 mini-game berbeda dari koleksi 24 game.',
    requirementLabel: '12 Game Berbeda',
    iconKey: 'Layers',
    xpBonus: 200,
  },
  {
    id: 'veteran_25',
    name: 'Quarter Century',
    description: 'Selesaikan total 25 sesi permainan.',
    requirementLabel: '25 Total Game',
    iconKey: 'Trophy',
    xpBonus: 175,
  },
  {
    id: 'level_10',
    name: 'Infinite Ascent',
    description: 'Capai Level Pemain 10 melalui akumulasi XP.',
    requirementLabel: 'Player Lv. 10',
    iconKey: 'Crown',
    xpBonus: 250,
  },
];

export function getGameOfTheDay(dateKey = getLocalDateKey()) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return GAME_REGISTRY[hash % GAME_REGISTRY.length];
}

export function getDynamicRecommendation(stats: Record<string, GameStatEntry>) {
  // Recommend a game from the least played category, or an unplayed popular game
  const unplayed = GAME_REGISTRY.filter((g) => !stats[g.id] || stats[g.id].plays === 0);
  if (unplayed.length > 0) {
    return unplayed.sort((a, b) => b.popularity - a.popularity)[0];
  }
  const byLeastPlayed = [...GAME_REGISTRY].sort(
    (a, b) => (stats[a.id]?.plays ?? 0) - (stats[b.id]?.plays ?? 0)
  );
  return byLeastPlayed[0];
}

export function getCategoryBrainScores(
  stats: Record<string, GameStatEntry>,
  bestScores: Record<string, number>
): Record<PrimaryCategory, number> {
  const cats: PrimaryCategory[] = ['memory', 'math', 'logic', 'reflex'];
  const out: Record<PrimaryCategory, number> = { memory: 0, math: 0, logic: 0, reflex: 0 };

  for (const cat of cats) {
    const games = GAME_REGISTRY.filter((g) => g.primaryCategory === cat);
    let sum = 0;
    let count = 0;
    for (const g of games) {
      const st = stats[g.id];
      const best = bestScores[g.id] ?? 0;
      if (st && st.plays > 0) {
        const normScore = Math.min(100, Math.round(Math.log10(Math.max(10, best)) * 22 + st.adaptiveSkill * 6));
        sum += normScore;
        count++;
      }
    }
    out[cat] = count === 0 ? 0 : Math.min(100, Math.round(sum / Math.max(1, count * 0.85)));
  }
  return out;
}

export interface SessionCommitSummary {
  xpEarned: number;
  isNewRecord: boolean;
  leveledUp: boolean;
  newLevel: number;
  newlyUnlockedAchievements: AchievementDefinition[];
  updatedDaily: DailyStatsState;
  nextAdaptiveTier: DifficultyTier;
}

export function commitGameSession(
  gameId: string,
  mode: GameMode,
  difficultyUsed: DifficultyTier,
  result: GameSessionResult
): SessionCommitSummary {
  const game = getGameById(gameId);
  const nowIso = new Date().toISOString();
  const todayKey = getLocalDateKey();

  // 1. Profile
  const profile = DatabaseManager.getProfile();
  profile.lastPlayedAt = nowIso;
  profile.lastGameId = gameId;
  DatabaseManager.saveProfile(profile);

  // 2. Best Score
  const bestScores = DatabaseManager.getBestScores();
  const prevBest = bestScores[gameId] ?? 0;
  const isNewRecord = result.score > prevBest && result.score > 0;
  if (isNewRecord) {
    bestScores[gameId] = result.score;
    DatabaseManager.saveBestScores(bestScores);
  }

  // 3. Game Stats + Adaptive Difficulty
  const allStats = DatabaseManager.getGameStats();
  const cur: GameStatEntry = allStats[gameId] ?? {
    gameId,
    plays: 0,
    completions: 0,
    totalScore: 0,
    totalPlaytimeSec: 0,
    bestAccuracy: 0,
    highestLevel: 0,
    lastPlayedAt: nowIso,
    adaptiveSkill: 1.0, // starts at NORMAL
  };

  cur.plays += 1;
  if (result.completed) cur.completions += 1;
  cur.totalScore += result.score;
  cur.totalPlaytimeSec += Math.max(1, Math.round(result.durationSec));
  cur.bestAccuracy = Math.max(cur.bestAccuracy, Math.round(result.accuracy));
  cur.highestLevel = Math.max(cur.highestLevel, result.levelReached);
  cur.lastPlayedAt = nowIso;

  // Adaptive scaling formula
  if (result.accuracy >= 88 && result.levelReached >= 3) {
    cur.adaptiveSkill = Math.min(6.0, +(cur.adaptiveSkill + 0.45).toFixed(2));
  } else if (result.accuracy >= 70 && result.score > 150) {
    cur.adaptiveSkill = Math.min(6.0, +(cur.adaptiveSkill + 0.2).toFixed(2));
  } else if (result.accuracy < 45 && cur.adaptiveSkill > 0.3) {
    cur.adaptiveSkill = Math.max(0.0, +(cur.adaptiveSkill - 0.3).toFixed(2));
  }

  allStats[gameId] = cur;
  DatabaseManager.saveGameStats(allStats);

  // 4. XP Calculation
  const xpEarned = calculateEarnedXp(result, difficultyUsed, mode);
  const xpState: XPState = DatabaseManager.getXP();
  const prevLevel = getLevelProgress(xpState.totalXp).level;

  // 5. Daily Stats & Streak
  const daily = DatabaseManager.ensureDailyRollover();
  if (daily.lastActiveDate !== todayKey) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = getLocalDateKey(yesterday);
    daily.streak = daily.lastActiveDate === yKey ? daily.streak + 1 : 1;
    daily.lastActiveDate = todayKey;
  }
  daily.gamesPlayedToday += 1;
  if (game && !daily.categoriesPlayedToday.includes(game.primaryCategory)) {
    daily.categoriesPlayedToday.push(game.primaryCategory);
  }
  daily.maxAccuracyToday = Math.max(daily.maxAccuracyToday, Math.round(result.accuracy));
  daily.scoreToday += result.score;
  const gotd = getGameOfTheDay(todayKey);
  if (gotd.id === gameId) {
    daily.playedGotdToday = true;
  }

  daily.quests = daily.quests.map((q) => {
    let nextProg = q.progress;
    if (q.type === 'plays') nextProg = daily.gamesPlayedToday;
    if (q.type === 'categories') nextProg = daily.categoriesPlayedToday.length;
    if (q.type === 'gotd') nextProg = daily.playedGotdToday ? 1 : 0;
    if (q.type === 'score_sum') nextProg = daily.scoreToday;
    return { ...q, progress: Math.min(q.target, nextProg) };
  });
  DatabaseManager.saveDailyStats(daily);

  // 6. Achievements Check
  const unlockedMap: Record<string, UnlockedAchievement> = DatabaseManager.getAchievements();
  const newlyUnlocked: AchievementDefinition[] = [];

  const totalPlays = Object.values(allStats).reduce((s, e) => s + e.plays, 0);
  const distinctGamesPlayed = Object.values(allStats).filter((e) => e.plays > 0).length;
  const playedPrimaryCats = new Set(
    Object.values(allStats)
      .filter((e) => e.plays > 0)
      .map((e) => getGameById(e.gameId)?.primaryCategory)
      .filter(Boolean)
  );
  const mathPlays = GAME_REGISTRY.filter((g) => g.primaryCategory === 'math').reduce(
    (s, g) => s + (allStats[g.id]?.plays ?? 0),
    0
  );

  const checkAndUnlock = (id: string, condition: boolean) => {
    if (!condition || unlockedMap[id]) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    unlockedMap[id] = { id, unlockedAt: nowIso };
    newlyUnlocked.push(def);
  };

  checkAndUnlock('first_game', totalPlays >= 1);
  checkAndUnlock('memory_master', game?.primaryCategory === 'memory' && result.levelReached >= 7);
  checkAndUnlock(
    'speed_demon',
    gameId === 'reaction-time' && typeof result.reactionMs === 'number' && result.reactionMs > 0 && result.reactionMs < 240
  );
  checkAndUnlock('math_genius', mathPlays >= 10);
  checkAndUnlock('perfect_run', result.accuracy >= 100 && result.score >= 300);
  checkAndUnlock('explorer', playedPrimaryCats.size >= 4);
  checkAndUnlock('no_limit', mode === 'endless' && result.levelReached >= 10);
  checkAndUnlock('solver_24', gameId === 'game-24' && result.levelReached >= 3);
  checkAndUnlock('titan_2048', gameId === 'game-2048' && result.score >= 2500);
  checkAndUnlock('sudoku_adept', gameId === 'sudoku' && result.completed);
  checkAndUnlock('streak_3', daily.streak >= 3);
  checkAndUnlock('all_rounder', distinctGamesPlayed >= 12);
  checkAndUnlock('veteran_25', totalPlays >= 25);

  const achievementXpBonus = newlyUnlocked.reduce((s, a) => s + a.xpBonus, 0);
  const updatedTotalXp = xpState.totalXp + xpEarned + achievementXpBonus;
  const afterLevel = getLevelProgress(updatedTotalXp).level;

  if (afterLevel >= 10 && !unlockedMap['level_10']) {
    const lvlDef = ACHIEVEMENTS.find((a) => a.id === 'level_10');
    if (lvlDef) {
      unlockedMap['level_10'] = { id: 'level_10', unlockedAt: nowIso };
      newlyUnlocked.push(lvlDef);
    }
  }

  const finalTotalXp = updatedTotalXp + (newlyUnlocked.find((a) => a.id === 'level_10') ? 250 : 0);
  const finalLevelInfo = getLevelProgress(finalTotalXp);

  DatabaseManager.saveXP({ totalXp: finalTotalXp, level: finalLevelInfo.level });
  DatabaseManager.saveAchievements(unlockedMap);

  // 7. History Entry
  const history = DatabaseManager.getHistory();
  const entry: GameHistoryEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    gameId,
    mode,
    difficulty: difficultyUsed,
    score: result.score,
    accuracy: Math.round(result.accuracy),
    durationSec: Math.round(result.durationSec),
    levelReached: result.levelReached,
    xpEarned,
    isNewRecord,
    playedAt: nowIso,
  };
  DatabaseManager.saveHistory([entry, ...history]);

  return {
    xpEarned,
    isNewRecord,
    leveledUp: finalLevelInfo.level > prevLevel,
    newLevel: finalLevelInfo.level,
    newlyUnlockedAchievements: newlyUnlocked,
    updatedDaily: daily,
    nextAdaptiveTier: skillToTier(cur.adaptiveSkill),
  };
}
