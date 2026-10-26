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
import {
  ATLAS_CELL_SIZE,
  ATLAS_FLOOR_Y,
  ATLAS_GRID,
  ATLAS_SIZE,
  BADGE_SIT_DURATION_SEC,
  IDLE_FRAME_INDICES,
  JUMP_DURATION_SEC,
  OYEN_ATLAS_FRAMES,
  PAUSE_1S_DURATION_SEC,
  PLAY_DURATION_SEC,
  POST_INTERACT_SIT_SEC,
  RUN_FPS,
  RUN_FRAME_INDICES,
  computeHeaderMascotTargets,
  evaluateArcJumpToTargetPhase,
  evaluateJumpPhase,
  evaluateWordmarkPlayPhase,
  getAtlasUvOffset,
  getNormalizedCellPlacement,
  getResponsiveQuadSize,
  type ElementRectLike,
  type HeaderMascotTargets,
  type MascotAnimState,
} from '../config/oyenMascotConfig';

// Singleton session cache so sprite sheets are downloaded and composited only once across route transitions
let sharedAtlasCanvasPromise: Promise<HTMLCanvasElement> | null = null;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function getSharedAtlasCanvas(): Promise<HTMLCanvasElement> {
  if (!sharedAtlasCanvasPromise) {
    sharedAtlasCanvasPromise = Promise.all([
      loadImageElement(lariSheetUrl),
      loadImageElement(lompatSheetUrl),
    ])
      .then(([lariImg, lompatImg]) => {
        const canvas = document.createElement('canvas');
        canvas.width = ATLAS_SIZE;
        canvas.height = ATLAS_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D context unavailable for sprite atlas');

        ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (const frame of OYEN_ATLAS_FRAMES) {
          const srcImg = frame.sheet === 'lari' ? lariImg : lompatImg;
          const { dx, dy, dw, dh } = getNormalizedCellPlacement(frame);
          ctx.drawImage(srcImg, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
        }
        return canvas;
      })
      .catch((err) => {
        sharedAtlasCanvasPromise = null;
        throw err;
      });
  }
  return sharedAtlasCanvasPromise;
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

export const OyenHeaderMascot: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitboxRef = useRef<HTMLButtonElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(() => detectWebGLSupport());

  const runtimeRef = useRef({
    initializedPosition: false,
    state: 'RUN_IN' as MascotAnimState,
    x: 0,
    y: 0,
    activeQuadSize: 50,
    jumpStartX: 0,
    jumpStartY: 0,
    jumpStartSize: 50,
    facing: 1 as 1 | -1,
    fade: 0,
    stageWidth: 360,
    stageHeight: 62,
    runQuadSize: 50,
    stateTimer: 0,
    sitDuration: BADGE_SIT_DURATION_SEC,
    blinkTimer: 1.5,
    blinking: false,
    runClock: 0,
    targets: null as HeaderMascotTargets | null,
  });

  useEffect(() => {
    if (!webglSupported) return;
    const stageEl = stageRef.current;
    const canvasEl = canvasRef.current;
    if (!stageEl || !canvasEl) return;

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

    // Ground/perch contact shadow plane (Porter-Duff premultiplied alpha blending)
    const shadowTex = new CanvasTexture(createSoftShadowCanvas());
    shadowTex.premultiplyAlpha = true;
    const shadowGeo = new PlaneGeometry(1, 1);
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
    shadowMesh.position.z = -0.5;
    scene.add(shadowMesh);

    // Main Oyen character sprite plane (UV-mapped 1x1 unit quad)
    const spriteGeo = new PlaneGeometry(1, 1);
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
    scene.add(spriteMesh);

    let atlasTex: CanvasTexture | null = null;
    let currentAtlasIdx = -1;
    let disposed = false;
    let rafId = 0;
    let isPageVisible = typeof document !== 'undefined' ? !document.hidden : true;
    let isStageIntersecting = true;
    let reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyAtlasFrame = (idx: number) => {
      if (!atlasTex || idx === currentAtlasIdx) return;
      currentAtlasIdx = idx;
      const { u, v, repeat } = getAtlasUvOffset(idx);
      atlasTex.repeat.set(repeat, repeat);
      atlasTex.offset.set(u, v);
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

    const syncDomStateAndHitbox = (targets: HeaderMascotTargets) => {
      const st = runtimeRef.current.state;
      stageEl.dataset.oyenState = st;
      const btn = hitboxRef.current;
      if (!btn) return;
      btn.style.left = `${targets.hitboxLeftPx}px`;
      btn.style.top = `${targets.hitboxTopPx}px`;
      btn.style.width = `${targets.hitboxWidthPx}px`;
      btn.style.height = `${targets.hitboxHeightPx}px`;
      btn.style.pointerEvents = st === 'SIT_ON_BADGE' && !reducedMotion ? 'auto' : 'none';
      btn.dataset.oyenState = st;
    };

    const refreshLayoutAndTarget = () => {
      const rect = stageEl.getBoundingClientRect();
      const hasMeasuredLayout = rect.width > 0;
      const w = Math.max(200, Math.round(rect.width || 360));
      const h = Math.max(48, Math.round(rect.height || 62));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const rt = runtimeRef.current;
      rt.stageWidth = w;
      rt.stageHeight = h;
      rt.runQuadSize = getResponsiveQuadSize(w);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.aspect = w / h;
      camera.position.set(0, 0, h / (2 * halfFovTan));
      camera.updateProjectionMatrix();

      const targets = measureFreshTargets(w, h, rt.runQuadSize);
      rt.targets = targets;

      if (!rt.initializedPosition) {
        rt.x = targets.entryLeftWorldX;
        rt.y = targets.floorBaseQuadY;
        rt.activeQuadSize = rt.runQuadSize;
        if (hasMeasuredLayout) {
          rt.initializedPosition = true;
        }
      } else if (rt.state === 'PLAY_ON_WORDMARK' || rt.state === 'PAUSE_ON_WORDMARK') {
        rt.x = targets.wordmarkPlayWorldX;
        rt.y = targets.wordmarkPlayQuadY;
        rt.activeQuadSize = targets.wordmarkQuadSize;
      } else if (rt.state === 'SIT_ON_BADGE' || rt.state === 'INTERACT_JUMP') {
        rt.x = targets.badgeWorldX;
        rt.y = targets.badgePerchQuadY;
        rt.activeQuadSize = targets.badgeQuadSize;
      }

      syncDomStateAndHitbox(targets);
    };

    refreshLayoutAndTarget();

    let lastTimestamp = 0;

    const renderSingleStep = (nowMs: number) => {
      if (disposed || !atlasTex) return;

      const nowSec = nowMs * 0.001;
      const dt = lastTimestamp > 0 ? Math.min((nowMs - lastTimestamp) * 0.001, 0.1) : 0.016;
      lastTimestamp = nowMs;

      const rt = runtimeRef.current;
      const targets =
        rt.targets ?? measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
      rt.targets = targets;

      const footRatioFromBottom = (ATLAS_CELL_SIZE - ATLAS_FLOOR_Y) / ATLAS_CELL_SIZE;

      if (reducedMotion) {
        rt.state = 'SIT_ON_BADGE';
        rt.facing = 1;
        rt.fade = 1;
        rt.x = targets.badgeWorldX;
        rt.y = targets.badgePerchQuadY;
        rt.activeQuadSize = targets.badgeQuadSize;
        applyAtlasFrame(IDLE_FRAME_INDICES[0]);
        spriteMat.color.setScalar(1);
        spriteMat.opacity = 1;
        spriteMesh.position.set(rt.x, rt.y, 0);
        spriteMesh.rotation.set(0, 0, 0);
        spriteMesh.scale.set(rt.activeQuadSize, rt.activeQuadSize, 1);
        const perchFloorY = rt.y - rt.activeQuadSize * (0.5 - footRatioFromBottom);
        shadowMesh.position.set(rt.x, perchFloorY + 0.5, -0.5);
        shadowMesh.scale.set(rt.activeQuadSize * 0.44, 5.0, 1);
        shadowMat.color.setScalar(0.75);
        shadowMat.opacity = 0.75;
        syncDomStateAndHitbox(targets);
        renderer.render(scene, camera);
        return;
      }

      let activeFrame: number = IDLE_FRAME_INDICES[0];
      let offsetX = 0;
      let offsetY = 0;
      let scaleX = 1;
      let scaleY = 1;
      let tiltZ = 0;

      if (rt.state === 'RUN_IN') {
        rt.runClock += dt;
        rt.y = targets.floorBaseQuadY;
        rt.activeQuadSize = rt.runQuadSize;
        rt.facing = 1;

        const remaining = targets.wordmarkTakeoffWorldX - rt.x;
        const speed = Math.max(72, targets.runSpeed * 0.85);
        const stepX = speed * dt;

        if (remaining <= stepX + 1.2) {
          const fresh = measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
          rt.targets = fresh;
          rt.x = fresh.wordmarkTakeoffWorldX;
          rt.jumpStartX = rt.x;
          rt.jumpStartY = fresh.floorBaseQuadY;
          rt.jumpStartSize = rt.runQuadSize;
          rt.stateTimer = 0;
          rt.state = 'JUMP_TO_WORDMARK';
          activeFrame = OYEN_ATLAS_FRAMES[12].atlasIndex;
          syncDomStateAndHitbox(fresh);
        } else {
          rt.x += stepX;
          const runSeqIdx = Math.floor(rt.runClock * RUN_FPS) % RUN_FRAME_INDICES.length;
          activeFrame = RUN_FRAME_INDICES[runSeqIdx];
          tiltZ = -Math.sin(rt.runClock * RUN_FPS * Math.PI * 0.5) * 0.018;
        }
      } else if (rt.state === 'JUMP_TO_WORDMARK') {
        rt.stateTimer += dt;
        const progress = rt.stateTimer / JUMP_DURATION_SEC;
        rt.facing = 1;

        if (progress >= 1) {
          rt.x = targets.wordmarkPlayWorldX;
          rt.y = targets.wordmarkPlayQuadY;
          rt.activeQuadSize = targets.wordmarkQuadSize;
          rt.stateTimer = 0;
          rt.state = 'PLAY_ON_WORDMARK';
          activeFrame = OYEN_ATLAS_FRAMES[12].atlasIndex;
          syncDomStateAndHitbox(targets);
        } else {
          const jp = evaluateArcJumpToTargetPhase(
            progress,
            rt.jumpStartX,
            targets.wordmarkPlayWorldX,
            rt.jumpStartY,
            targets.wordmarkPlayQuadY,
            rt.jumpStartSize,
            targets.wordmarkQuadSize,
            IDLE_FRAME_INDICES[2]
          );
          rt.x = jp.x;
          rt.y = jp.y;
          rt.activeQuadSize = jp.quadSize;
          activeFrame = jp.atlasIndex;
          scaleX = jp.squashX;
          scaleY = jp.squashY;
        }
      } else if (rt.state === 'PLAY_ON_WORDMARK') {
        rt.stateTimer += dt;
        const progress = rt.stateTimer / PLAY_DURATION_SEC;
        rt.x = targets.wordmarkPlayWorldX;
        rt.y = targets.wordmarkPlayQuadY;
        rt.activeQuadSize = targets.wordmarkQuadSize;
        rt.facing = 1;

        if (progress >= 1) {
          rt.x = targets.wordmarkPlayWorldX;
          rt.y = targets.wordmarkPlayQuadY;
          rt.activeQuadSize = targets.wordmarkQuadSize;
          rt.stateTimer = 0;
          rt.state = 'PAUSE_ON_WORDMARK';
          activeFrame = IDLE_FRAME_INDICES[0];
          syncDomStateAndHitbox(targets);
        } else {
          const playStep = evaluateWordmarkPlayPhase(progress);
          activeFrame = playStep.atlasIndex;
          offsetX = playStep.offsetX;
          offsetY = playStep.offsetY;
          scaleX = playStep.scaleX;
          scaleY = playStep.scaleY;
          tiltZ = playStep.tiltZ;
        }
      } else if (rt.state === 'PAUSE_ON_WORDMARK') {
        rt.stateTimer += dt;
        rt.x = targets.wordmarkPlayWorldX;
        rt.y = targets.wordmarkPlayQuadY;
        rt.activeQuadSize = targets.wordmarkQuadSize;
        rt.facing = 1;

        const isWinking = rt.stateTimer >= 0.45 && rt.stateTimer <= 0.78;
        activeFrame = isWinking ? IDLE_FRAME_INDICES[1] : IDLE_FRAME_INDICES[0];

        const breath = Math.sin(nowSec * 2.4);
        offsetY = breath * 0.28;
        scaleY = 1 + breath * 0.012;
        scaleX = 1 - breath * 0.006;

        if (rt.stateTimer >= PAUSE_1S_DURATION_SEC) {
          // After 1s pause on Cuking wordmark -> run across header toward the cat counter badge!
          const fresh = measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
          rt.targets = fresh;
          rt.stateTimer = 0;
          rt.jumpStartY = rt.y;
          rt.jumpStartSize = rt.activeQuadSize;
          rt.runClock = 0;
          rt.facing = 1;
          rt.state = 'RUN_TO_BADGE';
          syncDomStateAndHitbox(fresh);
        }
      } else if (rt.state === 'RUN_TO_BADGE') {
        rt.runClock += dt;
        rt.facing = 1;

        // Smooth hop down from Cuking wordmark onto the header floor during the first 0.26s
        const hopDownT = Math.min(1, rt.runClock / 0.26);
        const hopArc = 4 * hopDownT * (1 - hopDownT) * 3.0;
        rt.y = rt.jumpStartY + (targets.floorBaseQuadY - rt.jumpStartY) * hopDownT + hopArc;
        rt.activeQuadSize =
          rt.jumpStartSize + (rt.runQuadSize - rt.jumpStartSize) * hopDownT;

        const remaining = targets.badgeTakeoffWorldX - rt.x;
        const accel = Math.min(1, 0.55 + rt.runClock * 1.9);
        const speed = targets.runSpeed * accel;
        const stepX = speed * dt;

        if (remaining <= stepX + 1.5 && hopDownT >= 1) {
          // Reached takeoff point near the cat counter badge -> jump onto the badge!
          const fresh = measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
          rt.targets = fresh;
          rt.x = fresh.badgeTakeoffWorldX;
          rt.jumpStartX = rt.x;
          rt.jumpStartY = fresh.floorBaseQuadY;
          rt.jumpStartSize = rt.runQuadSize;
          rt.stateTimer = 0;
          rt.state = 'JUMP_TO_BADGE';
          activeFrame = OYEN_ATLAS_FRAMES[12].atlasIndex;
          syncDomStateAndHitbox(fresh);
        } else {
          rt.x += stepX;
          const runSeqIdx = Math.floor(rt.runClock * RUN_FPS) % RUN_FRAME_INDICES.length;
          activeFrame = RUN_FRAME_INDICES[runSeqIdx];
          tiltZ = -Math.sin(rt.runClock * RUN_FPS * Math.PI * 0.5) * 0.018;
        }
      } else if (rt.state === 'JUMP_TO_BADGE') {
        rt.stateTimer += dt;
        const progress = rt.stateTimer / JUMP_DURATION_SEC;
        rt.facing = 1;

        if (progress >= 1) {
          // Landed on top of the cat counter badge -> sit for ~3 seconds!
          rt.x = targets.badgeWorldX;
          rt.y = targets.badgePerchQuadY;
          rt.activeQuadSize = targets.badgeQuadSize;
          rt.stateTimer = 0;
          rt.sitDuration = BADGE_SIT_DURATION_SEC + Math.random() * 0.25;
          rt.blinking = false;
          rt.blinkTimer = 1.3 + Math.random() * 0.8;
          rt.state = 'SIT_ON_BADGE';
          activeFrame = IDLE_FRAME_INDICES[0];
          syncDomStateAndHitbox(targets);
        } else {
          const jp = evaluateArcJumpToTargetPhase(
            progress,
            rt.jumpStartX,
            targets.badgeWorldX,
            rt.jumpStartY,
            targets.badgePerchQuadY,
            rt.jumpStartSize,
            targets.badgeQuadSize,
            IDLE_FRAME_INDICES[0]
          );
          rt.x = jp.x;
          rt.y = jp.y;
          rt.activeQuadSize = jp.quadSize;
          activeFrame = jp.atlasIndex;
          scaleX = jp.squashX;
          scaleY = jp.squashY;
        }
      } else if (rt.state === 'SIT_ON_BADGE') {
        rt.x = targets.badgeWorldX;
        rt.y = targets.badgePerchQuadY;
        rt.activeQuadSize = targets.badgeQuadSize;
        rt.facing = 1;
        rt.stateTimer += dt;
        rt.blinkTimer -= dt;

        if (rt.blinkTimer <= 0) {
          rt.blinking = !rt.blinking;
          rt.blinkTimer = rt.blinking
            ? 0.52 + Math.random() * 0.2
            : 1.5 + Math.random() * 0.9;
        }

        activeFrame = rt.blinking ? IDLE_FRAME_INDICES[1] : IDLE_FRAME_INDICES[0];

        const breath = Math.sin(nowSec * 2.35);
        offsetY = breath * 0.32;
        scaleY = 1 + breath * 0.014;
        scaleX = 1 - breath * 0.008;
        tiltZ = Math.sin(nowSec * 1.4) * 0.015;

        if (rt.stateTimer >= rt.sitDuration) {
          // ~3s sit on cat counter badge finished -> hop down and run back to Cuking wordmark!
          const fresh = measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
          rt.targets = fresh;
          rt.stateTimer = 0;
          rt.jumpStartY = rt.y;
          rt.jumpStartSize = rt.activeQuadSize;
          rt.runClock = 0;
          rt.facing = -1;
          rt.state = 'RUN_TO_WORDMARK';
          syncDomStateAndHitbox(fresh);
        }
      } else if (rt.state === 'INTERACT_JUMP') {
        rt.stateTimer += dt;
        const progress = rt.stateTimer / JUMP_DURATION_SEC;
        rt.x = targets.badgeWorldX;
        rt.y = targets.badgePerchQuadY;
        rt.activeQuadSize = targets.badgeQuadSize;
        rt.facing = 1;

        if (progress >= 1) {
          // Land back on the cat counter badge after user click/tap -> sit before running back!
          rt.stateTimer = 0;
          rt.sitDuration = POST_INTERACT_SIT_SEC;
          rt.blinking = true;
          rt.blinkTimer = 0.6;
          rt.state = 'SIT_ON_BADGE';
          activeFrame = IDLE_FRAME_INDICES[1];
          syncDomStateAndHitbox(targets);
        } else {
          const jp = evaluateJumpPhase(progress, 4.2);
          activeFrame = jp.atlasIndex;
          offsetY = jp.jumpY;
          scaleX = jp.squashX;
          scaleY = jp.squashY;
        }
      } else if (rt.state === 'RUN_TO_WORDMARK') {
        rt.runClock += dt;
        rt.facing = -1;

        // Smooth hop down from cat counter badge onto the header floor during the first 0.26s
        const hopDownT = Math.min(1, rt.runClock / 0.26);
        const hopArc = 4 * hopDownT * (1 - hopDownT) * 3.0;
        rt.y = rt.jumpStartY + (targets.floorBaseQuadY - rt.jumpStartY) * hopDownT + hopArc;
        rt.activeQuadSize =
          rt.jumpStartSize + (rt.runQuadSize - rt.jumpStartSize) * hopDownT;

        const remaining = targets.wordmarkTakeoffWorldX - rt.x;
        const absRem = Math.abs(remaining);
        const easeOut = Math.min(1, 0.5 + absRem / 28);
        const speed = targets.runSpeed * easeOut;
        const stepX = -speed * dt;

        if (absRem <= Math.abs(stepX) + 1.5 && hopDownT >= 1) {
          // Reached wordmark takeoff point -> turn right and jump back onto Cuking wordmark!
          const fresh = measureFreshTargets(rt.stageWidth, rt.stageHeight, rt.runQuadSize);
          rt.targets = fresh;
          rt.x = fresh.wordmarkTakeoffWorldX;
          rt.jumpStartX = rt.x;
          rt.jumpStartY = fresh.floorBaseQuadY;
          rt.jumpStartSize = rt.runQuadSize;
          rt.facing = 1;
          rt.stateTimer = 0;
          rt.state = 'JUMP_TO_WORDMARK';
          activeFrame = OYEN_ATLAS_FRAMES[12].atlasIndex;
          syncDomStateAndHitbox(fresh);
        } else {
          rt.x += stepX;
          const runSeqIdx = Math.floor(rt.runClock * RUN_FPS) % RUN_FRAME_INDICES.length;
          activeFrame = RUN_FRAME_INDICES[runSeqIdx];
          tiltZ = Math.sin(rt.runClock * RUN_FPS * Math.PI * 0.5) * 0.018;
        }
      }

      applyAtlasFrame(activeFrame);

      spriteMesh.position.set(rt.x + offsetX, rt.y + offsetY, 0);
      spriteMesh.rotation.set(0, 0, tiltZ);
      spriteMesh.scale.set(
        rt.facing * rt.activeQuadSize * scaleX,
        rt.activeQuadSize * scaleY,
        1
      );

      // Smooth initial fade-in (maintaining premultiplied RGB:A invariant)
      if (rt.fade < 1) {
        rt.fade = Math.min(1, rt.fade + dt * 5);
      }
      spriteMat.color.setScalar(rt.fade);
      spriteMat.opacity = rt.fade;

      // Ground/perch contact shadow follows Oyen onto both the Cuking wordmark and the cat counter badge
      const surfaceFloorY = rt.y - rt.activeQuadSize * (0.5 - footRatioFromBottom);
      const airRatio = Math.min(1, Math.max(0, offsetY / 8));
      const shFade = 0.8 * (1 - airRatio * 0.45) * rt.fade;
      shadowMesh.position.set(rt.x + offsetX, surfaceFloorY + 0.5, -0.5);
      shadowMesh.scale.set(
        rt.activeQuadSize * (0.45 - airRatio * 0.14),
        5.2 * (1 - airRatio * 0.25),
        1
      );
      shadowMat.color.setScalar(shFade);
      shadowMat.opacity = shFade;

      renderer.render(scene, camera);
    };

    const scheduleLoop = () => {
      cancelAnimationFrame(rafId);
      if (disposed || !atlasTex || !isPageVisible || !isStageIntersecting) return;
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

    getSharedAtlasCanvas()
      .then((atlasCanvas) => {
        if (disposed) return;
        atlasTex = new CanvasTexture(atlasCanvas);
        atlasTex.colorSpace = SRGBColorSpace;
        atlasTex.premultiplyAlpha = true;
        atlasTex.generateMipmaps = true;
        atlasTex.minFilter = LinearMipmapLinearFilter;
        atlasTex.magFilter = LinearFilter;
        atlasTex.repeat.set(1 / ATLAS_GRID, 1 / ATLAS_GRID);

        spriteMat.map = atlasTex;
        runtimeRef.current.fade = reducedMotion ? 1 : 0.05;
        spriteMat.color.setScalar(runtimeRef.current.fade);
        spriteMat.opacity = runtimeRef.current.fade;
        spriteMat.needsUpdate = true;

        applyAtlasFrame(RUN_FRAME_INDICES[0]);
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
            refreshLayoutAndTarget();
            if (reducedMotion && atlasTex) {
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
            refreshLayoutAndTarget();
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

      spriteGeo.dispose();
      shadowGeo.dispose();
      spriteMat.dispose();
      shadowMat.dispose();
      atlasTex?.dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, [webglSupported]);

  const handlePerchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rt = runtimeRef.current;
    if (rt.state !== 'SIT_ON_BADGE') return;

    rt.state = 'INTERACT_JUMP';
    rt.stateTimer = 0;
    if (hitboxRef.current) {
      hitboxRef.current.style.pointerEvents = 'none';
      hitboxRef.current.dataset.oyenState = 'INTERACT_JUMP';
    }
    if (stageRef.current) {
      stageRef.current.dataset.oyenState = 'INTERACT_JUMP';
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
          <button
            ref={hitboxRef}
            type="button"
            id="oyen-perch-hitbox"
            className="oyen-perch-hitbox"
            onClick={handlePerchClick}
            tabIndex={-1}
            aria-label="Sentuh Oyen"
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
