"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { Wordmark } from "./brand";
import { Landmarks } from "./Scenery";
import { ButtonLink } from "./ui";

export const HEADER_H = 84;
const PIN = "M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z";

/** The brand mark in fixed colours, for sitting on the dark hero and the menu page in both themes. */
function LightWordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-white">
      <svg width={26} height={30} viewBox="0 0 148 168" aria-hidden>
        <path d={PIN} fill="#ffffff" />
        <circle cx="74" cy="70" r="34" fill="#0e1535" />
        <line x1="74" y1="70" x2="74" y2="48" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
        <line x1="74" y1="70" x2="58" y2="80" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
        <circle cx="74" cy="70" r="7" fill="#f0b440" />
      </svg>
      <span className="display whitespace-nowrap text-[1.6rem] leading-none !text-white">then &amp; there</span>
    </span>
  );
}

/** Where the menu page leads. `id` is the landing-page element to scroll to. */
const MENU = [
  { id: "try", label: copy.landing.navTry, hint: "Pick a decade and a place" },
  { id: "how-it-works", label: copy.landing.howLink, hint: "Three simple steps" },
  { id: "why", label: copy.landing.menuWhy, hint: "The reminiscence bump" },
  { id: "examples", label: copy.landing.navExamples, hint: "Three people, three continents" },
  { id: "priv", label: copy.landing.menuPrivacy, hint: "What we share, and what we never do" },
] as const;

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}

/** Three dashes that fold into a cross. */
function Dashes({ open }: { open: boolean }) {
  const line = "absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-out";
  return (
    <span aria-hidden className="relative block h-[18px] w-[22px]">
      <span className={`${line} ${open ? "top-[8px] rotate-45" : "top-0"}`} />
      <span className={`${line} top-[8px] ${open ? "scale-x-0 opacity-0" : ""}`} />
      <span className={`${line} ${open ? "top-[8px] -rotate-45" : "top-[16px]"}`} />
    </span>
  );
}

/** The full-screen navigation page. A curtain opens from the menu button's corner and the links rise in one by one. */
function MenuPage({ visible, onClose, returnFocus }: { visible: boolean; onClose: () => void; returnFocus: () => void }) {
  const L = copy.landing;
  const closeRef = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => closeRef.current?.focus(), 350);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !root.current) return;
      // Keep Tab inside the menu while it's open.
      const f = [...root.current.querySelectorAll<HTMLElement>("a[href], button")].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, onClose]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    // Let the curtain start closing and the page unlock, then glide to the section.
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 380);
  };

  const step = (i: number) => ({ transitionDelay: visible ? `${260 + i * 70}ms` : "0ms" });

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="menu-curtain fixed inset-0 z-50 overflow-y-auto bg-[#0e1535] text-white"
      data-open={visible ? "true" : "false"}
      style={{ clipPath: visible ? "circle(150% at calc(100% - 48px) 48px)" : "circle(0px at calc(100% - 48px) 48px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0e1535_0%,#24336e_70%,#6d5a9c_100%)] opacity-90" />
      <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] min-h-[180px] w-full opacity-[0.22]" viewBox="0 232 1440 208" preserveAspectRatio="xMidYMax slice">
        <Landmarks fill="#98a6f2" />
        <path d="M0 430 Q180 410 360 428 T720 432 T1080 426 T1440 430 V440 H0 Z" fill="#98a6f2" />
      </svg>

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 pb-10 pt-3 sm:px-8">
        <div className="flex items-center justify-between" style={{ minHeight: HEADER_H - 20 }}>
          <LightWordmark />
          <button
            ref={closeRef}
            type="button"
            onClick={() => {
              onClose();
              returnFocus();
            }}
            aria-label="Close menu"
            className="inline-flex h-12 items-center gap-3 rounded-full border border-white/30 pl-5 pr-4 text-[0.95rem] font-semibold text-white transition-colors hover:bg-white hover:text-[#0e1535]"
          >
            Close <Dashes open />
          </button>
        </div>

        <div className="mt-6 grid flex-1 content-start gap-10 md:mt-8 md:grid-cols-[1.5fr_1fr] md:gap-16">
          <nav aria-label="Sections">
            <ul>
              {MENU.map((m, i) => (
                <li key={m.id} className="menu-item border-b border-white/15" style={step(i)}>
                  <a href={`#${m.id}`} onClick={go(m.id)} className="group flex items-baseline gap-4 py-3 md:gap-6 md:py-3">
                    <span className="w-7 shrink-0 text-[0.8rem] font-semibold tabular-nums text-[#f0b440] md:w-9 md:text-[0.9rem]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="display block text-[1.6rem] leading-[1.1] !text-white transition-all duration-300 ease-out group-hover:translate-x-3 group-hover:!text-[#f0b440] group-focus-visible:translate-x-3 group-focus-visible:!text-[#f0b440] md:text-[2.2rem]">
                        {m.label}
                      </span>
                      <span className="mt-1 block text-[0.9rem] text-white/65 md:text-[1rem]">{m.hint}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="menu-item flex flex-col items-start gap-4 md:pt-4" style={step(MENU.length)}>
            <p className="display max-w-[16ch] text-[1.3rem] leading-[1.2] !text-white md:text-[1.6rem]">{L.headline}</p>
            <p className="max-w-[36ch] text-white/80">{L.ctaNote}</p>
            <ButtonLink href="/new/" className="min-h-14 !bg-[#f0b440] px-8 text-[1.05rem] !text-[#0e1535]" onClick={onClose}>
              {L.start}
            </ButtonLink>
            <a href="#examples" onClick={go("examples")} className="ghost-sweep">
              {L.example}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ landing }: { landing: boolean }) {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false); // the menu is meant to be showing
  const [mounted, setMounted] = useState(false); // the menu is in the page (kept for the closing animation)
  const menuBtn = useRef<HTMLButtonElement>(null);
  // On the landing page the header floats over the dark hero, then turns solid once you scroll.
  const overlay = landing && !scrolled;

  const openMenu = () => {
    setMounted(true);
    // two frames after mounting, so the curtain animates from closed
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), 800);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  const linkBase = "relative inline-flex min-h-11 items-center px-4 text-[0.95rem] font-semibold transition-colors";
  const tone = overlay ? "text-white/90 hover:text-white" : "text-indigo";

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5" style={{ marginBottom: landing ? -HEADER_H : 0 }}>
      <a href="#main" className="sr-only rounded-b-[10px] bg-indigo px-4 py-2 font-semibold text-on-indigo focus:not-sr-only focus:absolute focus:left-4 focus:top-0">
        Skip to content
      </a>
      {/* A floating bar, inset from the screen edge. Glass over the hero, solid once you scroll. */}
      <div
        className={`mx-auto w-full overflow-hidden rounded-[22px] border transition-[background-color,border-color,box-shadow] duration-300 ${landing ? "max-w-6xl" : "max-w-4xl"} ${
          overlay ? "border-white/20 bg-white/10 backdrop-blur-md" : "border-line shadow-[0_10px_30px_-14px_rgba(18,26,61,0.5)] backdrop-blur"
        }`}
        style={overlay ? undefined : { background: "color-mix(in srgb, var(--ground) 94%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-3 pl-5 pr-3" style={{ minHeight: HEADER_H - 20 }}>
          <Link href="/" aria-label="Then & There home" className="inline-flex min-h-12 items-center">
            {overlay ? <LightWordmark /> : <Wordmark size={26} />}
          </Link>

          <nav aria-label="Main" className="flex items-center gap-2">
            {/* On the landing page Privacy lives in the footer; other pages have no footer, so it stays here. */}
            {!landing && (
              <Link href="/about/" className={`${linkBase} ${tone}`}>
                {copy.landing.navPrivacy}
              </Link>
            )}
            {landing && (
              <>
                <span className="hidden sm:block">
                  <ButtonLink href="/new/" className={`min-h-11 whitespace-nowrap px-5 text-[0.95rem] ${overlay ? "!bg-[#f0b440] !text-[#0e1535]" : ""}`}>
                    {copy.landing.headerCta}
                  </ButtonLink>
                </span>
                <button
                  ref={menuBtn}
                  type="button"
                  onClick={openMenu}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  aria-label="Open menu"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[0.95rem] font-semibold transition-colors ${overlay ? "text-white hover:bg-white/15" : "text-indigo hover:bg-cloth"}`}
                >
                  <Dashes open={false} />
                </button>
              </>
            )}
          </nav>
        </div>
      </div>

      {landing && mounted && <MenuPage visible={open} onClose={closeMenu} returnFocus={() => setTimeout(() => menuBtn.current?.focus(), 50)} />}
    </header>
  );
}
