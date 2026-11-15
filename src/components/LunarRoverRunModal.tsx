import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Fuel, Pause, Play, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { soundFX } from '../game/audio';
import { AstronautPortrait } from './PathfinderDialogueModal';

interface LunarRoverRunModalProps {
  alreadyCompleted?: boolean;
  onMissionSuccess: () => void;
  onExitToMoon: () => void;
}

type DrivePhase = 'BRIEFING' | 'DRIVING' | 'PAUSED' | 'WON' | 'LOST';

interface BatteryCell {
  id: number;
  worldX: number;
  worldY: number;
  phase: number;
  collected: boolean;
}

interface RoverParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

const LOGICAL_W = 840;
const LOGICAL_H = 360;
const BASE_GROUND_Y = 248;
const GOAL_DISTANCE_METERS = 900;
const PX_PER_METER = 14;
const START_WORLD_X = 160;
const GOAL_WORLD_X = START_WORLD_X + GOAL_DISTANCE_METERS * PX_PER_METER; // 12760

const LUNAR_GRAVITY = 325;
const WHEEL_BASE_HALF = 24;
const WHEEL_RADIUS = 11.5;
const CHASSIS_RIDE_H = 15;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Continuous multi-octave lunar hill profile with flat launch pad & flat Fuel Base 02 apron */
function getLunarTerrainY(worldX: number): number {
  if (worldX <= 300) return BASE_GROUND_Y;
  if (worldX >= GOAL_WORLD_X - 240) return BASE_GROUND_Y;

  const startFade = smoothstep(300, 760, worldX);
  const endFade = 1 - smoothstep(GOAL_WORLD_X - 720, GOAL_WORLD_X - 240, worldX);
  const progress = Math.max(0, Math.min(1, (worldX - 300) / (GOAL_WORLD_X - 600)));

  // Ramp hill amplitude gently over the 900m expedition
  const difficulty = 0.48 + progress * 0.62;
  const amp = startFade * endFade * difficulty;

  const h1 = Math.sin((worldX - 300) * 0.0041) * 46;
  const h2 = Math.sin((worldX - 300) * 0.0096 + 1.15) * 23;
  const h3 = Math.sin((worldX - 300) * 0.0205 + 2.4) * 9.5;
  // Subtle lunar crater dips & ridge crests
  const ridge = Math.cos((worldX - 300) * 0.0063 + 0.5) * 14;

  return BASE_GROUND_Y - (h1 + h2 + h3 + ridge) * amp;
}

function getLunarSlope(worldX: number): number {
  const eps = 3;
  return (getLunarTerrainY(worldX + eps) - getLunarTerrainY(worldX - eps)) / (eps * 2);
}

function generateBatteryCells(): BatteryCell[] {
  const cells: BatteryCell[] = [];
  let id = 1;
  // Place cells every ~80m along hills, crests, and jump arcs so battery strategy matters
  for (let m = 72; m < GOAL_DISTANCE_METERS - 45; m += 78) {
    const jitter = ((id * 37) % 19) - 9;
    const wx = START_WORLD_X + (m + jitter) * PX_PER_METER;
    const gy = getLunarTerrainY(wx);
    const airborneHover = id % 3 === 0 ? 48 : 22;
    cells.push({
      id,
      worldX: wx,
      worldY: gy - airborneHover,
      phase: id * 1.3,
      collected: false,
    });
    id += 1;
  }
  return cells;
}

function drawSkyEarthMini(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(x - 8, y - 7, 9, 6);
  ctx.fillRect(x - 3, y, 8, 8);
  ctx.fillRect(x + 5, y - 5, 6, 7);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.fillRect(x - 9, y - 14, 12, 3);
  ctx.fillRect(x - 12, y - 1, 7, 2);
  ctx.fillRect(x + 2, y + 8, 10, 2);
  ctx.restore();
}

function drawFuelDepotBase(
  ctx: CanvasRenderingContext2D,
  baseScreenX: number,
  groundY: number,
  timeSec: number
) {
  const x = Math.round(baseScreenX);
  const y = Math.round(groundY);

  // Concrete pad apron
  ctx.fillStyle = '#2b303a';
  ctx.fillRect(x - 36, y - 4, 260, 14);

  // Checkered finish banner pole
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 24, y - 62, 4, 58);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x - 20 + col * 6, y - 60 + row * 6, 6, 6);
    }
  }

  // Pressurized Fuel Base Dome & Operations Center
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 12, y - 78, 118, 74);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 16, y - 74, 110, 68);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 16, y - 74, 110, 6);

  // Glowing bay windows
  for (const wx of [x + 28, x + 56, x + 84]) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(wx, y - 56, 18, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(wx + 2, y - 54, 14, 10);
  }

  // Docking garage arch
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 24, y - 32, 38, 28);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(x + 22, y - 35, 42, 3);

  // Towering Cryogenic Rocket Fuel Tanks (LH2 / LOX)
  for (const tx of [x + 142, x + 174]) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tx - 1, y - 102, 26, 98);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(tx, y - 100, 24, 94);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(tx + 2, y - 98, 8, 90);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(tx, y - 64, 24, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(tx, y - 38, 24, 4);
  }

  // Depot Roof Sign & Beacon
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 26, y - 96, 96, 16);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 26, y - 96, 96, 16);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 9px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL DEPOT 02', x + 74, y - 85);

  const pulse = Math.sin(timeSec * 6) > 0;
  ctx.fillStyle = pulse ? '#4ade80' : '#15803d';
  ctx.beginPath();
  ctx.arc(x + 154, y - 109, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHillClimbLunarRover(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  angle: number,
  wheelSpin: number,
  rearCompression: number,
  frontCompression: number,
  gasActive: boolean,
  driverTilt: number
) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(angle);

  // Headlight beam cone illuminating lunar hills ahead
  const beam = ctx.createLinearGradient(28, -8, 175, 16);
  beam.addColorStop(0, 'rgba(254, 240, 138, 0.36)');
  beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(28, -8);
  ctx.lineTo(175, -24);
  ctx.lineTo(175, 22);
  ctx.closePath();
  ctx.fill();

  // Articulated spring suspension arms (rear & front)
  const rearWheelY = CHASSIS_RIDE_H - rearCompression;
  const frontWheelY = CHASSIS_RIDE_H - frontCompression;

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.lineTo(-WHEEL_BASE_HALF, rearWheelY);
  ctx.moveTo(12, -2);
  ctx.lineTo(WHEEL_BASE_HALF, frontWheelY);
  ctx.stroke();

  // Coil spring shock struts
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -5);
  ctx.lineTo(-WHEEL_BASE_HALF, rearWheelY - 2);
  ctx.moveTo(18, -5);
  ctx.lineTo(WHEEL_BASE_HALF, frontWheelY - 2);
  ctx.stroke();

  // Chassis frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-31, -8, 62, 10);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-29, -6, 58, 7);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-28, -2, 56, 2);

  // Rear Gold Kapton RTG / Battery Pack
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-29, -18, 15, 11);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-27, -16, 11, 7);
  ctx.fillStyle = gasActive ? '#38bdf8' : '#0ea5e9';
  ctx.fillRect(-24, -14, 5, 4);

  // Rollbar & High-Gain Dish Antenna
  ctx.fillStyle = '#64748b';
  ctx.fillRect(15, -26, 3, 20);
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(21, -26, 7, Math.PI * 0.7, Math.PI * 1.9);
  ctx.fill();

  // Astronaut Driver (leans slightly with acceleration / pitch)
  ctx.save();
  ctx.translate(-3, -6);
  ctx.rotate(driverTilt);
  // Torso
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-7, -15, 14, 15);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-6, -14, 12, 13);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-6, -11, 12, 2);
  // Helmet & Visor
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-7, -28, 14, 13);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-6, -27, 12, 11);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, -24, 6, 6);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(1, -24, 3, 2);
  ctx.restore();

  // Front Headlight Lamp
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(27, -9, 4, 5);

  // Two large rotating wire-mesh lunar wheels
  const wheels: [number, number][] = [
    [-WHEEL_BASE_HALF, rearWheelY],
    [WHEEL_BASE_HALF, frontWheelY],
  ];
  for (const [wx, wy] of wheels) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wheelSpin);
    // Outer tire
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Tread lugs
    ctx.fillStyle = '#64748b';
    for (let t = 0; t < 8; t++) {
      const ta = (t * Math.PI) / 4;
      ctx.fillRect(Math.cos(ta) * 9 - 1.5, Math.sin(ta) * 9 - 1.5, 3, 3);
    }
    // Rim
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    // Wire mesh spokes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();
    // Gold hubcap
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export const LunarRoverRunModal: React.FC<LunarRoverRunModalProps> = ({
  alreadyCompleted = false,
  onMissionSuccess,
  onExitToMoon,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<DrivePhase>('BRIEFING');
  const phaseRef = useRef<DrivePhase>('BRIEFING');
  const keysRef = useRef<Set<string>>(new Set());
  const pedalRef = useRef<{ gas: boolean; brake: boolean }>({ gas: false, brake: false });
  const [pedalsUi, setPedalsUi] = useState({ gas: false, brake: false });

  const [hud, setHud] = useState({
    distanceMeters: 0,
    speedKmh: 0,
    battery: 100,
    flips: 0,
    loseReason: '' as '' | 'battery' | 'flipped',
  });

  const simRef = useRef({
    x: START_WORLD_X,
    y: BASE_GROUND_Y - CHASSIS_RIDE_H - WHEEL_RADIUS,
    vx: 0,
    vy: 0,
    angle: 0,
    angVel: 0,
    wheelSpin: 0,
    rearComp: 0,
    frontComp: 0,
    driverTilt: 0,
    camX: START_WORLD_X - 240,
    camY: 0,
    battery: 100,
    flips: 0,
    airTime: 0,
    airAngleAccum: 0,
    prevAirAngle: 0,
    wasAirborne: false,
    roofGrace: 0,
    dustCooldown: 0,
    cells: generateBatteryCells(),
    particles: [] as RoverParticle[],
    uiTimer: 0,
  });

  const setDrivePhase = useCallback((next: DrivePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const resetDrive = useCallback(() => {
    const sim = simRef.current;
    sim.x = START_WORLD_X;
    sim.y = getLunarTerrainY(START_WORLD_X) - CHASSIS_RIDE_H - WHEEL_RADIUS;
    sim.vx = 0;
    sim.vy = 0;
    sim.angle = 0;
    sim.angVel = 0;
    sim.wheelSpin = 0;
    sim.rearComp = 0;
    sim.frontComp = 0;
    sim.driverTilt = 0;
    sim.camX = START_WORLD_X - 230;
    sim.camY = 0;
    sim.battery = 100;
    sim.flips = 0;
    sim.airTime = 0;
    sim.airAngleAccum = 0;
    sim.prevAirAngle = 0;
    sim.wasAirborne = false;
    sim.roofGrace = 0;
    sim.dustCooldown = 0;
    sim.cells = generateBatteryCells();
    sim.particles = [];
    sim.uiTimer = 0;
    pedalRef.current = { gas: false, brake: false };
    setPedalsUi({ gas: false, brake: false });
    setHud({
      distanceMeters: 0,
      speedKmh: 0,
      battery: 100,
      flips: 0,
      loseReason: '',
    });
    setDrivePhase('DRIVING');
    soundFX.playUiClick();
  }, [setDrivePhase]);

  useEffect(() => {
    const syncKeysToPedals = () => {
      const gas = keysRef.current.has('KeyD') || keysRef.current.has('ArrowRight');
      const brake = keysRef.current.has('KeyA') || keysRef.current.has('ArrowLeft');
      setPedalsUi({
        gas: pedalRef.current.gas || gas,
        brake: pedalRef.current.brake || brake,
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      syncKeysToPedals();
      if (e.code === 'Space' && phaseRef.current === 'BRIEFING') {
        e.preventDefault();
        e.stopPropagation();
        resetDrive();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (phaseRef.current === 'DRIVING') {
          setDrivePhase('PAUSED');
        } else if (phaseRef.current === 'PAUSED') {
          setDrivePhase('DRIVING');
        } else if (e.code === 'Escape' && phaseRef.current === 'BRIEFING') {
          onExitToMoon();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      syncKeysToPedals();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [onExitToMoon, resetDrive, setDrivePhase]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;
      const sim = simRef.current;
      const currentPhase = phaseRef.current;

      const gasHeld =
        pedalRef.current.gas ||
        keysRef.current.has('KeyD') ||
        keysRef.current.has('ArrowRight');
      const brakeHeld =
        pedalRef.current.brake ||
        keysRef.current.has('KeyA') ||
        keysRef.current.has('ArrowLeft');

      if (currentPhase === 'DRIVING') {
        const substeps = 2;
        const subDt = dt / substeps;
        let groundedAny = false;
        let crashedFlipped = false;

        for (let step = 0; step < substeps; step++) {
          const cos = Math.cos(sim.angle);
          const sin = Math.sin(sim.angle);

          // Gravity
          sim.vy += LUNAR_GRAVITY * subDt;

          // World coordinates of rear & front wheel hubs
          const rHubX = sim.x - cos * WHEEL_BASE_HALF - sin * CHASSIS_RIDE_H;
          const rHubY = sim.y - sin * WHEEL_BASE_HALF + cos * CHASSIS_RIDE_H;
          const fHubX = sim.x + cos * WHEEL_BASE_HALF - sin * CHASSIS_RIDE_H;
          const fHubY = sim.y + sin * WHEEL_BASE_HALF + cos * CHASSIS_RIDE_H;

          const gRear = getLunarTerrainY(rHubX);
          const gFront = getLunarTerrainY(fHubX);

          const penRear = rHubY + WHEEL_RADIUS - gRear;
          const penFront = fHubY + WHEEL_RADIUS - gFront;

          const rearHit = penRear > 0;
          const frontHit = penFront > 0;
          if (rearHit || frontHit) groundedAny = true;

          sim.rearComp = rearHit ? Math.min(7, penRear * 0.45) : sim.rearComp * 0.8;
          sim.frontComp = frontHit ? Math.min(7, penFront * 0.45) : sim.frontComp * 0.8;

          const wheels: {
            hit: boolean;
            pen: number;
            hubX: number;
            armX: number;
          }[] = [
            { hit: rearHit, pen: penRear, hubX: rHubX, armX: -WHEEL_BASE_HALF },
            { hit: frontHit, pen: penFront, hubX: fHubX, armX: WHEEL_BASE_HALF },
          ];

          for (const w of wheels) {
            if (!w.hit) continue;
            const slope = getLunarSlope(w.hubX);
            const len = Math.hypot(1, slope);
            const tx = 1 / len;
            const ty = slope / len;
            // Upward surface normal in Y-down coordinates
            const nx = slope / len;
            const ny = -1 / len;

            // Spring + damper normal impulse
            const relVn = sim.vx * nx + sim.vy * ny;
            const springF = Math.max(0, w.pen * 185 - relVn * 18);
            const fx = nx * springF;
            const fy = ny * springF;

            sim.vx += fx * subDt;
            sim.vy += fy * subDt;

            // Torque around chassis center aligns rover to hills naturally
            const rx = w.armX * cos;
            const ry = w.armX * sin;
            const torque = (rx * fy - ry * fx) * 0.0022;
            sim.angVel += torque * subDt;

            // Drive traction along slope tangent
            const tangVel = sim.vx * tx + sim.vy * ty;
            if (gasHeld && !brakeHeld) {
              const targetMax = 510;
              if (tangVel < targetMax) {
                const drivePower = 480 * (1 - Math.max(0, tangVel) / 680);
                sim.vx += tx * drivePower * subDt;
                sim.vy += ty * drivePower * subDt;
              }
            } else if (brakeHeld && !gasHeld) {
              if (tangVel > 18) {
                // Strong hill-hold / braking
                sim.vx -= tx * 560 * subDt;
                sim.vy -= ty * 560 * subDt;
              } else if (tangVel > -190) {
                // Reverse up/down hill
                sim.vx -= tx * 280 * subDt;
                sim.vy -= ty * 280 * subDt;
              }
            } else {
              // Gentle coast rolling friction
              sim.vx -= tx * tangVel * 0.35 * subDt;
            }
          }

          // Soft hard-stop projection if deeply embedded after big landing
          const maxPen = Math.max(penRear, penFront);
          if (maxPen > 6) {
            const corr = (maxPen - 6) * 0.55;
            sim.y -= corr;
            if (sim.vy > 0) sim.vy *= 0.65;
          }

          // Pitch control: classic Hill Climb Racing!
          // In air: GAS tilts nose UP (backflip), BRAKE tilts nose DOWN (frontflip).
          // On ground: slight wheelie torque on gas / nose dip on brake.
          if (!rearHit && !frontHit) {
            if (gasHeld && !brakeHeld) {
              sim.angVel -= 5.6 * subDt;
            } else if (brakeHeld && !gasHeld) {
              sim.angVel += 5.6 * subDt;
            }
            sim.angVel *= 1 - 0.85 * subDt;
          } else {
            if (gasHeld && !brakeHeld && rearHit && !frontHit) {
              sim.angVel -= 1.6 * subDt;
            } else if (brakeHeld && !gasHeld && frontHit && !rearHit) {
              sim.angVel += 1.6 * subDt;
            }
            sim.angVel *= 1 - 6.5 * subDt;
          }

          sim.angVel = Math.max(-7.2, Math.min(7.2, sim.angVel));
          sim.angle += sim.angVel * subDt;

          // Keep rover inside left boundary
          if (sim.x < 70) {
            sim.x = 70;
            if (sim.vx < 0) sim.vx = 0;
          }

          sim.x += sim.vx * subDt;
          sim.y += sim.vy * subDt;

          // Roof / Helmet crash detection (when upside-down & head contacts regolith)
          const cos2 = Math.cos(sim.angle);
          const sin2 = Math.sin(sim.angle);
          // Local helmet top at (0, -32) -> world:
          const headX = sim.x - (-32) * sin2;
          const headY = sim.y + (-32) * cos2;
          const groundAtHead = getLunarTerrainY(headX);

          if ((headY + 4 >= groundAtHead && cos2 < 0.22) || (cos2 < -0.35 && Math.abs(sim.vx) < 18 && Math.abs(sim.vy) < 18)) {
            sim.roofGrace += subDt;
            sim.vx *= 0.92;
            if (sim.roofGrace > 0.12) {
              crashedFlipped = true;
              break;
            }
          } else {
            sim.roofGrace = Math.max(0, sim.roofGrace - subDt * 2);
          }
        }

        // Wheel spin & astronaut lean
        const wheelMove = gasHeld ? Math.max(sim.vx, 220) : brakeHeld ? Math.min(sim.vx, -120) : sim.vx;
        sim.wheelSpin += (wheelMove * dt) / WHEEL_RADIUS;
        const targetDriverTilt = gasHeld ? -0.14 : brakeHeld ? 0.14 : 0;
        sim.driverTilt += (targetDriverTilt - sim.driverTilt) * Math.min(1, dt * 10);

        // Air-time & flip stunt detection!
        if (!groundedAny) {
          if (!sim.wasAirborne) {
            sim.wasAirborne = true;
            sim.airTime = 0;
            sim.airAngleAccum = 0;
            sim.prevAirAngle = sim.angle;
          } else {
            sim.airTime += dt;
            sim.airAngleAccum += sim.angle - sim.prevAirAngle;
            sim.prevAirAngle = sim.angle;
          }
        } else if (sim.wasAirborne) {
          sim.wasAirborne = false;
          const completedFlips = Math.floor(Math.abs(sim.airAngleAccum) / (Math.PI * 1.68));
          if (completedFlips >= 1 && !crashedFlipped) {
            const isBackflip = sim.airAngleAccum < 0;
            const bonus = completedFlips * 15;
            sim.flips += completedFlips;
            sim.battery = Math.min(100, sim.battery + bonus);
            soundFX.playRoverBoost();
            sim.particles.push({
              x: sim.x,
              y: sim.y - 46,
              vx: sim.vx * 0.25,
              vy: -36,
              life: 1.15,
              maxLife: 1.15,
              size: 1,
              color: '#fde047',
              text: `${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}${completedFlips > 1 ? ` x${completedFlips}` : ''}! +${bonus}% PWR`,
            });
          } else if (sim.airTime > 0.9 && !crashedFlipped) {
            sim.battery = Math.min(100, sim.battery + 6);
            soundFX.playLandingThud();
            soundFX.playRepair();
            sim.particles.push({
              x: sim.x,
              y: sim.y - 44,
              vx: sim.vx * 0.2,
              vy: -32,
              life: 0.95,
              maxLife: 0.95,
              size: 1,
              color: '#38bdf8',
              text: 'LUNAR AIR! +6% PWR',
            });
          } else if (sim.airTime > 0.35 && !crashedFlipped) {
            soundFX.playLandingThud();
          }
          sim.airTime = 0;
          sim.airAngleAccum = 0;
        }

        // Kick up lunar regolith dust behind rear wheel when accelerating on ground
        sim.dustCooldown -= dt;
        if (groundedAny && (gasHeld || brakeHeld) && Math.abs(sim.vx) > 35 && sim.dustCooldown <= 0) {
          sim.dustCooldown = 0.055;
          const cos = Math.cos(sim.angle);
          const sin = Math.sin(sim.angle);
          const rearX = sim.x - cos * WHEEL_BASE_HALF - sin * (CHASSIS_RIDE_H + WHEEL_RADIUS);
          const rearY = sim.y - sin * WHEEL_BASE_HALF + cos * (CHASSIS_RIDE_H + WHEEL_RADIUS);
          sim.particles.push({
            x: rearX + (Math.random() - 0.5) * 6,
            y: rearY - 2,
            vx: -sim.vx * 0.28 - 35 - Math.random() * 45,
            vy: -18 - Math.random() * 34,
            life: 0.45,
            maxLife: 0.45,
            size: 3 + Math.random() * 2,
            color: Math.random() < 0.5 ? '#94a3b8' : '#cbd5e1',
          });
        }

        // Collect glowing cyan Battery Cells
        for (const cell of sim.cells) {
          if (cell.collected) continue;
          const bobY = cell.worldY + Math.sin(timeSec * 4.5 + cell.phase) * 5;
          if (Math.hypot(sim.x - cell.worldX, sim.y - bobY) < 42) {
            cell.collected = true;
            sim.battery = Math.min(100, sim.battery + 26);
            soundFX.playCoin();
            sim.particles.push({
              x: cell.worldX,
              y: bobY - 12,
              vx: 0,
              vy: -34,
              life: 0.9,
              maxLife: 0.9,
              size: 1,
              color: '#22d3ee',
              text: '+26% PWR',
            });
          }
        }

        // Battery drain (higher when holding throttle)
        const prevBattery = sim.battery;
        const drainRate = gasHeld ? 3.5 : brakeHeld ? 2.4 : 1.5;
        sim.battery = Math.max(0, sim.battery - drainRate * dt);
        if (prevBattery >= 20 && sim.battery < 20) {
          soundFX.playWarningTick();
        }

        // Smooth camera tracking ahead of rover & gently framing vertical hills
        const targetCamX = sim.x - 225 + Math.max(0, sim.vx * 0.16);
        sim.camX += (targetCamX - sim.camX) * Math.min(1, dt * 7);
        const targetCamY = Math.max(-95, Math.min(60, sim.y - 215));
        sim.camY += (targetCamY - sim.camY) * Math.min(1, dt * 4.5);

        const distMeters = Math.max(
          0,
          Math.min(GOAL_DISTANCE_METERS, Math.floor((sim.x - START_WORLD_X) / PX_PER_METER))
        );

        if (crashedFlipped) {
          soundFX.playImpact();
          for (let k = 0; k < 18; k++) {
            const ang = (Math.PI * 2 * k) / 18;
            sim.particles.push({
              x: sim.x,
              y: sim.y,
              vx: Math.cos(ang) * 110,
              vy: Math.sin(ang) * 110 - 40,
              life: 0.65,
              maxLife: 0.65,
              size: 4,
              color: k % 2 === 0 ? '#f87171' : '#fde047',
            });
          }
          setHud({
            distanceMeters: distMeters,
            speedKmh: 0,
            battery: Math.round(sim.battery),
            flips: sim.flips,
            loseReason: 'flipped',
          });
          setDrivePhase('LOST');
        } else if (sim.battery <= 0 && Math.abs(sim.vx) < 28) {
          soundFX.playAlert();
          setHud({
            distanceMeters: distMeters,
            speedKmh: 0,
            battery: 0,
            flips: sim.flips,
            loseReason: 'battery',
          });
          setDrivePhase('LOST');
        } else if (sim.x >= GOAL_WORLD_X) {
          soundFX.playMissionComplete();
          for (let k = 0; k < 30; k++) {
            const ang = Math.random() * Math.PI * 2;
            sim.particles.push({
              x: sim.x,
              y: sim.y - 16,
              vx: Math.cos(ang) * (60 + Math.random() * 120),
              vy: Math.sin(ang) * (60 + Math.random() * 120) - 55,
              life: 1.0,
              maxLife: 1.0,
              size: 4,
              color: ['#4ade80', '#38bdf8', '#fde047'][k % 3],
            });
          }
          setHud({
            distanceMeters: GOAL_DISTANCE_METERS,
            speedKmh: Math.round(Math.abs(sim.vx) * 0.14),
            battery: Math.round(sim.battery),
            flips: sim.flips,
            loseReason: '',
          });
          setDrivePhase('WON');
        }

        sim.uiTimer += dt;
        if (sim.uiTimer >= 0.08 && phaseRef.current === 'DRIVING') {
          sim.uiTimer = 0;
          setHud({
            distanceMeters: distMeters,
            speedKmh: Math.round(Math.abs(sim.vx) * 0.14),
            battery: Math.round(sim.battery),
            flips: sim.flips,
            loseReason: '',
          });
        }
      }

      if (currentPhase !== 'PAUSED') {
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) sim.particles.splice(i, 1);
        }
      }

      // Render Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.floor(LOGICAL_W * dpr);
        const targetH = Math.floor(LOGICAL_H * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          // 1. Starlit Black Lunar Sky
          ctx.fillStyle = '#060a13';
          ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

          for (let i = 0; i < 48; i++) {
            const sx = ((i * 197 - sim.camX * 0.025) % LOGICAL_W + LOGICAL_W) % LOGICAL_W;
            const sy = 14 + ((i * 89) % 195);
            ctx.fillStyle = i % 5 === 0 ? '#93c5fd' : '#e2e8f0';
            ctx.fillRect(sx, sy, i % 6 === 0 ? 2 : 1.5, i % 6 === 0 ? 2 : 1.5);
          }

          drawSkyEarthMini(ctx, 700, 62 - sim.camY * 0.08);

          // 2. Parallax Distant Grey Lunar Mountains
          const farOff = ((sim.camX * 0.14) % LOGICAL_W + LOGICAL_W) % LOGICAL_W;
          const farBaseY = 258 - sim.camY * 0.25;
          ctx.fillStyle = '#1b2230';
          for (let rep = 0; rep < 2; rep++) {
            const bx = rep * LOGICAL_W - farOff;
            ctx.beginPath();
            ctx.moveTo(bx, LOGICAL_H);
            const peaks = [
              [0, farBaseY - 40],
              [110, farBaseY - 88],
              [230, farBaseY - 56],
              [360, farBaseY - 108],
              [480, farBaseY - 62],
              [600, farBaseY - 96],
              [720, farBaseY - 52],
              [840, farBaseY - 40],
            ];
            for (const [px, py] of peaks) ctx.lineTo(bx + px, py);
            ctx.lineTo(bx + LOGICAL_W, LOGICAL_H);
            ctx.closePath();
            ctx.fill();
          }

          // 3. Mid-ground Crater Rim Ridges
          const midOff = ((sim.camX * 0.32) % LOGICAL_W + LOGICAL_W) % LOGICAL_W;
          const midBaseY = 278 - sim.camY * 0.45;
          ctx.fillStyle = '#2d3544';
          for (let rep = 0; rep < 2; rep++) {
            const bx = rep * LOGICAL_W - midOff;
            ctx.beginPath();
            ctx.moveTo(bx, LOGICAL_H);
            const ridges = [
              [0, midBaseY - 34],
              [95, midBaseY - 56],
              [175, midBaseY - 32],
              [315, midBaseY - 64],
              [420, midBaseY - 30],
              [555, midBaseY - 58],
              [665, midBaseY - 30],
              [840, midBaseY - 34],
            ];
            for (const [px, py] of ridges) ctx.lineTo(bx + px, py);
            ctx.lineTo(bx + LOGICAL_W, LOGICAL_H);
            ctx.closePath();
            ctx.fill();
          }

          // World-space camera transform for Lunar Hills, Rover, Depot, Cells, Particles
          ctx.save();
          ctx.translate(-sim.camX, -sim.camY);

          const visStart = Math.floor((sim.camX - 40) / 10) * 10;
          const visEnd = Math.ceil((sim.camX + LOGICAL_W + 40) / 10) * 10;
          const bottomClip = sim.camY + LOGICAL_H + 80;

          // 4. Sculpted Lunar Hills (Deep Basalt + Regolith Crust + Bright Sunlit Rim)
          ctx.fillStyle = '#474f5e';
          ctx.beginPath();
          ctx.moveTo(visStart, bottomClip);
          for (let wx = visStart; wx <= visEnd; wx += 10) {
            ctx.lineTo(wx, getLunarTerrainY(wx));
          }
          ctx.lineTo(visEnd, bottomClip);
          ctx.closePath();
          ctx.fill();

          // Upper lighter regolith band (18px thick following hills)
          ctx.fillStyle = '#687182';
          ctx.beginPath();
          for (let wx = visStart; wx <= visEnd; wx += 10) {
            const ty = getLunarTerrainY(wx);
            if (wx === visStart) ctx.moveTo(wx, ty);
            else ctx.lineTo(wx, ty);
          }
          for (let wx = visEnd; wx >= visStart; wx -= 10) {
            ctx.lineTo(wx, getLunarTerrainY(wx) + 18);
          }
          ctx.closePath();
          ctx.fill();

          // Bright lunar surface crust rim
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let wx = visStart; wx <= visEnd; wx += 10) {
            const ty = getLunarTerrainY(wx);
            if (wx === visStart) ctx.moveTo(wx, ty);
            else ctx.lineTo(wx, ty);
          }
          ctx.stroke();

          // Subsurface lunar rocks & crater dimples anchored in world coords
          const rockStep = 90;
          const firstRock = Math.floor(visStart / rockStep) * rockStep;
          for (let rx = firstRock; rx <= visEnd; rx += rockStep) {
            const gy = getLunarTerrainY(rx);
            const seed = Math.abs(Math.floor(rx * 13)) % 37;
            ctx.fillStyle = '#363d4a';
            ctx.fillRect(rx + 8, gy + 24 + (seed % 26), 10 + (seed % 8), 4);
            ctx.fillStyle = '#535b6b';
            ctx.fillRect(rx + 36, gy + 10 + (seed % 10), 6, 3);
          }

          // Distance Flag Markers every 100m
          for (let m = 100; m < GOAL_DISTANCE_METERS; m += 100) {
            const fx = START_WORLD_X + m * PX_PER_METER;
            if (fx < sim.camX - 40 || fx > sim.camX + LOGICAL_W + 40) continue;
            const fy = getLunarTerrainY(fx);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(fx - 1, fy - 28, 2, 28);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(fx + 1, fy - 28, 34, 13);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.strokeRect(fx + 1, fy - 28, 34, 13);
            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 8px "Silkscreen", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${m}M`, fx + 18, fy - 19);
          }

          // 5. Fuel Depot Destination Base at 900m
          if (GOAL_WORLD_X + 260 > sim.camX && GOAL_WORLD_X - 60 < sim.camX + LOGICAL_W) {
            drawFuelDepotBase(ctx, GOAL_WORLD_X + 24, BASE_GROUND_Y, timeSec);
          }

          // 6. Glowing Cyan Battery Cells
          for (const cell of sim.cells) {
            if (cell.collected) continue;
            if (cell.worldX < sim.camX - 30 || cell.worldX > sim.camX + LOGICAL_W + 30) continue;
            const cy = cell.worldY + Math.sin(timeSec * 4.5 + cell.phase) * 5;
            ctx.save();
            ctx.translate(cell.worldX, cy);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -10, 16, 20);
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(-6, -8, 12, 16);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(-2, -5, 4, 10);
            ctx.restore();
          }

          // 7. Lunar Rover Shadow + Vehicle
          const shadowY = getLunarTerrainY(sim.x);
          const heightAbove = Math.max(0, shadowY - (sim.y + CHASSIS_RIDE_H + WHEEL_RADIUS));
          const shadowScale = Math.max(0.35, 1 - heightAbove / 190);
          ctx.fillStyle = 'rgba(4, 6, 12, 0.45)';
          ctx.beginPath();
          ctx.ellipse(sim.x, shadowY + 3, 30 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
          ctx.fill();

          drawHillClimbLunarRover(
            ctx,
            sim.x,
            sim.y,
            sim.angle,
            sim.wheelSpin,
            sim.rearComp,
            sim.frontComp,
            gasHeld,
            sim.driverTilt
          );

          // 8. World Particles & Stunt Popups
          for (const p of sim.particles) {
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            ctx.save();
            ctx.globalAlpha = alpha;
            if (p.text) {
              ctx.font = 'bold 11px "Silkscreen", monospace';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#060a13';
              ctx.fillText(p.text, p.x + 1, p.y + 1);
              ctx.fillStyle = p.color;
              ctx.fillText(p.text, p.x, p.y);
            } else {
              ctx.fillStyle = p.color;
              ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.restore();
          }

          ctx.restore(); // end camera world transform

          // 9. Screen-Space Progress Track Bar (Top-Center inside viewport)
          const barW = 240;
          const barX = (LOGICAL_W - barW) / 2;
          const barY = 12;
          const frac = Math.max(
            0,
            Math.min(1, (sim.x - START_WORLD_X) / (GOAL_WORLD_X - START_WORLD_X))
          );
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(barX, barY, barW, 12);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, barW, 12);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(barX + 2, barY + 2, (barW - 4) * frac, 8);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(barX + barW - 4, barY - 2, 4, 16);

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [setDrivePhase]);

  const setPedal = (pedal: 'gas' | 'brake', active: boolean) => {
    pedalRef.current[pedal] = active;
    setPedalsUi({ ...pedalRef.current });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/78 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="pixel-panel-dark w-full max-w-[min(96vw,1152px,calc((100dvh-136px)*7/3))] max-h-[96dvh] flex flex-col overflow-hidden text-stone-100"
      >
        {/* Top Bar */}
        <div className="bg-[#343940] border-b-2 border-[#15171a] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Fuel className="w-4 h-4 text-emerald-300" />
            <h2 className="font-pixel text-sm sm:text-base text-[#e8cf79]">
              LUNAR HILL CLIMB
            </h2>
            {alreadyCompleted && (
              <span className="text-[11px] font-mono-tabular text-emerald-300">Replay</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
            <span className="text-stone-300">
              Fuel Base:{' '}
              <strong className="text-emerald-300">
                {hud.distanceMeters} / {GOAL_DISTANCE_METERS}m
              </strong>
            </span>
            <span className="text-stone-300">
              Battery:{' '}
              <strong className={hud.battery < 25 ? 'text-rose-400' : 'text-cyan-300'}>
                {hud.battery}%
              </strong>
            </span>
            <span className="text-stone-300">
              Speed: <strong className="text-amber-300">{hud.speedKmh} km/h</strong>
            </span>
            <span className="text-stone-300 hidden sm:inline">
              Flips: <strong className="text-yellow-300">{hud.flips}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {(phase === 'DRIVING' || phase === 'PAUSED') && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  setDrivePhase(phase === 'DRIVING' ? 'PAUSED' : 'DRIVING');
                }}
                className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                {phase === 'PAUSED' ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={resetDrive}
              className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restart</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onExitToMoon();
              }}
              aria-label="Exit to Moon"
              className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative w-full aspect-[7/3] bg-[#060a13] select-none overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full block touch-none" />

          {/* Hill Climb Racing On-Screen Pedals */}
          {phase === 'DRIVING' && (
            <>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setPedal('brake', true);
                }}
                onPointerUp={() => setPedal('brake', false)}
                onPointerLeave={() => setPedal('brake', false)}
                onPointerCancel={() => setPedal('brake', false)}
                className={`absolute bottom-3 left-3 sm:bottom-4 sm:left-5 w-20 sm:w-24 h-16 sm:h-20 border-2 flex flex-col items-center justify-center transition-transform cursor-pointer select-none touch-none ${
                  pedalsUi.brake
                    ? 'bg-rose-600/90 border-rose-200 scale-95 translate-y-0.5'
                    : 'bg-slate-900/75 hover:bg-slate-800/85 border-slate-400/70'
                }`}
              >
                <span className="font-pixel text-[11px] sm:text-xs text-rose-200">BRAKE</span>
                <span className="text-[9px] font-mono-tabular text-slate-300 mt-0.5">
                  A / ← TILT
                </span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setPedal('gas', true);
                }}
                onPointerUp={() => setPedal('gas', false)}
                onPointerLeave={() => setPedal('gas', false)}
                onPointerCancel={() => setPedal('gas', false)}
                className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-5 w-20 sm:w-24 h-16 sm:h-20 border-2 flex flex-col items-center justify-center transition-transform cursor-pointer select-none touch-none ${
                  pedalsUi.gas
                    ? 'bg-emerald-600/90 border-emerald-200 scale-95 translate-y-0.5'
                    : 'bg-slate-900/75 hover:bg-slate-800/85 border-slate-400/70'
                }`}
              >
                <span className="font-pixel text-[11px] sm:text-xs text-emerald-200">GAS</span>
                <span className="text-[9px] font-mono-tabular text-slate-300 mt-0.5">
                  D / → TILT
                </span>
              </button>
            </>
          )}

          {/* Briefing Overlay */}
          {phase === 'BRIEFING' && (
            <div className="absolute inset-0 bg-black/72 flex items-center justify-center p-4">
              <div className="pixel-panel-dark p-5 w-full max-w-lg space-y-4">
                <div className="font-pixel text-base text-cyan-300">
                  MISSION 2 · LUNAR HILL CLIMB TO FUEL BASE 02
                </div>
                <div className="flex items-start gap-3">
                  <AstronautPortrait speaking />
                  <p className="text-xs sm:text-sm text-stone-200 leading-relaxed bg-[#22262b] border border-[#464e58] p-3">
                    Climb <strong className="text-emerald-300">{GOAL_DISTANCE_METERS}m</strong> of
                    steep lunar hills to <strong className="text-amber-300">Lunar Fuel Base 02</strong>{' '}
                    for rocket fuel! Hold <strong className="text-emerald-300">GAS (D / →)</strong>{' '}
                    to power up slopes and tilt nose-up in mid-air; hold{' '}
                    <strong className="text-rose-300">BRAKE (A / ←)</strong> to level landings.
                    Grab cyan Battery Cells &amp; land flips for extra power!
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] font-mono-tabular text-stone-400">
                    DON&apos;T FLIP ON YOUR HELMET · COLLECT +PWR CELLS
                  </span>
                  <button
                    type="button"
                    onClick={resetDrive}
                    className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
                  >
                    START CLIMB
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 bg-black/68 flex items-center justify-center p-4">
              <div className="pixel-panel-dark p-5 w-full max-w-sm text-center space-y-4">
                <h3 className="font-pixel text-lg text-[#e8cf79]">Climb Paused</h3>
                <p className="text-xs text-stone-300 font-mono-tabular">
                  Distance: {hud.distanceMeters} / {GOAL_DISTANCE_METERS}m · Battery: {hud.battery}%
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      setDrivePhase('DRIVING');
                    }}
                    className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={resetDrive}
                    className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Restart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lost Overlay */}
          {phase === 'LOST' && (
            <div className="absolute inset-0 bg-black/72 flex items-center justify-center p-4">
              <div className="pixel-panel-dark p-5 w-full max-w-md space-y-4 text-center">
                <h3 className="font-pixel text-lg text-rose-400">
                  {hud.loseReason === 'flipped' ? 'ROVER FLIPPED!' : 'BATTERY DEPLETED'}
                </h3>
                <p className="text-xs text-stone-300">
                  {hud.loseReason === 'flipped'
                    ? 'You landed upside-down on the lunar hills! Use GAS and BRAKE mid-air to level your wheels before touchdown.'
                    : 'Your rover ran out of charge before reaching Lunar Fuel Base 02. Hit hilltops to collect cyan Battery Cells!'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={resetDrive}
                    className="pixel-btn bg-amber-600 hover:bg-amber-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      onExitToMoon();
                    }}
                    className="pixel-btn bg-[#434952] hover:bg-[#535a65] text-stone-100 font-pixel text-xs px-4 py-2.5 cursor-pointer"
                  >
                    RETURN TO MOON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Victory Overlay */}
          {phase === 'WON' && (
            <div className="absolute inset-0 bg-black/74 flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ scale: 0.94, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                className="pixel-panel-dark p-5 w-full max-w-lg space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-pixel text-base sm:text-xl text-emerald-400">
                      ROCKET FUEL SECURED!
                    </h3>
                    <p className="font-mono-tabular text-xs font-bold text-amber-300 mt-0.5">
                      ARRIVED AT LUNAR FUEL BASE 02 · {hud.flips} STUNT FLIPS
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AstronautPortrait speaking />
                  <div className="bg-[#22262b] border-2 border-[#4d5560] p-3.5 text-xs sm:text-sm text-stone-100 leading-relaxed">
                    Awesome lunar hill climbing! We loaded the cryogenic Rocket Fuel tanks from
                    Fuel Base 02. Let&apos;s bring this fuel back to the Ares IV Spacecraft and
                    fly home to Earth!
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      onMissionSuccess();
                    }}
                    className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
                  >
                    RETURN TO ROCKET
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer Strip */}
        <div className="bg-[#262a2f] border-t-2 border-[#15171a] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300">
          <span>
            Climb {GOAL_DISTANCE_METERS}m across lunar hills to Lunar Fuel Base 02. Land flips &amp; grab Battery Cells to stay charged.
          </span>
          <span className="font-mono-tabular text-amber-300 font-semibold">
            D / → GAS (AIR NOSE UP) · A / ← BRAKE (AIR NOSE DOWN)
          </span>
        </div>
      </motion.div>
    </div>
  );
};
