import type { ItemKind } from "@/lib/types";

const PIN = "M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z";

/** The clock-on-a-pin mark: a place (there) and a time (then). */
export function Logo({ size = 28, inverted = false, fixedLight = false, title }: { size?: number; inverted?: boolean; fixedLight?: boolean; title?: string }) {
  // fixedLight keeps white and gold in both themes, for the dark hero, the menu page and the footer.
  const pin = fixedLight ? "#ffffff" : inverted ? "var(--ground)" : "var(--indigo)";
  const face = fixedLight ? "#0e1535" : inverted ? "var(--indigo-deep)" : "var(--ground)";
  return (
    <svg width={(size * 148) / 168} height={size} viewBox="0 0 148 168" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d={PIN} fill={pin} />
      <circle cx="74" cy="70" r="34" fill={face} />
      <line x1="74" y1="70" x2="74" y2="48" stroke={pin} strokeWidth="10" strokeLinecap="round" />
      <line x1="74" y1="70" x2="58" y2="80" stroke={pin} strokeWidth="10" strokeLinecap="round" />
      <circle cx="74" cy="70" r="7" fill={fixedLight ? "#f0b440" : "var(--gold)"} />
    </svg>
  );
}

/** The logo with its hands winding backwards: used while a session is being built. */
export function WindingLogo({ size = 88, still = false }: { size?: number; still?: boolean }) {
  return (
    <svg width={(size * 148) / 168} height={size} viewBox="0 0 148 168" role="img" aria-label="Going back in time">
      <path d={PIN} fill="var(--indigo)" />
      <circle cx="74" cy="70" r="34" fill="var(--ground)" />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={74 + 27 * Math.sin((a * Math.PI) / 180)} cy={70 - 27 * Math.cos((a * Math.PI) / 180)} r="2.2" fill="var(--indigo)" opacity="0.5" />
      ))}
      <g className={still ? undefined : "wind-hour"} style={{ transformOrigin: "74px 70px" }}>
        <line x1="74" y1="70" x2="58" y2="80" stroke="var(--indigo)" strokeWidth="8" strokeLinecap="round" />
      </g>
      <g className={still ? undefined : "wind-minute"} style={{ transformOrigin: "74px 70px" }}>
        <line x1="74" y1="70" x2="74" y2="46" stroke="var(--indigo)" strokeWidth="6" strokeLinecap="round" />
      </g>
      <circle cx="74" cy="70" r="6" fill="var(--gold)" />
    </svg>
  );
}

/** The one wordmark: pin-and-clock mark plus "then & there". `light` is white on dark in either theme. */
export function Wordmark({ size = 22, inverted = false, light = false }: { size?: number; inverted?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.4, color: light ? "#ffffff" : inverted ? "var(--ground)" : "var(--indigo)" }}>
      {/* The pin's round head sits on the middle of the lowercase letters; its tip drops to the descender line. */}
      <span style={{ display: "inline-flex", transform: `translateY(${size * 0.14}px)` }}>
        <Logo size={size * 1.7} inverted={inverted} fixedLight={light} />
      </span>
      <span className="display whitespace-nowrap leading-none" style={{ fontSize: size, color: "inherit", wordSpacing: "-0.08em" }}>
        then &amp; there
      </span>
    </span>
  );
}

/** Kind icons: indigo circle, cloth strokes, one gold accent. */
export function KindIcon({ kind, size = 40 }: { kind: ItemKind | "music" | "food" | "film_tv" | "work_hobby"; size?: number }) {
  const k = kind === "closing_song" || kind === "music" ? "song" : kind === "food" ? "taste" : kind === "film_tv" ? "film" : kind;
  const s = "#F3F4F0";
  const g = "#D9981C";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "#24336E" }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 32 32">
        {k === "song" && (
          <>
            <path d="M12 24 V7 L26 4 V21" fill="none" stroke={s} strokeWidth="2.6" strokeLinejoin="round" />
            <circle cx="8.5" cy="24" r="4" fill={g} />
            <circle cx="22.5" cy="21" r="4" fill={g} />
          </>
        )}
        {k === "place" && (
          <>
            <path d="M5 27 H27 M8 27 V13 M16 27 V13 M24 27 V13 M4 13 H28 L16 5 Z" fill="none" stroke={s} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="16" cy="10" r="2" fill={g} />
          </>
        )}
        {k === "taste" && (
          <>
            <path d="M4 16 H28 A12 12 0 0 1 4 16 Z" fill={g} />
            <path d="M11 12 C9 9 13 8 11 5 M16 12 C14 9 18 8 16 5 M21 12 C19 9 23 8 21 5" fill="none" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {k === "film" && (
          <>
            <rect x="4" y="8" width="24" height="18" rx="2" fill="none" stroke={s} strokeWidth="2.4" />
            <path d="M4 13 H28 M9 8 L12 13 M15 8 L18 13 M21 8 L24 13" stroke={s} strokeWidth="2.2" />
            <path d="M14 17 V23 L19 20 Z" fill={g} />
          </>
        )}
        {k === "work_hobby" && (
          <>
            <rect x="5" y="11" width="22" height="15" rx="2" fill="none" stroke={s} strokeWidth="2.4" />
            <path d="M12 11 V7 H20 V11" fill="none" stroke={s} strokeWidth="2.4" />
            <circle cx="16" cy="18" r="2.5" fill={g} />
          </>
        )}
      </svg>
    </span>
  );
}

/** The resist-dye strip. Used in exactly three places: Home, the print header and the stage edges. */
export function IndigoBand({ height = 28, tone = "light" }: { height?: number; tone?: "light" | "dark" }) {
  const id = `band-${tone}-${height}`;
  const color = tone === "light" ? "var(--indigo)" : "#AFC0F5";
  const op = tone === "light" ? 0.55 : 0.7;
  return (
    <svg aria-hidden width="100%" height={height} className="block">
      <defs>
        <pattern id={id} width={height * 1.5} height={height} patternUnits="userSpaceOnUse">
          <circle cx={height * 0.5} cy={height / 2} r={height * 0.32} fill="none" stroke={color} strokeWidth="2" />
          <circle cx={height * 0.5} cy={height / 2} r={height * 0.12} fill={color} />
          <circle cx={height * 1.15} cy={height * 0.25} r="1.6" fill={color} />
          <circle cx={height * 1.15} cy={height * 0.75} r="1.6" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} opacity={op} />
    </svg>
  );
}
