<script setup lang="ts">
// Vista temporal: comprueba la conexión con la API. La Tarea 5 la reemplaza por el layout.
import { onMounted, ref } from 'vue'
import { apiUrl } from '@/config'

type Status = 'checking' | 'ok' | 'error'

const status = ref<Status>('checking')

onMounted(async () => {
  try {
    const response = await fetch(apiUrl('/api/health/'))
    const body: { status?: string } = await response.json()
    status.value = response.ok && body.status === 'ok' ? 'ok' : 'error'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <main class="health">
    <h1>Invexa</h1>
    <p role="status" :data-status="status">
      <template v-if="status === 'checking'">Conectando con la API…</template>
      <template v-else-if="status === 'ok'">API conectada.</template>
      <template v-else
        >No se pudo conectar con la API. ¿Está el backend en el puerto 3000?</template
      >
    </p>
  </main>
</template>

<style scoped>
.health {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-2);
}
</style>
