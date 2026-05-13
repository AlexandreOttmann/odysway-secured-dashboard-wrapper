const ALLOWED_CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com']

interface Rule {
  name: string
  description: string
  test: (src: string) => boolean
}

const RULES: Rule[] = [
  {
    name: 'no-eval',
    description: 'eval() and new Function() enable arbitrary code execution',
    test: (src) => /\beval\s*\(|new\s+Function\s*\(/.test(src),
  },
  {
    name: 'no-string-timer',
    description: 'setTimeout/setInterval with a string argument evaluates it as code',
    test: (src) => /setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/.test(src),
  },
  // {
  //   name: 'no-inline-handlers',
  //   description: 'Inline event handlers (onerror=, onclick=, etc.) bypass CSP',
  //   test: (src) => /\son\w+\s*=/i.test(src),
  // },
  {
    name: 'no-secret-patterns',
    description: 'Possible secret or API key detected in dashboard file',
    test: (src) =>
      /sk_live_|sk_test_|eyJ[a-zA-Z0-9_-]{20,}|SUPABASE_|NUXT_|anon\s*=\s*['"`][a-zA-Z0-9._-]{20,}/.test(
        src,
      ),
  },
  {
    name: 'no-disallowed-cdn',
    description: 'External script source not in the CSP allowlist',
    test: (src) => {
      const matches = src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)
      for (const [, url] of matches) {
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) continue
        try {
          const host = new URL(url).hostname
          if (!ALLOWED_CDN_HOSTS.includes(host)) return true
        } catch {
          return true
        }
      }
      return false
    },
  },
  {
    name: 'no-direct-fetch-external',
    description:
      'Dashboard must not fetch external URLs directly — use postMessage to relay through the parent',
    test: (src) => {
      const stripped = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      return (
        /fetch\s*\(\s*['"`]https?:\/\//.test(stripped) || /new\s+XMLHttpRequest/.test(stripped)
      )
    },
  },
]

export function lintHtml(src: string): string[] {
  return RULES.filter((r) => r.test(src)).map((r) => `[${r.name}] ${r.description}`)
}
