<script setup lang="ts">
/** Selector nativo con v-model. Los atributos (id, aria-*) pasan al <select>. */
defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

defineProps<{
  options: SelectOption[]
  placeholder?: string
  invalid?: boolean
}>()

const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <div class="ui-select" :class="{ 'ui-select--invalid': invalid }">
    <select
      v-model="model"
      class="ui-select__control"
      v-bind="$attrs"
      :aria-invalid="invalid || undefined"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.ui-select {
  position: relative;
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
}
.ui-select::after {
  content: '';
  position: absolute;
  right: var(--space-3);
  top: 50%;
  width: 7px;
  height: 7px;
  border-right: 2px solid var(--ink-2);
  border-bottom: 2px solid var(--ink-2);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
.ui-select:hover {
  border-color: var(--ink-3);
}
.ui-select:focus-within {
  border-color: var(--blue);
  box-shadow: var(--focus-ring);
}
.ui-select--invalid {
  border-color: var(--red);
}
.ui-select__control {
  appearance: none;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
  outline: none;
  cursor: pointer;
}
</style>
