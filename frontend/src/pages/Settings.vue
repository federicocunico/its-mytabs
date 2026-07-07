<script setup lang="ts">
import { reactive, watch } from "vue";
import { ScrollMode } from "@coderline/alphatab";
import { SettingSchema } from "../zod.ts";
import { generalError, getSetting, successMessage } from "../app.ts";
import { setTheme, type ThemePreference, themePreference } from "../theme.ts";
import { Button } from "@/components/ui/button/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Switch } from "@/components/ui/switch/index.ts";
import { Separator } from "@/components/ui/separator/index.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select/index.ts";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog/index.ts";

const setting = reactive(getSetting());

watch(setting, () => {
    try {
        localStorage.setItem("userSetting", JSON.stringify(SettingSchema.parse(setting)));
    } catch (e) {
        generalError(e);
    }
});

function resetToDefault() {
    try {
        Object.assign(setting, SettingSchema.parse({}));
        successMessage("Settings reset to defaults");
    } catch (e) {
        generalError(e);
    }
}

const themeChoices: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "Match system" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

const scaleChoices = [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 2, 3];
</script>

<template>
    <div class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <h1 class="mb-8 text-2xl font-semibold text-foreground">Settings</h1>

        <!-- Appearance -->
        <section class="mb-8">
            <h2 class="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h2>
            <p class="mb-4 text-sm text-muted-foreground">The editor always uses the dark studio look.</p>
            <div class="grid gap-2">
                <Label>Theme</Label>
                <div class="inline-flex w-fit rounded-md border border-border p-0.5" role="group" aria-label="Theme">
                    <button
                        v-for="choice in themeChoices"
                        :key="choice.value"
                        type="button"
                        class="rounded-[5px] px-3 py-1.5 text-sm transition-colors"
                        :class="themePreference === choice.value
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'"
                        @click="setTheme(choice.value)"
                    >
                        {{ choice.label }}
                    </button>
                </div>
            </div>
        </section>

        <Separator class="mb-8" />

        <!-- Tab player -->
        <section class="mb-8 grid gap-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tab player</h2>

            <div class="grid gap-2">
                <Label for="scoreStyle">Style</Label>
                <Select id="scoreStyle" v-model="setting.scoreStyle">
                    <SelectTrigger class="w-full sm:w-72">
                        <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="tab">Tab</SelectItem>
                        <SelectItem value="score">Score</SelectItem>
                        <SelectItem value="score-tab">Tab + Score</SelectItem>
                        <SelectItem value="horizontal-tab">Horizontal Tab</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div class="grid gap-2">
                <Label for="scale">Display scale</Label>
                <Select id="scale" v-model="setting.scale">
                    <SelectTrigger class="w-full sm:w-72">
                        <SelectValue placeholder="Scale" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="s in scaleChoices" :key="s" :value="s">{{ Math.round(s * 100) }}%</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div class="grid gap-2">
                <Label for="scrollMode">Scroll</Label>
                <Select id="scrollMode" v-model="setting.scrollMode" :disabled="setting.scoreStyle === 'horizontal-tab'">
                    <SelectTrigger class="w-full sm:w-72">
                        <SelectValue placeholder="Scroll mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem :value="ScrollMode.Continuous">Scroll</SelectItem>
                        <SelectItem :value="ScrollMode.Off">Off</SelectItem>
                        <SelectItem :value="ScrollMode.Smooth">Smooth scroll</SelectItem>
                    </SelectContent>
                </Select>
                <p v-if="setting.scoreStyle === 'horizontal-tab'" class="text-xs text-muted-foreground">
                    Horizontal tab always uses smooth scroll.
                </p>
            </div>

            <div class="flex items-center justify-between gap-4 sm:w-72">
                <Label for="showKeySignature">Show key signature</Label>
                <Switch id="showKeySignature" v-model="setting.showKeySignature" />
            </div>

            <div class="flex items-center justify-between gap-4 sm:w-72">
                <Label for="toolbarAutoHide">Auto-hide player toolbar</Label>
                <Switch id="toolbarAutoHide" v-model="setting.toolbarAutoHide" />
            </div>
        </section>

        <Separator class="mb-8" />

        <!-- Assists -->
        <section class="mb-8 grid gap-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assists</h2>

            <div class="grid gap-2">
                <Label for="noteColor">Note colors</Label>
                <Select id="noteColor" v-model="setting.noteColor">
                    <SelectTrigger class="w-full sm:w-72">
                        <SelectValue placeholder="Note colors" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No color</SelectItem>
                        <SelectItem value="rocksmith">Rocksmith 2014 color scheme</SelectItem>
                        <SelectItem value="louis-bass-v">Louis' 5-string bass color scheme</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div class="grid gap-2">
                <Label for="cursor">Cursor style</Label>
                <Select id="cursor" v-model="setting.cursor">
                    <SelectTrigger class="w-full sm:w-72">
                        <SelectValue placeholder="Cursor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="invisible">No cursor</SelectItem>
                        <SelectItem value="animated">Cursor (smooth)</SelectItem>
                        <SelectItem value="instant">Cursor (instant)</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                    </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">Tip: “Cursor (instant)” is the clearest way to check whether sync points line up.</p>
            </div>
        </section>

        <Separator class="mb-8" />

        <!-- Reset -->
        <section class="grid gap-3">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reset</h2>
            <AlertDialog>
                <AlertDialogTrigger as-child>
                    <Button variant="destructive" class="w-fit">Reset to defaults</Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset settings?</AlertDialogTitle>
                        <AlertDialogDescription>All player and assist settings return to their defaults. Your tabs are not affected.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction destructive @click="resetToDefault">Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    </div>
</template>
