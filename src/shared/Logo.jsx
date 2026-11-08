// The MutiaraInfo logo: an "M" inside a thin circle, then the name with "Info" in gold.
// The circle and "Mutiara" take the text colour around them (white on the green header and footer).
export const LogoMark = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" strokeWidth="1.8" />
    <path d="M13 27V13.5l7 8.5 7-8.5V27" strokeWidth="2.4" />
  </svg>
);

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-name">Mutiara<span>Info</span></span>
    </span>
  );
}
