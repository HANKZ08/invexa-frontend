<script setup lang="ts">
/** Botón base. Primario = acción principal de la vista (uno por vista). */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`, { 'ui-button--block': block }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.ui-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.ui-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.ui-button--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}
.ui-button--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-md);
}
.ui-button--lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-lg);
}
.ui-button--block {
  width: 100%;
}

.ui-button--primary {
  background: var(--blue);
  color: var(--on-blue);
}
.ui-button--primary:hover:not(:disabled) {
  background: var(--blue-hover);
}
.ui-button--secondary {
  background: var(--sheet);
  border-color: var(--blue);
  color: var(--blue);
}
.ui-button--secondary:hover:not(:disabled) {
  background: var(--blue-soft);
}
.ui-button--ghost {
  background: transparent;
  color: var(--ink-2);
}
.ui-button--ghost:hover:not(:disabled) {
  background: var(--sheet-sunken);
  color: var(--ink);
}
.ui-button--danger {
  background: var(--sheet);
  border-color: var(--red);
  color: var(--red);
}
.ui-button--danger:hover:not(:disabled) {
  background: var(--red-soft);
}

.ui-button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}
/* Móvil: los botones pequeños siguen siendo fáciles de tocar */
@media (max-width: 640px) {
  .ui-button--sm {
    min-height: 40px;
    padding-block: var(--space-2);
  }
}
</style>
