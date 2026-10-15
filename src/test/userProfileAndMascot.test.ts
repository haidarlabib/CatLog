import { describe, it, expect, beforeEach } from 'vitest';
import { settingsRepository } from '../db';

describe('UserProfile & Mascot Assets', () => {
  beforeEach(async () => {
    await settingsRepository.clearAllData();
  });

  it('stores and retrieves user profile nickname and photo data', async () => {
    // Default fallback
    const defaultName = await settingsRepository.get<string>('profileName', 'Cat Explorer');
    expect(defaultName).toBe('Cat Explorer');

    // Update nickname
    await settingsRepository.set('profileName', 'Pramudya Explorer');
    const updatedName = await settingsRepository.get<string>('profileName');
    expect(updatedName).toBe('Pramudya Explorer');

    // Save mock photo data
    const mockPhoto = { blob: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', mimeType: 'image/png' };
    await settingsRepository.set('profilePhoto', mockPhoto);

    const retrievedPhoto = await settingsRepository.get<typeof mockPhoto>('profilePhoto');
    expect(retrievedPhoto).toBeDefined();
    expect(retrievedPhoto?.blob).toBe(mockPhoto.blob);
    expect(retrievedPhoto?.mimeType).toBe('image/png');
  });

  it('validates Oyen mascot variant naming and assets', () => {
    const OYEN_ASSETS = {
      bos: '/mascot/oyen-bos.png',
      penasaran: '/mascot/oyen-penasaran.png',
      ngambek: '/mascot/oyen-ngambek.png',
      mager: '/mascot/oyen-mager.png',
    };

    expect(OYEN_ASSETS.bos).toContain('oyen-bos');
    expect(OYEN_ASSETS.penasaran).toContain('oyen-penasaran');
    expect(OYEN_ASSETS.ngambek).toContain('oyen-ngambek');
    expect(OYEN_ASSETS.mager).toContain('oyen-mager');
  });

  it('generates correct user initials for fallback avatar', () => {
    const getInitials = (name: string) =>
      name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase() || 'U';

    expect(getInitials('Cat Explorer')).toBe('CE');
    expect(getInitials('Haidar')).toBe('H');
    expect(getInitials('Ahmad Dahlan')).toBe('AD');
    expect(getInitials('')).toBe('U');
  });
});
