import React, { useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Gamepad2,
  Maximize2,
  MessageSquareText,
  Music,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { AudioSettings } from '../game/audio';
import {
  CRASH_SAFE_RADIUS_PX,
  CRASH_SITE_POS,
  LUNAR_LANDING_PAD_POS,
  MAP_H,
  MAP_W,
  TILE_SIZE,
} from '../game/mapData';
import {
  ObjectivePinId,
  buildNavigationObjectives,
  resolveActiveObjective,
} from '../game/navigationGuide';
import { PlayerState, StructureEntity, SurvivalStats, TileType } from '../game/types';

const MINI_SCALE = 3.5; // 56*3.5 = 196, 38*3.5 = 133

function getMiniTileColor(t: TileType): string {
  switch (t) {
    case 'mountain_wall':
      return '#3d1712';
    case 'ridge_rock':
      return '#75311c';
    case 'crater_floor':
      return '#6b2c17';
    case 'crater_rim':
      return '#b95f3a';
    case 'scorch':
      return '#4a1f14';
    case 'regolith':
      return '#8e3d21';
    case 'lunar_horizon':
      return '#070b14';
    case 'lunar_ridge':
      return '#4c5463';
    case 'lunar_crater_floor':
      return '#404652';
    case 'lunar_crater_rim':
      return '#8b94a4';
    case 'lunar_pad_scorch':
      return '#2b303a';
    case 'lunar_regolith':
      return '#68707e';
  }
}

interface ColonyHudProps {
  tiles: TileType[][];
  stats: SurvivalStats;
  player: PlayerState;
  structures: StructureEntity[];
  audioSettings: AudioSettings;
  paused: boolean;
  showRadar: boolean;
  trackedObjectiveId: ObjectivePinId | null;
  contextHint: string | null;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleGameplaySfx: () => void;
  onToggleUiSfx: () => void;
  onTogglePause: () => void;
  onToggleRadar: () => void;
  onOpenTacticalMap: () => void;
  onClearManualTrack: () => void;
  onOpenRocketStatus: () => void;
  onRecenter: () => void;
  onPeekHold: (dir: 'left' | 'right' | null) => void;
  onTriggerAction: () => void;
}

export const ColonyHud: React.FC<ColonyHudProps> = ({
  tiles,
  stats,
  player,
  structures,
  audioSettings,
  paused,
  showRadar,
  trackedObjectiveId,
  contextHint,
  onToggleMute,
  onToggleMusic,
  onToggleGameplaySfx,
  onToggleUiSfx,
  onTogglePause,
  onToggleRadar,
  onOpenTacticalMap,
  onClearManualTrack,
  onOpenRocketStatus,
  onRecenter,
  onPeekHold,
  onTriggerAction,
}) => {
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundMenuRef = useRef<HTMLDivElement | null>(null);
  const [soundMenuOpen, setSoundMenuOpen] = React.useState(false);

  useEffect(() => {
    if (!soundMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) {
        setSoundMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [soundMenuOpen]);

  const objectives = useMemo(
    () => buildNavigationObjectives(stats, player, structures),
    [stats, player, structures]
  );
  const activeObjective = useMemo(
    () => resolveActiveObjective(objectives, trackedObjectiveId),
    [objectives, trackedObjectiveId]
  );

  useEffect(() => {
    if (!showRadar) return;
    const canvas = miniCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // 1. Mars / Moon Terrain Base
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        ctx.fillStyle = getMiniTileColor(tiles[ty][tx]);
        ctx.fillRect(
          Math.floor(tx * MINI_SCALE),
          Math.floor(ty * MINI_SCALE),
          Math.ceil(MINI_SCALE),
          Math.ceil(MINI_SCALE)
        );
      }
    }

    // 2. Spacecraft / Lunar Pad Safety Ring
    const site = stats.planet === 'moon' ? LUNAR_LANDING_PAD_POS : CRASH_SITE_POS;
    const rcx = (site.tx + site.w / 2) * MINI_SCALE;
    const rcy = (site.ty + site.h / 2) * MINI_SCALE;
    const safeR = (CRASH_SAFE_RADIUS_PX / TILE_SIZE) * MINI_SCALE;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(rcx, rcy, safeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. Scenic Relics / Exploration Sites
    for (const s of structures) {
      if (s.category === 'terrain') {
        if (
          s.type === 'boulder' ||
          s.type === 'lunar_boulder' ||
          s.type === 'metal_debris' ||
          s.type === 'circuit_wreck'
        ) {
          continue;
        }
        const sx = (s.tx + s.w / 2) * MINI_SCALE;
        const sy = (s.ty + s.h / 2) * MINI_SCALE;
        ctx.fillStyle = 'rgba(251, 146, 60, 0.72)';
        ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1), 3, 3);
      } else if (s.category === 'exploration_site') {
        const sx = (s.tx + s.w / 2) * MINI_SCALE;
        const sy = (s.ty + s.h / 2) * MINI_SCALE;
        ctx.fillStyle = s.salvaged
          ? 'rgba(148, 163, 184, 0.45)'
          : s.type === 'apollo_plutonium'
          ? '#22d3ee'
          : '#fb923c';
        ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1), 3, 3);
      }
    }

    // 4. Dashed Route Line from Astronaut to Active Objective
    const px = (player.x / TILE_SIZE) * MINI_SCALE;
    const py = (player.y / TILE_SIZE) * MINI_SCALE;
    const tx = (activeObjective.targetX / TILE_SIZE) * MINI_SCALE;
    const ty = (activeObjective.targetY / TILE_SIZE) * MINI_SCALE;

    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();

    // 5. Objective Pins
    const shipRepaired =
      stats.rocket.cushioning >= 100 && stats.rocket.outerPlating >= 100;
    for (const obj of objectives) {
      if (
        stats.planet === 'mars' &&
        obj.id === 'kepler_telescope' &&
        !shipRepaired &&
        activeObjective.id !== 'kepler_telescope'
      ) {
        continue;
      }
      if (
        stats.planet === 'mars' &&
        obj.id === 'crashed_rocket' &&
        shipRepaired &&
        activeObjective.id === 'kepler_telescope'
      ) {
        continue;
      }

      const ox = (obj.targetX / TILE_SIZE) * MINI_SCALE;
      const oy = (obj.targetY / TILE_SIZE) * MINI_SCALE;
      const isCurrent = obj.id === activeObjective.id;

      if (isCurrent) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ox, oy, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = obj.completed
        ? '#15803d'
        : isCurrent
        ? '#d97706'
        : '#1e293b';
      ctx.strokeStyle = obj.completed
        ? '#4ade80'
        : isCurrent
        ? '#fde047'
        : '#fbbf24';
      ctx.lineWidth = 1;
      ctx.fillRect(Math.round(ox - 5), Math.round(oy - 5), 10, 10);
      ctx.strokeRect(Math.round(ox - 5), Math.round(oy - 5), 10, 10);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.pin, ox, oy + 0.5);
    }

    // 6. Astronaut Position
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(Math.round(px - 3), Math.round(py - 3), 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
  }, [
    activeObjective,
    objectives,
    player.x,
    player.y,
    showRadar,
    stats.planet,
    stats.rocket.cushioning,
    stats.rocket.outerPlating,
    structures,
    tiles,
  ]);

  const rocketPct =
    stats.planet === 'moon'
      ? (stats.lunarMission.roverCharged ? 33 : 0) +
        (stats.lunarMission.rocketFuelRecovered ? 33 : 0) +
        (stats.lunarMission.rocketFueled ? 34 : 0)
      : Math.round((stats.rocket.cushioning + stats.rocket.outerPlating) / 2);
  const lowO2 = stats.suitOxygen < 28;
  const lowPower = stats.suitPower < 28;

  return (
    <>
      {/* Top-Left Compact Controls & Radar Column */}
      <div className="fixed top-3 left-3 z-20 flex flex-col items-start gap-2.5">
        <div className="pixel-panel px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePause}
            title={paused ? 'Resume (Esc)' : 'Pause (Esc)'}
            className="pixel-btn bg-[#3a3e44] hover:bg-[#494f56] text-stone-100 px-3 py-1.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {paused ? (
              <Play className="w-4 h-4 text-emerald-400" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenRocketStatus}
            title="Inspect Spacecraft Repair Progress"
            className="pixel-btn bg-[#3a3e44] hover:bg-[#494f56] text-stone-100 px-3 py-1.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Rocket className="w-4 h-4 text-sky-300" />
            <span className="font-mono-tabular">Ship {rocketPct}%</span>
          </button>

          <button
            type="button"
            onClick={onToggleRadar}
            title="Toggle Surface Radar (Tab)"
            className={`pixel-btn px-3 py-1.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              showRadar
                ? 'bg-sky-700 text-white'
                : 'bg-[#3a3e44] hover:bg-[#494f56] text-stone-100'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Radar</span>
          </button>

          <button
            type="button"
            onClick={onRecenter}
            title="Center Camera on Astronaut (C)"
            className="pixel-btn bg-[#3a3e44] hover:bg-[#494f56] text-stone-100 p-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            title={audioSettings.musicEnabled ? 'Mute 8-Bit Music' : 'Enable 8-Bit Music'}
            className={`pixel-btn p-2 cursor-pointer flex items-center gap-1 text-xs font-pixel ${
              !audioSettings.musicEnabled || audioSettings.muted
                ? 'bg-[#312d34] hover:bg-[#403a44] text-stone-400'
                : 'bg-[#3a3e44] hover:bg-[#494f56] text-amber-300'
            }`}
          >
            <Music className="w-4 h-4" />
            <span className="hidden sm:inline">
              {!audioSettings.musicEnabled || audioSettings.muted ? 'BGM Off' : 'BGM'}
            </span>
          </button>

          <div ref={soundMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSoundMenuOpen((v) => !v)}
              title="Sound Channels & Audio Controls"
              className={`pixel-btn p-2 cursor-pointer flex items-center gap-1 text-xs font-pixel ${
                soundMenuOpen
                  ? 'bg-sky-700 text-white'
                  : 'bg-[#3a3e44] hover:bg-[#494f56] text-stone-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-sky-300" />
              <span className="hidden md:inline">Audio</span>
            </button>

            {soundMenuOpen && (
              <div className="pixel-panel-dark absolute left-0 top-full mt-2 w-64 p-3 z-40 space-y-2 shadow-2xl">
                <div className="flex items-center justify-between border-b border-stone-600/60 pb-1.5">
                  <span className="font-pixel text-[11px] text-[#e8cf79]">
                    SOUND CHANNELS
                  </span>
                  <span className="text-[10px] font-mono-tabular text-stone-400">
                    Hotkey: M
                  </span>
                </div>

                {/* 8-Bit Music Toggle */}
                <button
                  type="button"
                  onClick={onToggleMusic}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-[#1c2026] hover:bg-[#252a32] border border-[#38404b] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Music
                      className={`w-4 h-4 shrink-0 ${
                        audioSettings.musicEnabled && !audioSettings.muted
                          ? 'text-amber-300'
                          : 'text-stone-500'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-stone-100">
                        8-Bit Music
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Soft chiptune soundtrack
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-pixel text-[10px] px-2 py-0.5 border shrink-0 ${
                      audioSettings.musicEnabled && !audioSettings.muted
                        ? 'bg-emerald-900/60 border-emerald-400 text-emerald-300'
                        : 'bg-stone-800 border-stone-600 text-stone-400'
                    }`}
                  >
                    {audioSettings.musicEnabled && !audioSettings.muted ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Gameplay SFX Toggle */}
                <button
                  type="button"
                  onClick={onToggleGameplaySfx}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-[#1c2026] hover:bg-[#252a32] border border-[#38404b] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2
                      className={`w-4 h-4 shrink-0 ${
                        audioSettings.gameplaySfxEnabled && !audioSettings.muted
                          ? 'text-sky-300'
                          : 'text-stone-500'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-stone-100">
                        Gameplay SFX
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Steps, jumps, alerts, launch
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-pixel text-[10px] px-2 py-0.5 border shrink-0 ${
                      audioSettings.gameplaySfxEnabled && !audioSettings.muted
                        ? 'bg-emerald-900/60 border-emerald-400 text-emerald-300'
                        : 'bg-stone-800 border-stone-600 text-stone-400'
                    }`}
                  >
                    {audioSettings.gameplaySfxEnabled && !audioSettings.muted ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* UI & Dialogue SFX Toggle */}
                <button
                  type="button"
                  onClick={onToggleUiSfx}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-[#1c2026] hover:bg-[#252a32] border border-[#38404b] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquareText
                      className={`w-4 h-4 shrink-0 ${
                        audioSettings.uiSfxEnabled && !audioSettings.muted
                          ? 'text-emerald-300'
                          : 'text-stone-500'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-stone-100">
                        UI &amp; Dialogue
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Clicks, radar pings, typing
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-pixel text-[10px] px-2 py-0.5 border shrink-0 ${
                      audioSettings.uiSfxEnabled && !audioSettings.muted
                        ? 'bg-emerald-900/60 border-emerald-400 text-emerald-300'
                        : 'bg-stone-800 border-stone-600 text-stone-400'
                    }`}
                  >
                    {audioSettings.uiSfxEnabled && !audioSettings.muted ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Master Mute Toggle */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-[#231d21] hover:bg-[#2d242a] border border-[#4a3942] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {audioSettings.muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-stone-200 shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="text-xs font-semibold text-stone-100">
                        Master Audio
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Mute or unmute all sound
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-pixel text-[10px] px-2 py-0.5 border shrink-0 ${
                      !audioSettings.muted
                        ? 'bg-emerald-900/60 border-emerald-400 text-emerald-300'
                        : 'bg-rose-900/60 border-rose-400 text-rose-300'
                    }`}
                  >
                    {audioSettings.muted ? 'MUTED' : 'LIVE'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            title={audioSettings.muted ? 'Unmute All Audio (M)' : 'Mute All Audio (M)'}
            className="pixel-btn bg-[#3a3e44] hover:bg-[#494f56] text-stone-100 p-2 cursor-pointer"
          >
            {audioSettings.muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Guided Corner Radar directly below top-left controls */}
        {showRadar && (
          <div className="pixel-panel-dark p-2 w-[clamp(140px,min(18vw,calc((100dvh-210px)*0.9)),224px)] flex flex-col gap-1.5">
            <div
              className={`relative border overflow-hidden group ${
                stats.planet === 'moon' ? 'border-[#0e121a]' : 'border-[#1a0d0a]'
              }`}
            >
              <canvas
                ref={miniCanvasRef}
                width={Math.round(MAP_W * MINI_SCALE)}
                height={Math.round(MAP_H * MINI_SCALE)}
                onClick={onOpenTacticalMap}
                title="Click to expand Tactical Map & Instructions (G)"
                className="w-full h-auto block pixelated cursor-pointer"
              />
              <button
                type="button"
                onClick={onOpenTacticalMap}
                title="Open Interactive Tactical Map (G)"
                className="absolute top-1 right-1 bg-black/75 hover:bg-black/95 border border-stone-500/60 px-1.5 py-0.5 text-[9px] font-pixel text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 className="w-2.5 h-2.5" />
                <span>EXPAND</span>
              </button>
            </div>

            {/* Active Objective Direction & Instruction Strip */}
            <div className="bg-[#1b1f24] border border-[#32373f] px-1.5 py-1 space-y-0.5">
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular">
                <span className="font-bold text-amber-300 truncate">
                  [{activeObjective.pin}] {activeObjective.title}
                </span>
                <span className="text-sky-300 font-bold shrink-0">
                  {activeObjective.bearing} · {activeObjective.distanceMeters}m
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[9px] text-stone-300">
                <span className="truncate">{activeObjective.controlsCue}</span>
                {trackedObjectiveId && (
                  <button
                    type="button"
                    onClick={onClearManualTrack}
                    className="text-amber-300 hover:text-amber-200 underline shrink-0 cursor-pointer"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top-Right Survival & Salvage Inventory HUD */}
      <div className="fixed top-3 right-3 z-20 flex flex-col items-end gap-1.5 max-w-[calc(100vw-24px)]">
        <div className="pixel-panel px-3.5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-stone-100">
          <span className="font-pixel text-sm sm:text-base text-[#e8cf79] tracking-wide whitespace-nowrap">
            {stats.planet === 'moon' ? `Luna · Sol ${stats.sol}` : `Sol ${stats.sol}`}
          </span>

          <div
            className={`flex items-center gap-1.5 whitespace-nowrap ${
              lowO2 ? 'text-rose-300' : 'text-stone-100'
            }`}
            title="Suit Oxygen Reserve"
          >
            <Wind className="w-4 h-4 text-sky-300" />
            <span className="font-mono-tabular text-xs sm:text-sm font-bold">
              {Math.round(stats.suitOxygen)}%
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 whitespace-nowrap ${
              lowPower ? 'text-rose-300' : 'text-stone-100'
            }`}
            title="EVA Suit Battery"
          >
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="font-mono-tabular text-xs sm:text-sm font-bold">
              {Math.round(stats.suitPower)}%
            </span>
          </div>

          {stats.planet === 'moon' ? (
            <>
              <div
                className="flex items-center gap-1.5 whitespace-nowrap"
                title="Apollo Plutonium-238 Cores (Challenge 1: Power RTG)"
              >
                <span className="inline-block w-3.5 h-3.5 bg-cyan-400 border border-[#0f172a]" />
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-cyan-200">
                  {stats.lunarMission.roverCharged
                    ? 'RTG OK'
                    : `${stats.lunarMission.plutoniumCollected}/4 Pu`}
                </span>
              </div>

              <div
                className="flex items-center gap-1.5 whitespace-nowrap"
                title="Cryogenic Rocket Fuel (Challenge 2: Lunar Rover Run)"
              >
                <span className="inline-block w-3.5 h-4 bg-emerald-400 border border-[#0f172a]" />
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-emerald-200">
                  {stats.lunarMission.rocketFueled
                    ? 'FUELED'
                    : stats.lunarMission.rocketFuelRecovered
                    ? '1/1 Fuel'
                    : '0/1 Fuel'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div
                className="flex items-center gap-1.5 whitespace-nowrap"
                title="Pathfinder Airbags (Mission 1: Cushioning)"
              >
                <span className="inline-block w-3.5 h-3.5 rounded-full bg-[#f3ead3] border border-[#3f3a34]" />
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-amber-200">
                  {stats.pathfinderMission.rocketCushioningRestored
                    ? 'OK'
                    : `${stats.inventory.airbags}/10`}
                </span>
              </div>

              <div
                className="flex items-center gap-1.5 whitespace-nowrap"
                title="Ingenuity Steel Alloys (Mission 2: Outer Plating)"
              >
                <span className="inline-block w-4 h-3 bg-slate-300 border border-amber-400" />
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-sky-200">
                  {stats.blindLandingMission.rocketOuterPlatingRestored
                    ? 'OK'
                    : `${stats.inventory.steelAlloys}/3`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Sol Day Progress Bar */}
        <div className="pixel-panel px-2 py-1 w-48 sm:w-60">
          <div className="w-full h-2.5 bg-[#1c2024] border border-[#121417] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-amber-300 transition-[width] duration-150"
              style={{ width: `${Math.max(4, Math.round(stats.solProgress * 100))}%` }}
            />
          </div>
        </div>

        {/* Contextual Status Strip */}
        {(stats.dustStormActive || stats.inCrashSafeZone || lowO2 || lowPower) && (
          <div className="pixel-panel-dark px-3 py-1.5 text-xs font-medium text-stone-200">
            {stats.dustStormActive && stats.planet === 'mars'
              ? 'Dust storm active · Suit power draining faster'
              : lowO2 || lowPower
              ? `Low suit reserves · Return to ${
                  stats.planet === 'moon' ? 'Ares IV Landing Pad' : 'Crashed Rocket'
                } to recharge`
              : stats.planet === 'moon'
              ? 'Lunar Landing Pad · Suit O2 & Power charging'
              : 'Crash Site Life-Support · Suit O2 & Power charging'}
          </div>
        )}
      </div>

      {/* Left & Right Camera Peek Chevrons */}
      <button
        type="button"
        aria-label="Pan camera left"
        onMouseDown={() => onPeekHold('left')}
        onMouseUp={() => onPeekHold(null)}
        onMouseLeave={() => onPeekHold(null)}
        onTouchStart={() => onPeekHold('left')}
        onTouchEnd={() => onPeekHold(null)}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-14 flex items-center justify-center text-white/55 hover:text-white/95 hover:bg-black/25 rounded cursor-pointer transition-colors"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <button
        type="button"
        aria-label="Pan camera right"
        onMouseDown={() => onPeekHold('right')}
        onMouseUp={() => onPeekHold(null)}
        onMouseLeave={() => onPeekHold(null)}
        onTouchStart={() => onPeekHold('right')}
        onTouchEnd={() => onPeekHold(null)}
        className="fixed right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-14 flex items-center justify-center text-white/55 hover:text-white/95 hover:bg-black/25 rounded cursor-pointer transition-colors"
      >
        <ChevronRight className="w-8 h-8" />
      </button>

      {/* Bottom Interaction Trigger Pill */}
      {contextHint && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)]">
          <button
            type="button"
            onClick={onTriggerAction}
            className="pixel-panel-dark px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-sky-100 flex items-center gap-2 hover:bg-[#3a3f46] cursor-pointer max-w-full"
          >
            <span className="font-pixel text-[11px] bg-sky-500/25 border border-sky-400/60 px-1.5 py-0.5 text-sky-200 shrink-0">
              E
            </span>
            <span className="truncate">{contextHint}</span>
          </button>
        </div>
      )}
    </>
  );
};
