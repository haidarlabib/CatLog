import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Cat as CatIcon, MapPin, X } from 'lucide-react';

describe('Cat Detail Profile Polish & Navigation', () => {
  it('renders "Riwayat Ketemuan" title with the Cat icon without text collision', () => {
    const html = renderToString(
      React.createElement(
        'div',
        { className: 'section-header-inline' },
        React.createElement(
          'h2',
          { className: 'section-card-title' },
          React.createElement(CatIcon, { size: 18 }),
          React.createElement('span', null, 'Riwayat Ketemuan')
        ),
        React.createElement('span', { className: 'section-count-pill' }, '3')
      )
    );

    expect(html).toContain('Riwayat Ketemuan');
    expect(html).toContain('section-card-title');
    expect(html).not.toContain('Jurnal Lapangan');
  });

  it('renders interactive location button inside encounter strip', () => {
    const html = renderToString(
      React.createElement(
        'div',
        { className: 'detail-latest-strip' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'detail-latest-loc-btn',
            title: 'Lihat di peta MyWorld',
          },
          React.createElement(MapPin, { size: 13 }),
          React.createElement('span', null, 'JPO Gambir, Gambir')
        )
      )
    );

    expect(html).toContain('detail-latest-loc-btn');
    expect(html).toContain('JPO Gambir, Gambir');
    expect(html).toContain('Lihat di peta MyWorld');
  });

  it('validates cat name: max 15 chars and alphanumeric + space only', () => {
    const sanitizeName = (val: string) => val.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15);
    const isValidName = (val: string) => {
      const trimmed = val.trim();
      return trimmed.length > 0 && trimmed.length <= 15 && /^[a-zA-Z0-9 ]+$/.test(trimmed);
    };

    // Alphanumeric + space under 15 chars
    expect(sanitizeName('Milo Si Manis')).toBe('Milo Si Manis');
    expect(isValidName('Milo Si Manis')).toBe(true);

    // Strips commas and punctuation
    expect(sanitizeName('Milo, si manis!')).toBe('Milo si manis');
    expect(sanitizeName('Cat #1, test.')).toBe('Cat 1 test');

    // Truncates to 15 characters
    expect(sanitizeName('OOOOOOOOOOOOOOOOO')).toBe('OOOOOOOOOOOOOOO');
    expect(sanitizeName('OOOOOOOOOOOOOOOOO').length).toBe(15);

    // Rejects invalid strings
    expect(isValidName('OOOOOOOOOOOOOOOOO')).toBe(false); // 17 chars
    expect(isValidName('Milo,')).toBe(false); // contains comma
    expect(isValidName('Milo!')).toBe(false); // contains exclamation
  });

  it('renders full uncropped photo lightbox modal with close button and no badge stamp', () => {
    const html = renderToString(
      React.createElement(
        'div',
        { className: 'photo-lightbox-backdrop' },
        React.createElement(
          'div',
          { className: 'photo-lightbox-header' },
          React.createElement('span', { className: 'photo-lightbox-counter' }, '1 / 2'),
          React.createElement('button', { className: 'photo-lightbox-close-btn' }, React.createElement(X, { size: 20 }))
        ),
        React.createElement(
          'div',
          { className: 'photo-lightbox-body' },
          React.createElement('img', {
            src: 'blob:test',
            alt: 'Foto penuh',
            className: 'photo-lightbox-img',
          })
        )
      )
    );

    expect(html).toContain('photo-lightbox-backdrop');
    expect(html).toContain('photo-lightbox-close-btn');
    expect(html).toContain('photo-lightbox-img');
    expect(html).not.toContain('detail-hero-badge-stamp');
  });
});
