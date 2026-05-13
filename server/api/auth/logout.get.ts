export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (session?.user?.email) {
    console.info('[auth] logout:', session.user.email)
  }
  await clearUserSession(event)
  return sendRedirect(event, '/login')
})
