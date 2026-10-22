// Mirrors server/src/types.ts and docs/API_CONTRACT.md.
export type AnchorKind = "music" | "food" | "film_tv" | "place" | "work_hobby";
export const BIRTH_DECADES = ["1920s", "1930s", "1940s", "1950s", "1960s", "1970s"] as const;
export type BirthDecade = (typeof BIRTH_DECADES)[number];

export type Candidate = { qlooId: string; name: string; type: string; subtitle?: string };
export type ResolvedAnchor = {
  text: string;
  kind: AnchorKind;
  status: "matched" | "choose" | "none";
  match?: Candidate;
  candidates?: Candidate[];
  tag?: string;
};

/** A chip in the builder. `status` is missing while it resolves (or for example people, until built). */
export type AnchorChip = Omit<ResolvedAnchor, "status"> & { status?: ResolvedAnchor["status"] | "error" };

export type ItemKind = "song" | "place" | "taste" | "film" | "closing_song";
export type SessionItem = {
  id: string;
  slot: number;
  kind: ItemKind;
  title: string;
  subtitle?: string;
  year?: number;
  why: string;
  prompt: string;
  promptSource: "llm" | "template";
  provenance: {
    source: "qloo";
    operation: string;
    qlooId: string;
    qlooType: "artist" | "movie" | "place" | "brand";
    signals: string[];
    demographic?: string;
    location?: string;
  };
  links: { label: string; url: string }[];
  alternates: number;
};
export type EraWindow = { from: number; to: number; peak: number };
export type Session = { id: string; createdAt: string; eraWindow: EraWindow; items: SessionItem[]; notes: string[] };

export type Response = "yes" | "little" | "no";
export type Run = {
  session: Session;
  startedAt?: string;
  endedAt?: string;
  responses: Record<string, Response>;
  note?: string;
};

export type Profile = {
  id: string;
  nickname: string; // stays in this browser. Never sent anywhere.
  birthDecade: BirthDecade;
  region: string;
  livesNow?: string;
  anchors: AnchorChip[];
  avoidTopics: string[];
  boost: string[];
  avoid: string[];
  runs: Run[];
  createdAt: string;
  example?: boolean;
};

export type StepKey = "resolve" | "songs" | "films" | "places" | "tastes" | "rank" | "compose";
export type ErrorCode = "qloo_busy" | "qloo_auth" | "llm_down" | "thin_data" | "bad_input" | "network" | "not_found";
