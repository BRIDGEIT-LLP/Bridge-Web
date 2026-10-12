/**
 * Compatibility score shown as a circular progress ring with the number centered.
 * Color follows the surrounding text color (`currentColor`), so set it via
 * `className` — e.g. `text-white` over the dark shorts card, `text-primary` on the
 * light grid card.
 */
export function CompatibilityRing({
  value,
  max = 100,
  size = 54,
  stroke = 4,
  className = "",
}: {
  value: number;
  /** Value that represents a full ring. Defaults to 100 (`value` is already a percentage). */
  max?: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-headline text-sm font-black">
        {value}
      </span>
    </div>
  );
}
