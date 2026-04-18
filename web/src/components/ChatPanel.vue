<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import { FolderOpen } from "lucide-vue-next";
import type {
  Message,
  QuestionRequest,
  PermissionRequest,
} from "../api/client";
import MessageItem from "./MessageItem.vue";
import AgentMessageGroup from "./AgentMessageGroup.vue";
import AgentQuestion from "./AgentQuestion.vue";
import PermissionRequestVue from "./PermissionRequest.vue";
import DirectoryBrowser from "./DirectoryBrowser.vue";
import { useLocale } from "../composables/useLocale";

const props = defineProps<{
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  pendingQuestions?: QuestionRequest[];
  pendingPermissions?: PermissionRequest[];
  sessionError?: { message: string; dismissable?: boolean } | null;
  currentDirectory?: string;
  canChangeDirectory?: boolean;
  mode?: "chat" | "agent";
}>();

const emit = defineEmits<{
  (e: "questionAnswered", requestId: string, answers: string[][]): void;
  (e: "questionRejected", requestId: string): void;
  (
    e: "permissionResponded",
    requestId: string,
    response: "once" | "always" | "reject",
  ): void;
  (e: "clearError"): void;
  (e: "openSettings"): void;
  (e: "deletePart", messageId: string, partId: string): void;
  (
    e: "updatePart",
    messageId: string,
    partId: string,
    updates: { text?: string },
  ): void;
  (e: "changeDirectory", path: string): void;
}>();

const scrollContainer = ref<HTMLDivElement>();
const showDirectoryBrowser = ref(false);
const { t } = useLocale();

// Filter out invalid messages (e.g. corrupted data from backend)
const validMessages = computed(() => props.messages.filter((m) => m?.info?.id));

// Group consecutive assistant messages into one visual unit
type DisplayGroup =
  | { type: "user"; message: Message; key: string }
  | { type: "agent"; messages: Message[]; key: string; isLast: boolean };

const displayGroups = computed<DisplayGroup[]>(() => {
  const groups: DisplayGroup[] = [];
  let agentGroup: Extract<DisplayGroup, { type: "agent" }> | null = null;

  for (const message of validMessages.value) {
    if (message.info.role === "user") {
      agentGroup = null;
      groups.push({ type: "user", message, key: message.info.id });
    } else {
      if (!agentGroup) {
        agentGroup = {
          type: "agent",
          messages: [],
          key: message.info.id,
          isLast: false,
        };
        groups.push(agentGroup);
      }
      agentGroup.messages.push(message);
    }
  }

  // Mark last group
  if (groups.length > 0) {
    const last = groups[groups.length - 1];
    if (last.type === "agent") last.isLast = true;
  }

  return groups;
});

// Time-based greeting
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return t("greeting.morning");
  if (hour < 18) return t("greeting.afternoon");
  return t("greeting.evening");
});

function openDirectoryPicker() {
  showDirectoryBrowser.value = true;
}

function handleDirectorySelect(path: string) {
  showDirectoryBrowser.value = false;
  emit("changeDirectory", path);
}

function handleDirectoryCancel() {
  showDirectoryBrowser.value = false;
}

// 获取目录显示名称
function getDirectoryName(path: string): string {
  if (!path || path === "~" || path === ".") return "";
  // 处理 Windows 和 Unix 路径
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

watch(
  () => props.messages,
  async () => {
    await nextTick();
    scrollToBottom();
  },
  { deep: true },
);

watch(
  () => props.isStreaming,
  async (streaming) => {
    if (streaming) {
      await nextTick();
      scrollToBottom();
    }
  },
);

function scrollToBottom() {
  if (scrollContainer.value) {
    // Check if user is already near bottom to avoid annoying auto-scroll if they are reading history
    const isNearBottom =
      scrollContainer.value.scrollHeight -
        scrollContainer.value.scrollTop -
        scrollContainer.value.clientHeight <
      100;

    if (isNearBottom || validMessages.value.length <= 1) {
      // Always scroll on simple cases
      scrollContainer.value.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: "smooth",
      });
    }
  }
}
</script>

<template>
  <div class="chat-messages custom-scrollbar" ref="scrollContainer">
    <!-- Session Error Banner -->
    <div v-if="sessionError" class="session-error-banner">
      <div class="error-content">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span class="session-error-text">{{ sessionError.message }}</span>
      </div>
      <div class="error-actions">
        <button class="btn btn-sm btn-primary" @click="emit('openSettings')">
          {{ t("common.openSettings") }}
        </button>
        <button
          v-if="sessionError.dismissable"
          class="btn btn-sm btn-ghost"
          @click="emit('clearError')"
        >
          {{ t("common.close") }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="validMessages.length === 0 && !isLoading && !sessionError"
      class="chat-empty"
    >
      <div class="welcome-section">
        <div class="greeting-row">
          <img class="greeting-icon" src="/topviewbot.svg" alt="TopViewbot" />
          <span class="greeting-text">{{ greeting }}</span>
        </div>

        <!-- Directory Selector (only in code mode, subtle, below greeting) -->
        <div
          v-if="canChangeDirectory && mode === 'agent'"
          class="directory-selector-section"
        >
          <button class="directory-btn" @click="openDirectoryPicker">
            <FolderOpen :size="16" />
            <span class="directory-btn-text">
              {{
                currentDirectory && getDirectoryName(currentDirectory)
                  ? getDirectoryName(currentDirectory)
                  : t("chat.chooseDirectory")
              }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div class="messages-container" v-else>
      <template v-for="group in displayGroups" :key="group.key">
        <!-- User message -->
        <MessageItem
          v-if="group.type === 'user'"
          :message="group.message"
          @delete-part="(msgId, partId) => emit('deletePart', msgId, partId)"
          @update-part="
            (msgId, partId, updates) =>
              emit('updatePart', msgId, partId, updates)
          "
        />
        <!-- Consecutive agent messages as one group -->
        <div v-else class="agent-message-row">
          <AgentMessageGroup
            :messages="group.messages"
            :isStreaming="isStreaming && group.isLast"
          />
        </div>
      </template>

      <!-- Pending Permission Requests -->
      <div v-if="pendingPermissions?.length" class="pending-requests">
        <PermissionRequestVue
          v-for="request in pendingPermissions"
          :key="request.id"
          :request="request"
          @responded="
            (response) => emit('permissionResponded', request.id, response)
          "
        />
      </div>

      <!-- Pending Questions -->
      <div v-if="pendingQuestions?.length" class="pending-requests">
        <AgentQuestion
          v-for="request in pendingQuestions"
          :key="request.id"
          :request="request"
          @answered="(id, answers) => emit('questionAnswered', id, answers)"
          @rejected="(id) => emit('questionRejected', id)"
        />
      </div>

      <!-- Streaming Indicator is handled inside the last Agent message usually, or as a typing bubble -->
      <!-- Added extra space at bottom for scrolling past the input box -->
      <div class="bottom-spacer"></div>
    </div>

    <!-- Directory Browser -->
    <DirectoryBrowser
      :visible="showDirectoryBrowser"
      :initial-path="currentDirectory"
      @select="handleDirectorySelect"
      @cancel="handleDirectoryCancel"
    />
  </div>
</template>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl) 0;
  scroll-behavior: smooth;
  background: var(--bg-primary);
}

.messages-container {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xl) var(--space-2xl);
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* === Empty State === */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 var(--space-md);
  width: 100%;
  overflow: hidden;
}

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
  max-width: var(--input-max-width);
  width: 100%;
  animation: welcome-rise-in 0.6s ease-out;
  will-change: transform, opacity;
}

.greeting-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.greeting-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  opacity: 0.9;
}

.greeting-text {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  letter-spacing: -0.02em;
}

/* Directory selector */
.directory-selector-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.directory-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: all var(--transition-normal);
  margin-bottom: var(--space-sm);
}

.directory-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent);
  color: var(--text-primary);
}

.directory-btn svg {
  color: inherit;
}

.directory-btn-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom-spacer {
  height: 72px;
}

.agent-message-row {
  padding: 0;
  max-width: 860px;
  width: 100%;
  opacity: 0;
  animation: fade-up 0.3s var(--ease-smooth, ease) forwards;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pending-requests {
  padding: 0 var(--space-xl);
  margin-bottom: var(--space-md);
}

.session-error-banner {
  max-width: 860px;
  margin: var(--space-md) auto;
  padding: var(--space-md);
  background: var(--error-subtle);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: 100%;
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  color: var(--error);
}

.error-content svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.session-error-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.error-actions {
  display: flex;
  gap: var(--space-sm);
  margin-left: 28px;
}

.btn-sm {
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.75rem;
}

@keyframes welcome-rise-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
