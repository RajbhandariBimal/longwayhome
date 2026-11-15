import { WorldInit, createInitialWorld, createMoonWorld } from './mapData';
import { Direction } from './types';

const SAVE_STORAGE_KEY = 'red_planet_mars_save_v1';

interface SerializedSaveData {
  version: 1;
  player: {
    x: number;
    y: number;
    dir: Direction;
  };
  stats: WorldInit['stats'];
  salvagedIds: string[];
}

export function saveWorldProgress(world: WorldInit): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const salvagedIds = world.structures
      .filter((s) => s.salvaged)
      .map((s) => s.id);

    const payload: SerializedSaveData = {
      version: 1,
      player: {
        x: world.player.x,
        y: world.player.y,
        dir: world.player.dir,
      },
      stats: {
        ...world.stats,
        inventory: { ...world.stats.inventory },
        rocket: { ...world.stats.rocket },
        pathfinderMission: { ...world.stats.pathfinderMission },
        blindLandingMission: { ...world.stats.blindLandingMission },
        lunarMission: { ...world.stats.lunarMission },
      },
      salvagedIds,
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota or storage restriction errors silently
  }
}

export function loadWorldProgress(): { world: WorldInit; hasSavedProgress: boolean } {
  const base = createInitialWorld();
  if (typeof window === 'undefined' || !window.localStorage) {
    return { world: base, hasSavedProgress: false };
  }

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return { world: base, hasSavedProgress: false };
    }
    const parsed = JSON.parse(raw) as Partial<SerializedSaveData>;
    if (parsed.version !== 1 || !parsed.player || !parsed.stats) {
      return { world: base, hasSavedProgress: false };
    }

    const s = parsed.stats;
    const planet = s.planet === 'moon' ? 'moon' : 'mars';
    const world = planet === 'moon' ? createMoonWorld() : base;

    if (typeof parsed.player.x === 'number' && typeof parsed.player.y === 'number') {
      world.player.x = parsed.player.x;
      world.player.y = parsed.player.y;
    }
    if (
      parsed.player.dir === 'up' ||
      parsed.player.dir === 'down' ||
      parsed.player.dir === 'left' ||
      parsed.player.dir === 'right'
    ) {
      world.player.dir = parsed.player.dir;
    }

    world.stats = {
      planet,
      sol: typeof s.sol === 'number' ? s.sol : world.stats.sol,
      solProgress: typeof s.solProgress === 'number' ? s.solProgress : world.stats.solProgress,
      suitOxygen: typeof s.suitOxygen === 'number' ? s.suitOxygen : world.stats.suitOxygen,
      suitPower: typeof s.suitPower === 'number' ? s.suitPower : world.stats.suitPower,
      inCrashSafeZone: Boolean(s.inCrashSafeZone),
      dustStormActive: planet === 'moon' ? false : Boolean(s.dustStormActive),
      dustStormTimer:
        typeof s.dustStormTimer === 'number' ? s.dustStormTimer : world.stats.dustStormTimer,
      inventory: {
        airbags: s.inventory?.airbags ?? 0,
        steelAlloys: s.inventory?.steelAlloys ?? 0,
        plutonium: s.inventory?.plutonium ?? 0,
        rocketFuel: s.inventory?.rocketFuel ?? 0,
      },
      rocket: {
        cushioning: s.rocket?.cushioning ?? 0,
        outerPlating: s.rocket?.outerPlating ?? 0,
      },
      pathfinderMission: {
        accepted: Boolean(s.pathfinderMission?.accepted),
        completed: Boolean(s.pathfinderMission?.completed),
        airbagsRecovered: s.pathfinderMission?.airbagsRecovered ?? 0,
        rocketCushioningRestored: Boolean(s.pathfinderMission?.rocketCushioningRestored),
      },
      blindLandingMission: {
        completed: Boolean(s.blindLandingMission?.completed),
        steelAlloysRecovered: s.blindLandingMission?.steelAlloysRecovered ?? 0,
        rocketOuterPlatingRestored: Boolean(s.blindLandingMission?.rocketOuterPlatingRestored),
      },
      lunarMission: {
        plutoniumCollected: s.lunarMission?.plutoniumCollected ?? 0,
        rtgPowered: Boolean(s.lunarMission?.rtgPowered),
        roverCharged: Boolean(s.lunarMission?.roverCharged),
        rocketFuelRecovered: Boolean(s.lunarMission?.rocketFuelRecovered),
        rocketFueled: Boolean(s.lunarMission?.rocketFueled),
      },
      earthLocated: Boolean(s.earthLocated),
    };

    const salvagedSet = new Set(Array.isArray(parsed.salvagedIds) ? parsed.salvagedIds : []);
    for (const struct of world.structures) {
      if (salvagedSet.has(struct.id)) {
        struct.salvaged = true;
      }
    }

    return { world, hasSavedProgress: true };
  } catch {
    return { world: base, hasSavedProgress: false };
  }
}

export function clearSavedWorld(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
