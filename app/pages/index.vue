<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboards</h1>
        <p class="mt-1 text-sm text-gray-500">{{ dashboards?.length ?? 0 }} dashboard{{ dashboards?.length === 1 ? '' : 's' }}</p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/deleted"
          class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >Archived</NuxtLink>
        <NuxtLink
          to="/upload"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
        >+ Upload dashboard</NuxtLink>
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-48 rounded-xl bg-gray-100 animate-pulse" />
    </div>

    <div v-else-if="!dashboards?.length" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      </div>
      <p class="text-gray-900 font-medium">No dashboards yet</p>
      <p class="mt-1 text-sm text-gray-500">Upload your first dashboard to get started.</p>
    </div>

    <ul v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="d in localDashboards" :key="d.slug" class="relative group">
        <!-- Three-dot menu button (only for uploaded dashboards with creator info) -->
        <div v-if="d.created_by" class="absolute top-3 right-3 z-10">
          <button
            @click.prevent.stop="toggleMenu(d.slug)"
            class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Dashboard options"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          <!-- Dropdown menu -->
          <div
            v-if="openMenu === d.slug"
            class="absolute right-0 mt-1 w-56 rounded-xl bg-white shadow-lg border border-gray-100 py-1 text-sm z-20"
          >
            <div class="px-3 py-2 border-b border-gray-100">
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Created by</p>
              <p class="text-gray-700 truncate">{{ d.created_by }}</p>
            </div>
            <div class="px-3 py-2 border-b border-gray-100">
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Created</p>
              <p class="text-gray-700">{{ formatDate(d.created_at) }}</p>
            </div>
            <NuxtLink
              :to="`/edit/${d.slug}`"
              @click.stop
              class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit dashboard
            </NuxtLink>
            <button
              @click.stop="archiveDashboard(d.slug)"
              class="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
              </svg>
              Archive dashboard
            </button>
          </div>
        </div>

        <!-- Card -->
        <NuxtLink
          :to="`/d/${d.slug}`"
          class="flex flex-col h-full bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden"
        >
          <!-- Colored banner with icon -->
          <div :class="['h-24 flex items-center justify-center', cardColor(d.slug).bg]">
            <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', cardColor(d.slug).iconBg]">
              <svg :class="['w-5 h-5', cardColor(d.slug).icon]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
          </div>

          <!-- Content -->
          <div class="flex flex-col flex-1 p-4">
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="font-semibold text-gray-900 leading-tight">{{ d.title }}</span>
              <span
                v-if="d.live"
                class="shrink-0 flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p class="text-sm text-gray-500 line-clamp-2">{{ d.description || 'No description' }}</p>

            <!-- Footer -->
            <div v-if="d.created_by" class="mt-auto pt-3 flex items-center gap-1.5">
              <div class="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                <span class="text-xs font-medium text-gray-500">{{ d.created_by.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="text-xs text-gray-400 truncate">{{ d.created_by }}</span>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface DashboardEntry {
  slug: string
  title: string
  description: string
  file?: string
  live: boolean
  created_by?: string
  created_at?: string
}

const CARD_COLORS = [
  { bg: 'bg-blue-50', iconBg: 'bg-blue-100', icon: 'text-blue-500' },
  { bg: 'bg-violet-50', iconBg: 'bg-violet-100', icon: 'text-violet-500' },
  { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', icon: 'text-emerald-500' },
  { bg: 'bg-amber-50', iconBg: 'bg-amber-100', icon: 'text-amber-500' },
  { bg: 'bg-rose-50', iconBg: 'bg-rose-100', icon: 'text-rose-500' },
  { bg: 'bg-cyan-50', iconBg: 'bg-cyan-100', icon: 'text-cyan-500' },
]

function cardColor(slug: string) {
  const i = slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % CARD_COLORS.length
  return CARD_COLORS[i] ?? CARD_COLORS[0]!
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

const { data: dashboards, pending } = await useFetch<DashboardEntry[]>('/api/dashboards')

const localDashboards = ref<DashboardEntry[]>([])
watch(dashboards, (v) => { if (v) localDashboards.value = [...v] }, { immediate: true })

const openMenu = ref<string | null>(null)

function toggleMenu(slug: string) {
  openMenu.value = openMenu.value === slug ? null : slug
}

function closeMenu() {
  openMenu.value = null
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})

async function archiveDashboard(slug: string) {
  openMenu.value = null
  await $fetch(`/api/dashboards/${slug}/archive`, { method: 'PATCH' })
  localDashboards.value = localDashboards.value.filter((d) => d.slug !== slug)
}
</script>
