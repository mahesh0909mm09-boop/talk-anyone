import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PolicySection({title, children}: {title: string; children: ReactNode}) {
  return (
    <section className="border-b border-[#DADFD1] pb-8 last:border-b-0 last:pb-0">
      <h2 className="text-xl font-bold tracking-tight text-[#202824] sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-[#58645A]">{children}</div>
    </section>
  );
}

export default function PolicyLayout({eyebrow,title,description,children}: Props) {
  return (
    <main className="min-h-screen bg-[#F7F5EE] text-[#202824]">
      <header className="border-b border-[#202824]/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-xl font-extrabold tracking-tight">✳ talk anyone<span className="text-[#718F5A]">.</span></Link>
          <Link href="/chat" className="rounded-full bg-[#202824] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3D5144]">Start chatting</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#718F5A]">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-[#657066]">{description}</p>
        </div>
        <div className="mt-10 max-w-4xl space-y-9 rounded-[28px] border border-[#E0E4DA] bg-white p-6 shadow-sm sm:p-10">{children}</div>
      </div>
      <footer className="border-t border-[#202824]/10 px-5 py-8">
        <nav aria-label="Site information" className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/community-guidelines">Community guidelines</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="mt-5 text-center text-xs text-[#6D786D]">TALK ANYONE · Conversations with respect</p>
      </footer>
    </main>
  );
}
