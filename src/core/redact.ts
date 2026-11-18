/** Query parameters whose values look like secrets. */
const SECRET_PARAMS = /^(key|api[-_]?key|apikey|access[-_]?token|auth|token|sig|signature|secret|password)$/i;

/** Response headers that may identify an account or carry secrets; dropped from exports. */
const SENSITIVE_HEADERS = /cookie|authorization|token|api[-_]?key|organization|project|account|(^|-)user(-|$)|(^|-)org(-|$)/i;

/** Replace the values of secret-looking query parameters with `***`. Non-URL input is returned unchanged. */
export function redactUrl(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const hashAt = url.indexOf("#", q);
  const query = url.slice(q + 1, hashAt < 0 ? undefined : hashAt);
  const rest = hashAt < 0 ? "" : url.slice(hashAt);
  const masked = query
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      let name = pair.slice(0, eq);
      try {
        name = decodeURIComponent(name);
      } catch {
        // keep the raw name
      }
      return SECRET_PARAMS.test(name) ? `${pair.slice(0, eq)}=***` : pair;
    })
    .join("&");
  return `${url.slice(0, q + 1)}${masked}${rest}`;
}

/** True when a response header should not be written to a shareable export. */
export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.test(name);
}
