<script setup lang="ts">
/** Recuperar contraseña: pide un código al correo y lo cambia por una contraseña nueva. */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPasswordInput from '@/components/UiPasswordInput.vue'
import { toast } from '@/composables/useToast'

import CodeInput from '../components/CodeInput.vue'

const router = useRouter()
const step = ref<'email' | 'reset'>('email')
const form = reactive({ email: '', code: '', password: '' })
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')
const submitting = ref(false)
const resendIn = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onBeforeUnmount(() => clearInterval(timer))

const hasErrors = computed(() => Object.values(errors).some(Boolean))

function startCooldown() {
  resendIn.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value -= 1
    if (resendIn.value <= 0) clearInterval(timer)
  }, 1000)
}

async function requestCode() {
  errors.email = form.email.trim() ? undefined : 'Escribe el correo de tu cuenta.'
  if (errors.email) return
  submitting.value = true
  formError.value = ''
  try {
    await unwrap(api.POST('/api/auth/password-reset/', { body: { email: form.email.trim() } }))
    step.value = 'reset'
    startCooldown()
    toast.info('Si la cuenta existe, te enviamos un código a ese correo.')
  } catch (error) {
    formError.value = error instanceof ApiError ? error.message : 'No pudimos enviar el código.'
  } finally {
    submitting.value = false
  }
}

async function resetPassword() {
  errors.code = /^\d{6}$/.test(form.code) ? undefined : 'El código tiene 6 dígitos.'
  errors.password = form.password.length >= 8 ? undefined : 'Usa al menos 8 caracteres.'
  if (hasErrors.value) return
  submitting.value = true
  formError.value = ''
  try {
    await unwrap(
      api.POST('/api/auth/password-reset/confirm/', {
        body: { email: form.email.trim(), code: form.code, password: form.password },
      }),
    )
    toast.success('Contraseña cambiada. Ya puedes entrar.')
    await router.replace({ name: 'login' })
  } catch (error) {
    formError.value =
      error instanceof ApiError ? error.message : 'Código inválido o vencido. Pide uno nuevo.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="reset">
    <section class="card" aria-labelledby="reset-title">
      <p class="brand">Invexa</p>
      <h1 id="reset-title">Recuperar contraseña</h1>

      <form v-if="step === 'email'" novalidate @submit.prevent="requestCode">
        <p class="hint">
          Escribe el correo de tu cuenta y te enviamos un código para cambiar tu contraseña.
        </p>
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
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <UiButton type="submit" variant="primary" size="lg" block :loading="submitting">
          Enviar código
        </UiButton>
      </form>

      <form v-else novalidate @submit.prevent="resetPassword">
        <p class="hint">Escribe el código que llegó a {{ form.email }} y tu contraseña nueva.</p>
        <CodeInput v-model="form.code" label="Código de 6 dígitos" :invalid="!!errors.code" />
        <p v-if="errors.code" class="form-error">{{ errors.code }}</p>
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
          Cambiar contraseña
        </UiButton>
        <div class="resend">
          <UiButton variant="ghost" :disabled="resendIn > 0" @click="requestCode">
            {{ resendIn > 0 ? `Reenviar en ${resendIn} s` : 'Reenviar código' }}
          </UiButton>
        </div>
      </form>

      <p class="back"><RouterLink :to="{ name: 'login' }">Volver a iniciar sesión</RouterLink></p>
    </section>
  </main>
</template>

<style scoped>
.reset {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-5);
}
.card {
  width: min(420px, 100%);
  display: grid;
  gap: var(--space-4);
  background: var(--sheet);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sheet);
}
.brand {
  margin: 0;
  color: var(--blue);
  font-weight: 800;
}
h1 {
  margin: 0;
  font-size: var(--text-3xl);
}
form {
  display: grid;
  gap: var(--space-4);
}
.hint {
  margin: 0;
  color: var(--ink-2);
}
.form-error {
  margin: 0;
  color: var(--red);
  font-weight: 600;
}
.resend {
  display: flex;
  justify-content: center;
}
.back {
  margin: 0;
  text-align: center;
}
</style>
