import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import TabConfig from "./pages/TabConfig.vue";
import Settings from "./pages/Settings.vue";
import TabNew from "./pages/TabNew.vue";

const Tab = () => import("./pages/Tab.vue");
const TabEditor = () => import("./pages/TabEditor.vue");
const LocalLibrary = () => import("./pages/LocalLibrary.vue");

const routes: RouteRecordRaw[] = [
    {
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        // Local-folder library is the only entry (docker + static/Vercel).
                        // The app is client-side and requires no login.
                        name: "home",
                        path: "/",
                        alias: "/library",
                        component: LocalLibrary,
                        meta: { hideFooter: true },
                    },
                    {
                        path: "/tab/:id/edit/info",
                        component: TabConfig,
                    },
                    {
                        path: "/tab/:id/edit/audio",
                        component: TabConfig,
                    },
                    {
                        path: "/tab/:id/edit/tab-file",
                        component: TabConfig,
                    },
                    {
                        name: "tabNew",
                        path: "/new-tab",
                        component: TabNew,
                    },
                    {
                        // The editor is the default view for a tab; opening a tab
                        // (or the old player URL) lands here. Query params (e.g.
                        // ?track=) are preserved.
                        name: "tab",
                        path: "/tab/:id",
                        redirect: (to) => ({ name: "tabEditor", params: to.params, query: to.query }),
                    },
                    {
                        name: "tabEditor",
                        path: "/tab/:id/editor",
                        component: TabEditor,
                        meta: { hideFooter: true },
                    },
                    {
                        name: "editPath",
                        path: "/edit",
                        component: TabEditor,
                        meta: { hideFooter: true },
                    },
                    {
                        // Legacy player, kept reachable for reference but no longer
                        // linked from the UI.
                        name: "tabPlayer",
                        path: "/tab/:id/player",
                        component: Tab,
                        meta: { hideFooter: true },
                    },
                    {
                        name: "settings",
                        path: "/settings",
                        component: Settings,
                    },
                ],
            },
            // Login/registration are retired (no auth). Old links fall back to home.
            { path: "/register", redirect: "/" },
            { path: "/login", redirect: "/" },
        ],
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});

// Demo mode navigation guard
router.beforeEach((to, from, next) => {
    if (window.isDemo === true) {
        // Allow access to Settings, Tab pages, and Register (setup) page only.
        // The score editor is write-only functionality — block it in demo mode.
        const isTabPage = to.path.startsWith("/tab/") && !to.path.endsWith("/editor");
        const isSettingsPage = to.path === "/settings";
        const isRegisterPage = to.path === "/register";

        if (!isTabPage && !isSettingsPage && !isRegisterPage) {
            // Redirect to demo tab
            next("/tab/1?audio=youtube-VuKSlOT__9s&track=2");
        } else {
            next();
        }
    } else {
        next();
    }
});
