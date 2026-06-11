<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAlertStore } from '$lib/stores/alertStore'
import { Dialog, DialogContent } from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'

const store = useAlertStore()
const { current } = storeToRefs(store)

function dismiss() {
  current.value?.onDismiss?.()
  store.dismiss()
}

function snooze() {
  current.value?.onSnooze?.()
}

function onOpenChange(open: boolean) {
  if (!open) dismiss()
}
</script>

<template>
  <Dialog :open="!!current" @update:open="onOpenChange">
    <DialogContent :show-close-button="false" class="max-w-sm rounded-2xl">
      <div class="flex justify-center">
        <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <svg class="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-bold text-center">{{ current?.title }}</h3>
      <p class="text-sm text-muted-foreground text-center -mt-2">{{ current?.body }}</p>
      <div class="flex gap-2 mt-2">
        <Button v-if="current?.snoozeText" variant="outline" class="flex-1" @click="snooze">{{ current.snoozeText }}</Button>
        <Button class="flex-1" @click="dismiss">{{ current?.buttonText ?? 'OK' }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
