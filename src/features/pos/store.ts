/** Carrito de la caja. Se guarda en sessionStorage: una recarga no pierde la venta en curso. */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { CartLine } from './cart'

const KEY = 'invexa.cart'

function load(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>(load())
  const busy = ref(false)

  watch(
    lines,
    (value) => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(value))
      } catch {
        // Sin sessionStorage: el carrito vive solo mientras la pestaña esté abierta.
      }
    },
    { deep: true },
  )

  function clear() {
    lines.value = []
  }

  return { lines, busy, clear }
})
