<template>
  <div>
    <div v-if="!dashboard" class="text-gray-500">Dashboard not found.</div>
    <template v-else>
      <div class="mb-4 flex items-center gap-3">
        <NuxtLink to="/" class="text-sm text-blue-600 hover:underline">← All dashboards</NuxtLink>
        <span class="text-gray-400">/</span>
        <h1 class="text-lg font-semibold text-gray-900">{{ dashboard.title }}</h1>
        <span
          v-if="dashboard.live"
          class="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded"
        >Live data</span>
      </div>
      <iframe
        :src="iframeSrc"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        class="w-full border-0 rounded-lg"
        style="height: calc(100vh - 140px)"
        :title="dashboard.title"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
interface DashboardMeta {
  slug: string
  title: string
  description: string
  live: boolean
  source: 'db' | 'static'
  file?: string
}

const route = useRoute()
const slug = route.params.slug as string

const { data: dashboard } = await useFetch<DashboardMeta>(`/api/dashboards/${slug}`, {
  // 404 → null rather than throwing
  onResponseError({ response }) {
    if (response.status === 404) return
  },
}).catch(() => ({ data: ref(null) }))

const iframeSrc = computed(() => {
  if (!dashboard.value) return ''
  return dashboard.value.source === 'static' && dashboard.value.file
    ? `/dashboards/${dashboard.value.file}`
    : `/api/dashboards/${slug}/html`
})

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})

async function handleMessage(event: MessageEvent) {
  // sandbox="allow-scripts" (no allow-same-origin) gives the iframe an opaque origin,
  // which serialises as the string 'null'. Only accept messages from such contexts.
  if (event.origin !== 'null') return
  if (event.data?.type !== 'query') return

  const { view, body, params, requestId } = event.data as {
    view: string
    body?: Record<string, unknown>
    params?: Record<string, unknown>
    requestId: string
  }

  try {
    const data = await $fetch(`/api/query/${view}`, {
      method: 'POST',
      body: body && Object.keys(body).length > 0 ? body : { params: params ?? {} },
    })
    // targetOrigin '*' is safe: we're sending to our own sandboxed iframe;
    // the iframe cannot exfiltrate this data outside its sandbox.
    ;(event.source as WindowProxy).postMessage(
      { type: 'query-result', requestId, data },
      '*',
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Query failed'
    ;(event.source as WindowProxy).postMessage(
      { type: 'query-error', requestId, error: message },
      '*',
    )
  }
}
</script>
