import {
  CRASH_SAFE_RADIUS_PX,
  CRASH_SITE_POS,
  LUNAR_LANDING_PAD_POS,
  MAP_H,
  MAP_W,
  TILE_SIZE,
} from './mapData';
import {
  Particle,
  PlayerState,
  StructureEntity,
  SurvivalStats,
  TileType,
} from './types';

export interface RenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  zoom: number;
  camX: number;
  camY: number;
  time: number;
  tiles: TileType[][];
  structures: StructureEntity[];
  player: PlayerState;
  particles: Particle[];
  stats: SurvivalStats;
  nearestStructId: string | null;
}

function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function renderMarsScene(params: RenderParams) {
  const {
    ctx,
    width,
    height,
    zoom,
    camX,
    camY,
    time,
    tiles,
    structures,
    player,
    particles,
    stats,
    nearestStructId,
  } = params;

  const isMoon = stats.planet === 'moon';
  ctx.imageSmoothingEnabled = false;

  // Deep reddish Martian atmospheric sky OR pitch-black lunar space backdrop
  ctx.fillStyle = isMoon ? '#070b14' : '#29100e';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.scale(zoom, zoom);
  const offsetX = Math.round(width / (2 * zoom) - camX);
  const offsetY = Math.round(height / (2 * zoom) - camY);
  ctx.translate(offsetX, offsetY);

  const viewMinX = Math.max(0, Math.floor((camX - width / (2 * zoom)) / TILE_SIZE) - 2);
  const viewMaxX = Math.min(MAP_W - 1, Math.ceil((camX + width / (2 * zoom)) / TILE_SIZE) + 2);
  const viewMinY = Math.max(0, Math.floor((camY - height / (2 * zoom)) / TILE_SIZE) - 2);
  const viewMaxY = Math.min(MAP_H - 1, Math.ceil((camY + height / (2 * zoom)) / TILE_SIZE) + 2);

  // 1. Surface Tiles & Distant Horizons
  for (let ty = viewMinY; ty <= viewMaxY; ty++) {
    for (let tx = viewMinX; tx <= viewMaxX; tx++) {
      if (isMoon) {
        drawMoonTile(ctx, tiles, tx, ty, time);
      } else {
        drawMarsTile(ctx, tiles, tx, ty);
      }
    }
  }

  // Pixelated Earth hanging in the black lunar sky above the landing pad (Scene 04 homage)
  if (isMoon && viewMinY <= 4) {
    drawSkyEarth(ctx, 13 * TILE_SIZE, 16);
  }

  // 2. Subtle Safe-Zone Life-Support Perimeter Ring around Rocket
  const safeSite = isMoon ? LUNAR_LANDING_PAD_POS : CRASH_SITE_POS;
  const rcx = (safeSite.tx + safeSite.w / 2) * TILE_SIZE;
  const rcy = (safeSite.ty + safeSite.h / 2) * TILE_SIZE;
  ctx.save();
  ctx.strokeStyle = stats.inCrashSafeZone
    ? 'rgba(56, 189, 248, 0.35)'
    : 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(rcx, rcy, CRASH_SAFE_RADIUS_PX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Click-to-move waypoint target
  if (player.targetPoint) {
    const pulse = (Math.sin(time * 8) + 1) * 0.5;
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(player.targetPoint.x - 4),
      Math.round(player.targetPoint.y - 4),
      8,
      8
    );
  }

  // 3b. Power cable connecting RTG to Lunar Rover on Moon
  if (isMoon) {
    const rtg = structures.find((s) => s.type === 'lunar_rtg');
    const rover = structures.find((s) => s.type === 'lunar_rover');
    if (rtg && rover) {
      const rx = Math.round((rtg.tx + rtg.w / 2) * TILE_SIZE);
      const ry = Math.round((rtg.ty + rtg.h) * TILE_SIZE - 2);
      const vx = Math.round((rover.tx + rover.w / 2) * TILE_SIZE);
      const vy = Math.round(rover.ty * TILE_SIZE + 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(Math.min(rx, vx) - 1, ry, 4, Math.max(4, vy - ry));
      const pulseOn = stats.lunarMission.roverCharged && Math.sin(time * 8) > -0.2;
      ctx.fillStyle = stats.lunarMission.roverCharged
        ? pulseOn
          ? '#38bdf8'
          : '#0284c7'
        : '#475569';
      ctx.fillRect(Math.min(rx, vx), ry, 2, Math.max(4, vy - ry));
    }
  }

  // 4. Depth-sorted entities (structures + astronaut)
  type DrawItem = { sortY: number; draw: () => void };
  const drawList: DrawItem[] = [];

  for (const s of structures) {
    if (
      s.tx + s.w < viewMinX - 2 ||
      s.tx > viewMaxX + 2 ||
      s.ty + s.h < viewMinY - 2 ||
      s.ty > viewMaxY + 2
    ) {
      continue;
    }
    const bottomY = (s.ty + s.h) * TILE_SIZE;
    drawList.push({
      sortY: bottomY,
      draw: () =>
        drawStructure(ctx, s, time, s.id === nearestStructId, stats),
    });
  }

  if (isMoon) {
    drawList.push({
      sortY: player.y + 4,
      draw: () => drawAstronautFlashlight(ctx, player),
    });
  }

  drawList.push({
    sortY: player.y + 5,
    draw: () => drawAstronaut(ctx, player, time),
  });

  drawList.sort((a, b) => a.sortY - b.sortY);
  for (const item of drawList) {
    item.draw();
  }

  // 5. Particles (smoke, sparks, dust, floating text)
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    if (p.kind === 'text' && p.text) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 5.5px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#120806';
      ctx.fillText(p.text, Math.round(p.x) + 0.5, Math.round(p.y) + 0.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = alpha * (p.kind === 'smoke' ? 0.55 : 0.88);
      ctx.fillStyle = p.color;
      const sz = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
      ctx.restore();
    }
  }

  // 6. Floating World Interaction Prompt above nearest landmark
  if (nearestStructId) {
    const ns = structures.find((s) => s.id === nearestStructId);
    if (ns) {
      const cx = Math.round((ns.tx + ns.w / 2) * TILE_SIZE);
      const cy = Math.round(ns.ty * TILE_SIZE - 8 + Math.sin(time * 5) * 1.2);
      const label =
        ns.type === 'apollo_plutonium'
          ? 'PRESS E TO COLLECT PU-238'
          : ns.type === 'minigame_rover' ||
            ns.type === 'lunar_rover' ||
            ns.type === 'lunar_rtg' ||
            ns.category === 'crash_site' ||
            ns.category === 'lunar_facility'
          ? 'PRESS E TO INTERACT'
          : ns.category === 'minigame_location'
          ? 'E: INSPECT'
          : 'E: SALVAGE';

      const boxW = label.length * 3.8 + 8;
      ctx.fillStyle = isMoon ? 'rgba(9, 13, 24, 0.92)' : 'rgba(18, 12, 11, 0.9)';
      ctx.fillRect(Math.round(cx - boxW / 2), cy - 6, Math.round(boxW), 7);
      ctx.strokeStyle =
        ns.category === 'crash_site'
          ? '#38bdf8'
          : ns.category === 'lunar_facility'
          ? '#94a3b8'
          : ns.category === 'minigame_location'
          ? '#fbbf24'
          : '#fb923c';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(Math.round(cx - boxW / 2), cy - 6, Math.round(boxW), 7);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 4.3px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy - 1);
    }
  }

  ctx.restore();

  // 7. Planetary Lighting & Atmospheric Particles (Screen Space)
  if (isMoon) {
    const lunarVignette = ctx.createLinearGradient(0, 0, 0, height);
    lunarVignette.addColorStop(0, 'rgba(5, 8, 18, 0.34)');
    lunarVignette.addColorStop(0.28, 'rgba(0, 0, 0, 0)');
    lunarVignette.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
    lunarVignette.addColorStop(1, 'rgba(8, 12, 22, 0.32)');
    ctx.fillStyle = lunarVignette;
    ctx.fillRect(0, 0, width, height);
  } else {
    const hazeGrad = ctx.createLinearGradient(0, 0, 0, height);
    hazeGrad.addColorStop(0, 'rgba(65, 22, 18, 0.28)');
    hazeGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0)');
    hazeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
    hazeGrad.addColorStop(1, 'rgba(38, 13, 10, 0.22)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient Martian dust motes
    ctx.fillStyle = stats.dustStormActive
      ? 'rgba(244, 162, 107, 0.25)'
      : 'rgba(235, 146, 98, 0.1)';
    const count = stats.dustStormActive ? 34 : 12;
    for (let i = 0; i < count; i++) {
      const speedMult = stats.dustStormActive ? 360 : 75;
      const wx = ((i * 211 + time * speedMult) % (width + 140)) - 70;
      const wy = ((i * 97 + time * (stats.dustStormActive ? 75 : 18)) % (height + 40)) - 20;
      ctx.fillRect(Math.round(wx), Math.round(wy), stats.dustStormActive ? 28 + (i % 3) * 14 : 3, 2);
    }

    if (stats.dustStormActive) {
      ctx.fillStyle = 'rgba(180, 74, 38, 0.16)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 8. Off-screen World Navigation Markers
  drawNavigationIndicators(ctx, width, height, zoom, camX, camY, structures);
}

function drawMarsTile(ctx: CanvasRenderingContext2D, tiles: TileType[][], tx: number, ty: number) {
  const t = tiles[ty][tx];
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  const n = hash2d(tx, ty);

  if (t === 'mountain_wall') {
    // Dark reddish Martian sky + jagged layered mountain ridge
    ctx.fillStyle = '#381512';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#5e2519';
    ctx.fillRect(px, py + 5, TILE_SIZE, TILE_SIZE - 5);
    ctx.fillStyle = '#7c3420';
    ctx.fillRect(px + (tx % 2) * 3, py + 3, 9, 4);
    ctx.fillStyle = '#471a13';
    ctx.fillRect(px + 2, py + 11, 11, 5);
    return;
  }

  if (t === 'ridge_rock') {
    ctx.fillStyle = '#8b3e24';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#6f2e19';
    ctx.fillRect(px + 2, py + 4, 12, 7);
    ctx.fillStyle = '#ab5334';
    ctx.fillRect(px + 3, py + 3, 9, 3);
    return;
  }

  if (t === 'crater_floor') {
    ctx.fillStyle = '#7e361e';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (n > 0.72) {
      ctx.fillStyle = '#6b2c17';
      ctx.fillRect(px + Math.floor(n * 10), py + 6, 3, 1);
    }
    return;
  }

  if (t === 'crater_rim') {
    ctx.fillStyle = '#b95f3a';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#cf744c';
    ctx.fillRect(px + 2, py + 2, 10, 2);
    ctx.fillStyle = '#8d3f24';
    ctx.fillRect(px + 1, py + 12, 12, 2);
    return;
  }

  if (t === 'scorch') {
    ctx.fillStyle = '#5a281a';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#3d1b12';
    ctx.fillRect(px + Math.floor(n * 7), py + 4, 7, 5);
    if (n > 0.5) {
      ctx.fillStyle = '#26110b';
      ctx.fillRect(px + 4, py + 8, 5, 2);
    }
    return;
  }

  // Default: vast red-orange Martian regolith with subtle wind ripples & pebbles
  ctx.fillStyle = '#a24c2c';
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  if (n > 0.75) {
    ctx.fillStyle = '#8e3e22';
    ctx.fillRect(px + Math.floor(n * 10), py + 5, 3, 1);
    ctx.fillRect(px + 2, py + Math.floor(n * 11), 2, 1);
  } else if (n < 0.18) {
    ctx.fillStyle = '#ba603d';
    ctx.fillRect(px + 4, py + 10, 4, 1);
  }
}

function drawMoonTile(
  ctx: CanvasRenderingContext2D,
  tiles: TileType[][],
  tx: number,
  ty: number,
  time: number
) {
  const t = tiles[ty][tx];
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  const n = hash2d(tx, ty);

  if (t === 'lunar_horizon') {
    // Deep black space + twinkling stars + distant slate-grey lunar ridge silhouettes (Scene 04)
    ctx.fillStyle = '#070b14';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (n > 0.58) {
      const twinkle = 0.45 + 0.55 * Math.sin(time * 2.2 + n * 19);
      ctx.fillStyle = `rgba(226, 232, 240, ${twinkle.toFixed(2)})`;
      ctx.fillRect(px + Math.floor(n * 13), py + Math.floor(((n * 37) % 1) * 11), 1, 1);
    }
    if (n > 0.92) {
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(px + 5, py + 4, 2, 2);
    }
    // Lower horizon stepped dark grey hills
    const belowIsGround =
      ty + 1 < tiles.length && tiles[ty + 1][tx] !== 'lunar_horizon';
    if (belowIsGround) {
      ctx.fillStyle = '#1f2531';
      ctx.fillRect(px, py + 9, TILE_SIZE, 7);
      ctx.fillStyle = '#2c3342';
      ctx.fillRect(px + (tx % 2) * 3, py + 11, 10, 5);
    }
    return;
  }

  if (t === 'lunar_ridge') {
    ctx.fillStyle = '#4c5463';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#383f4c';
    ctx.fillRect(px + 2, py + 4, 12, 8);
    ctx.fillStyle = '#7b8597';
    ctx.fillRect(px + 3, py + 2, 10, 3);
    return;
  }

  if (t === 'lunar_crater_floor') {
    ctx.fillStyle = '#404652';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (n > 0.72) {
      ctx.fillStyle = '#323742';
      ctx.fillRect(px + Math.floor(n * 10), py + 6, 3, 1);
    }
    return;
  }

  if (t === 'lunar_crater_rim') {
    ctx.fillStyle = '#8b94a4';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#a3adbd';
    ctx.fillRect(px + 2, py + 2, 10, 2);
    ctx.fillStyle = '#565e6d';
    ctx.fillRect(px + 1, py + 12, 12, 2);
    return;
  }

  if (t === 'lunar_pad_scorch') {
    ctx.fillStyle = '#2b303a';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#1d2129';
    ctx.fillRect(px + Math.floor(n * 6), py + 3, 7, 5);
    if (n > 0.6) {
      ctx.fillStyle = '#3c4352';
      ctx.fillRect(px + 4, py + 10, 6, 1);
    }
    return;
  }

  // Default: cool slate-grey lunar regolith with micro-craters & silver dust ripples
  ctx.fillStyle = '#68707e';
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  if (n > 0.74) {
    ctx.fillStyle = '#555c69';
    ctx.fillRect(px + Math.floor(n * 10), py + 5, 3, 1);
    ctx.fillRect(px + 2, py + Math.floor(n * 11), 2, 1);
  } else if (n < 0.19) {
    ctx.fillStyle = '#818a99';
    ctx.fillRect(px + 4, py + 10, 4, 1);
  }
}

function drawSkyEarth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Crisp pixel Earth disc suspended in the black lunar sky (Scene 04)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 1, y - 1, 22, 22);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(x + 2, y, 16, 20);
  ctx.fillRect(x, y + 2, 20, 16);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x + 3, y + 2, 12, 14);
  // Continents
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(x + 5, y + 4, 6, 4);
  ctx.fillRect(x + 7, y + 8, 5, 5);
  ctx.fillRect(x + 13, y + 6, 4, 6);
  // Cloud swirls & polar caps
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + 6, y + 1, 8, 2);
  ctx.fillRect(x + 3, y + 7, 5, 2);
  ctx.fillRect(x + 11, y + 12, 6, 2);
}

function drawAstronautFlashlight(ctx: CanvasRenderingContext2D, player: PlayerState) {
  const px = Math.round(player.x);
  const py = Math.round(player.y - 6);
  ctx.save();
  ctx.fillStyle = 'rgba(254, 240, 138, 0.14)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  if (player.dir === 'right') {
    ctx.lineTo(px + 44, py - 14);
    ctx.lineTo(px + 44, py + 14);
  } else if (player.dir === 'left') {
    ctx.lineTo(px - 44, py - 14);
    ctx.lineTo(px - 44, py + 14);
  } else if (player.dir === 'up') {
    ctx.lineTo(px - 14, py - 42);
    ctx.lineTo(px + 14, py - 42);
  } else {
    ctx.lineTo(px - 14, py + 42);
    ctx.lineTo(px + 14, py + 42);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStructure(
  ctx: CanvasRenderingContext2D,
  s: StructureEntity,
  time: number,
  isHighlighted: boolean,
  stats: SurvivalStats
) {
  const x = s.tx * TILE_SIZE;
  const y = s.ty * TILE_SIZE;
  const bounce =
    time - s.lastInteractAt < 0.2 ? -Math.sin(((time - s.lastInteractAt) / 0.2) * Math.PI) * 1.5 : 0;
  const dy = Math.round(y + bounce);

  switch (s.type) {
    case 'crashed_rocket':
      drawCrashedRocket(ctx, x, y, time, isHighlighted, stats);
      break;
    case 'minigame_rover':
      drawMinigameRover(
        ctx,
        x,
        dy,
        time,
        isHighlighted,
        stats.pathfinderMission.completed
      );
      break;
    case 'minigame_satellite':
      drawMinigameSatellite(
        ctx,
        x,
        dy,
        time,
        isHighlighted,
        stats.blindLandingMission.completed
      );
      break;
    case 'abandoned_rover':
      drawAbandonedRover(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'damaged_lander':
      drawDamagedLander(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'abandoned_solar':
      drawAbandonedSolar(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'comm_antenna':
      drawCommAntenna(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'battery_unit':
      drawBatteryUnit(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'circuit_wreck':
      drawCircuitWreck(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'metal_debris':
      drawMetalDebris(ctx, x, dy, !!s.salvaged, isHighlighted);
      break;
    case 'boulder':
      drawBoulder(ctx, x, y, s.tx + s.ty);
      break;
    case 'ares_lunar_lander':
      drawAresLunarLander(ctx, x, y, time, isHighlighted);
      break;
    case 'apollo_plutonium':
      drawApolloPlutonium(ctx, x, dy, time, isHighlighted, !!s.salvaged);
      break;
    case 'lunar_rtg':
      drawLunarRtg(ctx, x, dy, time, isHighlighted, stats.lunarMission.rtgPowered);
      break;
    case 'lunar_rover':
      drawLunarRover(
        ctx,
        x,
        dy,
        time,
        isHighlighted,
        stats.lunarMission.roverCharged,
        stats.lunarMission.rocketFuelRecovered
      );
      break;
    case 'lunar_boulder':
      drawLunarBoulder(ctx, x, y, s.tx + s.ty);
      break;
  }
}

function drawCrashedRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  stats: SurvivalStats
) {
  // Large 6x4 tile (96x64 px) crashed spacecraft lying tilted across scorched impact crater
  // Ground shadow
  ctx.fillStyle = 'rgba(15, 7, 5, 0.55)';
  ctx.fillRect(x + 4, y + 48, 88, 12);

  // Rear damaged thruster bells (left side)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 2, y + 20, 14, 10);
  ctx.fillRect(x + 2, y + 34, 14, 10);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 4, y + 21, 10, 8);
  ctx.fillRect(x + 4, y + 35, 10, 8);

  const outerPlatingReady = stats.rocket.outerPlating >= 100;
  const bothReady = outerPlatingReady && stats.rocket.cushioning >= 100;

  // Flickering sparks on damaged engine until outer plating & systems are restored
  if (!bothReady && Math.sin(time * 17) > 0.45) {
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(x + 1, y + 24, 3, 2);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 2, y + 38, 2, 2);
  } else if (bothReady) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 1, y + 23, 3, 4);
    ctx.fillRect(x + 1, y + 37, 3, 4);
  }

  // Main cylindrical fuselage (NASA white + charcoal + dark titanium ribs)
  ctx.fillStyle = highlighted ? '#bae6fd' : '#0f172a';
  ctx.fillRect(x + 14, y + 14, 62, 36);
  ctx.fillStyle = outerPlatingReady ? '#f1f5f9' : '#e2e8f0';
  ctx.fillRect(x + 16, y + 16, 58, 32);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + 18, y + 17, 54, 11);
  // Lower shadow curvature
  ctx.fillStyle = outerPlatingReady ? '#64748b' : '#94a3b8';
  ctx.fillRect(x + 16, y + 39, 58, 9);

  // NASA-inspired orange/red mission stripe along fuselage
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(x + 16, y + 29, 58, 3);

  // Black thermal nose cone (right side)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 74, y + 17, 12, 30);
  ctx.fillRect(x + 86, y + 21, 7, 22);
  ctx.fillRect(x + 93, y + 25, 3, 14);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 76, y + 19, 8, 9);

  // Broken top stabilizer fin & cracked hull gap
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 18, y + 4, 14, 12);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 20, y + 6, 10, 9);

  // Visible crash breach / exposed wiring (disappears once Outer Plating Steel Alloys are installed!)
  if (!outerPlatingReady) {
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x + 34, y + 21, 14, 9);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(x + 36, y + 24, 5, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 42, y + 25, 4, 1);
  } else {
    // Repaired Steel Alloy outer plating patch
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x + 34, y + 21, 14, 9);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 34, y + 21, 14, 1);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 36, y + 24, 2, 2);
  }

  // Accessible Airlock Hatch & Status Beacon
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 54, y + 32, 12, 16);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 56, y + 34, 8, 12);
  // Status light (green when both systems restored, cyan otherwise)
  const lightOn = Math.sin(time * 4) > -0.2;
  ctx.fillStyle = bothReady
    ? '#4ade80'
    : lightOn
    ? '#38bdf8'
    : '#0284c7';
  ctx.fillRect(x + 59, y + 37, 2, 4);

  // Cockpit viewport
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 68, y + 21, 7, 6);
  ctx.fillStyle = bothReady ? '#67e8f9' : '#334155';
  ctx.fillRect(x + 69, y + 22, 5, 4);

  // Stowed Emergency Pathfinder Airbag Cushioning Modules along lower skirt once restored
  if (stats.rocket.cushioning >= 100) {
    for (const ax of [x + 20, x + 32, x + 44]) {
      ctx.fillStyle = '#3f3a34';
      ctx.fillRect(ax, y + 43, 9, 6);
      ctx.fillStyle = '#f3ead3';
      ctx.fillRect(ax + 1, y + 44, 3, 4);
      ctx.fillRect(ax + 5, y + 44, 3, 4);
      ctx.fillStyle = '#c9b996';
      ctx.fillRect(ax + 3, y + 45, 3, 3);
    }
  }
}

function drawMinigameRover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  missionCompleted: boolean
) {
  // 3x2 tile (48x32 px) — Old, Damaged, Dust-Covered NASA Pathfinder-Style Rover
  ctx.fillStyle = 'rgba(15, 7, 5, 0.5)';
  ctx.fillRect(x + 3, y + 24, 42, 6);

  // Faded buried wheel tracks
  ctx.fillStyle = '#73311b';
  ctx.fillRect(x - 5, y + 24, 9, 2);
  ctx.fillRect(x - 4, y + 19, 6, 2);

  // Damaged wheels (rear wheel buried in Martian dust, front-right wheel tilted/broken)
  ctx.fillStyle = '#111827';
  // Rear wheel (partially buried)
  ctx.fillRect(x + 5, y + 22, 7, 5);
  ctx.fillRect(x + 6, y + 11, 6, 4);
  ctx.fillStyle = '#57534e';
  ctx.fillRect(x + 7, y + 23, 3, 3);

  // Mid wheel
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 19, y + 22, 7, 6);
  ctx.fillRect(x + 19, y + 11, 7, 4);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x + 21, y + 23, 3, 4);

  // Front broken/askew wheel + detached tread fragment
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 33, y + 23, 6, 5);
  ctx.fillRect(x + 39, y + 26, 3, 2); // broken wheel piece on sand
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 34, y + 24, 3, 3);

  // Dust mound piled against lower chassis
  ctx.fillStyle = '#8e3e22';
  ctx.fillRect(x + 5, y + 24, 10, 3);
  ctx.fillRect(x + 26, y + 25, 8, 2);

  // Main weathered chassis & gold thermal foil
  ctx.fillStyle = highlighted ? '#fde68a' : '#1e293b';
  ctx.fillRect(x + 8, y + 12, 30, 12);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 10, y + 13, 26, 9);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(x + 12, y + 15, 11, 5);

  // Broken, cracked top solar panel deck covered in Martian dust
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(x + 10, y + 8, 17, 6);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x + 11, y + 9, 15, 4);
  // Cracked grid lines + missing corner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 16, y + 8, 2, 5);
  ctx.fillRect(x + 22, y + 9, 4, 2);
  // Red-orange Martian dust drifts across solar panels & chassis
  ctx.fillStyle = '#a24c2c';
  ctx.fillRect(x + 11, y + 9, 5, 3);
  ctx.fillRect(x + 20, y + 11, 6, 2);
  ctx.fillRect(x + 14, y + 18, 8, 3);

  // Deflated cream Pathfinder airbag remnant tucked near front strut (visible before full recovery)
  if (!missionCompleted) {
    ctx.fillStyle = '#d6c8a8';
    ctx.fillRect(x + 28, y + 20, 6, 4);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(x + 30, y + 20, 1, 4);
  }

  // Tilted camera mast & blinking indicator light
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x + 29, y + 4, 2, 10);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 26, y + 2, 9, 4);
  const blinkOn = Math.sin(time * 5.5) > 0;
  ctx.fillStyle = missionCompleted
    ? '#22c55e'
    : blinkOn
    ? '#ef4444'
    : '#7f1d1d';
  ctx.fillRect(x + 32, y + 3, 2, 2);
  if (!missionCompleted && blinkOn) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.fillRect(x + 31, y + 2, 4, 4);
  }

  // Distinct Pathfinder Rover badge
  drawBadge(
    ctx,
    x + 24,
    y - 2,
    missionCompleted ? 'DONE' : 'ROVER',
    missionCompleted ? '#4ade80' : '#f59e0b'
  );
}

function drawMinigameSatellite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  missionCompleted: boolean
) {
  // 3x3 tile (48x48 px) — Pixelated NASA Ingenuity Mars Helicopter Relay
  // Ground shadow under splayed legs
  ctx.fillStyle = 'rgba(15, 7, 5, 0.45)';
  ctx.fillRect(x + 8, y + 39, 32, 5);

  // Back landing legs (darker carbon-fiber)
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 17, y + 31, 2, 4);
  ctx.fillRect(x + 15, y + 35, 2, 4);
  ctx.fillRect(x + 13, y + 38, 3, 2);

  ctx.fillRect(x + 29, y + 31, 2, 4);
  ctx.fillRect(x + 31, y + 35, 2, 4);
  ctx.fillRect(x + 32, y + 38, 3, 2);

  // Front splayed carbon-fiber landing legs + looped footpads
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 16, y + 29, 2, 3);
  ctx.fillRect(x + 14, y + 32, 2, 3);
  ctx.fillRect(x + 12, y + 35, 2, 3);
  ctx.fillRect(x + 10, y + 38, 2, 3);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 7, y + 40, 5, 2);

  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 30, y + 29, 2, 3);
  ctx.fillRect(x + 32, y + 32, 2, 3);
  ctx.fillRect(x + 34, y + 35, 2, 3);
  ctx.fillRect(x + 36, y + 38, 2, 3);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 36, y + 40, 5, 2);

  // Metallic silver-chrome reflective foil rectangular fuselage box
  ctx.fillStyle = highlighted ? '#bae6fd' : '#0f172a';
  ctx.fillRect(x + 16, y + 23, 16, 11);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 17, y + 24, 14, 9);
  // Crisp foil reflection facets & warm Martian rust reflection underneath
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + 17, y + 24, 7, 3);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x + 24, y + 25, 7, 4);
  ctx.fillStyle = '#b7793c';
  ctx.fillRect(x + 18, y + 29, 12, 4);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x + 17, y + 27, 3, 4);

  // Optical telemetry sensor + blinking status LED on fuselage
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 23, y + 27, 3, 3);
  const blinkOn = Math.sin(time * 5.5) > 0;
  ctx.fillStyle = missionCompleted
    ? '#4ade80'
    : blinkOn
    ? '#38bdf8'
    : '#ef4444';
  ctx.fillRect(x + 24, y + 28, 1, 1);

  // Central coaxial rotor mast & pitch-link hubs
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x + 23, y + 10, 2, 13);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 22, y + 13, 4, 2);
  ctx.fillRect(x + 22, y + 18, 4, 2);

  // Upper & lower wide dark carbon-fiber coaxial rotor blades
  ctx.fillStyle = '#1e242b';
  ctx.fillRect(x + 5, y + 13, 38, 3);
  ctx.fillRect(x + 6, y + 18, 36, 3);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 7, y + 13, 14, 1);
  ctx.fillRect(x + 27, y + 13, 14, 1);
  ctx.fillRect(x + 8, y + 18, 13, 1);
  ctx.fillRect(x + 27, y + 18, 13, 1);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 21, y + 12, 6, 4);
  ctx.fillRect(x + 21, y + 17, 6, 4);

  // Top flat bronze-gold solar panel deck
  ctx.fillStyle = highlighted ? '#fde68a' : '#422f0e';
  ctx.fillRect(x + 14, y + 7, 20, 4);
  ctx.fillStyle = '#c2a355';
  ctx.fillRect(x + 15, y + 8, 18, 2);
  ctx.fillStyle = '#e5c158';
  ctx.fillRect(x + 16, y + 8, 16, 1);

  // Thin vertical whip antenna on top
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x + 24, y + 2, 1, 5);

  // Distinct Relay / Ingenuity marker tag
  drawBadge(
    ctx,
    x + 24,
    y - 1,
    missionCompleted ? 'DONE' : 'RELAY',
    missionCompleted ? '#4ade80' : '#38bdf8'
  );
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  color: string
) {
  ctx.fillStyle = 'rgba(15, 12, 12, 0.85)';
  ctx.fillRect(cx - 9, y - 6, 18, 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(cx - 9, y - 6, 18, 6);
  ctx.fillStyle = color;
  ctx.font = 'bold 4px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y - 1.5);
}

function drawAbandonedRover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 3, y + 24, 26, 4);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 4, y + 18, 5, 7);
  ctx.fillRect(x + 22, y + 18, 5, 7);
  ctx.fillRect(x + 4, y + 9, 5, 5);
  ctx.fillRect(x + 22, y + 9, 5, 5);

  ctx.fillStyle = highlighted ? '#fde68a' : '#334155';
  ctx.fillRect(x + 6, y + 10, 20, 12);
  ctx.fillStyle = salvaged ? '#64748b' : '#2563eb';
  ctx.fillRect(x + 8, y + 11, 16, 9);
  ctx.fillStyle = salvaged ? '#475569' : '#d97706';
  ctx.fillRect(x + 12, y + 13, 8, 5);
}

function drawDamagedLander(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.4)';
  ctx.fillRect(x + 4, y + 25, 40, 5);

  // Landing struts
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 6, y + 18, 4, 10);
  ctx.fillRect(x + 38, y + 18, 4, 10);
  ctx.fillRect(x + 22, y + 20, 4, 9);

  // Gold-foil lander body
  ctx.fillStyle = highlighted ? '#fde68a' : '#1e293b';
  ctx.fillRect(x + 12, y + 6, 24, 16);
  ctx.fillStyle = salvaged ? '#78716c' : '#d97706';
  ctx.fillRect(x + 14, y + 8, 20, 12);
  ctx.fillStyle = salvaged ? '#a8a29e' : '#fbbf24';
  ctx.fillRect(x + 16, y + 9, 10, 4);

  // Dish antenna on top
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 20, y + 1, 8, 5);
}

function drawAbandonedSolar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 2, y + 24, 28, 4);

  ctx.fillStyle = highlighted ? '#bae6fd' : '#1e293b';
  ctx.fillRect(x + 2, y + 6, 28, 18);
  ctx.fillStyle = salvaged ? '#475569' : '#2563eb';
  ctx.fillRect(x + 4, y + 8, 24, 14);
  if (!salvaged) {
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x + 4, y + 14, 24, 1);
    ctx.fillRect(x + 15, y + 8, 1, 14);
  }
  // Drifted Mars dust corner
  ctx.fillStyle = '#a24c2c';
  ctx.fillRect(x + 18, y + 16, 10, 6);
}

function drawCommAntenna(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 3, y + 24, 26, 4);

  // Base unit
  ctx.fillStyle = highlighted ? '#bae6fd' : '#334155';
  ctx.fillRect(x + 5, y + 16, 12, 10);
  ctx.fillStyle = salvaged ? '#475569' : '#38bdf8';
  ctx.fillRect(x + 8, y + 19, 4, 3);

  // Fallen lattice mast & dish
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x + 13, y + 11, 16, 4);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x + 23, y + 5, 7, 12);
}

function drawBatteryUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 2, y + 12, 28, 3);

  ctx.fillStyle = highlighted ? '#fde68a' : '#1f2937';
  ctx.fillRect(x + 3, y + 2, 26, 12);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 5, y + 3, 22, 9);
  ctx.fillStyle = salvaged ? '#64748b' : '#22c55e';
  ctx.fillRect(x + 8, y + 6, 4, 3);
  ctx.fillRect(x + 14, y + 6, 4, 3);
  ctx.fillStyle = salvaged ? '#475569' : '#eab308';
  ctx.fillRect(x + 20, y + 6, 4, 3);
}

function drawCircuitWreck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 2, y + 12, 12, 3);

  ctx.fillStyle = highlighted ? '#bae6fd' : '#1e293b';
  ctx.fillRect(x + 2, y + 3, 12, 10);
  ctx.fillStyle = salvaged ? '#475569' : '#15803d';
  ctx.fillRect(x + 4, y + 5, 8, 6);
  if (!salvaged) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 5, y + 6, 2, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 9, y + 8, 2, 2);
  }
}

function drawMetalDebris(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  salvaged: boolean,
  highlighted: boolean
) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.35)';
  ctx.fillRect(x + 2, y + 12, 12, 3);

  ctx.fillStyle = highlighted ? '#fde68a' : '#334155';
  ctx.fillRect(x + 2, y + 4, 12, 9);
  ctx.fillStyle = salvaged ? '#64748b' : '#cbd5e1';
  ctx.fillRect(x + 3, y + 5, 10, 6);
  if (!salvaged) {
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(x + 4, y + 8, 8, 2);
  }
}

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = 'rgba(15, 7, 5, 0.38)';
  ctx.fillRect(x + 2, y + 12, 13, 3);

  ctx.fillStyle = '#4d2214';
  ctx.fillRect(x + 2, y + 4, 12, 9);
  ctx.fillRect(x + 4, y + 2, 8, 11);
  ctx.fillStyle = seed % 2 === 0 ? '#7d3820' : '#8a4126';
  ctx.fillRect(x + 3, y + 4, 10, 7);
  ctx.fillStyle = '#a85536';
  ctx.fillRect(x + 4, y + 3, 6, 3);
}

function drawAresLunarLander(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean
) {
  // 4x4 tile (64x64 px) — Upright Ares IV Spacecraft on red-beacon lunar landing pad (Scene 04)
  // Dark pad perimeter & pulsing red landing beacons
  ctx.fillStyle = '#181c24';
  ctx.fillRect(x + 2, y + 46, 60, 14);
  ctx.fillStyle = '#2d3340';
  ctx.fillRect(x + 6, y + 48, 52, 9);

  const beaconOn = Math.sin(time * 4.5) > -0.1;
  ctx.fillStyle = beaconOn ? '#ef4444' : '#7f1d1d';
  ctx.fillRect(x + 3, y + 51, 3, 3);
  ctx.fillRect(x + 58, y + 51, 3, 3);

  // Splayed landing struts & footpads
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 14, y + 44, 4, 8);
  ctx.fillRect(x + 46, y + 44, 4, 8);
  ctx.fillRect(x + 11, y + 51, 8, 2);
  ctx.fillRect(x + 45, y + 51, 8, 2);

  // Side booster pods
  ctx.fillStyle = highlighted ? '#bae6fd' : '#1e293b';
  ctx.fillRect(x + 16, y + 28, 7, 17);
  ctx.fillRect(x + 41, y + 28, 7, 17);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 17, y + 29, 5, 14);
  ctx.fillRect(x + 42, y + 29, 5, 14);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(x + 17, y + 32, 5, 2);
  ctx.fillRect(x + 42, y + 32, 5, 2);

  // Main upright white fuselage & dark nose cap
  ctx.fillStyle = highlighted ? '#bae6fd' : '#0f172a';
  ctx.fillRect(x + 22, y + 10, 20, 36);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x + 23, y + 12, 18, 32);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 35, y + 12, 6, 32);

  // Tapered nose cone & tip
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 26, y + 5, 12, 7);
  ctx.fillRect(x + 29, y + 2, 6, 4);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + 27, y + 6, 8, 6);

  // Orange NASA trim & cockpit viewport
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(x + 23, y + 24, 18, 3);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 29, y + 15, 6, 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(x + 30, y + 16, 4, 4);

  // Engine bell
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 26, y + 44, 12, 5);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(x + 30, y + 36, 4, 4);
}

function drawApolloPlutonium(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  collected: boolean
) {
  // 2x2 tile (32x32 px) — Wrecked Apollo Lunar Module Descent Stage + glowing Plutonium-238 fuel cask
  ctx.fillStyle = 'rgba(4, 6, 12, 0.5)';
  ctx.fillRect(x + 2, y + 25, 28, 5);

  // Bent Apollo gold-foil octagonal descent stage frame & landing pad struts
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 2, y + 21, 5, 5);
  ctx.fillRect(x + 25, y + 21, 5, 5);
  ctx.fillRect(x + 4, y + 25, 4, 2);
  ctx.fillRect(x + 24, y + 25, 4, 2);

  ctx.fillStyle = highlighted ? '#a5f3fc' : '#1e293b';
  ctx.fillRect(x + 5, y + 11, 22, 13);
  ctx.fillStyle = collected ? '#64748b' : '#b45309';
  ctx.fillRect(x + 6, y + 12, 20, 11);
  ctx.fillStyle = collected ? '#94a3b8' : '#f59e0b';
  ctx.fillRect(x + 7, y + 13, 9, 5);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 17, y + 14, 7, 7);

  // Ejected Plutonium-238 RTG Fuel Cask beside the Apollo wreck
  if (!collected) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 5.2);
    ctx.fillStyle = `rgba(34, 211, 238, ${(0.22 * pulse).toFixed(2)})`;
    ctx.fillRect(x + 11, y + 3, 12, 12);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 13, y + 5, 8, 9);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 14, y + 6, 6, 7);
    ctx.fillStyle = pulse > 0.65 ? '#67e8f9' : '#22d3ee';
    ctx.fillRect(x + 15, y + 7, 4, 5);
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(x + 16, y + 8, 2, 3);

    drawBadge(ctx, x + 16, y + 1, 'PU-238', '#22d3ee');
  } else {
    drawBadge(ctx, x + 16, y + 5, 'EMPTY', '#94a3b8');
  }
}

function drawLunarRtg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  powered: boolean
) {
  // 3x2 tile (48x32 px) — NASA Radioisotope Thermoelectric Generator (RTG) Power Station
  ctx.fillStyle = 'rgba(4, 6, 12, 0.52)';
  ctx.fillRect(x + 4, y + 25, 40, 5);

  // Heavy base platform
  ctx.fillStyle = highlighted ? '#fde68a' : '#1b2029';
  ctx.fillRect(x + 5, y + 15, 38, 12);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 7, y + 17, 34, 8);

  // Central finned RTG cylinder (radiator fins)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 14, y + 5, 20, 16);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x + 16, y + 6, 16, 14);
  // Horizontal cooling fins
  for (let fy = 7; fy <= 17; fy += 3) {
    ctx.fillStyle = powered ? '#f59e0b' : '#64748b';
    ctx.fillRect(x + 12, y + fy, 24, 1);
  }

  // Thermocouple glowing core strip & status LED
  const blink = Math.sin(time * 5) > 0;
  ctx.fillStyle = powered ? '#22d3ee' : blink ? '#ef4444' : '#7f1d1d';
  ctx.fillRect(x + 22, y + 9, 4, 8);
  if (powered) {
    ctx.fillStyle = '#a5f3fc';
    ctx.fillRect(x + 23, y + 10, 2, 6);
  }

  // Voltage meter panel on right side
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + 35, y + 18, 5, 5);
  ctx.fillStyle = powered ? '#4ade80' : '#ef4444';
  ctx.fillRect(x + 36, y + 19, 3, 3);

  drawBadge(
    ctx,
    x + 24,
    y,
    powered ? 'RTG ON' : 'RTG',
    powered ? '#4ade80' : '#f59e0b'
  );
}

function drawLunarRover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  highlighted: boolean,
  charged: boolean,
  fuelRecovered: boolean
) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.48)';
  ctx.fillRect(x + 4, y + 24, 40, 5);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 6, y + 19, 8, 6);
  ctx.fillRect(x + 34, y + 19, 8, 6);
  ctx.fillRect(x + 8, y + 10, 6, 4);
  ctx.fillRect(x + 34, y + 10, 6, 4);

  ctx.fillStyle = highlighted ? '#fde68a' : '#334155';
  ctx.fillRect(x + 10, y + 12, 28, 10);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 12, y + 13, 24, 7);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(x + 18, y + 14, 12, 4);

  // High-gain antenna mast & status LED
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x + 32, y + 4, 2, 9);
  ctx.fillRect(x + 29, y + 2, 8, 3);
  const pulse = Math.sin(time * 5.5) > 0;
  ctx.fillStyle = fuelRecovered
    ? '#4ade80'
    : charged
    ? pulse
      ? '#38bdf8'
      : '#0ea5e9'
    : pulse
    ? '#ef4444'
    : '#7f1d1d';
  ctx.fillRect(x + 13, y + 14, 3, 3);

  drawBadge(
    ctx,
    x + 24,
    y - 2,
    fuelRecovered ? 'FUELED' : charged ? 'DRIVE' : 'NO PWR',
    fuelRecovered ? '#4ade80' : charged ? '#38bdf8' : '#ef4444'
  );
}

function drawLunarBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.42)';
  ctx.fillRect(x + 2, y + 12, 13, 3);

  ctx.fillStyle = '#333945';
  ctx.fillRect(x + 2, y + 4, 12, 9);
  ctx.fillRect(x + 4, y + 2, 8, 11);
  ctx.fillStyle = seed % 2 === 0 ? '#5b6373' : '#6c7587';
  ctx.fillRect(x + 3, y + 4, 10, 7);
  ctx.fillStyle = '#8b95a7';
  ctx.fillRect(x + 4, y + 3, 6, 3);
}

function drawAstronaut(ctx: CanvasRenderingContext2D, player: PlayerState, time: number) {
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const stepBob = player.isMoving ? (player.walkFrame % 2 === 0 ? -1 : 0) : 0;

  // Shadow
  ctx.fillStyle = 'rgba(18, 8, 5, 0.45)';
  ctx.fillRect(px - 4, py + 4, 8, 3);

  // Boots
  const leftLegOffset = player.isMoving && player.walkFrame % 2 === 0 ? -1 : 0;
  const rightLegOffset = player.isMoving && player.walkFrame % 2 === 1 ? -1 : 0;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(px - 3, py + 2 + leftLegOffset, 2, 3);
  ctx.fillRect(px + 1, py + 2 + rightLegOffset, 2, 3);

  // PLSS Life-Support Backpack
  ctx.fillStyle = '#64748b';
  if (player.dir === 'right') {
    ctx.fillRect(px - 5, py - 5 + stepBob, 2, 6);
  } else if (player.dir === 'left') {
    ctx.fillRect(px + 3, py - 5 + stepBob, 2, 6);
  }

  // NASA-inspired White EVA Suit + Mission Orange Trim
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(px - 4, py - 5 + stepBob, 8, 7);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(px - 3, py - 4 + stepBob, 6, 5);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(px - 3, py - 4 + stepBob, 6, 1);

  // Helmet & Gold-Tinted Reflective Visor
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(px - 5, py - 12 + stepBob, 10, 8);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(px - 4, py - 11 + stepBob, 8, 6);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(px - 3, py - 12 + stepBob, 6, 1);

  if (player.dir === 'down') {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px - 3, py - 9 + stepBob, 6, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px - 2, py - 9 + stepBob, 2, 1);
  } else if (player.dir === 'right') {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px, py - 9 + stepBob, 4, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px + 1, py - 9 + stepBob, 2, 1);
  } else if (player.dir === 'left') {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px - 4, py - 9 + stepBob, 4, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px - 3, py - 9 + stepBob, 2, 1);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px - 3, py - 5 + stepBob, 6, 5);
  }

  // Action scanner / repair spark
  if (player.actionTimer > 0) {
    const pulse = Math.sin(time * 24) * 2;
    ctx.fillStyle = '#38bdf8';
    const tx = player.dir === 'left' ? px - 8 : player.dir === 'right' ? px + 6 : px + 3;
    const ty = player.dir === 'up' ? py - 14 : py - 4;
    ctx.fillRect(Math.round(tx), Math.round(ty + pulse), 3, 2);
  }
}

function drawNavigationIndicators(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  camX: number,
  camY: number,
  structures: StructureEntity[]
) {
  const halfW = width / (2 * zoom);
  const halfH = height / (2 * zoom);
  const minWX = camX - halfW;
  const maxWX = camX + halfW;
  const minWY = camY - halfH;
  const maxWY = camY + halfH;

  const targets = structures.filter(
    (s) =>
      s.category === 'crash_site' ||
      s.category === 'minigame_location' ||
      s.category === 'lunar_facility' ||
      (s.category === 'exploration_site' && !s.salvaged)
  );

  for (const t of targets) {
    const cx = (t.tx + t.w / 2) * TILE_SIZE;
    const cy = (t.ty + t.h / 2) * TILE_SIZE;

    // Only draw edge marker when target is off-screen
    if (cx >= minWX && cx <= maxWX && cy >= minWY && cy <= maxWY) {
      continue;
    }

    const dx = cx - camX;
    const dy = cy - camY;
    const angle = Math.atan2(dy, dx);

    const padX = width / 2 - 44;
    const padY = height / 2 - 58;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = Math.min(
      Math.abs(padX / (cos || 0.0001)),
      Math.abs(padY / (sin || 0.0001))
    );

    const sx = width / 2 + cos * scale;
    const sy = height / 2 + sin * scale;

    const color =
      t.category === 'crash_site'
        ? '#38bdf8'
        : t.type === 'apollo_plutonium'
        ? '#22d3ee'
        : t.type === 'lunar_rtg'
        ? '#f59e0b'
        : t.category === 'lunar_facility'
        ? '#cbd5e1'
        : t.category === 'minigame_location'
        ? '#fbbf24'
        : '#fb923c';

    const tag =
      t.type === 'ares_lunar_lander'
        ? 'ROCKET'
        : t.category === 'crash_site'
        ? 'ROCKET'
        : t.type === 'apollo_plutonium'
        ? 'PU-238'
        : t.type === 'lunar_rtg'
        ? 'RTG'
        : t.type === 'lunar_rover'
        ? 'ROVER'
        : t.minigameId === 'rover_recovery'
        ? 'ROVER'
        : t.minigameId === 'systems_repair'
        ? 'RELAY'
        : 'SALVAGE';

    ctx.save();
    ctx.translate(sx, sy);

    // Directional triangle
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Small crisp label
    ctx.fillStyle = 'rgba(18, 12, 11, 0.85)';
    ctx.fillRect(-20, 9, 40, 13);
    ctx.fillStyle = color;
    ctx.font = 'bold 9px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tag, 0, 19);
    ctx.restore();
  }
}
