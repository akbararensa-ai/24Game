import React, { useRef, useState } from 'react';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import { DatabaseManager } from '../core/database';
import { ArcadeSettings, PlayerProfile, ThemeSetting } from '../types/arcade';

interface SettingsModalProps {
  profile: PlayerProfile;
  settings: ArcadeSettings;
  onUpdateProfile: (next: PlayerProfile) => void;
  onUpdateSettings: (next: ArcadeSettings) => void;
  onDatabaseReload: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  settings,
  onUpdateProfile,
  onUpdateSettings,
  onDatabaseReload,
  onClose,
}) => {
  const [nameInput, setNameInput] = useState(profile.username);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim().slice(0, 24) || 'Player One';
    onUpdateProfile({ ...profile, username: cleaned });
    setStatusMsg({ type: 'ok', text: 'Username berhasil diperbarui.' });
  };

  const handleExport = () => {
    const data = DatabaseManager.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infinite-arcade-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ type: 'ok', text: 'Data progres berhasil diekspor ke JSON.' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = DatabaseManager.importAll(text);
      if (res.ok) {
        onDatabaseReload();
        setStatusMsg({ type: 'ok', text: 'Data progres berhasil dipulihkan!' });
      } else {
        setStatusMsg({ type: 'err', text: res.error });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmReset = () => {
    DatabaseManager.resetAll();
    onDatabaseReload();
    setConfirmReset(false);
    setStatusMsg({ type: 'ok', text: 'Seluruh progres telah direset ke kondisi awal.' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6 my-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Pengaturan & Profil Lokal
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Username */}
        <form onSubmit={saveUsername} className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Nama Pemain
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={24}
              className="flex-1 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              Simpan
            </button>
          </div>
        </form>

        {/* Audio & Motion */}
        <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Efek Suara (Web Audio)</div>
              <div className="text-xs text-slate-500">Suara sintetis tanpa file eksternal</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                settings.soundEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Volume Suara</span>
              <span className="font-mono-num">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) =>
                onUpdateSettings({ ...settings, volume: Number(e.target.value) / 100 })
              }
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Animasi Antarmuka</div>
              <div className="text-xs text-slate-500">Transisi halus antar elemen</div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, animationsEnabled: !settings.animationsEnabled })
              }
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                settings.animationsEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.animationsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kurangi Gerakan (Reduced Motion)</div>
              <div className="text-xs text-slate-500">Minimalkan efek gerak cepat</div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })
              }
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                settings.reducedMotion
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.reducedMotion ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tema Tampilan</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'navy', label: 'Deep Navy' },
                  { id: 'midnight', label: 'Midnight' },
                  { id: 'light', label: 'Light Mode' },
                ] as { id: ThemeSetting; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, theme: t.id })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                    settings.theme === t.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LocalStorage Export / Import / Reset */}
        <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Cadangkan & Manajemen Data Lokal
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-500 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Seluruh Progres</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-2">
              <div className="text-xs text-rose-300 font-medium">
                Yakin hapus semua XP, skor tertinggi, riwayat, dan pencapaian?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                >
                  Ya, Hapus Semua
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </div>
    </div>
  );
};
