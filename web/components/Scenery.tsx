// Original illustrated scenery for the landing page: a sunrise over landmarks from several regions, drawn in the brand's indigo and gold.

/** Silhouettes along a baseline at y=430 in a 1440-wide scene. Fill and stroke are set by the caller. */
export function Landmarks({ fill }: { fill: string }) {
  const stroke = { stroke: fill, fill: "none", strokeLinecap: "round" as const };
  return (
    <g fill={fill}>
      {/* Baobab, West and East Africa */}
      <g transform="translate(170 430)">
        <path d="M-15 0 Q-31 -40 -19 -92 Q-10 -112 -4 -120 L4 -120 Q10 -112 19 -92 Q31 -40 15 0 Z" />
        <path d="M0 -118 L-36 -152 M0 -118 L-11 -164 M0 -118 L22 -158 M0 -118 L46 -142" {...stroke} strokeWidth={5} />
        <ellipse cx={-38} cy={-156} rx={22} ry={9} />
        <ellipse cx={-11} cy={-168} rx={20} ry={9} />
        <ellipse cx={23} cy={-162} rx={22} ry={9} />
        <ellipse cx={48} cy={-146} rx={18} ry={8} />
      </g>

      {/* Church with two towers, Latin America and Europe */}
      <g transform="translate(385 430)">
        <rect x={-62} y={-58} width={124} height={58} />
        <rect x={-54} y={-118} width={28} height={62} />
        <rect x={26} y={-118} width={28} height={62} />
        <polygon points="-56,-118 -40,-158 -24,-118" />
        <polygon points="24,-118 40,-158 56,-118" />
        <rect x={-22} y={-78} width={44} height={22} />
        <path d="M-22 -78 Q0 -112 22 -78 Z" />
        <rect x={-1.5} y={-130} width={3} height={22} />
        <rect x={-7} y={-124} width={14} height={3} />
      </g>

      {/* Stepped pyramid, Mesoamerica */}
      <g transform="translate(575 430)">
        <rect x={-104} y={-22} width={208} height={22} />
        <rect x={-84} y={-44} width={168} height={22} />
        <rect x={-64} y={-66} width={128} height={22} />
        <rect x={-44} y={-88} width={88} height={22} />
        <rect x={-20} y={-114} width={40} height={26} />
        <rect x={-27} y={-120} width={54} height={6} />
      </g>

      {/* Pagoda, East Asia */}
      <g transform="translate(925 430)">
        <rect x={-30} y={-40} width={60} height={40} />
        <polygon points="-58,-36 -42,-42 -26,-58 26,-58 42,-42 58,-36" />
        <rect x={-22} y={-92} width={44} height={34} />
        <polygon points="-44,-88 -30,-94 -17,-108 17,-108 30,-94 44,-88" />
        <rect x={-14} y={-134} width={28} height={26} />
        <polygon points="-30,-130 -19,-136 -10,-150 10,-150 19,-136 30,-130" />
        <rect x={-1.5} y={-184} width={3} height={36} />
        <circle cx={0} cy={-186} r={4} />
      </g>

      {/* Dome and minarets, North Africa, the Middle East and South Asia */}
      <g transform="translate(1085 430)">
        <path d="M-46 0 V-36 Q-46 -90 0 -90 Q46 -90 46 -36 V0 Z" />
        <rect x={-1.5} y={-108} width={3} height={20} />
        <circle cx={0} cy={-110} r={5} />
        <rect x={-68} y={-150} width={12} height={150} />
        <rect x={-72} y={-118} width={20} height={6} />
        <polygon points="-68,-150 -62,-174 -56,-150" />
        <rect x={56} y={-150} width={12} height={150} />
        <rect x={52} y={-118} width={20} height={6} />
        <polygon points="56,-150 62,-174 68,-150" />
      </g>

      {/* Palms, coasts everywhere */}
      <g transform="translate(1235 430)">
        <path d="M0 0 Q12 -52 0 -104" {...stroke} strokeWidth={7} />
        <path d="M0 -104 Q-28 -128 -54 -100 M0 -104 Q-18 -136 -40 -126 M0 -104 Q24 -134 52 -112 M0 -104 Q30 -112 56 -90 M0 -104 Q4 -140 18 -146" {...stroke} strokeWidth={5} />
      </g>
      <g transform="translate(1290 430) scale(0.8)">
        <path d="M0 0 Q-10 -50 4 -100" {...stroke} strokeWidth={7} />
        <path d="M4 -100 Q-24 -126 -50 -98 M4 -100 Q-14 -134 -36 -124 M4 -100 Q28 -132 56 -108 M4 -100 Q34 -108 58 -86" {...stroke} strokeWidth={5} />
      </g>

      {/* A second baobab to close the line */}
      <g transform="translate(1385 430) scale(0.75)">
        <path d="M-15 0 Q-31 -40 -19 -92 Q-10 -112 -4 -120 L4 -120 Q10 -112 19 -92 Q31 -40 15 0 Z" />
        <path d="M0 -118 L-36 -152 M0 -118 L-11 -164 M0 -118 L22 -158" {...stroke} strokeWidth={5} />
        <ellipse cx={-38} cy={-156} rx={22} ry={9} />
        <ellipse cx={-11} cy={-168} rx={20} ry={9} />
        <ellipse cx={23} cy={-162} rx={22} ry={9} />
      </g>
    </g>
  );
}

/** The hero backdrop: dusk sky, a rising sun ringed like the brand's resist-dye motif, three layers of land. */
export function HeroScene() {
  const stars: [number, number, number][] = [
    [90, 70, 1.6], [210, 130, 1.2], [330, 60, 1.8], [470, 150, 1.2], [560, 80, 1.5], [660, 40, 1.2], [790, 120, 1.4],
    [880, 60, 1.8], [1010, 150, 1.2], [1120, 70, 1.6], [1240, 130, 1.4], [1350, 60, 1.2], [140, 200, 1.1], [1300, 210, 1.1],
  ];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1535" />
          <stop offset="0.45" stopColor="#24336e" />
          <stop offset="0.78" stopColor="#6d5a9c" />
          <stop offset="1" stopColor="#e7a444" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="560" fill="url(#sky)" />
      {stars.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={0.7} />
      ))}
      <circle cx="720" cy="430" r="300" fill="url(#glow)" />
      <circle cx="720" cy="430" r="215" fill="none" stroke="#f0b440" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="720" cy="430" r="170" fill="none" stroke="#f0b440" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="720" cy="430" r="125" fill="none" stroke="#f0b440" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
      <circle cx="720" cy="430" r="92" fill="#f0b440" />

      {/* far: landmarks on a long, low ridge */}
      <g>
        <Landmarks fill="#98a6f2" />
        <path d="M0 430 Q180 410 360 428 T720 432 T1080 426 T1440 430 V470 H0 Z" fill="#98a6f2" />
      </g>
      {/* middle hills */}
      <path d="M0 470 Q220 430 460 462 T900 458 T1440 452 V560 H0 Z" fill="#26327a" />
      {/* near hills */}
      <path d="M0 505 Q260 470 520 500 T1040 496 T1440 488 V560 H0 Z" fill="#18215a" />
      {/* foreground */}
      <path d="M0 536 Q300 512 640 532 T1440 524 V560 H0 Z" fill="#0e1535" />
    </svg>
  );
}

/** Silhouette strip that rises out of the top of the footer. The scene's far ridge, in the footer's colour. */
export function SkylineStrip() {
  return (
    <svg className="block h-auto w-full" viewBox="0 232 1440 208" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <Landmarks fill="#0e1535" />
      <path d="M0 430 Q180 410 360 428 T720 432 T1080 426 T1440 430 V440 H0 Z" fill="#0e1535" />
    </svg>
  );
}
