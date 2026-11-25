
import Link from "next/link";

const features = [
  {
    symbol: "🎥",
    title: "See who you're talking to",
    description:
      "Have face-to-face conversations through random video chat.",
  },
  {
    symbol: "💬",
    title: "Words work too",
    description:
      "Not in the mood for video? Get to know someone through text.",
  },
  {
    symbol: "🔀",
    title: "A new hello, anytime",
    description:
      "Move to another conversation whenever you're ready.",
  },
];

const steps = [
  {
    number: "01",
    title: "Say hello",
    description:
      "Open stranger chat and agree to the community guidelines.",
  },
  {
    number: "02",
    title: "Start talking",
    description:
      "Get matched with another person and see where the conversation goes.",
  },
  {
    number: "03",
    title: "Keep exploring",
    description:
      "Enjoy the conversation or move on to meet someone new.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F5EE] text-[#202824]">
      {/* NAVIGATION */}
      <header className="border-b border-[#202824]/10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-extrabold tracking-tight"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202824] text-xl text-[#D8F38D]">
              ✳
            </span>
            talk anyone<span className="text-[#71915C]">.</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#how-it-works" className="hover:text-[#71915C]">
              How it works
            </a>
            <a href="#features" className="hover:text-[#71915C]">
              Features
            </a>
            <a href="#safety" className="hover:text-[#71915C]">
              Our community
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-semibold hover:text-[#71915C] sm:block"
            >
              Log in
            </Link>

            <Link
              href="/chat"
              className="rounded-full bg-[#202824] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5144]"
            >
              Start chatting
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#E5EDD3] px-4 py-2 text-xs font-semibold text-[#486541] sm:text-sm">
              <span>✳</span>
              A little less scrolling. A little more talking.
            </div>

            <h1 className="max-w-xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Everyone has a story.
              <span className="mt-2 block text-[#718F5A]">
                Go hear one.
              </span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-8 text-[#626A62]">
              A simple place to meet someone new, share a laugh,
              ask a question, or just talk about life.
              Sometimes a little hello goes a long way.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/chat"
                className="rounded-full bg-[#202824] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#202824]/10 transition hover:-translate-y-0.5 hover:bg-[#3D5144]"
              >
                Start a conversation ↗
              </Link>

              <a
                href="#how-it-works"
                className="rounded-full border border-[#202824]/20 px-7 py-4 text-base font-semibold transition hover:bg-[#EBEADC]"
              >
                How it works
              </a>
            </div>

            <p className="mt-6 flex items-center gap-2 text-sm text-[#727970]">
              <span className="text-[#638751]">✓</span>
              No account needed for stranger chat
            </p>
          </div>

          {/* EXAMPLE CONVERSATION */}
          <div className="relative mx-auto w-full max-w-lg">
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#DCE9C4]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-8 -left-8 h-44 w-44 rounded-full bg-[#F0DCC2]"
            />

            <div className="relative rounded-[32px] border border-[#E1DED2] bg-white p-5 shadow-2xl shadow-[#202824]/10 sm:p-8">
              <div className="mb-7 flex items-center justify-between border-b border-[#F0EEE7] pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EFD8] text-xl">
                    💬
                  </div>

                  <div>
                    <h2 className="text-base font-bold">
                      The art of saying hello
                    </h2>
                    <p className="text-xs text-[#80877C]">
                      Example conversation
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-[#F2F5EC] px-3 py-1 text-xs text-[#668456]">
                  A little moment
                </span>
              </div>

              <div className="space-y-5">
                <div className="flex items-end gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2DABB] text-sm">
                    🙂
                  </div>

                  <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-[#F2F0E9] px-4 py-4 text-sm leading-6">
                    Hey! What&apos;s one good thing that happened
                    to you today?
                  </div>
                </div>

                <div className="flex items-end justify-end gap-3">
                  <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-[#D9EFAB] px-4 py-4 text-sm leading-6">
                    I finally finished something I&apos;ve been
                    working on for weeks 😄
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9EFAB] text-sm">
                    😎
                  </div>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2DABB] text-sm">
                    🙂
                  </div>

                  <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-[#F2F0E9] px-4 py-4 text-sm leading-6">
                    That&apos;s awesome! Tell me about it.
                  </div>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between rounded-2xl border border-[#E8E8E0] bg-[#FAFAF7] px-4 py-4">
                <span className="text-sm text-[#A1A69C]">
                  Every conversation starts somewhere...
                </span>
                <span className="text-[#718F5A]">✳</span>
              </div>
            </div>

            <div className="relative -mt-3 ml-5 inline-flex -rotate-3 items-center gap-2 rounded-xl bg-[#202824] px-5 py-3 text-sm font-semibold text-white shadow-lg">
              ✨ A stranger could make your day.
            </div>
          </div>
        </div>
      </section>

      {/* VALUES STRIP */}
      <section className="border-y border-[#202824]/10 bg-[#EFEDE4]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-12 gap-y-4 px-5 py-6 text-sm font-semibold text-[#626B60]">
          <span>✳ Real conversations</span>
          <span>✳ New perspectives</span>
          <span>✳ Your choice to connect</span>
          <span>✳ Respect comes first</span>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8"
      >
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[#718F5A]">
            Made for conversations
          </p>

          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Less complicated.
            <br />
            More connection.
          </h2>

          <p className="mt-5 text-lg leading-8 text-[#697066]">
            No endless feeds. Just an easy way to start talking
            to someone you haven&apos;t met yet.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`rounded-[28px] border border-[#E4E2D7] p-8 ${
                index === 1 ? "bg-[#E7EDD9]" : "bg-white"
              }`}
            >
              <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F2EA] text-3xl">
                {feature.symbol}
              </div>

              <h3 className="text-2xl font-bold tracking-tight">
                {feature.title}
              </h3>

              <p className="mt-4 leading-7 text-[#677064]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="bg-[#202824] px-5 py-24 text-white sm:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[#D9EFAB]">
              The simple part
            </p>

            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Three steps.
              <br />
              A world of conversations.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-[28px] border border-white/15 bg-white/5 p-8"
              >
                <p className="text-5xl font-extrabold text-[#D9EFAB]">
                  {step.number}
                </p>

                <h3 className="mt-8 text-2xl font-bold">
                  {step.title}
                </h3>

                <p className="mt-4 leading-7 text-[#C0C9C0]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAFETY */}
      <section
        id="safety"
        className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2"
      >
        <div>
          <span className="mb-5 inline-block rounded-2xl bg-[#E7EDD9] p-5 text-4xl">
            🤝
          </span>

          <h2 className="max-w-lg text-4xl font-extrabold tracking-tight sm:text-5xl">
            Good conversations start with respect.
          </h2>

          <p className="mt-6 max-w-lg text-lg leading-8 text-[#697066]">
            Remember there&apos;s a real person on the other
            side of the screen. Be kind, respect boundaries,
            and don&apos;t share sensitive personal information.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              title: "Be yourself. Be respectful.",
              description:
                "Treat people the way you'd want to be treated.",
            },
            {
              title: "Your privacy matters.",
              description:
                "Avoid sharing your address, passwords, phone number, or other private details.",
            },
            {
              title: "You're in control.",
              description:
                "Use Next Stranger, Block, or Report if a conversation makes you uncomfortable.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-[#E2E2D9] bg-white p-6"
            >
              <span className="text-xl text-[#718F5A]">✓</span>

              <div>
                <h3 className="font-bold">{item.title}</h3>
                <p className="mt-2 leading-6 text-[#737B70]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#DCEBBF] px-6 py-16 text-center sm:px-12">
          <div className="mb-5 text-4xl">✳</div>

          <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Somebody out there has a story worth hearing.
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-lg text-[#596952]">
            Ready when you are. Your next conversation starts
            with a hello.
          </p>

          <Link
            href="/chat"
            className="mt-9 inline-block rounded-full bg-[#202824] px-9 py-4 font-bold text-white transition hover:bg-[#3D5144]"
          >
            Let&apos;s talk ↗
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#202824]/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row">
          <div>
            <p className="font-extrabold">talk anyone.</p>
            <p className="mt-1 text-xs text-[#747D71]">
              A place for new conversations.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-[#718F5A]">
              Home
            </Link>
            <Link href="/chat" className="hover:text-[#718F5A]">
              Chat
            </Link>
            <Link href="/login" className="hover:text-[#718F5A]">
              Log in
            </Link>
          </div>

          <p className="text-xs text-[#747D71]">
            © 2026 TALK ANYONE
          </p>
        </div>
                <nav aria-label="Site information" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[#647164]">
            <a href="/about" className="hover:underline">About</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/community-guidelines" className="hover:underline">Community guidelines</a>
            <a href="/contact" className="hover:underline">Contact</a>
          </nav>
</footer>
    </main>
  );
}

