import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { AudioManager } from '../core/audio';
import { GameComponentProps } from '../types/arcade';
import {
  GeometricShape,
  SHAPE_KINDS,
  SHAPE_PALETTE,
  ShapeKind,
  randInt,
  shuffleArray,
} from './shared';

// ============================================================================
// 19. REACTION TIME
// ============================================================================
export const ReactionTimeGame: React.FC<GameComponentProps> = ({
  mode,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const goTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const [state, setState] = useState<'wait' | 'ready' | 'early' | 'result'>('wait');
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [earlyCount, setEarlyCount] = useState(0);
  const targetRounds = mode === 'classic' ? 5 : mode === 'challenge' ? 5 : 999;

  const avgMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const score = times.reduce((s, t) => s + Math.max(40, Math.round(520 - t)), 0);

  const scheduleReady = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setState('wait');
    const delay = randInt(1400, 3900);
    timerRef.current = window.setTimeout(() => {
      goTimeRef.current = performance.now();
      AudioManager.tick();
      setState('ready');
    }, delay);
  }, []);

  useEffect(() => {
    scheduleReady();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [scheduleReady]);

  useEffect(() => {
    onHudUpdate({
      score,
      level: times.length + 1,
      progressLabel:
        mode === 'endless'
          ? `Rata-rata ${avgMs || '-'} ms`
          : `Ronde ${Math.min(targetRounds, times.length + 1)}/${targetRounds}`,
    });
  }, [avgMs, mode, onHudUpdate, score, targetRounds, times.length]);

  const finishNow = useCallback(
    (recorded: number[], earlies: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const mean = recorded.length > 0 ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : 999;
      const totalScore = recorded.reduce((s, t) => s + Math.max(40, Math.round(520 - t)), 0);
      const totalClicks = recorded.length + earlies;
      onGameOver({
        score: totalScore,
        accuracy: totalClicks > 0 ? Math.round((recorded.length / totalClicks) * 100) : 100,
        durationSec: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
        levelReached: recorded.length,
        completed: true,
        reactionMs: mean,
        customMetricLabel: 'Rata-rata Reaksi',
        customMetricValue: `${mean} ms`,
      });
    },
    [onGameOver]
  );

  const handleArenaTap = useCallback(() => {
    if (paused) return;
    if (state === 'wait') {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      AudioManager.wrong();
      setEarlyCount((e) => e + 1);
      setState('early');
      onTriggerFeedback?.('error', 'Terlalu Cepat!');
    } else if (state === 'ready') {
      const ms = Math.max(85, Math.round(performance.now() - goTimeRef.current));
      AudioManager.correct();
      const nextTimes = [...times, ms];
      setTimes(nextTimes);
      setLastMs(ms);
      onTriggerFeedback?.('score', `${ms} ms`);

      if (mode !== 'endless' && nextTimes.length >= targetRounds) {
        finishNow(nextTimes, earlyCount);
        return;
      }
      setState('result');
    } else if (state === 'early' || state === 'result') {
      scheduleReady();
    }
  }, [earlyCount, finishNow, mode, onTriggerFeedback, paused, scheduleReady, state, targetRounds, times]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !paused) {
        e.preventDefault();
        handleArenaTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleArenaTap, paused]);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4">
      <button
        type="button"
        onPointerDown={handleArenaTap}
        className={`w-full h-72 sm:h-80 rounded-2xl border flex flex-col items-center justify-center gap-3 p-6 text-center transition-colors cursor-pointer select-none ${
          state === 'ready'
            ? 'bg-emerald-500 border-emerald-300 text-slate-950'
            : state === 'early'
            ? 'bg-rose-500/20 border-rose-500 text-rose-200'
            : state === 'result'
            ? 'bg-blue-600/20 border-blue-400 text-slate-100'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {state === 'wait' && (
          <>
            <div className="text-2xl sm:text-3xl font-display font-bold">Tunggu Warna Hijau...</div>
            <div className="text-sm text-slate-400">Jangan tap sebelum arena berubah hijau</div>
          </>
        )}
        {state === 'ready' && (
          <div className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight">
            TAP SEKARANG!
          </div>
        )}
        {state === 'early' && (
          <>
            <div className="text-2xl font-display font-bold">Terlalu Cepat!</div>
            <div className="text-sm">Ketuk arena untuk mencoba lagi</div>
          </>
        )}
        {state === 'result' && (
          <>
            <div className="text-5xl font-mono-num font-bold text-cyan-300">{lastMs} ms</div>
            <div className="text-sm text-slate-300">Ketuk arena untuk ronde berikutnya</div>
          </>
        )}
      </button>

      {mode === 'endless' && times.length > 0 && (
        <button
          type="button"
          onClick={() => finishNow(times, earlyCount)}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200 cursor-pointer"
        >
          Selesaikan & Simpan Skor ({avgMs} ms)
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 20. COLOR STROOP
// ============================================================================
const STROOP_COLORS = [
  { name: 'MERAH', hex: '#EF4444' },
  { name: 'BIRU', hex: '#3B82F6' },
  { name: 'HIJAU', hex: '#10B981' },
  { name: 'KUNING', hex: '#F59E0B' },
];

interface StroopPrompt {
  wordIdx: number;
  inkIdx: number;
  rule: 'ink' | 'word';
}

function buildStroop(level: number): StroopPrompt {
  const wordIdx = randInt(0, 3);
  let inkIdx = randInt(0, 3);
  if (Math.random() < 0.75) {
    while (inkIdx === wordIdx) inkIdx = randInt(0, 3);
  }
  const rule = level >= 3 && Math.random() < 0.4 ? 'word' : 'ink';
  return { wordIdx, inkIdx, rule };
}

export const ColorStroopGame: React.FC<GameComponentProps> = ({
  mode,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 1 : mode === 'time_attack' ? null : 3);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 45 : null);
  const [prompt, setPrompt] = useState<StroopPrompt>(() => buildStroop(1));
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      streak,
      progressLabel: `Benar ${correct}`,
    });
  }, [correct, level, lives, mode, onHudUpdate, score, streak, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [attempts, correct, level, onGameOver, paused, score, timeLeft]);

  const pickColor = useCallback(
    (idx: number) => {
      if (paused) return;
      const target = prompt.rule === 'ink' ? prompt.inkIdx : prompt.wordIdx;
      const nextAtt = attempts + 1;
      setAttempts(nextAtt);

      if (idx === target) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        const gained = 35 + Math.min(45, nextStreak * 6);
        setScore((s) => s + gained);
        const nextCorrect = correct + 1;
        setCorrect(nextCorrect);
        const nextLvl = nextCorrect % 5 === 0 ? level + 1 : level;
        setLevel(nextLvl);
        onTriggerFeedback?.('score', `+${gained}`);
        if (nextStreak >= 3) AudioManager.combo(nextStreak);
        else AudioManager.correct();
        setPrompt(buildStroop(nextLvl));
      } else {
        AudioManager.wrong();
        setStreak(0);
        onTriggerFeedback?.('error', 'Salah Warna');
        if (lives !== null) {
          const nextLives = lives - 1;
          setLives(nextLives);
          if (nextLives <= 0) {
            onGameOver({
              score,
              accuracy: Math.round((correct / nextAtt) * 100),
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: false,
            });
            return;
          }
        }
        setPrompt(buildStroop(level));
      }
    },
    [attempts, correct, level, lives, onGameOver, onTriggerFeedback, paused, prompt.inkIdx, prompt.rule, prompt.wordIdx, score, streak]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) pickColor(idx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, pickColor]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 py-4">
      <div className="text-sm font-semibold text-slate-300">
        Aturan Aktif:{' '}
        <span className="text-cyan-400">
          {prompt.rule === 'ink' ? 'PILIH WARNA TINTA' : 'PILIH ARTI KATA'}
        </span>
      </div>

      <div className="w-full py-12 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <div
          className="text-4xl sm:text-5xl font-display font-extrabold tracking-wider"
          style={{ color: STROOP_COLORS[prompt.inkIdx].hex }}
        >
          {paused ? '•••••' : STROOP_COLORS[prompt.wordIdx].name}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {STROOP_COLORS.map((c, idx) => (
          <button
            key={c.name}
            type="button"
            disabled={paused}
            onClick={() => pickColor(idx)}
            className="h-14 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-bold flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 transition-all"
          >
            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.hex }} />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 21. TARGET TAP
// ============================================================================
interface TargetNode {
  id: number;
  xPct: number;
  yPct: number;
  sizePx: number;
  isHazard: boolean;
}

export const TargetTapGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 3 : null);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'endless' ? null : 35);
  const level = Math.max(1, Math.floor(hits / 8) + 1);

  const spawnTarget = useCallback(
    (lvl: number, forceSafe = false): TargetNode => {
      const sizePx = Math.max(38, 66 - lvl * 3 - Math.round(skillLevel * 2));
      const isHazard = !forceSafe && lvl >= 3 && Math.random() < 0.22;
      return {
        id: Date.now() + Math.random(),
        xPct: randInt(12, 88),
        yPct: randInt(14, 86),
        sizePx,
        isHazard,
      };
    },
    [skillLevel]
  );

  const [targets, setTargets] = useState<TargetNode[]>(() => [spawnTarget(1, true)]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 3 : undefined,
      timeLeftSec: timeLeft,
      progressLabel: `Target ${hits}`,
    });
  }, [hits, level, lives, mode, onHudUpdate, score, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      const total = hits + misses;
      onGameOver({
        score,
        accuracy: total > 0 ? Math.round((hits / total) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
        mistakes: misses,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [hits, level, misses, onGameOver, paused, score, timeLeft]);

  const handleTargetClick = (e: React.PointerEvent, t: TargetNode) => {
    e.stopPropagation();
    if (paused) return;
    if (t.isHazard) {
      AudioManager.wrong();
      const nextMiss = misses + 1;
      setMisses(nextMiss);
      onTriggerFeedback?.('error', 'Jebakan!');
      if (lives !== null) {
        const nextL = lives - 1;
        setLives(nextL);
        if (nextL <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((hits / (hits + nextMiss)) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
          });
          return;
        }
      }
      setTargets([spawnTarget(level, true)]);
      return;
    }

    AudioManager.correct();
    const nextHits = hits + 1;
    const gained = 35 + level * 10;
    setHits(nextHits);
    setScore((s) => s + gained);
    onTriggerFeedback?.('score', `+${gained}`);
    const nextLvl = Math.max(1, Math.floor(nextHits / 8) + 1);
    const nextList = [spawnTarget(nextLvl, true)];
    if (nextLvl >= 3 && Math.random() < 0.4) {
      nextList.push({ ...spawnTarget(nextLvl, false), isHazard: true });
    }
    setTargets(nextList);
  };

  const handleMissArea = () => {
    if (paused) return;
    AudioManager.wrong();
    const nextMiss = misses + 1;
    setMisses(nextMiss);
    if (lives !== null) {
      const nextL = lives - 1;
      setLives(nextL);
      if (nextL <= 0) {
        onGameOver({
          score,
          accuracy: hits + nextMiss > 0 ? Math.round((hits / (hits + nextMiss)) * 100) : 0,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-3">
      <div
        onPointerDown={handleMissArea}
        className="relative w-full h-80 sm:h-96 rounded-2xl bg-slate-900/95 border border-slate-800 overflow-hidden select-none cursor-crosshair"
      >
        {!paused &&
          targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => handleTargetClick(e, t)}
              style={{
                left: `${t.xPct}%`,
                top: `${t.yPct}%`,
                width: `${t.sizePx}px`,
                height: `${t.sizePx}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`absolute rounded-full border-2 flex items-center justify-center font-bold transition-transform active:scale-90 cursor-pointer ${
                t.isHazard
                  ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                  : 'bg-cyan-500/25 border-cyan-300 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]'
              }`}
            >
              {t.isHazard ? '✕' : <span className="w-3 h-3 rounded-full bg-cyan-300" />}
            </button>
          ))}
      </div>
      {mode === 'endless' && (
        <button
          type="button"
          onClick={() =>
            onGameOver({
              score,
              accuracy: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100,
              durationSec: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
              levelReached: level,
              completed: true,
            })
          }
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
        >
          Selesaikan Sesi
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 22. FAST COMPARISON
// ============================================================================
interface CompRound {
  kind: 'bigger' | 'same_diff';
  leftText: string;
  rightText: string;
  correctSide: 'left' | 'right'; // for same_diff: left=SAMA, right=BEDA
}

function buildComparisonRound(level: number): CompRound {
  if (level % 2 === 1) {
    const a1 = randInt(3, 12 + level * 2);
    const a2 = randInt(2, 9 + level);
    const leftVal = level >= 3 ? a1 * a2 : a1 + a2;
    const delta = randInt(1, 7) * (Math.random() < 0.5 ? 1 : -1);
    const rightVal = Math.max(2, leftVal + delta);
    const leftText = level >= 3 ? `${a1} × ${a2}` : `${a1} + ${a2}`;
    const b1 = randInt(2, Math.max(3, rightVal - 1));
    const rightText = level >= 3 ? String(rightVal) : `${b1} + ${rightVal - b1}`;
    return {
      kind: 'bigger',
      leftText,
      rightText,
      correctSide: leftVal > rightVal ? 'left' : 'right',
    };
  }
  const len = Math.min(7, 3 + Math.floor(level / 2));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let str = '';
  for (let i = 0; i < len; i++) str += chars[randInt(0, chars.length - 1)];
  const isSame = Math.random() < 0.5;
  let rightStr = str;
  if (!isSame) {
    const pos = randInt(0, len - 1);
    let rep = chars[randInt(0, chars.length - 1)];
    while (rep === str[pos]) rep = chars[randInt(0, chars.length - 1)];
    rightStr = str.slice(0, pos) + rep + str.slice(pos + 1);
  }
  return {
    kind: 'same_diff',
    leftText: str,
    rightText: rightStr,
    correctSide: isSame ? 'left' : 'right',
  };
}

export const FastComparisonGame: React.FC<GameComponentProps> = ({
  mode,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 1 : mode === 'time_attack' ? null : 3);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 45 : null);
  const [round, setRound] = useState<CompRound>(() => buildComparisonRound(1));
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      streak,
      progressLabel: `Benar ${correct}`,
    });
  }, [correct, level, lives, mode, onHudUpdate, score, streak, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [attempts, correct, level, onGameOver, paused, score, timeLeft]);

  const choose = useCallback(
    (side: 'left' | 'right') => {
      if (paused) return;
      const nextAtt = attempts + 1;
      setAttempts(nextAtt);
      if (side === round.correctSide) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        const gained = 35 + Math.min(45, nextStreak * 5);
        setScore((s) => s + gained);
        const nextC = correct + 1;
        setCorrect(nextC);
        const nextLvl = nextC % 5 === 0 ? level + 1 : level;
        setLevel(nextLvl);
        onTriggerFeedback?.('score', `+${gained}`);
        AudioManager.correct();
        setRound(buildComparisonRound(nextLvl));
      } else {
        AudioManager.wrong();
        setStreak(0);
        onTriggerFeedback?.('error', 'Salah');
        if (lives !== null) {
          const nextL = lives - 1;
          setLives(nextL);
          if (nextL <= 0) {
            onGameOver({
              score,
              accuracy: Math.round((correct / nextAtt) * 100),
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: false,
            });
            return;
          }
        }
        setRound(buildComparisonRound(level));
      }
    },
    [attempts, correct, level, lives, onGameOver, onTriggerFeedback, paused, round.correctSide, score, streak]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') choose('left');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') choose('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, paused]);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 py-4">
      <div className="text-sm font-semibold text-cyan-400">
        {round.kind === 'bigger' ? 'PILIH NILAI YANG LEBIH BESAR' : 'APAKAH KEDUA KODE IDENTIK?'}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="py-10 px-3 rounded-2xl bg-slate-900 border border-slate-800 text-center text-2xl sm:text-3xl font-mono-num font-bold text-slate-100">
          {paused ? '•••' : round.leftText}
        </div>
        <div className="py-10 px-3 rounded-2xl bg-slate-900 border border-slate-800 text-center text-2xl sm:text-3xl font-mono-num font-bold text-slate-100">
          {paused ? '•••' : round.rightText}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        <button
          type="button"
          disabled={paused}
          onClick={() => choose('left')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 font-semibold text-slate-100 cursor-pointer active:scale-95 transition-all"
        >
          {round.kind === 'bigger' ? '← KIRI LEBIH BESAR' : '← SAMA'}
        </button>
        <button
          type="button"
          disabled={paused}
          onClick={() => choose('right')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 font-semibold text-slate-100 cursor-pointer active:scale-95 transition-all"
        >
          {round.kind === 'bigger' ? 'KANAN LEBIH BESAR →' : 'BERBEDA →'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 23. SEQUENCE RUSH
// ============================================================================
type DirKey = 'up' | 'right' | 'down' | 'left';
const DIRS: DirKey[] = ['up', 'right', 'down', 'left'];

export const SequenceRushGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(mode === 'challenge' ? 1 : 3);
  const [seq, setSeq] = useState<DirKey[]>([]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'flash' | 'input'>('flash');
  const [fuse, setFuse] = useState(100);
  const [roundsWon, setRoundsWon] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const startRound = useCallback(
    (lvl: number) => {
      const len = Math.min(9, 3 + Math.floor((lvl + skillLevel) * 0.65));
      const nextSeq = Array.from({ length: len }, () => DIRS[randInt(0, 3)]);
      setSeq(nextSeq);
      setStep(0);
      setPhase('flash');
      setFuse(100);
    },
    [skillLevel]
  );

  useEffect(() => {
    startRound(1);
  }, [startRound]);

  useEffect(() => {
    if (paused || phase !== 'flash' || seq.length === 0) return;
    const flashMs = Math.max(650, 1300 + seq.length * 220 - level * 45);
    const id = window.setTimeout(() => setPhase('input'), flashMs);
    return () => window.clearTimeout(id);
  }, [level, paused, phase, seq]);

  useEffect(() => {
    if (paused || phase !== 'input') return;
    const limitMs = Math.max(2200, 4800 - level * 150 + seq.length * 320);
    const tick = 50;
    const dec = (tick / limitMs) * 100;
    const id = window.setInterval(() => {
      setFuse((f) => {
        if (f - dec <= 0) {
          AudioManager.wrong();
          const nextLives = lives - 1;
          setLives(nextLives);
          setAttempts((a) => a + 1);
          onTriggerFeedback?.('error', 'Waktu Habis!');
          if (nextLives <= 0) {
            onGameOver({
              score,
              accuracy: attempts + 1 > 0 ? Math.round((roundsWon / (attempts + 1)) * 100) : 0,
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: false,
            });
          } else {
            startRound(level);
          }
          return 100;
        }
        return f - dec;
      });
    }, tick);
    return () => window.clearInterval(id);
  }, [attempts, level, lives, onGameOver, onTriggerFeedback, paused, phase, roundsWon, score, seq.length, startRound]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: `Langkah ${step}/${seq.length}`,
    });
  }, [level, lives, mode, onHudUpdate, score, seq.length, step]);

  const inputDir = useCallback(
    (d: DirKey) => {
      if (paused || phase !== 'input') return;
      if (seq[step] === d) {
        AudioManager.sequenceNote(DIRS.indexOf(d) + 2);
        const nextStep = step + 1;
        setStep(nextStep);
        if (nextStep >= seq.length) {
          const gained = seq.length * 30 + Math.round(fuse * 0.5);
          const nextScore = score + gained;
          const nextWon = roundsWon + 1;
          const nextLvl = level + 1;
          setScore(nextScore);
          setRoundsWon(nextWon);
          setAttempts((a) => a + 1);
          setLevel(nextLvl);
          onTriggerFeedback?.('score', `+${gained}`);
          AudioManager.levelUp();
          startRound(nextLvl);
        }
      } else {
        AudioManager.wrong();
        setAttempts((a) => a + 1);
        onTriggerFeedback?.('error', 'Urutan Salah!');
        const nextL = lives - 1;
        setLives(nextL);
        if (nextL <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((roundsWon / (attempts + 1)) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
          });
        } else {
          startRound(level);
        }
      }
    },
    [attempts, fuse, level, lives, onGameOver, onTriggerFeedback, paused, phase, roundsWon, score, seq, startRound, step]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key === 'ArrowUp' || e.key === 'w') inputDir('up');
      if (e.key === 'ArrowRight' || e.key === 'd') inputDir('right');
      if (e.key === 'ArrowDown' || e.key === 's') inputDir('down');
      if (e.key === 'ArrowLeft' || e.key === 'a') inputDir('left');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputDir, paused]);

  const DirIcon = ({ dir }: { dir: DirKey }) => {
    if (dir === 'up') return <ArrowUp className="w-6 h-6" />;
    if (dir === 'right') return <ArrowRight className="w-6 h-6" />;
    if (dir === 'down') return <ArrowDown className="w-6 h-6" />;
    return <ArrowLeft className="w-6 h-6" />;
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 py-4">
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400 transition-[width] duration-75"
          style={{ width: `${phase === 'flash' ? 100 : fuse}%` }}
        />
      </div>

      <div className="text-sm font-medium text-slate-300">
        {phase === 'flash' ? 'Hafalkan urutan arah secepatnya!' : 'Tekan urutan arah sekarang!'}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 min-h-[64px] p-4 rounded-2xl bg-slate-900 border border-slate-800 w-full">
        {seq.map((d, idx) => {
          const visible = !paused && (phase === 'flash' || idx < step);
          return (
            <div
              key={idx}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                idx < step
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : phase === 'flash'
                  ? 'bg-blue-500/20 border-blue-400 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600'
              }`}
            >
              {visible ? <DirIcon dir={d} /> : '?'}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-48">
        <div />
        <button
          type="button"
          disabled={paused || phase === 'flash'}
          onClick={() => inputDir('up')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 flex items-center justify-center text-white cursor-pointer active:scale-95 disabled:opacity-40"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />
        <button
          type="button"
          disabled={paused || phase === 'flash'}
          onClick={() => inputDir('left')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 flex items-center justify-center text-white cursor-pointer active:scale-95 disabled:opacity-40"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          disabled={paused || phase === 'flash'}
          onClick={() => inputDir('down')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 flex items-center justify-center text-white cursor-pointer active:scale-95 disabled:opacity-40"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          type="button"
          disabled={paused || phase === 'flash'}
          onClick={() => inputDir('right')}
          className="h-14 rounded-xl bg-slate-800 hover:bg-blue-600 border border-slate-700 flex items-center justify-center text-white cursor-pointer active:scale-95 disabled:opacity-40"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 24. FOCUS TEST (Visual Search Density Matrix)
// ============================================================================
interface FocusCell {
  shape: ShapeKind;
  color: string;
  isTarget: boolean;
  found: boolean;
}

function buildFocusBoard(level: number, skill: number) {
  const tier = level + Math.floor(skill);
  const cols = tier <= 2 ? 4 : tier <= 5 ? 5 : 6;
  const rows = tier <= 2 ? 3 : 5;
  const total = cols * rows;
  const targetCount = Math.min(6, 2 + Math.floor(level / 2));

  const targetShape = SHAPE_KINDS[randInt(0, SHAPE_KINDS.length - 1)];
  const targetColor = SHAPE_PALETTE[randInt(0, SHAPE_PALETTE.length - 1)];

  const cells: FocusCell[] = [];
  for (let i = 0; i < targetCount; i++) {
    cells.push({ shape: targetShape, color: targetColor, isTarget: true, found: false });
  }
  while (cells.length < total) {
    const sh = SHAPE_KINDS[randInt(0, SHAPE_KINDS.length - 1)];
    const col = SHAPE_PALETTE[randInt(0, SHAPE_PALETTE.length - 1)];
    if (sh === targetShape && col === targetColor) continue;
    cells.push({ shape: sh, color: col, isTarget: false, found: false });
  }
  return {
    cols,
    targetShape,
    targetColor,
    targetCount,
    cells: shuffleArray(cells),
  };
}

export const FocusTestGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 1 : mode === 'time_attack' ? null : 3);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 50 : null);
  const [board, setBoard] = useState(() => buildFocusBoard(1, skillLevel));
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const foundInBoard = board.cells.filter((c) => c.found).length;

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      progressLabel: `${foundInBoard}/${board.targetCount} Target`,
    });
  }, [board.targetCount, foundInBoard, level, lives, mode, onHudUpdate, score, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: attempts > 0 ? Math.round((hits / attempts) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [attempts, hits, level, onGameOver, paused, score, timeLeft]);

  const tapCell = (idx: number) => {
    if (paused) return;
    const cell = board.cells[idx];
    if (cell.found) return;

    const nextAtt = attempts + 1;
    setAttempts(nextAtt);

    if (cell.isTarget) {
      AudioManager.correct();
      const nextHits = hits + 1;
      setHits(nextHits);
      const gained = 35 + level * 10;
      const nextScore = score + gained;
      setScore(nextScore);
      onTriggerFeedback?.('score', `+${gained}`);

      const nextCells = board.cells.map((c, i) => (i === idx ? { ...c, found: true } : c));
      if (nextCells.filter((c) => c.found).length >= board.targetCount) {
        AudioManager.levelUp();
        const nextLvl = level + 1;
        setLevel(nextLvl);
        setBoard(buildFocusBoard(nextLvl, skillLevel));
      } else {
        setBoard({ ...board, cells: nextCells });
      }
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Pengecoh!');
      if (lives !== null) {
        const nextL = lives - 1;
        setLives(nextL);
        if (nextL <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((hits / nextAtt) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
          });
        }
      }
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400">Temukan semua simbol:</span>
        <GeometricShape shape={board.targetShape} color={board.targetColor} size={28} />
        <span className="text-xs font-mono-num font-bold text-cyan-300">
          ({board.targetCount - foundInBoard} tersisa)
        </span>
      </div>

      <div
        className="grid gap-2 w-full"
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            disabled={paused || cell.found}
            onClick={() => tapCell(idx)}
            className={`aspect-square min-h-[46px] rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              cell.found
                ? 'bg-emerald-500/15 border-emerald-500/50 opacity-35 scale-90'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 active:scale-95'
            }`}
          >
            {!paused && (
              <GeometricShape
                shape={cell.shape}
                color={cell.color}
                size={board.cols >= 6 ? 26 : 32}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
