<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <NuxtLink to="/" class="font-semibold text-gray-900">Odysway Dashboards</NuxtLink>
      <div class="flex items-center gap-4 text-sm text-gray-600">
        <span v-if="user">{{ user.email }}</span>
        <a href="/api/auth/logout" class="text-red-600 hover:underline">Sign out</a>
      </div>
    </nav>
    <main class="p-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user } = useUserSession()
</script>
