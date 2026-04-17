<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'

const { login, register, verifyToken, isLoggedIn, loading, error } = useAuth()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const displayName = ref('')
const registerError = ref('')
const registerSuccess = ref('')

async function handleLogin() {
  registerError.value = ''
  registerSuccess.value = ''
  const ok = await login(username.value, password.value)
  if (ok) {
    window.location.reload()
  }
}

async function handleRegister() {
  registerError.value = ''
  registerSuccess.value = ''
  const ok = await register(username.value, password.value, displayName.value || undefined)
  if (ok) {
    registerSuccess.value = '注册成功，请登录'
    mode.value = 'login'
    password.value = ''
  } else {
    registerError.value = error.value
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    await verifyToken()
    if (isLoggedIn.value) {
      window.location.reload()
    }
  }
})
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">TopViewbot</h1>
        <p class="login-subtitle">{{ mode === 'login' ? '登录到您的账户' : '创建新账户' }}</p>
      </div>

      <form class="login-form" @submit.prevent="mode === 'login' ? handleLogin() : handleRegister()">
        <div class="input-group">
          <label class="label">用户名</label>
          <input
            v-model="username"
            type="text"
            class="input"
            placeholder="请输入用户名"
            required
            minlength="2"
            maxlength="32"
          />
        </div>

        <div v-if="mode === 'register'" class="input-group">
          <label class="label">显示名称 <span class="text-muted">（可选）</span></label>
          <input
            v-model="displayName"
            type="text"
            class="input"
            placeholder="您的显示名称"
            maxlength="64"
          />
        </div>

        <div class="input-group">
          <label class="label">密码</label>
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="请输入密码"
            required
            minlength="6"
          />
        </div>

        <div v-if="mode === 'login' && error" class="error-message">
          {{ error }}
        </div>
        <div v-if="mode === 'register' && registerError" class="error-message">
          {{ registerError }}
        </div>
        <div v-if="registerSuccess" class="success-message">
          {{ registerSuccess }}
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="loading"
        >
          {{ loading ? '请稍候...' : (mode === 'login' ? '登录' : '注册') }}
        </button>
      </form>

      <div class="login-footer">
        <button
          class="btn btn-ghost text-sm"
          @click="
            mode = mode === 'login' ? 'register' : 'login';
            error = '';
            registerError = '';
            registerSuccess = ''
          "
        >
          {{ mode === 'login' ? '没有账户？去注册' : '已有账户？去登录' }}
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
  background: var(--bg-primary);
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: var(--space-xl);
  background: var(--bg-secondary);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-lg);
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
  color: var(--text-primary);
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
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--accent);
}

.input::placeholder {
  color: var(--text-muted);
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.error-message {
  padding: var(--space-sm) var(--space-md);
  background: rgba(var(--danger-rgb, 220, 38, 38), 0.1);
  color: var(--danger);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}

.success-message {
  padding: var(--space-sm) var(--space-md);
  background: rgba(var(--success-rgb, 34, 197, 94), 0.1);
  color: var(--success);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}

.login-footer {
  margin-top: var(--space-lg);
  text-align: center;
}

.text-sm {
  font-size: 0.875rem;
}

.text-muted {
  color: var(--text-muted);
  font-weight: 400;
}
</style>
