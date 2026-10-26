import React, { useEffect, useRef, useState } from 'react';
import {
  CanvasTexture,
  CustomBlending,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';

import lariSheetUrl from '../../sprite sheet/lari.png';
import lompatSheetUrl from '../../sprite sheet/lompat.png';
import orenMasterUrl from '../../sprite sheet/oren master.png';
import mujaerSheetUrl from '../../sprite sheet/Tabby Cat Animation Sprite Sheet.png';
import putihSheetUrl from '../../sprite sheet/Fluffy Kitten Animation Sprite Sheet.png';
import {
  ATLAS_CELL_SIZE,
  ATLAS_FLOOR_Y,
  JUMP_DURATION_SEC,
  MASCOT_CHARACTER_CONFIGS,
  MASCOT_TURN_ORDER,
  PAUSE_1S_DURATION_SEC,
  PLAY_DURATION_SEC,
  POST_INTERACT_SIT_SEC,
  computeHeaderMascotTargets,
  computeRunnerHitbox,
  evaluateArcJumpToTargetPhase,
  evaluateBasecampBreathing,
  evaluateJumpPhase,
  evaluateWordmarkPlayPhase,
  getCharacterAtlasUv,
  getMascotRoleState,
  getNormalizedCellPlacement,
  getResponsiveQuadSize,
  type ElementRectLike,
  type HeaderMascotTargets,
  type MascotAnimState,
  type MascotAtlasFrame,
  type MascotCharacterId,
} from '../config/oyenMascotConfig';

// Per-character singleton session cache: each character's sprite sheet is composited into POT atlas at most once
const sharedAtlasCache = new Map<MascotCharacterId, Promise<HTMLCanvasElement>>();

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawFrameIntoAtlas(
  ctx: CanvasRenderingContext2D,
  srcImg: HTMLImageElement,
  frame: MascotAtlasFrame,
  cols: number
): void {
  const { dx, dy, dw, dh } = getNormalizedCellPlacement(frame, cols);
  if (!frame.clipPoly || frame.clipPoly.length < 3) {
    ctx.drawImage(srcImg, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
    return;
  }

  const sx = dw / frame.w;
  const sy = dh / frame.h;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < frame.clipPoly.length; i++) {
    const [px, py] = frame.clipPoly[i];
    const cx = dx + (px - frame.x) * sx;
    const cy = dy + (py - frame.y) * sy;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(srcImg, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
  ctx.restore();
}

function buildFallbackMasterAtlas(
  masterImg: HTMLImageElement,
  cols: number,
  rows: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = cols * ATLAS_CELL_SIZE;
  canvas.height = rows * ATLAS_CELL_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for fallback atlas');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const scale = Math.min(180 / masterImg.naturalWidth, 180 / masterImg.naturalHeight);
  const dw = Math.round(masterImg.naturalWidth * scale);
  const dh = Math.round(masterImg.naturalHeight * scale);
  const dx = Math.round((ATLAS_CELL_SIZE - dw) * 0.5);
  const dy = Math.round(ATLAS_FLOOR_Y - dh);
  ctx.drawImage(masterImg, dx, dy, dw, dh);
  return canvas;
}

function getCharacterAtlasCanvas(characterId: MascotCharacterId): Promise<HTMLCanvasElement> {
  const existing = sharedAtlasCache.get(characterId);
  if (existing) return existing;

  const cfg = MASCOT_CHARACTER_CONFIGS[characterId];
  const atlasWidth = cfg.atlasCols * ATLAS_CELL_SIZE;
  const atlasHeight = cfg.atlasRows * ATLAS_CELL_SIZE;

  const promise = (async () => {
    if (characterId === 'oyen') {
      try {
        const [lariImg, lompatImg] = await Promise.all([
          loadImageElement(lariSheetUrl),
          loadImageElement(lompatSheetUrl),
        ]);
        const canvas = document.createElement('canvas');
        canvas.width = atlasWidth;
        canvas.height = atlasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D context unavailable for Oyen sprite atlas');

        ctx.clearRect(0, 0, atlasWidth, atlasHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (const frame of cfg.frames) {
          const srcImg = frame.sheet === 'lari' ? lariImg : lompatImg;
          drawFrameIntoAtlas(ctx, srcImg, frame, cfg.atlasCols);
        }
        return canvas;
      } catch {
        const masterImg = await loadImageElement(orenMasterUrl);
        return buildFallbackMasterAtlas(masterImg, cfg.atlasCols, cfg.atlasRows);
      }
    }

    const sheetUrl = characterId === 'mujaer' ? mujaerSheetUrl : putihSheetUrl;
    const sheetImg = await loadImageElement(sheetUrl);
    const canvas = document.createElement('canvas');
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`2D context unavailable for ${characterId} sprite atlas`);

    ctx.clearRect(0, 0, atlasWidth, atlasHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const frame of cfg.frames) {
      drawFrameIntoAtlas(ctx, sheetImg, frame, cfg.atlasCols);
    }
    return canvas;
  })().catch((err) => {
    sharedAtlasCache.delete(characterId);
    throw err;
  });

  sharedAtlasCache.set(characterId, promise);
  return promise;
}

function createSoftShadowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(28, 25, 23, 0.22)');
    grad.addColorStop(0.55, 'rgba(28, 25, 23, 0.09)');
    grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  return c;
}

function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

interface MascotMemberRuntime {
  id: MascotCharacterId;
  slotIndex: number;
  x: number;
  y: number;
  z: number;
  quadSize: number;
  facing: 1 | -1;
  activeFrame: number;
  currentAtlasIdx: number;
  scaleX: number;
  scaleY: number;
  tiltZ: number;
  opacity: number;
  blinkTimer: number;
  blinking: boolean;
  sitPrimaryFrame: number;
  sitVariantFrame: number;
  isInteracting: boolean;
  interactTimer: number;
  interactBaseX: number;
  interactBaseY: number;
  interactBaseSize: number;
  interactReactionFrame: number;
}

export const OyenHeaderMascot: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const basecampHitboxRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  const runnerHitboxRef = useRef<HTMLButtonElement>(null);
  const guestRunnerHitboxRef = useRef<HTMLButtonElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(() => detectWebGLSupport());

  const pendingBasecampClicks = useRef<Record<MascotCharacterId, ReturnType<typeof setTimeout> | null>>({
    oyen: null,
    mujaer: null,
    putih: null,
  });

  const controllerRef = useRef({
    activeRunnerId: null as MascotCharacterId | null,
    guestRunnerId: null as MascotCharacterId | null,
    activeTurnIndex: 0,
    tourState: 'BASECAMP_REST' as MascotAnimState,
    tourTimer: 0,
    tourClock: 0,
    tourSpeedJitter: 1.0,
    playDuration: PLAY_DURATION_SEC,
    pauseDuration: PAUSE_1S_DURATION_SEC,
    basecampRestDuration: 2.2,
    jumpStartX: 0,
    jumpStartY: 0,
    jumpStartSize: 60,
    // Guest runner (join-run) state
    guestTourState: 'BASECAMP_REST' as MascotAnimState,
    guestTimer: 0,
    guestClock: 0,
    guestJumpStartX: 0,
    guestJumpStartY: 0,
    guestJumpStartSize: 60,
    stageWidth: 360,
    stageHeight: 62,
    runQuadSize: 60,
    targets: null as HeaderMascotTargets | null,
    initializedLayout: false,
    members: {
      oyen: {
        id: 'oyen',
        slotIndex: 0,
        x: 0,
        y: 0,
        z: 0.01,
        quadSize: 34,
        facing: 1,
        activeFrame: MASCOT_CHARACTER_CONFIGS.oyen.sitFrames[0],
        currentAtlasIdx: -1,
        scaleX: 1,
        scaleY: 1,
        tiltZ: 0,
        opacity: 0,
        blinkTimer: 1.5,
        blinking: false,
        sitPrimaryFrame: MASCOT_CHARACTER_CONFIGS.oyen.sitFrames[0],
        sitVariantFrame: MASCOT_CHARACTER_CONFIGS.oyen.sitFrames[1] ?? MASCOT_CHARACTER_CONFIGS.oyen.sitFrames[0],
        isInteracting: false,
        interactTimer: 0,
        interactBaseX: 0,
        interactBaseY: 0,
        interactBaseSize: 34,
        interactReactionFrame: MASCOT_CHARACTER_CONFIGS.oyen.interactReactionFrame,
      },
      mujaer: {
        id: 'mujaer',
        slotIndex: 1,
        x: 0,
        y: 0,
        z: -0.02,
        quadSize: 34,
        facing: 1,
        activeFrame: MASCOT_CHARACTER_CONFIGS.mujaer.sitFrames[0],
        currentAtlasIdx: -1,
        scaleX: 1,
        scaleY: 1,
        tiltZ: 0,
        opacity: 0,
        blinkTimer: 2.3,
        blinking: false,
        sitPrimaryFrame: MASCOT_CHARACTER_CONFIGS.mujaer.sitFrames[0],
        sitVariantFrame: MASCOT_CHARACTER_CONFIGS.mujaer.sitFrames[1] ?? MASCOT_CHARACTER_CONFIGS.mujaer.sitFrames[0],
        isInteracting: false,
        interactTimer: 0,
        interactBaseX: 0,
        interactBaseY: 0,
        interactBaseSize: 34,
        interactReactionFrame: MASCOT_CHARACTER_CONFIGS.mujaer.interactReactionFrame,
      },
      putih: {
        id: 'putih',
        slotIndex: 2,
        x: 0,
        y: 0,
        z: 0.02,
        quadSize: 34,
        facing: 1,
        activeFrame: MASCOT_CHARACTER_CONFIGS.putih.sitFrames[0],
        currentAtlasIdx: -1,
        scaleX: 1,
        scaleY: 1,
        tiltZ: 0,
        opacity: 0,
        blinkTimer: 3.1,
        blinking: false,
        sitPrimaryFrame: MASCOT_CHARACTER_CONFIGS.putih.sitFrames[0],
        sitVariantFrame: MASCOT_CHARACTER_CONFIGS.putih.sitFrames[1] ?? MASCOT_CHARACTER_CONFIGS.putih.sitFrames[0],
        isInteracting: false,
        interactTimer: 0,
        interactBaseX: 0,
        interactBaseY: 0,
        interactBaseSize: 34,
        interactReactionFrame: MASCOT_CHARACTER_CONFIGS.putih.interactReactionFrame,
      },
    } as Record<MascotCharacterId, MascotMemberRuntime>,
  });

  useEffect(() => {
    if (!webglSupported) return;
    const stageEl = stageRef.current;
    const canvasEl = canvasRef.current;
    if (!stageEl || !canvasEl) return;
    const basecampClicks = pendingBasecampClicks.current;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas: canvasEl,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
        premultipliedAlpha: true,
      });
    } catch {
      queueMicrotask(() => setWebglSupported(false));
      return;
    }

    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    const fovDeg = 26;
    const halfFovTan = Math.tan((fovDeg * Math.PI) / 360);
    const camera = new PerspectiveCamera(fovDeg, 2, 1, 1000);

    const shadowTex = new CanvasTexture(createSoftShadowCanvas());
    shadowTex.premultiplyAlpha = true;
    const shadowGeo = new PlaneGeometry(1, 1);
    const spriteGeo = new PlaneGeometry(1, 1);

    interface CharMeshBundle {
      id: MascotCharacterId;
      spriteMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
      shadowMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
      spriteMat: MeshBasicMaterial;
      shadowMat: MeshBasicMaterial;
      texture: CanvasTexture | null;
    }

    const charBundles = new Map<MascotCharacterId, CharMeshBundle>();

    for (const charId of MASCOT_TURN_ORDER) {
      const shadowMat = new MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
        depthWrite: false,
      });
      const shadowMesh = new Mesh(shadowGeo, shadowMat);

      const spriteMat = new MeshBasicMaterial({
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
        side: DoubleSide,
        depthWrite: false,
        opacity: 0,
      });
      const spriteMesh = new Mesh(spriteGeo, spriteMat);

      scene.add(shadowMesh);
      scene.add(spriteMesh);

      charBundles.set(charId, {
        id: charId,
        spriteMesh,
        shadowMesh,
        spriteMat,
        shadowMat,
        texture: null,
      });
    }

    let disposed = false;
    let rafId = 0;
    let isPageVisible = typeof document !== 'undefined' ? !document.hidden : true;
    let isStageIntersecting = true;
    let reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyAtlasFrame = (bundle: CharMeshBundle, idx: number) => {
      const tex = bundle.texture;
      if (!tex) return;
      const mem = controllerRef.current.members[bundle.id];
      if (mem.currentAtlasIdx === idx) return;
      mem.currentAtlasIdx = idx;

      const cfg = MASCOT_CHARACTER_CONFIGS[bundle.id];
      const { u, v, repeatU, repeatV } = getCharacterAtlasUv(
        idx,
        cfg.atlasCols,
        cfg.atlasRows,
        cfg.frames.length
      );
      tex.repeat.set(repeatU, repeatV);
      tex.offset.set(u, v);
    };

    const measureRelRect = (selector: string): ElementRectLike | null => {
      const parentHeader = stageEl.parentElement;
      if (!parentHeader) return null;
      const el = parentHeader.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const stageRect = stageEl.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (stageRect.width <= 0 || rect.width <= 0) return null;
      return {
        left: rect.left - stageRect.left,
        top: rect.top - stageRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const measureFreshTargets = (w: number, h: number, runQuad: number): HeaderMascotTargets => {
      const wmRect = measureRelRect('.brand-title-img, .brand-wrapper');
      const badgeRect = measureRelRect(
        '#header-cat-counter-badge, .header-status-pill, #header-catalog-quick-add, .header-status-cluster'
      );
      return computeHeaderMascotTargets(w, h, runQuad, wmRect, badgeRect);
    };

    let lastHitboxSig = '';
    const syncDomStateAndHitboxes = (targets: HeaderMascotTargets) => {
      const ctrl = controllerRef.current;
      const activeChar = ctrl.activeRunnerId ?? 'basecamp';
      const role = getMascotRoleState(ctrl.tourState);
      const isRunnerPaused = ctrl.activeRunnerId ? ctrl.members[ctrl.activeRunnerId].isInteracting : false;
      const currentOyenState = isRunnerPaused ? 'RUNNING_REACT' : ctrl.tourState;
      const currentRole = isRunnerPaused ? 'running-react' : role;

      const runnerHb = computeRunnerHitbox(
        ctrl.tourState,
        ctrl.activeRunnerId ? ctrl.members[ctrl.activeRunnerId].x : targets.badgeWorldX,
        ctrl.stageWidth,
        ctrl.stageHeight,
        targets,
        reducedMotion
      );

      const guestHb = computeRunnerHitbox(
        ctrl.guestTourState,
        ctrl.guestRunnerId ? ctrl.members[ctrl.guestRunnerId].x : targets.badgeWorldX,
        ctrl.stageWidth,
        ctrl.stageHeight,
        targets,
        reducedMotion
      );

      const sig = `${activeChar}|${ctrl.guestRunnerId || ''}|${currentOyenState}|${ctrl.members.oyen.isInteracting ? 1 : 0}|${ctrl.members.mujaer.isInteracting ? 1 : 0}|${ctrl.members.putih.isInteracting ? 1 : 0}|${runnerHb.enabled ? 1 : 0}|${runnerHb.leftPx}|${runnerHb.topPx}|${guestHb.enabled ? 1 : 0}|${guestHb.leftPx}`;
      if (sig !== lastHitboxSig) {
        lastHitboxSig = sig;
        stageEl.dataset.oyenState = currentOyenState;
        stageEl.dataset.mascotCharacter = activeChar;
        stageEl.dataset.mascotRole = currentRole;
        stageEl.dataset.basecampActive = 'true';
        if (ctrl.guestRunnerId) {
          stageEl.dataset.guestRunner = ctrl.guestRunnerId;
        } else {
          delete stageEl.dataset.guestRunner;
        }

        // 1. Sync 3 Basecamp Slot hitboxes (enabled only if character is currently at basecamp)
        MASCOT_TURN_ORDER.forEach((charId, idx) => {
          const btn = basecampHitboxRefs.current[idx];
          if (!btn) return;
          const slot = targets.basecampSlots[charId];
          const isAtBasecamp = ctrl.activeRunnerId !== charId && ctrl.guestRunnerId !== charId;
          const isEnabled = !reducedMotion && isAtBasecamp;
          const isMemInteracting = ctrl.members[charId].isInteracting;

          btn.style.left = `${slot.hitboxLeftPx}px`;
          btn.style.top = `${slot.hitboxTopPx}px`;
          btn.style.width = `${slot.hitboxWidthPx}px`;
          btn.style.height = `${slot.hitboxHeightPx}px`;
          btn.style.pointerEvents = isEnabled ? 'auto' : 'none';
          btn.dataset.mascotCharacter = charId;
          btn.dataset.mascotRole = isMemInteracting ? 'basecamp-react' : (isAtBasecamp ? 'basecamp-idle' : 'running');
          btn.dataset.oyenState = isMemInteracting ? 'BASECAMP_REACT' : 'BASECAMP_IDLE';
        });

        // 2. Sync Main Runner Hitbox
        const runnerBtn = runnerHitboxRef.current;
        if (runnerBtn) {
          runnerBtn.style.left = `${runnerHb.leftPx}px`;
          runnerBtn.style.top = `${runnerHb.topPx}px`;
          runnerBtn.style.width = `${runnerHb.widthPx}px`;
          runnerBtn.style.height = `${runnerHb.heightPx}px`;
          runnerBtn.style.pointerEvents = runnerHb.enabled ? 'auto' : 'none';
          runnerBtn.dataset.mascotCharacter = ctrl.activeRunnerId ?? 'oyen';
          runnerBtn.dataset.mascotRole = isRunnerPaused ? 'running-react' : role;
          runnerBtn.dataset.oyenState = currentOyenState;
        }

        // 3. Sync Guest Runner Hitbox
        const guestBtn = guestRunnerHitboxRef.current;
        if (guestBtn) {
          guestBtn.style.left = `${guestHb.leftPx}px`;
          guestBtn.style.top = `${guestHb.topPx}px`;
          guestBtn.style.width = `${guestHb.widthPx}px`;
          guestBtn.style.height = `${guestHb.heightPx}px`;
          guestBtn.style.pointerEvents = guestHb.enabled ? 'auto' : 'none';
          guestBtn.dataset.mascotCharacter = ctrl.guestRunnerId ?? '';
          guestBtn.dataset.mascotRole = 'join-running';
          guestBtn.dataset.oyenState = ctrl.guestTourState;
        }
      }
    };

    const refreshLayoutAndTargets = () => {
      const rect = stageEl.getBoundingClientRect();
      const w = Math.max(200, Math.round(rect.width || 360));
      const h = Math.max(48, Math.round(rect.height || 62));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const ctrl = controllerRef.current;
      ctrl.stageWidth = w;
      ctrl.stageHeight = h;
      ctrl.runQuadSize = getResponsiveQuadSize(w);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.aspect = w / h;
      camera.position.set(0, 0, h / (2 * halfFovTan));
      camera.updateProjectionMatrix();

      const targets = measureFreshTargets(w, h, ctrl.runQuadSize);
      ctrl.targets = targets;

      // Position basecamp residents if not out running
      for (const charId of MASCOT_TURN_ORDER) {
        const mem = ctrl.members[charId];
        const slot = targets.basecampSlots[charId];
        if (ctrl.activeRunnerId !== charId && ctrl.guestRunnerId !== charId) {
          mem.x = slot.worldX;
          mem.y = slot.worldY;
          mem.z = slot.zIndex;
          mem.quadSize = slot.quadSize;
        }
      }

      ctrl.initializedLayout = true;
      lastHitboxSig = '';
      syncDomStateAndHitboxes(targets);
    };

    refreshLayoutAndTargets();

    let lastTimestamp = 0;

    const renderSingleStep = (nowMs: number) => {
      if (disposed) return;

      const nowSec = nowMs * 0.001;
      const dt = lastTimestamp > 0 ? Math.min((nowMs - lastTimestamp) * 0.001, 0.1) : 0.016;
      lastTimestamp = nowMs;

      const ctrl = controllerRef.current;
      const targets = ctrl.targets ?? measureFreshTargets(ctrl.stageWidth, ctrl.stageHeight, ctrl.runQuadSize);
      ctrl.targets = targets;

      const footRatioFromBottom = (ATLAS_CELL_SIZE - ATLAS_FLOOR_Y) / ATLAS_CELL_SIZE;

      // 1. REDUCED MOTION SAFEGUARD: all 3 sit statically at basecamp
      if (reducedMotion) {
        ctrl.tourState = 'BASECAMP_IDLE';
        ctrl.activeRunnerId = null;
        ctrl.guestRunnerId = null;

        for (const charId of MASCOT_TURN_ORDER) {
          const bundle = charBundles.get(charId);
          if (!bundle || !bundle.texture) continue;
          const mem = ctrl.members[charId];
          const slot = targets.basecampSlots[charId];
          const cfg = MASCOT_CHARACTER_CONFIGS[charId];

          mem.x = slot.worldX;
          mem.y = slot.worldY;
          mem.z = slot.zIndex;
          mem.quadSize = slot.quadSize;
          mem.facing = 1;
          mem.opacity = 1;

          bundle.spriteMesh.visible = true;
          bundle.shadowMesh.visible = true;
          bundle.spriteMat.color.setScalar(1);
          bundle.spriteMat.opacity = 1;

          applyAtlasFrame(bundle, cfg.sitFrames[0]);
          bundle.spriteMesh.position.set(mem.x, mem.y, mem.z);
          bundle.spriteMesh.scale.set(mem.quadSize, mem.quadSize, 1);
          bundle.spriteMesh.rotation.set(0, 0, 0);

          const perchFloorY = mem.y - mem.quadSize * (0.5 - footRatioFromBottom);
          bundle.shadowMesh.position.set(mem.x, perchFloorY + 0.5, mem.z - 0.005);
          bundle.shadowMesh.scale.set(mem.quadSize * 0.44, 4.6, 1);
          bundle.shadowMat.color.setScalar(0.7);
          bundle.shadowMat.opacity = 0.7;
        }

        syncDomStateAndHitboxes(targets);
        renderer.render(scene, camera);
        return;
      }

      // 2. MAIN ACTIVE RUNNER TOUR STATE MACHINE
      const runnerId = ctrl.activeRunnerId;
      const runnerMem = runnerId ? ctrl.members[runnerId] : null;
      const runnerCfg = runnerId ? MASCOT_CHARACTER_CONFIGS[runnerId] : null;
      const runnerBundle = runnerId ? charBundles.get(runnerId) : null;

      if (!runnerId || !runnerMem || !runnerCfg || !runnerBundle) {
        // GROUP BASECAMP REST: all cats at basecamp
        ctrl.tourState = 'BASECAMP_REST';
        ctrl.tourTimer += dt;

        if (ctrl.tourTimer >= ctrl.basecampRestDuration) {
          const nextRunner = MASCOT_TURN_ORDER[ctrl.activeTurnIndex % MASCOT_TURN_ORDER.length];
          const nextBundle = charBundles.get(nextRunner);
          // Don't pick character if it's already running as guest
          if (nextBundle && nextBundle.texture && ctrl.guestRunnerId !== nextRunner) {
            ctrl.activeRunnerId = nextRunner;
            ctrl.activeTurnIndex += 1;
            ctrl.tourState = 'DEPART_BASECAMP';
            ctrl.tourTimer = 0;
            ctrl.tourClock = 0;
            ctrl.tourSpeedJitter = 0.94 + Math.random() * 0.12;

            const slot = targets.basecampSlots[nextRunner];
            ctrl.jumpStartX = slot.worldX;
            ctrl.jumpStartY = slot.worldY;
            ctrl.jumpStartSize = slot.quadSize;
          }
        }
      } else {
        const charRunQuad = ctrl.runQuadSize * runnerCfg.sizeMultiplier;
        const charWordmarkQuad = targets.wordmarkQuadSize * runnerCfg.sizeMultiplier;
        const charRunSpeed = targets.runSpeed * runnerCfg.speedMultiplier * ctrl.tourSpeedJitter;
        const slot = targets.basecampSlots[runnerId];

        if (runnerMem.isInteracting) {
          // PAUSE RUN: Movement stops in place; character reacts with jump in-place
          runnerMem.interactTimer += dt;
          const prog = runnerMem.interactTimer / JUMP_DURATION_SEC;
          runnerMem.x = runnerMem.interactBaseX;
          runnerMem.y = runnerMem.interactBaseY;
          runnerMem.quadSize = runnerMem.interactBaseSize;

          if (prog < 1.0) {
            const jp = evaluateJumpPhase(prog, 5.0, runnerCfg.jumpFrames);
            runnerMem.activeFrame = jp.atlasIndex;
            runnerMem.y = runnerMem.interactBaseY + jp.jumpY;
            runnerMem.scaleX = jp.squashX;
            runnerMem.scaleY = jp.squashY;
          } else if (runnerMem.interactTimer < POST_INTERACT_SIT_SEC) {
            runnerMem.activeFrame = runnerMem.interactReactionFrame;
            const happyBounce = Math.sin(nowSec * 3.4);
            runnerMem.y = runnerMem.interactBaseY + happyBounce * 0.32;
            runnerMem.scaleX = 1 - happyBounce * 0.008;
            runnerMem.scaleY = 1 + happyBounce * 0.015;
          } else {
            // Reaction complete -> RESUME RUN from exact last position
            runnerMem.isInteracting = false;
            runnerMem.scaleX = 1;
            runnerMem.scaleY = 1;
            runnerMem.y = runnerMem.interactBaseY;
          }
        } else if (ctrl.tourState === 'DEPART_BASECAMP') {
          ctrl.tourTimer += dt;
          const duration = 0.44;
          const prog = Math.min(1, ctrl.tourTimer / duration);
          runnerMem.facing = -1;

          const jp = evaluateArcJumpToTargetPhase(
            prog,
            ctrl.jumpStartX,
            targets.badgeFloorWorldX,
            ctrl.jumpStartY,
            targets.floorBaseQuadY,
            ctrl.jumpStartSize,
            charRunQuad,
            runnerCfg.runFrames[0],
            runnerCfg.jumpFrames
          );
          runnerMem.x = jp.x;
          runnerMem.y = jp.y;
          runnerMem.quadSize = jp.quadSize;
          runnerMem.activeFrame = jp.atlasIndex;
          runnerMem.scaleX = jp.squashX;
          runnerMem.scaleY = jp.squashY;

          if (prog >= 1) {
            ctrl.tourState = 'RUN_TO_WORDMARK';
            ctrl.tourTimer = 0;
            ctrl.tourClock = 0;
          }
        } else if (ctrl.tourState === 'RUN_TO_WORDMARK') {
          ctrl.tourClock += dt;
          runnerMem.facing = -1;
          runnerMem.y = targets.floorBaseQuadY;
          runnerMem.quadSize = charRunQuad;

          const speed = Math.max(76, charRunSpeed);
          const stepX = speed * dt;
          const remaining = runnerMem.x - targets.wordmarkTakeoffWorldX;

          if (remaining <= stepX + 1.5) {
            runnerMem.x = targets.wordmarkTakeoffWorldX;
            ctrl.tourState = 'JUMP_TO_WORDMARK';
            ctrl.tourTimer = 0;
            ctrl.jumpStartX = runnerMem.x;
            ctrl.jumpStartY = targets.floorBaseQuadY;
            ctrl.jumpStartSize = charRunQuad;
          } else {
            runnerMem.x -= stepX;
            const runIdx = Math.floor(ctrl.tourClock * runnerCfg.runFps) % runnerCfg.runFrames.length;
            runnerMem.activeFrame = runnerCfg.runFrames[runIdx];
            runnerMem.tiltZ = Math.sin(ctrl.tourClock * runnerCfg.runFps * Math.PI * 0.5) * 0.018;
          }
        } else if (ctrl.tourState === 'JUMP_TO_WORDMARK') {
          ctrl.tourTimer += dt;
          const prog = Math.min(1, ctrl.tourTimer / JUMP_DURATION_SEC);
          runnerMem.facing = 1;

          const jp = evaluateArcJumpToTargetPhase(
            prog,
            ctrl.jumpStartX,
            targets.wordmarkPlayWorldX,
            ctrl.jumpStartY,
            targets.wordmarkPlayQuadY,
            ctrl.jumpStartSize,
            charWordmarkQuad,
            runnerCfg.idleFrames[1] ?? runnerCfg.idleFrames[0],
            runnerCfg.jumpFrames
          );
          runnerMem.x = jp.x;
          runnerMem.y = jp.y;
          runnerMem.quadSize = jp.quadSize;
          runnerMem.activeFrame = jp.atlasIndex;
          runnerMem.scaleX = jp.squashX;
          runnerMem.scaleY = jp.squashY;

          if (prog >= 1) {
            ctrl.tourState = 'PLAY_ON_WORDMARK';
            ctrl.tourTimer = 0;
            ctrl.playDuration = PLAY_DURATION_SEC * (0.92 + Math.random() * 0.16);
          }
        } else if (ctrl.tourState === 'PLAY_ON_WORDMARK') {
          ctrl.tourTimer += dt;
          const prog = Math.min(1, ctrl.tourTimer / ctrl.playDuration);
          runnerMem.facing = 1;
          runnerMem.x = targets.wordmarkPlayWorldX;
          runnerMem.y = targets.wordmarkPlayQuadY;
          runnerMem.quadSize = charWordmarkQuad;

          const playStep = evaluateWordmarkPlayPhase(
            prog,
            runnerCfg.playSequence,
            runnerCfg.wordmarkSettleFrames
          );
          runnerMem.activeFrame = playStep.atlasIndex;
          runnerMem.x += playStep.offsetX;
          runnerMem.y += playStep.offsetY;
          runnerMem.scaleX = playStep.scaleX;
          runnerMem.scaleY = playStep.scaleY;
          runnerMem.tiltZ = playStep.tiltZ;

          if (prog >= 1) {
            ctrl.tourState = 'PAUSE_ON_WORDMARK';
            ctrl.tourTimer = 0;
            ctrl.pauseDuration = PAUSE_1S_DURATION_SEC + Math.random() * 0.22;
          }
        } else if (ctrl.tourState === 'PAUSE_ON_WORDMARK') {
          ctrl.tourTimer += dt;
          runnerMem.facing = 1;
          runnerMem.x = targets.wordmarkPlayWorldX;
          runnerMem.y = targets.wordmarkPlayQuadY;
          runnerMem.quadSize = charWordmarkQuad;

          const isExpressing = ctrl.tourTimer >= 0.42 && ctrl.tourTimer <= 0.8;
          runnerMem.activeFrame = isExpressing ? runnerCfg.wordmarkSettleFrames[0] : runnerCfg.wordmarkSettleFrames[1];

          const breath = Math.sin(nowSec * 2.4);
          runnerMem.y += breath * 0.28;
          runnerMem.scaleY = 1 + breath * 0.012;
          runnerMem.scaleX = 1 - breath * 0.006;

          if (ctrl.tourTimer >= ctrl.pauseDuration) {
            ctrl.tourState = 'RUN_TO_BASECAMP';
            ctrl.tourClock = 0;
            ctrl.jumpStartY = runnerMem.y;
            ctrl.jumpStartSize = runnerMem.quadSize;
          }
        } else if (ctrl.tourState === 'RUN_TO_BASECAMP') {
          ctrl.tourClock += dt;
          runnerMem.facing = 1;

          const hopDownT = Math.min(1, ctrl.tourClock / 0.25);
          const hopArc = 4 * hopDownT * (1 - hopDownT) * 2.4;
          runnerMem.y = ctrl.jumpStartY + (targets.floorBaseQuadY - ctrl.jumpStartY) * hopDownT + hopArc;
          runnerMem.quadSize = ctrl.jumpStartSize + (charRunQuad - ctrl.jumpStartSize) * hopDownT;

          const speed = Math.max(76, charRunSpeed);
          const stepX = speed * dt;
          const remaining = targets.badgeFloorWorldX - runnerMem.x;

          if (remaining <= stepX + 1.5 && hopDownT >= 1) {
            runnerMem.x = targets.badgeFloorWorldX;
            ctrl.tourState = 'RETURN_TO_BASECAMP';
            ctrl.tourTimer = 0;
            ctrl.jumpStartX = runnerMem.x;
            ctrl.jumpStartY = targets.floorBaseQuadY;
            ctrl.jumpStartSize = charRunQuad;
          } else {
            runnerMem.x += stepX;
            const runIdx = Math.floor(ctrl.tourClock * runnerCfg.runFps) % runnerCfg.runFrames.length;
            runnerMem.activeFrame = runnerCfg.runFrames[runIdx];
            runnerMem.tiltZ = -Math.sin(ctrl.tourClock * runnerCfg.runFps * Math.PI * 0.5) * 0.018;
          }
        } else if (ctrl.tourState === 'RETURN_TO_BASECAMP') {
          ctrl.tourTimer += dt;
          const duration = 0.52;
          const prog = Math.min(1, ctrl.tourTimer / duration);
          runnerMem.facing = 1;

          const jp = evaluateArcJumpToTargetPhase(
            prog,
            ctrl.jumpStartX,
            slot.worldX,
            ctrl.jumpStartY,
            slot.worldY,
            ctrl.jumpStartSize,
            slot.quadSize,
            runnerCfg.sitFrames[0],
            runnerCfg.jumpFrames
          );
          runnerMem.x = jp.x;
          runnerMem.y = jp.y;
          runnerMem.quadSize = jp.quadSize;
          runnerMem.activeFrame = jp.atlasIndex;
          runnerMem.scaleX = jp.squashX;
          runnerMem.scaleY = jp.squashY;

          if (prog >= 1) {
            ctrl.tourState = 'SETTLE_BASECAMP';
            ctrl.tourTimer = 0;
          }
        } else if (ctrl.tourState === 'SETTLE_BASECAMP') {
          ctrl.tourTimer += dt;
          runnerMem.facing = 1;
          runnerMem.x = slot.worldX;
          runnerMem.y = slot.worldY;
          runnerMem.quadSize = slot.quadSize;
          runnerMem.activeFrame = runnerCfg.sitFrames[0];

          const cushionProg = Math.min(1, ctrl.tourTimer / 0.28);
          const cushion = Math.sin(cushionProg * Math.PI);
          runnerMem.y = slot.worldY - cushion * 0.55;
          runnerMem.scaleX = 1 + cushion * 0.04;
          runnerMem.scaleY = 1 - cushion * 0.045;

          if (cushionProg >= 1) {
            ctrl.tourState = 'BASECAMP_REST';
            ctrl.tourTimer = 0;
            ctrl.activeRunnerId = null;
            ctrl.basecampRestDuration = 2.0 + Math.random() * 0.8;
          }
        }
      }

      // 3. GUEST JOIN-RUNNER STATE MACHINE (Max 2 running concurrently)
      const guestId = ctrl.guestRunnerId;
      if (guestId) {
        const guestMem = ctrl.members[guestId];
        const guestCfg = MASCOT_CHARACTER_CONFIGS[guestId];
        const guestSlot = targets.basecampSlots[guestId];
        const guestRunQuad = ctrl.runQuadSize * guestCfg.sizeMultiplier * 0.94;
        const guestLaneY = targets.floorBaseQuadY + 3.2; // Slightly receded in perspective lane

        if (guestMem.isInteracting) {
          // Guest runner paused by user click
          guestMem.interactTimer += dt;
          const prog = guestMem.interactTimer / JUMP_DURATION_SEC;
          guestMem.x = guestMem.interactBaseX;
          guestMem.y = guestMem.interactBaseY;
          guestMem.quadSize = guestMem.interactBaseSize;

          if (prog < 1.0) {
            const jp = evaluateJumpPhase(prog, 4.5, guestCfg.jumpFrames);
            guestMem.activeFrame = jp.atlasIndex;
            guestMem.y = guestMem.interactBaseY + jp.jumpY;
            guestMem.scaleX = jp.squashX;
            guestMem.scaleY = jp.squashY;
          } else if (guestMem.interactTimer < POST_INTERACT_SIT_SEC) {
            guestMem.activeFrame = guestCfg.interactReactionFrame;
            const happyBounce = Math.sin(nowSec * 3.4);
            guestMem.y = guestMem.interactBaseY + happyBounce * 0.32;
            guestMem.scaleX = 1 - happyBounce * 0.008;
            guestMem.scaleY = 1 + happyBounce * 0.015;
          } else {
            guestMem.isInteracting = false;
            guestMem.scaleX = 1;
            guestMem.scaleY = 1;
            guestMem.y = guestMem.interactBaseY;
          }
        } else if (ctrl.guestTourState === 'GUEST_DEPART') {
          ctrl.guestTimer += dt;
          const prog = Math.min(1, ctrl.guestTimer / 0.44);
          guestMem.facing = -1;

          const jp = evaluateArcJumpToTargetPhase(
            prog,
            ctrl.guestJumpStartX,
            targets.badgeFloorWorldX + 16,
            ctrl.guestJumpStartY,
            guestLaneY,
            ctrl.guestJumpStartSize,
            guestRunQuad,
            guestCfg.runFrames[0],
            guestCfg.jumpFrames
          );
          guestMem.x = jp.x;
          guestMem.y = jp.y;
          guestMem.quadSize = jp.quadSize;
          guestMem.activeFrame = jp.atlasIndex;
          guestMem.scaleX = jp.squashX;
          guestMem.scaleY = jp.squashY;

          if (prog >= 1) {
            ctrl.guestTourState = 'GUEST_RUN_OUT';
            ctrl.guestTimer = 0;
            ctrl.guestClock = 0;
          }
        } else if (ctrl.guestTourState === 'GUEST_RUN_OUT') {
          ctrl.guestClock += dt;
          guestMem.facing = -1;
          guestMem.y = guestLaneY;
          guestMem.quadSize = guestRunQuad;

          const speed = Math.max(72, targets.runSpeed * 0.94);
          const stepX = speed * dt;
          const turnPoint = targets.wordmarkPlayWorldX + 44; // Turn around before Cuking wordmark to avoid overlap
          const remaining = guestMem.x - turnPoint;

          if (remaining <= stepX + 1.5) {
            guestMem.x = turnPoint;
            ctrl.guestTourState = 'GUEST_PLAY';
            ctrl.guestTimer = 0;
          } else {
            guestMem.x -= stepX;
            const runIdx = Math.floor(ctrl.guestClock * guestCfg.runFps) % guestCfg.runFrames.length;
            guestMem.activeFrame = guestCfg.runFrames[runIdx];
            guestMem.tiltZ = Math.sin(ctrl.guestClock * guestCfg.runFps * Math.PI * 0.5) * 0.018;
          }
        } else if (ctrl.guestTourState === 'GUEST_PLAY') {
          ctrl.guestTimer += dt;
          guestMem.facing = 1;
          guestMem.y = guestLaneY;
          guestMem.quadSize = guestRunQuad;
          guestMem.activeFrame = guestCfg.interactReactionFrame;

          const hop = Math.sin((ctrl.guestTimer / 0.65) * Math.PI) * 2.2;
          guestMem.y = guestLaneY + Math.max(0, hop);

          if (ctrl.guestTimer >= 0.65) {
            ctrl.guestTourState = 'GUEST_RUN_BACK';
            ctrl.guestTimer = 0;
            ctrl.guestClock = 0;
          }
        } else if (ctrl.guestTourState === 'GUEST_RUN_BACK') {
          ctrl.guestClock += dt;
          guestMem.facing = 1;
          guestMem.y = guestLaneY;
          guestMem.quadSize = guestRunQuad;

          const speed = Math.max(72, targets.runSpeed * 0.94);
          const stepX = speed * dt;
          const targetX = targets.badgeFloorWorldX + 16;
          const remaining = targetX - guestMem.x;

          if (remaining <= stepX + 1.5) {
            guestMem.x = targetX;
            ctrl.guestTourState = 'GUEST_RETURN';
            ctrl.guestTimer = 0;
            ctrl.guestJumpStartX = guestMem.x;
            ctrl.guestJumpStartY = guestLaneY;
            ctrl.guestJumpStartSize = guestRunQuad;
          } else {
            guestMem.x += stepX;
            const runIdx = Math.floor(ctrl.guestClock * guestCfg.runFps) % guestCfg.runFrames.length;
            guestMem.activeFrame = guestCfg.runFrames[runIdx];
            guestMem.tiltZ = -Math.sin(ctrl.guestClock * guestCfg.runFps * Math.PI * 0.5) * 0.018;
          }
        } else if (ctrl.guestTourState === 'GUEST_RETURN') {
          ctrl.guestTimer += dt;
          const duration = 0.50;
          const prog = Math.min(1, ctrl.guestTimer / duration);
          guestMem.facing = 1;

          const jp = evaluateArcJumpToTargetPhase(
            prog,
            ctrl.guestJumpStartX,
            guestSlot.worldX,
            ctrl.guestJumpStartY,
            guestSlot.worldY,
            ctrl.guestJumpStartSize,
            guestSlot.quadSize,
            guestCfg.sitFrames[0],
            guestCfg.jumpFrames
          );
          guestMem.x = jp.x;
          guestMem.y = jp.y;
          guestMem.quadSize = jp.quadSize;
          guestMem.activeFrame = jp.atlasIndex;
          guestMem.scaleX = jp.squashX;
          guestMem.scaleY = jp.squashY;

          if (prog >= 1) {
            ctrl.guestTourState = 'GUEST_SETTLE';
            ctrl.guestTimer = 0;
          }
        } else if (ctrl.guestTourState === 'GUEST_SETTLE') {
          ctrl.guestTimer += dt;
          guestMem.facing = 1;
          guestMem.x = guestSlot.worldX;
          guestMem.y = guestSlot.worldY;
          guestMem.quadSize = guestSlot.quadSize;
          guestMem.activeFrame = guestCfg.sitFrames[0];

          const cushionProg = Math.min(1, ctrl.guestTimer / 0.26);
          const cushion = Math.sin(cushionProg * Math.PI);
          guestMem.y = guestSlot.worldY - cushion * 0.5;
          guestMem.scaleX = 1 + cushion * 0.04;
          guestMem.scaleY = 1 - cushion * 0.045;

          if (cushionProg >= 1) {
            ctrl.guestTourState = 'BASECAMP_REST';
            ctrl.guestRunnerId = null;
          }
        }
      }

      // 4. UPDATE & RENDER ALL 3 MASCOT SPRITES
      for (const charId of MASCOT_TURN_ORDER) {
        const bundle = charBundles.get(charId);
        if (!bundle || !bundle.texture) continue;
        const mem = ctrl.members[charId];
        const cfg = MASCOT_CHARACTER_CONFIGS[charId];
        const slot = targets.basecampSlots[charId];
        const isMainRunner = ctrl.activeRunnerId === charId;
        const isGuestRunner = ctrl.guestRunnerId === charId;
        const isRunning = isMainRunner || isGuestRunner;

        // Waiting at basecamp: organic breathing + blinking
        if (!isRunning) {
          mem.z = slot.zIndex;
          if (mem.isInteracting) {
            mem.interactTimer += dt;
            const prog = mem.interactTimer / JUMP_DURATION_SEC;
            mem.x = slot.worldX;
            mem.y = slot.worldY;
            mem.quadSize = slot.quadSize;

            if (prog < 1.0) {
              const jp = evaluateJumpPhase(prog, 3.6, cfg.jumpFrames);
              mem.activeFrame = jp.atlasIndex;
              mem.y = slot.worldY + jp.jumpY;
              mem.scaleX = jp.squashX;
              mem.scaleY = jp.squashY;
            } else if (mem.interactTimer < POST_INTERACT_SIT_SEC) {
              mem.activeFrame = mem.interactReactionFrame;
              const happyBounce = Math.sin(nowSec * 3.4);
              mem.y = slot.worldY + happyBounce * 0.28;
              mem.scaleX = 1 - happyBounce * 0.006;
              mem.scaleY = 1 + happyBounce * 0.012;
            } else {
              mem.isInteracting = false;
              mem.scaleX = 1;
              mem.scaleY = 1;
              mem.y = slot.worldY;
            }
          } else {
            mem.x = slot.worldX;
            mem.y = slot.worldY;
            mem.quadSize = slot.quadSize;
            mem.facing = 1;
            mem.tiltZ = 0;

            const breath = evaluateBasecampBreathing(nowSec, mem.slotIndex);
            mem.y = slot.worldY + breath.offsetY;
            mem.scaleX = breath.scaleX;
            mem.scaleY = breath.scaleY;

            mem.blinkTimer -= dt;
            if (mem.blinkTimer <= 0) {
              mem.blinking = !mem.blinking;
              mem.blinkTimer = mem.blinking ? 0.6 + Math.random() * 0.35 : 2.5 + Math.random() * 2.0;
            }
            mem.activeFrame = mem.blinking ? mem.sitVariantFrame : mem.sitPrimaryFrame;
          }
        }

        if (mem.opacity < 1) {
          mem.opacity = Math.min(1, mem.opacity + dt * 4.5);
        }

        bundle.spriteMesh.visible = true;
        bundle.shadowMesh.visible = true;
        bundle.spriteMat.color.setScalar(mem.opacity);
        bundle.spriteMat.opacity = mem.opacity;

        applyAtlasFrame(bundle, mem.activeFrame);

        const zPos = isMainRunner ? 0.1 : (isGuestRunner ? 0.08 : mem.z);
        bundle.spriteMesh.position.set(mem.x, mem.y, zPos);
        bundle.spriteMesh.rotation.set(0, 0, mem.tiltZ);
        bundle.spriteMesh.scale.set(
          mem.facing * mem.quadSize * mem.scaleX,
          mem.quadSize * mem.scaleY,
          1
        );

        const surfaceFloorY = mem.y - mem.quadSize * (0.5 - footRatioFromBottom);
        const shFade = 0.78 * mem.opacity;
        bundle.shadowMesh.position.set(mem.x, surfaceFloorY + 0.45, zPos - 0.005);
        bundle.shadowMesh.scale.set(mem.quadSize * 0.42, 4.4, 1);
        bundle.shadowMat.color.setScalar(shFade);
        bundle.shadowMat.opacity = shFade;
      }

      syncDomStateAndHitboxes(targets);
      renderer.render(scene, camera);
    };

    const scheduleLoop = () => {
      cancelAnimationFrame(rafId);
      if (disposed || !isPageVisible || !isStageIntersecting) return;
      if (reducedMotion) {
        renderSingleStep(performance.now());
        return;
      }
      const tick = (t: number) => {
        if (disposed || !isPageVisible || !isStageIntersecting) return;
        renderSingleStep(t);
        rafId = requestAnimationFrame(tick);
      };
      lastTimestamp = 0;
      rafId = requestAnimationFrame(tick);
    };

    // Parallel preloading of all 3 character atlases: Oyen, Mujaer, and Kucing Putih
    Promise.all(
      MASCOT_TURN_ORDER.map(async (charId) => {
        const atlasCanvas = await getCharacterAtlasCanvas(charId);
        const cfg = MASCOT_CHARACTER_CONFIGS[charId];
        const tex = new CanvasTexture(atlasCanvas);
        tex.colorSpace = SRGBColorSpace;
        tex.premultiplyAlpha = true;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.repeat.set(1 / cfg.atlasCols, 1 / cfg.atlasRows);
        return { charId, tex };
      })
    )
      .then((results) => {
        if (disposed) return;
        for (const { charId, tex } of results) {
          const bundle = charBundles.get(charId);
          if (bundle) {
            bundle.texture = tex;
            bundle.spriteMat.map = tex;
            bundle.spriteMat.needsUpdate = true;
            controllerRef.current.members[charId].opacity = reducedMotion ? 1 : 0.1;
          }
        }
        refreshLayoutAndTargets();
        scheduleLoop();
      })
      .catch(() => {
        if (!disposed) {
          setWebglSupported(false);
        }
      });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            refreshLayoutAndTargets();
            if (reducedMotion) {
              renderSingleStep(performance.now());
            }
          })
        : null;
    resizeObserver?.observe(stageEl);
    if (stageEl.parentElement) {
      resizeObserver?.observe(stageEl.parentElement);
    }

    const mutationObserver =
      typeof MutationObserver !== 'undefined' && stageEl.parentElement
        ? new MutationObserver(() => {
            refreshLayoutAndTargets();
          })
        : null;
    if (mutationObserver && stageEl.parentElement) {
      mutationObserver.observe(stageEl.parentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const visible = Boolean(entries[0]?.isIntersecting);
              if (visible !== isStageIntersecting) {
                isStageIntersecting = visible;
                if (visible) scheduleLoop();
                else cancelAnimationFrame(rafId);
              }
            },
            { threshold: 0.01 }
          )
        : null;
    intersectionObserver?.observe(stageEl);

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) scheduleLoop();
      else cancelAnimationFrame(rafId);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const mql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const handleMotionPrefChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      lastHitboxSig = '';
      scheduleLoop();
    };
    mql?.addEventListener?.('change', handleMotionPrefChange);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
      setWebglSupported(false);
    };
    canvasEl.addEventListener('webglcontextlost', handleContextLost);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      mql?.removeEventListener?.('change', handleMotionPrefChange);
      canvasEl.removeEventListener('webglcontextlost', handleContextLost);

      // Clean up all pending basecamp single-click timers
      for (const charId of MASCOT_TURN_ORDER) {
        const t = basecampClicks[charId];
        if (t) clearTimeout(t);
        basecampClicks[charId] = null;
      }

      spriteGeo.dispose();
      shadowGeo.dispose();
      shadowTex.dispose();

      for (const bundle of charBundles.values()) {
        bundle.spriteMat.dispose();
        bundle.shadowMat.dispose();
        bundle.texture?.dispose();
      }
      charBundles.clear();
      renderer.dispose();
    };
  }, [webglSupported]);

  // Single-Click Action: Character jumps in-place for ~1.4s, then returns to sitting
  const triggerBasecampSingleReaction = (charId: MascotCharacterId) => {
    const ctrl = controllerRef.current;
    const mem = ctrl.members[charId];
    if (mem.isInteracting || ctrl.activeRunnerId === charId || ctrl.guestRunnerId === charId) return;

    mem.isInteracting = true;
    mem.interactTimer = 0;
    mem.interactBaseX = mem.x;
    mem.interactBaseY = mem.y;
    mem.interactBaseSize = mem.quadSize;
  };

  // Double-Click Action: Character joins the run from basecamp (Max 2 running simultaneously)
  const triggerJoinRun = (charId: MascotCharacterId) => {
    const ctrl = controllerRef.current;
    const targets = ctrl.targets;
    if (!targets) return;

    const runningCount = (ctrl.activeRunnerId ? 1 : 0) + (ctrl.guestRunnerId ? 1 : 0);
    if (runningCount >= 2) {
      // Rule: Max 2 running concurrently. Third character remains at basecamp and gives an acknowledgment hop.
      triggerBasecampSingleReaction(charId);
      return;
    }

    const slot = targets.basecampSlots[charId];
    if (ctrl.activeRunnerId === null) {
      // Main runner slot was empty -> this character departs as main runner
      ctrl.activeRunnerId = charId;
      ctrl.tourState = 'DEPART_BASECAMP';
      ctrl.tourTimer = 0;
      ctrl.tourClock = 0;
      ctrl.tourSpeedJitter = 1.0;
      ctrl.jumpStartX = slot.worldX;
      ctrl.jumpStartY = slot.worldY;
      ctrl.jumpStartSize = slot.quadSize;
    } else if (ctrl.guestRunnerId === null && ctrl.activeRunnerId !== charId) {
      // Main runner is already running -> this character joins as guest runner!
      ctrl.guestRunnerId = charId;
      ctrl.guestTourState = 'GUEST_DEPART';
      ctrl.guestTimer = 0;
      ctrl.guestClock = 0;
      ctrl.guestJumpStartX = slot.worldX;
      ctrl.guestJumpStartY = slot.worldY;
      ctrl.guestJumpStartSize = slot.quadSize;
    }
  };

  // Basecamp button click / tap handler: distinguishes single-click from double-click (~280ms window)
  const handleBasecampClick = (e: React.MouseEvent<HTMLButtonElement>, charId: MascotCharacterId) => {
    e.stopPropagation();
    const ctrl = controllerRef.current;
    const mem = ctrl.members[charId];
    if (mem.isInteracting || ctrl.activeRunnerId === charId || ctrl.guestRunnerId === charId) return;

    const existingTimer = pendingBasecampClicks.current[charId];
    if (existingTimer) {
      // Double-click detected! Cancel single-click jump and execute join-run
      clearTimeout(existingTimer);
      pendingBasecampClicks.current[charId] = null;
      triggerJoinRun(charId);
    } else {
      // First click: wait 280ms before firing single-click reaction
      pendingBasecampClicks.current[charId] = setTimeout(() => {
        pendingBasecampClicks.current[charId] = null;
        triggerBasecampSingleReaction(charId);
      }, 280);
    }
  };

  // Runner click / tap handler: pauses horizontal run, jumps in-place, then resumes from exact last position
  const pauseAndReactRunner = (charId: MascotCharacterId) => {
    const ctrl = controllerRef.current;
    const mem = ctrl.members[charId];
    if (mem.isInteracting) return;

    mem.isInteracting = true;
    mem.interactTimer = 0;
    mem.interactBaseX = mem.x; // Exact last position preserved
    mem.interactBaseY = mem.y;
    mem.interactBaseSize = mem.quadSize;
  };

  const handleMainRunnerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ctrl = controllerRef.current;
    if (ctrl.activeRunnerId) {
      pauseAndReactRunner(ctrl.activeRunnerId);
    }
  };

  const handleGuestRunnerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ctrl = controllerRef.current;
    if (ctrl.guestRunnerId) {
      pauseAndReactRunner(ctrl.guestRunnerId);
    }
  };

  return (
    <div
      ref={stageRef}
      id="oyen-header-mascot"
      className="header-mascot-stage"
      aria-hidden="true"
    >
      {webglSupported ? (
        <>
          <canvas ref={canvasRef} className="header-mascot-canvas" />
          {/* Basecamp hitboxes for the 3 mascots perched on badge */}
          {MASCOT_TURN_ORDER.map((charId, idx) => (
            <button
              key={charId}
              ref={(el) => {
                basecampHitboxRefs.current[idx] = el;
              }}
              type="button"
              id={`oyen-basecamp-hitbox-${idx}`}
              className="oyen-basecamp-hitbox"
              onClick={(e) => handleBasecampClick(e, charId)}
              tabIndex={-1}
              aria-label={`Sentuh ${MASCOT_CHARACTER_CONFIGS[charId].displayName} di Basecamp`}
            />
          ))}
          {/* Active main runner hitbox while moving in corridor or playing on wordmark */}
          <button
            ref={runnerHitboxRef}
            type="button"
            id="oyen-runner-hitbox"
            className="oyen-runner-hitbox"
            onClick={handleMainRunnerClick}
            tabIndex={-1}
            aria-label="Sentuh Maskot Berlari"
          />
          {/* Active guest runner hitbox when a second mascot joins the run */}
          <button
            ref={guestRunnerHitboxRef}
            type="button"
            id="oyen-guest-runner-hitbox"
            className="oyen-guest-runner-hitbox"
            onClick={handleGuestRunnerClick}
            tabIndex={-1}
            aria-label="Sentuh Maskot Pendamping Berlari"
          />
        </>
      ) : (
        <img
          src={orenMasterUrl}
          alt=""
          className="header-mascot-fallback"
          draggable={false}
        />
      )}
    </div>
  );
};
