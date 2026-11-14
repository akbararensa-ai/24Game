import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AudioManager } from '../core/audio';
import { DatabaseManager } from '../core/database';
import {
  DIFFICULTY_TIERS,
  MODE_LABELS,
  SessionCommitSummary,
  skillToTier,
  tierToBaseSkill,
} from '../core/progression';
import { GAME_COMPONENTS } from '../games/gameMap';
import {
  DifficultyTier,
  GameHudState,
  GameMetadata,
  GameMode,
  GameSessionResult,
} from '../types/arcade';

interface GameShellProps {
  game: GameMetadata;
  bestScore: number;
  adaptiveSkill: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSessionComplete: (
    gameId: string,
    mode: GameMode,
    difficulty: DifficultyTier,
    result: GameSessionResult
  ) => SessionCommitSummary;
  onExit: () => void;
}

export const GameShell: React.FC<GameShellProps> = ({
  game,
  bestScore,
  adaptiveSkill,
  soundEnabled,
  onToggleSound,
  onSessionComplete,
  onExit,
}) => {
  const savedSessionObj = DatabaseManager.getActiveSessions()[game.id];
  const recommendedTier = skillToTier(adaptiveSkill);

  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>(() =>
    savedSessionObj ? 'playing' : 'setup'
  );
  const [selectedMode, setSelectedMode] = useState<GameMode>(
    savedSessionObj?.mode || game.supportedModes[0]
  );
  const [selectedDiff, setSelectedDiff] = useState<DifficultyTier>(recommendedTier);
  const [useSavedResume, setUseSavedResume] = useState<boolean>(!!savedSessionObj);
  const [paused, setPaused] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const [hud, setHud] = useState<GameHudState>({
    score: 0,
    level: 1,
    timeLeftSec: null,
    lives: null,
    progressLabel: '',
  });
  const [feedbackToast, setFeedbackToast] = useState<{
    id: number;
    kind: 'score' | 'error' | 'combo';
    text: string;
  } | null>(null);
  const [finalResult, setFinalResult] = useState<GameSessionResult | null>(null);
  const [commitSummary, setCommitSummary] = useState<SessionCommitSummary | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const GameComponent = GAME_COMPONENTS[game.id];

  const triggerFeedback = useCallback(
    (kind: 'score' | 'error' | 'combo', text = '') => {
      if (!text) return;
      setFeedbackToast({ id: Date.now() + Math.random(), kind, text });
    },
    []
  );

  useEffect(() => {
    if (!feedbackToast) return;
    const id = window.setTimeout(() => setFeedbackToast(null), 700);
    return () => window.clearTimeout(id);
  }, [feedbackToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'playing') {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // Animate final score counter on result screen
  useEffect(() => {
    if (phase !== 'result' || !finalResult) return;
    let frame = 0;
    const totalFrames = 24;
    const target = finalResult.score;
    const id = window.setInterval(() => {
      frame++;
      const progress = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(target * eased));
      if (frame >= totalFrames) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [finalResult, phase]);

  const handleSaveSession = useCallback(
    (payload: Record<string, unknown> | null) => {
      if (!game.supportsResume) return;
      if (!payload) {
        DatabaseManager.saveActiveSession(game.id, null);
      } else {
        DatabaseManager.saveActiveSession(game.id, {
          gameId: game.id,
          mode: selectedMode,
          savedAt: new Date().toISOString(),
          payload,
        });
      }
    },
    [game.id, game.supportsResume, selectedMode]
  );

  const handleGameOver = useCallback(
    (result: GameSessionResult) => {
      if (result.completed) AudioManager.levelUp();
      else AudioManager.gameOver();
      const summary = onSessionComplete(game.id, selectedMode, selectedDiff, result);
      setFinalResult(result);
      setCommitSummary(summary);
      setUseSavedResume(false);
      setPhase('result');
      setPaused(false);
    },
    [game.id, onSessionComplete, selectedDiff, selectedMode]
  );

  const startFresh = (modeToUse = selectedMode) => {
    AudioManager.click();
    DatabaseManager.saveActiveSession(game.id, null);
    setUseSavedResume(false);
    setSelectedMode(modeToUse);
    setPaused(false);
    setFinalResult(null);
    setCommitSummary(null);
    setRunKey((k) => k + 1);
    setPhase('playing');
  };

  const handleRestart = () => {
    startFresh(selectedMode);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Compact Top Gameplay HUD */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                AudioManager.click();
                onExit();
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Kembali ke Koleksi"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg truncate">
                {game.title}
              </h1>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <span>{MODE_LABELS[selectedMode]}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedDiff}</span>
                {hud.progressLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-400 tabular-nums">{hud.progressLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {phase === 'playing' && (
            <div className="flex items-center gap-4 sm:gap-6 shrink-0">
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Level</div>
                <div className="text-sm sm:text-base font-mono-num font-bold text-slate-100">
                  {hud.level}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Skor</div>
                <div className="text-sm sm:text-base font-mono-num font-bold text-cyan-400">
                  {hud.score.toLocaleString('id-ID')}
                </div>
              </div>
              {hud.timeLeftSec !== null && hud.timeLeftSec !== undefined && (
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Waktu</div>
                  <div
                    className={`text-sm sm:text-base font-mono-num font-bold ${
                      hud.timeLeftSec <= 10 ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {hud.timeLeftSec}s
                  </div>
                </div>
              )}
              {hud.lives !== null && hud.lives !== undefined && (
                <div className="hidden sm:flex items-center gap-1" aria-label={`Nyawa ${hud.lives}`}>
                  {Array.from({ length: hud.maxLives || 3 }).map((_, idx) => (
                    <Heart
                      key={idx}
                      className={`w-4 h-4 ${
                        idx < (hud.lives ?? 0)
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {phase === 'playing' && hud.onUseHint && (
              <button
                type="button"
                onClick={hud.onUseHint}
                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer"
                title="Gunakan Petunjuk"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSound}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
              aria-label={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {phase === 'playing' && (
              <>
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                  aria-label="Jeda Game"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                  aria-label="Mulai Ulang"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Arena Body */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative">
        {phase === 'setup' && (
          <div className="w-full max-w-lg rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="text-xs text-cyan-400 font-medium">
                Rekor Terbaik: {bestScore.toLocaleString('id-ID')} · Tingkat Adaptif: {recommendedTier}
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
                {game.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{game.howToPlay}</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">Pilih Mode Permainan</div>
              <div className="grid grid-cols-2 gap-2">
                {game.supportedModes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      AudioManager.click();
                      setSelectedMode(m);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedMode === m
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                Kesulitan Awal (Skala Otomatis Berlanjut Tanpa Batas)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIFFICULTY_TIERS.slice(0, 6).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      AudioManager.click();
                      setSelectedDiff(tier);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedDiff === tier
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400 border-t border-slate-800 pt-3">
              Kontrol: <span className="text-slate-200">{game.controlsHint}</span>
            </div>

            <button
              type="button"
              onClick={() => startFresh(selectedMode)}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai Bermain</span>
            </button>
          </div>
        )}

        {phase === 'playing' && GameComponent && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-4">
            {/* Floating Feedback Pop */}
            {feedbackToast && (
              <div
                key={feedbackToast.id}
                className={`pointer-events-none fixed top-20 z-40 px-4 py-1.5 rounded-lg text-sm font-mono-num font-bold shadow-lg animate-score-pop ${
                  feedbackToast.kind === 'error'
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {feedbackToast.text}
              </div>
            )}

            {/* Mobile lives bar */}
            {hud.lives !== null && hud.lives !== undefined && (
              <div className="flex sm:hidden items-center gap-1.5">
                {Array.from({ length: hud.maxLives || 3 }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < (hud.lives ?? 0) ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}

            <GameComponent
              key={runKey}
              mode={selectedMode}
              difficulty={selectedDiff}
              skillLevel={Math.max(tierToBaseSkill(selectedDiff), adaptiveSkill)}
              paused={paused}
              savedSession={useSavedResume ? savedSessionObj?.payload : null}
              onHudUpdate={setHud}
              onSaveSession={handleSaveSession}
              onGameOver={handleGameOver}
              onTriggerFeedback={triggerFeedback}
            />

            <p className="text-xs text-slate-500 text-center max-w-md pt-2">
              {game.howToPlay}
            </p>
          </div>
        )}

        {/* Pause Overlay */}
        {phase === 'playing' && paused && (
          <div className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center space-y-4">
              <h2 className="text-2xl font-display font-bold text-white">Permainan Dijeda</h2>
              <p className="text-sm text-slate-400">
                Tekan Lanjutkan untuk kembali ke {game.title}.
              </p>
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaused(false)}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                >
                  Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  Mulai Ulang
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full h-11 rounded-xl bg-transparent hover:bg-slate-800/60 border border-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Kembali ke Koleksi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result Screen */}
        {phase === 'result' && finalResult && commitSummary && (
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              {commitSummary.isNewRecord && (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Trophy className="w-4 h-4" />
                  <span>REKOR BARU TERCAPAI!</span>
                </div>
              )}
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
                {finalResult.completed ? 'Sesi Selesai' : 'Permainan Berakhir'}
              </h2>
              <div className="text-5xl font-mono-num font-extrabold text-cyan-400 pt-1">
                {animatedScore.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-slate-400">
                Skor Terbaik:{' '}
                <span className="text-slate-200 font-semibold tabular-nums">
                  {Math.max(bestScore, finalResult.score).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Akurasi</div>
                <div className="text-lg font-mono-num font-bold text-slate-100">
                  {Math.round(finalResult.accuracy)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Durasi</div>
                <div className="text-lg font-mono-num font-bold text-slate-100">
                  {finalResult.durationSec}d
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Level</div>
                <div className="text-lg font-mono-num font-bold text-slate-100">
                  {finalResult.levelReached}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">XP Didapat</div>
                <div className="text-lg font-mono-num font-bold text-emerald-400">
                  +{commitSummary.xpEarned}
                </div>
              </div>
            </div>

            {finalResult.customMetricLabel && (
              <div className="text-center text-sm text-slate-300">
                {finalResult.customMetricLabel}:{' '}
                <span className="font-mono-num font-bold text-cyan-300">
                  {finalResult.customMetricValue}
                </span>
              </div>
            )}

            {commitSummary.leveledUp && (
              <div className="p-3.5 rounded-xl bg-blue-600/15 border border-blue-500/40 text-center text-sm font-semibold text-blue-200">
                Naik ke Level Pemain {commitSummary.newLevel}!
              </div>
            )}

            {commitSummary.newlyUnlockedAchievements.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <div className="text-xs font-semibold text-amber-300">
                  Pencapaian Baru Terbuka:
                </div>
                {commitSummary.newlyUnlockedAchievements.map((ach) => (
                  <div key={ach.id} className="text-sm text-slate-100 font-medium">
                    {ach.name} (+{ach.xpBonus} XP)
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRestart}
                className="h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer transition-colors"
              >
                Main Lagi
              </button>
              <button
                type="button"
                onClick={onExit}
                className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors"
              >
                Kembali ke Koleksi
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
