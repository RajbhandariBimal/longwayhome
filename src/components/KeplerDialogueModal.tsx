import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Play, Telescope, X } from 'lucide-react';
import { soundFX } from '../game/audio';
import { AstronautPortrait } from './PathfinderDialogueModal';

const KEPLER_DIALOGUE_LINES: string[] = [
  'Both the Pathfinder airbags and Ingenuity Steel Alloys are installed—Ares IV is structurally flight-ready! Now I need to lock Earth’s exact orbital coordinates using the onboard Kepler Space Telescope.',
  'Launched by NASA in 2009, the real Kepler mission stared at over 150,000 stars to discover exoplanets using transit photometry—measuring tiny drops in a star’s brightness over time.',
  'Whenever a planet passes directly in front of its star, it blocks a small fraction of starlight, leaving a repeating dip in the brightness graph (light curve).',
  'Giant Hot Jupiters block roughly 1% of their star’s light, making deep dips that are easy to spot. Smaller Neptune-sized worlds leave fuzzier signals.',
  'An Earth-sized planet crossing a Sun-like star dims the light by only ~0.0084% (84 parts per million)—so faint that natural star flicker and sensor noise bury the signal!',
  'How this scan works: Examine the 300-point brightness graph and tap all 3 dips where the starlight drops below the baseline across 3 stages: Hot Jupiter, Neptune-size, and Earth!.',
  'When raw noise hides Earth’s tiny signal in Stage 3, toggle "Clean up noise" ON to apply a 9-point moving average—canceling random noise just like NASA’s Kepler pipeline so we can lock Earth and launch home!',
];

interface KeplerDialogueModalProps {
  earthAlreadyLocated: boolean;
  onStartMinigame: () => void;
  onClose: () => void;
}

const PixelatedKeplerModel: React.FC<{ className?: string }> = ({
  className = 'w-16 h-16 sm:w-20 sm:h-20',
}) => (
  <svg
    viewBox="0 0 32 32"
    shapeRendering="crispEdges"
    className={`pixelated ${className}`}
    aria-label="Pixelated Kepler Space Telescope"
  >
    {/* Deep space backdrop & stars */}
    <rect width="32" height="32" fill="#070d1d" />
    <rect x="3" y="4" width="1" height="1" fill="#fde047" />
    <rect x="27" y="6" width="1" height="1" fill="#7dd3fc" />
    <rect x="5" y="25" width="1" height="1" fill="#cbd5e1" />
    <rect x="26" y="26" width="1" height="1" fill="#f97316" />

    {/* Solar array wings */}
    <rect x="2" y="15" width="7" height="5" fill="#1e3a8a" />
    <rect x="3" y="16" width="5" height="3" fill="#38bdf8" />
    <rect x="5" y="15" width="1" height="5" fill="#0f172a" />

    <rect x="23" y="15" width="7" height="5" fill="#1e3a8a" />
    <rect x="24" y="16" width="5" height="3" fill="#38bdf8" />
    <rect x="26" y="15" width="1" height="5" fill="#0f172a" />

    {/* Sunshade / angled aperture hood */}
    <rect x="11" y="5" width="10" height="3" fill="#cbd5e1" />
    <rect x="12" y="6" width="8" height="2" fill="#0f172a" />
    <rect x="13" y="6" width="3" height="1" fill="#38bdf8" />

    {/* Cylindrical photometer barrel */}
    <rect x="10" y="8" width="12" height="11" fill="#94a3b8" />
    <rect x="11" y="9" width="10" height="9" fill="#e2e8f0" />
    <rect x="18" y="9" width="3" height="9" fill="#64748b" />
    <rect x="10" y="13" width="12" height="1" fill="#475569" />

    {/* Gold hexagonal spacecraft bus */}
    <rect x="9" y="19" width="14" height="6" fill="#b45309" />
    <rect x="10" y="20" width="12" height="4" fill="#f59e0b" />
    <rect x="12" y="21" width="8" height="2" fill="#fde047" />

    {/* High-gain antenna dish */}
    <rect x="15" y="25" width="2" height="3" fill="#94a3b8" />
    <rect x="12" y="28" width="8" height="2" fill="#cbd5e1" />
  </svg>
);

export const KeplerDialogueModal: React.FC<KeplerDialogueModalProps> = ({
  earthAlreadyLocated,
  onStartMinigame,
  onClose,
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const currentLine = KEPLER_DIALOGUE_LINES[lineIndex];
  const isTyping = visibleChars < currentLine.length;
  const isFinalLine = lineIndex === KEPLER_DIALOGUE_LINES.length - 1;

  useEffect(() => {
    if (earthAlreadyLocated) return;
    setVisibleChars(0);
  }, [lineIndex, earthAlreadyLocated]);

  useEffect(() => {
    if (earthAlreadyLocated) return;
    if (visibleChars >= currentLine.length) return;

    const timer = window.setTimeout(() => {
      setVisibleChars((c) => {
        const next = Math.min(currentLine.length, c + 2);
        if (next % 6 === 0) {
          soundFX.playDialogueBlip();
        }
        return next;
      });
    }, 18);

    return () => window.clearTimeout(timer);
  }, [visibleChars, currentLine, earthAlreadyLocated]);

  const handleAdvance = () => {
    if (isTyping) {
      soundFX.playTypingSkip();
      setVisibleChars(currentLine.length);
      return;
    }
    if (!isFinalLine) {
      soundFX.playUiClick();
      setLineIndex((idx) => idx + 1);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        soundFX.playUiClose();
        onClose();
        return;
      }
      if (earthAlreadyLocated) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        if (isTyping) {
          soundFX.playTypingSkip();
          setVisibleChars(currentLine.length);
        } else if (!isFinalLine) {
          soundFX.playUiClick();
          setLineIndex((idx) => idx + 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTyping, isFinalLine, currentLine.length, earthAlreadyLocated, onClose]);

  if (earthAlreadyLocated) {
    return (
      <div className="fixed inset-0 z-40 bg-black/65 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="pixel-panel-dark w-full max-w-xl p-5 sm:p-6 text-stone-100 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono-tabular text-emerald-400 uppercase tracking-wider">
                Kepler Space Telescope · Coordinates Locked
              </div>
              <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-1">
                Kepler Transit Photometry Array
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close briefing"
              className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <PixelatedKeplerModel className="w-20 h-20 border-2 border-[#5b463d] shrink-0" />
            <div className="relative flex-1 bg-[#22262b] border-2 border-[#464d56] p-4 text-sm text-stone-200 leading-relaxed">
              <div className="absolute -left-2 top-5 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#464d56] rotate-45" />
              <p>
                Earth&apos;s transit signature is already locked in Ares IV navigation! You can replay the Kepler light-curve scan or return to the console to launch home.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onStartMinigame();
              }}
              className="pixel-btn bg-[#3d434c] hover:bg-[#4e5560] text-stone-100 px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-orange-300" />
              <span>Replay Kepler Scan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onClose();
              }}
              className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
            >
              BACK TO CONSOLE
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/65 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        className="pixel-panel-dark w-full max-w-2xl p-4 sm:p-6 text-stone-100 space-y-4"
      >
        {/* Mission Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#3a3f46] pb-3">
          <div>
            <div className="text-[11px] font-mono-tabular text-orange-300 tracking-wide">
              NASA KEPLER SPACE TELESCOPE · ARES IV PRE-LAUNCH NAVIGATION
            </div>
            <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-0.5">
              Find Earth · Transit Photometry Briefing
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close briefing"
            className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pixelated Kepler Model + Animated Speech Bubble + Astronaut Portrait */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 shrink-0">
            <PixelatedKeplerModel className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-[#5b463d]" />
            <div className="flex items-center justify-center">
              <AstronautPortrait speaking={isTyping} />
            </div>
          </div>

          <div
            onClick={handleAdvance}
            className="relative flex-1 bg-[#22262b] border-2 border-[#4d5560] p-4 min-h-[168px] flex flex-col justify-between cursor-pointer select-none"
          >
            <div className="absolute -left-2 top-8 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#4d5560] rotate-45" />

            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="text-sm sm:text-[15px] text-stone-100 leading-relaxed"
              >
                {currentLine.slice(0, visibleChars)}
                {isTyping && (
                  <span className="inline-block w-2 h-4 bg-orange-400 ml-1 align-middle animate-pulse" />
                )}
              </motion.p>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-[#32373e] text-[11px] text-stone-400 font-mono-tabular">
              <span>
                Kepler Data {lineIndex + 1} / {KEPLER_DIALOGUE_LINES.length}
              </span>
              {!isFinalLine && (
                <span className="text-orange-300 flex items-center gap-1">
                  {isTyping ? 'Click or Space to reveal' : 'Click or Space to continue'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Dots + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {KEPLER_DIALOGUE_LINES.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 transition-all ${
                  idx === lineIndex
                    ? 'w-5 bg-orange-400'
                    : idx < lineIndex
                    ? 'w-2 bg-emerald-500/80'
                    : 'w-2 bg-[#434952]'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {!isFinalLine ? (
              <button
                type="button"
                onClick={handleAdvance}
                className="pixel-btn bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isTyping ? 'Reveal' : 'Next'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    onClose();
                  }}
                  className="pixel-btn bg-[#3f454e] hover:bg-[#4e5560] text-stone-200 font-pixel text-xs px-4 py-2.5 cursor-pointer"
                >
                  NOT NOW
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playBuild();
                    onStartMinigame();
                  }}
                  className="pixel-btn bg-orange-600 hover:bg-orange-500 text-white font-pixel text-xs px-5 py-2.5 flex items-center gap-2 cursor-pointer"
                >
                  <Telescope className="w-4 h-4" />
                  <span>START KEPLER SCAN</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
