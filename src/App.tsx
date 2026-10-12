import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { PlaceholderPage } from './pages/PlaceholderPage';

// Code-split pages to reduce initial bundle size per Milestone 6
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const CatalogPage = lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AddCatPage = lazy(() => import('./pages/AddCatPage').then((m) => ({ default: m.AddCatPage })));
const CatDetailPage = lazy(() => import('./pages/CatDetailPage').then((m) => ({ default: m.CatDetailPage })));
const EditCatPage = lazy(() => import('./pages/EditCatPage').then((m) => ({ default: m.EditCatPage })));
const AddSightingPage = lazy(() => import('./pages/AddSightingPage').then((m) => ({ default: m.AddSightingPage })));

const RouteLoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '260px',
      color: 'var(--color-primary)',
    }}
  >
    <div
      className="spin"
      style={{
        width: 32,
        height: 32,
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
      }}
      role="status"
      aria-label="Loading page content"
    />
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            {/* Main 3-tab navigation routes */}
            <Route index element={<MapPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Cat & Sighting Management Routes */}
            <Route path="cats/new" element={<AddCatPage />} />
            <Route path="cats/:catId" element={<CatDetailPage />} />
            <Route path="cats/:catId/edit" element={<EditCatPage />} />
            <Route path="cats/:catId/sightings/new" element={<AddSightingPage />} />

            {/* Sighting preview */}
            <Route
              path="sightings/:sightingId"
              element={
                <PlaceholderPage
                  title="Sighting Details"
                  milestoneTarget="Atlas Review"
                  description="Interactive map pin popup and sighting view."
                />
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
