<script>
import { defineComponent } from "vue";

export default defineComponent({
    props: {
        info: {
            type: Object,
            required: true,
        },
    },
    computed: {
        fillClass() {
            if (!this.info.fillCapacity) {
                return "";
            }
            if (this.info.fillUsed > this.info.fillCapacity) {
                return "text-danger";
            }
            if (this.info.fillUsed < this.info.fillCapacity) {
                return "text-warning";
            }
            return "text-success";
        },
        fillText() {
            if (!this.info.fillCapacity) {
                return "";
            }
            // Express in quarter beats for readability (960 ticks per quarter)
            const used = Math.round((this.info.fillUsed / 960) * 100) / 100;
            const capacity = Math.round((this.info.fillCapacity / 960) * 100) / 100;
            return `${used} / ${capacity}`;
        },
    },
});
</script>

<template>
    <div class="editor-status-bar">
        <span class="item">Bar {{ info.barIndex + 1 }}/{{ info.barCount }}</span>
        <span class="item">Beat {{ info.beatIndex + 1 }}</span>
        <span class="item">String {{ info.stringLabel }}</span>
        <span class="item" v-if="info.pendingFret">Fret: {{ info.pendingFret }}<span class="pending-caret">▁</span></span>
        <span class="item">{{ info.durationLabel }}<template v-if="info.dots"> •</template></span>
        <span class="item" v-if="info.isRest">Rest</span>
        <span class="item" :class="fillClass" title="Bar fill (quarter notes used / capacity)">
            Fill: {{ fillText }}
            <template v-if="info.fillUsed > info.fillCapacity">⚠</template>
        </span>
    </div>
</template>

<style scoped lang="scss">
.editor-status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    background-color: #101418;
    border-top: 1px solid #222;
    padding: 6px 15px;
    font-size: 13px;
    color: #b0c5d5;

    .item {
        margin-right: 20px;
        white-space: nowrap;
    }

    .pending-caret {
        animation: blink 1s step-end infinite;
    }
}

@keyframes blink {
    50% {
        opacity: 0;
    }
}
</style>
