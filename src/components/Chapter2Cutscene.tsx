import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundFX } from '../game/audio';

interface Chapter2CutsceneProps {
  muted: boolean;
  onToggleMute: () => void;
  onComplete: () => void;
}

export const CHAPTER2_VIDEO_SRC =
  '/assets/aistudio/red-planet-chapter-2-captioned__online-video-cutter.com__d5e65780.mp4';

let cachedBlobUrl: string | null = null;
let prefetchPromise: Promise<string | null> | null = null;

/** Preload the 1.2MB Chapter 2 MP4 into memory so playback never stalls on network buffering */
export function prefetchChapter2Video(): Promise<string | null> {
  if (cachedBlobUrl) return Promise.resolve(cachedBlobUrl);
  if (!prefetchPromise && typeof window !== 'undefined') {
    prefetchPromise = fetch(CHAPTER2_VIDEO_SRC, { cache: 'force-cache' })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return null;
        cachedBlobUrl = URL.createObjectURL(blob);
        return cachedBlobUrl;
      })
      .catch(() => null);
  }
  return prefetchPromise ?? Promise.resolve(null);
}

export const Chapter2Cutscene: React.FC<Chapter2CutsceneProps> = ({
  muted,
  onToggleMute,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState<string | null>(() => cachedBlobUrl);
  const [buffering, setBuffering] = useState<boolean>(() => !cachedBlobUrl);
  const [autoplayMutedFallback, setAutoplayMutedFallback] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const finishCutscene = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFadingOut(true);
    window.setTimeout(() => {
      onComplete();
    }, 220);
  }, [onComplete]);

  // Resolve in-memory Blob URL so playback has zero network/range-request jitter
  useEffect(() => {
    let active = true;
    if (cachedBlobUrl) {
      setVideoSrc(cachedBlobUrl);
      return;
    }
    prefetchChapter2Video().then((blobUrl) => {
      if (!active) return;
      setVideoSrc(blobUrl ?? CHAPTER2_VIDEO_SRC);
    });
    return () => {
      active = false;
    };
  }, []);

  const startPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || completedRef.current) return;
    setBuffering(false);
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
        // User can tap video or skip
      }
    }
  }, [muted]);

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
        finishCutscene();
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
  }, [finishCutscene, onToggleMute]);

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

  const syncTimeDom = (video: HTMLVideoElement) => {
    const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 16;
    const pct = Math.min(100, (video.currentTime / d) * 100);
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${pct.toFixed(1)}%`;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#050811] flex flex-col items-center justify-center p-2 sm:p-4 select-none transition-opacity duration-200 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-[min(96vw,1440px,calc((100dvh-108px)*16/9))] flex flex-col gap-2.5">
        {/* Top Cutscene Bar */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 bg-sky-400" />
            <span className="font-pixel text-[11px] sm:text-xs text-[#e8cf79] tracking-wider uppercase">
              Chapter 2 · Emergency Lunar Detour
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
              <p className="font-pixel text-sm text-sky-300">
                Lunar detour transmission unavailable
              </p>
              <button
                type="button"
                onClick={finishCutscene}
                className="pixel-btn bg-sky-600 hover:bg-sky-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
              >
                Land on the Moon
              </button>
            </div>
          ) : (
            <>
              {buffering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-xs font-mono-tabular text-sky-300 tracking-wider">
                  BUFFERING TRANSMISSION...
                </div>
              )}
              {videoSrc && (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => syncTimeDom(e.currentTarget)}
                  onCanPlayThrough={startPlayback}
                  onLoadedData={startPlayback}
                  onTimeUpdate={(e) => syncTimeDom(e.currentTarget)}
                  onEnded={finishCutscene}
                  onError={() => setVideoError(true)}
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (v.paused) {
                      v.play().catch(() => undefined);
                    }
                    if (autoplayMutedFallback) {
                      v.muted = false;
                      setAutoplayMutedFallback(false);
                    }
                  }}
                  className="w-full h-full object-contain bg-black transform-gpu will-change-transform"
                />
              )}
            </>
          )}
        </div>

        {/* Bottom Progress & Hint Strip */}
        <div className="flex items-center justify-between gap-4 px-1 text-[11px] font-mono-tabular text-stone-400">
          <div className="flex-1 h-1.5 bg-[#1b1e23] border border-[#2f353d] overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-300"
              style={{ width: '0%' }}
            />
          </div>
          <span className="shrink-0 text-stone-400">SPACE · Skip</span>
        </div>
      </div>
    </div>
  );
};
