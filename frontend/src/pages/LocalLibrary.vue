<script>
import { defineComponent } from "vue";
import { getProvider, setProvider, subscribe } from "../storage/session.ts";
import { openOpfs, pickLocalFolder, supportsFileSystemAccess } from "../storage/select-provider.ts";

export default defineComponent({
    data() {
        return { provider: getProvider(), tabs: [], folders: [], supportsFsa: supportsFileSystemAccess(), error: "" };
    },
    async mounted() {
        this._off = subscribe(() => {
            this.provider = getProvider();
            this.refresh();
        });
        if (!this.provider && !this.supportsFsa) {
            try {
                setProvider(await openOpfs());
            } catch (e) {
                this.error = String(e);
            }
        }
        this.provider = getProvider();
        await this.refresh();
    },
    beforeUnmount() {
        this._off?.();
    },
    methods: {
        async pick() {
            try {
                setProvider(await pickLocalFolder());
            } catch (e) {
                if (e?.name !== "AbortError") this.error = String(e);
            }
        },
        async refresh() {
            if (!this.provider) return;
            const { folders, tabs } = await this.provider.listFolder("");
            this.folders = folders;
            this.tabs = tabs;
        },
        open(path) {
            this.$router.push({ name: "editPath", query: { path } });
        },
    },
});
</script>

<template>
    <div class="local-library">
        <div v-if="!provider" class="empty">
            <p>Choose a folder on your computer to store your tabs.</p>
            <button v-if="supportsFsa" @click="pick">Choose folder</button>
            <p v-else class="muted">Your browser can't open a disk folder; tabs are stored privately in the browser.</p>
        </div>
        <div v-else>
            <h2>{{ provider.capabilities.rootLabel }}</h2>
            <button v-if="supportsFsa" @click="pick">Change folder</button>
            <ul>
                <li v-for="f in folders" :key="f.path">📁 {{ f.name }}</li>
                <li v-for="t in tabs" :key="t.path"><a href="#" @click.prevent="open(t.path)">🎸 {{ t.title }}</a></li>
            </ul>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
    </div>
</template>
