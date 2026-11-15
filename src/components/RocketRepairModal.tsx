import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Atom, CheckCircle2, Fuel, Layers, Rocket, Shield, Telescope, Wrench, X } from 'lucide-react';
import { soundFX } from '../game/audio';
import { APOLLO_PLUTONIUM_TOTAL } from '../game/mapData';
import { SurvivalStats } from '../game/types';
import { AstronautPortrait } from './PathfinderDialogueModal';

interface RocketRepairModalProps {
  stats: SurvivalStats;
  atCrashSite: boolean;
  onRestoreCushioning: () => void;
  onRestoreOuterPlating: () => void;
  onOpenFindEarth: () => void;
  onLaunchHome: () => void;
  onLoadLunarFuel?: () => void;
  onFlyToEarth?: () => void;
  onClose: () => void;
}

export const RocketRepairModal: React.FC<RocketRepairModalProps> = ({
  stats,
  atCrashSite,
  onRestoreCushioning,
  onRestoreOuterPlating,
  onOpenFindEarth,
  onLaunchHome,
  onLoadLunarFuel,
  onFlyToEarth,
  onClose,
}) => {
  const { rocket, inventory, pathfinderMission, blindLandingMission, lunarMission, earthLocated } =
    stats;
  const [installingCushioning, setInstallingCushioning] = useState(false);
  const [cushioningProgress, setCushioningProgress] = useState(0);

  const [installingPlating, setInstallingPlating] = useState(false);
  const [platingProgress, setPlatingProgress] = useState(0);

  const [fuelingRocket, setFuelingRocket] = useState(false);
  const [fuelingProgress, setFuelingProgress] = useState(0);

  const cushioningRestored =
    rocket.cushioning >= 100 || pathfinderMission.rocketCushioningRestored;
  const outerPlatingRestored =
    rocket.outerPlating >= 100 || blindLandingMission.rocketOuterPlatingRestored;

  const allSystemsRestored = cushioningRestored && outerPlatingRestored;
  const allReady = allSystemsRestored && earthLocated;
  const completedMissionsCount =
    (cushioningRestored ? 1 : 0) + (outerPlatingRestored ? 1 : 0);

  useEffect(() => {
    if (!installingCushioning) return;

    const interval = window.setInterval(() => {
      setCushioningProgress((prev) => {
        const next = Math.min(100, prev + 8);
        if (next % 24 === 0) {
          soundFX.playRepair();
        }
        if (next >= 100) {
          window.clearInterval(interval);
          setInstallingCushioning(false);
          onRestoreCushioning();
        }
        return next;
      });
    }, 95);

    return () => window.clearInterval(interval);
  }, [installingCushioning, onRestoreCushioning]);

  useEffect(() => {
    if (!installingPlating) return;

    const interval = window.setInterval(() => {
      setPlatingProgress((prev) => {
        const next = Math.min(100, prev + 8);
        if (next % 24 === 0) {
          soundFX.playRepair();
        }
        if (next >= 100) {
          window.clearInterval(interval);
          setInstallingPlating(false);
          onRestoreOuterPlating();
        }
        return next;
      });
    }, 95);

    return () => window.clearInterval(interval);
  }, [installingPlating, onRestoreOuterPlating]);

  useEffect(() => {
    if (!fuelingRocket) return;
    const interval = window.setInterval(() => {
      setFuelingProgress((prev) => {
        const next = Math.min(100, prev + 8);
        if (next % 24 === 0) {
          soundFX.playRepair();
        }
        if (next >= 100) {
          window.clearInterval(interval);
          setFuelingRocket(false);
          onLoadLunarFuel?.();
        }
        return next;
      });
    }, 85);
    return () => window.clearInterval(interval);
  }, [fuelingRocket, onLoadLunarFuel]);

  const handleStartCushioningInstall = () => {
    if (
      !atCrashSite ||
      !pathfinderMission.completed ||
      cushioningRestored ||
      installingCushioning
    ) {
      return;
    }
    soundFX.playUiClick();
    setCushioningProgress(0);
    setInstallingCushioning(true);
  };

  const handleStartPlatingInstall = () => {
    if (
      !atCrashSite ||
      !blindLandingMission.completed ||
      outerPlatingRestored ||
      installingPlating
    ) {
      return;
    }
    soundFX.playUiClick();
    setPlatingProgress(0);
    setInstallingPlating(true);
  };

  const handleStartLunarFueling = () => {
    if (
      !atCrashSite ||
      !lunarMission.rocketFuelRecovered ||
      lunarMission.rocketFueled ||
      fuelingRocket
    ) {
      return;
    }
    soundFX.playUiClick();
    setFuelingProgress(0);
    setFuelingRocket(true);
  };

  if (stats.planet === 'moon') {
    const fuelLoaded = lunarMission.rocketFueled;
    return (
      <div className="fixed inset-0 z-40 bg-black/68 flex items-center justify-center p-4">
        <div className="pixel-panel-dark w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-stone-100">
          {/* Moon Header */}
          <div className="bg-[#343940] border-b-2 border-[#15171a] px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Rocket className="w-5 h-5 text-sky-300" />
              <div>
                <h2 className="font-pixel text-base text-[#e8cf79]">
                  Ares IV — Lunar Launch Pad
                </h2>
                <p className="text-xs text-stone-300 mt-0.5">
                  {atCrashSite
                    ? 'Power the Lunar Rover via RTG, recover Rocket Fuel, and fly home to Earth'
                    : 'Inspecting telemetry remotely · Return to the Lunar Landing Pad to fuel up'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClose();
                onClose();
              }}
              aria-label="Close spacecraft console"
              className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Step 1: Apollo Plutonium & RTG */}
            <div className="bg-[#25282c] border-2 border-[#474e57] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Atom className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span className="text-sm font-semibold text-stone-100">
                    Challenge 1 · Apollo Plutonium &amp; RTG Rover Charge
                  </span>
                </div>
                <span
                  className={`font-mono-tabular text-xs font-bold ${
                    lunarMission.roverCharged ? 'text-emerald-400' : 'text-cyan-300'
                  }`}
                >
                  {lunarMission.roverCharged
                    ? 'ROVER CHARGED'
                    : `${lunarMission.plutoniumCollected}/${APOLLO_PLUTONIUM_TOTAL} PU-238`}
                </span>
              </div>
              <p className="text-xs text-stone-300">
                {lunarMission.roverCharged
                  ? 'All 4 Apollo Plutonium-238 cores are powering the RTG and the Lunar Rover is 100% charged.'
                  : 'Collect all 4 Plutonium-238 cores from the Apollo mission wrecks and insert them into the RTG to charge the Lunar Rover.'}
              </p>
            </div>

            {/* Step 2: Lunar Rover Fuel Run & Rocket Fueling */}
            <div className="bg-[#25282c] border-2 border-[#474e57] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="text-sm font-semibold text-stone-100">
                    Challenge 2 · Lunar Rover Fuel Depot &amp; Rocket Propellant
                  </span>
                </div>
                <span
                  className={`font-mono-tabular text-xs font-bold ${
                    fuelLoaded ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {fuelLoaded ? '100%' : fuelingRocket ? `${fuelingProgress}%` : '0%'}
                </span>
              </div>

              <div className="w-full h-2.5 bg-[#16181b] border border-[#32363d] overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    fuelLoaded ? 'bg-emerald-500' : 'bg-cyan-400'
                  }`}
                  style={{
                    width: `${fuelLoaded ? 100 : fuelingRocket ? fuelingProgress : 0}%`,
                  }}
                />
              </div>

              {fuelingRocket ? (
                <div className="bg-[#1b1e23] border border-cyan-400/50 p-3 flex items-center gap-3">
                  <AstronautPortrait speaking />
                  <div className="space-y-1">
                    <div className="font-pixel text-xs text-cyan-300">
                      Pumping Cryogenic Rocket Fuel...
                    </div>
                    <p className="text-xs text-stone-300">
                      Transferring LOX / RP-1 propellant from the Lunar Rover tanks into the Ares IV main booster.
                    </p>
                  </div>
                </div>
              ) : fuelLoaded ? (
                <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span className="font-pixel">ROCKET FUEL TANKS 100% FULL!</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Ready for Earth Return
                  </span>
                </div>
              ) : lunarMission.rocketFuelRecovered ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-stone-300">
                    Rocket Fuel recovered from Lunar Fuel Base 02! Load it into the rocket.
                  </span>
                  <button
                    type="button"
                    disabled={!atCrashSite}
                    onClick={handleStartLunarFueling}
                    className="pixel-btn bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Fuel className="w-3.5 h-3.5" />
                    <span>Load Rocket Fuel</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-rose-300 font-semibold">
                  {lunarMission.roverCharged
                    ? 'Interact with the charged Lunar Rover to drive to Lunar Fuel Base 02 and recover Rocket Fuel.'
                    : 'Charge the Lunar Rover at the RTG first, then drive it to Lunar Fuel Base 02 for Rocket Fuel.'}
                </div>
              )}
            </div>

            {/* Step 3: Fly to Earth */}
            <div className="bg-[#23262a] border border-[#3e434a] p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-stone-100">
                  {fuelLoaded ? 'Earth Return Trajectory Ready' : 'Awaiting Rocket Fuel'}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {fuelLoaded
                    ? 'All propellant tanks pressurized. Ignite main thrusters to fly home to Earth!'
                    : 'Retrieve Rocket Fuel from Lunar Fuel Base 02 and pump it into Ares IV above.'}
                </div>
              </div>
              <button
                type="button"
                disabled={!fuelLoaded || !atCrashSite}
                onClick={() => {
                  soundFX.playUiClick();
                  onFlyToEarth?.();
                }}
                className="pixel-btn bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                Fly to Earth!
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/65 flex items-center justify-center p-4">
      <div className="pixel-panel-dark w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-stone-100">
        {/* Header */}
        <div className="bg-[#3a3f46] border-b-2 border-[#15171a] px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-sky-300" />
            <div>
              <h2 className="font-pixel text-base text-[#e8cf79]">
                Ares IV — Spacecraft Repair Bay
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                {atCrashSite
                  ? 'Complete the 2 recovery missions and install components to launch home'
                  : 'Inspecting telemetry remotely · Return to the Crash Site to install components'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playUiClose();
              onClose();
            }}
            aria-label="Close spacecraft console"
            className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Mission Recovery Stockpile Strip */}
          <div className="bg-[#23262a] border border-[#3e434a] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-stone-300 font-medium">Recovered Mission Components</span>
            <div className="flex flex-wrap items-center gap-5 font-mono-tabular font-bold">
              <span className="text-amber-300">
                Airbags (Mission 1): {cushioningRestored ? 'Installed' : `${inventory.airbags}/10`}
              </span>
              <span className="text-sky-300">
                Steel Alloys (Mission 2):{' '}
                {outerPlatingRestored ? 'Installed' : `${inventory.steelAlloys}/3`}
              </span>
            </div>
          </div>

          {/* Mission 1: Emergency Landing Cushioning System (Pathfinder Airbags) */}
          <div className="bg-[#25282c] border-2 border-[#474e57] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-sm font-semibold text-stone-100">
                  Mission 1 · Emergency Landing Cushioning (Pathfinder Airbags)
                </span>
              </div>
              <span
                className={`font-mono-tabular text-xs font-bold ${
                  cushioningRestored ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {cushioningRestored
                  ? '100%'
                  : installingCushioning
                  ? `${cushioningProgress}%`
                  : '0%'}
              </span>
            </div>

            <div className="w-full h-2.5 bg-[#16181b] border border-[#32363d] overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ${
                  cushioningRestored ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                style={{
                  width: `${
                    cushioningRestored ? 100 : installingCushioning ? cushioningProgress : 0
                  }%`,
                }}
              />
            </div>

            {installingCushioning ? (
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="bg-[#1b1e23] border border-amber-400/50 p-3 flex items-center gap-3"
              >
                <AstronautPortrait speaking />
                <div className="space-y-1">
                  <div className="font-pixel text-xs text-amber-300">
                    Installing Pathfinder Airbag Modules...
                  </div>
                  <p className="text-xs text-stone-300">
                    Mounting multi-lobed Vectran cushioning pods and tension straps onto the Ares IV landing skirt.
                  </p>
                </div>
              </motion.div>
            ) : cushioningRestored ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="font-pixel text-xs text-emerald-400">
                  ROCKET CUSHIONING SYSTEM RESTORED!
                </span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Operational
                </span>
              </div>
            ) : pathfinderMission.completed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-stone-300">
                  10 / 10 Pathfinder airbags recovered and ready for installation.
                </div>
                <button
                  type="button"
                  disabled={!atCrashSite}
                  onClick={handleStartCushioningInstall}
                  className="pixel-btn bg-amber-600 hover:bg-amber-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Install Airbags (10/10)</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-semibold text-rose-300">
                  Recover 10 Airbags from the Abandoned Mars Pathfinder Rover (West Crater).
                </span>
                <button
                  type="button"
                  disabled
                  className="pixel-btn bg-[#34383e] text-stone-500 px-3.5 py-1.5 text-xs font-semibold cursor-not-allowed whitespace-nowrap"
                >
                  Locked ({inventory.airbags}/10)
                </button>
              </div>
            )}
          </div>

          {/* Mission 2: Outer Plating System (Ingenuity Steel Alloys) */}
          <div className="bg-[#25282c] border-2 border-[#474e57] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-300 shrink-0" />
                <span className="text-sm font-semibold text-stone-100">
                  Mission 2 · Rocket Outer Plating (Ingenuity Steel Alloys)
                </span>
              </div>
              <span
                className={`font-mono-tabular text-xs font-bold ${
                  outerPlatingRestored ? 'text-emerald-400' : 'text-sky-300'
                }`}
              >
                {outerPlatingRestored
                  ? '100%'
                  : installingPlating
                  ? `${platingProgress}%`
                  : '0%'}
              </span>
            </div>

            <div className="w-full h-2.5 bg-[#16181b] border border-[#32363d] overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ${
                  outerPlatingRestored ? 'bg-emerald-500' : 'bg-sky-400'
                }`}
                style={{
                  width: `${
                    outerPlatingRestored ? 100 : installingPlating ? platingProgress : 0
                  }%`,
                }}
              />
            </div>

            {installingPlating ? (
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="bg-[#1b1e23] border border-sky-400/50 p-3 flex items-center gap-3"
              >
                <AstronautPortrait speaking />
                <div className="space-y-1">
                  <div className="font-pixel text-xs text-sky-300">
                    Welding Steel Alloy Outer Plating...
                  </div>
                  <p className="text-xs text-stone-300">
                    Sealing the Ares IV hull breach with 3 aerospace Steel Alloy ingots recovered via Ingenuity Blind Landing.
                  </p>
                </div>
              </motion.div>
            ) : outerPlatingRestored ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="font-pixel text-xs text-emerald-400">
                  OUTER PLATING SYSTEM RESTORED!
                </span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Operational
                </span>
              </div>
            ) : blindLandingMission.completed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-stone-300">
                  3 / 3 Steel Alloys recovered and ready to weld onto the outer hull.
                </div>
                <button
                  type="button"
                  disabled={!atCrashSite}
                  onClick={handleStartPlatingInstall}
                  className="pixel-btn bg-sky-600 hover:bg-sky-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Install Outer Plating (3/3)</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-semibold text-rose-300">
                  Recover 3 Steel Alloys from the Ingenuity Autopilot Relay (East Highlands).
                </span>
                <button
                  type="button"
                  disabled
                  className="pixel-btn bg-[#34383e] text-stone-500 px-3.5 py-1.5 text-xs font-semibold cursor-not-allowed whitespace-nowrap"
                >
                  Locked ({inventory.steelAlloys}/3)
                </button>
              </div>
            )}
          </div>

          {/* Pre-Launch Navigation: Kepler Space Telescope */}
          <div className="bg-[#25282c] border-2 border-[#474e57] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Telescope className="w-4 h-4 text-orange-300 shrink-0" />
                <span className="text-sm font-semibold text-stone-100">
                  Pre-Launch · Locate Earth (Kepler Space Telescope)
                </span>
              </div>
              <span
                className={`font-mono-tabular text-xs font-bold ${
                  earthLocated ? 'text-emerald-400' : 'text-orange-300'
                }`}
              >
                {earthLocated ? 'LOCKED' : allSystemsRestored ? 'READY' : 'LOCKED'}
              </span>
            </div>

            {earthLocated ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                <span className="font-pixel text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  EARTH TRANSIT SIGNATURE LOCKED!
                </span>
                <button
                  type="button"
                  disabled={!atCrashSite}
                  onClick={() => {
                    soundFX.playUiClick();
                    onOpenFindEarth();
                  }}
                  className="pixel-btn bg-[#3a3f46] hover:bg-[#494f56] disabled:bg-[#34383e] disabled:text-stone-500 text-stone-200 px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Replay Kepler Scan
                </button>
              </div>
            ) : allSystemsRestored ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                <span className="text-xs text-stone-300">
                  {atCrashSite
                    ? 'Both ship systems restored! Scan starlight dips with the Kepler Space Telescope to lock Earth before takeoff.'
                    : 'Return to the Crash Site spaceship to use the Kepler Space Telescope.'}
                </span>
                <button
                  type="button"
                  disabled={!atCrashSite}
                  onClick={() => {
                    soundFX.playUiClick();
                    onOpenFindEarth();
                  }}
                  className="pixel-btn bg-orange-600 hover:bg-orange-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Telescope className="w-3.5 h-3.5" />
                  <span>🔭 Find Earth</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-stone-400">
                Install Mission 1 Cushioning and Mission 2 Outer Plating first to power up the Kepler Space Telescope.
              </div>
            )}
          </div>

          {/* Final Launch Action */}
          <div className="bg-[#23262a] border border-[#3e434a] p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-stone-100">
                {allReady
                  ? 'All Systems & Earth Course Verified'
                  : allSystemsRestored
                  ? 'Spacecraft Repaired · Locate Earth to Launch'
                  : `Rebuild Progress: ${completedMissionsCount} / 2 Missions Installed`}
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                {allReady
                  ? 'Outer plating, cushioning, and Earth coordinates locked. Ready to launch off Mars.'
                  : allSystemsRestored
                  ? 'Run the Kepler Space Telescope scan above to find Earth before taking off.'
                  : 'Complete both the Mars Airbag Run and Blind Landing helicopter missions to rebuild the rocket.'}
              </div>
            </div>

            <button
              type="button"
              disabled={!allReady || !atCrashSite}
              onClick={onLaunchHome}
              className="pixel-btn bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#34383e] disabled:text-stone-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              Launch Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
