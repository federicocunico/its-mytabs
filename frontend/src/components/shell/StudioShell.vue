<script>
import { defineComponent } from "vue";

/**
 * Guitar-Pro-style app shell: a fixed, full-viewport CSS grid that never
 * scrolls (only the score pane does). Slots fill each region:
 *
 *   #top          top bar (always visible)
 *   #left         left rail content (tool palette)   — collapsible + resizable
 *   #score        the score pane (alphaTab white card)
 *   #right        right rail content (mixer)         — collapsible + resizable
 *   #bottomGrid   bar-navigator + status strip       — hidden when collapsed
 *   #bottomBar    transport controls (always visible; scoped slot exposes the
 *                 collapse toggle + open state so the chevron can live here)
 *
 * The shell owns the panel sizes/open-flags and persists them to localStorage
 * so the layout survives reloads. No playback/editing logic lives here.
 */

const STORE_KEY = "mytabs-panel-layout";

const CLAMP = {
    left: { min: 190, max: 440 },
    right: { min: 230, max: 480 },
    bottomMin: 120,
};
const RAIL_CLOSED = 46;
const BOTTOM_CLOSED = 58;

const DEFAULTS = {
    leftW: 236,
    rightW: 300,
    bottomH: 300,
    leftOpen: true,
    rightOpen: true,
    bottomOpen: true,
};

export default defineComponent({
    data() {
        return { ...DEFAULTS, _drag: null };
    },
    computed: {
        gridTemplate() {
            const lw = this.leftOpen ? this.leftW : RAIL_CLOSED;
            const rw = this.rightOpen ? this.rightW : RAIL_CLOSED;
            const bh = this.bottomOpen ? this.bottomH : BOTTOM_CLOSED;
            return {
                gridTemplateRows: `54px 1fr ${bh}px`,
                gridTemplateColumns: `${lw}px 1fr ${rw}px`,
            };
        },
    },
    created() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
            for (const key of Object.keys(DEFAULTS)) {
                if (saved[key] !== undefined) {
                    this[key] = saved[key];
                }
            }
        } catch {
            // ignore malformed persisted layout
        }
    },
    beforeUnmount() {
        this.endDrag();
    },
    methods: {
        persist() {
            const out = {};
            for (const key of Object.keys(DEFAULTS)) {
                out[key] = this[key];
            }
            localStorage.setItem(STORE_KEY, JSON.stringify(out));
        },
        toggleLeft() {
            this.leftOpen = !this.leftOpen;
            this.persist();
        },
        toggleRight() {
            this.rightOpen = !this.rightOpen;
            this.persist();
        },
        toggleBottom() {
            this.bottomOpen = !this.bottomOpen;
            this.persist();
        },
        startDrag(which, e) {
            e.preventDefault();
            document.body.style.userSelect = "none";
            document.body.style.cursor = which === "bottom" ? "row-resize" : "col-resize";
            this._drag = which;
            this._move = (ev) => this.onDrag(ev);
            this._up = () => this.endDrag();
            document.addEventListener("mousemove", this._move);
            document.addEventListener("mouseup", this._up);
        },
        onDrag(ev) {
            if (this._drag === "left") {
                this.leftW = Math.max(CLAMP.left.min, Math.min(CLAMP.left.max, ev.clientX));
            } else if (this._drag === "right") {
                this.rightW = Math.max(CLAMP.right.min, Math.min(CLAMP.right.max, window.innerWidth - ev.clientX));
            } else if (this._drag === "bottom") {
                this.bottomH = Math.max(CLAMP.bottomMin, Math.min(window.innerHeight - 150, window.innerHeight - ev.clientY));
            }
        },
        endDrag() {
            if (!this._drag) {
                return;
            }
            document.removeEventListener("mousemove", this._move);
            document.removeEventListener("mouseup", this._up);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            this._drag = null;
            this.persist();
        },
    },
});
</script>

<template>
    <div class="studio-shell" :style="gridTemplate">
        <!-- TOP -->
        <header class="st-top">
            <slot name="top" />
        </header>

        <!-- LEFT RAIL -->
        <aside class="st-rail st-left" :class="{ collapsed: !leftOpen }">
            <template v-if="leftOpen">
                <button class="st-collapse st-collapse--left" title="Collapse panel" @click="toggleLeft">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
                <div class="st-rail-body">
                    <slot name="left" />
                </div>
                <div class="st-resize st-resize--right" title="Drag to resize" @mousedown="startDrag('left', $event)"></div>
            </template>
            <button v-else class="st-expand" title="Expand tools" @click="toggleLeft">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
        </aside>

        <!-- SCORE -->
        <main class="st-score">
            <slot name="score" />
        </main>

        <!-- RIGHT RAIL -->
        <aside class="st-rail st-right" :class="{ collapsed: !rightOpen }">
            <template v-if="rightOpen">
                <div class="st-resize st-resize--left" title="Drag to resize" @mousedown="startDrag('right', $event)"></div>
                <button class="st-collapse st-collapse--right" title="Collapse panel" @click="toggleRight">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6 6 6" /></svg>
                </button>
                <div class="st-rail-body">
                    <slot name="right" />
                </div>
            </template>
            <button v-else class="st-expand" title="Expand mixer" @click="toggleRight">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
        </aside>

        <!-- BOTTOM -->
        <footer class="st-bottom">
            <div v-if="bottomOpen" class="st-resize st-resize--top" title="Drag to resize" @mousedown="startDrag('bottom', $event)"></div>
            <div v-show="bottomOpen" class="st-bottom-grid">
                <slot name="bottomGrid" />
            </div>
            <div class="st-bottom-bar">
                <slot name="bottomBar" :bottom-open="bottomOpen" :toggle-bottom="toggleBottom" />
            </div>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
@import "../../styles/vars.scss";

.studio-shell {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-areas:
        "top top top"
        "left score right"
        "bot bot bot";
    background: $st-app-bg;
    color: $st-text;
    font-family: $st-font-ui;
    -webkit-font-smoothing: antialiased;
    z-index: 1050; // above the app navbar
}

.st-top {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 14px;
    background: $st-panel-bg;
    border-bottom: 1px solid $st-border;
    z-index: 30;
}

.st-rail {
    position: relative;
    background: $st-rail-bg;
    overflow: hidden;
    z-index: 20;

    &.st-left {
        grid-area: left;
        border-right: 1px solid $st-border;
    }
    &.st-right {
        grid-area: right;
        border-left: 1px solid $st-border;
    }
}

.st-rail-body {
    position: absolute;
    inset: 0;
    overflow-y: auto;
}

.st-score {
    grid-area: score;
    overflow: auto;
    background: $st-score-bg;
    padding: 26px 30px 40px;
    display: flex;
    justify-content: center;
}

.st-bottom {
    grid-area: bot;
    position: relative;
    background: $st-panel-bg;
    border-top: 1px solid $st-border;
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 30;
}

.st-bottom-grid {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.st-bottom-bar {
    flex: none;
}

// Collapse / expand chevrons -------------------------------------------------
.st-collapse {
    position: absolute;
    top: 10px;
    z-index: 6;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 1px solid $st-border-2;
    border-radius: 7px;
    background: $st-panel-2;
    color: #8b95a1;
    cursor: pointer;

    &--left {
        right: 10px;
    }
    &--right {
        right: 12px;
    }
    &:hover {
        background: #232b34;
    }
}

.st-expand {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    background: $st-panel-2;
    color: #aab4bf;
    cursor: pointer;

    &:hover {
        background: #232b34;
    }
}

// Drag handles ---------------------------------------------------------------
.st-resize {
    position: absolute;
    z-index: 7;

    &--right {
        top: 0;
        right: 0;
        width: 5px;
        height: 100%;
        cursor: col-resize;
    }
    &--left {
        top: 0;
        left: 0;
        width: 5px;
        height: 100%;
        cursor: col-resize;
    }
    &--top {
        top: 0;
        left: 0;
        right: 0;
        height: 5px;
        cursor: row-resize;
    }
    &:hover {
        background: rgba(91, 110, 245, 0.35);
    }
}
</style>
