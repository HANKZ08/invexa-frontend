/** Avisos breves (toasts) compartidos por toda la app. Se muestran en <UiToastHost>. */
import { readonly, ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DURATION: Record<ToastKind, number> = { success: 5000, info: 5000, error: 8000 }

const items = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

function push(kind: ToastKind, message: string): number {
  const id = nextId++
  items.value.push({ id, kind, message })
  timers.set(
    id,
    setTimeout(() => dismiss(id), DURATION[kind]),
  )
  return id
}

export function dismiss(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
  items.value = items.value.filter((item) => item.id !== id)
}

export function dismissAll(): void {
  for (const id of timers.keys()) dismiss(id)
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
}

export function useToast() {
  return { toasts: readonly(items), toast, dismiss }
}
