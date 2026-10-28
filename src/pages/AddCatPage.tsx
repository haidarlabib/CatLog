import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  MapPin, 
  Navigation, 
  ArrowLeft, 
  Save, 
  AlertCircle,
  Plus,
  X,
  Sparkles,
  Camera,
  RefreshCw,
  ChevronDown,
  Palette,
  Crop,
  Star
} from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { catService } from '../services/catService';
import { getCurrentDeviceLocation, reverseGeocode, isValidCoordinates, type GeoLocationError } from '../utils/geo';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import { PhotoCropEditorModal } from '../components/PhotoCropEditorModal';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { BadgeSelector } from '../components/BadgeSelector';
import { catDraftStore } from '../utils/catDraftStore';
import type { PhotoCropData } from '../utils/image';
import { 
  PRESET_COAT_COLORS, 
  PRESET_PATTERNS, 
  BREED_OPTIONS,
  resolveBadge,
  formatAppearanceLabel
} from '../config/catAppearance';

export const AddCatPage: React.FC = () => {
  const navigate = useNavigate();

  // Route & state protection: a valid photo draft is strictly mandatory
  const hasPhoto = catDraftStore.hasPhotoDraft();
  const [photosDraft, setPhotosDraft] = useState(() => catDraftStore.getPhotosDraft());
  const activeCoverPhoto = photosDraft.find((p) => p.isCover) || photosDraft[0] || null;
  const [showCropModal, setShowCropModal] = useState(false);

  const handleSelectCover = (id: string) => {
    catDraftStore.setCoverPhoto(id);
    setPhotosDraft(catDraftStore.getPhotosDraft());
  };

  const handleSaveCrop = (crop: PhotoCropData) => {
    catDraftStore.updateCoverCrop(crop);
    setPhotosDraft(catDraftStore.getPhotosDraft());
    setShowCropModal(false);
  };

  // Restore preserved form draft if returning from "Ganti Foto"
  const formDraft = catDraftStore.getFormDraft();

  // 1. Lokasi State
  const [latitude, setLatitude] = useState<number | null>(() => {
    if (formDraft && formDraft.latitude !== null) return formDraft.latitude;
    if (activeCoverPhoto?.location && isValidCoordinates(activeCoverPhoto.location.latitude, activeCoverPhoto.location.longitude)) {
      return activeCoverPhoto.location.latitude;
    }
    return null;
  });

  const [longitude, setLongitude] = useState<number | null>(() => {
    if (formDraft && formDraft.longitude !== null) return formDraft.longitude;
    if (activeCoverPhoto?.location && isValidCoordinates(activeCoverPhoto.location.latitude, activeCoverPhoto.location.longitude)) {
      return activeCoverPhoto.location.longitude;
    }
    return null;
  });

  const [locationName, setLocationName] = useState<string>(() => formDraft?.locationName || '');
  const [locationSource, setLocationSource] = useState<'gps' | 'manual'>(() => formDraft?.locationSource || 'gps');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // 2. Profil Kucing State
  const [name, setName] = useState(() => formDraft?.name || '');
  const [breed, setBreed] = useState(() => formDraft?.breed || 'unknown');

  // 3. Tampilan: Colour Badge (Wajib dipilih oleh pengguna)
  const [badgeRing, setBadgeRing] = useState<string>(() => formDraft?.badgeRing || '');

  // 4. Tampilan: Warna & Pola Bulu (Opsional & Collapsible)
  const [isAppearanceExpanded, setIsAppearanceExpanded] = useState(false);

  // 4. Tampilan: Warna & Pola Bulu
  const [selectedCoatColors, setSelectedCoatColors] = useState<string[]>(() => formDraft?.coatColors || []);
  const [customCoatColors, setCustomCoatColors] = useState<string[]>([]);
  const [newCoatInput, setNewCoatInput] = useState('');
  const [showAddCoat, setShowAddCoat] = useState(false);

  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(() => formDraft?.patterns || []);
  const [customPatterns, setCustomPatterns] = useState<string[]>([]);
  const [newPatternInput, setNewPatternInput] = useState('');
  const [showAddPattern, setShowAddPattern] = useState(false);

  // 5. Catatan
  const [notes, setNotes] = useState(() => formDraft?.notes || '');

  // Status Form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Leaflet Mini Map Preview refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const hasAutoLocatedRef = useRef(false);

  // Action: Change Photo (Retake) preserving entered form state
  const handleChangePhoto = () => {
    catDraftStore.setFormDraft({
      name,
      breed,
      badgeRing,
      coatColors: selectedCoatColors,
      patterns: selectedPatterns,
      notes,
      latitude,
      longitude,
      locationName,
      locationSource,
    });
    navigate('/cats/new');
  };

  // Resolve location place-name on coordinate change
  const handleLocationResolved = useCallback(async (lat: number, lng: number) => {
    setIsResolvingLocation(true);
    setGeoError(null);
    try {
      const place = await reverseGeocode(lat, lng);
      if (place) {
        setLocationName(place);
      } else {
        setLocationName('');
      }
    } catch {
      setLocationName('');
    } finally {
      setIsResolvingLocation(false);
    }
  }, []);

  // Request GPS
  const handleRequestGPS = useCallback(async () => {
    setGeoLoading(true);
    setGeoError(null);

    try {
      const pos = await getCurrentDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setLocationSource('gps');
      await handleLocationResolved(pos.latitude, pos.longitude);
    } catch (err: unknown) {
      const geoErr = err as GeoLocationError;
      setGeoError(geoErr.message || 'Gagal mendapatkan lokasi dari perangkat.');
    } finally {
      setGeoLoading(false);
    }
  }, [handleLocationResolved]);

  // Automatic GPS request or place-name resolution on mount
  useEffect(() => {
    if (hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;

    if (latitude !== null && longitude !== null && isValidCoordinates(latitude, longitude)) {
      if (!locationName) {
        handleLocationResolved(latitude, longitude);
      }
    } else {
      handleRequestGPS();
    }
  }, [latitude, longitude, locationName, handleLocationResolved, handleRequestGPS]);

  // Update Mini Map Preview whenever coordinates, badgeRing, or crop changes
  useEffect(() => {
    if (latitude === null || longitude === null || !isValidCoordinates(latitude, longitude)) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    const badge = resolveBadge(badgeRing);

    const focalX = activeCoverPhoto?.crop.focalX ?? 0.5;
    const focalY = activeCoverPhoto?.crop.focalY ?? 0.5;
    const zoom = activeCoverPhoto?.crop.zoom ?? 1.0;
    const objectPosition = `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
    const transform = zoom > 1.001 ? `transform: scale(${zoom.toFixed(2)}); transform-origin: ${objectPosition};` : '';

    const photoContent = activeCoverPhoto?.previewUrl
      ? `<img src="${activeCoverPhoto.previewUrl}" alt="Marker Foto" style="width: 100%; height: 100%; object-fit: cover; object-position: ${objectPosition}; ${transform}" />`
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
  }, [latitude, longitude, badgeRing, activeCoverPhoto?.previewUrl, activeCoverPhoto?.crop]);

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

  // Toggle Coat Color Chip
  const toggleCoatColor = (colorId: string) => {
    setSelectedCoatColors((prev) =>
      prev.includes(colorId) ? prev.filter((c) => c !== colorId) : [...prev, colorId]
    );
  };

  // Add Custom Coat Color
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

  // Remove Custom Coat Color
  const handleRemoveCustomCoat = (color: string) => {
    setSelectedCoatColors((prev) => prev.filter((c) => c !== color));
    setCustomCoatColors((prev) => prev.filter((c) => c !== color));
  };

  // Toggle Pattern Chip
  const togglePattern = (patternId: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(patternId) ? prev.filter((p) => p !== patternId) : [...prev, patternId]
    );
  };

  // Add Custom Pattern
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

  // Remove Custom Pattern
  const handleRemoveCustomPattern = (pattern: string) => {
    setSelectedPatterns((prev) => prev.filter((p) => p !== pattern));
    setCustomPatterns((prev) => prev.filter((p) => p !== pattern));
  };

  // If photo draft is missing or invalid, immediately redirect back to camera capture
  if (!hasPhoto || photosDraft.length === 0 || !activeCoverPhoto || !activeCoverPhoto.blob) {
    return <Navigate to="/cats/new" replace />;
  }

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setFormError('Nama kucing wajib diisi.');
      return;
    }

    if (cleanName.length > 15) {
      setFormError('Nama kucing maksimal 15 karakter.');
      return;
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(cleanName)) {
      setFormError('Nama kucing hanya boleh mengandung huruf, angka, dan spasi.');
      return;
    }

    // Validate mandatory character badge
    if (!badgeRing) {
      setFormError('Pilih Colour Badge karakter kucing terlebih dahulu.');
      return;
    }

    // Validate mandatory photo draft
    const currentPhotos = catDraftStore.getPhotosDraft();
    const coverPhoto = catDraftStore.getCoverPhotoDraft();
    if (currentPhotos.length === 0 || !coverPhoto || !coverPhoto.blob || coverPhoto.blob.size === 0) {
      setFormError('Foto kucing wajib diambil terlebih dahulu.');
      navigate('/cats/new', { replace: true });
      return;
    }

    // Validate required valid coordinates
    if (
      latitude === null ||
      longitude === null ||
      !isValidCoordinates(latitude, longitude)
    ) {
      setFormError('Lokasi pertemuan awal kucing wajib ditentukan. Izinkan akses GPS atau gunakan "Pilih di Peta".');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await catService.createCatWithFirstSighting({
        name: cleanName,
        breed,
        badgeRing,
        coatColors: selectedCoatColors,
        patterns: selectedPatterns,
        notes: notes.trim() || undefined,
        latitude,
        longitude,
        locationName: locationName.trim() || undefined,
        photos: currentPhotos.map((p) => ({
          blob: p.blob,
          mimeType: p.blob.type || 'image/jpeg',
          isCover: p.isCover,
          crop: p.crop,
          latitude: p.location?.latitude,
          longitude: p.location?.longitude,
        })),
        photoBlob: coverPhoto.blob,
        photoMimeType: coverPhoto.blob.type || 'image/jpeg',
        focalX: coverPhoto.crop.focalX,
        focalY: coverPhoto.crop.focalY,
        zoom: coverPhoto.crop.zoom,
        photoLatitude: coverPhoto.location?.latitude,
        photoLongitude: coverPhoto.location?.longitude,
        fedCat: false,
      });

      // Clear all temporary drafts on successful save
      catDraftStore.clearAllDrafts();

      navigate(`/cats/${result.cat.id}`, {
        state: { flashMessage: `Profil "${cleanName}" berhasil ditambahkan ke Katalog Kucing!` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan profil kucing.';
      setFormError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container" id="add-cat-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 32px)' }}>
      {/* Header Bar */}
      <div className="page-header-row">
        <button
          type="button"
          className="detail-nav-pill"
          onClick={() => {
            catDraftStore.clearAllDrafts();
            navigate(-1);
          }}
          aria-label="Kembali"
          id="btn-add-cat-back"
        >
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>
        <div style={{ textAlign: 'center' }}>
          <span className="eyebrow-tag" style={{ display: 'block', marginBottom: '2px' }}>ENTRI BARU</span>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>Tambah Kucing</h1>
        </div>
        <div style={{ width: 72 }} />
      </div>

      {formError && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }} role="alert">
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="add-cat-form" style={{ gap: 'var(--space-4)' }}>
        
        {/* Unified Dual-Panel: Foto Profil & Lokasi Kucing Preview */}
        <div className="add-cat-dual-preview" id="add-cat-dual-preview">
          {/* Panel Kiri: Foto Profil Kucing */}
          <div className="preview-panel-card preview-panel-photo">
            <div className="preview-panel-header">
              <span className="preview-panel-title">
                <Camera size={13} style={{ color: 'var(--color-primary)' }} />
                <span>FOTO SAMPUL</span>
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary preview-panel-action"
                  onClick={() => setShowCropModal(true)}
                  id="btn-crop-cover"
                  title="Atur tampilan foto sampul"
                >
                  <Crop size={12} style={{ color: 'var(--color-primary)' }} />
                  <span>Atur</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary preview-panel-action"
                  onClick={handleChangePhoto}
                  id="btn-change-photo"
                  title="Ganti / Tambah foto kucing"
                >
                  <RefreshCw size={12} />
                  <span>Foto</span>
                </button>
              </div>
            </div>

            <div className="preview-photo-body">
              <div className="preview-avatar-wrap">
                <div style={{ width: '96px', height: '96px', borderRadius: 'var(--radius-md, 12px)', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                  <CatPhotoImg
                    src={activeCoverPhoto?.previewUrl}
                    alt="Foto Sampul Kucing"
                    mode="square"
                    crop={activeCoverPhoto?.crop}
                  />
                </div>
              </div>

              {/* Multi-Photo Thumbnails & Cover Selection */}
              {photosDraft.length > 1 && (
                <div className="add-cat-photo-strip" id="add-cat-photo-strip">
                  <span className="add-cat-photo-strip-label">
                    Pilih Sampul ({photosDraft.length} foto):
                  </span>
                  <div className="add-cat-photo-strip-row">
                    {photosDraft.map((p, idx) => {
                      const isCover = p.isCover;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`add-cat-strip-thumb-btn ${isCover ? 'is-cover' : ''}`}
                          onClick={() => handleSelectCover(p.id)}
                          title={isCover ? 'Foto Sampul (Aktif)' : `Jadikan foto ${idx + 1} sebagai sampul`}
                        >
                          <img src={p.previewUrl} alt={`Foto ${idx + 1}`} />
                          {isCover && (
                            <span className="add-cat-strip-cover-pill">
                              <Star size={7} fill="currentColor" />
                              <span>Sampul</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel Kanan: Lokasi Kucing */}
          <div className="preview-panel-card preview-panel-location">
            <div className="preview-panel-header">
              <span className="preview-panel-title">
                <MapPin size={13} style={{ color: 'var(--color-primary)' }} />
                <span>LOKASI PERTAMA</span>
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
              {geoLoading && latitude === null ? (
                <div className="preview-location-empty-box" id="location-loading-indicator">
                  <div className="location-loading-spinner" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Mendeteksi lokasi...</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>Meminta GPS perangkat</span>
                  </div>
                </div>
              ) : latitude !== null && longitude !== null ? (
                <>
                  <div className="preview-mini-map-wrap">
                    <div ref={mapContainerRef} className="preview-mini-map" id="add-cat-mini-map" />
                  </div>
                  <div className="preview-location-address-row">
                    <Navigation size={12} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                    <span className="preview-location-address-text">
                      {isResolvingLocation ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>Mencari alamat...</span>
                      ) : locationName ? (
                        <span>{locationName}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Lokasi belum ditentukan</span>
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
                    {geoError && (
                      <span style={{ fontSize: '10px', color: 'var(--color-danger)', maxWidth: '200px' }}>
                        {geoError}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary preview-panel-action"
                      onClick={handleRequestGPS}
                      disabled={geoLoading}
                      id="btn-retry-gps"
                      title="Coba deteksi GPS lagi"
                    >
                      <Navigation size={12} className={geoLoading ? 'animate-spin' : ''} />
                      <span>GPS</span>
                    </button>
                    <button
                      type="button"
                      className="btn-primary preview-panel-action"
                      onClick={() => setShowMapPicker(true)}
                      id="btn-pick-on-map"
                      style={{ width: 'auto' }}
                    >
                      <MapPin size={12} />
                      <span>Pilih di Peta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* B. Bagian Nama Kucing */}
        <div className="form-group">
          <label htmlFor="cat-name-input" className="form-label">
            Nama Kucing <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="cat-name-input"
            className="form-input"
            placeholder="Masukkan nama kucing"
            value={name}
            maxLength={15}
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15))}
            required
          />
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
            Maks. 15 karakter (hanya huruf, angka, dan spasi)
          </span>
        </div>

        {/* C. Bagian Ras / Jenis */}
        <div className="form-group">
          <label htmlFor="cat-breed-select" className="form-label">
            Ras / Jenis
          </label>
          <select
            id="cat-breed-select"
            className="form-select"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            {BREED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* D. Colour Badge (Wajib) */}
        <div className="form-group" id="colour-badge-group">
          <h2 className="form-section-header">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Colour Badge</span>
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', marginLeft: '2px' }}>*</span>
          </h2>

          <BadgeSelector
            selectedBadgeId={badgeRing}
            onSelect={(id) => setBadgeRing(id)}
            photoUrl={activeCoverPhoto?.previewUrl}
            crop={activeCoverPhoto?.crop}
          />

          {badgeRing ? (() => {
            const activeBadge = resolveBadge(badgeRing);
            return (
              <div className={`selected-badge-feedback-card badge-pastel-${activeBadge.id}`}>
                <div className="selected-badge-feedback-head">
                  <strong>{activeBadge.nickname}</strong>
                  <span aria-hidden="true">·</span>
                  <span>{activeBadge.epithet}</span>
                </div>
                <p className="selected-badge-feedback-desc">{activeBadge.description}</p>
              </div>
            );
          })() : (
            <div className="selected-badge-feedback-empty">
              Ketuk salah satu bingkai di atas untuk menentukan karakter kucing ini.
            </div>
          )}
        </div>

        {/* E. Warna & Pola Bulu (Opsional - Collapsible) */}
        <div className="form-group" id="collapsible-appearance-group">
          <div className={`collapsible-appearance-card ${isAppearanceExpanded ? 'open' : ''}`}>
            <button
              type="button"
              className="collapsible-appearance-trigger"
              onClick={() => setIsAppearanceExpanded((prev) => !prev)}
              aria-expanded={isAppearanceExpanded}
              id="btn-toggle-appearance"
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
              <div className="collapsible-appearance-body" id="collapsible-appearance-content">
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

                    {/* Custom Coat Color Chips */}
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

                    {/* Custom Pattern Chips */}
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

        {/* F. Bagian Catatan */}
        <div className="form-group">
          <label htmlFor="cat-notes-input" className="form-label">
            Catatan
          </label>
          <textarea
            id="cat-notes-input"
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
          className="btn-primary btn-island"
          disabled={
            isSubmitting ||
            !name.trim() ||
            !badgeRing ||
            latitude === null ||
            longitude === null
          }
          id="btn-save-cat"
          style={{ marginTop: 'var(--space-2)' }}
        >
          <span>{isSubmitting ? 'Menyimpan Kucing...' : 'Simpan Kucing'}</span>
          <span className="btn-icon-disk" aria-hidden="true">
            <Save size={15} />
          </span>
        </button>
      </form>

      {/* Map Location Picker Modal */}
      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng, address: resolvedAddr }) => {
            setLatitude(lat);
            setLongitude(lng);
            setLocationSource('manual');
            if (resolvedAddr) {
              setLocationName(resolvedAddr);
            } else {
              handleLocationResolved(lat, lng);
            }
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* Photo Crop Modal - STRICTLY FOR COVER PHOTO ONLY */}
      {showCropModal && activeCoverPhoto && (
        <PhotoCropEditorModal
          imageUrl={activeCoverPhoto.previewUrl}
          initialCrop={activeCoverPhoto.crop}
          saveButtonText="Gunakan Foto Ini"
          cancelButtonText="Batal"
          onSave={handleSaveCrop}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
};
