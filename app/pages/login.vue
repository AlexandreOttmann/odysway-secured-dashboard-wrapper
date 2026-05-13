<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-sm w-full text-center">
      <h1 class="text-xl font-bold text-gray-900 mb-2">Odysway Dashboards</h1>
      <p class="text-sm text-gray-500 mb-6">Sign in with your @odysway.com Google account.</p>
      <div
        v-if="error"
        class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
      >
        {{ errorMessages[error as string] ?? 'An error occurred. Please try again.' }}
      </div>
      <a
        href="/api/auth/google"
        class="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
      >
        Sign in with Google
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const error = computed(() => route.query.error)

const errorMessages: Record<string, string> = {
  oauth_failed: 'Google sign-in failed. Please try again.',
  forbidden: 'Access denied — only @odysway.com accounts are permitted.',
}
</script>
