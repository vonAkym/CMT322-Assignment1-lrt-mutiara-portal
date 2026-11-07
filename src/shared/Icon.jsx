// Small line icons. They take the text colour (currentColor) and are hidden from screen readers,
// so always put a text label next to them.
const PATHS = {
  'Road closure': '<rect x="3" y="8" width="18" height="6" rx="1"/><path d="M7 8l-3 6M13 8l-3 6M19 8l-3 6M6 14v5M18 14v5"/>',
  'Schedule': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'Business access': '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6z"/><path d="M10 20v-6h4v6"/>',
  'Progress': '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  report: '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 8v3M12 13.5v.5"/>',
};

export default function Icon({ name, size = 16, stroke = 'currentColor', width = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || PATHS.list }} />
  );
}
