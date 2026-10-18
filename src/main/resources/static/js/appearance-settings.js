/* Shared appearance preferences, applied before the page paints. */
(() => {
    const key = "comfy-library-appearance";
    const defaults = {theme: "dark", accent: "#7c4dff", pageSize: 12};
    const root = document.documentElement;
    let settings = {...defaults};
    let syncControls = () => {};

    function sanitize(value) {
        return {theme: value?.theme === "light" ? "light" : "dark",
            accent: /^#[0-9a-f]{6}$/i.test(value?.accent || "") ? value.accent.toLowerCase() : defaults.accent,
            pageSize: [12, 24, 32].includes(value?.pageSize) ? value.pageSize : defaults.pageSize};
    }
    function luminance(rgb) {
        const linear = rgb.map(channel => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    function readableAccent(rgb, light) {
        let candidate = rgb;
        const background = light ? luminance([245, 246, 248]) : luminance([26, 26, 26]);
        for (let step = 0; step <= 20; step++) {
            const value = luminance(candidate);
            if ((Math.max(value, background) + 0.05) / (Math.min(value, background) + 0.05) >= 4.5) break;
            candidate = rgb.map(channel => Math.round(channel + ((light ? 0 : 255) - channel) * (step + 1) / 20));
        }
        return `rgb(${candidate.join(", ")})`;
    }
    function apply(value, persist = false) {
        const previousPageSize = settings.pageSize;
        settings = sanitize(value);
        root.dataset.theme = settings.theme;
        const rgb = settings.accent.slice(1).match(/../g).map(part => parseInt(part, 16));
        const valueLuminance = luminance(rgb);
        const whiteContrast = 1.05 / (valueLuminance + 0.05);
        const blackContrast = (valueLuminance + 0.05) / 0.05;
        root.style.setProperty("--primary", settings.accent);
        root.style.setProperty("--primary-rgb", rgb.join(", "));
        root.style.setProperty("--primary-hover", settings.theme === "dark" && settings.accent === defaults.accent
            ? "#9168ff" : readableAccent(rgb, settings.theme === "light"));
        root.style.setProperty("--on-primary", whiteContrast >= blackContrast ? "#ffffff" : "#111111");
        const hoverTarget = whiteContrast >= blackContrast ? 0 : 255;
        root.style.setProperty("--primary-fill-hover", `rgb(${rgb.map(channel => Math.round(channel + (hoverTarget - channel) * 0.12)).join(", ")})`);
        if (persist) {
            try { localStorage.setItem(key, JSON.stringify(settings)); } catch { /* Preferences still work without storage. */ }
        }
        syncControls();
        if (previousPageSize !== settings.pageSize) window.dispatchEvent(new CustomEvent("library-page-size-change", {detail: {pageSize: settings.pageSize}}));
    }
    window.LibrarySettings = {get pageSize() { return settings.pageSize; }};
    try { apply(JSON.parse(localStorage.getItem(key))); } catch { apply(defaults); }
    window.addEventListener("storage", event => {
        if (event.key !== key) return;
        try { apply(JSON.parse(event.newValue)); } catch { apply(defaults); }
    });
    document.addEventListener("DOMContentLoaded", () => {
        const menu = document.getElementById("sideMenu");
        if (!menu) return;
        const footer = document.createElement("div");
        footer.className = "sidebar-settings";
        footer.innerHTML = `
            <button id="settingsButton" class="sidebar-settings-button" type="button" aria-label="Settings"
                    title="Settings" aria-controls="appearanceSettings" aria-expanded="false">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3z"/>
                    <circle cx="12" cy="11" r="3"/>
                </svg>
                <span>Settings</span>
            </button>
            <section id="appearanceSettings" class="appearance-settings" role="dialog" aria-label="Settings" hidden>
                <div class="appearance-settings-header"><h2>Settings</h2>
                    <button id="closeSettingsButton" class="menu-close-button" type="button" aria-label="Close settings">×</button>
                </div>
                <div class="settings-layout">
                    <div class="settings-navigation" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
                        <button id="settingsTabGeneral" type="button" role="tab" aria-controls="settingsPanelGeneral" aria-selected="false" tabindex="-1">General</button>
                        <button id="settingsTabDisplay" type="button" role="tab" aria-controls="settingsPanelDisplay" aria-selected="true" tabindex="0">Display</button>
                        <button id="settingsTabArchives" type="button" role="tab" aria-controls="settingsPanelArchives" aria-selected="false" tabindex="-1">Archives</button>
                    </div>
                    <div class="settings-content">
                        <section id="settingsPanelGeneral" class="settings-section" role="tabpanel" aria-labelledby="settingsTabGeneral" hidden>
                            <h3>General</h3>
                            <label class="appearance-accent-label" for="itemsPerPage">Items per page</label>
                            <select id="itemsPerPage" class="details-edit-input"><option value="12">12</option><option value="24">24</option><option value="32">32</option></select>
                            <p>Your preferences are saved in this browser and apply across the application.</p>
                        </section>
                        <section id="settingsPanelDisplay" class="settings-section" role="tabpanel" aria-labelledby="settingsTabDisplay">
                            <h3 id="displaySettingsLabel">Display</h3>
                            <div class="appearance-mode-buttons" role="group" aria-labelledby="displaySettingsLabel">
                                <button id="lightModeButton" type="button" class="gallery-chip-button" aria-pressed="false">☀ Light</button>
                                <button id="darkModeButton" type="button" class="gallery-chip-button" aria-pressed="true">☾ Dark</button>
                            </div>
                            <label class="appearance-accent-label" for="accentColorInput">Accent color</label>
                            <div class="appearance-color-control">
                                <input id="accentColorInput" type="color" value="#7c4dff" aria-label="Accent color">
                                <output id="accentColorValue" for="accentColorInput">#7c4dff</output>
                                <button id="resetAccentButton" class="filter-reset-button" type="button">Reset accent</button>
                            </div>
                        </section>
                        <section id="settingsPanelArchives" class="settings-section" role="tabpanel" aria-labelledby="settingsTabArchives" hidden>
                            <h3>Archives</h3>
                            <p>JSON backup import and export are available under Backup in each library’s action menu.</p>
                        </section>
                    </div>
                </div>
            </section>`;
        menu.appendChild(footer);
        const button = document.getElementById("settingsButton");
        const panel = document.getElementById("appearanceSettings");
        const color = document.getElementById("accentColorInput");
        const light = document.getElementById("lightModeButton");
        const dark = document.getElementById("darkModeButton");
        const sections = ["General", "Display", "Archives"];
        let selectedSection = "Display";
        function selectSection(section, focus = false) {
            selectedSection = section;
            sections.forEach(name => {
                const tab = document.getElementById(`settingsTab${name}`);
                tab.setAttribute("aria-selected", String(name === section));
                tab.tabIndex = name === section ? 0 : -1;
                document.getElementById(`settingsPanel${name}`).hidden = name !== section;
            });
            if (focus) document.getElementById(`settingsTab${section}`).focus();
        }
        sections.forEach((name, index) => {
            const tab = document.getElementById(`settingsTab${name}`);
            tab.addEventListener("click", () => selectSection(name));
            tab.addEventListener("keydown", event => {
                let next = index;
                if (event.key === "ArrowDown") next = (index + 1) % sections.length;
                else if (event.key === "ArrowUp") next = (index + sections.length - 1) % sections.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = sections.length - 1;
                else return;
                event.preventDefault();
                selectSection(sections[next], true);
            });
        });
        selectSection(selectedSection);
        function close(focus = false) {
            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
            if (focus) button.focus();
        }
        syncControls = () => {
            light.setAttribute("aria-pressed", String(settings.theme === "light"));
            dark.setAttribute("aria-pressed", String(settings.theme === "dark"));
            light.classList.toggle("active", settings.theme === "light");
            dark.classList.toggle("active", settings.theme === "dark");
            document.getElementById("itemsPerPage").value = String(settings.pageSize);
            document.getElementById("resetAccentButton").disabled = settings.accent === defaults.accent;
            color.value = settings.accent;
            document.getElementById("accentColorValue").textContent = settings.accent;
        };
        syncControls();
        button.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
            button.setAttribute("aria-expanded", String(!panel.hidden));
            if (!panel.hidden) document.getElementById(`settingsTab${selectedSection}`).focus();
        });
        document.getElementById("closeSettingsButton").addEventListener("click", () => close(true));
        light.addEventListener("click", () => apply({...settings, theme: "light"}, true));
        dark.addEventListener("click", () => apply({...settings, theme: "dark"}, true));
        document.getElementById("resetAccentButton").addEventListener("click", () => apply({...settings, accent: defaults.accent}, true));
        document.getElementById("itemsPerPage").addEventListener("change", event => apply({...settings, pageSize: Number(event.target.value)}, true));
        color.addEventListener("input", () => apply({...settings, accent: color.value}, true));
        color.addEventListener("change", () => apply({...settings, accent: color.value}, true));
        document.addEventListener("click", event => { if (!footer.contains(event.target)) close(); });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !panel.hidden) {
                event.preventDefault(); event.stopImmediatePropagation(); close(true);
            }
        });
        new MutationObserver(() => {
            if (menu.classList.contains("hidden") || menu.getAttribute("aria-hidden") === "true") close();
        }).observe(menu, {attributes: true, attributeFilter: ["class", "aria-hidden"]});
    });
})();
