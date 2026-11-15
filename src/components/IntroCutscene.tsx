import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundFX } from '../game/audio';

interface IntroCutsceneProps {
  muted: boolean;
  onToggleMute: () => void;
  onComplete: () => void;
}

type IntroStage = 'VIDEO' | 'TITLE_CARD' | 'EXITING';

const INTRO_VIDEO_SRC = '/assets/aistudio/ares-horizon-story_ad912911.mp4';
const TITLE_HOLD_MS = 4100;
const FADE_OUT_MS = 700;

export const IntroCutscene: React.FC<IntroCutsceneProps> = ({
  muted,
  onToggleMute,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const stageRef = useRef<IntroStage>('VIDEO');

  const [stage, setStage] = useState<IntroStage>('VIDEO');
  const [progress, setProgress] = useState(0);
  const [autoplayMutedFallback, setAutoplayMutedFallback] = useState(false);
  const [videoError] = useState(false);

  const dustMotes = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 94}%`,
        top: `${(i * 29 + 11) % 86}%`,
        size: 2 + (i % 3),
        delay: (i % 6) * 0.35,
        dur: 3.4 + (i % 4) * 0.7,
        dx: 28 + (i % 5) * 12,
      })),
    []
  );

  const finishToGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stageRef.current = 'EXITING';
    setStage('EXITING');
    window.setTimeout(() => {
      onComplete();
    }, FADE_OUT_MS);
  }, [onComplete]);

  const enterTitleCard = useCallback(() => {
    if (stageRef.current !== 'VIDEO') return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    stageRef.current = 'TITLE_CARD';
    setStage('TITLE_CARD');
    soundFX.playSolDawn();
  }, []);

  // Auto-redirect smoothly into Mars gameplay after showing the title card
  useEffect(() => {
    if (stage !== 'TITLE_CARD') return;
    const timer = window.setTimeout(() => {
      finishToGame();
    }, TITLE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [stage, finishToGame]);

  const tryStartPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || stageRef.current !== 'VIDEO') return;
    if (!video.paused) return;

    video.muted = muted;
    try {
      await video.play();
    } catch {
      video.muted = true;
      setAutoplayMutedFallback(true);
      try {
        await video.play();
      } catch {
        // Retry on loadeddata/canplay or user click
      }
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void tryStartPlayback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!autoplayMutedFallback) {
      video.muted = muted;
    } else if (!muted) {
      video.muted = false;
      setAutoplayMutedFallback(false);
    }
  }, [muted, autoplayMutedFallback]);

  // If browser muted autoplay on refresh, unmute smoothly on first click or non-skip keypress
  useEffect(() => {
    if (!autoplayMutedFallback) return;
    const enableAudio = (e: Event) => {
      if (e instanceof KeyboardEvent && e.code === 'Space') {
        return;
      }
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        if (video.paused) {
          void video.play().catch(() => undefined);
        }
      }
      setAutoplayMutedFallback(false);
    };
    window.addEventListener('pointerdown', enableAudio, { once: true });
    window.addEventListener('keydown', enableAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
  }, [autoplayMutedFallback]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        soundFX.playUiClick();
        finishToGame();
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        e.stopPropagation();
        onToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [finishToGame, onToggleMute]);

  const handleUnmuteClick = () => {
    const video = videoRef.current;
    if (autoplayMutedFallback && video) {
      video.muted = false;
      setAutoplayMutedFallback(false);
      if (muted) {
        onToggleMute();
      }
      return;
    }
    onToggleMute();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 h-dvh w-screen bg-[#080404] flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden"
    >
      {/* Video Cutscene Layer */}
      <motion.div
        animate={{
          opacity: stage === 'VIDEO' ? 1 : 0,
          scale: stage === 'VIDEO' ? 1 : 1.04,
        }}
        transition={{ duration: 0.75, ease: 'easeInOut' }}
        className={`w-full max-w-[min(96vw,1440px,calc((100dvh-108px)*16/9))] flex flex-col gap-2.5 ${
          stage !== 'VIDEO' ? 'pointer-events-none' : ''
        }`}
      >
        {/* Top Cutscene Bar */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 bg-amber-400 animate-pulse" />
            <span className="font-pixel text-[11px] sm:text-xs text-[#e8cf79] tracking-wider uppercase">
              Ares IV · Mars Descent Transmission
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUnmuteClick}
              title={muted || autoplayMutedFallback ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
              className="pixel-btn bg-[#2d3238] hover:bg-[#3d434b] text-stone-100 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {muted || autoplayMutedFallback ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">
                    {autoplayMutedFallback ? 'Tap for Audio' : 'Muted'}
                  </span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Audio On</span>
                </>
              )}
            </button>

          </div>
        </div>

        {/* Video Frame */}
        <div className="pixel-panel-dark relative w-full aspect-video bg-black overflow-hidden">
          {videoError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="font-pixel text-sm text-amber-300">
                Opening transmission unavailable
              </p>
              <button
                type="button"
                onClick={enterTitleCard}
                className="pixel-btn bg-orange-600 hover:bg-orange-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
              >
                Continue to Mars
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={INTRO_VIDEO_SRC}
                autoPlay
                muted={muted || autoplayMutedFallback}
                playsInline
                preload="auto"
                onLoadedData={() => {
                  void tryStartPlayback();
                }}
                onCanPlay={() => {
                  void tryStartPlayback();
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 30;
                  setProgress(Math.min(100, (v.currentTime / d) * 100));
                }}
                onEnded={enterTitleCard}
                onError={enterTitleCard}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) {
                    void v.play().catch(() => undefined);
                  }
                  if (autoplayMutedFallback) {
                    v.muted = false;
                    setAutoplayMutedFallback(false);
                  }
                }}
                className="w-full h-full object-contain bg-black"
              />
              {autoplayMutedFallback && (
                <button
                  type="button"
                  onClick={handleUnmuteClick}
                  className="absolute bottom-3 right-3 z-10 pixel-btn bg-black/80 hover:bg-black/95 border border-amber-400/70 text-amber-200 px-3 py-1.5 text-[11px] font-pixel flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Click anywhere for audio</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom Progress & Hint Strip */}
        <div className="flex items-center justify-between gap-4 px-1 text-[11px] font-mono-tabular text-stone-400">
          <div className="flex-1 h-1.5 bg-[#1b1e23] border border-[#2f353d] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-300 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-stone-400">SPACE · Skip</span>
        </div>
      </motion.div>

      {/* Post-Crash Mars Title Card Overlay ("The Long Way Home") */}
      <AnimatePresence>
        {(stage === 'TITLE_CARD' || stage === 'EXITING') && (
          <motion.div
            key="mars-title-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage === 'EXITING' ? 0 : 1 }}
            transition={{ duration: stage === 'EXITING' ? 0.65 : 0.85, ease: 'easeInOut' }}
            className="fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center overflow-hidden"
            style={{
              background:
                'radial-gradient(ellipse 85% 60% at 50% 62%, rgba(194, 65, 12, 0.34) 0%, rgba(124, 45, 18, 0.22) 36%, rgba(12, 5, 4, 0.96) 76%, #080404 100%)',
            }}
          >
            {/* Glowing Martian horizon arc behind the title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.85, scale: 1 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="pointer-events-none absolute -bottom-[48vh] left-1/2 -translate-x-1/2 w-[150vw] h-[72vh] rounded-[100%]"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 10%, rgba(251, 146, 60, 0.36) 0%, rgba(180, 56, 20, 0.22) 28%, rgba(24, 8, 5, 0.95) 65%)',
                boxShadow: '0 -18px 80px rgba(234, 88, 12, 0.38)',
                borderTop: '1px solid rgba(251, 146, 60, 0.45)',
              }}
            />

            {/* Drifting Martian dust motes */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {dustMotes.map((m) => (
                <motion.span
                  key={m.id}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{
                    opacity: [0, 0.65, 0],
                    x: [0, m.dx],
                    y: [0, -14],
                  }}
                  transition={{
                    duration: m.dur,
                    delay: m.delay,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    left: m.left,
                    top: m.top,
                    width: m.size,
                    height: m.size,
                  }}
                  className="absolute rounded-full bg-amber-300/75 blur-[0.5px]"
                />
              ))}
            </div>

            {/* Subtle Mars Mission Tag */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.85, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10 font-mono-tabular text-[10px] sm:text-xs tracking-[0.38em] text-orange-300/85 uppercase mb-4"
            >
              SOL 01 · ARES IV TOUCHDOWN SECTOR
            </motion.div>

            {/* Main Mars-Style Blockbuster Title */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.94, letterSpacing: '0.28em' }}
              animate={{ opacity: 1, scale: 1, letterSpacing: '0.16em' }}
              transition={{ duration: 1.15, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 font-mars font-black uppercase text-3xl sm:text-5xl md:text-6xl leading-tight bg-gradient-to-b from-amber-100 via-orange-400 to-red-600 bg-clip-text text-transparent"
              style={{
                filter: 'drop-shadow(0 0 26px rgba(234, 88, 12, 0.45))',
              }}
            >
              THE LONG WAY HOME
            </motion.h1>

            {/* Glowing Mars Horizon Rule */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.75, ease: 'easeOut' }}
              className="relative z-10 mt-5 mb-4 h-[2px] w-56 sm:w-80 bg-gradient-to-r from-transparent via-orange-400 to-transparent"
            />

            {/* Sub-caption */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 1.05, ease: 'easeOut' }}
              className="relative z-10 font-tech font-semibold text-sm sm:text-lg tracking-[0.22em] uppercase text-amber-100/90"
            >
              A story based on real NASA data
            </motion.p>

            {/* Smooth Auto-Redirect Progress Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ duration: 0.7, delay: 1.45 }}
              className="relative z-10 mt-10 flex flex-col items-center gap-2"
            >
              <div className="w-40 h-1 bg-orange-950/80 border border-orange-500/30 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: TITLE_HOLD_MS / 1000, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-amber-200"
                />
              </div>
              <span className="font-mono-tabular text-[10px] tracking-[0.22em] text-stone-400 uppercase">
                Deploying to Martian Surface...
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
