import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundFX } from '../game/audio';

interface FindEarthModalProps {
  alreadyLocated: boolean;
  onEarthLocated: () => void;
  onLaunchAfterComplete?: () => void;
  onClose: () => void;
}

interface LevelConfig {
  id: number;
  name: string;
  noise: number;
  tip: string;
  seed: number;
}

const NUM_POINTS = 300;
const DIP_WIDTH = 8;
const DIP_DEPTH = 1.0;
const HIT_TOLERANCE = 10;
const SMOOTH_WINDOW = 9;
const Y_RANGE = 1.6;

const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'Hot Jupiter',
    noise: 0.1,
    tip: 'A giant planet. Easy to see.',
    seed: 11,
  },
  {
    id: 2,
    name: 'Neptune-size',
    noise: 0.4,
    tip: 'A smaller planet. A bit fuzzy.',
    seed: 27,
  },
  {
    id: 3,
    name: 'Earth!',
    noise: 1.0,
    tip: 'Earth is tiny. The noise hides it. Try Clean up noise.',
    seed: 191,
  },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateLevelData(seed: number, noise: number) {
  const rng = mulberry32(seed);
  const dipCenters = [60, 150, 240].map(
    (base) => base + Math.round((rng() * 2 - 1) * 5)
  );

  const halfDip = Math.floor(DIP_WIDTH / 2); // 4 -> indices [c-4 .. c+3] = 8 points
  const raw = Array.from({ length: NUM_POINTS }, (_, idx) => {
    let val = gaussianNoise(rng) * noise;
    for (const center of dipCenters) {
      if (idx >= center - halfDip && idx < center + halfDip) {
        val -= DIP_DEPTH;
      }
    }
    return val;
  });

  const radius = Math.floor(SMOOTH_WINDOW / 2); // 4 -> 9-point centered moving average
  const smoothed = raw.map((_, idx) => {
    let sum = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const k = idx + offset;
      if (k >= 0 && k < NUM_POINTS) {
        sum += raw[k];
        count += 1;
      }
    }
    return sum / count;
  });

  return { dipCenters, raw, smoothed };
}

export const FindEarthModal: React.FC<FindEarthModalProps> = ({
  alreadyLocated,
  onEarthLocated,
  onLaunchAfterComplete,
  onClose,
}) => {
  const [levelIdx, setLevelIdx] = useState(0);
  const [cleanNoise, setCleanNoise] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [foundIndices, setFoundIndices] = useState<number[]>([]);
  const [message, setMessage] = useState('Look for three dips below the baseline.');
  const [messageTone, setMessageTone] = useState<'neutral' | 'good' | 'warn' | 'victory'>('neutral');
  const [allComplete, setAllComplete] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const earthSavedRef = useRef(alreadyLocated);

  const level = LEVELS[levelIdx];
  const levelData = useMemo(
    () => generateLevelData(level.seed, level.noise),
    [level.seed, level.noise]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        soundFX.playUiClose();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width));
    const height = 200;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = darkMode ? '#081024' : '#f4eee1';
    ctx.fillRect(0, 0, width, height);

    const padX = 12;
    const padY = 14;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const toX = (idx: number) => padX + (idx / (NUM_POINTS - 1)) * plotW;
    const toY = (val: number) => {
      const clamped = Math.max(-Y_RANGE, Math.min(Y_RANGE, val));
      const norm = (Y_RANGE - clamped) / (2 * Y_RANGE);
      return padY + norm * plotH;
    };

    // Subtle reference gridlines
    ctx.strokeStyle = darkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(120, 113, 108, 0.16)';
    ctx.lineWidth = 1;
    for (const refVal of [-1.0, 0, 1.0]) {
      const y = Math.round(toY(refVal)) + 0.5;
      ctx.beginPath();
      ctx.setLineDash(refVal === 0 ? [] : [4, 4]);
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Translucent green bands behind found dips
    for (const dipIdx of foundIndices) {
      const center = levelData.dipCenters[dipIdx];
      const leftX = toX(Math.max(0, center - 5));
      const rightX = toX(Math.min(NUM_POINTS - 1, center + 5));
      ctx.fillStyle = darkMode ? 'rgba(34, 197, 94, 0.24)' : 'rgba(22, 163, 74, 0.22)';
      ctx.fillRect(leftX, padY, Math.max(12, rightX - leftX), plotH);
      ctx.strokeStyle = darkMode ? 'rgba(74, 222, 128, 0.7)' : 'rgba(21, 128, 61, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(leftX, padY, Math.max(12, rightX - leftX), plotH);
    }

    // Star brightness line (raw or moving average)
    const series = cleanNoise ? levelData.smoothed : levelData.raw;
    ctx.strokeStyle = darkMode ? '#7dd3fc' : '#0369a1';
    ctx.lineWidth = cleanNoise ? 2.4 : 1.75;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const x = toX(i);
      const y = toY(series[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Baseline labels
    ctx.fillStyle = darkMode ? 'rgba(148, 163, 184, 0.7)' : 'rgba(87, 83, 78, 0.75)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('STAR BRIGHTNESS', padX + 2, padY + 9);
    ctx.textAlign = 'right';
    ctx.fillText(cleanNoise ? '9-PT AVG' : 'RAW FLUX', width - padX - 2, padY + 9);

    ctx.restore();
  }, [cleanNoise, darkMode, foundIndices, levelData]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  useEffect(() => {
    const handleResize = () => drawGraph();
    window.addEventListener('resize', handleResize);
    const canvas = canvasRef.current;
    let observer: ResizeObserver | null = null;
    if (canvas && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => drawGraph());
      observer.observe(canvas);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [drawGraph]);

  const handleCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (transitioning || allComplete) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padX = 12;
    const plotW = Math.max(1, rect.width - padX * 2);
    const relX = e.clientX - rect.left - padX;
    const tappedIdx = Math.max(
      0,
      Math.min(NUM_POINTS - 1, Math.round((relX / plotW) * (NUM_POINTS - 1)))
    );

    let bestDip = -1;
    let bestDist = Infinity;
    levelData.dipCenters.forEach((center, idx) => {
      if (foundIndices.includes(idx)) return;
      const dist = Math.abs(tappedIdx - center);
      if (dist <= HIT_TOLERANCE && dist < bestDist) {
        bestDist = dist;
        bestDip = idx;
      }
    });

    if (bestDip === -1) {
      soundFX.playTargetMiss();
      setMessage('Not a dip. Look for where the line drops.');
      setMessageTone('warn');
      return;
    }

    const nextFound = [...foundIndices, bestDip];
    setFoundIndices(nextFound);

    if (nextFound.length < 3) {
      soundFX.playAirbagCollect();
      setMessage('Nice! Keep going.');
      setMessageTone('good');
      return;
    }

    if (levelIdx < LEVELS.length - 1) {
      soundFX.playMissionComplete();
      setTransitioning(true);
      setMessage('Planet found! Next…');
      setMessageTone('victory');
      advanceTimerRef.current = window.setTimeout(() => {
        setLevelIdx((prev) => prev + 1);
        setFoundIndices([]);
        setCleanNoise(false);
        setTransitioning(false);
        setMessage('Look for three dips below the baseline.');
        setMessageTone('neutral');
      }, 1500);
    } else {
      soundFX.playEarthLock();
      setAllComplete(true);
      setMessage('You found Earth! Kepler did this with real stars, one tiny dip at a time.');
      setMessageTone('victory');
      if (!earthSavedRef.current) {
        earthSavedRef.current = true;
        onEarthLocated();
      }
    }
  };

  const handleRestart = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setLevelIdx(0);
    setCleanNoise(false);
    setFoundIndices([]);
    setTransitioning(false);
    setAllComplete(false);
    setMessage('Look for three dips below the baseline.');
    setMessageTone('neutral');
  };

  const theme = darkMode
    ? {
        backdrop: 'rgba(2, 6, 17, 0.85)',
        card: '#0b1429',
        border: '#1e2f56',
        text: '#e2e8f0',
        muted: '#94a3b8',
        subPanel: '#101d3b',
        accent: '#f97316',
        accentText: '#fff7ed',
        btnSecondary: '#162547',
        btnSecondaryBorder: '#2a3f6e',
        msgNeutral: '#cbd5e1',
        msgGood: '#4ade80',
        msgWarn: '#fb923c',
        msgVictory: '#4ade80',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.65)',
        card: '#faf6ee',
        border: '#d6ccb8',
        text: '#1c1917',
        muted: '#57534e',
        subPanel: '#f0e9da',
        accent: '#ea580c',
        accentText: '#ffffff',
        btnSecondary: '#e7decb',
        btnSecondaryBorder: '#c9bda4',
        msgNeutral: '#44403c',
        msgGood: '#15803d',
        msgWarn: '#c2410c',
        msgVictory: '#15803d',
      };

  const messageColor =
    messageTone === 'good'
      ? theme.msgGood
      : messageTone === 'warn'
      ? theme.msgWarn
      : messageTone === 'victory'
      ? theme.msgVictory
      : theme.msgNeutral;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: theme.backdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div
        role="dialog"
        aria-label="Find Earth Kepler Space Telescope Minigame"
        style={{
          width: '100%',
          maxWidth: '860px',
          backgroundColor: theme.card,
          color: theme.text,
          border: `2px solid ${theme.border}`,
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Top Row: Title + Theme & Return Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: theme.text,
              letterSpacing: '-0.02em',
            }}
          >
            🔭 Find Earth
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                setDarkMode((d) => !d);
              }}
              style={{
                backgroundColor: theme.btnSecondary,
                color: theme.text,
                border: `1px solid ${theme.btnSecondaryBorder}`,
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: '38px',
              }}
            >
              {darkMode ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClose();
                onClose();
              }}
              style={{
                backgroundColor: theme.btnSecondary,
                color: theme.text,
                border: `1px solid ${theme.btnSecondaryBorder}`,
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: '38px',
              }}
            >
              Return
            </button>
          </div>
        </div>

        {/* One-line instruction */}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: 1.4,
            color: theme.muted,
          }}
        >
          Tap the dips in the star&apos;s light. Each dip is a planet passing in front.
        </p>

        {/* Level Name & Short Tip */}
        <div
          style={{
            backgroundColor: theme.subPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: theme.accent }}>
            Level {level.id}/3: {level.name}
          </span>
          <span style={{ fontSize: '12px', color: theme.text }}>{level.tip}</span>
        </div>

        {/* Full-width 200px tall Brightness Graph */}
        <div
          style={{
            width: '100%',
            borderRadius: '6px',
            overflow: 'hidden',
            border: `1px solid ${theme.border}`,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasTap}
            style={{
              display: 'block',
              width: '100%',
              height: '200px',
              cursor: transitioning || allComplete ? 'default' : 'crosshair',
              touchAction: 'manipulation',
            }}
          />
        </div>

        {/* Counter & Noise Toggle Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>
            Planet dips found: {foundIndices.length} / 3
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playScanSweep();
              setCleanNoise((prev) => !prev);
            }}
            style={{
              backgroundColor: cleanNoise ? theme.accent : theme.btnSecondary,
              color: cleanNoise ? theme.accentText : theme.text,
              border: `1px solid ${cleanNoise ? theme.accent : theme.btnSecondaryBorder}`,
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: '44px',
            }}
          >
            ✨ Clean up noise: {cleanNoise ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Feedback Message Area */}
        <div
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: theme.subPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '13px',
            fontWeight: 600,
            color: messageColor,
            minHeight: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span>{message}</span>

          {allComplete && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  handleRestart();
                }}
                style={{
                  backgroundColor: theme.btnSecondary,
                  color: theme.text,
                  border: `1px solid ${theme.btnSecondaryBorder}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: '38px',
                }}
              >
                Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  (onLaunchAfterComplete ?? onClose)();
                }}
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: '1px solid #15803d',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: '38px',
                }}
              >
                Lock Earth &amp; Launch
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
