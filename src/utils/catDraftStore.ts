import type { PhotoCropData } from './image';

export interface AddCatPhotoDraft {
  blob: Blob;
  previewUrl: string;
  crop: PhotoCropData;
  timestamp: number;
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
let currentPhotoDraft: AddCatPhotoDraft | null = null;
let currentFormDraft: AddCatFormDraft | null = null;

export const catDraftStore = {
  /**
   * Store the approved photo draft and create a managed object URL.
   * Automatically revokes previous previewUrl to prevent memory leaks.
   */
  setPhotoDraft(draft: {
    blob: Blob;
    crop: PhotoCropData;
    timestamp?: number;
    location?: { latitude: number; longitude: number } | null;
  }): AddCatPhotoDraft {
    if (currentPhotoDraft?.previewUrl && currentPhotoDraft.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentPhotoDraft.previewUrl);
      } catch {
        // Safe ignore
      }
    }

    const previewUrl = URL.createObjectURL(draft.blob);
    currentPhotoDraft = {
      blob: draft.blob,
      previewUrl,
      crop: draft.crop,
      timestamp: draft.timestamp || Date.now(),
      location: draft.location ?? null,
    };

    return currentPhotoDraft;
  },

  /**
   * Get the current approved photo draft.
   */
  getPhotoDraft(): AddCatPhotoDraft | null {
    return currentPhotoDraft;
  },

  /**
   * Check whether a valid photo draft with a non-empty blob exists.
   */
  hasPhotoDraft(): boolean {
    return Boolean(currentPhotoDraft && currentPhotoDraft.blob && currentPhotoDraft.blob.size > 0);
  },

  /**
   * Clear the photo draft and revoke object URL.
   */
  clearPhotoDraft(): void {
    if (currentPhotoDraft?.previewUrl && currentPhotoDraft.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentPhotoDraft.previewUrl);
      } catch {
        // Safe ignore
      }
    }
    currentPhotoDraft = null;
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
