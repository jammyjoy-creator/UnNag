import Link from "next/link";
import { LandingQr } from "@/components/LandingQr";

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(47,122,85,0.18),transparent),radial-gradient(ellipse_60%_40%_at_90%_10%,rgba(196,92,38,0.12),transparent)]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-2xl font-semibold tracking-tight">UnNag</p>
        <Link
          href="/vault"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-fog"
        >
          Open vault
        </Link>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-moss">
            Asynchronous household logistics
          </p>
          <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            End nagging. Send tasks anytime.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink/65">
            Your partner gets them only during their free windows — as a
            call-style drop with an optional 5-second voice note. No essays.
            No interruption mid-meeting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/vault"
              className="rounded-2xl bg-clay px-5 py-3 text-sm font-semibold text-white"
            >
              Start on phone → /vault
            </Link>
            <a
              href="#pricing"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold ring-1 ring-ink/10"
            >
              Pricing
            </a>
          </div>
        </div>

        <div className="justify-self-center rounded-[2rem] bg-white/70 p-8 shadow-sm ring-1 ring-ink/5 backdrop-blur">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-ink/45">
            Scan → install PWA
          </p>
          <LandingQr />
        </div>
      </section>

      <section className="relative border-t border-ink/5 bg-white/40 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {[
            {
              title: "Quiet windows",
              body: "Morning and evening slots you choose. Outside them, drops wait silently in the queue.",
            },
            {
              title: "5-second voice",
              body: "Hold to record. Soft cue at 3s, hard stop at 5s. “Liam to school at 5” — not a WhatsApp novel.",
            },
            {
              title: "Call-style alert",
              body: "When a window opens, UnNag rings like an incoming drop. Accept, snooze, or play the voice note.",
            },
          ].map((item) => (
            <article key={item.title}>
              <h2 className="font-display text-2xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-ink/60">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold">Pricing</h2>
          <p className="mt-2 max-w-xl text-ink/60">
            Built to run on free tiers. No App Store cut.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-ink p-8 text-fog">
              <p className="text-sm uppercase tracking-[0.16em] text-ring">Household</p>
              <p className="mt-3 font-display text-4xl font-semibold">$0</p>
              <ul className="mt-6 space-y-2 text-fog/75">
                <li>Unlimited queued drops</li>
                <li>5s voice notes + call overlay</li>
                <li>Partner invite codes</li>
                <li>Web Push quiet-window alerts</li>
              </ul>
              <Link
                href="/vault"
                className="mt-8 inline-flex rounded-2xl bg-fog px-5 py-3 text-sm font-semibold text-ink"
              >
                Use free forever
              </Link>
            </div>
            <div className="rounded-3xl bg-white p-8 ring-1 ring-ink/10">
              <p className="text-sm uppercase tracking-[0.16em] text-ink/45">Later</p>
              <p className="mt-3 font-display text-4xl font-semibold text-ink/35">—</p>
              <p className="mt-6 text-ink/55">
                Optional paid tier later for multi-home / family packs. Core UnNag
                stays free for couples and roommates.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/5 py-10 text-center text-sm text-ink/45">
        UnNag · household-vault · scan the QR, add to Home Screen, stop nagging.
      </footer>
    </main>
  );
}
