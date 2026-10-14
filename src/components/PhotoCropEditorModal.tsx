import React, { useState, useRef } from 'react';
import { X, RotateCcw, ZoomIn, ZoomOut, Move, Check } from 'lucide-react';
import { CatPhotoImg } from './CatPhotoImg';
import { clampCrop, DEFAULT_PHOTO_CROP, type PhotoCropData } from '../utils/image';
import { resolveBadge } from '../config/catAppearance';

interface PhotoCropEditorModalProps {
  imageUrl: string;
  initialCrop?: Partial<PhotoCropData> | null;
  badgeRingColor?: string;
  badgeId?: string;
  saveButtonText?: string;
  cancelButtonText?: string;
  onSave: (crop: PhotoCropData) => void;
  onClose: () => void;
}

export const PhotoCropEditorModal: React.FC<PhotoCropEditorModalProps> = ({
  imageUrl,
  initialCrop,
  badgeRingColor = '#D96B43',
  badgeId,
  saveButtonText = 'Simpan Foto',
  cancelButtonText = 'Batal',
  onSave,
  onClose,
}) => {
  const resolvedBadge = resolveBadge(badgeId || badgeRingColor);
  const [crop, setCrop] = useState<PhotoCropData>(() => clampCrop(initialCrop));
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    focalX: number;
    focalY: number;
  } | null>(null);

  const interactiveBoxRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = interactiveBoxRef.current;
    if (!box) return;

    box.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focalX: crop.focalX,
      focalY: crop.focalY,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    const box = interactiveBoxRef.current;
    if (!box) return;

    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Moving mouse/touch to right should move image right, which shifts focal point to the left
    const dx = (e.clientX - dragStartRef.current.startX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.startY) / rect.height;

    const sensitivity = 1.0 / crop.zoom;
    const nextFocalX = dragStartRef.current.focalX - dx * sensitivity;
    const nextFocalY = dragStartRef.current.focalY - dy * sensitivity;

    setCrop((prev) => clampCrop({
      ...prev,
      focalX: nextFocalX,
      focalY: nextFocalY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current && dragStartRef.current.pointerId === e.pointerId) {
      try {
        interactiveBoxRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      dragStartRef.current = null;
      setIsDragging(false);
    }
  };

  const handleReset = () => {
    setCrop({ ...DEFAULT_PHOTO_CROP });
  };

  const handleSave = () => {
    onSave(clampCrop(crop));
    onClose();
  };

  return (
    <div className="modal-backdrop" id="photo-crop-modal" role="dialog" aria-modal="true">
      <div className="modal-dialog" style={{ maxWidth: '440px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Move size={18} color="var(--color-primary)" />
            <h2 className="modal-title" style={{ fontSize: 'var(--font-size-md)' }}>Atur Tampilan Foto</h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Main Interactive Touch/Drag Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Sesuaikan Posisi
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Kembalikan ke posisi awal"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>

            <div
              ref={interactiveBoxRef}
              className="crop-interactive-viewport"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: 'var(--color-surface-subtle)',
                border: isDragging ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                touchAction: 'none',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              <CatPhotoImg
                src={imageUrl}
                alt="Pengaturan fokus foto"
                mode="square"
                crop={crop}
                style={{ width: '100%', height: '100%' }}
              />

              {/* Subtle focal crosshair badge */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '1.5px dashed rgba(255, 255, 255, 0.75)',
                    borderRadius: '50%',
                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)',
                  }}
                />
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(26, 23, 20, 0.72)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Geser untuk mengarahkan fokus
              </div>
            </div>
          </div>

          {/* Zoom Control Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ZoomIn size={13} />
                <span>Zoom</span>
              </span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {crop.zoom.toFixed(1)}x
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ZoomOut size={14} color="var(--color-text-muted)" />
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={crop.zoom}
                onChange={(e) => setCrop((prev) => clampCrop({ ...prev, zoom: parseFloat(e.target.value) }))}
                style={{ flex: 1, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <ZoomIn size={14} color="var(--color-text-muted)" />
            </div>
          </div>

          {/* Two Synchronized Preview Panels */}
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Hasil Tampilan
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* 1. Pratinjau Profil */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '10px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Pratinjau Profil
                </span>
                <div style={{ width: '84px', height: '84px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <CatPhotoImg
                    src={imageUrl}
                    alt="Pratinjau Profil"
                    mode="square"
                    crop={crop}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Rasio 1:1</span>
              </div>

              {/* 2. Pratinjau Peta */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '10px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Pratinjau Peta
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px' }}>
                    <CatPhotoImg
                      src={imageUrl}
                      alt="Pratinjau Peta"
                      mode="circle"
                      ringColor={resolvedBadge.hex}
                      badgeId={badgeId || resolvedBadge.id}
                      crop={crop}
                    />
                  </div>
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: `6px solid ${resolvedBadge.hex}`,
                      marginTop: '-2px',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Marker Lingkaran</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ marginTop: '14px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            style={{ flex: 1 }}
            id="btn-save-crop"
          >
            <Check size={16} />
            <span>{saveButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
