// ============================================================================
// GURIHEL DESIGN SYSTEM TOKENS
// Verbatim definitions matching Section 8 of Full Stack Blueprint v1.0
// ============================================================================

export const GuriHelTokens = {
  colors: {
    primary: '#0B7A3E',
    deep: '#0F3D2A',
    accent: '#F5B800',
    info: '#1F6FD0',
    danger: '#D64545',
    surface: '#EEF2F0',
    border: '#C9D2CD',
    text: '#18211C',
  },
  typography: {
    fontFamilyLatin: 'Plus Jakarta Sans, Inter, sans-serif',
    fontFamilyArabic: 'IBM Plex Sans Arabic, sans-serif',
    display: { size: '28px', weight: '700' },
    title: { size: '20px', weight: '600' },
    subtitle: { size: '16px', weight: '600' },
    body: { size: '14px', weight: '400' },
    caption: { size: '12px', weight: '400' },
    price: { size: '18px', weight: '700', color: '#0B7A3E' },
  },
  spacing: {
    grid: 4,
    screenMargin: 16,
  },
  radius: {
    chips: 999,
    cards: 16,
    buttons: 12,
    sheets: 24,
  },
  elevation: {
    flat: 0,
    cards: 1,
    floatingBars: 4,
    modals: 8,
  },
} as const;
