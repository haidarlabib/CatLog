# ProwlLog PWA — Personal Community Cat Tracker

A mobile-first, privacy-respecting Progressive Web App for discovering, tracking, and cataloging feline encounters with interactive photo pins, offline app shell, and local-first IndexedDB persistence.

---

## 🛠️ Tech Stack & Architecture

- **UI Framework:** React 19 + TypeScript (Strict mode)
- **Bundler & Tooling:** Vite 8 + Vitest
- **Local Storage Layer:** IndexedDB managed via Dexie 4
- **Interactive Map:** Leaflet 1.9 with decoupled OSM tile provider
- **PWA & Offline:** `vite-plugin-pwa` with Workbox precaching (`registerType: 'prompt'`)
- **Data Portability:** ZIP export/import (`jszip`) with schema versioning (`schemaVersion: 1`) and atomic Dexie transactions

---

## 🚀 Getting Started

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run automated test suites (Vitest)
npm run test

# Production build with type checking
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Production Deployment

ProwlLog is a Single Page Application (SPA). For production deployment, ensure that all routes are redirected to `/index.html` to support direct client-side routing on routes like `/catalog`, `/settings`, and `/cats/:catId`.

### 1. Static Hosting (Netlify / Cloudflare Pages / Surge)
The repository includes [public/_redirects](file:///d:/projek%20porto/nyoba%20aja/prowlog/public/_redirects) which automatically copies to `dist/_redirects`:
```text
/* /index.html 200
```

### 2. Vercel
A `vercel.json` file in the root can be configured as:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3. Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    root /var/www/prowllog/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets with version hashes
    location ~* \.(?:js|css|woff2|png|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Do not cache Service Worker
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

> **Security Note:** Service workers, Geolocation API, and Persistent Storage require HTTPS (Secure Context) in production.

---

## 📦 PWA & Offline Strategy

1. **Service Worker Update Strategy:** Configured with `registerType: 'prompt'` via [src/components/PwaUpdatePrompt.tsx](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/components/PwaUpdatePrompt.tsx). Updates do not trigger sudden page reloads while a user is entering cat data; instead, a non-intrusive banner allows the user to update when safe.
2. **Precached App Shell:** Core HTML, CSS, JavaScript chunks, webfonts, and application icons are pre-cached by Workbox for offline instant startup.
3. **Local Photos & Data:** Stored directly as Blobs in IndexedDB. Browsing the CATalog, viewing profiles, and adding/editing cats works 100% offline.
4. **Map Tile Limitation:** Sighting pins are rendered locally; however, background OpenStreetMap tiles require network access and are not bulk-cached offline. When offline, an informative banner notifies the user while keeping markers functional.

---

## 💾 Backup & Data Portability

ProwlLog exports a portable ZIP archive containing:
- `manifest.json`: Schema metadata, app version, counts, and export timestamp.
- `data.json`: Cats, sightings, feeding logs, and user settings.
- `photos/`: Individual binary image files named by photo ID (avoids bloated Base64 strings).

Import options include:
- **Replace (Overwrite):** Clears existing data and restores from backup atomically.
- **Merge:** Appends new records and updates matching records safely without data loss.
