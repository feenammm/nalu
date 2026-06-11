<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { Plus, Trash2, Check, Circle, Calendar } from 'lucide-vue-next'
import type { Schedule } from '$lib/types'
import { useI18n } from '$lib/i18n'
import { Input } from '$lib/components/ui/input'
import { useAiRefresh } from '$lib/composables/useAiRefresh'

const { t } = useI18n()
const schedules = ref<Schedule[]>([])
const newTitle = ref('')
const newDate = ref('')
const newTime = ref('')
const notifiedIds = new Set<string>()
let interval: ReturnType<typeof setInterval>

async function loadSchedules() {
  try {
    schedules.value = await invoke('get_schedules')
  } catch (error) {
    console.error(error)
  }
}

async function addSchedule() {
  if (!newTitle.value.trim() || !newDate.value || !newTime.value) return
  await invoke('add_schedule', { title: newTitle.value.trim(), scheduledAt: `${newDate.value}T${newTime.value}:00` })
  newTitle.value = ''
  newDate.value = ''
  newTime.value = ''
  await loadSchedules()
}

async function toggleSchedule(id: string) {
  await invoke('toggle_schedule', { id })
  await loadSchedules()
}

async function deleteSchedule(id: string) {
  await invoke('delete_schedule', { id })
  await loadSchedules()
}

function playBeep() {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 800
  gain.gain.setValueAtTime(0.5, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.5)
}

function checkReminders() {
  const now = Date.now()
  for (const schedule of schedules.value) {
    if (schedule.done || notifiedIds.has(schedule.id)) continue
    const diff = new Date(schedule.scheduled_at).getTime() - now
    if (diff > 0 && diff <= (schedule.reminder_minutes || 5) * 60000) {
      sendNotification({ title: t('notification.scheduleReminder'), body: `${schedule.title} - ${t('notification.upcomingEvent')}` })
      playBeep()
      notifiedIds.add(schedule.id)
    }
  }
}

onMounted(async () => {
  await loadSchedules()
  checkReminders()
  interval = setInterval(checkReminders, 60000)
})
onBeforeUnmount(() => clearInterval(interval))
useAiRefresh(loadSchedules)
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <h1 class="text-2xl font-bold mb-6">{{ t('schedule.title') }}</h1>
    <form class="flex gap-2 mb-6" @submit.prevent="addSchedule">
      <Input v-model="newTitle" class="flex-1" :placeholder="t('schedule.eventTitle')" />
      <Input v-model="newDate" type="date" />
      <Input v-model="newTime" type="time" />
      <button type="submit" class="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90" :disabled="!newTitle.trim() || !newDate || !newTime">
        <Plus class="w-4 h-4" />
      </button>
    </form>
    <div class="space-y-1.5">
      <div v-for="schedule in schedules" :key="schedule.id" class="group flex items-center gap-3 px-4 py-3 rounded-lg bg-card border">
        <button class="rounded-md p-1 transition-colors hover:bg-secondary" @click="toggleSchedule(schedule.id)">
          <Check v-if="schedule.done" class="w-5 h-5 text-green-500" />
          <Circle v-else class="w-5 h-5 text-muted-foreground/50" />
        </button>
        <div class="flex-1"><span class="text-sm" :class="{ 'line-through text-muted-foreground': schedule.done }">{{ schedule.title }}</span>
          <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Calendar class="w-3 h-3" />
            {{ schedule.scheduled_at.replace('T', ' ').slice(0, 16) }}
          </div>
        </div>
        <button class="opacity-0 group-hover:opacity-100 text-muted-foreground/50 transition-colors hover:text-red-400" @click="deleteSchedule(schedule.id)">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
      <div v-if="schedules.length === 0" class="text-center py-12 text-muted-foreground text-sm">{{ t('schedule.noEvents') }}</div>
    </div>
  </div>
</template>
