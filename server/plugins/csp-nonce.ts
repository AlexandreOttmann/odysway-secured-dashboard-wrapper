// Inject the per-request CSP nonce (set by server/middleware/02.csp.ts) onto
// every inline <script> Nuxt/Vite emits, so the strict script-src 'nonce-…'
// policy lets them execute. External (src=…) scripts already match 'self' and
// don't need a nonce, but tagging them too is harmless and simpler.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const nonce = event.context.cspNonce as string | undefined
    if (!nonce) return

    const addNonce = (tag: string) =>
      tag.replace(/<script(?![^>]*\snonce=)/gi, `<script nonce="${nonce}"`)

    html.head = html.head.map(addNonce)
    html.bodyPrepend = html.bodyPrepend.map(addNonce)
    html.bodyAppend = html.bodyAppend.map(addNonce)
  })
})
