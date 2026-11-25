import PolicyLayout, { PolicySection } from "@/components/talk-anyone/policy-layout";
import Link from "next/link";

export const metadata = { title: "Terms of Use — TALK ANYONE" };
const CONTACT_EMAIL = "mahesh0909mm09@gmail.com";

export default function TermsPage() {
  return (
    <PolicyLayout eyebrow="Using the site" title="Terms of use" description="Basic conditions for using TALK ANYONE. Last updated: 25 November 2026.">
      <PolicySection title="Who may use the service">
        <p>TALK ANYONE is intended for users aged 18 or older. Do not use the platform if you are under 18, or if using the service would violate laws applicable to you.</p>
      </PolicySection>
      <PolicySection title="Respect and lawful behavior">
        <p>You agree not to use the service for harassment, threats, hate, exploitation, sexually explicit conduct, illegal activity, fraud, impersonation, or sharing another person's private information. Do not record or distribute another person's image or conversation without the permissions required by applicable law.</p>
        <p>Please read and follow our <Link href="/community-guidelines" className="underline underline-offset-4">community guidelines</Link>.</p>
      </PolicySection>
      <PolicySection title="Conversations with other users">
        <p>You are responsible for what you send or reveal to another participant. People you meet may misrepresent themselves; TALK ANYONE cannot guarantee another person's identity, behavior, or the accuracy of information they share. Leave and report a conversation that makes you uncomfortable.</p>
      </PolicySection>
      <PolicySection title="Moderation and access">
        <p>We may restrict access, disconnect sessions, review reports, or take other reasonable safety actions when misuse is suspected. Reports do not guarantee an immediate response.</p>
      </PolicySection>
      <PolicySection title="Availability">
        <p>The website may be unavailable because of maintenance, network conditions, or provider outages. We do not promise uninterrupted access or a particular match or connection quality.</p>
      </PolicySection>
      <PolicySection title="Changes and contact">
        <p>Features and these terms may change as the service evolves. If you have questions about the rules, email <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
