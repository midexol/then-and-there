// Suggested questions: an optional LLM writes them; templates are the always-safe fallback.
import { createHash } from "node:crypto";
import type { ItemKind } from "../types.js";
import { questionIsSafe } from "./safety.js";

const TEMPLATES: Record<ItemKind | "taste_place", string[]> = {
  song: [
    "What does this music make you think of?",
    "Where would you hear music like this?",
    "Did anyone you know sing or dance to this?",
    "What was playing on the radio at home?",
  ],
  closing_song: ["Shall we sing along to one together?", "Which of their songs would you like to finish with?"],
  place: [
    "Did you ever go there? Who did you go with?",
    "What was it like there?",
    "What would you see on the way there?",
    "What did people wear to go there?",
  ],
  taste: ["Who in your family liked this?", "Where would you buy this?", "What did it taste like?", "When would you have this?"],
  taste_place: ["What would you order there?", "Who would you go there with?"],
  film: [
    "Where did you go to the pictures?",
    "Who would you go to the cinema with?",
    "Who were the film stars everyone talked about?",
  ],
};

export function templateQuestion(kind: ItemKind, id: string, isPlaceTaste = false): string {
  const list = TEMPLATES[isPlaceTaste ? "taste_place" : kind];
  const n = parseInt(createHash("md5").update(id).digest("hex").slice(0, 6), 16);
  return list[n % list.length]!;
}

export type QuestionRequest = { id: string; kind: ItemKind; title: string; subtitle?: string; year?: number };

export interface Llm {
  readonly model: string;
  writeQuestions(items: QuestionRequest[], ctx: { region: string; era: string; avoidTopics: string[] }): Promise<Record<string, string>>;
}

/** Any OpenAI-compatible chat endpoint. Receives item names, kinds, region and era only. */
export class OpenAiCompatibleLlm implements Llm {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    readonly model: string,
    private timeoutMs = 20_000,
  ) {}

  async writeQuestions(items: QuestionRequest[], ctx: { region: string; era: string; avoidTopics: string[] }) {
    const system = [
      "You write one short, warm conversation starter for each item in a reminiscence session with an older adult.",
      "Rules: invite, never test. Never ask 'Do you remember'. No questions about dates or names they might not know.",
      "Prefer open questions about people, places, senses and feelings. Max 20 words each. Plain language.",
      "Never mention health, memory, illness, death or war.",
      ctx.avoidTopics.length ? `Steer well away from these topics: ${ctx.avoidTopics.join("; ")}.` : "",
      'Return JSON only: {"questions": {"<id>": "<question>"}}. Use only the ids given.',
    ].join("\n");
    const user = JSON.stringify({ region: ctx.region, era: ctx.era, items });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.6,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { questions?: Record<string, unknown> };
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(json.questions ?? {})) if (typeof v === "string") out[k] = v.trim();
      return out;
    } finally {
      clearTimeout(t);
    }
  }
}

/** Picks the LLM question when it is safe and for a known id, else the template. */
export function chooseQuestion(
  llmOut: Record<string, string> | null,
  id: string,
  kind: ItemKind,
  avoidTopics: string[],
  isPlaceTaste = false,
): { prompt: string; promptSource: "llm" | "template" } {
  const q = llmOut?.[id];
  if (q && questionIsSafe(q, avoidTopics)) return { prompt: q, promptSource: "llm" };
  return { prompt: templateQuestion(kind, id, isPlaceTaste), promptSource: "template" };
}
