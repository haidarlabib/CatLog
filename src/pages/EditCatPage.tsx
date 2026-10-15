import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  ArrowLeft, 
  Camera, 
  Save, 
  AlertCircle,
  Plus,
  X,
  Sparkles,
  Sliders,
  ChevronDown,
  Palette,
  Navigation,
  MapPin
} from 'lucide-react';
import { catRepository, sightingRepository, photoRepository } from '../db';
import { catService } from '../services/catService';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { BadgeSelector } from '../components/BadgeSelector';
import { compressImage, validateImageFile, DEFAULT_PHOTO_CROP, type PhotoCropData } from '../utils/image';
import { PhotoCropEditorModal } from '../components/PhotoCropEditorModal';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import { defaultMapConfig } from '../config/mapConfig';
import { 
  DEFAULT_BADGE_RING, 
  PRESET_COAT_COLORS, 
  PRESET_PATTERNS, 
  BREED_OPTIONS,
  getBadgeColorHex,
  resolveBadge,
  formatAppearanceLabel
} from '../config/catAppearance';
import type { Cat } from '../types';

export const EditCatPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();

  const [cat, setCat] = useState<Cat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Field State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('unknown');
  const [badgeRing, setBadgeRing] = useState<string>(DEFAULT_BADGE_RING);
  const [isAppearanceExpanded, setIsAppearanceExpanded] = useState(false);

  // Appearance chips state
  const [selectedCoatColors, setSelectedCoatColors] = useState<string[]>([]);
  const [customCoatColors, setCustomCoatColors] = useState<string[]>([]);
  const [newCoatInput, setNewCoatInput] = useState('');
  const [showAddCoat, setShowAddCoat] = useState(false);

  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [customPatterns, setCustomPatterns] = useState<string[]>([]);
  const [newPatternInput, setNewPatternInput] = useState('');
  const [showAddPattern, setShowAddPattern] = useState(false);

  const [notes, setNotes] = useState('');

  // Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [isLocationChanged, setIsLocationChanged] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Existing photo preview & crop for mini-map marker
  const [coverPhotoBlobUrl, setCoverPhotoBlobUrl] = useState<string | null>(null);
  const [existingPhotoCrop, setExistingPhotoCrop] = useState<PhotoCropData>(DEFAULT_PHOTO_CROP);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  // New Photo Upload State
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null);
  const [newPhotoCrop, setNewPhotoCrop] = useState<PhotoCropData>(DEFAULT_PHOTO_CROP);
  const [showCropModal, setShowCropModal] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<{ width?: number; height?: number; mimeType: string }>({
    mimeType: 'image/jpeg',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catId) return;

    Promise.all([
      catRepository.getById(catId),
      sightingRepository.getByCatId(catId),
    ])
      .then(async ([c, sightings]) => {
        if (!c) {
          setErrorMsg('Profil kucing tidak ditemukan.');
          setIsLoading(false);
          return;
        }
        setCat(c);
        setName(c.name);
        setBreed(c.breed || 'unknown');
        const resolvedBadge = resolveBadge(c.badgeRing);
        setBadgeRing(resolvedBadge.id);

        // Populate coat colors
        const colors = c.coatColors || [];
        setSelectedCoatColors(colors);
        const presetColorIds = PRESET_COAT_COLORS.map((pc) => pc.id.toLowerCase());
        const customColors = colors.filter((color) => !presetColorIds.includes(color.toLowerCase()));
        setCustomCoatColors(customColors);

        // Populate patterns
        const pats = c.patterns || [];
        setSelectedPatterns(pats);
        const presetPatternIds = PRESET_PATTERNS.map((pp) => pp.id.toLowerCase());
        const customPats = pats.filter((pattern) => !presetPatternIds.includes(pattern.toLowerCase()));
        setCustomPatterns(customPats);

        setNotes(c.notes || '');

        // Populate location from latest sighting
        if (sightings.length > 0 && sightings[0].latitude !== null && sightings[0].longitude !== null) {
          setLatitude(sightings[0].latitude);
          setLongitude(sightings[0].longitude);
          setLocationName(sightings[0].locationName || '');
        }

        // Load cover photo blob for marker preview
        if (c.coverPhotoId) {
          try {
            const photo = await photoRepository.getById(c.coverPhotoId);
            if (photo?.blob) {
              const url = URL.createObjectURL(photo.blob);
              setCoverPhotoBlobUrl(url);
              if (photo.focalX !== undefined || photo.focalY !== undefined || photo.zoom !== undefined) {
                setExistingPhotoCrop({
                  focalX: photo.focalX ?? 0.5,
                  focalY: photo.focalY ?? 0.5,
                  zoom: photo.zoom ?? 1.0,
                });
              }
            }
          } catch {
            // Handle photo load error silently
          }
        }
      })
      .catch(() => {
        setErrorMsg('Gagal memuat profil untuk diedit.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [catId]);

  // Clean up Object URLs
  useEffect(() => {
    return () => {
      if (newPreviewUrl && newPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newPreviewUrl);
      }
      if (coverPhotoBlobUrl && coverPhotoBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPhotoBlobUrl);
      }
    };
  }, [newPreviewUrl, coverPhotoBlobUrl]);

  // Mini-map Leaflet Effect for Location Preview
  useEffect(() => {
    if (latitude === null || longitude === null || !mapContainerRef.current) return;

    const badge = resolveBadge(badgeRing);
    const activePhotoUrl = newPreviewUrl || coverPhotoBlobUrl;
    const activeCrop = newPreviewUrl ? newPhotoCrop : existingPhotoCrop;

    const focalX = activeCrop.focalX ?? 0.5;
    const focalY = activeCrop.focalY ?? 0.5;
    const zoom = activeCrop.zoom ?? 1.0;
    const objectPosition = `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
    const transform = zoom > 1.001 ? `transform: scale(${zoom.toFixed(2)}); transform-origin: ${objectPosition};` : '';

    const photoContent = activePhotoUrl
      ? `<img src="${activePhotoUrl}" alt="Marker Foto" style="width: 100%; height: 100%; object-fit: cover; object-position: ${objectPosition}; ${transform}" />`
      : `<div class="fallback-icon" style="color: ${badge.hex};"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-9 4c-3 0-5 2-5 5 0 2 2 3 5 3s5-1 5-3c0-3-2-5-5-5z"/></svg></div>`;

    const cal = badge.calibration;

    const customIcon = L.divIcon({
      className: 'cat-map-marker-container',
      html: `
        <div class="cat-photo-marker-pin selected">
          <div class="cat-photo-marker-frame-wrap">
            <div class="cat-photo-marker-inner-circle" style="width: ${cal.photoDiameter}%; height: ${cal.photoDiameter}%; top: ${cal.photoCenterY}%; left: ${cal.photoCenterX}%;">
              ${photoContent}
            </div>
            <img class="cat-photo-marker-badge-img" src="${badge.assetPath}" alt="${badge.nickname}" style="transform: scale(${cal.frameScale});" />
          </div>
          <div class="cat-photo-marker-arrow" style="border-top-color: ${badge.hex};"></div>
        </div>
      `,
      iconSize: [52, 57],
      iconAnchor: [26, 57],
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });

      L.tileLayer(defaultMapConfig.tileProvider.url, {
        maxZoom: defaultMapConfig.tileProvider.maxZoom,
        maxNativeZoom: defaultMapConfig.tileProvider.maxNativeZoom ?? 18,
        subdomains: defaultMapConfig.tileProvider.subdomains || ['a', 'b', 'c', 'd'],
      }).addTo(map);

      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
      markerInstanceRef.current = marker;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([latitude, longitude], 17);
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([latitude, longitude]);
        markerInstanceRef.current.setIcon(customIcon);
      }
    }

    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [latitude, longitude, badgeRing, newPreviewUrl, newPhotoCrop, coverPhotoBlobUrl, existingPhotoCrop]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const val = validateImageFile(file);
    if (!val.valid) {
      setErrorMsg(val.error || 'Format berkas tidak valid.');
      return;
    }

    try {
      setErrorMsg(null);
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });

      if (newPreviewUrl && newPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newPreviewUrl);
      }

      const url = URL.createObjectURL(compressed.blob);
      setSelectedBlob(compressed.blob);
      setNewPreviewUrl(url);
      setNewPhotoCrop({ ...DEFAULT_PHOTO_CROP });
      setShowCropModal(true);
      setPhotoMeta({
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
    } catch {
      setErrorMsg('Gagal memproses gambar foto.');
    }
  };

  const toggleCoatColor = (colorId: string) => {
    setSelectedCoatColors((prev) =>
      prev.includes(colorId) ? prev.filter((c) => c !== colorId) : [...prev, colorId]
    );
  };

  const handleAddCustomCoat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCoatInput.trim();
    if (!clean) return;

    if (!selectedCoatColors.includes(clean)) {
      setSelectedCoatColors((prev) => [...prev, clean]);
    }
    if (!customCoatColors.includes(clean)) {
      setCustomCoatColors((prev) => [...prev, clean]);
    }
    setNewCoatInput('');
    setShowAddCoat(false);
  };

  const handleRemoveCustomCoat = (color: string) => {
    setSelectedCoatColors((prev) => prev.filter((c) => c !== color));
    setCustomCoatColors((prev) => prev.filter((c) => c !== color));
  };

  const togglePattern = (patternId: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(patternId) ? prev.filter((p) => p !== patternId) : [...prev, patternId]
    );
  };

  const handleAddCustomPattern = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPatternInput.trim();
    if (!clean) return;

    if (!selectedPatterns.includes(clean)) {
      setSelectedPatterns((prev) => [...prev, clean]);
    }
    if (!customPatterns.includes(clean)) {
      setCustomPatterns((prev) => [...prev, clean]);
    }
    setNewPatternInput('');
    setShowAddPattern(false);
  };

  const handleRemoveCustomPattern = (pat: string) => {
    setSelectedPatterns((prev) => prev.filter((p) => p !== pat));
    setCustomPatterns((prev) => prev.filter((p) => p !== pat));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Nama kucing wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await catService.updateCatProfile(catId, {
        name: cleanName,
        breed,
        badgeRing,
        coatColors: selectedCoatColors,
        patterns: selectedPatterns,
        notes: notes.trim() || undefined,
        newPhotoBlob: selectedBlob,
        newPhotoMimeType: photoMeta.mimeType,
        newPhotoWidth: photoMeta.width,
        newPhotoHeight: photoMeta.height,
        newPhotoFocalX: newPhotoCrop.focalX,
        newPhotoFocalY: newPhotoCrop.focalY,
        newPhotoZoom: newPhotoCrop.zoom,
        ...(isLocationChanged ? {
          latitude,
          longitude,
          locationName: locationName.trim() || undefined,
        } : {}),
      });

      navigate(`/cats/${catId}`, {
        state: { flashMessage: 'Profil kucing berhasil diperbarui!' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil kucing.';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p>Memuat form edit...</p>
      </div>
    );
  }

  return (
    <div className="page-container" id="edit-cat-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 32px)' }}>
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/cats/${catId}`)}
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={16} />
          <span>Batal</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>Edit Profil Kucing</h1>
        <div style={{ width: 60 }} />
      </div>

      {errorMsg && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="edit-cat-form" style={{ gap: 'var(--space-4)' }}>
        {/* Foto Sampul */}
        <div className="form-group">
          <label className="form-label">Foto Sampul</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 90, height: 90, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0 }}>
              {newPreviewUrl ? (
                <CatPhotoImg src={newPreviewUrl} alt="Pratinjau sampul baru" crop={newPhotoCrop} />
              ) : (
                <CatPhotoImg photoId={cat?.coverPhotoId} alt="Foto sampul saat ini" />
              )}
            </div>
            <div style={{ width: 90, height: 90, position: 'relative', flexShrink: 0 }}>
              {newPreviewUrl ? (
                <CatPhotoImg src={newPreviewUrl} alt="Pratinjau badge" mode="circle" badgeId={badgeRing} crop={newPhotoCrop} />
              ) : (
                <CatPhotoImg photoId={cat?.coverPhotoId} alt="Pratinjau badge" mode="circle" badgeId={badgeRing} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={() => fileInputRef.current?.click()}
                id="btn-change-cover-photo"
              >
                <Camera size={14} />
                <span>Unggah Foto Baru</span>
              </button>
              {newPreviewUrl && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 10px' }}
                  onClick={() => setShowCropModal(true)}
                  id="btn-edit-cover-crop"
                >
                  <Sliders size={13} />
                  <span>Atur Tampilan</span>
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Lokasi Kucing Preview & Edit Panel */}
        <div className="preview-panel-card preview-panel-location" id="edit-cat-location-panel" style={{ width: '100%' }}>
          <div className="preview-panel-header">
            <span className="preview-panel-title">
              <MapPin size={13} style={{ color: 'var(--color-primary)' }} />
              <span>Lokasi Kucing</span>
            </span>
            {latitude !== null && longitude !== null && (
              <button
                type="button"
                className="btn-secondary preview-panel-action"
                onClick={() => setShowMapPicker(true)}
                id="btn-change-location"
                title="Ubah titik lokasi di peta"
              >
                <MapPin size={12} />
                <span>Ubah Lokasi</span>
              </button>
            )}
          </div>

          <div className="preview-location-body">
            {latitude !== null && longitude !== null ? (
              <>
                <div className="preview-mini-map-wrap">
                  <div ref={mapContainerRef} className="preview-mini-map" id="edit-cat-mini-map" />
                </div>
                <div className="preview-location-address-row">
                  <Navigation size={12} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                  <span className="preview-location-address-text">
                    {locationName ? (
                      <span>{locationName}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>Alamat belum tersedia</span>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="preview-location-empty-box" id="location-fallback-box">
                <MapPin size={22} style={{ color: 'var(--color-primary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Lokasi belum ditentukan
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    Belum ada data koordinat untuk kucing ini
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-primary preview-panel-action"
                  onClick={() => setShowMapPicker(true)}
                  id="btn-pick-on-map"
                  style={{ width: 'auto' }}
                >
                  <MapPin size={12} />
                  <span>Tentukan Lokasi di Peta</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nama Kucing */}
        <div className="form-group">
          <label htmlFor="edit-cat-name" className="form-label">
            Nama Kucing <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="edit-cat-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Ras / Jenis */}
        <div className="form-group">
          <label htmlFor="edit-cat-breed" className="form-label">
            Ras / Jenis
          </label>
          <select
            id="edit-cat-breed"
            className="form-select"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            {BREED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Colour Badge */}
        <div className="form-group" id="edit-colour-badge-group">
          <h2 className="form-section-header">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Colour Badge</span>
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', marginLeft: '2px' }}>*</span>
          </h2>

          <BadgeSelector
            selectedBadgeId={badgeRing}
            onSelect={(id) => setBadgeRing(id)}
            photoUrl={newPreviewUrl}
            photoId={!newPreviewUrl ? cat?.coverPhotoId : undefined}
            crop={newPreviewUrl ? newPhotoCrop : undefined}
          />
        </div>

        {/* Warna & Pola Bulu (Opsional - Collapsible) */}
        <div className="form-group" id="edit-collapsible-appearance-group">
          <div className={`collapsible-appearance-card ${isAppearanceExpanded ? 'open' : ''}`}>
            <button
              type="button"
              className="collapsible-appearance-trigger"
              onClick={() => setIsAppearanceExpanded((prev) => !prev)}
              aria-expanded={isAppearanceExpanded}
              id="btn-edit-toggle-appearance"
            >
              <div className="collapsible-appearance-left">
                <span className="collapsible-appearance-title">
                  <Palette size={16} style={{ color: 'var(--color-primary)' }} />
                  <span>Warna & Pola Bulu (Opsional)</span>
                </span>
                {!isAppearanceExpanded && (selectedCoatColors.length > 0 || selectedPatterns.length > 0) && (
                  <span className="collapsible-appearance-summary">
                    {[
                      selectedCoatColors.map((c) => formatAppearanceLabel(c)).join(', '),
                      selectedPatterns.map((p) => formatAppearanceLabel(p)).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                )}
              </div>
              <div className="collapsible-appearance-chevron">
                <ChevronDown size={18} />
              </div>
            </button>

            {isAppearanceExpanded && (
              <div className="collapsible-appearance-body" id="edit-collapsible-appearance-content">
                {/* Subsection: Warna Bulu */}
                <div>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Warna Bulu
                  </label>
                  <div className="chip-group">
                    {PRESET_COAT_COLORS.map((c) => {
                      const isSelected = selectedCoatColors.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleCoatColor(c.id)}
                        >
                          <span>{c.label}</span>
                        </button>
                      );
                    })}

                    {customCoatColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chip-btn selected"
                        onClick={() => toggleCoatColor(c)}
                      >
                        <span>{c}</span>
                        <span
                          className="chip-remove-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomCoat(c);
                          }}
                          title="Hapus pilihan"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    ))}

                    {!showAddCoat ? (
                      <button
                        type="button"
                        className="chip-btn"
                        style={{ borderStyle: 'dashed' }}
                        onClick={() => setShowAddCoat(true)}
                      >
                        <Plus size={13} />
                        <span>Tambah</span>
                      </button>
                    ) : (
                      <form onSubmit={handleAddCustomCoat} className="chip-add-form">
                        <input
                          type="text"
                          className="chip-add-input"
                          placeholder="Warna baru..."
                          value={newCoatInput}
                          onChange={(e) => setNewCoatInput(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="chip-add-submit">
                          OK
                        </button>
                        <button
                          type="button"
                          className="chip-remove-x"
                          onClick={() => {
                            setShowAddCoat(false);
                            setNewCoatInput('');
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Subsection: Pola Bulu */}
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Pola Bulu
                  </label>
                  <div className="chip-group">
                    {PRESET_PATTERNS.map((p) => {
                      const isSelected = selectedPatterns.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePattern(p.id)}
                        >
                          <span>{p.label}</span>
                        </button>
                      );
                    })}

                    {customPatterns.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="chip-btn selected"
                        onClick={() => togglePattern(p)}
                      >
                        <span>{p}</span>
                        <span
                          className="chip-remove-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomPattern(p);
                          }}
                          title="Hapus pola"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    ))}

                    {!showAddPattern ? (
                      <button
                        type="button"
                        className="chip-btn"
                        style={{ borderStyle: 'dashed' }}
                        onClick={() => setShowAddPattern(true)}
                      >
                        <Plus size={13} />
                        <span>Tambah</span>
                      </button>
                    ) : (
                      <form onSubmit={handleAddCustomPattern} className="chip-add-form">
                        <input
                          type="text"
                          className="chip-add-input"
                          placeholder="Pola baru..."
                          value={newPatternInput}
                          onChange={(e) => setNewPatternInput(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="chip-add-submit">
                          OK
                        </button>
                        <button
                          type="button"
                          className="chip-remove-x"
                          onClick={() => {
                            setShowAddPattern(false);
                            setNewPatternInput('');
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Catatan Profil */}
        <div className="form-group">
          <label htmlFor="edit-cat-notes" className="form-label">
            Catatan
          </label>
          <textarea
            id="edit-cat-notes"
            className="form-textarea"
            rows={3}
            placeholder="Ciri khas, sifat, atau kebiasaan kucing ini"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Tombol Simpan */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          id="btn-save-edit"
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}</span>
        </button>
      </form>

      {showCropModal && newPreviewUrl && (
        <PhotoCropEditorModal
          imageUrl={newPreviewUrl}
          initialCrop={newPhotoCrop}
          badgeId={badgeRing}
          badgeRingColor={getBadgeColorHex(badgeRing)}
          onSave={(crop) => setNewPhotoCrop(crop)}
          onClose={() => setShowCropModal(false)}
        />
      )}

      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng, address: resolvedAddr }) => {
            setLatitude(lat);
            setLongitude(lng);
            setIsLocationChanged(true);
            if (resolvedAddr) {
              setLocationName(resolvedAddr);
            }
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

