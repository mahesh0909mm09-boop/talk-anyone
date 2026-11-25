import PolicyLayout, { PolicySection } from "@/components/talk-anyone/policy-layout";

export const metadata = { title: "Community Guidelines — TALK ANYONE" };

export default function CommunityPage() {
  return (
    <PolicyLayout eyebrow="Better conversations" title="Community guidelines" description="The person on the other side of the screen deserves respect. These rules apply to video, audio, text, and profiles.">
      <PolicySection title="Be respectful">
        <p>Don't harass, threaten, bully, intimidate, discriminate against, or target others with hateful language. If a participant says no or wants to leave, respect that boundary.</p>
      </PolicySection>
      <PolicySection title="No nudity or sexual content">
        <p>Nudity, sexually explicit activity, sexual harassment, and solicitation for sexual services are not allowed. Any sexual content involving minors or suspected child exploitation is strictly prohibited.</p>
      </PolicySection>
      <PolicySection title="Protect privacy">
        <p>Do not post or request passwords, precise addresses, payment details, private documents, or someone's personal contact information. Do not impersonate people, threaten to expose them, or share their images or recordings without appropriate consent.</p>
      </PolicySection>
      <PolicySection title="No scams, spam, or dangerous conduct">
        <p>Do not distribute malware, phishing links, fraudulent offers, violent threats, instructions to harm others, or repeated unwanted promotions. Respect intellectual property rights.</p>
      </PolicySection>
      <PolicySection title="Adults only">
        <p>The platform is intended for people aged 18 or older. Do not use it if you are under 18. Never seek or share sexual content involving minors. Report suspected exploitation immediately.</p>
      </PolicySection>
      <PolicySection title="If something goes wrong">
        <p>Use <strong>Next Stranger</strong> to leave a conversation. Use available <strong>Block</strong> and <strong>Report</strong> tools for inappropriate behavior. You may also contact the site operator through the contact page. If someone is in immediate danger, contact local emergency services.</p>
        <p>We may take action in response to violations, but we cannot guarantee that every inappropriate interaction will be prevented or detected.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
