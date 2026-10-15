import React from 'react';

/**
 * Oyen mascot states for ProwlLog empty/error/loading states.
 * Uses four original character images from karakter/ folder:
 * a.png = Oyen Si Bos (empty catalog)
 * b.png = Oyen Si Penasaran (empty map)
 * c.png = Oyen Ngambek (error)
 * d.png = Oyen Mager (loading)
 */

export type OyenVariant = 'bos' | 'penasaran' | 'ngambek' | 'mager';

const OYEN_ASSETS: Record<OyenVariant, string> = {
  bos: '/mascot/oyen-bos.png',
  penasaran: '/mascot/oyen-penasaran.png',
  ngambek: '/mascot/oyen-ngambek.png',
  mager: '/mascot/oyen-mager.png',
};

interface OyenEmptyStateProps {
  variant: OyenVariant;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  /** Extra className on outer wrapper */
  className?: string;
  /** For map overlay: transparent bg */
  overlay?: boolean;
}

export const OyenEmptyState: React.FC<OyenEmptyStateProps> = ({
  variant,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className,
  overlay,
}) => {
  return (
    <div
      className={`oyen-empty-state ${overlay ? 'oyen-empty-state--overlay' : ''} ${className ?? ''}`}
      id={`oyen-state-${variant}`}
    >
      <div className="oyen-empty-state-card">
        <img
          src={OYEN_ASSETS[variant]}
          alt={`Oyen maskot ProwlLog`}
          className="oyen-mascot-img"
          draggable={false}
        />
        <div className="oyen-text-group">
          <h2 className="oyen-title">{title}</h2>
          {description && <p className="oyen-desc">{description}</p>}
        </div>
        {ctaLabel && onCtaClick && (
          <button
            type="button"
            className="btn-primary"
            onClick={onCtaClick}
            id={`oyen-cta-${variant}`}
          >
            <span>{ctaLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
