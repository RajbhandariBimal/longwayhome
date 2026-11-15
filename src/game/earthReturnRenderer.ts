// Native 480x270 16-bit SNES/GBA pixel-art renderer for "Cosmo Boy: The Unlikely Return"

export const ER_W = 480;
export const ER_H = 270;
export const ER_DURATION = 27.0;

export interface CutsceneSceneMeta {
  id: '07' | '08' | '09' | '10';
  shortLabel: string;
  title: string;
  start: number;
  end: number;
  narrationLines: [string, string];
}

export const EARTH_RETURN_SCENES: CutsceneSceneMeta[] = [
  {
    id: '07',
    shortLabel: '07 · Re-entry',
    title: 'Scene 07 · Atmospheric Re-entry',
    start: 0.0,
    end: 6.5,
    narrationLines: [
      "Cosmo Boy's spacecraft breaks through",
      "Earth's atmosphere for final descent.",
    ],
  },
  {
    id: '08',
    shortLabel: '08 · Breaking News',
    title: 'Scene 08 · Breaking News',
    start: 6.5,
    end: 14.5,
    narrationLines: [
      'Networks broadcast the unlikely return',
      'of Cosmo Boy across the globe.',
    ],
  },
  {
    id: '09',
    shortLabel: '09 · Touchdown',
    title: 'Scene 09 · Touchdown at HQ',
    start: 14.5,
    end: 20.0,
    narrationLines: [
      'Retro-thrusters ignite as the capsule',
      'lands safely at NASA Headquarters.',
    ],
  },
  {
    id: '10',
    shortLabel: "10 · Hero's Welcome",
    title: "Scene 10 · Hero's Welcome",
    start: 20.0,
    end: 27.0,
    narrationLines: [
      'Engineers and crowds cheer as Cosmo Boy',
      'steps onto home soil at last.',
    ],
  },
];

export function getSceneAtTime(t: number): CutsceneSceneMeta {
  for (let i = EARTH_RETURN_SCENES.length - 1; i >= 0; i--) {
    if (t >= EARTH_RETURN_SCENES[i].start) return EARTH_RETURN_SCENES[i];
  }
  return EARTH_RETURN_SCENES[0];
}

const INK = '#0b0f19';

// Crisp 4x5 pixel bitmap glyphs for authentic anti-alias-free in-world pixel typography
const FONT_4X5: Record<string, string[]> = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  B: ['1110', '1001', '1110', '1001', '1110'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  D: ['1110', '1001', '1001', '1001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['0111', '1000', '1011', '1001', '0111'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  I: ['1110', '0100', '0100', '0100', '1110'],
  J: ['0011', '0001', '0001', '1001', '0110'],
  K: ['1001', '1010', '1100', '1010', '1001'],
  L: ['1000', '1000', '1000', '1000', '1111'],
  M: ['1001', '1111', '1111', '1001', '1001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  P: ['1110', '1001', '1110', '1000', '1000'],
  Q: ['0110', '1001', '1001', '1011', '0111'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  T: ['1111', '0100', '0100', '0100', '0100'],
  U: ['1001', '1001', '1001', '1001', '0110'],
  V: ['1001', '1001', '1001', '0110', '0110'],
  W: ['1001', '1001', '1111', '1111', '1001'],
  X: ['1001', '1001', '0110', '1001', '1001'],
  Y: ['1001', '1001', '0110', '0100', '0100'],
  Z: ['1111', '0010', '0100', '1000', '1111'],
  '0': ['0110', '1011', '1001', '1101', '0110'],
  '1': ['0100', '1100', '0100', '0100', '1110'],
  '2': ['1110', '0001', '0110', '1000', '1111'],
  '3': ['1110', '0001', '0110', '0001', '1110'],
  '4': ['1001', '1001', '1111', '0001', '0001'],
  '5': ['1111', '1000', '1110', '0001', '1110'],
  '6': ['0111', '1000', '1110', '1001', '0110'],
  '7': ['1111', '0001', '0010', '0100', '0100'],
  '8': ['0110', '1001', '0110', '1001', '0110'],
  '9': ['0110', '1001', '0111', '0001', '1110'],
  ':': ['0000', '0100', '0000', '0100', '0000'],
  '.': ['0000', '0000', '0000', '0000', '0100'],
  ',': ['0000', '0000', '0000', '0100', '1000'],
  '!': ['0100', '0100', '0100', '0000', '0100'],
  '-': ['0000', '0000', '1110', '0000', '0000'],
  '+': ['0000', '0100', '1110', '0100', '0000'],
  '/': ['0001', '0010', '0100', '1000', '0000'],
  '|': ['0100', '0100', '0100', '0100', '0100'],
  '·': ['0000', '0000', '0100', '0000', '0000'],
  ' ': ['0000', '0000', '0000', '0000', '0000'],
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  outlineColor?: string,
  align: 'left' | 'center' | 'right' = 'left'
) {
  const upper = text.toUpperCase();
  const charAdvance = 5 * scale;
  const totalW = Math.max(0, upper.length * charAdvance - scale);
  let startX = Math.round(x);
  if (align === 'center') startX = Math.round(x - totalW / 2);
  else if (align === 'right') startX = Math.round(x - totalW);
  const startY = Math.round(y);

  const drawPass = (ox: number, oy: number, c: string) => {
    ctx.fillStyle = c;
    for (let i = 0; i < upper.length; i++) {
      const glyph = FONT_4X5[upper[i]] ?? FONT_4X5[' '];
      const gx = startX + i * charAdvance + ox;
      for (let r = 0; r < 5; r++) {
        const row = glyph[r];
        for (let col = 0; col < 4; col++) {
          if (row[col] === '1') {
            ctx.fillRect(gx + col * scale, startY + r * scale + oy, scale, scale);
          }
        }
      }
    }
  };

  if (outlineColor) {
    const o = Math.max(1, Math.floor(scale));
    drawPass(-o, 0, outlineColor);
    drawPass(o, 0, outlineColor);
    drawPass(0, -o, outlineColor);
    drawPass(0, o, outlineColor);
    drawPass(-o, -o, outlineColor);
    drawPass(o, -o, outlineColor);
    drawPass(-o, o, outlineColor);
    drawPass(o, o, outlineColor);
  }
  drawPass(0, 0, color);
}

/** 16-bit cel-shaded Cosmo Boy sprite with PLSS backpack, NASA stripes, golden visor & walk/wave poses */
function drawCosmoBoy(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  opts: {
    walkPhase?: number; // 0..1 when walking, undefined when standing
    waving?: boolean;
    wavePhase?: number;
    facing?: 1 | -1;
    scale?: number;
  } = {}
) {
  const s = opts.scale ?? 1;
  const x = Math.round(cx);
  const y = Math.round(bottomY);
  const facing = opts.facing ?? 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);

  const wf = opts.walkPhase !== undefined ? Math.floor(opts.walkPhase * 4) % 4 : -1;
  const bob = wf === 1 || wf === 3 ? -1 : 0;

  // Ground shadow
  px(ctx, -8, -1, 16, 2, 'rgba(11, 15, 25, 0.45)');

  // PLSS Life-support backpack (behind torso)
  px(ctx, -9, -25 + bob, 6, 13, INK);
  px(ctx, -8, -24 + bob, 4, 11, '#94a3b8');
  px(ctx, -8, -24 + bob, 2, 11, '#e2e8f0');
  px(ctx, -7, -22 + bob, 2, 2, '#ea580c'); // orange telemetry strip
  px(ctx, -7, -27 + bob, 1, 3, '#64748b'); // pack antenna

  // Legs & dark-slate boots (4-frame walk cycle or planted stance)
  let leftLegX = -5;
  let rightLegX = 1;
  let leftLegY = 0;
  let rightLegY = 0;
  if (wf === 0) {
    leftLegX = -7;
    rightLegX = 3;
  } else if (wf === 1) {
    leftLegX = -4;
    rightLegX = 1;
    rightLegY = -2;
  } else if (wf === 2) {
    leftLegX = 2;
    rightLegX = -6;
  } else if (wf === 3) {
    leftLegX = -2;
    rightLegX = 0;
    leftLegY = -2;
  }

  // Left Leg
  px(ctx, leftLegX - 1, -11 + leftLegY, 6, 11, INK);
  px(ctx, leftLegX, -10 + leftLegY, 4, 6, '#cbd5e1');
  px(ctx, leftLegX, -10 + leftLegY, 2, 6, '#f8fafc');
  px(ctx, leftLegX, -4 + leftLegY, 5, 4, '#1e293b');
  px(ctx, leftLegX, -4 + leftLegY, 4, 1, '#475569');

  // Right Leg
  px(ctx, rightLegX - 1, -11 + rightLegY, 6, 11, INK);
  px(ctx, rightLegX, -10 + rightLegY, 4, 6, '#94a3b8');
  px(ctx, rightLegX, -10 + rightLegY, 2, 6, '#f8fafc');
  px(ctx, rightLegX, -4 + rightLegY, 5, 4, '#1e293b');
  px(ctx, rightLegX, -4 + rightLegY, 4, 1, '#475569');

  // Torso (rounded shaded white suit + blue/orange NASA markings)
  px(ctx, -6, -24 + bob, 13, 14, INK);
  px(ctx, -5, -23 + bob, 11, 12, '#cbd5e1');
  px(ctx, -5, -23 + bob, 8, 10, '#f8fafc');
  px(ctx, -5, -14 + bob, 11, 2, '#94a3b8'); // hip shadow
  // Chest control module & NASA stripes
  px(ctx, -2, -21 + bob, 6, 5, '#475569');
  px(ctx, -1, -20 + bob, 4, 3, '#e2e8f0');
  px(ctx, -1, -20 + bob, 2, 1, '#2563eb'); // NASA blue accent
  px(ctx, 2, -20 + bob, 1, 1, '#ea580c'); // NASA orange indicator
  px(ctx, -5, -22 + bob, 2, 2, '#2563eb'); // shoulder patch

  // Helmet (rounded cel-shaded dome + golden reflective visor + white glint)
  px(ctx, -7, -37 + bob, 15, 14, INK);
  px(ctx, -6, -36 + bob, 13, 12, '#cbd5e1');
  px(ctx, -6, -36 + bob, 10, 9, '#f8fafc');
  // Collar ring
  px(ctx, -5, -25 + bob, 11, 2, '#64748b');
  px(ctx, -4, -25 + bob, 8, 1, '#94a3b8');
  // Curved golden-amber reflective visor (#b45309, #f59e0b, #fde047)
  px(ctx, -2, -34 + bob, 9, 8, INK);
  px(ctx, -1, -33 + bob, 7, 6, '#b45309');
  px(ctx, -1, -33 + bob, 6, 5, '#f59e0b');
  px(ctx, 0, -33 + bob, 4, 3, '#fde047');
  px(ctx, 0, -33 + bob, 2, 2, '#ffffff'); // bright white specular reflection glint

  // Front Arm (waving heroically or swinging during walk)
  if (opts.waving) {
    const waveOffset = Math.round(Math.sin((opts.wavePhase ?? 0) * 10) * 2.2);
    px(ctx, 5, -31 + bob + waveOffset, 5, 11, INK);
    px(ctx, 6, -30 + bob + waveOffset, 3, 7, '#f8fafc');
    px(ctx, 6, -32 + bob + waveOffset, 4, 3, INK);
    px(ctx, 6, -31 + bob + waveOffset, 3, 2, '#475569'); // dark glove
  } else {
    const armSwing = wf === 0 ? -2 : wf === 2 ? 2 : 0;
    px(ctx, -5 + armSwing, -22 + bob, 5, 10, INK);
    px(ctx, -4 + armSwing, -21 + bob, 3, 6, '#f8fafc');
    px(ctx, -4 + armSwing, -15 + bob, 3, 3, '#1e293b'); // glove
  }

  ctx.restore();
}

/** 16-bit Spacecraft (horizontal for atmospheric entry or vertical lander for HQ touchdown/plaza) */
function drawSpacecraft(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  opts: {
    mode: 'entry_diag' | 'vertical_lander';
    thrusterLevel?: number; // 0..1
    legsDeployed?: boolean;
    hatchOpen?: boolean;
    timeSec: number;
    scale?: number;
  }
) {
  const s = opts.scale ?? 1;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.scale(s, s);

  if (opts.mode === 'entry_diag') {
    // Tilted side-view shuttle/spacecraft diving diagonally toward bottom-right
    ctx.rotate(0.48);

    // Thruster / rear exhaust plume
    if ((opts.thrusterLevel ?? 0) > 0.05) {
      const f = 14 + Math.sin(opts.timeSec * 38) * 5;
      px(ctx, -38 - f, -6, f + 12, 12, '#c2410c');
      px(ctx, -34 - f * 0.75, -5, f * 0.75 + 8, 10, '#f97316');
      px(ctx, -30 - f * 0.5, -3, f * 0.5 + 5, 6, '#fde047');
      px(ctx, -27 - f * 0.25, -2, f * 0.25 + 3, 4, '#fefce8');
    }

    // Top tail fin
    px(ctx, -24, -18, 12, 10, INK);
    px(ctx, -23, -17, 9, 8, '#cbd5e1');
    px(ctx, -21, -16, 4, 6, '#ea580c');

    // Main sleek shuttle fuselage (3-tone white/slate ramp + ink outline)
    px(ctx, -26, -10, 56, 20, INK);
    px(ctx, -25, -9, 52, 18, '#e2e8f0');
    px(ctx, -24, -9, 46, 8, '#f8fafc'); // top highlight
    px(ctx, -25, 2, 52, 7, '#64748b'); // cool underside shadow
    px(ctx, -25, 0, 48, 3, '#94a3b8');

    // Nose cone heat shield cap
    px(ctx, 22, -7, 10, 14, INK);
    px(ctx, 22, -6, 8, 12, '#334155');
    px(ctx, 27, -4, 4, 8, '#f97316'); // glowing hot plasma nose

    // Mission stripes (orange-red & blue)
    px(ctx, -14, -4, 20, 2, '#2563eb');
    px(ctx, -14, -1, 20, 2, '#ea580c');

    // Glowing cyan cockpit window with bright glint
    px(ctx, 8, -8, 11, 7, INK);
    px(ctx, 9, -7, 9, 5, '#0284c7');
    px(ctx, 10, -7, 7, 4, '#38bdf8');
    px(ctx, 11, -6, 3, 2, '#bae6fd');
  } else {
    // Vertical capsule / lander oriented upright
    const legs = opts.legsDeployed ?? true;

    // Stepped retro-thruster flames below nozzles
    if ((opts.thrusterLevel ?? 0) > 0.05) {
      const fLen = Math.round((18 + Math.sin(opts.timeSec * 42) * 5) * (opts.thrusterLevel ?? 1));
      for (const nx of [-10, 10]) {
        px(ctx, nx - 5, 18, 10, fLen, '#c2410c');
        px(ctx, nx - 4, 18, 8, Math.round(fLen * 0.78), '#f97316');
        px(ctx, nx - 3, 18, 6, Math.round(fLen * 0.54), '#fde047');
        px(ctx, nx - 2, 18, 4, Math.round(fLen * 0.3), '#fefce8');
      }
    }

    if (legs) {
      // Left outrigger strut
      for (let i = 0; i < 12; i++) {
        px(ctx, -14 - i, 7 + i, 4, 3, INK);
        px(ctx, -13 - i, 8 + i, 2, 2, '#475569');
      }
      px(ctx, -30, 18, 9, 4, INK);
      px(ctx, -29, 19, 7, 2, '#475569');

      // Right outrigger strut
      for (let i = 0; i < 12; i++) {
        px(ctx, 10 + i, 7 + i, 4, 3, INK);
        px(ctx, 11 + i, 8 + i, 2, 2, '#475569');
      }
      px(ctx, 21, 18, 9, 4, INK);
      px(ctx, 22, 19, 7, 2, '#1e293b');
    }

    // Engine bells
    px(ctx, -14, 12, 8, 6, INK);
    px(ctx, -13, 13, 6, 4, '#475569');
    px(ctx, 6, 12, 8, 6, INK);
    px(ctx, 7, 13, 6, 4, '#475569');

    // Main conical/cylindrical white spacecraft hull (4-tone cel ramp)
    // Top nose cap
    px(ctx, -8, -32, 16, 6, INK);
    px(ctx, -7, -31, 14, 5, '#e2e8f0');
    px(ctx, -6, -31, 7, 4, '#f8fafc');
    // Upper crew module
    px(ctx, -14, -26, 28, 18, INK);
    px(ctx, -13, -25, 26, 16, '#cbd5e1');
    px(ctx, -13, -25, 16, 16, '#f8fafc');
    px(ctx, 6, -25, 7, 16, '#64748b'); // cool right flank shadow
    // Lower service bay
    px(ctx, -18, -8, 36, 21, INK);
    px(ctx, -17, -7, 34, 19, '#e2e8f0');
    px(ctx, -17, -7, 19, 19, '#f8fafc');
    px(ctx, 6, -7, 11, 19, '#64748b');
    px(ctx, 2, -7, 4, 19, '#94a3b8');

    // Orange-red & blue NASA mission stripes
    px(ctx, -17, -4, 34, 2, '#2563eb');
    px(ctx, -17, -1, 34, 2, '#ea580c');

    // Glowing cyan cockpit window with #bae6fd glint
    px(ctx, -9, -21, 14, 9, INK);
    px(ctx, -8, -20, 12, 7, '#0284c7');
    px(ctx, -7, -20, 9, 5, '#38bdf8');
    px(ctx, -6, -19, 4, 2, '#bae6fd');

    // Open hatch & boarding ramp for Scene 10
    if (opts.hatchOpen) {
      px(ctx, -5, 2, 10, 10, INK);
      px(ctx, -4, 3, 8, 8, '#0f172a');
      // Boarding steps to ground
      px(ctx, -5, 12, 10, 9, INK);
      px(ctx, -4, 13, 8, 2, '#94a3b8');
      px(ctx, -4, 16, 8, 2, '#cbd5e1');
      px(ctx, -4, 19, 8, 2, '#64748b');
    }
  }

  ctx.restore();
}

type HumanVariant =
  | 'anchor'
  | 'engineer_polo'
  | 'engineer_jacket'
  | 'engineer_vest'
  | 'photographer';

/** Expressive 16-bit human sprites with distinct hair, skin ramp, blinking, talking, cheering & camera */
function drawHuman(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  variant: HumanVariant,
  opts: {
    timeSec: number;
    seed?: number;
    cheer?: boolean;
    talking?: boolean;
    scale?: number;
    facing?: 1 | -1;
  }
) {
  const s = opts.scale ?? 1;
  const seed = opts.seed ?? 1;
  const blink = Math.floor((opts.timeSec + seed * 0.7) * 1.4) % 7 === 0 && (opts.timeSec * 10) % 7 < 1.2;
  const jump = opts.cheer ? Math.max(0, Math.round(Math.sin(opts.timeSec * 9 + seed * 1.7) * 3)) : 0;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(bottomY - jump));
  ctx.scale((opts.facing ?? 1) * s, s);

  const skinHighlight = seed % 3 === 1 ? '#d99a74' : '#fbd3b6';
  const skinMid = seed % 3 === 1 ? '#b87654' : '#e6a982';

  if (variant === 'anchor') {
    // Larger studio portrait anchor behind desk (drawn from waist up)
    // Tailored navy blazer + white blouse
    px(ctx, -18, -32, 36, 32, INK);
    px(ctx, -17, -31, 34, 30, '#1e3a8a'); // blazer mid
    px(ctx, -17, -31, 14, 30, '#2548a8'); // highlight shoulder
    px(ctx, 6, -31, 11, 30, '#172554'); // cool shadow
    // White blouse collar V-neck
    px(ctx, -7, -31, 14, 16, '#f8fafc');
    px(ctx, -4, -31, 8, 12, '#e2e8f0');
    px(ctx, -6, -31, 3, 10, '#172554'); // blazer lapel L
    px(ctx, 3, -31, 3, 10, '#172554'); // blazer lapel R
    // Neck
    px(ctx, -4, -36, 8, 6, INK);
    px(ctx, -3, -35, 6, 5, skinMid);
    // Head + chestnut bob hair
    px(ctx, -12, -57, 24, 22, INK);
    px(ctx, -11, -56, 22, 16, '#7c2d12'); // hair back
    px(ctx, -10, -56, 18, 6, '#9a3412'); // hair highlight
    // Face
    px(ctx, -8, -50, 16, 14, skinMid);
    px(ctx, -7, -50, 12, 12, skinHighlight);
    // Hair bangs framing face
    px(ctx, -10, -54, 5, 11, '#7c2d12');
    px(ctx, 6, -54, 4, 11, '#451a03');
    // Eyes (blink every few seconds)
    if (blink) {
      px(ctx, -5, -45, 3, 1, INK);
      px(ctx, 2, -45, 3, 1, INK);
    } else {
      px(ctx, -5, -46, 3, 3, '#ffffff');
      px(ctx, -4, -45, 2, 2, INK);
      px(ctx, 2, -46, 3, 3, '#ffffff');
      px(ctx, 3, -45, 2, 2, INK);
    }
    // Expressive lip-syncing mouth
    const mouthOpen = opts.talking && Math.sin(opts.timeSec * 18) > -0.15;
    if (mouthOpen) {
      px(ctx, -2, -40, 5, 3, '#9f1239');
      px(ctx, -1, -40, 3, 1, '#fecdd3');
    } else {
      px(ctx, -2, -39, 4, 1, '#9f1239');
    }
    // Studio earpiece
    px(ctx, -9, -44, 2, 3, '#38bdf8');
    ctx.restore();
    return;
  }

  // Full-body 16-bit crowd/ground crew sprite
  // Legs
  px(ctx, -5, -11, 10, 11, INK);
  px(ctx, -4, -10, 4, 10, '#1e293b');
  px(ctx, 1, -10, 4, 10, '#334155');
  px(ctx, -4, -3, 4, 3, '#0f172a');
  px(ctx, 1, -3, 4, 3, '#0f172a');

  // Torso by variant
  px(ctx, -6, -22, 12, 12, INK);
  if (variant === 'engineer_polo') {
    px(ctx, -5, -21, 10, 10, '#f8fafc');
    px(ctx, -5, -21, 4, 10, '#e2e8f0');
    px(ctx, 1, -19, 3, 2, '#2563eb'); // NASA pocket logo
  } else if (variant === 'engineer_jacket') {
    px(ctx, -5, -21, 10, 10, '#1d4ed8'); // blue NASA flight jacket
    px(ctx, 1, -21, 4, 10, '#1e3a8a');
    px(ctx, -2, -21, 4, 10, '#cbd5e1');
  } else if (variant === 'engineer_vest') {
    px(ctx, -5, -21, 10, 10, '#f8fafc');
    px(ctx, -4, -21, 8, 9, '#f97316'); // high-vis safety vest
    px(ctx, -4, -15, 8, 2, '#fde047');
  } else {
    // Press photographer jacket
    px(ctx, -5, -21, 10, 10, '#475569');
    px(ctx, 1, -21, 4, 10, '#334155');
  }

  // Arms (raised when cheering, or holding camera for photographer)
  if (opts.cheer && variant !== 'photographer') {
    const wave = Math.round(Math.sin(opts.timeSec * 12 + seed) * 2);
    px(ctx, -9, -27 + wave, 4, 8, INK);
    px(ctx, -8, -26 + wave, 2, 6, skinHighlight);
    px(ctx, 5, -27 - wave, 4, 8, INK);
    px(ctx, 6, -26 - wave, 2, 6, skinHighlight);
  } else if (variant === 'photographer') {
    // Camera held up with lens
    px(ctx, -2, -21, 9, 7, INK);
    px(ctx, -1, -20, 7, 5, '#1e293b');
    px(ctx, 2, -19, 3, 3, '#38bdf8');
    px(ctx, -1, -22, 3, 2, '#e2e8f0'); // flash bulb
  } else {
    px(ctx, -8, -21, 3, 8, INK);
    px(ctx, -7, -20, 2, 6, skinMid);
    px(ctx, 5, -21, 3, 8, INK);
    px(ctx, 5, -20, 2, 6, skinMid);
  }

  // Head + distinct hairstyles
  px(ctx, -5, -31, 10, 10, INK);
  px(ctx, -4, -30, 8, 8, skinHighlight);
  const hairColors = ['#1e293b', '#78350f', '#b45309', '#451a03'];
  const hc = hairColors[seed % hairColors.length];
  px(ctx, -4, -31, 8, 3, hc);
  if (seed % 2 === 0) px(ctx, -4, -29, 2, 3, hc);

  // Eyes & cheering mouth
  if (!blink) {
    px(ctx, -2, -27, 1, 2, INK);
    px(ctx, 2, -27, 1, 2, INK);
  } else {
    px(ctx, -2, -27, 1, 1, INK);
    px(ctx, 2, -27, 1, 1, INK);
  }
  if (opts.cheer) {
    px(ctx, -1, -24, 3, 2, '#9f1239');
  }

  // Headset on engineers
  if (variant === 'engineer_vest' || variant === 'engineer_polo') {
    px(ctx, -6, -29, 2, 5, '#f59e0b');
    px(ctx, -5, -25, 4, 1, '#94a3b8');
  }

  ctx.restore();
}

/** Scene 07 (0.0s - 6.5s): Atmospheric Re-entry */
function renderScene07(ctx: CanvasRenderingContext2D, t: number) {
  // Deep space sky
  px(ctx, 0, 0, ER_W, ER_H, '#050814');

  // Crisp twinkling starfield
  for (let i = 0; i < 65; i++) {
    const sx = (i * 73 + 19) % ER_W;
    const sy = (i * 41 + 7) % 185;
    const twinkle = Math.sin(t * 4 + i) > 0.65;
    px(ctx, sx, sy, twinkle ? 2 : 1, twinkle ? 2 : 1, i % 5 === 0 ? '#bae6fd' : '#f8fafc');
  }

  // Distant Mars sphere in upper-right distance
  const mx = 398;
  const my = 44;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(mx, my, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(mx, my, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(mx - 2, my - 2, 8, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, mx - 5, my - 4, 4, 3, '#fb923c');

  // Curved Earth Horizon below (cyan limb + cobalt ocean + green landmasses + drifting clouds)
  const earthCx = 250;
  const earthCy = 665;
  const earthR = 520;

  // Atmospheric cyan glow limb
  ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthR + 12, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthR + 5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();

  // Cobalt ocean dome
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthR, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(earthCx - 20, earthCy + 8, earthR - 10, Math.PI * 1.2, Math.PI * 1.8);
  ctx.fill();

  // Pixel landmasses & drifting clouds on Earth
  ctx.save();
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthR - 1, Math.PI * 1.15, Math.PI * 1.85);
  ctx.clip();

  const landShift = Math.round(t * 8);
  px(ctx, 60 - landShift, 178, 86, 40, '#15803d');
  px(ctx, 72 - landShift, 172, 62, 24, '#22c55e');
  px(ctx, 250 - landShift, 162, 110, 48, '#15803d');
  px(ctx, 265 - landShift, 158, 78, 28, '#22c55e');
  px(ctx, 390 - landShift, 190, 80, 35, '#16a34a');

  const cloudShift = Math.round(t * 14);
  for (let c = 0; c < 6; c++) {
    const cx = ((c * 95 - cloudShift) % 520 + 520) % 520 - 30;
    const cy = 166 + (c % 3) * 14;
    px(ctx, cx, cy, 42, 6, '#e2e8f0');
    px(ctx, cx + 6, cy - 3, 24, 4, '#ffffff');
  }
  ctx.restore();

  // Plunging Side-View Spacecraft + Plasma Bow-Shock Sparks + Hull Vibration
  const p = Math.min(1, t / 6.5);
  const vibX = Math.round(Math.sin(t * 58) * (p > 0.2 ? 1.5 : 0));
  const vibY = Math.round(Math.cos(t * 47) * (p > 0.2 ? 1.5 : 0));
  const shipX = Math.round(118 + p * 185 + vibX);
  const shipY = Math.round(52 + p * 102 + vibY);

  // Fiery plasma bow-shock trail & nose envelope
  const plasmaGlow = Math.sin(Math.min(1, p * 1.15) * Math.PI);
  if (plasmaGlow > 0.1) {
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(0.48);
    // Layered heat plasma envelope wrapping nose & underside
    px(ctx, -40, -14, 78, 28, 'rgba(194, 65, 12, 0.35)');
    px(ctx, -18, -11, 56, 24, 'rgba(249, 115, 22, 0.45)');
    px(ctx, 18, -9, 20, 18, '#fde047');
    px(ctx, 28, -5, 8, 10, '#fefce8');
    ctx.restore();

    // Streaming sparks peeled off the heatshield
    for (let s = 0; s < 22; s++) {
      const age = ((t * 2.2 + s * 0.19) % 1);
      const sx = Math.round(shipX + 18 - age * (95 + (s % 4) * 16) + vibX);
      const sy = Math.round(shipY + 6 - age * (46 + (s % 3) * 9) + Math.sin(s * 3 + t * 12) * 5);
      const sparkColors = ['#fefce8', '#fde047', '#f97316', '#c2410c'];
      const col = sparkColors[Math.min(3, Math.floor(age * 4))];
      px(ctx, sx, sy, age < 0.3 ? 4 : 2, 2, col);
    }
  }

  drawSpacecraft(ctx, shipX, shipY, {
    mode: 'entry_diag',
    thrusterLevel: 0.7,
    timeSec: t,
    scale: 1,
  });

  // Top-Left Gold-Bordered Telemetry HUD
  const hx = 12;
  const hy = 12;
  const hw = 152;
  const hh = 74;
  px(ctx, hx, hy, hw, hh, 'rgba(9, 14, 28, 0.9)');
  px(ctx, hx, hy, hw, 1, '#f59e0b');
  px(ctx, hx, hy + hh - 1, hw, 1, '#f59e0b');
  px(ctx, hx, hy, 1, hh, '#f59e0b');
  px(ctx, hx + hw - 1, hy, 1, hh, '#f59e0b');

  drawPixelText(ctx, 'ENTRY TELEMETRY', hx + 6, hy + 6, '#fde047', 1);
  const shieldPeak = t < 4.5;
  drawPixelText(
    ctx,
    shieldPeak ? 'HEATSHIELD: PEAK' : 'HEATSHIELD: NOMINAL',
    hx + 6,
    hy + 15,
    shieldPeak ? '#f97316' : '#4ade80',
    1
  );

  // Animated cyan telemetry sine wave
  px(ctx, hx + 6, hy + 25, 86, 20, '#0f172a');
  px(ctx, hx + 6, hy + 35, 86, 1, '#1e293b');
  for (let wx = 0; wx < 84; wx += 2) {
    const wy = hy + 35 + Math.round(Math.sin(wx * 0.16 - t * 8) * (shieldPeak ? 7 : 4));
    px(ctx, hx + 7 + wx, wy, 2, 2, '#38bdf8');
  }

  // Mini Capsule Schematic on right side of HUD
  px(ctx, hx + 102, hy + 24, 42, 34, '#0f172a');
  px(ctx, hx + 114, hy + 29, 18, 12, '#94a3b8');
  px(ctx, hx + 117, hy + 31, 12, 8, '#f8fafc');
  px(ctx, hx + 112, hy + 42, 22, 3, shieldPeak ? '#f97316' : '#38bdf8');
  drawPixelText(ctx, 'ARES-IV', hx + 106, hy + 49, '#94a3b8', 1);

  drawPixelText(ctx, 'TARGET: NASA HQ', hx + 6, hy + 62, '#bae6fd', 1);
}

/** Scene 08 (6.5s - 14.5s): Breaking News GNN Studio */
function renderScene08(ctx: CanvasRenderingContext2D, t: number) {
  const localT = t - 6.5;

  // Deep sapphire studio backdrop
  px(ctx, 0, 0, ER_W, ER_H, '#091534');
  // Subtle vertical broadcast studio wall panels
  for (let x = 0; x < ER_W; x += 40) {
    px(ctx, x, 0, 1, 210, '#0f2354');
  }

  // Glowing cyan dot-matrix pixel world map across back wall
  const mapRows = [
    '000011111000000011111111000000',
    '001111111100001111111111110000',
    '000111110000001111111111100000',
    '000011100000000111111110000000',
    '000001110000000011101100011000',
    '000001111000000011000000111100',
    '000000110000000010000000011000',
  ];
  const pulseCol = Math.sin(t * 3) > 0 ? '#0ea5e9' : '#0284c7';
  for (let r = 0; r < mapRows.length; r++) {
    for (let c = 0; c < mapRows[r].length; c++) {
      if (mapRows[r][c] === '1') {
        px(ctx, 42 + c * 13, 38 + r * 13, 5, 5, pulseCol);
        px(ctx, 43 + c * 13, 39 + r * 13, 2, 2, '#38bdf8');
      }
    }
  }

  // Top Micro-HUD bar
  px(ctx, 0, 0, ER_W, 18, '#0b1024');
  px(ctx, 0, 18, ER_W, 1, '#38bdf8');
  drawPixelText(ctx, '08 · BREAKING NEWS | GNN WORLDWIDE STUDIO', 10, 7, '#e2e8f0', 1);
  const satBlink = Math.floor(t * 2.5) % 2 === 0;
  px(ctx, 392, 6, 4, 4, satBlink ? '#ef4444' : '#7f1d1d');
  drawPixelText(ctx, 'SAT-LINK 04', 400, 6, '#38bdf8', 1);

  // Expressive Female News Anchor on left behind broadcast desk
  drawHuman(ctx, 118, 168, 'anchor', {
    timeSec: t,
    seed: 2,
    talking: true,
    scale: 1.55,
  });

  // Curved Studio Desk in front of anchor
  px(ctx, 18, 162, 200, 34, INK);
  px(ctx, 19, 163, 198, 6, '#38bdf8'); // illuminated cyan desk trim
  px(ctx, 19, 169, 198, 26, '#1e293b');
  px(ctx, 24, 174, 80, 14, '#0f172a');
  drawPixelText(ctx, 'GNN DESK', 34, 178, '#bae6fd', 1);

  // Metallic-framed Studio Monitor on right
  const mx = 236;
  const my = 32;
  const mw = 224;
  const mh = 136;
  px(ctx, mx, my, mw, mh, INK);
  px(ctx, mx + 2, my + 2, mw - 4, mh - 4, '#64748b'); // outer metal bevel
  px(ctx, mx + 4, my + 4, mw - 8, mh - 8, '#334155');
  px(ctx, mx + 7, my + 7, mw - 14, mh - 14, '#081126'); // inner screen

  // Monitor Scene: Curved Earth + descending spacecraft + smoke clouds
  const scrX = mx + 7;
  const scrY = my + 7;
  const scrW = mw - 14;
  const scrH = mh - 14;
  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  // Starlit sky inside monitor
  for (let i = 0; i < 16; i++) {
    px(ctx, scrX + ((i * 37) % scrW), scrY + ((i * 23) % 70), 1, 1, '#e2e8f0');
  }
  // Curved Earth bottom of monitor
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(scrX + 110, scrY + 235, 155, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(scrX + 55, scrY + 86, 52, 26);
  ctx.fillRect(scrX + 135, scrY + 90, 48, 22);

  // Descending spacecraft with smoke clouds on monitor
  const mShipY = scrY + 34 + Math.round(Math.sin(localT * 2.5) * 4);
  const mShipX = scrX + 114;
  for (let c = 0; c < 4; c++) {
    px(ctx, mShipX - 18 - c * 10, mShipY + 14 + c * 4, 14 - c * 2, 7, '#cbd5e1');
  }
  drawSpacecraft(ctx, mShipX, mShipY, {
    mode: 'vertical_lander',
    thrusterLevel: 0.75,
    legsDeployed: true,
    timeSec: t,
    scale: 0.72,
  });

  // Circular blue NASA emblem (top-left of monitor)
  const nx = scrX + 22;
  const ny = scrY + 22;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(nx, ny, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(nx, ny, 12, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, nx - 10, ny - 1, 20, 2, '#ef4444'); // red chevron vector
  drawPixelText(ctx, 'NASA', nx, ny - 4, '#ffffff', 1, undefined, 'center');

  // Cosmo Boy Portrait Inset (top-right of monitor)
  px(ctx, scrX + scrW - 46, scrY + 6, 40, 44, INK);
  px(ctx, scrX + scrW - 45, scrY + 7, 38, 42, '#1e293b');
  drawCosmoBoy(ctx, scrX + scrW - 26, scrY + 48, {
    waving: true,
    wavePhase: localT,
    scale: 1,
  });

  // Bold black-outlined "COSMO BOY RETURNS!" headline inside monitor
  drawPixelText(
    ctx,
    'COSMO BOY RETURNS!',
    scrX + scrW / 2,
    scrY + scrH - 18,
    '#fde047',
    2,
    INK,
    'center'
  );
  ctx.restore();

  // Breaking News Ribbon + Metallic Scrolling Ticker + GNN LIVE Badge (above bottom caption)
  px(ctx, 0, 184, ER_W, 13, '#dc2626');
  px(ctx, 0, 184, ER_W, 1, '#f87171');
  drawPixelText(ctx, 'BREAKING NEWS', 12, 188, '#ffffff', 1);
  drawPixelText(ctx, 'CAPSULE RE-ENTRY CONFIRMED', 120, 188, '#fef08a', 1);

  // Metallic slate ticker bar
  px(ctx, 0, 197, ER_W, 14, '#334155');
  px(ctx, 0, 197, ER_W, 1, '#94a3b8');
  const tickerText =
    '+++ EXCLUSIVE: ARES IV SURVIVES ENTRY +++ COSMO BOY RETURNS TO EARTH +++ NASA HQ RECOVERY TEAM READY +++';
  const tickerOffset = Math.round(localT * 52) % 420;
  drawPixelText(ctx, tickerText, 64 - tickerOffset, 202, '#f8fafc', 1);

  // GNN LIVE badge on left over ticker
  px(ctx, 0, 196, 58, 16, INK);
  px(ctx, 2, 197, 54, 14, '#1e293b');
  px(ctx, 6, 202, 4, 4, satBlink ? '#ef4444' : '#7f1d1d');
  drawPixelText(ctx, 'GNN LIVE', 13, 202, '#ffffff', 1);
}

/** Scene 09 (14.5s - 20.0s): Touchdown at NASA HQ */
function renderScene09(ctx: CanvasRenderingContext2D, t: number) {
  const localT = t - 14.5; // 0..5.5s

  // Dithered twilight/night sky
  px(ctx, 0, 0, ER_W, 206, '#0b1224');
  px(ctx, 0, 95, ER_W, 111, '#14203b');
  // 2x2 Bayer twilight horizon band
  for (let y = 88; y < 116; y += 2) {
    for (let x = (y % 4 === 0 ? 0 : 2); x < ER_W; x += 4) {
      px(ctx, x, y, 2, 2, y < 102 ? '#14203b' : '#1e2d4f');
    }
  }
  for (let i = 0; i < 34; i++) {
    px(ctx, (i * 83 + 11) % ER_W, (i * 29 + 5) % 85, 1, 1, '#e2e8f0');
  }

  // Sweeping golden searchlights
  ctx.save();
  for (const [bx, speed, amp, baseA] of [
    [68, 1.3, 0.25, -0.35],
    [295, 1.6, 0.28, -1.15],
  ] as [number, number, number, number][]) {
    const ang = baseA + Math.sin(t * speed) * amp;
    ctx.fillStyle = 'rgba(253, 224, 71, 0.14)';
    ctx.beginPath();
    ctx.moveTo(bx, 206);
    ctx.lineTo(bx + Math.cos(ang - 0.12) * 260, 206 + Math.sin(ang - 0.12) * 260);
    ctx.lineTo(bx + Math.cos(ang + 0.12) * 260, 206 + Math.sin(ang + 0.12) * 260);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Distant NASA perimeter skyline
  px(ctx, 0, 178, ER_W, 28, '#172238');

  // Left Launch Gantry Tower
  px(ctx, 26, 48, 32, 158, INK);
  px(ctx, 28, 50, 28, 156, '#334155');
  for (let gy = 56; gy < 200; gy += 16) {
    px(ctx, 29, gy, 26, 2, '#64748b');
    px(ctx, 30, gy + 2, 4, 12, '#0f172a');
    px(ctx, 48, gy + 2, 4, 12, '#0f172a');
  }
  // Service arm & blinking red warning light
  px(ctx, 56, 78, 34, 6, INK);
  px(ctx, 56, 79, 32, 4, '#64748b');
  px(ctx, 40, 42, 4, 6, Math.floor(t * 3) % 2 === 0 ? '#ef4444' : '#7f1d1d');

  // Detailed NASA HQ Building on right with illuminated blue NASA HQ facade sign & golden windows
  px(ctx, 316, 86, 150, 120, INK);
  px(ctx, 318, 88, 146, 118, '#475569');
  px(ctx, 318, 88, 96, 118, '#64748b'); // lit facade left
  px(ctx, 318, 88, 146, 8, '#94a3b8'); // roofline trim
  // Illuminated blue NASA HQ sign
  px(ctx, 336, 98, 92, 18, INK);
  px(ctx, 337, 99, 90, 16, '#1d4ed8');
  drawPixelText(ctx, 'NASA HQ', 382, 102, '#ffffff', 2, INK, 'center');
  // Golden lit windows
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      px(ctx, 328 + col * 26, 126 + row * 22, 16, 12, INK);
      px(ctx, 329 + col * 26, 127 + row * 22, 14, 10, '#f59e0b');
      px(ctx, 330 + col * 26, 128 + row * 22, 8, 5, '#fde047');
    }
  }

  // Ground apron & Concrete Blast Pad with yellow hazard stripes and blinking red beacons
  px(ctx, 0, 206, ER_W, ER_H - 206, '#1e293b');
  px(ctx, 0, 206, ER_W, 2, '#475569');
  // Blast pad raised apron
  px(ctx, 108, 198, 174, 14, INK);
  px(ctx, 109, 199, 172, 12, '#64748b');
  // Yellow hazard stripes
  for (let hx = 114; hx < 274; hx += 16) {
    px(ctx, hx, 207, 8, 4, '#eab308');
  }
  // Blinking pad red beacons
  const beaconOn = Math.floor(t * 4) % 2 === 0;
  px(ctx, 112, 194, 5, 5, beaconOn ? '#ef4444' : '#7f1d1d');
  px(ctx, 273, 194, 5, 5, beaconOn ? '#ef4444' : '#7f1d1d');

  // Vertical Spacecraft Descent easing down onto pad (touches down at localT = 4.35s)
  const descendFrac = Math.min(1, localT / 4.35);
  const eased = 1 - Math.pow(1 - descendFrac, 2.2);
  const padContactY = 178; // leg pads sit at 178 + 21 = 199
  const shipY = Math.round(28 + eased * (padContactY - 28));
  const thrust = descendFrac < 1 ? 0.95 : Math.max(0, 1 - (localT - 4.35) * 3);

  // Billowing pixel dust clouds kicked up as ship nears the blast pad
  if (descendFrac > 0.45) {
    const dustIntensity = Math.sin(Math.min(1, (localT - 2.0) / 3.4) * Math.PI);
    for (let d = 0; d < 12; d++) {
      const side = d % 2 === 0 ? -1 : 1;
      const spread = ((localT * 38 + d * 11) % 68) * side;
      const dx = Math.round(195 + spread * (0.4 + dustIntensity * 0.8));
      const dy = Math.round(196 - Math.abs(Math.sin(d + localT * 4)) * 12 * dustIntensity);
      const rad = Math.round(6 + (1 - Math.abs(spread) / 70) * 6);
      ctx.fillStyle = d % 3 === 0 ? '#cbd5e1' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(dx, dy, Math.max(2, rad), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSpacecraft(ctx, 195, shipY, {
    mode: 'vertical_lander',
    thrusterLevel: thrust,
    legsDeployed: true,
    timeSec: t,
    scale: 1,
  });

  // Ground crew watching touchdown from safety perimeter
  drawHuman(ctx, 84, 208, 'engineer_vest', { timeSec: t, seed: 3, facing: 1 });
  drawHuman(ctx, 302, 208, 'engineer_polo', { timeSec: t, seed: 5, facing: -1 });
  drawHuman(ctx, 322, 208, 'engineer_jacket', { timeSec: t, seed: 7, facing: -1 });
}

/** Scene 10 (20.0s - 27.0s): Hero's Welcome at NASA HQ Plaza */
function renderScene10(ctx: CanvasRenderingContext2D, t: number) {
  const localT = t - 20.0; // 0..7.0s

  // Bright clear blue daytime sky over NASA HQ Plaza
  px(ctx, 0, 0, ER_W, 190, '#38bdf8');
  px(ctx, 0, 95, ER_W, 95, '#7dd3fc');
  // Crisp pixel clouds
  for (const [cx, cy] of [
    [60, 40],
    [220, 28],
    [390, 48],
  ]) {
    px(ctx, cx, cy, 54, 12, '#f8fafc');
    px(ctx, cx + 10, cy - 6, 32, 8, '#ffffff');
  }

  // NASA HQ Building facade in background right
  px(ctx, 308, 72, 162, 124, INK);
  px(ctx, 310, 74, 158, 122, '#94a3b8');
  px(ctx, 310, 74, 158, 8, '#cbd5e1');
  px(ctx, 336, 86, 102, 18, INK);
  px(ctx, 337, 87, 100, 16, '#1d4ed8');
  drawPixelText(ctx, 'NASA HQ', 387, 90, '#ffffff', 2, INK, 'center');
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      px(ctx, 324 + col * 28, 118 + row * 24, 16, 14, INK);
      px(ctx, 325 + col * 28, 119 + row * 24, 14, 12, '#bae6fd');
    }
  }

  // Illuminated "WELCOME HOME" celebration banner strung across plaza
  px(ctx, 134, 42, 212, 26, INK);
  px(ctx, 136, 44, 208, 22, '#1e3a8a');
  px(ctx, 136, 44, 208, 2, '#f59e0b');
  px(ctx, 136, 64, 208, 2, '#f59e0b');
  drawPixelText(ctx, 'WELCOME HOME', 240, 50, '#fde047', 2, INK, 'center');
  // Banner poles
  px(ctx, 130, 40, 4, 158, '#475569');
  px(ctx, 346, 40, 4, 158, '#475569');

  // Plaza paving
  px(ctx, 0, 196, ER_W, ER_H - 196, '#475569');
  px(ctx, 0, 196, ER_W, 3, '#cbd5e1');
  for (let tx = 0; tx < ER_W; tx += 32) {
    px(ctx, tx, 199, 1, 70, '#334155');
  }

  // Landed Spacecraft on left of plaza with open hatch & boarding ramp
  drawSpacecraft(ctx, 98, 176, {
    mode: 'vertical_lander',
    thrusterLevel: 0,
    legsDeployed: true,
    hatchOpen: true,
    timeSec: t,
    scale: 1,
  });

  // Cosmo Boy walks from capsule hatch (x=108) to center stage (x=236) then waves!
  const walkDuration = 2.6;
  const walkFrac = Math.min(1, localT / walkDuration);
  const cosmoX = Math.round(112 + walkFrac * 124);
  const isWaving = walkFrac >= 1;
  drawCosmoBoy(ctx, cosmoX, 205, {
    walkPhase: isWaving ? undefined : (localT * 2.2) % 1,
    waving: isWaving,
    wavePhase: localT,
    facing: 1,
    scale: 1.25,
  });

  // Cheering NASA Engineers & Press Photographers
  const crowd: { x: number; y: number; variant: HumanVariant; seed: number; facing: 1 | -1 }[] = [
    { x: 162, y: 202, variant: 'engineer_polo', seed: 1, facing: 1 },
    { x: 188, y: 205, variant: 'photographer', seed: 4, facing: 1 },
    { x: 288, y: 204, variant: 'engineer_vest', seed: 2, facing: -1 },
    { x: 314, y: 202, variant: 'engineer_jacket', seed: 6, facing: -1 },
    { x: 342, y: 206, variant: 'photographer', seed: 9, facing: -1 },
    { x: 370, y: 203, variant: 'engineer_polo', seed: 8, facing: -1 },
    { x: 398, y: 205, variant: 'engineer_jacket', seed: 11, facing: -1 },
  ];
  for (const person of crowd) {
    drawHuman(ctx, person.x, person.y, person.variant, {
      timeSec: t,
      seed: person.seed,
      cheer: true,
      facing: person.facing,
    });
  }

  // Bright Press Camera Flashes!
  const flashCycle = (localT * 1.35) % 1;
  if (flashCycle < 0.14) {
    const fx = Math.floor(localT * 1.35) % 2 === 0 ? 188 : 342;
    const fy = 183;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(fx, fy, 11, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, fx - 14, fy, 28, 2, '#ffffff');
    px(ctx, fx, fy - 14, 2, 28, '#ffffff');
  }

  // Drifting multi-colored confetti across the sky & plaza
  const confettiColors = ['#fde047', '#38bdf8', '#f97316', '#4ade80', '#f43f5e', '#ffffff'];
  for (let c = 0; c < 42; c++) {
    const cx = Math.round(((c * 37 + Math.sin(localT * 2 + c) * 14) % (ER_W - 10)) + 5);
    const cy = Math.round(((localT * (26 + (c % 4) * 7) + c * 17) % 210));
    px(ctx, cx, cy, c % 3 === 0 ? 3 : 2, 2, confettiColors[c % confettiColors.length]);
  }
}

/** Master frame render at native 480x270 integer-snapped pixel resolution + CRT scanlines */
export function renderEarthReturnFrame(ctx: CanvasRenderingContext2D, t: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ER_W, ER_H);

  if (t < 6.5) {
    renderScene07(ctx, t);
  } else if (t < 14.5) {
    renderScene08(ctx, t);
  } else if (t < 20.0) {
    renderScene09(ctx, t);
  } else {
    renderScene10(ctx, t);
  }

  // Subtle horizontal CRT scanlines (1px dark semi-transparent bands every 2 pixels)
  ctx.fillStyle = 'rgba(4, 7, 14, 0.22)';
  for (let y = 1; y < ER_H; y += 2) {
    ctx.fillRect(0, y, ER_W, 1);
  }
}
