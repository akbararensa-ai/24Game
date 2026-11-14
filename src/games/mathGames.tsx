import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import { AudioManager } from '../core/audio';
import { GameComponentProps } from '../types/arcade';
import { TouchKeypad, randInt, shuffleArray } from './shared';

// ============================================================================
// 7. MENTAL MATH
// ============================================================================
interface MathQuestion {
  prompt: string;
  answer: number;
}

function generateMentalMath(level: number, skill: number): MathQuestion {
  const tier = level + Math.floor(skill * 1.5);
  const ops = tier <= 2 ? ['+', '-'] : tier <= 5 ? ['+', '-', '×', '÷'] : ['+', '-', '×', '÷', 'mix'];
  const op = ops[randInt(0, ops.length - 1)];

  if (op === '+') {
    const max = Math.min(450, 18 + tier * 14);
    const a = randInt(5, max);
    const b = randInt(4, max);
    return { prompt: `${a} + ${b}`, answer: a + b };
  }
  if (op === '-') {
    const max = Math.min(450, 20 + tier * 14);
    const a = randInt(12, max);
    const b = randInt(3, a - 1);
    return { prompt: `${a} − ${b}`, answer: a - b };
  }
  if (op === '×') {
    const maxA = Math.min(28, 7 + Math.floor(tier * 1.4));
    const maxB = Math.min(18, 6 + Math.floor(tier * 1.1));
    const a = randInt(3, maxA);
    const b = randInt(3, maxB);
    return { prompt: `${a} × ${b}`, answer: a * b };
  }
  if (op === '÷') {
    const b = randInt(3, Math.min(16, 6 + tier));
    const ans = randInt(3, Math.min(25, 8 + tier * 2));
    return { prompt: `${b * ans} ÷ ${b}`, answer: ans };
  }
  // mix
  const a = randInt(3, 12 + Math.floor(tier * 0.8));
  const b = randInt(3, 10 + Math.floor(tier * 0.6));
  const c = randInt(4, 25 + tier * 2);
  if (Math.random() < 0.5) {
    return { prompt: `(${a} × ${b}) + ${c}`, answer: a * b + c };
  }
  return { prompt: `(${a} + ${b}) × ${randInt(2, 7)}`, answer: (a + b) * 1 }; // rebuilt cleanly below
}

function buildMentalMathQuestion(level: number, skill: number): MathQuestion {
  const q = generateMentalMath(level, skill);
  if (q.prompt.includes(') ×')) {
    const a = randInt(4, 14 + level);
    const b = randInt(3, 12 + level);
    const c = randInt(2, 8);
    return { prompt: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
  }
  return q;
}

export const MentalMathGame: React.FC<GameComponentProps> = ({
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
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 1 : mode === 'time_attack' ? null : 3);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 60 : null);
  const [question, setQuestion] = useState<MathQuestion>(() => buildMentalMathQuestion(1, skillLevel));
  const [inputVal, setInputVal] = useState('');
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      streak,
      progressLabel: mode === 'classic' ? `Soal ${answered}/15` : `Terjawab ${correctCount}`,
    });
  }, [answered, correctCount, level, lives, mode, onHudUpdate, score, streak, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: answered > 0 ? Math.round((correctCount / answered) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
        maxStreak,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [answered, correctCount, level, maxStreak, onGameOver, paused, score, timeLeft]);

  const handleSubmit = useCallback(() => {
    if (paused || inputVal === '' || inputVal === '-') return;
    const num = Number(inputVal);
    const nextAnswered = answered + 1;
    setAnswered(nextAnswered);

    if (num === question.answer) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setMaxStreak((m) => Math.max(m, nextStreak));
      const gained = 40 + level * 10 + Math.min(60, nextStreak * 8);
      const nextScore = score + gained;
      const nextCorrect = correctCount + 1;
      setScore(nextScore);
      setCorrectCount(nextCorrect);
      onTriggerFeedback?.('score', `+${gained}`);
      if (nextStreak >= 3) AudioManager.combo(nextStreak);
      else AudioManager.correct();

      const nextLvl = nextCorrect % 3 === 0 ? level + 1 : level;
      setLevel(nextLvl);

      if (mode === 'classic' && nextAnswered >= 15) {
        onGameOver({
          score: nextScore + 180,
          accuracy: Math.round((nextCorrect / nextAnswered) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: nextLvl,
          completed: true,
          maxStreak: Math.max(maxStreak, nextStreak),
        });
        return;
      }
      setQuestion(buildMentalMathQuestion(nextLvl, skillLevel));
      setInputVal('');
    } else {
      AudioManager.wrong();
      setStreak(0);
      onTriggerFeedback?.('error', `Jawaban: ${question.answer}`);
      if (lives !== null) {
        const nextLives = lives - 1;
        setLives(nextLives);
        if (nextLives <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((correctCount / nextAnswered) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
            mistakes: nextAnswered - correctCount,
            maxStreak,
          });
          return;
        }
      }
      setQuestion(buildMentalMathQuestion(level, skillLevel));
      setInputVal('');
    }
  }, [answered, correctCount, inputVal, level, lives, maxStreak, mode, onGameOver, onTriggerFeedback, paused, question.answer, score, skillLevel, streak]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (/^[0-9]$/.test(e.key)) setInputVal((v) => (v.length < 10 ? v + e.key : v));
      else if (e.key === '-') setInputVal((v) => (v.startsWith('-') ? v.slice(1) : '-' + v));
      else if (e.key === 'Backspace') setInputVal((v) => v.slice(0, -1));
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, paused]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="w-full py-7 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
        <div className="text-3xl sm:text-4xl font-mono-num font-bold text-slate-100">
          {paused ? '? ? ?' : `${question.prompt} = ?`}
        </div>
        <div className="h-11 max-w-[200px] mx-auto rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-center text-2xl font-mono-num font-bold text-cyan-300">
          {inputVal || <span className="text-slate-600">_</span>}
        </div>
      </div>

      <TouchKeypad
        value={inputVal}
        onChange={setInputVal}
        onSubmit={handleSubmit}
        allowNegative
        disabled={paused}
      />
    </div>
  );
};

// ============================================================================
// 8. MATH RUSH
// ============================================================================
interface RushRound {
  prompt: string;
  answer: number;
  options: number[];
}

function buildRushRound(level: number, skill: number): RushRound {
  const q = buildMentalMathQuestion(level, skill);
  const opts = new Set<number>([q.answer]);
  while (opts.size < 4) {
    const delta = randInt(-12, 12);
    if (delta !== 0) {
      const cand = q.answer + delta;
      if (cand >= 0 || q.answer < 0) opts.add(cand);
    }
  }
  return { ...q, options: shuffleArray(Array.from(opts)) };
}

export const MathRushGame: React.FC<GameComponentProps> = ({
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
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lives, setLives] = useState(mode === 'challenge' ? 1 : 3);
  const [round, setRound] = useState<RushRound>(() => buildRushRound(1, skillLevel));
  const [fusePct, setFusePct] = useState(100);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);

  const fuseDurationMs = Math.max(1900, 5200 - level * 260 - skillLevel * 220);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      streak,
      progressLabel: `Kecepatan ${(fuseDurationMs / 1000).toFixed(1)}s`,
    });
  }, [fuseDurationMs, level, lives, mode, onHudUpdate, score, streak]);

  const advanceOrEnd = useCallback(
    (wasCorrect: boolean, nextCorrect: number, nextAnswered: number, nextScore: number, nextLvl: number, nextLives: number) => {
      if (nextLives <= 0) {
        onGameOver({
          score: nextScore,
          accuracy: nextAnswered > 0 ? Math.round((nextCorrect / nextAnswered) * 100) : 0,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: nextLvl,
          completed: false,
          mistakes: nextAnswered - nextCorrect,
          maxStreak,
        });
        return;
      }
      if (mode === 'time_attack' && nextAnswered >= 25) {
        onGameOver({
          score: nextScore + 200,
          accuracy: Math.round((nextCorrect / nextAnswered) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: nextLvl,
          completed: true,
          maxStreak,
        });
        return;
      }
      setRound(buildRushRound(nextLvl, skillLevel));
      setFusePct(100);
    },
    [maxStreak, mode, onGameOver, skillLevel]
  );

  useEffect(() => {
    if (paused) return;
    const stepMs = 40;
    const dec = (stepMs / fuseDurationMs) * 100;
    const id = window.setInterval(() => {
      setFusePct((p) => {
        if (p - dec <= 0) {
          AudioManager.wrong();
          setStreak(0);
          const nextAns = answered + 1;
          const nextLives = lives - 1;
          setAnswered(nextAns);
          setLives(nextLives);
          onTriggerFeedback?.('error', 'Waktu Habis');
          advanceOrEnd(false, correct, nextAns, score, level, nextLives);
          return 100;
        }
        return p - dec;
      });
    }, stepMs);
    return () => window.clearInterval(id);
  }, [advanceOrEnd, answered, correct, fuseDurationMs, level, lives, onTriggerFeedback, paused, score]);

  const pickOption = useCallback(
    (opt: number) => {
      if (paused) return;
      const nextAns = answered + 1;
      setAnswered(nextAns);
      if (opt === round.answer) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setMaxStreak((m) => Math.max(m, nextStreak));
        const speedBonus = Math.round(fusePct * 0.4);
        const gained = 35 + speedBonus + level * 8;
        const nextScore = score + gained;
        const nextCorrect = correct + 1;
        const nextLvl = nextCorrect % 4 === 0 ? level + 1 : level;
        setScore(nextScore);
        setCorrect(nextCorrect);
        setLevel(nextLvl);
        onTriggerFeedback?.('score', `+${gained}`);
        if (nextStreak >= 3) AudioManager.combo(nextStreak);
        else AudioManager.correct();
        advanceOrEnd(true, nextCorrect, nextAns, nextScore, nextLvl, lives);
      } else {
        AudioManager.wrong();
        setStreak(0);
        const nextLives = lives - 1;
        setLives(nextLives);
        onTriggerFeedback?.('error', 'Salah');
        advanceOrEnd(false, correct, nextAns, score, level, nextLives);
      }
    },
    [advanceOrEnd, answered, correct, fusePct, level, lives, onTriggerFeedback, paused, round.answer, score, streak]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0 && round.options[idx] !== undefined) {
        pickOption(round.options[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, pickOption, round.options]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 py-4">
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-[width] duration-75 ${
            fusePct > 45 ? 'bg-cyan-400' : fusePct > 20 ? 'bg-amber-400' : 'bg-rose-500'
          }`}
          style={{ width: `${fusePct}%` }}
        />
      </div>

      <div className="w-full py-10 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
        <div className="text-4xl sm:text-5xl font-mono-num font-bold text-slate-100">
          {paused ? '? ? ?' : round.prompt}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {round.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={paused}
            onClick={() => pickOption(opt)}
            className="h-16 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 text-2xl font-mono-num font-bold text-slate-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center relative"
          >
            <span className="absolute left-3 top-2 text-[11px] text-slate-500 font-normal">{idx + 1}</span>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 9. MISSING NUMBER
// ============================================================================
function buildMissingNumber(level: number, skill: number): MathQuestion {
  const tier = level + Math.floor(skill * 1.4);
  const type = tier <= 2 ? randInt(0, 1) : randInt(0, 3);
  if (type === 0) {
    const a = randInt(6, 20 + tier * 8);
    const ans = randInt(4, 18 + tier * 7);
    return Math.random() < 0.5
      ? { prompt: `${a} + ? = ${a + ans}`, answer: ans }
      : { prompt: `? + ${a} = ${a + ans}`, answer: ans };
  }
  if (type === 1) {
    const ans = randInt(5, 25 + tier * 6);
    const b = randInt(3, 18 + tier * 4);
    return { prompt: `${ans + b} − ? = ${b}`, answer: ans };
  }
  if (type === 2) {
    const a = randInt(3, 14 + Math.floor(tier * 0.8));
    const ans = randInt(3, 15 + Math.floor(tier * 0.8));
    return { prompt: `${a} × ? = ${a * ans}`, answer: ans };
  }
  const a = randInt(3, 12);
  const ans = randInt(2, 12 + tier);
  const mult = randInt(2, 6);
  return { prompt: `(${a} + ?) × ${mult} = ${(a + ans) * mult}`, answer: ans };
}

export const MissingNumberGame: React.FC<GameComponentProps> = ({
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
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 60 : null);
  const [question, setQuestion] = useState<MathQuestion>(() => buildMissingNumber(1, skillLevel));
  const [inputVal, setInputVal] = useState('');
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      progressLabel: mode === 'classic' ? `Soal ${answered}/12` : `Terpecahkan ${correct}`,
    });
  }, [answered, correct, level, lives, mode, onHudUpdate, score, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: true,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [answered, correct, level, onGameOver, paused, score, timeLeft]);

  const handleSubmit = useCallback(() => {
    if (paused || inputVal === '' || inputVal === '-') return;
    const nextAns = answered + 1;
    setAnswered(nextAns);

    if (Number(inputVal) === question.answer) {
      AudioManager.correct();
      const gained = 50 + level * 15;
      const nextScore = score + gained;
      const nextCorrect = correct + 1;
      const nextLvl = nextCorrect % 3 === 0 ? level + 1 : level;
      setScore(nextScore);
      setCorrect(nextCorrect);
      setLevel(nextLvl);
      onTriggerFeedback?.('score', `+${gained}`);

      if (mode === 'classic' && nextAns >= 12) {
        onGameOver({
          score: nextScore + 180,
          accuracy: Math.round((nextCorrect / nextAns) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: nextLvl,
          completed: true,
        });
        return;
      }
      setQuestion(buildMissingNumber(nextLvl, skillLevel));
      setInputVal('');
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', `Nilai ? = ${question.answer}`);
      if (lives !== null) {
        const nextLives = lives - 1;
        setLives(nextLives);
        if (nextLives <= 0) {
          onGameOver({
            score,
            accuracy: Math.round((correct / nextAns) * 100),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
            mistakes: nextAns - correct,
          });
          return;
        }
      }
      setQuestion(buildMissingNumber(level, skillLevel));
      setInputVal('');
    }
  }, [answered, correct, inputVal, level, lives, mode, onGameOver, onTriggerFeedback, paused, question.answer, score, skillLevel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (/^[0-9]$/.test(e.key)) setInputVal((v) => (v.length < 8 ? v + e.key : v));
      else if (e.key === 'Backspace') setInputVal((v) => v.slice(0, -1));
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, paused]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="w-full py-7 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
        <div className="text-xs text-slate-400">Temukan nilai pengganti tanda tanya</div>
        <div className="text-2xl sm:text-3xl font-mono-num font-bold text-slate-100">
          {paused ? '? ? ?' : question.prompt}
        </div>
        <div className="h-11 max-w-[180px] mx-auto rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-2xl font-mono-num font-bold text-cyan-300">
          {inputVal || <span className="text-slate-600">?</span>}
        </div>
      </div>

      <TouchKeypad value={inputVal} onChange={setInputVal} onSubmit={handleSubmit} disabled={paused} />
    </div>
  );
};

// ============================================================================
// 10. EQUATION PUZZLE (Symbolic Systems & Algebra)
// ============================================================================
interface EquationPuzzle {
  lines: string[];
  targetLabel: string;
  answer: number;
}

function buildEquationPuzzle(level: number, skill: number): EquationPuzzle {
  const tier = level + Math.floor(skill);
  if (tier <= 2) {
    const x = randInt(2, 14);
    const coef = randInt(2, 5);
    const offset = randInt(1, 15);
    return {
      lines: [`${coef}x + ${offset} = ${coef * x + offset}`],
      targetLabel: 'x = ?',
      answer: x,
    };
  }
  if (tier <= 5) {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    return {
      lines: [
        `▲ + ▲ = ${a + a}`,
        `▲ × ■ = ${a * b}`,
      ],
      targetLabel: '■ = ?',
      answer: b,
    };
  }
  const a = randInt(2, 10);
  const b = randInt(2, 10);
  const c = randInt(2, 9);
  return {
    lines: [
      `▲ + ▲ + ▲ = ${a * 3}`,
      `▲ + ■ = ${a + b}`,
      `(■ × ●) − ▲ = ${b * c - a}`,
    ],
    targetLabel: '● = ?',
    answer: c,
  };
}

export const EquationPuzzleGame: React.FC<GameComponentProps> = ({
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
  const [puzzle, setPuzzle] = useState<EquationPuzzle>(() => buildEquationPuzzle(1, skillLevel));
  const [inputVal, setInputVal] = useState('');
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: mode === 'classic' ? `Puzzle ${solved}/10` : `Terpecahkan ${solved}`,
    });
  }, [level, lives, mode, onHudUpdate, score, solved]);

  const handleSubmit = useCallback(() => {
    if (paused || !inputVal) return;
    const nextAtt = attempts + 1;
    setAttempts(nextAtt);

    if (Number(inputVal) === puzzle.answer) {
      AudioManager.correct();
      const gained = 65 + level * 20;
      const nextScore = score + gained;
      const nextSolved = solved + 1;
      const nextLvl = level + 1;
      setScore(nextScore);
      setSolved(nextSolved);
      onTriggerFeedback?.('score', `+${gained}`);

      if (mode === 'classic' && nextSolved >= 10) {
        onGameOver({
          score: nextScore + 220,
          accuracy: Math.round((nextSolved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: true,
        });
        return;
      }
      setLevel(nextLvl);
      setPuzzle(buildEquationPuzzle(nextLvl, skillLevel));
      setInputVal('');
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', `Jawaban: ${puzzle.answer}`);
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        onGameOver({
          score,
          accuracy: Math.round((solved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
          mistakes: nextAtt - solved,
        });
        return;
      }
      setPuzzle(buildEquationPuzzle(level, skillLevel));
      setInputVal('');
    }
  }, [attempts, inputVal, level, lives, mode, onGameOver, onTriggerFeedback, paused, puzzle.answer, score, skillLevel, solved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (/^[0-9]$/.test(e.key)) setInputVal((v) => (v.length < 8 ? v + e.key : v));
      else if (e.key === 'Backspace') setInputVal((v) => v.slice(0, -1));
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, paused]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="w-full p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-center">
        {puzzle.lines.map((line, i) => (
          <div key={i} className="text-xl sm:text-2xl font-mono-num font-semibold text-slate-100">
            {paused ? '••••••' : line}
          </div>
        ))}
        <div className="pt-2 border-t border-slate-800 text-lg font-mono-num font-bold text-cyan-400">
          {puzzle.targetLabel} <span className="text-white ml-2">{inputVal || '_'}</span>
        </div>
      </div>

      <TouchKeypad value={inputVal} onChange={setInputVal} onSubmit={handleSubmit} disabled={paused} />
    </div>
  );
};

// ============================================================================
// 11. NUMBER SEQUENCE
// ============================================================================
interface SequenceChallenge {
  terms: number[];
  answer: number;
  hint: string;
}

function buildNumberSequence(level: number, skill: number): SequenceChallenge {
  const tier = level + Math.floor(skill);
  const kind = tier <= 2 ? randInt(0, 1) : randInt(0, 4);

  if (kind === 0) {
    // Arithmetic
    const start = randInt(2, 25);
    const diff = randInt(3, 11 + tier * 2);
    const terms = Array.from({ length: 5 }, (_, i) => start + i * diff);
    return { terms, answer: start + 5 * diff, hint: `Selisih konstan +${diff}` };
  }
  if (kind === 1) {
    // Second-order increment (+2, +4, +6...)
    let val = randInt(1, 12);
    let step = randInt(2, 5);
    const inc = randInt(2, 4);
    const terms = [val];
    for (let i = 0; i < 4; i++) {
      val += step;
      terms.push(val);
      step += inc;
    }
    return { terms, answer: val + step, hint: `Selisih bertambah +${inc} tiap langkah` };
  }
  if (kind === 2) {
    // Geometric
    const start = randInt(1, 5);
    const ratio = randInt(2, 3);
    const terms = Array.from({ length: 4 }, (_, i) => start * Math.pow(ratio, i));
    return { terms, answer: start * Math.pow(ratio, 4), hint: `Dikali ${ratio} setiap suku` };
  }
  if (kind === 3) {
    // Fibonacci-like
    const a = randInt(1, 7);
    const b = randInt(2, 9);
    const terms = [a, b];
    for (let i = 2; i < 5; i++) terms.push(terms[i - 1] + terms[i - 2]);
    return { terms, answer: terms[3] + terms[4], hint: 'Jumlahkan 2 angka sebelumnya' };
  }
  // Squares + offset
  const offset = randInt(1, 7);
  const base = randInt(1, 4);
  const terms = Array.from({ length: 4 }, (_, i) => Math.pow(base + i, 2) + offset);
  return { terms, answer: Math.pow(base + 4, 2) + offset, hint: `Pola kuadrat n² + ${offset}` };
}

export const NumberSequenceGame: React.FC<GameComponentProps> = ({
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
  const [seq, setSeq] = useState<SequenceChallenge>(() => buildNumberSequence(1, skillLevel));
  const [inputVal, setInputVal] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: mode === 'classic' ? `Deret ${solved}/10` : `Deret ${solved}`,
      onUseHint: showHint ? null : () => setShowHint(true),
    });
  }, [level, lives, mode, onHudUpdate, score, showHint, solved]);

  const handleSubmit = useCallback(() => {
    if (paused || !inputVal) return;
    const nextAtt = attempts + 1;
    setAttempts(nextAtt);

    if (Number(inputVal) === seq.answer) {
      AudioManager.correct();
      const gained = (showHint ? 35 : 65) + level * 15;
      const nextScore = score + gained;
      const nextSolved = solved + 1;
      const nextLvl = level + 1;
      setScore(nextScore);
      setSolved(nextSolved);
      onTriggerFeedback?.('score', `+${gained}`);

      if (mode === 'classic' && nextSolved >= 10) {
        onGameOver({
          score: nextScore + 200,
          accuracy: Math.round((nextSolved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: true,
        });
        return;
      }
      setLevel(nextLvl);
      setSeq(buildNumberSequence(nextLvl, skillLevel));
      setInputVal('');
      setShowHint(false);
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', `Lanjutan: ${seq.answer}`);
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        onGameOver({
          score,
          accuracy: Math.round((solved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
          mistakes: nextAtt - solved,
        });
        return;
      }
      setSeq(buildNumberSequence(level, skillLevel));
      setInputVal('');
      setShowHint(false);
    }
  }, [attempts, inputVal, level, lives, mode, onGameOver, onTriggerFeedback, paused, score, seq.answer, showHint, skillLevel, solved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (/^[0-9]$/.test(e.key)) setInputVal((v) => (v.length < 8 ? v + e.key : v));
      else if (e.key === 'Backspace') setInputVal((v) => v.slice(0, -1));
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, paused]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="w-full p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {seq.terms.map((n, i) => (
            <span
              key={i}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-lg sm:text-xl font-mono-num font-bold text-slate-100"
            >
              {paused ? '?' : n}
            </span>
          ))}
          <span className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-400/60 text-lg sm:text-xl font-mono-num font-bold text-cyan-300 min-w-[54px] text-center">
            {inputVal || '?'}
          </span>
        </div>
        {showHint && (
          <div className="text-center text-xs text-amber-300">
            Petunjuk: {seq.hint}
          </div>
        )}
      </div>

      <TouchKeypad value={inputVal} onChange={setInputVal} onSubmit={handleSubmit} disabled={paused} />
    </div>
  );
};

// ============================================================================
// 12. 24 GAME (Guaranteed Solvable Solver + Interactive Step Builder)
// ============================================================================
interface Node24 {
  val: number;
  expr: string;
}

function solve24Steps(nodes: Node24[]): string | null {
  if (nodes.length === 1) {
    return Math.abs(nodes[0].val - 24) < 1e-6 ? nodes[0].expr : null;
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const rest = nodes.filter((_, idx) => idx !== i && idx !== j);
      const candidates: Node24[] = [
        { val: a.val + b.val, expr: `(${a.expr} + ${b.expr})` },
        { val: a.val * b.val, expr: `(${a.expr} × ${b.expr})` },
        { val: a.val - b.val, expr: `(${a.expr} − ${b.expr})` },
        { val: b.val - a.val, expr: `(${b.expr} − ${a.expr})` },
      ];
      if (Math.abs(b.val) > 1e-6) {
        candidates.push({ val: a.val / b.val, expr: `(${a.expr} ÷ ${b.expr})` });
      }
      if (Math.abs(a.val) > 1e-6) {
        candidates.push({ val: b.val / a.val, expr: `(${b.expr} ÷ ${a.expr})` });
      }
      for (const c of candidates) {
        const res = solve24Steps([...rest, c]);
        if (res) return res;
      }
    }
  }
  return null;
}

function generateSolvable24(skill: number): { nums: number[]; solution: string } {
  const maxCard = skill >= 3 ? 13 : 9;
  for (let attempt = 0; attempt < 250; attempt++) {
    const nums = [
      randInt(1, maxCard),
      randInt(1, maxCard),
      randInt(1, maxCard),
      randInt(1, maxCard),
    ];
    const sol = solve24Steps(nums.map((n) => ({ val: n, expr: String(n) })));
    if (sol) return { nums, solution: sol };
  }
  return { nums: [3, 8, 3, 8], solution: '(8 ÷ (3 − (8 ÷ 3)))' };
}

interface Card24 {
  id: number;
  val: number;
  label: string;
}

function formatNum24(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return Number(n.toFixed(2)).toString();
}

export const Game24: React.FC<GameComponentProps> = ({
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
  const [solved, setSolved] = useState(0);
  const [skips, setSkips] = useState(0);
  const [lives, setLives] = useState<number | null>(mode === 'challenge' ? 3 : null);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 90 : null);

  const initialDeal = useMemo(() => generateSolvable24(skillLevel), [skillLevel]);
  const [baseNums, setBaseNums] = useState<number[]>(initialDeal.nums);
  const [solutionExpr, setSolutionExpr] = useState<string>(initialDeal.solution);
  const [cards, setCards] = useState<Card24[]>(() =>
    initialDeal.nums.map((v, i) => ({ id: i, val: v, label: String(v) }))
  );
  const [history, setHistory] = useState<Card24[][]>([]);
  const [firstId, setFirstId] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<'+' | '−' | '×' | '÷' | null>(null);
  const [hintShown, setHintShown] = useState(false);

  const dealNew = useCallback(
    (nextSkill = skillLevel) => {
      const next = generateSolvable24(nextSkill + Math.floor(level / 3));
      setBaseNums(next.nums);
      setSolutionExpr(next.solution);
      setCards(next.nums.map((v, i) => ({ id: i, val: v, label: String(v) })));
      setHistory([]);
      setFirstId(null);
      setSelectedOp(null);
      setHintShown(false);
    },
    [level, skillLevel]
  );

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 3 : undefined,
      timeLeftSec: timeLeft,
      progressLabel: mode === 'classic' ? `Ronde ${solved}/5` : `Terpecahkan ${solved}`,
      onUseHint: hintShown ? null : () => setHintShown(true),
    });
  }, [hintShown, level, lives, mode, onHudUpdate, score, solved, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onGameOver({
        score,
        accuracy: solved + skips > 0 ? Math.round((solved / (solved + skips)) * 100) : 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: solved > 0,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [level, onGameOver, paused, score, skips, solved, timeLeft]);

  const handleResetHand = () => {
    AudioManager.click();
    setCards(baseNums.map((v, i) => ({ id: i, val: v, label: String(v) })));
    setHistory([]);
    setFirstId(null);
    setSelectedOp(null);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    AudioManager.click();
    const prev = history[history.length - 1];
    setCards(prev);
    setHistory((h) => h.slice(0, -1));
    setFirstId(null);
    setSelectedOp(null);
  };

  const handleCardClick = (card: Card24) => {
    if (paused) return;
    if (firstId === null) {
      AudioManager.click();
      setFirstId(card.id);
      return;
    }
    if (firstId === card.id) {
      setFirstId(null);
      setSelectedOp(null);
      return;
    }
    if (!selectedOp) {
      AudioManager.click();
      setFirstId(card.id);
      return;
    }
    const first = cards.find((c) => c.id === firstId);
    if (!first) return;

    if (selectedOp === '÷' && Math.abs(card.val) < 1e-6) {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Tidak bisa bagi 0');
      return;
    }

    let resultVal = 0;
    if (selectedOp === '+') resultVal = first.val + card.val;
    if (selectedOp === '−') resultVal = first.val - card.val;
    if (selectedOp === '×') resultVal = first.val * card.val;
    if (selectedOp === '÷') resultVal = first.val / card.val;

    const newCard: Card24 = {
      id: Date.now() + Math.random(),
      val: resultVal,
      label: formatNum24(resultVal),
    };
    const nextCards = [...cards.filter((c) => c.id !== first.id && c.id !== card.id), newCard];
    setHistory((h) => [...h, cards]);
    setCards(nextCards);
    setFirstId(null);
    setSelectedOp(null);

    if (nextCards.length === 1) {
      if (Math.abs(newCard.val - 24) < 1e-6) {
        AudioManager.levelUp();
        const gained = (hintShown ? 60 : 120) + level * 25;
        const nextScore = score + gained;
        const nextSolved = solved + 1;
        setScore(nextScore);
        setSolved(nextSolved);
        onTriggerFeedback?.('score', `+${gained} (24!)`);

        window.setTimeout(() => {
          if (mode === 'classic' && nextSolved >= 5) {
            onGameOver({
              score: nextScore + 250,
              accuracy: Math.round((nextSolved / (nextSolved + skips)) * 100),
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: true,
            });
          } else {
            setLevel((l) => l + 1);
            dealNew();
          }
        }, 550);
      } else {
        AudioManager.wrong();
        onTriggerFeedback?.('error', `Hasil = ${formatNum24(newCard.val)} (Bukan 24)`);
      }
    } else {
      AudioManager.click();
    }
  };

  const handleSkip = () => {
    AudioManager.click();
    const nextSkips = skips + 1;
    setSkips(nextSkips);
    if (lives !== null) {
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        onGameOver({
          score,
          accuracy: solved + nextSkips > 0 ? Math.round((solved / (solved + nextSkips)) * 100) : 0,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
        });
        return;
      }
    }
    dealNew();
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="text-xs text-slate-400 text-center">
        Pilih kartu angka → pilih operator → pilih kartu kedua hingga tersisa angka 24
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        {cards.map((c) => {
          const isSelected = firstId === c.id;
          const is24 = cards.length === 1 && Math.abs(c.val - 24) < 1e-6;
          return (
            <button
              key={c.id}
              type="button"
              disabled={paused}
              onClick={() => handleCardClick(c)}
              className={`h-24 rounded-2xl border text-3xl font-mono-num font-bold transition-all cursor-pointer active:scale-95 ${
                is24
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : isSelected
                  ? 'bg-blue-600/25 border-blue-400 text-cyan-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-100'
              }`}
            >
              {paused ? '?' : c.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2.5 w-full">
        {(['+', '−', '×', '÷'] as const).map((op) => (
          <button
            key={op}
            type="button"
            disabled={paused || firstId === null}
            onClick={() => {
              AudioManager.click();
              setSelectedOp(op);
            }}
            className={`h-13 rounded-xl border text-2xl font-bold transition-all cursor-pointer disabled:opacity-35 ${
              selectedOp === op
                ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
            }`}
          >
            {op}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 w-full">
        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0 || paused}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={handleResetHand}
          disabled={history.length === 0 || paused}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Ulang</span>
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={paused}
          className="px-4 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-sm font-medium text-slate-300 cursor-pointer"
        >
          Lewati Soal
        </button>
      </div>

      {hintShown && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono-num text-amber-300 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 shrink-0" />
          <span>Contoh solusi: {solutionExpr}</span>
        </div>
      )}
    </div>
  );
};
