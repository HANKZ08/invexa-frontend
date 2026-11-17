<script setup lang="ts">
/** Activa la cuenta creada por el administrador: correo, código de 6 dígitos y contraseña nueva. */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { homeFor } from '@/app/nav'
import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPasswordInput from '@/components/UiPasswordInput.vue'
import { toast } from '@/composables/useToast'
import { useSessionStore } from '@/stores/session'

import CodeInput from '../components/CodeInput.vue'

const router = useRouter()
const session = useSessionStore()

const form = reactive({ email: '', code: '', password: '' })
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')
const submitting = ref(false)
const resendIn = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const hasErrors = computed(() => Object.values(errors).some(Boolean))

function validate(): boolean {
  errors.email = /^\S+@\S+\.\S+$/.test(form.email.trim())
    ? undefined
    : 'Escribe el correo de tu cuenta.'
  errors.code = /^\d{6}$/.test(form.code) ? undefined : 'El código debe tener 6 dígitos.'
  errors.password =
    form.password.length >= 8 ? undefined : 'La contraseña debe tener al menos 8 caracteres.'
  return !hasErrors.value
}

async function submit() {
  formError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    const user = await unwrap(
      api.POST('/api/auth/verify-email/', {
        body: { email: form.email.trim(), code: form.code, password: form.password },
      }),
    )
    // La API no devuelve tokens: entramos con el usuario recién activado.
    await session.login(user.username, form.password)
    toast.success('Cuenta activada. Bienvenida.')
    await router.replace(homeFor(session.role ?? 'cashier'))
  } catch (error) {
    formError.value =
      error instanceof ApiError
        ? (error.fieldError('code') ?? error.message)
        : 'No pudimos activar la cuenta.'
    form.password = ''
  } finally {
    submitting.value = false
  }
}

function startCooldown() {
  resendIn.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value -= 1
    if (resendIn.value <= 0) clearInterval(timer)
  }, 1000)
}

async function resend() {
  formError.value = ''
  try {
    await unwrap(api.POST('/api/auth/resend-code/', { body: { email: form.email.trim() } }))
    toast.info('Si la cuenta está pendiente, enviamos un código nuevo a ese correo.')
    startCooldown()
  } catch (error) {
    formError.value = error instanceof ApiError ? error.message : 'No pudimos reenviar el código.'
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main class="activate">
    <section class="card" aria-labelledby="activate-title">
      <p class="brand">Invexa</p>
      <h1 id="activate-title">Activa tu cuenta</h1>
      <p class="hint">
        El administrador creó tu cuenta. Escribe el código de 6 dígitos que te llegó al correo y
        elige tu contraseña.
      </p>

      <form novalidate @submit.prevent="submit">
        <UiField v-slot="f" label="Correo" :error="errors.email" required>
          <UiInput
            :id="f.id"
            v-model="form.email"
            type="email"
            autocomplete="email"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>

        <CodeInput
          v-model="form.code"
          label="Código de 6 dígitos"
          :invalid="!!errors.code"
          :described-by="errors.code ? 'activate-code-error' : undefined"
        />
        <p v-if="errors.code" id="activate-code-error" class="field-error">{{ errors.code }}</p>

        <UiField
          v-slot="f"
          label="Contraseña nueva"
          :error="errors.password"
          hint="Mínimo 8 caracteres."
          required
        >
          <UiPasswordInput
            :id="f.id"
            v-model="form.password"
            autocomplete="new-password"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <UiButton type="submit" variant="primary" size="lg" block :loading="submitting">
          Activar y entrar
        </UiButton>
        <UiButton variant="ghost" size="sm" :disabled="resendIn > 0 || !form.email" @click="resend">
          {{ resendIn > 0 ? `Pedir otro código en ${resendIn} s` : 'No me llegó el código' }}
        </UiButton>
      </form>
    </section>
  </main>
</template>

<style scoped>
.activate {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-6);
}
.card {
  width: min(440px, 100%);
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-raised);
  padding: var(--space-8);
  display: grid;
  gap: var(--space-4);
}
.brand {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  font-size: var(--text-2xl);
  color: var(--blue);
}
h1 {
  font-size: var(--text-3xl);
}
.hint {
  color: var(--ink-3);
}
form {
  display: grid;
  gap: var(--space-4);
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
.field-error {
  color: var(--red);
  font-weight: 600;
  font-size: var(--text-sm);
  margin-top: calc(var(--space-2) * -1);
}
</style>
