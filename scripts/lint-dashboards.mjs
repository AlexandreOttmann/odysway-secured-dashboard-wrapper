#!/usr/bin/env node
// Lints all HTML files in public/dashboards/ and fails CI if dangerous patterns are found.
// Run: npm run lint:dashboards

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DASHBOARDS_DIR = resolve(process.cwd(), 'public/dashboards')

// CDN hosts allowed in the CSP (must match nuxt.config.ts routeRules)
const ALLOWED_CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com']

const RULES = [
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
  {
    name: 'no-inline-handlers',
    description: 'Inline event handlers (onerror=, onclick=, etc.) bypass CSP',
    test: (src) => /\son\w+\s*=/i.test(src),
  },
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
          return true // unparseable URL is suspicious
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
      // Allow relative fetch('/api/...') and postMessage-based queries; flag absolute http(s) fetch
      const stripped = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      return /fetch\s*\(\s*['"`]https?:\/\//.test(stripped) ||
        /new\s+XMLHttpRequest/.test(stripped)
    },
  },
]

let files
try {
  files = readdirSync(DASHBOARDS_DIR).filter((f) => f.endsWith('.html'))
} catch {
  console.error(`[lint-dashboards] directory not found: ${DASHBOARDS_DIR}`)
  process.exit(1)
}

if (files.length === 0) {
  console.log('[lint-dashboards] no HTML files found — nothing to check')
  process.exit(0)
}

let totalViolations = 0

for (const file of files) {
  const filePath = join(DASHBOARDS_DIR, file)
  const src = readFileSync(filePath, 'utf-8')
  const violations = RULES.filter((r) => r.test(src))

  if (violations.length > 0) {
    console.error(`\n  FAIL  ${file}`)
    for (const v of violations) {
      console.error(`        [${v.name}] ${v.description}`)
    }
    totalViolations += violations.length
  } else {
    console.log(`  ok    ${file}`)
  }
}

if (totalViolations > 0) {
  console.error(`\n${totalViolations} violation(s) found. Fix them before merging.\n`)
  process.exit(1)
} else {
  console.log(`\nAll ${files.length} dashboard(s) passed lint.\n`)
}
