export type LegalDoc = 'terms' | 'privacy' | 'refund';

const DOC_HREF: Record<LegalDoc, string> = {
  terms: '../terms/',
  privacy: '../privacy/',
  refund: '../refund/',
};

/**
 * A link to another legal doc. Standalone (public site) renders a real
 * relative href between the static-exported pages. Inline (inside the
 * Electron app) renders a button that swaps the in-app view instead —
 * a real <a> there would navigate the whole app window off its React tree.
 */
export function CrossLink({
  doc,
  onCrossLink,
  children,
}: {
  doc: LegalDoc;
  onCrossLink?: (doc: LegalDoc) => void;
  children: React.ReactNode;
}) {
  if (onCrossLink) {
    return (
      <button type="button" onClick={() => onCrossLink(doc)} className="underline underline-offset-2">
        {children}
      </button>
    );
  }
  return <a href={DOC_HREF[doc]}>{children}</a>;
}

export function TermsBody({ onCrossLink }: { onCrossLink?: (doc: LegalDoc) => void }) {
  return (
    <>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the SPARK Engine desktop
        application, its accompanying website, and any related services (together,
        &ldquo;SPARK Engine&rdquo; or the &ldquo;Service&rdquo;), operated by Team Stack Don't Overflow
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By downloading, installing, or
        using SPARK Engine, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. What SPARK Engine is</h2>
      <p>
        SPARK Engine is a desktop application that lets you ask questions about your data — CSV
        files, spreadsheets, or connected databases — in plain English or by voice, and get back
        answers, charts, and the underlying SQL. Query execution happens locally on your machine
        using an embedded DuckDB engine. Depending on the privacy level you choose and your
        subscription tier, generating the SQL and speaking answers back to you may involve sending
        limited information to third-party AI providers, as described in full in our{' '}
        <CrossLink doc="privacy" onCrossLink={onCrossLink}>Privacy Policy</CrossLink>.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You sign in to SPARK Engine with your Google account through our authentication provider.
        You are responsible for maintaining the security of that account and for all activity that
        occurs under it. You must be at least 18 years old, or the age of legal majority in your
        jurisdiction, to create an account.
      </p>

      <h2>3. Subscription plans and billing</h2>
      <p>
        SPARK Engine is offered under several tiers (FREE, IGNITE, BLAZE, STORM, and THUNDER), each
        with its own quotas, feature set, and price, as described on our pricing screen. Key
        points:
      </p>
      <ul>
        <li>
          Paid plans are billed in advance on a monthly or yearly cycle and renew automatically
          until cancelled.
        </li>
        <li>
          Payments are processed by <strong>Razorpay</strong>, a third-party payment gateway. We do
          not receive or store your card, UPI, or bank account details — Razorpay handles that
          directly under its own security and compliance obligations.
        </li>
        <li>
          You can cancel or change your plan at any time from within the app&apos;s Pricing screen.
          Cancellation stops future renewals; it does not retroactively refund the current billing
          period. Full details are in our{' '}
          <CrossLink doc="refund" onCrossLink={onCrossLink}>Refund &amp; Cancellation Policy</CrossLink>.
        </li>
        <li>
          We may change tier pricing or included quotas going forward. If a change affects an
          active subscription, we will make reasonable efforts to notify you before your next
          renewal.
        </li>
      </ul>

      <h2>4. API keys and third-party providers</h2>
      <p>
        On the FREE, IGNITE, BLAZE, and STORM tiers, SPARK Engine is <strong>bring-your-own-key</strong>:
        you supply your own API keys for the AI providers it uses (currently Groq for SQL
        generation and Deepgram for voice), and any usage costs charged by those providers are
        between you and them — we do not bill you for them and are not a party to your agreement
        with those providers.
      </p>
      <p>
        On the THUNDER tier, we provide managed Groq and Deepgram keys as part of the subscription,
        subject to fair-use limits described in the app. Managed keys remain our property; you may
        not extract, share, or use them outside of SPARK Engine.
      </p>

      <h2>5. Your data and content</h2>
      <p>
        You retain all ownership rights to the data you connect to or import into SPARK Engine.
        We do not claim any ownership over your files, database contents, or query results. As
        described in our Privacy Policy, your underlying data is processed locally by default and
        is not uploaded to servers we operate.
      </p>
      <p>
        You are responsible for ensuring you have the right to use and analyze any data you connect
        to the Service, and for complying with any laws or agreements that apply to that data
        (for example, data protection obligations owed to your own customers or employees).
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or to process data you do not have the right to process.</li>
        <li>Attempt to reverse-engineer, decompile, or extract the managed API keys or proprietary models bundled with the Service.</li>
        <li>Circumvent or attempt to circumvent quota, rate, or tier-based feature limits.</li>
        <li>Use automated means to abuse, overload, or scrape the Service or its infrastructure.</li>
        <li>Resell, sublicense, or provide the Service to third parties as your own product.</li>
      </ul>

      <h2>7. Accuracy of AI-generated results</h2>
      <p>
        SPARK Engine uses AI models to translate your questions into SQL and to summarize results.
        These models can make mistakes. <strong>Generated SQL and answers are provided for your
        convenience and are not guaranteed to be accurate, complete, or fit for any particular
        purpose.</strong> You are responsible for reviewing and validating any query, result, or
        conclusion before relying on it, especially for financial, medical, legal, or other
        high-stakes decisions.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        SPARK Engine, its name, logo, and underlying software are owned by Team Stack Don't Overflow and
        protected by applicable intellectual property laws. These Terms do not grant you any right
        to use our trademarks or branding except as necessary to describe your use of the Service.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
        warranties of any kind, whether express or implied, including implied warranties of
        merchantability, fitness for a particular purpose, and non-infringement. We do not warrant
        that the Service will be uninterrupted, error-free, or secure.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Team Stack Don't Overflow will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or any loss of data,
        profits, or revenue, arising out of or related to your use of the Service. Our total
        liability for any claim arising from these Terms or the Service will not exceed the amount
        you paid us in the twelve months preceding the claim.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate your access if you materially breach these Terms, including through abusive use
        of managed API keys or attempts to circumvent tier limits. Provisions that by their nature
        should survive termination (ownership, disclaimers, limitation of liability) will survive.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material changes, we will update
        the &ldquo;Last updated&rdquo; date above and, where practical, notify you in-app. Continued
        use of the Service after changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-law
        principles. Any dispute arising from these Terms or the Service will be subject to the
        exclusive jurisdiction of the courts located in India.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms can be sent to{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a>.
      </p>
    </>
  );
}
