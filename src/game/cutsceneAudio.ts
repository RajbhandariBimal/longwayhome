// Synchronized 8-bit Web Audio engine for "Cosmo Boy: The Unlikely Return" (Scenes 07-10)

interface NoteCue {
  t: number;
  freq: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
}

// Scene 08 (6.5s - 14.5s) 8-bit breaking news stinger
const NEWS_FANFARE: NoteCue[] = [
  { t: 6.58, freq: 523.25, dur: 0.09, type: 'square', vol: 0.06 },
  { t: 6.68, freq: 523.25, dur: 0.09, type: 'square', vol: 0.06 },
  { t: 6.78, freq: 659.25, dur: 0.1, type: 'square', vol: 0.065 },
  { t: 6.9, freq: 783.99, dur: 0.12, type: 'square', vol: 0.07 },
  { t: 7.05, freq: 1046.5, dur: 0.28, type: 'square', vol: 0.075 },
  { t: 6.58, freq: 130.81, dur: 0.35, type: 'triangle', vol: 0.08 },
  { t: 7.05, freq: 196.0, dur: 0.35, type: 'triangle', vol: 0.08 },
];

// Scene 10 (20.0s - 27.0s) upbeat 8-bit victory fanfare melody + bass
const VICTORY_MELODY: NoteCue[] = [
  // Opening triumphant phrase
  { t: 20.15, freq: 523.25, dur: 0.12, type: 'square', vol: 0.055 },
  { t: 20.3, freq: 659.25, dur: 0.12, type: 'square', vol: 0.055 },
  { t: 20.45, freq: 783.99, dur: 0.14, type: 'square', vol: 0.06 },
  { t: 20.62, freq: 1046.5, dur: 0.32, type: 'square', vol: 0.07 },
  { t: 20.98, freq: 783.99, dur: 0.14, type: 'square', vol: 0.055 },
  { t: 21.15, freq: 1046.5, dur: 0.36, type: 'square', vol: 0.07 },
  // Bouncy second phrase
  { t: 21.65, freq: 880.0, dur: 0.14, type: 'square', vol: 0.055 },
  { t: 21.82, freq: 987.77, dur: 0.14, type: 'square', vol: 0.055 },
  { t: 22.0, freq: 1046.5, dur: 0.22, type: 'square', vol: 0.065 },
  { t: 22.28, freq: 783.99, dur: 0.15, type: 'square', vol: 0.055 },
  { t: 22.48, freq: 659.25, dur: 0.15, type: 'square', vol: 0.055 },
  { t: 22.68, freq: 783.99, dur: 0.35, type: 'square', vol: 0.065 },
  // Heroic finale climb
  { t: 23.2, freq: 587.33, dur: 0.14, type: 'square', vol: 0.055 },
  { t: 23.38, freq: 659.25, dur: 0.14, type: 'square', vol: 0.055 },
  { t: 23.56, freq: 783.99, dur: 0.14, type: 'square', vol: 0.06 },
  { t: 23.74, freq: 880.0, dur: 0.16, type: 'square', vol: 0.06 },
  { t: 23.94, freq: 987.77, dur: 0.18, type: 'square', vol: 0.065 },
  { t: 24.16, freq: 1046.5, dur: 0.45, type: 'square', vol: 0.075 },
  { t: 24.75, freq: 1318.5, dur: 0.16, type: 'square', vol: 0.06 },
  { t: 24.96, freq: 1567.98, dur: 0.55, type: 'square', vol: 0.075 },
  // Warm triangle bassline
  { t: 20.15, freq: 130.81, dur: 0.38, type: 'triangle', vol: 0.075 },
  { t: 20.62, freq: 196.0, dur: 0.42, type: 'triangle', vol: 0.075 },
  { t: 21.15, freq: 130.81, dur: 0.42, type: 'triangle', vol: 0.075 },
  { t: 21.65, freq: 174.61, dur: 0.32, type: 'triangle', vol: 0.075 },
  { t: 22.0, freq: 130.81, dur: 0.42, type: 'triangle', vol: 0.075 },
  { t: 22.68, freq: 196.0, dur: 0.42, type: 'triangle', vol: 0.075 },
  { t: 23.2, freq: 146.83, dur: 0.35, type: 'triangle', vol: 0.075 },
  { t: 23.74, freq: 196.0, dur: 0.35, type: 'triangle', vol: 0.075 },
  { t: 24.16, freq: 130.81, dur: 0.5, type: 'triangle', vol: 0.08 },
  { t: 24.96, freq: 261.63, dur: 0.65, type: 'triangle', vol: 0.08 },
];

export class Cutscene8BitAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private rumbleNode: AudioBufferSourceNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;

  private muted = false;
  private lastTelemetryStep = -1;
  private lastAnchorBlipStep = -1;
  private lastFlashStep = -1;
  private touchdownPlayed = false;
  private firedNotes = new Set<number>();

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 2, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  unlock() {
    this.ensureCtx();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopContinuous();
    }
  }

  resetForTime(t: number) {
    this.stopContinuous();
    this.lastTelemetryStep = t < 6.5 ? Math.floor(t / 0.85) : 999;
    this.lastAnchorBlipStep = t < 14.5 ? Math.floor((t - 7.3) / 0.14) : 999;
    this.lastFlashStep = t < 20.0 ? -1 : Math.floor((t - 21.0) / 1.1);
    this.touchdownPlayed = t >= 18.85;
    this.firedNotes.clear();
    // Mark earlier note cues as already played
    NEWS_FANFARE.forEach((n, idx) => {
      if (n.t < t) this.firedNotes.add(idx);
    });
    VICTORY_MELODY.forEach((n, idx) => {
      if (n.t < t) this.firedNotes.add(100 + idx);
    });
  }

  stopContinuous() {
    if (this.rumbleNode) {
      try {
        this.rumbleNode.stop();
        this.rumbleNode.disconnect();
      } catch {
        // ignore
      }
      this.rumbleNode = null;
      this.rumbleFilter = null;
      this.rumbleGain = null;
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    dur: number,
    type: OscillatorType = 'square',
    vol = 0.05
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private playNoiseBurst(dur: number, cutoff: number, vol: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  private updateContinuousNoise(active: boolean, cutoff: number, targetGain: number) {
    if (!active || this.muted) {
      if (this.rumbleGain && this.ctx) {
        this.rumbleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
      if (!active && this.rumbleNode) {
        this.stopContinuous();
      }
      return;
    }

    const ctx = this.ensureCtx();
    if (!ctx || !this.noiseBuffer) return;

    if (!this.rumbleNode) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      this.rumbleNode = src;
      this.rumbleFilter = filter;
      this.rumbleGain = gain;
    }

    if (this.rumbleFilter && this.rumbleGain) {
      this.rumbleFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.08);
      this.rumbleGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    }
  }

  update(t: number, isPlaying: boolean) {
    if (!isPlaying || this.muted) {
      this.stopContinuous();
      return;
    }

    // Scene 07 (0.0s - 6.5s): Atmospheric rumble + telemetry tones
    if (t < 6.5) {
      const intensity = Math.sin(Math.min(1, t / 6.2) * Math.PI);
      this.updateContinuousNoise(true, 180 + intensity * 260, 0.028 + intensity * 0.036);

      const step = Math.floor(t / 0.85);
      if (step > this.lastTelemetryStep) {
        this.lastTelemetryStep = step;
        const pitch = step % 2 === 0 ? 920 : 1240;
        this.playTone(pitch, pitch, 0.055, 'square', 0.025);
      }
      return;
    }

    // Scene 08 (6.5s - 14.5s): 8-bit news fanfare + anchor speech blips
    if (t < 14.5) {
      this.updateContinuousNoise(false, 200, 0);

      NEWS_FANFARE.forEach((n, idx) => {
        if (t >= n.t && !this.firedNotes.has(idx)) {
          this.firedNotes.add(idx);
          this.playTone(n.freq, n.freq, n.dur, n.type, n.vol);
        }
      });

      if (t >= 7.35 && t <= 13.9) {
        const blipStep = Math.floor((t - 7.35) / 0.14);
        if (blipStep > this.lastAnchorBlipStep) {
          this.lastAnchorBlipStep = blipStep;
          if (blipStep % 7 !== 0) {
            const f = 390 + ((blipStep * 53) % 140);
            this.playTone(f, f + 20, 0.032, 'triangle', 0.018);
          }
        }
      }
      return;
    }

    // Scene 09 (14.5s - 20.0s): Retro-thruster hiss + touchdown thud
    if (t < 20.0) {
      const thrustActive = t >= 14.55 && t < 18.85;
      const thrustStrength = thrustActive ? 0.048 : 0;
      this.updateContinuousNoise(thrustActive, 640, thrustStrength);

      if (t >= 18.85 && !this.touchdownPlayed) {
        this.touchdownPlayed = true;
        this.playTone(135, 42, 0.28, 'triangle', 0.095);
        this.playNoiseBurst(0.24, 340, 0.075);
      }
      return;
    }

    // Scene 10 (20.0s - 27.0s): Victory fanfare + camera shutter pops
    this.updateContinuousNoise(false, 200, 0);
    VICTORY_MELODY.forEach((n, idx) => {
      const key = 100 + idx;
      if (t >= n.t && !this.firedNotes.has(key)) {
        this.firedNotes.add(key);
        this.playTone(n.freq, n.freq, n.dur, n.type, n.vol);
      }
    });

    if (t >= 21.1 && t <= 26.2) {
      const fStep = Math.floor((t - 21.1) / 1.15);
      if (fStep > this.lastFlashStep) {
        this.lastFlashStep = fStep;
        this.playTone(1750, 880, 0.035, 'square', 0.022);
      }
    }
  }
}
