import type { LegalDoc } from './TermsBody';

// No cross-links to other legal docs appear in this one, but the prop is
// accepted for a consistent interface with TermsBody / RefundBody.
export function PrivacyBody(_props: { onCrossLink?: (doc: LegalDoc) => void }) {
  return (
    <>
      <p>
        This Privacy Policy explains what SPARK Engine (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects
        when you use the SPARK Engine desktop application and website, and — because this product
        is built around a local-first design — goes into more technical detail than most privacy
        policies about exactly what data leaves your machine, when, and in what form. If anything
        here conflicts with marketing copy elsewhere, this page is authoritative.
      </p>

      <h2>1. Account data</h2>
      <p>
        You sign in with Google, through AWS Cognito (our authentication provider). We receive your
        name, email address, and a stable account identifier from Google — we never see or store
        your Google password. This account data is stored in our AWS infrastructure (Mumbai, India
        region) and is used solely to identify your account, associate it with a subscription tier,
        and enforce usage quotas.
      </p>

      <h2>2. Billing data</h2>
      <p>
        Subscription payments are handled by <strong>Razorpay</strong>. We store only the metadata
        needed to know what plan you&apos;re on and whether your subscription is active — plan
        name, billing cycle, subscription status, and payment/order identifiers. We do not receive
        or store your card number, UPI ID, or bank details; those are handled entirely within
        Razorpay&apos;s own PCI-compliant systems.
      </p>

      <h2>3. Usage counters</h2>
      <p>
        To enforce the query limits attached to your tier, we store a small usage record per
        account — a count of queries run this month and today, and when those counters last reset.
        We do <strong>not</strong> store the content of your questions or query results as part of
        this record; it is purely numeric.
      </p>

      <h2>4. Your actual data: CSVs, spreadsheets, and databases</h2>
      <p>
        Any file or database you connect to SPARK Engine is imported into a <strong>local DuckDB
        instance running on your own machine</strong>. We do not upload, store, or have access to
        this data on any server we operate. It exists only on your device and is cleared when you
        disconnect the source (or, for CSV imports, when you remove the file).
      </p>

      <h2>5. What we send to AI providers — and what we don&apos;t</h2>
      <p>
        Turning a plain-English question into SQL, and reading an answer back to you, uses
        third-party AI models. Exactly what leaves your machine to make that happen depends on the
        <strong> privacy level</strong> you choose in Settings, and on your subscription tier. We
        designed this to be the one part of the product where the technical detail actually matters,
        so here it is in full:
      </p>

      <h3>Standard (default)</h3>
      <ul>
        <li>
          Your question, your database&apos;s <strong>schema</strong> (table and column names, not
          their contents), and a handful of <strong>synthetic sample rows</strong> are sent to Groq
          so it can write accurate SQL.
        </li>
        <li>
          Before anything is sent, every value that looks like personal data — names, emails, phone
          numbers, addresses, and similar — is automatically detected and replaced with an opaque
          placeholder token (for example <code>SPK_V17</code>). Groq only ever sees the token, plus
          a short hint about its shape (&ldquo;a date&rdquo;, &ldquo;an email address&rdquo;) so it
          can still write a grammatically sensible sentence around it.
        </li>
        <li>
          The mapping from each token back to your real value is generated fresh for each query,
          lives only in your app&apos;s memory for the duration of that request, and is never
          written to disk, sent over the network, or logged.
        </li>
        <li>
          Ordinary non-personal values — counts, totals, product names, dates that aren&apos;t tied
          to a person — are not tokenized and may appear in the request in the clear.
        </li>
        <li>If voice output is enabled, the final answer is sent to a text-to-speech provider to be spoken aloud.</li>
      </ul>

      <h3>Strict</h3>
      <ul>
        <li>
          Every value that came from your data — not just personal-looking ones — is tokenized
          before it leaves your machine.
        </li>
        <li>
          Cloud text-to-speech is turned off in this mode, because speaking the answer aloud would
          otherwise require sending the fully de-tokenized sentence to a second, separate provider.
        </li>
      </ul>

      <h3>Local / Offline (BLAZE tier and up)</h3>
      <ul>
        <li>
          Nothing leaves your machine — not your question, not the schema, not sample rows. SQL
          generation runs entirely on-device using a locally-installed language model
          (<code>node-llama-cpp</code>), with no network call involved.
        </li>
        <li>
          This is the only mode where the common claim &ldquo;your data never leaves your
          machine&rdquo; is true in the fullest sense, including for the question you ask, not just
          the underlying data.
        </li>
      </ul>

      <h3>The safety check behind all of this</h3>
      <p>
        Independently of which level is active, every outbound request to an AI provider passes
        through a final check that inspects the exact text about to be sent and aborts the request
        if it finds a real, non-tokenized data value inside it. This exists so that a bug in the
        tokenization logic fails safe — as a blocked request — rather than as a silent leak.
      </p>

      <h2>6. Voice input and output</h2>
      <p>
        On tiers where voice is enabled, spoken questions are sent to Deepgram for speech-to-text
        transcription, and (outside Strict/Local modes) spoken answers are generated via a
        third-party text-to-speech provider. On the FREE through STORM tiers you supply your own
        Deepgram API key, so that audio is sent under your own account with that provider, subject
        to their terms. On THUNDER, we provide a managed key and that traffic runs through our own
        provider account instead.
      </p>

      <h2>7. Cookies and analytics</h2>
      <p>
        Our landing page does not use cookies, third-party analytics, or advertising trackers of
        any kind. It is a static page; we do not know who visits it beyond what your browser or ISP
        would ordinarily disclose to any website.
      </p>

      <h2>8. Where data is stored</h2>
      <p>
        Account, billing, and usage data described in sections 1–3 are stored on AWS infrastructure
        provisioned in the Mumbai (ap-south-1) region. We do not intentionally replicate this data
        outside India. Requests to third-party AI providers (section 5) are subject to those
        providers&apos; own data-handling practices and may be processed outside India — this is
        limited to whatever a given privacy level permits leaving your device in the first place.
      </p>

      <h2>9. Data retention and deletion</h2>
      <p>
        We retain account, billing, and usage data for as long as your account is active, plus a
        reasonable period afterward for accounting and fraud-prevention purposes. You can request
        deletion of your account and associated data at any time by contacting us at{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a>. Data that only ever existed on
        your own machine (your files, your local DuckDB databases) is deleted the same way any
        local file is — by removing it yourself or uninstalling the app.
      </p>

      <h2>10. Children&apos;s privacy</h2>
      <p>
        SPARK Engine is not directed at children and is not intended for use by anyone under 18. We
        do not knowingly collect personal data from children.
      </p>

      <h2>11. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, export, or delete the
        personal data we hold about you. To exercise any of these rights, contact us at{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a> and we will respond within a
        reasonable time.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        If we change what we collect or how we handle it — especially anything described in section
        5 — we will update the &ldquo;Last updated&rdquo; date above and, for material changes,
        make a reasonable effort to notify you in-app.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about this policy can be sent to{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a>.
      </p>
    </>
  );
}
