import type { FastifyInstance } from "fastify";

const privacyHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>C2Coach Privacy Policy</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f5f7f4; color: #132019; line-height: 1.65; }
    main { max-width: 820px; margin: 0 auto; padding: 48px 24px 72px; }
    article { background: #fff; border: 1px solid #dbe5dc; border-radius: 20px; padding: 36px; box-shadow: 0 12px 36px rgba(13, 45, 29, .08); }
    h1, h2 { color: #0b3d2a; line-height: 1.25; }
    h1 { margin-top: 0; font-size: clamp(2rem, 5vw, 3rem); }
    h2 { margin-top: 2rem; font-size: 1.25rem; }
    a { color: #087a55; }
    .meta { color: #52645a; }
    .brand { color: #087a55; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    @media (max-width: 600px) { main { padding: 20px 12px 48px; } article { padding: 24px 20px; border-radius: 14px; } }
  </style>
</head>
<body>
<main>
  <article>
    <div class="brand">C2Coach</div>
    <h1>Privacy Policy</h1>
    <p class="meta"><strong>Effective date:</strong> 29 October 2026</p>
    <p>C2Coach is a business communication practice application operated in India. This policy explains how C2Coach collects, uses, shares and protects information when you use the mobile application and related services.</p>

    <h2>Information we collect</h2>
    <ul>
      <li><strong>Account information:</strong> name, email address, authentication details and account-security records.</li>
      <li><strong>Profile and learning preferences:</strong> job title, function, career level, industry, audience, goals and selected programmes.</li>
      <li><strong>Practice information:</strong> scenario selections, written or spoken responses, transcripts, feedback, scores, progress and session history.</li>
      <li><strong>Voice information:</strong> microphone audio is collected only when you start a voice feature. Audio and transcripts may be processed to provide coaching and feedback.</li>
      <li><strong>Subscription information:</strong> plan, entitlement and transaction status. Payment-card details are handled by the applicable app store and are not stored by C2Coach.</li>
      <li><strong>Technical information:</strong> app version, device and operating-system information, diagnostic events, security logs and service usage needed to operate and protect the service.</li>
    </ul>

    <h2>How we use information</h2>
    <p>We use information to create and secure accounts; personalise exercises; provide voice, AI-assisted coaching and assessments; measure progress; manage subscriptions and allowances; provide support; prevent fraud and abuse; diagnose problems; and comply with legal obligations.</p>

    <h2>AI and voice processing</h2>
    <p>Practice responses, transcripts and relevant profile context may be sent to contracted AI or voice-processing providers to generate coaching, feedback or speech features. C2Coach does not sell personal information. Automated feedback is provided for communication practice and should not be treated as professional, legal, medical, financial or employment advice.</p>

    <h2>Service providers</h2>
    <p>We may use service providers for cloud hosting, databases and authentication, AI processing, analytics, email delivery and app-store billing. These providers process information on our behalf under their own security and privacy obligations. Current providers may include Vercel, Supabase, OpenAI, Google and Apple where their services are enabled.</p>

    <h2>Sharing</h2>
    <p>We share information only with service providers needed to operate C2Coach, when you direct us to share it, to protect users and the service, or when required by law. We do not sell or rent personal information.</p>

    <h2>Retention and deletion</h2>
    <p>We retain information only for as long as needed to provide the service, maintain security and transaction records, resolve disputes and meet legal obligations. You can request account deletion through the application or by contacting us. Some records may be retained where legally required or necessary to prevent fraud.</p>

    <h2>Security</h2>
    <p>We use reasonable administrative, technical and organisational safeguards. No internet service can guarantee absolute security, so you should use a strong password and protect access to your device and email account.</p>

    <h2>Your choices and rights</h2>
    <p>You may access and update profile information in the app, control microphone permission in device settings, request correction or deletion of personal information, and withdraw optional permissions. Depending on applicable law, additional rights may apply.</p>

    <h2>Children</h2>
    <p>C2Coach is intended for working professionals and is not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>

    <h2>International processing</h2>
    <p>Service providers may process information in countries outside India. Where required, we use appropriate safeguards for cross-border processing.</p>

    <h2>Changes to this policy</h2>
    <p>We may update this policy as C2Coach develops. We will publish the revised policy with a new effective date and provide additional notice when required.</p>

    <h2>Contact</h2>
    <p>For privacy questions or requests, contact <a href="mailto:support@c2coach.work">support@c2coach.work</a>.</p>
    <p>Website: <a href="https://c2coach.work">https://c2coach.work</a>.</p>
  </article>
</main>
</body>
</html>`;

const accountDeletionHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delete your C2Coach account</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f5f7f4; color: #132019; line-height: 1.65; }
    main { max-width: 820px; margin: 0 auto; padding: 48px 24px 72px; }
    article { background: #fff; border: 1px solid #dbe5dc; border-radius: 20px; padding: 36px; box-shadow: 0 12px 36px rgba(13, 45, 29, .08); }
    h1, h2 { color: #0b3d2a; line-height: 1.25; }
    h1 { margin-top: 0; font-size: clamp(2rem, 5vw, 3rem); }
    h2 { margin-top: 2rem; font-size: 1.25rem; }
    a { color: #087a55; }
    .brand { color: #087a55; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    @media (max-width: 600px) { main { padding: 20px 12px 48px; } article { padding: 24px 20px; border-radius: 14px; } }
  </style>
</head>
<body>
<main>
  <article>
    <div class="brand">C2Coach</div>
    <h1>Delete your account and data</h1>
    <p>C2Coach users can permanently delete their account from the Android or iOS application.</p>

    <h2>Delete your account in the app</h2>
    <ol>
      <li>Sign in to C2Coach.</li>
      <li>Open <strong>Settings</strong>.</li>
      <li>Select <strong>Delete account</strong>.</li>
      <li>Review the warning and select <strong>Delete permanently</strong>.</li>
    </ol>

    <h2>If you cannot access the app</h2>
    <p>Email <a href="mailto:support@c2coach.work?subject=C2Coach%20account%20deletion%20request">support@c2coach.work</a> from the address used for your C2Coach account. Use the subject “C2Coach account deletion request”. We may ask you to verify account ownership before processing the request.</p>

    <h2>Data deleted</h2>
    <p>Deletion removes the C2Coach account, profile and learning preferences, authentication sessions, practice conversations and responses, feedback and scores, progress records, voice-session records, and subscription entitlement links associated with the account.</p>

    <h2>Data that may be retained</h2>
    <p>Limited transaction, fraud-prevention, security or legal-compliance records may be retained where required by law or reasonably necessary to protect users and the service. App-store purchase records remain subject to Google Play or Apple retention rules. Any retained records are restricted to those purposes and are not used to continue the deleted account.</p>
  </article>
</main>
</body>
</html>`;

export function register(app: FastifyInstance) {
  app.get("/privacy", { config: { rateLimit: false } }, async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(privacyHtml);
  });
  app.get("/account-deletion", { config: { rateLimit: false } }, async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(accountDeletionHtml);
  });
}

