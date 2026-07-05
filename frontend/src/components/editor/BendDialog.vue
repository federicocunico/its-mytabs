<script>
import { defineComponent } from "vue";
import { BModal } from "bootstrap-vue-next";
import { BEND_PRESETS } from "../../editor/mutations/effects.ts";

export default defineComponent({
    components: { BModal },
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["update:modelValue", "apply"],
    data() {
        return {
            presets: BEND_PRESETS,
            selected: "bend-full",
        };
    },
    methods: {
        apply() {
            const preset = this.presets.find((p) => p.id === this.selected);
            if (preset) {
                this.$emit("apply", preset);
            }
            this.$emit("update:modelValue", false);
        },
    },
});
</script>

<template>
    <BModal
        :model-value="modelValue"
        title="Bend"
        @update:model-value='$emit("update:modelValue", $event)'
        @ok="apply"
    >
        <div class="form-check" v-for="preset in presets" :key="preset.id">
            <input
                class="form-check-input"
                type="radio"
                name="bendPreset"
                :id="`bend-${preset.id}`"
                :value="preset.id"
                v-model="selected"
            />
            <label class="form-check-label" :for="`bend-${preset.id}`">
                {{ preset.label }}
            </label>
        </div>
    </BModal>
</template>
