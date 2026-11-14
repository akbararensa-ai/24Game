import { ArcadeSettings } from '../types/arcade';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.65;

  public configure(settings: Pick<ArcadeSettings, 'soundEnabled' | 'volume'>) {
    this.enabled = settings.soundEnabled;
    this.volume = Math.max(0, Math.min(1, settings.volume));
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainMultiplier = 0.2,
    delaySec = 0,
    slideToFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx || this.volume <= 0.01) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), now + durationSec);
    }

    const peak = Math.max(0.001, this.volume * gainMultiplier);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public click() {
    this.playTone(540, 0.055, 'triangle', 0.14, 0, 420);
  }

  public flip() {
    this.playTone(360, 0.07, 'sine', 0.14, 0, 520);
  }

  public correct() {
    this.playTone(523.25, 0.09, 'triangle', 0.18, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.18, 0.06);
  }

  public combo(streak: number) {
    const base = Math.min(880, 440 + streak * 32);
    this.playTone(base, 0.08, 'sine', 0.18, 0);
    this.playTone(base * 1.25, 0.13, 'triangle', 0.18, 0.05);
  }

  public wrong() {
    this.playTone(210, 0.14, 'sawtooth', 0.13, 0, 130);
    this.playTone(155, 0.18, 'sawtooth', 0.11, 0.08, 105);
  }

  public tick() {
    this.playTone(760, 0.035, 'sine', 0.08, 0);
  }

  public sequenceNote(index: number) {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5];
    const freq = scale[index % scale.length];
    this.playTone(freq, 0.19, 'sine', 0.22, 0);
  }

  public levelUp() {
    this.playTone(440, 0.1, 'triangle', 0.18, 0);
    this.playTone(554.37, 0.1, 'triangle', 0.18, 0.08);
    this.playTone(659.25, 0.12, 'triangle', 0.19, 0.16);
    this.playTone(880, 0.22, 'sine', 0.22, 0.24);
  }

  public achievement() {
    this.playTone(587.33, 0.1, 'sine', 0.2, 0);
    this.playTone(739.99, 0.1, 'sine', 0.2, 0.09);
    this.playTone(880, 0.12, 'sine', 0.2, 0.18);
    this.playTone(1174.66, 0.26, 'triangle', 0.22, 0.27);
  }

  public gameOver() {
    this.playTone(392, 0.15, 'triangle', 0.16, 0, 311);
    this.playTone(311, 0.18, 'triangle', 0.15, 0.14, 246);
    this.playTone(233, 0.28, 'sine', 0.15, 0.29, 174);
  }
}

export const AudioManager = new AudioEngine();
