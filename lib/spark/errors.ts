/* Turns the raw failure text from the main process into something a
   person can act on. The original string is always preserved and shown
   under "Technical details" — nothing is hidden, only reordered. */

export interface FriendlyError {
  headline: string;
  detail?: string;
  hint?: string;
  /** Which recovery actions make sense for this failure. */
  actions: Array<'retry' | 'sql' | 'edit' | 'settings' | 'connect'>;
}

export function humanizeError(raw: string): FriendlyError {
  const e = raw || 'Unknown error';

  // --- Missing / rejected credentials ---
  if (/Groq API key is required/i.test(e)) {
    return {
      headline: 'SPARK needs a Groq API key.',
      detail: 'Question understanding and SQL generation both run through Groq.',
      actions: ['settings'],
    };
  }
  if (/Groq API error \(401\)|invalid_api_key|Unauthorized/i.test(e)) {
    return {
      headline: 'Your Groq API key was rejected.',
      detail: 'The key is present but the service would not accept it.',
      hint: 'Check it has not been revoked or regenerated.',
      actions: ['settings', 'retry'],
    };
  }
  if (/Groq API error \(429\)|rate limit/i.test(e)) {
    return {
      headline: 'Groq is rate-limiting this key.',
      detail: 'Too many requests in a short window.',
      hint: 'Wait a moment and ask again.',
      actions: ['retry'],
    };
  }

  // --- Nothing to query ---
  if (/No tables found/i.test(e)) {
    return {
      headline: 'There is no data loaded yet.',
      detail: 'SPARK looked in DuckDB and found no tables to query.',
      actions: ['connect'],
    };
  }
  if (/Selected dataset not found/i.test(e)) {
    return {
      headline: 'That dataset is no longer available.',
      detail: 'The file backing this session was moved or removed.',
      actions: ['connect'],
    };
  }

  // --- Schema mismatches: the most common real failure ---
  const binder = e.match(/(?:Binder Error|Catalog Error).*?column "?([\w.]+)"?/i);
  if (binder) {
    const referenced = e.match(/Candidate bindings?:?\s*"?([\w.]+)"?/i);
    return {
      headline: "SPARK couldn't answer that.",
      detail: `There is no ${binder[1]} field in your database.`,
      hint: referenced ? `${referenced[1]} exists instead.` : 'Try naming the column as it appears in your schema.',
      actions: ['edit', 'sql', 'retry'],
    };
  }
  const tableErr = e.match(/(?:Catalog Error).*?Table with name ([\w]+)/i);
  if (tableErr) {
    return {
      headline: "SPARK couldn't answer that.",
      detail: `It wrote a query against a table called ${tableErr[1]}, which is not in your database.`,
      hint: 'Open the schema map to see what is actually there.',
      actions: ['edit', 'sql', 'retry'],
    };
  }

  // --- Guardrail ---
  if (/Only SELECT queries are allowed/i.test(e)) {
    return {
      headline: 'That would have modified your data.',
      detail: 'SPARK only ever runs read-only queries, so it stopped before executing.',
      hint: 'Rephrase it as a question about the data.',
      actions: ['edit', 'sql'],
    };
  }

  // --- SQL that did not parse or type-check ---
  if (/Parser Error|Conversion Error|Type.*mismatch|Invalid Input Error/i.test(e)) {
    return {
      headline: 'The generated query would not run.',
      detail: 'SPARK wrote SQL that DuckDB rejected.',
      hint: 'Asking more specifically usually fixes this.',
      actions: ['retry', 'sql', 'edit'],
    };
  }

  // --- Transport ---
  if (/Electron API not available/i.test(e)) {
    return {
      headline: 'The analytics engine is not reachable.',
      detail: 'The desktop bridge did not load.',
      hint: 'Restart SPARK.',
      actions: [],
    };
  }
  if (/fetch failed|ENOTFOUND|ETIMEDOUT|network/i.test(e)) {
    return {
      headline: 'SPARK could not reach the AI service.',
      detail: 'The request left the app but got no response.',
      hint: 'Check your connection and try again.',
      actions: ['retry'],
    };
  }

  return {
    headline: "SPARK couldn't answer that.",
    detail: e.length > 160 ? e.slice(0, 157) + '…' : e,
    actions: ['retry', 'edit'],
  };
}
