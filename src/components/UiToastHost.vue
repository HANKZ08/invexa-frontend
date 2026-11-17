<script setup lang="ts">
/** Región donde se anuncian los avisos. Se monta una vez en el layout. */
import { computed } from 'vue'

import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const polite = computed(() => toasts.value.filter((t) => t.kind !== 'error'))
const urgent = computed(() => toasts.value.filter((t) => t.kind === 'error'))
const LABEL = { success: 'Listo', info: 'Aviso', error: 'Error' } as const
</script>

<template>
  <div class="ui-toasts">
    <div role="alert" class="ui-toasts__group">
      <div v-for="t in urgent" :key="t.id" class="ui-toast ui-toast--error">
        <strong>{{ LABEL[t.kind] }}</strong>
        <p>{{ t.message }}</p>
        <button type="button" aria-label="Cerrar aviso" @click="dismiss(t.id)">×</button>
      </div>
    </div>
    <div aria-live="polite" class="ui-toasts__group">
      <div v-for="t in polite" :key="t.id" class="ui-toast" :class="`ui-toast--${t.kind}`">
        <strong>{{ LABEL[t.kind] }}</strong>
        <p>{{ t.message }}</p>
        <button type="button" aria-label="Cerrar aviso" @click="dismiss(t.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-toasts {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: 50;
  display: grid;
  gap: var(--space-2);
  width: min(380px, calc(100vw - 2 * var(--space-4)));
}
.ui-toasts__group {
  display: grid;
  gap: var(--space-2);
}
.ui-toast {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--sheet);
  color: var(--ink);
  box-shadow: var(--shadow-raised);
  animation: ui-toast-in var(--duration-base) var(--ease-out);
}
.ui-toast strong {
  font-size: var(--text-sm);
  font-stretch: var(--stretch-narrow);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ui-toast p {
  grid-column: 1;
  font-size: var(--text-md);
}
.ui-toast button {
  all: unset;
  cursor: pointer;
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: start;
  font-size: var(--text-xl);
  line-height: 1;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--ink-2);
}
.ui-toast button:focus-visible {
  box-shadow: var(--focus-ring);
}
.ui-toast--success {
  background: var(--copy-green);
  color: var(--copy-green-ink);
}
.ui-toast--error {
  background: var(--copy-pink);
  color: var(--copy-pink-ink);
}
.ui-toast--info strong {
  color: var(--blue);
}
.ui-toast--success button,
.ui-toast--error button {
  color: inherit;
}
@keyframes ui-toast-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
