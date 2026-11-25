import PolicyLayout, { PolicySection } from "@/components/talk-anyone/policy-layout";

export const metadata = { title: "Contact TALK ANYONE" };
const CONTACT_EMAIL = "mahesh0909mm09@gmail.com";

export default function ContactPage() {
  return (
    <PolicyLayout eyebrow="Get in touch" title="We're listening." description="Questions, feedback, safety concerns, or privacy requests? Here's how to reach the TALK ANYONE operator.">
      <PolicySection title="Contact email">
        <p><a className="break-all font-semibold text-[#3C6544] underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>For the clearest response, include a short subject line such as <strong>Site feedback</strong>, <strong>Privacy request</strong>, or <strong>Safety report</strong>.</p>
        <a className="inline-flex rounded-full bg-[#202824] px-6 py-3 font-semibold text-white" href={`mailto:${CONTACT_EMAIL}?subject=TALK%20ANYONE%20Support`}>Write an email ↗</a>
      </PolicySection>
      <PolicySection title="Reporting a problem">
        <p>When possible, use the <strong>Report</strong> control within the chat. You can also describe the issue by email, including the approximate date/time and what happened. Do not email private images, passwords, or sensitive documents unless truly necessary.</p>
      </PolicySection>
      <PolicySection title="Privacy requests">
        <p>For questions about your personal data or requests to access, correct, or delete account information, email us with the subject <strong>Privacy request</strong>. We may need to verify that the request relates to your account before acting.</p>
      </PolicySection>
      <PolicySection title="Emergency situations">
        <p>Email support is not an emergency service. If you or someone else is in immediate danger, contact local emergency services.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
