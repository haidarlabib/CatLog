import { useState, useEffect, useCallback, useRef } from 'react';
import { settingsRepository } from '../db';

/**
 * Hook to read/write user profile (nickname + photo) from IndexedDB settings.
 * Used by Settings page and Map page personal avatar marker.
 */

export interface UserProfile {
  nickname: string;
  photoBlob: Blob | null;
  photoUrl: string | null;
}

const DEFAULT_NICKNAME = 'Cat Explorer';
const SETTINGS_KEY_NICKNAME = 'profileName';
const SETTINGS_KEY_PHOTO = 'profilePhoto';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>({
    nickname: DEFAULT_NICKNAME,
    photoBlob: null,
    photoUrl: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const photoUrlRef = useRef<string | null>(null);
  useEffect(() => {
    photoUrlRef.current = profile.photoUrl;
  }, [profile.photoUrl]);

  // Load profile from DB
  const loadProfile = useCallback(async () => {
    try {
      const [name, photoData] = await Promise.all([
        settingsRepository.get<string>(SETTINGS_KEY_NICKNAME, DEFAULT_NICKNAME),
        settingsRepository.get<{ blob: string; mimeType: string }>(SETTINGS_KEY_PHOTO),
      ]);

      let photoBlob: Blob | null = null;
      let photoUrl: string | null = null;

      if (photoData && photoData.blob) {
        // Convert base64 back to Blob
        const byteChars = atob(photoData.blob);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        photoBlob = new Blob([byteNumbers], { type: photoData.mimeType || 'image/jpeg' });
        photoUrl = URL.createObjectURL(photoBlob);
      }

      setProfile({
        nickname: name || DEFAULT_NICKNAME,
        photoBlob,
        photoUrl,
      });
    } catch {
      // Fallback silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    return () => {
      // Cleanup blob URL on unmount
      if (photoUrlRef.current && photoUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(photoUrlRef.current);
        } catch {
          // Safe ignore
        }
      }
    };
  }, [loadProfile]);

  const updateNickname = useCallback(async (name: string) => {
    const trimmed = name.trim() || DEFAULT_NICKNAME;
    await settingsRepository.set(SETTINGS_KEY_NICKNAME, trimmed);
    setProfile((prev) => ({ ...prev, nickname: trimmed }));
  }, []);

  const updatePhoto = useCallback(async (blob: Blob) => {
    // Store as base64 in settings (photos are small profile pics)
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:xxx;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });

    await settingsRepository.set(SETTINGS_KEY_PHOTO, {
      blob: base64,
      mimeType: blob.type || 'image/jpeg',
    });

    // Update state
    setProfile((prev) => {
      if (prev.photoUrl) URL.revokeObjectURL(prev.photoUrl);
      return {
        ...prev,
        photoBlob: blob,
        photoUrl: URL.createObjectURL(blob),
      };
    });
  }, []);

  const removePhoto = useCallback(async () => {
    await settingsRepository.delete(SETTINGS_KEY_PHOTO);
    setProfile((prev) => {
      if (prev.photoUrl) URL.revokeObjectURL(prev.photoUrl);
      return { ...prev, photoBlob: null, photoUrl: null };
    });
  }, []);

  return {
    profile,
    isLoading,
    updateNickname,
    updatePhoto,
    removePhoto,
    reloadProfile: loadProfile,
  };
}
