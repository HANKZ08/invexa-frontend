<script setup lang="ts">
/**
 * Diálogo modal sobre <dialog> nativo: atrapa el foco, se cierra con Esc
 * y devuelve el foco al elemento que lo abrió.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

defineProps<{ title: string; description?: string }>()
const open = defineModel<boolean>('open', { default: false })

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = `dialog-${useId()}`
let opener: HTMLElement | null = null

function show() {
  const el = dialog.value
  if (!el || el.hasAttribute('open')) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  el.showModal()
}

function hide() {
  const el = dialog.value
  if (el?.hasAttribute('open')) el.close()
  else restoreFocus()
}

function restoreFocus() {
  const target = opener
  opener = null
  if (target?.isConnected) nextTick(() => target.focus())
}

function onClose() {
  open.value = false
  restoreFocus()
}

watch(open, (value) => (value ? show() : hide()))
onMounted(() => {
  if (open.value) show()
})
onBeforeUnmount(() => {
  if (dialog.value?.hasAttribute('open')) dialog.value.close()
})
</script>

<template>
  <dialog ref="dialog" class="ui-dialog" :aria-labelledby="titleId" @close="onClose">
    <header class="ui-dialog__head">
      <h2 :id="titleId">{{ title }}</h2>
      <button type="button" class="ui-dialog__close" aria-label="Cerrar" @click="open = false">
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <p v-if="description" class="ui-dialog__description">{{ description }}</p>
    <div class="ui-dialog__body"><slot /></div>
    <footer v-if="$slots.footer" class="ui-dialog__footer"><slot name="footer" /></footer>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  width: min(480px, calc(100vw - 2 * var(--space-4)));
  border: 0;
  border-radius: var(--radius-md);
  padding: var(--space-6);
  background: var(--sheet);
  color: var(--ink);
  box-shadow: var(--shadow-raised);
}
.ui-dialog::backdrop {
  background: rgb(16 19 28 / 0.45);
}
.ui-dialog[open] {
  animation: ui-dialog-in var(--duration-base) var(--ease-out);
}
.ui-dialog__head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: var(--space-4);
}
.ui-dialog__head h2 {
  font-size: var(--text-2xl);
}
.ui-dialog__close {
  all: unset;
  cursor: pointer;
  font-size: var(--text-2xl);
  line-height: 1;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  color: var(--ink-2);
}
.ui-dialog__close:hover {
  background: var(--sheet-sunken);
  color: var(--ink);
}
.ui-dialog__close:focus-visible {
  box-shadow: var(--focus-ring);
}
.ui-dialog__description {
  color: var(--ink-2);
  margin-top: var(--space-2);
}
.ui-dialog__body {
  margin-top: var(--space-4);
}
.ui-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
@keyframes ui-dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* Ventanas emergentes: nunca más altas que la pantalla; en móvil ocupan casi todo el ancho */
.ui-dialog {
  max-height: calc(100dvh - 2 * var(--space-4));
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 640px) {
  .ui-dialog {
    width: calc(100vw - 2 * var(--space-3));
    max-height: calc(100dvh - 2 * var(--space-3));
    padding: var(--space-5);
  }
}
</style>
