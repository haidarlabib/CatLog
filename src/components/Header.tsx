import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PawPrint, Plus } from 'lucide-react';
import { OyenHeaderMascot } from './OyenHeaderMascot';

interface HeaderProps {
  catCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ catCount = 0 }) => {
  const location = useLocation();
  const isCatalogPage = location.pathname === '/catalog';

  return (
    <header className="app-header">
      <Link to="/" className="brand-wrapper" aria-label="Cuking Beranda">
        <img
          src="/cuking logo.png"
          alt="Cuking"
          className="brand-title-img"
          height="36"
        />
      </Link>

      <OyenHeaderMascot />

      <div className="header-status-cluster">
        {isCatalogPage ? (
          <Link
            to="/cats/new"
            className="catalog-quick-add-btn"
            aria-label="Tambah kucing baru"
            title="Tambah kucing baru"
            id="header-catalog-quick-add"
          >
            <Plus size={13} aria-hidden="true" />
            <span>Catat</span>
          </Link>
        ) : (
          <Link
            to="/catalog"
            id="header-cat-counter-badge"
            className="header-status-pill header-status-pill--interactive"
            title={`Total kucing terdata: ${catCount}`}
          >
            <PawPrint size={12} className="header-pill-accent-icon" aria-hidden="true" />
            <span className="tabular-nums">{catCount} Kucing</span>
          </Link>
        )}
      </div>
    </header>
  );
};
