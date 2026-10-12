import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, X, Footprints, Plus, MapPin, Calendar } from 'lucide-react';
import { catRepository } from '../db';
import { CatPhotoImg } from '../components/CatPhotoImg';
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
      setErrorMsg('Failed to load cats from local storage.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCats(searchQuery);
  }, [searchQuery, loadCats]);

  return (
    <div className="page-container" id="catalog-page">
      {/* Title & Counter */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">CATalog</h1>
          <span className="page-subtitle">Your personal feline index</span>
        </div>
        <span className="brand-badge" id="catalog-count-badge">
          {cats.length} {cats.length === 1 ? 'Cat' : 'Cats'}
        </span>
      </div>

      {/* Search Input Bar */}
      <div className="search-bar-wrapper">
        <Search className="search-icon" size={18} aria-hidden="true" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, breed, or color..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search cats"
          id="catalog-search-input"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
          <p>Loading CATalog...</p>
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
          <span style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
        </div>
      )}

      {/* Content Grid or Empty State */}
      {!isLoading && !errorMsg && (
        <>
          {cats.length > 0 ? (
            <div className="cat-grid" id="catalog-grid">
              {cats.map((cat) => {
                const breedText = cat.breed && cat.breed !== 'unknown' ? cat.breed : null;
                const formattedDate = cat.latestSighting
                  ? new Date(cat.latestSighting.spottedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
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
                        alt={`Photo of ${cat.name}`}
                        className="cat-card-img"
                      />
                    </div>
                    <div className="cat-card-body">
                      <div className="cat-card-title">{cat.name}</div>
                      {breedText && (
                        <div className="cat-card-meta">
                          <span className="brand-badge" style={{ padding: '1px 6px', fontSize: '11px' }}>
                            {breedText}
                          </span>
                        </div>
                      )}
                      <div className="cat-card-meta" style={{ marginTop: 'auto', paddingTop: '4px' }}>
                        {formattedDate && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} />
                            <span>{formattedDate}</span>
                          </span>
                        )}
                        {cat.latestSighting?.locationName && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <MapPin size={11} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                              {cat.latestSighting.locationName}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-card" style={{ margin: 'var(--space-6) auto' }}>
              <div className="empty-state-icon-circle">
                <Footprints size={28} />
              </div>
              {searchQuery.trim().length > 0 ? (
                <>
                  <h2 className="empty-state-title">No Matches Found</h2>
                  <p className="empty-state-desc">
                    No cats matching &ldquo;{searchQuery}&rdquo; were found in your local collection.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                </>
              ) : (
                <>
                  <h2 className="empty-state-title">Your CATalog is Empty</h2>
                  <p className="empty-state-desc">
                    Every cat you meet and document will be organized here with photos, breed info, and encounter history.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate('/cats/new')}
                    id="catalog-add-cat-btn"
                  >
                    <Plus size={18} />
                    <span>Add Your First Cat</span>
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
