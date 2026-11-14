import React from 'react';
import {
  Award,
  Brain,
  Calculator,
  CheckSquare,
  Compass,
  Crown,
  Flame,
  Grid3x3,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  Sigma,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { ACHIEVEMENTS, getCategoryBrainScores } from '../core/progression';
import { getGameById } from '../core/registry';
import {
  GameHistoryEntry,
  GameStatEntry,
  UnlockedAchievement,
} from '../types/arcade';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Brain,
  Zap,
  Calculator,
  Award,
  Compass,
  Infinity: InfinityIcon,
  Sigma,
  Grid3x3,
  CheckSquare,
  Flame,
  Layers,
  Trophy,
  Crown,
};

export const StatsAndAchievements: React.FC<{
  stats: Record<string, GameStatEntry>;
  bestScores: Record<string, number>;
  history: GameHistoryEntry[];
  achievements: Record<string, UnlockedAchievement>;
}> = ({ stats, bestScores, history, achievements }) => {
  const brain = getCategoryBrainScores(stats, bestScores);
  const recentScores = [...history].slice(0, 12).reverse();
  const maxRecent = Math.max(100, ...recentScores.map((h) => h.score));

  // Radar Chart math (4 axes: Memory top, Math right, Logic bottom, Reflex left)
  const cx = 110;
  const cy = 110;
  const rMax = 76;
  const pMem = (brain.memory / 100) * rMax;
  const pMath = (brain.math / 100) * rMax;
  const pLogic = (brain.logic / 100) * rMax;
  const pReflex = (brain.reflex / 100) * rMax;

  const radarPoints = [
    `${cx},${cy - Math.max(8, pMem)}`,
    `${cx + Math.max(8, pMath)},${cy}`,
    `${cx},${cy + Math.max(8, pLogic)}`,
    `${cx - Math.max(8, pReflex)},${cy}`,
  ].join(' ');

  return (
    <div className="space-y-10">
      {/* Brain Radar & Trend Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row items-center gap-6">
          <svg width="220" height="220" viewBox="0 0 220 220" className="shrink-0">
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <polygon
                key={ring}
                points={`${cx},${cy - rMax * ring} ${cx + rMax * ring},${cy} ${cx},${cy + rMax * ring} ${cx - rMax * ring},${cy}`}
                fill="none"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
              />
            ))}
            <line x1={cx} y1={cy - rMax} x2={cx} y2={cy + rMax} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <line x1={cx - rMax} y1={cy} x2={cx + rMax} y2={cy} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <polygon
              points={radarPoints}
              fill="rgba(59, 130, 246, 0.25)"
              stroke="#3B82F6"
              strokeWidth="2.5"
            />
            <text x={cx} y="18" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold">Memory</text>
            <text x="208" y={cy + 4} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold">Math</text>
            <text x={cx} y="210" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold">Logic</text>
            <text x="12" y={cy + 4} textAnchor="start" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold">Reflex</text>
          </svg>

          <div className="flex-1 w-full space-y-3">
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
              Indeks Kemampuan Otak
            </h3>
            {(
              [
                { label: 'Memory Lab', val: brain.memory, color: 'bg-blue-500' },
                { label: 'Calculate Arena', val: brain.math, color: 'bg-cyan-500' },
                { label: 'Logic Zone', val: brain.logic, color: 'bg-violet-500' },
                { label: 'Reflex Arena', val: brain.reflex, color: 'bg-emerald-500' },
              ] as const
            ).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{row.label}</span>
                  <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{row.val}/100</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score Trend Bar Chart */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
              Tren Skor 12 Sesi Terakhir
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {history.length} total sesi
            </span>
          </div>

          {recentScores.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-slate-500">
              Mainkan game pertamamu untuk melihat grafik perkembangan skor.
            </div>
          ) : (
            <div className="h-40 flex items-end gap-2 pt-4">
              {recentScores.map((item) => {
                const hPct = Math.max(8, Math.round((item.score / maxRecent) * 100));
                const gName = getGameById(item.gameId)?.title || item.gameId;
                return (
                  <div
                    key={item.id}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group"
                    title={`${gName}: ${item.score}`}
                  >
                    <div className="text-[10px] font-mono-num text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.score}
                    </div>
                    <div
                      className="w-full max-w-[26px] rounded-t-md bg-blue-500/80 hover:bg-cyan-400 transition-colors"
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            Pencapaian
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {Object.keys(achievements).length} / {ACHIEVEMENTS.length} Terbuka
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = achievements[ach.id];
            const Icon = ICON_MAP[ach.iconKey] || Trophy;
            return (
              <div
                key={ach.id}
                className={`rounded-xl border p-4 flex items-start gap-3.5 transition-colors ${
                  unlocked
                    ? 'bg-white dark:bg-slate-900 border-blue-500/40'
                    : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-65'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    unlocked
                      ? 'bg-blue-500/15 text-blue-500 dark:text-cyan-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {unlocked ? <Icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {ach.name}
                    </h4>
                    <span className="text-[11px] font-mono-num text-emerald-500 shrink-0">
                      +{ach.xpBonus} XP
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {ach.description}
                  </p>
                  <div className="text-[11px] text-slate-500">
                    {unlocked
                      ? `Terbuka · ${new Date(unlocked.unlockedAt).toLocaleDateString('id-ID')}`
                      : `Syarat: ${ach.requirementLabel}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <h3 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
          Riwayat Permainan Terbaru
        </h3>
        {history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500">
            Belum ada sesi permainan tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Game</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold text-right">Skor</th>
                  <th className="py-3 px-4 font-semibold text-right">Akurasi</th>
                  <th className="py-3 px-4 font-semibold text-right">Level</th>
                  <th className="py-3 px-4 font-semibold text-right">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {history.slice(0, 15).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {getGameById(row.gameId)?.title || row.gameId}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {row.mode} · {row.difficulty}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-cyan-600 dark:text-cyan-400">
                      {row.score.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {row.accuracy}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {row.levelReached}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-emerald-600 dark:text-emerald-400">
                      +{row.xpEarned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
