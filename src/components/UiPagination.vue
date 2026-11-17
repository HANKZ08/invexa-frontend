<script setup lang="ts">
/**
 * Paginación de listados: rango, selector "Ver 25 / 50 / 100" y páginas.
 * Sirve para listas de la API (count total) y para listas ya cargadas en memoria.
 */
import { computed, watch } from 'vue'

import { formatNumber } from '@/utils/format'

import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

import UiButton from './UiButton.vue'

const props = withDefaults(defineProps<{ count: number; sizes?: number[] }>(), {
  sizes: () => Array.from({ length: 19 }, (_, i) => 10 + i * 5),
})
const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { default: 25 })

const pages = computed(() => Math.max(1, Math.ceil(props.count / pageSize.value)))
const from = computed(() => (props.count === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const to = computed(() => Math.min(page.value * pageSize.value, props.count))

// Cambiar cuántas filas se ven vuelve a la primera página.
watch(pageSize, () => (page.value = 1))
</script>

<template>
  <nav v-if="count > 0" class="ui-pagination" aria-label="Paginación">
    <p class="ui-pagination__range" aria-live="polite">
      {{ formatNumber(from) }}–{{ formatNumber(to) }} de {{ formatNumber(count) }}
    </p>
    <div class="ui-pagination__buttons">
      <label class="ui-pagination__size">
        <span>Ver</span>
        <select v-model.number="pageSize" name="page-size">
          <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <div v-if="pages > 1" class="ui-pagination__nav">
        <UiButton size="sm" :disabled="page <= 1" @click="page = page - 1"
          ><ChevronLeft :size="14" aria-hidden="true" /> Anterior</UiButton
        >
        <span class="ui-pagination__page">Página {{ page }} de {{ pages }}</span>
        <UiButton size="sm" :disabled="page >= pages" @click="page = page + 1">
          Siguiente <ChevronRight :size="14" aria-hidden="true"
        /></UiButton>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.ui-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-top: var(--space-3);
  font-size: var(--text-md);
}
.ui-pagination__range {
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.ui-pagination__buttons {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.ui-pagination__size {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink-2);
  font-weight: 600;
}
.ui-pagination__size select {
  font: inherit;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--sheet);
  color: var(--ink);
}
.ui-pagination__size select:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.ui-pagination__nav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.ui-pagination__page {
  font-weight: 600;
  color: var(--ink-2);
}
@media (max-width: 640px) {
  .ui-pagination {
    flex-direction: column;
    align-items: stretch;
  }
  .ui-pagination__buttons {
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
  }
  .ui-pagination__nav {
    flex: 1 1 100%;
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }
  .ui-pagination__nav .ui-button {
    white-space: nowrap;
  }
  .ui-pagination__page {
    text-align: center;
    flex: 1;
    white-space: nowrap;
  }
}
</style>
