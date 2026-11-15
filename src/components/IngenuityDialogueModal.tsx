import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Play, ShieldAlert, X } from 'lucide-react';
import { soundFX } from '../game/audio';
import { AstronautPortrait } from './PathfinderDialogueModal';

const INGENUITY_DIALOGUE_LINES: string[] = [
  'Whoa... look at that craft standing on the ridge. That is NASA’s Ingenuity Mars Helicopter!',
  'On April 19, 2021, Ingenuity achieved the first powered, controlled flight on another planet.',
  'Because Mars’ atmosphere is only about 1% as dense as Earth’s, it relies on ultra-light carbon coaxial rotors spinning over 2,500 RPM.',
  'And because radio signals between Earth and Mars have a delay of several minutes, Ingenuity cannot be flown with a live joystick.',
  'Flight teams have to upload an entire waypoint sequence in advance—a blind autopilot flight!',
  'Its relay telemetry is still operational, and there are 3 aerospace Steel Alloy ingots cached across nearby landing zones.',
  'If I transmit clean autopilot flight plans through this Ingenuity relay, I can recover all 3 Steel Alloys to rebuild my rocket’s outer plating!',
];

interface IngenuityDialogueModalProps {
  missionAlreadyCompleted: boolean;
  rocketOuterPlatingRestored: boolean;
  onAcceptMission: () => void;
  onPracticeRun: () => void;
  onClose: () => void;
}

/** Crisp pixelated sprite of the Ingenuity Mars Helicopter modeled from the reference */
export const PixelatedIngenuityModel: React.FC<{
  spinning?: boolean;
  crashed?: boolean;
  className?: string;
}> = ({ spinning = false, crashed = false, className = 'w-20 h-20' }) => (
  <svg
    viewBox="0 0 32 32"
    shapeRendering="crispEdges"
    className={`pixelated ${className}`}
    aria-label="Pixelated Ingenuity Mars Helicopter"
  >
    {/* Ground shadow */}
    <rect x="6" y="29" width="20" height="2" fill="rgba(0,0,0,0.42)" />

    {/* Top thin whip antenna */}
    <rect x="15" y="1" width="1" height="3" fill="#e2e8f0" />

    {/* Flat bronze-gold top solar panel */}
    <rect x="10" y="4" width="12" height="1" fill="#e5c158" />
    <rect x="9" y="5" width="14" height="1" fill="#a6832c" />
    <rect x="10" y="6" width="12" height="1" fill="#6e5418" />

    {/* Central coaxial mast */}
    <rect x="15" y="7" width="2" height="10" fill="#94a3b8" />
    <rect x="15" y="10" width="2" height="1" fill="#475569" />
    <rect x="15" y="13" width="2" height="1" fill="#475569" />

    {/* Upper coaxial wide dark carbon-fiber rotor */}
    {spinning ? (
      <>
        <rect x="2" y="8" width="28" height="2" fill="rgba(203, 213, 225, 0.55)" />
        <rect x="5" y="8" width="22" height="1" fill="#475569" />
      </>
    ) : (
      <>
        <rect x="3" y="8" width="11" height="2" fill="#1e242b" />
        <rect x="4" y="8" width="9" height="1" fill="#475569" />
        <rect x="18" y="8" width="11" height="2" fill="#1e242b" />
        <rect x="19" y="8" width="9" height="1" fill="#475569" />
        <rect x="13" y="7" width="6" height="3" fill="#0f172a" />
      </>
    )}

    {/* Lower coaxial wide dark carbon-fiber rotor */}
    {spinning ? (
      <>
        <rect x="3" y="12" width="26" height="2" fill="rgba(148, 163, 184, 0.5)" />
        <rect x="6" y="12" width="20" height="1" fill="#334155" />
      </>
    ) : (
      <>
        <rect x="4" y="12" width="10" height="2" fill="#1e242b" />
        <rect x="5" y="12" width="8" height="1" fill="#3b4452" />
        <rect x="18" y="12" width="10" height="2" fill="#1e242b" />
        <rect x="19" y="12" width="8" height="1" fill="#3b4452" />
        <rect x="13" y="11" width="6" height="3" fill="#0f172a" />
      </>
    )}

    {/* 4 Splayed carbon-fiber landing legs + looped footpads */}
    {/* Back legs */}
    <rect x="12" y="21" width="1" height="3" fill="#475569" />
    <rect x="11" y="24" width="1" height="3" fill="#475569" />
    <rect x="10" y="27" width="2" height="1" fill="#1e293b" />

    <rect x="19" y="21" width="1" height="3" fill="#475569" />
    <rect x="20" y="24" width="1" height="3" fill="#475569" />
    <rect x="20" y="27" width="2" height="1" fill="#1e293b" />

    {/* Front splayed legs */}
    <rect x="11" y="19" width="2" height="1" fill="#0f172a" />
    <rect x="10" y="20" width="2" height="2" fill="#64748b" />
    <rect x="8" y="22" width="2" height="2" fill="#475569" />
    <rect x="7" y="24" width="2" height="2" fill="#334155" />
    <rect x="5" y="26" width="2" height="2" fill="#1e293b" />
    <rect x="3" y="28" width="3" height="1" fill="#0f172a" />

    <rect x="19" y="19" width="2" height="1" fill="#0f172a" />
    <rect x="20" y="20" width="2" height="2" fill="#64748b" />
    <rect x="22" y="22" width="2" height="2" fill="#475569" />
    <rect x="23" y="24" width="2" height="2" fill="#334155" />
    <rect x="25" y="26" width="2" height="2" fill="#1e293b" />
    <rect x="26" y="28" width="3" height="1" fill="#0f172a" />

    {/* Reflective metallic silver-foil rectangular fuselage box */}
    <rect x="11" y="16" width="10" height="7" fill="#1e293b" />
    <rect x="12" y="17" width="8" height="5" fill="#cbd5e1" />
    {/* Reflective highlights + Martian rust foil bounce */}
    <rect x="12" y="17" width="4" height="2" fill="#f8fafc" />
    <rect x="16" y="18" width="4" height="2" fill="#94a3b8" />
    <rect x="13" y="20" width="6" height="2" fill="#b7793c" />
    <rect x="12" y="19" width="2" height="2" fill="#64748b" />
    {/* Optical sensor / status pip */}
    <rect x="15" y="18" width="2" height="2" fill="#0f172a" />
    <rect x="15" y="18" width="1" height="1" fill={crashed ? '#ef4444' : '#38bdf8'} />
  </svg>
);

const IngenuityInspectPortrait: React.FC = () => (
  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#2c130d] border-2 border-[#5b463d] flex items-center justify-center shrink-0 relative overflow-hidden">
    {/* Pixelated Martian horizon backdrop */}
    <svg viewBox="0 0 32 32" shapeRendering="crispEdges" className="absolute inset-0 w-full h-full pixelated">
      <rect width="32" height="18" fill="#5b281b" />
      <rect y="14" width="32" height="4" fill="#843c22" />
      <rect y="18" width="32" height="14" fill="#a8502c" />
      <rect x="2" y="24" width="6" height="1" fill="#7d361c" />
      <rect x="21" y="27" width="8" height="1" fill="#7d361c" />
    </svg>
    <PixelatedIngenuityModel className="relative z-10 w-18 h-18 sm:w-20 sm:h-20" />
  </div>
);

export const IngenuityDialogueModal: React.FC<IngenuityDialogueModalProps> = ({
  missionAlreadyCompleted,
  rocketOuterPlatingRestored,
  onAcceptMission,
  onPracticeRun,
  onClose,
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const currentLine = INGENUITY_DIALOGUE_LINES[lineIndex];
  const isTyping = visibleChars < currentLine.length;
  const isFinalLine = lineIndex === INGENUITY_DIALOGUE_LINES.length - 1;

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
                Blind Landing: Ingenuity Autopilot · Completed
              </div>
              <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-1">
                Ingenuity Mars Helicopter Relay
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
            <IngenuityInspectPortrait />
            <div className="relative flex-1 bg-[#22262b] border-2 border-[#464d56] p-4 text-sm text-stone-200 leading-relaxed">
              <div className="absolute -left-2 top-5 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#464d56] rotate-45" />
              {rocketOuterPlatingRestored ? (
                <p>
                  All 3 Steel Alloy ingots have been recovered via Ingenuity&apos;s autopilot relay and welded onto the Ares IV&apos;s outer plating!
                </p>
              ) : (
                <p>
                  We already recovered all 3 Steel Alloy ingots from Ingenuity&apos;s flight sectors! Return to the Ares IV rocket to weld them onto the outer plating.
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
              <span>Replay Autopilot</span>
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
            <div className="text-[11px] font-mono-tabular text-sky-300 tracking-wide">
              INGENUITY AUTOPILOT RELAY · EASTERN HIGHLANDS
            </div>
            <h2 className="font-pixel text-base sm:text-lg text-[#e8cf79] mt-0.5">
              Inspecting Ingenuity Mars Helicopter
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

        {/* Pixelated Ingenuity Model + Animated Speech Bubble + Astronaut Portrait */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 shrink-0">
            <IngenuityInspectPortrait />
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono-tabular text-amber-300">
              <AstronautPortrait speaking={isTyping} />
            </div>
          </div>

          <div
            onClick={handleAdvance}
            className="relative flex-1 bg-[#22262b] border-2 border-[#4d5560] p-4 min-h-[152px] flex flex-col justify-between cursor-pointer select-none"
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
                  <span className="inline-block w-2 h-4 bg-amber-300 ml-1 align-middle animate-pulse" />
                )}
              </motion.p>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-[#32373e] text-[11px] text-stone-400 font-mono-tabular">
              <span>
                Telemetry {lineIndex + 1} / {INGENUITY_DIALOGUE_LINES.length}
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
            {INGENUITY_DIALOGUE_LINES.map((_, idx) => (
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
                  className="pixel-btn bg-sky-600 hover:bg-sky-500 text-white font-pixel text-xs px-5 py-2.5 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>LAUNCH AUTOPILOT</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
