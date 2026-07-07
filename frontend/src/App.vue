<script setup lang="ts">
import { useRoute } from "vue-router";
import { Notifications } from "@kyvg/vue3-notification";
import { computed } from "vue";

const route = useRoute();

// Remount the editor when a different tab file is opened; keep the app shell
// alive across library navigation.
const viewKey = computed(() => route.name === "editPath" ? `edit:${String(route.query.path ?? "")}` : "app");
</script>

<template>
    <div>
        <router-view :key="viewKey" />
        <Notifications position="bottom right" />
    </div>
</template>

<style scoped></style>
