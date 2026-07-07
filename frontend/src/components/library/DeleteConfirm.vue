<script setup lang="ts">
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog/index.ts";

defineProps<{
    name: string;
    isFolder: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    confirm: [];
}>();
</script>

<template>
    <AlertDialog v-model:open="open">
        <AlertDialogContent class="sm:max-w-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete {{ isFolder ? "folder" : "tab" }}?</AlertDialogTitle>
                <AlertDialogDescription>
                    “{{ name }}” will be permanently deleted<template v-if="isFolder"> <strong>including everything inside it</strong></template>. This can't be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction destructive @click="emit('confirm')">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
