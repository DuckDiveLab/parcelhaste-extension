// Strips sessions, tokens and personal data from portal captures (HTML pages and HAR files)
// before they become fixtures. harness-check still scans the result; this makes it pass.

export interface SanitizeOptions {
  /** Literal strings to replace wherever they appear (your name, street, account number). */
  redact?: readonly string[];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_LIKE = /\+?\d[\d ().-]{6,}\d/g;
const DECIMAL = /\d\.\d/;
const SECRET_HEADER =
  /^(cookie|set-cookie|authorization|proxy-authorization|x-csrf-token|x-xsrf-token|x-api-key)$/i;
const SECRET_NAME = /(token|csrf|xsrf|password|secret|session|auth|verification)/i;

export const REDACTED = "REDACTED";
export const REDACTED_EMAIL = "redacted@example.com";
export const REDACTED_PHONE = "+44 7700 900000";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Emails, phone-like numbers and the caller's own strings become synthetic values. */
export function redactText(text: string, options: SanitizeOptions = {}): string {
  let result = text.replace(EMAIL, REDACTED_EMAIL);
  result = result.replace(PHONE_LIKE, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15 || DECIMAL.test(match)) {
      return match;
    }
    return REDACTED_PHONE;
  });
  for (const literal of options.redact ?? []) {
    if (literal.trim() !== "") {
      result = result.replace(new RegExp(escapeRegExp(literal), "gi"), REDACTED);
    }
  }
  return result;
}

/** Removes scripts, blanks token-like meta and hidden inputs, then redacts text. */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  let result = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<meta\b[^>]*>/gi, (tag) =>
    SECRET_NAME.test(tag) ? tag.replace(/content="[^"]*"/i, `content="${REDACTED}"`) : tag,
  );
  result = result.replace(/<input\b[^>]*>/gi, (tag) =>
    /type="hidden"/i.test(tag) && SECRET_NAME.test(tag)
      ? tag.replace(/value="[^"]*"/i, `value="${REDACTED}"`)
      : tag,
  );
  return redactText(result, options);
}

interface HarHeader {
  name: string;
  value: string;
}

interface HarParam {
  name: string;
  value?: string;
}

interface HarEntry {
  request?: {
    url?: string;
    cookies?: unknown[];
    headers?: HarHeader[];
    queryString?: HarParam[];
    postData?: { mimeType?: string; text?: string; params?: HarParam[] };
  };
  response?: {
    cookies?: unknown[];
    headers?: HarHeader[];
    content?: { text?: string };
  };
}

interface Har {
  log?: { entries?: HarEntry[] };
}

function cleanHeaders(headers: HarHeader[] | undefined, options: SanitizeOptions): HarHeader[] {
  return (headers ?? [])
    .filter((header) => !SECRET_HEADER.test(header.name))
    .map((header) => ({ name: header.name, value: redactText(header.value, options) }));
}

function cleanParams(params: HarParam[] | undefined, options: SanitizeOptions): HarParam[] {
  return (params ?? []).map((param) => ({
    name: param.name,
    value: SECRET_NAME.test(param.name) ? REDACTED : redactText(param.value ?? "", options),
  }));
}

const FORM_BODY = /^[^=&\s]+=[^&]*(?:&[^=&\s]+=[^&]*)*$/;

/** Form-encoded bodies hide emails as %40; decode, redact per parameter, re-encode. */
function cleanBody(text: string, mimeType: string | undefined, options: SanitizeOptions): string {
  if (/x-www-form-urlencoded/i.test(mimeType ?? "") || FORM_BODY.test(text)) {
    const cleaned = new URLSearchParams();
    for (const [name, value] of new URLSearchParams(text)) {
      cleaned.append(name, SECRET_NAME.test(name) ? REDACTED : redactText(value, options));
    }
    return cleaned.toString();
  }
  return redactText(text, options);
}

function cleanUrl(url: string, options: SanitizeOptions): string {
  try {
    const parsed = new URL(url);
    for (const [name] of parsed.searchParams) {
      if (SECRET_NAME.test(name)) {
        parsed.searchParams.set(name, REDACTED);
      }
    }
    return redactText(parsed.toString(), options);
  } catch {
    return redactText(url, options);
  }
}

/** Drops cookies and secret headers, blanks token parameters, redacts every text body. */
export function sanitizeHar(har: Har, options: SanitizeOptions = {}): Har {
  const entries = (har.log?.entries ?? []).map((entry) => {
    const request = entry.request ?? {};
    const response = entry.response ?? {};
    const cleaned: HarEntry = {
      ...entry,
      request: {
        ...request,
        url: cleanUrl(request.url ?? "", options),
        cookies: [],
        headers: cleanHeaders(request.headers, options),
        queryString: cleanParams(request.queryString, options),
      },
      response: {
        ...response,
        cookies: [],
        headers: cleanHeaders(response.headers, options),
      },
    };
    if (request.postData !== undefined && cleaned.request !== undefined) {
      cleaned.request.postData = {
        ...request.postData,
        ...(request.postData.text !== undefined && {
          text: cleanBody(request.postData.text, request.postData.mimeType, options),
        }),
        ...(request.postData.params !== undefined && {
          params: cleanParams(request.postData.params, options),
        }),
      };
    }
    if (response.content?.text !== undefined && cleaned.response !== undefined) {
      cleaned.response.content = {
        ...response.content,
        text: redactText(response.content.text, options),
      };
    }
    return cleaned;
  });
  return { ...har, log: { ...har.log, entries } };
}
