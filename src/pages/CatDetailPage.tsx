import React, { useState, useEffect, useCallback } from 'react';
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
  Camera
} from 'lucide-react';
import { 
  catRepository, 
  sightingRepository, 
  feedingLogRepository 
} from '../db';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { formatBreedLabel, formatAppearanceLabel, resolveBadge } from '../config/catAppearance';
import { formatIndonesianDateTime } from '../utils/date';
import { OyenEmptyState } from '../components/OyenEmptyState';
import type { Cat, Sighting, FeedingLog } from '../types';

export const CatDetailPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [cat, setCat] = useState<Cat | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(
    (location.state as { flashMessage?: string })?.flashMessage || null
  );

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

      // Load sightings and feeding logs in parallel
      const [sightingsList, feedingList] = await Promise.all([
        sightingRepository.getByCatId(catId),
        feedingLogRepository.getByCatId(catId),
      ]);

      setSightings(sightingsList);
      setFeedingLogs(feedingList);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [catId]);

  useEffect(() => {
    loadCatData();
  }, [loadCatData]);

  // Clear flash message after 4s
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
        state: { flashMessage: `Profil "${cat?.name || 'Kucing'}" dan semua pertemuannya telah dihapus.` },
      });
    } catch {
      alert('Gagal menghapus profil kucing. Silakan coba lagi.');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--color-text-muted)' }}>
        <div
          className="spin"
          style={{
            width: 28,
            height: 28,
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            margin: '0 auto var(--space-3)',
          }}
          role="status"
          aria-label="Memuat profil kucing"
        />
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
  const badge = cat.badgeRing ? resolveBadge(cat.badgeRing) : null;

  return (
    <div className="page-container" id="cat-detail-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 24px)' }}>
      {/* Top Header Navigation */}
      <div className="page-header-row" style={{ alignItems: 'center' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/catalog')}
          aria-label="Kembali ke Katalog"
          style={{ padding: '6px 12px' }}
          id="btn-cat-detail-back"
        >
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>

        <h1 className="page-title" style={{ fontSize: 'var(--font-size-md)', margin: 0, fontWeight: 700 }}>
          Detail Kucing
        </h1>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            to={`/cats/${cat.id}/edit`}
            className="btn-secondary"
            style={{ padding: '6px 10px' }}
            id="btn-edit-cat"
            aria-label="Edit kucing"
          >
            <Edit3 size={15} />
          </Link>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '6px 10px', color: 'var(--color-danger)' }}
            onClick={() => setShowDeleteModal(true)}
            aria-label="Hapus profil kucing"
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

      {/* Hero Photo Card with Badge Stamp */}
      <div className="detail-hero-box" id="cat-cover-photo">
        <CatPhotoImg
          photoId={cat.coverPhotoId}
          alt={`Foto ${cat.name}`}
          className="detail-hero-img"
        />
        {badge && (
          <div className="detail-hero-badge-stamp" title={`Badge: ${badge.nickname}`}>
            <img
              src={badge.assetPath}
              alt={badge.nickname}
              className="detail-hero-badge-img"
            />
          </div>
        )}
      </div>

      {/* Profile Header & Attributes */}
      <div className="form-card" style={{ gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="page-title" style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>{cat.name}</h2>
          <span className="brand-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} />
            <span>{sightings.length} pertemuan</span>
          </span>
        </div>

        <div className="detail-badge-row">
          {cat.breed && cat.breed !== 'unknown' && (
            <span className="detail-tag">
              {formatBreedLabel(cat.breed)}
            </span>
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

        {cat.notes && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', lineHeight: 1.5, margin: '2px 0' }}>
            {cat.notes}
          </p>
        )}

        {/* Latest Encounter Summary */}
        {latestSighting && (
          <div style={{ marginTop: 'var(--space-1)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              <MapPin size={13} style={{ color: 'var(--color-primary)' }} />
              <span>{latestSighting.locationName || 'Lokasi tercatat'}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '18px' }}>
              Terakhir: {formatIndonesianDateTime(latestSighting.spottedAt)}
            </span>
          </div>
        )}

        {/* Primary CTA: Add Sighting */}
        <Link
          to={`/cats/${cat.id}/sightings/new`}
          className="btn-primary"
          id="btn-add-sighting-cta"
          style={{ width: '100%', marginTop: 'var(--space-2)' }}
        >
          <Plus size={18} />
          <span>Catat Pertemuan Baru</span>
        </Link>
      </div>

      {/* Encounter History Section */}
      <div className="timeline-card" id="cat-encounter-history">
        <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)' }}>
          Riwayat Pertemuan ({sightings.length})
        </h2>

        {sightings.length > 0 ? (
          <div className="timeline-list" id="sightings-list">
            {sightings.map((sighting) => {
              const formattedDate = formatIndonesianDateTime(sighting.spottedAt);

              return (
                <div key={sighting.id} className="timeline-item" id={`sighting-item-${sighting.id}`}>
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-surface-subtle)',
                        color: 'var(--color-text-subtle)',
                      }}
                      aria-label="Tidak ada foto"
                    >
                      <Camera size={22} style={{ opacity: 0.45 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                      {formattedDate}
                    </span>
                    {sighting.locationName && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={11} />
                        <span>{sighting.locationName}</span>
                      </span>
                    )}
                    {sighting.notes && (
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {sighting.notes}
                      </p>
                    )}
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
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Utensils size={16} />
            <span>Riwayat Pemberian Makan ({feedingLogs.length})</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {feedingLogs.map((log) => {
              const foodName = log.foodType === 'wet_food' ? 'Makanan Basah' : log.foodType === 'dry_food' ? 'Makanan Kering' : log.foodType === 'treat' ? 'Camilan' : 'Lainnya';
              return (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-xs)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>
                      {foodName}
                    </span>
                    {log.notes && <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>— {log.notes}</span>}
                  </div>
                  <span style={{ color: 'var(--color-text-subtle)' }}>
                    {new Date(log.fedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
              <AlertTriangle size={22} />
              <h3 id="modal-title" style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-danger)' }}>
                Hapus Profil Kucing?
              </h3>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Apakah Anda yakin ingin menghapus <strong>{cat.name}</strong> secara permanen?
              Tindakan ini akan menghapus semua {sightings.length} pertemuan, foto, dan catatan makanan yang terkait dari penyimpanan lokal Anda.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
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
    </div>
  );
};
