import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import {
  ATLAS_CELL_SIZE,
  ATLAS_GRID,
  BADGE_SIT_DURATION_SEC,
  IDLE_FRAME_INDICES,
  JUMP_FRAME_INDICES,
  OYEN_ATLAS_FRAMES,
  PAUSE_1S_DURATION_SEC,
  RUN_FRAME_INDICES,
  computeHeaderMascotTargets,
  evaluateArcJumpToTargetPhase,
  evaluateJumpPhase,
  evaluateWordmarkPlayPhase,
  getAtlasUvOffset,
  getNormalizedCellPlacement,
  getPatrolBounds,
  getResponsiveQuadSize,
} from '../config/oyenMascotConfig';
import { OyenHeaderMascot } from '../components/OyenHeaderMascot';
import { Header } from '../components/Header';

describe('Cuking Header — Three.js Oyen Mascot Integration', () => {
  it('verifies all original sprite sheet assets exist in sprite sheet/ with valid PNG signatures', () => {
    const expectedFiles = ['lari.png', 'lompat.png', 'oren master.png', 'kumpulan.png'];
    for (const file of expectedFiles) {
      const fullPath = path.resolve('sprite sheet', file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100_000);

      // Verify PNG magic signature (89 50 4E 47) and RGBA colorType = 6 in IHDR
      const buf = fs.readFileSync(fullPath);
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
      const colorType = buf[25];
      expect(colorType).toBe(6); // Truecolor with alpha (RGBA)
    }
  });

  it('maps exact idle, run, and jump frames within source dimensions and skips incompatible pose 8', () => {
    expect(OYEN_ATLAS_FRAMES.length).toBe(16);
    expect(IDLE_FRAME_INDICES).toEqual([0, 1, 2, 3]);
    expect(RUN_FRAME_INDICES).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(JUMP_FRAME_INDICES).toEqual([12, 13, 14, 15]);

    for (const f of OYEN_ATLAS_FRAMES) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(1983);
      expect(f.y + f.h).toBeLessThanOrEqual(793);
      if (f.sheet === 'lompat') {
        expect(f.sourceIndex).toBeLessThan(8);
      }
    }
  });

  it('guarantees zero clipping (positive safety padding on all 4 sides) inside every 256x256 normalized cell', () => {
    for (const f of OYEN_ATLAS_FRAMES) {
      const { col, row, dx, dy, dw, dh } = getNormalizedCellPlacement(f);
      const cellLeft = col * ATLAS_CELL_SIZE;
      const cellRight = (col + 1) * ATLAS_CELL_SIZE;
      const cellTop = row * ATLAS_CELL_SIZE;
      const cellBottom = (row + 1) * ATLAS_CELL_SIZE;

      expect(dx - cellLeft).toBeGreaterThanOrEqual(12);
      expect(cellRight - (dx + dw)).toBeGreaterThanOrEqual(12);
      expect(dy - cellTop).toBeGreaterThanOrEqual(30);
      expect(cellBottom - (dy + dh)).toBeGreaterThanOrEqual(16);
    }
  });

  it('computes accurate Three.js UV offsets and parabolic jump phases across crouch, ascent, apex, and landing', () => {
    expect(getAtlasUvOffset(0)).toEqual({ u: 0, v: 0.75, repeat: 1 / ATLAS_GRID });
    expect(getAtlasUvOffset(3)).toEqual({ u: 0.75, v: 0.75, repeat: 0.25 });
    expect(getAtlasUvOffset(4)).toEqual({ u: 0, v: 0.5, repeat: 0.25 });
    expect(getAtlasUvOffset(15)).toEqual({ u: 0.75, v: 0, repeat: 0.25 });

    const prep = evaluateJumpPhase(0.08, 10);
    expect(prep.atlasIndex).toBe(12);
    expect(prep.jumpY).toBe(0);
    expect(prep.squashY).toBeLessThan(1);

    const up = evaluateJumpPhase(0.3, 10);
    expect(up.atlasIndex).toBe(13);
    expect(up.jumpY).toBeGreaterThan(3);

    const apex = evaluateJumpPhase(0.58, 10);
    expect(apex.atlasIndex).toBe(14);
    expect(apex.jumpY).toBeCloseTo(10, 1);

    const land = evaluateJumpPhase(0.88, 10);
    expect(land.atlasIndex).toBe(15);
    expect(land.jumpY).toBeGreaterThan(0);
  });

  it('computes full-width patrol bounds and dynamic wordmark play target on both mobile and desktop', () => {
    const mobileQuad = getResponsiveQuadSize(390);
    expect(mobileQuad).toBeGreaterThanOrEqual(44);
    expect(mobileQuad).toBeLessThanOrEqual(52);

    const mobileBounds = getPatrolBounds(390, mobileQuad);
    expect(mobileBounds.canPatrol).toBe(true);
    expect(mobileBounds.centerX).toBe(0);
    expect(mobileBounds.minX).toBeLessThan(-150);
    expect(mobileBounds.maxX).toBeGreaterThan(150);
    expect(mobileBounds.span).toBeGreaterThan(300);

    const desktopQuad = getResponsiveQuadSize(860);
    expect(desktopQuad).toBe(52);

    const desktopBounds = getPatrolBounds(860, desktopQuad);
    expect(desktopBounds.canPatrol).toBe(true);
    expect(desktopBounds.centerX).toBe(0);
    expect(desktopBounds.minX).toBeLessThan(-380);
    expect(desktopBounds.maxX).toBeGreaterThan(380);
    expect(desktopBounds.span).toBeGreaterThan(760);

    // Verify dynamic wordmark play target & badge perch target (~3s sit + click-jump)
    const targets = computeHeaderMascotTargets(
      860,
      62,
      desktopQuad,
      { left: 16, top: 15, width: 98, height: 40 },
      { left: 748, top: 24, width: 96, height: 28 }
    );
    expect(targets.entryLeftWorldX).toBeLessThan(-430);
    expect(targets.wordmarkTakeoffWorldX).toBeGreaterThan(-430 + 20);
    expect(targets.wordmarkPlayWorldX).toBeGreaterThan(targets.wordmarkTakeoffWorldX);
    expect(targets.wordmarkPlayQuadY).toBeGreaterThan(targets.floorBaseQuadY);
    expect(targets.badgeWorldX).toBeCloseTo(366, 0);
    expect(targets.badgePerchQuadY).toBeGreaterThan(targets.floorBaseQuadY);
    expect(PAUSE_1S_DURATION_SEC).toBe(1.0);
    expect(BADGE_SIT_DURATION_SEC).toBe(3.0);

    const midArc = evaluateArcJumpToTargetPhase(
      0.5,
      targets.wordmarkTakeoffWorldX,
      targets.wordmarkPlayWorldX,
      targets.floorBaseQuadY,
      targets.wordmarkPlayQuadY,
      desktopQuad,
      targets.wordmarkQuadSize
    );
    expect(midArc.x).toBeGreaterThan(targets.wordmarkTakeoffWorldX);
    expect(midArc.x).toBeLessThan(targets.wordmarkPlayWorldX);
    expect(midArc.y).toBeGreaterThan(targets.floorBaseQuadY);
    expect(JUMP_FRAME_INDICES).toContain(midArc.atlasIndex);

    const playPeek = evaluateWordmarkPlayPhase(0.15);
    expect(playPeek.atlasIndex).toBe(12);
    const playPawRaise = evaluateWordmarkPlayPhase(0.5);
    expect(playPawRaise.atlasIndex).toBe(13);
    expect(playPawRaise.offsetY).toBeGreaterThan(1);
    const playSettle = evaluateWordmarkPlayPhase(0.95);
    expect(playSettle.atlasIndex).toBe(0);
  });

  it('integrates cleanly into Header with brand logo, status pills, catalog controls, and non-WebGL fallback', () => {
    const mascotHtml = renderToString(React.createElement(OyenHeaderMascot));
    expect(mascotHtml).toContain('id="oyen-header-mascot"');
    expect(mascotHtml).toContain('header-mascot-fallback');

    const mapHeaderHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(Header, { catCount: 7 })
      )
    );
    expect(mapHeaderHtml).toContain('/cuking logo.png');
    expect(mapHeaderHtml).toContain('id="oyen-header-mascot"');
    expect(mapHeaderHtml).toContain('id="header-cat-counter-badge"');
    expect(mapHeaderHtml).toContain('Total kucing terdata: 7');
    expect(mapHeaderHtml.replace('<!-- -->', '')).toContain('7 Kucing');

    const catalogHeaderHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/catalog'] },
        React.createElement(Header, { catCount: 7 })
      )
    );
    expect(catalogHeaderHtml).toContain('/cuking logo.png');
    expect(catalogHeaderHtml).toContain('id="oyen-header-mascot"');
    expect(catalogHeaderHtml).toContain('id="header-catalog-quick-add"');
    expect(catalogHeaderHtml).not.toContain('id="cat-compass-3d"');
  });
});
