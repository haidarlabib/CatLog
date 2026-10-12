import React, { useState, useEffect } from 'react';
import { Footprints } from 'lucide-react';
import { photoRepository } from '../db';

interface CatPhotoImgProps {
  photoId?: string | null;
  alt: string;
  className?: string;
  aspectRatio?: string;
}

export const CatPhotoImg: React.FC<CatPhotoImgProps> = ({
  photoId,
  alt,
  className = 'cat-card-img',
  aspectRatio,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(photoId));

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    if (!photoId) {
      setBlobUrl(null);
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
        } else {
          setBlobUrl(null);
        }
      })
      .catch(() => {
        if (active) setBlobUrl(null);
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
  }, [photoId]);

  if (isLoading) {
    return (
      <div
        className="cat-card-placeholder"
        style={aspectRatio ? { aspectRatio } : undefined}
        aria-busy="true"
      >
        <span style={{ fontSize: 'var(--font-size-xs)' }}>Loading...</span>
      </div>
    );
  }

  if (blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={alt}
        className={className}
        style={aspectRatio ? { aspectRatio } : undefined}
      />
    );
  }

  return (
    <div
      className="cat-card-placeholder"
      style={aspectRatio ? { aspectRatio } : undefined}
      aria-label="No photo available"
    >
      <Footprints size={28} />
    </div>
  );
};
