import React from 'react';
import { CHARACTER_BADGES, type CharacterBadge } from '../config/catAppearance';
import type { PhotoCropData } from '../utils/image';

export interface BadgeSelectorProps {
  selectedBadgeId: string | null;
  onSelect: (badgeId: string) => void;
  /** Retained as optional for backward compatibility with callers */
  photoUrl?: string | null;
  photoId?: string | null;
  crop?: Partial<PhotoCropData> | null;
}

export const BadgeSelector: React.FC<BadgeSelectorProps> = ({
  selectedBadgeId,
  onSelect,
}) => {
  return (
    <div className="colour-badge-section" id="colour-badge-section">
      <div
        className="colour-badge-row"
        role="radiogroup"
        aria-label="Colour Badge"
      >
        {CHARACTER_BADGES.map((badge: CharacterBadge) => {
          const isSelected = selectedBadgeId?.toLowerCase() === badge.id.toLowerCase();
          const cal = badge.calibration;

          return (
            <button
              key={badge.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Badge ${badge.nickname}`}
              id={`badge-option-${badge.id}`}
              className={`colour-badge-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(badge.id)}
            >
              {/* Selected state: Circular green outline */}
              <span className="badge-select-ring" aria-hidden="true" />

              {/* Direct PNG Frame artwork calibrated per-asset */}
              <img
                src={badge.assetPath}
                alt=""
                className="badge-btn-img"
                style={{ transform: `scale(${cal?.frameScale ?? 1.0})` }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
