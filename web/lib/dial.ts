// Illustrative examples for the landing-page time dial only. Real sessions come from Qloo.
// Artists and films change with the decade; places and tastes are rotated from a small set.
import type { KeepsakeData } from "@/components/keepsakes";
import type { BirthDecade } from "./types";

type Era = { artist: string; film: string; year: number };
type Place = {
  key: string;
  label: string;
  region: string; // what we prefill in the builder
  eras: Record<BirthDecade, Era>;
  places: string[];
  tastes: string[];
};

export const DIAL_PLACES: Place[] = [
  {
    key: "mx",
    label: "Mexico City",
    region: "Mexico City, Mexico",
    eras: {
      "1920s": { artist: "Agustín Lara", film: "Ahí está el detalle", year: 1940 },
      "1930s": { artist: "Pedro Infante", film: "Nosotros los pobres", year: 1948 },
      "1940s": { artist: "Pedro Infante", film: "Tizoc", year: 1957 },
      "1950s": { artist: "José José", film: "El Chanfle", year: 1979 },
      "1960s": { artist: "Juan Gabriel", film: "Como agua para chocolate", year: 1992 },
      "1970s": { artist: "Luis Miguel", film: "Amores perros", year: 2000 },
    },
    places: ["Xochimilco", "Palacio de Bellas Artes", "Bosque de Chapultepec", "Plaza Garibaldi"],
    tastes: ["Chocolate Abuelita", "Jarritos", "Mazapán de la Rosa", "Gansito"],
  },
  {
    key: "liv",
    label: "Liverpool",
    region: "Liverpool, UK",
    eras: {
      "1920s": { artist: "Vera Lynn", film: "Brief Encounter", year: 1945 },
      "1930s": { artist: "Lonnie Donegan", film: "Carry On Nurse", year: 1959 },
      "1940s": { artist: "The Beatles", film: "A Hard Day's Night", year: 1964 },
      "1950s": { artist: "The Real Thing", film: "Kes", year: 1969 },
      "1960s": { artist: "Frankie Goes to Hollywood", film: "Letter to Brezhnev", year: 1985 },
      "1970s": { artist: "The La's", film: "The Full Monty", year: 1997 },
    },
    places: ["The Cavern Club", "Mersey Ferry", "New Brighton", "Sefton Park"],
    tastes: ["Bird's Custard", "Vimto", "Typhoo", "Jacob's Cream Crackers"],
  },
  {
    key: "ibd",
    label: "Ibadan",
    region: "Ibadan, Nigeria",
    eras: {
      "1920s": { artist: "Bobby Benson", film: "Casablanca", year: 1942 },
      "1930s": { artist: "Victor Olaiya", film: "The Ten Commandments", year: 1956 },
      "1940s": { artist: "I. K. Dairo", film: "Kongi's Harvest", year: 1970 },
      "1950s": { artist: "King Sunny Adé", film: "Ajani Ogun", year: 1976 },
      "1960s": { artist: "Sir Shina Peters", film: "Living in Bondage", year: 1992 },
      "1970s": { artist: "Lágbájá", film: "Saworoide", year: 1999 },
    },
    places: ["Cocoa House", "Dugbe Market", "Bower's Tower", "Agodi Gardens"],
    tastes: ["Ovaltine", "Bournvita", "Gala", "Peak Milk"],
  },
];

const DECADES: BirthDecade[] = ["1920s", "1930s", "1940s", "1950s", "1960s", "1970s"];

export function eraWindow(d: BirthDecade) {
  const mid = parseInt(d.slice(0, 4), 10) + 5;
  return { from: mid + 10, to: mid + 30, peak: mid + 14 };
}

/** Four keepsakes for the dial. A custom place gets honest placeholders until a real session is built. */
export function dialKeepsakes(decade: BirthDecade, placeKey: string, custom?: string): KeepsakeData[] {
  const p = DIAL_PLACES.find((x) => x.key === placeKey);
  const w = eraWindow(decade);
  if (!p) {
    const city = (custom ?? "").split(",")[0]!.trim() || "Their home town";
    return [
      { kind: "song", title: "Their songs", sub: `Music · ${city}` },
      { kind: "taste", title: "A taste of home", sub: city },
      { kind: "place", title: city, sub: "A place" },
      { kind: "film", title: `Films of ${w.peak}`, sub: "Found when you build", year: w.peak },
    ];
  }
  const e = p.eras[decade];
  const i = DECADES.indexOf(decade);
  return [
    { kind: "song", title: e.artist, sub: `Music · ${p.label}` },
    { kind: "taste", title: p.tastes[i % p.tastes.length]!, sub: p.label },
    { kind: "place", title: p.places[i % p.places.length]!, sub: `A place · ${p.label}` },
    { kind: "film", title: e.film, sub: "", year: e.year },
  ];
}
