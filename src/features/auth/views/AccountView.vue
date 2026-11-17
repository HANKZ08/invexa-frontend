<script setup lang="ts">
/** Mi cuenta: nombre del perfil y cambio de contraseña. */
import { computed, reactive, ref } from 'vue'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPasswordInput from '@/components/UiPasswordInput.vue'
import { useSessionStore } from '@/stores/session'
import { avatarFileError, avatarSrc, removeAvatar, uploadAvatar } from '../avatar'

const session = useSessionStore()

// --- Foto de perfil -----------------------------------------------------------
const photo = computed(() => session.user?.avatarUrl ?? null)
const initials = computed(
  () =>
    (session.user?.fullName ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?',
)
const photoError = ref('')
const photoBusy = ref(false)
const photoStatus = ref('')

async function onPhotoChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  photoError.value = avatarFileError(file) ?? ''
  if (photoError.value) return
  photoBusy.value = true
  photoStatus.value = ''
  try {
    const result = await uploadAvatar(file)
    session.setUser({ ...session.user!, avatarUrl: avatarSrc(result.avatar_url) })
    photoStatus.value = 'Foto actualizada.'
  } catch (error) {
    photoError.value = error instanceof Error ? error.message : 'No pudimos guardar la foto.'
  } finally {
    photoBusy.value = false
  }
}

async function onPhotoRemoved() {
  photoBusy.value = true
  photoError.value = ''
  try {
    await removeAvatar()
    session.setUser({ ...session.user!, avatarUrl: null })
    photoStatus.value = 'Foto quitada.'
  } catch {
    photoError.value = 'No pudimos quitar la foto.'
  } finally {
    photoBusy.value = false
  }
}

const parts = (session.user?.fullName ?? '').split(' ')
const profile = reactive({ firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') })
const profileStatus = ref('')
const profileError = ref('')
const profileBusy = ref(false)

const passwords = reactive({ current: '', next: '' })
const passwordErrors = reactive<{ current?: string; next?: string }>({})
const passwordStatus = ref('')
const passwordBusy = ref(false)

async function saveProfile() {
  profileStatus.value = ''
  profileError.value = ''
  profileBusy.value = true
  try {
    const me = await unwrap(
      api.PATCH('/api/auth/me/', {
        body: { first_name: profile.firstName.trim(), last_name: profile.lastName.trim() },
      }),
    )
    const data = me as unknown as { first_name: string; last_name: string; username: string }
    session.setUser({
      ...session.user!,
      fullName: `${data.first_name} ${data.last_name}`.trim() || data.username,
    })
    profileStatus.value = 'Datos guardados.'
  } catch (error) {
    profileError.value = error instanceof ApiError ? error.message : 'No pudimos guardar los datos.'
  } finally {
    profileBusy.value = false
  }
}

async function changePassword() {
  passwordStatus.value = ''
  passwordErrors.current = passwords.current ? undefined : 'Escribe tu contraseña actual.'
  passwordErrors.next =
    passwords.next.length >= 8 ? undefined : 'La contraseña nueva debe tener al menos 8 caracteres.'
  if (passwordErrors.current || passwordErrors.next) return

  passwordBusy.value = true
  try {
    await unwrap(
      api.POST('/api/auth/change-password/', {
        body: { current_password: passwords.current, new_password: passwords.next },
      }),
    )
    passwords.current = ''
    passwords.next = ''
    passwordStatus.value = 'Contraseña cambiada.'
  } catch (error) {
    if (error instanceof ApiError) {
      passwordErrors.current = error.fieldError('current_password')
      passwordErrors.next = error.fieldError('new_password')
      if (!passwordErrors.current && !passwordErrors.next) passwordStatus.value = ''
      if (!passwordErrors.current && !passwordErrors.next) profileError.value = error.message
    }
  } finally {
    passwordBusy.value = false
  }
}
</script>

<template>
  <section class="account">
    <h1>Mi cuenta</h1>

    <article class="sheet photo-card">
      <div class="photo" aria-hidden="true">
        <img v-if="photo" :src="photo" alt="" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="photo-actions">
        <h2>Foto de perfil</h2>
        <p class="hint">PNG, JPG o GIF de máximo 10 MB.</p>
        <div class="actions">
          <label class="file-button" :aria-disabled="photoBusy">
            {{ photo ? 'Cambiar foto' : 'Subir foto' }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif"
              name="avatar"
              :disabled="photoBusy"
              @change="onPhotoChosen"
            />
          </label>
          <UiButton v-if="photo" variant="ghost" :loading="photoBusy" @click="onPhotoRemoved"
            >Quitar foto</UiButton
          >
        </div>
        <p v-if="photoError" class="form-error" role="alert">{{ photoError }}</p>
        <p v-if="photoStatus" class="form-ok" role="status">{{ photoStatus }}</p>
      </div>
    </article>

    <article class="sheet">
      <h2>Datos</h2>
      <form data-profile novalidate @submit.prevent="saveProfile">
        <UiField v-slot="f" label="Nombres">
          <UiInput :id="f.id" v-model="profile.firstName" autocomplete="given-name" />
        </UiField>
        <UiField v-slot="f" label="Apellidos">
          <UiInput :id="f.id" v-model="profile.lastName" autocomplete="family-name" />
        </UiField>
        <p v-if="profileError" class="form-error" role="alert">{{ profileError }}</p>
        <p v-if="profileStatus" class="form-ok" role="status">{{ profileStatus }}</p>
        <div class="actions">
          <UiButton type="submit" variant="primary" :loading="profileBusy">Guardar datos</UiButton>
        </div>
      </form>
    </article>

    <article class="sheet">
      <h2>Contraseña</h2>
      <form data-password novalidate @submit.prevent="changePassword">
        <UiField v-slot="f" label="Contraseña actual" :error="passwordErrors.current" required>
          <UiPasswordInput
            :id="f.id"
            v-model="passwords.current"
            name="current-password"
            autocomplete="current-password"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField
          v-slot="f"
          label="Contraseña nueva"
          :error="passwordErrors.next"
          hint="Mínimo 8 caracteres."
          required
        >
          <UiPasswordInput
            :id="f.id"
            v-model="passwords.next"
            name="new-password"
            autocomplete="new-password"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <p v-if="passwordStatus" class="form-ok" role="status">{{ passwordStatus }}</p>
        <div class="actions">
          <UiButton type="submit" variant="primary" :loading="passwordBusy"
            >Cambiar contraseña</UiButton
          >
        </div>
      </form>
    </article>
  </section>
</template>

<style scoped>
.account {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-6);
  grid-template-columns: minmax(0, 1fr);
}
/* En pantallas anchas: foto a todo el ancho; datos y contraseña lado a lado */
@media (min-width: 1100px) {
  .account {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }
  .account h1,
  .photo-card {
    grid-column: 1 / -1;
  }
}
h1 {
  font-size: var(--text-4xl);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
}
h2 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-4);
}
form {
  display: grid;
  gap: var(--space-4);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
.form-ok {
  color: var(--copy-green-ink);
  background: var(--copy-green);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}

.photo-card {
  display: flex;
  gap: var(--space-5);
  align-items: center;
  flex-wrap: wrap;
}
.photo {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--blue);
  color: var(--on-blue);
  font-size: var(--text-2xl);
  font-weight: 800;
  flex: none;
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-actions {
  display: grid;
  gap: var(--space-2);
}
.photo-actions .actions {
  justify-content: flex-start;
}
.photo-actions h2 {
  margin: 0;
}
.hint {
  color: var(--ink-3);
  font-size: var(--text-sm);
}
.actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}
.file-button {
  position: relative;
  cursor: pointer;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--blue);
  color: var(--blue);
  font-weight: 700;
}
.file-button:hover {
  background: var(--blue-soft);
}
.file-button:focus-within {
  box-shadow: var(--focus-ring);
}
.file-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
