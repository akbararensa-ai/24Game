import React from 'react';
import { GameComponentProps } from '../types/arcade';
import {
  MemoryMatchGame,
  NumberMemoryGame,
  SequenceMemoryGame,
  VisualGridMemoryGame,
  WordMemoryGame,
  SpatialMemoryGame,
} from './memoryGames';
import {
  MentalMathGame,
  MathRushGame,
  MissingNumberGame,
  EquationPuzzleGame,
  NumberSequenceGame,
  Game24,
} from './mathGames';
import {
  PatternRecognitionGame,
  OddOneOutGame,
  LogicalDeductionGame,
  SudokuGame,
  NonogramGame,
  Game2048,
} from './logicGames';
import {
  ReactionTimeGame,
  ColorStroopGame,
  TargetTapGame,
  FastComparisonGame,
  SequenceRushGame,
  FocusTestGame,
} from './reflexGames';

export const GAME_COMPONENTS: Record<string, React.FC<GameComponentProps>> = {
  'memory-match': MemoryMatchGame,
  'number-memory': NumberMemoryGame,
  'sequence-memory': SequenceMemoryGame,
  'visual-grid-memory': VisualGridMemoryGame,
  'word-memory': WordMemoryGame,
  'spatial-memory': SpatialMemoryGame,
  'mental-math': MentalMathGame,
  'math-rush': MathRushGame,
  'missing-number': MissingNumberGame,
  'equation-puzzle': EquationPuzzleGame,
  'number-sequence': NumberSequenceGame,
  'game-24': Game24,
  'pattern-recognition': PatternRecognitionGame,
  'odd-one-out': OddOneOutGame,
  'logical-deduction': LogicalDeductionGame,
  sudoku: SudokuGame,
  nonogram: NonogramGame,
  'game-2048': Game2048,
  'reaction-time': ReactionTimeGame,
  'color-stroop': ColorStroopGame,
  'target-tap': TargetTapGame,
  'fast-comparison': FastComparisonGame,
  'sequence-rush': SequenceRushGame,
  'focus-test': FocusTestGame,
};
