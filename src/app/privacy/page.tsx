import PolicyLayout, { PolicySection } from "@/components/talk-anyone/policy-layout";
import Link from "next/link";

export const metadata = { title: "Privacy Policy — TALK ANYONE" };
const CONTACT_EMAIL = "mahesh0909mm09@gmail.com";

export default function PrivacyPage() {
  return (
    <PolicyLayout eyebrow="Privacy and trust" title="Privacy policy" description="How information can be processed when you visit or use TALK ANYONE. Last updated: 25 November 2026.">
      <PolicySection title="Information involved in the service">
        <p>Depending on the features you use, information processed may include account email and profile details, text messages exchanged during a chat, safety reports you submit, and technical information such as IP address, browser/device information, timestamps, and connection diagnostics.</p>
        <p>Camera and microphone access is requested through your browser for live calls. WebRTC connects participants directly when possible and may use relay servers when needed. Other participants may see or hear what you share and may make their own recordings, beyond our control.</p>
      </PolicySection>
      <PolicySection title="Why information is processed">
        <p>Information is used to enable matchmaking and communication, manage accounts where available, investigate reports, detect misuse, maintain security, and operate and improve the service.</p>
      </PolicySection>
      <PolicySection title="Service providers">
        <p>Hosting, account, database, and connectivity providers can process the data necessary to provide their services. TALK ANYONE uses technologies from providers including Vercel, Render, Supabase, and Metered. Their involvement may vary by feature and deployment.</p>
      </PolicySection>
      <PolicySection title="Cookies and advertising">
        <p>Cookies or similar storage may support site features, authentication, security, and analytics. If Google advertising is enabled on eligible public pages, third-party vendors including Google may place or read cookies and use web beacons, IP addresses, or similar identifiers to serve and measure advertising.</p>
        <p>Google and its partners may use advertising cookies to serve ads based on previous visits to this or other websites. You can manage personalized ads through <a className="underline underline-offset-4" href="https://myadcenter.google.com/" target="_blank" rel="noreferrer">Google My Ad Center</a> or visit <a className="underline underline-offset-4" href="https://www.aboutads.info/" target="_blank" rel="noreferrer">aboutads.info</a> for opt-out options offered by participating advertising partners.</p>
        <p>Where legally required, advertising consent choices must be presented before relevant technologies are used. These choices are separate from camera and microphone permission.</p>
      </PolicySection>
      <PolicySection title="Data sharing and retention">
        <p>Chat participants receive information that you choose to share with them. Relevant data may also be available to service providers and safety administrators when needed for operation, security, or investigation. Information may be retained for different periods depending on its purpose, technical logs, account settings, and applicable legal obligations.</p>
        <p>For questions about particular data, correction, deletion, or retention, contact us using the details below. Some records may need to be kept when legally required or necessary to resolve safety incidents.</p>
      </PolicySection>
      <PolicySection title="Your choices and safety">
        <p>You can decline camera and microphone permissions, stop a call, avoid sharing personal details, and use available block and report controls. No online stranger-chat service can guarantee that other users will respect privacy.</p>
        <p>The service is intended for adults aged 18 or older. People under 18 should not use TALK ANYONE.</p>
      </PolicySection>
      <PolicySection title="Contact and updates">
        <p>Privacy questions and data requests can be emailed to <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. The policy may be updated when the site's functionality or data practices change. See our <Link href="/contact" className="underline underline-offset-4">contact page</Link>.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
