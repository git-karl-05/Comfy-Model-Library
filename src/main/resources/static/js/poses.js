const API_BASE_URL = "/api/poses";
let currentPage = 0;
let totalPages = 0;
let appliedSortBy = null;
let appliedSortDirection = null;
let category = "ALL";
let favorites = "ALL";
let currentPose = null;
let previews = [];
let previewIndex = 0;
let poseDetailsSwipe = null;
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
    const params = new URLSearchParams({page: currentPage, size: 12});
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
        byId("pageIndicator").textContent = `Page ${currentPage + 1} of ${Math.max(1, totalPages)}`;
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
        const img = document.createElement("img");
        img.className = "lora-card-image";
        img.src = image;
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
        try { await api(`/${pose.id}/favorite`, {method: "PATCH"}); await refreshCurrentView(); }
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
        byId("poseDetailsModal").querySelector(".lora-details-scroll-area").scrollTop = 0;
        showModal("poseDetailsModal", true);
        sizePosePreviewLikeGalleryCard();
    } catch (error) { window.alert(error.message); }
}
function sizePosePreviewLikeGalleryCard() {
    const modal = byId("poseDetailsModal");
    if (!modal) return;
    const cards = document.querySelectorAll("#poseList .lora-card");
    const card = [...cards].find(item => item.dataset.poseId === String(currentPose?.id)) ?? cards[0];
    const bounds = card?.getBoundingClientRect();
    const doubleColumn = byId("poseList")?.classList.contains("double-column");
    const ratio = bounds?.width > 0 && bounds?.height > 0
            ? bounds.width / bounds.height : doubleColumn ? 4 / 5 : 3 / 4;
    modal.style.setProperty("--preview-card-ratio", String(ratio));
    modal.style.setProperty("--preview-card-width", bounds?.width > 0 ? `${bounds.width}px` : "100%");
    const scrollArea = modal.querySelector(".lora-details-scroll-area");
    const scrollbarWidth = Math.max(0, (scrollArea?.offsetWidth ?? 0) - (scrollArea?.clientWidth ?? 0));
    modal.style.setProperty("--preview-scrollbar-width", `${scrollbarWidth}px`);
}
function renderPreview() {
    const container = byId("detailsImageContainer");
    container.replaceChildren();
    if (previews.length) {
        const img = document.createElement("img");
        img.src = previews[previewIndex];
        img.alt = currentPose.name || "Pose preview";
        img.className = "details-image";
        container.appendChild(img);
    } else container.textContent = "No Image";
    for (const id of ["previousPreviewButton", "nextPreviewButton", "previewIndicators"]) byId(id).classList.toggle("hidden", previews.length <= 1);
    const indicators = byId("previewIndicators");
    indicators.replaceChildren();
    previews.forEach((_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preview-indicator-button" + (index === previewIndex ? " active" : "");
        button.setAttribute("aria-label", `Image ${index + 1}`);
        button.addEventListener("click", () => { previewIndex = index; renderPreview(); });
        indicators.appendChild(button);
    });
}
function openPoseForm(pose = null) {
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
function closeActions() { byId("actionMenuOverlay").classList.add("hidden"); }

document.addEventListener("DOMContentLoaded", async () => {
    if (!byId("poseList")) {
        await setupPosePage();
        return;
    }
    gallerySort.setup();
    const detailsModal = byId("poseDetailsModal");
    poseDetailsSwipe = setupSwipeDownToClose(detailsModal.querySelector(".lora-details-sheet"),
        detailsModal.querySelector(".lora-details-scroll-area"), () => showModal("poseDetailsModal", false), {handleWhileScrolled: true});
    const on = (id, action, event = "click") => byId(id).addEventListener(event, action);
    const refreshFromStart = () => { currentPage = 0; return refreshCurrentView(); };
    on("searchInput", () => { clearTimeout(searchTimer); searchTimer = setTimeout(refreshFromStart, 400); }, "input");
    on("searchIconButton", () => { byId("searchOverlay").classList.remove("hidden"); byId("searchInput").focus(); });
    on("closeSearchButton", () => { clearTimeout(searchTimer); byId("searchOverlay").classList.add("hidden"); byId("searchInput").value = ""; refreshFromStart(); });
    on("previousPageButton", () => { if (currentPage > 0) { currentPage--; refreshCurrentView(); } });
    on("nextPageButton", () => { if (currentPage + 1 < totalPages) { currentPage++; refreshCurrentView(); } });
    for (const [id, layout] of [["singleColumnButton", "single-column"], ["doubleColumnButton", "double-column"]]) {
        on(id, () => {
            byId("poseList").classList.remove("single-column", "double-column");
            byId("poseList").classList.add(layout);
            for (const button of ["singleColumnButton", "doubleColumnButton"]) byId(button).classList.toggle("active", button === id);
        });
    }
    function menu(open) {
        for (const id of ["sideMenu", "menuBackdrop"]) byId(id).classList.toggle("hidden", !open);
        byId("optionsButton").setAttribute("aria-expanded", String(open));
    }
    on("optionsButton", () => menu(true));
    on("closeMenuButton", () => menu(false));
    on("menuBackdrop", () => menu(false));
    on("openActionMenuButton", () => byId("actionMenuOverlay").classList.toggle("hidden"));
    on("actionMenuOverlay", event => { if (event.target === byId("actionMenuOverlay")) closeActions(); });
    on("addPoseActionButton", () => FormNavigation.go("/html/add-pose.html"));
    on("editPoseButton", () => { if (currentPose) FormNavigation.go(`/html/edit-pose.html?id=${currentPose.id}`); });
    for (const id of ["closePoseFormButton", "cancelPoseFormButton", "poseFormBackdrop"]) on(id, () => showModal("poseFormModal", false));
    on("closePoseDetailsButton", () => showModal("poseDetailsModal", false));
    on("poseDetailsModal", event => { if (event.target === byId("poseDetailsModal")) showModal("poseDetailsModal", false); });
    on("previousPreviewButton", () => { previewIndex = (previewIndex + previews.length - 1) % previews.length; renderPreview(); });
    on("nextPreviewButton", () => { previewIndex = (previewIndex + 1) % previews.length; renderPreview(); });
    on("poseImagesInput", () => { byId("poseSelectedImages").textContent = Array.from(byId("poseImagesInput").files, file => file.name).join(", "); }, "change");
    setupPoseSubmission();
    on("filterButton", () => { byId("categoryFilter").value = category; byId("favoriteFilter").value = favorites; showModal("filterModal", true); byId("filterButton").setAttribute("aria-expanded", "true"); });
    function closeFilter() { showModal("filterModal", false); byId("filterButton").setAttribute("aria-expanded", "false"); }
    for (const id of ["closeFilterButton", "filterModalBackdrop"]) on(id, closeFilter);
    function applyFilters() {
        category = byId("categoryFilter").value;
        favorites = byId("favoriteFilter").value;
        const count = Number(category !== "ALL") + Number(favorites !== "ALL");
        byId("filterCountBadge").textContent = count;
        byId("filterCountBadge").classList.toggle("hidden", !count);
        byId("filterButton").classList.toggle("active", count > 0);
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
        const count = Number(category !== "ALL") + Number(favorites !== "ALL");
        byId("filterCountBadge").textContent = count;
        byId("filterCountBadge").classList.toggle("hidden", !count);
        byId("filterButton").classList.toggle("active", count > 0);
        gallerySort.update();
    }
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
function renderSelectedImages() {
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
    container.replaceChildren();
    const editing = window.location.pathname.endsWith("/edit-pose.html");
    const images = editing ? [...retainedImages, ...selectedImageUrls] : [...selectedImageUrls, ...retainedImages];
    editImageIndex = Math.min(editImageIndex, Math.max(0, images.length - 1));
    const path = images[editImageIndex];
    if (path) {
        const image = document.createElement("img");
        image.src = path;
        image.alt = `Pose image ${editImageIndex + 1}; click to add images`;
        container.appendChild(image);
        if (editing) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-preview-image-button";
            remove.setAttribute("aria-label", "Remove displayed preview image");
            remove.textContent = "×";
            remove.addEventListener("click", event => {
                event.preventDefault(); event.stopPropagation();
                if (editImageIndex < retainedImages.length) retainedImages.splice(editImageIndex, 1);
                else {
                    const index = editImageIndex - retainedImages.length;
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
        placeholder.textContent = "Click to choose preview images";
        container.appendChild(placeholder);
    }
}

window.addEventListener("pageshow", event => {
    if (event.persisted && byId("poseList")) refreshCurrentView();
});
