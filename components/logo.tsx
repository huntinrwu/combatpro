// CombatPro mark: a glove on a dark tile, in the brand gold. Inline SVG so it
// stays crisp and visible on both light and dark surfaces (an <img> of a
// currentColor SVG always renders black).
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#0a0a0a" />
      <path
        fill="#f5b83d"
        transform="translate(4 4) scale(0.75)"
        d="M21 8c4.5 0 7 2.5 7 7v2c0 4.5-2.5 7-7 7h-6c-2 0-3.5-1-4-2.5c-1 1-2.5 1.5-4 1.5c-1.5 0-3-1-3-3v-8c0-2 1.5-3 3-3c1.5 0 3 .5 4 1.5c.5-1.5 2-2.5 4-2.5h6z"
      />
      <path
        stroke="#0a0a0a"
        strokeWidth="1"
        strokeLinecap="round"
        transform="translate(4 4) scale(0.75)"
        d="M11 11.5v9"
      />
    </svg>
  );
}
