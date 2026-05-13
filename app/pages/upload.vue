<template>
  <div class="max-w-xl mx-auto">
    <div class="mb-6 flex items-center gap-3">
      <NuxtLink to="/" class="text-sm text-blue-600 hover:underline">← All dashboards</NuxtLink>
      <span class="text-gray-400">/</span>
      <h1 class="text-lg font-semibold text-gray-900">Upload dashboard</h1>
    </div>

    <form @submit.prevent="submit" class="space-y-5">
      <!-- Drop zone -->
      <div
        class="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
        :class="isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p class="text-sm text-gray-600">
          <label class="cursor-pointer font-medium text-blue-600 hover:underline">
            Choose an HTML file
            <input
              ref="fileInput"
              type="file"
              accept=".html,text/html"
              class="sr-only"
              @change="onFileChange"
            />
          </label>
          or drag and drop
        </p>
        <p v-if="fileName" class="text-xs font-medium text-gray-800">{{ fileName }}</p>
        <p v-else class="text-xs text-gray-400">.html only · max 512 KB</p>
      </div>

      <!-- Metadata -->
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            v-model="form.title"
            type="text"
            required
            maxlength="200"
            placeholder="My dashboard"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @input="syncSlug"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            v-model="form.slug"
            type="text"
            required
            maxlength="100"
            pattern="[a-z0-9-]+"
            placeholder="my-dashboard"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-400">Lowercase letters, numbers, hyphens. URL: /d/{{ form.slug || '…' }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description <span class="text-gray-400 font-normal">(optional)</span></label>
          <input
            v-model="form.description"
            type="text"
            maxlength="500"
            placeholder="Short description shown on the home page"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input v-model="form.live" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span class="text-sm text-gray-700">Live data <span class="text-gray-400">(shows the "Live data" badge)</span></span>
        </label>
      </div>

      <!-- Lint violations -->
      <div v-if="violations.length" class="rounded-md bg-red-50 border border-red-200 p-4">
        <p class="text-sm font-medium text-red-800 mb-2">Security lint failed:</p>
        <ul class="space-y-1">
          <li v-for="v in violations" :key="v" class="text-xs font-mono text-red-700">{{ v }}</li>
        </ul>
      </div>

      <!-- Generic error -->
      <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

      <!-- Success -->
      <div v-if="successSlug" class="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        Dashboard uploaded.
        <NuxtLink :to="`/d/${successSlug}`" class="font-medium underline">Open /d/{{ successSlug }}</NuxtLink>
      </div>

      <button
        type="submit"
        :disabled="submitting || !htmlContent"
        class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {{ submitting ? 'Uploading…' : 'Upload dashboard' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const htmlContent = ref('')

const form = reactive({
  title: '',
  slug: '',
  description: '',
  live: false,
})

const submitting = ref(false)
const violations = ref<string[]>([])
const errorMsg = ref('')
const successSlug = ref('')

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

let slugManuallyEdited = false

function syncSlug() {
  if (!slugManuallyEdited) {
    form.slug = slugify(form.title)
  }
}

watch(() => form.slug, (val, old) => {
  if (val !== slugify(form.title) && val !== old) {
    slugManuallyEdited = true
  }
})

async function loadFile(file: File) {
  if (!file.name.endsWith('.html') && file.type !== 'text/html') {
    errorMsg.value = 'Only .html files are accepted.'
    return
  }
  if (file.size > 512 * 1024) {
    errorMsg.value = 'File exceeds 512 KB limit.'
    return
  }
  errorMsg.value = ''
  violations.value = []
  successSlug.value = ''
  fileName.value = file.name
  htmlContent.value = await file.text()
  if (!form.title) {
    form.title = file.name.replace(/\.html$/i, '')
    slugManuallyEdited = false
    syncSlug()
  }
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadFile(file)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
}

async function submit() {
  if (!htmlContent.value) return
  submitting.value = true
  violations.value = []
  errorMsg.value = ''
  successSlug.value = ''

  try {
    const result = await $fetch<{ slug: string }>('/api/dashboards/upload', {
      method: 'POST',
      body: {
        slug: form.slug,
        title: form.title,
        description: form.description,
        live: form.live,
        html: htmlContent.value,
      },
    })
    successSlug.value = result.slug
  } catch (err: unknown) {
    const fe = err as { data?: { data?: { violations?: string[] }; message?: string } }
    if (fe?.data?.data?.violations?.length) {
      violations.value = fe.data.data.violations
    } else {
      errorMsg.value = fe?.data?.message ?? 'Upload failed.'
    }
  } finally {
    submitting.value = false
  }
}
</script>
