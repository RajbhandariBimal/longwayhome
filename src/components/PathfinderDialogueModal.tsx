import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Play, ShieldAlert, X } from 'lucide-react';
import { soundFX } from '../game/audio';

const DIALOGUE_LINES: string[] = [
  'Interesting... this looks like an old Mars landing system.',
  "Did you know that NASA's Mars Pathfinder successfully landed on Mars on July 4, 1997?",
  'It used an innovative landing technique involving a parachute and a giant system of inflatable airbags.',
  'These airbags protected the lander by cushioning its impact with the Martian surface. After landing, it bounced approximately 15 times before coming to rest.',
  'Pathfinder also carried Sojourner, the first rover to operate on another planet.',
  'These airbags were an incredible engineering achievement!',
  'Looking at this abandoned rover, I think some of its airbag components might still be recoverable.',
  'My rocket is damaged, and I need additional cushioning components to restore its emergency landing protection system.',
  'If I can recover enough airbags, perhaps I can repair it!',
];

interface PathfinderDialogueModalProps {
  missionAlreadyCompleted: boolean;
  rocketCushioningRestored: boolean;
  onAcceptMission: () => void;
  onPracticeRun: () => void;
  onClose: () => void;
}

export const AstronautPortrait: React.FC<{ speaking?: boolean }> = ({ speaking = false }) => (
  <motion.div
    animate={speaking ? { y: [0, -2, 0] } : { y: 0 }}
    transition={{ repeat: speaking ? Infinity : 0, duration: 0.45, ease: 'easeInOut' }}
    className="w-16 h-16 sm:w-20 sm:h-20 bg-[#231512] border-2 border-[#5b463d] flex items-center justify-center shrink-0 relative overflow-hidden"
  >
    <svg viewBox="0 0 16 16" className="w-14 h-14 sm:w-16 sm:h-16 pixelated">
      {/* Martian backdrop */}
      <rect width="16" height="16" fill="#3a1914" />
      <rect y="12" width="16" height="4" fill="#6d2d1d" />
      {/* PLSS Backpack */}
      <rect x="3" y="9" width="10" height="6" fill="#64748b" />
      {/* White EVA Suit Shoulders */}
      <rect x="4" y="10" width="8" height="6" fill="#f8fafc" />
      <rect x="4" y="10" width="8" height="1" fill="#ea580c" />
      <rect x="6" y="12" width="4" height="2" fill="#94a3b8" />
      {/* Helmet */}
      <rect x="3" y="2" width="10" height="8" fill="#0f172a" />
      <rect x="4" y="3" width="8" height="6" fill="#f8fafc" />
      <rect x="5" y="2" width="6" height="1" fill="#ea580c" />
      {/* Gold Reflective Visor */}
      <rect x="5" y="4" width="6" height="4" fill="#b45309" />
      <rect x="6" y="4" width="2" height="1" fill="#fde047" />
      <rect x="9" y="6" width="1" height="1" fill="#fbbf24" />
    </svg>
  </motion.div>
);

export const PathfinderDialogueModal: React.FC<PathfinderDialogueModalProps> = ({
  missionAlreadyCompleted,
  rocketCushioningRestored,
  onAcceptMission,
  onPracticeRun,
  onClose,
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const currentLine = DIALOGUE_LINES[lineIndex];
  const isTyping = visibleChars < currentLine.length;
  const isFinalLine = lineIndex === DIALOGUE_LINES.length - 1;

  useEffect(() => {
    if (missionAlreadyCompleted) return;
    setVisibleChars(0);
  }, [lineIndex, missionAlreadyCompleted]);

  useEffect(() => {
    if (missionAlreadyCompleted) return;
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
  }, [visibleChars, currentLine, missionAlreadyCompleted]);

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
      if (missionAlreadyCompleted) return;
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
  }, [isTyping, isFinalLine, currentLine.length, missionAlreadyCompleted, onClose]);

  if (missionAlreadyCompleted) {
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
                Mars Pathfinder: Airbag Recovery · Completed
              </div>
              <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-1">
                Abandoned Mars Pathfinder Rover
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialogue"
              className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <AstronautPortrait />
            <div className="relative flex-1 bg-[#22262b] border-2 border-[#464d56] p-4 text-sm text-stone-200 leading-relaxed">
              <div className="absolute -left-2 top-5 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#464d56] rotate-45" />
              {rocketCushioningRestored ? (
                <p>
                  All 10 Pathfinder airbag components have been recovered and installed on the Ares IV rocket&apos;s emergency landing protection system!
                </p>
              ) : (
                <p>
                  We already recovered all 10 airbag components from this Pathfinder rover! Let&apos;s head back to the crashed Ares IV rocket and install them.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onPracticeRun();
              }}
              className="pixel-btn bg-[#3d434c] hover:bg-[#4e5560] text-stone-100 px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-amber-300" />
              <span>Practice Run</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onClose();
              }}
              className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
            >
              RETURN TO MARS
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
            <div className="text-[11px] font-mono-tabular text-amber-300 tracking-wide">
              MARS PATHFINDER: AIRBAG RECOVERY · WESTERN CRATER BASIN
            </div>
            <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-0.5">
              Abandoned Pathfinder Rover
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialogue"
            className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Character Portrait + Animated Speech Bubble */}
        <div className="flex items-start gap-3 sm:gap-4">
          <AstronautPortrait speaking={isTyping} />

          <div
            onClick={handleAdvance}
            className="relative flex-1 bg-[#22262b] border-2 border-[#4d5560] p-4 min-h-[120px] flex flex-col justify-between cursor-pointer select-none"
          >
            {/* Speech bubble pointer */}
            <div className="absolute -left-2 top-5 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#4d5560] rotate-45" />

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
                  <span className="inline-block w-2 h-4 bg-amber-300 ml-1 align-middle animate-pulse" />
                )}
              </motion.p>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-[#32373e] text-[11px] text-stone-400 font-mono-tabular">
              <span>
                Log {lineIndex + 1} / {DIALOGUE_LINES.length}
              </span>
              {!isFinalLine && (
                <span className="text-amber-300 flex items-center gap-1">
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
            {DIALOGUE_LINES.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 transition-all ${
                  idx === lineIndex
                    ? 'w-5 bg-amber-400'
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
                className="pixel-btn bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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
                    onAcceptMission();
                  }}
                  className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>ACCEPT MISSION</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
