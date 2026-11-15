import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Cutscene8BitAudio } from '../game/cutsceneAudio';
import {
  ER_DURATION,
  ER_H,
  ER_W,
  getSceneAtTime,
  renderEarthReturnFrame,
} from '../game/earthReturnRenderer';

interface EarthReturnCutsceneProps {
  muted: boolean;
  onToggleMute: () => void;
  onComplete: () => void;
}

export const EarthReturnCutscene: React.FC<EarthReturnCutsceneProps> = ({
  muted,
  onToggleMute,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<Cutscene8BitAudio | null>(null);
  if (!audioRef.current) {
    audioRef.current = new Cutscene8BitAudio();
  }

  const [sceneIdx, setSceneIdx] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  const timeRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Unlock 8-bit Web Audio immediately on mount & sync mute
  useEffect(() => {
    const engine = audioRef.current;
    engine?.setMuted(muted);
    if (!muted) {
      engine?.unlock();
    }
  }, [muted]);

  useEffect(() => {
    const engine = audioRef.current;
    engine?.unlock();
    const unlockGesture = () => {
      engine?.unlock();
    };
    window.addEventListener('pointerdown', unlockGesture, { passive: true });
    let skipTimer = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat || completedRef.current) return;
        completedRef.current = true;
        engine?.stopContinuous();
        setFadingOut(true);
        skipTimer = window.setTimeout(() => {
          onCompleteRef.current();
        }, 350);
        return;
      }
      engine?.unlock();
      if (e.code === 'KeyM') {
        e.preventDefault();
        e.stopPropagation();
        onToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      if (skipTimer) window.clearTimeout(skipTimer);
      window.removeEventListener('pointerdown', unlockGesture);
      window.removeEventListener('keydown', onKeyDown, true);
      engine?.stopContinuous();
    };
  }, [onToggleMute]);

  // Auto-playing 27-second cutscene loop (no play/pause/skip/timestamps)
  useEffect(() => {
    let rafId = 0;
    let endTimer = 0;
    let lastNow = performance.now();
    let lastSceneId = '';

    const drawFrame = (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderEarthReturnFrame(ctx, t);
    };

    drawFrame(0);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      if (!completedRef.current) {
        const nextT = Math.min(ER_DURATION, timeRef.current + dt);
        timeRef.current = nextT;

        const sc = getSceneAtTime(nextT);
        if (sc.id !== lastSceneId) {
          lastSceneId = sc.id;
          const idx = sc.id === '07' ? 0 : sc.id === '08' ? 1 : sc.id === '09' ? 2 : 3;
          setSceneIdx(idx);
        }

        if (nextT >= ER_DURATION) {
          completedRef.current = true;
          audioRef.current?.update(nextT, false);
          drawFrame(ER_DURATION);
          setFadingOut(true);
          endTimer = window.setTimeout(() => {
            onCompleteRef.current();
          }, 800);
          return;
        }

        audioRef.current?.update(nextT, true);
        drawFrame(nextT);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (endTimer) window.clearTimeout(endTimer);
    };
  }, []);

  const activeScene =
    sceneIdx === 0
      ? getSceneAtTime(0)
      : sceneIdx === 1
      ? getSceneAtTime(6.5)
      : sceneIdx === 2
      ? getSceneAtTime(14.5)
      : getSceneAtTime(20.0);

  return (
    <div
      className={`fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#050811] flex flex-col items-center justify-center p-2 sm:p-4 select-none transition-opacity duration-700 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-[min(96vw,1440px,calc((100dvh-108px)*16/9))] flex flex-col gap-2.5">
        {/* Top Cutscene Bar (no timestamps, no skip/play/replay controls) */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 bg-amber-400 animate-pulse" />
            <span className="font-pixel text-[11px] sm:text-xs text-[#e8cf79] tracking-wider uppercase">
              Cosmo Boy: The Unlikely Return
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              audioRef.current?.unlock();
              onToggleMute();
            }}
            title={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            className="pixel-btn bg-[#2d3238] hover:bg-[#3d434b] text-stone-100 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>8-Bit SFX</span>
              </>
            )}
          </button>
        </div>

        {/* 16:9 Native 480x270 Pixel-Art Video Frame */}
        <div className="pixel-panel-dark relative w-full aspect-video bg-black overflow-hidden">
          <canvas
            ref={canvasRef}
            width={ER_W}
            height={ER_H}
            style={{ imageRendering: 'pixelated' }}
            className="w-full h-full block pixelated"
          />

          {/* Centered Bottom Caption Overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/62 to-transparent pt-8 pb-3 sm:pb-4 px-4 text-center">
            <div className="font-pixel text-[11px] sm:text-xs text-[#e89b3c] tracking-wide mb-1">
              {activeScene.title}
            </div>
            <p className="text-xs sm:text-sm font-medium text-white leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              {activeScene.narrationLines[0]}
              <br />
              {activeScene.narrationLines[1]}
            </p>
          </div>
        </div>
        {/* Bottom Skip Hint */}
        <div className="flex items-center justify-end px-1 text-[11px] font-mono-tabular text-stone-400">
          <span>SPACE · Skip</span>
        </div>
      </div>
    </div>
  );
};
