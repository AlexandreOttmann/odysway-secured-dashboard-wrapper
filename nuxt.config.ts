import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2024-11-01',

  modules: ['nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // Populated at runtime from NUXT_SUPABASE_URL / NUXT_SUPABASE_DASHBOARD_KEY /
    // NUXT_SUPABASE_AUDIT_KEY / NUXT_SUPABASE_UPLOADER_KEY (see .env.example).
    supabaseUrl: '',
    supabaseDashboardKey: '',
    supabaseAuditKey: '',
    supabaseUploaderKey: '',
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
      },
    },
  },

  nitro: {
    routeRules: {
      // Dashboard static files get their own CSP — looser to allow chart CDNs
      '/dashboards/**': {
        headers: {
          'Content-Security-Policy':
            "default-src 'none'; " +
            // 'unsafe-inline' is acceptable here because the iframe in
            // app/pages/d/[slug].vue uses sandbox="allow-scripts" WITHOUT
            // allow-same-origin, so inline script in a dashboard cannot read
            // the parent's cookies/localStorage even if malicious.
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self'; " +
            'frame-ancestors https://dashboards.odysway.com http://localhost:3000;',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    },
  },
})
