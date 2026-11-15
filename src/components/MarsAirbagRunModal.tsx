import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Pause, Play, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { soundFX } from '../game/audio';
import { AstronautPortrait } from './PathfinderDialogueModal';

interface MarsAirbagRunModalProps {
  isPracticeMode?: boolean;
  onMissionSuccess: () => void;
  onExitToMars: () => void;
}

type RunnerPhase = 'RUNNING' | 'PAUSED' | 'WON' | 'LOST';
type ObstacleKind = 'rock' | 'crater' | 'debris' | 'metal';

interface Obstacle {
  id: number;
  x: number;
  w: number;
  h: number;
  kind: ObstacleKind;
  variant: number;
}

interface CollectibleAirbag {
  id: number;
  x: number;
  y: number;
  baseY: number;
  r: number;
  phase: number;
  collected: boolean;
}

interface RunnerParticle {
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
const GROUND_BASE_Y = 290;
const TARGET_AIRBAGS = 10;

function getTerrainHeightOffset(worldDist: number): number {
  return (
    Math.sin(worldDist * 0.011) * 4 +
    Math.sin(worldDist * 0.031) * 2
  );
}

/** Draws a Mars Pathfinder multi-lobed cream airbag collectible with dark harness straps and fabric texture */
function drawPathfinderAirbag(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Subtle golden beacon aura around collectible airbags
  const grad = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.65);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.42)');
  grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.65, 0, Math.PI * 2);
  ctx.fill();

  const lobePositions = [
    { x: 0, y: -radius * 0.46, r: radius * 0.52 },
    { x: -radius * 0.46, y: -radius * 0.12, r: radius * 0.5 },
    { x: radius * 0.46, y: -radius * 0.12, r: radius * 0.5 },
    { x: -radius * 0.32, y: radius * 0.38, r: radius * 0.5 },
    { x: radius * 0.32, y: radius * 0.38, r: radius * 0.5 },
  ];

  // Outer dark fabric outline
  ctx.fillStyle = '#3c322b';
  for (const l of lobePositions) {
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cream Vectran airbag fabric lobes
  for (const l of lobePositions) {
    ctx.fillStyle = '#d7c7a3';
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5edd6';
    ctx.beginPath();
    ctx.arc(l.x - l.r * 0.22, l.y - l.r * 0.22, l.r * 0.66, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(130, 108, 78, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r * 0.7, -0.7, 1.4);
    ctx.stroke();
  }

  // Central core lobe
  const centerR = radius * 0.46;
  ctx.fillStyle = '#eadec0';
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#faf5e6';
  ctx.beginPath();
  ctx.arc(-centerR * 0.2, -centerR * 0.2, centerR * 0.58, 0, Math.PI * 2);
  ctx.fill();

  // Dark tension straps
  ctx.strokeStyle = '#38302a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const l of lobePositions) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(l.x * 1.12, l.y * 1.12);
    ctx.stroke();
  }

  // Central restraint hub
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Draws the player's astronaut character running/jumping rightwards in Mars EVA suit */
function drawRunningAstronaut(
  ctx: CanvasRenderingContext2D,
  cx: number,
  feetY: number,
  runCycle: number,
  grounded: boolean,
  squashX: number,
  squashY: number,
  won: boolean
) {
  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(squashX, squashY);

  const stride = grounded ? Math.sin(runCycle) : 0.75;
  const bob = grounded ? Math.abs(Math.cos(runCycle)) * -3 : 0;
  const lean = won ? 0 : grounded ? 0.08 : -0.06;
  ctx.rotate(lean);

  // Back arm (behind torso)
  ctx.save();
  ctx.translate(0, -28 + bob);
  ctx.rotate(-stride * 0.65);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-3, 0, 6, 12);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-2, 1, 4, 9);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-2.5, 10, 5, 4); // glove
  ctx.restore();

  // Back leg
  ctx.save();
  ctx.translate(-1, -15 + bob);
  ctx.rotate(-stride * 0.75);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-3.5, 0, 7, 11);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-3.5, 10, 9, 5); // boot
  ctx.restore();

  // PLSS Life-Support Backpack (left/rear side of astronaut)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-15, -34 + bob, 9, 18);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-14, -33 + bob, 7, 16);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-13, -31 + bob, 5, 4);
  // Small antenna on backpack
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-12, -41 + bob, 2, 7);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-12, -42 + bob, 2, 2);

  // Front leg
  ctx.save();
  ctx.translate(2, -15 + bob);
  ctx.rotate(stride * 0.75);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-4, -1, 8, 13);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-3, 0, 6, 10);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-3, 6, 6, 2); // knee trim
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-3, 10, 10, 5); // boot
  ctx.restore();

  // Main NASA White EVA Torso + Mission Orange Trim
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-8, -33 + bob, 16, 19);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-7, -32 + bob, 14, 17);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-7, -30 + bob, 14, 3);
  // Chest life-support control module
  ctx.fillStyle = '#475569';
  ctx.fillRect(-2, -26 + bob, 8, 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, -24 + bob, 2, 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(3, -24 + bob, 2, 2);

  // Helmet & Gold-Tinted Reflective Visor (facing right)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-9, -49 + bob, 19, 17);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-8, -48 + bob, 17, 15);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-6, -49 + bob, 13, 2);
  // Gold visor
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, -45 + bob, 9, 9);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(1, -44 + bob, 7, 7);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(2, -44 + bob, 4, 2);

  // Front arm (in front of torso)
  ctx.save();
  ctx.translate(1, -28 + bob);
  ctx.rotate(won ? -2.4 : stride * 0.65);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-3.5, -1, 7, 13);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-2.5, 0, 5, 10);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-2.5, 7, 5, 2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-2.5, 10, 5, 4); // glove
  ctx.restore();

  ctx.restore();
}

export const MarsAirbagRunModal: React.FC<MarsAirbagRunModalProps> = ({
  isPracticeMode = false,
  onMissionSuccess,
  onExitToMars,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<RunnerPhase>('RUNNING');
  const phaseRef = useRef<RunnerPhase>('RUNNING');

  const [hudState, setHudState] = useState({
    airbags: 0,
    distance: 0,
    score: 0,
  });

  // Mutable simulation state inside ref for 60fps loop
  const simRef = useRef({
    playerX: 128,
    playerFeetY: GROUND_BASE_Y,
    playerVy: 0,
    playerHalfW: 11,
    playerHeight: 46,
    runCycle: 0,
    squashX: 1,
    squashY: 1,
    grounded: true,
    jumpBuffer: 0,
    speed: 320,
    distancePx: 0,
    score: 0,
    airbags: 0,
    nextEntityId: 1,
    obstacleCooldown: 1.05,
    collectibleCooldown: 0.75,
    obstacles: [] as Obstacle[],
    collectibles: [] as CollectibleAirbag[],
    particles: [] as RunnerParticle[],
    dustMotes: Array.from({ length: 28 }, (_, i) => ({
      x: (i * 41) % LOGICAL_W,
      y: 30 + ((i * 53) % (GROUND_BASE_Y - 40)),
      w: 2 + (i % 4) * 2,
      s: 0.4 + (i % 5) * 0.25,
    })),
    uiTimer: 0,
  });

  const setRunnerPhase = useCallback((next: RunnerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const resetRun = useCallback(() => {
    const sim = simRef.current;
    sim.playerFeetY = GROUND_BASE_Y;
    sim.playerVy = 0;
    sim.runCycle = 0;
    sim.squashX = 1;
    sim.squashY = 1;
    sim.grounded = true;
    sim.jumpBuffer = 0;
    sim.speed = 320;
    sim.distancePx = 0;
    sim.score = 0;
    sim.airbags = 0;
    sim.obstacleCooldown = 1.0;
    sim.collectibleCooldown = 0.65;
    sim.obstacles = [];
    sim.collectibles = [];
    sim.particles = [];
    sim.uiTimer = 0;

    setHudState({ airbags: 0, distance: 0, score: 0 });
    setRunnerPhase('RUNNING');
    soundFX.playUiClick();
  }, [setRunnerPhase]);

  const triggerJump = useCallback(() => {
    if (phaseRef.current !== 'RUNNING') return;
    const sim = simRef.current;
    sim.jumpBuffer = 0.14;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          triggerJump();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (phaseRef.current === 'RUNNING') {
          setRunnerPhase('PAUSED');
        } else if (phaseRef.current === 'PAUSED') {
          setRunnerPhase('RUNNING');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [triggerJump, setRunnerPhase]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.035, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;

      const sim = simRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === 'RUNNING') {
        // Gradually ramp runner speed
        sim.speed = Math.min(560, 320 + sim.distancePx * 0.015);
        const dx = sim.speed * dt;
        sim.distancePx += dx;
        sim.score += dx * 0.12;

        const terrainY = GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + sim.playerX);

        // Jump execution via jump buffer
        if (sim.jumpBuffer > 0) {
          sim.jumpBuffer -= dt;
          if (sim.grounded) {
            sim.playerVy = -620;
            sim.grounded = false;
            sim.jumpBuffer = 0;
            sim.squashX = 0.86;
            sim.squashY = 1.15;
            soundFX.playJump();

            for (let i = 0; i < 6; i++) {
              sim.particles.push({
                x: sim.playerX - 6 + Math.random() * 12,
                y: terrainY - 2,
                vx: -80 - Math.random() * 80,
                vy: -20 - Math.random() * 45,
                life: 0.35,
                maxLife: 0.35,
                size: 3 + Math.random() * 2,
                color: '#d97745',
              });
            }
          }
        }

        // Gravity & vertical integration
        if (!sim.grounded) {
          sim.playerVy += 1560 * dt;
          sim.playerFeetY += sim.playerVy * dt;

          if (sim.playerFeetY >= terrainY) {
            sim.playerFeetY = terrainY;
            sim.playerVy = 0;
            sim.grounded = true;
            sim.squashX = 1.18;
            sim.squashY = 0.84;
            soundFX.playLandingThud();

            // Dust kick-up on landing
            for (let i = 0; i < 5; i++) {
              sim.particles.push({
                x: sim.playerX + (Math.random() - 0.5) * 14,
                y: terrainY - 1,
                vx: -90 - Math.random() * 70,
                vy: -15 - Math.random() * 35,
                life: 0.3,
                maxLife: 0.3,
                size: 3,
                color: '#c25e34',
              });
            }
          }
        } else {
          // Grounded astronaut running stride
          sim.playerFeetY = terrainY;
          sim.runCycle += (sim.speed / 26) * dt;
        }

        // Recover squash & stretch smoothly
        sim.squashX += (1 - sim.squashX) * Math.min(1, dt * 14);
        sim.squashY += (1 - sim.squashY) * Math.min(1, dt * 14);

        // Spawn obstacles
        sim.obstacleCooldown -= dt;
        if (sim.obstacleCooldown <= 0) {
          const kinds: ObstacleKind[] = ['rock', 'crater', 'debris', 'metal'];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          let w = 32;
          let h = 34;
          if (kind === 'rock') {
            w = 28 + Math.floor(Math.random() * 14);
            h = 30 + Math.floor(Math.random() * 16);
          } else if (kind === 'crater') {
            w = 48 + Math.floor(Math.random() * 18);
            h = 16;
          } else if (kind === 'debris') {
            w = 38;
            h = 34;
          } else {
            w = 28;
            h = 38;
          }

          sim.nextEntityId += 1;
          sim.obstacles.push({
            id: sim.nextEntityId,
            x: LOGICAL_W + 40,
            w,
            h,
            kind,
            variant: Math.floor(Math.random() * 3),
          });

          const speedFactor = 320 / sim.speed;
          sim.obstacleCooldown = (1.15 + Math.random() * 0.85) * speedFactor;
        }

        // Spawn collectible smaller airbags
        sim.collectibleCooldown -= dt;
        if (sim.collectibleCooldown <= 0) {
          const spawnX = LOGICAL_W + 60;
          // Avoid spawning directly inside an obstacle's ground column unless high enough to arc over
          const overlappingObs = sim.obstacles.find(
            (o) => Math.abs(o.x + o.w / 2 - spawnX) < 55
          );
          const heightTier = overlappingObs
            ? 92 + Math.random() * 28
            : Math.random() < 0.45
            ? 32
            : 82 + Math.random() * 36;

          const baseY = GROUND_BASE_Y - heightTier;
          sim.nextEntityId += 1;
          sim.collectibles.push({
            id: sim.nextEntityId,
            x: spawnX,
            y: baseY,
            baseY,
            r: 15,
            phase: Math.random() * Math.PI * 2,
            collected: false,
          });

          const speedFactor = 320 / sim.speed;
          sim.collectibleCooldown = (1.35 + Math.random() * 0.75) * speedFactor;
        }

        // Move & check collisions for obstacles against running astronaut AABB
        const playerLeft = sim.playerX - sim.playerHalfW + 2;
        const playerRight = sim.playerX + sim.playerHalfW - 2;
        const playerTop = sim.playerFeetY - sim.playerHeight + 6;
        const playerBottom = sim.playerFeetY - 2;
        const playerCenterY = sim.playerFeetY - sim.playerHeight / 2;

        for (let i = sim.obstacles.length - 1; i >= 0; i--) {
          const obs = sim.obstacles[i];
          obs.x -= dx;

          const obsGroundY =
            GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + obs.x + obs.w / 2);

          // Forgiving hitbox check
          const obsLeft = obs.x + 6;
          const obsRight = obs.x + obs.w - 6;
          const obsTop =
            obs.kind === 'crater' ? obsGroundY - 6 : obsGroundY - obs.h + 7;
          const obsBottom = obsGroundY + 8;

          const overlaps =
            playerRight > obsLeft &&
            playerLeft < obsRight &&
            playerBottom > obsTop &&
            playerTop < obsBottom;

          if (overlaps) {
            soundFX.playImpact();
            for (let k = 0; k < 18; k++) {
              const ang = (Math.PI * 2 * k) / 18;
              sim.particles.push({
                x: sim.playerX,
                y: playerCenterY,
                vx: Math.cos(ang) * (70 + Math.random() * 110),
                vy: Math.sin(ang) * (70 + Math.random() * 110) - 40,
                life: 0.55,
                maxLife: 0.55,
                size: 4,
                color: k % 2 === 0 ? '#f87171' : '#f8fafc',
              });
            }
            setHudState({
              airbags: sim.airbags,
              distance: Math.floor(sim.distancePx / 12),
              score: Math.floor(sim.score),
            });
            setRunnerPhase('LOST');
            break;
          }

          if (obs.x + obs.w < -60) {
            sim.obstacles.splice(i, 1);
          }
        }

        // Move & collect airbags
        if (phaseRef.current === 'RUNNING') {
          for (let i = sim.collectibles.length - 1; i >= 0; i--) {
            const c = sim.collectibles[i];
            c.x -= dx;
            c.y = c.baseY + Math.sin(timeSec * 5 + c.phase) * 5;

            const closestX = Math.max(playerLeft - 5, Math.min(c.x, playerRight + 5));
            const closestY = Math.max(playerTop - 4, Math.min(c.y, playerBottom + 4));
            const dist = Math.hypot(c.x - closestX, c.y - closestY);

            if (!c.collected && dist < c.r + 4) {
              c.collected = true;
              sim.airbags += 1;
              sim.score += 150;
              soundFX.playAirbagCollect();

              // Burst particles + floating +1 text
              for (let k = 0; k < 12; k++) {
                const ang = (Math.PI * 2 * k) / 12;
                sim.particles.push({
                  x: c.x,
                  y: c.y,
                  vx: Math.cos(ang) * (50 + Math.random() * 70),
                  vy: Math.sin(ang) * (50 + Math.random() * 70),
                  life: 0.45,
                  maxLife: 0.45,
                  size: 3.5,
                  color: k % 2 === 0 ? '#fde047' : '#f5edd6',
                });
              }
              sim.particles.push({
                x: c.x,
                y: c.y - 12,
                vx: 0,
                vy: -36,
                life: 0.85,
                maxLife: 0.85,
                size: 1,
                color: '#fde047',
                text: `${sim.airbags}/${TARGET_AIRBAGS}`,
              });

              sim.collectibles.splice(i, 1);

              if (sim.airbags >= TARGET_AIRBAGS) {
                soundFX.playMissionComplete();
                for (let k = 0; k < 30; k++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 60 + Math.random() * 140;
                  sim.particles.push({
                    x: sim.playerX,
                    y: playerCenterY,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 60,
                    life: 1.0,
                    maxLife: 1.0,
                    size: 4,
                    color: ['#fde047', '#38bdf8', '#4ade80', '#f5edd6'][k % 4],
                  });
                }
                setHudState({
                  airbags: TARGET_AIRBAGS,
                  distance: Math.floor(sim.distancePx / 12),
                  score: Math.floor(sim.score),
                });
                setRunnerPhase('WON');
                break;
              }
            } else if (c.x < -50) {
              sim.collectibles.splice(i, 1);
            }
          }
        }

        // Ambient dust motes
        for (const m of sim.dustMotes) {
          m.x -= dx * m.s * 0.45;
          if (m.x < -20) m.x = LOGICAL_W + 20;
        }

        sim.uiTimer += dt;
        if (sim.uiTimer >= 0.08 && phaseRef.current === 'RUNNING') {
          sim.uiTimer = 0;
          setHudState({
            airbags: sim.airbags,
            distance: Math.floor(sim.distancePx / 12),
            score: Math.floor(sim.score),
          });
        }
      }

      // Update particles even after win/loss for celebratory/impact bursts
      if (currentPhase !== 'PAUSED') {
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) {
            sim.particles.splice(i, 1);
          }
        }
      }

      // Render Mars Airbag Run Canvas
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

          // 1. Martian Sky Gradient
          const sky = ctx.createLinearGradient(0, 0, 0, GROUND_BASE_Y);
          sky.addColorStop(0, '#36130e');
          sky.addColorStop(0.55, '#7c2f1b');
          sky.addColorStop(1, '#cf6437');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

          // Pale Martian sun + dusty halo
          ctx.fillStyle = 'rgba(254, 215, 170, 0.16)';
          ctx.beginPath();
          ctx.arc(680, 74, 42, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fde6c4';
          ctx.beginPath();
          ctx.arc(680, 74, 16, 0, Math.PI * 2);
          ctx.fill();

          // 2. Parallax Distant Martian Mountains (Layer 1)
          const farOffset = (sim.distancePx * 0.12) % LOGICAL_W;
          ctx.fillStyle = '#5a2115';
          for (let rep = 0; rep < 2; rep++) {
            const bx = rep * LOGICAL_W - farOffset;
            ctx.beginPath();
            ctx.moveTo(bx, GROUND_BASE_Y);
            const peaks = [
              [0, 210],
              [90, 165],
              [190, 196],
              [300, 148],
              [420, 190],
              [540, 156],
              [660, 200],
              [760, 162],
              [840, 210],
            ];
            for (const [px, py] of peaks) {
              ctx.lineTo(bx + px, py);
            }
            ctx.lineTo(bx + LOGICAL_W, GROUND_BASE_Y);
            ctx.closePath();
            ctx.fill();
          }

          // 3. Parallax Mid-ground Mesas (Layer 2)
          const midOffset = (sim.distancePx * 0.28) % LOGICAL_W;
          ctx.fillStyle = '#732b1a';
          for (let rep = 0; rep < 2; rep++) {
            const bx = rep * LOGICAL_W - midOffset;
            ctx.beginPath();
            ctx.moveTo(bx, GROUND_BASE_Y);
            const ridges = [
              [0, 240],
              [70, 220],
              [120, 220],
              [170, 244],
              [280, 214],
              [350, 214],
              [410, 242],
              [520, 224],
              [585, 224],
              [650, 248],
              [760, 222],
              [840, 240],
            ];
            for (const [px, py] of ridges) {
              ctx.lineTo(bx + px, py);
            }
            ctx.lineTo(bx + LOGICAL_W, GROUND_BASE_Y);
            ctx.closePath();
            ctx.fill();
          }

          // 4. Uneven Martian Desert Floor
          ctx.fillStyle = '#9c4324';
          ctx.beginPath();
          ctx.moveTo(0, LOGICAL_H);
          for (let sx = 0; sx <= LOGICAL_W; sx += 12) {
            const gy = GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + sx);
            ctx.lineTo(sx, gy);
          }
          ctx.lineTo(LOGICAL_W, LOGICAL_H);
          ctx.closePath();
          ctx.fill();

          // Upper sun-lit regolith crust
          ctx.strokeStyle = '#d47447';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let sx = 0; sx <= LOGICAL_W; sx += 12) {
            const gy = GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + sx);
            if (sx === 0) ctx.moveTo(sx, gy);
            else ctx.lineTo(sx, gy);
          }
          ctx.stroke();

          // Sub-surface Martian pebbles & strata lines
          ctx.fillStyle = '#6d2a16';
          for (let i = 0; i < 24; i++) {
            const px = ((i * 89 - sim.distancePx) % (LOGICAL_W + 40) + LOGICAL_W + 40) % (LOGICAL_W + 40) - 20;
            const py = GROUND_BASE_Y + 14 + ((i * 19) % 44);
            ctx.fillRect(px, py, 5 + (i % 4) * 3, 2);
          }

          // 5. Obstacles (Rocks, Craters, Spacecraft Debris, Metal Fragments)
          for (const obs of sim.obstacles) {
            const gy = GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + obs.x + obs.w / 2);
            if (obs.kind === 'rock') {
              ctx.fillStyle = '#471a11';
              ctx.beginPath();
              ctx.moveTo(obs.x, gy + 3);
              ctx.lineTo(obs.x + obs.w * 0.25, gy - obs.h * 0.8);
              ctx.lineTo(obs.x + obs.w * 0.62, gy - obs.h);
              ctx.lineTo(obs.x + obs.w, gy + 3);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#6e2c1a';
              ctx.beginPath();
              ctx.moveTo(obs.x + 3, gy + 2);
              ctx.lineTo(obs.x + obs.w * 0.28, gy - obs.h * 0.72);
              ctx.lineTo(obs.x + obs.w * 0.56, gy - obs.h * 0.85);
              ctx.lineTo(obs.x + obs.w * 0.6, gy + 2);
              ctx.closePath();
              ctx.fill();
            } else if (obs.kind === 'crater') {
              // Raised crater rim
              ctx.fillStyle = '#b95c36';
              ctx.beginPath();
              ctx.ellipse(obs.x + obs.w / 2, gy + 2, obs.w / 2 + 4, 7, 0, 0, Math.PI * 2);
              ctx.fill();
              // Dark recessed crater pit
              ctx.fillStyle = '#3b160e';
              ctx.beginPath();
              ctx.ellipse(obs.x + obs.w / 2, gy + 3, obs.w / 2 - 2, 5, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(obs.x + obs.w / 2, gy + 2, obs.w / 2 + 1, 5.5, 0, Math.PI, Math.PI * 2);
              ctx.stroke();
            } else if (obs.kind === 'debris') {
              // Broken spacecraft hull debris
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(obs.x + 4, gy - obs.h + 6, obs.w - 8, obs.h - 4);
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(obs.x + 6, gy - obs.h + 8, obs.w - 12, obs.h - 10);
              ctx.fillStyle = '#ea580c';
              ctx.fillRect(obs.x + 6, gy - obs.h + 15, obs.w - 12, 5);
              // Jagged strut
              ctx.strokeStyle = '#64748b';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(obs.x + 2, gy + 2);
              ctx.lineTo(obs.x + 12, gy - obs.h);
              ctx.moveTo(obs.x + obs.w - 4, gy + 2);
              ctx.lineTo(obs.x + obs.w - 10, gy - obs.h + 4);
              ctx.stroke();
            } else {
              // Sharp metallic fragments
              ctx.fillStyle = '#334155';
              ctx.beginPath();
              ctx.moveTo(obs.x + 2, gy + 2);
              ctx.lineTo(obs.x + obs.w * 0.35, gy - obs.h);
              ctx.lineTo(obs.x + obs.w * 0.7, gy - obs.h * 0.45);
              ctx.lineTo(obs.x + obs.w, gy + 2);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#94a3b8';
              ctx.beginPath();
              ctx.moveTo(obs.x + 6, gy + 2);
              ctx.lineTo(obs.x + obs.w * 0.36, gy - obs.h + 5);
              ctx.lineTo(obs.x + obs.w * 0.55, gy + 2);
              ctx.closePath();
              ctx.fill();
            }
          }

          // 6. Collectible Inflatable Pathfinder Airbags
          for (const c of sim.collectibles) {
            drawPathfinderAirbag(ctx, c.x, c.y, c.r, Math.sin(timeSec * 2 + c.phase) * 0.25);
          }

          // 7. Running Astronaut Player
          const victoryHop =
            currentPhase === 'WON' ? Math.abs(Math.sin(timeSec * 8)) * 18 : 0;
          const groundYAtPlayer = GROUND_BASE_Y + getTerrainHeightOffset(sim.distancePx + sim.playerX);
          const heightAboveGround = Math.max(0, groundYAtPlayer - (sim.playerFeetY - victoryHop));
          const shadowScale = Math.max(0.4, 1 - heightAboveGround / 180);

          ctx.fillStyle = 'rgba(20, 8, 5, 0.35)';
          ctx.beginPath();
          ctx.ellipse(
            sim.playerX,
            groundYAtPlayer + 3,
            14 * shadowScale,
            4.5 * shadowScale,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          drawRunningAstronaut(
            ctx,
            sim.playerX,
            sim.playerFeetY - victoryHop,
            sim.runCycle,
            sim.grounded && currentPhase !== 'WON',
            sim.squashX,
            sim.squashY,
            currentPhase === 'WON'
          );

          // 8. Ambient Dust Motes & Burst Particles
          ctx.fillStyle = 'rgba(244, 172, 128, 0.28)';
          for (const m of sim.dustMotes) {
            ctx.fillRect(m.x, m.y, m.w, 1.5);
          }

          for (const p of sim.particles) {
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            ctx.save();
            ctx.globalAlpha = alpha;
            if (p.text) {
              ctx.font = 'bold 13px "Silkscreen", monospace';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#1b0d0a';
              ctx.fillText(p.text, p.x + 1, p.y + 1);
              ctx.fillStyle = p.color;
              ctx.fillText(p.text, p.x, p.y);
            } else {
              ctx.fillStyle = p.color;
              ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.restore();
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [setRunnerPhase]);

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="pixel-panel-dark w-full max-w-[min(96vw,1152px,calc((100dvh-136px)*7/3))] max-h-[96dvh] flex flex-col overflow-hidden text-stone-100"
      >
        {/* Top Mini-Game Bar */}
        <div className="bg-[#343940] border-b-2 border-[#15171a] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel text-sm sm:text-base text-[#e8cf79]">
              MARS AIRBAG RUN
            </h2>
            {isPracticeMode && (
              <span className="text-[11px] font-mono-tabular text-sky-300">
                Practice Mode
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
            <div className="flex items-center gap-2">
              <span className="text-stone-300">Airbags:</span>
              <span className="font-bold text-amber-300">
                {hudState.airbags} / {TARGET_AIRBAGS}
              </span>
              <div className="hidden sm:flex items-center gap-0.5">
                {Array.from({ length: TARGET_AIRBAGS }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-2 h-3 border border-[#181a1d] ${
                      idx < hudState.airbags ? 'bg-amber-300' : 'bg-[#202328]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <span className="text-stone-300">
              Dist: <strong className="text-stone-100">{hudState.distance}m</strong>
            </span>
            <span className="text-stone-300">
              Score: <strong className="text-emerald-300">{hudState.score}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {(phase === 'RUNNING' || phase === 'PAUSED') && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playUiClick();
                  setRunnerPhase(phase === 'RUNNING' ? 'PAUSED' : 'RUNNING');
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
              onClick={resetRun}
              title="Restart Mars Airbag Run"
              className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restart</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                onExitToMars();
              }}
              aria-label="Exit to Mars"
              className="pixel-btn bg-[#4a5059] hover:bg-[#5a616b] p-1.5 text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Game Viewport */}
        <div className="relative w-full aspect-[7/3] bg-[#2a100c] select-none overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              e.preventDefault();
              triggerJump();
            }}
            className="w-full h-full block cursor-pointer touch-none"
          />

          {/* Pause Overlay */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center p-4">
              <div className="pixel-panel-dark p-5 w-full max-w-sm text-center space-y-4">
                <h3 className="font-pixel text-lg text-[#e8cf79]">Run Paused</h3>
                <p className="text-xs text-stone-300 font-mono-tabular">
                  Airbags Collected: {hudState.airbags} / {TARGET_AIRBAGS} · Distance: {hudState.distance}m
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      setRunnerPhase('RUNNING');
                    }}
                    className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={resetRun}
                    className="pixel-btn bg-[#464d57] hover:bg-[#565e6a] text-stone-100 px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Restart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mission Interrupted (Loss) Overlay */}
          {phase === 'LOST' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/70 flex items-center justify-center p-4"
            >
              <div className="pixel-panel-dark p-5 sm:p-6 w-full max-w-md space-y-4 text-center">
                <div>
                  <h3 className="font-pixel text-lg sm:text-xl text-rose-400">
                    MISSION INTERRUPTED
                  </h3>
                  <p className="text-xs text-stone-300 mt-1.5">
                    You collided with a Martian surface hazard before recovering all 10 airbags.
                  </p>
                </div>

                <div className="bg-[#22262b] border border-[#3e434a] p-3 grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                  <div>
                    <div className="text-stone-400">Airbags</div>
                    <div className="font-bold text-amber-300 text-sm">
                      {hudState.airbags} / {TARGET_AIRBAGS}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-400">Distance</div>
                    <div className="font-bold text-stone-100 text-sm">{hudState.distance}m</div>
                  </div>
                  <div>
                    <div className="text-stone-400">Score</div>
                    <div className="font-bold text-emerald-300 text-sm">{hudState.score}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resetRun}
                    className="pixel-btn bg-amber-600 hover:bg-amber-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      onExitToMars();
                    }}
                    className="pixel-btn bg-[#434952] hover:bg-[#535a65] text-stone-100 font-pixel text-xs px-4 py-2.5 cursor-pointer"
                  >
                    RETURN TO MARS
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Mission Accomplished (Victory) Overlay */}
          {phase === 'WON' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/72 flex items-center justify-center p-3 sm:p-4"
            >
              <motion.div
                initial={{ scale: 0.94, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                className="pixel-panel-dark p-4 sm:p-6 w-full max-w-lg space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-pixel text-base sm:text-xl text-emerald-400">
                      MISSION ACCOMPLISHED!
                    </h3>
                    <p className="font-mono-tabular text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                      10 AIRBAGS SUCCESSFULLY RECOVERED
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AstronautPortrait speaking />
                  <div className="relative flex-1 bg-[#22262b] border-2 border-[#4d5560] p-3.5 text-xs sm:text-sm text-stone-100 leading-relaxed">
                    <div className="absolute -left-2 top-5 w-3 h-3 bg-[#22262b] border-l-2 border-b-2 border-[#4d5560] rotate-45" />
                    Excellent! We have recovered all the airbag components we need. Let&apos;s get back to the rocket and put them to use!
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-mono-tabular text-stone-400">
                    Distance {hudState.distance}m · Score {hudState.score}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      onMissionSuccess();
                    }}
                    className="pixel-btn bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-xs px-5 py-2.5 cursor-pointer"
                  >
                    RETURN TO MARS
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Bottom Controls Strip */}
        <div className="bg-[#262a2f] border-t-2 border-[#15171a] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300">
          <span>
            Jump over Martian rocks, craters, and spacecraft debris while collecting 10 inflatable airbags.
          </span>
          <span className="font-mono-tabular text-amber-300 font-semibold">
            SPACE / UP ARROW / CLICK OR TAP TO JUMP
          </span>
        </div>
      </motion.div>
    </div>
  );
};
