# DESIGN SPECIFICATION & REVAMP BLUEPRINT: PROWLLOG (CUKING)
> **Master UI/UX Redesign, Animation Choreography, and Visual Engineering Directive**  
> **Status:** Approved for Implementation | **Scope:** 100% Visual & Experience Upgrade | **Feature Integrity:** Strictly Preserved (Zero Breaking Changes)  
> **Target Aesthetic:** *Warm Editorial Minimalism × Tactile Haptic Luxury (Awwwards / Linear-Grade)*

---

## 1. Executive Summary & Design Vision

ProwlLog (Cuking) is already architecturally robust with a complete local-first engine (Dexie IndexedDB, Leaflet, PWA, multi-photo capture, and 129 passing automated tests). 

The goal of this design blueprint is to transform the visual presentation from a **utilitarian mobile prototype** into an **elite, $150k+ agency-grade personal atlas**. The design must exude warmth, physical tactile depth, cinematic micro-motion, and effortless clarity while preserving **100% of existing functionality, data contracts, and automated tests**.

### Core Pillars:
1. **Warm Editorial Minimalism**: Move away from cold, flat gray boxes. Embrace a tactile warm paper/parchment background (`#FBF8F2`), crisp porcelain cards (`#FFFFFF`), whisper-thin borders (`#E5DED5`), and high-character typography with tight tracking.
2. **Tactile Haptic Architecture ("Doppelrand" / Double-Bezel)**: Major cards and containers look like machined hardware—subtle outer shells with concentric inner surfaces and micro-highlights instead of generic heavy drop shadows.
3. **Kinetic Spring Physics**: All transitions abandon robotic `ease-in-out` for physical mass and spring timing (`cubic-bezier(0.32, 0.72, 0, 1)`). Hover states scale subtly down on active press (`scale(0.98)`). Lists reveal with a graceful cascade.
4. **Subtle 3D Touch (Three.js Micro-Moment)**: A lightweight, isolated WebGL canvas rendering a tactile 3D Cat Compass / Talisman Coin in the brand header or empty states with ambient mouse/gyro tracking, automatic resource disposal, and strict reduced-motion fallback.
5. **Zero Feature Regression**: No routes, database fields, form validations, or test IDs are modified. Every button, input, and modal continues to operate identically under the hood.

---

## 2. Design System Foundations

### 2.1. Color Palette & Semantic Tokens
The palette honors the existing brand teal while introducing rich, warm neutrals and washed pastels:

```css
:root {
  /* Canvas & Surfaces */
  --color-bg: #FBF8F2;                   /* Warm bone/parchment canvas */
  --color-bg-subtle: #F5F0E6;            /* Secondary container tint */
  --color-surface: #FFFFFF;               /* Crisp porcelain card surface */
  --color-surface-elevated: #FFFFFF;      /* Floating overlays & modals */
  --color-surface-glass: rgba(251, 248, 242, 0.85); /* Frosted header/bottom bar */

  /* Text & Contrast (WCAG 2.1 AA Compliant) */
  --color-text-primary: #1C1917;         /* Deep warm charcoal (never #000) */
  --color-text-secondary: #57534E;       /* Balanced stone reading text */
  --color-text-muted: #78716C;           /* Secondary metadata & labels */
  --color-text-subtle: #A8A29E;          /* Timestamps & placeholders */
  --color-text-inverse: #FFFFFF;

  /* Brand Primary (Signature Deep Pine / Oceanic Teal) */
  --color-primary: #226F80;
  --color-primary-hover: #1A5764;
  --color-primary-active: #13424D;
  --color-primary-tint: #EBF4F5;          /* Soft accent wash */
  --color-primary-glow: rgba(34, 111, 128, 0.15);

  /* Hairlines & Borders */
  --color-border: #E7DFD5;               /* Structural divider */
  --color-border-subtle: #EFE9E1;        /* Micro hairline */
  --color-border-focus: #226F80;
  --color-border-highlight: rgba(255, 255, 255, 0.7);

  /* Washed Pastel Trait & Badge Accents */
  --badge-oopsie-bg: #F1F5F9;   --badge-oopsie-text: #475569;   --badge-oopsie-border: #CBD5E1;
  --badge-boss-bg: #FEF3C7;     --badge-boss-text: #92400E;     --badge-boss-border: #FCD34D;
  --badge-pinkie-bg: #FCE7F3;   --badge-pinkie-text: #9D174D;   --badge-pinkie-border: #F472B6;
  --badge-blue-bg: #E0F2FE;     --badge-blue-text: #075985;     --badge-blue-border: #38BDF8;
  --badge-emerald-bg: #ECFDF5;  --badge-emerald-text: #065F46;  --badge-emerald-border: #34D399;
  --badge-bandit-bg: #FFEDD5;   --badge-bandit-text: #9A3412;   --badge-bandit-border: #FB923C;

  /* Haptic Shadows (Ultra-diffuse, warm tinted) */
  --shadow-sm: 0 1px 3px rgba(28, 25, 23, 0.04), 0 1px 2px rgba(28, 25, 23, 0.02);
  --shadow-md: 0 4px 14px rgba(28, 25, 23, 0.05), 0 1px 3px rgba(28, 25, 23, 0.03);
  --shadow-lg: 0 12px 32px rgba(28, 25, 23, 0.07), 0 2px 6px rgba(28, 25, 23, 0.03);
  --shadow-inner-bevel: inset 0 1px 1px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(0, 0, 0, 0.03);

  /* Radii */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-card: 24px;
  --radius-pill: 9999px;

  /* Motion Curves */
  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 180ms;
  --duration-base: 280ms;
  --duration-smooth: 450ms;
}
```

---

### 2.2. Typographic Hierarchy
- **Primary Typeface**: `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`.
- **Editorial Contrast Accent**: `Instrument Serif`, `Newsreader`, or `Playfair Display` (for featured headlines, cat profile names, and empty state titles).
- **Numbers / Metrics**: `font-variant-numeric: tabular-nums` (dates, coords, cat counters).
- **Rules**:
  - Headlines: tight tracking (`letter-spacing: -0.025em`) and line-height `1.15`.
  - Micro-eyebrows: `text-[11px]`, uppercase, wide tracking (`letter-spacing: 0.12em`), font-weight 600.
  - Body: max line length 65ch, line-height 1.6, `text-wrap: pretty`.
  - Elimination of all generic AI copywriting clichés: plain, warm, natural Indonesian/English copy.

---

### 2.3. Haptic Double-Bezel ("Doppelrand") Architecture
Rather than flat cards with generic borders:
```html
<!-- Pattern: Double-Bezel Machined Card -->
<div class="card-bezel-outer">
  <div class="card-bezel-inner">
    <!-- Card content here -->
  </div>
</div>
```
```css
.card-bezel-outer {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  padding: 4px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-base) var(--ease-spring), box-shadow var(--duration-base) var(--ease-spring);
}

.card-bezel-inner {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: calc(var(--radius-card) - 4px);
  padding: 16px;
  box-shadow: var(--shadow-inner-bevel);
}

.card-bezel-outer:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-bezel-outer:active {
  transform: translateY(0) scale(0.99);
}
```

---

### 2.4. Button-in-Button & Island Action Patterns
Primary call-to-actions follow the high-end trailing icon enclosure:
```css
.btn-primary-island {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--color-primary);
  color: #FFFFFF;
  padding: 10px 14px 10px 20px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: 0.9375rem;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 14px rgba(34, 111, 128, 0.25);
  transition: all var(--duration-fast) var(--ease-spring);
}

.btn-primary-island:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(34, 111, 128, 0.32);
}

.btn-primary-island:active {
  transform: translateY(1px) scale(0.98);
}

.btn-primary-island .icon-disk {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.btn-primary-island:hover .icon-disk {
  transform: translateX(2px);
}
```

---

## 3. Three.js Signature Micro-Experience Specification

To introduce a high-end 3D touch without slowing down mobile performance or risking battery drain, implement a dedicated micro-component:

### Component: `<CatCompass3D />` (Interactive 3D Talisman Coin)
- **Role**: Serves as an interactive tactile branding moment (rendered in the Catalog Hero header, in the Cat Detail profile badge banner, or inside the empty state).
- **Visual Subject**: An embossed physical gold-brass or oceanic-teal metallic coin with a low-poly 3D cat paw / cat silhouette relief, resting on a subtle transparent canvas.
- **Micro-Interaction**:
  - **Pointer Tracking**: Gently tilts toward the user's cursor / touch drag with spring damping (`rotation.y` and `rotation.x` interpolation `lerp(target, 0.05)`).
  - **Ambient Breathing**: Very slow, calming floating wobble when idle (`Math.sin(time * 1.5) * 0.08`).
  - **Click/Tap Reaction**: Executes a playful 360-degree coin-spin impulse with a soft tactile sound/vibration feedback.
- **Safety, Performance & Lifespan Contract**:
  1. **Lazy Loaded**: Dynamically imported (`const CatCompass3D = lazy(...)`) so Three.js (only ~140KB gzipped) is **not** loaded in the critical initial bundle of the Map.
  2. **WebGL Context Disposal**: On component unmount (`useEffect` cleanup), the component explicitly disposes all geometries, materials, and calls `renderer.dispose()`.
  3. **Performance Throttling**:
     - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` (prevents GPU meltdown on Retina/4K phones).
     - Renders at fixed micro dimensions (e.g., 90×90px or 120×120px).
     - `alpha: true`, `antialias: true`, no shadow maps (uses baked vertex shading + single directional light).
  4. **Accessibility & Reduced Motion**:
     - If `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true, the render loop halts immediately after the initial frame, presenting a crisp, static 3D vector emblem without running continuous RAF loops.

---

## 4. Screen-by-Screen UI/UX Polish Plan

### 4.1. App Shell & Navigation
- **Header ([`Header.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/components/Header.tsx))**:
  - Frosted glass effect (`backdrop-filter: blur(16px)` with warm tint `rgba(251, 248, 242, 0.85)`).
  - Logo paired with a micro-counter badge (`"X Kucing Tersimpan"` with soft teal pill background).
  - Subtle offline notification bar integrated seamlessly as an animated slide-down ribbon.
- **Bottom Navigation ([`BottomNav.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/components/BottomNav.tsx))**:
  - Transform into a **floating island dock** on mobile (`margin: 0 16px 12px 16px`, `border-radius: 9999px`, detached from the bottom screen edge with safe-area padding).
  - Active tab uses a sliding background pill with spring translation instead of abrupt color cuts.
  - Active icon scales up to `1.1` with a micro-haptic bounce.
  - The center "+" or camera shortcut button has a glowing subtle teal aura.

---

### 4.2. Map Page (`/` — [`MapPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/MapPage.tsx))
- **Photo Pins**:
  - Enhance the circular photo markers with concentric double-rings matching the cat's Character Badge.
  - Add an ultra-subtle breathing pulse animation to the most recently spotted cat marker.
  - Clustered marker pill (radius 50m) styled as a refined stacked photo deck with an ambient badge count.
- **User Location Pin**:
  - Refined avatar marker with a smooth directional radar pulse (`@keyframes pulse-wave`).
- **Cat Bottom Sheet / Popup Card**:
  - When a pin is tapped, slide up a floating bottom drawer with `backdrop-filter: blur(12px)`.
  - Shows the cat's cover photo, name in editorial serif, time elapsed ("2 jam lalu"), and an island button "Buka Profil ↗".

---

### 4.3. CATalog Page (`/catalog` — [`CatalogPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/CatalogPage.tsx))
- **Header & Search Experience**:
  - Prominent editorial headline ("Atlas Kucing") accompanied by the interactive `<CatCompass3D />` coin emblem.
  - Search input housed in a double-bezel wrapper with a clear indicator pill, instant keyboard focus ring, and quick-filter chips (Semua, Si Oon, Si Bos, Si Manis).
- **Cat Grid Layout**:
  - Bento-inspired asymmetrical card styling on tablet/desktop, clean high-density single column on mobile.
  - Each cat card features:
    - Circular photo aperture with genuine Character Badge frame.
    - Subtle trait pills (e.g. `Tabby`, `Bicolor`, `Domestik`).
    - Stat line: Pin icon with latest sighting location name & date formatted in clean Indonesian typography.
    - Hover lift with custom cubic-bezier spring.

---

### 4.4. Cat Detail Page (`/cats/:catId` — [`CatDetailPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/CatDetailPage.tsx))
- **Photo Carousel Hero**:
  - Full-width cinematic photo header with subtle gradient scrim.
  - Smooth swipe gesture indicator dots.
  - Cover photo marked with an elegant glass star badge.
- **Identity & Character Badge Card**:
  - Displays the cat's chosen personality frame badge with an editorial title (e.g. *Lil Boss — Si Bos Nakal*) and personality summary card.
- **Encounter Timeline (Sightings)**:
  - Vertical connected milestone timeline with clean geometric dots.
  - Each sighting card displays the exact date, location name, notes, and direct link to view on map.
- **Feeding History**:
  - Clean food bowl icon badges (`Basah`, `Kering`, `Camilan`) with warm pastel tags.
- **Action Dock**:
  - Fixed floating action bar at bottom with primary "Catat Pertemuan Baru" button-in-button.

---

### 4.5. Add Cat Flow (Camera & Form — [`AddCatCameraPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/AddCatCameraPage.tsx) & [`AddCatPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/AddCatPage.tsx))
- **Camera Viewfinder**:
  - Darkened cinematic frame with minimal golden rule-of-thirds grid guides.
  - Smooth shutter button with double-ring active feedback and white flash transition.
  - Multi-photo tray at bottom displaying captured thumbnails with delete and crop shortcuts.
- **Form Page**:
  - Retains all form state via `catDraftStore`.
  - **Horizontal Badge Selector**: 6 circular personality badges rendered as direct luxury rings with active glowing selection rings.
  - **Collapsible Trait Accordions**: Smooth height transition for detailed coat pattern and color pickers.
  - **GPS Status Badge**: Displays green pulse for locked GPS or clean fallback button to open [`MapLocationPickerModal.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/components/MapLocationPickerModal.tsx).

---

### 4.6. Settings Page (`/settings` — [`SettingsPage.tsx`](file:///d:/projek%20porto/nyoba%20aja/prowlog/src/pages/SettingsPage.tsx))
- **Explorer Profile**:
  - Card with user avatar, customizable explorer nickname, and haptic edit button.
- **Storage Quota Indicator**:
  - Smooth animated percentage bar showing IndexedDB usage (MB used of available GB).
- **Data Portability Hub**:
  - Elegant double-bezel cards for "Ekspor Cadangan (ZIP)" and "Pulihkan Data".
  - Dropzone for ZIP upload with clear status animations.

---

## 5. Motion Choreography & Performance Guardrails

### 5.1. Motion Rules:
- **No Layout Thrashing**: Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` (`translate3d`, `scale`) and `opacity`.
- **Spring Curves**: Replace all generic transitions with `--ease-spring: cubic-bezier(0.32, 0.72, 0, 1)`.
- **Staggered Card Entry**: Use `IntersectionObserver` to trigger a CSS class `.animate-enter` with variable delay (`animation-delay: calc(var(--stagger) * 60ms)`).
- **Reduced Motion**: All animations wrapped in `@media (prefers-reduced-motion: reduce)` to gracefully default to instant opacity shifts.

---

## 6. Implementation Checklist & Strict Integrity Rules

1. [ ] **Preserve All Test Selectors**: Retain all existing `id` attributes (`#catalog-page`, `#catalog-search-input`, `#user-location-avatar`, etc.) and test attributes to guarantee 100% of the 129 Vitest tests continue to pass.
2. [ ] **Preserve Database Contracts**: Do not modify table schemas in `database.ts` or method signatures in repositories and services.
3. [ ] **Preserve Offline Functionality**: Ensure no CDN fonts or un-cached remote dependencies are added. Keep Google Fonts cached by Workbox.
4. [ ] **Isolated Three.js Bundle**: Ensure Three.js is dynamically imported in a dedicated sub-chunk via Rollup `manualChunks` in `vite.config.ts` so the core application bundle remains ultra-light.

---

## 7. Execution Prompt for AI Agents

```text
PROMPT TO EXECUTE THIS DESIGN SPECIFICATION:

"Review design.md thoroughly. Execute the design revamp for ProwlLog (Cuking) according to the specifications:
1. Update tokens.css and main.css with the warm editorial minimalism palette, haptic double-bezel variables, refined typography, and spring motion curves.
2. Implement the subtle Three.js micro-component (<CatCompass3D />) using dynamic lazy loading, proper WebGL disposal, clamped pixel ratio, and prefers-reduced-motion fallback.
3. Upgrade components (Header, BottomNav, CatPhotoImg, BadgeSelector, AppShell) with the floating island dock, double-bezel card containers, and button-in-button CTA patterns.
4. Polish all pages (MapPage, CatalogPage, CatDetailPage, AddCatCameraPage, AddCatPage, SettingsPage) according to Section 4 of design.md.
5. Strictly preserve all existing functionality, form flows, route paths, test IDs, and verify that all 129 automated Vitest tests pass with 'npm test'."
```
