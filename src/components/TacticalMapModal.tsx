import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Compass, Lock, MapPin, Navigation, X } from 'lucide-react';
import {
  CRASH_SAFE_RADIUS_PX,
  CRASH_SITE_POS,
  LUNAR_LANDING_PAD_POS,
  MAP_H,
  MAP_W,
  TILE_SIZE,
} from '../game/mapData';
import {
  NavigationObjective,
  ObjectivePinId,
  buildNavigationObjectives,
  resolveActiveObjective,
} from '../game/navigationGuide';
import { soundFX } from '../game/audio';
import { PlayerState, StructureEntity, SurvivalStats, TileType } from '../game/types';

interface TacticalMapModalProps {
  tiles: TileType[][];
  structures: StructureEntity[];
  player: PlayerState;
  stats: SurvivalStats;
  trackedObjectiveId: ObjectivePinId | null;
  onTrackObjective: (id: ObjectivePinId | null) => void;
  onWalkToObjective: (obj: NavigationObjective) => void;
  onClose: () => void;
}

const SCALE = 10; // 56*10 = 560 x 38*10 = 380 native crisp pixels

function getPinDrawPosition(obj: NavigationObjective): { ox: number; oy: number } {
  const ox =
    obj.id === 'crashed_rocket'
      ? (obj.targetX / TILE_SIZE) * SCALE - 12
      : obj.id === 'kepler_telescope'
      ? (obj.targetX / TILE_SIZE) * SCALE + 12
      : (obj.targetX / TILE_SIZE) * SCALE;
  const oy = (obj.targetY / TILE_SIZE) * SCALE;
  return { ox, oy };
}

function getTileColor(t: TileType): string {
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
      return '#994426';
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

export const TacticalMapModal: React.FC<TacticalMapModalProps> = ({
  tiles,
  structures,
  player,
  stats,
  trackedObjectiveId,
  onTrackObjective,
  onWalkToObjective,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectives = useMemo(
    () => buildNavigationObjectives(stats, player, structures),
    [stats, player, structures]
  );
  const activeObj = useMemo(
    () => resolveActiveObjective(objectives, trackedObjectiveId),
    [objectives, trackedObjectiveId]
  );

  const [selectedId, setSelectedId] = useState<ObjectivePinId>(activeObj.id);
  const selectedObj = useMemo(
    () => objectives.find((o) => o.id === selectedId) ?? activeObj,
    [objectives, selectedId, activeObj]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyG') {
        e.preventDefault();
        e.stopPropagation();
        soundFX.playUiClose();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const time = now / 1000;
          ctx.imageSmoothingEnabled = false;

          // 1. Render Terrain Grid (Mars or Moon)
          for (let ty = 0; ty < MAP_H; ty++) {
            for (let tx = 0; tx < MAP_W; tx++) {
              ctx.fillStyle = getTileColor(tiles[ty][tx]);
              ctx.fillRect(tx * SCALE, ty * SCALE, SCALE, SCALE);
            }
          }

          // Subtle grid lines
          ctx.strokeStyle =
            stats.planet === 'moon' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.14)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= MAP_W; x += 4) {
            ctx.beginPath();
            ctx.moveTo(x * SCALE, 0);
            ctx.lineTo(x * SCALE, MAP_H * SCALE);
            ctx.stroke();
          }
          for (let y = 0; y <= MAP_H; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y * SCALE);
            ctx.lineTo(MAP_W * SCALE, y * SCALE);
            ctx.stroke();
          }

          // 2. Spacecraft / Lunar Pad Safe Ring
          const site = stats.planet === 'moon' ? LUNAR_LANDING_PAD_POS : CRASH_SITE_POS;
          const rcx = (site.tx + site.w / 2) * SCALE;
          const rcy = (site.ty + site.h / 2) * SCALE;
          const safeR = (CRASH_SAFE_RADIUS_PX / TILE_SIZE) * SCALE;
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(rcx, rcy, safeR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // 3. Secondary Relics / Facility Footprint Dots
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
              const sx = (s.tx + s.w / 2) * SCALE;
              const sy = (s.ty + s.h / 2) * SCALE;
              ctx.fillStyle = 'rgba(251, 146, 60, 0.72)';
              ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 5, 5);
            } else if (s.category === 'exploration_site') {
              const sx = (s.tx + s.w / 2) * SCALE;
              const sy = (s.ty + s.h / 2) * SCALE;
              ctx.fillStyle = s.salvaged
                ? 'rgba(148, 163, 184, 0.45)'
                : s.type === 'apollo_plutonium'
                ? '#22d3ee'
                : '#fb923c';
              ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
            }
          }

          // 4. Animated Dashed Guidance Route Line from Astronaut to Selected Objective
          const px = (player.x / TILE_SIZE) * SCALE;
          const py = (player.y / TILE_SIZE) * SCALE;
          const { ox: tx, oy: ty } = getPinDrawPosition(selectedObj);

          ctx.save();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -time * 24;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();

          // 5. Numbered Objective Pins
          for (const obj of objectives) {
            const { ox, oy } = getPinDrawPosition(obj);
            const isSelected = obj.id === selectedObj.id;
            const isTracked = obj.id === activeObj.id;

            if (isSelected || isTracked) {
              const pulseR = 13 + Math.sin(time * 5) * 2.5;
              ctx.strokeStyle = isSelected ? '#fde047' : '#38bdf8';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(ox, oy, pulseR, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.fillStyle = obj.completed
              ? '#15803d'
              : obj.id === 'crashed_rocket' || obj.id === 'lunar_lander'
              ? '#0284c7'
              : isSelected
              ? '#d97706'
              : '#1e293b';
            ctx.strokeStyle = obj.completed
              ? '#4ade80'
              : isSelected
              ? '#fde047'
              : '#fbbf24';
            ctx.lineWidth = 2;
            ctx.fillRect(Math.round(ox - 9), Math.round(oy - 9), 18, 18);
            ctx.strokeRect(Math.round(ox - 9), Math.round(oy - 9), 18, 18);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Silkscreen", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.pin, ox, oy + 0.5);
          }

          // 6. Astronaut Live Position Marker
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(Math.round(px - 6), Math.round(py - 6), 12, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(px - 4), Math.round(py - 4), 8, 8);
          ctx.fillStyle = stats.planet === 'moon' ? '#38bdf8' : '#ea580c';
          ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activeObj.id, objectives, player.x, player.y, selectedObj, stats.planet, structures, tiles]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * (MAP_W * SCALE);
    const cy = ((e.clientY - rect.top) / rect.height) * (MAP_H * SCALE);

    let closest: NavigationObjective | null = null;
    let bestD = 26;
    for (const obj of objectives) {
      const { ox, oy } = getPinDrawPosition(obj);
      const d = Math.hypot(cx - ox, cy - oy);
      if (d < bestD) {
        bestD = d;
        closest = obj;
      }
    }
    if (closest) {
      soundFX.playUiClick();
      setSelectedId(closest.id);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/78 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pixel-panel-dark w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-stone-100"
      >
        {/* Header */}
        <div className="bg-[#343940] border-b-2 border-[#15171a] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="font-pixel text-sm sm:text-base text-[#e8cf79]">
                {stats.planet === 'moon'
                  ? 'LUNA TACTICAL MAP & FACILITY GUIDE'
                  : 'MARS TACTICAL MAP & MISSION GUIDE'}
              </h2>
              <p className="text-[11px] text-stone-300">
                Click any numbered pin or objective on the right to see instructions and set an auto-walk route
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playUiClose();
              onClose();
            }}
            aria-label="Close tactical map"
            className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main 2-Column Body */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left: Full Sector Canvas */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
            <div
              className={`border-2 border-[#3e434a] overflow-hidden ${
                stats.planet === 'moon' ? 'bg-[#070b14]' : 'bg-[#1b0d0a]'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={MAP_W * SCALE}
                height={MAP_H * SCALE}
                onClick={handleCanvasClick}
                className="w-full h-auto block pixelated cursor-pointer"
              />
            </div>

            {/* Clean Legend Row */}
            <div className="bg-[#23262a] border border-[#3e434a] px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono-tabular text-stone-300">
              <span>White Square: Astronaut</span>
              {stats.planet === 'moon' ? (
                <>
                  <span className="text-amber-300">1: Pu-238 · 2: RTG · 3: Rover</span>
                  <span className="text-sky-300">L: Ares IV Pad</span>
                  <span className="text-cyan-300">Cyan Dots: Apollo Plutonium</span>
                </>
              ) : (
                <>
                  <span className="text-amber-300">1–2: Missions · 3: Kepler</span>
                  <span className="text-sky-300">S: Ares IV Spacecraft</span>
                  <span className="text-orange-300">Orange Dots: Martian Relics</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Sequential Mission List + Selected Instructions */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            {/* Objective List */}
            <div className="bg-[#22262b] border border-[#3e434a] p-2.5 space-y-1 max-h-60 overflow-y-auto">
              {objectives.map((obj) => {
                const isSelected = obj.id === selectedObj.id;
                const isTracked = obj.id === activeObj.id;
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      setSelectedId(obj.id);
                    }}
                    className={`w-full px-2.5 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#363d47] border border-amber-400/70 text-white'
                        : 'bg-[#1a1d21] hover:bg-[#2a2f36] border border-transparent text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 font-pixel text-[10px] flex items-center justify-center shrink-0 border ${
                          obj.completed
                            ? 'bg-emerald-800/70 border-emerald-400 text-emerald-200'
                            : isTracked
                            ? 'bg-amber-600 border-amber-300 text-white'
                            : 'bg-[#2c3138] border-[#4d5560] text-stone-200'
                        }`}
                      >
                        {obj.pin}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold truncate">{obj.title}</div>
                        <div className="text-[10px] text-stone-400 truncate">
                          {obj.sector}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 font-mono-tabular text-[11px]">
                      <span className="text-stone-400">
                        {obj.bearing} {obj.distanceMeters}m
                      </span>
                      {obj.completed && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Objective Detailed Instructions */}
            <div className="bg-[#23262a] border-2 border-[#464e58] p-3.5 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-pixel text-xs text-[#e8cf79]">
                      [{selectedObj.pin}] {selectedObj.title}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-sky-300 mt-0.5">
                      Direction: {selectedObj.bearing} · Distance: {selectedObj.distanceMeters}m · {selectedObj.sector}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-pixel px-2 py-0.5 border shrink-0 ${
                      selectedObj.completed
                        ? 'bg-emerald-900/50 border-emerald-400 text-emerald-300'
                        : 'bg-amber-900/40 border-amber-400 text-amber-300'
                    }`}
                  >
                    {selectedObj.completed ? 'DONE' : 'ACTIVE'}
                  </span>
                </div>

                <p className="text-xs text-stone-200 leading-relaxed">
                  {selectedObj.instructions}
                </p>

                {selectedObj.lockedReason && (
                  <div className="bg-[#2c1f1a] border border-amber-500/50 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{selectedObj.lockedReason}</span>
                  </div>
                )}

                <div className="bg-[#1b1e22] border border-[#333840] px-2.5 py-2 text-[11px] space-y-1">
                  <div className="text-sky-300 font-semibold">
                    Controls: {selectedObj.controlsCue}
                  </div>
                  <div className="text-emerald-300">Reward: {selectedObj.reward}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    onTrackObjective(
                      trackedObjectiveId === selectedObj.id ? null : selectedObj.id
                    );
                  }}
                  className="pixel-btn flex-1 bg-[#3a4048] hover:bg-[#49515c] text-stone-100 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {trackedObjectiveId === selectedObj.id
                      ? 'Pinned on Minimap'
                      : 'Pin Route'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    onWalkToObjective(selectedObj);
                  }}
                  className="pixel-btn flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Guide Astronaut Here</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
