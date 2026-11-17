<script setup lang="ts">
/**
 * Envoltura de un control de formulario: label, ayuda y error asociados por id.
 * El slot recibe `{ id, describedBy, invalid }` para conectarlos al control.
 */
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  hint?: string
  error?: string
  required?: boolean
  id?: string
}>()

const autoId = useId()
const controlId = computed(() => props.id ?? `field-${autoId}`)
const hintId = computed(() => `${controlId.value}-hint`)
const errorId = computed(() => `${controlId.value}-error`)
const describedBy = computed(() =>
  [props.hint ? hintId.value : '', props.error ? errorId.value : ''].filter(Boolean).join(' '),
)
</script>

<template>
  <div class="ui-field" :class="{ 'ui-field--invalid': !!error }">
    <label class="ui-field__label" :for="controlId">
      {{ label }}
      <span v-if="required" class="ui-field__required"
        ><span aria-hidden="true">*</span><span class="visually-hidden"> (obligatorio)</span></span
      >
    </label>
    <slot :id="controlId" :described-by="describedBy || undefined" :invalid="!!error" />
    <p v-if="hint" :id="hintId" class="ui-field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="ui-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.ui-field {
  display: grid;
  gap: var(--space-1);
}
.ui-field__label {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--ink);
  /* Altura fija: las etiquetas de una misma fila quedan alineadas aunque una sea obligatoria */
  height: 1.5rem;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.ui-field__required {
  color: var(--red);
  margin-left: 2px;
}
.ui-field__hint {
  font-size: var(--text-sm);
  color: var(--ink-3);
}
.ui-field__error {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--red);
}
</style>
