(() => {
    const el = id => document.getElementById(id);
    let folder = "", page = 0, request = 0, selected = null;
    let sortField = "name", sortDescending = false, mediaFilter = "all";
    const sortValue = () => sortField === null ? "recent" : sortField === "name" ? (sortDescending ? "name-desc" : "name")
        : `${sortField}${sortDescending ? "" : "-asc"}`;
    const send = type => {
        if (window.parent !== window) window.parent.postMessage({type, path: selected?.path}, location.origin);
        else location.assign("/html/poses.html");
    };
    el("cancelOutput").onclick = () => send("output-cancel");
    el("useOutput").onclick = () => { if (selected) send("output-select"); };
    let previewCard = null, mediaEntries = [], hasMore = false, navigating = false;
    const folderPositions = new Map();
    const folderExpansion = new Map();
    const dateExpansion = new Map();
    el("outputFolders").addEventListener("toggle", () => folderExpansion.set(folder, el("outputFolders").open));
    let gridScroll = 0, scrollRestore = null, previewOrigin = null, totalMedia = 0, mediaOffset = 0;
    const mediaArea = () => document.querySelector(".output-media-area");
    const previewOpen = () => !el("outputFullPreview").classList.contains("hidden");
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        el("outputGrid").parentElement.addEventListener(type, () => { scrollRestore = null; }, {passive: true});
    }
    function closePreview() {
        document.querySelector(".output-page").classList.remove("preview-active");
        document.querySelector(".output-media-area").classList.remove("preview-open");
        el("outputFullMedia").replaceChildren();
        el("outputFullPreview").classList.add("hidden");
        el("outputGrid").classList.remove("hidden");
        el("outputPagination").classList.remove("hidden");
        previewCard?.focus({preventScroll: true});
        mediaArea().scrollTop = gridScroll;
    }
    function closeSelectedPreview() {
        const origin = previewOrigin;
        previewOrigin = null;
        if (origin && (origin.folder !== folder || origin.page !== page)) {
            return load(origin.folder, origin.page, 0, origin.scroll);
        }
        if (origin) gridScroll = origin.scroll;
        closePreview();
    }
    el("closeOutputPreview").onclick = closeSelectedPreview;
    function togglePreviewOverlay() {
        if (!previewOpen()) return;
        const preview = el("outputFullPreview");
        if (preview.classList.contains("overlay-faded")) preview.classList.remove("overlay-faded");
        else preview.classList.add("overlay-faded");
    }
    el("outputFullPreview").addEventListener("keydown", event => {
        if (event.target === el("outputFullPreview") && event.key === " ") {
            event.preventDefault(); togglePreviewOverlay();
        }
    });
    function openPreview(entry, card) {
        if (!previewOpen()) {
            gridScroll = mediaArea().scrollTop;
            el("outputFullPreview").classList.remove("overlay-faded");
        }
        if (!previewOrigin) previewOrigin = {folder, page, scroll: gridScroll};
        previewCard = card;
        selected = entry;
        for (const item of el("outputGrid").querySelectorAll("[aria-pressed]")) item.setAttribute("aria-pressed", String(item === card));
        el("useOutput").disabled = false;
        const index = mediaEntries.findIndex(item => item.entry.path === entry.path);
        el("previewPosition").textContent = `${mediaOffset + index + 1} / ${totalMedia}`;
        el("previewName").textContent = entry.name;
        el("previewName").title = entry.name;
        document.querySelector(".output-page").classList.add("preview-active");
        document.querySelector(".output-media-area").classList.add("preview-open");
        const media = document.createElement(entry.video ? "video" : "img");
        media.src = `/api/poses/output-image?${new URLSearchParams({path: entry.path})}`;
        if (entry.video) { media.controls = true; media.playsInline = true; media.preload = "metadata"; }
        else {
            media.alt = entry.name;
            media.onclick = togglePreviewOverlay;
        }
        el("outputFullMedia").replaceChildren(media);
        el("outputGrid").classList.add("hidden");
        el("outputPagination").classList.add("hidden");
        el("outputFullPreview").classList.remove("hidden");
        document.querySelector(".output-media-area").scrollTop = 0;
        el("outputFullPreview").focus({preventScroll: true});
    }
    async function navigatePreview(direction) {
        if (navigating || !selected || el("outputFullPreview").classList.contains("hidden")) return;
        const index = mediaEntries.findIndex(item => item.entry.path === selected.path);
        const next = mediaEntries[index + direction];
        if (next) { openPreview(next.entry, next.card); return; }
        if ((direction < 0 && page === 0) || (direction > 0 && !hasMore)) return;
        navigating = true;
        try { await load(folder, page + direction, direction); }
        finally { navigating = false; }
    }
    // Keep vertical drags inside the expanded viewer; the shared handler owns horizontal swipes.
    el("outputFullPreview").addEventListener("touchmove", event => {
        if (!previewOpen() || event.touches.length !== 1) return;
        const target = event.target;
        if (target.tagName === "VIDEO" && target.controls
                && event.touches[0].clientY >= target.getBoundingClientRect().bottom - 64) return;
        if (event.cancelable) event.preventDefault();
    }, {passive: false});
    el("outputFullPreview").addEventListener("wheel", event => {
        if (previewOpen() && !event.ctrlKey && event.cancelable) event.preventDefault();
    }, {passive: false});
    setupHorizontalPreviewSwipe(el("outputFullMedia"), {
        getRecord: () => folder,
        getIndex: () => selected?.path,
        getCount: () => mediaEntries.length + (page > 0 || hasMore ? 1 : 0),
        previous: () => navigatePreview(-1), next: () => navigatePreview(1)
    });
    document.addEventListener("keydown", event => {
        if (el("outputOptions").open || el("outputFullPreview").classList.contains("hidden")
                || event.target.closest("button, input, select, textarea, video")) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); navigatePreview(event.key === "ArrowLeft" ? -1 : 1);
        }
    });
    el("outputOptionsButton").onclick = () => el("outputOptions").showModal();
    el("closeOutputOptions").onclick = () => el("outputOptions").close();
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || el("outputOptions").open) return;
        if (!el("outputFullPreview").classList.contains("hidden")) closeSelectedPreview();
        else send("output-cancel");
    });
    const sortChoices = [["Name", "name"], ["Created", "created"], ["Modified", "modified"]];
    const filterChoices = [["All", "all"], ["Image", "image"], ["Video", "video"]];
    function updateOptions() {
        for (const [label, value] of sortChoices) {
            const active = sortField === value;
            const button = el(`sortOutput${label}`);
            button.setAttribute("aria-pressed", String(active));
            button.setAttribute("aria-label", `${label}${active ? (sortDescending ? ", descending" : ", ascending") : ""}`);
            el(`sortOutput${label}Direction`).textContent = active ? (sortDescending ? "↓" : "↑") : "";
            button.title = active ? (sortDescending ? "Remove sort" : "Sort descending") : `Sort by ${label.toLowerCase()}`;
        }
        for (const [label, value] of filterChoices) {
            el(`filterOutput${label}`).setAttribute("aria-pressed", String(mediaFilter === value));
        }
    }
    for (const [label, value] of sortChoices) el(`sortOutput${label}`).onclick = () => {
        if (sortField !== value) {
            sortField = value;
            sortDescending = false;
        } else if (!sortDescending) {
            sortDescending = true;
        } else {
            sortField = null;
            sortDescending = false;
        }
        updateOptions();
        return load(folder, 0);
    };
    for (const [label, value] of filterChoices) el(`filterOutput${label}`).onclick = () => {
        mediaFilter = value;
        updateOptions();
        return load(folder, 0);
    };
    updateOptions();
    // Native dialog backdrop clicks target the dialog; check its bounds so
    // clicks on padding or inside controls leave the options open.
    const options = el("outputOptions");
    const outsideOptions = event => {
        if (event.target !== options) return false;
        const rect = options.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right
            || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    let backdropPress = false;
    options.addEventListener("pointerdown", event => { backdropPress = outsideOptions(event); });
    options.addEventListener("click", event => {
        if (backdropPress && outsideOptions(event)) options.close();
        backdropPress = false;
    });
    el("refreshOutput").onclick = () => load(folder, page);
    el("outputPrevious").onclick = () => load(folder, page - 1);
    el("outputNext").onclick = () => load(folder, page + 1);
    function breadcrumbs() {
        el("outputBreadcrumbs").replaceChildren();
        const parts = folder.split("/").filter(Boolean);
        ["Output", ...parts].forEach((name, index) => {
            const button = document.createElement("button"); button.type = "button"; button.textContent = name;
            button.onclick = () => {
                const target = parts.slice(0, index).join("/");
                if (target === folder && previewOpen()) { closePreview(); return; }
                if (target === folder) return;
                const saved = folderPositions.get(target);
                load(target, saved?.page || 0, 0, saved?.scroll || 0);
            };
            if (index === parts.length) button.setAttribute("aria-current", "page");
            if (index) {
                const separator = document.createElement("span");
                separator.textContent = "/";
                separator.setAttribute("aria-hidden", "true");
                el("outputBreadcrumbs").append(separator);
            }
            el("outputBreadcrumbs").append(button);
        });
    }
    function renderFolders(folders) {
        const section = el("outputFolders");
        section.hidden = !folders.length;
        section.open = folderExpansion.get(folder) || false;
        el("outputFoldersSummary").textContent = `Folders (${folders.length})`;
        el("outputFolderList").replaceChildren();
        for (const entry of folders) {
            const button = document.createElement("button");
            button.type = "button"; button.className = "output-folder-button";
            const name = document.createElement("span"); name.className = "output-folder-name"; name.textContent = entry.name;
            const count = document.createElement("span"); count.className = "output-folder-count";
            count.textContent = entry.contentCount == null ? "Contents unavailable" : `${entry.contentCount} ${entry.contentCount === 1 ? "item" : "items"}`;
            button.append(name); button.append(count);
            button.onclick = () => {
                const saved = folderPositions.get(entry.path);
                load(entry.path, saved?.page || 0, 0, saved?.scroll || 0);
            };
            el("outputFolderList").append(button);
        }
    }
    async function load(target, nextPage, previewDirection = 0, restoreScroll = 0) {
        if (mediaEntries.length || el("outputGrid").children.length || el("outputFolderList").children.length) {
            folderPositions.set(folder, {page, scroll: previewOpen() ? gridScroll : mediaArea().scrollTop});
        }
        if (!previewDirection) previewOrigin = null;
        closePreview(); previewCard = null;
        gridScroll = restoreScroll;
        const token = ++request;
        scrollRestore = restoreScroll > 0 ? {token, top: restoreScroll} : null;
        selected = null; el("useOutput").disabled = true;
        el("outputFolders").hidden = true;
        el("outputFolderList").replaceChildren();
        el("outputGrid").replaceChildren(); el("outputStatus").textContent = "Loading previews…";
        el("outputPrevious").disabled = el("outputNext").disabled = true;
        try {
            const response = await fetch(`/api/poses/output-images?${new URLSearchParams({folder: target, page: nextPage, sort: sortValue(), media: mediaFilter, timeZone: window.OutputDateGroups.timeZone})}`);
            if (!response.ok) throw new Error("Output folder unavailable. Check the server’s ComfyUI output setting and try again.");
            const listing = await response.json(); if (token !== request) return;
            folder = listing.folder; page = listing.page; hasMore = listing.hasMore; mediaEntries = []; breadcrumbs();
            totalMedia = listing.totalMedia ?? listing.entries.filter(entry => !entry.directory).length;
            mediaOffset = listing.mediaOffset ?? 0;
            renderFolders(listing.folders ?? listing.entries.filter(entry => entry.directory));
            el("outputPrevious").disabled = page === 0; el("outputNext").disabled = !listing.hasMore;
            el("outputPageNumber").textContent = `Page ${page + 1}`;
            const groups = window.OutputDateGroups.groups(listing.entries, listing.dayCounts, new Date(), sortField === "created" && !sortDescending);
            for (const group of groups) {
                const section = document.createElement("details"); section.className = "output-folders output-date-group";
                const expansionKey = `${folder}:${group.day}`;
                section.open = dateExpansion.get(expansionKey) ?? true;
                section.addEventListener("toggle", () => dateExpansion.set(expansionKey, section.open));
                const heading = document.createElement("summary"); heading.textContent = `${group.label} (${group.count})`;
                const grid = document.createElement("div"); grid.className = "comfy-output-grid double-column";
                section.append(heading); section.append(grid); el("outputGrid").append(section);
            for (const entry of group.entries) {
                const card = document.createElement("button"); card.type = "button"; card.className = "comfy-output-item";
                if (!entry.directory) {
                    card.classList.add("lora-card");
                    card.classList.add("output-media-card");
                    card.setAttribute("aria-pressed", "false");
                    const media = document.createElement(entry.video ? "video" : "img");
                    media.src = `/api/poses/output-image?${new URLSearchParams({path: entry.path, thumbnail: !entry.video, size: 1280})}`;
                    if (entry.video) { media.muted = true; media.playsInline = true; media.preload = "metadata"; }
                    else { media.alt = ""; media.loading = "lazy"; }
                    const restore = () => {
                        if (scrollRestore?.token === request && !previewOpen()) mediaArea().scrollTop = scrollRestore.top;
                    };
                    media.addEventListener(entry.video ? "loadedmetadata" : "load", restore, {once: true});
                    const frame = document.createElement("span");
                    frame.className = "output-media-frame";
                    frame.append(media);
                    card.append(frame);
                }
                const label = document.createElement("span"); label.className = "output-item-name"; label.textContent = (entry.directory ? "📁 " : entry.video ? "▶ " : "") + entry.name; card.append(label);
                card.onclick = () => {
                    if (entry.directory) {
                        const saved = folderPositions.get(entry.path);
                        load(entry.path, saved?.page || 0, 0, saved?.scroll || 0); return;
                    }
                    selected = entry;
                    for (const item of el("outputGrid").querySelectorAll("[aria-pressed]")) item.setAttribute("aria-pressed", String(item === card));
                    el("useOutput").disabled = false;
                    openPreview(entry, card);
                };
                grid.append(card);
                if (!entry.directory) mediaEntries.push({entry, card});
            }
            }
            mediaArea().scrollTop = restoreScroll;
            if (previewDirection && mediaEntries.length) {
                const item = mediaEntries[previewDirection > 0 ? 0 : mediaEntries.length - 1];
                openPreview(item.entry, item.card);
            } else if (previewDirection && ((previewDirection > 0 && hasMore) || (previewDirection < 0 && page > 0))) {
                return load(folder, page + previewDirection, previewDirection);
            }
            el("outputStatus").textContent = (listing.entries.length || listing.folders?.length) ? "" : "No matching previews in this folder. Try another filter or folder.";
        } catch (error) { if (token === request) el("outputStatus").textContent = error.message; }
    }
    load("", 0);
})();
