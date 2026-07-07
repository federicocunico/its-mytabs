import { createApp } from "vue";

import App from "./App.vue";
import { FontAwesomeIcon } from "./icon.ts";

// @ts-ignore No idea
import { createBootstrap } from "bootstrap-vue-next";

// Dependencies
import { router } from "./router.ts";
import { i18n } from "./i18n.ts";
import { initStorage } from "./storage/session.ts";

// CSS — main.scss (Bootstrap) first, Tailwind after so its layered
// utilities are declared later in the sheet order.
import "./styles/main.scss";
import "./styles/tailwind.css";

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(createBootstrap());
app.component("FontAwesomeIcon", FontAwesomeIcon);

// Restore any previously-picked storage folder before the UI renders, so the
// local library / editor see a ready provider on first paint.
initStorage().finally(() => app.mount("#app"));

function checkMobile() {
    if (window.innerWidth <= 768) {
        document.documentElement.classList.add("mobile");
    } else {
        document.documentElement.classList.remove("mobile");
    }
}
window.addEventListener("resize", checkMobile);
checkMobile();

// HMR is not working properly with AlphaTab, so we do a full reload on update
if (import.meta.hot) {
    import.meta.hot.on("vite:afterUpdate", () => {
        console.log("Hot update - reloading page to reset AlphaTab");

        // editor page only
        if (window.location.pathname.startsWith("/edit")) {
            window.location.reload();
        }
    });
}
