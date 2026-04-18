<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuth } from "../composables/useAuth";
import { useLocale } from "../composables/useLocale";

const { login, register, verifyToken, isLoggedIn, loading, error } = useAuth();
const { t } = useLocale();

const mode = ref<"login" | "register">("login");
const username = ref("");
const password = ref("");
const displayName = ref("");
const registerError = ref("");
const registerSuccess = ref("");

async function handleLogin() {
  registerError.value = "";
  registerSuccess.value = "";
  const ok = await login(username.value, password.value);
  if (ok) return;
}

async function handleRegister() {
  registerError.value = "";
  registerSuccess.value = "";
  const ok = await register(
    username.value,
    password.value,
    displayName.value || undefined,
  );
  if (ok) {
    if (isLoggedIn.value) return;
    registerSuccess.value = t("login.registerSuccess");
    mode.value = "login";
    password.value = "";
  } else {
    registerError.value = error.value;
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    await verifyToken();
    if (isLoggedIn.value) {
      window.location.reload();
    }
  }
});
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-kicker">{{ t("login.kicker") }}</div>
        <h1 class="login-title">{{ t("login.title") }}</h1>
        <p class="login-subtitle">
          {{
            mode === "login"
              ? t("login.subtitleLogin")
              : t("login.subtitleRegister")
          }}
        </p>
      </div>

      <form
        class="login-form"
        @submit.prevent="mode === 'login' ? handleLogin() : handleRegister()"
      >
        <div class="input-group">
          <label class="label">{{ t("login.username") }}</label>
          <input
            v-model="username"
            type="text"
            class="input"
            :placeholder="t('login.usernamePlaceholder')"
            required
            minlength="2"
            maxlength="32"
          />
        </div>

        <div v-if="mode === 'register'" class="input-group">
          <label class="label"
            >{{ t("login.displayName") }}
            <span class="text-muted">({{ t("login.optional") }})</span></label
          >
          <input
            v-model="displayName"
            type="text"
            class="input"
            :placeholder="t('login.displayNamePlaceholder')"
            maxlength="64"
          />
        </div>

        <div class="input-group">
          <label class="label">{{ t("login.password") }}</label>
          <input
            v-model="password"
            type="password"
            class="input"
            :placeholder="t('login.passwordPlaceholder')"
            required
            minlength="6"
          />
        </div>

        <div v-if="mode === 'login' && error" class="status-message error">
          {{ error }}
        </div>
        <div
          v-if="mode === 'register' && registerError"
          class="status-message error"
        >
          {{ registerError }}
        </div>
        <div v-if="registerSuccess" class="status-message success">
          {{ registerSuccess }}
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="loading"
        >
          {{
            loading
              ? t("login.wait")
              : mode === "login"
                ? t("login.login")
                : t("login.register")
          }}
        </button>
      </form>

      <div class="login-footer">
        <button
          class="btn btn-ghost text-sm"
          @click="
            mode = mode === 'login' ? 'register' : 'login';
            error = '';
            registerError = '';
            registerSuccess = '';
          "
        >
          {{ mode === "login" ? t("login.toRegister") : t("login.toLogin") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  padding: var(--space-md);
  background:
    radial-gradient(circle at 10% 10%, var(--accent-glow), transparent 40%),
    linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.3;
  pointer-events: none;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: left;
  margin-bottom: var(--space-lg);
}

.login-kicker {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}

.login-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
  color: var(--text-primary);
  font-family: var(--font-display);
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.input::placeholder {
  color: var(--text-muted);
}

.btn-block {
  width: 100%;
  justify-content: center;
  height: 40px;
}

.login-footer {
  margin-top: var(--space-lg);
  text-align: left;
}

.text-sm {
  font-size: 0.875rem;
}

.text-muted {
  color: var(--text-muted);
  font-weight: 400;
}
</style>
