const API_BASE_URL = "/api/loras";


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
let pageSize = DEFAULT_PAGE_SIZE;
let totalPages = 0;
let totalElements = 0;


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
let appliedSubcategoryFilter = "ALL";


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
let currentPreviewIndex = 0;


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
            appliedSortBy = ["loraName", "creator", "createdDate"].includes(saved.sortBy) ? saved.sortBy : null;
            appliedSortDirection = saved.sortDirection === "desc" ? "desc" : "asc";
            appliedBaseModelFilter = saved.baseModel || "ALL";
            appliedCategoryFilter = saved.category || "ALL";
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


    const imageHtml =
        lora.filePath

            ? isVideoPreview(
                lora.filePath
            )

                ? `
                    <video
                        class="lora-card-image"
                        src="${lora.filePath}"
                        muted
                        loop
                        playsinline
                        preload="auto"
                    ></video>
                  `

                : `
                    <img
                        class="lora-card-image"
                        src="${lora.filePath}"
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

        await refreshCurrentView();

    } catch (error) {
        console.error(
            "Error toggling favorite:",
            error
        );
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
            appliedCategoryFilter ===
            "FAVORITES"
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

    /*
     * Favorites is represented by the
     * special FAVORITES category value.
     */
    if (
        appliedCategoryFilter ===
        "FAVORITES"
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


function closeActionMenu() {
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

function setupFilterModal() {
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
        () => {
            baseModelFilter.value =
                appliedBaseModelFilter;

            categoryFilter.value =
                appliedCategoryFilter;

            subcategoryFilter.value =
                appliedSubcategoryFilter;

            openFilterModal();
        }
    );

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

    appliedCategoryFilter =
        categoryFilter.value;

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
                buildSortParameters()
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
    const singleButton =
        document.getElementById(
            "singleColumnButton"
        );

    const doubleButton =
        document.getElementById(
            "doubleColumnButton"
        );

    const loraList =
        document.getElementById(
            "loraList"
        );

    if (
        !singleButton ||
        !doubleButton ||
        !loraList
    ) {
        return;
    }

    singleButton.addEventListener(
        "click",
        () => {
            loraList.classList.remove(
                "double-column"
            );

            loraList.classList.add(
                "single-column"
            );

            singleButton.classList.add(
                "active"
            );

            doubleButton.classList.remove(
                "active"
            );
        }
    );

    doubleButton.addEventListener(
        "click",
        () => {
            loraList.classList.remove(
                "single-column"
            );

            loraList.classList.add(
                "double-column"
            );

            doubleButton.classList.add(
                "active"
            );

            singleButton.classList.remove(
                "active"
            );
        }
    );
}

/* =========================
   LORA DETAILS MODAL
========================= */

function setupLoraDetailsModal() {
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

    editButton.addEventListener(
        "click",
        openEditLoraPage
    );
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

        currentLora =
            await response.json();

        const modal =
            getLoraDetailsModal();
        loraDetailsSwipe?.reset();

        if (!modal) {
            throw new Error(
                "LoRA details modal was not found."
            );
        }

        populateLoraDetailsModal(
            currentLora
        );

        resetPreviewCarousel();

        const modalSheet =
            modal.querySelector(
                ".lora-details-sheet"
            );

        modal.classList.remove(
            "hidden",
            "closing"
        );
        modal.setAttribute("aria-hidden", "false");

        restartLoraModalOpeningAnimation(
            modalSheet
        );

        resetLoraDetailsScrollPosition();

        await loadPreviewCarousel(
            currentLora.id
        );

    } catch (error) {
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

    let closingFinished = false;

    function finishCloseAnimation() {
        if (closingFinished) {
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
        "No positive prompt saved."
    );

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

function populateDetailsImage(
    lora
) {
    const imageContainer =
        document.getElementById(
            "detailsImageContainer"
        );

    if (!imageContainer) {
        return;
    }

    if (!lora.filePath) {
        imageContainer.innerHTML = `
            <div class="lora-card-placeholder">
                No Preview
            </div>
        `;

        return;
    }

    if (
        isVideoPreview(
            lora.filePath
        )
    ) {
        imageContainer.innerHTML = `
            <video
                src="${lora.filePath}"
                class="details-image"
                controls
                muted
                loop
                playsinline
                preload="metadata"
            >
                Your browser cannot play this video preview.
            </video>
        `;

        const video =
            imageContainer.querySelector(
                "video"
            );

        if (video) {
            video
                .play()
                .catch(
                    error => {
                        console.debug(
                            "Video autoplay prevented:",
                            error
                        );
                    }
                );
        }

        return;
    }

    imageContainer.innerHTML = `
        <img
            src="${lora.filePath}"
            alt="${lora.loraName || "LoRA Preview"}"
            class="details-image"
        >
    `;
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
    }

    window.clearTimeout(
        Number(
            button.dataset.resetTimer
        )
    );

    button.textContent =
        message;

    button.disabled = true;

    const timer =
        window.setTimeout(
            () => {
                button.textContent =
                    button.dataset.originalText;

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
            : DEFAULT_PAGE_SIZE;

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

    pageIndicator.textContent =
        `Page ${currentPage + 1} of ${totalPages}`;
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
    currentPreviewImages = [];
    currentPreviewIndex = 0;

    const indicators =
        document.getElementById(
            "previewIndicators"
        );

    if (indicators) {
        indicators.innerHTML = "";
    }

    updatePreviewNavigation();
}


async function loadPreviewCarousel(
    loraId
) {
    if (!loraId) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/${loraId}/previews`
            );

        if (!response.ok) {
            /*
             * Older LoRAs or backend
             * configurations may not have
             * the preview endpoint.
             * Fall back to the main preview.
             */
            currentPreviewImages =
                currentLora?.filePath
                    ? [
                        currentLora.filePath
                    ]
                    : [];

            currentPreviewIndex = 0;

            renderCurrentPreview();

            return;
        }

        const previewResponse =
            await response.json();

        currentPreviewImages =
            normalizePreviewResponse(
                previewResponse
            );

        if (
            currentPreviewImages.length ===
            0 &&
            currentLora?.filePath
        ) {
            currentPreviewImages = [
                currentLora.filePath
            ];
        }

        currentPreviewIndex = 0;

        renderCurrentPreview();

    } catch (error) {
        console.error(
            "Unable to load preview carousel:",
            error
        );

        currentPreviewImages =
            currentLora?.filePath
                ? [
                    currentLora.filePath
                ]
                : [];

        currentPreviewIndex = 0;

        renderCurrentPreview();
    }
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


function renderPreviewPath(
    previewPath
) {
    const imageContainer =
        document.getElementById(
            "detailsImageContainer"
        );

    if (!imageContainer) {
        return;
    }

    if (!previewPath) {
        imageContainer.innerHTML = `
            <div class="lora-card-placeholder">
                No Preview
            </div>
        `;

        return;
    }

    if (
        isVideoPreview(
            previewPath
        )
    ) {
        imageContainer.innerHTML = `
            <video
                src="${previewPath}"
                class="details-image"
                controls
                muted
                loop
                playsinline
                preload="metadata"
            >
                Your browser cannot play this video preview.
            </video>
        `;

        const video =
            imageContainer.querySelector(
                "video"
            );

        if (video) {
            video
                .play()
                .catch(
                    () => {
                        // Autoplay may be blocked.
                    }
                );
        }

        return;
    }

    imageContainer.innerHTML = `
        <img
            src="${previewPath}"
            alt="${currentLora?.loraName || "LoRA Preview"}"
            class="details-image"
        >
    `;
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
    const indicatorContainer =
        document.getElementById(
            "previewIndicators"
        );

    if (!indicatorContainer) {
        return;
    }

    indicatorContainer.innerHTML = "";

    if (
        currentPreviewImages.length <=
        1
    ) {
        indicatorContainer.classList.add(
            "hidden"
        );

        return;
    }

    indicatorContainer.classList.remove(
        "hidden"
    );

    currentPreviewImages.forEach(
        (_, index) => {
            const indicator =
                document.createElement(
                    "button"
                );

            indicator.type =
                "button";

            indicator.className =
                "preview-indicator-button";

            indicator.setAttribute(
                "aria-label",
                `Show preview ${index + 1}`
            );

            indicator.classList.toggle(
                "active",
                index ===
                currentPreviewIndex
            );

            indicator.addEventListener(
                "click",
                () => {
                    currentPreviewIndex =
                        index;

                    renderCurrentPreview();
                }
            );

            indicatorContainer.appendChild(
                indicator
            );
        }
    );
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
            const originalText =
                exportButton.textContent;

            exportButton.disabled =
                true;

            exportButton.textContent =
                "Exporting...";

            try {
                const response =
                    await fetch(
                        `${API_BASE_URL}/backup/export`
                    );

                if (!response.ok) {
                    throw new Error(
                        `Backup export failed. Status: ${response.status}`
                    );
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
                    "Unable to export the backup."
                );

            } finally {
                exportButton.disabled =
                    false;

                exportButton.textContent =
                    originalText;
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
                    "Import this backup? Existing LoRAs will remain and duplicate name/version entries will be skipped."
                );

            if (!confirmed) {
                fileInput.value = "";

                return;
            }

            const originalText =
                importButton.textContent;

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
                        `${API_BASE_URL}/backup/import`,
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
                    "Unable to import the backup."
                );

            } finally {
                importButton.disabled =
                    false;

                importButton.textContent =
                    originalText;

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
    text
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
        finishDraggedLoraDetailsClose
    );
}
// Returning through browser Back may restore a cached document rather than rerun startup.
window.addEventListener("pageshow", event => {
    if (event.persisted) refreshCurrentView();
});
