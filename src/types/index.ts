/**
 * Domain Data Models per PRD Section 9
 * ProwlLog PWA - Personal Cat Tracker
 */

export type BreedType =
  | 'unknown'
  | 'domestic'
  | 'persian'
  | 'angora'
  | 'maine_coon'
  | 'siamese'
  | 'bengal'
  | 'other';

export type FoodType = 'wet_food' | 'dry_food' | 'treat' | 'other';

export interface Cat {
  id: string;
  name: string;
  breed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  notes?: string;
  coverPhotoId?: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Sighting {
  id: string;
  catId: string;
  photoId?: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  notes?: string;
  spottedAt: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CatPhoto {
  id: string;
  catId: string;
  sightingId?: string | null;
  blob: Blob;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  createdAt: string; // ISO 8601
}

export interface FeedingLog {
  id: string;
  catId: string;
  sightingId?: string | null;
  foodType: FoodType;
  notes?: string;
  fedAt: string; // ISO 8601
  createdAt: string; // ISO 8601
}

export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: string; // ISO 8601
}

export interface CatWithLatestSighting extends Cat {
  latestSighting?: Sighting | null;
  sightingsCount: number;
  coverPhotoUrl?: string | null;
}

/* Input DTOs */
export interface CreateCatInput {
  name: string;
  breed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  notes?: string;
  coverPhotoId?: string | null;
}

export interface UpdateCatInput {
  name?: string;
  breed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  notes?: string;
  coverPhotoId?: string | null;
}

export interface CreateSightingInput {
  catId: string;
  photoId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  notes?: string;
  spottedAt?: string;
}

export interface UpdateSightingInput {
  photoId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  notes?: string;
  spottedAt?: string;
}

export interface SavePhotoInput {
  catId: string;
  sightingId?: string | null;
  blob: Blob;
  mimeType: string;
  width?: number | null;
  height?: number | null;
}

export interface CreateFeedingLogInput {
  catId: string;
  sightingId?: string | null;
  foodType: FoodType;
  notes?: string;
  fedAt?: string;
}

