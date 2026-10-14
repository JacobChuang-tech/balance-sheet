// Line icons (Lucide-style) used in place of emoji
const svg = (paths) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  bank: svg('<path d="M3 21h18"/><path d="M5 21V10"/><path d="M19 21V10"/><path d="M9 21V10"/><path d="M15 21V10"/><path d="M12 3 3 8h18z"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  trend: svg('<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>'),
  coins: svg('<circle cx="9" cy="9" r="6"/><path d="M15.5 9.2a6 6 0 1 1-6.3 6.3"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15 16 9.5"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  // Category icons
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
  clipboard: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>'),
  gem: svg('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M12 21 8 9l2-6M12 21l4-12-2-6"/>'),
  creditCard: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>'),
  fileText: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
  briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'),
  laptop: svg('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>'),
  percent: svg('<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8C10.5 4 7 4 7 6s3 2 5 2zM12 8c1.5-4 5-4 5-2s-3 2-5 2z"/>'),
  banknote: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
  utensils: svg('<path d="M4 3v7a3 3 0 0 0 3 3v8"/><path d="M10 3v7a3 3 0 0 1-3 3"/><path d="M7 3v7"/><path d="M17 21V3c-2 1-3 4-3 7v3h3"/>'),
  car: svg('<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>'),
  bag: svg('<path d="M5 7h14l-1 14H6z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>'),
  film: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>'),
  heartPulse: svg('<path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11.4 8.8 11.4s8.8-6 8.8-11.4z"/><path d="M3.5 12h4l2-3 3 6 2-3h5.5"/>'),
  book: svg('<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  package: svg('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>'),
  logo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="7" width="3" height="7" rx="1"/><rect x="6.5" y="4" width="3" height="10" rx="1"/><rect x="11" y="2" width="3" height="12" rx="1"/></svg>`
};

// Colored rounded tile with a white line icon, for categories
export function categoryTile(cat) {
  return `<span class="cat-tile" style="background: ${cat.color}">${ICONS[cat.icon] || ICONS.package}</span>`;
}
