<script setup lang="ts">
/** Inicio de sesión. Tras entrar vuelve a `?redirect=` o a la pantalla de inicio del rol. */
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPasswordInput from '@/components/UiPasswordInput.vue'
import { homeFor } from '@/app/nav'
import { ApiError } from '@/api/errors'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const form = reactive({ username: '', password: '' })
const errors = reactive<{ username?: string; password?: string }>({})
const formError = ref('')
const submitting = ref(false)

function validate(): boolean {
  errors.username = form.username.trim() ? undefined : 'Escribe tu usuario.'
  errors.password = form.password ? undefined : 'Escribe tu contraseña.'
  return !errors.username && !errors.password
}

async function submit() {
  formError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await session.login(form.username.trim(), form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    await router.replace(redirect ?? homeFor(session.role ?? 'cashier'))
  } catch (error) {
    formError.value =
      error instanceof ApiError ? error.message : 'No pudimos iniciar sesión. Inténtalo de nuevo.'
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login">
    <section class="card" aria-labelledby="login-title">
      <p class="brand">Invexa</p>
      <h1 id="login-title">Iniciar sesión</h1>
      <p class="hint">Ferretería El Tornillo · usa el usuario que te dio el administrador.</p>

      <form novalidate @submit.prevent="submit">
        <UiField v-slot="f" label="Usuario" :error="errors.username" required>
          <UiInput
            :id="f.id"
            v-model="form.username"
            autocomplete="username"
            autocapitalize="none"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Contraseña" :error="errors.password" required>
          <UiPasswordInput
            :id="f.id"
            v-model="form.password"
            autocomplete="current-password"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <UiButton type="submit" variant="primary" size="lg" block :loading="submitting">
          Entrar
        </UiButton>
        <p class="forgot">
          <RouterLink :to="{ name: 'recuperar' }">¿Olvidaste tu contraseña?</RouterLink>
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.forgot {
  margin: 0;
  text-align: center;
  font-weight: 600;
}
.login {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-6);
}
.card {
  width: min(400px, 100%);
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
  font-size: var(--text-md);
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
</style>
