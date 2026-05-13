<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <NuxtLink to="/" class="text-sm text-gray-500 hover:text-gray-700 transition-colors">Dashboards</NuxtLink>
          <span class="text-gray-300">/</span>
          <span class="text-sm text-gray-900 font-medium">Archived</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Archived dashboards</h1>
        <p class="mt-1 text-sm text-gray-500">{{ localDashboards.length }} archived dashboard{{ localDashboards.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-48 rounded-xl bg-gray-100 animate-pulse" />
    </div>

    <div v-else-if="!localDashboards.length" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
        </svg>
      </div>
      <p class="text-gray-900 font-medium">No archived dashboards</p>
      <p class="mt-1 text-sm text-gray-500">Archived dashboards will appear here.</p>
    </div>

    <ul v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="d in localDashboards" :key="d.slug">
        <div class="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden opacity-70">
          <!-- Colored banner (greyed) -->
          <div class="h-24 flex items-center justify-center bg-gray-50">
            <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
          </div>

          <!-- Content -->
          <div class="flex flex-col flex-1 p-4">
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="font-semibold text-gray-700 leading-tight">{{ d.title }}</span>
              <span
                v-if="d.live"
                class="shrink-0 text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
              >Live</span>
            </div>
            <p class="text-sm text-gray-400 line-clamp-2">{{ d.description || 'No description' }}</p>

            <!-- Footer -->
            <div class="mt-auto pt-3 flex items-center justify-between">
              <div v-if="d.created_by" class="flex items-center gap-1.5 min-w-0">
                <div class="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span class="text-xs font-medium text-gray-400">{{ d.created_by.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="text-xs text-gray-400 truncate">{{ d.created_by }}</span>
              </div>
              <button
                @click="restoreDashboard(d.slug)"
                class="shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restore
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface DashboardEntry {
  slug: string
  title: string
  description: string
  live: boolean
  created_by?: string
  created_at?: string
}

const { data: dashboards, pending } = await useFetch<DashboardEntry[]>('/api/dashboards/deleted')

const localDashboards = ref<DashboardEntry[]>([])
watch(dashboards, (v) => { if (v) localDashboards.value = [...v] }, { immediate: true })

async function restoreDashboard(slug: string) {
  await $fetch(`/api/dashboards/${slug}/restore`, { method: 'PATCH' })
  localDashboards.value = localDashboards.value.filter((d) => d.slug !== slug)
}
</script>
