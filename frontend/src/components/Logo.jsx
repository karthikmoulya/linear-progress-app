export default function Logo({ inverted = false, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="7" fill={inverted ? "#FFFFFF" : "#12141A"} />
      <path
        d="M8 18.5 L12.5 13 L15.5 16 L20 9.5"
        stroke={inverted ? "#12141A" : "#FFFFFF"}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
