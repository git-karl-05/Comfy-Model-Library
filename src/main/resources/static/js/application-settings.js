/* Settings belong to the installed host, rather than browser preferences. */
document.addEventListener("DOMContentLoaded", async () => {
    const panel = document.getElementById("settingsPanelGeneral");
    if (!panel || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
    try {
        const response = await fetch("/api/desktop");
        if (!response.ok) return;
        const settings = await response.json();
        const section = document.createElement("section");
        section.className = "settings-section application-settings";
        section.innerHTML = `<h3>Application</h3>
            <label><input type="checkbox" name="autoStart"> Start with Windows</label>
            <label><input type="checkbox" name="openBrowser"> Open browser on automatic startup</label>
            <label><input type="checkbox" name="lan"> Allow access from other devices</label>
            <label>Server port<input class="details-edit-input" type="number" min="1024" max="65535" name="port"></label>
            <label>ComfyUI output folder<input class="details-edit-input" type="text" name="output"></label>
            <button type="button" class="details-cancel-button" data-action="choose-output">Browse output folder</button>
            <button type="button" class="details-cancel-button" data-action="data">Open data folder</button>
            <button type="button" class="details-cancel-button" data-action="logs">Open logs</button>
            <button type="button" class="details-save-button">Save application settings</button>
            <p role="status" aria-live="polite">Network and folder changes take effect after quitting and reopening the app.</p>`;
        panel.appendChild(section);
        section.querySelectorAll("input").forEach(input => {
            if (input.type === "checkbox") input.checked = settings[input.name] === "true";
            else input.value = settings[input.name] || "";
        });
        section.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", async () => {
            try {
                const result = await fetch(`/api/desktop/action/${button.dataset.action}`, {method: "POST"});
                if (!result.ok) throw new Error("Unable to open the requested folder.");
                const value = await result.json();
                if (value.path) section.querySelector('[name="output"]').value = value.path;
            } catch (error) { section.querySelector('[role="status"]').textContent = error.message; }
        }));
        section.querySelector(".details-save-button").addEventListener("click", async () => {
            const status = section.querySelector('[role="status"]');
            const values = {};
            section.querySelectorAll("input").forEach(input => { values[input.name] = input.type === "checkbox" ? String(input.checked) : input.value; });
            try {
                const saved = await fetch("/api/desktop", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(values)});
                if (!saved.ok) throw new Error("Settings could not be saved. Check the port and output folder, and use the installed app.");
                status.textContent = "Saved. Quit and reopen the app to apply network and folder changes.";
            } catch (error) { status.textContent = error.message; }
        });
        if (location.hash === "#application-settings") {
            document.getElementById("settingsButton")?.click();
            document.getElementById("settingsTabGeneral")?.click();
            section.scrollIntoView({block: "nearest"});
        }
    } catch { /* Desktop settings are absent when running the development server. */ }
});
