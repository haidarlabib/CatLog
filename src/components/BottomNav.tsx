import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Map, PawPrint, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const activeIdx = pathname.startsWith('/settings')
    ? 2
    : pathname.startsWith('/catalog') || pathname.startsWith('/cats/')
    ? 1
    : 0;

  return (
    <nav className="bottom-nav-wrapper" aria-label="Navigasi Utama">
      <div
        className="bottom-nav-pill"
        style={{ '--active-idx': activeIdx } as React.CSSProperties}
      >
        <span className="bottom-nav-glider" aria-hidden="true" />

        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-tab-map"
        >
          <Map className="nav-item-icon" aria-hidden="true" />
          <span className="nav-item-label">MyWorld</span>
        </NavLink>

        <NavLink
          to="/catalog"
          className={({ isActive }) =>
            `nav-item ${isActive || pathname.startsWith('/cats/') ? 'active' : ''}`
          }
          id="nav-tab-catalog"
        >
          <PawPrint className="nav-item-icon" aria-hidden="true" />
          <span className="nav-item-label">CatLog</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-tab-settings"
        >
          <Settings className="nav-item-icon" aria-hidden="true" />
          <span className="nav-item-label">Pengaturan</span>
        </NavLink>
      </div>
    </nav>
  );
};
