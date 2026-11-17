import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CodeInput from '../components/CodeInput.vue'

describe('CodeInput', () => {
  it('pegar 6 dígitos llena todas las casillas y emite el código', async () => {
    const wrapper = mount(CodeInput, { props: { label: 'Código' } })
    const first = wrapper.findAll('input')[0]!
    await first.trigger('paste', { clipboardData: { getData: () => '482917' } })
    const values = wrapper.findAll('input').map((i) => (i.element as HTMLInputElement).value)
    expect(values.join('')).toBe('482917')
    const emitted = wrapper.emitted('update:modelValue') ?? []
    expect(emitted[emitted.length - 1]).toEqual(['482917'])
  })

  it('escribir un dígito avanza a la siguiente casilla', async () => {
    const wrapper = mount(CodeInput, { props: { label: 'Código' }, attachTo: document.body })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('4')
    expect(document.activeElement).toBe(inputs[1]!.element)
    wrapper.unmount()
  })

  it('solo acepta dígitos', async () => {
    const wrapper = mount(CodeInput, { props: { label: 'Código' } })
    const box = wrapper.findAll('input')[0]!
    await box.setValue('a')
    expect((box.element as HTMLInputElement).value).toBe('')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('retroceder en una casilla vacía vuelve a la anterior', async () => {
    const wrapper = mount(CodeInput, { props: { label: 'Código' }, attachTo: document.body })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('4')
    await inputs[1]!.trigger('keydown', { key: 'Backspace' })
    expect(document.activeElement).toBe(inputs[0]!.element)
    wrapper.unmount()
  })
})
