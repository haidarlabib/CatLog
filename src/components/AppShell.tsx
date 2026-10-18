import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';
import { catRepository } from '../db';

interface AppShellProps {
  catCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({ catCount: initialCount }) => {
  const [count, setCount] = useState<number>(initialCount ?? 0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    catRepository.count().then((c) => {
      if (isMounted) setCount(c);
    }).catch(() => {
      // Graceful fallback
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location.pathname]);

  const isCameraRoute = location.pathname === '/cats/new';
  const hasDedicatedHeader = location.pathname.startsWith('/cats/') || location.pathname.startsWith('/sightings/');
  const showGlobalHeader = !isCameraRoute && !hasDedicatedHeader;
  const showBottomNav = !isCameraRoute;

  return (
    <div className="app-shell">
      {showGlobalHeader && <Header catCount={count} />}
      <PwaUpdatePrompt />
      {!isOnline && !isCameraRoute && (
        <div className="offline-notice-bar" role="status">
          <span>Mode luring aktif: Menampilkan data tersimpan. Ubin peta membutuhkan koneksi internet.</span>
        </div>
      )}
      <main className="app-content" style={isCameraRoute ? { padding: 0 } : undefined}>
        <Outlet />
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
};
