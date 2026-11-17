<script setup lang="ts">
/** Alta y edición de producto. Valida precios antes de enviar y muestra los errores de la API en su campo. */
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiSelect from '@/components/UiSelect.vue'
import { toast } from '@/composables/useToast'

import {
  createProduct,
  fetchCategories,
  fetchSuppliers,
  updateProduct,
  type Product,
  type ProductRequest,
} from '../api'

const props = defineProps<{ product: Product | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const queryClient = useQueryClient()
const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers })

const emptyForm = () => ({
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  supplier: '',
  cost_price: '',
  sale_price: '',
  min_stock: '5',
  is_active: true,
})
const form = reactive(emptyForm())
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')

watch(
  () => [open.value, props.product] as const,
  ([isOpen, product]) => {
    if (!isOpen) return
    Object.assign(
      form,
      emptyForm(),
      product
        ? {
            sku: product.sku,
            barcode: product.barcode ?? '',
            name: product.name,
            description: product.description ?? '',
            category: String(product.category),
            supplier: product.supplier ? String(product.supplier) : '',
            cost_price: product.cost_price,
            sale_price: product.sale_price,
            min_stock: String(product.min_stock),
            is_active: product.is_active,
          }
        : {},
    )
    for (const key of Object.keys(errors)) errors[key] = undefined
    formError.value = ''
  },
  { immediate: true },
)

const categoryOptions = computed(() =>
  (categories.data.value?.results ?? []).map((c) => ({ value: c.id, label: c.name })),
)
const supplierOptions = computed(() =>
  (suppliers.data.value?.results ?? []).map((s) => ({ value: s.id, label: s.name })),
)

function validate(): boolean {
  const cost = Number(form.cost_price)
  const sale = Number(form.sale_price)
  errors.sku = form.sku.trim() ? undefined : 'Escribe el SKU del producto.'
  errors.name = form.name.trim() ? undefined : 'Escribe el nombre del producto.'
  errors.category = form.category ? undefined : 'Elige una categoría.'
  errors.cost_price =
    form.cost_price !== '' && cost >= 0 ? undefined : 'Escribe el precio de costo.'
  errors.sale_price =
    form.sale_price === '' || sale < 0.01
      ? 'Escribe el precio de venta (mínimo S/ 0.01).'
      : sale < cost
        ? 'El precio de venta no puede ser menor al costo.'
        : undefined
  errors.min_stock =
    Number(form.min_stock) >= 0 && form.min_stock !== '' ? undefined : 'Escribe un número, 0 o más.'
  return !Object.values(errors).some(Boolean)
}

function toBody(): ProductRequest {
  return {
    sku: form.sku.trim(),
    barcode: form.barcode.trim() || null,
    name: form.name.trim(),
    description: form.description,
    category: Number(form.category),
    supplier: form.supplier ? Number(form.supplier) : null,
    cost_price: form.cost_price,
    sale_price: form.sale_price,
    min_stock: Number(form.min_stock),
    is_active: form.is_active,
  } as ProductRequest
}

const save = useMutation({
  mutationFn: () =>
    props.product ? updateProduct(props.product.id, toBody()) : createProduct(toBody()),
  onSuccess: (saved) => {
    toast.success(`Producto ${saved.sku} guardado.`)
    queryClient.invalidateQueries({ queryKey: ['products'] })
    emit('saved')
    open.value = false
  },
  onError: (error) => {
    if (!(error instanceof ApiError)) {
      formError.value = 'No pudimos guardar el producto. Inténtalo de nuevo.'
      return
    }
    for (const field of [
      'sku',
      'barcode',
      'name',
      'category',
      'supplier',
      'cost_price',
      'sale_price',
      'min_stock',
    ]) {
      errors[field] = error.fieldError(field)
    }
    formError.value = Object.values(errors).some(Boolean) ? '' : error.message
  },
})

function submit() {
  formError.value = ''
  if (!validate()) return
  save.mutate()
}
</script>

<template>
  <UiDialog v-model:open="open" :title="product ? 'Editar producto' : 'Nuevo producto'">
    <form novalidate class="grid" @submit.prevent="submit">
      <div class="two">
        <UiField v-slot="f" label="SKU" :error="errors.sku" required>
          <UiInput
            :id="f.id"
            v-model="form.sku"
            name="sku"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Código de barras" :error="errors.barcode">
          <UiInput
            :id="f.id"
            v-model="form.barcode"
            name="barcode"
            inputmode="numeric"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
      </div>
      <UiField v-slot="f" label="Nombre" :error="errors.name" required>
        <UiInput
          :id="f.id"
          v-model="form.name"
          name="name"
          :invalid="f.invalid"
          :aria-describedby="f.describedBy"
        />
      </UiField>
      <div class="two">
        <UiField v-slot="f" label="Categoría" :error="errors.category" required>
          <UiSelect
            :id="f.id"
            v-model="form.category"
            name="category"
            placeholder="Elige…"
            :options="categoryOptions"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Proveedor" :error="errors.supplier">
          <UiSelect
            :id="f.id"
            v-model="form.supplier"
            name="supplier"
            placeholder="Sin proveedor"
            :options="supplierOptions"
            :aria-describedby="f.describedBy"
          />
        </UiField>
      </div>
      <div class="two">
        <UiField v-slot="f" label="Precio de costo" :error="errors.cost_price" required>
          <UiInput
            :id="f.id"
            v-model="form.cost_price"
            name="cost_price"
            prefix="S/"
            inputmode="decimal"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Precio de venta" :error="errors.sale_price" required>
          <UiInput
            :id="f.id"
            v-model="form.sale_price"
            name="sale_price"
            prefix="S/"
            inputmode="decimal"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
      </div>
      <UiField
        v-slot="f"
        label="Stock mínimo"
        :error="errors.min_stock"
        hint="Cuando el stock llegue a este número, aparece para reponer."
      >
        <UiInput
          :id="f.id"
          v-model="form.min_stock"
          name="min_stock"
          inputmode="numeric"
          :invalid="f.invalid"
          :aria-describedby="f.describedBy"
        />
      </UiField>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="actions">
        <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
        <UiButton type="submit" variant="primary" :loading="save.isPending.value">Guardar</UiButton>
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--space-4);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
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
@media (max-width: 640px) {
  .two {
    grid-template-columns: 1fr;
  }
}
</style>
