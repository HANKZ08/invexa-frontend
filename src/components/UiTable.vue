<script lang="ts">
export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  sortable?: boolean
  /** Se oculta en pantallas angostas (información secundaria). */
  hideOnMobile?: boolean
  /** Se oculta en pantallas menores a 1100 px (laptop y tablet). */
  hideOnNarrow?: boolean
}

export interface TableSort {
  key: string
  direction: 'asc' | 'desc'
}
</script>

<script setup lang="ts" generic="Row extends Record<string, unknown>">
/**
 * Tabla de datos con estados de carga, vacío y error, y orden por columna.
 * Celdas personalizables con slots `cell-<key>` que reciben `{ row, value }`.
 */
import UiButton from './UiButton.vue'

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: Row[]
    rowKey?: string
    caption?: string
    loading?: boolean
    error?: string
    emptyText?: string
    skeletonRows?: number
  }>(),
  { rowKey: 'id', emptyText: 'No hay registros.', skeletonRows: 5 },
)

const sort = defineModel<TableSort | null>('sort', { default: null })
defineEmits<{ retry: [] }>()

function ariaSort(column: TableColumn) {
  if (!column.sortable) return undefined
  if (sort.value?.key !== column.key) return 'none'
  return sort.value.direction === 'asc' ? 'ascending' : 'descending'
}

function toggleSort(column: TableColumn) {
  const same = sort.value?.key === column.key
  sort.value = {
    key: column.key,
    direction: same && sort.value?.direction === 'asc' ? 'desc' : 'asc',
  }
}

function keyOf(row: Row, index: number) {
  const value = row[props.rowKey]
  return typeof value === 'string' || typeof value === 'number' ? value : index
}
</script>

<template>
  <div class="ui-table">
    <table :aria-busy="loading || undefined">
      <caption v-if="caption" class="visually-hidden">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{
              right: column.align === 'right',
              'hide-mobile': column.hideOnMobile,
              'hide-narrow': column.hideOnNarrow,
            }"
            :aria-sort="ariaSort(column)"
          >
            <button v-if="column.sortable" type="button" class="sort" @click="toggleSort(column)">
              {{ column.label }}
              <span
                class="sort__icon"
                :data-dir="sort?.key === column.key ? sort.direction : 'none'"
                aria-hidden="true"
              ></span>
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="n in skeletonRows" :key="`skeleton-${n}`" class="skeleton">
            <td
              v-for="column in columns"
              :key="column.key"
              :class="{ 'hide-mobile': column.hideOnMobile, 'hide-narrow': column.hideOnNarrow }"
            >
              <span class="skeleton__bar"></span>
            </td>
          </tr>
        </template>
        <tr v-else-if="error">
          <td :colspan="columns.length" class="state">
            <p class="state__error">{{ error }}</p>
            <UiButton size="sm" @click="$emit('retry')">Reintentar</UiButton>
          </td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td :colspan="columns.length" class="state">
            <slot name="empty"
              ><p class="state__empty">{{ emptyText }}</p></slot
            >
          </td>
        </tr>
        <template v-else>
          <tr v-for="(row, index) in rows" :key="keyOf(row, index)">
            <td
              v-for="column in columns"
              :key="column.key"
              :data-label="column.label || undefined"
              :class="{
                right: column.align === 'right',
                'hide-mobile': column.hideOnMobile,
                'hide-narrow': column.hideOnNarrow,
              }"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">{{
                row[column.key]
              }}</slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ui-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}
th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  padding: 0 var(--space-2) var(--space-2);
  border-bottom: 2px solid var(--ink);
  white-space: nowrap;
}
td {
  padding: var(--space-2);
  border-bottom: 1px dashed var(--rule);
  vertical-align: middle;
}
.right {
  text-align: right;
}
tbody tr:hover td {
  background: var(--sheet-sunken);
}
.sort {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-sm);
}
.sort:hover {
  color: var(--ink);
}
.sort:focus-visible {
  box-shadow: var(--focus-ring);
}
.sort__icon {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  opacity: 0.35;
}
.sort__icon[data-dir='asc'] {
  transform: rotate(180deg);
  opacity: 1;
}
.sort__icon[data-dir='desc'] {
  opacity: 1;
}
.state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
}
.state__empty {
  color: var(--ink-3);
}
.state__error {
  color: var(--red);
  font-weight: 600;
  margin-bottom: var(--space-3);
}
.skeleton__bar {
  display: block;
  height: 0.8em;
  border-radius: var(--radius-sm);
  background: var(--rule);
  animation: ui-pulse 1.2s var(--ease-out) infinite alternate;
}
@keyframes ui-pulse {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .hide-mobile {
    display: none;
  }
}
@media (max-width: 1100px) {
  .hide-narrow {
    display: none;
  }
}
/* Móvil: cada fila es una tarjeta con etiqueta y valor, sin desplazamiento horizontal */
@media (max-width: 640px) {
  .ui-table {
    overflow: visible;
  }
  .ui-table table,
  .ui-table tbody,
  .ui-table tr,
  .ui-table td {
    display: block;
    width: 100%;
  }
  .ui-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .ui-table tbody tr:not(.skeleton):not(:has(> td.state)) {
    border: 1px solid var(--rule);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .ui-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    border: 0;
    padding: var(--space-1) 0;
    text-align: right;
  }
  .ui-table td.hide-mobile {
    display: none;
  }
  .ui-table td[data-label]::before {
    content: attr(data-label);
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--ink-3);
    text-align: left;
  }
  .ui-table td:not([data-label]):not(.state) {
    justify-content: flex-end;
  }
  .ui-table td.state {
    display: block;
    text-align: center;
  }
}
</style>
