import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import AppShell from "./layouts/AppShell.vue";
import Library from "./pages/Library.vue";
import Settings from "./pages/Settings.vue";
import { applyTheme, forceDark } from "./theme.ts";

const TabEditor = () => import("./pages/TabEditor.vue");

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        component: AppShell,
        children: [
            {
                // Local-folder library; folder navigation via ?dir=Rock/Sub.
                name: "home",
                path: "",
                component: Library,
            },
            {
                name: "favorites",
                path: "favorites",
                component: Library,
                meta: { favorites: true },
            },
            {
                name: "settings",
                path: "settings",
                component: Settings,
            },
        ],
    },
    {
        // The editor is a standalone full-viewport studio (always dark).
        name: "editPath",
        path: "/edit",
        component: TabEditor,
        meta: { studio: true },
    },

    // Legacy URLs from the retired server-backed app fall back to home.
    { path: "/library", redirect: "/" },
    { path: "/login", redirect: "/" },
    { path: "/register", redirect: "/" },
    { path: "/new-tab", redirect: "/" },
    { path: "/tab/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});

// Studio routes (editor) are always dark; everything else follows the user's
// theme preference.
router.afterEach((to) => {
    if (to.meta.studio) forceDark();
    else applyTheme();
});
