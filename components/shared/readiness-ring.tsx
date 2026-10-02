type ReadinessRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  label?: string;
};

export function ReadinessRing({ value, size = 112, label }: ReadinessRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const stroke = Math.max(6, Math.round(size / 14));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Score"}: ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="fill-none stroke-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-semibold tabular-nums" style={{ fontSize: size / 4.6 }}>
          {clamped}%
        </span>
      </div>
    </div>
  );
}
