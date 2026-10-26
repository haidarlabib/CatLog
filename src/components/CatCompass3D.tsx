import React, { useEffect, useRef } from 'react';

interface CatCompass3DProps {
  size?: number;
  title?: string;
}

/**
 * Zero-dependency 3D extruded metallic talisman coin with real 3D normal shading,
 * raised parallax cat-paw relief, pointer tilt physics, and click-to-spin impulse.
 * ponytail: native Canvas 2D + 3D matrix math avoids ~600KB Three.js bundle; upgrade to WebGL/Three only if loading external glTF meshes.
 */
export const CatCompass3D: React.FC<CatCompass3DProps> = ({
  size = 64,
  title = 'Ketuk untuk memutar koin kompas Cuking',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    rotX: 0.16,
    rotY: -0.28,
    targetX: 0.16,
    targetY: -0.28,
    velY: 0,
    hovering: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const R = size * 0.39;
    const THICKNESS = size * 0.075;
    const SEGMENTS = 36;
    const FOV = size * 3.4;

    const project = (x: number, y: number, z: number, rx: number, ry: number) => {
      // Rotate around Y then X
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const scale = FOV / (FOV - z2);
      return {
        px: size / 2 + x1 * scale,
        py: size / 2 + y2 * scale,
        z: z2,
        scale,
      };
    };

    const drawEllipticalDisc = (
      zOffset: number,
      radius: number,
      rx: number,
      ry: number,
      fill: string | CanvasGradient,
      stroke?: string,
      lineWidth = 1
    ) => {
      ctx.beginPath();
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const p = project(Math.cos(a) * radius, Math.sin(a) * radius, zOffset, rx, ry);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    const drawBlob3D = (
      cx: number,
      cy: number,
      rxBlob: number,
      ryBlob: number,
      rotBlob: number,
      zOffset: number,
      rx: number,
      ry: number,
      fill: string
    ) => {
      const steps = 16;
      const cb = Math.cos(rotBlob);
      const sb = Math.sin(rotBlob);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const lx = Math.cos(a) * rxBlob;
        const ly = Math.sin(a) * ryBlob;
        const wx = cx + lx * cb - ly * sb;
        const wy = cy + lx * sb + ly * cb;
        const p = project(wx, wy, zOffset, rx, ry);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    const renderFrame = (time: number) => {
      const s = stateRef.current;
      if (!reducedMotion) {
        const idleY = s.hovering ? 0 : Math.sin(time * 0.0015) * 0.26;
        const idleX = s.hovering ? 0 : Math.cos(time * 0.0011) * 0.12;
        s.rotX += (s.targetX + idleX - s.rotX) * 0.1;
        s.rotY += (s.targetY + idleY - s.rotY) * 0.1 + s.velY;
        s.velY *= 0.92;
        if (Math.abs(s.velY) < 0.0005) s.velY = 0;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      // Soft ambient ground shadow beneath floating coin
      const shadowY = size * 0.87;
      const shadowGrad = ctx.createRadialGradient(
        size / 2,
        shadowY,
        1,
        size / 2,
        shadowY,
        size * 0.28
      );
      shadowGrad.addColorStop(0, 'rgba(28, 25, 23, 0.16)');
      shadowGrad.addColorStop(1, 'rgba(28, 25, 23, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(size / 2, shadowY, size * 0.25, size * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();

      const rx = s.rotX;
      const ry = s.rotY;

      // Face normal Z after rotation determines which side faces viewer
      const frontNormalZ = Math.cos(ry) * Math.cos(rx);
      const frontVisible = frontNormalZ >= 0;

      // 1. Draw back-most face rim first (painter's order)
      const backZ = frontVisible ? -THICKNESS : THICKNESS;
      drawEllipticalDisc(backZ, R, rx, ry, '#9B7B45');

      // 2. Draw 3D extruded milled cylinder edge quads sorted by depth
      const quads: Array<{
        pts: Array<{ px: number; py: number }>;
        zAvg: number;
        shade: number;
      }> = [];

      for (let i = 0; i < SEGMENTS; i++) {
        const a0 = (i / SEGMENTS) * Math.PI * 2;
        const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
        const am = (a0 + a1) * 0.5;

        const p0f = project(Math.cos(a0) * R, Math.sin(a0) * R, THICKNESS, rx, ry);
        const p1f = project(Math.cos(a1) * R, Math.sin(a1) * R, THICKNESS, rx, ry);
        const p1b = project(Math.cos(a1) * R, Math.sin(a1) * R, -THICKNESS, rx, ry);
        const p0b = project(Math.cos(a0) * R, Math.sin(a0) * R, -THICKNESS, rx, ry);

        // Rotate radial normal to world space for Blinn-Phong shading
        const nx = Math.cos(am);
        const ny = Math.sin(am);
        const wx = nx * Math.cos(ry);
        const wz = -nx * Math.sin(ry);
        const wy = ny * Math.cos(rx) - wz * Math.sin(rx);
        const wzFinal = ny * Math.sin(rx) + wz * Math.cos(rx);

        // Only draw front-facing cylinder facets
        if (wzFinal > -0.15) {
          const lightDot = wx * -0.45 + wy * -0.55 + wzFinal * 0.7;
          const flute = i % 2 === 0 ? 0.06 : -0.04;
          quads.push({
            pts: [p0f, p1f, p1b, p0b],
            zAvg: (p0f.z + p1f.z + p1b.z + p0b.z) * 0.25,
            shade: Math.max(0, Math.min(1, 0.5 + lightDot * 0.48 + flute)),
          });
        }
      }

      quads.sort((a, b) => a.zAvg - b.zAvg);
      for (const q of quads) {
        const rCol = Math.round(135 + q.shade * 108);
        const gCol = Math.round(104 + q.shade * 96);
        const bCol = Math.round(54 + q.shade * 72);
        ctx.beginPath();
        ctx.moveTo(q.pts[0].px, q.pts[0].py);
        ctx.lineTo(q.pts[1].px, q.pts[1].py);
        ctx.lineTo(q.pts[2].px, q.pts[2].py);
        ctx.lineTo(q.pts[3].px, q.pts[3].py);
        ctx.closePath();
        ctx.fillStyle = `rgb(${rCol},${gCol},${bCol})`;
        ctx.strokeStyle = `rgb(${rCol},${gCol},${bCol})`;
        ctx.lineWidth = 0.6;
        ctx.fill();
        ctx.stroke();
      }

      // 3. Draw visible main face with dynamic specular gradient
      const faceZ = frontVisible ? THICKNESS : -THICKNESS;
      const specShiftX = Math.sin(ry) * R * 0.7;
      const specShiftY = -Math.sin(rx) * R * 0.7;

      const rimGrad = ctx.createLinearGradient(
        size * 0.2 + specShiftX,
        size * 0.18 + specShiftY,
        size * 0.8 - specShiftX,
        size * 0.82 - specShiftY
      );
      rimGrad.addColorStop(0, '#F3E3BE');
      rimGrad.addColorStop(0.45, '#D2B173');
      rimGrad.addColorStop(1, '#98773E');
      drawEllipticalDisc(faceZ, R, rx, ry, rimGrad, 'rgba(255,255,255,0.55)', 0.8);

      // Inner Oceanic Teal enamel core
      const coreR = R * 0.82;
      const coreGrad = ctx.createRadialGradient(
        size * 0.42 + specShiftX * 0.5,
        size * 0.36 + specShiftY * 0.5,
        coreR * 0.1,
        size * 0.5,
        size * 0.5,
        coreR * 1.15
      );
      coreGrad.addColorStop(0, '#2E899C');
      coreGrad.addColorStop(0.58, '#1F6A7A');
      coreGrad.addColorStop(1, '#12424D');
      drawEllipticalDisc(faceZ + (frontVisible ? 0.3 : -0.3), coreR, rx, ry, coreGrad, '#DFC38D', 0.9);

      // Compass cardinal tick marks on enamel dial
      const tickZ = faceZ + (frontVisible ? 0.6 : -0.6);
      for (let t = 0; t < 12; t++) {
        const ang = (t / 12) * Math.PI * 2;
        const isMajor = t % 3 === 0;
        const rIn = coreR * (isMajor ? 0.76 : 0.84);
        const rOut = coreR * 0.93;
        const pIn = project(Math.cos(ang) * rIn, Math.sin(ang) * rIn, tickZ, rx, ry);
        const pOut = project(Math.cos(ang) * rOut, Math.sin(ang) * rOut, tickZ, rx, ry);
        ctx.beginPath();
        ctx.moveTo(pIn.px, pIn.py);
        ctx.lineTo(pOut.px, pOut.py);
        ctx.strokeStyle = isMajor ? 'rgba(243, 227, 190, 0.88)' : 'rgba(243, 227, 190, 0.38)';
        ctx.lineWidth = isMajor ? 1.35 : 0.8;
        ctx.stroke();
      }

      // 4. Raised 3D Parallax Relief Emblem
      const reliefShadowZ = faceZ + (frontVisible ? 0.9 : -0.9);
      const reliefZ = faceZ + (frontVisible ? 2.1 : -2.1);

      if (frontVisible) {
        // Raised Cat Paw Relief (Shadow layer + Champagne Gold top relief)
        const sUnit = R * 0.1;
        const drawPawLayer = (zPos: number, color: string) => {
          // Central palm pad
          drawBlob3D(0, sUnit * 1.35, sUnit * 2.25, sUnit * 1.85, 0, zPos, rx, ry, color);
          // 4 Toe beans in gentle arc
          drawBlob3D(-sUnit * 2.35, -sUnit * 0.85, sUnit * 0.88, sUnit * 1.18, -0.32, zPos, rx, ry, color);
          drawBlob3D(-sUnit * 0.82, -sUnit * 2.05, sUnit * 0.88, sUnit * 1.22, -0.1, zPos, rx, ry, color);
          drawBlob3D(sUnit * 0.82, -sUnit * 2.05, sUnit * 0.88, sUnit * 1.22, 0.1, zPos, rx, ry, color);
          drawBlob3D(sUnit * 2.35, -sUnit * 0.85, sUnit * 0.88, sUnit * 1.18, 0.32, zPos, rx, ry, color);
        };
        drawPawLayer(reliefShadowZ, 'rgba(12, 43, 50, 0.55)');
        drawPawLayer(reliefZ, '#F2DFB6');
      } else {
        // Reverse Coin Face: Geometric Cat Head & Pointed Ears Emblem
        const u = R * 0.11;
        const drawCatHead = (zPos: number, color: string) => {
          const earPts = [
            [-u * 2.5, -u * 0.4],
            [-u * 2.1, -u * 3.1],
            [-u * 0.6, -u * 1.6],
            [u * 0.6, -u * 1.6],
            [u * 2.1, -u * 3.1],
            [u * 2.5, -u * 0.4],
            [u * 2.3, u * 1.6],
            [0, u * 2.5],
            [-u * 2.3, u * 1.6],
          ];
          ctx.beginPath();
          earPts.forEach(([ex, ey], idx) => {
            const p = project(ex, ey, zPos, rx, ry);
            if (idx === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          });
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };
        drawCatHead(reliefShadowZ, 'rgba(12, 43, 50, 0.55)');
        drawCatHead(reliefZ, '#F2DFB6');
      }

      ctx.restore();
    };

    let rafId = 0;
    let isVisible = true;

    const tick = (time: number) => {
      if (!isVisible) return;
      renderFrame(time);
      rafId = requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      renderFrame(0);
    } else {
      rafId = requestAnimationFrame(tick);
    }

    let observer: IntersectionObserver | null = null;
    if (!reducedMotion && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const nextVisible = Boolean(entry?.isIntersecting);
          if (nextVisible && !isVisible) {
            isVisible = true;
            rafId = requestAnimationFrame(tick);
          } else if (!nextVisible) {
            isVisible = false;
            cancelAnimationFrame(rafId);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(canvas);
    }

    return () => {
      isVisible = false;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [size]);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    stateRef.current.hovering = true;
    stateRef.current.targetY = nx * 0.65;
    stateRef.current.targetX = -ny * 0.5;
  };

  const handlePointerLeave = () => {
    stateRef.current.hovering = false;
    stateRef.current.targetX = 0.16;
    stateRef.current.targetY = -0.28;
  };

  const handleSpinClick = () => {
    stateRef.current.velY += 0.42;
  };

  return (
    <button
      type="button"
      id="cat-compass-3d"
      className="cat-compass-3d-btn"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleSpinClick}
      title={title}
      aria-label={title}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block', pointerEvents: 'none' }}
        aria-hidden="true"
      />
    </button>
  );
};
