export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  // OAuth callback and static assets bypass session check
  if (
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/_nuxt/') ||
    url.pathname.startsWith('/dashboards/')
  ) {
    return
  }

  // All other API routes require a valid session
  if (!url.pathname.startsWith('/api/')) return

  const session = await getUserSession(event)
  if (!session?.user?.email) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
})
