/** Recovery/OAuth links contain secrets in their query string. Never send them to logs. */
export function requestPathForLog(url: string) {
  return url.split(/[?#]/, 1)[0].replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 256);
}
