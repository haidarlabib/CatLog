import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, X, MapPin, ArrowUpRight } from 'lucide-react';
import { catRepository } from '../db';
import { CatPhotoImg } from '../components/CatPhotoImg';
import {
  CHARACTER_BADGES,
  formatBreedLabel,
  formatAppearanceLabel,
  resolveBadge,
} from '../config/catAppearance';
import { OyenEmptyState } from '../components/OyenEmptyState';
import type { CatWithLatestSighting } from '../types';

export const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [cats, setCats] = useState<CatWithLatestSighting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBadgeFilter, setActiveBadgeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCats = useCallback(async (query: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const rawCats =
        query.trim().length > 0
          ? await catRepository.search(query)
          : await catRepository.getAll();

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

  const filteredCats = useMemo(() => {
    if (activeBadgeFilter === 'all') return cats;
    return cats.filter((c) => resolveBadge(c.badgeRing).id === activeBadgeFilter);
  }, [cats, activeBadgeFilter]);

  return (
    <div className="page-container catalog-page-container" id="catalog-page">
      <h1 className="sr-only">Katalog Kucing</h1>

      {/* Double-Bezel Search Input Bar */}
      <div className="search-bezel-shell">
        <div className="search-bar-wrapper">
          <Search className="search-icon" size={17} aria-hidden="true" />
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
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Personality Archetype Filter Strip (shown when cats exist) */}
      {!isLoading && !errorMsg && cats.length > 0 && (
        <div className="catalog-filter-strip" role="tablist" aria-label="Filter kepribadian kucing">
          <button
            type="button"
            role="tab"
            aria-selected={activeBadgeFilter === 'all'}
            className={`catalog-filter-chip ${activeBadgeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveBadgeFilter('all')}
          >
            <span>Semua</span>
            <span className="filter-chip-count tabular-nums">{cats.length}</span>
          </button>
          {CHARACTER_BADGES.map((b) => {
            const countForBadge = cats.filter(
              (c) => resolveBadge(c.badgeRing).id === b.id
            ).length;
            if (countForBadge === 0 && activeBadgeFilter !== b.id) return null;
            const isActive = activeBadgeFilter === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`catalog-filter-chip badge-pastel-${b.id} ${isActive ? 'active' : ''}`}
                onClick={() => setActiveBadgeFilter(isActive ? 'all' : b.id)}
              >
                <span
                  className="filter-chip-dot"
                  style={{ backgroundColor: b.hex }}
                  aria-hidden="true"
                />
                <span>{b.nickname}</span>
                <span className="filter-chip-count tabular-nums">{countForBadge}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Skeleton Shimmer Loading State */}
      {isLoading && (
        <div className="cat-grid" role="status" aria-label="Memuat katalog">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="cat-card cat-card--skeleton" aria-hidden="true">
              <div className="skeleton-shimmer cat-card-media" />
              <div className="cat-card-body">
                <div className="skeleton-shimmer skeleton-line skeleton-line--title" />
                <div className="skeleton-shimmer skeleton-line skeleton-line--sub" />
                <div className="skeleton-shimmer skeleton-line skeleton-line--meta" />
              </div>
            </div>
          ))}
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
          {filteredCats.length > 0 ? (
            <div className="cat-grid" id="catalog-grid">
              {filteredCats.map((cat, idx) => {
                const breedText =
                  cat.breed && cat.breed !== 'unknown' ? formatBreedLabel(cat.breed) : null;
                const coatText =
                  cat.coatColors && cat.coatColors.length > 0
                    ? cat.coatColors.map(formatAppearanceLabel).join(', ')
                    : null;
                const badge = resolveBadge(cat.badgeRing);
                const latestLoc = cat.latestSighting?.locationName;

                return (
                  <Link
                    key={cat.id}
                    to={`/cats/${cat.id}`}
                    className="cat-card animate-stagger-in"
                    style={{ '--stagger': Math.min(idx, 10) } as React.CSSProperties}
                    id={`cat-card-${cat.id}`}
                  >
                    <div className="cat-card-media">
                      <CatPhotoImg
                        photoId={cat.coverPhotoId}
                        alt={`Foto ${cat.name}`}
                        mode="square"
                      />
                      <span
                        className="cat-card-badge-emblem"
                        title={`${badge.nickname} — ${badge.epithet}`}
                      >
                        <img src={badge.assetPath} alt="" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="cat-card-body">
                      <div className="cat-card-header-row">
                        <div className="cat-card-title">{cat.name}</div>
                        <span className="cat-card-more-btn" aria-hidden="true">
                          <ArrowUpRight size={13} />
                        </span>
                      </div>

                      <div className="cat-card-subtitle">
                        <span className={`cat-card-personality-pill badge-pastel-${badge.id}`}>
                          {badge.epithet}
                        </span>
                        <span className="cat-card-breed-tag">{breedText || 'Domestik'}</span>
                        {coatText && <span className="cat-card-coat-tag">{coatText}</span>}
                      </div>

                      <div className="cat-card-meta">
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        <span className="cat-card-meta-text tabular-nums">
                          {latestLoc
                            ? `${latestLoc} · ${cat.sightingsCount || 1}×`
                            : `${cat.sightingsCount || 1} pertemuan`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 0 || activeBadgeFilter !== 'all' ? (
            <div className="empty-state-card" style={{ margin: 'var(--space-6) auto' }}>
              <h2 className="empty-state-title">Tidak Ada Kucing yang Cocok</h2>
              <p className="empty-state-desc">
                {searchQuery.trim().length > 0
                  ? `Tidak ditemukan kucing yang sesuai dengan "${searchQuery}".`
                  : 'Belum ada kucing dengan badge karakter tersebut.'}
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearchQuery('');
                  setActiveBadgeFilter('all');
                }}
              >
                Reset Filter
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
