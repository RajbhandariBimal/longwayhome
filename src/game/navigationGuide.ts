import { APOLLO_PLUTONIUM_TOTAL, TILE_SIZE } from './mapData';
import { PlayerState, StructureEntity, SurvivalStats } from './types';

export type ObjectivePinId =
  | 'rover_recovery'
  | 'systems_repair'
  | 'crashed_rocket'
  | 'kepler_telescope'
  | 'apollo_plutonium'
  | 'lunar_rtg'
  | 'lunar_rover'
  | 'lunar_lander';

export interface NavigationObjective {
  id: ObjectivePinId;
  pin: string;
  order: number;
  title: string;
  sector: string;
  targetX: number;
  targetY: number;
  walkX: number;
  walkY: number;
  completed: boolean;
  lockedReason?: string;
  instructions: string;
  controlsCue: string;
  reward: string;
  bearing: string;
  distanceMeters: number;
}

export function getCompassBearing(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx); // radians, 0 = East, -PI/2 = North
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 337.5 || deg < 22.5) return 'E';
  if (deg < 67.5) return 'SE';
  if (deg < 112.5) return 'S';
  if (deg < 157.5) return 'SW';
  if (deg < 202.5) return 'W';
  if (deg < 247.5) return 'NW';
  if (deg < 292.5) return 'N';
  return 'NE';
}

export function buildNavigationObjectives(
  stats: SurvivalStats,
  player: PlayerState,
  structures: StructureEntity[] = []
): NavigationObjective[] {
  type RawDef = {
    id: ObjectivePinId;
    pin: string;
    order: number;
    title: string;
    sector: string;
    tx: number;
    ty: number;
    wx: number;
    wy: number;
    completed: boolean;
    lockedReason?: string;
    instructions: string;
    controlsCue: string;
    reward: string;
  };

  let rawDefs: RawDef[];

  if (stats.planet === 'moon') {
    const { lunarMission } = stats;
    const apolloSites = structures.filter((s) => s.type === 'apollo_plutonium');
    const remainingSites = apolloSites.filter((s) => !s.salvaged);

    // Target nearest uncollected Apollo plutonium core (or fallback to first site once complete)
    let nearestApollo = remainingSites[0] ?? apolloSites[0];
    if (remainingSites.length > 1) {
      let bestDist = Infinity;
      for (const s of remainingSites) {
        const d = Math.hypot(
          (s.tx + s.w / 2) * TILE_SIZE - player.x,
          (s.ty + s.h / 2) * TILE_SIZE - player.y
        );
        if (d < bestDist) {
          bestDist = d;
          nearestApollo = s;
        }
      }
    }

    const apolloTx = nearestApollo ? (nearestApollo.tx + nearestApollo.w / 2) * TILE_SIZE : 8 * TILE_SIZE;
    const apolloTy = nearestApollo ? (nearestApollo.ty + nearestApollo.h / 2) * TILE_SIZE : 10 * TILE_SIZE;
    const apolloWalkX = nearestApollo
      ? (nearestApollo.tx + nearestApollo.w / 2) * TILE_SIZE
      : 8 * TILE_SIZE;
    const apolloWalkY = nearestApollo
      ? (nearestApollo.ty + nearestApollo.h + 0.9) * TILE_SIZE
      : 12 * TILE_SIZE;

    const puDone = lunarMission.plutoniumCollected >= APOLLO_PLUTONIUM_TOTAL;

    rawDefs = [
      {
        id: 'apollo_plutonium',
        pin: '1',
        order: 1,
        title: `Collect Apollo Plutonium (${lunarMission.plutoniumCollected}/${APOLLO_PLUTONIUM_TOTAL})`,
        sector: nearestApollo ? nearestApollo.label.split(' · ')[0] : 'Apollo Crater Wrecks',
        tx: apolloTx,
        ty: apolloTy,
        wx: apolloWalkX,
        wy: apolloWalkY,
        completed: puDone,
        instructions:
          'Search the 4 glowing cyan Apollo spacecraft wreckages scattered across the lunar craters and press E at each site to collect all 4 Plutonium-238 cores.',
        controlsCue: 'Press E at Cyan PU-238 Wrecks',
        reward: '4 Plutonium-238 Fuel Cores',
      },
      {
        id: 'lunar_rtg',
        pin: '2',
        order: 2,
        title: 'Power RTG & Charge Rover',
        sector: 'Central Charging Pad',
        tx: 24.5 * TILE_SIZE,
        ty: 16 * TILE_SIZE,
        wx: 21.8 * TILE_SIZE,
        wy: 16 * TILE_SIZE,
        completed: lunarMission.roverCharged,
        lockedReason: !puDone
          ? `Collect all ${APOLLO_PLUTONIUM_TOTAL} Apollo Plutonium cores in Step [1] first`
          : undefined,
        instructions:
          'Bring all 4 Plutonium-238 cores to the Radioisotope Thermoelectric Generator (RTG) east of your rocket and press E to generate electricity and charge the Lunar Rover.',
        controlsCue: 'Press E at RTG Station',
        reward: 'Lunar Rover 100% Charged',
      },
      {
        id: 'lunar_rover',
        pin: '3',
        order: 3,
        title: 'Drive Rover to Fuel Base',
        sector: 'Central Charging Pad',
        tx: 24.5 * TILE_SIZE,
        ty: 20 * TILE_SIZE,
        wx: 21.8 * TILE_SIZE,
        wy: 20 * TILE_SIZE,
        completed: lunarMission.rocketFuelRecovered,
        lockedReason: !lunarMission.roverCharged
          ? 'Power the RTG in Step [2] first to charge the Lunar Rover'
          : undefined,
        instructions:
          'Board the charged Lunar Rover and climb 900m across steep lunar hills to Lunar Fuel Base 02 to recover cryogenic Rocket Fuel.',
        controlsCue: 'Press E at Rover · D/→ Gas · A/← Brake/Tilt',
        reward: 'Cryogenic Rocket Fuel',
      },
      {
        id: 'lunar_lander',
        pin: 'L',
        order: 4,
        title: 'Fuel Ares IV & Fly to Earth',
        sector: 'Western Lunar Landing Pad',
        tx: 14 * TILE_SIZE,
        ty: 19 * TILE_SIZE,
        wx: 17.5 * TILE_SIZE,
        wy: 20.0 * TILE_SIZE,
        completed: lunarMission.rocketFueled,
        lockedReason: !lunarMission.rocketFuelRecovered
          ? 'Drive the Lunar Rover in Step [3] to get Rocket Fuel first'
          : undefined,
        instructions:
          'Return to the Ares IV Spacecraft on the Lunar Landing Pad, load the recovered Rocket Fuel into the tanks, and launch home to Earth!',
        controlsCue: 'Press E at Ares IV -> Load Fuel & Fly',
        reward: 'Fly Home to Earth (Victory)',
      },
    ];
  } else {
    const { pathfinderMission, blindLandingMission, rocket, earthLocated } = stats;
    const shipRepaired = rocket.cushioning >= 100 && rocket.outerPlating >= 100;

    rawDefs = [
      {
        id: 'rover_recovery',
        pin: '1',
        order: 1,
        title: 'Pathfinder Airbag Run',
        sector: 'Western Crater Basin (NW)',
        tx: 10.5 * TILE_SIZE,
        ty: 11 * TILE_SIZE,
        wx: 12.8 * TILE_SIZE,
        wy: 11 * TILE_SIZE,
        completed: pathfinderMission.completed,
        instructions:
          'Travel northwest to the Abandoned Mars Pathfinder Rover. Bounce across the Martian canyon and collect 10 Airbags to restore Ares IV landing cushioning.',
        controlsCue: 'Press E at Pathfinder Rover · Space/Click to Jump',
        reward: '10 Pathfinder Airbags (Cushioning)',
      },
      {
        id: 'systems_repair',
        pin: '2',
        order: 2,
        title: 'Blind Landing: Ingenuity Autopilot',
        sector: 'Eastern Highlands Relay (NE)',
        tx: 45.5 * TILE_SIZE,
        ty: 10.5 * TILE_SIZE,
        wx: 43.0 * TILE_SIZE,
        wy: 10.5 * TILE_SIZE,
        completed: blindLandingMission.completed,
        instructions:
          'Head northeast to the Ingenuity Mars Helicopter Relay. Program all 3 flight paths in advance to navigate ridges and recover 3 Steel Alloys for rocket outer plating.',
        controlsCue: 'Press E at Ingenuity Relay · Queue & Send Flight',
        reward: '3 Steel Alloys (Outer Plating)',
      },
      {
        id: 'crashed_rocket',
        pin: 'S',
        order: 3,
        title: 'Rebuild Ares IV Spacecraft',
        sector: 'Central Crash Site',
        tx: 28 * TILE_SIZE,
        ty: 19 * TILE_SIZE,
        wx: 28.5 * TILE_SIZE,
        wy: 22.0 * TILE_SIZE,
        completed: shipRepaired,
        lockedReason:
          !pathfinderMission.completed || !blindLandingMission.completed
            ? 'Complete Missions [1] Pathfinder and [2] Ingenuity first to gather Airbags & Steel Alloys'
            : undefined,
        instructions:
          'Return to the Ares IV Crash Site blue safe zone. Open the Spacecraft Repair console and install both Pathfinder Cushioning (100%) and Ingenuity Outer Plating (100%).',
        controlsCue: 'Press E at Spacecraft to Install Parts',
        reward: 'Spacecraft Flight-Ready (100%)',
      },
      {
        id: 'kepler_telescope',
        pin: '3',
        order: 4,
        title: 'Locate Earth (Kepler) & Launch',
        sector: 'Central Crash Site',
        tx: 28 * TILE_SIZE,
        ty: 19 * TILE_SIZE,
        wx: 28.5 * TILE_SIZE,
        wy: 22.0 * TILE_SIZE,
        completed: earthLocated,
        lockedReason: !shipRepaired
          ? 'Install Cushioning & Outer Plating on Ares IV in Step [S] first'
          : undefined,
        instructions:
          'Once Ares IV is 100% repaired, open the Spacecraft console to run the Kepler Space Telescope transit photometry scan, lock Earth coordinates, and launch Chapter 2.',
        controlsCue: 'Press E at Spacecraft -> Locate Earth',
        reward: 'Earth Lock & Chapter 2 Launch',
      },
    ];
  }

  return rawDefs.map((d) => {
    const dx = d.tx - player.x;
    const dy = d.ty - player.y;
    const distPx = Math.hypot(dx, dy);
    return {
      id: d.id,
      pin: d.pin,
      order: d.order,
      title: d.title,
      sector: d.sector,
      targetX: d.tx,
      targetY: d.ty,
      walkX: d.wx,
      walkY: d.wy,
      completed: d.completed,
      lockedReason: d.lockedReason,
      instructions: d.instructions,
      controlsCue: d.controlsCue,
      reward: d.reward,
      bearing: getCompassBearing(dx, dy),
      distanceMeters: Math.max(0, Math.round(distPx / 2)),
    };
  });
}

export function resolveActiveObjective(
  objectives: NavigationObjective[],
  manualTrackedId: ObjectivePinId | null
): NavigationObjective {
  if (manualTrackedId) {
    const found = objectives.find((o) => o.id === manualTrackedId);
    if (found) return found;
  }
  const nextPending = objectives.find((o) => !o.completed);
  return nextPending ?? objectives[objectives.length - 1];
}
