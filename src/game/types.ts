export type PlanetId = 'mars' | 'moon';

export type GameState =
  | 'INTRO_CUTSCENE'
  | 'CHAPTER2_CUTSCENE'
  | 'EARTH_RETURN_CUTSCENE'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type TileType =
  | 'regolith'
  | 'crater_floor'
  | 'crater_rim'
  | 'scorch'
  | 'ridge_rock'
  | 'mountain_wall'
  | 'lunar_regolith'
  | 'lunar_crater_floor'
  | 'lunar_crater_rim'
  | 'lunar_pad_scorch'
  | 'lunar_ridge'
  | 'lunar_horizon';

export type LocationCategory =
  | 'crash_site'
  | 'exploration_site'
  | 'minigame_location'
  | 'lunar_facility'
  | 'terrain';

export type StructureType =
  | 'crashed_rocket'
  | 'minigame_rover'
  | 'minigame_satellite'
  | 'abandoned_rover'
  | 'damaged_lander'
  | 'abandoned_solar'
  | 'comm_antenna'
  | 'battery_unit'
  | 'circuit_wreck'
  | 'metal_debris'
  | 'boulder'
  | 'ares_lunar_lander'
  | 'apollo_plutonium'
  | 'lunar_rtg'
  | 'lunar_rover'
  | 'lunar_boulder';

export interface SalvageYield {
  metalParts: number;
  circuits: number;
  powerCells: number;
  suitPowerRestore?: number;
  suitOxygenRestore?: number;
}

export interface StructureEntity {
  id: string;
  type: StructureType;
  category: LocationCategory;
  label: string;
  /** Top-left tile coordinates */
  tx: number;
  ty: number;
  /** Width and height in tiles */
  w: number;
  h: number;
  solid: boolean;
  /** True once salvaged/inspected (for exploration equipment / plutonium caches) */
  salvaged?: boolean;
  yields?: SalvageYield;
  /** For minigame locations */
  minigameId?: 'rover_recovery' | 'systems_repair' | 'lunar_rover_run';
  animOffset: number;
  lastInteractAt: number;
}

export interface PlayerState {
  /** World pixel position (native 16px-per-tile coordinates) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  walkFrame: number;
  walkTimer: number;
  isMoving: boolean;
  actionTimer: number;
  actionType: 'salvage' | 'repair' | 'scan' | null;
  targetPoint: { x: number; y: number } | null;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'smoke' | 'dust' | 'spark' | 'text';
  text?: string;
}

export interface Inventory {
  airbags: number;
  steelAlloys: number;
  plutonium: number;
  rocketFuel: number;
}

export interface RocketSystems {
  cushioning: number; // 0..100 (Mission 1: Pathfinder Airbags)
  outerPlating: number; // 0..100 (Mission 2: Ingenuity Steel Alloys)
}

export interface PathfinderMissionState {
  accepted: boolean;
  completed: boolean;
  airbagsRecovered: number;
  rocketCushioningRestored: boolean;
}

export interface BlindLandingMissionState {
  completed: boolean;
  steelAlloysRecovered: number;
  rocketOuterPlatingRestored: boolean;
}

export interface LunarMissionState {
  plutoniumCollected: number; // 0..4
  rtgPowered: boolean;
  roverCharged: boolean;
  rocketFuelRecovered: boolean;
  rocketFueled: boolean;
}

export interface SurvivalStats {
  planet: PlanetId;
  sol: number;
  solProgress: number; // 0..1
  suitOxygen: number; // 0..100
  suitPower: number; // 0..100
  inCrashSafeZone: boolean;
  dustStormActive: boolean;
  dustStormTimer: number;
  inventory: Inventory;
  rocket: RocketSystems;
  pathfinderMission: PathfinderMissionState;
  blindLandingMission: BlindLandingMissionState;
  lunarMission: LunarMissionState;
  earthLocated: boolean;
}
