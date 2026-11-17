<script setup lang="ts">
/** Campo de contraseña con un botón de ojo para mostrar u ocultar lo escrito. */
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

defineProps<{
  invalid?: boolean
}>()

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
  <div class="ui-password" :class="{ 'ui-password--invalid': invalid }">
    <input
      v-model="model"
      class="ui-password__control"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      :aria-invalid="invalid || undefined"
    />
    <button
      type="button"
      class="ui-password__toggle"
      :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      :aria-pressed="visible"
      :title="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" :size="18" aria-hidden="true" />
      <Eye v-else :size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ui-password {
  display: flex;
  align-items: center;
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-out);
}
.ui-password:hover {
  border-color: var(--ink-3);
}
.ui-password:focus-within {
  border-color: var(--blue);
  box-shadow: var(--focus-ring);
}
.ui-password--invalid {
  border-color: var(--red);
}
.ui-password__control {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  padding: var(--space-2) var(--space-3);
  outline: none;
}
.ui-password__control::placeholder {
  color: var(--ink-3);
}
.ui-password__toggle {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-right: var(--space-1);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
}
.ui-password__toggle:hover {
  color: var(--blue);
  background: color-mix(in srgb, var(--blue) 10%, transparent);
}
.ui-password__toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
