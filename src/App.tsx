import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BlindLandingModal } from './components/BlindLandingModal';
import { Chapter2Cutscene, prefetchChapter2Video } from './components/Chapter2Cutscene';
import { ColonyHud } from './components/ColonyHud';
import { EarthReturnCutscene } from './components/EarthReturnCutscene';
import { FindEarthModal } from './components/FindEarthModal';
import { IngenuityDialogueModal } from './components/IngenuityDialogueModal';
import { IntroCutscene } from './components/IntroCutscene';
import { KeplerDialogueModal } from './components/KeplerDialogueModal';
import { LunarRoverRunModal } from './components/LunarRoverRunModal';
import { LunarRtgModal } from './components/LunarRtgModal';
import { MarsAirbagRunModal } from './components/MarsAirbagRunModal';
import { PathfinderDialogueModal } from './components/PathfinderDialogueModal';
import { RocketRepairModal } from './components/RocketRepairModal';
import { TacticalMapModal } from './components/TacticalMapModal';
import { TouchControls } from './components/TouchControls';
import { AudioSettings, MusicTrackId, soundFX } from './game/audio';
import {
  APOLLO_PLUTONIUM_TOTAL,
  MAP_H,
  MAP_W,
  TILE_SIZE,
  WorldInit,
  createInitialWorld,
  createMoonWorld,
  findNearestInteractable,
  isPlayerInCrashSafeZone,
  isRectBlocked,
} from './game/mapData';
import { ObjectivePinId } from './game/navigationGuide';
import { renderMarsScene } from './game/pixelRenderer';
import {
  clearSavedWorld,
  loadWorldProgress,
  saveWorldProgress,
} from './game/saveSystem';
import {
  GameState,
  Particle,
  SurvivalStats,
} from './game/types';

const BASE_ZOOM = 4;
const SOL_DURATION_SEC = 55;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initialLoadRef = useRef(loadWorldProgress());
  const worldRef = useRef<WorldInit>(initialLoadRef.current.world);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleId = useRef(1);
  const keysRef = useRef<Set<string>>(new Set());
  const camRef = useRef({
    x: worldRef.current.player.x,
    y: worldRef.current.player.y,
  });
  const peekDirRef = useRef<'left' | 'right' | null>(null);
  const stepSoundCooldown = useRef(0);
  const smokeCooldown = useRef(0);
  const uiSyncTimer = useRef(0);
  const autoSaveTimer = useRef(0);

  const [gameState, setGameState] = useState<GameState>('INTRO_CUTSCENE');
  const gameStateRef = useRef<GameState>('INTRO_CUTSCENE');

  const [stats, setStats] = useState<SurvivalStats>(() => ({
    ...worldRef.current.stats,
    inventory: { ...worldRef.current.stats.inventory },
    rocket: { ...worldRef.current.stats.rocket },
    pathfinderMission: { ...worldRef.current.stats.pathfinderMission },
    blindLandingMission: { ...worldRef.current.stats.blindLandingMission },
    lunarMission: { ...worldRef.current.stats.lunarMission },
  }));

  const [rocketModalOpen, setRocketModalOpen] = useState(false);
  const rocketModalOpenRef = useRef(false);
  const [rtgModalOpen, setRtgModalOpen] = useState(false);
  const rtgModalOpenRef = useRef(false);
  const [keplerDialogueOpen, setKeplerDialogueOpen] = useState(false);
  const keplerDialogueOpenRef = useRef(false);
  const [findEarthOpen, setFindEarthOpen] = useState(false);
  const findEarthOpenRef = useRef(false);

  const [pathfinderDialogueOpen, setPathfinderDialogueOpen] = useState(false);
  const pathfinderDialogueOpenRef = useRef(false);
  const [ingenuityDialogueOpen, setIngenuityDialogueOpen] = useState(false);
  const ingenuityDialogueOpenRef = useRef(false);
  const [airbagPracticeMode, setAirbagPracticeMode] = useState(false);

  const [activeMinigame, setActiveMinigame] = useState<
    'rover_recovery' | 'systems_repair' | 'lunar_rover_run' | null
  >(null);
  const activeMinigameRef = useRef<
    'rover_recovery' | 'systems_repair' | 'lunar_rover_run' | null
  >(null);

  const [showRadar, setShowRadar] = useState(true);
  const [tacticalMapOpen, setTacticalMapOpen] = useState(false);
  const tacticalMapOpenRef = useRef(false);
  const [trackedObjectiveId, setTrackedObjectiveId] = useState<ObjectivePinId | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    soundFX.getSettings()
  );
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [lunarNotice, setLunarNotice] = useState<{ title: string; body: string } | null>(null);
  const zoomRef = useRef(BASE_ZOOM);
  const lowO2BeepCooldownRef = useRef(0);
  const wasInSafeZoneRef = useRef(true);
  const [introVeil, setIntroVeil] = useState<'hidden' | 'solid' | 'fading'>('hidden');

  const syncAudioState = useCallback(() => {
    setAudioSettings(soundFX.getSettings());
  }, []);

  const handleToggleMasterMute = useCallback(() => {
    soundFX.muted = !soundFX.muted;
    syncAudioState();
    if (!soundFX.muted) {
      soundFX.unlock();
      soundFX.playUiClick();
    }
  }, [syncAudioState]);

  const handleToggleMusic = useCallback(() => {
    soundFX.musicEnabled = !soundFX.musicEnabled;
    syncAudioState();
    soundFX.unlock();
    soundFX.playUiClick();
  }, [syncAudioState]);

  const handleToggleGameplaySfx = useCallback(() => {
    soundFX.gameplaySfxEnabled = !soundFX.gameplaySfxEnabled;
    syncAudioState();
    soundFX.unlock();
    if (soundFX.gameplaySfxEnabled) {
      soundFX.playCoin();
    } else {
      soundFX.playUiClick();
    }
  }, [syncAudioState]);

  const handleToggleUiSfx = useCallback(() => {
    soundFX.uiSfxEnabled = !soundFX.uiSfxEnabled;
    syncAudioState();
    soundFX.unlock();
    soundFX.playUiClick();
  }, [syncAudioState]);

  // Unlock Web Audio context on first user interaction so 8-bit BGM & SFX play reliably
  useEffect(() => {
    const handleUnlock = () => {
      soundFX.unlock();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  // Dynamically switch 8-bit chiptune soundtrack by chapter, planet, and active minigame
  useEffect(() => {
    let targetTrack: MusicTrackId = 'none';
    if (gameState === 'PLAYING') {
      if (activeMinigame === 'rover_recovery' || activeMinigame === 'lunar_rover_run') {
        targetTrack = 'action';
      } else if (activeMinigame === 'systems_repair' || findEarthOpen) {
        targetTrack = 'puzzle';
      } else if (stats.planet === 'moon') {
        targetTrack = 'moon';
      } else {
        targetTrack = 'mars';
      }
    }
    soundFX.setMusicTrack(targetTrack);
  }, [gameState, activeMinigame, findEarthOpen, stats.planet]);

  useEffect(() => {
    if (introVeil !== 'solid') return;
    const raf = requestAnimationFrame(() => {
      setIntroVeil('fading');
    });
    const timer = window.setTimeout(() => {
      setIntroVeil('hidden');
    }, 950);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [introVeil]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    rocketModalOpenRef.current = rocketModalOpen;
  }, [rocketModalOpen]);

  useEffect(() => {
    rtgModalOpenRef.current = rtgModalOpen;
  }, [rtgModalOpen]);

  useEffect(() => {
    keplerDialogueOpenRef.current = keplerDialogueOpen;
  }, [keplerDialogueOpen]);

  useEffect(() => {
    findEarthOpenRef.current = findEarthOpen;
  }, [findEarthOpen]);

  useEffect(() => {
    pathfinderDialogueOpenRef.current = pathfinderDialogueOpen;
  }, [pathfinderDialogueOpen]);

  useEffect(() => {
    ingenuityDialogueOpenRef.current = ingenuityDialogueOpen;
  }, [ingenuityDialogueOpen]);

  useEffect(() => {
    activeMinigameRef.current = activeMinigame;
  }, [activeMinigame]);

  useEffect(() => {
    tacticalMapOpenRef.current = tacticalMapOpen;
  }, [tacticalMapOpen]);

  useEffect(() => {
    const updateZoom = () => {
      const effectiveSpan = Math.min(window.innerWidth, window.innerHeight * 1.6);
      const z =
        effectiveSpan < 640
          ? 2.75
          : effectiveSpan < 960
          ? 3.25
          : effectiveSpan > 1550
          ? 4.25
          : 3.75;
      zoomRef.current = z;
    };
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, []);

  const spawnParticle = useCallback((p: Omit<Particle, 'id'>) => {
    nextParticleId.current += 1;
    particlesRef.current.push({ ...p, id: nextParticleId.current });
    if (particlesRef.current.length > 220) {
      particlesRef.current.shift();
    }
  }, []);

  const syncStatsToReact = useCallback(() => {
    const st = worldRef.current.stats;
    setStats({
      ...st,
      inventory: { ...st.inventory },
      rocket: { ...st.rocket },
      pathfinderMission: { ...st.pathfinderMission },
      blindLandingMission: { ...st.blindLandingMission },
      lunarMission: { ...st.lunarMission },
    });
  }, []);

  const resetGame = useCallback(
    (startWithIntro = false) => {
      clearSavedWorld();
      const fresh = createInitialWorld();
      worldRef.current = fresh;
      particlesRef.current = [];
      camRef.current = { x: fresh.player.x, y: fresh.player.y };
      setRocketModalOpen(false);
      setRtgModalOpen(false);
      setKeplerDialogueOpen(false);
      setFindEarthOpen(false);
      setPathfinderDialogueOpen(false);
      setIngenuityDialogueOpen(false);
      setActiveMinigame(null);
      setTacticalMapOpen(false);
      setTrackedObjectiveId(null);
      setLunarNotice(null);
      syncStatsToReact();
      if (startWithIntro) {
        setGameState('INTRO_CUTSCENE');
      } else {
        setGameState('PLAYING');
        soundFX.playSolDawn();
      }
    },
    [syncStatsToReact]
  );

  const triggerInteract = useCallback(() => {
    if (
      gameStateRef.current !== 'PLAYING' ||
      rocketModalOpenRef.current ||
      rtgModalOpenRef.current ||
      keplerDialogueOpenRef.current ||
      findEarthOpenRef.current ||
      pathfinderDialogueOpenRef.current ||
      ingenuityDialogueOpenRef.current ||
      tacticalMapOpenRef.current ||
      activeMinigameRef.current !== null
    ) {
      return;
    }

    const { player, structures, stats: st } = worldRef.current;
    const nearest = findNearestInteractable(player, structures);
    if (!nearest) return;

    nearest.lastInteractAt = performance.now() / 1000;

    if (st.planet === 'moon') {
      player.targetPoint = null;
      keysRef.current.clear();

      if (nearest.type === 'apollo_plutonium' && !nearest.salvaged) {
        nearest.salvaged = true;
        st.inventory.plutonium = Math.min(
          APOLLO_PLUTONIUM_TOTAL,
          st.inventory.plutonium + 1
        );
        st.lunarMission.plutoniumCollected = Math.min(
          APOLLO_PLUTONIUM_TOTAL,
          st.lunarMission.plutoniumCollected + 1
        );
        soundFX.playPlutoniumHum();

        const cx = (nearest.tx + nearest.w / 2) * TILE_SIZE;
        const cy = nearest.ty * TILE_SIZE;
        for (let i = 0; i < 10; i++) {
          spawnParticle({
            x: cx + (Math.random() - 0.5) * 14,
            y: cy + 6,
            vx: (Math.random() - 0.5) * 28,
            vy: -14 - Math.random() * 18,
            life: 0.55,
            maxLife: 0.55,
            size: 2,
            color: i % 2 === 0 ? '#22d3ee' : '#a7f3d0',
            kind: 'spark',
          });
        }
        spawnParticle({
          x: cx,
          y: cy - 4,
          vx: 0,
          vy: -12,
          life: 1.4,
          maxLife: 1.4,
          size: 1,
          color: '#22d3ee',
          kind: 'text',
          text: `+1 PU-238 (${st.lunarMission.plutoniumCollected}/${APOLLO_PLUTONIUM_TOTAL})`,
        });

        if (st.lunarMission.plutoniumCollected >= APOLLO_PLUTONIUM_TOTAL) {
          soundFX.playMissionComplete();
          setLunarNotice({
            title: 'All 4 Apollo Plutonium Cores Collected!',
            body: 'Return to the Radioisotope Thermoelectric Generator (RTG) east of your rocket and press E to power the generator and charge the Lunar Rover.',
          });
        }
        syncStatsToReact();
        saveWorldProgress(worldRef.current);
        return;
      }

      soundFX.playUiClick();
      if (nearest.type === 'ares_lunar_lander') {
        setRocketModalOpen(true);
      } else if (nearest.type === 'lunar_rtg') {
        setRtgModalOpen(true);
      } else if (nearest.type === 'lunar_rover') {
        if (!st.lunarMission.roverCharged) {
          setLunarNotice({
            title: 'Lunar Rover · Battery Depleted',
            body: `Collect all ${APOLLO_PLUTONIUM_TOTAL} Plutonium-238 cores scattered from the Apollo mission spaceships (${st.lunarMission.plutoniumCollected}/${APOLLO_PLUTONIUM_TOTAL}) and load them into the RTG above the rover to charge it.`,
          });
        } else {
          setActiveMinigame('lunar_rover_run');
        }
      }
      saveWorldProgress(worldRef.current);
      return;
    }

    if (nearest.category === 'crash_site') {
      soundFX.playUiClick();
      saveWorldProgress(worldRef.current);
      setRocketModalOpen(true);
      return;
    }

    if (nearest.category === 'minigame_location' && nearest.minigameId) {
      soundFX.playUiClick();
      player.targetPoint = null;
      keysRef.current.clear();
      saveWorldProgress(worldRef.current);
      if (nearest.minigameId === 'rover_recovery') {
        setPathfinderDialogueOpen(true);
      } else if (nearest.minigameId === 'systems_repair') {
        setIngenuityDialogueOpen(true);
      } else {
        setActiveMinigame(nearest.minigameId);
      }
      return;
    }
  }, []);

  // Keyboard bindings (preserved WASD / Arrows + Space/E + Tab + C + M + Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        gameStateRef.current === 'INTRO_CUTSCENE' ||
        gameStateRef.current === 'CHAPTER2_CUTSCENE' ||
        gameStateRef.current === 'EARTH_RETURN_CUTSCENE'
      ) {
        return;
      }
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'Escape') {
        if (findEarthOpenRef.current) {
          // FindEarthModal handles its own Escape key
          return;
        } else if (tacticalMapOpenRef.current) {
          soundFX.playUiClose();
          setTacticalMapOpen(false);
        } else if (rtgModalOpenRef.current) {
          soundFX.playUiClose();
          setRtgModalOpen(false);
        } else if (keplerDialogueOpenRef.current) {
          soundFX.playUiClose();
          setKeplerDialogueOpen(false);
          setRocketModalOpen(true);
        } else if (rocketModalOpenRef.current) {
          soundFX.playUiClose();
          setRocketModalOpen(false);
        } else if (pathfinderDialogueOpenRef.current) {
          soundFX.playUiClose();
          setPathfinderDialogueOpen(false);
        } else if (ingenuityDialogueOpenRef.current) {
          soundFX.playUiClose();
          setIngenuityDialogueOpen(false);
        } else if (activeMinigameRef.current !== null) {
          // Active minigame modals handle their own Escape key
          return;
        } else if (gameStateRef.current === 'PLAYING') {
          soundFX.playPauseChime(true);
          saveWorldProgress(worldRef.current);
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          soundFX.playPauseChime(false);
          setGameState('PLAYING');
        }
        return;
      }

      if (code === 'Tab' && gameStateRef.current === 'PLAYING') {
        soundFX.playRadarPing();
        setShowRadar((v) => !v);
        return;
      }

      if (
        code === 'KeyG' &&
        gameStateRef.current === 'PLAYING' &&
        !rocketModalOpenRef.current &&
        !rtgModalOpenRef.current &&
        !keplerDialogueOpenRef.current &&
        !findEarthOpenRef.current &&
        !pathfinderDialogueOpenRef.current &&
        !ingenuityDialogueOpenRef.current &&
        activeMinigameRef.current === null
      ) {
        soundFX.playRadarPing();
        setTacticalMapOpen((v) => !v);
        return;
      }

      if (code === 'KeyM') {
        handleToggleMasterMute();
        return;
      }

      if (code === 'KeyC' && gameStateRef.current === 'PLAYING') {
        soundFX.playCameraSnap();
        worldRef.current.player.targetPoint = null;
        camRef.current.x = worldRef.current.player.x;
        camRef.current.y = worldRef.current.player.y;
        return;
      }

      if (code === 'KeyE' || code === 'Space') {
        if (!e.repeat) {
          triggerInteract();
        }
        return;
      }

      keysRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [triggerInteract, handleToggleMasterMute]);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const z = zoomRef.current;
    const wx = (sx - rect.width / 2) / z + camRef.current.x;
    const wy = (sy - rect.height / 2) / z + camRef.current.y;
    return { wx, wy };
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (
        gameStateRef.current !== 'PLAYING' ||
        rocketModalOpenRef.current ||
        rtgModalOpenRef.current ||
        keplerDialogueOpenRef.current ||
        findEarthOpenRef.current ||
        pathfinderDialogueOpenRef.current ||
        ingenuityDialogueOpenRef.current ||
        tacticalMapOpenRef.current ||
        activeMinigameRef.current !== null
      ) {
        return;
      }

      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const tx = Math.floor(wx / TILE_SIZE);
      const ty = Math.floor(wy / TILE_SIZE);
      const { player, structures } = worldRef.current;

      // Check if clicking directly on an already-adjacent interactive object
      const clickedStruct = structures.find(
        (s) =>
          s.category !== 'terrain' &&
          !(s.category === 'exploration_site' && s.salvaged) &&
          tx >= s.tx &&
          tx < s.tx + s.w &&
          ty >= s.ty &&
          ty < s.ty + s.h
      );

      if (clickedStruct) {
        const cx = (clickedStruct.tx + clickedStruct.w / 2) * TILE_SIZE;
        const cy = (clickedStruct.ty + clickedStruct.h / 2) * TILE_SIZE;
        const dx = Math.max(0, Math.abs(player.x - cx) - (clickedStruct.w * TILE_SIZE) / 2);
        const dy = Math.max(0, Math.abs(player.y - cy) - (clickedStruct.h * TILE_SIZE) / 2);
        if (Math.hypot(dx, dy) < 28) {
          triggerInteract();
          return;
        }
      }

      player.targetPoint = {
        x: Math.max(12, Math.min(MAP_W * TILE_SIZE - 12, wx)),
        y: Math.max(12, Math.min(MAP_H * TILE_SIZE - 12, wy)),
      };
      soundFX.playWaypoint();
    },
    [screenToWorld, triggerInteract]
  );

  // Main 60fps Loop (completely paused during video cutscenes so playback never lags)
  const isCutscene =
    gameState === 'INTRO_CUTSCENE' ||
    gameState === 'CHAPTER2_CUTSCENE' ||
    gameState === 'EARTH_RETURN_CUTSCENE';

  useEffect(() => {
    if (isCutscene) {
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
          canvas.width = Math.floor(cw * dpr);
          canvas.height = Math.floor(ch * dpr);
        }

        const world = worldRef.current;
        const { player, structures, tiles, stats: st } = world;
        const isActivePlay =
          gameStateRef.current === 'PLAYING' &&
          !rocketModalOpenRef.current &&
          !rtgModalOpenRef.current &&
          !keplerDialogueOpenRef.current &&
          !findEarthOpenRef.current &&
          !pathfinderDialogueOpenRef.current &&
          !ingenuityDialogueOpenRef.current &&
          !tacticalMapOpenRef.current &&
          activeMinigameRef.current === null;

        if (isActivePlay) {
          // 1. Preserved Smooth Player Movement & Corner-Sliding
          const keys = keysRef.current;
          let moveX = 0;
          let moveY = 0;

          if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
          if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

          if (moveX !== 0 || moveY !== 0) {
            player.targetPoint = null;
          } else if (player.targetPoint) {
            const dx = player.targetPoint.x - player.x;
            const dy = player.targetPoint.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 2.5) {
              player.targetPoint = null;
            } else {
              moveX = dx / dist;
              moveY = dy / dist;
            }
          }

          const mag = Math.hypot(moveX, moveY);
          const powerPenalty = st.suitPower <= 0 ? 0.68 : 1;
          const speed = 68 * powerPenalty;

          if (mag > 0.01) {
            const nx = moveX / mag;
            const ny = moveY / mag;
            player.isMoving = true;

            if (Math.abs(nx) >= Math.abs(ny)) {
              player.dir = nx >= 0 ? 'right' : 'left';
            } else {
              player.dir = ny >= 0 ? 'down' : 'up';
            }

            const halfW = 4.2;
            const halfH = 4.2;
            const stepX = nx * speed * dt;
            const stepY = ny * speed * dt;

            if (!isRectBlocked(player.x + stepX, player.y, halfW, halfH, structures, tiles)) {
              player.x += stepX;
            } else if (Math.abs(ny) < 0.2) {
              if (!isRectBlocked(player.x + stepX, player.y - 3, halfW, halfH, structures, tiles)) {
                player.y -= Math.min(3, speed * dt * 0.7);
              } else if (
                !isRectBlocked(player.x + stepX, player.y + 3, halfW, halfH, structures, tiles)
              ) {
                player.y += Math.min(3, speed * dt * 0.7);
              } else {
                player.targetPoint = null;
              }
            }

            if (!isRectBlocked(player.x, player.y + stepY, halfW, halfH, structures, tiles)) {
              player.y += stepY;
            } else if (Math.abs(nx) < 0.2) {
              if (!isRectBlocked(player.x - 3, player.y + stepY, halfW, halfH, structures, tiles)) {
                player.x -= Math.min(3, speed * dt * 0.7);
              } else if (
                !isRectBlocked(player.x + 3, player.y + stepY, halfW, halfH, structures, tiles)
              ) {
                player.x += Math.min(3, speed * dt * 0.7);
              } else {
                player.targetPoint = null;
              }
            }

            player.walkTimer += dt;
            if (player.walkTimer > 0.14) {
              player.walkTimer = 0;
              player.walkFrame = (player.walkFrame + 1) % 4;
            }

            stepSoundCooldown.current -= dt;
            if (stepSoundCooldown.current <= 0) {
              stepSoundCooldown.current = st.planet === 'moon' ? 0.27 : 0.24;
              if (st.planet === 'moon') {
                soundFX.playMoonStep();
              } else {
                soundFX.playStep();
              }
              spawnParticle({
                x: player.x + (Math.random() - 0.5) * 4,
                y: player.y + 4,
                vx: -nx * 6,
                vy: -ny * 6,
                life: 0.35,
                maxLife: 0.35,
                size: 1.5,
                color: st.planet === 'moon' ? '#94a3b8' : '#7c361d',
                kind: 'dust',
              });
            }
          } else {
            player.isMoving = false;
            player.walkFrame = 0;
          }

          if (player.actionTimer > 0) {
            player.actionTimer = Math.max(0, player.actionTimer - dt);
          }

          // 2. Crashed Rocket Engine Smoke Plumes (Mars only)
          smokeCooldown.current -= dt;
          if (
            st.planet === 'mars' &&
            smokeCooldown.current <= 0 &&
            (st.rocket.outerPlating < 100 || st.rocket.cushioning < 100)
          ) {
            smokeCooldown.current = 0.24;
            const rocket = structures.find((s) => s.type === 'crashed_rocket');
            if (rocket) {
              spawnParticle({
                x: rocket.tx * TILE_SIZE + 8 + (Math.random() - 0.5) * 5,
                y: rocket.ty * TILE_SIZE + 26 + (Math.random() - 0.5) * 8,
                vx: -3 + (Math.random() - 0.5) * 4,
                vy: -11 - Math.random() * 5,
                life: 1.1,
                maxLife: 1.1,
                size: 3.5,
                color: Math.random() < 0.35 ? '#475569' : '#64748b',
                kind: 'smoke',
              });
            }
          }

          // 3. Sol Timer, Dust Storms (Mars only) & Suit Survival Reserves
          st.solProgress += dt / SOL_DURATION_SEC;
          if (st.solProgress >= 1) {
            st.solProgress -= 1;
            st.sol += 1;
            soundFX.playSolDawn();
          }

          if (st.planet === 'mars') {
            st.dustStormTimer -= dt;
            if (st.dustStormTimer <= 0) {
              st.dustStormActive = !st.dustStormActive;
              st.dustStormTimer = st.dustStormActive ? 14 : 40 + Math.random() * 14;
              if (st.dustStormActive) {
                soundFX.playAlert();
                soundFX.playDustStorm();
              }
            }
          } else {
            st.dustStormActive = false;
          }

          st.inCrashSafeZone = isPlayerInCrashSafeZone(player, st.planet);
          if (st.inCrashSafeZone) {
            if (!wasInSafeZoneRef.current && (st.suitOxygen < 92 || st.suitPower < 92)) {
              soundFX.playRecharge();
            }
            st.suitOxygen = Math.min(100, st.suitOxygen + dt * 16);
            st.suitPower = Math.min(100, st.suitPower + dt * 18);
            lowO2BeepCooldownRef.current = 0;
          } else {
            const o2Drain = st.suitPower <= 0 ? 1.55 : 0.75;
            const powerDrain = (st.dustStormActive ? 1.65 : 0.68) * (player.isMoving ? 1.15 : 0.75);
            st.suitOxygen = Math.max(0, st.suitOxygen - dt * o2Drain);
            st.suitPower = Math.max(0, st.suitPower - dt * powerDrain);
            if (st.suitOxygen > 0 && st.suitOxygen < 25) {
              lowO2BeepCooldownRef.current -= dt;
              if (lowO2BeepCooldownRef.current <= 0) {
                lowO2BeepCooldownRef.current = 2.4;
                soundFX.playLowO2Beep();
              }
            } else {
              lowO2BeepCooldownRef.current = 0;
            }
          }
          wasInSafeZoneRef.current = st.inCrashSafeZone;

          if (st.suitOxygen <= 0) {
            soundFX.playGameOver();
            setGameState('GAME_OVER');
          }

          autoSaveTimer.current += dt;
          if (autoSaveTimer.current >= 2.0) {
            autoSaveTimer.current = 0;
            saveWorldProgress(world);
          }
        }

        // 4. Update Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.kind === 'smoke') {
            p.size += dt * 2.5;
          }
          if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
          }
        }

        // 5. Camera Follow + Edge Peek
        const peekOffset =
          peekDirRef.current === 'left' ? -140 : peekDirRef.current === 'right' ? 140 : 0;
        const halfViewW = cw / (2 * zoomRef.current);
        const halfViewH = ch / (2 * zoomRef.current);
        const worldW = MAP_W * TILE_SIZE;
        const worldH = MAP_H * TILE_SIZE;
        const targetCamX =
          halfViewW >= worldW / 2
            ? worldW / 2
            : Math.max(halfViewW, Math.min(worldW - halfViewW, player.x + peekOffset));
        const targetCamY =
          halfViewH >= worldH / 2
            ? worldH / 2
            : Math.max(halfViewH, Math.min(worldH - halfViewH, player.y));
        camRef.current.x += (targetCamX - camRef.current.x) * Math.min(1, dt * 7);
        camRef.current.y += (targetCamY - camRef.current.y) * Math.min(1, dt * 7);

        // 6. Nearest Interactive Landmark & Context Hint
        const nearest = findNearestInteractable(player, structures);
        uiSyncTimer.current += dt;
        if (uiSyncTimer.current >= 0.12) {
          uiSyncTimer.current = 0;
          syncStatsToReact();
          if (nearest) {
            if (nearest.type === 'ares_lunar_lander') {
              setContextHint('PRESS E TO INTERACT · Ares IV Spacecraft (Lunar Pad)');
            } else if (nearest.type === 'apollo_plutonium') {
              setContextHint(`PRESS E TO COLLECT · ${nearest.label}`);
            } else if (nearest.type === 'lunar_rtg') {
              setContextHint('PRESS E TO INTERACT · Radioisotope Thermoelectric Generator (RTG)');
            } else if (nearest.type === 'lunar_rover') {
              setContextHint(
                st.lunarMission.roverCharged
                  ? 'PRESS E TO DRIVE · Lunar Rover to Fuel Base 02'
                  : 'PRESS E TO INTERACT · Lunar Rover (Needs RTG Charge)'
              );
            } else if (nearest.category === 'lunar_facility') {
              setContextHint(`PRESS E TO INSPECT · ${nearest.label}`);
            } else if (nearest.category === 'crash_site') {
              setContextHint('PRESS E TO INTERACT · Crashed Spacecraft (Ares IV)');
            } else if (nearest.type === 'minigame_rover') {
              setContextHint('PRESS E TO INTERACT · Abandoned Mars Pathfinder Rover');
            } else if (nearest.type === 'minigame_satellite') {
              setContextHint('PRESS E TO INTERACT · Ingenuity Mars Helicopter Relay');
            } else if (nearest.category === 'minigame_location') {
              setContextHint(`${nearest.label} · Inspect Site`);
            } else {
              setContextHint(`${nearest.label} · Salvage Components`);
            }
          } else {
            setContextHint(null);
          }
        }

        // 7. Render Mars Scene
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          renderMarsScene({
            ctx,
            width: cw,
            height: ch,
            zoom: zoomRef.current,
            camX: camRef.current.x,
            camY: camRef.current.y,
            time: timeSec,
            tiles,
            structures,
            player,
            particles: particlesRef.current,
            stats: st,
            nearestStructId: nearest?.id ?? null,
          });
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isCutscene, spawnParticle, syncStatsToReact]);

  const handleRestoreOuterPlating = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    if (!isPlayerInCrashSafeZone(world.player)) return;
    if (!st.blindLandingMission.completed || st.blindLandingMission.rocketOuterPlatingRestored) {
      return;
    }

    st.rocket.outerPlating = 100;
    st.blindLandingMission.rocketOuterPlatingRestored = true;
    st.inventory.steelAlloys = 0;

    soundFX.playMissionComplete();
    const rocket = world.structures.find((s) => s.type === 'crashed_rocket');
    if (rocket) {
      const rcx = (rocket.tx + rocket.w / 2) * TILE_SIZE;
      const rcy = (rocket.ty + rocket.h / 2) * TILE_SIZE;
      for (let i = 0; i < 14; i++) {
        spawnParticle({
          x: rcx + (Math.random() - 0.5) * 40,
          y: rcy + 8 + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 32,
          vy: -14 - Math.random() * 20,
          life: 0.65,
          maxLife: 0.65,
          size: 2.5,
          color: i % 2 === 0 ? '#38bdf8' : '#fde047',
          kind: 'spark',
        });
      }
      spawnParticle({
        x: rcx,
        y: rocket.ty * TILE_SIZE - 4,
        vx: 0,
        vy: -11,
        life: 1.6,
        maxLife: 1.6,
        size: 1,
        color: '#4ade80',
        kind: 'text',
        text: 'OUTER PLATING RESTORED!',
      });
    }

    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleRestoreCushioning = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    if (!isPlayerInCrashSafeZone(world.player)) return;
    if (!st.pathfinderMission.completed || st.pathfinderMission.rocketCushioningRestored) return;

    st.rocket.cushioning = 100;
    st.pathfinderMission.rocketCushioningRestored = true;
    st.inventory.airbags = 0;

    soundFX.playMissionComplete();
    const rocket = world.structures.find((s) => s.type === 'crashed_rocket');
    if (rocket) {
      const rcx = (rocket.tx + rocket.w / 2) * TILE_SIZE;
      const rcy = (rocket.ty + rocket.h / 2) * TILE_SIZE;
      for (let i = 0; i < 14; i++) {
        spawnParticle({
          x: rcx + (Math.random() - 0.5) * 40,
          y: rcy + 8 + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 32,
          vy: -14 - Math.random() * 20,
          life: 0.65,
          maxLife: 0.65,
          size: 2.5,
          color: i % 2 === 0 ? '#fde047' : '#f3ead3',
          kind: 'spark',
        });
      }
      spawnParticle({
        x: rcx,
        y: rocket.ty * TILE_SIZE - 4,
        vx: 0,
        vy: -11,
        life: 1.6,
        maxLife: 1.6,
        size: 1,
        color: '#4ade80',
        kind: 'text',
        text: 'CUSHIONING RESTORED!',
      });
    }

    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleCompleteAirbagMission = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;

    if (!airbagPracticeMode && !st.pathfinderMission.completed) {
      st.pathfinderMission.accepted = true;
      st.pathfinderMission.completed = true;
      st.pathfinderMission.airbagsRecovered = 10;
      st.inventory.airbags = 10;

      const rover = world.structures.find((s) => s.type === 'minigame_rover');
      if (rover) {
        rover.salvaged = true;
      }

      for (let i = 0; i < 12; i++) {
        spawnParticle({
          x: world.player.x + (Math.random() - 0.5) * 18,
          y: world.player.y - 6,
          vx: (Math.random() - 0.5) * 34,
          vy: -15 - Math.random() * 20,
          life: 0.6,
          maxLife: 0.6,
          size: 2,
          color: i % 2 === 0 ? '#fde047' : '#4ade80',
          kind: 'spark',
        });
      }
      spawnParticle({
        x: world.player.x,
        y: world.player.y - 16,
        vx: 0,
        vy: -12,
        life: 1.6,
        maxLife: 1.6,
        size: 1,
        color: '#fde047',
        kind: 'text',
        text: '10 AIRBAGS RECOVERED!',
      });

      syncStatsToReact();
      saveWorldProgress(world);
    }

    setAirbagPracticeMode(false);
    setActiveMinigame(null);
  }, [airbagPracticeMode, spawnParticle, syncStatsToReact]);

  const handleCompleteBlindLanding = useCallback(
    (summary: { steelAlloys: number; flightsSent: number; vectorsUsed: number }) => {
      const world = worldRef.current;
      const st = world.stats;

      if (!st.blindLandingMission.completed) {
        st.blindLandingMission.completed = true;
        st.blindLandingMission.steelAlloysRecovered = summary.steelAlloys;
        st.inventory.steelAlloys = summary.steelAlloys;

        const satellite = world.structures.find((s) => s.type === 'minigame_satellite');
        if (satellite) {
          satellite.salvaged = true;
        }

        soundFX.playMissionComplete();
        for (let i = 0; i < 14; i++) {
          spawnParticle({
            x: world.player.x + (Math.random() - 0.5) * 20,
            y: world.player.y - 6,
            vx: (Math.random() - 0.5) * 36,
            vy: -15 - Math.random() * 20,
            life: 0.65,
            maxLife: 0.65,
            size: 2,
            color: i % 2 === 0 ? '#f59e0b' : '#4ade80',
            kind: 'spark',
          });
        }
        spawnParticle({
          x: world.player.x,
          y: world.player.y - 16,
          vx: 0,
          vy: -12,
          life: 1.7,
          maxLife: 1.7,
          size: 1,
          color: '#fde047',
          kind: 'text',
          text: `+${summary.steelAlloys} STEEL ALLOYS!`,
        });

        syncStatsToReact();
        saveWorldProgress(world);
      }

      setActiveMinigame(null);
    },
    [spawnParticle, syncStatsToReact]
  );

  const handleEarthLocated = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    st.earthLocated = true;
    soundFX.playMissionComplete();
    void prefetchChapter2Video();

    const rocket = world.structures.find((s) => s.type === 'crashed_rocket');
    if (rocket) {
      const rcx = (rocket.tx + rocket.w / 2) * TILE_SIZE;
      spawnParticle({
        x: rcx,
        y: rocket.ty * TILE_SIZE - 4,
        vx: 0,
        vy: -11,
        life: 1.7,
        maxLife: 1.7,
        size: 1,
        color: '#7dd3fc',
        kind: 'text',
        text: 'EARTH COORDINATES LOCKED!',
      });
    }

    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleLaunchHome = useCallback(() => {
    const { rocket, earthLocated } = worldRef.current.stats;
    if (rocket.cushioning >= 100 && rocket.outerPlating >= 100 && earthLocated) {
      setRocketModalOpen(false);
      setKeplerDialogueOpen(false);
      setFindEarthOpen(false);
      soundFX.playRocketLaunch();
      setGameState('CHAPTER2_CUTSCENE');
    }
  }, []);

  const handleRoverCharged = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    st.lunarMission.rtgPowered = true;
    st.lunarMission.roverCharged = true;
    st.inventory.plutonium = 0;

    soundFX.playMissionComplete();
    const rover = world.structures.find((s) => s.type === 'lunar_rover');
    if (rover) {
      rover.salvaged = true;
      const vx = (rover.tx + rover.w / 2) * TILE_SIZE;
      const vy = rover.ty * TILE_SIZE;
      spawnParticle({
        x: vx,
        y: vy - 4,
        vx: 0,
        vy: -11,
        life: 1.6,
        maxLife: 1.6,
        size: 1,
        color: '#22d3ee',
        kind: 'text',
        text: 'LUNAR ROVER CHARGED!',
      });
    }
    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleCompleteLunarRoverRun = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    st.lunarMission.rocketFuelRecovered = true;
    st.inventory.rocketFuel = 1;

    soundFX.playMissionComplete();
    const rover = world.structures.find((s) => s.type === 'lunar_rover');
    if (rover) {
      spawnParticle({
        x: (rover.tx + rover.w / 2) * TILE_SIZE,
        y: rover.ty * TILE_SIZE - 4,
        vx: 0,
        vy: -11,
        life: 1.7,
        maxLife: 1.7,
        size: 1,
        color: '#4ade80',
        kind: 'text',
        text: 'ROCKET FUEL RECOVERED!',
      });
    }
    setActiveMinigame(null);
    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleLoadLunarFuel = useCallback(() => {
    const world = worldRef.current;
    const st = world.stats;
    st.lunarMission.rocketFueled = true;
    st.inventory.rocketFuel = 0;

    soundFX.playMissionComplete();
    const lander = world.structures.find((s) => s.type === 'ares_lunar_lander');
    if (lander) {
      spawnParticle({
        x: (lander.tx + lander.w / 2) * TILE_SIZE,
        y: lander.ty * TILE_SIZE - 4,
        vx: 0,
        vy: -11,
        life: 1.7,
        maxLife: 1.7,
        size: 1,
        color: '#4ade80',
        kind: 'text',
        text: 'ROCKET FUELED FOR EARTH!',
      });
    }
    syncStatsToReact();
    saveWorldProgress(world);
  }, [spawnParticle, syncStatsToReact]);

  const handleFlyToEarth = useCallback(() => {
    const { lunarMission } = worldRef.current.stats;
    if (lunarMission.rocketFueled) {
      setRocketModalOpen(false);
      soundFX.playRocketLaunch();
      setGameState('EARTH_RETURN_CUTSCENE');
    }
  }, []);

  const handleCompleteChapter2 = useCallback(() => {
    const moonWorld = createMoonWorld(worldRef.current.stats);
    worldRef.current = moonWorld;
    particlesRef.current = [];
    camRef.current = { x: moonWorld.player.x, y: moonWorld.player.y };
    setTacticalMapOpen(false);
    setTrackedObjectiveId(null);
    syncStatsToReact();
    saveWorldProgress(moonWorld);
    setLunarNotice({
      title: 'Chapter 2 · Lunar Survival (Moon)',
      body: 'Emergency landing complete! First collect all 4 Plutonium-238 cores scattered from the Apollo mission spaceships and load them into the RTG to charge the Lunar Rover. Then drive the rover to Lunar Fuel Base 02 for rocket fuel to fly home to Earth!',
    });
    setGameState('PLAYING');
    soundFX.playSolDawn();
  }, [syncStatsToReact]);

  const handleTouchDirHold = (dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => {
    const map = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    if (pressed) {
      keysRef.current.add(map[dir]);
    } else {
      keysRef.current.delete(map[dir]);
    }
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden ${
        stats.planet === 'moon' ? 'bg-[#070b14]' : 'bg-[#29100e]'
      }`}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`block w-full h-full pixelated cursor-pointer ${
          isCutscene ? 'hidden' : ''
        }`}
      />

      {gameState !== 'INTRO_CUTSCENE' &&
        gameState !== 'CHAPTER2_CUTSCENE' &&
        gameState !== 'EARTH_RETURN_CUTSCENE' && (
          <ColonyHud
            tiles={worldRef.current.tiles}
            stats={stats}
            player={worldRef.current.player}
            structures={worldRef.current.structures}
            audioSettings={audioSettings}
            paused={gameState === 'PAUSED'}
            showRadar={showRadar}
            trackedObjectiveId={trackedObjectiveId}
            contextHint={contextHint}
            onToggleMute={handleToggleMasterMute}
            onToggleMusic={handleToggleMusic}
            onToggleGameplaySfx={handleToggleGameplaySfx}
            onToggleUiSfx={handleToggleUiSfx}
            onTogglePause={() => {
              const nextPaused = gameState !== 'PAUSED';
              soundFX.playPauseChime(nextPaused);
              setGameState(nextPaused ? 'PAUSED' : 'PLAYING');
            }}
            onToggleRadar={() => {
              soundFX.playRadarPing();
              setShowRadar((v) => !v);
            }}
            onOpenTacticalMap={() => {
              soundFX.playRadarPing();
              setTacticalMapOpen(true);
            }}
            onClearManualTrack={() => {
              soundFX.playUiClick();
              setTrackedObjectiveId(null);
            }}
            onOpenRocketStatus={() => {
              soundFX.playUiOpen();
              setRocketModalOpen(true);
            }}
            onRecenter={() => {
              soundFX.playCameraSnap();
              worldRef.current.player.targetPoint = null;
              camRef.current.x = worldRef.current.player.x;
              camRef.current.y = worldRef.current.player.y;
            }}
            onPeekHold={(dir) => {
              peekDirRef.current = dir;
            }}
            onTriggerAction={triggerInteract}
          />
        )}

      {lunarNotice && gameState === 'PLAYING' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-lg">
          <div className="pixel-panel-dark p-4 text-stone-100 flex items-start justify-between gap-3 border-2 border-slate-500 shadow-2xl">
            <div className="space-y-1">
              <div className="font-pixel text-xs text-sky-300">{lunarNotice.title}</div>
              <p className="text-xs text-stone-300 leading-relaxed">{lunarNotice.body}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                setLunarNotice(null);
              }}
              className="pixel-btn bg-[#3a3f46] hover:bg-[#4c535d] text-stone-100 text-xs font-pixel px-2.5 py-1 cursor-pointer shrink-0"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {gameState === 'PLAYING' &&
        !rocketModalOpen &&
        !rtgModalOpen &&
        !keplerDialogueOpen &&
        !findEarthOpen &&
        !pathfinderDialogueOpen &&
        !ingenuityDialogueOpen &&
        !tacticalMapOpen &&
        !activeMinigame && (
          <TouchControls onDirHold={handleTouchDirHold} onAction={triggerInteract} />
        )}

      {tacticalMapOpen && (
        <TacticalMapModal
          tiles={worldRef.current.tiles}
          structures={worldRef.current.structures}
          player={worldRef.current.player}
          stats={stats}
          trackedObjectiveId={trackedObjectiveId}
          onTrackObjective={(id) => setTrackedObjectiveId(id)}
          onWalkToObjective={(obj) => {
            worldRef.current.player.targetPoint = {
              x: obj.walkX,
              y: obj.walkY,
            };
            setTrackedObjectiveId(obj.id);
            setTacticalMapOpen(false);
          }}
          onClose={() => setTacticalMapOpen(false)}
        />
      )}

      {rtgModalOpen && (
        <LunarRtgModal
          stats={stats}
          onRoverCharged={handleRoverCharged}
          onClose={() => setRtgModalOpen(false)}
        />
      )}

      {rocketModalOpen && (
        <RocketRepairModal
          stats={stats}
          atCrashSite={isPlayerInCrashSafeZone(worldRef.current.player, stats.planet)}
          onRestoreCushioning={handleRestoreCushioning}
          onRestoreOuterPlating={handleRestoreOuterPlating}
          onOpenFindEarth={() => {
            void prefetchChapter2Video();
            setRocketModalOpen(false);
            setKeplerDialogueOpen(true);
          }}
          onLaunchHome={handleLaunchHome}
          onLoadLunarFuel={handleLoadLunarFuel}
          onFlyToEarth={handleFlyToEarth}
          onClose={() => setRocketModalOpen(false)}
        />
      )}

      {keplerDialogueOpen && (
        <KeplerDialogueModal
          earthAlreadyLocated={stats.earthLocated}
          onStartMinigame={() => {
            setKeplerDialogueOpen(false);
            setFindEarthOpen(true);
          }}
          onClose={() => {
            setKeplerDialogueOpen(false);
            setRocketModalOpen(true);
          }}
        />
      )}

      {findEarthOpen && (
        <FindEarthModal
          alreadyLocated={stats.earthLocated}
          onEarthLocated={handleEarthLocated}
          onLaunchAfterComplete={handleLaunchHome}
          onClose={() => {
            setFindEarthOpen(false);
            setRocketModalOpen(true);
          }}
        />
      )}

      {pathfinderDialogueOpen && (
        <PathfinderDialogueModal
          missionAlreadyCompleted={stats.pathfinderMission.completed}
          rocketCushioningRestored={stats.pathfinderMission.rocketCushioningRestored}
          onAcceptMission={() => {
            worldRef.current.stats.pathfinderMission.accepted = true;
            syncStatsToReact();
            saveWorldProgress(worldRef.current);
            setAirbagPracticeMode(false);
            setPathfinderDialogueOpen(false);
            setActiveMinigame('rover_recovery');
          }}
          onPracticeRun={() => {
            setAirbagPracticeMode(true);
            setPathfinderDialogueOpen(false);
            setActiveMinigame('rover_recovery');
          }}
          onClose={() => setPathfinderDialogueOpen(false)}
        />
      )}

      {ingenuityDialogueOpen && (
        <IngenuityDialogueModal
          missionAlreadyCompleted={stats.blindLandingMission.completed}
          rocketOuterPlatingRestored={stats.blindLandingMission.rocketOuterPlatingRestored}
          onAcceptMission={() => {
            setIngenuityDialogueOpen(false);
            setActiveMinigame('systems_repair');
          }}
          onPracticeRun={() => {
            setIngenuityDialogueOpen(false);
            setActiveMinigame('systems_repair');
          }}
          onClose={() => setIngenuityDialogueOpen(false)}
        />
      )}

      {activeMinigame === 'rover_recovery' && (
        <MarsAirbagRunModal
          isPracticeMode={airbagPracticeMode}
          onMissionSuccess={handleCompleteAirbagMission}
          onExitToMars={() => {
            setAirbagPracticeMode(false);
            setActiveMinigame(null);
          }}
        />
      )}

      {activeMinigame === 'systems_repair' && (
        <BlindLandingModal
          alreadyCompleted={stats.blindLandingMission.completed}
          onMissionSuccess={handleCompleteBlindLanding}
          onExitToMars={() => setActiveMinigame(null)}
        />
      )}

      {activeMinigame === 'lunar_rover_run' && (
        <LunarRoverRunModal
          alreadyCompleted={stats.lunarMission.rocketFuelRecovered}
          onMissionSuccess={handleCompleteLunarRoverRun}
          onExitToMoon={() => setActiveMinigame(null)}
        />
      )}

      {/* Opening Story Cutscene */}
      {gameState === 'INTRO_CUTSCENE' && (
        <IntroCutscene
          muted={audioSettings.muted}
          onToggleMute={handleToggleMasterMute}
          onComplete={() => {
            syncStatsToReact();
            setIntroVeil('solid');
            setGameState('PLAYING');
            soundFX.playSolDawn();
          }}
        />
      )}

      {/* Chapter 2 Emergency Lunar Detour Cutscene */}
      {gameState === 'CHAPTER2_CUTSCENE' && (
        <Chapter2Cutscene
          muted={audioSettings.muted}
          onToggleMute={handleToggleMasterMute}
          onComplete={handleCompleteChapter2}
        />
      )}

      {/* Finale Earth Return Cutscene ("Cosmo Boy: The Unlikely Return") */}
      {gameState === 'EARTH_RETURN_CUTSCENE' && (
        <EarthReturnCutscene
          muted={audioSettings.muted}
          onToggleMute={handleToggleMasterMute}
          onComplete={() => {
            soundFX.playVictory();
            setGameState('VICTORY');
          }}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="pixel-panel-dark w-full max-w-md p-6 sm:p-7 text-stone-100 space-y-4">
            <h2 className="font-pixel text-xl text-[#e8cf79]">Mission Paused</h2>
            <div className="text-xs text-stone-300 space-y-1 font-mono-tabular">
              <div>
                Sector: {stats.planet === 'moon' ? 'Luna · Apollo Wreckage Sector' : 'Mars · Crash Site'}
              </div>
              <div>Sol: {stats.sol}</div>
              {stats.planet === 'moon' ? (
                <>
                  <div>
                    Apollo Pu-238: {stats.lunarMission.plutoniumCollected} / 4 · RTG:{' '}
                    {stats.lunarMission.rtgPowered ? 'ON' : 'OFF'}
                  </div>
                  <div>
                    Rover: {stats.lunarMission.roverCharged ? 'CHARGED' : 'LOW'} · Rocket Fuel:{' '}
                    {stats.lunarMission.rocketFueled
                      ? 'LOADED'
                      : stats.lunarMission.rocketFuelRecovered
                        ? 'RECOVERED'
                        : '0/1'}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    Missions Complete:{' '}
                    {(stats.pathfinderMission.rocketCushioningRestored ? 1 : 0) +
                      (stats.blindLandingMission.rocketOuterPlatingRestored ? 1 : 0)}{' '}
                    / 2
                  </div>
                  <div>
                    Cushioning {stats.rocket.cushioning}% · Outer Plating {stats.rocket.outerPlating}%
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="pixel-btn flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-xs font-semibold cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => resetGame(false)}
                className="pixel-btn flex-1 bg-[#464c54] hover:bg-[#565d67] text-stone-100 py-2 text-xs font-semibold cursor-pointer"
              >
                Restart Mission
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFX.playUiClick();
                setGameState(stats.planet === 'moon' ? 'CHAPTER2_CUTSCENE' : 'INTRO_CUTSCENE');
              }}
              className="pixel-btn w-full bg-[#343940] hover:bg-[#434952] text-stone-200 py-2 text-xs font-medium cursor-pointer"
            >
              {stats.planet === 'moon' ? 'Replay Chapter 2 Detour' : 'Replay Story Intro'}
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === 'GAME_OVER' && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="pixel-panel-dark w-full max-w-lg p-6 sm:p-7 text-stone-100 space-y-4">
            <h2 className="font-pixel text-xl text-rose-400">Suit Oxygen Depleted</h2>
            <p className="text-xs text-stone-300 leading-relaxed">
              {stats.planet === 'moon'
                ? 'Your EVA suit reserves ran dry far from the Ares IV Lunar Landing Pad. Return to the lander life-support ring periodically while scouring the Apollo crash sites.'
                : 'Your EVA suit reserves ran dry far from the Crash Site. Return to the Ares IV life-support ring periodically while completing your recovery missions.'}
            </p>
            <div className="bg-[#23262a] border border-[#3a3f46] p-3 text-xs font-mono-tabular grid grid-cols-2 gap-2">
              <div>Sols Survived: {stats.sol}</div>
              <div>
                Sector: {stats.planet === 'moon' ? 'Luna · Apollo Wreckage Sector' : 'Mars · Crash Site'}
              </div>
            </div>
            {stats.planet === 'moon' ? (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const freshMoon = createMoonWorld(worldRef.current.stats);
                    worldRef.current = freshMoon;
                    particlesRef.current = [];
                    camRef.current = { x: freshMoon.player.x, y: freshMoon.player.y };
                    syncStatsToReact();
                    saveWorldProgress(freshMoon);
                    setGameState('PLAYING');
                    soundFX.playSolDawn();
                  }}
                  className="pixel-btn flex-1 bg-sky-600 hover:bg-sky-500 text-white font-pixel text-xs py-2.5 cursor-pointer"
                >
                  Respawn at Lunar Pad
                </button>
                <button
                  type="button"
                  onClick={() => resetGame(false)}
                  className="pixel-btn bg-[#464c54] hover:bg-[#565d67] text-stone-100 font-pixel text-xs px-4 py-2.5 cursor-pointer"
                >
                  Restart Mars
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => resetGame(false)}
                className="pixel-btn w-full bg-orange-600 hover:bg-orange-500 text-white font-pixel text-sm py-2.5 cursor-pointer"
              >
                Play Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {gameState === 'VICTORY' && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="pixel-panel-dark w-full max-w-lg p-6 sm:p-7 text-stone-100 space-y-4">
            <h2 className="font-pixel text-xl text-emerald-400">Homebound to Earth!</h2>
            <p className="text-xs text-stone-300 leading-relaxed">
              After rebuilding Ares IV on Mars, locating Earth via Kepler&apos;s telescope,
              gathering Apollo Plutonium-238 to power the RTG and charge the Lunar Rover, and
              recovering cryogenic rocket fuel from Lunar Fuel Base 02, you blasted off the Moon
              for Earth!
            </p>
            <div className="bg-[#23262a] border border-[#3a3f46] p-3 text-xs font-mono-tabular grid grid-cols-2 gap-2">
              <div>Escape Sol: {stats.sol}</div>
              <div>Apollo Pu-238: 4/4</div>
              <div>Lunar Fuel Base: Cleared</div>
              <div>Destination: Earth</div>
            </div>
            <button
              type="button"
              onClick={() => resetGame(false)}
              className="pixel-btn w-full bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-sm py-2.5 cursor-pointer"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      {introVeil !== 'hidden' && (
        <div
          className={`pointer-events-none fixed inset-0 z-50 bg-[#080404] transition-opacity duration-900 ease-out ${
            introVeil === 'fading' ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
    </div>
  );
}
