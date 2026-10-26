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
  MASCOT_CHARACTER_CONFIGS,
  MASCOT_TURN_ORDER,
  MUJAER_ATLAS_FRAMES,
  OYEN_ATLAS_FRAMES,
  PAUSE_1S_DURATION_SEC,
  POST_INTERACT_SIT_SEC,
  PUTIH_ATLAS_FRAMES,
  RUN_FRAME_INDICES,
  computeHeaderMascotTargets,
  computeSafeMascotHitbox,
  evaluateArcJumpToTargetPhase,
  evaluateBasecampBreathing,
  evaluateJumpPhase,
  evaluateWordmarkPlayPhase,
  getAtlasUvOffset,
  getCharacterAtlasUv,
  getMascotRoleState,
  getNextMascotCharacterId,
  getNormalizedCellPlacement,
  getPatrolBounds,
  getResponsiveQuadSize,
} from '../config/oyenMascotConfig';
import { OyenHeaderMascot } from '../components/OyenHeaderMascot';
import { Header } from '../components/Header';

function readPngDimensionsAndColorType(buf: Buffer) {
  expect(buf[0]).toBe(0x89);
  expect(buf[1]).toBe(0x50);
  expect(buf[2]).toBe(0x4e);
  expect(buf[3]).toBe(0x47);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  return { width, height, colorType };
}

describe('Cuking Header — Trio Mascot System (Oyen, Mujaer & Kucing Putih)', () => {
  it('verifies all original sprite sheet assets for Oyen, Mujaer, and Kucing Putih exist with true RGBA alpha', () => {
    const expectedAssets: Array<[string, number, number]> = [
      ['lari.png', 1983, 793],
      ['lompat.png', 1983, 793],
      ['oren master.png', 1536, 1024],
      ['kumpulan.png', 1536, 1024],
      ['Tabby Cat Animation Sprite Sheet.png', 1983, 793],
      ['Fluffy Kitten Animation Sprite Sheet.png', 1774, 887],
    ];

    for (const [file, expW, expH] of expectedAssets) {
      const fullPath = path.resolve('sprite sheet', file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100_000);

      const buf = fs.readFileSync(fullPath);
      const { width, height, colorType } = readPngDimensionsAndColorType(buf);
      expect(width).toBe(expW);
      expect(height).toBe(expH);
      expect(colorType).toBe(6); // Truecolor RGBA transparency
    }
  });

  it('validates POT atlas dimensions, frame bounds, and polygon clip masks across all three characters', () => {
    expect(MASCOT_TURN_ORDER).toEqual(['oyen', 'mujaer', 'putih']);
    expect(getNextMascotCharacterId('oyen')).toBe('mujaer');
    expect(getNextMascotCharacterId('mujaer')).toBe('putih');
    expect(getNextMascotCharacterId('putih')).toBe('oyen');

    expect(OYEN_ATLAS_FRAMES.length).toBe(16);
    expect(MUJAER_ATLAS_FRAMES.length).toBe(17);
    expect(PUTIH_ATLAS_FRAMES.length).toBe(23);

    const sheetDimensions: Record<string, [number, number]> = {
      lari: [1983, 793],
      lompat: [1983, 793],
      mujaer: [1983, 793],
      putih: [1774, 887],
    };

    for (const charId of MASCOT_TURN_ORDER) {
      const cfg = MASCOT_CHARACTER_CONFIGS[charId];
      // Verify Power-of-Two (POT) atlas dimensions for hardware WebGL mipmaps
      const atlasW = cfg.atlasCols * ATLAS_CELL_SIZE;
      const atlasH = cfg.atlasRows * ATLAS_CELL_SIZE;
      expect(atlasW & (atlasW - 1)).toBe(0);
      expect(atlasH & (atlasH - 1)).toBe(0);
      expect(cfg.frames.length).toBeLessThanOrEqual(cfg.atlasCols * cfg.atlasRows);

      // Verify state frame indices reference valid atlas frames
      for (const idx of [
        ...cfg.idleFrames,
        ...cfg.sitFrames,
        ...cfg.runFrames,
        ...cfg.jumpFrames,
        ...cfg.playSequence,
        ...cfg.wordmarkSettleFrames,
        cfg.interactReactionFrame,
      ]) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(cfg.frames.length);
      }

      for (const f of cfg.frames) {
        const [maxW, maxH] = sheetDimensions[f.sheet];
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.w).toBeLessThanOrEqual(maxW);
        expect(f.y + f.h).toBeLessThanOrEqual(maxH);

        if (f.clipPoly) {
          expect(f.clipPoly.length).toBeGreaterThanOrEqual(3);
          for (const [px, py] of f.clipPoly) {
            expect(px).toBeGreaterThanOrEqual(f.x);
            expect(px).toBeLessThanOrEqual(f.x + f.w);
            expect(py).toBeGreaterThanOrEqual(f.y);
            expect(py).toBeLessThanOrEqual(f.y + f.h);
          }
        }
      }
    }

    // Kucing Putih pill exclusion checks: run y <= 291, idle y <= 591, jump y <= 838, master y <= 365
    expect(PUTIH_ATLAS_FRAMES[0].y + PUTIH_ATLAS_FRAMES[0].h).toBeLessThanOrEqual(365);
    for (const rIdx of MASCOT_CHARACTER_CONFIGS.putih.runFrames) {
      const f = PUTIH_ATLAS_FRAMES[rIdx];
      expect(f.y + f.h).toBeLessThanOrEqual(291);
    }
    for (const iIdx of MASCOT_CHARACTER_CONFIGS.putih.idleFrames) {
      const f = PUTIH_ATLAS_FRAMES[iIdx];
      expect(f.y + f.h).toBeLessThanOrEqual(591);
    }
    for (const jIdx of MASCOT_CHARACTER_CONFIGS.putih.jumpFrames) {
      const f = PUTIH_ATLAS_FRAMES[jIdx];
      expect(f.y + f.h).toBeLessThanOrEqual(838);
    }
  });

  it('guarantees zero cell-edge clipping inside every 256x256 normalized cell across all 56 trio frames', () => {
    for (const charId of MASCOT_TURN_ORDER) {
      const cfg = MASCOT_CHARACTER_CONFIGS[charId];
      for (const f of cfg.frames) {
        const { col, row, dx, dy, dw, dh } = getNormalizedCellPlacement(f, cfg.atlasCols);
        const cellLeft = col * ATLAS_CELL_SIZE;
        const cellRight = (col + 1) * ATLAS_CELL_SIZE;
        const cellTop = row * ATLAS_CELL_SIZE;
        const cellBottom = (row + 1) * ATLAS_CELL_SIZE;

        expect(dx - cellLeft).toBeGreaterThanOrEqual(10);
        expect(cellRight - (dx + dw)).toBeGreaterThanOrEqual(10);
        expect(dy - cellTop).toBeGreaterThanOrEqual(24);
        expect(cellBottom - (dy + dh)).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it('computes accurate UV offsets, role states, and both 4-frame and 6-frame parabolic jump arcs', () => {
    expect(IDLE_FRAME_INDICES).toEqual([0, 1, 2, 3]);
    expect(RUN_FRAME_INDICES).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(JUMP_FRAME_INDICES).toEqual([12, 13, 14, 15]);

    expect(getAtlasUvOffset(0)).toEqual({ u: 0, v: 0.75, repeat: 1 / ATLAS_GRID });
    expect(getAtlasUvOffset(15)).toEqual({ u: 0.75, v: 0, repeat: 0.25 });

    // Verify 8x4 POT UV math for Mujaer & Kucing Putih
    expect(getCharacterAtlasUv(0, 8, 4, 23)).toEqual({
      u: 0,
      v: 0.75,
      repeatU: 0.125,
      repeatV: 0.25,
    });
    expect(getCharacterAtlasUv(9, 8, 4, 23)).toEqual({
      u: 0.125,
      v: 0.5,
      repeatU: 0.125,
      repeatV: 0.25,
    });
    expect(getCharacterAtlasUv(22, 8, 4, 23)).toEqual({
      u: 0.75,
      v: 0.25,
      repeatU: 0.125,
      repeatV: 0.25,
    });

    // Verify high-level role states
    expect(getMascotRoleState('RUN_IN')).toBe('run');
    expect(getMascotRoleState('RUN_TO_BADGE')).toBe('run');
    expect(getMascotRoleState('RUN_OUT')).toBe('run');
    expect(getMascotRoleState('PLAY_ON_WORDMARK')).toBe('idle');
    expect(getMascotRoleState('PAUSE_ON_WORDMARK')).toBe('idle');
    expect(getMascotRoleState('JUMP_TO_WORDMARK')).toBe('jump');
    expect(getMascotRoleState('SIT_ON_BADGE')).toBe('sit');
    expect(getMascotRoleState('INTERACT_JUMP')).toBe('interact');
    expect(getMascotRoleState('INTERACT_PAUSE')).toBe('interact');
    expect(getMascotRoleState('BASECAMP_IDLE')).toBe('basecamp');
    expect(getMascotRoleState('DEPART_BASECAMP')).toBe('jumpToRun');
    expect(getMascotRoleState('RETURN_TO_BASECAMP')).toBe('returnToBasecamp');

    // 4-frame jump check (Oyen)
    expect(evaluateJumpPhase(0.08, 10).atlasIndex).toBe(12);
    expect(evaluateJumpPhase(0.3, 10).atlasIndex).toBe(13);
    expect(evaluateJumpPhase(0.58, 10).atlasIndex).toBe(14);
    expect(evaluateJumpPhase(0.88, 10).atlasIndex).toBe(15);

    // 6-frame jump check (Kucing Putih: [17, 18, 19, 20, 21, 22])
    const putihJumps = MASCOT_CHARACTER_CONFIGS.putih.jumpFrames;
    expect(evaluateJumpPhase(0.08, 8, putihJumps).atlasIndex).toBe(17);
    expect(evaluateJumpPhase(0.24, 8, putihJumps).atlasIndex).toBe(18);
    expect(evaluateJumpPhase(0.42, 8, putihJumps).atlasIndex).toBe(19);
    expect(evaluateJumpPhase(0.60, 8, putihJumps).atlasIndex).toBe(20);
    expect(evaluateJumpPhase(0.78, 8, putihJumps).atlasIndex).toBe(21);
    expect(evaluateJumpPhase(0.95, 8, putihJumps).atlasIndex).toBe(22);
  });

  it('computes responsive patrol bounds, non-overlapping interactive hitboxes, and 2s post-click recovery', () => {
    const mobileQuad = getResponsiveQuadSize(390);
    const mobileBounds = getPatrolBounds(390, mobileQuad);
    expect(mobileBounds.canPatrol).toBe(true);
    expect(mobileBounds.span).toBeGreaterThan(300);

    const desktopQuad = getResponsiveQuadSize(860);
    const wmRect = { left: 16, top: 15, width: 98, height: 40 };
    const badgeRect = { left: 748, top: 24, width: 96, height: 28 };
    const targets = computeHeaderMascotTargets(860, 62, desktopQuad, wmRect, badgeRect);

    expect(targets.entryLeftWorldX).toBeLessThan(-430);
    expect(targets.exitRightWorldX).toBeGreaterThan(430);
    expect(targets.wordmarkPlayWorldX).toBeGreaterThan(targets.wordmarkTakeoffWorldX);
    expect(targets.badgeWorldX).toBeCloseTo(366, 0);
    expect(PAUSE_1S_DURATION_SEC).toBe(1.0);
    expect(BADGE_SIT_DURATION_SEC).toBe(3.0);
    expect(POST_INTERACT_SIT_SEC).toBe(2.0);

    // Hitbox while running in open center corridor is enabled and never overlaps logo or badge
    const runHitbox = computeSafeMascotHitbox('RUN_TO_BADGE', 0, 860, 62, targets, false);
    expect(runHitbox.enabled).toBe(true);
    expect(runHitbox.leftPx).toBeGreaterThanOrEqual(wmRect.left + wmRect.width + 6);
    expect(runHitbox.leftPx + runHitbox.widthPx).toBeLessThanOrEqual(badgeRect.left - 6);

    // Hitbox while sitting on badge sits strictly above badgeRect.top so "0 Kucing" remains 100% clickable
    const sitHitbox = computeSafeMascotHitbox('SIT_ON_BADGE', targets.badgeWorldX, 860, 62, targets, false);
    expect(sitHitbox.enabled).toBe(true);
    expect(sitHitbox.topPx + sitHitbox.heightPx).toBeLessThanOrEqual(badgeRect.top);

    // Mascot Basecamp Slots: all three mascots have dedicated perches along the top of badge
    expect(targets.basecampSlots).toBeDefined();
    expect(targets.basecampSlots.oyen.worldX).toBeLessThan(targets.basecampSlots.mujaer.worldX);
    expect(targets.basecampSlots.mujaer.worldX).toBeLessThan(targets.basecampSlots.putih.worldX);
    for (const charId of MASCOT_TURN_ORDER) {
      const slot = targets.basecampSlots[charId];
      expect(slot.hitboxTopPx + slot.hitboxHeightPx).toBeLessThanOrEqual(badgeRect.top + 2);
    }

    // Basecamp breathing micro-motion
    const b0 = evaluateBasecampBreathing(1.0, 0);
    const b1 = evaluateBasecampBreathing(1.0, 1);
    expect(b0.offsetY).toBeDefined();
    expect(b0.scaleX).toBeCloseTo(1, 1);
    expect(b0.offsetY).not.toBe(b1.offsetY); // Distinct phase per slot

    // Hitbox is disabled during INTERACT_JUMP / INTERACT_PAUSE / BETWEEN_TURNS to prevent stacked clicks
    expect(computeSafeMascotHitbox('INTERACT_JUMP', 0, 860, 62, targets, false).enabled).toBe(false);
    expect(computeSafeMascotHitbox('INTERACT_PAUSE', 0, 860, 62, targets, false).enabled).toBe(false);
    expect(computeSafeMascotHitbox('BETWEEN_TURNS', 0, 860, 62, targets, false).enabled).toBe(false);

    // Character-specific wordmark play sequences
    for (const charId of MASCOT_TURN_ORDER) {
      const cfg = MASCOT_CHARACTER_CONFIGS[charId];
      const p1 = evaluateWordmarkPlayPhase(0.15, cfg.playSequence, cfg.wordmarkSettleFrames);
      const p2 = evaluateWordmarkPlayPhase(0.5, cfg.playSequence, cfg.wordmarkSettleFrames);
      const p3 = evaluateWordmarkPlayPhase(0.95, cfg.playSequence, cfg.wordmarkSettleFrames);
      expect(p1.atlasIndex).toBe(cfg.playSequence[0]);
      expect(p2.atlasIndex).toBe(cfg.playSequence[2]);
      expect(p3.atlasIndex).toBe(cfg.wordmarkSettleFrames[1]);
    }

    // Arc jump test with Mujaer jump frames
    const mujaerArc = evaluateArcJumpToTargetPhase(
      0.5,
      targets.wordmarkTakeoffWorldX,
      targets.wordmarkPlayWorldX,
      targets.floorBaseQuadY,
      targets.wordmarkPlayQuadY,
      desktopQuad,
      targets.wordmarkQuadSize,
      MASCOT_CHARACTER_CONFIGS.mujaer.sitFrames[0],
      MASCOT_CHARACTER_CONFIGS.mujaer.jumpFrames
    );
    expect(MASCOT_CHARACTER_CONFIGS.mujaer.jumpFrames).toContain(mujaerArc.atlasIndex);
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
