const API_BASE_URL = "/api/poses";
let currentPage = 0;
window.addEventListener("library-page-size-change", () => {
    if (!document.getElementById("poseList")) return;
    currentPage = 0;
    refreshCurrentView();
});
let totalPages = 0;
let appliedSortBy = null;
let appliedSortDirection = null;
let category = "ALL";
let favorites = "ALL";
let currentPose = null;
let previews = [];
let previewIndex = 0;
let poseDetailsSwipe = null;
let posePreviewSwipe = null;
let poseToDelete = null;
let deletingPose = false;
let retainedImages = [];
let selectedPoseFiles = [];
let editImageIndex = 0;
let searchTimer;
let requestVersion = 0;
const byId = id => document.getElementById(id);
const gallerySort = document.getElementById("poseList") ? createGallerySort({
    getState: () => ({field: appliedSortBy, direction: appliedSortDirection}),
    apply: applySort,
    reset: resetSort,
    label: "Sort poses"
}) : null;

async function api(path = "", options) {
    const response = await fetch(API_BASE_URL + path, options);
    if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
}
function showModal(id, open) {
    const modal = byId(id);
    if (id === "poseDetailsModal") {
        poseDetailsSwipe?.reset();
        posePreviewSwipe?.reset();
        closePoseDetailsActions();
        if (!open) {
            modal.querySelectorAll("video").forEach(video => { video.pause(); video.currentTime = 0; });
            currentPose = null;
            previews = [];
            previewIndex = 0;
        }
    }
    if (!open && modal.contains(document.activeElement)) document.activeElement.blur();
    modal.inert = !open;
    modal.classList.toggle("hidden", !open);
    modal.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = document.querySelector('.modal-overlay:not(.hidden), .filter-modal:not(.hidden)') ? "hidden" : "";
}
function message(id, text) {
    byId(id).textContent = text;
    byId(id).classList.toggle("hidden", !text);
}
function poseImages(pose) {
    return pose.images?.length ? pose.images : (pose.filePath ? [pose.filePath] : []);
}
async function refreshCurrentView() {
    const version = ++requestVersion;
    const params = new URLSearchParams({page: currentPage, size: window.LibrarySettings?.pageSize ?? 12});
    const keyword = byId("searchInput").value.trim();
    if (keyword) params.set("keyword", keyword);
    if (category !== "ALL") params.set("category", category);
    if (favorites === "true") params.set("favorite", "true");
    if (appliedSortBy) {
        params.set("sortBy", appliedSortBy);
        params.set("sortDirection", appliedSortDirection);
    }
    try {
        const page = await api(`?${params}`);
        if (version !== requestVersion) return;
        if (!Array.isArray(page.content)) throw new Error("Invalid pose page response");
        totalPages = page.totalPages;
        currentPage = page.number;
        const list = byId("poseList");
        list.replaceChildren();
        page.content.forEach(pose => list.appendChild(createPoseCard(pose)));
        if (!page.content.length) list.textContent = "No poses found.";
        byId("paginationControls").classList.toggle("hidden", totalPages <= 1);
        byId("previousPageButton").disabled = currentPage <= 0;
        byId("nextPageButton").disabled = currentPage >= totalPages - 1;
        if (window.GalleryPagination) {
            window.GalleryPagination.render(byId("pageIndicator"), currentPage, Math.max(1, totalPages), async page => {
                currentPage = page;
                await refreshCurrentView();
                window.scrollTo({top: 0, behavior: "smooth"});
            });
        } else byId("pageIndicator").textContent = `Page ${currentPage + 1} of ${Math.max(1, totalPages)}`;
    } catch (error) {
        if (version === requestVersion) byId("poseList").textContent = `Unable to load poses: ${error.message}`;
    }
}
function createPoseCard(pose) {
    const card = document.createElement("article");
    card.className = "lora-card";
    card.dataset.poseId = String(pose.id);
    const image = poseImages(pose)[0];
    if (image) {
        const img = createPosePreview(image);
        img.className = "lora-card-image";
        img.alt = pose.name || "Pose preview";
        img.loading = "lazy";
        card.appendChild(img);
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "lora-card-placeholder";
        placeholder.textContent = "No Image";
        card.appendChild(placeholder);
    }
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-button";
    favorite.textContent = pose.favorite ? "★" : "☆";
    favorite.setAttribute("aria-label", "Toggle favorite");
    favorite.addEventListener("click", async event => {
        event.stopPropagation();
        try { await togglePoseFavorite(pose.id); }
        catch (error) { window.alert(error.message); }
    });
    const header = document.createElement("div");
    header.className = "lora-card-header";
    const meta = document.createElement("p");
    meta.className = "lora-meta";
    meta.textContent = pose.category || "Uncategorized";
    const title = document.createElement("h2");
    title.textContent = pose.name || "Untitled Pose";
    header.append(meta, title);
    card.append(favorite, header);
    card.addEventListener("click", () => openPoseDetails(pose.id));
    return card;
}
function updatePoseFilterButtons() {
    const count = Number(category !== "ALL");
    byId("filterCountBadge").textContent = count;
    byId("filterCountBadge").classList.toggle("hidden", !count);
    byId("filterButton").classList.toggle("active", count > 0);
    const active = favorites === "true";
    byId("favoritesToggleButton").classList.toggle("active", active);
    byId("favoritesToggleButton").setAttribute("aria-pressed", String(active));
    byId("favoritesToggleButton").title = active ? "Turn off Favorites filter" : "Show favorites only";
    byId("favoritesToggleIcon").textContent = active ? "★" : "☆";
}

async function applySort(field) {
    if (!["name", "category", "seed"].includes(field)) return;
    appliedSortDirection = appliedSortBy === field && appliedSortDirection === "asc" ? "desc" : "asc";
    appliedSortBy = field;
    currentPage = 0;
    gallerySort.update();
    gallerySort.close();
    await refreshCurrentView();
}
async function resetSort() {
    appliedSortBy = null;
    appliedSortDirection = null;
    currentPage = 0;
    gallerySort.update();
    gallerySort.close();
    await refreshCurrentView();
}
async function openPoseDetails(id) {
    try {
        currentPose = await api(`/${id}`);
        for (const [element, field] of Object.entries({detailsPoseName: "name", detailsCategory: "category", detailsSeed: "seed", detailsBaseModel: "baseModel", detailsLora: "lora", detailsPrompt: "prompt", detailsNotes: "notes"})) {
            byId(element).textContent = currentPose[field] ?? "Not provided";
        }
        previews = poseImages(currentPose);
        previewIndex = 0;
        renderPreview();
        showModal("poseDetailsModal", true);
        sizePosePreviewLikeGalleryCard();
        const modal = byId("poseDetailsModal");
        const scrollArea = modal.querySelector(".lora-details-scroll-area");
        const openedPose = currentPose;
        const resetScroll = () => {
            modal.scrollTop = 0;
            if (scrollArea) scrollArea.scrollTop = 0;
        };
        // A hidden scroll container may ignore scrollTop; reset after it is visible and sized.
        resetScroll();
        window.requestAnimationFrame(() => {
            if (currentPose === openedPose && !modal.classList.contains("hidden")) resetScroll();
        });
    } catch (error) { window.alert(error.message); }
}
function sizePosePreviewLikeGalleryCard() {
    const modal = byId("poseDetailsModal");
    if (!modal) return;
    // Modal dimensions always follow the single-column gallery, regardless of tile layout.
    const list = byId("poseList");
    const padding = list ? getComputedStyle(list) : null;
    const width = (list?.clientWidth ?? 0)
            - (parseFloat(padding?.paddingLeft) || 0) - (parseFloat(padding?.paddingRight) || 0);
    modal.style.setProperty("--preview-card-ratio", String(3 / 4));
    modal.style.setProperty("--preview-card-width", width > 0 ? `${width}px` : "100%");
    const scrollArea = modal.querySelector(".lora-details-scroll-area");
    const scrollbarWidth = Math.max(0, (scrollArea?.offsetWidth ?? 0) - (scrollArea?.clientWidth ?? 0));
    modal.style.setProperty("--preview-scrollbar-width", `${scrollbarWidth}px`);
}
function updatePoseDetailsFavorite() {
    const favorite = Boolean(currentPose?.favorite);
    byId("favoritePoseDetailsButton")?.setAttribute("aria-checked", String(favorite));
    if (byId("favoritePoseDetailsLabel")) byId("favoritePoseDetailsLabel").textContent = favorite ? "Unfavorite" : "Favorite";
    if (byId("favoritePoseDetailsIcon")) byId("favoritePoseDetailsIcon").textContent = favorite ? "★" : "☆";
}
async function togglePoseFavorite(id) {
    const updated = await api(`/${id}/favorite`, {method: "PATCH"});
    if (String(currentPose?.id) === String(id)) {
        currentPose.favorite = Boolean(updated.favorite);
        updatePoseDetailsFavorite();
    }
    await refreshCurrentView();
    return updated;
}
function closePoseDetailsActions(focus = false) {
    const menu = byId("poseDetailsActionsMenu");
    if (menu) menu.hidden = true;
    byId("poseDetailsActionsButton")?.setAttribute("aria-expanded", "false");
    if (focus) byId("poseDetailsActionsButton")?.focus();
}
function setupPoseDetailsActions() {
    const wrapper = byId("poseDetailsMoreActions"), menu = byId("poseDetailsActionsMenu");
    const button = byId("poseDetailsActionsButton"), favorite = byId("favoritePoseDetailsButton");
    const items = [favorite, byId("editPoseButton"), byId("deletePoseButton")];
    function open() {
        updatePoseDetailsFavorite(); menu.hidden = false;
        button.setAttribute("aria-expanded", "true"); favorite.focus();
    }
    button.addEventListener("click", () => menu.hidden ? open() : closePoseDetailsActions(true));
    button.addEventListener("keydown", event => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault(); open();
            if (event.key === "ArrowUp") items[2].focus();
        }
    });
    favorite.addEventListener("click", async () => {
        if (!currentPose?.id || favorite.disabled) return;
        const id = currentPose.id; favorite.disabled = true;
        try {
            await togglePoseFavorite(id);
            if (String(currentPose?.id) === String(id)) closePoseDetailsActions(true);
        } catch (error) { window.alert(`Unable to update favorite: ${error.message}`); }
        finally { favorite.disabled = false; }
    });
    menu.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation(); closePoseDetailsActions(true);
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const available = items.filter(item => !item.disabled);
            const current = available.indexOf(document.activeElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1
                : (current + (event.key === "ArrowUp" ? -1 : 1) + available.length) % available.length;
            available[next]?.focus();
        }
    });
    wrapper.addEventListener("focusout", event => {
        if (event.relatedTarget && !wrapper.contains(event.relatedTarget)) closePoseDetailsActions();
    });
    document.addEventListener("click", event => { if (!wrapper.contains(event.target)) closePoseDetailsActions(); });
}

function openDeletePoseDialog() {
    if (!currentPose || deletingPose) return;
    closePoseDetailsActions();
    poseToDelete = {id: currentPose.id, name: currentPose.name};
    byId("deletePosePrompt").textContent = `Are you sure you want to delete "${poseToDelete.name || "this pose"}"? This cannot be undone.`;
    message("deletePoseError", "");
    byId("deletePoseDialog").showModal();
    byId("cancelDeletePoseButton").focus();
}
function cancelDeletePose() {
    if (deletingPose) return;
    byId("deletePoseDialog").close();
    poseToDelete = null;
    byId("poseDetailsActionsButton").focus();
}
async function confirmDeletePose() {
    if (!poseToDelete || deletingPose) return;
    deletingPose = true;
    const button = byId("confirmDeletePoseButton");
    button.disabled = true;
    button.textContent = "Deleting...";
    byId("cancelDeletePoseButton").disabled = true;
    message("deletePoseError", "");
    try {
        await api(`/${poseToDelete.id}`, {method: "DELETE"});
    } catch (error) {
        message("deletePoseError", `Unable to delete pose: ${error.message}`);
        return;
    } finally {
        deletingPose = false;
        button.disabled = false;
        button.textContent = "Delete";
        byId("cancelDeletePoseButton").disabled = false;
    }
    byId("deletePoseDialog").close();
    poseToDelete = null;
    showModal("poseDetailsModal", false);
    if (currentPage > 0 && byId("poseList").children.length <= 1) currentPage--;
    try {
        await loadCategories();
        await refreshCurrentView();
    } catch (error) { window.alert(`Pose deleted. Unable to refresh the gallery: ${error.message}`); }
    byId("openActionMenuButton").focus();
}

function createPosePreview(path, thumbnail = false) {
    const video = /\.(mp4|webm|ogg|mov)(?:[?#]|$)/i.test(path);
    const media = document.createElement(video ? "video" : "img");
    if (video) {
        media.muted = true;
        media.playsInline = true;
        media.preload = "metadata";
        media.controls = !thumbnail;
        media.loop = !thumbnail;
    } else media.loading = "lazy";
    addPreviewCacheFallback(media, path);
    media.src = localPreviewUrl(path);
    return media;
}
function changePosePreview(direction) {
    if (previews.length < 2) return;
    previewIndex = (previewIndex + direction + previews.length) % previews.length;
    renderPreview();
}
function renderPreview() {
    const container = byId("detailsImageContainer");
    container.querySelectorAll("video").forEach(video => video.pause());
    container.replaceChildren();
    if (previews.length) {
        const media = createPosePreview(previews[previewIndex]);
        media.alt = currentPose.name || "Pose preview";
        media.className = "details-image";
        container.appendChild(media);
    } else container.textContent = "No Image";
    for (const id of ["previousPreviewButton", "nextPreviewButton", "previewIndicators"]) byId(id).classList.toggle("hidden", previews.length <= 1);
    const indicators = byId("previewIndicators");
    const signature = JSON.stringify(previews);
    if (indicators.dataset.paths !== signature) {
        indicators.dataset.paths = signature;
        indicators.replaceChildren();
        previews.forEach((path, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "preview-indicator-button";
            button.setAttribute("aria-label", `Preview ${index + 1}`);
            button.title = `Show preview ${index + 1}`;
            const thumbnail = createPosePreview(path, true);
            thumbnail.alt = "";
            thumbnail.setAttribute("aria-hidden", "true");
            button.appendChild(thumbnail);
            button.addEventListener("click", () => { previewIndex = index; renderPreview(); });
            indicators.appendChild(button);
        });
    }
    [...(indicators.children || [])].forEach((button, index) => {
        button.classList.toggle("active", index === previewIndex);
        button.setAttribute("aria-pressed", String(index === previewIndex));
    });
    byId("previewStatus").textContent = previews.length ? `Preview ${previewIndex + 1} of ${previews.length}` : "No previews";
}
async function refreshPoseLibrary() {
    const button = byId("refreshPosesButton");
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    byId("refreshPosesLabel").textContent = "Refreshing...";
    try {
        await loadCategories();
        await refreshCurrentView();
        closeActions();
        byId("openActionMenuButton").focus();
    } catch (error) {
        window.alert(`Unable to refresh the gallery: ${error.message}`);
    } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        byId("refreshPosesLabel").textContent = "Refresh";
    }
}

function openPoseForm(pose = null) {
    pendingOutputImage = "";
    byId("poseForm").reset();
    message("poseFormMessage", "");
    byId("poseFormTitle").textContent = pose ? "Edit Pose" : "Add Pose";
    for (const field of ["id", "name", "category", "baseModel", "seed", "lora", "prompt", "notes"]) {
        byId(`pose${field[0].toUpperCase() + field.slice(1)}Input`).value = pose?.[field] ?? "";
    }
    retainedImages = pose ? [...poseImages(pose)] : [];
    selectedPoseFiles = [];
    selectedImageUrls.forEach(url => URL.revokeObjectURL(url));
    selectedImageUrls = [];
    editImageIndex = 0;
    byId("poseSelectedImages").textContent = "";
    renderExistingImages();
    if (byId("poseFormModal")) showModal("poseFormModal", true);
    byId("poseNameInput").focus();
}
function renderExistingImages() {
    updatePoseImagePreview();
    const container = byId("poseExistingImages");
    if (window.location.pathname.endsWith("/edit-pose.html")) { container.replaceChildren(); return; }
    container.replaceChildren();
    retainedImages.forEach((path, index) => {
        const row = document.createElement("div");
        const img = document.createElement("img");
        img.src = path;
        img.alt = `Existing image ${index + 1}`;
        img.className = "pose-form-thumbnail";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove image";
        remove.className = "details-cancel-button";
        remove.addEventListener("click", () => { retainedImages.splice(index, 1); renderExistingImages(); });
        row.append(img, remove);
        container.appendChild(row);
    });
}
async function loadCategories() {
    const values = await api("/categories");
    const select = byId("categoryFilter");
    select?.replaceChildren(new Option("All Categories", "ALL"));
    byId("poseCategorySuggestions").replaceChildren();
    values.forEach(value => {
        select?.add(new Option(value, value));
        const option = document.createElement("option");
        option.value = value;
        byId("poseCategorySuggestions").appendChild(option);
    });
    if (select) select.value = category;
}
function closeActions() {
    byId("actionMenuOverlay").classList.add("hidden");
    byId("openActionMenuButton").setAttribute("aria-expanded", "false");
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!byId("poseList")) {
        await setupPosePage();
        return;
    }
    gallerySort.setup();
    const detailsModal = byId("poseDetailsModal");
    poseDetailsSwipe = setupSwipeDownToClose(detailsModal.querySelector(".lora-details-sheet"),
        detailsModal.querySelector(".lora-details-scroll-area"), () => showModal("poseDetailsModal", false), {handleWhileScrolled: true, allowVideoSwipe: true});
    const on = (id, action, event = "click") => byId(id).addEventListener(event, action);
    posePreviewSwipe = setupHorizontalPreviewSwipe(byId("detailsImageContainer"), {
        getRecord: () => currentPose, getIndex: () => previewIndex, getCount: () => previews.length,
        previous: () => changePosePreview(-1), next: () => changePosePreview(1)
    });
    byId("poseDetailsModal").querySelector(".details-carousel")?.addEventListener("keydown", event => {
        if (event.target.tagName === "VIDEO" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        changePosePreview(event.key === "ArrowLeft" ? -1 : 1);
    });
    on("refreshPosesButton", refreshPoseLibrary);
    setupPoseDetailsActions();
    on("deletePoseButton", openDeletePoseDialog);
    on("cancelDeletePoseButton", cancelDeletePose);
    on("confirmDeletePoseButton", confirmDeletePose);
    on("deletePoseDialog", event => {
        const dialog = byId("deletePoseDialog");
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
                || event.clientY < bounds.top || event.clientY > bounds.bottom) cancelDeletePose();
    });
    on("deletePoseDialog", event => {
        event.preventDefault();
        cancelDeletePose();
    }, "cancel");
    on("backupMenuButton", () => {
        const expanded = byId("backupOptions").classList.contains("hidden");
        byId("backupOptions").classList.toggle("hidden", !expanded);
        byId("backupMenuButton").setAttribute("aria-expanded", String(expanded));
    });
    const refreshFromStart = () => { currentPage = 0; return refreshCurrentView(); };
    on("searchInput", () => { clearTimeout(searchTimer); searchTimer = setTimeout(refreshFromStart, 400); }, "input");
    on("searchIconButton", () => { byId("searchOverlay").classList.remove("hidden"); byId("searchInput").focus(); });
    on("closeSearchButton", () => { clearTimeout(searchTimer); byId("searchOverlay").classList.add("hidden"); byId("searchInput").value = ""; refreshFromStart(); });
    on("previousPageButton", () => { if (currentPage > 0) { currentPage--; refreshCurrentView(); } });
    on("nextPageButton", () => { if (currentPage + 1 < totalPages) { currentPage++; refreshCurrentView(); } });
    function setLayout(doubleColumn) {
        byId("poseList").classList.toggle("single-column", !doubleColumn);
        byId("poseList").classList.toggle("double-column", doubleColumn);
        byId("doubleColumnButton").classList.toggle("active", doubleColumn);
        byId("doubleColumnButton").setAttribute("aria-pressed", String(doubleColumn));
        byId("doubleColumnButton").title = doubleColumn ? "Switch to single-column layout" : "Switch to double-column layout";
    }
    setLayout(false);
    on("doubleColumnButton", () => setLayout(!byId("poseList").classList.contains("double-column")));
    on("favoritesToggleButton", async () => {
        const button = byId("favoritesToggleButton");
        if (button.disabled) return;
        button.disabled = true;
        favorites = favorites === "true" ? "ALL" : "true";
        byId("favoriteFilter").value = favorites;
        currentPage = 0;
        updatePoseFilterButtons();
        try { await refreshCurrentView(); }
        finally { button.disabled = false; }
    });
    function menu(open) {
        for (const id of ["sideMenu", "menuBackdrop"]) byId(id).classList.toggle("hidden", !open);
        byId("optionsButton").setAttribute("aria-expanded", String(open));
    }
    on("optionsButton", () => menu(true));
    on("closeMenuButton", () => menu(false));
    on("menuBackdrop", () => menu(false));
    on("openActionMenuButton", () => {
        byId("actionMenuOverlay").classList.toggle("hidden");
        byId("openActionMenuButton").setAttribute("aria-expanded", String(!byId("actionMenuOverlay").classList.contains("hidden")));
    });
    on("actionMenuOverlay", event => { if (event.target === byId("actionMenuOverlay")) closeActions(); });
    on("addPoseActionButton", () => FormNavigation.go("/html/add-pose.html"));
    on("editPoseButton", () => { closePoseDetailsActions(); if (currentPose) FormNavigation.go(`/html/edit-pose.html?id=${currentPose.id}`); });
    for (const id of ["closePoseFormButton", "cancelPoseFormButton", "poseFormBackdrop"]) on(id, () => showModal("poseFormModal", false));
    on("closePoseDetailsButton", () => showModal("poseDetailsModal", false));
    on("poseDetailsModal", event => { if (event.target === byId("poseDetailsModal")) showModal("poseDetailsModal", false); });
    on("previousPreviewButton", () => changePosePreview(-1));
    on("nextPreviewButton", () => changePosePreview(1));
    on("poseImagesInput", () => { byId("poseSelectedImages").textContent = Array.from(byId("poseImagesInput").files, file => file.name).join(", "); }, "change");
    setupPoseSubmission();
    on("filterButton", () => { byId("categoryFilter").value = category; byId("favoriteFilter").value = favorites; showModal("filterModal", true); byId("filterButton").setAttribute("aria-expanded", "true"); });
    function closeFilter() { showModal("filterModal", false); byId("filterButton").setAttribute("aria-expanded", "false"); }
    for (const id of ["closeFilterButton", "filterModalBackdrop"]) on(id, closeFilter);
    function applyFilters() {
        category = byId("categoryFilter").value;
        favorites = byId("favoriteFilter").value;
        updatePoseFilterButtons();
        closeFilter();
        refreshFromStart();
    }
    on("applyFilterButton", applyFilters);
    on("resetFilterButton", () => { byId("categoryFilter").value = "ALL"; byId("favoriteFilter").value = "ALL"; applyFilters(); });
    on("exportBackupButton", async () => {
        closeActions();
        try {
            const response = await fetch(API_BASE_URL + "/backup/export");
            if (!response.ok) throw new Error((await response.text()) || "Backup export failed");
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a"); link.href = url; link.download = "poses-backup.json"; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { window.alert(error.message); }
    });
    on("importBackupButton", () => { closeActions(); byId("backupFileInput").click(); });
    on("backupFileInput", async () => {
        const file = byId("backupFileInput").files[0];
        if (!file) return;
        try {
            await api("/backup/import", {method: "POST", headers: {"Content-Type": "application/json"}, body: file});
            await loadCategories(); await refreshFromStart();
        } catch (error) { window.alert(`Unable to import poses: ${error.message}`); }
        finally { byId("backupFileInput").value = ""; }
    }, "change");
    document.addEventListener("click", async event => {
        const copy = event.target.closest("[data-copy-target]");
        if (copy) {
            const label = copy.getAttribute("aria-label");
            const title = copy.title;
            copy.disabled = true;
            let message;
            try { await navigator.clipboard.writeText(byId(copy.dataset.copyTarget).textContent); message = "Copied"; }
            catch { message = "Copy failed"; }
            copy.textContent = message === "Copied" ? "✓" : "!";
            copy.setAttribute("aria-label", message);
            copy.title = message;
            setTimeout(() => {
                copy.textContent = "⧉";
                copy.setAttribute("aria-label", label);
                copy.title = title;
                copy.disabled = false;
            }, 1500);
        }
        const expand = event.target.closest("[data-expand-target]");
        if (expand) {
            byId("expandedTextTitle").textContent = expand.dataset.expandTitle;
            byId("expandedTextContent").textContent = byId(expand.dataset.expandTarget).textContent;
            showModal("expandedTextModal", true);
        }
    });
    on("closeExpandedTextButton", () => showModal("expandedTextModal", false));
    on("expandedTextModal", event => { if (event.target === byId("expandedTextModal")) showModal("expandedTextModal", false); });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (byId("deletePoseDialog").open) return;
        for (const id of ["expandedTextModal", "poseFormModal", "poseDetailsModal", "filterModal"]) {
            if (!byId(id).classList.contains("hidden")) { showModal(id, false); break; }
        }
        closeActions(); menu(false);
    });
    on("goTopButton", () => window.scrollTo({top: 0, behavior: "smooth"}));
    window.addEventListener("scroll", () => byId("goTopButton").classList.toggle("hidden", window.scrollY < 300), {passive: true});
    window.addEventListener("resize", () => {
        if (currentPose) sizePosePreviewLikeGalleryCard();
    });
    const saved = FormNavigation.restoreState();
    if (saved) {
        currentPage = Number.isInteger(saved.page) && saved.page >= 0 ? saved.page : 0;
        appliedSortBy = ["name", "category", "seed"].includes(saved.sortBy) ? saved.sortBy : null;
        appliedSortDirection = saved.sortDirection === "desc" ? "desc" : "asc";
        category = saved.category || "ALL";
        favorites = saved.favorites === "true" ? "true" : "ALL";
        byId("searchInput").value = saved.search || "";
        if (saved.search) byId("searchOverlay").classList.remove("hidden");
        if (saved.doubleColumn) byId("doubleColumnButton").click();
        updatePoseFilterButtons();
        gallerySort.update();
    }
    updatePoseFilterButtons();
    FormNavigation.register(() => ({page: currentPage, sortBy: appliedSortBy, sortDirection: appliedSortDirection,
        category, favorites, search: byId("searchInput").value, doubleColumn: byId("poseList").classList.contains("double-column")}));
    await refreshCurrentView();
    if (saved) window.scrollTo(0, saved.scrollY || 0);
    try { await loadCategories(); } catch (error) { console.error("Unable to load pose categories", error); }
});

function setupPoseSubmission() {
    byId("poseForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (!byId("poseForm").reportValidity()) return;
        const data = new FormData(byId("poseForm"));
        if (pendingOutputImage) data.set("outputImage", pendingOutputImage);
        data.set("retainedImages", JSON.stringify(retainedImages));
        if (window.location.pathname.endsWith("/edit-pose.html")) {
            data.delete("images");
            selectedPoseFiles.forEach(file => data.append("images", file));
        }
        const id = byId("poseIdInput").value;
        byId("savePoseButton").disabled = true;
        try {
            const saved = await api(id ? `/${id}` : "", {method: id ? "PUT" : "POST", body: data});
            if (!byId("poseList")) { FormNavigation.finish(); return; }
            showModal("poseFormModal", false);
            if (id && !byId("poseDetailsModal").classList.contains("hidden")) await openPoseDetails(saved.id);
            await loadCategories();
            await refreshCurrentView();
        } catch (error) { message("poseFormMessage", error.message); }
        finally { byId("savePoseButton").disabled = false; }
    });
}

async function setupPosePage() {
    const editing = window.location.pathname.endsWith("/edit-pose.html");
    const id = new URLSearchParams(window.location.search).get("id");
    for (const button of ["closePoseFormButton", "cancelPoseFormButton"]) byId(button).addEventListener("click", () => FormNavigation.finish());
    function menu(open) {
        byId("sideMenu").classList.toggle("hidden", !open);
        byId("sideMenu").setAttribute("aria-hidden", String(!open));
        byId("menuBackdrop").classList.toggle("hidden", !open);
        byId("optionsButton").setAttribute("aria-expanded", String(open));
    }
    byId("optionsButton").addEventListener("click", () => menu(true));
    byId("closeMenuButton").addEventListener("click", () => menu(false));
    byId("menuBackdrop").addEventListener("click", () => menu(false));
    byId("poseImagesInput").addEventListener("change", renderSelectedImages);
    setupPoseImagePicker();
    setupPoseSubmission();
    // Disable saving until the existing record has loaded, including invalid/missing IDs.
    byId("savePoseButton").disabled = true;
    try {
        if (editing && (!/^[1-9]\d*$/.test(id || ""))) throw new Error("A valid pose ID is required.");
        openPoseForm(editing ? await api(`/${id}`) : null);
        byId("savePoseButton").disabled = false;
    } catch (error) { message("poseFormMessage", error.message); }
    try { await loadCategories(); } catch (error) { console.error("Unable to load categories", error); }
}
let selectedImageUrls = [];
let pendingOutputImage = "";
function renderSelectedImages() {
    if (byId("poseImagesInput").files.length) pendingOutputImage = "";
    selectedImageUrls.forEach(url => URL.revokeObjectURL(url));
    selectedImageUrls = [];
    const container = byId("poseSelectedImages");
    container.replaceChildren();
    selectedPoseFiles = Array.from(byId("poseImagesInput").files);
    editImageIndex = 0;
    selectedPoseFiles.forEach(file => {
        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        selectedImageUrls.push(url);
        img.src = url;
        img.alt = file.name;
        img.className = "pose-form-thumbnail";
        container.appendChild(img);
    });
    updatePoseImagePreview();
}

function updatePoseImagePreview() {
    const container = byId("poseImagePreviewContainer");
    if (!container) return;
    container.querySelectorAll("video").forEach(video => video.pause());
    container.replaceChildren();
    const editing = window.location.pathname.endsWith("/edit-pose.html");
    const images = editing ? [...retainedImages, ...selectedImageUrls] : [...selectedImageUrls, ...retainedImages];
    if (pendingOutputImage) images.unshift(`/api/poses/output-image?path=${encodeURIComponent(pendingOutputImage)}`);
    editImageIndex = Math.min(editImageIndex, Math.max(0, images.length - 1));
    const path = images[editImageIndex];
    if (path) {
        const video = /\.(mp4|webm|mov|ogg)(?:[?#]|$)/i.test(path);
        const image = document.createElement(video ? "video" : "img");
        if (video) {
            image.muted = true; image.loop = true; image.playsInline = true;
            image.autoplay = true; image.preload = "metadata";
        } else image.alt = `Pose preview ${editImageIndex + 1}; choose from ComfyUI`;
        image.src = path;
        container.appendChild(image);
        if (editing) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-preview-image-button";
            remove.setAttribute("aria-label", "Remove displayed preview image");
            remove.textContent = "×";
            remove.addEventListener("click", event => {
                event.preventDefault(); event.stopPropagation();
                const savedIndex = editImageIndex - (pendingOutputImage ? 1 : 0);
                if (pendingOutputImage && editImageIndex === 0) pendingOutputImage = "";
                else if (savedIndex < retainedImages.length) retainedImages.splice(savedIndex, 1);
                else {
                    const index = savedIndex - retainedImages.length;
                    selectedPoseFiles.splice(index, 1);
                    URL.revokeObjectURL(selectedImageUrls[index]);
                    selectedImageUrls.splice(index, 1);
                }
                updatePoseImagePreview();
            });
            container.appendChild(remove);
            if (images.length > 1) {
                const navigation = document.createElement("div");
                navigation.className = "pose-edit-image-nav";
                for (const [label, delta] of [["Previous image", -1], ["Next image", 1]]) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "icon-button";
                    button.setAttribute("aria-label", label);
                    button.textContent = delta < 0 ? "‹" : "›";
                    button.addEventListener("click", event => {
                        event.preventDefault(); event.stopPropagation();
                        editImageIndex = (editImageIndex + delta + images.length) % images.length;
                        updatePoseImagePreview();
                    });
                    navigation.appendChild(button);
                }
                container.appendChild(navigation);
            }
        }
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "lora-card-placeholder";
        placeholder.textContent = "Tap to choose from ComfyUI";
        container.appendChild(placeholder);
    }
}

window.addEventListener("pageshow", event => {
    if (event.persisted && byId("poseList")) refreshCurrentView();
});


function setupPoseImagePicker() {
    const picker = byId("poseImagePicker");
    if (!picker) return;
    const preview = byId("poseImagePreviewContainer"), frame = byId("outputPageFrame");
    const close = () => { picker.close(); preview.focus(); };
    const open = event => {
        if (event.target.closest("button")) return;
        event.preventDefault();
        if (!frame.getAttribute("src")) frame.src = "/html/output.html";
        picker.showModal(); frame.focus();
    };
    preview.addEventListener("click", open);
    preview.addEventListener("keydown", event => {
        if (event.target === preview && ["Enter", " "].includes(event.key)) open(event);
    });
    picker.addEventListener("cancel", event => { event.preventDefault(); close(); });
    window.addEventListener("message", event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || !picker.open) return;
        if (event.data?.type === "output-cancel") close();
        if (event.data?.type === "output-select" && typeof event.data.path === "string" && event.data.path) {
            pendingOutputImage = event.data.path; editImageIndex = 0;
            updatePoseImagePreview(); close();
        }
    });
}
