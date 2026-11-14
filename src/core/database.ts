import {
  ActiveSession,
  ArcadeSettings,
  DailyQuest,
  DailyStatsState,
  ExportedDatabase,
  GameHistoryEntry,
  GameStatEntry,
  PlayerProfile,
  UnlockedAchievement,
  XPState,
} from '../types/arcade';

const DB_VERSION = 1;

export const STORAGE_KEYS = {
  version: 'ia_db_version',
  profile: 'ia_profile',
  settings: 'ia_settings',
  gameStats: 'ia_game_stats',
  bestScores: 'ia_best_scores',
  gameHistory: 'ia_game_history',
  achievements: 'ia_achievements',
  xp: 'ia_xp',
  dailyStats: 'ia_daily_stats',
  activeSessions: 'ia_active_sessions',
} as const;

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashDateString(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildDailyQuests(dateKey: string): DailyQuest[] {
  const seed = hashDateString(dateKey);
  const playTarget = 3 + (seed % 3); // 3-5 games
  const scoreTarget = 1200 + (seed % 4) * 500;
  return [
    {
      id: `dq_plays_${dateKey}`,
      title: `Selesaikan ${playTarget} Sesi`,
      description: `Mainkan dan selesaikan ${playTarget} mini-game apa saja hari ini.`,
      target: playTarget,
      progress: 0,
      xpReward: 120,
      claimed: false,
      type: 'plays',
    },
    {
      id: `dq_cats_${dateKey}`,
      title: 'Jelajah 2 Kategori',
      description: 'Mainkan mini-game dari minimal 2 kategori berbeda hari ini.',
      target: 2,
      progress: 0,
      xpReward: 100,
      claimed: false,
      type: 'categories',
    },
    {
      id: `dq_gotd_${dateKey}`,
      title: 'Game of the Day',
      description: 'Mainkan 1 sesi penuh Game of the Day hari ini.',
      target: 1,
      progress: 0,
      xpReward: 140,
      claimed: false,
      type: 'gotd',
    },
    {
      id: `dq_score_${dateKey}`,
      title: `Kumpulkan ${scoreTarget.toLocaleString('id-ID')} Skor`,
      description: 'Akumulasikan total skor harian di berbagai arena.',
      target: scoreTarget,
      progress: 0,
      xpReward: 150,
      claimed: false,
      type: 'score_sum',
    },
  ];
}

export function createDefaultProfile(): PlayerProfile {
  return {
    username: 'Player One',
    createdAt: new Date().toISOString(),
    lastPlayedAt: null,
    lastGameId: null,
  };
}

export function createDefaultSettings(): ArcadeSettings {
  return {
    soundEnabled: true,
    volume: 0.65,
    animationsEnabled: true,
    reducedMotion: false,
    theme: 'navy',
  };
}

export function createDefaultDailyStats(dateKey = getLocalDateKey()): DailyStatsState {
  return {
    dateKey,
    streak: 0,
    lastActiveDate: null,
    gamesPlayedToday: 0,
    categoriesPlayedToday: [],
    maxAccuracyToday: 0,
    scoreToday: 0,
    playedGotdToday: false,
    quests: buildDailyQuests(dateKey),
  };
}

class LocalDatabaseManager {
  private storageErrorListener: ((msg: string) => void) | null = null;
  private pendingTimers = new Map<string, number>();

  public onStorageError(cb: (msg: string) => void) {
    this.storageErrorListener = cb;
  }

  private safeGet<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private safeSet(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'QuotaExceededError'
          ? 'Penyimpanan lokal penuh! Ekspor data Anda atau hapus riwayat lama.'
          : 'LocalStorage tidak tersedia di browser ini.';
      this.storageErrorListener?.(msg);
    }
  }

  public setDebounced(key: string, value: unknown, delayMs = 250) {
    const existing = this.pendingTimers.get(key);
    if (existing) window.clearTimeout(existing);
    const id = window.setTimeout(() => {
      this.safeSet(key, value);
      this.pendingTimers.delete(key);
    }, delayMs);
    this.pendingTimers.set(key, id);
  }

  public initAndMigrate() {
    const ver = this.safeGet<number>(STORAGE_KEYS.version, 0);
    if (ver < DB_VERSION) {
      this.safeSet(STORAGE_KEYS.version, DB_VERSION);
    }
    this.ensureDailyRollover();
  }

  public getProfile(): PlayerProfile {
    return this.safeGet(STORAGE_KEYS.profile, createDefaultProfile());
  }

  public saveProfile(profile: PlayerProfile) {
    this.safeSet(STORAGE_KEYS.profile, profile);
  }

  public getSettings(): ArcadeSettings {
    return this.safeGet(STORAGE_KEYS.settings, createDefaultSettings());
  }

  public saveSettings(settings: ArcadeSettings) {
    this.safeSet(STORAGE_KEYS.settings, settings);
  }

  public getGameStats(): Record<string, GameStatEntry> {
    return this.safeGet(STORAGE_KEYS.gameStats, {});
  }

  public saveGameStats(stats: Record<string, GameStatEntry>) {
    this.safeSet(STORAGE_KEYS.gameStats, stats);
  }

  public getBestScores(): Record<string, number> {
    return this.safeGet(STORAGE_KEYS.bestScores, {});
  }

  public saveBestScores(scores: Record<string, number>) {
    this.safeSet(STORAGE_KEYS.bestScores, scores);
  }

  public getHistory(): GameHistoryEntry[] {
    return this.safeGet(STORAGE_KEYS.gameHistory, []);
  }

  public saveHistory(history: GameHistoryEntry[]) {
    // Keep up to 200 latest entries to avoid quota bloat
    this.safeSet(STORAGE_KEYS.gameHistory, history.slice(0, 200));
  }

  public getAchievements(): Record<string, UnlockedAchievement> {
    return this.safeGet(STORAGE_KEYS.achievements, {});
  }

  public saveAchievements(achievements: Record<string, UnlockedAchievement>) {
    this.safeSet(STORAGE_KEYS.achievements, achievements);
  }

  public getXP(): XPState {
    return this.safeGet(STORAGE_KEYS.xp, { totalXp: 0, level: 1 });
  }

  public saveXP(xp: XPState) {
    this.safeSet(STORAGE_KEYS.xp, xp);
  }

  public ensureDailyRollover(): DailyStatsState {
    const today = getLocalDateKey();
    const current = this.safeGet<DailyStatsState | null>(STORAGE_KEYS.dailyStats, null);
    if (!current) {
      const fresh = createDefaultDailyStats(today);
      this.safeSet(STORAGE_KEYS.dailyStats, fresh);
      return fresh;
    }
    if (current.dateKey !== today) {
      // Compute streak continuity
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayKey = getLocalDateKey(yesterdayDate);
      const keptStreak =
        current.lastActiveDate === yesterdayKey || current.lastActiveDate === today
          ? current.streak
          : 0;
      const rolled: DailyStatsState = {
        dateKey: today,
        streak: keptStreak,
        lastActiveDate: current.lastActiveDate,
        gamesPlayedToday: 0,
        categoriesPlayedToday: [],
        maxAccuracyToday: 0,
        scoreToday: 0,
        playedGotdToday: false,
        quests: buildDailyQuests(today),
      };
      this.safeSet(STORAGE_KEYS.dailyStats, rolled);
      return rolled;
    }
    return current;
  }

  public saveDailyStats(daily: DailyStatsState) {
    this.safeSet(STORAGE_KEYS.dailyStats, daily);
  }

  public getActiveSessions(): Record<string, ActiveSession> {
    return this.safeGet(STORAGE_KEYS.activeSessions, {});
  }

  public saveActiveSession(gameId: string, session: ActiveSession | null) {
    const all = this.getActiveSessions();
    if (!session) {
      delete all[gameId];
    } else {
      all[gameId] = session;
    }
    this.setDebounced(STORAGE_KEYS.activeSessions, all, 150);
  }

  public exportAll(): ExportedDatabase {
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      ia_profile: this.getProfile(),
      ia_settings: this.getSettings(),
      ia_game_stats: this.getGameStats(),
      ia_best_scores: this.getBestScores(),
      ia_game_history: this.getHistory(),
      ia_achievements: this.getAchievements(),
      ia_xp: this.getXP(),
      ia_daily_stats: this.ensureDailyRollover(),
      ia_active_sessions: this.getActiveSessions(),
    };
  }

  public importAll(rawJson: string): { ok: true } | { ok: false; error: string } {
    try {
      const parsed = JSON.parse(rawJson) as Partial<ExportedDatabase>;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Format file JSON tidak valid.' };
      }
      if (
        !parsed.ia_profile ||
        typeof parsed.ia_profile.username !== 'string' ||
        !parsed.ia_xp ||
        typeof parsed.ia_xp.totalXp !== 'number' ||
        !parsed.ia_settings ||
        typeof parsed.ia_game_stats !== 'object'
      ) {
        return {
          ok: false,
          error: 'Struktur database INFINITE ARCADE tidak lengkap atau korup.',
        };
      }

      this.safeSet(STORAGE_KEYS.version, DB_VERSION);
      this.safeSet(STORAGE_KEYS.profile, parsed.ia_profile);
      this.safeSet(STORAGE_KEYS.settings, { ...createDefaultSettings(), ...parsed.ia_settings });
      this.safeSet(STORAGE_KEYS.gameStats, parsed.ia_game_stats || {});
      this.safeSet(STORAGE_KEYS.bestScores, parsed.ia_best_scores || {});
      this.safeSet(
        STORAGE_KEYS.gameHistory,
        Array.isArray(parsed.ia_game_history) ? parsed.ia_game_history.slice(0, 200) : []
      );
      this.safeSet(STORAGE_KEYS.achievements, parsed.ia_achievements || {});
      this.safeSet(STORAGE_KEYS.xp, parsed.ia_xp);
      if (parsed.ia_daily_stats) {
        this.safeSet(STORAGE_KEYS.dailyStats, parsed.ia_daily_stats);
      }
      this.safeSet(STORAGE_KEYS.activeSessions, parsed.ia_active_sessions || {});
      this.ensureDailyRollover();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Gagal membaca JSON. Pastikan file tidak rusak.' };
    }
  }

  public resetAll() {
    Object.values(STORAGE_KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
    this.initAndMigrate();
  }
}

export const DatabaseManager = new LocalDatabaseManager();
