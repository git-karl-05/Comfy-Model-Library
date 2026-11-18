/* Shared appearance preferences, applied before the page paints. */
(() => {
    const key = "comfy-library-appearance";
    const defaults = {theme: "dark", accent: "#7c4dff", pageSize: 12, defaultBaseModel: null};
    const root = document.documentElement;
    let settings = {...defaults};
    let syncControls = () => {};

    function sanitize(value) {
        return {theme: value?.theme === "light" ? "light" : "dark",
            accent: /^#[0-9a-f]{6}$/i.test(value?.accent || "") ? value.accent.toLowerCase() : defaults.accent,
            pageSize: [12, 24, 32].includes(value?.pageSize) ? value.pageSize : defaults.pageSize,
            defaultBaseModel: typeof value?.defaultBaseModel === "string" && value.defaultBaseModel.trim() && value.defaultBaseModel.length <= 255
                ? value.defaultBaseModel : null};
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
        const previousDefaultModel = settings.defaultBaseModel;
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
        if (previousDefaultModel !== settings.defaultBaseModel) window.dispatchEvent(new CustomEvent("library-default-model-change", {detail: {baseModel: settings.defaultBaseModel}}));
    }
    window.LibrarySettings = {get pageSize() { return settings.pageSize; }, get defaultBaseModel() { return settings.defaultBaseModel; }};
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
                <span class="compact-action-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3z"/>
                    <circle cx="12" cy="11" r="3"/>
                </svg></span>
                <span>Settings</span>
            </button>
            <div id="settingsBackdrop" class="settings-modal-backdrop" hidden></div>
            <section id="appearanceSettings" class="appearance-settings" role="dialog" aria-modal="true" aria-label="Settings" hidden>
                <div id="settingsModalHeader" class="appearance-settings-header"><h2>Settings</h2>
                    <button id="closeSettingsButton" class="menu-close-button" type="button" aria-label="Close settings">×</button>
                </div>
                <div class="settings-layout">
                    <div id="settingsNavigation" class="settings-navigation" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
                        <button id="settingsTabGeneral" type="button" role="tab" aria-controls="settingsPanelGeneral" aria-selected="false" tabindex="-1">General</button>
                        <button id="settingsTabDisplay" type="button" role="tab" aria-controls="settingsPanelDisplay" aria-selected="true" tabindex="0">Display</button>
                        <button id="settingsTabArchives" type="button" role="tab" aria-controls="settingsPanelArchives" aria-selected="false" tabindex="-1">Archive</button>
                        <button id="settingsTabData" type="button" role="tab" aria-controls="settingsPanelData" aria-selected="false" tabindex="-1">Backup &amp; Import</button>
                    </div>
                    <div class="settings-content">
                        <section id="settingsPanelGeneral" class="settings-section" role="tabpanel" aria-labelledby="settingsTabGeneral" hidden>
                            <h3>General</h3>
                            <label class="appearance-accent-label" for="itemsPerPage">Items per page</label>
                            <select id="itemsPerPage" class="details-edit-input"><option value="12">12</option><option value="24">24</option><option value="32">32</option></select>
                            <div class="settings-default-model">
                                <label class="appearance-accent-label" for="defaultBaseModelSelect">Default Base Model</label>
                                <select id="defaultBaseModelSelect" class="details-edit-input"><option value="ALL">All base models</option></select>
                                <button id="saveDefaultBaseModel" class="details-save-button" type="button">Set as default</button>
                                <p id="defaultBaseModelStatus" role="status" aria-live="polite"></p>
                            </div>
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
                            <h3>Archived LoRAs</h3>
                            <p id="archiveStatus" role="status" aria-live="polite"></p>
                            <div id="archivedLoras" class="archived-loras"></div>
                            <div class="archive-pagination">
                                <button id="archivePrevious" class="pagination-button" type="button" aria-label="Previous archive page" title="Previous page">‹</button>
                                <span id="archivePageIndicator" aria-live="polite"></span>
                                <button id="archiveNext" class="pagination-button" type="button" aria-label="Next archive page" title="Next page">›</button>
                            </div>
                        </section>
                        <section id="settingsPanelData" class="settings-section" role="tabpanel" aria-labelledby="settingsTabData" hidden>
                            <div id="settingsLoRADataContent"></div>
                            <div id="settingsPoseDataContent"></div>
                        </section>
                    </div>
                </div>
            </section>`;
        menu.appendChild(footer);
        const button = document.getElementById("settingsButton");
        const panel = document.getElementById("appearanceSettings");
        const settingsBackdrop = document.getElementById("settingsBackdrop");
        document.body.appendChild(settingsBackdrop);
        document.body.appendChild(panel);
        const dataTools = document.getElementById("libraryDataTools");
        for (const [library, label] of [["loras", "LoRA"], ["poses", "Pose"]]) {
            const host = document.getElementById(`settings${label}DataContent`);
            if (dataTools?.dataset.library === library) {
                host.appendChild(dataTools);
                dataTools.hidden = false;
                continue;
            }
            const tools = document.createElement("section");
            tools.className = "settings-data-tools";
            tools.innerHTML = `<h4>${label}</h4>
                <button id="settings${label}BackupToggle" class="compact-action-button" type="button" aria-expanded="false" aria-controls="settings${label}BackupOptions">
                    <span class="compact-action-icon" aria-hidden="true">▣</span><span>${label} Backup</span>
                </button>
                <div id="settings${label}BackupOptions" class="backup-options hidden">
                    <button id="settings${label}BackupExport" class="compact-action-button" type="button"><span class="compact-action-icon" aria-hidden="true">↓</span><span>Export ${label} Backup (JSON)</span></button>
                    <button id="settings${label}BackupImport" class="compact-action-button" type="button"><span class="compact-action-icon" aria-hidden="true">↑</span><span>Import ${label} Backup (JSON)</span></button>
                </div>
                <input id="settings${label}BackupFile" class="hidden-file-input" type="file" accept=".json,application/json">
                <p id="settings${label}BackupStatus" role="status" aria-live="polite"></p>`;
            host.appendChild(tools);
            const toggle = document.getElementById(`settings${label}BackupToggle`);
            const options = document.getElementById(`settings${label}BackupOptions`);
            const exportButton = document.getElementById(`settings${label}BackupExport`);
            const importButton = document.getElementById(`settings${label}BackupImport`);
            const input = document.getElementById(`settings${label}BackupFile`);
            const status = document.getElementById(`settings${label}BackupStatus`);
            const endpoint = library === "loras" ? "/api/backup" : "/api/poses/backup";
            toggle.addEventListener("click", () => {
                const expanded = options.classList.contains("hidden");
                options.classList.toggle("hidden", !expanded);
                toggle.setAttribute("aria-expanded", String(expanded));
            });
            exportButton.addEventListener("click", async () => {
                exportButton.disabled = true;
                status.textContent = "Exporting…";
                try {
                    const response = await fetch(`${endpoint}/export`);
                    if (!response.ok) throw new Error(`Unable to export ${label} backup.`);
                    const url = URL.createObjectURL(await response.blob());
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = library === "loras" ? "comfy-model-library-backup.json" : "poses-backup.json";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    status.textContent = `${label} backup exported.`;
                } catch (error) { status.textContent = error.message; }
                finally { exportButton.disabled = false; }
            });
            importButton.addEventListener("click", () => input.click());
            input.addEventListener("change", async () => {
                const file = input.files?.[0];
                if (!file) return;
                if (library === "loras" && !window.confirm("Import this LoRA backup? Matching LoRAs will be updated using the backup.")) {
                    input.value = "";
                    return;
                }
                importButton.disabled = true;
                status.textContent = "Importing…";
                try {
                    let body = file;
                    const headers = {};
                    if (library === "loras") {
                        body = new FormData();
                        body.append("file", file);
                    } else headers["Content-Type"] = "application/json";
                    const response = await fetch(`${endpoint}/import`, {method: "POST", headers, body});
                    if (!response.ok) throw new Error((await response.text()) || `Unable to import ${label} backup.`);
                    const result = await response.json();
                    status.textContent = `${label} backup imported. Imported: ${result.importedCount ?? result.imported ?? 0}. Updated: ${result.updatedCount ?? 0}.`;
                } catch (error) { status.textContent = error.message; }
                finally { importButton.disabled = false; input.value = ""; }
            });
        }
        let archivePage = 0;
        let archiveRequest = 0;
        const archiveStatus = document.getElementById("archiveStatus");
        const archiveList = document.getElementById("archivedLoras");
        const archivePrevious = document.getElementById("archivePrevious");
        const archiveNext = document.getElementById("archiveNext");
        async function loadArchives() {
            if (typeof fetch !== "function") return;
            const request = ++archiveRequest;
            archiveStatus.textContent = "Loading archived LoRAs…";
            archivePrevious.disabled = true;
            archiveNext.disabled = true;
            archiveList.replaceChildren();
            try {
                const response = await fetch(`/api/loras/archived?page=${archivePage}&size=12`, {cache: "no-store"});
                if (!response.ok) throw new Error("Unable to load archived LoRAs. Reopen Archive to retry.");
                const page = await response.json();
                if (request !== archiveRequest) return;
                if (!page.content.length && archivePage > 0) {
                    archivePage = Math.max(0, page.totalPages - 1);
                    return loadArchives();
                }
                archiveStatus.textContent = page.totalElements ? `${page.totalElements} archived LoRAs` : "No archived LoRAs.";
                const pageIndicator = document.getElementById("archivePageIndicator");
                pageIndicator.textContent = `${archivePage + 1} / ${Math.max(1, page.totalPages)}`;
                pageIndicator.setAttribute("aria-label", `Page ${archivePage + 1} of ${Math.max(1, page.totalPages)}`);
                archivePrevious.disabled = archivePage === 0;
                archiveNext.disabled = page.last;
                for (const lora of page.content) {
                    const row = document.createElement("div");
                    row.className = "archived-lora-row";
                    const preview = document.createElement("span");
                    preview.className = "archived-lora-preview";
                    preview.setAttribute("aria-hidden", "true");
                    preview.textContent = "▧";
                    if (lora.filePath) {
                        const isVideo = /\.(mp4|webm|mov)(?:[?#]|$)/i.test(lora.filePath);
                        const media = document.createElement(isVideo ? "video" : "img");
                        media.className = "archived-lora-preview-media";
                        if (isVideo) {
                            media.muted = true;
                            media.playsInline = true;
                            media.preload = "metadata";
                            media.addEventListener("loadedmetadata", () => {
                                if (Number.isFinite(media.duration) && media.duration > 0) media.currentTime = Math.min(0.1, media.duration / 2);
                            });
                        } else {
                            media.alt = "";
                            media.loading = "lazy";
                        }
                        const cachedUrl = localPreviewUrl(lora.filePath);
                        let triedOriginal = cachedUrl === lora.filePath;
                        media.addEventListener("error", () => {
                            if (!triedOriginal) {
                                triedOriginal = true;
                                media.src = lora.filePath;
                            } else media.hidden = true;
                        });
                        media.src = cachedUrl;
                        preview.appendChild(media);
                    }
                    const name = document.createElement("span");
                    name.textContent = [lora.loraName, lora.version && `v${lora.version}`, lora.creator].filter(Boolean).join(" · ");
                    const restore = document.createElement("button");
                    restore.type = "button";
                    restore.className = "compact-action-button";
                    restore.textContent = "Restore";
                    restore.setAttribute("aria-label", `Restore ${lora.loraName}`);
                    restore.addEventListener("click", async () => {
                        restore.disabled = true;
                        try {
                            const saved = await fetch(`/api/loras/${lora.id}/archive`, {
                                method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({archived: false})
                            });
                            if (!saved.ok) throw new Error("Unable to restore this LoRA. Please try again.");
                            window.dispatchEvent(new CustomEvent("library-archive-change"));
                        } catch (error) {
                            archiveStatus.textContent = error.message;
                            restore.disabled = false;
                        }
                    });
                    row.appendChild(preview);
                    row.appendChild(name);
                    row.appendChild(restore);
                    archiveList.appendChild(row);
                }
            } catch (error) { if (request === archiveRequest) archiveStatus.textContent = error.message; }
        }
        archivePrevious.addEventListener("click", () => { archivePage--; loadArchives(); });
        archiveNext.addEventListener("click", () => { archivePage++; loadArchives(); });
        window.addEventListener("library-archive-change", () => {
            if (!panel.hidden && selectedSection === "Archives") loadArchives();
        });
        const color = document.getElementById("accentColorInput");
        const light = document.getElementById("lightModeButton");
        const dark = document.getElementById("darkModeButton");
        const defaultModelSelect = document.getElementById("defaultBaseModelSelect");
        const saveDefaultModel = document.getElementById("saveDefaultBaseModel");
        const defaultModelStatus = document.getElementById("defaultBaseModelStatus");
        let loadingModels = false;
        async function loadDefaultModels() {
            if (loadingModels || typeof fetch !== "function") return;
            loadingModels = true;
            defaultModelSelect.disabled = true;
            saveDefaultModel.disabled = true;
            defaultModelStatus.textContent = "Loading base models…";
            let loaded = false;
            try {
                const response = await fetch("/api/loras/filter-options", {cache: "no-store"});
                if (!response.ok) throw new Error("Unable to load base models. Reopen General to retry.");
                const rows = await response.json();
                if (!Array.isArray(rows)) throw new Error("Unable to load base models. Reopen General to retry.");
                const models = [...new Set(rows.map(row => row?.baseModel).filter(value => typeof value === "string" && value.trim()))]
                    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}));
                if (settings.defaultBaseModel && settings.defaultBaseModel !== "ALL" && !models.includes(settings.defaultBaseModel)) models.push(settings.defaultBaseModel);
                defaultModelSelect.replaceChildren();
                for (const [value, label] of [["ALL", "All base models"], ...models.map(model => [model, model])]) {
                    const option = document.createElement("option");
                    option.value = value; option.textContent = label;
                    defaultModelSelect.appendChild(option);
                }
                defaultModelSelect.value = settings.defaultBaseModel || "ALL";
                defaultModelStatus.textContent = "";
                loaded = true;
            } catch (error) {
                defaultModelStatus.textContent = error.message;
            } finally {
                loadingModels = false;
                defaultModelSelect.disabled = false;
                saveDefaultModel.disabled = !loaded;
            }
        }
        saveDefaultModel.addEventListener("click", () => {
            apply({...settings, defaultBaseModel: defaultModelSelect.value || "ALL"}, true);
            defaultModelStatus.textContent = "Default saved.";
        });
        const sections = ["General", "Display", "Archives", "Data"];
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
            if (section === "General") loadDefaultModels();
            if (section === "Archives") loadArchives();
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
        function sizeToGeneral() {
            const general = document.getElementById("settingsPanelGeneral");
            const wasHidden = general.hidden;
            general.hidden = false;
            const height = Math.max(general.scrollHeight, document.getElementById("settingsNavigation").scrollHeight);
            general.hidden = wasHidden;
            if (!height) return;
            const header = document.getElementById("settingsModalHeader");
            const style = getComputedStyle(panel);
            const headerStyle = getComputedStyle(header);
            const frame = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
                + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
                + header.offsetHeight + parseFloat(headerStyle.marginBottom);
            panel.style.setProperty("--settings-modal-height", `${Math.ceil(height + frame)}px`);
        }
        function close(focus = false) {
            panel.hidden = true;
            settingsBackdrop.hidden = true;
            document.body.classList.remove("settings-open");
            button.setAttribute("aria-expanded", "false");
            if (focus) (document.getElementById("optionsButton") || button).focus();
        }
        syncControls = () => {
            light.setAttribute("aria-pressed", String(settings.theme === "light"));
            dark.setAttribute("aria-pressed", String(settings.theme === "dark"));
            light.classList.toggle("active", settings.theme === "light");
            dark.classList.toggle("active", settings.theme === "dark");
            document.getElementById("itemsPerPage").value = String(settings.pageSize);
            defaultModelSelect.value = settings.defaultBaseModel || "ALL";
            document.getElementById("resetAccentButton").disabled = settings.accent === defaults.accent;
            color.value = settings.accent;
            document.getElementById("accentColorValue").textContent = settings.accent;
        };
        syncControls();
        button.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
            button.setAttribute("aria-expanded", String(!panel.hidden));
            if (!panel.hidden) {
                sizeToGeneral();
                document.body.classList.add("settings-open");
                settingsBackdrop.hidden = false;
                menu.classList.add("hidden");
                document.getElementById("menuBackdrop")?.classList.add("hidden");
                document.getElementById("menuBackdrop")?.setAttribute("aria-hidden", "true");
                document.getElementById("optionsButton")?.setAttribute("aria-expanded", "false");
                document.body.classList.remove("menu-open");
                document.getElementById(`settingsTab${selectedSection}`).focus();
                if (selectedSection === "General") loadDefaultModels();
                if (selectedSection === "Archives") loadArchives();
            }
        });
        document.getElementById("closeSettingsButton").addEventListener("click", () => close(true));
        if (window.location?.search && new URLSearchParams(window.location.search).get("settings") === "data") {
            selectSection("Data");
            button.click();
        }
        light.addEventListener("click", () => apply({...settings, theme: "light"}, true));
        dark.addEventListener("click", () => apply({...settings, theme: "dark"}, true));
        document.getElementById("resetAccentButton").addEventListener("click", () => apply({...settings, accent: defaults.accent}, true));
        document.getElementById("itemsPerPage").addEventListener("change", event => apply({...settings, pageSize: Number(event.target.value)}, true));
        color.addEventListener("input", () => apply({...settings, accent: color.value}, true));
        color.addEventListener("change", () => apply({...settings, accent: color.value}, true));
        settingsBackdrop.addEventListener("click", () => close(true));
        document.addEventListener("click", event => {
            const notesDialog = document.getElementById("notesImportListDialog");
            if (event.isTrusted === false || notesDialog?.open || notesDialog?.contains(event.target)) return;
            if (!footer.contains(event.target) && !panel.contains(event.target)) close();
        });
        document.addEventListener("keydown", event => {
            if (document.getElementById("notesImportListDialog")?.open) return;
            if (event.key === "Tab" && !panel.hidden) {
                const controls = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')]
                    .filter(control => control.getClientRects().length > 0);
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
            if (event.key === "Escape" && !panel.hidden) {
                event.preventDefault(); event.stopImmediatePropagation(); close(true);
            } else if (event.key === "Escape" && !menu.classList.contains("hidden")) {
                event.preventDefault(); event.stopImmediatePropagation();
                menu.classList.add("hidden");
                menu.setAttribute("aria-hidden", "true");
                const backdrop = document.getElementById("menuBackdrop");
                backdrop?.classList.add("hidden");
                backdrop?.setAttribute("aria-hidden", "true");
                document.body.classList.remove("menu-open");
                const opener = document.getElementById("optionsButton");
                opener?.setAttribute("aria-expanded", "false");
                opener?.focus();
            }
        });
    });
})();
