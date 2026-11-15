import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Atom, BatteryCharging, CheckCircle2, Flame, Lock, X, Zap } from 'lucide-react';
import { soundFX } from '../game/audio';
import { APOLLO_PLUTONIUM_TOTAL } from '../game/mapData';
import { SurvivalStats } from '../game/types';
import { AstronautPortrait } from './PathfinderDialogueModal';

interface LunarRtgModalProps {
  stats: SurvivalStats;
  onRoverCharged: () => void;
  onClose: () => void;
}

export const LunarRtgModal: React.FC<LunarRtgModalProps> = ({
  stats,
  onRoverCharged,
  onClose,
}) => {
  const { lunarMission } = stats;
  const collected = Math.min(APOLLO_PLUTONIUM_TOTAL, lunarMission.plutoniumCollected);
  const hasAllPlutonium = collected >= APOLLO_PLUTONIUM_TOTAL;

  const [charging, setCharging] = useState(false);
  const [chargePct, setChargePct] = useState(lunarMission.roverCharged ? 100 : 0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!charging) onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [charging, onClose]);

  useEffect(() => {
    if (!charging) return;
    const interval = window.setInterval(() => {
      setChargePct((prev) => {
        const next = Math.min(100, prev + 6);
        if (next % 24 === 0) {
          soundFX.playRepair();
        }
        if (next >= 100) {
          window.clearInterval(interval);
          setCharging(false);
          onRoverCharged();
        }
        return next;
      });
    }, 80);
    return () => window.clearInterval(interval);
  }, [charging, onRoverCharged]);

  const handleStartCharge = () => {
    if (!hasAllPlutonium || lunarMission.roverCharged || charging) return;
    soundFX.playUiClick();
    setChargePct(0);
    setCharging(true);
  };

  const displayPct = lunarMission.roverCharged ? 100 : chargePct;
  const tempC = Math.round(-130 + (displayPct / 100) * 870);

  return (
    <div className="fixed inset-0 z-40 bg-black/72 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pixel-panel-dark w-full max-w-xl flex flex-col overflow-hidden text-stone-100"
      >
        {/* Header */}
        <div className="bg-[#343940] border-b-2 border-[#15171a] px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Atom className="w-5 h-5 text-cyan-300" />
            <div>
              <h2 className="font-pixel text-sm sm:text-base text-[#e8cf79]">
                RTG POWER & ROVER CHARGER
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                Radioisotope Thermoelectric Generator · Mission 1
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={charging}
            onClick={() => {
              soundFX.playUiClick();
              onClose();
            }}
            aria-label="Close RTG console"
            className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] disabled:opacity-50 p-1.5 text-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* NASA Science Brief */}
          <div className="bg-[#1e232b] border border-[#3a424e] p-3.5 text-xs text-stone-300 leading-relaxed">
            <span className="text-cyan-300 font-semibold">How NASA RTGs Work: </span>
            A Radioisotope Thermoelectric Generator converts heat from decaying{' '}
            <strong className="text-stone-100">Plutonium-238</strong> directly into steady
            electricity via solid-state thermocouples—powering lunar rovers even without
            sunlight.
          </div>

          {/* Apollo Plutonium Core Slots */}
          <div className="bg-[#23262a] border-2 border-[#464e58] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-100">
                Apollo Mission Plutonium-238 Cores
              </span>
              <span
                className={`font-mono-tabular font-bold ${
                  hasAllPlutonium ? 'text-cyan-300' : 'text-amber-300'
                }`}
              >
                {collected} / {APOLLO_PLUTONIUM_TOTAL} Collected
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: APOLLO_PLUTONIUM_TOTAL }).map((_, i) => {
                const filled = i < collected;
                const activeGlow = lunarMission.roverCharged || charging;
                return (
                  <div
                    key={i}
                    className={`border-2 p-2.5 text-center transition-colors ${
                      activeGlow
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
                        : filled
                        ? 'bg-[#1b2c33] border-cyan-500/80 text-cyan-300'
                        : 'bg-[#171a1e] border-[#30353d] text-stone-500'
                    }`}
                  >
                    <div className="font-pixel text-[10px]">PU-238</div>
                    <div className="text-[10px] font-mono-tabular mt-1">
                      {activeGlow ? 'ACTIVE' : filled ? 'READY' : 'EMPTY'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seebeck Thermal Output & Rover Charge Progress */}
          <div className="bg-[#23262a] border-2 border-[#464e58] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono-tabular">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Flame className="w-4 h-4" />
                Core Temp: <strong>{tempC}°C</strong>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <BatteryCharging className="w-4 h-4" />
                Rover Battery: <strong>{displayPct}%</strong>
              </span>
            </div>

            <div className="w-full h-3 bg-[#14171a] border border-[#323840] overflow-hidden">
              <div
                className={`h-full transition-[width] duration-100 ${
                  displayPct >= 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-amber-500 to-cyan-400'
                }`}
                style={{ width: `${displayPct}%` }}
              />
            </div>

            {charging && (
              <div className="flex items-center gap-3 pt-1">
                <AstronautPortrait speaking />
                <p className="text-xs text-cyan-200 leading-relaxed">
                  Loading all 4 Plutonium-238 fuel pellets into the RTG thermal core and
                  routing electricity down the power cable into the Lunar Rover...
                </p>
              </div>
            )}
          </div>

          {/* Action Row */}
          {lunarMission.roverCharged ? (
            <div className="bg-emerald-950/40 border border-emerald-500/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  RTG Online! Lunar Rover is 100% charged—walk south to the Rover to drive
                  to Lunar Fuel Base 02.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  onClose();
                }}
                className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-4 py-2 cursor-pointer ml-auto"
              >
                CONTINUE
              </button>
            </div>
          ) : hasAllPlutonium ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-stone-300">
                All 4 Apollo Plutonium cores ready! Power up the RTG to charge the rover.
              </span>
              <button
                type="button"
                disabled={charging}
                onClick={handleStartCharge}
                className="pixel-btn bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-pixel text-xs px-4 py-2.5 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{charging ? 'CHARGING...' : 'POWER RTG & CHARGE ROVER'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#2b201b] border border-amber-500/50 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <Lock className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  Collect all {APOLLO_PLUTONIUM_TOTAL} Plutonium cores scattered from the
                  Apollo mission spaceships ({APOLLO_PLUTONIUM_TOTAL - collected} remaining).
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  onClose();
                }}
                className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 font-pixel text-[11px] px-3 py-1.5 cursor-pointer shrink-0"
              >
                SEARCH MOON
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
