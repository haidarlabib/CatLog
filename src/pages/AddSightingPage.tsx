import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  MapPin, 
  Navigation, 
  ArrowLeft, 
  Save, 
  AlertCircle,
  Sliders
} from 'lucide-react';
import { catRepository } from '../db';
import { catService } from '../services/catService';
import { compressImage, validateImageFile, DEFAULT_PHOTO_CROP, type PhotoCropData } from '../utils/image';
import { 
  getCurrentDeviceLocation, 
  reverseGeocode, 
  extractExifGps, 
  isValidCoordinates, 
  type GeoLocationError 
} from '../utils/geo';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import { PhotoCropEditorModal } from '../components/PhotoCropEditorModal';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { getBadgeColorHex } from '../config/catAppearance';
import type { Cat, FoodType } from '../types';

export const AddSightingPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();

  const [cat, setCat] = useState<Cat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Photo State
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoCrop, setPhotoCrop] = useState<PhotoCropData>(DEFAULT_PHOTO_CROP);
  const [showCropModal, setShowCropModal] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<{ width?: number; height?: number; mimeType: string }>({
    mimeType: 'image/jpeg',
  });
  const [setAsCoverPhoto, setSetAsCoverPhoto] = useState(false);

  // Sighting & Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [spottedAt, setSpottedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Feeding State
  const [fedCat, setFedCat] = useState(false);
  const [foodType, setFoodType] = useState<FoodType>('wet_food');
  const [feedingNotes, setFeedingNotes] = useState('');

  // Status & Error States
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Location precedence refs
  const isLocationManuallySet = useRef(false);
  const activeCaptureSourceRef = useRef<'camera' | 'gallery'>('gallery');
  const cameraGpsSnapshotRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const photoGpsRef = useRef<{ latitude: number; longitude: number; source: 'exif' | 'camera_snapshot' } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catId) return;

    catRepository.getById(catId)
      .then((c) => {
        if (!c) {
          setFormError('Kucing tidak ditemukan.');
        } else {
          setCat(c);
        }
      })
      .catch(() => {
        setFormError('Gagal memuat profil kucing.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [catId]);

  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  // Clean up transient previewUrl on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrlRef.current);
        } catch {
          // Safe ignore
        }
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Format berkas tidak valid.');
      return;
    }

    try {
      setFormError(null);

      // 1. Inspect original image for embedded EXIF GPS before compression
      const exifGps = await extractExifGps(file);
      if (exifGps) {
        photoGpsRef.current = {
          latitude: exifGps.latitude,
          longitude: exifGps.longitude,
          source: 'exif',
        };

        if (!isLocationManuallySet.current) {
          setLatitude(exifGps.latitude);
          setLongitude(exifGps.longitude);
          setGeoMessage('Koordinat lokasi diekstrak otomatis dari metadata EXIF foto.');
          setGeoError(null);
          reverseGeocode(exifGps.latitude, exifGps.longitude).then((place) => {
            if (place && !isLocationManuallySet.current) {
              setLocationName(place);
            }
          });
        } else {
          setGeoMessage(
            `Foto memiliki koordinat EXIF (${exifGps.latitude.toFixed(4)}, ${exifGps.longitude.toFixed(4)}), namun pilihan lokasi manual Anda tetap dipertahankan.`
          );
        }
      } else {
        // No EXIF GPS found in image
        if (activeCaptureSourceRef.current === 'camera' && cameraGpsSnapshotRef.current) {
          const snapshot = cameraGpsSnapshotRef.current;
          // Valid if taken within 2 minutes of interaction
          if (Date.now() - snapshot.timestamp < 120000 && isValidCoordinates(snapshot.latitude, snapshot.longitude)) {
            photoGpsRef.current = {
              latitude: snapshot.latitude,
              longitude: snapshot.longitude,
              source: 'camera_snapshot',
            };

            if (!isLocationManuallySet.current) {
              setLatitude(snapshot.latitude);
              setLongitude(snapshot.longitude);
              setGeoMessage('Lokasi dicatat dari snapshot GPS saat tombol kamera dibuka.');
              setGeoError(null);
              reverseGeocode(snapshot.latitude, snapshot.longitude).then((place) => {
                if (place && !isLocationManuallySet.current) {
                  setLocationName(place);
                }
              });
            }
          }
        } else if (activeCaptureSourceRef.current === 'gallery') {
          photoGpsRef.current = null;
          if (latitude === null && longitude === null) {
            setGeoMessage('Foto galeri tanpa metadata GPS EXIF.');
          }
        }
      }

      // 2. Compress image for local IndexedDB storage
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      const newPreview = URL.createObjectURL(compressed.blob);
      setSelectedBlob(compressed.blob);
      setPreviewUrl(newPreview);
      setPhotoCrop({ ...DEFAULT_PHOTO_CROP });
      setShowCropModal(true);
      setPhotoMeta({
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
    } catch {
      setFormError('Gagal memproses berkas foto.');
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedBlob(null);
    setPreviewUrl(null);
    setPhotoCrop({ ...DEFAULT_PHOTO_CROP });
    photoGpsRef.current = null;
  };

  const handleRequestLocation = async () => {
    isLocationManuallySet.current = true;
    setGeoLoading(true);
    setGeoError(null);
    setGeoMessage(null);

    try {
      const pos = await getCurrentDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setGeoMessage(`Koordinat GPS perangkat didapatkan (akurasi: ±${pos.accuracy}m)`);
      reverseGeocode(pos.latitude, pos.longitude).then((place) => {
        if (place) setLocationName(place);
      });
    } catch (err: unknown) {
      const geoErr = err as GeoLocationError;
      setGeoError(geoErr.message || 'Tidak dapat mengambil lokasi perangkat.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const spotDate = new Date(spottedAt);
      const isoSpottedAt = isNaN(spotDate.getTime()) ? new Date().toISOString() : spotDate.toISOString();

      await catService.addSightingToExistingCat({
        catId,
        photoBlob: selectedBlob,
        photoMimeType: photoMeta.mimeType,
        photoWidth: photoMeta.width,
        photoHeight: photoMeta.height,
        focalX: photoCrop.focalX,
        focalY: photoCrop.focalY,
        zoom: photoCrop.zoom,
        photoLatitude: photoGpsRef.current?.latitude ?? null,
        photoLongitude: photoGpsRef.current?.longitude ?? null,
        latitude,
        longitude,
        locationName: locationName.trim() || undefined,
        notes: notes.trim() || undefined,
        spottedAt: isoSpottedAt,
        fedCat,
        foodType: fedCat ? foodType : undefined,
        feedingNotes: fedCat && feedingNotes.trim() ? feedingNotes.trim() : undefined,
        setAsCoverPhoto,
      });

      navigate(`/cats/${catId}`, {
        state: { flashMessage: `Pertemuan baru berhasil dicatat untuk ${cat?.name || 'kucing'}!` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pertemuan.';
      setFormError(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p>Memuat...</p>
      </div>
    );
  }

  return (
    <div className="page-container" id="add-sighting-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 24px)' }}>
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/cats/${catId}`)}
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>
          Catat Pertemuan {cat ? `untuk ${cat.name}` : ''}
        </h1>
        <div style={{ width: 60 }} />
      </div>

      {formError && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="add-sighting-form">
        {/* Photo Selection */}
        <div className="form-group">
          <label className="form-label">
            Foto Pertemuan <span className="form-label-optional">(opsional)</span>
          </label>

          {previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="photo-preview-wrap">
                <CatPhotoImg
                  src={previewUrl}
                  alt="Pratinjau pertemuan"
                  mode="square"
                  crop={photoCrop}
                />
                <div className="photo-preview-overlay">
                  <button
                    type="button"
                    className="photo-preview-btn"
                    onClick={() => setShowCropModal(true)}
                    aria-label="Atur tampilan foto"
                    id="btn-adjust-photo-crop"
                  >
                    <Sliders size={14} />
                    <span>Atur Tampilan</span>
                  </button>
                  <button
                    type="button"
                    className="photo-preview-btn"
                    onClick={() => galleryInputRef.current?.click()}
                    aria-label="Ganti foto"
                  >
                    <ImageIcon size={14} />
                    <span>Ganti</span>
                  </button>
                  <button
                    type="button"
                    className="photo-preview-btn"
                    style={{ backgroundColor: 'rgba(217, 72, 65, 0.85)' }}
                    onClick={handleRemovePhoto}
                    aria-label="Hapus foto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCropModal(true)}
                style={{ alignSelf: 'center', fontSize: 'var(--font-size-xs)', padding: '6px 14px' }}
              >
                <Sliders size={14} />
                <span>Atur Tampilan Foto</span>
              </button>
            </div>
          ) : (
            <div className="photo-picker-row">
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
                onClick={() => {
                  activeCaptureSourceRef.current = 'camera';
                  // Capture fresh GPS snapshot around camera trigger
                  getCurrentDeviceLocation()
                    .then((pos) => {
                      cameraGpsSnapshotRef.current = {
                        latitude: pos.latitude,
                        longitude: pos.longitude,
                        timestamp: Date.now(),
                      };
                    })
                    .catch(() => {});
                  cameraInputRef.current?.click();
                }}
                id="btn-sighting-camera"
              >
                <Camera size={18} />
                <span>Kamera</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
                onClick={() => {
                  activeCaptureSourceRef.current = 'gallery';
                  galleryInputRef.current?.click();
                }}
                id="btn-sighting-gallery"
              >
                <ImageIcon size={18} />
                <span>Galeri</span>
              </button>
            </div>
          )}

          {previewUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', marginTop: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={setAsCoverPhoto}
                onChange={(e) => setSetAsCoverPhoto(e.target.checked)}
              />
              <span>Jadikan foto ini sebagai foto sampul baru untuk {cat?.name || 'kucing'}</span>
            </label>
          )}

          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <input
            type="file"
            ref={galleryInputRef}
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>

        {/* Location Section */}
        <div className="form-group">
          <label className="form-label">
            Lokasi <span className="form-label-optional">(opsional)</span>
          </label>

          <div className="geo-panel">
            <div className="geo-row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={handleRequestLocation}
                disabled={geoLoading}
                id="btn-sighting-gps"
              >
                <Navigation size={14} className={geoLoading ? 'animate-spin' : ''} />
                <span>{geoLoading ? 'Mencari GPS...' : 'Gunakan GPS'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={() => setShowMapPicker(true)}
                id="btn-sighting-pick-map"
              >
                <MapPin size={14} />
                <span>Pilih di Peta</span>
              </button>

              {latitude !== null && longitude !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="geo-badge">
                    <MapPin size={12} />
                    <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: '11px', color: 'var(--color-danger)', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      isLocationManuallySet.current = true;
                      setLatitude(null);
                      setLongitude(null);
                      setGeoMessage(null);
                    }}
                    title="Hapus koordinat"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {geoMessage && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 500 }}>
                {geoMessage}
              </span>
            )}
            {geoError && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                {geoError}
              </span>
            )}

            <input
              type="text"
              className="form-input"
              placeholder="Nama tempat (misal: Dekat perpustakaan)"
              value={locationName}
              onChange={(e) => {
                isLocationManuallySet.current = true;
                setLocationName(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Encounter Date & Time */}
        <div className="form-group">
          <label htmlFor="sighting-spotted-at" className="form-label">
            Waktu Pertemuan
          </label>
          <input
            type="datetime-local"
            id="sighting-spotted-at"
            className="form-input"
            value={spottedAt}
            onChange={(e) => setSpottedAt(e.target.value)}
          />
        </div>

        {/* Feeding status */}
        <div className="form-group">
          <label className="form-label">Apakah Anda memberi makan kucing ini?</label>
          <div className="feeding-toggle-row">
            <button
              type="button"
              className={`feeding-choice-btn ${!fedCat ? 'selected' : ''}`}
              onClick={() => setFedCat(false)}
            >
              Tidak
            </button>
            <button
              type="button"
              className={`feeding-choice-btn ${fedCat ? 'selected' : ''}`}
              onClick={() => setFedCat(true)}
            >
              Ya
            </button>
          </div>

          {fedCat && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`feeding-choice-btn ${foodType === 'wet_food' ? 'selected' : ''}`}
                  onClick={() => setFoodType('wet_food')}
                  style={{ flex: 1 }}
                >
                  Makanan Basah
                </button>
                <button
                  type="button"
                  className={`feeding-choice-btn ${foodType === 'dry_food' ? 'selected' : ''}`}
                  onClick={() => setFoodType('dry_food')}
                  style={{ flex: 1 }}
                >
                  Makanan Kering
                </button>
                <button
                  type="button"
                  className={`feeding-choice-btn ${foodType === 'treat' ? 'selected' : ''}`}
                  onClick={() => setFoodType('treat')}
                  style={{ flex: 1 }}
                >
                  Camilan
                </button>
              </div>

              <input
                type="text"
                className="form-input"
                placeholder="Catatan pakan (opsional, misal: Whiskas Tuna 50g)"
                value={feedingNotes}
                onChange={(e) => setFeedingNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Sighting Notes */}
        <div className="form-group">
          <label htmlFor="sighting-notes" className="form-label">
            Catatan Tambahan <span className="form-label-optional">(opsional)</span>
          </label>
          <textarea
            id="sighting-notes"
            className="form-textarea"
            rows={3}
            placeholder="Bagaimana tingkah kucing saat bertemu? Ada interaksi menarik?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          id="btn-save-sighting"
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Menyimpan Pertemuan...' : 'Simpan Pertemuan'}</span>
        </button>
      </form>

      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng, address: resolvedAddr }) => {
            isLocationManuallySet.current = true;
            setLatitude(lat);
            setLongitude(lng);
            setGeoMessage('Titik koordinat berhasil dipilih di peta.');
            setGeoError(null);
            if (resolvedAddr) {
              setLocationName(resolvedAddr);
            } else {
              reverseGeocode(lat, lng).then((place) => {
                if (place) setLocationName(place);
              });
            }
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {showCropModal && previewUrl && (
        <PhotoCropEditorModal
          imageUrl={previewUrl}
          initialCrop={photoCrop}
          badgeId={cat?.badgeRing}
          badgeRingColor={getBadgeColorHex(cat?.badgeRing)}
          onSave={(newCrop) => setPhotoCrop(newCrop)}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
};
