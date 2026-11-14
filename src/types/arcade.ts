export type PrimaryCategory = 'memory' | 'math' | 'logic' | 'reflex';

export type FilterCategory =
  | 'all'
  | 'memory'
  | 'math'
  | 'logic'
  | 'reflex'
  | 'attention'
  | 'puzzle'
  | 'arcade';

export type GameMode = 'classic' | 'endless' | 'time_attack' | 'challenge';

export type DifficultyTier =
  | 'EASY'
  | 'NORMAL'
  | 'HARD'
  | 'EXPERT'
  | 'MASTER'
  | 'INSANE'
  | 'INFINITE';

export type ThemeSetting = 'navy' | 'midnight' | 'light';

export interface PlayerProfile {
  username: string;
  createdAt: string;
  lastPlayedAt: string | null;
  lastGameId: string | null;
}

export interface ArcadeSettings {
  soundEnabled: boolean;
  volume: number; // 0 to 1
  animationsEnabled: boolean;
  reducedMotion: boolean;
  theme: ThemeSetting;
}

export interface XPState {
  totalXp: number;
  level: number;
}

export interface GameStatEntry {
  gameId: string;
  plays: number;
  completions: number;
  totalScore: number;
  totalPlaytimeSec: number;
  bestAccuracy: number;
  highestLevel: number;
  lastPlayedAt: string;
  adaptiveSkill: number; // 0.0 to 6.0 (maps to DifficultyTier)
}

export interface GameHistoryEntry {
  id: string;
  gameId: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  score: number;
  accuracy: number;
  durationSec: number;
  levelReached: number;
  xpEarned: number;
  isNewRecord: boolean;
  playedAt: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  requirementLabel: string;
  iconKey: string;
  xpBonus: number;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  xpReward: number;
  claimed: boolean;
  type: 'plays' | 'categories' | 'accuracy' | 'gotd' | 'score_sum';
}

export interface DailyStatsState {
  dateKey: string; // YYYY-MM-DD local
  streak: number;
  lastActiveDate: string | null;
  gamesPlayedToday: number;
  categoriesPlayedToday: PrimaryCategory[];
  maxAccuracyToday: number;
  scoreToday: number;
  playedGotdToday: boolean;
  quests: DailyQuest[];
}

export interface ActiveSession {
  gameId: string;
  mode: GameMode;
  savedAt: string;
  payload: Record<string, unknown>;
}

export interface GameMetadata {
  id: string;
  title: string;
  shortDesc: string;
  howToPlay: string;
  primaryCategory: PrimaryCategory;
  tags: FilterCategory[];
  supportedModes: GameMode[];
  popularity: number;
  releaseOrder: number;
  supportsResume?: boolean;
  controlsHint: string;
  accentColor: string;
}

export interface GameSessionResult {
  score: number;
  accuracy: number; // 0-100
  durationSec: number;
  levelReached: number;
  completed: boolean;
  mistakes?: number;
  maxStreak?: number;
  reactionMs?: number;
  customMetricLabel?: string;
  customMetricValue?: string;
}

export interface GameComponentProps {
  mode: GameMode;
  difficulty: DifficultyTier;
  skillLevel: number;
  paused: boolean;
  savedSession?: Record<string, unknown> | null;
  onHudUpdate: (hud: GameHudState) => void;
  onSaveSession?: (payload: Record<string, unknown> | null) => void;
  onGameOver: (result: GameSessionResult) => void;
  onTriggerFeedback?: (kind: 'score' | 'error' | 'combo', text?: string) => void;
}

export interface GameHudState {
  score: number;
  level: number;
  timeLeftSec?: number | null;
  elapsedSec?: number;
  lives?: number | null;
  maxLives?: number;
  progressLabel?: string;
  streak?: number;
  hintText?: string | null;
  onUseHint?: (() => void) | null;
}

export interface ExportedDatabase {
  version: number;
  exportedAt: string;
  ia_profile: PlayerProfile;
  ia_settings: ArcadeSettings;
  ia_game_stats: Record<string, GameStatEntry>;
  ia_best_scores: Record<string, number>;
  ia_game_history: GameHistoryEntry[];
  ia_achievements: Record<string, UnlockedAchievement>;
  ia_xp: XPState;
  ia_daily_stats: DailyStatsState;
  ia_active_sessions: Record<string, ActiveSession>;
}
