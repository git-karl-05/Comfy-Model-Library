const API_BASE_URL = "/api/loras";
const BACKUP_API_BASE_URL = "/api/backup";


/* =========================
   APPLICATION STATE
========================= */

let currentLora = null;
let isEditingLora = false;
let loraDetailsSwipe = null;


/* =========================
   PAGINATION STATE
========================= */

const DEFAULT_PAGE_SIZE = 12;

let currentPage = 0;
let pageSize = window.LibrarySettings?.pageSize ?? DEFAULT_PAGE_SIZE;
let totalPages = 0;
let totalElements = 0;
window.addEventListener("library-page-size-change", event => {
    pageSize = event.detail.pageSize;
    if (!document.getElementById("loraList")) return;
    currentPage = 0;
    pageBeforeSearch = 0;
    refreshCurrentView();
});


/* =========================
   SEARCH STATE
========================= */

const SEARCH_DEBOUNCE_DELAY = 400;
const MINIMUM_SEARCH_LENGTH = 2;

let currentSearchResults = [];
let isSearchActive = false;

let pageBeforeSearch = 0;
let scrollPositionBeforeSearch = 0;

let searchDebounceTimer = null;
let lastSearchKeyword = "";


/* =========================
   FILTER STATE
========================= */

let appliedBaseModelFilter = "ALL";
let appliedCategoryFilter = "ALL";
let favoritesOnly = false;
let appliedSubcategoryFilter = "ALL";
let filterMetadata = [];


/* =========================
   SORT STATE
========================= */

let appliedSortBy = null;
let appliedSortDirection = null;


/* =========================
   BOTTOM SHEET STATE
========================= */

// Shared swipe constants and helpers are loaded from sheet-swipe.js.


/* =========================
   PREVIEW CAROUSEL STATE
========================= */

let currentPreviewImages = [];
let currentPreviewPrompts = new Map();
let currentPreviewIndex = 0;
let previewSwipe = null;
let detailsRequestSequence = 0;


/* =========================
   APPLICATION STARTUP
========================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        if (getRequestedLoraId()) {
            document.body.classList.add(
                "returning-to-modal"
            );
        }


        /* -------------------------
           Gallery
        ------------------------- */

        setupLayoutButtons();
        setupPaginationControls();
        setupGoToTopButton();


        /* -------------------------
           Search / Sort / Filter
        ------------------------- */

        setupSearch();
        setupSearchOverlay();

        setupSortModal();

        setupFilterModal();
        setupFilterSheetSwipe();


        /* -------------------------
           LoRA Details
        ------------------------- */

        setupLoraDetailsModal();
        setupLoraDetailsSwipe();

        setupPreviewCarousel();
        setupExpandedTextModal();


        /* -------------------------
           Menus / Actions
        ------------------------- */

        setupMenu();
        setupActionMenu();

        setupImportFolderForm();

        setupBackupExport();
        setupBackupImport();


        /* -------------------------
           Initial Gallery Load
        ------------------------- */

        const saved = FormNavigation.restoreState();
        if (saved) {
            currentPage = Number.isInteger(saved.page) && saved.page >= 0 ? saved.page : 0;
            appliedSortBy = ["loraName", "creator", "category", "subCategory", "baseModel"].includes(saved.sortBy) ? saved.sortBy : null;
            appliedSortDirection = saved.sortDirection === "desc" ? "desc" : "asc";
            appliedBaseModelFilter = saved.baseModel || "ALL";
            appliedCategoryFilter = saved.category === "FAVORITES" ? (saved.categoryBeforeFavorites || "ALL") : (saved.category || "ALL");
            favoritesOnly = saved.favoritesOnly === true || saved.category === "FAVORITES";
            appliedSubcategoryFilter = saved.subcategory || "ALL";
            document.getElementById("searchInput").value = saved.search || "";
            isSearchActive = (saved.search || "").trim().length >= MINIMUM_SEARCH_LENGTH;
            if (saved.search) document.getElementById("searchOverlay")?.classList.remove("hidden");
            if (saved.doubleColumn) document.getElementById("doubleColumnButton")?.click();
            updateSortDisplay();
            updateFilterButton();
        }
        FormNavigation.register(() => ({
            page: currentPage, sortBy: appliedSortBy, sortDirection: appliedSortDirection,
            baseModel: appliedBaseModelFilter, category: appliedCategoryFilter, subcategory: appliedSubcategoryFilter,
            favoritesOnly,
            search: document.getElementById("searchInput")?.value || "",
            doubleColumn: document.getElementById("loraList")?.classList.contains("double-column")
        }));
        await refreshCurrentView();
        await reopenRequestedLoraModal();
        if (saved) window.scrollTo(0, saved.scrollY || 0);
    }
);


/* =========================
   GALLERY DATA
========================= */

async function fetchAllLoras(
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const url =
            buildLoraPageUrl(
                page,
                pageSize
            );

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Failed to fetch LoRAs"
            );
        }

        const pageResponse =
            await response.json();

        validateLoraPageResponse(
            pageResponse
        );

        updatePaginationState(
            pageResponse
        );

        updatePaginationControls();

        if (
            pageResponse.content.length === 0
        ) {
            displayEmptyGalleryMessage();
            return;
        }

        renderLoraPage(
            pageResponse.content
        );

    } catch (error) {
        displayGalleryError(
            error
        );
    }
}


function displayLoras(
    loras
) {
    const loraList =
        document.getElementById(
            "loraList"
        );

    if (!loraList) {
        return;
    }

    loraList.innerHTML = "";

    if (
        !loras ||
        loras.length === 0
    ) {
        loraList.innerHTML = `
            <p class="empty-message">
                No LoRAs found.
            </p>
        `;

        return;
    }

    loras.forEach(
        lora => {
            loraList.appendChild(
                createLoraCard(lora)
            );
        }
    );
}


function createLoraCard(
    lora
) {
    const card =
        document.createElement(
            "article"
        );

    card.className =
        "lora-card";
    card.dataset.loraId = String(lora.id);


    const imageHtml =
        lora.filePath

            ? isVideoPreview(
                lora.filePath
            )

                ? `
                    <video
                        class="lora-card-image"
                        src="${localPreviewUrl(lora.filePath)}"
                        muted
                        loop
                        playsinline
                        preload="auto"
                    ></video>
                  `

                : `
                    <img
                        class="lora-card-image"
                        src="${localPreviewUrl(lora.filePath)}"
                        alt="${lora.loraName ?? "LoRA Preview"}"
                    >
                  `

            : `
                <div class="lora-card-placeholder">
                    No Image
                </div>
              `;


    card.innerHTML = `
        ${imageHtml}

        <button
            class="favorite-button"
            type="button"
            aria-label="Toggle favorite"
        >
            ${lora.favorite ? "★" : "☆"}
        </button>

        <div class="lora-card-header">

            <p class="lora-meta">
                ${
        lora.creator
            ? lora.creator
            : "Unknown creator"
    }
            </p>

            <h2>
                ${
        lora.loraName
        ?? "Untitled LoRA"
    }
            </h2>

        </div>
    `;


    addPreviewCacheFallback(card.querySelector(".lora-card-image"), lora.filePath);

    const previewVideo =
        card.querySelector(
            "video.lora-card-image"
        );


    if (previewVideo) {
        setupGalleryVideoPreview(
            card,
            previewVideo
        );
    }


    const favoriteButton =
        card.querySelector(
            ".favorite-button"
        );


    if (favoriteButton) {
        favoriteButton.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                await toggleFavorite(
                    lora.id
                );
            }
        );
    }


    card.addEventListener(
        "click",
        () => {
            openLoraDetailsModal(
                lora.id
            );
        }
    );


    return card;
}


/* =========================
   GALLERY VIDEO PREVIEW
========================= */

function setupGalleryVideoPreview(
    card,
    video
) {
    if (
        !card ||
        !video
    ) {
        return;
    }

    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    if (
        window.matchMedia(
            "(hover: hover)"
        ).matches
    ) {
        card.addEventListener(
            "mouseenter",
            () => {
                playGalleryVideo(
                    video
                );
            }
        );

        card.addEventListener(
            "mouseleave",
            () => {
                resetGalleryVideo(
                    video
                );
            }
        );

        card.addEventListener(
            "focusin",
            () => {
                playGalleryVideo(
                    video
                );
            }
        );

        card.addEventListener(
            "focusout",
            () => {
                resetGalleryVideo(
                    video
                );
            }
        );

        return;
    }

    galleryVideoObserver.observe(
        video
    );
}


/* =========================
   GALLERY RENDERING
========================= */

function renderLoraPage(
    loras
) {
    displayLoras(
        loras
    );
}


function displayEmptyGalleryMessage() {
    const loraList =
        document.getElementById(
            "loraList"
        );

    if (!loraList) {
        return;
    }

    loraList.innerHTML = `
        <p class="empty-message">
            No LoRAs found.
        </p>
    `;
}


function displayGalleryError(
    error
) {
    console.error(
        "Gallery error:",
        error
    );

    const loraList =
        document.getElementById(
            "loraList"
        );

    if (!loraList) {
        return;
    }

    loraList.innerHTML = `
        <p class="empty-message">
            Unable to load LoRAs.
        </p>
    `;
}

/* =========================
   FAVORITES
========================= */

async function toggleFavorite(loraId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/${loraId}/favorite`,
            {
                method: "PUT"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to toggle favorite"
            );
        }

        const updated = await response.json();
        if (String(currentLora?.id) === String(loraId)) {
            currentLora.favorite = Boolean(updated.favorite);
            updateLoraDetailsFavorite();
        }
        await refreshCurrentView();
        return updated;

    } catch (error) {
        console.error(
            "Error toggling favorite:",
            error
        );
        return null;
    }
}


/* =========================
   SEARCH
========================= */

function clearSearchDebounceTimer() {
    if (searchDebounceTimer === null) {
        return;
    }

    window.clearTimeout(
        searchDebounceTimer
    );

    searchDebounceTimer = null;
}


async function performSearchFromInput() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) {
        return;
    }

    const keyword =
        searchInput.value.trim();

    if (keyword === "") {
        return;
    }

    if (
        keyword.length <
        MINIMUM_SEARCH_LENGTH
    ) {
        return;
    }

    if (
        keyword === lastSearchKeyword &&
        isSearchActive
    ) {
        return;
    }

    lastSearchKeyword = keyword;

    await searchLoras(
        keyword,
        0
    );
}


async function clearSearch() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const searchOverlay =
        document.getElementById(
            "searchOverlay"
        );

    if (searchInput) {
        searchInput.value = "";
    }

    if (searchOverlay) {
        searchOverlay.classList.add(
            "hidden"
        );
    }

    clearSearchDebounceTimer();

    lastSearchKeyword = "";
    currentSearchResults = [];
    isSearchActive = false;

    const restoredPage =
        pageBeforeSearch;

    const restoredScrollPosition =
        scrollPositionBeforeSearch;

    currentPage = restoredPage;

    await refreshCurrentView();

    window.requestAnimationFrame(
        () => {
            window.scrollTo({
                top: restoredScrollPosition,
                behavior: "auto"
            });
        }
    );
}


function setupSearch() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) {
        return;
    }

    searchInput.addEventListener(
        "input",
        () => {
            clearSearchDebounceTimer();

            searchDebounceTimer =
                window.setTimeout(
                    async () => {
                        await performSearchFromInput();
                    },
                    SEARCH_DEBOUNCE_DELAY
                );
        }
    );

    searchInput.addEventListener(
        "keydown",
        async event => {

            if (event.key === "Enter") {
                event.preventDefault();

                clearSearchDebounceTimer();

                await performSearchFromInput();

                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();

                clearSearchDebounceTimer();

                await clearSearch();
            }
        }
    );
}


function setupSearchOverlay() {
    const searchButton =
        document.getElementById(
            "searchIconButton"
        );

    const closeButton =
        document.getElementById(
            "closeSearchButton"
        );

    const searchOverlay =
        document.getElementById(
            "searchOverlay"
        );

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (
        !searchButton ||
        !closeButton ||
        !searchOverlay ||
        !searchInput
    ) {
        return;
    }

    searchButton.addEventListener(
        "click",
        () => {

            if (!isSearchActive) {
                pageBeforeSearch =
                    currentPage;

                scrollPositionBeforeSearch =
                    window.scrollY;
            }

            searchOverlay.classList.remove(
                "hidden"
            );

            searchInput.focus();
        }
    );

    closeButton.addEventListener(
        "click",
        async () => {
            clearSearchDebounceTimer();

            await clearSearch();
        }
    );
}


async function searchLoras(
    keyword,
    page = currentPage
) {
    try {
        const normalizedKeyword =
            keyword.trim();

        if (
            normalizedKeyword.length <
            MINIMUM_SEARCH_LENGTH
        ) {
            return;
        }

        const parameters = {
            keyword: normalizedKeyword,
            ...buildFilterParameters(),
            ...buildSortParameters()
        };

        if (
            favoritesOnly
        ) {
            parameters.favorite = true;
        }

        const url =
            buildPaginatedUrl(
                "/search",
                page,
                pageSize,
                parameters
            );

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Search failed. Status: ${response.status}`
            );
        }

        const pageResponse =
            await response.json();

        isSearchActive = true;

        lastSearchKeyword =
            normalizedKeyword;

        displayPaginatedLoraResponse(
            pageResponse
        );

    } catch (error) {
        console.error(
            "Search error:",
            error
        );

        isSearchActive = false;

        displayGalleryError(
            error
        );
    }
}


/* =========================
   CURRENT GALLERY VIEW
========================= */

async function refreshCurrentView() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const keyword =
        searchInput?.value.trim() ?? "";

    /*
     * Search takes priority because the
     * search request already includes the
     * currently applied filters and sort.
     */
    if (
        isSearchActive &&
        keyword.length >=
        MINIMUM_SEARCH_LENGTH
    ) {
        await searchLoras(
            keyword,
            currentPage
        );

        return;
    }

    // Favorites narrows the applied filters independently.
    if (
        favoritesOnly
    ) {
        await fetchFavoriteLoras(
            currentPage
        );

        return;
    }

    /*
     * Normal gallery filters.
     */
    if (hasActiveGalleryFilters()) {
        await fetchFilteredLoras(
            currentPage
        );

        return;
    }

    /*
     * No search or filters.
     */
    await fetchAllLoras(
        currentPage
    );
}


/* =========================
   ACTION MENU
========================= */

function setupActionMenu() {
    const backupButton = document.getElementById("backupMenuButton");
    const backupOptions = document.getElementById("backupOptions");
    backupButton?.addEventListener("click", () => {
        const expanded = backupOptions.classList.contains("hidden");
        backupOptions.classList.toggle("hidden", !expanded);
        backupButton.setAttribute("aria-expanded", String(expanded));
    });
    document.getElementById("refreshLorasButton")?.addEventListener("click", refreshLoraLibrary);
    const openButton =
        document.getElementById(
            "openActionMenuButton"
        );

    const overlay =
        document.getElementById(
            "actionMenuOverlay"
        );

    const popover =
        document.getElementById(
            "actionMenuPopover"
        );

    const addButton =
        document.getElementById(
            "addLoraActionButton"
        );

    const importButton =
        document.getElementById(
            "showImportFolderButton"
        );

    const importForm =
        document.getElementById(
            "importFolderForm"
        );

    const importResult =
        document.getElementById(
            "importResult"
        );

    if (
        !openButton ||
        !overlay ||
        !popover ||
        !addButton ||
        !importButton ||
        !importForm
    ) {
        return;
    }

    openButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            overlay.classList.toggle(
                "hidden"
            );
            openButton.setAttribute("aria-expanded", String(!overlay.classList.contains("hidden")));
        }
    );

    popover.addEventListener(
        "click",
        event => {
            event.stopPropagation();
        }
    );

    overlay.addEventListener(
        "click",
        closeActionMenu
    );

    addButton.addEventListener(
        "click",
        () => {
            FormNavigation.go("/html/add-lora.html");
        }
    );

    importButton.addEventListener(
        "click",
        () => {

            importForm.classList.toggle(
                "hidden"
            );

            if (importResult) {
                importResult.classList.add(
                    "hidden"
                );

                importResult.classList.remove(
                    "import-result-success",
                    "import-result-error"
                );

                importResult.innerHTML = "";
            }

            if (
                !importForm.classList.contains(
                    "hidden"
                )
            ) {
                document
                    .getElementById(
                        "importFolderPath"
                    )
                    ?.focus();
            }
        }
    );
}

async function refreshLoraLibrary() {
    const button = document.getElementById("refreshLorasButton");
    const label = document.getElementById("refreshLorasLabel");
    if (!button || button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (label) label.textContent = "Refreshing...";
    try {
        await refreshFilterMetadata();
        // Keep the user's current search, filters, sort and page.
        await refreshCurrentView();
        closeActionMenu();
        document.getElementById("openActionMenuButton")?.focus();
    } catch (error) {
        window.alert(`Unable to refresh the library: ${error.message}`);
    } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (label) label.textContent = "Refresh";
    }
}


function closeActionMenu() {
    document.getElementById("openActionMenuButton")?.setAttribute("aria-expanded", "false");
    const overlay =
        document.getElementById(
            "actionMenuOverlay"
        );

    const importForm =
        document.getElementById(
            "importFolderForm"
        );

    const importResult =
        document.getElementById(
            "importResult"
        );

    overlay?.classList.add(
        "hidden"
    );

    importForm?.classList.add(
        "hidden"
    );

    if (importResult) {
        importResult.classList.add(
            "hidden"
        );

        importResult.classList.remove(
            "import-result-success",
            "import-result-error"
        );

        importResult.innerHTML = "";
    }
}


/* =========================
   GO TO TOP
========================= */

function setupGoToTopButton() {
    const goTopButton =
        document.getElementById(
            "goTopButton"
        );

    if (!goTopButton) {
        return;
    }

    function updateGoTopVisibility() {
        const shouldShow =
            window.scrollY > 500;

        goTopButton.classList.toggle(
            "hidden",
            !shouldShow
        );
    }

    window.addEventListener(
        "scroll",
        updateGoTopVisibility,
        {
            passive: true
        }
    );

    goTopButton.addEventListener(
        "click",
        () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );

    updateGoTopVisibility();
}


/* =========================
   FILTER ELEMENTS
========================= */

function getFilterElements() {
    return {
        modal:
            document.getElementById(
                "filterModal"
            ),

        backdrop:
            document.getElementById(
                "filterModalBackdrop"
            ),

        openButton:
            document.getElementById(
                "filterButton"
            ),

        closeButton:
            document.getElementById(
                "closeFilterButton"
            ),

        applyButton:
            document.getElementById(
                "applyFilterButton"
            ),

        resetButton:
            document.getElementById(
                "resetFilterButton"
            ),

        baseModelFilter:
            document.getElementById(
                "baseModelFilter"
            ),

        categoryFilter:
            document.getElementById(
                "categoryFilter"
            ),

        subcategoryFilter:
            document.getElementById(
                "subcategoryFilter"
            ),

        countBadge:
            document.getElementById(
                "filterCountBadge"
            )
    };
}


/* =========================
   FILTER MODAL
========================= */

function setupFavoritesToggle() {
    const button = document.getElementById("favoritesToggleButton");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        favoritesOnly = !favoritesOnly;
        currentPage = 0;
        pageBeforeSearch = 0;
        updateFilterButton();
        try { await refreshCurrentView(); }
        finally { button.disabled = false; }
    });
}


function setupFilterModal() {
    setupFavoritesToggle();
    const {
        modal,
        backdrop,
        openButton,
        closeButton,
        applyButton,
        resetButton,
        baseModelFilter,
        categoryFilter,
        subcategoryFilter
    } = getFilterElements();

    if (
        !modal ||
        !backdrop ||
        !openButton ||
        !closeButton ||
        !applyButton ||
        !resetButton ||
        !baseModelFilter ||
        !categoryFilter ||
        !subcategoryFilter
    ) {
        return;
    }

    openButton.addEventListener(
        "click",
        async () => {
            openButton.disabled = true;
            try {
                await refreshFilterMetadata();
                openFilterModal();
            } catch (error) {
                window.alert(error.message);
            } finally {
                openButton.disabled = false;
            }
        }
    );

    const updateDependentOptions = () => populateMetadataFilterOptions({
        baseModel: baseModelFilter.value, category: categoryFilter.value, subCategory: subcategoryFilter.value
    });
    baseModelFilter.addEventListener("change", updateDependentOptions);
    categoryFilter.addEventListener("change", updateDependentOptions);

    closeButton.addEventListener(
        "click",
        () => {
            cancelPendingFilterChanges();
            closeFilterModal();
        }
    );

    backdrop.addEventListener(
        "click",
        () => {
            cancelPendingFilterChanges();
            closeFilterModal();
        }
    );

    resetButton.addEventListener(
        "click",
        resetFilterSelection
    );

    applyButton.addEventListener(
        "click",
        async () => {
            await applySelectedFilter();
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key !== "Escape" ||
                modal.classList.contains(
                    "hidden"
                )
            ) {
                return;
            }

            cancelPendingFilterChanges();

            closeFilterModal();
        }
    );

    updateFilterButton();
}


function openFilterModal() {
    const {
        modal,
        openButton,
        baseModelFilter
    } = getFilterElements();

    if (!modal) {
        return;
    }

    modal.inert = false;

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    openButton?.setAttribute(
        "aria-expanded",
        "true"
    );

    window.requestAnimationFrame(
        () => {
            baseModelFilter?.focus();
        }
    );
}

async function refreshFilterMetadata() {
    // Shared by opening the filter and explicitly refreshing the library.
    const response = await fetch(`${API_BASE_URL}/filter-options`, {cache: "no-store"});
    if (!response.ok) throw new Error(`Unable to load filter metadata (${response.status}).`);
    const metadata = await response.json();
    if (!Array.isArray(metadata)) throw new Error("Invalid filter metadata response.");
    filterMetadata = metadata;
    populateMetadataFilterOptions({baseModel: appliedBaseModelFilter,
        category: appliedCategoryFilter, subCategory: appliedSubcategoryFilter});
}

function setMetadataFilterOptions(select, values, placeholder, selected, special = [], formatLabel = value => value) {
    const unique = [...new Set(values.filter(value => typeof value === "string" && value.trim()))]
            .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    select.replaceChildren();
    // ALL remains an internal unfiltered value, never a selectable menu option.
    const empty = document.createElement("option");
    empty.value = "ALL";
    empty.textContent = placeholder;
    empty.hidden = true;
    empty.disabled = true;
    select.appendChild(empty);
    for (const [value, label] of [...special, ...unique.map(value => [value, formatLabel(value)])]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }
    // Older saved filters used uppercase values; retain the underlying metadata values.
    const match = selected === "ALL" ? null
            : unique.find(value => value.toLowerCase() === String(selected).toLowerCase());
    select.value = special.some(([value]) => value === selected) ? selected : match ?? "ALL";
}

function populateMetadataFilterOptions(selected) {
    const {baseModelFilter, categoryFilter, subcategoryFilter} = getFilterElements();
    setMetadataFilterOptions(baseModelFilter, filterMetadata.map(row => row.baseModel),
            "Select a base model", selected.baseModel);
    const models = baseModelFilter.value === "ALL" ? []
            : filterMetadata.filter(row => row.baseModel === baseModelFilter.value);
    const sentenceCase = value => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    setMetadataFilterOptions(categoryFilter, models.map(row => row.category),
            "Select a category", selected.category, [], sentenceCase);
    categoryFilter.disabled = baseModelFilter.value === "ALL";
    const categories = models.filter(row => row.category === categoryFilter.value);
    setMetadataFilterOptions(subcategoryFilter, categories.map(row => row.subCategory),
            "Select a subcategory", selected.subCategory);
    subcategoryFilter.disabled = categories.length === 0
            || !categories.some(row => typeof row.subCategory === "string" && row.subCategory.trim());
}


function closeFilterModal() {
    const {
        modal,
        openButton
    } = getFilterElements();

    if (!modal) {
        return;
    }

    /*
     * Move focus outside the modal
     * before making it inert.
     */
    openButton?.focus();

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.inert = true;

    openButton?.setAttribute(
        "aria-expanded",
        "false"
    );
}


/* =========================
   FILTER STATE
========================= */

function getActiveFilterCount() {
    let activeCount = 0;

    if (
        appliedBaseModelFilter !==
        "ALL"
    ) {
        activeCount += 1;
    }

    if (
        appliedCategoryFilter !==
        "ALL"
    ) {
        activeCount += 1;
    }

    if (
        appliedSubcategoryFilter !==
        "ALL"
    ) {
        activeCount += 1;
    }

    return activeCount;
}


function hasActiveGalleryFilters() {
    return getActiveFilterCount() > 0;
}


function buildFilterParameters() {
    const parameters = {};

    if (
        appliedBaseModelFilter !==
        "ALL"
    ) {
        parameters.baseModel =
            appliedBaseModelFilter;
    }

    if (
        appliedCategoryFilter !==
        "ALL" &&
        appliedCategoryFilter !==
        "FAVORITES"
    ) {
        parameters.category =
            appliedCategoryFilter;
    }

    if (
        appliedSubcategoryFilter !==
        "ALL"
    ) {
        parameters.subcategory =
            appliedSubcategoryFilter;
    }

    return parameters;
}


function cancelPendingFilterChanges() {
    const {
        baseModelFilter,
        categoryFilter,
        subcategoryFilter
    } = getFilterElements();

    if (baseModelFilter) {
        baseModelFilter.value =
            appliedBaseModelFilter;
    }

    if (categoryFilter) {
        categoryFilter.value =
            appliedCategoryFilter;
    }

    if (subcategoryFilter) {
        subcategoryFilter.value =
            appliedSubcategoryFilter;
    }
}


async function applySelectedFilter() {
    const {
        baseModelFilter,
        categoryFilter,
        subcategoryFilter
    } = getFilterElements();

    if (
        !baseModelFilter ||
        !categoryFilter ||
        !subcategoryFilter
    ) {
        return;
    }

    appliedBaseModelFilter =
        baseModelFilter.value;

    appliedCategoryFilter = categoryFilter.value === "FAVORITES" ? "ALL" : categoryFilter.value;

    appliedSubcategoryFilter =
        subcategoryFilter.value;

    clearSearchForFilterChange();

    updateFilterButton();

    closeFilterModal();

    await refreshCurrentView();
}


function clearSearchForFilterChange() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (searchInput) {
        searchInput.value = "";
    }

    clearSearchDebounceTimer();

    lastSearchKeyword = "";
    currentSearchResults = [];
    isSearchActive = false;

    currentPage = 0;
    pageBeforeSearch = 0;
}


function updateFilterButton() {
    const favorites = favoritesOnly;
    const favoritesButton = document.getElementById("favoritesToggleButton");
    favoritesButton?.classList.toggle("active", favorites);
    favoritesButton?.setAttribute("aria-pressed", String(favorites));
    if (favoritesButton) favoritesButton.title = favorites ? "Turn off Favorites filter" : "Show favorites only";
    const icon = document.getElementById("favoritesToggleIcon");
    if (icon) icon.textContent = favorites ? "★" : "☆";
    const {
        openButton,
        countBadge
    } = getFilterElements();

    if (
        !openButton ||
        !countBadge
    ) {
        return;
    }

    const activeFilterCount =
        getActiveFilterCount();

    const hasActiveFilters =
        activeFilterCount > 0;

    openButton.classList.toggle(
        "active",
        hasActiveFilters
    );

    countBadge.classList.toggle(
        "hidden",
        !hasActiveFilters
    );

    countBadge.textContent =
        String(activeFilterCount);
}


async function resetFilterSelection() {
    const {
        baseModelFilter,
        categoryFilter,
        subcategoryFilter
    } = getFilterElements();

    if (baseModelFilter) {
        baseModelFilter.value =
            "ALL";
    }

    if (categoryFilter) {
        categoryFilter.value =
            "ALL";
    }

    if (subcategoryFilter) {
        subcategoryFilter.value =
            "ALL";
    }

    appliedBaseModelFilter =
        "ALL";

    appliedCategoryFilter =
        "ALL";

    appliedSubcategoryFilter =
        "ALL";

    clearSearchForFilterChange();

    updateFilterButton();

    closeFilterModal();

    await refreshCurrentView();
}


/* =========================
   FAVORITES / FILTERED DATA
========================= */

async function fetchFavoriteLoras(
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const url =
            buildPaginatedUrl(
                "/favorites",
                page,
                pageSize,
                {...buildFilterParameters(), ...buildSortParameters()}
            );

        await fetchPaginatedLoras(
            url,
            "Failed to fetch favorite LoRAs"
        );

    } catch (error) {
        console.error(
            "Favorites filter error:",
            error
        );

        displayGalleryError(
            error
        );
    }
}


async function fetchFilteredLoras(
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const parameters = {
            ...buildFilterParameters(),
            ...buildSortParameters()
        };

        const url =
            buildPaginatedUrl(
                "/filter",
                page,
                pageSize,
                parameters
            );

        await fetchPaginatedLoras(
            url,
            "Failed to fetch filtered LoRAs"
        );

    } catch (error) {
        console.error(
            "Gallery filter error:",
            error
        );

        displayGalleryError(
            error
        );
    }
}


/* =========================
   CATEGORY DATA
========================= */

async function fetchLorasByCategory(
    category,
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const encodedCategory =
            encodeURIComponent(
                category
            );

        const url =
            buildPaginatedUrl(
                `/category/${encodedCategory}`,
                page,
                pageSize
            );

        await fetchPaginatedLoras(
            url,
            "Failed to fetch LoRAs by category"
        );

    } catch (error) {
        console.error(
            "Category filter error:",
            error
        );

        displayGalleryError(
            error
        );
    }
}


/* =========================
   LEGACY CLIENT-SIDE
   SEARCH PAGINATION
========================= */

/*
 * Kept because it exists in the current
 * application and may still be referenced
 * elsewhere. Current server-side search
 * uses displayPaginatedLoraResponse().
 */



/* =========================
   GALLERY LAYOUT
========================= */

function setupLayoutButtons() {
    const singleButton = document.getElementById("singleColumnButton");
    const doubleButton = document.getElementById("doubleColumnButton");
    const loraList = document.getElementById("loraList");
    if (!doubleButton || !loraList) return;
    function setLayout(doubleColumn) {
        loraList.classList.toggle("single-column", !doubleColumn);
        loraList.classList.toggle("double-column", doubleColumn);
        doubleButton.classList.toggle("active", doubleColumn);
        doubleButton.setAttribute("aria-pressed", String(doubleColumn));
        doubleButton.title = doubleColumn ? "Switch to single-column layout" : "Switch to double-column layout";
        singleButton?.classList.toggle("active", !doubleColumn);
    }
    // Support older pages with two controls; the main gallery uses a single toggle.
    singleButton?.addEventListener("click", () => setLayout(false));
    doubleButton.addEventListener("click", () => setLayout(singleButton ? true : !loraList.classList.contains("double-column")));
    setLayout(loraList.classList.contains("double-column"));
}


/* =========================
   LORA DETAILS MODAL
========================= */

function updateLoraDetailsFavorite() {
    const favorite = Boolean(currentLora?.favorite);
    document.getElementById("favoriteLoraDetailsButton")?.setAttribute("aria-checked", String(favorite));
    const label = document.getElementById("favoriteLoraDetailsLabel");
    const icon = document.getElementById("favoriteLoraDetailsIcon");
    if (label) label.textContent = favorite ? "Unfavorite" : "Favorite";
    if (icon) icon.textContent = favorite ? "★" : "☆";
}
function closeLoraDetailsActions(focus = false) {
    const menu = document.getElementById("loraDetailsActionsMenu");
    if (menu) menu.hidden = true;
    const button = document.getElementById("loraDetailsActionsButton");
    button?.setAttribute("aria-expanded", "false");
    if (focus) button?.focus();
}
function setupLoraDetailsActions() {
    const wrapper = document.getElementById("loraDetailsMoreActions");
    const button = document.getElementById("loraDetailsActionsButton");
    const menu = document.getElementById("loraDetailsActionsMenu");
    const favorite = document.getElementById("favoriteLoraDetailsButton");
    const edit = document.getElementById("editLoraButton");
    if (!wrapper || !button || !menu || !favorite || !edit) return;
    function open() {
        updateLoraDetailsFavorite();
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        favorite.focus();
    }
    button.addEventListener("click", () => menu.hidden ? open() : closeLoraDetailsActions(true));
    button.addEventListener("keydown", event => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault(); open();
            if (event.key === "ArrowUp") edit.focus();
        }
    });
    favorite.addEventListener("click", async () => {
        if (!currentLora?.id || favorite.disabled) return;
        const id = currentLora.id;
        favorite.disabled = true;
        try {
            const updated = await toggleFavorite(id);
            if (!updated) window.alert("Unable to update this LoRA's favorite status. Please try again.");
            else if (String(currentLora?.id) === String(id)) closeLoraDetailsActions(true);
        } finally { favorite.disabled = false; }
    });
    menu.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation(); closeLoraDetailsActions(true);
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const items = [favorite, edit].filter(item => !item.disabled);
            if (!items.length) return;
            const current = items.indexOf(document.activeElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
            items[next].focus();
        }
    });
    wrapper.addEventListener("focusout", event => {
        // Touch browsers may blur before click without focusing the tapped button.
        // Outside clicks still dismiss the menu through the document click handler.
        if (event.relatedTarget && !wrapper.contains(event.relatedTarget)) closeLoraDetailsActions();
    });
    document.addEventListener("click", event => {
        if (!wrapper.contains(event.target)) closeLoraDetailsActions();
    });
}


function setupLoraDetailsModal() {
    setupLoraDetailsActions();
    const closeButton =
        document.getElementById(
            "closeLoraDetailsButton"
        );

    const modalOverlay =
        document.getElementById(
            "loraDetailsModal"
        );

    const editButton =
        document.getElementById(
            "editLoraButton"
        );

    if (
        !closeButton ||
        !modalOverlay ||
        !editButton
    ) {
        return;
    }

    closeButton.addEventListener(
        "click",
        closeLoraDetailsModal
    );

    modalOverlay.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                modalOverlay
            ) {
                closeLoraDetailsModal();
            }
        }
    );

    editButton.addEventListener("click", () => {
        closeLoraDetailsActions();
        openEditLoraPage();
    });
}


/* =========================
   LORA DETAILS HELPERS
========================= */

function getLoraDetailsModal() {
    return document.getElementById(
        "loraDetailsModal"
    );
}


function getLoraDetailsScrollContainer() {
    return document.querySelector(
        "#loraDetailsModal .lora-details-scroll-area"
    );
}


function resetLoraDetailsScrollPosition() {
    const scrollContainer =
        getLoraDetailsScrollContainer();

    if (!scrollContainer) {
        return;
    }

    scrollContainer.scrollTop = 0;

    window.requestAnimationFrame(
        () => {
            scrollContainer.scrollTo({
                top: 0,
                left: 0,
                behavior: "auto"
            });
        }
    );
}


/* =========================
   RETURNED LORA MODAL
========================= */

function getRequestedLoraId() {
    const queryParameters =
        new URLSearchParams(
            window.location.search
        );

    const rawId =
        queryParameters.get(
            "openLora"
        );

    if (!rawId) {
        return null;
    }

    const loraId =
        Number(rawId);

    if (
        !Number.isInteger(loraId) ||
        loraId <= 0
    ) {
        return null;
    }

    return loraId;
}


function removeOpenLoraParameter() {
    const cleanedUrl =
        new URL(
            window.location.href
        );

    cleanedUrl.searchParams.delete(
        "openLora"
    );

    window.history.replaceState(
        {},
        "",
        cleanedUrl
    );
}


async function reopenRequestedLoraModal() {
    const loraId =
        getRequestedLoraId();

    if (!loraId) {
        return;
    }

    try {
        await openLoraDetailsModal(
            loraId
        );

        removeOpenLoraParameter();

    } catch (error) {
        console.error(
            "Unable to reopen LoRA modal:",
            error
        );

    } finally {
        document.body.classList.remove(
            "returning-to-modal"
        );
    }
}


/* =========================
   MODAL OPENING ANIMATION
========================= */

function restartLoraModalOpeningAnimation(
    modalSheet
) {
    if (!modalSheet) {
        return;
    }

    modalSheet.classList.remove(
        "opening",
        "closing"
    );

    /*
     * Force the browser to recognize
     * the class removal before adding
     * the opening class again.
     */
    void modalSheet.offsetWidth;

    modalSheet.classList.add(
        "opening"
    );

    modalSheet.addEventListener(
        "animationend",
        () => {
            modalSheet.classList.remove(
                "opening"
            );
        },
        {
            once: true
        }
    );
}


/* =========================
   OPEN LORA DETAILS
========================= */

async function openLoraDetailsModal(
    loraId
) {
    const requestSequence = ++detailsRequestSequence;
    closeLoraDetailsActions();
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/${loraId}`
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load LoRA details"
            );
        }

        const lora = await response.json();
        if (requestSequence !== detailsRequestSequence) return;
        currentLora = lora;

        const modal =
            getLoraDetailsModal();
        loraDetailsSwipe?.reset();

        if (!modal) {
            throw new Error(
                "LoRA details modal was not found."
            );
        }

        resetPreviewCarousel();
        populateLoraDetailsModal(
            currentLora
        );

        const modalSheet =
            modal.querySelector(
                ".lora-details-sheet"
            );

        modal.classList.remove(
            "hidden",
            "closing"
        );
        modal.setAttribute("aria-hidden", "false");
        sizePreviewLikeGalleryCard();

        restartLoraModalOpeningAnimation(
            modalSheet
        );

        resetLoraDetailsScrollPosition();

        await loadPreviewCarousel(
            currentLora.id, requestSequence
        );

    } catch (error) {
        if (requestSequence !== detailsRequestSequence) return;
        console.error(
            "Error loading LoRA details:",
            error
        );

        alert(
            "Unable to load LoRA details."
        );
    }
}


/* =========================
   CLOSE LORA DETAILS
========================= */

function finishClosingLoraDetailsModal(
    modal,
    modalSheet
) {
    closeLoraDetailsActions();
    detailsRequestSequence++;
    loraDetailsSwipe?.reset();
    modal.setAttribute("aria-hidden", "true");
    modal.classList.add(
        "hidden"
    );

    modal.classList.remove(
        "closing"
    );

    modalSheet.classList.remove(
        "opening",
        "closing"
    );
}


function closeLoraDetailsModal() {
    closeLoraDetailsActions();
    previewSwipe?.reset();
    const modal =
        document.getElementById(
            "loraDetailsModal"
        );

    const modalSheet =
        modal?.querySelector(
            ".lora-details-sheet"
        );

    const video =
        document.querySelector(
            "#detailsImageContainer video"
        );

    if (
        !modal ||
        !modalSheet
    ) {
        return;
    }

    if (
        modal.classList.contains(
            "hidden"
        ) ||
        modal.classList.contains(
            "closing"
        )
    ) {
        return;
    }

    modal.classList.add(
        "closing"
    );

    modalSheet.classList.add(
        "closing"
    );

    const closingRequestSequence = detailsRequestSequence;
    let closingFinished = false;

    function finishCloseAnimation() {
        if (closingFinished || closingRequestSequence !== detailsRequestSequence) {
            return;
        }

        closingFinished = true;

        finishClosingLoraDetailsModal(
            modal,
            modalSheet
        );
    }

    modalSheet.addEventListener(
        "animationend",
        finishCloseAnimation,
        {
            once: true
        }
    );

    /*
     * Fallback in case animationend
     * does not fire.
     */
    window.setTimeout(
        finishCloseAnimation,
        250
    );

    isEditingLora = false;
    currentLora = null;

    clearEditMessage();

    if (video) {
        video.pause();
        video.currentTime = 0;
    }
}


/* =========================
   POPULATE LORA DETAILS
========================= */

function populateLoraDetailsModal(
    lora
) {
    document.getElementById(
        "detailsLoraName"
    ).textContent =
        lora.loraName ||
        "Untitled LoRA";

    document.getElementById(
        "detailsCreator"
    ).textContent =
        lora.creator ||
        "Unknown creator";

    document.getElementById(
        "detailsVersion"
    ).textContent =
        lora.version ||
        "N/A";

    document.getElementById(
        "detailsCategory"
    ).textContent =
        lora.category ||
        "N/A";

    document.getElementById(
        "detailsSubCategory"
    ).textContent =
        lora.subCategory ||
        "N/A";

    document.getElementById(
        "detailsBaseModel"
    ).textContent =
        lora.baseModel ||
        "N/A";

    setCopyableField(
        "detailsPositivePrompt",
        "detailsPositivePrompt",
        lora.positivePrompt,
        "No trained words saved."
    );

    setCopyableField("detailsPrompt", "detailsPrompt", lora.prompt, "No prompt saved.");

    setCopyableField(
        "detailsSeedNumber",
        "detailsSeedNumber",
        lora.seedNumber,
        "N/A"
    );

    setCopyableField(
        "detailsNegativePrompt",
        "detailsNegativePrompt",
        lora.negativePrompt,
        "No negative prompt saved."
    );

    setCopyableField(
        "detailsNotes",
        "detailsNotes",
        lora.notes,
        "No notes saved."
    );

    const hasNegativePrompt =
        typeof lora.negativePrompt ===
        "string" &&
        lora.negativePrompt.trim() !== "";

    const hasNotes =
        typeof lora.notes ===
        "string" &&
        lora.notes.trim() !== "";

    const additionalDetails =
        document.getElementById(
            "additionalLoraDetails"
        );

    if (additionalDetails) {
        additionalDetails.hidden =
            !hasNegativePrompt &&
            !hasNotes;

        additionalDetails.open = false;
    }

    populateDetailsUrl(
        lora
    );
}


/* =========================
   DETAILS PREVIEW
========================= */

function populateDetailsImage(lora) {
    renderPreviewPath(lora.filePath);
}


/* =========================
   DETAILS URL
========================= */

function populateDetailsUrl(
    lora
) {
    const urlLink =
        document.getElementById(
            "detailsUrl"
        );

    if (!urlLink) {
        return;
    }

    if (lora.url) {
        urlLink.href =
            lora.url;

        urlLink.textContent =
            lora.url;

        urlLink.title =
            lora.url;

        urlLink.classList.remove(
            "hidden"
        );

    } else {
        urlLink.href = "#";

        urlLink.textContent =
            "N/A";

        urlLink.removeAttribute(
            "title"
        );

        urlLink.classList.remove(
            "hidden"
        );
    }
}


/* =========================
   LORA EDIT MODE
========================= */

function enterLoraEditMode() {
    if (!currentLora) {
        return;
    }

    isEditingLora = true;

    populateLoraEditFields(
        currentLora
    );

    setLoraEditVisibility(
        true
    );

    const nameInput =
        document.getElementById(
            "editLoraName"
        );

    if (nameInput) {
        nameInput.focus({
            preventScroll: true
        });
    }
}


function setLoraEditVisibility(
    editing
) {
    toggleHidden(
        "detailsHeaderView",
        editing
    );

    toggleHidden(
        "detailsHeaderEdit",
        !editing
    );

    toggleHidden(
        "detailsInfoView",
        editing
    );

    toggleHidden(
        "detailsInfoEdit",
        !editing
    );

    toggleHidden(
        "detailsPromptView",
        editing
    );

    toggleHidden(
        "detailsPromptEdit",
        !editing
    );

    toggleHidden(
        "detailsEditActionBar",
        !editing
    );

    const urlLink =
        document.getElementById(
            "detailsUrl"
        );

    if (urlLink) {
        const shouldHideUrl =
            editing ||
            !currentLora?.url;

        urlLink.classList.toggle(
            "hidden",
            shouldHideUrl
        );
    }
}


function toggleHidden(
    elementId,
    shouldHide
) {
    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return;
    }

    element.classList.toggle(
        "hidden",
        shouldHide
    );
}


function cancelLoraEdit() {
    if (!currentLora) {
        return;
    }

    populateLoraEditFields(
        currentLora
    );

    exitLoraEditMode();
}


function exitLoraEditMode() {
    isEditingLora = false;

    setLoraEditVisibility(
        false
    );

    clearEditMessage();
}


/* =========================
   EDIT PAGE NAVIGATION
========================= */

function buildEditLoraPageUrl(
    loraId
) {
    const queryParameters =
        new URLSearchParams({
            id: String(loraId)
        });

    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("openLora", String(loraId));
    return FormNavigation.formUrl(`/html/edit-lora.html?${queryParameters}`, returnUrl.href);
}


function openEditLoraPage() {
    if (!currentLora?.id) {
        console.error(
            "Cannot open edit page without a LoRA ID."
        );

        return;
    }

    window.location.href =
        buildEditLoraPageUrl(
            currentLora.id
        );
}


/* =========================
   EDIT REQUEST
========================= */

function buildLoraUpdateRequest() {
    const seedValue =
        document
            .getElementById(
                "editSeedNumber"
            )
            ?.value
            .trim() || "";

    return {
        loraName:
            getModalInputValue(
                "editLoraName"
            ),

        version:
            getModalInputValue(
                "editVersion"
            ),

        creator:
            getModalInputValue(
                "editCreator"
            ),

        category:
            getModalInputValue(
                "editCategory"
            ),

        subCategory:
            getModalInputValue(
                "editSubCategory"
            ),

        positivePrompt:
            getModalInputValue(
                "editPositivePrompt"
            ),

        negativePrompt:
            getModalInputValue(
                "editNegativePrompt"
            ),

        seedNumber:
            seedValue === ""
                ? null
                : Number(seedValue),

        notes:
            getModalInputValue(
                "editNotes"
            ),

        favorite:
            currentLora?.favorite ??
            false
    };
}


function getModalInputValue(
    elementId
) {
    const element =
        document.getElementById(
            elementId
        );

    return element
        ? element.value.trim()
        : "";
}


function populateLoraEditFields(
    lora
) {
    setInputValue(
        "editLoraName",
        lora.loraName
    );

    setInputValue(
        "editCreator",
        lora.creator
    );

    setInputValue(
        "editVersion",
        lora.version
    );

    setInputValue(
        "editCategory",
        lora.category
    );

    setInputValue(
        "editSubCategory",
        lora.subCategory
    );

    setInputValue(
        "editGroupName",
        lora.groupName
    );

    setInputValue(
        "editSeedNumber",
        lora.seedNumber
    );

    setInputValue(
        "editPositivePrompt",
        lora.positivePrompt
    );

    setInputValue(
        "editNegativePrompt",
        lora.negativePrompt
    );

    setInputValue(
        "editNotes",
        lora.notes
    );
}


function validateLoraUpdate(
    requestBody
) {
    if (!requestBody.loraName) {
        return "LoRA name is required.";
    }

    if (!requestBody.category) {
        return "Category is required.";
    }

    if (
        requestBody.seedNumber !== null &&
        Number.isNaN(
            requestBody.seedNumber
        )
    ) {
        return "Seed must be a valid number.";
    }

    return null;
}


function setInputValue(
    elementId,
    value
) {
    const element =
        document.getElementById(
            elementId
        );

    if (element) {
        element.value =
            value ?? "";
    }
}


/* =========================
   SAVE LORA EDIT
========================= */

async function saveLoraEdit() {
    if (!currentLora?.id) {
        displayEditMessage(
            "Unable to determine which LoRA is being edited.",
            true
        );

        return;
    }

    const requestBody =
        buildLoraUpdateRequest();

    const validationError =
        validateLoraUpdate(
            requestBody
        );

    if (validationError) {
        displayEditMessage(
            validationError,
            true
        );

        return;
    }

    const saveButton =
        document.getElementById(
            "saveLoraEditButton"
        );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent =
            "Saving...";
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/${currentLora.id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            requestBody
                        )
                }
            );

        if (!response.ok) {
            const responseText =
                await response.text();

            throw new Error(
                responseText ||
                `Update failed with status ${response.status}`
            );
        }

        currentLora =
            await response.json();

        populateLoraDetailsModal(
            currentLora
        );

        exitLoraEditMode();

        displayEditMessage(
            "LoRA updated successfully."
        );

    } catch (error) {
        console.error(
            "LoRA update error:",
            error
        );

        displayEditMessage(
            "Unable to save the LoRA. Check the backend logs.",
            true
        );

        return;

    } finally {
        if (saveButton) {
            saveButton.disabled = false;

            saveButton.textContent =
                "Save";
        }
    }

    try {
        await refreshCurrentView();

    } catch (error) {
        console.error(
            "Gallery refresh error:",
            error
        );
    }
}


/* =========================
   EDIT STATUS MESSAGE
========================= */

function displayEditMessage(
    message,
    isError = false
) {
    const messageElement =
        document.getElementById(
            "detailsEditMessage"
        );

    if (!messageElement) {
        return;
    }

    messageElement.textContent =
        message;

    messageElement.classList.remove(
        "hidden",
        "details-edit-message-error",
        "details-edit-message-success"
    );

    messageElement.classList.add(
        isError
            ? "details-edit-message-error"
            : "details-edit-message-success"
    );
}


function clearEditMessage() {
    const messageElement =
        document.getElementById(
            "detailsEditMessage"
        );

    if (!messageElement) {
        return;
    }

    messageElement.textContent = "";

    messageElement.classList.add(
        "hidden"
    );

    messageElement.classList.remove(
        "details-edit-message-error",
        "details-edit-message-success"
    );
}

/* =========================
   SIDE MENU
========================= */

function setupMenu() {
    const optionsButton =
        document.getElementById(
            "optionsButton"
        );

    const sideMenu =
        document.getElementById(
            "sideMenu"
        );

    const closeMenuButton =
        document.getElementById(
            "closeMenuButton"
        );

    const menuBackdrop =
        document.getElementById(
            "menuBackdrop"
        );

    if (
        !optionsButton ||
        !sideMenu ||
        !closeMenuButton ||
        !menuBackdrop
    ) {
        return;
    }

    function openMenu() {
        sideMenu.classList.remove(
            "hidden"
        );

        menuBackdrop.classList.remove(
            "hidden"
        );

        menuBackdrop.setAttribute(
            "aria-hidden",
            "false"
        );

        optionsButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    function closeMenu() {
        sideMenu.classList.add(
            "hidden"
        );

        menuBackdrop.classList.add(
            "hidden"
        );

        menuBackdrop.setAttribute(
            "aria-hidden",
            "true"
        );

        optionsButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    optionsButton.addEventListener(
        "click",
        openMenu
    );

    closeMenuButton.addEventListener(
        "click",
        closeMenu
    );

    menuBackdrop.addEventListener(
        "click",
        closeMenu
    );
}


/* =========================
   IMPORT FOLDER
========================= */

function setupImportFolderForm() {
    const importForm =
        document.getElementById(
            "importFolderForm"
        );

    const folderPathInput =
        document.getElementById(
            "importFolderPath"
        );

    const submitButton =
        document.getElementById(
            "importFolderSubmitButton"
        );

    const importResult =
        document.getElementById(
            "importResult"
        );

    if (
        !importForm ||
        !folderPathInput ||
        !submitButton ||
        !importResult
    ) {
        return;
    }

    importForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const folderPath =
                folderPathInput.value.trim();

            if (folderPath === "") {
                displayImportError(
                    "Enter a LoRA folder path."
                );

                return;
            }

            submitButton.disabled = true;
            submitButton.textContent =
                "Importing...";

            importResult.classList.add(
                "hidden"
            );

            importResult.innerHTML = "";

            try {
                const response =
                    await fetch(
                        `${API_BASE_URL}/import-folder`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    folderPath:
                                    folderPath
                                })
                        }
                    );

                if (!response.ok) {
                    const errorMessage =
                        await response.text();

                    throw new Error(
                        errorMessage ||
                        `Import failed with status ${response.status}`
                    );
                }

                const summary =
                    await response.json();

                displayImportSummary(
                    summary
                );

                await refreshCurrentView();

            } catch (error) {
                console.error(
                    "Folder import error:",
                    error
                );

                displayImportError(
                    "Unable to import the folder. Verify the path and check the backend logs."
                );

            } finally {
                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "Scan and Import";
            }
        }
    );
}


function displayImportSummary(
    summary
) {
    const importResult =
        document.getElementById(
            "importResult"
        );

    if (!importResult) {
        return;
    }

    importResult.classList.remove(
        "hidden",
        "import-result-error"
    );

    importResult.classList.add(
        "import-result-success"
    );

    importResult.innerHTML = `
        <h3>Import Complete</h3>

        <div class="import-summary-list">

            <div class="import-summary-row">
                <span>📂 Files Scanned</span>
                <strong>
                    ${summary.scannedFiles ?? 0}
                </strong>
            </div>

            <div class="import-summary-row">
                <span>✅ Imported</span>
                <strong>
                    ${summary.importedCount ?? 0}
                </strong>
            </div>

            <div class="import-summary-row">
                <span>⏭ Already Exists</span>
                <strong>
                    ${summary.skippedCount ?? 0}
                </strong>
            </div>

            <div class="import-summary-row">
                <span>❌ Failed</span>
                <strong>
                    ${summary.failedCount ?? 0}
                </strong>
            </div>

        </div>
    `;
}


function displayImportError(
    message
) {
    const importResult =
        document.getElementById(
            "importResult"
        );

    if (!importResult) {
        return;
    }

    importResult.classList.remove(
        "hidden",
        "import-result-success"
    );

    importResult.classList.add(
        "import-result-error"
    );

    importResult.innerHTML = `
        <h3>Import Failed</h3>
        <p>${message}</p>
    `;
}


/* =========================
   COPYABLE FIELDS
========================= */

document.addEventListener(
    "click",
    async event => {
        const copyButton =
            event.target.closest(
                ".copy-field-button"
            );

        if (!copyButton) {
            return;
        }

        const targetId =
            copyButton.dataset.copyTarget;

        const targetElement =
            document.getElementById(
                targetId
            );

        if (!targetElement) {
            console.error(
                `Copy target not found: ${targetId}`
            );

            return;
        }

        const textToCopy =
            targetElement
                .textContent
                .trim();

        if (
            !textToCopy ||
            textToCopy ===
            "Not provided"
        ) {
            showCopyButtonStatus(
                copyButton,
                "Nothing to copy"
            );

            return;
        }

        try {
            await navigator.clipboard.writeText(
                textToCopy
            );

            showCopyButtonStatus(
                copyButton,
                "Copied"
            );

        } catch (error) {
            console.error(
                "Clipboard copy failed:",
                error
            );

            const copied =
                copyUsingFallback(
                    textToCopy
                );

            showCopyButtonStatus(
                copyButton,
                copied
                    ? "Copied"
                    : "Copy failed"
            );
        }
    }
);


function copyUsingFallback(
    text
) {
    const temporaryTextArea =
        document.createElement(
            "textarea"
        );

    temporaryTextArea.value =
        text;

    temporaryTextArea.setAttribute(
        "readonly",
        ""
    );

    temporaryTextArea.style.position =
        "fixed";

    temporaryTextArea.style.opacity =
        "0";

    document.body.appendChild(
        temporaryTextArea
    );

    temporaryTextArea.select();

    temporaryTextArea.setSelectionRange(
        0,
        temporaryTextArea.value.length
    );

    let copied = false;

    try {
        copied =
            document.execCommand(
                "copy"
            );

    } catch (error) {
        console.error(
            "Fallback copy failed:",
            error
        );
    }

    temporaryTextArea.remove();

    return copied;
}


function setCopyableField(
    targetId,
    buttonTarget,
    value,
    emptyMessage
) {
    const target =
        document.getElementById(
            targetId
        );

    const button =
        document.querySelector(
            `[data-copy-target="${buttonTarget}"]`
        );

    if (!target) {
        return;
    }

    const hasValue =
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "";

    target.textContent =
        hasValue
            ? String(value)
            : emptyMessage;

    if (button) {
        button.disabled =
            !hasValue;
    }
}


function showCopyButtonStatus(
    button,
    message
) {
    if (
        !button.dataset.originalText
    ) {
        button.dataset.originalText =
            button.textContent.trim();
        button.dataset.originalLabel = button.getAttribute("aria-label");
        button.dataset.originalTitle = button.title;
    }

    window.clearTimeout(
        Number(
            button.dataset.resetTimer
        )
    );

    button.textContent =
        message === "Copied" ? "✓" : "!";
    button.setAttribute("aria-label", message);
    button.title = message;

    button.disabled = true;

    const timer =
        window.setTimeout(
            () => {
                button.textContent =
                    button.dataset.originalText;
                button.setAttribute("aria-label", button.dataset.originalLabel);
                button.title = button.dataset.originalTitle;

                button.disabled =
                    false;

                delete button.dataset
                    .resetTimer;
            },
            1200
        );

    button.dataset.resetTimer =
        String(timer);
}


/* =========================
   VIDEO HELPERS
========================= */

function isVideoPreview(
    filePath
) {
    if (!filePath) {
        return false;
    }

    return filePath
        .toLowerCase()
        .split("?")[0]
        .endsWith(".mp4");
}


const galleryVideoObserver =
    new IntersectionObserver(
        entries => {
            entries.forEach(
                entry => {
                    if (
                        !window.matchMedia(
                            "(hover: none)"
                        ).matches
                    ) {
                        return;
                    }

                    const video =
                        entry.target;

                    if (
                        entry.isIntersecting
                    ) {
                        playGalleryVideo(
                            video
                        );

                    } else {
                        resetGalleryVideo(
                            video
                        );
                    }
                }
            );
        },
        {
            threshold: 0.65
        }
    );


function playGalleryVideo(
    video
) {
    if (!video) {
        return;
    }

    pauseOtherGalleryVideos(
        video
    );

    const playPromise =
        video.play();

    if (
        playPromise &&
        typeof playPromise.catch ===
        "function"
    ) {
        playPromise.catch(
            () => {
                // Autoplay may be blocked.
            }
        );
    }
}


function pauseOtherGalleryVideos(
    activeVideo
) {
    document
        .querySelectorAll(
            ".lora-card video.lora-card-image"
        )
        .forEach(
            video => {
                if (
                    video !==
                    activeVideo
                ) {
                    resetGalleryVideo(
                        video
                    );
                }
            }
        );
}


function resetGalleryVideo(
    video
) {
    if (!video) {
        return;
    }

    video.pause();

    try {
        video.currentTime = 0;
    } catch {
        // Ignore videos that are not ready.
    }
}

/* =========================
   PAGINATED URL HELPERS
========================= */

function buildLoraPageUrl(
    page,
    size
) {
    return buildPaginatedUrl(
        "",
        page,
        size,
        buildSortParameters()
    );
}


function buildPaginatedUrl(
    endpoint,
    page,
    size,
    parameters = {}
) {
    const queryParameters =
        new URLSearchParams();

    queryParameters.set(
        "page",
        String(page)
    );

    queryParameters.set(
        "size",
        String(size)
    );

    Object.entries(
        parameters
    ).forEach(
        ([key, value]) => {
            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return;
            }

            queryParameters.set(
                key,
                String(value)
            );
        }
    );

    return (
        `${API_BASE_URL}${endpoint}?` +
        queryParameters.toString()
    );
}


/* =========================
   PAGINATED RESPONSE
========================= */

function validateLoraPageResponse(
    pageResponse
) {
    if (
        !pageResponse ||
        !Array.isArray(
            pageResponse.content
        )
    ) {
        throw new Error(
            "Invalid paginated LoRA response."
        );
    }
}


function updatePaginationState(
    pageResponse
) {
    currentPage =
        Number.isInteger(
            pageResponse.number
        )
            ? pageResponse.number
            : 0;

    pageSize =
        Number.isInteger(
            pageResponse.size
        )
            ? pageResponse.size
            : (window.LibrarySettings?.pageSize ?? DEFAULT_PAGE_SIZE);

    totalPages =
        Number.isInteger(
            pageResponse.totalPages
        )
            ? pageResponse.totalPages
            : 0;

    totalElements =
        Number.isInteger(
            pageResponse.totalElements
        )
            ? pageResponse.totalElements
            : 0;
}


function displayPaginatedLoraResponse(
    pageResponse
) {
    validateLoraPageResponse(
        pageResponse
    );

    updatePaginationState(
        pageResponse
    );

    if (
        pageResponse.content.length ===
        0
    ) {
        displayEmptyGalleryMessage();

    } else {
        renderLoraPage(
            pageResponse.content
        );
    }

    updatePaginationControls();
}


async function fetchPaginatedLoras(
    url,
    errorMessage
) {
    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error(
            `${errorMessage}. Status: ${response.status}`
        );
    }

    const pageResponse =
        await response.json();

    displayPaginatedLoraResponse(
        pageResponse
    );

    return pageResponse;
}


/* =========================
   PAGINATION CONTROLS
========================= */

function setupPaginationControls() {
    const previousButton =
        document.getElementById(
            "previousPageButton"
        );

    const nextButton =
        document.getElementById(
            "nextPageButton"
        );

    if (
        !previousButton ||
        !nextButton
    ) {
        return;
    }

    previousButton.addEventListener(
        "click",
        async () => {
            if (
                currentPage <= 0
            ) {
                return;
            }

            currentPage -= 1;

            await refreshCurrentView();

            scrollToLoraGalleryControls();
        }
    );

    nextButton.addEventListener(
        "click",
        async () => {
            if (
                totalPages === 0 ||
                currentPage >=
                totalPages - 1
            ) {
                return;
            }

            currentPage += 1;

            await refreshCurrentView();

            scrollToLoraGalleryControls();
        }
    );

    updatePaginationControls();
}


function updatePaginationControls() {
    const paginationControls =
        document.getElementById(
            "paginationControls"
        );

    const previousButton =
        document.getElementById(
            "previousPageButton"
        );

    const nextButton =
        document.getElementById(
            "nextPageButton"
        );

    const pageIndicator =
        document.getElementById(
            "pageIndicator"
        );

    if (
        !paginationControls ||
        !previousButton ||
        !nextButton ||
        !pageIndicator
    ) {
        return;
    }

    if (
        totalElements === 0 ||
        totalPages <= 1
    ) {
        paginationControls.classList.add(
            "hidden"
        );

        previousButton.disabled =
            true;

        nextButton.disabled =
            true;

        pageIndicator.textContent =
            totalElements === 0
                ? "Page 0 of 0"
                : "Page 1 of 1";

        return;
    }

    paginationControls.classList.remove(
        "hidden"
    );

    previousButton.disabled =
        currentPage <= 0;

    nextButton.disabled =
        currentPage >=
        totalPages - 1;

    if (window.GalleryPagination) {
        window.GalleryPagination.render(pageIndicator, currentPage, totalPages, async page => {
            currentPage = page;
            await refreshCurrentView();
            scrollToLoraGalleryControls();
        });
    } else pageIndicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}


function scrollToLoraGalleryControls() {
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth"
    });
}






/* =========================
   SHARED BOTTOM SHEET SWIPE
========================= */

function setupBottomSheetSwipe({
                                   sheet,
                                   canStart,
                                   onDismiss
                               }) {
    if (!sheet) {
        return;
    }

    let activePointerId = null;

    let startY = 0;

    let currentY = 0;

    let dragging = false;


    function resetSheetPosition() {
        sheet.style.transition =
            `transform ${SHEET_RESET_DURATION}ms ease`;

        sheet.style.transform =
            "translateY(0)";

        window.setTimeout(
            () => {
                sheet.style.removeProperty(
                    "transition"
                );

                sheet.style.removeProperty(
                    "transform"
                );

                sheet.classList.remove(
                    "dragging"
                );
            },
            SHEET_RESET_DURATION
        );
    }


    function finishDismiss() {
        sheet.style.removeProperty(
            "transition"
        );

        sheet.style.removeProperty(
            "transform"
        );

        sheet.classList.remove(
            "dragging"
        );

        onDismiss?.();
    }


    sheet.addEventListener(
        "pointerdown",
        event => {
            if (
                event.pointerType ===
                "mouse" &&
                event.button !== 0
            ) {
                return;
            }

            if (
                typeof canStart ===
                "function" &&
                !canStart(event)
            ) {
                return;
            }

            activePointerId =
                event.pointerId;

            startY =
                event.clientY;

            currentY =
                startY;

            dragging = true;

            sheet.classList.add(
                "dragging"
            );

            sheet.style.transition =
                "none";

            try {
                sheet.setPointerCapture(
                    activePointerId
                );
            } catch {
                // Pointer capture may not
                // be available in every browser.
            }
        }
    );


    sheet.addEventListener(
        "pointermove",
        event => {
            if (
                !dragging ||
                event.pointerId !==
                activePointerId
            ) {
                return;
            }

            currentY =
                event.clientY;

            const distance =
                Math.max(
                    0,
                    currentY - startY
                );

            sheet.style.transform =
                `translateY(${distance}px)`;
        }
    );


    function endDrag(
        event
    ) {
        if (
            !dragging ||
            event.pointerId !==
            activePointerId
        ) {
            return;
        }

        const distance =
            Math.max(
                0,
                currentY - startY
            );

        dragging = false;

        try {
            if (
                sheet.hasPointerCapture(
                    activePointerId
                )
            ) {
                sheet.releasePointerCapture(
                    activePointerId
                );
            }
        } catch {
            // Safe fallback.
        }

        activePointerId = null;

        if (
            distance >=
            SHEET_DISMISS_DISTANCE
        ) {
            sheet.style.transition =
                `transform ${SHEET_RESET_DURATION}ms ease`;

            sheet.style.transform =
                "translateY(100%)";

            window.setTimeout(
                finishDismiss,
                SHEET_RESET_DURATION
            );

            return;
        }

        resetSheetPosition();
    }


    sheet.addEventListener(
        "pointerup",
        endDrag
    );

    sheet.addEventListener(
        "pointercancel",
        endDrag
    );
}


/* =========================
   PREVIEW CAROUSEL
========================= */

function setupPreviewCarousel() {
    document.getElementById("previewPromptButton")?.addEventListener("click", () => {
        const path = currentPreviewImages[currentPreviewIndex];
        openExpandedTextModal("Preview prompt", currentPreviewPrompts.get(path) || "No prompt available for this preview.", true);
    });
    previewSwipe ??= setupHorizontalPreviewSwipe(document.getElementById("detailsImageContainer"), {
        getRecord: () => currentLora, getIndex: () => currentPreviewIndex,
        getCount: () => currentPreviewImages.length, previous: showPreviousPreview, next: showNextPreview
    });
    const carousel = document.querySelector("#loraDetailsModal .details-carousel");
    carousel?.addEventListener("keydown", event => {
        if (event.target.tagName === "VIDEO" || currentPreviewImages.length <= 1) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            if (event.key === "ArrowLeft") showPreviousPreview();
            else showNextPreview();
        }
    });
    window.addEventListener("resize", () => {
        if (currentLora) sizePreviewLikeGalleryCard();
    });
    const previousButton =
        document.getElementById(
            "previousPreviewButton"
        );

    const nextButton =
        document.getElementById(
            "nextPreviewButton"
        );

    if (previousButton) {
        previousButton.addEventListener(
            "click",
            () => {
                showPreviousPreview();
            }
        );
    }

    if (nextButton) {
        nextButton.addEventListener(
            "click",
            () => {
                showNextPreview();
            }
        );
    }
}


function resetPreviewCarousel() {
    previewSwipe?.reset();
    currentPreviewImages = [];
    currentPreviewPrompts.clear();
    document.getElementById("previewPromptButton")?.classList.add("hidden");
    currentPreviewIndex = 0;

    const indicators =
        document.getElementById(
            "previewIndicators"
        );

    if (indicators) {
        indicators.innerHTML = "";
        indicators.classList.add("hidden");
        indicators.scrollLeft = 0;
    }
    const status = document.getElementById("previewStatus");
    if (status) status.textContent = "";

    updatePreviewNavigation();
}


async function loadPreviewCarousel(loraId, requestSequence = detailsRequestSequence) {
    if (!loraId) return;
    const primaryPath = currentLora?.filePath;
    const isCurrentRequest = () => requestSequence === detailsRequestSequence
            && String(currentLora?.id) === String(loraId)
            && !getLoraDetailsModal()?.classList.contains("closing");
    try {
        const response = await fetch(`${API_BASE_URL}/${loraId}/images`);
        if (!response.ok) throw new Error(`Unable to load previews (${response.status})`);
        const payload = await response.json();
        const previews = normalizePreviewResponse(payload);
        if (!isCurrentRequest()) return;
        currentPreviewPrompts.clear();
        const entries = Array.isArray(payload) ? payload : payload?.previews ?? [];
        entries.forEach(preview => {
            const path = preview?.filePath ?? preview?.url ?? preview?.path;
            if (path && typeof preview.prompt === "string") currentPreviewPrompts.set(path, preview.prompt);
        });
        // Historical LoRAs may only have a primary path; keep it first.
        currentPreviewImages = [...new Set([primaryPath, ...previews]
                .filter(path => typeof path === "string" && path.trim()))];
    } catch (error) {
        if (!isCurrentRequest()) return;
        console.debug("Unable to load preview carousel; using main preview:", error);
        currentPreviewPrompts.clear();
        currentPreviewImages = primaryPath ? [primaryPath] : [];
    }
    currentPreviewIndex = 0;
    renderCurrentPreview();
}


function sizePreviewLikeGalleryCard() {
    const modal = getLoraDetailsModal();
    const carousel = document.querySelector("#loraDetailsModal .details-carousel");
    if (!modal || !carousel) return;
    // Use the single-column gallery dimensions regardless of the selected display layout.
    const list = document.getElementById("loraList");
    const padding = list ? getComputedStyle(list) : null;
    const width = (list?.clientWidth ?? 0)
            - (parseFloat(padding?.paddingLeft) || 0) - (parseFloat(padding?.paddingRight) || 0);
    modal.style.setProperty("--preview-card-ratio", String(3 / 4));
    modal.style.setProperty("--preview-card-width", width > 0 ? `${width}px` : "100%");
    // Include the scroll area's gutter so it does not steal width from the image.
    const scrollArea = modal.querySelector(".lora-details-scroll-area");
    const scrollbarWidth = Math.max(0, (scrollArea?.offsetWidth ?? 0) - (scrollArea?.clientWidth ?? 0));
    modal.style.setProperty("--preview-scrollbar-width", `${scrollbarWidth}px`);
}


function normalizePreviewResponse(
    previewResponse
) {
    if (
        Array.isArray(
            previewResponse
        )
    ) {
        return previewResponse
            .map(
                preview => {
                    if (
                        typeof preview ===
                        "string"
                    ) {
                        return preview;
                    }

                    return (
                        preview?.filePath ??
                        preview?.url ??
                        preview?.path ??
                        null
                    );
                }
            )
            .filter(Boolean);
    }

    if (
        Array.isArray(
            previewResponse?.previews
        )
    ) {
        return normalizePreviewResponse(
            previewResponse.previews
        );
    }

    return [];
}


function renderCurrentPreview() {
    const promptButton = document.getElementById("previewPromptButton");
    promptButton?.classList.toggle("hidden", currentPreviewImages.length === 0);
    if (
        currentPreviewImages.length ===
        0
    ) {
        if (currentLora) {
            populateDetailsImage(
                currentLora
            );
        }

        renderPreviewIndicators();

        updatePreviewNavigation();

        return;
    }

    const previewPath =
        currentPreviewImages[
            currentPreviewIndex
            ];

    renderPreviewPath(
        previewPath
    );

    renderPreviewIndicators();

    updatePreviewNavigation();
}


function renderPreviewPath(previewPath) {
    const imageContainer = document.getElementById("detailsImageContainer");
    if (!imageContainer) return;
    imageContainer.querySelector("video")?.pause();
    document.getElementById("previewPromptButton")?.classList.remove("video-controls-active");
    imageContainer.replaceChildren();
    const placeholder = message => {
        const empty = document.createElement("div");
        empty.className = "lora-card-placeholder";
        empty.textContent = message;
        imageContainer.replaceChildren(empty);
    };
    if (!previewPath) {
        placeholder("No Preview");
        return;
    }
    const isVideo = isVideoPreview(previewPath);
    const media = document.createElement(isVideo ? "video" : "img");
    media.className = "details-image";
    let retriedSource = false;
    media.addEventListener("error", () => {
        if (!retriedSource && localPreviewUrl(previewPath) !== previewPath) {
            retriedSource = true;
            media.src = isVideo && !previewPath.includes("#") ? `${previewPath}#t=0.1` : previewPath;
            return;
        }
        // A late error from the previous preview must not replace the current one.
        if (media.parentElement === imageContainer) placeholder("Preview unavailable");
    });
    if (isVideo) {
        media.controls = true;
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.preload = "metadata";
        setupVideoPreviewPoster(media, previewPath);
        setupPreviewPromptVisibility(media);
    } else {
        media.alt = `${currentLora?.loraName || "LoRA"} — preview ${currentPreviewIndex + 1}`;
    }
    media.src = isVideo ? videoThumbnailUrl(previewPath) : localPreviewUrl(previewPath);
    imageContainer.appendChild(media);
    if (isVideo) media.play().catch(() => { /* Autoplay may be blocked. */ });
}


// Native controls have no visibility event. Follow the interactions that reveal
// them, then restore the info button after playback becomes idle.
function setupPreviewPromptVisibility(video) {
    const button = document.getElementById("previewPromptButton");
    if (!button) return;
    let idleTimer;
    const isCurrent = () => video.parentElement === document.getElementById("detailsImageContainer");
    const revealControls = () => {
        if (!isCurrent()) return;
        clearTimeout(idleTimer);
        button.classList.add("video-controls-active");
        if (!video.paused) {
            idleTimer = setTimeout(() => {
                if (isCurrent()) button.classList.remove("video-controls-active");
            }, 2500);
        }
    };
    ["pointermove", "pointerdown", "touchstart", "focus", "play", "pause", "seeking"].forEach(type =>
        video.addEventListener(type, revealControls));
    video.addEventListener("pointerleave", () => {
        clearTimeout(idleTimer);
        if (isCurrent() && !video.paused) button.classList.remove("video-controls-active");
    });
}


function showPreviousPreview() {
    if (
        currentPreviewImages.length <=
        1
    ) {
        return;
    }

    currentPreviewIndex =
        (
            currentPreviewIndex -
            1 +
            currentPreviewImages.length
        ) %
        currentPreviewImages.length;

    renderCurrentPreview();
}


function showNextPreview() {
    if (
        currentPreviewImages.length <=
        1
    ) {
        return;
    }

    currentPreviewIndex =
        (
            currentPreviewIndex +
            1
        ) %
        currentPreviewImages.length;

    renderCurrentPreview();
}


function updatePreviewNavigation() {
    const previousButton =
        document.getElementById(
            "previousPreviewButton"
        );

    const nextButton =
        document.getElementById(
            "nextPreviewButton"
        );

    const hasMultiplePreviews =
        currentPreviewImages.length > 1;

    previousButton?.classList.toggle(
        "hidden",
        !hasMultiplePreviews
    );

    nextButton?.classList.toggle(
        "hidden",
        !hasMultiplePreviews
    );

    if (previousButton) {
        previousButton.disabled =
            !hasMultiplePreviews;
    }

    if (nextButton) {
        nextButton.disabled =
            !hasMultiplePreviews;
    }
}


function renderPreviewIndicators() {
    const container = document.getElementById("previewIndicators");
    if (!container) return;
    container.classList.toggle("hidden", currentPreviewImages.length <= 1);
    // Retain the buttons during navigation so keyboard focus and scroll stay put.
    const needsRebuild = container.children.length !== currentPreviewImages.length
            || currentPreviewImages.some((path, index) => container.children[index]?.dataset.path !== path);
    if (needsRebuild) {
        container.replaceChildren();
        currentPreviewImages.forEach((path, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "preview-indicator-button";
            button.dataset.path = path;
            button.title = `Show ${isVideoPreview(path) ? "video" : "image"} ${index + 1}`;
            button.setAttribute("aria-label", button.title);
            button.setAttribute("aria-controls", "detailsImageContainer");
            const thumbnail = document.createElement(isVideoPreview(path) ? "video" : "img");
            if (isVideoPreview(path)) {
                thumbnail.muted = true;
                thumbnail.playsInline = true;
                thumbnail.preload = "metadata";
                thumbnail.tabIndex = -1;
                setupVideoPreviewPoster(thumbnail, path, {thumbnail: true});
                const badge = document.createElement("span");
                badge.className = "preview-video-badge";
                badge.textContent = "▶";
                badge.setAttribute("aria-hidden", "true");
                button.appendChild(badge);
            } else {
                thumbnail.alt = "";
                thumbnail.loading = "lazy";
            }
            thumbnail.setAttribute("aria-hidden", "true");
            let retriedSource = false;
            thumbnail.addEventListener("error", () => {
                if (!retriedSource && localPreviewUrl(path) !== path) {
                    retriedSource = true;
                    thumbnail.src = isVideoPreview(path) && !path.includes("#") ? `${path}#t=0.1` : path;
                    return;
                }
                thumbnail.remove();
                button.classList.add("preview-unavailable");
            });
            thumbnail.src = isVideoPreview(path) ? videoThumbnailUrl(path) : localPreviewUrl(path);
            button.appendChild(thumbnail);
            button.addEventListener("click", () => {
                currentPreviewIndex = index;
                renderCurrentPreview();
            });
            container.appendChild(button);
        });
    }
    [...container.children].forEach((button, index) => {
        const active = index === currentPreviewIndex;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        if (active && !container.classList.contains("hidden")) {
            // Scroll only the thumbnail strip, without moving the modal's content.
            if (button.offsetLeft < container.scrollLeft) container.scrollLeft = button.offsetLeft;
            else if (button.offsetLeft + button.offsetWidth > container.scrollLeft + container.clientWidth) {
                container.scrollLeft = button.offsetLeft + button.offsetWidth - container.clientWidth;
            }
        }
    });
    const status = document.getElementById("previewStatus");
    if (status) status.textContent = currentPreviewImages.length
            ? `Preview ${currentPreviewIndex + 1} of ${currentPreviewImages.length}` : "No previews";
}

/* =========================
   BACKUP EXPORT
========================= */

function setupBackupExport() {
    const exportButton =
        document.getElementById(
            "exportBackupButton"
        );

    if (!exportButton) {
        return;
    }

    exportButton.addEventListener(
        "click",
        async () => {
            const originalHtml =
                exportButton.innerHTML;

            exportButton.disabled =
                true;

            exportButton.textContent =
                "Exporting...";

            try {
                const response =
                    await fetch(
                        `${BACKUP_API_BASE_URL}/export`
                    );

                if (!response.ok) {
                    const details = await response.text();
                    throw new Error(`Backup export failed (HTTP ${response.status}). ${details}`);
                }

                const backupBlob =
                    await response.blob();

                const contentDisposition =
                    response.headers.get(
                        "Content-Disposition"
                    );

                const fileName =
                    getBackupFileName(
                        contentDisposition
                    );

                const downloadUrl =
                    URL.createObjectURL(
                        backupBlob
                    );

                const downloadLink =
                    document.createElement(
                        "a"
                    );

                downloadLink.href =
                    downloadUrl;

                downloadLink.download =
                    fileName;

                document.body.appendChild(
                    downloadLink
                );

                downloadLink.click();

                downloadLink.remove();

                URL.revokeObjectURL(
                    downloadUrl
                );

            } catch (error) {
                console.error(
                    "Backup export error:",
                    error
                );

                window.alert(
                    error.message || "Unable to export the backup."
                );

            } finally {
                exportButton.disabled =
                    false;

                exportButton.innerHTML =
                    originalHtml;
            }
        }
    );
}


function getBackupFileName(
    contentDisposition
) {
    if (!contentDisposition) {
        return (
            "comfy-model-library-backup.json"
        );
    }

    const utfMatch =
        contentDisposition.match(
            /filename\*=UTF-8''([^;]+)/i
        );

    if (utfMatch?.[1]) {
        try {
            return decodeURIComponent(
                utfMatch[1]
            );
        } catch {
            return utfMatch[1];
        }
    }

    const regularMatch =
        contentDisposition.match(
            /filename="?([^";]+)"?/i
        );

    if (regularMatch?.[1]) {
        return regularMatch[1];
    }

    return (
        "comfy-model-library-backup.json"
    );
}


/* =========================
   BACKUP IMPORT
========================= */

function setupBackupImport() {
    const importButton =
        document.getElementById(
            "importBackupButton"
        );

    const fileInput =
        document.getElementById(
            "backupFileInput"
        );

    if (
        !importButton ||
        !fileInput
    ) {
        return;
    }

    importButton.addEventListener(
        "click",
        () => {
            fileInput.value = "";

            fileInput.click();
        }
    );

    fileInput.addEventListener(
        "change",
        async () => {
            const backupFile =
                fileInput.files?.[0];

            if (!backupFile) {
                return;
            }

            const confirmed =
                window.confirm(
                    "Import this backup? Matching LoRAs will be updated using the backup. Missing fields in older backups will keep their existing values. Other LoRAs will remain."
                );

            if (!confirmed) {
                fileInput.value = "";

                return;
            }

            const originalHtml =
                importButton.innerHTML;

            importButton.disabled =
                true;

            importButton.textContent =
                "Importing...";

            try {
                const formData =
                    new FormData();

                formData.append(
                    "file",
                    backupFile
                );

                const response =
                    await fetch(
                        `${BACKUP_API_BASE_URL}/import`,
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                if (!response.ok) {
                    const errorMessage =
                        await response.text();

                    throw new Error(
                        errorMessage ||
                        `Backup import failed. Status: ${response.status}`
                    );
                }

                let result = null;

                const contentType =
                    response.headers.get(
                        "Content-Type"
                    );

                if (
                    contentType?.includes(
                        "application/json"
                    )
                ) {
                    result =
                        await response.json();

                } else {
                    result =
                        await response.text();
                }

                console.log(
                    "Backup import result:",
                    result
                );

                currentPage = 0;

                await refreshCurrentView();

                window.alert(
                    buildBackupImportMessage(
                        result
                    )
                );

            } catch (error) {
                console.error(
                    "Backup import error:",
                    error
                );

                window.alert(
                    error.message || "Unable to import the backup."
                );

            } finally {
                importButton.disabled =
                    false;

                importButton.innerHTML =
                    originalHtml;

                fileInput.value = "";
            }
        }
    );
}


function buildBackupImportMessage(
    result
) {
    if (
        !result ||
        typeof result !== "object"
    ) {
        if (
            typeof result === "string" &&
            result.trim() !== ""
        ) {
            return result;
        }

        return "Backup imported successfully.";
    }

    const imported =
        result.importedCount ??
        result.imported ??
        0;

    const skipped =
        result.skippedCount ??
        result.skipped ??
        0;

    const failed =
        result.failedCount ??
        result.failed ??
        0;

    return (
        "Backup import complete.\n\n" +
        `Imported: ${imported}\n` +
        `Updated: ${result.updatedCount ?? 0}\n` +
        `Skipped: ${skipped}\n` +
        `Failed: ${failed}`
    );
}


/* =========================
   EXPANDED TEXT MODAL
========================= */

function setupExpandedTextModal() {
    const modal =
        document.getElementById(
            "expandedTextModal"
        );

    const closeButton =
        document.getElementById(
            "closeExpandedTextButton"
        );

    if (
        !modal ||
        !closeButton
    ) {
        return;
    }

    closeButton.addEventListener(
        "click",
        closeExpandedTextModal
    );

    modal.addEventListener(
        "click",
        event => {
            if (
                event.target === modal
            ) {
                closeExpandedTextModal();
            }
        }
    );

    document.addEventListener(
        "click",
        event => {
            const expandButton =
                event.target.closest(
                    ".expand-field-button"
                );

            if (!expandButton) {
                return;
            }

            const targetId =
                expandButton.dataset
                    .expandTarget;

            if (!targetId) {
                return;
            }

            const target =
                document.getElementById(
                    targetId
                );

            if (!target) {
                return;
            }

            const title =
                expandButton.dataset
                    .expandTitle ||
                "Details";

            openExpandedTextModal(
                title,
                target.textContent.trim()
            );
        }
    );
}


function openExpandedTextModal(
    title,
    text,
    isPreviewPrompt = false
) {
    const modal =
        document.getElementById(
            "expandedTextModal"
        );

    const titleElement =
        document.getElementById(
            "expandedTextTitle"
        );

    const contentElement =
        document.getElementById(
            "expandedTextContent"
        );

    if (
        !modal ||
        !titleElement ||
        !contentElement
    ) {
        return;
    }

    document.getElementById("closeExpandedTextButton")?.classList.toggle("hidden", isPreviewPrompt);
    const copyButton = document.getElementById("copyPreviewPromptButton");
    copyButton?.classList.toggle("hidden", !isPreviewPrompt);
    if (copyButton) {
        copyButton.title = "Copy preview prompt";
        copyButton.setAttribute("aria-label", "Copy preview prompt");
    }

    titleElement.textContent =
        title || "Details";

    contentElement.textContent =
        text || "Not provided";

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";
}


function closeExpandedTextModal() {
    const modal =
        document.getElementById(
            "expandedTextModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    /*
     * Keep body scrolling disabled if the
     * LoRA details modal is still open.
     */
    const detailsModal =
        document.getElementById(
            "loraDetailsModal"
        );

    if (
        !detailsModal ||
        detailsModal.classList.contains(
            "hidden"
        )
    ) {
        document.body.style.overflow =
            "";
    }
}


/* =========================
   SORT PARAMETERS
========================= */

function buildSortParameters() {
    if (
        !appliedSortBy ||
        !appliedSortDirection
    ) {
        return {};
    }

    return {
        sortBy:
        appliedSortBy,

        sortDirection:
        appliedSortDirection
    };
}


/* =========================
   SORT MODAL
========================= */

const gallerySort = createGallerySort({
    getState: () => ({field: appliedSortBy, direction: appliedSortDirection}),
    apply: applySort,
    reset: resetSort,
    label: "Sort LoRAs"
});

function setupSortModal() { gallerySort.setup(); }
function openSortModal() { gallerySort.open(); }
function closeSortModal() { gallerySort.close(); }


/* =========================
   APPLY SORT
========================= */

async function applySort(
    sortField
) {
    if (!sortField) {
        return;
    }

    /*
     * Clicking the currently selected field
     * toggles its direction.
     *
     * Selecting a different field always
     * begins ascending.
     */
    if (
        appliedSortBy === sortField
    ) {
        appliedSortDirection =
            appliedSortDirection === "asc"
                ? "desc"
                : "asc";

    } else {
        appliedSortBy =
            sortField;

        appliedSortDirection =
            "asc";
    }

    currentPage = 0;

    updateSortDisplay();

    closeSortModal();

    try {
        await refreshCurrentView();

        scrollToLoraGalleryControls();

    } catch (error) {
        console.error(
            "Unable to apply sort:",
            error
        );
    }
}


/* =========================
   SORT DISPLAY
========================= */

async function resetSort() {
    appliedSortBy = null;
    appliedSortDirection = null;
    currentPage = 0;
    updateSortDisplay();
    closeSortModal();
    await refreshCurrentView();
}

function updateSortDisplay() { gallerySort.update(); }


/* =========================
   BOTTOM SHEET SWIPE HELPERS
========================= */

/* =========================
   FILTER SHEET SWIPE
========================= */

function setupFilterSheetSwipe() {
    const filterModal =
        document.getElementById(
            "filterModal"
        );

    const filterSheet =
        filterModal?.querySelector(
            ".filter-sheet"
        );

    setupSwipeDownToClose(
        filterSheet,
        null,
        closeFilterModal
    );
}


/* =========================
   LORA DETAILS DRAG CLOSE
========================= */

function finishDraggedLoraDetailsClose() {
    const modal =
        document.getElementById(
            "loraDetailsModal"
        );

    const modalSheet =
        modal?.querySelector(
            ".lora-details-sheet"
        );

    const video =
        document.querySelector(
            "#detailsImageContainer video"
        );

    if (
        !modal ||
        !modalSheet
    ) {
        return;
    }

    finishClosingLoraDetailsModal(
        modal,
        modalSheet
    );

    currentLora = null;
    isEditingLora = false;

    clearEditMessage();

    if (video) {
        video.pause();
        video.currentTime = 0;
    }
}


/* =========================
   LORA DETAILS SWIPE
========================= */

function setupLoraDetailsSwipe() {
    const modal =
        document.getElementById(
            "loraDetailsModal"
        );

    const modalSheet =
        modal?.querySelector(
            ".lora-details-sheet"
        );

    const scrollContainer =
        getLoraDetailsScrollContainer();

    loraDetailsSwipe = setupSwipeDownToClose(
        modalSheet,
        scrollContainer,
        finishDraggedLoraDetailsClose,
        {allowVideoSwipe: true}
    );
}
// Returning through browser Back may restore a cached document rather than rerun startup.
window.addEventListener("pageshow", event => {
    if (event.persisted) refreshCurrentView();
});
