<script setup lang="ts">
/**
 * Código de 6 dígitos en casillas. Acepta pegar, avanza solo al escribir
 * y vuelve atrás con Retroceso. Emite el código completo como string.
 */
import { nextTick, ref, watch } from 'vue'

const LENGTH = 6
defineProps<{ label: string; invalid?: boolean; describedBy?: string }>()
const model = defineModel<string>({ default: '' })

const boxes = ref<HTMLInputElement[]>([])
const digits = ref<string[]>(Array.from({ length: LENGTH }, () => ''))

watch(
  model,
  (value) => {
    digits.value = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '')
  },
  { immediate: true },
)

function emitCode() {
  model.value = digits.value.join('')
}

function focus(index: number) {
  nextTick(() => boxes.value[index]?.focus())
}

function onInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const digit = input.value.replace(/\D/g, '').slice(-1)
  digits.value[index] = digit
  input.value = digit
  emitCode()
  if (digit && index < LENGTH - 1) focus(index + 1)
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    event.preventDefault()
    digits.value[index - 1] = ''
    emitCode()
    focus(index - 1)
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, LENGTH)
  if (!pasted) return
  digits.value = Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? '')
  emitCode()
  focus(Math.min(pasted.length, LENGTH - 1))
}
</script>

<template>
  <fieldset class="code" :aria-describedby="describedBy" :class="{ invalid }">
    <legend class="code__legend">{{ label }}</legend>
    <div class="code__boxes">
      <input
        v-for="(_, i) in digits"
        :key="i"
        :ref="(el) => (boxes[i] = el as HTMLInputElement)"
        :value="digits[i]"
        class="code__box"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="1"
        :aria-label="`Dígito ${i + 1} de ${LENGTH}`"
        :aria-invalid="invalid || undefined"
        @input="onInput(i, $event)"
        @keydown="onKeydown(i, $event)"
        @paste="onPaste"
      />
    </div>
  </fieldset>
</template>

<style scoped>
.code {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.code__legend {
  font-weight: 600;
  margin-bottom: var(--space-2);
  padding: 0;
}
.code__boxes {
  display: flex;
  gap: var(--space-2);
}
.code__box {
  width: 100%;
  max-width: 52px;
  aspect-ratio: 4 / 5;
  text-align: center;
  font: inherit;
  font-size: var(--text-2xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--sheet);
  color: var(--ink);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  outline: none;
}
.code__box:focus {
  border-color: var(--blue);
  box-shadow: var(--focus-ring);
}
.invalid .code__box {
  border-color: var(--red);
}
</style>
