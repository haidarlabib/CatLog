export type MascotCharacterId = 'oyen' | 'mujaer' | 'putih';

export type MascotRoleState =
  | 'basecamp'
  | 'basecamp-idle'
  | 'basecamp-react'
  | 'run'
  | 'running'
  | 'running-paused'
  | 'running-react'
  | 'join-running'
  | 'jumpToRun'
  | 'returnToBasecamp'
  | 'returning-to-basecamp'
  | 'idle'
  | 'interact'
  | 'jump'
  | 'sit';

export type MascotAnimState =
  | 'BASECAMP_IDLE'
  | 'BASECAMP_REST'
  | 'BASECAMP_REACT'
  | 'DEPART_BASECAMP'
  | 'RUN_TO_WORDMARK'
  | 'JUMP_TO_WORDMARK'
  | 'PLAY_ON_WORDMARK'
  | 'PAUSE_ON_WORDMARK'
  | 'RUN_TO_BASECAMP'
  | 'RETURN_TO_BASECAMP'
  | 'SETTLE_BASECAMP'
  | 'RUNNING_PAUSED'
  | 'RUNNING_REACT'
  | 'GUEST_DEPART'
  | 'GUEST_RUN_OUT'
  | 'GUEST_PLAY'
  | 'GUEST_RUN_BACK'
  | 'GUEST_RETURN'
  | 'GUEST_SETTLE'
  | 'INTERACT_JUMP'
  | 'INTERACT_PAUSE'
  | 'RUN_IN'
  | 'RUN_TO_BADGE'
  | 'JUMP_TO_BADGE'
  | 'SIT_ON_BADGE'
  | 'RUN_OUT'
  | 'BETWEEN_TURNS';

export type SpriteSheetKey = 'lari' | 'lompat' | 'mujaer' | 'putih';

export interface ElementRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SafeHitboxRect {
  readonly leftPx: number;
  readonly topPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly enabled: boolean;
}

export interface BasecampSlot {
  readonly characterId: MascotCharacterId;
  readonly slotIndex: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly quadSize: number;
  readonly zIndex: number;
  readonly hitboxLeftPx: number;
  readonly hitboxTopPx: number;
  readonly hitboxWidthPx: number;
  readonly hitboxHeightPx: number;
}

export interface HeaderMascotTargets {
  readonly entryLeftWorldX: number;
  readonly exitRightWorldX: number;
  readonly wordmarkTakeoffWorldX: number;
  readonly wordmarkPlayWorldX: number;
  readonly wordmarkPlayQuadY: number;
  readonly wordmarkQuadSize: number;
  readonly wordmarkSafeTopHeightPx: number;
  readonly badgeTakeoffWorldX: number;
  readonly badgeWorldX: number;
  readonly badgePerchQuadY: number;
  readonly badgeQuadSize: number;
  readonly badgeFloorWorldX: number;
  readonly basecampSlots: Record<MascotCharacterId, BasecampSlot>;
  readonly floorBaseQuadY: number;
  readonly runSpeed: number;
  readonly corridorLeftDomX: number;
  readonly corridorRightDomX: number;
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
  readonly clipPoly?: readonly (readonly [number, number])[];
}

export interface MascotCharacterConfig {
  readonly id: MascotCharacterId;
  readonly displayName: string;
  readonly atlasCols: number;
  readonly atlasRows: number;
  readonly frames: readonly MascotAtlasFrame[];
  readonly masterFrameIndex: number | null;
  readonly idleFrames: readonly number[];
  readonly sitFrames: readonly number[];
  readonly runFrames: readonly number[];
  readonly jumpFrames: readonly number[];
  readonly playSequence: readonly [number, number, number, number];
  readonly wordmarkSettleFrames: readonly [number, number];
  readonly interactReactionFrame: number;
  readonly runFps: number;
  readonly speedMultiplier: number;
  readonly sizeMultiplier: number;
}

/**
 * Trio Mascot Sprite Sheet Audit & POT Atlas Manifest (256x256 per cell):
 *
 * A. OYEN (4x4 POT = 1024x1024):
 *    - `sprite sheet/lari.png` (1983x793 RGBA): 8 running poses (`run_0`..`run_7`).
 *    - `sprite sheet/lompat.png` (1983x793 RGBA): 4 idle/sit poses + 4 jump poses;
 *      pose index 8 (`x:1619, y:402`) skipped (left-facing play-bow opposite to right-facing cycle).
 *    - `sprite sheet/kumpulan.png` (1536x1024 RGBA): skipped (contact sheet with baked-in text labels).
 *    - `sprite sheet/oren master.png` (1536x1024 RGBA): used as non-WebGL / SSR master fallback.
 *
 * B. MUJAER — Tabby Cat (`sprite sheet/Tabby Cat Animation Sprite Sheet.png`, 1983x793 RGBA, 8x4 POT = 2048x1024):
 *    - Master pose (`master`, index 0) + 5 idle/sit poses (`1..5`) + 7 run poses (`6..12`) + 4 jump poses (`13..16`).
 *    - Baked section header pills (`MUJAER MASTER`, `RUN`, `IDLE & SIT`, `JUMP`) are excluded via coordinates & polygon clips.
 *    - Note on `idle_lounge_stretch` (index 5): kept in atlas as clean extracted pose, but excluded from compact
 *      wordmark/badge perches because its 2:1 sprawled posture requires 0.54 scale (~18% smaller head than `0.66` upright sit).
 *
 * C. KUCING PUTIH — Fluffy Kitten (`sprite sheet/Fluffy Kitten Animation Sprite Sheet.png`, 1774x887 RGBA, 8x4 POT = 2048x1024):
 *    - Master pose (`master`, index 0) + 8 idle/sit poses (`1..8`) + 8 run poses (`9..16`) + 6 jump poses (`17..22`).
 *    - Baked pink title pills and numbered badges (`1`..`8`) below every pose are cleanly excluded (`y <= 291`, `y <= 591`, `y <= 838`).
 */
export const MASCOT_TURN_ORDER: readonly MascotCharacterId[] = ['oyen', 'mujaer', 'putih'] as const;

export const ATLAS_GRID = 4;
export const ATLAS_CELL_SIZE = 256;
export const ATLAS_SIZE = ATLAS_GRID * ATLAS_CELL_SIZE; // 1024x1024 POT for 4x4
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

export const MUJAER_ATLAS_FRAMES: readonly MascotAtlasFrame[] = [
  { atlasIndex: 0, name: 'master', sheet: 'mujaer', sourceIndex: 0, x: 8, y: 56, w: 296, h: 346, cx: 148, footY: 345, scale: 0.5 },
  { atlasIndex: 1, name: 'idle_sit_alert', sheet: 'mujaer', sourceIndex: 1, x: 476, y: 279, w: 250, h: 250, cx: 125, footY: 249, scale: 0.66, clipPoly: [[588, 279], [726, 279], [726, 529], [476, 529], [476, 345], [588, 345]] },
  { atlasIndex: 2, name: 'idle_loaf_smile', sheet: 'mujaer', sourceIndex: 2, x: 728, y: 326, w: 305, h: 189, cx: 152, footY: 188, scale: 0.64 },
  { atlasIndex: 3, name: 'idle_sit_curious', sheet: 'mujaer', sourceIndex: 3, x: 1060, y: 259, w: 195, h: 260, cx: 96, footY: 259, scale: 0.66 },
  { atlasIndex: 4, name: 'idle_groom_paw', sheet: 'mujaer', sourceIndex: 4, x: 1261, y: 283, w: 240, h: 238, cx: 119, footY: 237, scale: 0.66 },
  { atlasIndex: 5, name: 'idle_lounge_stretch', sheet: 'mujaer', sourceIndex: 5, x: 1521, y: 309, w: 408, h: 207, cx: 204, footY: 206, scale: 0.54 },
  { atlasIndex: 6, name: 'run_0', sheet: 'mujaer', sourceIndex: 6, x: 344, y: 62, w: 224, h: 192, cx: 111, footY: 189, scale: 0.76, clipPoly: [[344, 62], [560, 62], [562, 102], [565, 118], [566, 165], [558, 210], [558, 254], [344, 254]] },
  { atlasIndex: 7, name: 'run_1', sheet: 'mujaer', sourceIndex: 7, x: 562, y: 74, w: 227, h: 190, cx: 113, footY: 188, scale: 0.76, clipPoly: [[562, 74], [789, 74], [789, 264], [562, 264], [562, 210], [568, 165], [566, 118], [562, 102]] },
  { atlasIndex: 8, name: 'run_2', sheet: 'mujaer', sourceIndex: 8, x: 790, y: 68, w: 258, h: 195, cx: 128, footY: 193, scale: 0.76 },
  { atlasIndex: 9, name: 'run_3', sheet: 'mujaer', sourceIndex: 9, x: 1048, y: 77, w: 268, h: 186, cx: 133, footY: 185, scale: 0.75, clipPoly: [[1048, 77], [1312, 77], [1312, 175], [1309, 188], [1316, 208], [1316, 262], [1048, 262]] },
  { atlasIndex: 10, name: 'run_4', sheet: 'mujaer', sourceIndex: 10, x: 1310, y: 85, w: 245, h: 164, cx: 122, footY: 162, scale: 0.76, clipPoly: [[1312, 85], [1532, 85], [1532, 175], [1554, 195], [1554, 218], [1540, 235], [1540, 249], [1318, 249], [1318, 208], [1310, 188], [1312, 175]] },
  { atlasIndex: 11, name: 'run_5', sheet: 'mujaer', sourceIndex: 11, x: 1538, y: 77, w: 212, h: 191, cx: 105, footY: 190, scale: 0.76, clipPoly: [[1538, 77], [1734, 77], [1746, 100], [1748, 165], [1740, 215], [1740, 268], [1556, 268], [1556, 175], [1538, 145]] },
  { atlasIndex: 12, name: 'run_6', sheet: 'mujaer', sourceIndex: 12, x: 1735, y: 80, w: 244, h: 186, cx: 126, footY: 182, scale: 0.76, clipPoly: [[1735, 80], [1979, 80], [1979, 266], [1742, 266], [1742, 215], [1750, 165], [1747, 100]] },
  { atlasIndex: 13, name: 'jump_prep', sheet: 'mujaer', sourceIndex: 13, x: 218, y: 521, w: 341, h: 257, cx: 170, footY: 256, scale: 0.62 },
  { atlasIndex: 14, name: 'jump_up', sheet: 'mujaer', sourceIndex: 14, x: 619, y: 529, w: 400, h: 219, cx: 200, footY: 218, scale: 0.56 },
  { atlasIndex: 15, name: 'jump_midair', sheet: 'mujaer', sourceIndex: 15, x: 1098, y: 533, w: 319, h: 227, cx: 160, footY: 226, scale: 0.64 },
  { atlasIndex: 16, name: 'jump_land', sheet: 'mujaer', sourceIndex: 16, x: 1546, y: 535, w: 386, h: 243, cx: 192, footY: 242, scale: 0.58 },
] as const;

export const PUTIH_ATLAS_FRAMES: readonly MascotAtlasFrame[] = [
  { atlasIndex: 0, name: 'master', sheet: 'putih', sourceIndex: 0, x: 12, y: 26, w: 309, h: 339, cx: 153, footY: 338, scale: 0.52 },
  { atlasIndex: 1, name: 'idle_sit_cute', sheet: 'putih', sourceIndex: 1, x: 309, y: 408, w: 180, h: 183, cx: 90, footY: 182, scale: 0.78, clipPoly: [[309, 408], [488, 408], [488, 535], [478, 555], [478, 591], [309, 591]] },
  { atlasIndex: 2, name: 'idle_sit_laugh', sheet: 'putih', sourceIndex: 2, x: 478, y: 434, w: 184, h: 157, cx: 90, footY: 156, scale: 0.78, clipPoly: [[488, 434], [662, 434], [662, 591], [478, 591], [478, 555], [488, 535]] },
  { atlasIndex: 3, name: 'idle_sit_look_up', sheet: 'putih', sourceIndex: 3, x: 665, y: 389, w: 156, h: 202, cx: 78, footY: 201, scale: 0.78, clipPoly: [[665, 389], [820, 389], [820, 470], [808, 485], [815, 591], [665, 591]] },
  { atlasIndex: 4, name: 'idle_prone_peek', sheet: 'putih', sourceIndex: 4, x: 808, y: 472, w: 220, h: 119, cx: 110, footY: 118, scale: 0.78, clipPoly: [[820, 472], [993, 472], [1027, 488], [1027, 591], [815, 591], [808, 485]] },
  { atlasIndex: 5, name: 'idle_groom_paw', sheet: 'putih', sourceIndex: 5, x: 993, y: 387, w: 182, h: 204, cx: 92, footY: 203, scale: 0.78, clipPoly: [[993, 387], [1175, 387], [1175, 591], [1027, 591], [1027, 488], [993, 474]] },
  { atlasIndex: 6, name: 'idle_sit_tall', sheet: 'putih', sourceIndex: 6, x: 1176, y: 373, w: 197, h: 218, cx: 98, footY: 217, scale: 0.78, clipPoly: [[1176, 373], [1325, 373], [1325, 522], [1372, 535], [1372, 565], [1362, 591], [1176, 591]] },
  { atlasIndex: 7, name: 'idle_nap_rest', sheet: 'putih', sourceIndex: 7, x: 1335, y: 426, w: 243, h: 165, cx: 121, footY: 164, scale: 0.76, clipPoly: [[1335, 426], [1526, 426], [1554, 456], [1562, 502], [1577, 545], [1577, 591], [1365, 591], [1374, 565], [1374, 535], [1335, 515]] },
  { atlasIndex: 8, name: 'idle_sit_tilt', sheet: 'putih', sourceIndex: 8, x: 1526, y: 373, w: 219, h: 218, cx: 116, footY: 217, scale: 0.78, clipPoly: [[1526, 373], [1745, 373], [1745, 591], [1580, 591], [1580, 545], [1566, 502], [1556, 456], [1526, 445]] },
  { atlasIndex: 9, name: 'run_0', sheet: 'putih', sourceIndex: 9, x: 336, y: 114, w: 206, h: 177, cx: 101, footY: 173, scale: 0.8, clipPoly: [[336, 114], [534, 114], [532, 167], [540, 192], [540, 291], [336, 291]] },
  { atlasIndex: 10, name: 'run_1', sheet: 'putih', sourceIndex: 10, x: 530, y: 88, w: 186, h: 203, cx: 94, footY: 202, scale: 0.8, clipPoly: [[534, 88], [715, 88], [715, 134], [705, 148], [714, 192], [711, 224], [696, 245], [696, 291], [541, 291], [541, 192], [532, 167]] },
  { atlasIndex: 11, name: 'run_2', sheet: 'putih', sourceIndex: 11, x: 696, y: 128, w: 166, h: 163, cx: 86, footY: 161, scale: 0.8, clipPoly: [[705, 128], [784, 128], [795, 142], [828, 132], [852, 132], [860, 175], [858, 212], [832, 232], [848, 268], [848, 291], [696, 291], [696, 245], [711, 224], [714, 192], [705, 148]] },
  { atlasIndex: 12, name: 'run_3', sheet: 'putih', sourceIndex: 12, x: 784, y: 68, w: 254, h: 223, cx: 125, footY: 222, scale: 0.8, clipPoly: [[784, 68], [1026, 68], [1016, 118], [1024, 167], [1036, 192], [1036, 216], [1004, 242], [1004, 291], [851, 291], [851, 268], [835, 232], [861, 212], [861, 175], [853, 132], [828, 132], [805, 140], [784, 118]] },
  { atlasIndex: 13, name: 'run_4', sheet: 'putih', sourceIndex: 13, x: 1008, y: 94, w: 228, h: 197, cx: 112, footY: 195, scale: 0.8, clipPoly: [[1016, 94], [1174, 94], [1174, 122], [1222, 124], [1234, 191], [1227, 216], [1208, 241], [1208, 291], [1008, 291], [1008, 242], [1036, 216], [1036, 192], [1024, 167], [1016, 118]] },
  { atlasIndex: 14, name: 'run_5', sheet: 'putih', sourceIndex: 14, x: 1174, y: 90, w: 231, h: 201, cx: 121, footY: 199, scale: 0.8, clipPoly: [[1174, 90], [1394, 90], [1391, 142], [1401, 191], [1403, 216], [1388, 242], [1388, 291], [1209, 291], [1209, 241], [1228, 216], [1235, 191], [1224, 134], [1195, 124], [1174, 112]] },
  { atlasIndex: 15, name: 'run_6', sheet: 'putih', sourceIndex: 15, x: 1388, y: 106, w: 220, h: 185, cx: 110, footY: 182, scale: 0.8, clipPoly: [[1394, 106], [1562, 106], [1562, 128], [1588, 130], [1604, 191], [1606, 216], [1592, 242], [1592, 291], [1388, 291], [1388, 242], [1403, 216], [1401, 191], [1391, 142]] },
  { atlasIndex: 16, name: 'run_7', sheet: 'putih', sourceIndex: 16, x: 1562, y: 88, w: 205, h: 203, cx: 106, footY: 201, scale: 0.8, clipPoly: [[1562, 88], [1767, 88], [1767, 291], [1593, 291], [1593, 242], [1607, 216], [1605, 191], [1592, 135], [1562, 122]] },
  { atlasIndex: 17, name: 'jump_0', sheet: 'putih', sourceIndex: 17, x: 50, y: 655, w: 312, h: 183, cx: 154, footY: 182, scale: 0.7 },
  { atlasIndex: 18, name: 'jump_1', sheet: 'putih', sourceIndex: 18, x: 373, y: 640, w: 306, h: 197, cx: 153, footY: 196, scale: 0.7 },
  { atlasIndex: 19, name: 'jump_2', sheet: 'putih', sourceIndex: 19, x: 680, y: 645, w: 258, h: 191, cx: 128, footY: 190, scale: 0.74 },
  { atlasIndex: 20, name: 'jump_3', sheet: 'putih', sourceIndex: 20, x: 969, y: 636, w: 282, h: 200, cx: 140, footY: 199, scale: 0.72 },
  { atlasIndex: 21, name: 'jump_4', sheet: 'putih', sourceIndex: 21, x: 1271, y: 640, w: 249, h: 197, cx: 124, footY: 196, scale: 0.74 },
  { atlasIndex: 22, name: 'jump_5', sheet: 'putih', sourceIndex: 22, x: 1535, y: 654, w: 204, h: 184, cx: 102, footY: 182, scale: 0.76 },
] as const;

export const IDLE_FRAME_INDICES = [0, 1, 2, 3] as const;
export const RUN_FRAME_INDICES = [4, 5, 6, 7, 8, 9, 10, 11] as const;
export const JUMP_FRAME_INDICES = [12, 13, 14, 15] as const;

export const MASCOT_CHARACTER_CONFIGS: Record<MascotCharacterId, MascotCharacterConfig> = {
  oyen: {
    id: 'oyen',
    displayName: 'Oyen',
    atlasCols: 4,
    atlasRows: 4,
    frames: OYEN_ATLAS_FRAMES,
    masterFrameIndex: null,
    idleFrames: IDLE_FRAME_INDICES,
    sitFrames: [0, 1],
    runFrames: RUN_FRAME_INDICES,
    jumpFrames: JUMP_FRAME_INDICES,
    playSequence: [12, 2, 13, 3],
    wordmarkSettleFrames: [1, 0],
    interactReactionFrame: 1,
    runFps: 8.5,
    speedMultiplier: 1.0,
    sizeMultiplier: 1.0,
  },
  mujaer: {
    id: 'mujaer',
    displayName: 'Mujaer',
    atlasCols: 8,
    atlasRows: 4,
    frames: MUJAER_ATLAS_FRAMES,
    masterFrameIndex: 0,
    idleFrames: [1, 3, 4, 2],
    sitFrames: [1, 2, 4, 3],
    runFrames: [6, 7, 8, 9, 10, 11, 12],
    jumpFrames: [13, 14, 15, 16],
    playSequence: [13, 3, 14, 4],
    wordmarkSettleFrames: [4, 1],
    interactReactionFrame: 2,
    runFps: 9.0,
    speedMultiplier: 1.05,
    sizeMultiplier: 1.0,
  },
  putih: {
    id: 'putih',
    displayName: 'Kucing Putih',
    atlasCols: 8,
    atlasRows: 4,
    frames: PUTIH_ATLAS_FRAMES,
    masterFrameIndex: 0,
    idleFrames: [1, 3, 4, 5, 2, 8],
    sitFrames: [1, 6, 8, 5, 7, 2],
    runFrames: [9, 10, 11, 12, 13, 14, 15, 16],
    jumpFrames: [17, 18, 19, 20, 21, 22],
    playSequence: [4, 3, 18, 5],
    wordmarkSettleFrames: [2, 1],
    interactReactionFrame: 2,
    runFps: 9.2,
    speedMultiplier: 0.94,
    sizeMultiplier: 0.98,
  },
};

export const RUN_SPEED_SCALE = 0.65;
export const RUN_FPS = 8.5;
export const JUMP_DURATION_SEC = 0.54;
export const PLAY_DURATION_SEC = 1.35;
export const PAUSE_1S_DURATION_SEC = 1.0;
export const BADGE_SIT_DURATION_SEC = 3.0;
export const POST_INTERACT_SIT_SEC = 2.0;
export const BETWEEN_TURNS_MIN_SEC = 0.65;
export const MIN_HEADER_PATROL_WIDTH = 180;
export const FULL_CROSS_DURATION_SEC = 2.25;

export function getNextMascotCharacterId(current: MascotCharacterId): MascotCharacterId {
  const idx = MASCOT_TURN_ORDER.indexOf(current);
  return MASCOT_TURN_ORDER[(idx + 1) % MASCOT_TURN_ORDER.length];
}

export function getMascotRoleState(state: MascotAnimState): MascotRoleState {
  switch (state) {
    case 'BASECAMP_IDLE':
    case 'BASECAMP_REST':
    case 'SETTLE_BASECAMP':
    case 'GUEST_SETTLE':
      return 'basecamp';
    case 'BASECAMP_REACT':
      return 'basecamp-react';
    case 'DEPART_BASECAMP':
    case 'GUEST_DEPART':
      return 'jumpToRun';
    case 'RUN_TO_WORDMARK':
    case 'RUN_TO_BASECAMP':
    case 'RUN_IN':
    case 'RUN_TO_BADGE':
    case 'RUN_OUT':
      return 'run';
    case 'RUNNING_PAUSED':
    case 'RUNNING_REACT':
      return 'running-react';
    case 'GUEST_RUN_OUT':
    case 'GUEST_PLAY':
    case 'GUEST_RUN_BACK':
      return 'join-running';
    case 'RETURN_TO_BASECAMP':
    case 'GUEST_RETURN':
      return 'returnToBasecamp';
    case 'JUMP_TO_WORDMARK':
    case 'JUMP_TO_BADGE':
      return 'jump';
    case 'SIT_ON_BADGE':
      return 'sit';
    case 'INTERACT_JUMP':
    case 'INTERACT_PAUSE':
      return 'interact';
    case 'PLAY_ON_WORDMARK':
    case 'PAUSE_ON_WORDMARK':
    case 'BETWEEN_TURNS':
      return 'idle';
  }
}

export function evaluateBasecampBreathing(
  nowSec: number,
  slotIndex: number
): { offsetY: number; scaleX: number; scaleY: number } {
  const phase = slotIndex * 1.57;
  const breath = Math.sin(nowSec * 2.2 + phase);
  return {
    offsetY: breath * 0.22,
    scaleX: 1 - breath * 0.007,
    scaleY: 1 + breath * 0.012,
  };
}

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

export function getCharacterAtlasUv(
  atlasIndex: number,
  cols: number,
  rows: number,
  frameCount: number
): { u: number; v: number; repeatU: number; repeatV: number } {
  const clamped = Math.max(0, Math.min(frameCount - 1, atlasIndex | 0));
  const col = clamped % cols;
  const row = Math.floor(clamped / cols);
  const repeatU = 1 / cols;
  const repeatV = 1 / rows;
  return {
    u: col * repeatU,
    v: (rows - 1 - row) * repeatV,
    repeatU,
    repeatV,
  };
}

export function getNormalizedCellPlacement(frame: MascotAtlasFrame, cols: number = ATLAS_GRID) {
  const col = frame.atlasIndex % cols;
  const row = Math.floor(frame.atlasIndex / cols);
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
 * Dynamically computes the header mascot's left entry, wordmark play perch,
 * cat counter badge sitting perch, safe middle click corridor, and right exit coordinates.
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

  const entryLeftWorldX = -stageWidth * 0.5 - runQuadSize * 0.58;
  const exitRightWorldX = stageWidth * 0.5 + runQuadSize * 0.58;
  const takeoffDomX = Math.max(Math.round(runQuadSize * 0.48) + 4, playDomX - 22);
  const wordmarkTakeoffWorldX = takeoffDomX - stageWidth * 0.5;

  const wmLetterTopDomY = Math.max(26, Math.min(stageHeight - 20, wmRect.top + wmRect.height * 0.4));
  const wmAvailHeight = Math.max(21, wmLetterTopDomY - 5.5);
  const wordmarkQuadSize = Math.max(33, Math.min(39, wmAvailHeight / 0.6484375));
  const wmDomCenterY = wmLetterTopDomY - (0.5 - footRatioFromBottom) * wordmarkQuadSize;
  const wordmarkPlayQuadY = stageHeight * 0.5 - wmDomCenterY;
  const wordmarkSafeTopHeightPx = Math.max(16, Math.round(wmRect.top + 4));

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

  const isMobile = stageWidth < 600;
  const maxSafeBasecampQuad = Math.floor((badgeTopDomY + 3.8) / (1 - footRatioFromBottom) - 2);
  const basecampQuadSize = isMobile
    ? Math.max(22, Math.min(26, maxSafeBasecampQuad))
    : Math.max(25, Math.min(30, maxSafeBasecampQuad));

  const basecampPawsDomY = badgeTopDomY + 4;
  const slotDomCenterY = basecampPawsDomY - (0.5 - footRatioFromBottom) * basecampQuadSize;
  const slotBaseWorldY = stageHeight * 0.5 - slotDomCenterY;

  const slotSpacing = isMobile ? 16.5 : 23.0;
  const basecampHitboxW = Math.max(20, Math.round(basecampQuadSize * 0.88));
  const basecampHitboxH = Math.max(18, Math.round(badgeTopDomY + 2));

  const basecampSlots: Record<MascotCharacterId, BasecampSlot> = {
    oyen: {
      characterId: 'oyen',
      slotIndex: 0,
      worldX: badgeWorldX - slotSpacing,
      worldY: slotBaseWorldY,
      quadSize: basecampQuadSize,
      zIndex: 0.01,
      hitboxLeftPx: Math.round(badgeDomCenterX - slotSpacing - basecampHitboxW * 0.5),
      hitboxTopPx: 0,
      hitboxWidthPx: basecampHitboxW,
      hitboxHeightPx: basecampHitboxH,
    },
    mujaer: {
      characterId: 'mujaer',
      slotIndex: 1,
      worldX: badgeWorldX,
      worldY: isMobile ? slotBaseWorldY + 1.5 : slotBaseWorldY,
      quadSize: basecampQuadSize,
      zIndex: -0.02,
      hitboxLeftPx: Math.round(badgeDomCenterX - basecampHitboxW * 0.5),
      hitboxTopPx: 0,
      hitboxWidthPx: basecampHitboxW,
      hitboxHeightPx: basecampHitboxH,
    },
    putih: {
      characterId: 'putih',
      slotIndex: 2,
      worldX: badgeWorldX + slotSpacing,
      worldY: slotBaseWorldY,
      quadSize: basecampQuadSize * 0.98,
      zIndex: 0.02,
      hitboxLeftPx: Math.round(badgeDomCenterX + slotSpacing - basecampHitboxW * 0.5),
      hitboxTopPx: 0,
      hitboxWidthPx: basecampHitboxW,
      hitboxHeightPx: basecampHitboxH,
    },
  };

  const badgeFloorDomX = Math.max(wmRect.left + wmRect.width + 12, bRect.left - 18);
  const badgeFloorWorldX = badgeFloorDomX - stageWidth * 0.5;

  const corridorLeftDomX = Math.round(wmRect.left + wmRect.width + 6);
  const corridorRightDomX = Math.round(bRect.left - 6);

  const hitboxWidthPx = 44;
  const hitboxLeftPx = Math.round(badgeDomCenterX - hitboxWidthPx * 0.5);
  const hitboxTopPx = 0;
  const hitboxHeightPx = Math.max(20, Math.round(badgeTopDomY));

  const bounds = getPatrolBounds(stageWidth, runQuadSize);

  return {
    entryLeftWorldX,
    exitRightWorldX,
    wordmarkTakeoffWorldX,
    wordmarkPlayWorldX,
    wordmarkPlayQuadY,
    wordmarkQuadSize,
    wordmarkSafeTopHeightPx,
    badgeTakeoffWorldX,
    badgeWorldX,
    badgePerchQuadY,
    badgeQuadSize,
    badgeFloorWorldX,
    basecampSlots,
    floorBaseQuadY,
    runSpeed: bounds.runSpeed,
    corridorLeftDomX,
    corridorRightDomX,
    hitboxLeftPx,
    hitboxTopPx,
    hitboxWidthPx,
    hitboxHeightPx,
  };
}

/**
 * Computes an interactive tap/click hitbox that tracks the active mascot when perched or running
 * while guaranteeing zero overlap with the Cuking logo link and cat counter / quick-add buttons.
 */
export function computeSafeMascotHitbox(
  state: MascotAnimState,
  worldX: number,
  stageWidth: number,
  stageHeight: number,
  targets: HeaderMascotTargets,
  reducedMotion: boolean
): SafeHitboxRect {
  if (reducedMotion) {
    return {
      leftPx: targets.hitboxLeftPx,
      topPx: targets.hitboxTopPx,
      widthPx: targets.hitboxWidthPx,
      heightPx: targets.hitboxHeightPx,
      enabled: false,
    };
  }

  if (state === 'SIT_ON_BADGE' || state === 'BASECAMP_IDLE' || state === 'BASECAMP_REST' || state === 'SETTLE_BASECAMP') {
    return {
      leftPx: targets.hitboxLeftPx,
      topPx: targets.hitboxTopPx,
      widthPx: targets.hitboxWidthPx,
      heightPx: targets.hitboxHeightPx,
      enabled: true,
    };
  }

  if (state === 'PLAY_ON_WORDMARK' || state === 'PAUSE_ON_WORDMARK') {
    const domX = Math.round(targets.wordmarkPlayWorldX + stageWidth * 0.5);
    return {
      leftPx: Math.max(4, domX - 20),
      topPx: 0,
      widthPx: 40,
      heightPx: targets.wordmarkSafeTopHeightPx,
      enabled: true,
    };
  }

  if (state === 'RUN_IN' || state === 'RUN_TO_BADGE' || state === 'RUN_OUT' || state === 'RUN_TO_WORDMARK') {
    const domX = worldX + stageWidth * 0.5;
    const desiredLeft = Math.round(domX - 22);
    const desiredRight = desiredLeft + 44;
    const clampedLeft = Math.max(targets.corridorLeftDomX, desiredLeft);
    const clampedRight = Math.min(targets.corridorRightDomX, desiredRight);
    const widthPx = clampedRight - clampedLeft;

    if (widthPx >= 24) {
      const heightPx = Math.min(44, Math.max(28, stageHeight - 10));
      return {
        leftPx: clampedLeft,
        topPx: Math.max(4, stageHeight - heightPx - 4),
        widthPx,
        heightPx,
        enabled: true,
      };
    }
  }

  return {
    leftPx: targets.hitboxLeftPx,
    topPx: targets.hitboxTopPx,
    widthPx: targets.hitboxWidthPx,
    heightPx: targets.hitboxHeightPx,
    enabled: false,
  };
}

export function computeRunnerHitbox(
  state: MascotAnimState,
  worldX: number,
  stageWidth: number,
  stageHeight: number,
  targets: HeaderMascotTargets,
  reducedMotion: boolean
): SafeHitboxRect {
  if (reducedMotion) {
    return {
      leftPx: targets.hitboxLeftPx,
      topPx: targets.hitboxTopPx,
      widthPx: targets.hitboxWidthPx,
      heightPx: targets.hitboxHeightPx,
      enabled: false,
    };
  }

  if (state === 'PLAY_ON_WORDMARK' || state === 'PAUSE_ON_WORDMARK') {
    const domX = Math.round(targets.wordmarkPlayWorldX + stageWidth * 0.5);
    return {
      leftPx: Math.max(4, domX - 20),
      topPx: 0,
      widthPx: 40,
      heightPx: targets.wordmarkSafeTopHeightPx,
      enabled: true,
    };
  }

  if (
    state === 'RUN_TO_WORDMARK' ||
    state === 'RUN_TO_BASECAMP' ||
    state === 'RUN_IN' ||
    state === 'RUN_TO_BADGE' ||
    state === 'RUN_OUT' ||
    state === 'RUNNING_PAUSED' ||
    state === 'RUNNING_REACT' ||
    state === 'GUEST_RUN_OUT' ||
    state === 'GUEST_RUN_BACK' ||
    state === 'GUEST_PLAY'
  ) {
    const domX = worldX + stageWidth * 0.5;
    const desiredLeft = Math.round(domX - 22);
    const desiredRight = desiredLeft + 44;
    const clampedLeft = Math.max(targets.corridorLeftDomX, desiredLeft);
    const clampedRight = Math.min(targets.corridorRightDomX, desiredRight);
    const widthPx = clampedRight - clampedLeft;

    if (widthPx >= 22) {
      const heightPx = Math.min(44, Math.max(28, stageHeight - 10));
      return {
        leftPx: clampedLeft,
        topPx: Math.max(4, stageHeight - heightPx - 4),
        widthPx,
        heightPx,
        enabled: true,
      };
    }
  }

  return {
    leftPx: targets.hitboxLeftPx,
    topPx: targets.hitboxTopPx,
    widthPx: targets.hitboxWidthPx,
    heightPx: targets.hitboxHeightPx,
    enabled: false,
  };
}

function pickAirJumpFrame(airT: number, jumpFrames: readonly number[]): number {
  if (jumpFrames.length <= 4) {
    if (airT < 0.44) return jumpFrames[1] ?? jumpFrames[0];
    if (airT < 0.76) return jumpFrames[2] ?? jumpFrames[0];
    return jumpFrames[3] ?? jumpFrames[jumpFrames.length - 1];
  }
  const airCount = jumpFrames.length - 1;
  const idx = 1 + Math.min(airCount - 1, Math.max(0, Math.floor(airT * airCount)));
  return jumpFrames[idx];
}

export function evaluateJumpPhase(
  progress: number,
  maxJumpHeight: number,
  jumpFrames: readonly number[] = JUMP_FRAME_INDICES
): {
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
      atlasIndex: jumpFrames[0],
      jumpY: 0,
      squashX: 1 + crouch * 0.045,
      squashY: 1 - crouch * 0.055,
    };
  }

  const airT = (t - 0.16) / 0.84;
  const parabola = 4 * airT * (1 - airT);
  const jumpY = parabola * maxJumpHeight;

  let atlasIndex: number;
  if (jumpFrames.length <= 4) {
    atlasIndex = jumpFrames[3] ?? jumpFrames[jumpFrames.length - 1];
    if (t < 0.46) {
      atlasIndex = jumpFrames[1] ?? jumpFrames[0];
    } else if (t < 0.74) {
      atlasIndex = jumpFrames[2] ?? jumpFrames[0];
    }
  } else {
    atlasIndex = pickAirJumpFrame(airT, jumpFrames);
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
  landingIdleFrame: number = IDLE_FRAME_INDICES[0],
  jumpFrames: readonly number[] = JUMP_FRAME_INDICES
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
      atlasIndex: jumpFrames[0],
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
    const atlasIndex = pickAirJumpFrame(airT, jumpFrames);

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
  const landJumpFrame = jumpFrames[jumpFrames.length - 1];
  return {
    atlasIndex: landT < 0.45 ? landJumpFrame : landingIdleFrame,
    x: targetX,
    y: targetY - cushion * 0.65,
    quadSize: targetSize,
    squashX: 1 + cushion * 0.05,
    squashY: 1 - cushion * 0.055,
  };
}

export function evaluateWordmarkPlayPhase(
  progress: number,
  playSequence: readonly [number, number, number, number] = [12, 2, 13, 3],
  settleFrames: readonly [number, number] = [1, 0]
): {
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
      atlasIndex: p < 0.52 ? playSequence[0] : playSequence[1],
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
      atlasIndex: p < 0.58 ? playSequence[2] : playSequence[3],
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
    atlasIndex: p < 0.5 ? settleFrames[0] : settleFrames[1],
    offsetX: 0,
    offsetY: 0,
    scaleX: 1 + settle * 0.025,
    scaleY: 1 - settle * 0.025,
    tiltZ: Math.sin(p * Math.PI * 2) * 0.03 * (1 - p),
  };
}
