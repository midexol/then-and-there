"use client";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BtnProps = { variant?: "primary" | "secondary" | "quiet"; full?: boolean } & ComponentProps<"button">;

const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-[1rem] font-semibold transition-colors disabled:cursor-not-allowed";
const variants = {
  primary: "bg-indigo text-on-indigo hover:opacity-90 disabled:bg-line disabled:text-ink-soft",
  secondary: "border-2 border-indigo text-indigo hover:bg-cloth disabled:opacity-50",
  quiet: "text-indigo underline-offset-4 hover:underline px-2 disabled:opacity-50",
};

export function Button({ variant = "primary", full, className = "", ...p }: BtnProps) {
  return <button className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`} {...p} />;
}

export function ButtonLink({ variant = "primary", full, className = "", ...p }: { variant?: keyof typeof variants; full?: boolean } & ComponentProps<typeof Link>) {
  return <Link className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`} {...p} />;
}

export function Page({ children, narrow = true, className = "" }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return <main id="main" className={`mx-auto w-full ${narrow ? "max-w-xl" : "max-w-5xl"} px-5 pb-16 ${className}`}>{children}</main>;
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="no-print mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-5 pt-3">
      <div className="flex items-center">{left}</div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-12 items-center gap-1 font-semibold text-indigo">
      <span aria-hidden>‹</span> {children}
    </Link>
  );
}

export function Pill({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cloth px-3 py-1 text-[0.875rem] text-indigo">
      {label && <b>{label}</b>}
      {label && <span aria-hidden>·</span>}
      {children}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "gold"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-l-4 border-err bg-card text-ink"
      : tone === "gold"
        ? "border-l-4 border-gold bg-card text-ink"
        : "bg-cloth text-ink";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-[0.95rem] leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}
