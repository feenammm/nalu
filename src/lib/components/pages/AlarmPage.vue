<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Plus, Trash2, AlarmClock, Bell, BellOff, SkipForward } from 'lucide-vue-next'
import type { Alarm } from '$lib/types'
import { useI18n } from '$lib/i18n'
import { Input } from '$lib/components/ui/input'
import { useAiRefresh } from '$lib/composables/useAiRefresh'

const { t } = useI18n()
const alarms = ref<Alarm[]>([])
const newTime = ref('08:00')
const newLabel = ref('')
const newRepeat = ref('none')

async function loadAlarms() {
  try {
    alarms.value = await invoke('get_alarms')
  } catch (error) {
    console.error(error)
  }
}

async function addAlarm() {
  if (!newTime.value) return
  await invoke('add_alarm', { time: newTime.value, label: newLabel.value.trim(), repeat: newRepeat.value })
  newLabel.value = ''
  newRepeat.value = 'none'
  await loadAlarms()
}

async function skipNextAlarm(id: string) {
  await invoke('skip_next_alarm', { id })
  await loadAlarms()
}

async function toggleAlarm(id: string) {
  await invoke('toggle_alarm', { id })
  await loadAlarms()
}

async function deleteAlarm(id: string) {
  await invoke('delete_alarm', { id })
  await loadAlarms()
}

onMounted(loadAlarms)
useAiRefresh(loadAlarms)
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <AlarmClock class="w-6 h-6" />
      {{ t('alarm.title') }}
    </h1>
    <form class="bg-card rounded-xl p-4 border mb-6" @submit.prevent="addAlarm">
      <h2 class="text-sm font-semibold mb-3">{{ t('alarm.setAlarm') }}</h2>
      <div class="flex gap-2 items-end flex-wrap">
        <label><span class="block text-xs text-muted-foreground mb-1">{{ t('alarm.time') }}</span><Input v-model="newTime" type="time" /></label>
        <label class="flex-1 min-w-[120px]"><span class="block text-xs text-muted-foreground mb-1">{{ t('alarm.label') }}</span><Input
          v-model="newLabel"
          type="text"
          class="w-full"
          :placeholder="t('alarm.labelPlaceholder')"
        /></label>
        <label><span class="block text-xs text-muted-foreground mb-1">{{ t('alarm.repeat') }}</span>
          <select v-model="newRepeat" class="px-3 py-2.5 rounded-lg border bg-transparent text-sm">
            <option value="none">{{ t('alarm.repeatOptions.none') }}</option>
            <option value="daily">{{ t('alarm.repeatOptions.daily') }}</option>
            <option value="weekdays">{{ t('alarm.repeatOptions.weekdays') }}</option>
            <option value="weekends">{{ t('alarm.repeatOptions.weekends') }}</option>
          </select>
        </label>
        <button type="submit" class="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-1.5 transition-colors hover:bg-primary/90">
          <Plus class="w-4 h-4" />
          {{ t('common.add') }}
        </button>
      </div>
    </form>
    <div class="space-y-2">
      <div v-for="alarm in alarms" :key="alarm.id" class="flex items-center gap-4 px-4 py-4 rounded-xl bg-card border" :class="{ 'opacity-50': !alarm.active }">
        <div class="text-4xl font-mono font-bold min-w-[120px]">{{ alarm.time }}</div>
        <div class="flex-1">
          <div v-if="alarm.label" class="text-sm font-medium">{{ alarm.label }}</div>
          <div class="text-xs text-muted-foreground">{{ t(`alarm.repeatOptions.${alarm.repeat}`) }}</div>
        </div>
        <button v-if="alarm.active" class="rounded-md p-2 transition-colors hover:bg-secondary" :title="alarm.skip_next ? t('alarm.cancelSkip') : t('alarm.skipNext')" @click="skipNextAlarm(alarm.id)">
          <SkipForward class="w-4 h-4" :class="alarm.skip_next ? 'text-amber-500' : 'text-muted-foreground'" />
        </button>
        <button class="rounded-md p-2 transition-colors hover:bg-secondary" @click="toggleAlarm(alarm.id)">
          <Bell v-if="alarm.active" class="w-4 h-4 text-primary" />
          <BellOff v-else class="w-4 h-4 text-muted-foreground" />
        </button>
        <button class="rounded-md p-2 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-400 dark:hover:bg-red-500/10" @click="deleteAlarm(alarm.id)">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
      <div v-if="alarms.length === 0" class="text-center py-12 text-muted-foreground text-sm">{{ t('alarm.noAlarms') }}</div>
    </div>
  </div>
</template>
