import {
  PlanetId,
  PlayerState,
  StructureEntity,
  SurvivalStats,
  TileType,
} from './types';

export const MAP_W = 56;
export const MAP_H = 38;
export const TILE_SIZE = 16;

export const CRASH_SITE_POS = { tx: 25, ty: 17, w: 6, h: 4 };
export const LUNAR_LANDING_PAD_POS = { tx: 12, ty: 17, w: 4, h: 4 };
export const CRASH_SAFE_RADIUS_PX = 76;
export const APOLLO_PLUTONIUM_TOTAL = 4;

export interface WorldInit {
  tiles: TileType[][];
  structures: StructureEntity[];
  player: PlayerState;
  stats: SurvivalStats;
}

let nextIdCounter = 1;
export function genId(prefix: string): string {
  nextIdCounter += 1;
  return `${prefix}_${nextIdCounter}`;
}

export function createInitialWorld(): WorldInit {
  nextIdCounter = 1;

  const tiles: TileType[][] = Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => 'regolith' as TileType)
  );

  const setTile = (x: number, y: number, type: TileType) => {
    if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
      tiles[y][x] = type;
    }
  };

  // Distant Martian mountain formations framing the northern horizon & corners
  for (let x = 0; x < MAP_W; x++) {
    const ridgeHeight = 2 + Math.floor((Math.sin(x * 0.35) + Math.cos(x * 0.17) + 2) * 0.65);
    for (let y = 0; y < ridgeHeight; y++) {
      setTile(x, y, 'mountain_wall');
    }
    setTile(x, ridgeHeight, 'ridge_rock');
  }

  // Subtle rocky ridgelines around outer borders
  for (let y = 0; y < MAP_H; y++) {
    if (y > 4 && (y % 7 < 3)) {
      setTile(0, y, 'ridge_rock');
      setTile(MAP_W - 1, y, 'ridge_rock');
    }
  }

  // Helper to carve realistic Martian craters
  const paintCrater = (cx: number, cy: number, radius: number) => {
    for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
      for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius - 1.1) {
          setTile(x, y, 'crater_floor');
        } else if (d <= radius + 0.35) {
          setTile(x, y, 'crater_rim');
        }
      }
    }
  };

  // Distinct Martian craters (including Minigame 1 basin and South Lander crater)
  paintCrater(10, 11, 5); // Western Crater Basin (Minigame 1 — Rover Recovery)
  paintCrater(28, 31, 4); // South Impact Crater (Damaged Lander site)
  paintCrater(42, 26, 4); // Southeast Dust Crater
  paintCrater(18, 28, 3); // Southwest Minor Crater
  paintCrater(37, 11, 3); // Northeast Minor Crater

  // Eastern Highlands rocky plateau around Minigame 2 (Satellite Systems)
  for (let y = 7; y <= 14; y++) {
    for (let x = 41; x <= 50; x++) {
      const d = Math.hypot(x - 45.5, y - 10.5);
      if (d <= 4.6 && d >= 3.2) {
        setTile(x, y, 'ridge_rock');
      }
    }
  }

  // Crash skid/scorch trench leading into the central Crashed Rocket
  for (let i = 0; i < 8; i++) {
    const sx = 19 + i;
    const sy = 15 + Math.floor(i * 0.55);
    setTile(sx, sy, 'scorch');
    setTile(sx + 1, sy, 'scorch');
    setTile(sx, sy + 1, 'scorch');
  }
  for (let y = 17; y <= 21; y++) {
    for (let x = 24; x <= 31; x++) {
      setTile(x, y, 'scorch');
    }
  }

  const structures: StructureEntity[] = [];
  const addStruct = (s: Omit<StructureEntity, 'id' | 'animOffset' | 'lastInteractAt'>) => {
    structures.push({
      ...s,
      id: genId(s.type),
      animOffset: Math.random() * 10,
      lastInteractAt: 0,
    });
  };

  // 1. CENTRAL LANDMARK: Crashed Earth-to-Mars Rocket
  addStruct({
    type: 'crashed_rocket',
    category: 'crash_site',
    label: 'Crashed Spacecraft (Ares IV)',
    tx: CRASH_SITE_POS.tx,
    ty: CRASH_SITE_POS.ty,
    w: CRASH_SITE_POS.w,
    h: CRASH_SITE_POS.h,
    solid: true,
  });

  // Scenic crash-site debris & Martian relics (non-mission environment props)
  addStruct({
    type: 'metal_debris',
    category: 'terrain',
    label: 'Rocket Hull Fragment',
    tx: 22,
    ty: 19,
    w: 1,
    h: 1,
    solid: true,
  });
  addStruct({
    type: 'circuit_wreck',
    category: 'terrain',
    label: 'Ejected Avionics Pod',
    tx: 32,
    ty: 17,
    w: 1,
    h: 1,
    solid: true,
  });

  // 2. MISSION 1: Mars Pathfinder Rover (Western Crater Basin — Airbag Recovery)
  addStruct({
    type: 'minigame_rover',
    category: 'minigame_location',
    label: 'Abandoned Mars Pathfinder Rover',
    tx: 9,
    ty: 10,
    w: 3,
    h: 2,
    solid: true,
    salvaged: false,
    minigameId: 'rover_recovery',
  });

  // 3. MISSION 2: Ingenuity Mars Helicopter Relay (Eastern Highlands — Blind Landing)
  addStruct({
    type: 'minigame_satellite',
    category: 'minigame_location',
    label: 'Ingenuity Mars Helicopter Relay',
    tx: 44,
    ty: 9,
    w: 3,
    h: 3,
    solid: true,
    salvaged: false,
    minigameId: 'systems_repair',
  });

  // 4. SCENIC MARTIAN RELICS (environmental props)
  addStruct({
    type: 'comm_antenna',
    category: 'terrain',
    label: 'Fallen Deep-Space Antenna',
    tx: 26,
    ty: 6,
    w: 2,
    h: 2,
    solid: true,
  });

  addStruct({
    type: 'battery_unit',
    category: 'terrain',
    label: 'RTG Battery Storage Unit',
    tx: 6,
    ty: 21,
    w: 2,
    h: 1,
    solid: true,
  });

  addStruct({
    type: 'abandoned_rover',
    category: 'terrain',
    label: 'Decommissioned Pathfinder Rover',
    tx: 11,
    ty: 29,
    w: 2,
    h: 2,
    solid: true,
  });

  addStruct({
    type: 'damaged_lander',
    category: 'terrain',
    label: 'Damaged Viking-Class Lander',
    tx: 27,
    ty: 30,
    w: 3,
    h: 2,
    solid: true,
  });

  addStruct({
    type: 'abandoned_solar',
    category: 'terrain',
    label: 'Buried Solar Panel Array',
    tx: 42,
    ty: 26,
    w: 2,
    h: 2,
    solid: true,
  });

  addStruct({
    type: 'circuit_wreck',
    category: 'terrain',
    label: 'Telemetry Relay Crate',
    tx: 45,
    ty: 18,
    w: 1,
    h: 1,
    solid: true,
  });

  addStruct({
    type: 'metal_debris',
    category: 'terrain',
    label: 'Jettisoned Heat Shield',
    tx: 17,
    ty: 11,
    w: 1,
    h: 1,
    solid: true,
  });

  // 5. NATURAL MARTIAN BOULDERS (sparse, framed for clean navigation)
  const boulderCoords: [number, number][] = [
    [4, 6],
    [16, 6],
    [21, 9],
    [34, 7],
    [39, 6],
    [51, 8],
    [50, 15],
    [4, 15],
    [14, 18],
    [20, 23],
    [36, 22],
    [49, 24],
    [7, 32],
    [21, 34],
    [35, 33],
    [48, 32],
  ];
  for (const [bx, by] of boulderCoords) {
    addStruct({
      type: 'boulder',
      category: 'terrain',
      label: 'Martian Basalt Boulder',
      tx: bx,
      ty: by,
      w: 1,
      h: 1,
      solid: true,
    });
  }

  // Player starts right beside the Crashed Rocket airlock!
  const player: PlayerState = {
    x: 28 * TILE_SIZE + TILE_SIZE / 2,
    y: 22 * TILE_SIZE,
    vx: 0,
    vy: 0,
    dir: 'up',
    walkFrame: 0,
    walkTimer: 0,
    isMoving: false,
    actionTimer: 0,
    actionType: null,
    targetPoint: null,
  };

  const stats: SurvivalStats = {
    planet: 'mars',
    sol: 1,
    solProgress: 0.12,
    suitOxygen: 100,
    suitPower: 100,
    inCrashSafeZone: true,
    dustStormActive: false,
    dustStormTimer: 42,
    inventory: {
      airbags: 0,
      steelAlloys: 0,
      plutonium: 0,
      rocketFuel: 0,
    },
    rocket: {
      cushioning: 0,
      outerPlating: 0,
    },
    pathfinderMission: {
      accepted: false,
      completed: false,
      airbagsRecovered: 0,
      rocketCushioningRestored: false,
    },
    blindLandingMission: {
      completed: false,
      steelAlloysRecovered: 0,
      rocketOuterPlatingRestored: false,
    },
    lunarMission: {
      plutoniumCollected: 0,
      rtgPowered: false,
      roverCharged: false,
      rocketFuelRecovered: false,
      rocketFueled: false,
    },
    earthLocated: false,
  };

  return { tiles, structures, player, stats };
}

/** Generate Chapter 2 Moon Terrain: Ares IV Lunar Pad, RTG + Lunar Rover, and 4 Apollo Plutonium Wrecks */
export function createMoonWorld(prevStats?: SurvivalStats): WorldInit {
  nextIdCounter = 100;

  const tiles: TileType[][] = Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => 'lunar_regolith' as TileType)
  );

  const setTile = (x: number, y: number, type: TileType) => {
    if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
      tiles[y][x] = type;
    }
  };

  // Black starlit lunar sky & distant dark-grey mountain silhouette along northern horizon
  for (let x = 0; x < MAP_W; x++) {
    const hillY = 3 + Math.floor((Math.sin(x * 0.28) + Math.cos(x * 0.14) + 2) * 0.65);
    for (let y = 0; y < hillY; y++) {
      setTile(x, y, 'lunar_horizon');
    }
    setTile(x, hillY, 'lunar_ridge');
  }

  // Subtle grey ridge formations flanking far east/west borders
  for (let y = 5; y < MAP_H; y++) {
    if (y % 8 < 3) {
      setTile(0, y, 'lunar_ridge');
      setTile(MAP_W - 1, y, 'lunar_ridge');
    }
  }

  // Realistic grey Moon impact craters
  const paintLunarCrater = (cx: number, cy: number, radius: number) => {
    for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
      for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
        if (y <= 5) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius - 1.1) {
          setTile(x, y, 'lunar_crater_floor');
        } else if (d <= radius + 0.35) {
          setTile(x, y, 'lunar_crater_rim');
        }
      }
    }
  };

  paintLunarCrater(8, 10, 4);   // Northwest Apollo 11 Crater
  paintLunarCrater(24, 9, 3);   // North-Central Crater
  paintLunarCrater(46, 10, 4);  // Northeast Apollo 15 Crater
  paintLunarCrater(10, 29, 4);  // Southwest Apollo 17 Crater
  paintLunarCrater(29, 30, 4);  // South-Central Crater
  paintLunarCrater(46, 28, 4);  // Southeast Apollo 16 Crater

  // Dark landing pad tarmac around the Ares IV spacecraft (no base nearby)
  for (let y = 16; y <= 22; y++) {
    for (let x = 10; x <= 17; x++) {
      setTile(x, y, 'lunar_pad_scorch');
    }
  }

  // Small concrete charging pad under the RTG & Lunar Rover station
  for (let y = 15; y <= 21; y++) {
    for (let x = 22; x <= 27; x++) {
      setTile(x, y, 'lunar_pad_scorch');
    }
  }

  const structures: StructureEntity[] = [];
  const addStruct = (s: Omit<StructureEntity, 'id' | 'animOffset' | 'lastInteractAt'>) => {
    structures.push({
      ...s,
      id: genId(s.type),
      animOffset: Math.random() * 10,
      lastInteractAt: 0,
    });
  };

  // 1. Upright Ares IV Spacecraft parked on the Lunar Landing Pad
  addStruct({
    type: 'ares_lunar_lander',
    category: 'crash_site',
    label: 'Ares IV Spacecraft (Lunar Pad)',
    tx: LUNAR_LANDING_PAD_POS.tx,
    ty: LUNAR_LANDING_PAD_POS.ty,
    w: LUNAR_LANDING_PAD_POS.w,
    h: LUNAR_LANDING_PAD_POS.h,
    solid: true,
  });

  // 2. Radioisotope Thermoelectric Generator (RTG) — converts Apollo Plutonium into power
  addStruct({
    type: 'lunar_rtg',
    category: 'lunar_facility',
    label: 'Radioisotope Thermoelectric Generator (RTG)',
    tx: 23,
    ty: 15,
    w: 3,
    h: 2,
    solid: true,
    salvaged: false,
  });

  // 3. Lunar Rover — charged by the RTG, driven to the remote Lunar Fuel Base
  addStruct({
    type: 'lunar_rover',
    category: 'minigame_location',
    label: 'Lunar Exploration Rover',
    tx: 23,
    ty: 19,
    w: 3,
    h: 2,
    solid: true,
    salvaged: false,
    minigameId: 'lunar_rover_run',
  });

  // 4. Scattered Plutonium-238 Cores from Apollo Mission Spaceships (4 wreck sites)
  addStruct({
    type: 'apollo_plutonium',
    category: 'exploration_site',
    label: 'Apollo 11 Descent Stage · Plutonium-238 Core',
    tx: 7,
    ty: 9,
    w: 2,
    h: 2,
    solid: true,
    salvaged: false,
  });

  addStruct({
    type: 'apollo_plutonium',
    category: 'exploration_site',
    label: 'Apollo 15 Lunar Module Wreck · Plutonium-238 Core',
    tx: 45,
    ty: 9,
    w: 2,
    h: 2,
    solid: true,
    salvaged: false,
  });

  addStruct({
    type: 'apollo_plutonium',
    category: 'exploration_site',
    label: 'Apollo 16 Cargo Stage · Plutonium-238 Core',
    tx: 45,
    ty: 27,
    w: 2,
    h: 2,
    solid: true,
    salvaged: false,
  });

  addStruct({
    type: 'apollo_plutonium',
    category: 'exploration_site',
    label: 'Apollo 17 Lander Stage · Plutonium-238 Core',
    tx: 9,
    ty: 28,
    w: 2,
    h: 2,
    solid: true,
    salvaged: false,
  });

  // 5. Natural Grey Lunar Basalt Boulders (clean obstacle dressing)
  const lunarBoulders: [number, number][] = [
    [5, 14],
    [15, 11],
    [31, 11],
    [38, 14],
    [50, 16],
    [51, 22],
    [6, 23],
    [16, 26],
    [35, 25],
    [40, 31],
    [20, 34],
  ];
  for (const [bx, by] of lunarBoulders) {
    addStruct({
      type: 'lunar_boulder',
      category: 'terrain',
      label: 'Lunar Basalt Boulder',
      tx: bx,
      ty: by,
      w: 1,
      h: 1,
      solid: true,
    });
  }

  // Astronaut spawns beside the landed Ares IV rocket facing right toward the RTG & Rover
  const player: PlayerState = {
    x: 17 * TILE_SIZE + TILE_SIZE / 2,
    y: 20 * TILE_SIZE,
    vx: 0,
    vy: 0,
    dir: 'right',
    walkFrame: 0,
    walkTimer: 0,
    isMoving: false,
    actionTimer: 0,
    actionType: null,
    targetPoint: null,
  };

  const baseStats = prevStats ?? createInitialWorld().stats;
  const stats: SurvivalStats = {
    ...baseStats,
    planet: 'moon',
    suitOxygen: 100,
    suitPower: 100,
    inCrashSafeZone: true,
    dustStormActive: false,
    dustStormTimer: 9999,
    inventory: {
      ...baseStats.inventory,
      plutonium: 0,
      rocketFuel: 0,
    },
    rocket: { ...baseStats.rocket },
    pathfinderMission: { ...baseStats.pathfinderMission },
    blindLandingMission: { ...baseStats.blindLandingMission },
    lunarMission: {
      plutoniumCollected: 0,
      rtgPowered: false,
      roverCharged: false,
      rocketFuelRecovered: false,
      rocketFueled: false,
    },
  };

  return { tiles, structures, player, stats };
}

/** Check whether a rectangular hitbox overlaps any solid structure, mountain wall, or map border */
export function isRectBlocked(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  structures: StructureEntity[],
  tiles: TileType[][]
): boolean {
  const minX = cx - halfW;
  const maxX = cx + halfW;
  const minY = cy - halfH;
  const maxY = cy + halfH;

  if (minX < 8 || minY < 8 || maxX > MAP_W * TILE_SIZE - 8 || maxY > MAP_H * TILE_SIZE - 8) {
    return true;
  }

  // Check mountain wall / lunar sky horizon tiles
  const tx0 = Math.max(0, Math.floor(minX / TILE_SIZE));
  const tx1 = Math.min(MAP_W - 1, Math.floor(maxX / TILE_SIZE));
  const ty0 = Math.max(0, Math.floor(minY / TILE_SIZE));
  const ty1 = Math.min(MAP_H - 1, Math.floor(maxY / TILE_SIZE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tiles[ty][tx] === 'mountain_wall' || tiles[ty][tx] === 'lunar_horizon') {
        return true;
      }
    }
  }

  for (const s of structures) {
    if (!s.solid) continue;
    const inset =
      s.type === 'crashed_rocket' || s.type === 'ares_lunar_lander'
        ? 4
        : 2;
    const sx0 = s.tx * TILE_SIZE + inset;
    const sy0 = s.ty * TILE_SIZE + inset;
    const sx1 = (s.tx + s.w) * TILE_SIZE - inset;
    const sy1 = (s.ty + s.h) * TILE_SIZE - inset;

    if (maxX > sx0 && minX < sx1 && maxY > sy0 && minY < sy1) {
      return true;
    }
  }
  return false;
}

/** Find closest interactive landmark */
export function findNearestInteractable(
  player: PlayerState,
  structures: StructureEntity[],
  maxDistPx = 30
): StructureEntity | null {
  let best: StructureEntity | null = null;
  let bestDist = maxDistPx;

  const dirVec =
    player.dir === 'up'
      ? { x: 0, y: -5 }
      : player.dir === 'down'
      ? { x: 0, y: 5 }
      : player.dir === 'left'
      ? { x: -5, y: 0 }
      : { x: 5, y: 0 };

  const px = player.x + dirVec.x;
  const py = player.y + dirVec.y;

  for (const s of structures) {
    if (s.category === 'terrain') continue;
    if (s.category === 'exploration_site' && s.salvaged) continue;

    const cx = (s.tx + s.w / 2) * TILE_SIZE;
    const cy = (s.ty + s.h / 2) * TILE_SIZE;
    const dx = Math.max(0, Math.abs(px - cx) - (s.w * TILE_SIZE) / 2);
    const dy = Math.max(0, Math.abs(py - cy) - (s.h * TILE_SIZE) / 2);
    const dist = Math.hypot(dx, dy);

    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

export function isPlayerInCrashSafeZone(
  player: PlayerState,
  planet: PlanetId = 'mars'
): boolean {
  const site = planet === 'moon' ? LUNAR_LANDING_PAD_POS : CRASH_SITE_POS;
  const rcx = (site.tx + site.w / 2) * TILE_SIZE;
  const rcy = (site.ty + site.h / 2) * TILE_SIZE;
  return Math.hypot(player.x - rcx, player.y - rcy) <= CRASH_SAFE_RADIUS_PX;
}
