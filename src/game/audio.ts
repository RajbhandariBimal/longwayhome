export type MusicTrackId = 'none' | 'mars' | 'moon' | 'action' | 'puzzle';
export type SfxCategory = 'gameplay' | 'ui';

export interface AudioSettings {
  muted: boolean;
  musicEnabled: boolean;
  gameplaySfxEnabled: boolean;
  uiSfxEnabled: boolean;
}

interface TrackData {
  bpm: number;
  /** 64 16th-note steps (4 bars of 16 steps). null = rest, number = MIDI note */
  lead: (number | null)[];
  arp: (number | null)[];
  bass: (number | null)[];
  /** 'K' = kick, 'S' = snare, 'H' = hi-hat, null = rest */
  drums: ('K' | 'S' | 'H' | null)[];
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// MIDI note constants for readable chiptune composition
const _ = null;
const C2 = 36, D2 = 38, E2 = 40, F2 = 41, G2 = 43, Ab2 = 44, A2 = 45, Bb2 = 46, B2 = 47;
const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, Ab3 = 56, A3 = 57, Bb3 = 58, B3 = 59;
const C4 = 60, Cs4 = 61, D4 = 62, Eb4 = 63, E4 = 64, F4 = 65, Fs4 = 66, G4 = 67, Ab4 = 68, A4 = 69, Bb4 = 70, B4 = 71;
const C5 = 72, D5 = 74, Eb5 = 75, E5 = 76, F5 = 77, Fs5 = 78, G5 = 79, Ab5 = 80, A5 = 81, Bb5 = 82, B5 = 83;
const C6 = 84, D6 = 86;

const TRACKS: Record<Exclude<MusicTrackId, 'none'>, TrackData> = {
  // Mars Exploration: Calm, spacious D-Dorian frontier theme (78 BPM)
  mars: {
    bpm: 78,
    lead: [
      D5, _, F5, _, A5, _, G5, _, F5, _, E5, _, D5, _, _, _,
      C5, _, E5, _, G5, _, F5, _, E5, _, C5, _, D5, _, _, _,
      Bb4, _, D5, _, F5, _, E5, _, D5, _, C5, _, Bb4, _, A4, _,
      G4, _, A4, _, Bb4, _, C5, _, E5, _, D5, _, A4, _, _, _,
    ],
    arp: [
      D4, _, A4, _, F4, _, A4, _, D4, _, A4, _, F4, _, A4, _,
      C4, _, G4, _, E4, _, G4, _, C4, _, G4, _, D4, _, A4, _,
      Bb3, _, F4, _, D4, _, F4, _, G3, _, D4, _, Bb3, _, D4, _,
      A3, _, E4, _, C4, _, E4, _, A3, _, Cs4, _, A3, _, _, _,
    ],
    bass: [
      D3, _, _, _, _, _, D3, _, D3, _, _, _, _, _, A2, _,
      C3, _, _, _, _, _, C3, _, C3, _, _, _, D3, _, _, _,
      Bb2, _, _, _, _, _, Bb2, _, G2, _, _, _, _, _, G2, _,
      A2, _, _, _, _, _, A2, _, A2, _, _, _, A2, _, _, _,
    ],
    drums: [
      'K', _, _, _, 'H', _, _, _, 'S', _, _, _, 'H', _, _, _,
      'K', _, _, _, 'H', _, _, _, 'S', _, _, _, 'H', _, 'H', _,
      'K', _, _, _, 'H', _, _, _, 'S', _, _, _, 'H', _, _, _,
      'K', _, _, _, 'H', _, _, _, 'S', _, _, 'H', 'S', _, _, _,
    ],
  },

  // Moon Exploration: Gentle, weightless A-minor cosmic drift (70 BPM)
  moon: {
    bpm: 70,
    lead: [
      E5, _, _, _, A5, _, G5, _, E5, _, _, _, C5, _, D5, _,
      E5, _, _, _, B5, _, A5, _, G5, _, _, _, E5, _, _, _,
      F5, _, _, _, A5, _, G5, _, E5, _, _, _, D5, _, C5, _,
      B4, _, _, _, E5, _, D5, _, C5, _, _, _, A4, _, _, _,
    ],
    arp: [
      A4, _, E5, _, C5, _, E5, _, A4, _, E5, _, C5, _, E5, _,
      G4, _, E5, _, B4, _, E5, _, G4, _, D5, _, B4, _, D5, _,
      F4, _, C5, _, A4, _, C5, _, D4, _, A4, _, F4, _, A4, _,
      E4, _, B4, _, G4, _, B4, _, E4, _, B4, _, A4, _, _, _,
    ],
    bass: [
      A2, _, _, _, _, _, _, _, A2, _, _, _, E2, _, _, _,
      G2, _, _, _, _, _, _, _, E2, _, _, _, G2, _, _, _,
      F2, _, _, _, _, _, _, _, D2, _, _, _, D2, _, _, _,
      E2, _, _, _, _, _, _, _, E2, _, _, _, A2, _, _, _,
    ],
    drums: [
      'K', _, _, _, _, _, 'H', _, 'S', _, _, _, _, _, 'H', _,
      'K', _, _, _, _, _, 'H', _, 'S', _, _, _, 'H', _, _, _,
      'K', _, _, _, _, _, 'H', _, 'S', _, _, _, _, _, 'H', _,
      'K', _, _, _, _, _, 'S', _, 'H', _, _, _, 'S', _, _, _,
    ],
  },

  // Action Minigames: Steady, warm 104 BPM Arcade Chiptune Groove
  action: {
    bpm: 104,
    lead: [
      C5, _, Eb5, _, G5, _, Eb5, _, F5, _, G5, _, Bb5, _, G5, _,
      Ab5, _, G5, _, F5, _, Eb5, _, D5, _, F5, _, D5, _, B4, _,
      C5, _, Eb5, _, G5, _, C6, _, Bb5, _, Ab5, _, G5, _, F5, _,
      Eb5, _, F5, _, G5, _, Eb5, _, D5, _, B4, _, C5, _, _, _,
    ],
    arp: [
      C4, _, G4, _, Eb4, _, C5, _, Bb3, _, F4, _, D4, _, Bb4, _,
      Ab3, _, Eb4, _, C4, _, Ab4, _, G3, _, D4, _, B3, _, G4, _,
      C4, _, G4, _, Eb4, _, C5, _, F3, _, C4, _, Ab3, _, F4, _,
      G3, _, Eb4, _, G3, _, D4, _, C4, _, G4, _, C4, _, _, _,
    ],
    bass: [
      C3, _, _, C3, _, _, C3, _, Bb2, _, _, Bb2, _, _, Bb2, _,
      Ab2, _, _, Ab2, _, _, Ab2, _, G2, _, _, G2, _, _, G2, _,
      C3, _, _, C3, _, _, C3, _, F2, _, _, F2, _, _, F2, _,
      G2, _, _, G2, _, _, G2, _, C3, _, G2, _, C3, _, _, _,
    ],
    drums: [
      'K', _, 'H', _, 'S', _, 'H', _, 'K', _, 'H', _, 'S', _, 'H', _,
      'K', _, 'H', _, 'S', _, 'H', _, 'K', _, 'S', _, 'H', _, 'S', _,
      'K', _, 'H', _, 'S', _, 'H', _, 'K', _, 'H', _, 'S', _, 'H', _,
      'K', _, 'H', _, 'S', _, 'H', _, 'K', _, 'S', _, 'K', _, 'H', _,
    ],
  },

  // Puzzle / Telemetry Minigames: Relaxed 84 BPM E-minor Pulse
  puzzle: {
    bpm: 84,
    lead: [
      E5, _, _, G5, B5, _, A5, _, G5, _, E5, _, D5, _, _, _,
      C5, _, E5, _, G5, _, Fs5, _, E5, _, D5, _, B4, _, _, _,
      E5, _, G5, _, B5, _, D6, _, C6, _, B5, _, A5, _, G5, _,
      Fs5, _, G5, _, A5, _, B5, _, G5, _, Fs5, _, E5, _, _, _,
    ],
    arp: [
      E4, _, B4, _, G4, _, B4, _, D4, _, A4, _, Fs4, _, A4, _,
      C4, _, G4, _, B3, _, Fs4, _, E4, _, B4, _, B3, _, Fs4, _,
      E4, _, B4, _, G4, _, B4, _, A3, _, E4, _, C4, _, E4, _,
      B3, _, Fs4, _, D4, _, Fs4, _, E4, _, B4, _, E4, _, _, _,
    ],
    bass: [
      E3, _, _, _, E3, _, _, _, D3, _, _, _, D3, _, _, _,
      C3, _, _, _, B2, _, _, _, E3, _, _, _, B2, _, _, _,
      E3, _, _, _, E3, _, _, _, A2, _, _, _, A2, _, _, _,
      B2, _, _, _, B2, _, _, _, E3, _, B2, _, E3, _, _, _,
    ],
    drums: [
      'K', _, _, _, 'S', _, 'H', _, 'K', _, _, _, 'S', _, 'H', _,
      'K', _, _, _, 'S', _, 'H', _, 'K', _, 'H', _, 'S', _, 'H', _,
      'K', _, _, _, 'S', _, 'H', _, 'K', _, _, _, 'S', _, 'H', _,
      'K', _, _, _, 'S', _, 'H', _, 'K', _, 'S', _, 'S', _, _, _,
    ],
  },
};

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private gameplaySfxGain: GainNode | null = null;
  private uiSfxGain: GainNode | null = null;

  private _muted = false;
  private _musicEnabled = true;
  private _gameplaySfxEnabled = true;
  private _uiSfxEnabled = true;

  private currentTrack: MusicTrackId = 'none';
  private schedulerTimer: number | null = null;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private lastRechargeAt = 0;

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this._muted = val;
    this.syncMasterGains();
    if (val) {
      this.stopSchedulerOnly();
    } else if (this.currentTrack !== 'none' && this._musicEnabled) {
      this.startScheduler();
    }
  }

  public get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  public set musicEnabled(val: boolean) {
    this._musicEnabled = val;
    this.syncMasterGains();
    if (!val) {
      this.stopSchedulerOnly();
    } else if (this.currentTrack !== 'none' && !this._muted) {
      this.startScheduler();
    }
  }

  public get musicMuted(): boolean {
    return !this._musicEnabled;
  }

  public set musicMuted(val: boolean) {
    this.musicEnabled = !val;
  }

  public get gameplaySfxEnabled(): boolean {
    return this._gameplaySfxEnabled;
  }

  public set gameplaySfxEnabled(val: boolean) {
    this._gameplaySfxEnabled = val;
    this.syncMasterGains();
  }

  public get uiSfxEnabled(): boolean {
    return this._uiSfxEnabled;
  }

  public set uiSfxEnabled(val: boolean) {
    this._uiSfxEnabled = val;
    this.syncMasterGains();
  }

  public getSettings(): AudioSettings {
    return {
      muted: this._muted,
      musicEnabled: this._musicEnabled,
      gameplaySfxEnabled: this._gameplaySfxEnabled,
      uiSfxEnabled: this._uiSfxEnabled,
    };
  }

  private syncMasterGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.gameplaySfxGain) {
      const target = this._muted || !this._gameplaySfxEnabled ? 0 : 1.0;
      this.gameplaySfxGain.gain.setTargetAtTime(target, now, 0.02);
    }
    if (this.uiSfxGain) {
      const target = this._muted || !this._uiSfxEnabled ? 0 : 1.0;
      this.uiSfxGain.gain.setTargetAtTime(target, now, 0.02);
    }
    if (this.musicGain) {
      const target = this._muted || !this._musicEnabled ? 0 : 0.18;
      this.musicGain.gain.setTargetAtTime(target, now, 0.06);
    }
  }

  private createContextIfNeeded(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.gameplaySfxGain) {
      this.gameplaySfxGain = this.ctx.createGain();
      this.gameplaySfxGain.gain.value = this._muted || !this._gameplaySfxEnabled ? 0 : 1.0;
      this.gameplaySfxGain.connect(this.ctx.destination);
    }
    if (this.ctx && !this.uiSfxGain) {
      this.uiSfxGain = this.ctx.createGain();
      this.uiSfxGain.gain.value = this._muted || !this._uiSfxEnabled ? 0 : 1.0;
      this.uiSfxGain.connect(this.ctx.destination);
    }
    if (this.ctx && !this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._muted || !this._musicEnabled ? 0 : 0.18;

      // Warm low-pass filter softens upper harmonics so chiptune BGM is gentle on the ear
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 1280;
      this.musicFilter.Q.value = 0.65;

      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx && !this.noiseBuffer) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 1.5, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  private ensureContext(category: SfxCategory): AudioContext | null {
    if (this._muted) return null;
    if (category === 'gameplay' && !this._gameplaySfxEnabled) return null;
    if (category === 'ui' && !this._uiSfxEnabled) return null;
    const ctx = this.createContextIfNeeded();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  public unlock() {
    const ctx = this.createContextIfNeeded();
    if (ctx && ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (this.currentTrack !== 'none' && !this._muted && this._musicEnabled) {
            this.startScheduler();
          }
        })
        .catch(() => {});
    } else if (ctx && this.currentTrack !== 'none' && !this._muted && this._musicEnabled) {
      this.startScheduler();
    }
  }

  public setMusicTrack(track: MusicTrackId) {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stepIndex = 0;
    this.stopSchedulerOnly();
    if (track !== 'none' && !this._muted && this._musicEnabled) {
      this.startScheduler();
    }
  }

  private stopSchedulerOnly() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private startScheduler() {
    if (typeof window === 'undefined') return;
    if (this.schedulerTimer !== null) return;
    const ctx = this.createContextIfNeeded();
    if (!ctx || ctx.state !== 'running') return;

    this.nextNoteTime = ctx.currentTime + 0.05;
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleAhead();
    }, 65);
  }

  private scheduleAhead() {
    if (this._muted || !this._musicEnabled || this.currentTrack === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicFilter) return;

    const track = TRACKS[this.currentTrack];
    const stepDur = 60 / track.bpm / 4; // 16th-note duration
    const lookahead = 0.2;

    if (this.nextNoteTime < ctx.currentTime - 0.3) {
      this.nextNoteTime = ctx.currentTime + 0.05;
    }

    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this.scheduleMusicStep(track, this.stepIndex, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  private scheduleMusicStep(
    track: TrackData,
    step: number,
    time: number,
    stepDur: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;

    // Gentle triangle melody lead (warm NES bell/flute tone)
    const leadMidi = track.lead[step];
    if (leadMidi !== null) {
      this.scheduleMusicOsc(midiToHz(leadMidi), time, stepDur * 1.9, 'triangle', 0.14);
    }

    // Soft sine arpeggio bed
    const arpMidi = track.arp[step];
    if (arpMidi !== null) {
      this.scheduleMusicOsc(midiToHz(arpMidi), time, stepDur * 1.15, 'sine', 0.065);
    }

    // Warm triangle bassline
    const bassMidi = track.bass[step];
    if (bassMidi !== null) {
      this.scheduleMusicOsc(midiToHz(bassMidi), time, stepDur * 1.7, 'triangle', 0.19);
    }

    // Muted, soft retro percussion
    const drum = track.drums[step];
    if (drum === 'K') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.16, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(gain);
      gain.connect(this.musicFilter);
      osc.start(time);
      osc.stop(time + 0.13);
    } else if (drum === 'S' && this.noiseBuffer) {
      this.scheduleMusicNoise(time, 0.085, 'bandpass', 1350, 0.055);
    } else if (drum === 'H' && this.noiseBuffer) {
      this.scheduleMusicNoise(time, 0.032, 'highpass', 4200, 0.022);
    }
  }

  private scheduleMusicOsc(
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    vol: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.024);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(time);
    osc.stop(time + dur + 0.025);
  }

  private scheduleMusicNoise(
    time: number,
    dur: number,
    filterType: BiquadFilterType,
    cutoff: number,
    vol: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(time);
    src.stop(time + dur + 0.015);
  }

  private getSfxTarget(category: SfxCategory): GainNode | null {
    return category === 'ui' ? this.uiSfxGain : this.gameplaySfxGain;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainLevel = 0.045,
    delay = 0,
    category: SfxCategory = 'gameplay'
  ) {
    const ctx = this.ensureContext(category);
    const target = this.getSfxTarget(category);
    if (!ctx || !target) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(target);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    startCutoff: number,
    endCutoff: number,
    gainLevel = 0.038,
    delay = 0,
    category: SfxCategory = 'gameplay'
  ) {
    const ctx = this.ensureContext(category);
    const target = this.getSfxTarget(category);
    if (!ctx || !this.noiseBuffer || !target) return;

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startCutoff, now);
    if (endCutoff !== startCutoff) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, endCutoff), now + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // --- Gameplay SFX ---

  playStep() {
    this.tone(112, 70, 0.042, 'triangle', 0.024, 0, 'gameplay');
    this.noiseBurst(0.032, 'bandpass', 880, 480, 0.012, 0, 'gameplay');
  }

  playMoonStep() {
    this.tone(175, 118, 0.055, 'sine', 0.022, 0, 'gameplay');
    this.noiseBurst(0.035, 'highpass', 1800, 900, 0.008, 0, 'gameplay');
  }

  playWaypoint() {
    this.tone(540, 740, 0.05, 'triangle', 0.026, 0, 'gameplay');
  }

  playRepair() {
    this.tone(392, 587, 0.08, 'triangle', 0.045, 0, 'gameplay');
    this.tone(587, 880, 0.1, 'triangle', 0.045, 0.06, 'gameplay');
    this.tone(880, 1175, 0.11, 'sine', 0.035, 0.12, 'gameplay');
  }

  playMine() {
    this.tone(180, 82, 0.1, 'triangle', 0.045, 0, 'gameplay');
    this.tone(300, 210, 0.07, 'triangle', 0.03, 0.04, 'gameplay');
    this.noiseBurst(0.08, 'lowpass', 1100, 300, 0.028, 0, 'gameplay');
  }

  playBuild() {
    this.tone(294, 440, 0.08, 'triangle', 0.045, 0, 'gameplay');
    this.tone(440, 587, 0.1, 'triangle', 0.045, 0.07, 'gameplay');
    this.tone(587, 784, 0.14, 'sine', 0.05, 0.14, 'gameplay');
  }

  playCoin() {
    this.tone(880, 880, 0.06, 'triangle', 0.04, 0, 'gameplay');
    this.tone(1175, 1175, 0.14, 'triangle', 0.042, 0.06, 'gameplay');
  }

  playPlutoniumHum() {
    this.tone(440, 660, 0.09, 'sine', 0.04, 0, 'gameplay');
    this.tone(660, 990, 0.14, 'triangle', 0.04, 0.06, 'gameplay');
    this.tone(1320, 1320, 0.18, 'sine', 0.03, 0.12, 'gameplay');
  }

  playSolDawn() {
    this.tone(392, 392, 0.14, 'triangle', 0.045, 0, 'gameplay');
    this.tone(494, 494, 0.14, 'triangle', 0.045, 0.12, 'gameplay');
    this.tone(587, 587, 0.25, 'triangle', 0.05, 0.24, 'gameplay');
    this.tone(784, 784, 0.28, 'sine', 0.035, 0.34, 'gameplay');
  }

  playAlert() {
    this.tone(330, 240, 0.13, 'triangle', 0.045, 0, 'gameplay');
    this.tone(330, 240, 0.13, 'triangle', 0.045, 0.18, 'gameplay');
  }

  playLowO2Beep() {
    this.tone(784, 784, 0.07, 'triangle', 0.036, 0, 'gameplay');
    this.tone(587, 587, 0.09, 'triangle', 0.036, 0.1, 'gameplay');
  }

  playWarningTick() {
    this.tone(620, 520, 0.06, 'triangle', 0.03, 0, 'gameplay');
    this.tone(620, 520, 0.06, 'triangle', 0.03, 0.11, 'gameplay');
  }

  playDustStorm() {
    this.noiseBurst(0.65, 'bandpass', 220, 880, 0.05, 0, 'gameplay');
    this.tone(200, 130, 0.35, 'triangle', 0.032, 0.05, 'gameplay');
  }

  playRecharge() {
    const now = performance.now();
    if (now - this.lastRechargeAt < 4000) return;
    this.lastRechargeAt = now;
    this.tone(440, 440, 0.07, 'triangle', 0.038, 0, 'gameplay');
    this.tone(554, 554, 0.07, 'triangle', 0.038, 0.07, 'gameplay');
    this.tone(659, 659, 0.13, 'sine', 0.038, 0.14, 'gameplay');
  }

  playJump() {
    this.tone(240, 540, 0.11, 'triangle', 0.04, 0, 'gameplay');
  }

  playLandingThud() {
    this.tone(125, 62, 0.075, 'triangle', 0.03, 0, 'gameplay');
    this.noiseBurst(0.05, 'lowpass', 620, 220, 0.018, 0, 'gameplay');
  }

  playRoverBoost() {
    this.tone(220, 440, 0.14, 'triangle', 0.035, 0, 'gameplay');
    this.tone(440, 660, 0.14, 'sine', 0.03, 0.08, 'gameplay');
  }

  playAirbagCollect() {
    this.tone(660, 880, 0.07, 'triangle', 0.042, 0, 'gameplay');
    this.tone(990, 1320, 0.12, 'sine', 0.045, 0.055, 'gameplay');
  }

  playImpact() {
    this.tone(150, 52, 0.22, 'sawtooth', 0.045, 0, 'gameplay');
    this.tone(98, 42, 0.24, 'triangle', 0.05, 0.03, 'gameplay');
    this.noiseBurst(0.18, 'lowpass', 820, 170, 0.048, 0, 'gameplay');
  }

  playRocketLaunch() {
    this.noiseBurst(0.95, 'lowpass', 240, 1400, 0.06, 0, 'gameplay');
    this.tone(110, 440, 0.75, 'triangle', 0.05, 0.05, 'gameplay');
    this.tone(220, 880, 0.65, 'sine', 0.04, 0.2, 'gameplay');
  }

  playTargetMiss() {
    this.tone(220, 155, 0.11, 'triangle', 0.04, 0, 'gameplay');
  }

  playEarthLock() {
    this.tone(523, 523, 0.09, 'triangle', 0.045, 0, 'gameplay');
    this.tone(659, 659, 0.09, 'triangle', 0.045, 0.09, 'gameplay');
    this.tone(784, 784, 0.09, 'triangle', 0.045, 0.18, 'gameplay');
    this.tone(1046, 1046, 0.12, 'triangle', 0.048, 0.27, 'gameplay');
    this.tone(1318, 1318, 0.28, 'sine', 0.05, 0.38, 'gameplay');
  }

  playMissionComplete() {
    this.tone(523, 523, 0.1, 'triangle', 0.042, 0, 'gameplay');
    this.tone(659, 659, 0.1, 'triangle', 0.042, 0.09, 'gameplay');
    this.tone(784, 784, 0.1, 'triangle', 0.042, 0.18, 'gameplay');
    this.tone(1046, 1046, 0.26, 'sine', 0.05, 0.27, 'gameplay');
  }

  playGameOver() {
    this.tone(392, 392, 0.18, 'triangle', 0.045, 0, 'gameplay');
    this.tone(370, 370, 0.18, 'triangle', 0.045, 0.2, 'gameplay');
    this.tone(349, 349, 0.18, 'triangle', 0.045, 0.4, 'gameplay');
    this.tone(330, 220, 0.45, 'triangle', 0.05, 0.6, 'gameplay');
    this.tone(130, 98, 0.55, 'sine', 0.055, 0.6, 'gameplay');
  }

  playVictory() {
    const notes: [number, number, number][] = [
      [523.25, 0, 0.12],
      [659.25, 0.13, 0.12],
      [783.99, 0.26, 0.12],
      [1046.5, 0.39, 0.26],
      [880.0, 0.68, 0.12],
      [987.77, 0.81, 0.12],
      [1046.5, 0.96, 0.38],
      [1318.5, 1.38, 0.14],
      [1567.98, 1.54, 0.48],
    ];
    for (const [f, d, dur] of notes) {
      this.tone(f, f, dur, 'triangle', 0.045, d, 'gameplay');
      this.tone(f / 2, f / 2, dur, 'sine', 0.04, d, 'gameplay');
    }
  }

  // --- UI & Dialogue SFX ---

  playUiClick() {
    this.tone(520, 660, 0.04, 'triangle', 0.028, 0, 'ui');
  }

  playUiOpen() {
    this.tone(440, 440, 0.045, 'triangle', 0.03, 0, 'ui');
    this.tone(660, 660, 0.075, 'sine', 0.03, 0.045, 'ui');
  }

  playUiClose() {
    this.tone(560, 560, 0.04, 'triangle', 0.026, 0, 'ui');
    this.tone(390, 390, 0.065, 'sine', 0.026, 0.04, 'ui');
  }

  playRadarPing() {
    this.tone(740, 980, 0.09, 'sine', 0.028, 0, 'ui');
  }

  playCameraSnap() {
    this.tone(460, 620, 0.05, 'sine', 0.025, 0, 'ui');
  }

  playPauseChime(paused: boolean) {
    if (paused) {
      this.tone(523, 523, 0.06, 'triangle', 0.03, 0, 'ui');
      this.tone(392, 392, 0.09, 'sine', 0.03, 0.06, 'ui');
    } else {
      this.tone(392, 392, 0.06, 'triangle', 0.03, 0, 'ui');
      this.tone(523, 523, 0.09, 'sine', 0.03, 0.06, 'ui');
    }
  }

  playTypingSkip() {
    this.tone(720, 880, 0.035, 'sine', 0.022, 0, 'ui');
  }

  playDialogueBlip() {
    this.tone(440, 500, 0.028, 'sine', 0.016, 0, 'ui');
  }

  playScanSweep() {
    this.tone(500, 920, 0.12, 'sine', 0.032, 0, 'ui');
  }
}

export const soundFX = new RetroAudioEngine();
