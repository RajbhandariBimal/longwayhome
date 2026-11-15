import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Moon,
  RotateCcw,
  Send,
  Sun,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { soundFX } from '../game/audio';
import { PixelatedIngenuityModel } from './IngenuityDialogueModal';

export interface BlindLandingModalProps {
  alreadyCompleted?: boolean;
  onMissionSuccess: (summary: {
    steelAlloys: number;
    flightsSent: number;
    vectorsUsed: number;
  }) => void;
  onExitToMars: () => void;
}

type DirectionCmd = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Coord = readonly [number, number];
type FlightPhase = 'PLANNING' | 'EXECUTING' | 'CRASHED' | 'FAILED_LANDING' | 'SECTOR_CLEARED' | 'MISSION_SUCCESS';

interface SectorConfig {
  id: number;
  name: string;
  start: Coord;
  pad: Coord;
  battery: number;
  ridges: Coord[];
}

const GRID_COLS = 9;
const GRID_ROWS = 7;
const STEP_MS = 320;
const CRASH_RESET_MS = 1150;

const SECTORS: SectorConfig[] = [
  {
    id: 1,
    name: 'JEZERO RIDGE APPROACH',
    start: [0, 3],
    pad: [8, 3],
    battery: 14,
    ridges: [
      [4, 2],
      [4, 3],
      [4, 4],
      [4, 5],
      [4, 6],
    ],
  },
  {
    id: 2,
    name: 'NERETVA CANYON SLALOM',
    start: [0, 0],
    pad: [8, 6],
    battery: 24,
    ridges: [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [5, 6],
      [5, 5],
      [5, 4],
      [5, 3],
      [5, 2],
      [7, 1],
      [7, 2],
      [7, 3],
    ],
  },
  {
    id: 3,
    name: 'BELVA BASIN GAUNTLET',
    start: [4, 6],
    pad: [4, 0],
    battery: 12,
    ridges: [
      [3, 5],
      [5, 5],
      [3, 3],
      [4, 3],
      [5, 3],
      [2, 2],
      [6, 2],
      [1, 4],
      [7, 4],
      [3, 1],
      [5, 1],
    ],
  },
];

const DIR_DELTA: Record<DirectionCmd, { dx: number; dy: number; symbol: string; tilt: number }> = {
  UP: { dx: 0, dy: -1, symbol: '↑', tilt: 0 },
  DOWN: { dx: 0, dy: 1, symbol: '↓', tilt: 0 },
  LEFT: { dx: -1, dy: 0, symbol: '←', tilt: -11 },
  RIGHT: { dx: 1, dy: 0, symbol: '→', tilt: 11 },
};

function isSameCoord(a: Coord, b: Coord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function isRidgeAt(x: number, y: number, ridges: Coord[]): boolean {
  return ridges.some(([rx, ry]) => rx === x && ry === y);
}

function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

/** Self-contained Web Audio API retro telemetry SFX synthesizer */
class TelemetryAudio {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), t + duration);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  click() {
    this.playTone(620, 780, 0.045, 'square', 0.025);
  }

  undo() {
    this.playTone(460, 300, 0.06, 'triangle', 0.032);
  }

  transmit() {
    this.playTone(440, 880, 0.09, 'sawtooth', 0.028, 0);
    this.playTone(660, 1180, 0.11, 'triangle', 0.035, 0.08);
  }

  rotorStep(stepIndex: number) {
    const base = 180 + (stepIndex % 2) * 28;
    this.playTone(base, base * 0.72, 0.08, 'triangle', 0.03, 0);
    this.playTone(540, 480, 0.035, 'sine', 0.015, 0.015);
  }

  crash() {
    this.playTone(165, 38, 0.32, 'sawtooth', 0.065, 0);
    this.playTone(110, 32, 0.36, 'square', 0.045, 0.03);
  }

  unsafeLanding() {
    this.playTone(310, 180, 0.16, 'sawtooth', 0.04, 0);
    this.playTone(230, 130, 0.22, 'sawtooth', 0.04, 0.16);
  }

  sectorClear() {
    this.playTone(523.25, 523.25, 0.09, 'triangle', 0.04, 0);
    this.playTone(659.25, 659.25, 0.09, 'triangle', 0.04, 0.08);
    this.playTone(783.99, 783.99, 0.18, 'triangle', 0.048, 0.16);
  }

  victoryFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, idx === notes.length - 1 ? 0.35 : 0.11, 'triangle', 0.048, idx * 0.095);
    });
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

/** Metallic Steel Alloy Ingot SVG icon */
const SteelAlloyIngotIcon: React.FC<{ lit?: boolean; className?: string }> = ({
  lit = true,
  className = 'w-6 h-4',
}) => (
  <svg viewBox="0 0 36 22" className={className} aria-hidden="true">
    <polygon
      points="6,4 30,4 34,11 30,18 6,18 2,11"
      fill={lit ? '#64748b' : '#1f2937'}
      stroke={lit ? '#e2e8f0' : '#374151'}
      strokeWidth="1.5"
    />
    <polygon
      points="8,6 28,6 30,10 6,10"
      fill={lit ? '#cbd5e1' : '#374151'}
    />
    <polygon
      points="6,11 30,11 28,16 8,16"
      fill={lit ? '#475569' : '#111827'}
    />
    {lit && (
      <>
        <rect x="12" y="7" width="12" height="2" fill="#f8fafc" opacity="0.7" />
        <circle cx="18" cy="13.5" r="2" fill="#f59e0b" />
      </>
    )}
  </svg>
);

/** Helicopter Emblem SVG for Top Header */
const HelicopterEmblem: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
    <rect x="2" y="2" width="32" height="32" rx="4" fill="#18120c" stroke="#f59e0b" strokeWidth="1.5" />
    <line x1="6" y1="10" x2="30" y2="10" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="9" y1="13" x2="27" y2="13" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="17" y="10" width="2" height="7" fill="#cbd5e1" />
    <rect x="13" y="16" width="10" height="7" rx="1.5" fill="#f59e0b" stroke="#fde68a" strokeWidth="1" />
    <circle cx="18" cy="19.5" r="1.8" fill="#0f172a" />
    <line x1="14" y1="23" x2="10" y2="29" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="22" y1="23" x2="26" y2="29" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="8" y1="29" x2="12" y2="29" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    <line x1="24" y1="29" x2="28" y2="29" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Pixelated Ingenuity Helicopter Sprite wrapper with hover bob, banking tilt, and crash state */
const IngenuitySprite: React.FC<{
  spinning: boolean;
  tiltDeg: number;
  crashed: boolean;
}> = ({ spinning, tiltDeg, crashed }) => (
  <div
    className="w-full h-full flex items-center justify-center pointer-events-none"
    style={{
      transform: `rotate(${crashed ? 28 : tiltDeg}deg) ${crashed ? 'scale(0.88)' : ''}`,
      transition: 'transform 180ms ease-out',
    }}
  >
    <div
      className={`w-[92%] h-[92%] drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)] ${
        spinning ? 'animate-[bounce_0.55s_ease-in-out_infinite]' : ''
      }`}
    >
      <PixelatedIngenuityModel spinning={spinning} crashed={crashed} className="w-full h-full" />
    </div>
  </div>
);

/** Jagged Layered Dark-Red Martian Ridge Obstacle SVG */
const RidgeObstacleTile: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div
    className={`relative w-full h-full overflow-hidden border ${
      isDark
        ? 'bg-[#360d10]/88 border-rose-500/45'
        : 'bg-[#5c161c]/88 border-rose-700/60'
    }`}
  >
    {/* Diagonal Red/Dark Hazard Hatching */}
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-55" preserveAspectRatio="none">
      <defs>
        <pattern
          id="blRidgeHatch"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="14" fill="rgba(185, 28, 28, 0.35)" />
          <rect x="7" width="7" height="14" fill="rgba(24, 6, 8, 0.45)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#blRidgeHatch)" />
    </svg>

    {/* Jagged Layered Mountain Peak */}
    <svg viewBox="0 0 100 100" className="relative z-10 w-full h-full p-1.5">
      <polygon points="8,86 31,26 51,64 68,18 92,86" fill="#450a0a" stroke="#991b1b" strokeWidth="2.5" />
      <polygon points="15,84 31,32 45,62 34,84" fill="#7f1d1d" />
      <polygon points="48,84 68,24 86,84 64,84" fill="#6b1414" />
      <polygon points="31,32 39,49 27,48" fill="#b91c1c" opacity="0.65" />
      <polygon points="68,24 75,45 62,43" fill="#dc2626" opacity="0.55" />
      <polyline
        points="20,76 35,54 48,68 65,45 80,76"
        fill="none"
        stroke="#fca5a5"
        strokeWidth="1.6"
        opacity="0.35"
      />
    </svg>

    {/* Corner Hazard LED Pip */}
    <span className="absolute top-1 right-1 z-20 w-1.5 h-1.5 bg-rose-500 shadow-[0_0_5px_#f43f5e]" />
  </div>
);

/** Analog PWR Semicircular Needle Gauge */
const AnalogPowerGauge: React.FC<{ ratio: number; isDark: boolean }> = ({ ratio, isDark }) => {
  const clamped = Math.max(0, Math.min(1, ratio));
  const angleDeg = -82 + clamped * 164; // -82deg (empty left) to +82deg (full right)
  const needleColor =
    clamped > 0.5 ? '#22c55e' : clamped > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className={`px-2 py-1 border rounded-sm flex items-center justify-center ${
        isDark ? 'bg-[#080c11] border-[#26303d]' : 'bg-[#1a222d] border-[#475569]'
      }`}
    >
      <svg viewBox="0 0 84 48" className="w-16 h-9" aria-label={`Power ${Math.round(clamped * 100)}%`}>
        {/* Scale Arc: Red -> Amber -> Green */}
        <path
          d="M 10 40 A 32 32 0 0 1 25 13"
          fill="none"
          stroke="#ef4444"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 28 11.5 A 32 32 0 0 1 56 11.5"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 59 13 A 32 32 0 0 1 74 40"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Tick marks */}
        <line x1="12" y1="40" x2="17" y2="38" stroke="#94a3b8" strokeWidth="1" />
        <line x1="42" y1="8" x2="42" y2="14" stroke="#94a3b8" strokeWidth="1" />
        <line x1="72" y1="40" x2="67" y2="38" stroke="#94a3b8" strokeWidth="1" />

        {/* Sweeping Needle */}
        <g
          transform={`translate(42, 40) rotate(${angleDeg})`}
          style={{ transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <line x1="0" y1="0" x2="0" y2="-26" stroke={needleColor} strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <circle cx="42" cy="40" r="4" fill="#cbd5e1" stroke="#0f172a" strokeWidth="1.2" />
      </svg>
    </div>
  );
};

export const BlindLandingModal: React.FC<BlindLandingModalProps> = ({
  alreadyCompleted = false,
  onMissionSuccess,
  onExitToMars,
}) => {
  const [sectorIdx, setSectorIdx] = useState(0);
  const [clearedSectors, setClearedSectors] = useState<number[]>([]);
  const [queue, setQueue] = useState<DirectionCmd[]>([]);
  const [phase, setPhase] = useState<FlightPhase>('PLANNING');
  const [heliPos, setHeliPos] = useState<Coord>(SECTORS[0].start);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(-1);
  const [failedStepIdx, setFailedStepIdx] = useState<number>(-1);
  const [statusMessage, setStatusMessage] = useState<string>(
    `SECTOR 1: QUEUE UP TO ${SECTORS[0].battery} MOVES, THEN SEND FLIGHT.`
  );
  const [lastClearedWasNewAlloy, setLastClearedWasNewAlloy] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [muted, setMuted] = useState(
    () => soundFX.muted || !soundFX.gameplaySfxEnabled
  );
  const [boardShake, setBoardShake] = useState(false);
  const [explosionPos, setExplosionPos] = useState<Coord | null>(null);
  const [flightsSent, setFlightsSent] = useState(0);
  const [totalVectorsUsed, setTotalVectorsUsed] = useState(0);
  const [rewardDispatched, setRewardDispatched] = useState(false);

  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<TelemetryAudio | null>(null);
  const timersRef = useRef<number[]>([]);
  const sectorIdxRef = useRef(0);
  const phaseRef = useRef<FlightPhase>('PLANNING');

  const sector = SECTORS[sectorIdx];
  const remainingBattery = Math.max(0, sector.battery - queue.length);
  const currentTilt =
    phase === 'EXECUTING' && activeStepIdx >= 0 && queue[activeStepIdx]
      ? DIR_DELTA[queue[activeStepIdx]].tilt
      : 0;

  useEffect(() => {
    sectorIdxRef.current = sectorIdx;
  }, [sectorIdx]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const engine = new TelemetryAudio();
    audioRef.current = engine;
    return () => {
      for (const id of timersRef.current) {
        window.clearTimeout(id);
      }
      timersRef.current = [];
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const selectSector = useCallback(
    (idx: number) => {
      if (phaseRef.current === 'EXECUTING') return;
      clearAllTimers();
      const next = SECTORS[idx];
      setSectorIdx(idx);
      setQueue([]);
      setHeliPos(next.start);
      setActiveStepIdx(-1);
      setFailedStepIdx(-1);
      setExplosionPos(null);
      setBoardShake(false);
      setPhase('PLANNING');
      setStatusMessage(
        `SECTOR ${next.id}: QUEUE UP TO ${next.battery} MOVES, THEN SEND FLIGHT.`
      );
      audioRef.current?.click();
    },
    [clearAllTimers]
  );

  // Precompute planned flight trajectory for SVG overlay
  const plannedTrajectory = useMemo(() => {
    const points: { x: number; y: number; ok: boolean }[] = [
      { x: sector.start[0], y: sector.start[1], ok: true },
    ];
    let cx = sector.start[0];
    let cy = sector.start[1];
    let collided = false;

    for (const cmd of queue) {
      const { dx, dy } = DIR_DELTA[cmd];
      cx += dx;
      cy += dy;
      if (!isInBounds(cx, cy) || isRidgeAt(cx, cy, sector.ridges)) {
        collided = true;
        points.push({ x: cx, y: cy, ok: false });
        break;
      }
      points.push({ x: cx, y: cy, ok: true });
    }

    return { points, collided };
  }, [queue, sector]);

  // Procedural Martian Regolith + Animated Dust Particles Canvas
  useEffect(() => {
    const canvas = terrainCanvasRef.current;
    if (!canvas) return;
    let rafId = 0;

    // Build deterministic offscreen regolith terrain texture once per sector
    const offscreen = document.createElement('canvas');
    const W = 540;
    const H = 420;
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext('2d');

    const seeded = (n: number) => {
      const s = Math.sin(n * 12.9898 + (sector.id + 1) * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    if (octx) {
      const cellW = W / GRID_COLS;
      const cellH = H / GRID_ROWS;

      // Pixelated Martian terrain blocks with organic rust/ochre height noise
      const pxSize = 6;
      for (let py = 0; py < H; py += pxSize) {
        for (let px = 0; px < W; px += pxSize) {
          const n1 = Math.sin(px * 0.018 + sector.id * 2.1) * Math.cos(py * 0.021 - sector.id);
          const n2 = Math.sin((px + py) * 0.045 + sector.id * 4.3) * 0.5;
          const jitter = seeded(px * 31 + py * 17) * 0.35;
          const val = n1 * 0.45 + n2 * 0.3 + jitter;

          if (val > 0.38) {
            octx.fillStyle = '#c86432';
          } else if (val > 0.14) {
            octx.fillStyle = '#ac4b23';
          } else if (val > -0.15) {
            octx.fillStyle = '#8b3719';
          } else if (val > -0.38) {
            octx.fillStyle = '#6c2814';
          } else {
            octx.fillStyle = '#531d10';
          }
          octx.fillRect(px, py, pxSize, pxSize);
        }
      }

      // Wind ripples across dunes
      octx.fillStyle = 'rgba(235, 138, 78, 0.22)';
      for (let i = 0; i < 42; i++) {
        const rx = seeded(i * 11 + 3) * (W - 60);
        const ry = seeded(i * 19 + 7) * (H - 10);
        const rw = 24 + seeded(i * 23) * 44;
        octx.fillRect(Math.floor(rx), Math.floor(ry), Math.floor(rw), 2);
      }

      // Micro impact craters
      for (let i = 0; i < 14; i++) {
        const cx = 24 + seeded(i * 41 + 1) * (W - 48);
        const cy = 24 + seeded(i * 53 + 2) * (H - 48);
        const cr = 6 + seeded(i * 61 + 5) * 12;
        octx.fillStyle = 'rgba(42, 12, 8, 0.45)';
        octx.beginPath();
        octx.arc(cx, cy, cr, 0, Math.PI * 2);
        octx.fill();
        octx.strokeStyle = 'rgba(224, 118, 66, 0.38)';
        octx.lineWidth = 2;
        octx.beginPath();
        octx.arc(cx, cy, cr, Math.PI * 0.9, Math.PI * 1.9);
        octx.stroke();
      }

      // Scattered basalt pebbles
      for (let i = 0; i < 85; i++) {
        const px = seeded(i * 71) * W;
        const py = seeded(i * 89) * H;
        octx.fillStyle = i % 3 === 0 ? '#3a140d' : '#d97745';
        octx.fillRect(Math.floor(px), Math.floor(py), 3, 2);
      }

      // Subtle tactical grid bevel lines
      octx.strokeStyle = 'rgba(25, 10, 6, 0.55)';
      octx.lineWidth = 1.5;
      for (let c = 0; c <= GRID_COLS; c++) {
        const gx = Math.round(c * cellW);
        octx.beginPath();
        octx.moveTo(gx, 0);
        octx.lineTo(gx, H);
        octx.stroke();
      }
      for (let r = 0; r <= GRID_ROWS; r++) {
        const gy = Math.round(r * cellH);
        octx.beginPath();
        octx.moveTo(0, gy);
        octx.lineTo(W, gy);
        octx.stroke();
      }
    }

    const dustMotes = Array.from({ length: 34 }, (_, i) => ({
      x: (i * 57) % W,
      y: (i * 43) % H,
      len: 4 + (i % 4) * 3,
      speed: 22 + (i % 5) * 11,
      alpha: 0.14 + (i % 3) * 0.08,
    }));

    let last = performance.now();
    const renderLoop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(offscreen, 0, 0);

        // Drifting Martian dust motes
        for (const m of dustMotes) {
          m.x += m.speed * dt;
          m.y += m.speed * 0.14 * dt;
          if (m.x > W + 12) m.x = -12;
          if (m.y > H + 8) m.y = -8;
          ctx.fillStyle = `rgba(253, 186, 116, ${m.alpha})`;
          ctx.fillRect(Math.round(m.x), Math.round(m.y), m.len, 1.5);
        }

        // Faint amber orbital radar rings & crosshairs
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
        ctx.lineWidth = 1;
        const rcx = W / 2;
        const rcy = H / 2;
        for (const r of [75, 145, 220]) {
          ctx.beginPath();
          ctx.arc(rcx, rcy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(rcx, 0);
        ctx.lineTo(rcx, H);
        ctx.moveTo(0, rcy);
        ctx.lineTo(W, rcy);
        ctx.stroke();
        ctx.restore();
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [sector.id]);

  // Queue Commands
  const pushMove = useCallback(
    (dir: DirectionCmd) => {
      if (phaseRef.current !== 'PLANNING') return;
      setQueue((prev) => {
        if (prev.length >= SECTORS[sectorIdxRef.current].battery) return prev;
        audioRef.current?.click();
        return [...prev, dir];
      });
    },
    []
  );

  const undoMove = useCallback(() => {
    if (phaseRef.current !== 'PLANNING') return;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      audioRef.current?.undo();
      return prev.slice(0, -1);
    });
  }, []);

  const clearQueue = useCallback(() => {
    if (phaseRef.current !== 'PLANNING') return;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      audioRef.current?.undo();
      return [];
    });
  }, []);

  const resetSectorAfterFailure = useCallback((sec: SectorConfig) => {
    scheduleTimeout(() => {
      setHeliPos(sec.start);
      setActiveStepIdx(-1);
      setFailedStepIdx(-1);
      setExplosionPos(null);
      setBoardShake(false);
      setQueue([]);
      setPhase('PLANNING');
      setStatusMessage(
        `SECTOR ${sec.id}: QUEUE UP TO ${sec.battery} MOVES, THEN SEND FLIGHT.`
      );
    }, CRASH_RESET_MS);
  }, [scheduleTimeout]);

  const sendFlight = useCallback(() => {
    if (phaseRef.current !== 'PLANNING' || queue.length === 0) return;

    const activeSector = SECTORS[sectorIdxRef.current];
    const commands = [...queue];

    clearAllTimers();
    setPhase('EXECUTING');
    setActiveStepIdx(0);
    setFailedStepIdx(-1);
    setExplosionPos(null);
    setBoardShake(false);
    setFlightsSent((f) => f + 1);
    setTotalVectorsUsed((v) => v + commands.length);
    setStatusMessage(`UPLINK TRANSMITTED · EXECUTING ${commands.length} AUTOPILOT VECTORS...`);
    audioRef.current?.transmit();

    let curX = activeSector.start[0];
    let curY = activeSector.start[1];

    const runStep = (idx: number) => {
      if (idx >= commands.length) {
        // Sequence finished — check touchdown
        if (isSameCoord([curX, curY], activeSector.pad)) {
          const alreadyHasAlloy = clearedSectors.includes(activeSector.id);
          const nextCleared = alreadyHasAlloy
            ? clearedSectors
            : [...clearedSectors, activeSector.id];

          setClearedSectors(nextCleared);
          setLastClearedWasNewAlloy(!alreadyHasAlloy);
          setActiveStepIdx(-1);

          if (nextCleared.length >= SECTORS.length) {
            setPhase('MISSION_SUCCESS');
            setStatusMessage(
              `TOUCHDOWN CONFIRMED AT (${curX},${curY})! ALL 3 STEEL ALLOYS RECOVERED.`
            );
            audioRef.current?.victoryFanfare();
          } else {
            setPhase('SECTOR_CLEARED');
            setStatusMessage(
              `TOUCHDOWN CONFIRMED AT (${curX},${curY})! ${
                alreadyHasAlloy ? 'SECTOR RE-VERIFIED.' : '+1 STEEL ALLOY RECOVERED.'
              }`
            );
            audioRef.current?.sectorClear();
          }
        } else {
          setPhase('FAILED_LANDING');
          setFailedStepIdx(commands.length - 1);
          setBoardShake(true);
          setStatusMessage(
            `UNSAFE LANDING AT (${curX},${curY}) — MISSED PAD (${activeSector.pad[0]},${activeSector.pad[1]}). REBOOTING...`
          );
          audioRef.current?.unsafeLanding();
          resetSectorAfterFailure(activeSector);
        }
        return;
      }

      const cmd = commands[idx];
      const { dx, dy } = DIR_DELTA[cmd];
      const nx = curX + dx;
      const ny = curY + dy;

      setActiveStepIdx(idx);
      audioRef.current?.rotorStep(idx);

      if (!isInBounds(nx, ny)) {
        const clampedX = Math.max(-0.35, Math.min(GRID_COLS - 0.65, nx));
        const clampedY = Math.max(-0.35, Math.min(GRID_ROWS - 0.65, ny));
        setHeliPos([clampedX, clampedY]);
        scheduleTimeout(() => {
          setPhase('CRASHED');
          setFailedStepIdx(idx);
          setExplosionPos([
            Math.max(0, Math.min(GRID_COLS - 1, curX)),
            Math.max(0, Math.min(GRID_ROWS - 1, curY)),
          ]);
          setBoardShake(true);
          setStatusMessage(
            `SIGNAL LOST AT STEP ${idx + 1}: FLEW OFF RADAR BOUNDARY! RESETTING...`
          );
          audioRef.current?.crash();
          resetSectorAfterFailure(activeSector);
        }, STEP_MS);
        return;
      }

      curX = nx;
      curY = ny;
      setHeliPos([nx, ny]);

      if (isRidgeAt(nx, ny, activeSector.ridges)) {
        scheduleTimeout(() => {
          setPhase('CRASHED');
          setFailedStepIdx(idx);
          setExplosionPos([nx, ny]);
          setBoardShake(true);
          setStatusMessage(
            `CRASH AT (${nx},${ny}): COLLISION WITH MARS RIDGE! RESETTING...`
          );
          audioRef.current?.crash();
          resetSectorAfterFailure(activeSector);
        }, STEP_MS);
        return;
      }

      scheduleTimeout(() => {
        runStep(idx + 1);
      }, STEP_MS);
    };

    scheduleTimeout(() => {
      runStep(0);
    }, 180);
  }, [queue, clearedSectors, clearAllTimers, scheduleTimeout, resetSectorAfterFailure]);

  const handleDeployNextSector = useCallback(() => {
    const nextUnclearedIdx = SECTORS.findIndex((s) => !clearedSectors.includes(s.id));
    const targetIdx =
      nextUnclearedIdx !== -1 ? nextUnclearedIdx : (sectorIdx + 1) % SECTORS.length;
    selectSector(targetIdx);
  }, [clearedSectors, sectorIdx, selectSector]);

  const handlePlayAgain = useCallback(() => {
    clearAllTimers();
    setClearedSectors([]);
    setFlightsSent(0);
    setTotalVectorsUsed(0);
    setLastClearedWasNewAlloy(false);
    setSectorIdx(0);
    setQueue([]);
    setHeliPos(SECTORS[0].start);
    setActiveStepIdx(-1);
    setFailedStepIdx(-1);
    setExplosionPos(null);
    setBoardShake(false);
    setPhase('PLANNING');
    setStatusMessage(
      `SECTOR 1: QUEUE UP TO ${SECTORS[0].battery} MOVES, THEN SEND FLIGHT.`
    );
    audioRef.current?.click();
  }, [clearAllTimers]);

  const handleReturnWithSuccess = useCallback(() => {
    audioRef.current?.click();
    if (!rewardDispatched) {
      setRewardDispatched(true);
      onMissionSuccess({
        steelAlloys: 3,
        flightsSent,
        vectorsUsed: totalVectorsUsed,
      });
    } else {
      onExitToMars();
    }
  }, [rewardDispatched, onMissionSuccess, onExitToMars, flightsSent, totalVectorsUsed]);

  // Full keyboard support: WASD / Arrows, Backspace/Z, C/Esc, Enter
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        clearQueue();
        return;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        pushMove('UP');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        pushMove('DOWN');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        pushMove('LEFT');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        pushMove('RIGHT');
      } else if (e.code === 'Backspace' || e.code === 'KeyZ') {
        e.preventDefault();
        e.stopPropagation();
        undoMove();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        e.stopPropagation();
        clearQueue();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (phaseRef.current === 'SECTOR_CLEARED') {
          handleDeployNextSector();
        } else if (phaseRef.current === 'PLANNING') {
          sendFlight();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pushMove, undoMove, clearQueue, sendFlight, handleDeployNextSector]);

  // Theme tokens (Dark Industrial Steel vs Light NASA Aerospace Console)
  const chassisOuter = isDark
    ? 'bg-[#090c10] text-stone-100 border-[#28313e]'
    : 'bg-[#cbd2dc] text-slate-900 border-[#64748b]';
  const panelBg = isDark
    ? 'bg-[#12171f] border-[#26303d]'
    : 'bg-[#dde3eb] border-[#94a3b8]';
  const recessedBg = isDark
    ? 'bg-[#0a0d12] border-[#222b36]'
    : 'bg-[#1c2430] border-[#475569] text-stone-100';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const statusToneClass =
    phase === 'CRASHED' || phase === 'FAILED_LANDING'
      ? 'text-rose-400 border-rose-500/60 bg-rose-950/50'
      : phase === 'SECTOR_CLEARED' || phase === 'MISSION_SUCCESS'
      ? 'text-emerald-400 border-emerald-500/60 bg-emerald-950/45'
      : 'text-amber-300 border-amber-500/40 bg-[#0c1016]';

  const powerRatio = remainingBattery / sector.battery;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 overflow-y-auto ${
        isDark ? 'bg-[#050608]/90 bl-grid-backdrop' : 'bg-slate-900/75 bl-grid-backdrop'
      }`}
    >
      {/* Main Command Center Chassis */}
      <div
        className={`relative w-full max-w-[1360px] border-2 shadow-[0_24px_60px_rgba(0,0,0,0.85)] font-tech overflow-hidden ${chassisOuter}`}
      >
        {/* Subtle CRT Scanlines + Vignette Overlay */}
        <div className="pointer-events-none fixed sm:absolute inset-0 bl-scanlines opacity-20 z-30" />
        <div className="pointer-events-none absolute inset-0 bl-vignette opacity-45 z-30" />

        {/* Corner Rivets */}
        <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-slate-500/70 border border-black/70 z-20" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-500/70 border border-black/70 z-20" />
        <span className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full bg-slate-500/70 border border-black/70 z-20" />
        <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-500/70 border border-black/70 z-20" />

        <div className="relative z-10 p-3 sm:p-4 space-y-2.5">
          {/* 1. TOP HEADER BAR */}
          <header
            className={`border px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-3 ${panelBg}`}
          >
            {/* Left: Emblem + Stencil Title */}
            <div className="flex items-center gap-3">
              <HelicopterEmblem className="w-9 h-9 shrink-0" />
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-stencil text-xl sm:text-2xl tracking-wider text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.45)] leading-none">
                    BLIND LANDING
                  </h1>
                  {alreadyCompleted && (
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                      RELAY ONLINE
                    </span>
                  )}
                </div>
                <p
                  className={`font-mono-tabular text-[10px] sm:text-[11px] tracking-[0.14em] uppercase mt-0.5 ${mutedText}`}
                >
                  JPL FLIGHT DECK · INGENUITY MARS AUTOPILOT
                </p>
              </div>
            </div>

            {/* Right: Recessed Digital Telemetry Bay + Hardware Toggle Switches + Return */}
            <div className="flex flex-wrap items-center gap-2.5 ml-auto">
              {/* Recessed Digital Telemetry Bay */}
              <div
                className={`border px-3 py-1.5 flex flex-wrap items-center gap-3 sm:gap-4 font-mono-tabular text-xs ${recessedBg}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">LVL:</span>
                  <span className="font-bold text-amber-300">{sector.id}/3</span>
                </div>

                <div className="h-4 w-px bg-slate-700" />

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">ALLOY:</span>
                  <span className="font-bold text-emerald-300">
                    {clearedSectors.length}/3
                  </span>
                  <div className="flex items-center gap-1 ml-0.5">
                    {SECTORS.map((s) => {
                      const has = clearedSectors.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          title={`Sector ${s.id} Steel Alloy`}
                          className={`p-0.5 border ${
                            has
                              ? 'border-amber-400/80 bg-amber-500/15 shadow-[0_0_6px_rgba(245,158,11,0.45)]'
                              : 'border-slate-700 bg-slate-900/70'
                          }`}
                        >
                          <SteelAlloyIngotIcon lit={has} className="w-5 h-3" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-slate-400">BAT:</span>
                  <span
                    className={`font-bold ${
                      powerRatio > 0.5
                        ? 'text-emerald-400'
                        : powerRatio > 0.25
                        ? 'text-amber-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {String(remainingBattery).padStart(2, '0')}/
                    {String(sector.battery).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Vintage Hardware Toggle Switches */}
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                title={muted ? 'Enable Telemetry SFX' : 'Mute Telemetry SFX'}
                className={`border px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-mono-tabular font-bold uppercase cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#1a212b] hover:bg-[#232c39] border-[#354254] text-stone-200'
                    : 'bg-[#cfd7e3] hover:bg-[#c1cbd9] border-[#64748b] text-slate-900'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    muted
                      ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                      : 'bg-emerald-400 shadow-[0_0_6px_#4ade80]'
                  }`}
                />
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>SFX</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioRef.current?.click();
                  setIsDark((d) => !d);
                }}
                title="Toggle Dark / Light Console Finish"
                className={`border px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-mono-tabular font-bold uppercase cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#1a212b] hover:bg-[#232c39] border-[#354254] text-stone-200'
                    : 'bg-[#cfd7e3] hover:bg-[#c1cbd9] border-[#64748b] text-slate-900'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isDark
                      ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                      : 'bg-sky-500 shadow-[0_0_6px_#0ea5e9]'
                  }`}
                />
                {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                <span>{isDark ? 'DARK' : 'LIGHT'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioRef.current?.click();
                  onExitToMars();
                }}
                className={`border px-2.5 py-1.5 flex items-center gap-1 text-[11px] font-mono-tabular font-bold uppercase cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#231618] hover:bg-[#381d20] border-rose-500/50 text-rose-200'
                    : 'bg-rose-100 hover:bg-rose-200 border-rose-400 text-rose-900'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>RETURN</span>
              </button>
            </div>
          </header>

          {/* 2. MISSION INSTRUMENT STRIP */}
          <div
            className={`relative border px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-3 ${panelBg}`}
          >
            {/* Left: Sector Title + Backlit 1/2/3 Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono-tabular font-bold tracking-wider">
                  <span className={isDark ? 'text-stone-200' : 'text-slate-800'}>SECTOR</span>
                  <span className="px-1.5 py-0.5 bg-[#0a0d12] border border-amber-400/70 text-amber-300">
                    {sector.id}
                  </span>
                  <span className={isDark ? 'text-stone-300' : 'text-slate-700'}>OF 3</span>
                </div>
                <div
                  className={`font-mono-tabular text-[11px] tracking-[0.12em] uppercase mt-0.5 ${mutedText}`}
                >
                  {sector.name}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {SECTORS.map((s, idx) => {
                  const active = idx === sectorIdx;
                  const cleared = clearedSectors.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={phase === 'EXECUTING'}
                      onClick={() => selectSector(idx)}
                      className={`relative w-9 h-9 font-mono-tabular text-sm font-bold border transition-all cursor-pointer disabled:cursor-not-allowed ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                          : isDark
                          ? 'bg-[#1a2029] hover:bg-[#252d3a] border-[#334155] text-slate-300'
                          : 'bg-slate-200 hover:bg-slate-300 border-slate-400 text-slate-800'
                      }`}
                    >
                      {s.id}
                      {cleared && (
                        <span
                          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80]"
                          title="Sector Cleared"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Analog PWR Gauge + Rugged CELLS Tracking Bar */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-2">
                <span className={`font-mono-tabular text-[11px] font-bold ${mutedText}`}>
                  PWR
                </span>
                <AnalogPowerGauge ratio={powerRatio} isDark={isDark} />
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-mono-tabular text-[11px] font-bold ${mutedText}`}>
                  CELLS
                </span>
                <div
                  className={`border px-2 py-1.5 flex items-center gap-[3px] ${recessedBg}`}
                  title={`${remainingBattery} / ${sector.battery} power cells remaining`}
                >
                  {Array.from({ length: sector.battery }).map((_, idx) => {
                    const lit = idx < remainingBattery;
                    const cellColor = !lit
                      ? 'bg-slate-800/70 border-slate-700/60'
                      : powerRatio <= 0.25
                      ? 'bg-rose-500 border-rose-300/70 shadow-[0_0_6px_rgba(244,63,94,0.75)] animate-pulse'
                      : powerRatio <= 0.5
                      ? 'bg-amber-400 border-amber-200/70 shadow-[0_0_5px_rgba(251,191,36,0.6)]'
                      : 'bg-emerald-400 border-emerald-200/70 shadow-[0_0_5px_rgba(52,211,153,0.55)]';
                    return (
                      <span
                        key={idx}
                        className={`inline-block w-1.5 sm:w-2 h-4 border transition-colors duration-150 ${cellColor}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. MAIN COMMAND WORKSPACE (Left Radar Board + Right Flight Nav Computer) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.52fr_1fr] gap-3 items-stretch">
            {/* CENTER-LEFT: TACTICAL RADAR BOARD */}
            <section className={`relative border p-3 flex flex-col gap-2.5 ${panelBg}`}>
              {/* Status Banner above grid */}
              <div
                className={`border px-3 py-2 flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-[11px] sm:text-xs font-bold tracking-wide transition-colors ${statusToneClass}`}
              >
                <span className="truncate">{statusMessage}</span>
                <span className="shrink-0 opacity-90">
                  POS ({Math.round(heliPos[0])},{Math.round(heliPos[1])}) · PAD (
                  {sector.pad[0]},{sector.pad[1]})
                </span>
              </div>

              {/* Metal Bezel + Coordinates + 9x7 Radar Grid */}
              <div
                className={`border p-2.5 flex-1 flex flex-col justify-between gap-1.5 ${recessedBg} ${
                  boardShake ? 'animate-bl-shake' : ''
                }`}
              >
                {/* Top Bezel Telemetry */}
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 tracking-wider px-1">
                  <span>CAM: ORBITAL-01 · REGOLITH RADAR</span>
                  <span className="hidden sm:inline text-amber-300/80">
                    DELAY: +11M 24S · ALT: 5.0M
                  </span>
                </div>

                {/* X-Axis 0..8 Labels + Y-Axis 0..6 Labels + Grid */}
                <div className="flex flex-col gap-1">
                  {/* X-axis row */}
                  <div className="grid grid-cols-[20px_1fr] gap-1">
                    <div />
                    <div className="grid grid-cols-9 text-center font-mono-tabular text-[10px] text-amber-300/75 font-bold">
                      {Array.from({ length: GRID_COLS }).map((_, col) => (
                        <span key={col}>{col}</span>
                      ))}
                    </div>
                  </div>

                  {/* Y-axis column + Interactive Radar Board */}
                  <div className="grid grid-cols-[20px_1fr] gap-1 items-stretch">
                    {/* Y-axis 0..6 */}
                    <div className="grid grid-rows-7 items-center text-center font-mono-tabular text-[10px] text-amber-300/75 font-bold">
                      {Array.from({ length: GRID_ROWS }).map((_, row) => (
                        <span key={row}>{row}</span>
                      ))}
                    </div>

                    {/* 9x7 Radar Canvas + SVG Overlays */}
                    <div className="relative w-full aspect-[9/7] border border-amber-500/35 overflow-hidden bg-[#3a160c]">
                      {/* Procedural Martian Regolith Canvas */}
                      <canvas
                        ref={terrainCanvasRef}
                        className="absolute inset-0 w-full h-full block pixelated"
                      />

                      {/* Tile Layer (Start reticle, Ridges, Landing Pad) */}
                      <div className="relative z-10 grid grid-cols-9 grid-rows-7 w-full h-full">
                        {Array.from({ length: GRID_ROWS }).map((_, y) =>
                          Array.from({ length: GRID_COLS }).map((__, x) => {
                            const isStart = isSameCoord([x, y], sector.start);
                            const isPad = isSameCoord([x, y], sector.pad);
                            const isRidge = isRidgeAt(x, y, sector.ridges);
                            const alloyCollected = clearedSectors.includes(sector.id);

                            return (
                              <div key={`${x}-${y}`} className="relative w-full h-full">
                                {/* Start Tile Dashed Amber Launch Reticle */}
                                {isStart && (
                                  <div className="absolute inset-1 border border-dashed border-amber-300/80 bg-amber-500/10 pointer-events-none" />
                                )}

                                {/* Ridge Obstacle Tile */}
                                {isRidge && <RidgeObstacleTile isDark={isDark} />}

                                {/* Landing Pad Tile */}
                                {isPad && (
                                  <div className="relative w-full h-full border border-emerald-400/85 bg-emerald-500/20 flex items-center justify-center">
                                    {/* Animated Radar Ping Rings */}
                                    <span className="absolute w-7 h-7 rounded-full border border-emerald-300/70 animate-ping" />
                                    <span className="relative w-6 h-6 rounded-full border-2 border-emerald-300/90 flex items-center justify-center bg-emerald-950/50">
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                                    </span>

                                    {/* Uncollected Steel Alloy Ingot Badge */}
                                    {!alloyCollected && (
                                      <div
                                        title="Steel Alloy Reward"
                                        className="absolute bottom-0.5 right-0.5 bg-[#0c1118]/90 border border-amber-300/70 px-0.5 py-[1px] shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                                      >
                                        <SteelAlloyIngotIcon lit className="w-4 h-2.5" />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Planned Flight Path SVG Overlay */}
                      <svg
                        viewBox="0 0 900 700"
                        className="absolute inset-0 w-full h-full z-15 pointer-events-none"
                      >
                        <defs>
                          <filter id="blPathGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        {plannedTrajectory.points.length > 1 &&
                          plannedTrajectory.points.slice(1).map((pt, i) => {
                            const prev = plannedTrajectory.points[i];
                            const x1 = prev.x * 100 + 50;
                            const y1 = prev.y * 100 + 50;
                            const x2 = pt.x * 100 + 50;
                            const y2 = pt.y * 100 + 50;
                            const mx = (x1 + x2) / 2;
                            const my = (y1 + y2) / 2;
                            const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                            const strokeColor = pt.ok ? '#fbbf24' : '#f43f5e';

                            return (
                              <g key={i} filter="url(#blPathGlow)" opacity={phase === 'EXECUTING' ? 0.5 : 0.85}>
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={strokeColor}
                                  strokeWidth="4.5"
                                  strokeDasharray="9 7"
                                  strokeLinecap="round"
                                />
                                {/* Directional Arrow Chevron */}
                                <g transform={`translate(${mx}, ${my}) rotate(${ang})`}>
                                  <polyline
                                    points="-7,-6 4,0 -7,6"
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </g>
                                {/* Waypoint Dot */}
                                <circle
                                  cx={x2}
                                  cy={y2}
                                  r={pt.ok ? 6 : 9}
                                  fill={pt.ok ? '#fde68a' : '#f43f5e'}
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                />
                              </g>
                            );
                          })}
                      </svg>

                      {/* Ingenuity Helicopter Sprite (smooth 320ms step translation) */}
                      <div
                        className="absolute top-0 left-0 z-20 pointer-events-none"
                        style={{
                          width: `${100 / GRID_COLS}%`,
                          height: `${100 / GRID_ROWS}%`,
                          transform: `translate3d(${heliPos[0] * 100}%, ${heliPos[1] * 100}%, 0)`,
                          transition:
                            phase === 'EXECUTING' ? `transform ${STEP_MS}ms linear` : 'none',
                        }}
                      >
                        <IngenuitySprite
                          spinning={phase === 'EXECUTING'}
                          tiltDeg={currentTilt}
                          crashed={phase === 'CRASHED'}
                        />
                      </div>

                      {/* Crash Explosion Burst Overlay */}
                      {explosionPos && (
                        <div
                          className="absolute top-0 left-0 z-25 pointer-events-none flex items-center justify-center"
                          style={{
                            width: `${100 / GRID_COLS}%`,
                            height: `${100 / GRID_ROWS}%`,
                            transform: `translate3d(${explosionPos[0] * 100}%, ${
                              explosionPos[1] * 100
                            }%, 0)`,
                          }}
                        >
                          <div className="w-12 h-12 rounded-full bg-orange-500/80 border-2 border-yellow-200 animate-ping" />
                          <div className="absolute w-7 h-7 rounded-full bg-rose-600/90 border border-amber-200" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Bezel Telemetry */}
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 tracking-wider px-1 pt-0.5">
                  <span>GRID: 9×7 TACTICAL</span>
                  <span>WIND: 4.2 M/S ENE · DUST: MODERATE</span>
                </div>
              </div>

              {/* Legend Row */}
              <div
                className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono-tabular uppercase tracking-wider px-1 ${mutedText}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 border border-amber-200 inline-block" />
                  INGENUITY CRAFT
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-800 border border-rose-500 inline-block" />
                  MARS RIDGE (CRASH)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  LANDING PAD
                </span>
                <span className="flex items-center gap-1.5">
                  <SteelAlloyIngotIcon lit className="w-4 h-2.5" />
                  STEEL ALLOY REWARD
                </span>
              </div>
            </section>

            {/* RIGHT SIDE: FLIGHT NAVIGATION COMPUTER PANEL */}
            <aside className={`border p-3 flex flex-col justify-between gap-3 ${panelBg}`}>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
                <span
                  className={`font-mono-tabular text-xs font-bold tracking-wider ${
                    isDark ? 'text-stone-100' : 'text-slate-900'
                  }`}
                >
                  FLIGHT QUEUE ·{' '}
                  <span className="text-amber-400">
                    {queue.length} / {sector.battery}
                  </span>{' '}
                  MOVES
                </span>
                <span
                  className={`font-mono-tabular text-[11px] font-bold tracking-wider ${
                    phase === 'EXECUTING' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {phase === 'EXECUTING' ? 'TX ACTIVE' : 'MEM READY'}
                </span>
              </div>

              {/* Amber-Tinted CRT Terminal: NAV BUFFER // SEQ_OUT */}
              <div className="relative border border-amber-500/45 bg-[#120b04] p-2.5 min-h-[126px] flex flex-col justify-between shadow-[inset_0_0_24px_rgba(245,158,11,0.12)]">
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-amber-400/80 border-b border-amber-500/25 pb-1 mb-2">
                  <span>NAV BUFFER // SEQ_OUT</span>
                  <span>{remainingBattery} FREE</span>
                </div>

                {queue.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center font-mono-tabular text-xs text-amber-400/70 tracking-wider py-4">
                    AWAITING FLIGHT VECTORS...
                  </div>
                ) : (
                  <div className="flex-1 flex flex-wrap content-start gap-1.5 max-h-[130px] overflow-y-auto pr-1">
                    {queue.map((cmd, idx) => {
                      const isExecutingThis = phase === 'EXECUTING' && idx === activeStepIdx;
                      const isDone =
                        (phase === 'EXECUTING' && idx < activeStepIdx) ||
                        phase === 'SECTOR_CLEARED' ||
                        phase === 'MISSION_SUCCESS';
                      const isFailed = idx === failedStepIdx;

                      const chipClass = isFailed
                        ? 'bg-rose-600/80 border-rose-300 text-white shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                        : isExecutingThis
                        ? 'bg-amber-500 border-yellow-200 text-black font-bold shadow-[0_0_10px_rgba(245,158,11,0.85)]'
                        : isDone
                        ? 'bg-[#221a10] border-amber-700/40 text-amber-500/50'
                        : 'bg-[#261909] border-amber-500/50 text-amber-200';

                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 border font-mono-tabular text-[11px] ${chipClass}`}
                        >
                          <span className="opacity-65 text-[10px]">{idx + 1}</span>
                          <span className="font-bold">{DIR_DELTA[cmd].symbol}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Heavy Mechanical Illuminated D-Pad */}
              <div
                className={`border p-3 flex flex-col items-center justify-center gap-2 ${
                  isDark ? 'bg-[#0b0f15] border-[#242e3b]' : 'bg-[#cfd7e3] border-[#94a3b8]'
                }`}
              >
                <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
                  <div />
                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || remainingBattery <= 0}
                    onClick={() => pushMove('UP')}
                    className={`h-14 border-2 flex flex-col items-center justify-center gap-0.5 font-mono-tabular text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-[#19202a] hover:bg-[#232c3a] active:translate-y-[1px] border-[#334155] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'bg-slate-800 hover:bg-slate-700 active:translate-y-[1px] border-slate-950 text-amber-300'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>UP</span>
                  </button>
                  <div />

                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || remainingBattery <= 0}
                    onClick={() => pushMove('LEFT')}
                    className={`h-14 border-2 flex flex-col items-center justify-center gap-0.5 font-mono-tabular text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-[#19202a] hover:bg-[#232c3a] active:translate-y-[1px] border-[#334155] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'bg-slate-800 hover:bg-slate-700 active:translate-y-[1px] border-slate-950 text-amber-300'
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>LEFT</span>
                  </button>

                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || remainingBattery <= 0}
                    onClick={() => pushMove('DOWN')}
                    className={`h-14 border-2 flex flex-col items-center justify-center gap-0.5 font-mono-tabular text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-[#19202a] hover:bg-[#232c3a] active:translate-y-[1px] border-[#334155] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'bg-slate-800 hover:bg-slate-700 active:translate-y-[1px] border-slate-950 text-amber-300'
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span>DOWN</span>
                  </button>

                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || remainingBattery <= 0}
                    onClick={() => pushMove('RIGHT')}
                    className={`h-14 border-2 flex flex-col items-center justify-center gap-0.5 font-mono-tabular text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-[#19202a] hover:bg-[#232c3a] active:translate-y-[1px] border-[#334155] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'bg-slate-800 hover:bg-slate-700 active:translate-y-[1px] border-slate-950 text-amber-300'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>RIGHT</span>
                  </button>
                </div>
              </div>

              {/* Brushed-Steel UNDO / CLEAR + Hazard-Striped SEND FLIGHT */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || queue.length === 0}
                    onClick={undoMove}
                    className={`h-10 border-2 flex items-center justify-center gap-1.5 font-mono-tabular text-xs font-bold tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                      isDark
                        ? 'bg-[#1b222c] hover:bg-[#26303e] border-[#3b4758] text-stone-200'
                        : 'bg-slate-300 hover:bg-slate-400 border-slate-500 text-slate-900'
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>UNDO</span>
                  </button>

                  <button
                    type="button"
                    disabled={phase !== 'PLANNING' || queue.length === 0}
                    onClick={clearQueue}
                    className={`h-10 border-2 flex items-center justify-center gap-1.5 font-mono-tabular text-xs font-bold tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                      isDark
                        ? 'bg-[#1b222c] hover:bg-[#26303e] border-[#3b4758] text-stone-200'
                        : 'bg-slate-300 hover:bg-slate-400 border-slate-500 text-slate-900'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>CLEAR</span>
                  </button>
                </div>

                {/* Hazard-Striped SEND FLIGHT Command Bar */}
                <button
                  type="button"
                  disabled={phase !== 'PLANNING' || queue.length === 0}
                  onClick={sendFlight}
                  className={`relative w-full h-14 border-2 border-amber-400 flex items-center justify-center gap-2 font-stencil text-base sm:text-lg tracking-[0.14em] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(245,158,11,0.38)] hover:brightness-110 active:translate-y-[1px] ${
                    isDark ? 'bl-hazard-stripe' : 'bl-hazard-stripe-light'
                  }`}
                >
                  <span className="px-4 py-1 bg-[#120d06]/90 border border-amber-400/70 text-amber-200 flex items-center gap-2 shadow-md">
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>SEND FLIGHT</span>
                  </span>
                </button>

                <div
                  className={`flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono-tabular ${mutedText}`}
                >
                  <span>WASD / ARROWS: QUEUE · Z/BKSP: UNDO</span>
                  <span>C/ESC: CLEAR · ENTER: SEND</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* 4. SECTOR CLEARED REWARD MODAL (when fewer than 3 Steel Alloys collected) */}
        {phase === 'SECTOR_CLEARED' && (
          <div className="absolute inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-md border-2 border-emerald-400 bg-[#0d131a] text-stone-100 p-6 space-y-5 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="font-mono-tabular text-[11px] text-emerald-300 uppercase tracking-widest">
                    SECTOR {sector.id} CLEARED · TOUCHDOWN CONFIRMED
                  </div>
                  <h2 className="font-stencil text-xl text-amber-300 tracking-wide">
                    {lastClearedWasNewAlloy ? 'STEEL ALLOY RECOVERED' : 'SECTOR RE-VERIFIED'}
                  </h2>
                </div>
              </div>

              <div className="border border-[#2b3746] bg-[#080b10] p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-amber-400/60 bg-amber-500/10">
                    <SteelAlloyIngotIcon lit className="w-10 h-6" />
                  </div>
                  <div>
                    <div className="font-mono-tabular text-xs text-stone-300">
                      {lastClearedWasNewAlloy
                        ? '+1 Steel Alloy Ingot Secured'
                        : 'Alloy Already Secured in This Sector'}
                    </div>
                    <div className="font-mono-tabular text-sm font-bold text-emerald-300 mt-0.5">
                      ALLOY STEEL: {clearedSectors.length}/3
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => selectSector(sectorIdx)}
                  className="border border-slate-600 bg-slate-800 hover:bg-slate-700 text-stone-200 font-mono-tabular text-xs font-bold px-3.5 py-2.5 cursor-pointer"
                >
                  REPLAY
                </button>
                <button
                  type="button"
                  onClick={handleDeployNextSector}
                  className="border-2 border-emerald-400 bg-emerald-600 hover:bg-emerald-500 text-white font-mono-tabular text-xs font-bold px-4 py-2.5 cursor-pointer tracking-wider"
                >
                  DEPLOY NEXT SECTOR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. MISSION SUCCESS MODAL (only when all 3 sectors & 3/3 Steel Alloys collected) */}
        {phase === 'MISSION_SUCCESS' && (
          <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-lg border-2 border-amber-400 bg-[#0d1218] text-stone-100 p-6 space-y-5 shadow-[0_0_50px_rgba(245,158,11,0.4)]">
              <div className="flex items-center gap-3">
                <HelicopterEmblem className="w-11 h-11 shrink-0" />
                <div>
                  <div className="font-mono-tabular text-[11px] text-emerald-400 uppercase tracking-widest">
                    JPL AUTOPILOT RELAY · ALL SECTORS COMPLETE
                  </div>
                  <h2 className="font-stencil text-2xl text-amber-300 tracking-wider">
                    MISSION SUCCESS
                  </h2>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                Ingenuity completed blind autopilot landings across all three Martian sectors, recovering all 3 Steel Alloy ingots and telemetry modules for the Ares IV spacecraft.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono-tabular text-xs">
                <div className="border border-amber-500/40 bg-[#080b10] p-3">
                  <div className="text-slate-400 text-[10px]">ALLOY STEELS</div>
                  <div className="text-amber-300 font-bold text-base mt-0.5">3/3</div>
                </div>
                <div className="border border-emerald-500/40 bg-[#080b10] p-3">
                  <div className="text-slate-400 text-[10px]">SECTORS</div>
                  <div className="text-emerald-300 font-bold text-base mt-0.5">3/3</div>
                </div>
                <div className="border border-slate-700 bg-[#080b10] p-3">
                  <div className="text-slate-400 text-[10px]">FLIGHTS SENT</div>
                  <div className="text-stone-100 font-bold text-base mt-0.5">{flightsSent}</div>
                </div>
                <div className="border border-slate-700 bg-[#080b10] p-3">
                  <div className="text-slate-400 text-[10px]">VECTORS USED</div>
                  <div className="text-sky-300 font-bold text-base mt-0.5">{totalVectorsUsed}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="border border-slate-600 bg-slate-800 hover:bg-slate-700 text-stone-100 font-mono-tabular text-xs font-bold px-4 py-2.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>PLAY AGAIN</span>
                </button>
                <button
                  type="button"
                  onClick={handleReturnWithSuccess}
                  className="border-2 border-emerald-400 bg-emerald-600 hover:bg-emerald-500 text-white font-mono-tabular text-xs font-bold px-5 py-2.5 cursor-pointer tracking-wider"
                >
                  RETURN TO GAME
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
