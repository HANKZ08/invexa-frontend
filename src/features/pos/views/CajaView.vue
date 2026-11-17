<script setup lang="ts">
/** Caja: escaneo con lector, carrito, cobro, cliente opcional y atajos de teclado. */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import { toast } from '@/composables/useToast'
import { useCartStore } from '../store'
import { evaluatePayments, isCash, PAYMENT_METHODS, type PaymentLine } from '../payments'
import { addLine, removeLine, setQuantity, totals, type SellableProduct } from '../cart'
import {
  createCustomer,
  createSale,
  findCustomer,
  openInvoice,
  searchProducts,
  type Customer,
} from '../api'
import { formatMoney } from '@/utils/format'

const cart = useCartStore()
const queryClient = useQueryClient()

const scan = ref('')
const notice = ref('')
const browsing = ref(false)
// El buscador va cerrado; se abre con clic en el botón o con F2.
const searchOpen = ref(false)
const scanInput = ref<HTMLInputElement | null>(null)

let nextLineId = 2
const payLines = ref<PaymentLine[]>([{ id: 1, method: 'cash', amount: '', reference: '' }])
const check = computed(() =>
  evaluatePayments(amounts.value.total, payLines.value, { allowDebt: !!customer.value }),
)
const debtHint = computed(() =>
  !customer.value && !check.value.valid && check.value.missing > 0
    ? `Si el cliente paga después, elige su DNI o RUC para dejar ${formatMoney(check.value.missing)} de deuda.`
    : '',
)
function addPayLine() {
  payLines.value.push({ id: nextLineId++, method: 'yape', amount: '', reference: '' })
}
function removePayLine(id: number) {
  payLines.value = payLines.value.filter((l) => l.id !== id)
}
const discount = ref('')
const formError = ref('')
const done = ref<{
  id: number
  number: string
  total: string
  change: string | null
  pending: string | null
} | null>(null)

const customer = ref<Customer | null>(null)
const docSearch = ref('')
const docNotFound = ref(false)
const newCustomer = reactive({ name: '' })

const amounts = computed(() => totals(cart.lines, Number(discount.value) || 0))
const canPay = computed(() => cart.lines.length > 0 && !cart.busy && check.value.valid)

function focusScan() {
  nextTick(() => scanInput.value?.focus())
}

function openSearch() {
  searchOpen.value = true
  focusScan()
}

// Esc: cierra el buscador y limpia su texto.
function closeSearch() {
  browsing.value = false
  scan.value = ''
  searchOpen.value = false
}

// Al salir del campo: si quedó vacío, el buscador vuelve a cerrarse.
function onBlur() {
  browsing.value = false
  if (!scan.value.trim()) searchOpen.value = false
}

function add(product: SellableProduct) {
  const result = addLine(cart.lines, product)
  if (result.error) notice.value = result.error
  else {
    cart.lines = result.lines
    notice.value = ''
  }
  scan.value = ''
  focusScan()
}

const pickerText = computed(() => scan.value.trim())
const picker = useQuery({
  queryKey: computed(() => ['pos-picker', pickerText.value]),
  queryFn: async () =>
    ((await searchProducts(pickerText.value)).results ?? []) as unknown as SellableProduct[],
  enabled: computed(() => browsing.value),
  placeholderData: (previous) => previous,
})

function openPicker() {
  browsing.value = true
}

async function onScan() {
  const query = scan.value.trim()
  if (!query) return
  notice.value = ''
  try {
    const data = await searchProducts(query)
    const results = (data.results ?? []) as unknown as SellableProduct[]
    const exact = results.find(
      (p) =>
        (p as unknown as { barcode: string | null }).barcode === query ||
        p.sku.toLowerCase() === query.toLowerCase(),
    )
    if (exact) return add(exact)
    if (results.length) {
      browsing.value = true
      notice.value = 'Elige el producto de la lista.'
      return
    }
    notice.value = `No encontramos «${query}». Revisa el código o prueba con el nombre.`
    scan.value = ''
  } catch {
    notice.value = 'No pudimos buscar el producto. Revisa tu conexión.'
  }
}

function setQty(productId: number, quantity: number) {
  const result = setQuantity(cart.lines, productId, quantity)
  if (result.error) notice.value = result.error
  else cart.lines = result.lines
}

function remove(productId: number) {
  cart.lines = removeLine(cart.lines, productId)
}

async function lookupCustomer() {
  docNotFound.value = false
  customer.value = null
  const document = docSearch.value.trim()
  if (!document) return
  const data = await findCustomer(document)
  const found = (data.results ?? []).find((c) => c.document_id === document)
  if (found) customer.value = found
  else docNotFound.value = true
}

const addCustomer = useMutation({
  mutationFn: () =>
    createCustomer({ name: newCustomer.name.trim(), document_id: docSearch.value.trim() }),
  onSuccess: (created) => {
    customer.value = created
    docNotFound.value = false
    toast.success(`Cliente ${created.name} guardado.`)
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  },
  onError: (error) => {
    notice.value = error instanceof ApiError ? error.message : 'No pudimos guardar el cliente.'
  },
})

const pay = useMutation({
  mutationFn: () => {
    cart.busy = true
    return createSale({
      customer: customer.value?.id ?? null,
      payments: payLines.value.map((l) => ({
        method: l.method,
        amount: String(Number(l.amount)),
        reference: l.reference.trim(),
      })),
      discount: String(Number(discount.value) || 0),
      notes: '',
      items: cart.lines.map((l) => ({ product: l.productId, quantity: l.quantity })),
    })
  },
  onSuccess: (sale) => {
    done.value = {
      id: sale.id,
      number: sale.number ?? '',
      total: String(sale.total),
      change: sale.change == null ? null : String(sale.change),
      pending: sale.status === 'pending' ? String(sale.balance) : null,
    }
    cart.clear()
    payLines.value = [{ id: nextLineId++, method: 'cash', amount: '', reference: '' }]
    discount.value = ''
    customer.value = null
    docSearch.value = ''
    formError.value = ''
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      const items = error.fieldError('items')
      const amount = error.fieldError('amount_paid')
      formError.value = items ?? amount ?? error.message
    } else {
      formError.value = 'No pudimos cobrar. Tu carrito sigue aquí; inténtalo de nuevo.'
    }
  },
  onSettled: () => {
    cart.busy = false
  },
})

function cobrar() {
  formError.value = ''
  if (!canPay.value) return
  pay.mutate()
}

function nuevaVenta() {
  done.value = null
  notice.value = ''
  focusScan()
}

async function verFactura() {
  if (!done.value) return
  try {
    await openInvoice(done.value.id)
  } catch {
    toast.error('No pudimos abrir la factura.')
  }
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing =
    target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA'
  if (event.key === 'F2') {
    event.preventDefault()
    openSearch()
  } else if (event.key === 'F4' && cart.lines.length) {
    event.preventDefault()
    ;(document.querySelector('input[name="pay-amount"]') as HTMLElement | null)?.focus()
  } else if (
    event.key === 'F8' &&
    !typing &&
    canPay.value &&
    payLines.value.every((l) => isCash(l.method))
  ) {
    event.preventDefault()
    cobrar()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="caja">
    <div class="left">
      <header class="head">
        <h1>Caja</h1>
        <p class="hint">F2 buscar · F4 cobrar · F8 cobrar en efectivo</p>
      </header>

      <div class="search">
        <button
          v-if="!searchOpen"
          type="button"
          class="open-search"
          aria-controls="scan-search"
          @click="openSearch"
        >
          Buscar producto <kbd>F2</kbd>
        </button>
        <UiField
          v-else
          v-slot="f"
          label="Código, SKU o nombre"
          hint="Con lector: escanea y pulsa Enter. Haz clic o escribe para ver los productos."
        >
          <input
            id="scan-search"
            ref="scanInput"
            v-model="scan"
            name="scan"
            class="scan"
            type="search"
            autocomplete="off"
            role="combobox"
            aria-controls="product-list"
            :aria-expanded="browsing && !!picker.data.value?.length"
            :aria-describedby="f.describedBy"
            @focus="openPicker"
            @click="openPicker"
            @input="openPicker"
            @keydown.enter.prevent="onScan"
            @keydown.esc="closeSearch"
            @blur="onBlur"
          />
        </UiField>
        <ul
          v-if="browsing && picker.data.value?.length"
          id="product-list"
          class="candidates"
          aria-label="Productos"
        >
          <li v-for="p in picker.data.value" :key="p.id">
            <button type="button" @mousedown.prevent @click="add(p)">
              <span class="sku">{{ p.sku }}</span> {{ p.name }}
              <span class="price">{{ formatMoney(p.sale_price) }} · stock {{ p.stock }}</span>
            </button>
          </li>
        </ul>
      </div>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>

      <article class="sheet">
        <p v-if="!cart.lines.length" class="empty">
          Escanea un producto o escribe su nombre para empezar.
        </p>
        <table v-else>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="r">Precio</th>
              <th class="r">Cant.</th>
              <th class="r">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in cart.lines" :key="line.productId">
              <td>
                <span class="sku">{{ line.sku }}</span> {{ line.name }}
              </td>
              <td class="r num">{{ formatMoney(line.unitPrice) }}</td>
              <td class="r">
                <div class="qty">
                  <button
                    type="button"
                    :aria-label="`Quitar una unidad de ${line.name}`"
                    @click="setQty(line.productId, line.quantity - 1)"
                  >
                    −
                  </button>
                  <span class="num">{{ line.quantity }}</span>
                  <button
                    type="button"
                    :aria-label="`Agregar una unidad de ${line.name}`"
                    @click="setQty(line.productId, line.quantity + 1)"
                  >
                    +
                  </button>
                </div>
              </td>
              <td class="r num">{{ formatMoney(line.unitPrice * line.quantity) }}</td>
              <td>
                <button
                  type="button"
                  class="remove"
                  :aria-label="`Quitar ${line.name}`"
                  @click="remove(line.productId)"
                >
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>

    <aside class="right" aria-label="Cobrar">
      <article v-if="done" class="sheet done" role="status">
        <p class="serial">{{ done.number }}</p>
        <p class="big">Venta registrada</p>
        <p v-if="done.pending !== null" class="pending-note">
          Venta pendiente. Saldo por cobrar:
          <strong class="num">{{ formatMoney(done.pending) }}</strong>
        </p>
        <p v-if="done.change !== null">
          Cambio: <strong class="num">{{ formatMoney(done.change) }}</strong>
        </p>
        <p>
          Total: <strong class="num">{{ formatMoney(done.total) }}</strong>
        </p>
        <div class="actions">
          <UiButton variant="secondary" @click="verFactura">Ver factura</UiButton>
          <UiButton variant="primary" @click="nuevaVenta">Nueva venta</UiButton>
        </div>
      </article>

      <article v-else class="sheet">
        <dl class="totals">
          <div>
            <dt>Subtotal</dt>
            <dd class="num">{{ formatMoney(amounts.subtotal) }}</dd>
          </div>
          <div>
            <dt><label for="discount">Descuento (S/)</label></dt>
            <dd>
              <input
                id="discount"
                v-model="discount"
                name="discount"
                class="small"
                inputmode="decimal"
              />
            </dd>
          </div>
          <div>
            <dt>IGV 18 %</dt>
            <dd class="num">{{ formatMoney(amounts.tax) }}</dd>
          </div>
          <div class="grand">
            <dt>Total</dt>
            <dd class="num">{{ formatMoney(amounts.total) }}</dd>
          </div>
        </dl>
        <p class="estimate">Total estimado. El servidor confirma el monto al cobrar.</p>

        <fieldset class="group">
          <legend>Cliente (opcional)</legend>
          <div class="doc">
            <input
              v-model="docSearch"
              name="document"
              aria-label="DNI o RUC del cliente"
              placeholder="DNI o RUC"
              inputmode="numeric"
              @keydown.enter.prevent="lookupCustomer"
            />
            <UiButton size="sm" variant="secondary" @click="lookupCustomer">Buscar</UiButton>
          </div>
          <p v-if="customer" class="ok">{{ customer.name }} · {{ customer.document_id }}</p>
          <div v-else-if="docNotFound" class="new">
            <p>No existe. Escribe el nombre para darlo de alta:</p>
            <input
              v-model="newCustomer.name"
              name="customer-name"
              placeholder="Nombre o razón social"
            />
            <UiButton
              size="sm"
              variant="primary"
              :loading="addCustomer.isPending.value"
              @click="addCustomer.mutate()"
              >Guardar cliente</UiButton
            >
          </div>
          <p v-else class="hint">Sin cliente: consumidor final.</p>
        </fieldset>

        <fieldset class="group">
          <legend>Pagos</legend>
          <div v-for="(line, index) in payLines" :key="line.id" class="pay-line">
            <select
              v-model="line.method"
              :name="`pay-method-${index}`"
              :aria-label="`Medio del pago ${index + 1}`"
            >
              <option v-for="m in PAYMENT_METHODS" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
            <input
              v-model="line.amount"
              name="pay-amount"
              class="amount"
              inputmode="decimal"
              :aria-label="`Monto del pago ${index + 1} (S/)`"
              placeholder="0.00"
            />
            <input
              v-if="!isCash(line.method)"
              v-model="line.reference"
              name="pay-ref"
              class="ref"
              :aria-label="`Número de operación del pago ${index + 1}`"
              placeholder="N.° de operación"
            />
            <button
              v-if="payLines.length > 1"
              type="button"
              class="remove"
              :aria-label="`Quitar el pago ${index + 1}`"
              @click="removePayLine(line.id)"
            >
              ×
            </button>
          </div>
          <button type="button" class="add-pay" @click="addPayLine">
            + Agregar otro medio de pago
          </button>
        </fieldset>

        <p class="change" aria-live="polite">
          <template v-if="check.valid && check.change > 0"
            >Cambio (en efectivo):
            <strong class="num">{{ formatMoney(check.change) }}</strong></template
          >
          <template v-else-if="check.valid && check.debt > 0"
            >Quedará como deuda: <strong class="num">{{ formatMoney(check.debt) }}</strong
            >. Venta pendiente.</template
          >
          <template v-else-if="!check.valid && !check.error && check.missing > 0"
            >Falta cubrir <strong class="num">{{ formatMoney(check.missing) }}</strong> en
            efectivo.</template
          >
          <template v-if="debtHint"><br />{{ debtHint }}</template>
        </p>

        <p v-if="formError || check.error" class="form-error" role="alert">
          {{ formError || check.error }}
        </p>

        <UiButton
          data-pay
          class="pay"
          variant="primary"
          size="lg"
          block
          :loading="pay.isPending.value"
          :disabled="!canPay"
          @click="cobrar"
        >
          {{
            check.debt > 0
              ? `Dejar deuda ${formatMoney(check.debt)}`
              : `Cobrar ${formatMoney(amounts.total)}`
          }}
        </UiButton>
      </article>
    </aside>
  </section>
</template>

<style scoped>
.caja {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: var(--space-5);
  padding: var(--space-6);
  min-height: 100dvh;
  align-items: start;
}
.left,
.right {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  min-width: 0;
}
.left > .sheet {
  min-width: 0;
  overflow-x: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: var(--space-3);
  flex-wrap: wrap;
}
h1 {
  font-size: var(--text-3xl);
}
.hint {
  color: var(--ink-3);
  font-size: var(--text-sm);
}
.open-search {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--sheet);
  color: var(--ink-3);
  border: 2px dashed color-mix(in srgb, var(--blue) 55%, transparent);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--text-lg);
  cursor: pointer;
  text-align: left;
}
.open-search:hover {
  color: var(--blue);
  border-color: var(--blue);
}
.open-search:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.scan {
  width: 100%;
  font: inherit;
  font-size: var(--text-xl);
  padding: var(--space-3) var(--space-4);
  background: var(--sheet);
  color: var(--ink);
  border: 2px solid var(--blue);
  border-radius: var(--radius-md);
}
.scan:focus {
  outline: none;
  box-shadow: var(--focus-ring);
}
.notice {
  color: var(--copy-yellow-ink);
  background: var(--copy-yellow);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
}
.search {
  position: relative;
}
.candidates {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 360px;
  overflow-y: auto;
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-raised);
  padding: var(--space-1);
  z-index: 20;
}
.candidates .price {
  display: block;
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.pay-line {
  display: grid;
  grid-template-columns: minmax(120px, 1.1fr) minmax(90px, 1fr) minmax(120px, 1.2fr) auto;
  gap: var(--space-2);
  align-items: center;
}
.pay-line select,
.pay-line input {
  font: inherit;
  width: 100%;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--sheet-sunken);
  color: var(--ink);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
}
.pay-line select:focus,
.pay-line input:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: var(--focus-ring);
}
.pay-line .amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.add-pay {
  all: unset;
  cursor: pointer;
  box-sizing: border-box;
  width: 100%;
  text-align: center;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--blue);
  border-radius: var(--radius-md);
  color: var(--blue);
  font-weight: 700;
}
.add-pay:hover {
  background: var(--blue-soft);
}
.add-pay:focus-visible {
  box-shadow: var(--focus-ring);
}
.candidates {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-1);
}
.candidates button {
  all: unset;
  cursor: pointer;
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--sheet);
}
.candidates button:hover,
.candidates button:focus-visible {
  background: var(--blue-soft);
  box-shadow: var(--focus-ring);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
}
.empty {
  color: var(--ink-3);
  padding: var(--space-8) 0;
  text-align: center;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  text-align: left;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  border-bottom: 2px solid var(--ink);
  padding: 0 var(--space-2) var(--space-2);
}
td {
  padding: var(--space-2);
  border-bottom: 1px dashed var(--rule);
}
.r {
  text-align: right;
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.qty {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.qty button,
.remove {
  all: unset;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--rule-strong);
  font-weight: 700;
}
.remove {
  border-color: transparent;
  color: var(--red);
}
.qty button:focus-visible,
.remove:focus-visible,
.methods button:focus-visible {
  box-shadow: var(--focus-ring);
}
.totals {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}
.totals div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}
.totals dt {
  color: var(--ink-2);
}
.totals dd {
  margin: 0;
}
.totals .grand {
  border-top: 2px solid var(--ink);
  padding-top: var(--space-2);
  font-size: var(--text-2xl);
  font-weight: 800;
}
.totals input.small {
  width: 110px;
  text-align: right;
  font: inherit;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--sheet-sunken);
  color: var(--ink);
}
.estimate {
  color: var(--ink-3);
  font-size: var(--text-sm);
}
.group {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--space-2);
}
.group legend {
  font-weight: 600;
  padding: 0;
  margin-bottom: var(--space-1);
}
.doc,
.new {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.doc input,
.new input,
.cash input {
  font: inherit;
  padding: var(--space-2) var(--space-3);
  background: var(--sheet-sunken);
  color: var(--ink);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
}
.doc input,
.new input {
  flex: 1;
  min-width: 160px;
}
.ok {
  color: var(--copy-green-ink);
  font-weight: 600;
}
.methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.methods button {
  all: unset;
  cursor: pointer;
  text-align: center;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--rule-strong);
  font-weight: 700;
}
.methods button[aria-pressed='true'] {
  background: var(--blue);
  color: var(--on-blue);
  border-color: var(--blue);
}
.cash {
  display: grid;
  gap: var(--space-1);
}
.cash label {
  font-weight: 600;
}
.big-input {
  font-size: var(--text-3xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.change {
  font-size: var(--text-lg);
  min-height: 1.5em;
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
.pay {
  font-size: var(--text-xl);
}
.done {
  text-align: center;
}
.done .serial {
  font-size: var(--text-2xl);
}
.pending-note {
  color: var(--copy-yellow-ink);
  background: var(--copy-yellow);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
}
.done .big {
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--copy-green-ink);
}
.actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}
@media (max-width: 1100px) {
  .caja {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-4);
  }
  /* Ninguna columna del cobro fuerza ancho: el panel se ajusta a la pantalla */
  .right > * {
    min-width: 0;
  }
}
@media (max-width: 480px) {
  .pay-line {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
