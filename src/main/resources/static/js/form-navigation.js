/* Same-origin form navigation and per-tab gallery state, shared by both libraries. */
const FormNavigation = (() => {
    const fallback = "/html/index.html";
    const formPaths = new Set(["/html/add-lora.html", "/html/edit-lora.html", "/html/add-pose.html", "/html/edit-pose.html"]);
    let stateProvider = null;
    function safeReturn(value) {
        if (!value) return fallback;
        try {
            const url = new URL(value, window.location.href);
            if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol) || url.username || url.password || formPaths.has(url.pathname)) return fallback;
            return url.pathname + url.search + url.hash;
        } catch { return fallback; }
    }
    function returnUrl() {
        const params = new URLSearchParams(window.location.search);
        // An explicitly invalid target must fall back rather than trusting the referrer.
        return safeReturn(params.has("returnTo") ? params.get("returnTo") : document.referrer);
    }
    function key() {
        const url = new URL(window.location.href);
        url.searchParams.delete("openLora");
        return "gallery-state:" + url.pathname + url.search;
    }
    function saveState() {
        if (!stateProvider) return;
        try { sessionStorage.setItem(key(), JSON.stringify({...stateProvider(), scrollY: window.scrollY})); } catch { /* Storage may be disabled. */ }
    }
    function restoreState() {
        try { return JSON.parse(sessionStorage.getItem(key()) || "null"); } catch { return null; }
    }
    function formUrl(target, returnTarget) {
        saveState();
        const url = new URL(target, window.location.href);
        if (url.origin !== window.location.origin || !formPaths.has(url.pathname)) throw new Error("Invalid form destination");
        const origin = returnTarget || (formPaths.has(window.location.pathname) ? returnUrl() : window.location.href);
        url.searchParams.set("returnTo", safeReturn(origin));
        return url.pathname + url.search + url.hash;
    }
    function go(target, returnTarget) { window.location.assign(formUrl(target, returnTarget)); }
    function finish() { window.location.replace(returnUrl()); }
    function register(provider) { stateProvider = provider; }
    document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
        const url = new URL(link.href, window.location.href);
        if (url.origin === window.location.origin && formPaths.has(url.pathname)) {
            event.preventDefault();
            go(url.href);
        }
    });
    window.addEventListener("pagehide", saveState);
    return {safeReturn, returnUrl, formUrl, go, finish, register, restoreState};
})();
