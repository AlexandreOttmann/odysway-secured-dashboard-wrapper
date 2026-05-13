export default defineNuxtRouteMiddleware((to) => {
  // Login page is public so OAuth errors can be surfaced
  if (to.path === '/login') return

  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/api/auth/google', { external: true })
  }
})
