import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eraser, Pencil, Undo2 } from 'lucide-react';
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
// 13. PATTERN RECOGNITION (3x3 Matrix)
// ============================================================================
interface MatrixCell {
  shape: ShapeKind;
  color: string;
  rotation: number;
  hollow: boolean;
  dots: number;
}

function generateMatrixPuzzle(level: number, skill: number) {
  const shapes = shuffleArray(SHAPE_KINDS).slice(0, 3);
  const colors = shuffleArray(SHAPE_PALETTE).slice(0, 3);
  const rotStep = level + skill >= 3 ? 45 : 90;
  const startRot = randInt(0, 3) * 90;
  const useDots = level + skill >= 2;

  const grid: MatrixCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push({
        shape: shapes[(r + c) % 3],
        color: colors[r],
        rotation: (startRot + c * rotStep + r * 45) % 360,
        hollow: (r + c) % 2 === 1 && level >= 3,
        dots: useDots ? ((c + 1) % 4) : 0,
      });
    }
  }
  const answer = grid[8];
  const candidates: MatrixCell[] = [answer];
  while (candidates.length < 4) {
    const mutated: MatrixCell = {
      shape: Math.random() < 0.5 ? shapes[randInt(0, 2)] : answer.shape,
      color: Math.random() < 0.4 ? colors[randInt(0, 2)] : answer.color,
      rotation: (answer.rotation + randInt(1, 3) * 45) % 360,
      hollow: Math.random() < 0.3 ? !answer.hollow : answer.hollow,
      dots: useDots ? randInt(0, 3) : 0,
    };
    const dup = candidates.some(
      (x) =>
        x.shape === mutated.shape &&
        x.color === mutated.color &&
        x.rotation === mutated.rotation &&
        x.hollow === mutated.hollow &&
        x.dots === mutated.dots
    );
    if (!dup) candidates.push(mutated);
  }
  return {
    grid: grid.slice(0, 8),
    answer,
    options: shuffleArray(candidates),
  };
}

export const PatternRecognitionGame: React.FC<GameComponentProps> = ({
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
  const [puzzle, setPuzzle] = useState(() => generateMatrixPuzzle(1, skillLevel));
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: mode === 'classic' ? `Pola ${solved}/10` : `Terpecahkan ${solved}`,
    });
  }, [level, lives, mode, onHudUpdate, score, solved]);

  const handlePick = (opt: MatrixCell) => {
    if (paused) return;
    const nextAtt = attempts + 1;
    setAttempts(nextAtt);
    const isOk =
      opt.shape === puzzle.answer.shape &&
      opt.color === puzzle.answer.color &&
      opt.rotation === puzzle.answer.rotation &&
      opt.hollow === puzzle.answer.hollow &&
      opt.dots === puzzle.answer.dots;

    if (isOk) {
      AudioManager.correct();
      const gained = 75 + level * 20;
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
      setPuzzle(generateMatrixPuzzle(nextLvl, skillLevel));
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Pola Tidak Cocok');
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
      setPuzzle(generateMatrixPuzzle(level, skillLevel));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
      <div className="text-xs text-slate-400">
        Identifikasi pola baris & kolom untuk melengkapi sel ke-9
      </div>
      <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
        {puzzle.grid.map((cell, idx) => (
          <div
            key={idx}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center"
          >
            {!paused && <GeometricShape {...cell} size={42} />}
          </div>
        ))}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-blue-500/10 border border-blue-400/60 flex items-center justify-center text-2xl font-bold text-cyan-300">
          ?
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full">
        {puzzle.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={paused}
            onClick={() => handlePick(opt)}
            className="aspect-square rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-400 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            {!paused && <GeometricShape {...opt} size={38} />}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 14. ODD ONE OUT
// ============================================================================
interface OddItem {
  shape: ShapeKind;
  color: string;
  rotation: number;
  hollow: boolean;
  dots: number;
  isOdd: boolean;
}

function buildOddOneOut(level: number, skill: number): { items: OddItem[]; cols: number } {
  const tier = level + Math.floor(skill);
  const total = tier <= 2 ? 4 : tier <= 5 ? 9 : tier <= 9 ? 12 : 16;
  const cols = total === 4 ? 2 : total <= 9 ? 3 : 4;

  const baseShape = SHAPE_KINDS[randInt(0, SHAPE_KINDS.length - 1)];
  const baseColor = SHAPE_PALETTE[randInt(0, SHAPE_PALETTE.length - 1)];
  const baseRot = randInt(0, 3) * 90;
  const baseHollow = Math.random() < 0.35;
  const baseDots = tier >= 3 ? randInt(1, 3) : 0;

  const oddIdx = randInt(0, total - 1);
  const diffType = tier <= 2 ? randInt(0, 1) : randInt(0, 3);

  const items: OddItem[] = Array.from({ length: total }, (_, idx) => {
    if (idx !== oddIdx) {
      return {
        shape: baseShape,
        color: baseColor,
        rotation: baseRot,
        hollow: baseHollow,
        dots: baseDots,
        isOdd: false,
      };
    }
    if (diffType === 0) {
      const otherShapes = SHAPE_KINDS.filter((s) => s !== baseShape);
      return {
        shape: otherShapes[randInt(0, otherShapes.length - 1)],
        color: baseColor,
        rotation: baseRot,
        hollow: baseHollow,
        dots: baseDots,
        isOdd: true,
      };
    }
    if (diffType === 1) {
      const otherColors = SHAPE_PALETTE.filter((c) => c !== baseColor);
      return {
        shape: baseShape,
        color: otherColors[randInt(0, otherColors.length - 1)],
        rotation: baseRot,
        hollow: baseHollow,
        dots: baseDots,
        isOdd: true,
      };
    }
    if (diffType === 2) {
      return {
        shape: baseShape,
        color: baseColor,
        rotation: baseRot,
        hollow: !baseHollow,
        dots: baseDots,
        isOdd: true,
      };
    }
    return {
      shape: baseShape,
      color: baseColor,
      rotation: baseRot,
      hollow: baseHollow,
      dots: (baseDots + 1) % 4,
      isOdd: true,
    };
  });

  return { items, cols };
}

export const OddOneOutGame: React.FC<GameComponentProps> = ({
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
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 45 : null);
  const [board, setBoard] = useState(() => buildOddOneOut(1, skillLevel));
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      timeLeftSec: timeLeft,
      progressLabel: `Ditemukan ${correct}`,
    });
  }, [correct, level, lives, mode, onHudUpdate, score, timeLeft]);

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

  const pick = (item: OddItem) => {
    if (paused) return;
    const nextAtt = attempts + 1;
    setAttempts(nextAtt);
    if (item.isOdd) {
      AudioManager.correct();
      const gained = 45 + level * 12;
      setScore((s) => s + gained);
      setCorrect((c) => c + 1);
      const nextLvl = level + 1;
      setLevel(nextLvl);
      onTriggerFeedback?.('score', `+${gained}`);
      setBoard(buildOddOneOut(nextLvl, skillLevel));
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Bukan yang ini');
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
        }
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="text-xs text-slate-400">Ketuk satu objek yang berbeda dari yang lain</div>
      <div
        className="grid gap-2.5 w-full"
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={paused}
            onClick={() => pick(item)}
            className="aspect-square min-h-[58px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-400 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            {!paused && <GeometricShape {...item} size={board.cols >= 4 ? 30 : 38} />}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 15. LOGICAL DEDUCTION (Procedural Constraint Ordering)
// ============================================================================
const ENTITIES_POOL = [
  { name: 'Alfa', color: '#3B82F6' },
  { name: 'Beta', color: '#06B6D4' },
  { name: 'Gamma', color: '#8B5CF6' },
  { name: 'Delta', color: '#10B981' },
];

interface DeductionPuzzle {
  entities: typeof ENTITIES_POOL;
  solution: string[];
  clues: string[];
}

function generateDeductionPuzzle(size: number): DeductionPuzzle {
  const entities = ENTITIES_POOL.slice(0, size);
  const solution = shuffleArray(entities.map((e) => e.name));

  // Generate strong non-ambiguous clues from ground truth
  const clues: string[] = [];
  if (size === 3) {
    const [p0, p1, p2] = solution;
    clues.push(`${p0} berada tepat di sebelah kiri ${p1}.`);
    clues.push(`${p2} tidak berada di posisi 1 atau 2.`);
    clues.push(`${p1} ada di antara ${p0} dan ${p2}.`);
  } else {
    const [p0, p1, p2, p3] = solution;
    clues.push(`${p0} berada di ujung paling kiri (Posisi 1).`);
    clues.push(`${p2} berada tepat di sebelah kanan ${p1}.`);
    clues.push(`${p3} bukan tetangga ${p0} dan bukan di posisi 3.`);
    clues.push(`${p1} tidak berada di ujung kanan.`);
  }
  return { entities, solution, clues: shuffleArray(clues) };
}

export const LogicalDeductionGame: React.FC<GameComponentProps> = ({
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
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const size = level + skillLevel >= 3 ? 4 : 3;
  const [puzzle, setPuzzle] = useState<DeductionPuzzle>(() => generateDeductionPuzzle(size));
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(size).fill(null));
  const [activeEntity, setActiveEntity] = useState<string | null>(null);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 1 : 3,
      progressLabel: mode === 'classic' ? `Kasus ${solved}/6` : `Kasus ${solved}`,
    });
  }, [level, lives, mode, onHudUpdate, score, solved]);

  const placeInSlot = (slotIdx: number) => {
    if (paused) return;
    AudioManager.click();
    if (activeEntity) {
      setSlots((prev) => {
        const cleaned = prev.map((x) => (x === activeEntity ? null : x));
        cleaned[slotIdx] = activeEntity;
        return cleaned;
      });
      setActiveEntity(null);
    } else if (slots[slotIdx]) {
      setSlots((prev) => prev.map((x, i) => (i === slotIdx ? null : x)));
    }
  };

  const checkAnswer = () => {
    if (paused || slots.some((s) => s === null)) return;
    const nextAtt = attempts + 1;
    setAttempts(nextAtt);
    const isOk = slots.every((s, idx) => s === puzzle.solution[idx]);

    if (isOk) {
      AudioManager.correct();
      const gained = 90 + level * 25;
      const nextScore = score + gained;
      const nextSolved = solved + 1;
      const nextLvl = level + 1;
      setScore(nextScore);
      setSolved(nextSolved);
      onTriggerFeedback?.('score', `+${gained}`);

      if (mode === 'classic' && nextSolved >= 6) {
        onGameOver({
          score: nextScore + 220,
          accuracy: Math.round((nextSolved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: true,
        });
        return;
      }
      const nextSize = nextLvl + skillLevel >= 3 ? 4 : 3;
      setLevel(nextLvl);
      setPuzzle(generateDeductionPuzzle(nextSize));
      setSlots(Array(nextSize).fill(null));
      setActiveEntity(null);
    } else {
      AudioManager.wrong();
      onTriggerFeedback?.('error', 'Susunan Belum Sesuai Premis');
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        onGameOver({
          score,
          accuracy: Math.round((solved / nextAtt) * 100),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-5">
      <div className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
        <div className="text-xs font-semibold text-cyan-400">Petunjuk Logika</div>
        <ul className="space-y-1.5 text-sm text-slate-200">
          {puzzle.clues.map((c, i) => (
            <li key={i}>• {paused ? '••••••••••••' : c}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2.5 w-full" style={{ gridTemplateColumns: `repeat(${puzzle.solution.length}, minmax(0, 1fr))` }}>
        {slots.map((occupant, idx) => (
          <button
            key={idx}
            type="button"
            disabled={paused}
            onClick={() => placeInSlot(idx)}
            className={`h-20 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              occupant
                ? 'bg-blue-600/20 border-blue-400 text-slate-100'
                : activeEntity
                ? 'bg-slate-800/80 border-cyan-400/60 border-dashed text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <span className="text-[11px]">Posisi {idx + 1}</span>
            <span className="text-sm font-bold">{occupant || 'Kosong'}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {puzzle.entities.map((ent) => {
          const placed = slots.includes(ent.name);
          const selected = activeEntity === ent.name;
          return (
            <button
              key={ent.name}
              type="button"
              disabled={paused}
              onClick={() => {
                AudioManager.click();
                setActiveEntity(selected ? null : ent.name);
              }}
              className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                selected
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                  : placed
                  ? 'bg-slate-800/40 border-slate-800 text-slate-500'
                  : 'bg-slate-800 border-slate-700 text-slate-100 hover:border-blue-400'
              }`}
            >
              {ent.name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={paused || slots.some((s) => s === null)}
        onClick={checkAnswer}
        className="w-full max-w-xs h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold cursor-pointer transition-colors"
      >
        Verifikasi Deduksi
      </button>
    </div>
  );
};

// ============================================================================
// 16. SUDOKU (9x9 Procedural Generator + Notes + Hint + Save/Resume)
// ============================================================================
function generateSudokuBoard(cluesCount: number): { puzzle: number[]; solution: number[] } {
  const board = Array(81).fill(0);

  const isSafe = (b: number[], idx: number, val: number) => {
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    for (let i = 0; i < 9; i++) {
      if (b[r * 9 + i] === val || b[i * 9 + c] === val) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (b[(br + dr) * 9 + (bc + dc)] === val) return false;
      }
    }
    return true;
  };

  const solve = (b: number[]): boolean => {
    const empty = b.indexOf(0);
    if (empty === -1) return true;
    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const n of nums) {
      if (isSafe(b, empty, n)) {
        b[empty] = n;
        if (solve(b)) return true;
        b[empty] = 0;
      }
    }
    return false;
  };

  solve(board);
  const solution = [...board];
  const puzzle = [...board];
  const indices = shuffleArray(Array.from({ length: 81 }, (_, i) => i));
  const toRemove = Math.max(25, Math.min(58, 81 - cluesCount));
  for (let i = 0; i < toRemove; i++) {
    puzzle[indices[i]] = 0;
  }
  return { puzzle, solution };
}

export const SudokuGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  savedSession,
  onHudUpdate,
  onSaveSession,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const cluesTarget = Math.max(24, 40 - Math.round(skillLevel * 2.4));

  const initData = useMemo(() => {
    if (
      savedSession &&
      Array.isArray(savedSession.grid) &&
      Array.isArray(savedSession.solution) &&
      Array.isArray(savedSession.fixed)
    ) {
      return {
        grid: savedSession.grid as number[],
        solution: savedSession.solution as number[],
        fixed: savedSession.fixed as boolean[],
        notes: (savedSession.notes as number[][]) || Array.from({ length: 81 }, () => []),
        mistakes: (savedSession.mistakes as number) || 0,
        score: (savedSession.score as number) || 0,
        level: (savedSession.level as number) || 1,
      };
    }
    const gen = generateSudokuBoard(cluesTarget);
    return {
      grid: gen.puzzle,
      solution: gen.solution,
      fixed: gen.puzzle.map((v) => v !== 0),
      notes: Array.from({ length: 81 }, () => [] as number[]),
      mistakes: 0,
      score: 0,
      level: 1,
    };
  }, [cluesTarget, savedSession]);

  const [grid, setGrid] = useState<number[]>(initData.grid);
  const [solution, setSolution] = useState<number[]>(initData.solution);
  const [fixed, setFixed] = useState<boolean[]>(initData.fixed);
  const [notes, setNotes] = useState<number[][]>(initData.notes);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(initData.mistakes);
  const [score, setScore] = useState(initData.score);
  const [level, setLevel] = useState(initData.level);
  const [undoStack, setUndoStack] = useState<number[][]>([]);
  const maxMistakes = mode === 'challenge' ? 3 : 5;

  useEffect(() => {
    onSaveSession?.({ grid, solution, fixed, notes, mistakes, score, level });
  }, [fixed, grid, level, mistakes, notes, onSaveSession, score, solution]);

  const useHint = useCallback(() => {
    const emptyIdxs = grid.map((v, i) => (v === 0 ? i : -1)).filter((i) => i !== -1);
    if (emptyIdxs.length === 0) return;
    const pick = selected !== null && grid[selected] === 0 ? selected : emptyIdxs[randInt(0, emptyIdxs.length - 1)];
    AudioManager.click();
    const next = [...grid];
    next[pick] = solution[pick];
    setGrid(next);
    setSelected(pick);
  }, [grid, selected, solution]);

  useEffect(() => {
    const filledCount = grid.filter((v) => v !== 0).length;
    onHudUpdate({
      score,
      level,
      lives: Math.max(0, maxMistakes - mistakes),
      maxLives: maxMistakes,
      progressLabel: `${filledCount}/81 Sel`,
      onUseHint: useHint,
    });
  }, [grid, level, maxMistakes, mistakes, onHudUpdate, score, useHint]);

  const enterValue = useCallback(
    (num: number) => {
      if (paused || selected === null || fixed[selected]) return;
      if (noteMode) {
        AudioManager.click();
        setNotes((prev) =>
          prev.map((arr, idx) =>
            idx !== selected ? arr : arr.includes(num) ? arr.filter((x) => x !== num) : [...arr, num]
          )
        );
        return;
      }

      setUndoStack((u) => [...u.slice(-15), grid]);
      const next = [...grid];
      next[selected] = num;
      setGrid(next);

      if (num !== 0 && num !== solution[selected]) {
        AudioManager.wrong();
        const nextErr = mistakes + 1;
        setMistakes(nextErr);
        onTriggerFeedback?.('error', 'Angka Bentrok!');
        if (nextErr >= maxMistakes) {
          onSaveSession?.(null);
          onGameOver({
            score,
            accuracy: Math.max(0, Math.round(((81 - nextErr * 4) / 81) * 100)),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: false,
            mistakes: nextErr,
          });
        }
      } else if (num === solution[selected]) {
        AudioManager.correct();
        const gained = 25 + level * 5;
        const nextScore = score + gained;
        setScore(nextScore);
        onTriggerFeedback?.('score', `+${gained}`);

        if (next.every((v, i) => v === solution[i])) {
          AudioManager.levelUp();
          if (mode === 'endless') {
            const nextLvl = level + 1;
            const gen = generateSudokuBoard(Math.max(22, cluesTarget - nextLvl));
            setLevel(nextLvl);
            setGrid(gen.puzzle);
            setSolution(gen.solution);
            setFixed(gen.puzzle.map((v) => v !== 0));
            setNotes(Array.from({ length: 81 }, () => []));
            setScore(nextScore + 400);
          } else {
            onSaveSession?.(null);
            onGameOver({
              score: nextScore + 450,
              accuracy: Math.max(50, Math.round(((81 - mistakes) / 81) * 100)),
              durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
              levelReached: level,
              completed: true,
              mistakes,
            });
          }
        }
      }
    },
    [cluesTarget, fixed, grid, level, maxMistakes, mistakes, mode, noteMode, onGameOver, onSaveSession, onTriggerFeedback, paused, score, selected, solution]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (/^[1-9]$/.test(e.key)) enterValue(Number(e.key));
      else if (e.key === 'Backspace' || e.key === '0') enterValue(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enterValue, paused]);

  const selRow = selected !== null ? Math.floor(selected / 9) : -1;
  const selCol = selected !== null ? selected % 9 : -1;
  const selVal = selected !== null ? grid[selected] : 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <div className="grid grid-cols-9 bg-slate-800 p-1 rounded-xl border border-slate-700 w-full aspect-square">
        {grid.map((val, idx) => {
          const r = Math.floor(idx / 9);
          const c = idx % 9;
          const isFixed = fixed[idx];
          const isSelected = selected === idx;
          const isRelated = r === selRow || c === selCol;
          const sameVal = selVal !== 0 && val === selVal;
          const isConflict = val !== 0 && val !== solution[idx];
          const borderRight = c === 2 || c === 5 ? 'border-r-2 border-r-slate-500' : 'border-r border-r-slate-800';
          const borderBottom = r === 2 || r === 5 ? 'border-b-2 border-b-slate-500' : 'border-b border-b-slate-800';

          return (
            <button
              key={idx}
              type="button"
              disabled={paused}
              onClick={() => setSelected(idx)}
              className={`flex items-center justify-center text-sm sm:text-base font-mono-num font-bold transition-colors cursor-pointer ${borderRight} ${borderBottom} ${
                isSelected
                  ? 'bg-blue-600/40 text-white'
                  : isConflict
                  ? 'bg-rose-500/25 text-rose-300'
                  : sameVal
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : isRelated
                  ? 'bg-slate-900/60'
                  : 'bg-slate-950/90'
              } ${isFixed ? 'text-slate-200' : 'text-cyan-300'}`}
            >
              {paused ? '' : val !== 0 ? (
                val
              ) : notes[idx].length > 0 ? (
                <span className="text-[9px] leading-tight text-slate-400 grid grid-cols-3 w-full px-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n}>{notes[idx].includes(n) ? n : ''}</span>
                  ))}
                </span>
              ) : (
                ''
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between w-full gap-2">
        <button
          type="button"
          onClick={() => setNoteMode((n) => !n)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
            noteMode ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Catatan {noteMode ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (undoStack.length === 0) return;
            setGrid(undoStack[undoStack.length - 1]);
            setUndoStack((u) => u.slice(0, -1));
          }}
          disabled={undoStack.length === 0}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={() => enterValue(0)}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Hapus</span>
        </button>
      </div>

      <div className="grid grid-cols-9 gap-1.5 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            disabled={paused}
            onClick={() => enterValue(n)}
            className="h-11 rounded-lg bg-slate-800 hover:bg-blue-600 border border-slate-700 text-base font-mono-num font-bold text-slate-100 cursor-pointer active:scale-95 transition-all"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 17. NONOGRAM (Procedural Picross)
// ============================================================================
function computeNonogramClues(line: boolean[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell) run++;
    else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length > 0 ? clues : [0];
}

function generateNonogram(size: number) {
  const sol: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.random() < 0.56)
  );
  // Ensure at least 1 filled cell per row & column so puzzle is clean
  for (let r = 0; r < size; r++) {
    if (!sol[r].some(Boolean)) sol[r][randInt(0, size - 1)] = true;
  }
  const rowClues = sol.map((row) => computeNonogramClues(row));
  const colClues = Array.from({ length: size }, (_, c) =>
    computeNonogramClues(sol.map((row) => row[c]))
  );
  return { sol, rowClues, colClues };
}

export const NonogramGame: React.FC<GameComponentProps> = ({
  mode,
  skillLevel,
  paused,
  savedSession,
  onHudUpdate,
  onSaveSession,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const baseSize = skillLevel >= 3 ? 6 : 5;

  const init = useMemo(() => {
    if (savedSession && Array.isArray(savedSession.sol) && Array.isArray(savedSession.board)) {
      const s = savedSession.sol as boolean[][];
      return {
        size: s.length,
        sol: s,
        rowClues: s.map((r) => computeNonogramClues(r)),
        colClues: Array.from({ length: s.length }, (_, c) => computeNonogramClues(s.map((r) => r[c]))),
        board: savedSession.board as (0 | 1 | 2)[][], // 0 empty, 1 fill, 2 cross
        score: (savedSession.score as number) || 0,
        level: (savedSession.level as number) || 1,
        mistakes: (savedSession.mistakes as number) || 0,
      };
    }
    const g = generateNonogram(baseSize);
    return {
      size: baseSize,
      ...g,
      board: Array.from({ length: baseSize }, () => Array(baseSize).fill(0) as (0 | 1 | 2)[]),
      score: 0,
      level: 1,
      mistakes: 0,
    };
  }, [baseSize, savedSession]);

  const [size, setSize] = useState(init.size);
  const [sol, setSol] = useState(init.sol);
  const [rowClues, setRowClues] = useState(init.rowClues);
  const [colClues, setColClues] = useState(init.colClues);
  const [board, setBoard] = useState<(0 | 1 | 2)[][]>(init.board);
  const [tool, setTool] = useState<'fill' | 'mark'>('fill');
  const [score, setScore] = useState(init.score);
  const [level, setLevel] = useState(init.level);
  const [mistakes, setMistakes] = useState(init.mistakes);
  const [lives, setLives] = useState(mode === 'challenge' ? 3 : 5);

  useEffect(() => {
    onSaveSession?.({ sol, board, score, level, mistakes });
  }, [board, level, mistakes, onSaveSession, score, sol]);

  const handleHint = useCallback(() => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (sol[r][c] && board[r][c] !== 1) {
          AudioManager.click();
          setBoard((prev) =>
            prev.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? 1 : v)) : row))
          );
          return;
        }
      }
    }
  }, [board, size, sol]);

  useEffect(() => {
    const targetTotal = sol.flat().filter(Boolean).length;
    const currentFilled = board.flat().filter((v) => v === 1).length;
    onHudUpdate({
      score,
      level,
      lives,
      maxLives: mode === 'challenge' ? 3 : 5,
      progressLabel: `${currentFilled}/${targetTotal} Blok`,
      onUseHint: handleHint,
    });
  }, [board, handleHint, level, lives, mode, onHudUpdate, score, sol]);

  const toggleCell = (r: number, c: number) => {
    if (paused) return;
    if (tool === 'mark') {
      AudioManager.click();
      setBoard((prev) =>
        prev.map((row, ri) =>
          ri === r ? row.map((v, ci) => (ci === c ? (v === 2 ? 0 : 2) : v)) : row
        )
      );
      return;
    }

    if (board[r][c] === 1) return;
    if (sol[r][c]) {
      AudioManager.correct();
      const nextBoard = board.map((row, ri) =>
        ri === r ? row.map((v, ci) => (ci === c ? 1 : v)) : row
      );
      setBoard(nextBoard);
      const nextScore = score + 25;
      setScore(nextScore);

      // Check completion: all true cells are filled (1)
      const isDone = sol.every((row, ri) =>
        row.every((shouldFill, ci) => !shouldFill || nextBoard[ri][ci] === 1)
      );
      if (isDone) {
        AudioManager.levelUp();
        const bonus = 150 + size * 20;
        if (mode === 'classic' && level >= 3) {
          onSaveSession?.(null);
          onGameOver({
            score: nextScore + bonus,
            accuracy: Math.max(50, Math.round(100 - mistakes * 6)),
            durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
            levelReached: level,
            completed: true,
            mistakes,
          });
        } else {
          const nextLvl = level + 1;
          const nextSize = Math.min(8, baseSize + Math.floor(nextLvl / 2));
          const g = generateNonogram(nextSize);
          setScore(nextScore + bonus);
          setLevel(nextLvl);
          setSize(nextSize);
          setSol(g.sol);
          setRowClues(g.rowClues);
          setColClues(g.colClues);
          setBoard(Array.from({ length: nextSize }, () => Array(nextSize).fill(0)));
          onTriggerFeedback?.('score', `+${bonus} Selesai!`);
        }
      }
    } else {
      AudioManager.wrong();
      setBoard((prev) =>
        prev.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? 2 : v)) : row))
      );
      setMistakes((m) => m + 1);
      const nextLives = lives - 1;
      setLives(nextLives);
      onTriggerFeedback?.('error', 'Sel Kosong (×)');
      if (nextLives <= 0) {
        onSaveSession?.(null);
        onGameOver({
          score,
          accuracy: Math.max(0, Math.round(100 - (mistakes + 1) * 12)),
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: level,
          completed: false,
          mistakes: mistakes + 1,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTool('fill')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${
            tool === 'fill'
              ? 'bg-blue-600 border-blue-400 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          ■ Isi Blok
        </button>
        <button
          type="button"
          onClick={() => setTool('mark')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${
            tool === 'mark'
              ? 'bg-cyan-600 border-cyan-400 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          × Tandai Kosong
        </button>
      </div>

      <div className="w-full overflow-x-auto flex justify-center">
        <div
          className="grid gap-1 items-end"
          style={{ gridTemplateColumns: `auto repeat(${size}, minmax(34px, 46px))` }}
        >
          <div />
          {colClues.map((clues, c) => (
            <div key={c} className="flex flex-col items-center justify-end pb-1 text-[11px] font-mono-num text-slate-400 leading-tight">
              {clues.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
          {board.map((row, r) => (
            <React.Fragment key={r}>
              <div className="flex items-center justify-end gap-1 pr-2 text-[11px] font-mono-num text-slate-400">
                {rowClues[r].map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
              {row.map((cell, c) => (
                <button
                  key={c}
                  type="button"
                  disabled={paused}
                  onClick={() => toggleCell(r, c)}
                  className={`aspect-square rounded-lg border flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
                    cell === 1
                      ? 'bg-blue-500 border-blue-300'
                      : cell === 2
                      ? 'bg-slate-900 border-slate-800 text-slate-500'
                      : 'bg-slate-900/90 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {cell === 2 ? '×' : ''}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 18. 2048 (4x4 Sliding Grid + Swipe + Keyboard + Undo + Save/Resume)
// ============================================================================
function spawn2048Tile(board: number[]): number[] {
  const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i !== -1);
  if (empty.length === 0) return board;
  const pick = empty[randInt(0, empty.length - 1)];
  const copy = [...board];
  copy[pick] = Math.random() < 0.9 ? 2 : 4;
  return copy;
}

function canMove2048(b: number[]): boolean {
  if (b.includes(0)) return true;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = b[r * 4 + c];
      if (c < 3 && b[r * 4 + c + 1] === v) return true;
      if (r < 3 && b[(r + 1) * 4 + c] === v) return true;
    }
  }
  return false;
}

function slideRow2048(row: number[]): { next: number[]; gained: number } {
  const filtered = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(filtered[i]);
    }
  }
  while (out.length < 4) out.push(0);
  return { next: out, gained };
}

function move2048(board: number[], dir: 'up' | 'down' | 'left' | 'right'): { next: number[]; gained: number; moved: boolean } {
  const next = Array(16).fill(0);
  let gained = 0;

  for (let i = 0; i < 4; i++) {
    let line: number[] = [];
    for (let j = 0; j < 4; j++) {
      if (dir === 'left') line.push(board[i * 4 + j]);
      if (dir === 'right') line.push(board[i * 4 + (3 - j)]);
      if (dir === 'up') line.push(board[j * 4 + i]);
      if (dir === 'down') line.push(board[(3 - j) * 4 + i]);
    }
    const res = slideRow2048(line);
    gained += res.gained;
    for (let j = 0; j < 4; j++) {
      if (dir === 'left') next[i * 4 + j] = res.next[j];
      if (dir === 'right') next[i * 4 + (3 - j)] = res.next[j];
      if (dir === 'up') next[j * 4 + i] = res.next[j];
      if (dir === 'down') next[(3 - j) * 4 + i] = res.next[j];
    }
  }
  const moved = next.some((v, idx) => v !== board[idx]);
  return { next, gained, moved };
}

const TILE_COLORS_2048: Record<number, string> = {
  0: 'bg-slate-900/70 text-transparent border-slate-800/60',
  2: 'bg-slate-800 text-slate-100 border-slate-700',
  4: 'bg-slate-700 text-slate-100 border-slate-600',
  8: 'bg-blue-900/80 text-blue-100 border-blue-700',
  16: 'bg-blue-700 text-white border-blue-500',
  32: 'bg-cyan-700 text-white border-cyan-500',
  64: 'bg-cyan-500 text-slate-950 border-cyan-300',
  128: 'bg-indigo-600 text-white border-indigo-400',
  256: 'bg-purple-600 text-white border-purple-400',
  512: 'bg-violet-500 text-white border-violet-300',
  1024: 'bg-amber-500 text-slate-950 border-amber-300',
  2048: 'bg-emerald-400 text-slate-950 border-emerald-200',
};

export const Game2048: React.FC<GameComponentProps> = ({
  mode,
  paused,
  savedSession,
  onHudUpdate,
  onSaveSession,
  onGameOver,
  onTriggerFeedback,
}) => {
  const startTimeRef = useRef(Date.now());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const initialState = useMemo(() => {
    if (savedSession && Array.isArray(savedSession.board) && savedSession.board.length === 16) {
      return {
        board: savedSession.board as number[],
        score: (savedSession.score as number) || 0,
      };
    }
    return {
      board: spawn2048Tile(spawn2048Tile(Array(16).fill(0))),
      score: 0,
    };
  }, [savedSession]);

  const [board, setBoard] = useState<number[]>(initialState.board);
  const [score, setScore] = useState<number>(initialState.score);
  const [prevState, setPrevState] = useState<{ board: number[]; score: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(mode === 'time_attack' ? 120 : null);

  const maxTile = Math.max(...board);
  const level = Math.max(1, Math.floor(Math.log2(Math.max(2, maxTile))) - 1);

  useEffect(() => {
    onSaveSession?.({ board, score });
  }, [board, onSaveSession, score]);

  useEffect(() => {
    onHudUpdate({
      score,
      level,
      timeLeftSec: timeLeft,
      progressLabel: `Ubin Maks ${maxTile}`,
    });
  }, [level, maxTile, onHudUpdate, score, timeLeft]);

  useEffect(() => {
    if (paused || timeLeft === null) return;
    if (timeLeft <= 0) {
      onSaveSession?.(null);
      onGameOver({
        score,
        accuracy: 100,
        durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        levelReached: level,
        completed: maxTile >= 512,
      });
      return;
    }
    const id = window.setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => window.clearInterval(id);
  }, [level, maxTile, onGameOver, onSaveSession, paused, score, timeLeft]);

  const performMove = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (paused) return;
      const res = move2048(board, dir);
      if (!res.moved) return;

      setPrevState({ board, score });
      const withSpawn = spawn2048Tile(res.next);
      const nextScore = score + res.gained;
      setBoard(withSpawn);
      setScore(nextScore);

      if (res.gained > 0) {
        AudioManager.correct();
        if (res.gained >= 32) onTriggerFeedback?.('score', `+${res.gained}`);
      } else {
        AudioManager.click();
      }

      const nextMax = Math.max(...withSpawn);
      if (mode === 'classic' && nextMax >= 2048) {
        AudioManager.levelUp();
        onSaveSession?.(null);
        onGameOver({
          score: nextScore + 500,
          accuracy: 100,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: 10,
          completed: true,
        });
        return;
      }

      if (!canMove2048(withSpawn)) {
        AudioManager.gameOver();
        onSaveSession?.(null);
        onGameOver({
          score: nextScore,
          accuracy: 100,
          durationSec: Math.round((Date.now() - startTimeRef.current) / 1000),
          levelReached: Math.max(1, Math.floor(Math.log2(Math.max(2, nextMax))) - 1),
          completed: nextMax >= 2048,
        });
      }
    },
    [board, mode, onGameOver, onSaveSession, onTriggerFeedback, paused, score]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') performMove('up');
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') performMove('down');
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') performMove('left');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') performMove('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, performMove]);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4 select-none">
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          if (!touchStartRef.current) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - touchStartRef.current.x;
          const dy = t.clientY - touchStartRef.current.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
            if (Math.abs(dx) > Math.abs(dy)) performMove(dx > 0 ? 'right' : 'left');
            else performMove(dy > 0 ? 'down' : 'up');
          }
          touchStartRef.current = null;
        }}
        className="grid grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-900 border border-slate-800 w-full aspect-square touch-none"
      >
        {board.map((val, i) => {
          const style = TILE_COLORS_2048[val] || 'bg-emerald-300 text-slate-950 border-white';
          return (
            <div
              key={i}
              className={`rounded-xl border flex items-center justify-center font-mono-num font-bold transition-transform duration-100 ${style} ${
                val >= 1000 ? 'text-lg sm:text-xl' : val >= 100 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              {paused ? '' : val > 0 ? val : ''}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          disabled={!prevState || paused}
          onClick={() => {
            if (!prevState) return;
            AudioManager.click();
            setBoard(prevState.board);
            setScore(prevState.score);
            setPrevState(null);
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
          <span>Undo</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => performMove('left')}
            aria-label="Geser Kiri"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => performMove('up')}
            aria-label="Geser Atas"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => performMove('down')}
            aria-label="Geser Bawah"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => performMove('right')}
            aria-label="Geser Kanan"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
