import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  MapPin,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Star,
  Cat as CatIcon,
  X,
} from 'lucide-react';
import {
  catRepository,
  sightingRepository,
  feedingLogRepository,
  photoRepository,
} from '../db';
import { CatPhotoImg } from '../components/CatPhotoImg';
import {
  formatBreedLabel,
  formatAppearanceLabel,
  resolveBadge,
} from '../config/catAppearance';
import { formatIndonesianDateTime } from '../utils/date';
import { OyenEmptyState } from '../components/OyenEmptyState';
import type { Cat, Sighting, FeedingLog, CatPhoto } from '../types';

export const CatDetailPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [cat, setCat] = useState<Cat | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [photos, setPhotos] = useState<CatPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(
    (location.state as { flashMessage?: string })?.flashMessage || null
  );

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Full-size uncropped photo lightbox state
  const [fullViewIndex, setFullViewIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullViewIndex(null);
    };
    if (fullViewIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullViewIndex]);

  const loadCatData = useCallback(async () => {
    if (!catId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    try {
      const foundCat = await catRepository.getById(catId);
      if (!foundCat) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setCat(foundCat);

      const [sightingsList, feedingList, photosList] = await Promise.all([
        sightingRepository.getByCatId(catId),
        feedingLogRepository.getByCatId(catId),
        photoRepository.getByCatId(catId),
      ]);

      setSightings(sightingsList);
      setFeedingLogs(feedingList);
      setPhotos(photosList);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [catId]);

  useEffect(() => {
    loadCatData();
  }, [loadCatData]);

  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  const handleDelete = async () => {
    if (!catId) return;
    setIsDeleting(true);

    try {
      await catRepository.deleteWithCascade(catId);
      navigate('/catalog', {
        state: {
          flashMessage: `Profil "${cat?.name || 'Kucing'}" dan semua pertemuannya telah dihapus.`,
        },
      });
    } catch {
      alert('Gagal menghapus profil kucing. Silakan coba lagi.');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Order photos: Cover photo first, then remaining photos by createdAt descending
  const orderedPhotos = useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (!cat?.coverPhotoId) return photos;

    const cover = photos.find((p) => p.id === cat.coverPhotoId);
    const others = photos.filter((p) => p.id !== cat.coverPhotoId);

    return cover ? [cover, ...others] : photos;
  }, [photos, cat?.coverPhotoId]);

  const handleSliderScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const scrollLeft = slider.scrollLeft;
    const width = slider.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      setActivePhotoIndex(index);
    }
  };

  const scrollToSlide = (index: number) => {
    const slider = sliderRef.current;
    if (!slider) return;
    const clamped = Math.max(0, Math.min(index, orderedPhotos.length - 1));
    slider.scrollTo({
      left: clamped * slider.clientWidth,
      behavior: 'smooth',
    });
    setActivePhotoIndex(clamped);
  };

  // Pointer drag to swipe on desktop mouse alongside native touch swipe
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = sliderRef.current?.scrollLeft || 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !sliderRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 4) {
      hasMovedRef.current = true;
    }
    sliderRef.current.scrollLeft = startScrollLeftRef.current - dx;
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const slider = sliderRef.current;
    if (!slider) return;
    const width = slider.clientWidth;
    if (width > 0 && hasMovedRef.current) {
      const targetIndex = Math.max(
        0,
        Math.min(Math.round(slider.scrollLeft / width), orderedPhotos.length - 1)
      );
      scrollToSlide(targetIndex);
    }
  };

  if (isLoading) {
    return (
      <div
        className="page-container detail-page-container"
        role="status"
        aria-label="Memuat profil kucing"
      >
        <div className="skeleton-shimmer detail-hero-box" style={{ height: 320 }} />
        <div className="form-card">
          <div className="skeleton-shimmer skeleton-line skeleton-line--title" />
          <div className="skeleton-shimmer skeleton-line skeleton-line--sub" />
          <div className="skeleton-shimmer skeleton-line skeleton-line--meta" />
        </div>
      </div>
    );
  }

  if (notFound || !cat) {
    return (
      <div className="page-container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
        <OyenEmptyState
          variant="ngambek"
          title="Kucing Tidak Ditemukan"
          description="Profil kucing yang Anda cari tidak ada di penyimpanan lokal atau telah dihapus."
          ctaLabel="Kembali ke Katalog"
          onCtaClick={() => navigate('/catalog')}
        />
      </div>
    );
  }

  const latestSighting = sightings.length > 0 ? sightings[0] : null;
  const badge = cat.badgeRing ? resolveBadge(cat.badgeRing) : resolveBadge('oopsie');

  return (
    <div
      className="page-container detail-page-container"
      id="cat-detail-page"
      style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 28px)' }}
    >
      {/* Top Dedicated Navigation Bar */}
      <div className="detail-top-bar">
        <button
          type="button"
          className="btn-secondary detail-nav-pill"
          onClick={() => navigate('/catalog')}
          aria-label="Kembali ke Katalog"
          id="btn-cat-detail-back"
        >
          <ArrowLeft size={15} />
          <span>Katalog</span>
        </button>

        <span className="eyebrow-tag" style={{ margin: 0 }}>
          Profil Kucing
        </span>

        <div className="detail-top-actions">
          <Link
            to={`/cats/${cat.id}/edit`}
            className="btn-secondary detail-icon-btn"
            id="btn-edit-cat"
            aria-label="Edit kucing"
            title="Edit profil"
          >
            <Edit3 size={15} />
          </Link>
          <button
            type="button"
            className="btn-secondary detail-icon-btn detail-icon-btn--danger"
            onClick={() => setShowDeleteModal(true)}
            aria-label="Hapus profil kucing"
            title="Hapus profil"
            id="btn-delete-cat"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Success Feedback Banner */}
      {feedbackMsg && (
        <div className="info-banner" role="status">
          <CheckCircle2 size={16} className="info-banner-icon" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Hero Photo Section: Double-Bezel Gallery Slider */}
      <div className="detail-hero-box detail-gallery-container" id="cat-photo-gallery">
        {orderedPhotos.length > 0 ? (
          <>
            <div
              ref={sliderRef}
              className="detail-gallery-slider"
              onScroll={handleSliderScroll}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {orderedPhotos.map((photo, index) => {
                const isCover = photo.id === cat.coverPhotoId;
                return (
                  <div
                    key={photo.id}
                    className="detail-gallery-slide"
                    onClick={() => {
                      if (!hasMovedRef.current) {
                        setFullViewIndex(index);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Ketuk untuk melihat foto asli penuh tanpa crop"
                  >
                    <CatPhotoImg
                      photoId={photo.id}
                      alt={`Foto ${cat.name} ${index + 1}`}
                      className="detail-hero-img"
                    />

                    {/* Sampul Tag on Cover Slide */}
                    {isCover && orderedPhotos.length > 1 && (
                      <div className="detail-hero-cover-tag">
                        <Star size={10} fill="currentColor" />
                        <span>Sampul</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {orderedPhotos.length > 1 && (
              <>
                {activePhotoIndex > 0 && (
                  <button
                    type="button"
                    className="detail-gallery-edge-btn edge-prev"
                    onClick={() => scrollToSlide(activePhotoIndex - 1)}
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}

                {activePhotoIndex < orderedPhotos.length - 1 && (
                  <button
                    type="button"
                    className="detail-gallery-edge-btn edge-next"
                    onClick={() => scrollToSlide(activePhotoIndex + 1)}
                    aria-label="Foto selanjutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

                <div className="detail-gallery-counter">
                  <span>
                    {activePhotoIndex + 1} / {orderedPhotos.length}
                  </span>
                </div>

                <div className="detail-gallery-dots">
                  {orderedPhotos.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      className={`detail-gallery-dot ${dotIdx === activePhotoIndex ? 'active' : ''}`}
                      onClick={() => scrollToSlide(dotIdx)}
                      aria-label={`Lihat foto ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            className="detail-gallery-slide"
            onClick={() => setFullViewIndex(0)}
            style={{ cursor: 'pointer' }}
            title="Ketuk untuk melihat foto asli penuh tanpa crop"
          >
            <CatPhotoImg
              photoId={cat.coverPhotoId}
              alt={`Foto ${cat.name}`}
              className="detail-hero-img"
            />
          </div>
        )}
      </div>

      {/* Editorial Identity & Attributes Card */}
      <div className="form-card detail-identity-card">
        <div className="detail-identity-top">
          <div>
            <span className={`detail-archetype-pill badge-pastel-${badge.id}`}>
              {badge.nickname} · {badge.epithet}
            </span>
            <h1 className="detail-cat-name">{cat.name}</h1>
          </div>
          <span className="brand-badge tabular-nums">
            <MapPin size={11} />
            <span>{sightings.length} pertemuan</span>
          </span>
        </div>

        <div className="detail-badge-row">
          {cat.breed && cat.breed !== 'unknown' && (
            <span className="detail-tag">{formatBreedLabel(cat.breed)}</span>
          )}
          {cat.coatColors && cat.coatColors.length > 0 && (
            <span className="detail-tag detail-tag-accent">
              {cat.coatColors.map(formatAppearanceLabel).join(', ')}
            </span>
          )}
          {cat.patterns && cat.patterns.length > 0 && (
            <span className="detail-tag">
              {cat.patterns.map(formatAppearanceLabel).join(', ')}
            </span>
          )}
        </div>

        {cat.notes && <blockquote className="detail-notes-quote">{cat.notes}</blockquote>}

        <p className="detail-personality-caption">{badge.description}</p>

        {/* Latest Encounter Summary */}
        {latestSighting && (
          <div className="detail-latest-strip">
            <button
              type="button"
              className="detail-latest-loc-btn"
              onClick={() => {
                navigate('/', {
                  state: {
                    focusLat: latestSighting.latitude,
                    focusLng: latestSighting.longitude,
                    focusSightingId: latestSighting.id,
                  },
                });
              }}
              title="Lihat di peta MyWorld"
              aria-label={`Buka lokasi ${latestSighting.locationName || 'pertemuan'} di peta MyWorld`}
            >
              <MapPin size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>{latestSighting.locationName || 'Lokasi tercatat'}</span>
            </button>
            <span className="detail-latest-time tabular-nums">
              Terakhir: {formatIndonesianDateTime(latestSighting.spottedAt)}
            </span>
          </div>
        )}

        {/* Primary Button-in-Button Island CTA */}
        <Link
          to={`/cats/${cat.id}/sightings/new`}
          className="btn-primary btn-island"
          id="btn-add-sighting-cta"
          style={{ width: '100%', marginTop: 'var(--space-1)' }}
        >
          <span>Catat Pertemuan Baru</span>
          <span className="btn-icon-disk" aria-hidden="true">
            <Plus size={16} />
          </span>
        </Link>
      </div>

      {/* Encounter History Timeline */}
      <div className="timeline-card" id="cat-encounter-history">
        <div className="section-header-inline">
          <h2 className="section-card-title">
            <CatIcon size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Riwayat Ketemuan</span>
          </h2>
          <span className="section-count-pill tabular-nums">{sightings.length}</span>
        </div>

        {sightings.length > 0 ? (
          <div className="timeline-list" id="sightings-list">
            {sightings.map((sighting) => {
              const formattedDate = formatIndonesianDateTime(sighting.spottedAt);

              return (
                <div
                  key={sighting.id}
                  className="timeline-item"
                  id={`sighting-item-${sighting.id}`}
                >
                  {sighting.photoId ? (
                    <div className="timeline-thumb">
                      <CatPhotoImg
                        photoId={sighting.photoId}
                        alt="Foto pertemuan kucing"
                        className="timeline-thumb"
                      />
                    </div>
                  ) : (
                    <div
                      className="timeline-thumb timeline-thumb-placeholder"
                      aria-label="Tidak ada foto"
                    >
                      <Camera size={20} style={{ opacity: 0.45 }} />
                    </div>
                  )}
                  <div className="timeline-item-content">
                    <span className="timeline-date tabular-nums">{formattedDate}</span>
                    {sighting.locationName && (
                      <button
                        type="button"
                        className="timeline-location-btn"
                        onClick={() => {
                          navigate('/', {
                            state: {
                              focusLat: sighting.latitude,
                              focusLng: sighting.longitude,
                              focusSightingId: sighting.id,
                            },
                          });
                        }}
                        title="Lihat di peta MyWorld"
                        aria-label={`Buka lokasi ${sighting.locationName} di peta MyWorld`}
                      >
                        <MapPin size={11} />
                        <span>{sighting.locationName}</span>
                      </button>
                    )}
                    {sighting.notes && <p className="timeline-notes">{sighting.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Belum ada riwayat pertemuan.
          </p>
        )}
      </div>

      {/* Feeding History Section */}
      {feedingLogs.length > 0 && (
        <div className="timeline-card">
          <div className="section-header-inline">
            <div>
              <span className="eyebrow-tag">Catatan Nutrisi</span>
              <h2 className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Utensils size={15} style={{ color: 'var(--color-primary)' }} />
                <span>Riwayat Pemberian Makan</span>
              </h2>
            </div>
            <span className="section-count-pill tabular-nums">{feedingLogs.length}</span>
          </div>

          <div className="feeding-log-list">
            {feedingLogs.map((log) => {
              const foodName =
                log.foodType === 'wet_food'
                  ? 'Makanan Basah'
                  : log.foodType === 'dry_food'
                  ? 'Makanan Kering'
                  : log.foodType === 'treat'
                  ? 'Camilan'
                  : 'Lainnya';
              return (
                <div key={log.id} className="feeding-log-row">
                  <div className="feeding-log-left">
                    <span className="feeding-type-pill">{foodName}</span>
                    {log.notes && <span className="feeding-log-note">{log.notes}</span>}
                  </div>
                  <span className="feeding-log-time tabular-nums">
                    {new Date(log.fedAt).toLocaleDateString('id-ID', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)' }}>
              <div className="settings-icon-box danger" style={{ width: 36, height: 36 }}>
                <AlertTriangle size={18} />
              </div>
              <h3 id="modal-title" style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
                Hapus Profil Kucing?
              </h3>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              Apakah Anda yakin ingin menghapus <strong>{cat.name}</strong> secara permanen?
              Tindakan ini akan menghapus semua {sightings.length} pertemuan, foto, dan catatan
              makanan yang terkait dari penyimpanan lokal Anda.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
                id="btn-confirm-delete"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Modal Foto Asli Penuh Tanpa Crop */}
      {fullViewIndex !== null && (
        <div
          className="photo-lightbox-backdrop"
          onClick={() => setFullViewIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Lihat foto penuh tanpa crop"
        >
          <div className="photo-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <span className="photo-lightbox-counter">
              {orderedPhotos.length > 0 ? `${fullViewIndex + 1} / ${orderedPhotos.length}` : '1 / 1'}
            </span>
            <button
              type="button"
              className="photo-lightbox-close-btn"
              onClick={() => setFullViewIndex(null)}
              aria-label="Tutup foto penuh"
              id="btn-close-lightbox"
            >
              <X size={20} />
            </button>
          </div>

          <div className="photo-lightbox-body" onClick={(e) => e.stopPropagation()}>
            {orderedPhotos.length > 0 && orderedPhotos[fullViewIndex] ? (
              <CatPhotoImg
                photoId={orderedPhotos[fullViewIndex].id}
                alt={`Foto asli ${cat.name}`}
                crop={{ zoom: 1.0, focalX: 0.5, focalY: 0.5 }}
                className="photo-lightbox-img"
              />
            ) : (
              <CatPhotoImg
                photoId={cat.coverPhotoId}
                alt={`Foto asli ${cat.name}`}
                crop={{ zoom: 1.0, focalX: 0.5, focalY: 0.5 }}
                className="photo-lightbox-img"
              />
            )}

            {orderedPhotos.length > 1 && (
              <>
                {fullViewIndex > 0 && (
                  <button
                    type="button"
                    className="photo-lightbox-nav photo-lightbox-prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullViewIndex(fullViewIndex - 1);
                    }}
                    aria-label="Foto sebelumnya"
                    id="btn-lightbox-prev"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}
                {fullViewIndex < orderedPhotos.length - 1 && (
                  <button
                    type="button"
                    className="photo-lightbox-nav photo-lightbox-next"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullViewIndex(fullViewIndex + 1);
                    }}
                    aria-label="Foto selanjutnya"
                    id="btn-lightbox-next"
                  >
                    <ChevronRight size={22} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
