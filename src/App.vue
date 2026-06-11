<script setup lang="ts">
import { RouterView } from "vue-router";
import AlertModal from "$lib/components/AlertModal.vue";
</script>

<template>
  <RouterView />
  <AlertModal />
</template>
