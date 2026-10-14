import React, { useState, useEffect } from 'react';
import { Footprints } from 'lucide-react';
import { photoRepository } from '../db';
import { getCropStyle, type PhotoCropData } from '../utils/image';
import { resolveBadge } from '../config/catAppearance';

export interface CatPhotoImgProps {
  photoId?: string | null;
  src?: string | null; // Direct object URL or remote URL
  alt: string;
  className?: string;
  aspectRatio?: string;
  mode?: 'square' | 'circle';
  ringColor?: string;
  badgeId?: string | null;
  crop?: Partial<PhotoCropData> | null;
  style?: React.CSSProperties;
}

export const CatPhotoImg: React.FC<CatPhotoImgProps> = ({
  photoId,
  src,
  alt,
  className = 'cat-card-img',
  aspectRatio,
  mode = 'square',
  ringColor,
  badgeId,
  crop,
  style,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(src || null);
  const [loadedCrop, setLoadedCrop] = useState<PhotoCropData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(photoId && !src));

  useEffect(() => {
    if (src) {
      setBlobUrl(src);
      setIsLoading(false);
      return;
    }

    let active = true;
    let url: string | null = null;

    if (!photoId) {
      setBlobUrl(null);
      setLoadedCrop(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    photoRepository.getById(photoId)
      .then((photo) => {
        if (!active) return;
        if (photo?.blob) {
          url = URL.createObjectURL(photo.blob);
          setBlobUrl(url);
          if (photo.focalX !== undefined || photo.focalY !== undefined || photo.zoom !== undefined) {
            setLoadedCrop({
              focalX: photo.focalX ?? 0.5,
              focalY: photo.focalY ?? 0.5,
              zoom: photo.zoom ?? 1.0,
            });
          }
        } else {
          setBlobUrl(null);
          setLoadedCrop(null);
        }
      })
      .catch(() => {
        if (active) {
          setBlobUrl(null);
          setLoadedCrop(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [photoId, src]);

  const activeCrop = crop || loadedCrop;
  const cropCss = getCropStyle(activeCrop);
  const badge = badgeId ? resolveBadge(badgeId) : null;
  const effectiveRingColor = ringColor || (badge ? badge.hex : undefined);

  // If circular mode with character badge frame
  if (mode === 'circle' && badge) {
    return (
      <div
        className={`cat-photo-badge-wrap ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {/* Inner Circular Avatar */}
        <div
          style={{
            position: 'absolute',
            width: '74%',
            height: '74%',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: 'var(--color-surface)',
            boxShadow: `0 2px 6px ${badge.hex}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>...</span>
          ) : blobUrl ? (
            <img
              src={blobUrl}
              alt={alt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                pointerEvents: 'none',
                ...cropCss,
              }}
            />
          ) : (
            <Footprints size={20} style={{ color: badge.hex }} />
          )}
        </div>

        {/* Decorative Character PNG Frame Overlay */}
        <img
          src={badge.assetPath}
          alt={badge.nickname}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 2,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(mode === 'circle'
      ? {
          borderRadius: '50%',
          aspectRatio: '1 / 1',
          border: effectiveRingColor ? `3px solid ${effectiveRingColor}` : '3px solid var(--color-primary)',
          boxShadow: effectiveRingColor ? `0 2px 8px ${effectiveRingColor}44` : 'var(--shadow-subtle)',
        }
      : {
          aspectRatio: aspectRatio || '1 / 1',
        }),
    ...style,
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
    ...cropCss,
  };

  if (isLoading) {
    return (
      <div
        className={`cat-card-placeholder ${className}`}
        style={containerStyle}
        aria-busy="true"
      >
        <span style={{ fontSize: 'var(--font-size-xs)' }}>Memuat...</span>
      </div>
    );
  }

  if (blobUrl) {
    return (
      <div className={mode === 'circle' ? 'cat-photo-circle-wrap' : 'cat-photo-square-wrap'} style={containerStyle}>
        <img
          src={blobUrl}
          alt={alt}
          className={className}
          style={imageStyle}
        />
      </div>
    );
  }

  return (
    <div
      className={`cat-card-placeholder ${className}`}
      style={containerStyle}
      aria-label="Tidak ada foto"
    >
      <Footprints size={mode === 'circle' ? 22 : 28} style={{ color: effectiveRingColor || 'currentColor' }} />
    </div>
  );
};

