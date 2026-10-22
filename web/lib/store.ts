"use client";
// Profiles live only in this browser (localStorage), behind try/catch.
import { useSyncExternalStore } from "react";
import type { AnchorChip, BirthDecade, Profile, Run } from "./types";

const KEY = "then-and-there:profiles:v1";
const listeners = new Set<() => void>();
let cache: Profile[] | null = null;
const EMPTY: Profile[] = [];

function read(): Profile[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: Profile[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep in memory for this visit */
  }
  listeners.forEach((l) => l());
}

export function useProfiles(): Profile[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cache = null;
          l();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useProfile(id: string | null): Profile | undefined {
  const all = useProfiles();
  return id ? all.find((p) => p.id === id) : undefined;
}

export const getProfile = (id: string) => read().find((p) => p.id === id);

export function saveProfile(p: Profile) {
  const all = read();
  const i = all.findIndex((x) => x.id === p.id);
  write(i === -1 ? [p, ...all] : all.map((x) => (x.id === p.id ? p : x)));
}

export function updateProfile(id: string, fn: (p: Profile) => Profile) {
  const p = getProfile(id);
  if (p) saveProfile(fn(p));
}

export function deleteProfile(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function updateRun(id: string, fn: (r: Run) => Run) {
  updateProfile(id, (p) => {
    const runs = [...p.runs];
    const last = runs.at(-1);
    if (last) runs[runs.length - 1] = fn(last);
    return { ...p, runs };
  });
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Example people from three continents. Their anchors resolve through Qloo when first built. */
export const EXAMPLES: { nickname: string; birthDecade: BirthDecade; region: string; anchors: AnchorChip[] }[] = [
  {
    nickname: "Grandma Rosa",
    birthDecade: "1940s",
    region: "Mexico City, Mexico",
    anchors: [
      { text: "Pedro Infante", kind: "music" },
      { text: "bolero", kind: "music" },
      { text: "tamales", kind: "food" },
    ],
  },
  {
    nickname: "Grandpa Ken",
    birthDecade: "1940s",
    region: "Liverpool, UK",
    anchors: [
      { text: "The Beatles", kind: "music" },
      { text: "Cilla Black", kind: "music" },
      { text: "tea", kind: "food" },
    ],
  },
  {
    nickname: "Mama Adunni",
    birthDecade: "1950s",
    region: "Ibadan, Nigeria",
    anchors: [
      { text: "King Sunny Adé", kind: "music" },
      { text: "highlife", kind: "music" },
      { text: "amala", kind: "food" },
    ],
  },
];

export function profileFromExample(i: number): Profile {
  const ex = EXAMPLES[i]!;
  return { id: newId(), ...ex, anchors: ex.anchors.map((a) => ({ ...a })), avoidTopics: [], boost: [], avoid: [], runs: [], createdAt: new Date().toISOString(), example: true };
}

export function eraFor(decade: BirthDecade) {
  const mid = parseInt(decade.slice(0, 4), 10) + 5;
  return { from: mid + 10, to: mid + 30, peak: mid + 14 };
}

export const regionShort = (r: string) => r.split(",")[0]!.trim();

export function relativeDay(iso?: string) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
