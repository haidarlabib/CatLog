import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, X, MapPin, MoreHorizontal } from 'lucide-react';
import { catRepository } from '../db';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { formatBreedLabel, formatAppearanceLabel } from '../config/catAppearance';
import { OyenEmptyState } from '../components/OyenEmptyState';
import type { CatWithLatestSighting } from '../types';

export const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [cats, setCats] = useState<CatWithLatestSighting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCats = useCallback(async (query: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // If query is provided, use repo search, otherwise fetch all
      const rawCats = query.trim().length > 0
        ? await catRepository.search(query)
        : await catRepository.getAll();

      // Enrich with latest sighting info
      const enriched: CatWithLatestSighting[] = await Promise.all(
        rawCats.map(async (c) => {
          const detail = await catRepository.getCatWithLatestSighting(c.id);
          return detail || { ...c, sightingsCount: 0, latestSighting: null };
        })
      );

      setCats(enriched);
    } catch {
      setErrorMsg('Gagal memuat data kucing dari penyimpanan lokal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCats(searchQuery);
  }, [searchQuery, loadCats]);

  return (
    <div className="page-container catalog-page-container" id="catalog-page">
      {/* Title */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Katalog Kucing</h1>
          <span className="page-subtitle">Koleksi kucing yang kamu temui</span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="search-bar-wrapper">
        <Search className="search-icon" size={18} aria-hidden="true" />
        <input
          type="text"
          className="search-input"
          placeholder="Cari kucing berdasarkan nama, ras, atau warna..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Cari kucing"
          id="catalog-search-input"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Hapus pencarian"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
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
            aria-label="Memuat katalog"
          />
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <OyenEmptyState
          variant="ngambek"
          title="Yah, ada yang nggak beres."
          description={errorMsg}
          ctaLabel="Coba Lagi"
          onCtaClick={() => loadCats(searchQuery)}
        />
      )}

      {/* Content Grid or Empty State */}
      {!isLoading && !errorMsg && (
        <>
          {cats.length > 0 ? (
            <div className="cat-grid" id="catalog-grid">
              {cats.map((cat) => {
                const breedText = cat.breed && cat.breed !== 'unknown' ? formatBreedLabel(cat.breed) : null;
                const coatText = cat.coatColors && cat.coatColors.length > 0 
                  ? cat.coatColors.map(formatAppearanceLabel).join(' ') 
                  : null;

                return (
                  <Link
                    key={cat.id}
                    to={`/cats/${cat.id}`}
                    className="cat-card"
                    id={`cat-card-${cat.id}`}
                  >
                    <div className="cat-card-media">
                      <CatPhotoImg
                        photoId={cat.coverPhotoId}
                        alt={`Foto ${cat.name}`}
                        mode="square"
                      />
                    </div>
                    <div className="cat-card-body">
                      <div className="cat-card-header-row">
                        <div className="cat-card-title">{cat.name}</div>
                        <span className="cat-card-more-btn" aria-hidden="true">
                          <MoreHorizontal size={14} />
                        </span>
                      </div>
                      
                      <div className="cat-card-subtitle">
                        <span className="cat-card-breed-tag">{breedText || 'Domestik'}</span>
                        {coatText && <span className="cat-card-coat-tag">{coatText}</span>}
                      </div>

                      <div className="cat-card-meta">
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        <span>{cat.sightingsCount || 1} pertemuan</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 0 ? (
            <div className="empty-state-card" style={{ margin: 'var(--space-6) auto' }}>
              <h2 className="empty-state-title">Tidak Ada Kucing yang Cocok</h2>
              <p className="empty-state-desc">
                Tidak ditemukan kucing yang sesuai dengan &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                Hapus Pencarian
              </button>
            </div>
          ) : (
            <OyenEmptyState
              variant="bos"
              title="Belum ada kucing, Bos!"
              description="Yuk, catat kucing pertama yang kamu temui."
              ctaLabel="Tambah Kucing"
              onCtaClick={() => navigate('/cats/new')}
              className="catalog-empty-state"
            />
          )}
        </>
      )}
    </div>
  );
};
