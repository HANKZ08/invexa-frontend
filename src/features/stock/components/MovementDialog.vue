<script setup lang="ts">
/** Registrar entrada, salida o conteo físico. Muestra el resultado antes de confirmar. */
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiSelect from '@/components/UiSelect.vue'
import { toast } from '@/composables/useToast'

import { createMovement, previewResult, type MovementType } from '../api'

export interface StockProduct {
  id: number
  sku: string
  name: string
  stock: number
}

const props = defineProps<{ product: StockProduct | null; initialType?: MovementType }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const queryClient = useQueryClient()
const form = reactive({ type: 'in' as MovementType, quantity: '', note: '' })
const errors = reactive<{ quantity?: string }>({})
const formError = ref('')

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    Object.assign(form, { type: props.initialType ?? 'in', quantity: '', note: '' })
    errors.quantity = undefined
    formError.value = ''
  },
)

const typeOptions = [
  { value: 'in', label: 'Entrada (llegó mercadería)' },
  { value: 'out', label: 'Salida (merma, rotura, uso interno)' },
  { value: 'adjustment', label: 'Conteo físico' },
]

const quantityNumber = computed(() => Number(form.quantity))
const preview = computed(() => {
  if (!props.product || form.quantity === '' || Number.isNaN(quantityNumber.value)) return null
  return previewResult({
    stock: props.product.stock,
    type: form.type,
    quantity: quantityNumber.value,
  })
})
const previewText = computed(() => {
  if (!props.product || !preview.value) return ''
  return `Stock actual ${props.product.stock} → quedará ${preview.value.after}`
})

function validate(): boolean {
  const q = quantityNumber.value
  errors.quantity = undefined
  if (form.quantity === '' || !Number.isInteger(q) || q < 0) {
    errors.quantity = 'Escribe una cantidad entera.'
  } else if (form.type !== 'adjustment' && q < 1) {
    errors.quantity = 'Debe ser mayor a cero.'
  } else if (props.product && form.type === 'out' && q > props.product.stock) {
    errors.quantity = `Stock insuficiente: hay ${props.product.stock} y pides ${q}.`
  } else if (props.product && form.type === 'adjustment' && q === props.product.stock) {
    errors.quantity = 'El conteo coincide con el stock actual.'
  }
  return !errors.quantity
}

const save = useMutation({
  mutationFn: () =>
    createMovement({
      product: props.product!.id,
      movement_type: form.type,
      quantity: quantityNumber.value,
      note: form.note.trim(),
    }),
  onSuccess: () => {
    const p = props.product!
    const result = previewResult({
      stock: p.stock,
      type: form.type,
      quantity: quantityNumber.value,
    })
    toast.success(`${p.sku}: stock ${p.stock} → ${result.after}.`)
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    queryClient.invalidateQueries({ queryKey: ['low-stock'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    emit('saved')
    open.value = false
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      errors.quantity = error.fieldError('quantity')
      formError.value = errors.quantity ? '' : error.message
    } else {
      formError.value = 'No pudimos registrar el movimiento.'
    }
  },
})

function submit() {
  formError.value = ''
  if (!props.product || !validate()) return
  save.mutate()
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Registrar movimiento"
    :description="product ? `${product.sku} · ${product.name}` : 'Elige un producto primero.'"
  >
    <form novalidate class="form" @submit.prevent="submit">
      <UiField v-slot="f" label="Tipo de movimiento" required>
        <UiSelect :id="f.id" v-model="form.type" name="movement-type" :options="typeOptions" />
      </UiField>
      <UiField
        v-slot="f"
        :label="form.type === 'adjustment' ? 'Stock contado' : 'Cantidad'"
        :error="errors.quantity"
        required
      >
        <UiInput
          :id="f.id"
          v-model="form.quantity"
          name="quantity"
          inputmode="numeric"
          :invalid="f.invalid"
          :aria-describedby="f.describedBy"
        />
      </UiField>
      <p v-if="previewText" class="preview" aria-live="polite">{{ previewText }}</p>
      <UiField v-slot="f" label="Nota" hint="Opcional: número de factura, motivo de la merma…">
        <UiInput :id="f.id" v-model="form.note" name="note" :aria-describedby="f.describedBy" />
      </UiField>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="actions">
        <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
        <UiButton
          type="submit"
          variant="primary"
          :loading="save.isPending.value"
          :disabled="!product"
          >Registrar</UiButton
        >
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.form {
  display: grid;
  gap: var(--space-4);
}
.preview {
  font-weight: 700;
  color: var(--blue);
  background: var(--blue-soft);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
</style>
