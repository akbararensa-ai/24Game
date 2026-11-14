import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Check } from 'lucide-react';
import { AudioManager } from '../core/audio';
import { GameComponentProps } from '../types/arcade';
import {
  GeometricShape,
  SHAPE_KINDS,
  SHAPE_PALETTE,
  ShapeKind,
  TouchKeypad,
  randInt,
  shuffleArray,
} from './shared';

// ============================================================================
// 1. MEMORY MATCH
// ============================================================================
interface MatchCard {
  uid: number;
  pairId: number;
  shape: ShapeKind;
  color: string;
  hollow: boolean;
  flipped: boolean;
  matched: boolean;
}

export const MemoryMatchGame: React.FC<GameComponentProps> = ({
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
  const [mistakes, setMistakes] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(
    mode === 'time_attack' ? 75 : null
  );
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 5 : null);
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);

  const buildDeck = useCallback((lvl: number) => {
    const pairCount = Math.min(12, 3 + Math.floor((lvl + skillLevel * 0.5) * 0.8));
    const combos: { shape: ShapeKind; color: string; hollow: boolean }[] = [];
    for (const shape of SHAPE_KINDS) {
      for (const color of SHAPE_PALETTE) {
        combos.push({ shape, color, hollow: false });
        combos.push({ shape, color, hollow: true });
      }
    }
    const chosen = shuffleArray(combos).slice(0, pairCount);
    const deck: MatchCard[] = [];
    chosen.forEach((c, idx) => {
      deck.push({ uid: idx * 2, pairId: idx, ...c, flipped: false, matched: false });
      deck.push({ uid: idx * 2 + 1, pairId: idx, ...c, flipped: false, matched: false });
    });
    return shuffleArray(deck);
  }, [skillLevel]);

  useEffect(() => {
    setCards(buildDeck(1));
  }, [buildDeck]);

  const finishGame = useCallback(
    (finalScore: number, lvlReached: number, completed: boolean, totalAtt: number, totalErr: number) => {
      const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      const acc = totalAtt > 0 ? Math.max(0, Math.round(((totalAtt - totalErr) / totalAtt) * 100)) : 100;
      onGameOver({
        score: finalScore,
        accuracy: acc,
        durationSec,
        levelReached: lvlReached,
        completed,
        mistakes: totalErr,
        maxStreak,
      });
    },
    [maxStreak, onGameOver]
  );

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      timeLeftSec: timeLeft,
      lives,
      maxLives: mode === 'challenge' ? 5 : undefined,
      streak,
      progressLabel: `${cards.filter((c) => c.matched).length / 2}/${cards.length / 2} Pasang`,
    });
  }, [cards, level, lives, mode, onHudUpdate, score, streak, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      finishGame(score, level, false, attempts, mistakes);
      return;
    }
    const id = window.setInterval(() => {
      setTimeLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [attempts, finishGame, level, mistakes, paused, score, timeLeft]);

  const handleCardTap = (uid: number) => {
    if (paused || locked) return;
    const target = cards.find((c) => c.uid === uid);
    if (!target || target.flipped || target.matched) return;

    AudioManager.flip();
    const updated = cards.map((c) => (c.uid === uid ? { ...c, flipped: true } : c));
    setCards(updated);
    const nextSel = [...selectedIds, uid];
    setSelectedIds(nextSel);

    if (nextSel.length === 2) {
      setLocked(true);
      setAttempts((a) => a + 1);
      const [firstId, secondId] = nextSel;
      const c1 = updated.find((c) => c.uid === firstId)!;
      const c2 = updated.find((c) => c.uid === secondId)!;

      if (c1.pairId === c2.pairId) {
        const nextStreak = streak + 1;
        const gained = 60 + nextStreak * 15 + level * 10;
        const nextScore = score + gained;
        setStreak(nextStreak);
        setMaxStreak((m) => Math.max(m, nextStreak));
        setScore(nextScore);
        onTriggerFeedback?.('score', `+${gained}`);
        if (nextStreak >= 2) AudioManager.combo(nextStreak);
        else AudioManager.correct();

        window.setTimeout(() => {
          setCards((prev) => {
            const matchedDeck = prev.map((c) =>
              c.uid === firstId || c.uid === secondId ? { ...c, matched: true } : c
            );
            const allDone = matchedDeck.every((c) => c.matched);
            if (allDone) {
              if (mode === 'classic' && level >= 5) {
                finishGame(nextScore + 250, level, true, attempts + 1, mistakes);
              } else {
                AudioManager.levelUp();
                const nextLvl = level + 1;
                setLevel(nextLvl);
                if (mode === 'time_attack') {
                  setTimeLeft((t) => (t !== null ? t + 12 : null));
                }
                setTimeout(() => setCards(buildDeck(nextLvl)), 250);
              }
            }
            return matchedDeck;
          });
          setSelectedIds([]);
          setLocked(false);
        }, 280);
      } else {
        AudioManager.wrong();
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setStreak(0);
        onTriggerFeedback?.('error', 'Salah');
        window.setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.uid === firstId || c.uid === secondId ? { ...c, flipped: false } : c
            )
          );
          setSelectedIds([]);
          setLocked(false);
          if (lives !== null) {
            const nextLives = lives - 1;
            setLives(nextLives);
            if (nextLives <= 0) {
              finishGame(score, level, false, attempts + 1, nextMistakes);
            }
          }
        }, 620);
      }
    }
  };

  const colsClass =
    cards.length <= 6
      ? 'grid-cols-3'
      : cards.length <= 12
      ? 'grid-cols-4'
      : cards.length <= 16
      ? 'grid-cols-4'
      : 'grid-cols-4 sm:grid-cols-5';

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-4">
      <div className="text-xs text-slate-400 tabular-nums">
        Kesalahan: <span className="text-slate-200 font-semibold">{mistakes}</span>
        <span className="mx-2">·</span>
        Kombo: <span className="text-cyan-400 font-semibold">{streak}x</span>
      </div>
      <div className={`grid ${colsClass} gap-2.5 sm:gap-3 w-full`}>
        {cards.map((card) => {
          const revealed = card.flipped || card.matched;
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleCardTap(card.uid)}
              disabled={revealed || paused}
              className={`aspect-square min-h-[58px] rounded-xl border flex items-center justify-center transition-all duration-150 cursor-pointer ${
                card.matched
                  ? 'bg-emerald-500/10 border-emerald-500/40 scale-95 opacity-70'
                  : revealed
                  ? 'bg-slate-800 border-blue-400/60 shadow-lg'
                  : 'bg-slate-900/90 border-slate-700/70 hover:border-blue-500/50 hover:bg-slate-800/80 active:scale-95'
              }`}
            >
              {revealed ? (
                <GeometricShape
                  shape={card.shape}
                  color={card.color}
                  hollow={card.hollow}
                  size={36}
                />
              ) : (
                <div className="w-3 h-3 rounded-sm bg-slate-700/70 rotate-45" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 2. NUMBER MEMORY
// ============================================================================
export const NumberMemoryGame: React.FC<GameComponentProps> = ({
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
  const maxLives = mode === 'challenge' ? 1 : 3;
  const [phase, setPhase] = useState<'show' | 'input' | 'feedback'>('show');
  const [targetNum, setTargetNum] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [showProgress, setShowProgress] = useState(100);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [lastWasCorrect, setLastWasCorrect] = useState(false);

  const generateRound = useCallback(
    (lvl: number) => {
      const len = Math.max(3, 2 + lvl + Math.floor(skillLevel * 0.5));
      let str = String(randInt(1, 9));
      for (let i = 1; i < len; i++) {
        str += String(randInt(0, 9));
      }
      setTargetNum(str);
      setInputVal('');
      setPhase('show');
      setShowProgress(100);
    },
    [skillLevel]
  );

  useEffect(() => {
    generateRound(1);
  }, [generateRound]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives,
      progressLabel: `${targetNum.length} Digit`,
    });
  }, [level, lives, maxLives, onHudUpdate, score, targetNum.length]);

  useEffect(() => {
    if (paused || phase !== 'show') return;
    const durationMs = Math.min(5500, 1400 + targetNum.length * 420);
    const stepMs = 50;
    const decrement = (stepMs / durationMs) * 100;
    const id = window.setInterval(() => {
      setShowProgress((p) => {
        if (p - decrement <= 0) {
          window.clearInterval(id);
          setPhase('input');
          return 0;
        }
        return p - decrement;
      });
    }, stepMs);
    return () => window.clearInterval(id);
  }, [paused, phase, targetNum]);

  const handleSubmit = useCallback(() => {
    if (phase !== 'input' || inputVal.length === 0) return;
    const nextTotal = totalRounds + 1;
    setTotalRounds(nextTotal);
    const isOk = inputVal.trim() === targetNum;
    setLastWasCorrect(isOk);
    setPhase('feedback');

    if (isOk) {
      AudioManager.correct();
      const gained = targetNum.length * 45 + level * 20;
      const nextScore = score + gained;
      setScore(nextScore);
      setCorrectRounds((c) => c + 1);
      onTriggerFeedback?.('score', `+${gained}`);

      window.setTimeout(() => {
        if (mode === 'classic' && level >= 8) {
          onGameOver({
            score: nextScore + 200,
            accuracy: Math.round(((correctRounds + 1) / nextTotal) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: true,
          });
        } else {
          const nextLvl = level + 1;
          setLevel(nextLvl);
          generateRound(nextLvl);
        }
      }, 900);
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Keliru');
      const nextLives = lives - 1;
      setLives(nextLives);
      window.setTimeout(() => {
        if (nextLives <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((correctRounds / nextTotal) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
            mistakes: nextTotal - correctRounds,
          });
        } else {
          generateRound(level);
        }
      }, 1500);
    }
  }, [correctRounds, generateRound, inputVal, level, lives, mode, onGameOver, onTriggerFeedback, phase, score, targetNum, totalRounds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || phase !== 'input') return;
      if (/^[0-9]$/.test(e.key)) {
        setInputVal((v) => (v.length < 18 ? v + e.key : v));
      } else if (e.key === 'Backspace') {
        setInputVal((v) => v.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, paused, phase]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
      {phase === 'show' && (
        <div className="w-full text-center space-y-5 py-6">
          <div className="text-sm text-slate-400">Hafalkan deret angka berikut</div>
          <div className="text-4xl sm:text-5xl font-mono-num font-bold tracking-wider text-slate-100 break-all px-2">
            {paused ? '••••••' : targetNum}
          </div>
          <div className="w-full max-w-xs mx-auto h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width] duration-75"
              style={{ width: `${showProgress}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'input' && (
        <div className="w-full space-y-4">
          <div className="text-center text-sm text-slate-400">Masukkan angka yang kamu ingat</div>
          <div className="h-14 px-4 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl sm:text-3xl font-mono-num font-bold tracking-widest text-cyan-300">
            {inputVal || <span className="text-slate-600">_</span>}
          </div>
          <TouchKeypad
            value={inputVal}
            onChange={setInputVal}
            onSubmit={handleSubmit}
            submitLabel="Periksa Angka"
          />
        </div>
      )}

      {phase === 'feedback' && (
        <div className="w-full text-center space-y-4 py-4">
          <div className={`text-lg font-bold ${lastWasCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
            {lastWasCorrect ? 'Tepat Sekali!' : 'Kurang Tepat'}
          </div>
          <div className="space-y-1 text-sm">
            <div className="text-slate-400">Target:</div>
            <div className="text-2xl font-mono-num font-bold text-slate-100 tracking-wider">{targetNum}</div>
            {!lastWasCorrect && (
              <>
                <div className="text-slate-400 pt-2">Jawabanmu:</div>
                <div className="text-xl font-mono-num font-bold tracking-wider flex justify-center flex-wrap gap-0.5">
                  {inputVal.split('').map((ch, idx) => (
                    <span
                      key={idx}
                      className={ch === targetNum[idx] ? 'text-emerald-400' : 'text-rose-400 underline'}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. SEQUENCE MEMORY (Simon Matrix)
// ============================================================================
export const SequenceMemoryGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const gridSize = skillLevel >= 4 ? 4 : 3;
  const tileCount = gridSize * gridSize;

  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(mode === 'challenge' ? 1 : 3);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userIndex, setUserIndex] = useState(0);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [isPlayingSeq, setIsPlayingSeq] = useState(true);
  const [mistakes, setMistakes] = useState(0);
  const [hits, setHits] = useState(0);

  const playSequence = useCallback(
    async (seq: number[], lvl: number) => {
      setIsPlayingSeq(true);
      const stepDelay = Math.max(220, 520 - lvl * 22 - skillLevel * 20);
      await new Promise((r) => setTimeout(r, 380));
      for (let i = 0; i < seq.length; i++) {
        const tile = seq[i];
        setActiveTile(tile);
        AudioManager.sequenceNote(tile);
        await new Promise((r) => setTimeout(r, stepDelay * 0.65));
        setActiveTile(null);
        await new Promise((r) => setTimeout(r, stepDelay * 0.35));
      }
      setUserIndex(0);
      setIsPlayingSeq(false);
    },
    [skillLevel]
  );

  useEffect(() => {
    const initial = [randInt(0, tileCount - 1), randInt(0, tileCount - 1)];
    setSequence(initial);
    playSequence(initial, 1);
  }, [playSequence, tileCount]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: `Urutan ${userIndex}/${sequence.length}`,
    });
  }, [level, lives, mode, onHudUpdate, score, sequence.length, userIndex]);

  const handleTap = (idx: number) => {
    if (paused || isPlayingSeq) return;
    setActiveTile(idx);
    window.setTimeout(() => setActiveTile((cur) => (cur === idx ? null : cur)), 170);

    if (sequence[userIndex] === idx) {
      AudioManager.sequenceNote(idx);
      const nextHits = hits + 1;
      setHits(nextHits);
      const nextIdx = userIndex + 1;
      setUserIndex(nextIdx);

      if (nextIdx >= sequence.length) {
        const gained = sequence.length * 40 + level * 15;
        const nextScore = score + gained;
        setScore(nextScore);
        onTriggerFeedback?.('score', `+${gained}`);

        if (mode === 'classic' && level >= 10) {
          onGameOver({
            score: nextScore + 300,
            accuracy: Math.round((nextHits / (nextHits + mistakes)) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: true,
          });
          return;
        }
        const nextLvl = level + 1;
        setLevel(nextLvl);
        const nextSeq = [...sequence, randInt(0, tileCount - 1)];
        setSequence(nextSeq);
        playSequence(nextSeq, nextLvl);
      }
    } else {
      AudioManager.wrong();
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      onTriggerFeedback?.('error', 'Urutan Salah');
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        const total = hits + nextMistakes;
        onGameOver({
          score,
          accuracy: total > 0 ? Math.round((hits / total) * 100) : 0,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
          mistakes: nextMistakes,
        });
      } else {
        playSequence(sequence, level);
      }
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-5">
      <div className="text-sm font-medium text-slate-300">
        {isPlayingSeq ? 'Perhatikan urutan cahaya...' : 'Ulangi urutan sekarang!'}
      </div>
      <div
        className={`grid gap-3 w-full ${
          gridSize === 4 ? 'grid-cols-4' : 'grid-cols-3'
        }`}
      >
        {Array.from({ length: tileCount }).map((_, idx) => {
          const isLit = activeTile === idx;
          return (
            <button
              key={idx}
              type="button"
              disabled={isPlayingSeq || paused}
              onClick={() => handleTap(idx)}
              className={`aspect-square min-h-[68px] rounded-2xl border transition-all duration-100 cursor-pointer ${
                isLit
                  ? 'bg-cyan-400 border-cyan-200 scale-95 shadow-[0_0_24px_rgba(34,211,238,0.55)]'
                  : 'bg-slate-900 border-slate-700/80 hover:border-blue-500/50 active:scale-95'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 4. VISUAL GRID MEMORY
// ============================================================================
export const VisualGridMemoryGame: React.FC<GameComponentProps> = ({
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
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [gridSize, setGridSize] = useState(3);
  const [targets, setTargets] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);

  const setupBoard = useCallback(
    (lvl: number) => {
      const size = lvl <= 2 ? 3 : lvl <= 6 ? 4 : lvl <= 12 ? 5 : 6;
      const count = Math.min(size * size - 2, 3 + Math.floor(lvl * 0.9) + Math.floor(skillLevel * 0.4));
      const all = Array.from({ length: size * size }, (_, i) => i);
      const chosen = shuffleArray(all).slice(0, count);
      setGridSize(size);
      setTargets(chosen);
      setPicked([]);
      setWrongPicks([]);
      setPhase('memorize');
    },
    [skillLevel]
  );

  useEffect(() => {
    setupBoard(1);
  }, [setupBoard]);

  useEffect(() => {
    if (paused || phase !== 'memorize') return;
    const ms = Math.max(950, 1750 - level * 40 + targets.length * 140);
    const id = window.setTimeout(() => setPhase('recall'), ms);
    return () => window.clearTimeout(id);
  }, [level, paused, phase, targets.length]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: `${picked.length}/${targets.length} Sel`,
    });
  }, [level, lives, mode, onHudUpdate, picked.length, score, targets.length]);

  const handleCellTap = (idx: number) => {
    if (paused || phase !== 'recall') return;
    if (picked.includes(idx) || wrongPicks.includes(idx)) return;

    const nextClicks = totalClicks + 1;
    setTotalClicks(nextClicks);

    if (targets.includes(idx)) {
      AudioManager.correct();
      const nextPicked = [...picked, idx];
      setPicked(nextPicked);

      if (nextPicked.length === targets.length) {
        const gained = targets.length * 35 + level * 25;
        const nextScore = score + gained;
        setScore(nextScore);
        onTriggerFeedback?.('score', `+${gained}`);
        AudioManager.levelUp();

        window.setTimeout(() => {
          if (mode === 'classic' && level >= 9) {
            onGameOver({
              score: nextScore + 250,
              accuracy: Math.round(((nextClicks - totalWrong) / nextClicks) * 100),
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: true,
            });
          } else {
            const nextLvl = level + 1;
            setLevel(nextLvl);
            setupBoard(nextLvl);
          }
        }, 420);
      }
    } else {
      AudioManager.wrong();
      const nextWrongTotal = totalWrong + 1;
      setTotalWrong(nextWrongTotal);
      const nextWrongs = [...wrongPicks, idx];
      setWrongPicks(nextWrongs);
      onTriggerFeedback?.('error', 'Salah Sel');

      if (nextWrongs.length >= 3 || mode === 'challenge') {
        const nextLives = lives - 1;
        setLives(nextLives);
        if (nextLives <= 0) {
          onGameOver({
            score,
            accuracy: Math.max(0, Math.round(((nextClicks - nextWrongTotal) / nextClicks) * 100)),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
            mistakes: nextWrongTotal,
          });
        } else {
          window.setTimeout(() => setupBoard(level), 600);
        }
      }
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
      <div className="text-sm text-slate-300 font-medium">
        {phase === 'memorize'
          ? `Hafalkan ${targets.length} sel yang menyala`
          : `Ketuk ${targets.length - picked.length} sel tersisa`}
      </div>
      <div
        className="grid gap-2 w-full"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
          const isTarget = targets.includes(idx);
          const isFound = picked.includes(idx);
          const isWrong = wrongPicks.includes(idx);
          const showLit = (!paused && phase === 'memorize' && isTarget) || isFound;

          return (
            <button
              key={idx}
              type="button"
              disabled={paused || phase === 'memorize'}
              onClick={() => handleCellTap(idx)}
              className={`aspect-square min-h-[46px] rounded-xl border transition-all duration-150 cursor-pointer ${
                showLit
                  ? 'bg-blue-500 border-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
                  : isWrong
                  ? 'bg-rose-500/30 border-rose-500'
                  : 'bg-slate-900 border-slate-700/80 hover:border-slate-500 active:scale-95'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 5. WORD MEMORY
// ============================================================================
const WORD_BANK = [
  'CAKRAWALA', 'PRISMA', 'ORBIT', 'GRAVITASI', 'KUANTUM', 'SINAPSA', 'MATRIX', 'VEKTOR',
  'KINETIK', 'SPEKTRUM', 'NEBULA', 'FOTON', 'LENSA', 'KOMPAS', 'LABIRIN', 'ALGORITMA',
  'SINTESIS', 'RESONANSI', 'FREKUENSI', 'PARADOKS', 'SIMETRI', 'AKSIOMA', 'LOGIKA', 'POLA',
  'MONOLIT', 'KINETIKA', 'KATALIS', 'ZENITH', 'HORIZON', 'EKLIPS', 'SOLSTIS', 'PULSAR',
  'MODULUS', 'ELIPS', 'HIPOTESIS', 'DEDUKSI', 'INDUKSI', 'TEOREMA', 'INTEGRAL', 'STATIS',
  'DINAMIS', 'IMPULS', 'MOMENTUM', 'ELEKTRON', 'ISOTOP', 'KRISTAL', 'DIAMOND', 'TITANIUM',
  'KARBON', 'SILIKON', 'OSILASI', 'AMPLITUDO', 'HARMONI', 'MELODI', 'RITME', 'TEMPO',
  'STRATEGI', 'TAKTIK', 'ARENA', 'PIONIR', 'VORTEX', 'RADIAN', 'POLIGON', 'OKTAGON',
  'HEKSAGON', 'FRACTAL', 'SPIRAL', 'TANGEN', 'KOORDINAT', 'ABSIS', 'ORDINAT', 'GRADIEN',
  'KAPASITAS', 'ENERGI', 'TURBIN', 'DINAMO', 'MAGNET', 'MEDAN', 'FLUKTUASI', 'ENTROPI',
  'KODON', 'GENOM', 'NEURON', 'KORTEX', 'REFLEKS', 'FOKUS', 'MEMORI', 'ATMOSFER',
  'STRATOSFER', 'SAMUDRA', 'PALUNG', 'GLASIER', 'GURUN', 'KANYON', 'KILAT', 'GUNTUR',
];

export const WordMemoryGame: React.FC<GameComponentProps> = ({
  mode,
  paused,
  onHudUpdate,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const [seenWords, setSeenWords] = useState<Set<string>>(() => new Set());
  const [currentWord, setCurrentWord] = useState('');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(mode === 'challenge' ? 1 : 3);
  const [turn, setTurn] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 60 : null);

  const pickNextWord = useCallback((seen: Set<string>, lastWord: string) => {
    const seenList = Array.from(seen).filter((w) => w !== lastWord);
    const unseenList = WORD_BANK.filter((w) => !seen.has(w));
    const shouldShowSeen = seenList.length > 0 && (unseenList.length === 0 || Math.random() < 0.45);
    if (shouldShowSeen) {
      return seenList[randInt(0, seenList.length - 1)];
    }
    return unseenList[randInt(0, unseenList.length - 1)];
  }, []);

  useEffect(() => {
    setCurrentWord(WORD_BANK[randInt(0, WORD_BANK.length - 1)]);
  }, []);

  useEffect(() => {
    onHudUpdate({
      score,
      level: Math.max(1, Math.floor(turn / 5) + 1),
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      streak,
      progressLabel: `${seenWords.size} Kata Terlihat`,
    });
  }, [lives, mode, onHudUpdate, score, seenWords.size, streak, timeLeft, turn]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: turn > 1 ? Math.round((correctCount / (turn - 1)) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: Math.max(1, Math.floor(turn / 5) + 1),
        completed: true,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [correctCount, onGameOver, paused, score, timeLeft, turn]);

  const answer = useCallback(
    (choice: 'seen' | 'new') => {
      if (paused || !currentWord) return;
      const actuallySeen = seenWords.has(currentWord);
      const isRight = (choice === 'seen') === actuallySeen;

      const nextSeen = new Set(seenWords);
      nextSeen.add(currentWord);
      setSeenWords(nextSeen);

      if (isRight) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        const gained = 30 + Math.min(50, nextStreak * 5);
        setScore((s) => s + gained);
        setCorrectCount((c) => c + 1);
        onTriggerFeedback?.('score', `+${gained}`);
        if (nextStreak >= 3) AudioManager.combo(nextStreak);
        else AudioManager.correct();
      } else {
        AudioManager.wrong();
        setStreak(0);
        onTriggerFeedback?.('error', actuallySeen ? 'Sudah Pernah!' : 'Kata Baru!');
        const nextLives = lives - 1;
        setLives(nextLives);
        if (nextLives <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((correctCount / turn) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: Math.max(1, Math.floor(turn / 5) + 1),
            completed: false,
            mistakes: turn - correctCount,
          });
          return;
        }
      }

      setTurn((t) => t + 1);
      setCurrentWord(pickNextWord(nextSeen, currentWord));
    },
    [correctCount, currentWord, lives, onGameOver, onTriggerFeedback, paused, pickNextWord, score, seenWords, streak, turn]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key === 'ArrowLeft') answer('seen');
      if (e.key === 'ArrowRight') answer('new');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, paused]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-8 py-4">
      <div className="text-xs text-slate-400">
        Apakah kata ini sudah pernah muncul di sesi ini?
      </div>
      <div className="w-full py-10 px-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
        <div className="text-3xl sm:text-4xl font-display font-bold tracking-wide text-slate-100">
          {paused ? '••••••' : currentWord}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full">
        <button
          type="button"
          onClick={() => answer('seen')}
          disabled={paused}
          className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>PERNAH</span>
        </button>
        <button
          type="button"
          onClick={() => answer('new')}
          disabled={paused}
          className="h-14 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>BARU</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 6. SPATIAL MEMORY
// ============================================================================
interface SpatialItem {
  cell: number;
  shape: ShapeKind;
  color: string;
}

export const SpatialMemoryGame: React.FC<GameComponentProps> = ({
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
  const [gridSize, setGridSize] = useState(4);
  const [items, setItems] = useState<SpatialItem[]>([]);
  const [targetItem, setTargetItem] = useState<SpatialItem | null>(null);
  const [phase, setPhase] = useState<'observe' | 'locate'>('observe');
  const [decoyItems, setDecoyItems] = useState<SpatialItem[]>([]);
  const [roundsDone, setRoundsDone] = useState(0);
  const [roundsOk, setRoundsOk] = useState(0);

  const setupRound = useCallback(
    (lvl: number) => {
      const size = lvl >= 6 ? 5 : 4;
      const objCount = Math.min(8, 2 + Math.floor((lvl + skillLevel * 0.6) * 0.7));
      const cells = shuffleArray(Array.from({ length: size * size }, (_, i) => i)).slice(0, objCount);
      const shapes = shuffleArray(SHAPE_KINDS).slice(0, objCount);
      const created: SpatialItem[] = cells.map((cell, idx) => ({
        cell,
        shape: shapes[idx],
        color: SHAPE_PALETTE[idx % SHAPE_PALETTE.length],
      }));
      setGridSize(size);
      setItems(created);
      setTargetItem(created[0]);
      setDecoyItems([]);
      setPhase('observe');
    },
    [skillLevel]
  );

  useEffect(() => {
    setupRound(1);
  }, [setupRound]);

  useEffect(() => {
    if (paused || phase !== 'observe' || items.length === 0) return;
    const ms = Math.max(1200, 2400 - level * 60 + items.length * 160);
    const id = window.setTimeout(() => {
      // Shift other objects as spatial distractors in higher levels
      const usedCells = new Set<number>();
      const shifted: SpatialItem[] = [];
      for (let i = 1; i < items.length; i++) {
        let newCell = randInt(0, gridSize * gridSize - 1);
        while (usedCells.has(newCell) || newCell === items[0].cell) {
          newCell = randInt(0, gridSize * gridSize - 1);
        }
        usedCells.add(newCell);
        shifted.push({ ...items[i], cell: newCell });
      }
      setDecoyItems(shifted);
      setPhase('locate');
    }, ms);
    return () => window.clearTimeout(id);
  }, [gridSize, items, level, paused, phase]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: phase === 'observe' ? 'Fase Hafal' : 'Cari Posisi Asal',
    });
  }, [level, lives, mode, onHudUpdate, phase, score]);

  const handleTap = (cellIdx: number) => {
    if (paused || phase !== 'locate' || !targetItem) return;
    const nextTotal = roundsDone + 1;
    setRoundsDone(nextTotal);

    if (cellIdx === targetItem.cell) {
      AudioManager.correct();
      const gained = items.length * 40 + level * 25;
      const nextScore = score + gained;
      setScore(nextScore);
      setRoundsOk((r) => r + 1);
      onTriggerFeedback?.('score', `+${gained}`);

      if (mode === 'classic' && level >= 8) {
        onGameOver({
          score: nextScore + 250,
          accuracy: Math.round(((roundsOk + 1) / nextTotal) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: true,
        });
        return;
      }
      const nextLvl = level + 1;
      setLevel(nextLvl);
      setupRound(nextLvl);
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Posisi Salah');
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        onGameOver({
          score,
          accuracy: Math.round((roundsOk / nextTotal) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
          mistakes: nextTotal - roundsOk,
        });
      } else {
        setupRound(level);
      }
    }
  };

  const renderedMap = useMemo(() => {
    const map = new Map<number, SpatialItem>();
    const list = phase === 'observe' ? items : decoyItems;
    for (const it of list) map.set(it.cell, it);
    return map;
  }, [decoyItems, items, phase]);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 text-sm text-slate-200 min-h-[40px]">
        {phase === 'observe' ? (
          <span>Hafalkan posisi tiap simbol di bawah ini...</span>
        ) : (
          targetItem && (
            <>
              <span>Klik posisi ASAL dari:</span>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 border border-slate-600">
                <GeometricShape shape={targetItem.shape} color={targetItem.color} size={24} />
              </span>
            </>
          )
        )}
      </div>

      <div
        className="grid gap-2 w-full"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
          const item = paused ? undefined : renderedMap.get(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={paused || phase === 'observe'}
              onClick={() => handleTap(idx)}
              className={`aspect-square min-h-[54px] rounded-xl border flex items-center justify-center transition-all duration-150 ${
                phase === 'locate'
                  ? 'bg-slate-900 border-slate-700 hover:border-blue-400 active:scale-95 cursor-pointer'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              {item ? (
                <GeometricShape shape={item.shape} color={item.color} size={30} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
