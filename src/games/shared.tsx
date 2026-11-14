import React from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';
import { AudioManager } from '../core/audio';

export type ShapeKind =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cross';

export const SHAPE_KINDS: ShapeKind[] = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'pentagon',
  'hexagon',
  'star',
  'cross',
];

export const SHAPE_PALETTE = [
  '#3B82F6', // electric blue
  '#06B6D4', // cyan
  '#8B5CF6', // purple
  '#10B981', // emerald
  '#F59E0B', // amber
  '#F43F5E', // rose
];

export function GeometricShape({
  shape,
  color = '#3B82F6',
  size = 36,
  rotation = 0,
  hollow = false,
  dots = 0,
}: {
  shape: ShapeKind;
  color?: string;
  size?: number;
  rotation?: number;
  hollow?: boolean;
  dots?: number;
}) {
  const fill = hollow ? 'none' : color;
  const stroke = color;
  const strokeWidth = hollow ? 3.2 : 1.5;

  const renderShape = () => {
    switch (shape) {
      case 'circle':
        return <circle cx="24" cy="24" r="15" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
      case 'triangle':
        return <polygon points="24,7 41,38 7,38" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      case 'square':
        return <rect x="9" y="9" width="30" height="30" rx="3" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
      case 'diamond':
        return <polygon points="24,6 42,24 24,42 6,24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      case 'pentagon':
        return <polygon points="24,6 41,19 35,39 13,39 7,19" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      case 'hexagon':
        return <polygon points="24,6 39,15 39,33 24,42 9,33 9,15" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      case 'star':
        return (
          <polygon
            points="24,5 29.5,17 42,18.5 32.5,27.5 35,40.5 24,34 13,40.5 15.5,27.5 6,18.5 18.5,17"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      case 'cross':
        return (
          <path
            d="M19 8H29V19H40V29H29V40H19V29H8V19H19V8Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ transform: `rotate(${rotation}deg)` }}
      className="transition-transform duration-150 select-none shrink-0"
    >
      {renderShape()}
      {dots > 0 && (
        <g fill={hollow ? color : '#060A13'}>
          {dots >= 1 && <circle cx="24" cy="24" r="2.6" />}
          {dots >= 2 && <circle cx="17" cy="24" r="2.3" />}
          {dots >= 3 && <circle cx="31" cy="24" r="2.3" />}
          {dots >= 4 && <circle cx="24" cy="17" r="2.3" />}
        </g>
      )}
    </svg>
  );
}

export function TouchKeypad({
  value,
  onChange,
  onSubmit,
  allowNegative = false,
  disabled = false,
  submitLabel = 'Jawab',
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  allowNegative?: boolean;
  disabled?: boolean;
  submitLabel?: string;
}) {
  const pushDigit = (d: string) => {
    if (disabled) return;
    AudioManager.click();
    if (value.length >= 18) return;
    onChange(value + d);
  };

  const toggleSign = () => {
    if (disabled || !allowNegative) return;
    AudioManager.click();
    if (value.startsWith('-')) onChange(value.slice(1));
    else onChange('-' + value);
  };

  const backspace = () => {
    if (disabled) return;
    AudioManager.click();
    onChange(value.slice(0, -1));
  };

  return (
    <div className="w-full max-w-xs mx-auto select-none">
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => pushDigit(digit)}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/80 dark:bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 text-lg font-mono-num font-semibold text-slate-100 transition-transform duration-100 cursor-pointer disabled:opacity-40"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={allowNegative ? toggleSign : backspace}
          className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 active:scale-95 border border-slate-700/50 text-sm font-medium text-slate-300 flex items-center justify-center transition-transform duration-100 cursor-pointer disabled:opacity-40"
        >
          {allowNegative ? '+/−' : <Delete className="w-5 h-5" />}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => pushDigit('0')}
          className="h-12 sm:h-13 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 text-lg font-mono-num font-semibold text-slate-100 transition-transform duration-100 cursor-pointer disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          aria-label="Hapus digit"
          className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 active:scale-95 border border-slate-700/50 text-slate-300 flex items-center justify-center transition-transform duration-100 cursor-pointer disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
      <button
        type="button"
        disabled={disabled || value.length === 0 || value === '-'}
        onClick={onSubmit}
        className="mt-2.5 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
      >
        <span>{submitLabel}</span>
        <CornerDownLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
