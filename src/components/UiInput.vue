<script setup lang="ts">
/** Campo de texto con v-model. Los atributos (id, type, inputmode…) pasan al <input>. */
defineOptions({ inheritAttrs: false })

defineProps<{
  invalid?: boolean
  prefix?: string
}>()

const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <div class="ui-input" :class="{ 'ui-input--invalid': invalid }">
    <span v-if="prefix" class="ui-input__prefix" aria-hidden="true">{{ prefix }}</span>
    <input
      v-model="model"
      class="ui-input__control"
      v-bind="$attrs"
      :aria-invalid="invalid || undefined"
    />
  </div>
</template>

<style scoped>
.ui-input {
  display: flex;
  align-items: center;
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-out);
}
.ui-input:hover {
  border-color: var(--ink-3);
}
.ui-input:focus-within {
  border-color: var(--blue);
  box-shadow: var(--focus-ring);
}
.ui-input--invalid {
  border-color: var(--red);
}
.ui-input__prefix {
  padding-left: var(--space-3);
  color: var(--ink-3);
  font-weight: 600;
}
.ui-input__control {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  padding: var(--space-2) var(--space-3);
  outline: none;
}
.ui-input__control::placeholder {
  color: var(--ink-3);
}
.ui-input__control:disabled {
  cursor: not-allowed;
  color: var(--ink-3);
}
</style>
