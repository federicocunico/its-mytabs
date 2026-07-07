<script setup lang="ts">
import { ref, watch } from "vue";
import type { TabEntry } from "@/storage/types.ts";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

const props = defineProps<{
    tab: TabEntry | null;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    save: [details: { title: string; artist: string }];
}>();

const title = ref("");
const artist = ref("");

watch(open, (v) => {
    if (v && props.tab) {
        title.value = props.tab.title;
        artist.value = props.tab.artist;
    }
});

function submit() {
    open.value = false;
    emit("save", { title: title.value.trim(), artist: artist.value.trim() });
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Tab details</DialogTitle>
                <DialogDescription>
                    Shown in the library instead of the file name<template v-if="tab"> (<span class="font-mono text-xs">{{ tab.name }}</span>)</template>.
                </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="submit">
                <div class="grid gap-2">
                    <Label for="details-title">Title</Label>
                    <Input id="details-title" v-model="title" autofocus />
                </div>
                <div class="grid gap-2">
                    <Label for="details-artist">Artist</Label>
                    <Input id="details-artist" v-model="artist" />
                </div>
            </form>
            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="submit">Save</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
