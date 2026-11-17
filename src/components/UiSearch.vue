<script setup lang="ts">
/** Buscador plegado: muestra un botón y se abre al hacer clic. Esc lo limpia y lo cierra. */
import { computed, nextTick, ref } from 'vue'
import { Search } from 'lucide-vue-next'

import UiInput from './UiInput.vue'

withDefaults(defineProps<{ label?: string; placeholder?: string; name?: string }>(), {
  label: 'Buscar',
  placeholder: '',
  name: 'search',
})
const model = defineModel<string>({ default: '' })

const open = ref(false)
const field = ref<InstanceType<typeof UiInput> | null>(null)
const isOpen = computed(() => open.value || model.value.trim() !== '')

async function show() {
  open.value = true
  await nextTick()
  ;(field.value?.$el as HTMLElement | undefined)?.querySelector('input')?.focus()
}

function close() {
  model.value = ''
  open.value = false
}

// Al salir del campo, si quedó vacío, vuelve a plegarse.
function onBlur() {
  if (!model.value.trim()) open.value = false
}
</script>

<template>
  <div class="ui-search">
    <span class="ui-search__label">{{ label }}</span>
    <button v-if="!isOpen" type="button" class="ui-search__open" @click="show">
      <Search :size="16" aria-hidden="true" />
      {{ placeholder || 'Buscar' }}
    </button>
    <UiInput
      v-else
      ref="field"
      v-model="model"
      type="search"
      :name="name"
      :aria-label="label"
      :placeholder="placeholder"
      autocomplete="off"
      @keydown.esc="close"
      @blur="onBlur"
    />
  </div>
</template>

<style scoped>
.ui-search {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  align-content: start;
}
.ui-search__label {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--ink);
  height: 1.5rem;
  display: flex;
  align-items: center;
}
.ui-search__open {
  width: 100%;
  height: 41px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--sheet);
  color: var(--ink-3);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.ui-search__open:hover {
  color: var(--blue);
  border-color: var(--blue);
}
.ui-search__open:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
