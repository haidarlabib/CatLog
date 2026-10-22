import { DEFAULT_PHOTO_CROP, type PhotoCropData } from './image';

export interface AddCatPhotoDraft {
  id: string;
  blob: Blob;
  previewUrl: string;
  crop: PhotoCropData;
  timestamp: number;
  isCover: boolean;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface AddCatFormDraft {
  name: string;
  breed: string;
  badgeRing: string;
  coatColors: string[];
  patterns: string[];
  notes: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  locationSource: 'gps' | 'manual';
}

// Scoped in-memory draft container
let currentPhotosDraft: AddCatPhotoDraft[] = [];
let currentFormDraft: AddCatFormDraft | null = null;

export const catDraftStore = {
  /**
   * Set multiple photos in draft, revoking previous object URLs.
   */
  setPhotosDraft(photos: Array<{
    id?: string;
    blob: Blob;
    crop?: PhotoCropData;
    isCover?: boolean;
    timestamp?: number;
    location?: { latitude: number; longitude: number } | null;
  }>): AddCatPhotoDraft[] {
    // Revoke previous URLs
    this.clearPhotoDraft();

    if (!photos || photos.length === 0) {
      currentPhotosDraft = [];
      return [];
    }

    const hasExplicitCover = photos.some((p) => p.isCover);
    currentPhotosDraft = photos.map((item, idx) => {
      const id = item.id || `draft_photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      const previewUrl = URL.createObjectURL(item.blob);
      const isCover = hasExplicitCover ? Boolean(item.isCover) : idx === 0;

      return {
        id,
        blob: item.blob,
        previewUrl,
        crop: item.crop ? { ...item.crop } : { ...DEFAULT_PHOTO_CROP },
        timestamp: item.timestamp || Date.now(),
        isCover,
        location: item.location ?? null,
      };
    });

    return [...currentPhotosDraft];
  },

  /**
   * Add a single photo to the draft list.
   */
  addPhotoDraft(item: {
    id?: string;
    blob: Blob;
    crop?: PhotoCropData;
    isCover?: boolean;
    timestamp?: number;
    location?: { latitude: number; longitude: number } | null;
  }): AddCatPhotoDraft {
    const id = item.id || `draft_photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const previewUrl = URL.createObjectURL(item.blob);
    const isFirst = currentPhotosDraft.length === 0;
    const isCover = item.isCover !== undefined ? item.isCover : isFirst;

    if (isCover) {
      currentPhotosDraft.forEach((p) => {
        p.isCover = false;
      });
    }

    const newPhoto: AddCatPhotoDraft = {
      id,
      blob: item.blob,
      previewUrl,
      crop: item.crop ? { ...item.crop } : { ...DEFAULT_PHOTO_CROP },
      timestamp: item.timestamp || Date.now(),
      isCover,
      location: item.location ?? null,
    };

    currentPhotosDraft.push(newPhoto);
    return newPhoto;
  },

  /**
   * Designate a specific photo as the cover photo.
   */
  setCoverPhoto(id: string): void {
    let found = false;
    currentPhotosDraft.forEach((p) => {
      if (p.id === id) {
        p.isCover = true;
        found = true;
      } else {
        p.isCover = false;
      }
    });

    if (!found && currentPhotosDraft.length > 0) {
      currentPhotosDraft[0].isCover = true;
    }
  },

  /**
   * Update crop specifically for the cover photo.
   */
  updateCoverCrop(crop: PhotoCropData): void {
    const cover = this.getCoverPhotoDraft();
    if (cover) {
      cover.crop = { ...crop };
    }
  },

  /**
   * Update crop for a specific photo by ID.
   */
  updatePhotoCrop(id: string, crop: PhotoCropData): void {
    const target = currentPhotosDraft.find((p) => p.id === id);
    if (target) {
      target.crop = { ...crop };
    }
  },

  /**
   * Remove a photo from draft by ID.
   */
  removePhotoDraft(id: string): void {
    const idx = currentPhotosDraft.findIndex((p) => p.id === id);
    if (idx === -1) return;

    const removed = currentPhotosDraft[idx];
    if (removed.previewUrl && removed.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed.previewUrl);
      } catch {
        // Safe ignore
      }
    }

    const wasCover = removed.isCover;
    currentPhotosDraft.splice(idx, 1);

    if (wasCover && currentPhotosDraft.length > 0) {
      currentPhotosDraft[0].isCover = true;
    }
  },

  /**
   * Get all draft photos.
   */
  getPhotosDraft(): AddCatPhotoDraft[] {
    return [...currentPhotosDraft];
  },

  /**
   * Get the designated cover photo draft, or first photo as fallback.
   */
  getCoverPhotoDraft(): AddCatPhotoDraft | null {
    if (currentPhotosDraft.length === 0) return null;
    return currentPhotosDraft.find((p) => p.isCover) || currentPhotosDraft[0] || null;
  },

  /**
   * Backward-compatible: Store a single photo as cover.
   */
  setPhotoDraft(draft: {
    blob: Blob;
    crop: PhotoCropData;
    timestamp?: number;
    location?: { latitude: number; longitude: number } | null;
  }): AddCatPhotoDraft {
    this.clearPhotoDraft();

    const id = `draft_photo_${Date.now()}`;
    const previewUrl = URL.createObjectURL(draft.blob);
    const newPhoto: AddCatPhotoDraft = {
      id,
      blob: draft.blob,
      previewUrl,
      crop: draft.crop,
      timestamp: draft.timestamp || Date.now(),
      isCover: true,
      location: draft.location ?? null,
    };

    currentPhotosDraft = [newPhoto];
    return newPhoto;
  },

  /**
   * Backward-compatible: Get the current approved photo draft (returns cover photo).
   */
  getPhotoDraft(): AddCatPhotoDraft | null {
    return this.getCoverPhotoDraft();
  },

  /**
   * Check whether at least one valid photo draft exists.
   */
  hasPhotoDraft(): boolean {
    return currentPhotosDraft.length > 0 && currentPhotosDraft.some((p) => Boolean(p.blob && p.blob.size > 0));
  },

  /**
   * Clear all photo drafts and revoke object URLs.
   */
  clearPhotoDraft(): void {
    currentPhotosDraft.forEach((p) => {
      if (p.previewUrl && p.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {
          // Safe ignore
        }
      }
    });
    currentPhotosDraft = [];
  },

  /**
   * Save form fields before user navigates back to camera (e.g. via "Ganti Foto").
   */
  setFormDraft(form: AddCatFormDraft): void {
    currentFormDraft = { ...form };
  },

  /**
   * Retrieve preserved form fields.
   */
  getFormDraft(): AddCatFormDraft | null {
    return currentFormDraft;
  },

  /**
   * Clear saved form fields.
   */
  clearFormDraft(): void {
    currentFormDraft = null;
  },

  /**
   * Complete cleanup after successful cat creation or complete cancellation.
   */
  clearAllDrafts(): void {
    this.clearPhotoDraft();
    this.clearFormDraft();
  },
};

