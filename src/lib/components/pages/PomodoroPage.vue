<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-vue-next'
import type { PomodoroState } from '$lib/types'
import { useI18n } from '$lib/i18n'
import { Input } from '$lib/components/ui/input'

const { t } = useI18n()
const timerState = ref<PomodoroState>({ is_running: false, is_break: false, remaining_seconds: 1500, work_duration: 1500, break_duration: 300, completed_count: 0 })
const workMinutes = ref(25)
const breakMinutes = ref(5)
const minutes = computed(() => Math.floor(timerState.value.remaining_seconds / 60))
const seconds = computed(() => timerState.value.remaining_seconds % 60)
const progress = computed(() => {
  const duration = timerState.value.is_break ? timerState.value.break_duration : timerState.value.work_duration
  return duration ? 1 - timerState.value.remaining_seconds / duration : 0
})
let unlisten: UnlistenFn | undefined
let unlistenWorkEnd: UnlistenFn | undefined
let unlistenBreakEnd: UnlistenFn | undefined

async function loadState() {
  try {
    timerState.value = await invoke('pomodoro_get_state')
  } catch (error) {
    console.error(error)
  }
}

async function start() {
  await invoke('pomodoro_start')
  await loadState()
}

async function pause() { timerState.value = await invoke('pomodoro_pause') }

async function reset() { timerState.value = await invoke('pomodoro_reset') }

async function skip() { timerState.value = await invoke('pomodoro_skip') }

async function setDuration() { timerState.value = await invoke('pomodoro_set_duration', { workMinutes: workMinutes.value, breakMinutes: breakMinutes.value }) }

onMounted(async () => {
  await loadState()
  unlisten = await listen<number>('pomodoro-tick', ({ payload }) => { timerState.value.remaining_seconds = payload })
  unlistenWorkEnd = await listen<number>('pomodoro-work-end', () => { void loadState() })
  unlistenBreakEnd = await listen('pomodoro-break-end', () => { void loadState() })
})
onBeforeUnmount(() => {
  unlisten?.()
  unlistenWorkEnd?.()
  unlistenBreakEnd?.()
})
</script>

<template>
  <div class="max-w-md mx-auto px-6 py-12 text-center">
    <h1 class="text-2xl font-bold mb-2">{{ t('pomodoro.title') }}</h1>
    <p class="text-sm text-muted-foreground mb-8">{{ timerState.is_break ? t('pomodoro.breakTime') : t('pomodoro.focusTime') }} · {{ timerState.completed_count }} {{ t('pomodoro.completed') }}</p>
    <div class="relative w-64 h-64 mx-auto mb-8">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2" class="text-muted" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          :class="timerState.is_break ? 'text-green-500' : 'text-primary'"
          :stroke-dasharray="2 * Math.PI * 45"
          :stroke-dashoffset="2 * Math.PI * 45 * (1 - progress)"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-5xl font-mono font-bold">{{ String(minutes).padStart(2, '0') }}:{{ String(seconds).padStart(2, '0') }}</span>
        <span class="text-xs text-muted-foreground mt-1">{{ timerState.is_break ? t('pomodoro.break') : t('pomodoro.focus') }}</span>
      </div>
    </div>
    <div class="flex items-center justify-center gap-4 mb-8">
      <button class="p-3 rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" @click="reset">
        <RotateCcw class="w-5 h-5" />
      </button>
      <button v-if="timerState.is_running" class="p-4 rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90" @click="pause">
        <Pause class="w-6 h-6" />
      </button>
      <button v-else class="p-4 rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90" @click="start">
        <Play class="w-6 h-6" />
      </button>
      <button class="p-3 rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" @click="skip">
        <SkipForward class="w-5 h-5" />
      </button>
    </div>
    <div class="flex items-center justify-center gap-6 text-sm">
      <label class="flex items-center gap-2"><span class="text-muted-foreground">{{ t('pomodoro.work') }}</span><Input
        v-model.number="workMinutes"
        type="number"
        min="1"
        max="120"
        class="w-16 text-center"
        @change="setDuration"
      /><span class="text-muted-foreground">{{ t('pomodoro.min') }}</span></label>
      <label class="flex items-center gap-2"><span class="text-muted-foreground">{{ t('pomodoro.break') }}</span><Input
        v-model.number="breakMinutes"
        type="number"
        min="1"
        max="60"
        class="w-16 text-center"
        @change="setDuration"
      /><span class="text-muted-foreground">{{ t('pomodoro.min') }}</span></label>
    </div>
  </div>
</template>
