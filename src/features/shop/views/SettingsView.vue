<script setup lang="ts">
/** Configuración de la tienda (solo administrador): nombre, datos de factura, IGV y logos. */
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import { toast } from '@/composables/useToast'
import { useShopStore } from '@/stores/shop'

import { fetchShop, saveShop, type ShopAdmin } from '../api'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const shop = useShopStore()
const queryClient = useQueryClient()

const query = useQuery({
  queryKey: ['shop-settings'],
  queryFn: async () => (await fetchShop()) as ShopAdmin,
})

const form = reactive({
  name: '',
  currencySymbol: '',
  legalName: '',
  taxId: '',
  address: '',
  phone: '',
  taxPercent: '',
})
const error = ref('')

// Archivos nuevos y quitar logos: se envían solo si el administrador los eligió.
const picked = reactive<{ logo: File | null; icon: File | null }>({ logo: null, icon: null })
const removed = reactive({ logo: false, icon: false })
const previews = reactive<{ logo: string | null; icon: string | null }>({ logo: null, icon: null })

function fill(data: ShopAdmin) {
  form.name = data.name
  form.currencySymbol = data.currency_symbol
  form.legalName = data.legal_name
  form.taxId = data.tax_id
  form.address = data.address
  form.phone = data.phone
  form.taxPercent = String(Math.round(Number(data.tax_rate) * 10000) / 100)
}

watch(
  () => query.data.value,
  (data) => data && fill(data),
  { immediate: true },
)

function imageError(file: File): string | undefined {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return 'Solo se aceptan PNG, JPG o WEBP.'
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen supera los 10 MB.'
  return undefined
}

function onPick(kind: 'logo' | 'icon', event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const problem = imageError(file)
  if (problem) {
    error.value = problem
    return
  }
  error.value = ''
  picked[kind] = file
  removed[kind] = false
  previews[kind] = URL.createObjectURL(file)
}

function onRemove(kind: 'logo' | 'icon') {
  picked[kind] = null
  removed[kind] = true
  previews[kind] = null
}

const currentLogo = computed(
  () => previews.logo ?? (removed.logo ? null : (query.data.value?.logo_url ?? null)),
)
const currentIcon = computed(
  () => previews.icon ?? (removed.icon ? null : (query.data.value?.icon_url ?? null)),
)

const mutation = useMutation({
  mutationFn: () => {
    const body = new FormData()
    body.append('name', form.name.trim())
    body.append('currency_symbol', form.currencySymbol.trim())
    body.append('legal_name', form.legalName.trim())
    body.append('tax_id', form.taxId.trim())
    body.append('address', form.address.trim())
    body.append('phone', form.phone.trim())
    body.append('tax_rate', (Number(form.taxPercent) / 100).toFixed(4))
    for (const kind of ['logo', 'icon'] as const) {
      const file = picked[kind]
      if (file) body.append(kind, file)
      if (removed[kind]) body.append(`remove_${kind}`, 'true')
    }
    return saveShop(body)
  },
  onSuccess: (data) => {
    shop.apply(data)
    queryClient.setQueryData(['shop-settings'], data)
    picked.logo = null
    picked.icon = null
    removed.logo = false
    removed.icon = false
    previews.logo = null
    previews.icon = null
    error.value = ''
    toast.success('Configuración guardada.')
  },
  onError: (cause) => {
    error.value = cause instanceof Error ? cause.message : 'No pudimos guardar la configuración.'
  },
})

function validate(): string | undefined {
  if (!form.name.trim()) return 'Escribe el nombre comercial.'
  const percent = Number(form.taxPercent)
  if (Number.isNaN(percent) || percent < 0 || percent >= 100)
    return 'El IGV debe estar entre 0 y 99 %.'
  if (form.taxId && !/^\d{11}$/.test(form.taxId.trim())) return 'El RUC debe tener 11 dígitos.'
  return undefined
}

function save() {
  const problem = validate()
  if (problem) {
    error.value = problem
    return
  }
  error.value = ''
  mutation.mutate()
}
</script>

<template>
  <section class="settings">
    <header class="head">
      <h1>Configuración</h1>
      <p class="sub">Nombre, datos de la factura, IGV y las imágenes de la tienda.</p>
    </header>

    <p v-if="query.isError.value" class="notice" role="alert">
      No pudimos cargar la configuración.
      <UiButton variant="ghost" size="sm" @click="query.refetch()">Reintentar</UiButton>
    </p>

    <form v-else class="sheet" novalidate @submit.prevent="save">
      <fieldset class="group">
        <legend>Identidad</legend>
        <div class="row">
          <UiField v-slot="f" label="Nombre comercial" required>
            <UiInput
              :id="f.id"
              v-model="form.name"
              name="name"
              maxlength="120"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Símbolo de moneda" hint="Por ejemplo S/ o US$">
            <UiInput
              :id="f.id"
              v-model="form.currencySymbol"
              name="currency"
              maxlength="5"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>

        <div class="images">
          <div class="image-card">
            <span class="label">Logo completo</span>
            <div class="preview logo-preview">
              <img v-if="currentLogo" :src="currentLogo" alt="Logo actual" />
              <span v-else>Sin logo</span>
            </div>
            <div class="actions">
              <label class="file">
                Cambiar logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  name="logo"
                  @change="onPick('logo', $event)"
                />
              </label>
              <UiButton v-if="currentLogo" variant="ghost" size="sm" @click="onRemove('logo')"
                >Quitar</UiButton
              >
            </div>
          </div>

          <div class="image-card">
            <span class="label">Ícono</span>
            <div class="preview icon-preview">
              <img v-if="currentIcon" :src="currentIcon" alt="Ícono actual" />
              <span v-else>Sin ícono</span>
            </div>
            <div class="actions">
              <label class="file">
                Cambiar ícono
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  name="icon"
                  @change="onPick('icon', $event)"
                />
              </label>
              <UiButton v-if="currentIcon" variant="ghost" size="sm" @click="onRemove('icon')"
                >Quitar</UiButton
              >
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Datos para la factura</legend>
        <UiField v-slot="f" label="Razón social">
          <UiInput
            :id="f.id"
            v-model="form.legalName"
            name="legal-name"
            maxlength="160"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <div class="row">
          <UiField v-slot="f" label="RUC" hint="11 dígitos">
            <UiInput
              :id="f.id"
              v-model="form.taxId"
              name="tax-id"
              inputmode="numeric"
              maxlength="11"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Teléfono">
            <UiInput
              :id="f.id"
              v-model="form.phone"
              name="phone"
              maxlength="30"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>
        <UiField v-slot="f" label="Dirección">
          <UiInput
            :id="f.id"
            v-model="form.address"
            name="address"
            maxlength="200"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="IGV (%)" hint="Solo afecta a las ventas nuevas">
          <UiInput
            :id="f.id"
            v-model="form.taxPercent"
            name="tax-percent"
            inputmode="decimal"
            :aria-describedby="f.describedBy"
          />
        </UiField>
      </fieldset>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <footer class="footer">
        <UiButton type="submit" variant="primary" :loading="mutation.isPending.value"
          >Guardar cambios</UiButton
        >
      </footer>
    </form>
  </section>
</template>

<style scoped>
.settings {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-5);
}
.head h1 {
  margin: 0;
}
.sub {
  margin: var(--space-1) 0 0;
  color: var(--ink-3);
}
.sheet {
  display: grid;
  gap: var(--space-6);
  background: var(--sheet);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}
.group {
  display: grid;
  gap: var(--space-4);
  border: 0;
  padding: 0;
  margin: 0;
}
.group legend {
  font-weight: 700;
  padding: 0;
  margin-bottom: var(--space-2);
}
.row {
  display: grid;
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}
.images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
}
.image-card {
  display: grid;
  gap: var(--space-2);
  align-content: start;
}
.label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-3);
}
.preview {
  display: grid;
  place-items: center;
  min-height: 120px;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--ground);
  color: var(--ink-3);
  padding: var(--space-3);
}
.preview img {
  max-width: 100%;
  max-height: 140px;
  object-fit: contain;
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.file {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
.file:focus-within {
  box-shadow: var(--focus-ring);
}
.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.notice,
.error {
  margin: 0;
  color: var(--red);
  font-weight: 600;
}
.footer {
  display: flex;
  justify-content: flex-end;
}
</style>
