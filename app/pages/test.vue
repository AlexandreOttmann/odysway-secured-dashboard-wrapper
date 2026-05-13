<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Test table</h1>

    <div v-if="pending" class="text-gray-500">Loading…</div>

    <div v-else-if="error" class="text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3 text-sm">
      {{ error.message }}
    </div>

    <template v-else>
      <p class="text-sm text-gray-500 mb-4">{{ rows.length }} row(s)</p>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-gray-100">
            <th class="text-left px-4 py-2 text-gray-600 font-medium">id</th>
            <th class="text-left px-4 py-2 text-gray-600 font-medium">created_at</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-2 font-mono text-xs">{{ row.id }}</td>
            <td class="px-4 py-2 font-mono text-xs">{{ row.created_at }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup lang="ts">
const { data, pending, error } = await useFetch('/api/query/test_entries', {
  method: 'POST',
  body: { params: {} },
})

const rows = computed(() => (data.value as any[]) ?? [])
</script>
