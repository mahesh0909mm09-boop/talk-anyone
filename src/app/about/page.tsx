import PolicyLayout, { PolicySection } from "@/components/talk-anyone/policy-layout";
import Link from "next/link";

export const metadata = { title: "About TALK ANYONE" };

export default function AboutPage() {
  return (
    <PolicyLayout eyebrow="Our story" title="A little hello can go a long way." description="TALK ANYONE is a place to meet someone new through spontaneous conversations, without endlessly scrolling through a feed.">
      <PolicySection title="What is TALK ANYONE?">
        <p>We are building a browser-based stranger chat experience. Visitors can enter a random conversation, use video and text features, and move to a different conversation when they want to.</p>
        <p>People come from different places and backgrounds. A respectful, curious question can make an unfamiliar conversation meaningful.</p>
      </PolicySection>
      <PolicySection title="How to get started">
        <ol className="list-decimal space-y-2 pl-6"><li>Choose <strong>Start chatting</strong> on the homepage.</li><li>Read the safety notice and grant camera or microphone permission if you want to use those features.</li><li>Wait for a match, say hello, and use <strong>Next Stranger</strong> whenever you want to leave.</li></ol>
      </PolicySection>
      <PolicySection title="What makes a good conversation?">
        <p>Simple things: respect boundaries, ask open questions, never pressure someone to share personal details, and leave if the conversation feels uncomfortable. You can report or block inappropriate behavior using the available chat controls.</p>
      </PolicySection>
      <PolicySection title="A note about strangers online">
        <p>We cannot verify what another participant says about themselves or guarantee that every interaction will be safe. Please protect your personal information and do not rely on someone you have just met for financial or personal security decisions.</p>
        <p>Read our <Link className="underline underline-offset-4" href="/community-guidelines">community guidelines</Link> before joining.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
