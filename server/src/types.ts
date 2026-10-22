// Shared types. Mirrors docs/API_CONTRACT.md. The server never receives a nickname.

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

export type ProfileAnchor = { qlooId?: string; tag?: string; kind: AnchorKind; label: string };

export type ProfileInput = {
  birthDecade: BirthDecade;
  region: string;
  livesNow?: string;
  anchors: ProfileAnchor[];
  boost?: string[];
  avoid?: string[];
  avoidTopics?: string[]; // server-only. NEVER sent to Qloo.
};

export type ItemKind = "song" | "place" | "taste" | "film" | "closing_song";
export type QlooTarget = "artist" | "movie" | "place" | "brand";

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
    qlooType: QlooTarget;
    signals: string[];
    demographic?: string;
    location?: string;
  };
  links: { label: string; url: string }[];
  alternates: number;
};

export type EraWindow = { from: number; to: number; peak: number };

export type Session = {
  id: string;
  createdAt: string;
  eraWindow: EraWindow;
  items: SessionItem[];
  notes: string[];
};

export type StepKey = "resolve" | "songs" | "films" | "places" | "tastes" | "rank" | "compose";

export type ErrorCode = "qloo_busy" | "qloo_auth" | "llm_down" | "thin_data" | "bad_input";

export type SseEvent =
  | { event: "step"; data: { key: StepKey; label?: string; state: "start" | "done"; count?: number } }
  | { event: "session"; data: Session }
  | { event: "error"; data: { code: ErrorCode; message: string; retryable: boolean } };
