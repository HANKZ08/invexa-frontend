/** Paginación en memoria para listas que ya están cargadas (filtradas en el cliente). */
import { computed, ref, watch, type Ref } from 'vue'

export function usePagedList<T>(items: Ref<T[]>, initialSize = 25) {
  const page = ref(1)
  const pageSize = ref(initialSize)
  const count = computed(() => items.value.length)
  const pageItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  // Si la lista se encoge (por un filtro), no se queda en una página que ya no existe.
  watch(items, () => {
    const last = Math.max(1, Math.ceil(count.value / pageSize.value))
    if (page.value > last) page.value = last
  })

  return { page, pageSize, count, pageItems }
}
