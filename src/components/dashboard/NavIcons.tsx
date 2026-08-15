// Minimal hand-drawn line icons for the sidebar nav — kept dependency-free
// and restrained (thin strokes, no fills except where a solid shape reads
// better) to match the app's existing understated visual language.

export type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PriorityIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="4" y="12" width="3" height="8" fill="currentColor" />
      <rect x="10.5" y="6" width="3" height="14" fill="currentColor" />
      <rect x="17" y="9" width="3" height="11" fill="currentColor" />
    </svg>
  );
}

export function LeadsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
      <path d="M18 8v4M16 10h4" />
    </svg>
  );
}

export function ReferralIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M7.8 11l8.4-4M7.8 13l8.4 4" />
    </svg>
  );
}

export function ContractedIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function ProductivityIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
    </svg>
  );
}

export function SowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

export function AiIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}

export function TeamIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="9" r="3" />
      <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M14.5 13c2.8.3 5 2.7 5 5.5" />
    </svg>
  );
}

export function ChevronIcon({ className, direction = "left" }: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg {...base} className={className}>
      <path d={direction === "left" ? "M14 5l-6 7 6 7" : "M10 5l6 7-6 7"} />
    </svg>
  );
}
