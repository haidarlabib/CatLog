/**
 * Configuration and helpers for cat appearance, Character Badge frames,
 * coat colors, and patterns.
 */

export interface CharacterBadge {
  id: string;
  nickname: string;
  epithet: string;
  description: string;
  assetPath: string;
  hex: string;
}

export const CHARACTER_BADGES: CharacterBadge[] = [
  {
    id: 'oopsie',
    nickname: 'Oopsie',
    epithet: 'Si Oon',
    description: 'Polos, santai, dan sedikit bingung. Suka bengong, penasaran sama hal random, dan sering bertingkah konyol tanpa sadar.',
    assetPath: '/borders/white_border.png',
    hex: '#94A3B8',
  },
  {
    id: 'lil-boss',
    nickname: 'Lil Boss',
    epithet: 'Si Bos Nakal',
    description: 'Percaya diri, sok berkuasa, dan suka bikin ulah. Tingkahnya jahil, selalu ingin jadi pusat perhatian, tetapi tetap menggemaskan.',
    assetPath: '/borders/orange_border.png',
    hex: '#D96B43',
  },
  {
    id: 'pinkie',
    nickname: 'Pinkie',
    epithet: 'Si Manis',
    description: 'Lembut, manja, dan penuh pesona. Suka cari perhatian, senang dielus, dan punya tingkah yang bikin siapa pun gemas.',
    assetPath: '/borders/pink_border.png',
    hex: '#D94680',
  },
  {
    id: 'bluebell',
    nickname: 'Bluebell',
    epithet: 'Si Lucu',
    description: 'Manis, menggemaskan, dan punya daya tarik tersendiri. Tingkahnya spontan, ekspresif, dan bikin orang susah menahan senyum.',
    assetPath: '/borders/blue_border.png',
    hex: '#2B799E',
  },
  {
    id: 'clover',
    nickname: 'Clover',
    epithet: 'Si Ramah',
    description: 'Hangat, bersahabat, dan mudah didekati. Suka menyapa, nyaman berada di dekat manusia, dan punya aura yang menenangkan.',
    assetPath: '/borders/green_border.png',
    hex: '#2E8B57',
  },
  {
    id: 'rascal',
    nickname: 'Rascal',
    epithet: 'Si Galak',
    description: 'Jutek, berani, dan sedikit temperamental. Suka pasang muka judes, punya pendirian kuat, tetapi tetap punya sisi lucu yang bikin gemas.',
    assetPath: '/borders/red_border.png',
    hex: '#DC2626',
  },
];

export interface BadgeRingOption {
  id: string;
  name: string;
  hex: string;
}

export const BADGE_RING_OPTIONS: BadgeRingOption[] = CHARACTER_BADGES.map((b) => ({
  id: b.id,
  name: `${b.nickname} (${b.epithet})`,
  hex: b.hex,
}));

export const DEFAULT_BADGE_RING = 'lil-boss';
export const DEFAULT_BADGE_COLOR_HEX = '#D96B43';

/**
 * Resolves a badge identifier, legacy color string, or hex code to a CharacterBadge.
 * Guarantees a safe fallback to Oopsie for unknown/empty values.
 */
export function resolveBadge(badgeIdOrLegacy?: string | null): CharacterBadge {
  if (!badgeIdOrLegacy) {
    return CHARACTER_BADGES[0]; // Oopsie fallback
  }

  const raw = badgeIdOrLegacy.trim().toLowerCase();

  // 1. Direct match on ID
  const directMatch = CHARACTER_BADGES.find((b) => b.id.toLowerCase() === raw);
  if (directMatch) return directMatch;

  // 2. Direct match on Nickname or Epithet
  const nickMatch = CHARACTER_BADGES.find(
    (b) => b.nickname.toLowerCase() === raw || b.epithet.toLowerCase() === raw
  );
  if (nickMatch) return nickMatch;

  // 3. Backward-compatible legacy color name and hex mappings
  if (
    raw === 'terracotta' ||
    raw === 'orange' ||
    raw === 'oranye' ||
    raw === '#d96b43' ||
    raw === '#f97316' ||
    raw.includes('terracotta') ||
    raw.includes('amber')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'lil-boss')!;
  }

  if (
    raw === 'blue' ||
    raw === 'biru' ||
    raw === '#2b799e' ||
    raw === '#3b82f6' ||
    raw === '#0284c7' ||
    raw.includes('blue') ||
    raw.includes('biru') ||
    raw.includes('sky')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'bluebell')!;
  }

  if (
    raw === 'pink' ||
    raw === '#d94680' ||
    raw === '#ec4899' ||
    raw.includes('pink') ||
    raw.includes('rose')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'pinkie')!;
  }

  if (
    raw === 'green' ||
    raw === 'hijau' ||
    raw === '#2e8b57' ||
    raw === '#10b981' ||
    raw.includes('green') ||
    raw.includes('hijau') ||
    raw.includes('emerald')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'clover')!;
  }

  if (
    raw === 'red' ||
    raw === 'merah' ||
    raw === '#dc2626' ||
    raw === '#ef4444' ||
    raw.includes('red') ||
    raw.includes('merah')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'rascal')!;
  }

  if (
    raw === 'yellow' ||
    raw === 'kuning' ||
    raw === '#d97706' ||
    raw === '#f59e0b' ||
    raw.includes('yellow') ||
    raw.includes('kuning') ||
    raw.includes('white') ||
    raw.includes('putih')
  ) {
    return CHARACTER_BADGES.find((b) => b.id === 'oopsie')!;
  }

  // 4. Default safe fallback for unknown legacy values
  return CHARACTER_BADGES[0];
}

/**
 * Resolves a badge ring ID or arbitrary hex to a valid hex color string.
 * Ensures backward-compatibility and safe fallback.
 */
export function getBadgeColorHex(ringIdOrHex?: string | null): string {
  if (!ringIdOrHex) return DEFAULT_BADGE_COLOR_HEX;

  // If already a valid hex color format (#xxx or #xxxxxx)
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(ringIdOrHex)) {
    return ringIdOrHex;
  }

  return resolveBadge(ringIdOrHex).hex;
}

/**
 * Standard preset coat colors
 */
export const PRESET_COAT_COLORS = [
  { id: 'Orange', label: 'Oranye' },
  { id: 'White', label: 'Putih' },
  { id: 'Black', label: 'Hitam' },
  { id: 'Gray', label: 'Abu-abu' },
  { id: 'Brown', label: 'Cokelat' },
];

/**
 * Standard preset patterns
 */
export const PRESET_PATTERNS = [
  { id: 'Tabby', label: 'Tabby' },
  { id: 'Calico', label: 'Calico' },
  { id: 'Solid', label: 'Polos' },
  { id: 'Bicolor', label: 'Belang' },
];

/**
 * Map of English coat/pattern keys to Indonesian display labels
 */
export const APPEARANCE_DISPLAY_MAP: Record<string, string> = {
  Orange: 'Oranye',
  orange: 'Oranye',
  Oranye: 'Oranye',
  White: 'Putih',
  white: 'Putih',
  Putih: 'Putih',
  Black: 'Hitam',
  black: 'Hitam',
  Hitam: 'Hitam',
  Gray: 'Abu-abu',
  gray: 'Abu-abu',
  Grey: 'Abu-abu',
  grey: 'Abu-abu',
  'Abu-abu': 'Abu-abu',
  Brown: 'Cokelat',
  brown: 'Cokelat',
  Cokelat: 'Cokelat',
  Tabby: 'Tabby',
  tabby: 'Tabby',
  Calico: 'Calico',
  calico: 'Calico',
  'Belang Tiga': 'Calico',
  Solid: 'Polos',
  solid: 'Polos',
  Polos: 'Polos',
  Bicolor: 'Belang',
  bicolor: 'Belang',
  Belang: 'Belang',
};

export function formatAppearanceLabel(value: string): string {
  if (!value) return '';
  return APPEARANCE_DISPLAY_MAP[value] || value;
}

/**
 * Standard breed options with underlying values and Indonesian labels
 */
export const BREED_OPTIONS = [
  { value: 'unknown', label: 'Belum tahu pasti' },
  { value: 'domestic', label: 'Domestik / Kampung' },
  { value: 'persian', label: 'Persia' },
  { value: 'angora', label: 'Anggora' },
  { value: 'maine_coon', label: 'Maine Coon' },
  { value: 'siamese', label: 'Siam' },
  { value: 'bengal', label: 'Bengal' },
  { value: 'other', label: 'Lainnya' },
];

export function formatBreedLabel(breed?: string): string {
  if (!breed || breed === 'unknown' || breed === 'Not sure yet') {
    return 'Belum tahu pasti';
  }
  const match = BREED_OPTIONS.find(
    (b) => b.value.toLowerCase() === breed.toLowerCase() || b.label.toLowerCase() === breed.toLowerCase()
  );
  if (match) return match.label;
  return breed;
}
