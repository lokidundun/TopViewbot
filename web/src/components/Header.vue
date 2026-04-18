<script setup lang="ts">
import { Square, Folder } from "lucide-vue-next";
import type { Session } from "../api/client";
import { useLocale } from "../composables/useLocale";

defineProps<{
  session: Session | null;
  isStreaming: boolean;
  isSummarizing?: boolean;
  retryInfo?: { attempt: number; message: string; next: number } | null;
}>();

const emit = defineEmits<{
  abort: [];
}>();

const { t } = useLocale();
</script>

<template>
  <header class="header glass-header">
    <div class="header-left">
      <div class="session-info" v-if="session">
        <span class="session-title">{{
          session.title || t("header.newSession")
        }}</span>
        <span
          v-if="session.directory && session.directory !== '.'"
          class="session-dir"
          :title="session.directory"
        >
          <Folder :size="12" /> {{ session.directory }}
        </span>
      </div>
    </div>

    <div class="header-center">
      <!-- Retry Indicator -->
      <div v-if="retryInfo" class="streaming-badge retry-badge">
        <span class="retry-dot"></span>
        <span class="streaming-text">
          {{
            t("header.retrying", {
              attempt: retryInfo.attempt,
              message: retryInfo.message,
            })
          }}
        </span>
      </div>
      <!-- Streaming Indicator (centered when streaming) -->
      <div v-else-if="isStreaming" class="streaming-badge">
        <span class="streaming-dot"></span>
        <span class="streaming-text">{{ t("header.generating") }}</span>
      </div>
    </div>

    <div class="header-right">
      <!-- Abort Button -->
      <button
        v-if="isStreaming"
        class="btn btn-ghost abort-btn"
        @click="emit('abort')"
      >
        <Square :size="14" fill="currentColor" />
        <span>{{ t("common.stop") }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.glass-header {
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
  z-index: 10;
  font-family: var(--font-sans);
}

.session-info {
  display: flex;
  gap: var(--space-sm);
}

.session-title {
  font-weight: 600;
  font-size: 14px;
}

.session-dir {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.streaming-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--accent-subtle);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
}

.streaming-dot {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.retry-badge .streaming-text {
  color: var(--warning, #f59e0b);
}

.retry-dot {
  width: 8px;
  height: 8px;
  background: var(--warning, #f59e0b);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
  box-shadow: 0 0 8px var(--warning, #f59e0b);
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.8;
  }
}

.abort-btn {
  color: var(--error);
  font-size: 13px;
  gap: 6px;
}

.abort-btn:hover {
  background: var(--error-subtle);
}
</style>
