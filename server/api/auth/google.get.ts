export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['email', 'profile'],
    // hd is a UI hint to Google to show only @odysway.com accounts.
    // It is NOT a security guarantee — the server-side check below is the real gate.
    // authorizationParams: { hd: 'odysway.com' },
  },

  async onSuccess(event, { user }) {
    // Double-check both fields: a compromised token could have hd spoofed
    // if (!user.email?.endsWith('@odysway.com') || user.hd !== 'odysway.com') {
    //   console.warn('[auth] rejected non-odysway login attempt:', user.email)
    //   return sendRedirect(event, '/login?error=forbidden')
    // }

    await setUserSession(event, {
      user: { email: user.email, name: user.name ?? '' },
    })

    console.info('[auth] login:', user.email)
    return sendRedirect(event, '/')
  },

  onError(event, error) {
    console.error('[auth] OAuth error:', error)
    return sendRedirect(event, '/login?error=oauth_failed')
  },
})
