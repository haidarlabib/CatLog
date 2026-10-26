export type MascotAnimState =
  | 'RUN_IN'
  | 'JUMP_TO_WORDMARK'
  | 'PLAY_ON_WORDMARK'
  | 'PAUSE_ON_WORDMARK'
  | 'RUN_TO_BADGE'
  | 'JUMP_TO_BADGE'
  | 'SIT_ON_BADGE'
  | 'INTERACT_JUMP'
  | 'RUN_TO_WORDMARK';
export type SpriteSheetKey = 'lari' | 'lompat';

export interface ElementRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface HeaderMascotTargets {
  readonly entryLeftWorldX: number;
  readonly wordmarkTakeoffWorldX: number;
  readonly wordmarkPlayWorldX: number;
  readonly wordmarkPlayQuadY: number;
  readonly wordmarkQuadSize: number;
  readonly badgeTakeoffWorldX: number;
  readonly badgeWorldX: number;
  readonly badgePerchQuadY: number;
  readonly badgeQuadSize: number;
  readonly floorBaseQuadY: number;
  readonly runSpeed: number;
  readonly hitboxLeftPx: number;
  readonly hitboxTopPx: number;
  readonly hitboxWidthPx: number;
  readonly hitboxHeightPx: number;
}

export interface MascotAtlasFrame {
  readonly atlasIndex: number;
  readonly name: string;
  readonly sheet: SpriteSheetKey;
  readonly sourceIndex: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly footY: number;
  readonly scale: number;
}

/**
 * Sprite Sheet Audit & Normalized 4x4 Atlas Manifest (1024x1024 POT, 256x256 per cell):
 *
 * 1. `sprite sheet/lari.png` (1983x793 RGBA, 4 cols x 2 rows = 8 frames):
 *    - Source indices 0..7 -> Atlas indices 4..11 (`run_0` .. `run_7`).
 *    - Playback: 12 FPS continuous rotary gallop cycle.
 *
 * 2. `sprite sheet/lompat.png` (1983x793 RGBA, Row 0 = 4 frames, Row 1 = 5 frames -> 9 poses total):
 *    - Row 0 source indices 0..3 -> Atlas indices 0..3 (`idle_sit_smile`, `idle_sit_wink`, `idle_stand_look`, `idle_stand_happy`).
 *    - Row 1 source indices 4..7 -> Atlas indices 12..15 (`jump_prep`, `jump_up`, `jump_midair`, `jump_land`).
 *    - Row 1 source index 8 (`x:1619, y:402, w:349, h:356`) -> INTENTIONALLY SKIPPED (left-facing play-bow pose,
 *      opposite to the right-facing orientation of the run/jump sequence).
 *
 * 3. `sprite sheet/kumpulan.png` (1536x1024 RGBA):
 *    - Reference contact sheet containing baked-in UI text labels (`0 idle_1_stand`, `IDLE`, `RUN`, etc.) -> SKIPPED at runtime.
 *
 * 4. `sprite sheet/oren master.png` (1536x1024 RGBA):
 *    - Clean high-res single Oyen master pose -> Used as non-WebGL / SSR graceful fallback image.
 */
export const ATLAS_GRID = 4;
export const ATLAS_CELL_SIZE = 256;
export const ATLAS_SIZE = ATLAS_GRID * ATLAS_CELL_SIZE; // 1024x1024 POT
export const ATLAS_FLOOR_Y = 232; // Ground baseline inside each 256x256 cell (24px bottom safety pad)

export const OYEN_ATLAS_FRAMES: readonly MascotAtlasFrame[] = [
  // Row 0 (Atlas 0..3): IDLE & PLAY poses from lompat.png (Row 0, cols 0..3)
  { atlasIndex: 0, name: 'idle_sit_smile', sheet: 'lompat', sourceIndex: 0, x: 159, y: 11, w: 325, h: 377, cx: 149, footY: 370, scale: 0.448 },
  { atlasIndex: 1, name: 'idle_sit_wink', sheet: 'lompat', sourceIndex: 1, x: 549, y: 16, w: 307, h: 358, cx: 148, footY: 354, scale: 0.470 },
  { atlasIndex: 2, name: 'idle_stand_look', sheet: 'lompat', sourceIndex: 2, x: 886, y: 15, w: 356, h: 357, cx: 188, footY: 352, scale: 0.480 },
  { atlasIndex: 3, name: 'idle_stand_happy', sheet: 'lompat', sourceIndex: 3, x: 1411, y: 11, w: 347, h: 364, cx: 180, footY: 360, scale: 0.474 },

  // Row 1 (Atlas 4..7): RUN frames 0..3 from lari.png (Row 0, cols 0..3)
  { atlasIndex: 4, name: 'run_0', sheet: 'lari', sourceIndex: 0, x: 12, y: 29, w: 487, h: 373, cx: 242, footY: 364, scale: 0.436 },
  { atlasIndex: 5, name: 'run_1', sheet: 'lari', sourceIndex: 1, x: 499, y: 43, w: 503, h: 343, cx: 252, footY: 336, scale: 0.436 },
  { atlasIndex: 6, name: 'run_2', sheet: 'lari', sourceIndex: 2, x: 1002, y: 46, w: 516, h: 343, cx: 260, footY: 348, scale: 0.430 },
  { atlasIndex: 7, name: 'run_3', sheet: 'lari', sourceIndex: 3, x: 1518, y: 68, w: 465, h: 308, cx: 238, footY: 322, scale: 0.458 },

  // Row 2 (Atlas 8..11): RUN frames 4..7 from lari.png (Row 1, cols 0..3)
  { atlasIndex: 8, name: 'run_4', sheet: 'lari', sourceIndex: 4, x: 17, y: 403, w: 518, h: 359, cx: 259, footY: 352, scale: 0.432 },
  { atlasIndex: 9, name: 'run_5', sheet: 'lari', sourceIndex: 5, x: 546, y: 400, w: 458, h: 346, cx: 228, footY: 341, scale: 0.444 },
  { atlasIndex: 10, name: 'run_6', sheet: 'lari', sourceIndex: 6, x: 1005, y: 400, w: 493, h: 363, cx: 242, footY: 358, scale: 0.438 },
  { atlasIndex: 11, name: 'run_7', sheet: 'lari', sourceIndex: 7, x: 1524, y: 406, w: 459, h: 343, cx: 228, footY: 339, scale: 0.456 },

  // Row 3 (Atlas 12..15): JUMP frames 0..3 from lompat.png (Row 1, cols 0..3; col 4 skipped)
  { atlasIndex: 12, name: 'jump_prep', sheet: 'lompat', sourceIndex: 4, x: 16, y: 408, w: 449, h: 309, cx: 228, footY: 306, scale: 0.466 },
  { atlasIndex: 13, name: 'jump_up', sheet: 'lompat', sourceIndex: 5, x: 468, y: 380, w: 404, h: 371, cx: 196, footY: 366, scale: 0.466 },
  { atlasIndex: 14, name: 'jump_midair', sheet: 'lompat', sourceIndex: 6, x: 871, y: 368, w: 327, h: 377, cx: 162, footY: 372, scale: 0.462 },
  { atlasIndex: 15, name: 'jump_land', sheet: 'lompat', sourceIndex: 7, x: 1226, y: 423, w: 369, h: 331, cx: 188, footY: 327, scale: 0.470 },
] as const;

export const IDLE_FRAME_INDICES = [0, 1, 2, 3] as const;
export const RUN_FRAME_INDICES = [4, 5, 6, 7, 8, 9, 10, 11] as const;
export const JUMP_FRAME_INDICES = [12, 13, 14, 15] as const;

export const RUN_SPEED_SCALE = 0.65;
export const RUN_FPS = 8.5;
export const JUMP_DURATION_SEC = 0.54;
export const PLAY_DURATION_SEC = 1.35;
export const PAUSE_1S_DURATION_SEC = 1.0;
export const BADGE_SIT_DURATION_SEC = 3.0;
export const POST_INTERACT_SIT_SEC = 2.5;
export const MIN_HEADER_PATROL_WIDTH = 180;
export const FULL_CROSS_DURATION_SEC = 2.25;

export function getResponsiveQuadSize(stageWidth: number): number {
  if (stageWidth >= 600) return 52;
  return Math.max(44, Math.min(49, Math.round(stageWidth * 0.12)));
}

export function getAtlasUvOffset(atlasIndex: number): { u: number; v: number; repeat: number } {
  const clamped = Math.max(0, Math.min(OYEN_ATLAS_FRAMES.length - 1, atlasIndex | 0));
  const col = clamped % ATLAS_GRID;
  const row = Math.floor(clamped / ATLAS_GRID);
  const step = 1 / ATLAS_GRID;
  return {
    u: col * step,
    v: (ATLAS_GRID - 1 - row) * step,
    repeat: step,
  };
}

export function getNormalizedCellPlacement(frame: MascotAtlasFrame) {
  const col = frame.atlasIndex % ATLAS_GRID;
  const row = Math.floor(frame.atlasIndex / ATLAS_GRID);
  const dw = Math.round(frame.w * frame.scale);
  const dh = Math.round(frame.h * frame.scale);
  const dx = Math.round(col * ATLAS_CELL_SIZE + ATLAS_CELL_SIZE / 2 - frame.cx * frame.scale);
  const dy = Math.round(row * ATLAS_CELL_SIZE + ATLAS_FLOOR_Y - frame.footY * frame.scale);
  return { col, row, dx, dy, dw, dh };
}

export function getPatrolBounds(stageWidth: number, quadSize: number) {
  const halfSpan = Math.round(quadSize * 0.44) + 2;
  const minX = -stageWidth / 2 + halfSpan;
  const maxX = Math.max(minX, stageWidth / 2 - halfSpan);
  const centerX = 0;
  const span = Math.max(0, maxX - minX);
  const canPatrol = stageWidth >= MIN_HEADER_PATROL_WIDTH && span >= 80;
  const targetCrossSec = stageWidth >= 600 ? 2.5 : FULL_CROSS_DURATION_SEC;
  const baseRunSpeed = canPatrol ? Math.max(110, span / targetCrossSec) : 115;
  const runSpeed = baseRunSpeed * RUN_SPEED_SCALE;
  return { minX, maxX, centerX, span, canPatrol, runSpeed };
}

/**
 * Dynamically computes BOTH Oyen's left play perch (above the "Cuki" letters of the Cuking wordmark)
 * AND Oyen's right sitting perch (on top of the cat counter badge), guaranteeing zero left/top/right clipping.
 */
export function computeHeaderMascotTargets(
  stageWidth: number,
  stageHeight: number,
  runQuadSize: number,
  wordmarkRelRect: ElementRectLike | null,
  badgeRelRect: ElementRectLike | null
): HeaderMascotTargets {
  const floorWorldY = -stageHeight * 0.5 + 6;
  const footRatioFromBottom = (ATLAS_CELL_SIZE - ATLAS_FLOOR_Y) / ATLAS_CELL_SIZE;
  const floorBaseQuadY = floorWorldY + runQuadSize * (0.5 - footRatioFromBottom);

  const wmRect: ElementRectLike = wordmarkRelRect ?? {
    left: 16,
    top: 15,
    width: 98,
    height: 40,
  };

  const bRect: ElementRectLike = badgeRelRect ?? {
    left: Math.max(140, stageWidth - 106),
    top: 24,
    width: 90,
    height: 28,
  };

  // 1. Wordmark play target (above "Cuki", safe from left-edge & top-edge clipping)
  const minSafeDomX = Math.round(runQuadSize * 0.62) + 12;
  const rawPlayDomX = wmRect.left + wmRect.width * 0.35;
  const playDomX = Math.max(minSafeDomX, Math.min(stageWidth * 0.42, rawPlayDomX));
  const wordmarkPlayWorldX = playDomX - stageWidth * 0.5;

  const entryLeftWorldX = -stageWidth * 0.5 - runQuadSize * 0.48;
  const takeoffDomX = Math.max(Math.round(runQuadSize * 0.48) + 4, playDomX - 22);
  const wordmarkTakeoffWorldX = takeoffDomX - stageWidth * 0.5;

  const wmLetterTopDomY = Math.max(26, Math.min(stageHeight - 20, wmRect.top + wmRect.height * 0.4));
  const wmAvailHeight = Math.max(21, wmLetterTopDomY - 5.5);
  const wordmarkQuadSize = Math.max(33, Math.min(39, wmAvailHeight / 0.6484375));
  const wmDomCenterY = wmLetterTopDomY - (0.5 - footRatioFromBottom) * wordmarkQuadSize;
  const wordmarkPlayQuadY = stageHeight * 0.5 - wmDomCenterY;

  // 2. Cat counter badge perch target (on top rim of "0 Kucing" badge)
  const badgeDomCenterX = bRect.left + bRect.width * 0.5;
  const rawBadgeWorldX = badgeDomCenterX - stageWidth * 0.5;
  const badgeWorldX = Math.max(
    wordmarkPlayWorldX + 70,
    Math.min(stageWidth * 0.5 - 24, rawBadgeWorldX)
  );

  const badgeLeftWorldX = bRect.left - stageWidth * 0.5;
  const badgeTakeoffWorldX = Math.max(
    wordmarkPlayWorldX + 32,
    Math.min(badgeWorldX - 36, badgeLeftWorldX - runQuadSize * 0.42)
  );

  const badgeTopDomY = Math.max(20, Math.min(stageHeight - 18, bRect.top));
  const badgePawsDomY = badgeTopDomY + 5;
  const badgeAvailHeight = Math.max(21, badgePawsDomY - 6.5);
  const badgeQuadSize = Math.max(33, Math.min(40, badgeAvailHeight / 0.6484375));
  const badgeDomCenterY = badgePawsDomY - (0.5 - footRatioFromBottom) * badgeQuadSize;
  const badgePerchQuadY = stageHeight * 0.5 - badgeDomCenterY;

  const hitboxWidthPx = 44;
  const hitboxLeftPx = Math.round(badgeDomCenterX - hitboxWidthPx * 0.5);
  const hitboxTopPx = 0;
  const hitboxHeightPx = Math.max(22, Math.round(badgeTopDomY + 3));

  const bounds = getPatrolBounds(stageWidth, runQuadSize);

  return {
    entryLeftWorldX,
    wordmarkTakeoffWorldX,
    wordmarkPlayWorldX,
    wordmarkPlayQuadY,
    wordmarkQuadSize,
    badgeTakeoffWorldX,
    badgeWorldX,
    badgePerchQuadY,
    badgeQuadSize,
    floorBaseQuadY,
    runSpeed: bounds.runSpeed,
    hitboxLeftPx,
    hitboxTopPx,
    hitboxWidthPx,
    hitboxHeightPx,
  };
}

export function evaluateJumpPhase(progress: number, maxJumpHeight: number): {
  atlasIndex: number;
  jumpY: number;
  squashX: number;
  squashY: number;
} {
  const t = Math.max(0, Math.min(1, progress));
  if (t < 0.16) {
    const p = t / 0.16;
    const crouch = Math.sin(p * Math.PI);
    return {
      atlasIndex: JUMP_FRAME_INDICES[0],
      jumpY: 0,
      squashX: 1 + crouch * 0.045,
      squashY: 1 - crouch * 0.055,
    };
  }

  const airT = (t - 0.16) / 0.84;
  const parabola = 4 * airT * (1 - airT);
  const jumpY = parabola * maxJumpHeight;

  let atlasIndex: number = JUMP_FRAME_INDICES[3];
  if (t < 0.46) {
    atlasIndex = JUMP_FRAME_INDICES[1];
  } else if (t < 0.74) {
    atlasIndex = JUMP_FRAME_INDICES[2];
  }

  return {
    atlasIndex,
    jumpY,
    squashX: 1 - parabola * 0.02,
    squashY: 1 + parabola * 0.025,
  };
}

export function evaluateArcJumpToTargetPhase(
  progress: number,
  startX: number,
  targetX: number,
  startY: number,
  targetY: number,
  startSize: number,
  targetSize: number,
  landingIdleFrame: number = IDLE_FRAME_INDICES[0]
): {
  atlasIndex: number;
  x: number;
  y: number;
  quadSize: number;
  squashX: number;
  squashY: number;
} {
  const t = Math.max(0, Math.min(1, progress));
  if (t < 0.15) {
    const p = t / 0.15;
    const crouch = Math.sin(p * Math.PI);
    return {
      atlasIndex: JUMP_FRAME_INDICES[0],
      x: startX + (targetX - startX) * (t * 0.25),
      y: startY,
      quadSize: startSize,
      squashX: 1 + crouch * 0.05,
      squashY: 1 - crouch * 0.06,
    };
  }

  if (t < 0.86) {
    const airT = (t - 0.15) / 0.71;
    const easeX = 1 - Math.pow(1 - airT, 2.0);
    const xStartAir = startX + (targetX - startX) * (0.15 * 0.25);
    const x = xStartAir + (targetX - xStartAir) * easeX;

    const linearY = startY + (targetY - startY) * airT;
    const parabola = 4 * airT * (1 - airT);
    const y = linearY + parabola * 4.2;
    const quadSize = startSize + (targetSize - startSize) * airT;

    let atlasIndex: number = JUMP_FRAME_INDICES[3];
    if (airT < 0.44) {
      atlasIndex = JUMP_FRAME_INDICES[1];
    } else if (airT < 0.76) {
      atlasIndex = JUMP_FRAME_INDICES[2];
    }

    return {
      atlasIndex,
      x,
      y,
      quadSize,
      squashX: 1 - parabola * 0.025,
      squashY: 1 + parabola * 0.03,
    };
  }

  const landT = (t - 0.86) / 0.14;
  const cushion = Math.sin(landT * Math.PI);
  return {
    atlasIndex: landT < 0.45 ? JUMP_FRAME_INDICES[3] : landingIdleFrame,
    x: targetX,
    y: targetY - cushion * 0.65,
    quadSize: targetSize,
    squashX: 1 + cushion * 0.05,
    squashY: 1 - cushion * 0.055,
  };
}

export function evaluateWordmarkPlayPhase(progress: number): {
  atlasIndex: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  tiltZ: number;
} {
  const t = Math.max(0, Math.min(1, progress));

  if (t < 0.36) {
    const p = t / 0.36;
    const wiggle = Math.sin(p * Math.PI * 2);
    return {
      atlasIndex: p < 0.52 ? JUMP_FRAME_INDICES[0] : IDLE_FRAME_INDICES[2],
      offsetX: Math.sin(p * Math.PI) * 3.0,
      offsetY: 0,
      scaleX: 1 + Math.sin(p * Math.PI) * 0.035,
      scaleY: 1 - Math.sin(p * Math.PI) * 0.035,
      tiltZ: wiggle * 0.055,
    };
  }

  if (t < 0.72) {
    const p = (t - 0.36) / 0.36;
    const hop = Math.sin(p * Math.PI);
    return {
      atlasIndex: p < 0.58 ? JUMP_FRAME_INDICES[1] : IDLE_FRAME_INDICES[3],
      offsetX: 3.0 - p * 3.0,
      offsetY: hop * 2.4,
      scaleX: 1 - hop * 0.02,
      scaleY: 1 + hop * 0.025,
      tiltZ: -hop * 0.045,
    };
  }

  const p = (t - 0.72) / 0.28;
  const settle = Math.sin(p * Math.PI) * (1 - p);
  return {
    atlasIndex: p < 0.5 ? IDLE_FRAME_INDICES[1] : IDLE_FRAME_INDICES[0],
    offsetX: 0,
    offsetY: 0,
    scaleX: 1 + settle * 0.025,
    scaleY: 1 - settle * 0.025,
    tiltZ: Math.sin(p * Math.PI * 2) * 0.03 * (1 - p),
  };
}
