import { randomBytes } from 'node:crypto'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)

  // /dashboards/** CSP is set via nuxt.config.ts routeRules (applied to static files)
  if (url.pathname.startsWith('/dashboards/')) return

  const nonce = randomBytes(16).toString('base64')
  event.context.cspNonce = nonce

  const isDev = process.env.NODE_ENV !== 'production'

  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`

  const connectSrc = isDev
    ? "connect-src 'self' ws: http://localhost:* https://localhost:*"
    : "connect-src 'self'"

  setResponseHeader(
    event,
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      connectSrc,
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  )
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
})
