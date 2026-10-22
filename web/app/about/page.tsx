import { Logo } from "@/components/brand";
import { BackLink, Page, TopBar } from "@/components/ui";
import { copy } from "@/lib/copy";

export default function About() {
  const a = copy.about;
  return (
    <>
      <TopBar left={<BackLink href="/">Home</BackLink>} />
      <Page>
        <h1 className="mt-4 text-[2rem] leading-[1.15]">{a.title}</h1>
        <p className="mt-2 text-ink-soft">{a.sub}</p>

        <section className="mt-6 rounded-[16px] border border-line bg-card p-4">
          <h2 className="font-bold text-indigo" style={{ fontFamily: "var(--font-body)", fontSize: "1rem" }}>
            {a.sentTitle}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {a.sent.map((t) => (
              <li key={t}>
                <span aria-hidden className="text-ok">✓</span> {t}
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-3 rounded-[16px] border border-line bg-card p-4">
          <h2 className="font-bold text-ink" style={{ fontFamily: "var(--font-body)", fontSize: "1rem" }}>
            {a.neverTitle}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {a.never.map((t) => (
              <li key={t}>
                <span aria-hidden className="text-err">✕</span> {t}
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-4 rounded-[16px] bg-cloth p-4">{a.local}</p>
        <p className="mt-4 border-l-4 border-gold pl-3">{a.medical}</p>
        <p className="mt-4 text-[0.95rem] text-ink-soft">{a.llm}</p>

        <p className="mt-12 flex items-center gap-2 text-[0.875rem] text-ink-soft">
          <Logo size={20} /> {a.credit}
        </p>
      </Page>
    </>
  );
}
