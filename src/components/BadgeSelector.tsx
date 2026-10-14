import React, { useState, useRef, useEffect } from 'react';
import { Check, Info, X } from 'lucide-react';
import { CHARACTER_BADGES, type CharacterBadge } from '../config/catAppearance';
import { CatPhotoImg } from './CatPhotoImg';
import type { PhotoCropData } from '../utils/image';

export interface BadgeSelectorProps {
  selectedBadgeId: string | null;
  onSelect: (badgeId: string) => void;
  photoUrl?: string | null;
  photoId?: string | null;
  crop?: Partial<PhotoCropData> | null;
}

export const BadgeSelector: React.FC<BadgeSelectorProps> = ({
  selectedBadgeId,
  onSelect,
  photoUrl,
  photoId,
  crop,
}) => {
  // Track which badge tooltip/popover is currently active (if any)
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss tooltip on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTooltipId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltipId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleTooltip = (badgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTooltipId((prev) => (prev === badgeId ? null : badgeId));
  };

  return (
    <div className="colour-badge-section" ref={containerRef} id="colour-badge-section">
      <div className="colour-badge-grid" role="radiogroup" aria-label="Colour Badge Karakter">
        {CHARACTER_BADGES.map((badge: CharacterBadge) => {
          const isSelected = selectedBadgeId?.toLowerCase() === badge.id.toLowerCase();
          const isTooltipOpen = activeTooltipId === badge.id;

          return (
            <div
              key={badge.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              id={`badge-option-${badge.id}`}
              className={`colour-badge-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(badge.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onSelect(badge.id);
                }
              }}
              onMouseEnter={() => {
                // Desktop hover support
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  setActiveTooltipId(badge.id);
                }
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  setActiveTooltipId(null);
                }
              }}
              aria-describedby={`tooltip-${badge.id}`}
            >
              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="badge-card-check" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}

              {/* Accessible Info Trigger Button (for Mobile Tap & Keyboard) */}
              <button
                type="button"
                className={`badge-info-btn ${isTooltipOpen ? 'active' : ''}`}
                onClick={(e) => toggleTooltip(badge.id, e)}
                aria-label={`Lihat deskripsi karakter ${badge.nickname}`}
                title="Info Karakter"
              >
                <Info size={13} />
              </button>

              {/* Character Avatar with Real Transparent PNG Frame */}
              <div className="badge-card-avatar-wrap">
                <CatPhotoImg
                  src={photoUrl}
                  photoId={photoId}
                  alt={`${badge.nickname} frame preview`}
                  mode="circle"
                  badgeId={badge.id}
                  crop={crop}
                />
              </div>

              {/* Nickname & Epithet */}
              <div className="badge-card-info">
                <span className="badge-nickname">{badge.nickname}</span>
                <span className="badge-epithet">{badge.epithet}</span>
              </div>

              {/* Accessible Personality Description Tooltip / Popover */}
              {isTooltipOpen && (
                <div
                  id={`tooltip-${badge.id}`}
                  className="badge-personality-tooltip"
                  role="tooltip"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="tooltip-header">
                    <span className="tooltip-title">
                      {badge.nickname} — {badge.epithet}
                    </span>
                    <button
                      type="button"
                      className="tooltip-close-btn"
                      onClick={(e) => toggleTooltip(badge.id, e)}
                      aria-label="Tutup info"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="tooltip-body">"{badge.description}"</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="colour-badge-helper">
        Pilih badge yang paling cocok dengan karakter kucingmu.
      </p>
    </div>
  );
};
