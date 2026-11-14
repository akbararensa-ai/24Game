import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Brain,
  Calculator,
  Calendar,
  CheckCircle2,
  Cpu,
  Dices,
  Gamepad2,
  Play,
  Puzzle,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { AudioManager } from './core/audio';
import { DatabaseManager } from './core/database';
import {
  SessionCommitSummary,
  commitGameSession,
  getDynamicRecommendation,
  getGameOfTheDay,
  getLevelProgress,
  skillToTier,
} from './core/progression';
import {
  CATEGORY_LABELS,
  GAME_REGISTRY,
  PRIMARY_CATEGORY_LABELS,
  getGameById,
} from './core/registry';
import { GameShell } from './components/GameShell';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { SettingsModal } from './components/SettingsModal';
import { StatsAndAchievements } from './components/StatsAndAchievements';
import {
  ArcadeSettings,
  DailyStatsState,
  DifficultyTier,
  FilterCategory,
  GameHistoryEntry,
  GameMetadata,
  GameMode,
  GameSessionResult,
  GameStatEntry,
  PlayerProfile,
  PrimaryCategory,
  UnlockedAchievement,
  XPState,
} from './types/arcade';
import heroBackdropUrl from './assets/images/arcade_hero_backdrop_1794631826336.jpg';

type ActiveView = 'home' | 'library' | 'daily' | 'stats';
type SortOption = 'popular' | 'newest' | 'best_score';

function CategoryIcon({ cat, className = 'w-5 h-5' }: { cat: PrimaryCategory; className?: string }) {
  switch (cat) {
    case 'memory':
      return <Brain className={className} />;
    case 'math':
      return <Calculator className={className} />;
    case 'logic':
      return <Cpu className={className} />;
    case 'reflex':
      return <Zap className={className} />;
  }
}

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() => DatabaseManager.getProfile());
  const [settings, setSettings] = useState<ArcadeSettings>(() => DatabaseManager.getSettings());
  const [gameStats, setGameStats] = useState<Record<string, GameStatEntry>>(() =>
    DatabaseManager.getGameStats()
  );
  const [bestScores, setBestScores] = useState<Record<string, number>>(() =>
    DatabaseManager.getBestScores()
  );
  const [history, setHistory] = useState<GameHistoryEntry[]>(() => DatabaseManager.getHistory());
  const [achievements, setAchievements] = useState<Record<string, UnlockedAchievement>>(() =>
    DatabaseManager.getAchievements()
  );
  const [xpState, setXpState] = useState<XPState>(() => DatabaseManager.getXP());
  const [dailyStats, setDailyStats] = useState<DailyStatsState>(() =>
    DatabaseManager.ensureDailyRollover()
  );

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Library Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  const syncFromDb = useCallback(() => {
    setProfile(DatabaseManager.getProfile());
    setSettings(DatabaseManager.getSettings());
    setGameStats(DatabaseManager.getGameStats());
    setBestScores(DatabaseManager.getBestScores());
    setHistory(DatabaseManager.getHistory());
    setAchievements(DatabaseManager.getAchievements());
    setXpState(DatabaseManager.getXP());
    setDailyStats(DatabaseManager.ensureDailyRollover());
  }, []);

  useEffect(() => {
    DatabaseManager.initAndMigrate();
    DatabaseManager.onStorageError((msg) => setStorageError(msg));
    syncFromDb();
    setInitialized(true);
  }, [syncFromDb]);

  // Apply Audio + Theme + Motion settings
  useEffect(() => {
    AudioManager.configure(settings);
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    if (settings.reducedMotion || !settings.animationsEnabled) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [settings]);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const handleUpdateSettings = (next: ArcadeSettings) => {
    setSettings(next);
    DatabaseManager.saveSettings(next);
  };

  const handleUpdateProfile = (next: PlayerProfile) => {
    setProfile(next);
    DatabaseManager.saveProfile(next);
  };

  const handleSessionComplete = useCallback(
    (
      gameId: string,
      mode: GameMode,
      difficulty: DifficultyTier,
      result: GameSessionResult
    ): SessionCommitSummary => {
      const summary = commitGameSession(gameId, mode, difficulty, result);
      syncFromDb();
      if (summary.newlyUnlockedAchievements.length > 0) {
        AudioManager.achievement();
        setToastMsg(
          `Pencapaian Terbuka: ${summary.newlyUnlockedAchievements.map((a) => a.name).join(', ')}`
        );
      } else if (summary.leveledUp) {
        AudioManager.levelUp();
        setToastMsg(`Selamat! Naik ke Level ${summary.newLevel}`);
      }
      return summary;
    },
    [syncFromDb]
  );

  const handleClaimDailyQuest = (questId: string) => {
    const target = dailyStats.quests.find((q) => q.id === questId);
    if (!target || target.claimed || target.progress < target.target) return;

    AudioManager.achievement();
    const updatedQuests = dailyStats.quests.map((q) =>
      q.id === questId ? { ...q, claimed: true } : q
    );
    const nextDaily: DailyStatsState = { ...dailyStats, quests: updatedQuests };
    DatabaseManager.saveDailyStats(nextDaily);

    const nextXpTotal = xpState.totalXp + target.xpReward;
    const nextLevel = getLevelProgress(nextXpTotal).level;
    DatabaseManager.saveXP({ totalXp: nextXpTotal, level: nextLevel });

    syncFromDb();
    setToastMsg(`Klaim Harian Berhasil: +${target.xpReward} XP`);
  };

  const launchGame = (gameId: string) => {
    AudioManager.click();
    setActiveGameId(gameId);
  };

  const launchRandomGame = () => {
    const pool =
      filteredGames.length > 0 && activeView === 'library' ? filteredGames : GAME_REGISTRY;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    launchGame(pick.id);
  };

  const levelInfo = useMemo(() => getLevelProgress(xpState.totalXp), [xpState.totalXp]);
  const gameOfTheDay = useMemo(() => getGameOfTheDay(dailyStats.dateKey), [dailyStats.dateKey]);
  const recommendedGame = useMemo(() => getDynamicRecommendation(gameStats), [gameStats]);
  const activeSessions = useMemo(
    () => (initialized ? DatabaseManager.getActiveSessions() : {}),
    [initialized, activeGameId]
  );

  const continueGame = useMemo(() => {
    if (profile.lastGameId) {
      const found = getGameById(profile.lastGameId);
      if (found) return found;
    }
    return recommendedGame;
  }, [profile.lastGameId, recommendedGame]);

  const aggregateStats = useMemo(() => {
    const entries = Object.values(gameStats);
    const totalPlays = entries.reduce((s, e) => s + e.plays, 0);
    const totalPlaytimeSec = entries.reduce((s, e) => s + e.totalPlaytimeSec, 0);
    const highestScore = Math.max(0, ...Object.values(bestScores));
    const totalCompletions = entries.reduce((s, e) => s + e.completions, 0);
    return {
      totalPlays,
      totalPlaytimeMin: Math.round(totalPlaytimeSec / 60),
      highestScore,
      totalCompletions,
    };
  }, [bestScores, gameStats]);

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = GAME_REGISTRY.filter((g) => {
      const catOk = selectedCategory === 'all' || g.tags.includes(selectedCategory);
      const qOk =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.shortDesc.toLowerCase().includes(q) ||
        PRIMARY_CATEGORY_LABELS[g.primaryCategory].toLowerCase().includes(q);
      return catOk && qOk;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') return b.popularity - a.popularity;
      if (sortBy === 'newest') return b.releaseOrder - a.releaseOrder;
      return (bestScores[b.id] ?? 0) - (bestScores[a.id] ?? 0);
    });
  }, [bestScores, searchQuery, selectedCategory, sortBy]);

  // Active Game Fullscreen Shell
  const activeGameMeta: GameMetadata | undefined = activeGameId
    ? getGameById(activeGameId)
    : undefined;

  if (activeGameMeta) {
    return (
      <GameShell
        game={activeGameMeta}
        bestScore={bestScores[activeGameMeta.id] ?? 0}
        adaptiveSkill={gameStats[activeGameMeta.id]?.adaptiveSkill ?? 1.0}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() =>
          handleUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
        }
        onSessionComplete={handleSessionComplete}
        onExit={() => {
          setActiveGameId(null);
          syncFromDb();
        }}
      />
    );
  }

  const canvasBg =
    settings.theme === 'light'
      ? 'bg-slate-50 text-slate-900'
      : settings.theme === 'midnight'
      ? 'bg-[#03050a] text-slate-100'
      : 'bg-[#060a13] text-slate-100';

  return (
    <div className={`min-h-screen flex flex-col ${canvasBg} transition-colors duration-200`}>
      {/* Top Bar Contract: [Wordmark] — [4 Nav Links] — [1 Primary CTA] */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#060a13]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="text-lg sm:text-xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            INFINITE ARCADE
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'home', label: 'Beranda' },
                { id: 'library', label: 'Koleksi Game' },
                { id: 'daily', label: 'Tantangan Harian' },
                { id: 'stats', label: 'Statistik' },
              ] as { id: ActiveView; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  AudioManager.click();
                  setActiveView(item.id);
                }}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeView === item.id
                    ? 'text-blue-600 dark:text-cyan-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={launchRandomGame}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Dices className="w-4 h-4" />
              <span>Main Acak</span>
            </button>
          </div>
        </div>

        {/* Mobile sub-nav */}
        <div className="flex md:hidden border-t border-slate-200/70 dark:border-slate-800/70 overflow-x-auto px-4 py-2 gap-4 text-xs font-medium">
          {(
            [
              { id: 'home', label: 'Beranda' },
              { id: 'library', label: '24 Game' },
              { id: 'daily', label: 'Harian' },
              { id: 'stats', label: 'Statistik' },
            ] as { id: ActiveView; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`whitespace-nowrap shrink-0 px-2 py-1 rounded-md cursor-pointer ${
                activeView === item.id
                  ? 'bg-blue-600/15 text-blue-600 dark:text-cyan-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {storageError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
            {storageError}
          </div>
        )}

        {/* Compact Player Profile & Utility Bar */}
        <section className="rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center font-display font-bold text-lg text-blue-600 dark:text-cyan-400 shrink-0">
              {levelInfo.level}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-display font-bold text-slate-900 dark:text-white truncate">
                  {profile.username}
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  Level {levelInfo.level} · {xpState.totalXp.toLocaleString('id-ID')} XP
                </span>
              </div>
              <div className="w-full max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-300"
                  style={{ width: `${levelInfo.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() =>
                handleUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-500" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Suara {settings.soundEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pengaturan</span>
            </button>
          </div>
        </section>

        {/* HOME VIEW */}
        {activeView === 'home' && (
          <>
            {/* Hero Arena Banner */}
            <section className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#070d1a] min-h-[300px] grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <img
                src={heroBackdropUrl}
                alt="Arena Kognitif INFINITE ARCADE"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060a13] via-[#060a13]/85 to-[#060a13]/40" />

              <div className="relative z-10 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-5">
                <div className="text-xs font-semibold tracking-wider text-cyan-400">
                  PLAY MORE. THINK FASTER. GO INFINITE.
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white leading-tight [text-wrap:balance]">
                  READY TO CHALLENGE YOUR BRAIN?
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                  24 mini-game prosedural lintas memori, matematika, logika, dan refleks dengan kesulitan adaptif tanpa batas level.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={launchRandomGame}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Dices className="w-4 h-4" />
                    <span>Play Random Game</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launchGame(continueGame.id)}
                    className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 text-cyan-400 fill-current" />
                    <span>Continue: {continueGame.title}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Recommendation & Game of the Day */}
              <div className="relative z-10 lg:col-span-5 p-6 sm:p-8 flex flex-col justify-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-[#060a13]/65">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Game of the Day</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-lg text-white">
                        {gameOfTheDay.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {PRIMARY_CATEGORY_LABELS[gameOfTheDay.primaryCategory]} · Rekor{' '}
                        {(bestScores[gameOfTheDay.id] ?? 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchGame(gameOfTheDay.id)}
                      className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Mainkan
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-800" />

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-blue-400">Rekomendasi Untukmu</div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-base text-slate-100">
                        {recommendedGame.title}
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-1">
                        {recommendedGame.shortDesc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchGame(recommendedGame.id)}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Coba
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Player 7-Metric Overview Strip */}
            <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Total Main', val: aggregateStats.totalPlays.toLocaleString('id-ID') },
                { label: 'Waktu Main', val: `${aggregateStats.totalPlaytimeMin} mnt` },
                { label: 'Skor Tertinggi', val: aggregateStats.highestScore.toLocaleString('id-ID') },
                { label: 'Level', val: String(levelInfo.level) },
                { label: 'Total XP', val: xpState.totalXp.toLocaleString('id-ID') },
                { label: 'Daily Streak', val: `${dailyStats.streak} hari` },
                { label: 'Sesi Tuntas', val: aggregateStats.totalCompletions.toLocaleString('id-ID') },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 p-3.5"
                >
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</div>
                  <div className="text-lg font-mono-num font-bold text-slate-900 dark:text-white mt-0.5">
                    {stat.val}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* DAILY CHALLENGES VIEW (shown on 'home' preview or dedicated 'daily' tab) */}
        {(activeView === 'home' || activeView === 'daily') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-500" />
                  <span>Tantangan Harian</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Diperbarui otomatis setiap hari ({dailyStats.dateKey}) · Streak aktif: {dailyStats.streak} hari
                </p>
              </div>
              {activeView === 'home' && (
                <button
                  type="button"
                  onClick={() => setActiveView('daily')}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <span>Detail Harian</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {dailyStats.quests.map((q) => {
                const done = q.progress >= q.target;
                const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className="rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {q.title}
                        </h3>
                        <span className="text-xs font-mono-num font-semibold text-emerald-500 shrink-0">
                          +{q.xpReward} XP
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{q.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                        <span>Progres</span>
                        <span>
                          {q.progress}/{q.target}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-[width] duration-300 ${
                            done ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {q.claimed ? (
                        <div className="pt-1 text-xs font-semibold text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Diklaim</span>
                        </div>
                      ) : done ? (
                        <button
                          type="button"
                          onClick={() => handleClaimDailyQuest(q.id)}
                          className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          Klaim +{q.xpReward} XP
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* GAME LIBRARY (shown on 'home' & 'library') */}
        {(activeView === 'home' || activeView === 'library') && (
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Gamepad2 className="w-6 h-6 text-blue-500" />
                  <span>Koleksi 24 Mini-Game</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Semua tantangan dibuat secara prosedural dengan skala kesulitan adaptif tanpa batas.
                </p>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari game..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="popular" className="bg-slate-900 text-white">Populer</option>
                    <option value="newest" className="bg-slate-900 text-white">Terbaru</option>
                    <option value="best_score" className="bg-slate-900 text-white">Skor Terbaik</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 7 Category Interactive Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(CATEGORY_LABELS) as FilterCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    AudioManager.click();
                    setSelectedCategory(cat);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Cards Grid */}
            {filteredGames.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
                <Puzzle className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-sm font-medium text-slate-400">
                  Tidak ada game yang cocok dengan pencarianmu.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGames.map((game) => {
                  const st = gameStats[game.id];
                  const best = bestScores[game.id] ?? 0;
                  const diffTier = skillToTier(st?.adaptiveSkill ?? 1.0);
                  const hasSaved = !!activeSessions[game.id];

                  return (
                    <article
                      key={game.id}
                      onClick={() => launchGame(game.id)}
                      className="group rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/60 p-5 flex flex-col justify-between gap-4 transition-all duration-150 cursor-pointer"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                            <CategoryIcon cat={game.primaryCategory} />
                          </div>
                          {hasSaved && (
                            <span className="text-[11px] font-semibold text-amber-500">
                              Sesi Tersimpan
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                            {game.title}
                          </h3>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{PRIMARY_CATEGORY_LABELS[game.primaryCategory]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{diffTier}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                          {game.shortDesc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <div className="text-[10px] text-slate-400">Best Score</div>
                          <div className="text-sm font-mono-num font-bold text-slate-900 dark:text-slate-100">
                            {best.toLocaleString('id-ID')}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            launchGame(game.id);
                          }}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{hasSaved ? 'Lanjutkan' : 'Play'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* STATS & ACHIEVEMENTS VIEW */}
        {activeView === 'stats' && (
          <StatsAndAchievements
            stats={gameStats}
            bestScores={bestScores}
            history={history}
            achievements={achievements}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500">
        INFINITE ARCADE · 24 Mini-Game Prosedural · Penyimpanan Lokal Otomatis
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          profile={profile}
          settings={settings}
          onUpdateProfile={handleUpdateProfile}
          onUpdateSettings={handleUpdateSettings}
          onDatabaseReload={syncFromDb}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Achievement / Level-Up Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-cyan-400/50 text-sm font-semibold text-white shadow-xl">
          <Award className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
