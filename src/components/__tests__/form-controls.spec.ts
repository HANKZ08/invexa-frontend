import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

import UiButton from '../UiButton.vue'
import UiField from '../UiField.vue'
import UiInput from '../UiInput.vue'
import UiSelect from '../UiSelect.vue'

describe('UiButton', () => {
  it('es un <button type="button"> por defecto y emite click', async () => {
    const wrapper = mount(UiButton, { slots: { default: 'Guardar' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('aplica la variante como clase', () => {
    const wrapper = mount(UiButton, { props: { variant: 'primary' }, slots: { default: 'Cobrar' } })
    expect(wrapper.classes()).toContain('ui-button--primary')
  })

  it('en carga queda deshabilitado, anuncia aria-busy y no emite click', async () => {
    const wrapper = mount(UiButton, { props: { loading: true }, slots: { default: 'Cobrar' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})

describe('UiField', () => {
  it('asocia label, ayuda y error con el control por id', () => {
    const wrapper = mount(UiField, {
      props: { label: 'Precio de venta', hint: 'Sin IGV', error: 'No puede ser menor al costo.' },
      slots: {
        default: (props: { id: string; describedBy?: string; invalid: boolean }) =>
          h('input', {
            id: props.id,
            'aria-describedby': props.describedBy,
            'aria-invalid': props.invalid,
          }),
      },
    })
    const input = wrapper.get('input')
    const id = input.attributes('id')!
    expect(wrapper.get('label').attributes('for')).toBe(id)

    const describedBy = input.attributes('aria-describedby')!.split(' ')
    expect(describedBy).toHaveLength(2)
    expect(wrapper.get(`#${describedBy[0]}`).text()).toBe('Sin IGV')
    expect(wrapper.get(`#${describedBy[1]}`).text()).toBe('No puede ser menor al costo.')
    expect(input.attributes('aria-invalid')).toBe('true')
  })

  it('marca el campo obligatorio de forma visible y accesible', () => {
    const wrapper = mount(UiField, {
      props: { label: 'SKU', required: true },
      slots: { default: () => h('input') },
    })
    expect(wrapper.get('label').text()).toContain('SKU')
    expect(wrapper.get('label').text()).toContain('obligatorio')
  })
})

describe('UiInput', () => {
  it('funciona con v-model', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'PIN' } })
    await wrapper.get('input').setValue('PIN-001')
    expect(wrapper.emitted('update:modelValue')).toEqual([['PIN-001']])
  })

  it('pasa los atributos al <input> y marca aria-invalid', () => {
    const wrapper = mount(UiInput, {
      props: { modelValue: '', invalid: true },
      attrs: { id: 'precio', inputmode: 'decimal', placeholder: '0.00' },
    })
    const input = wrapper.get('input')
    expect(input.attributes('id')).toBe('precio')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('aria-invalid')).toBe('true')
  })

  it('muestra un prefijo como S/', () => {
    const wrapper = mount(UiInput, { props: { modelValue: '', prefix: 'S/' } })
    expect(wrapper.text()).toContain('S/')
  })
})

describe('UiSelect', () => {
  const options = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
  ]

  it('muestra las opciones y actualiza v-model', async () => {
    const wrapper = mount(UiSelect, { props: { modelValue: 'cash', options } })
    expect(wrapper.findAll('option').map((o) => o.text())).toEqual(['Efectivo', 'Tarjeta'])
    await wrapper.get('select').setValue('card')
    expect(wrapper.emitted('update:modelValue')).toEqual([['card']])
  })

  it('agrega una opción vacía cuando hay placeholder', () => {
    const wrapper = mount(UiSelect, { props: { modelValue: '', options, placeholder: 'Elige…' } })
    const first = wrapper.findAll('option')[0]!
    expect(first.text()).toBe('Elige…')
    expect(first.attributes('value')).toBe('')
  })
})
