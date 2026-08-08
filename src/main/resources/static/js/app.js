const API_BASE_URL = "/api/loras";

let currentLora = null;
let isEditingLora = false;

const DEFAULT_PAGE_SIZE = 12;

let currentPage = 0;
let pageSize = DEFAULT_PAGE_SIZE;
let totalPages = 0;
let totalElements = 0;

let currentSearchResults = [];
let isSearchActive = false;

let appliedBaseModelFilter = "ALL"
let appliedCategoryFilter = "ALL";
let appliedSubcategoryFilter = "ALL";

let pageBeforeSearch = 0;
let scrollPositionBeforeSearch = 0;

let searchDebounceTimer = null;
let lastSearchKeyword = "";

const SEARCH_DEBOUNCE_DELAY = 400;
const MINIMUM_SEARCH_LENGTH = 2;

const SHEET_DISMISS_DISTANCE = 120;
const SHEET_RESET_DURATION = 180;

let currentPreviewImages = [];
let currentPreviewIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
    if (getRequestedLoraId()) {
        document.body.classList.add(
            "returning-to-modal"
        );
    }
    setupLayoutButtons();
    setupSearch();
    setupGoToTopButton();

    setupFilterModal();
    setupFilterSheetSwipe();

    setupLoraDetailsModal();
    setupLoraDetailsSwipe();
    setupPreviewCarousel();

    setupSearchOverlay();
    setupActionMenu();
    setupImportFolderForm();
    setupMenu();
    setupPaginationControls();


    await fetchAllLoras(0);

    await reopenRequestedLoraModal();

});

async function fetchAllLoras(page) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const url = buildLoraPageUrl(page, pageSize);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Failed to fetch LoRAs");
        }

        const pageResponse = await response.json();

        validateLoraPageResponse(pageResponse);
        updatePaginationState(pageResponse);
        updatePaginationControls();

        if (pageResponse.content.length === 0) {
            displayEmptyGalleryMessage();
            return;
        }

        renderLoraPage(pageResponse.content);

    } catch (error) {
        displayGalleryError(error);
    }
}

function displayLoras(loras) {
    const loraList = document.getElementById("loraList");

    loraList.innerHTML = "";

    if (!loras || loras.length === 0) {
        loraList.innerHTML = `
            <p class="empty-message">
                No LoRAs found.
            </p>
        `;
        return;
    }

    loras.forEach(lora => {
        loraList.appendChild(createLoraCard(lora));
    });
}

function createLoraCard(lora) {
    const card = document.createElement("article");
    card.className = "lora-card";

    const imageHtml = lora.filePath
        ? isVideoPreview(lora.filePath)
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

        <button class="favorite-button" aria-label="Toggle favorite">
            ${lora.favorite ? "★" : "☆"}
        </button>

        <div class="lora-card-header">
            <p class="lora-meta">
                ${lora.creator ? lora.creator : "Unknown creator"}
            </p>

            <h2>${lora.loraName ?? "Untitled LoRA"}</h2>
        </div>
    `;

    const previewVideo =
        card.querySelector("video.lora-card-image");


    if (previewVideo) {
        setupGalleryVideoPreview(card, previewVideo);

    }



    card.addEventListener("click", () => {
        openLoraDetailsModal(lora.id);
    });

    const favoriteButton = card.querySelector(".favorite-button");

    favoriteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        await toggleFavorite(lora.id);
    });

    return card;
}

async function toggleFavorite(loraId) {
    try {
        const response = await fetch(`${API_BASE_URL}/${loraId}/favorite`, {
            method: "PUT"
        });

        if (!response.ok) {
            throw new Error("Failed to toggle favorite");
        }

        await refreshCurrentView();

    } catch (error) {
        console.error("Error toggling favorite:", error);
    }
}

function clearSearchDebounceTimer() {
    if (searchDebounceTimer === null) {
        return;
    }

    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
}

async function performSearchFromInput() {
    const searchInput =
        document.getElementById("searchInput");

    if (!searchInput) {
        return;
    }

    const keyword = searchInput.value.trim();

    if (keyword === "") {
        return;
    }

    if (keyword.length < MINIMUM_SEARCH_LENGTH) {
        return;
    }

    if (
        keyword === lastSearchKeyword &&
        isSearchActive
    ) {
        return;
    }

    lastSearchKeyword = keyword;

    await searchLoras(keyword, 0);
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

    window.requestAnimationFrame(() => {
        window.scrollTo({
            top: restoredScrollPosition,
            behavior: "auto"
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById("searchInput");

    if (!searchInput) {
        return;
    }

    searchInput.addEventListener("input", () => {
        clearSearchDebounceTimer();

        searchDebounceTimer = window.setTimeout(
            async () => {
                await performSearchFromInput();
            },
            SEARCH_DEBOUNCE_DELAY
        );
    });

    searchInput.addEventListener("keydown", async event => {
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
    });
}

function setupSearchOverlay() {
    const searchButton =
        document.getElementById("searchIconButton");

    const closeButton =
        document.getElementById("closeSearchButton");

    const searchOverlay =
        document.getElementById("searchOverlay");

    const searchInput =
        document.getElementById("searchInput");

    if (
        !searchButton ||
        !closeButton ||
        !searchOverlay ||
        !searchInput
    ) {
        return;
    }

    searchButton.addEventListener("click", () => {
        if (!isSearchActive) {
            pageBeforeSearch = currentPage;
            scrollPositionBeforeSearch = window.scrollY;
        }

        searchOverlay.classList.remove("hidden");
        searchInput.focus();
    });

    closeButton.addEventListener("click", async () => {
        clearSearchDebounceTimer();
        await clearSearch();
    });
}

function setupActionMenu() {
    const openButton = document.getElementById("openActionMenuButton");
    const overlay = document.getElementById("actionMenuOverlay");
    const popover = document.getElementById("actionMenuPopover");
    const addButton = document.getElementById("addLoraActionButton");
    const importButton = document.getElementById("showImportFolderButton");
    const importForm = document.getElementById("importFolderForm");
    const importResult = document.getElementById("importResult");

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

    openButton.addEventListener("click", event => {
        event.stopPropagation();
        overlay.classList.toggle("hidden");
    });

    popover.addEventListener("click", event => {
        event.stopPropagation();
    });

    overlay.addEventListener("click", closeActionMenu);

    addButton.addEventListener("click", () => {
        window.location.href = "/html/add-lora.html";
    });

    importButton.addEventListener("click", () => {
        importForm.classList.toggle("hidden");

        if (importResult) {
            importResult.classList.add("hidden");
            importResult.innerHTML = "";
        }

        if (!importForm.classList.contains("hidden")) {
            document.getElementById("importFolderPath")?.focus();
        }
    });
}

function closeActionMenu() {
    const overlay = document.getElementById("actionMenuOverlay");
    const importForm = document.getElementById("importFolderForm");
    const importResult = document.getElementById("importResult");

    overlay?.classList.add("hidden");
    importForm?.classList.add("hidden");

    if (importResult) {
        importResult.classList.add("hidden");
        importResult.innerHTML = "";
    }
}

function setupGoToTopButton() {
    const goTopButton = document.getElementById("goTopButton");

    if (!goTopButton) {
        return;
    }

    function updateGoTopVisibility() {
        if (window.scrollY > 500) {
            goTopButton.classList.remove("hidden");
        } else {
            goTopButton.classList.add("hidden");
        }
    }

    window.addEventListener("scroll", updateGoTopVisibility);

    goTopButton.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });

    updateGoTopVisibility();
}

async function refreshCurrentView() {
    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const keyword =
        searchInput?.value.trim() ?? "";

    if (
        isSearchActive &&
        keyword.length >= MINIMUM_SEARCH_LENGTH
    ) {
        await searchLoras(
            keyword,
            currentPage
        );

        return;
    }

    if (
        appliedCategoryFilter ===
        "FAVORITES"
    ) {
        await fetchFavoriteLoras(
            currentPage
        );

        return;
    }

    if (hasActiveGalleryFilters()) {
        await fetchFilteredLoras(
            currentPage
        );

        return;
    }

    await fetchAllLoras(
        currentPage
    );
}

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

async function searchLoras(
    keyword,
    page = currentPage
) {
    try {
        const normalizedKeyword = keyword.trim();

        if (
            normalizedKeyword.length <
            MINIMUM_SEARCH_LENGTH
        ) {
            return;
        }

        const url = buildPaginatedUrl(
            "/search",
            page,
            pageSize,
            {
                keyword: normalizedKeyword
            }
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Search failed. Status: ${response.status}`
            );
        }

        const pageResponse = await response.json();

        isSearchActive = true;
        lastSearchKeyword = normalizedKeyword;

        displayPaginatedLoraResponse(pageResponse);

    } catch (error) {
        console.error(
            "Search error:",
            error
        );

        isSearchActive = false;
        displayGalleryError(error);
    }
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

    modal.classList.remove("hidden");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    openButton?.setAttribute(
        "aria-expanded",
        "true"
    );

    window.requestAnimationFrame(() => {
        baseModelFilter?.focus();
    });
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
     * Move focus outside the modal before hiding it.
     */
    openButton?.focus();

    modal.classList.add("hidden");

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

function getActiveFilterCount() {
    let activeCount = 0;

    if (appliedBaseModelFilter !== "ALL") {
        activeCount += 1;
    }

    if (appliedCategoryFilter !== "ALL") {
        activeCount += 1;
    }

    if (appliedSubcategoryFilter !== "ALL") {
        activeCount += 1;
    }


    return activeCount;
}

function hasActiveGalleryFilters() {
    return getActiveFilterCount() > 0;
}

function buildFilterParameters() {
    const parameters = {};

    if (appliedBaseModelFilter !== "ALL") {
        parameters.baseModel =
            appliedBaseModelFilter;
    }

    if (
        appliedCategoryFilter !== "ALL" &&
        appliedCategoryFilter !== "FAVORITES"
    ) {
        parameters.category =
            appliedCategoryFilter;
    }

    if (appliedSubcategoryFilter !== "ALL") {
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

    if (!openButton || !countBadge) {
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

function resetFilterSelection() {
    const {
        baseModelFilter,
        categoryFilter,
        subcategoryFilter
    } = getFilterElements();

    if (baseModelFilter) {
        baseModelFilter.value = "ALL";
    }

    if (categoryFilter) {
        categoryFilter.value = "ALL";
    }

    if (subcategoryFilter) {
        subcategoryFilter.value = "ALL";
    }
}

function renderSearchResultsPage(page) {
    const resultCount = currentSearchResults.length;

    totalElements = resultCount;
    pageSize = DEFAULT_PAGE_SIZE;
    totalPages = Math.ceil(resultCount / pageSize);

    if (totalPages === 0) {
        currentPage = 0;
    } else {
        currentPage = Math.min(
            Math.max(page,0),
            totalPages - 1
        );
    }

    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;

    const pageResults = currentSearchResults.slice(startIndex, endIndex);

    displayLoras(pageResults);
    updatePaginationControls();
}

async function fetchLorasByCategory(
    category,
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const encodedCategory =
            encodeURIComponent(category);

        const url = buildPaginatedUrl(
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

        displayGalleryError(error);
    }
}

async function fetchFavoriteLoras(
    page = currentPage
) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const url = buildPaginatedUrl(
            "/favorites",
            page,
            pageSize
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

        displayGalleryError(error);
    }
}

async function fetchFilteredLoras(page = currentPage) {
    isSearchActive = false;
    currentSearchResults = [];

    try {
        const filterParameters = buildFilterParameters();

        const url = buildPaginatedUrl("/filter", page, pageSize, filterParameters);

        await fetchPaginatedLoras(url, "Failed to fetch filtered LoRAs");
    } catch (error) {
        console.error("Gallery filter error: ", error);

        displayGalleryError(error);
    }
}


function setupLayoutButtons() {
    const singleButton = document.getElementById("singleColumnButton");
    const doubleButton = document.getElementById("doubleColumnButton");
    const loraList = document.getElementById("loraList");

    if (!singleButton || !doubleButton || !loraList) {
        return;
    }

    singleButton.addEventListener("click", () => {
        loraList.classList.remove("double-column");
        loraList.classList.add("single-column");

        singleButton.classList.add("active");
        doubleButton.classList.remove("active");
    });

    doubleButton.addEventListener("click", () => {
        loraList.classList.remove("single-column");
        loraList.classList.add("double-column");

        doubleButton.classList.add("active");
        singleButton.classList.remove("active");
    });
}

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
            if (event.target === modalOverlay) {
                closeLoraDetailsModal();
            }
        }
    );

    editButton.addEventListener(
        "click",
        openEditLoraPage
    );
}

async function saveLoraEdit() {
    if (!currentLora?.id) {
        displayEditMessage(
            "Unable to determine which LoRA is being edited.",
            true
        );
        return;
    }

    const requestBody = buildLoraUpdateRequest();
    const validationError =
        validateLoraUpdate(requestBody);

    if (validationError) {
        displayEditMessage(validationError, true);
        return;
    }

    const saveButton =
        document.getElementById("saveLoraEditButton");

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/${currentLora.id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
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

        currentLora = await response.json();

        populateLoraDetailsModal(currentLora);
        exitLoraEditMode();

        displayEditMessage(
            "LoRA updated successfully."
        );

    } catch (error) {
        console.error("LoRA update error:", error);

        displayEditMessage(
            "Unable to save the LoRA. Check the backend logs.",
            true
        );

        return;

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
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

function displayEditMessage(message, isError = false) {
    const messageElement =
        document.getElementById("detailsEditMessage");

    if (!messageElement) {
        return;
    }

    messageElement.textContent = message;
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
        document.getElementById("detailsEditMessage");

    if (!messageElement) {
        return;
    }

    messageElement.textContent = "";
    messageElement.classList.add("hidden");
    messageElement.classList.remove(
        "details-edit-message-error",
        "details-edit-message-success"
    );
}

function getLoraDetailsModal() {
    return document.getElementById("loraDetailsModal");
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

    window.requestAnimationFrame(() => {
        scrollContainer.scrollTo({
            top: 0,
            left: 0,
            behavior: "auto"
        });
    });
}

/* =========================
   RETURNED LORA MODAL HELPERS
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

    // Force the browser to recognize the class removal.
    void modalSheet.offsetWidth;

    modalSheet.classList.add("opening");

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


async function openLoraDetailsModal(loraId) {
    try {
        const response = await fetch(`${API_BASE_URL}/${loraId}`);

        if (!response.ok) {
            throw new Error("Failed to load LoRA details");
        }

        currentLora = await response.json();

        const modal = getLoraDetailsModal();

        if (!modal) {
            throw new Error("LoRA details modal was not found.");
        }

        populateLoraDetailsModal(currentLora);
        resetPreviewCarousel();

        const modalSheet = modal.querySelector(".lora-details-sheet");

        modal.classList.remove("hidden", "closing");

        restartLoraModalOpeningAnimation(modalSheet);
        resetLoraDetailsScrollPosition();

        await loadPreviewCarousel(currentLora.id);

    } catch (error) {
        console.error("Error loading LoRA details:", error);
        alert("Unable to load LoRA details.");
    }
}

function finishClosingLoraDetailsModal(
    modal,
    modalSheet
) {
    modal.classList.add("hidden");

    modal.classList.remove("closing");

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

    if (!modal || !modalSheet) {
        return;
    }

    if (
        modal.classList.contains("hidden") ||
        modal.classList.contains("closing")
    ) {
        return;
    }

    modal.classList.add("closing");
    modalSheet.classList.add("closing");

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

function populateLoraDetailsModal(lora) {
    document.getElementById("detailsLoraName").textContent =
        lora.loraName || "Untitled LoRA";

    document.getElementById("detailsCreator").textContent =
        lora.creator ? `by ${lora.creator}` : "Unknown creator";

    document.getElementById("detailsVersion").textContent =
        lora.version || "N/A";

    document.getElementById("detailsCategory").textContent =
        lora.category || "N/A";

    document.getElementById("detailsSubCategory").textContent =
        lora.subCategory || "N/A";

    document.getElementById("detailsBaseModel").textContent =
        lora.baseModel || "N/A";

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
        typeof lora.negativePrompt === "string" &&
        lora.negativePrompt.trim() !== "";

    const hasNotes =
        typeof lora.notes === "string" &&
        lora.notes.trim() !== "";

    if (additionalDetails) {
        additionalDetails.hidden =
            !hasNegativePrompt && !hasNotes;

        additionalDetails.open = false;
    }
    populateDetailsUrl(lora);
}

function populateDetailsImage(lora) {
    const imageContainer =
        document.getElementById("detailsImageContainer");

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

    if (isVideoPreview(lora.filePath)) {
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

        const video = imageContainer.querySelector("video");

        if (video) {
            video.play().catch(error => {
                console.debug(
                    "Video autoplay prevented:",
                    error
                );
            });
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

function populateDetailsUrl(lora) {
    const urlLink = document.getElementById("detailsUrl");

    if (!urlLink) {
        return;
    }

    if (lora.url) {
        urlLink.href = lora.url;
        urlLink.textContent = lora.url;
        urlLink.title = lora.url;
        urlLink.classList.remove("hidden");
    } else {
        urlLink.href = "#";
        urlLink.textContent = "N/A";
        urlLink.removeAttribute("title");
        urlLink.classList.remove("hidden");
    }
}

function enterLoraEditMode() {
    if (!currentLora) {
        return;
    }

    isEditingLora = true;

    populateLoraEditFields(currentLora);
    setLoraEditVisibility(true);

    const nameInput =
        document.getElementById("editLoraName");

    if (nameInput) {
        nameInput.focus({
            preventScroll: true
        });
    }
}

function setLoraEditVisibility(editing) {
    toggleHidden("detailsHeaderView", editing);
    toggleHidden("detailsHeaderEdit", !editing);

    toggleHidden("detailsInfoView", editing);
    toggleHidden("detailsInfoEdit", !editing);

    toggleHidden("detailsPromptView", editing);
    toggleHidden("detailsPromptEdit", !editing);

    toggleHidden("detailsEditActionBar", !editing);

    const urlLink = document.getElementById("detailsUrl");

    if (urlLink) {
        const shouldHideUrl =
            editing || !currentLora?.url;

        urlLink.classList.toggle(
            "hidden",
            shouldHideUrl
        );
    }
}

function toggleHidden(elementId, shouldHide) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.classList.toggle("hidden", shouldHide);
}

function cancelLoraEdit() {
    if (!currentLora) {
        return;
    }

    populateLoraEditFields(currentLora);
    exitLoraEditMode();
}

function exitLoraEditMode() {
    isEditingLora = false;
    setLoraEditVisibility(false);
    clearEditMessage();
}

function buildEditLoraPageUrl(loraId) {
    const queryParameters = new URLSearchParams({id: String(loraId)});

    return `/html/edit-lora.html?${queryParameters.toString()}`;
}

function openEditLoraPage() {
    if (!currentLora?.id) {
        console.error("Cannot open edit page without a LoRA ID.");

        return;
    }

    window.location.href = buildEditLoraPageUrl(currentLora.id);
}

function buildLoraUpdateRequest() {
    const seedValue =
        document.getElementById("editSeedNumber")?.value.trim() || "";

    return {
        loraName: getModalInputValue("editLoraName"),
        version: getModalInputValue("editVersion"),
        creator: getModalInputValue("editCreator"),
        category: getModalInputValue("editCategory"),
        subCategory: getModalInputValue("editSubCategory"),
        positivePrompt: getModalInputValue("editPositivePrompt"),
        negativePrompt: getModalInputValue("editNegativePrompt"),
        seedNumber: seedValue === "" ? null : Number(seedValue),
        notes: getModalInputValue("editNotes"),
        favorite: currentLora?.favorite ?? false
    };
}

function getModalInputValue(elementId) {
    const element = document.getElementById(elementId);

    return element ? element.value.trim() : "";
}

function populateLoraEditFields(lora) {
    setInputValue("editLoraName", lora.loraName);
    setInputValue("editCreator", lora.creator);
    setInputValue("editVersion", lora.version);
    setInputValue("editCategory", lora.category);
    setInputValue("editSubCategory", lora.subCategory);
    setInputValue("editGroupName", lora.groupName);
    setInputValue("editSeedNumber", lora.seedNumber);
    setInputValue("editPositivePrompt", lora.positivePrompt);
    setInputValue("editNegativePrompt", lora.negativePrompt);
    setInputValue("editNotes", lora.notes);
}

function validateLoraUpdate(requestBody) {
    if (!requestBody.loraName) {
        return "LoRA name is required.";
    }

    if (!requestBody.category) {
        return "Category is required.";
    }

    if (
        requestBody.seedNumber !== null &&
        Number.isNaN(requestBody.seedNumber)
    ) {
        return "Seed must be a valid number.";
    }

    return null;
}

function setInputValue(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        element.value = value ?? "";
    }
}

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



function setupImportFolderForm() {
    const importForm = document.getElementById("importFolderForm");
    const folderPathInput = document.getElementById("importFolderPath");
    const submitButton = document.getElementById("importFolderSubmitButton");
    const importResult = document.getElementById("importResult");

    if (!importForm || !folderPathInput || !submitButton || !importResult) {
        return;
    }

    importForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const folderPath = folderPathInput.value.trim();

        if (folderPath === "") {
            displayImportError("Enter a LoRA folder path.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Importing...";

        importResult.classList.add("hidden");
        importResult.innerHTML = "";

        try {
            const response = await fetch(`${API_BASE_URL}/import-folder`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    folderPath: folderPath
                })
            });

            if (!response.ok) {
                const errorMessage = await response.text();

                throw new Error(
                    errorMessage || `Import failed with status ${response.status}`
                );
            }

            const summary = await response.json();

            displayImportSummary(summary);

            await refreshCurrentView();

        } catch (error) {
            console.error("Folder import error:", error);

            displayImportError(
                "Unable to import the folder. Verify the path and check the backend logs."
            );

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Scan and Import";
        }
    });
}

function displayImportSummary(summary) {
    const importResult = document.getElementById("importResult");

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
                <strong>${summary.scannedFiles ?? 0}</strong>
            </div>

            <div class="import-summary-row">
                <span>✅ Imported</span>
                <strong>${summary.importedCount ?? 0}</strong>
            </div>

            <div class="import-summary-row">
                <span>⏭ Already Exists</span>
                <strong>${summary.skippedCount ?? 0}</strong>
            </div>

            <div class="import-summary-row">
                <span>❌ Failed</span>
                <strong>${summary.failedCount ?? 0}</strong>
            </div>

        </div>
    `;
}

function displayImportError(message) {
    const importResult =
        document.getElementById("importResult");

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

document.addEventListener("click", async event => {
    const copyButton = event.target.closest(".copy-field-button");

    if (!copyButton) {
        return;
    }

    const targetId = copyButton.dataset.copyTarget;
    const targetElement = document.getElementById(targetId);

    if (!targetElement) {
        console.error(`Copy target not found: ${targetId}`);
        return;
    }

    const textToCopy = targetElement.textContent.trim();

    if (!textToCopy || textToCopy === "Not provided") {
        showCopyButtonStatus(copyButton, "Nothing to copy");
        return;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        showCopyButtonStatus(copyButton, "Copied");
    } catch (error) {
        console.error("Clipboard copy failed:", error);

        const copied = copyUsingFallback(textToCopy);

        showCopyButtonStatus(
            copyButton,
            copied ? "Copied" : "Copy failed"
        );
    }
});

function copyUsingFallback(text) {
    const temporaryTextArea = document.createElement("textarea");

    temporaryTextArea.value = text;
    temporaryTextArea.setAttribute("readonly", "");
    temporaryTextArea.style.position = "fixed";
    temporaryTextArea.style.opacity = "0";

    document.body.appendChild(temporaryTextArea);

    temporaryTextArea.select();
    temporaryTextArea.setSelectionRange(
        0,
        temporaryTextArea.value.length
    );

    let copied = false;

    try {
        copied = document.execCommand("copy");
    } catch (error) {
        console.error("Fallback copy failed:", error);
    }

    temporaryTextArea.remove();

    return copied;
}

const additionalDetails =
    document.getElementById("additionalLoraDetails");

if (additionalDetails) {
    additionalDetails.open = false;
}



function setCopyableField(
    targetId,
    buttonTarget,
    value,
    emptyMessage
) {
    const target = document.getElementById(targetId);

    const button = document.querySelector(
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
        button.disabled = !hasValue;
    }
}

function showCopyButtonStatus(button, message) {
    if (!button.dataset.originalText) {
        button.dataset.originalText =
            button.textContent.trim();
    }

    window.clearTimeout(
        Number(button.dataset.resetTimer)
    );

    button.textContent = message;
    button.disabled = true;

    const timer = window.setTimeout(() => {
        button.textContent =
            button.dataset.originalText;

        button.disabled = false;
        delete button.dataset.resetTimer;
    }, 1200);

    button.dataset.resetTimer = String(timer);
}

function isVideoPreview(filePath) {
    if (!filePath) {
        return false;
    }

    return filePath
        .toLowerCase()
        .split("?")[0]
        .endsWith(".mp4");
}

const galleryVideoObserver = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            if (!window.matchMedia("(hover: none)").matches) {
                return;
            }

            const video = entry.target;

            if (entry.isIntersecting) {
                playGalleryVideo(video);
            } else {
                resetGalleryVideo(video);
            }
        });
    },
    {
        threshold: 0.7
    }
);

function playGalleryVideo(video) {
    pauseOtherGalleryVideos(video);

    video.play().catch(error => {
        console.debug("Gallery preview playback prevented:", error);
    });
}

function setupGalleryVideoPreview(card, video) {
    card.addEventListener("pointerenter", event => {
        if (event.pointerType === "mouse") {
            playGalleryVideo(video);
        }
    });

    card.addEventListener("pointerleave", event => {
        if (event.pointerType === "mouse") {
            resetGalleryVideo(video);
        }
    });

    galleryVideoObserver.observe(video);
}

function pauseOtherGalleryVideos(activeVideo) {
    document
        .querySelectorAll("video.lora-card-image")
        .forEach(video => {
            if (video !== activeVideo) {
                resetGalleryVideo(video);
            }
        });
}

function resetGalleryVideo(video) {
    video.pause();

    if (video.readyState >= 1) {
        video.currentTime = 0;
    }
}

function buildLoraPageUrl(page, size) {
    const queryParameters = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
    });

    return `${API_BASE_URL}?${queryParameters.toString()}`;
}

function validateLoraPageResponse(pageResponse) {
    if (!pageResponse || typeof pageResponse !== "object") {
        throw new Error("The LoRA API returned an invalid response.");
    }

    if (!Array.isArray(pageResponse.content)) {
        throw new Error("The LoRA API response does not contain a content array.");
    }
}

function updatePaginationState(pageResponse) {
    currentPage = pageResponse.number ?? 0;
    pageSize = pageResponse.size ?? DEFAULT_PAGE_SIZE;
    totalPages = pageResponse.totalPages ?? 0;
    totalElements = pageResponse.totalElements ?? 0;
}

function getLoraGallery() {
    const gallery = document.getElementById("loraList");

    if (!gallery) {
        throw new Error("The LoRA gallery element with ID 'loraList' was not found.");
    }

    return gallery;
}

function clearLoraGallery() {
    const gallery = getLoraGallery();
    gallery.replaceChildren();
}

function renderLoraPage(loras) {
    const gallery = getLoraGallery();

    clearLoraGallery();

    loras.forEach(lora => {
        const card = createLoraCard(lora);
        gallery.appendChild(card);
    })
}

function displayEmptyGalleryMessage() {
    const gallery = getLoraGallery();

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No LoRAs found.";

    gallery.replaceChildren(message);
}

function displayGalleryError(error) {
    console.error("Error loading paginated LoRAs:", error);

    const gallery = document.getElementById("loraList");

    if (!gallery) {
        return;
    }

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "Unable to load LoRAs. Check the browser console and backend logs.";

    gallery.replaceChildren(message);
}

function buildPaginatedUrl(
    path,
    page,
    size,
    parameters = {}
) {
    const queryParameters =
        new URLSearchParams({
            page: String(page),
            size: String(size)
        });

    Object.entries(parameters).forEach(
        ([key, value]) => {
            if (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            ) {
                queryParameters.set(
                    key,
                    String(value)
                );
            }
        }
    );

    return (
        `${API_BASE_URL}${path}` +
        `?${queryParameters.toString()}`
    );
}

function displayPaginatedLoraResponse(
    pageResponse
) {
    validateLoraPageResponse(pageResponse);

    updatePaginationState(pageResponse);
    updatePaginationControls();

    if (pageResponse.content.length === 0) {
        displayEmptyGalleryMessage();
        return;
    }

    renderLoraPage(pageResponse.content);
}

async function fetchPaginatedLoras(
    url,
    errorMessage
) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `${errorMessage}. ` +
            `Status: ${response.status}`
        );
    }

    const pageResponse =
        await response.json();

    displayPaginatedLoraResponse(
        pageResponse
    );
}

function setupPaginationControls() {
    const previousButton =
        document.getElementById(
            "previousPageButton"
        );

    const nextButton =
        document.getElementById(
            "nextPageButton"
        );

    if (!previousButton || !nextButton) {
        return;
    }

    previousButton.addEventListener(
        "click",
        async () => {
            if (currentPage <= 0) {
                return;
            }

            currentPage -= 1;

            await refreshCurrentView();
            await scrollToLoraGalleryControls();
        }
    );

    nextButton.addEventListener(
        "click",
        async () => {
            if (
                totalPages === 0 ||
                currentPage >= totalPages - 1
            ) {
                return;
            }

            currentPage += 1;

            await refreshCurrentView();
            await scrollToLoraGalleryControls();
        }
    );
}

function updatePaginationControls() {
    const controls = document.getElementById("paginationControls");
    const previousButton = document.getElementById("previousPageButton");
    const nextButton = document.getElementById("nextPageButton");
    const pageIndicator = document.getElementById("pageIndicator");

    if (!controls || !previousButton || !nextButton || !pageIndicator) {
        return;
    }

    const hasMultiplePages = totalPages > 1;

    controls.classList.toggle(
        "hidden",
        !hasMultiplePages
    );

    if (totalPages === 0) {
        pageIndicator.textContent = "Page 0 of 0";
    } else {
        pageIndicator.textContent =
            `Page ${currentPage + 1} of ${totalPages}`;
    }

    previousButton.disabled =
        currentPage <= 0;

    nextButton.disabled =
        totalPages === 0 ||
        currentPage >= totalPages - 1;
}

async function scrollToLoraGalleryControls() {
    const galleryControls =
        document.querySelector(
            ".gallery-controls"
        );

    if (!galleryControls) {
        return;
    }

    /*
     * Wait until the newly rendered gallery has
     * been applied to the page layout.
     */
    await new Promise(resolve => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(
                resolve
            );
        });
    });

    galleryControls.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function getMaximumScrollTop() {
    return Math.max(
        0,
        document.documentElement.scrollHeight -
        window.innerHeight
    );
}

function clampScrollPosition(scrollPosition) {
    const maximumScrollTop =
        getMaximumScrollTop();

    return Math.min(
        Math.max(scrollPosition, 0),
        maximumScrollTop
    );
}

function isInteractiveSheetElement(target) {
    return Boolean(
        target.closest(`button, a, input, select, textarea, video, [role="button"]`)
    );
}

function canStartSheetDrag(
    event,
    scrollContainer
) {
    if (event.touches.length !== 1) {
        return false;
    }

    if (
        isInteractiveSheetElement(
            event.target
        )
    ) {
        return false;
    }

    /*
     * Allow a tiny tolerance because mobile browsers
     * may report a fractional scroll position at the top.
     */
    if (
        scrollContainer &&
        scrollContainer.scrollTop > 2
    ) {
        return false;
    }

    return true;
}

function moveSheetDown(
    sheet,
    distance
) {
    sheet.classList.add(
        "dragging"
    );

    sheet.style.transition = "none";

    sheet.style.transform =
        `translateY(${distance}px)`;
}

function resetDraggedSheet(
    sheet
) {
    sheet.classList.remove(
        "dragging"
    );

    sheet.style.transition =
        `transform ${SHEET_RESET_DURATION}ms ease`;

    sheet.style.transform =
        "translateY(0)";

    window.setTimeout(
        () => {
            sheet.style.transition = "";
            sheet.style.transform = "";
        },
        SHEET_RESET_DURATION
    );
}

function dismissDraggedSheet(
    sheet,
    onDismiss
) {
    sheet.classList.remove(
        "dragging"
    );

    sheet.style.transition =
        `transform ${SHEET_RESET_DURATION}ms ease-in`;

    sheet.style.transform =
        "translateY(100vh)";

    window.setTimeout(
        () => {
            sheet.style.transition = "";
            sheet.style.transform = "";

            onDismiss();
        },
        SHEET_RESET_DURATION
    );
}

function setupSwipeDownToClose(
    sheet,
    scrollContainer,
    onDismiss
) {
    if (!sheet) {
        return;
    }

    let startY = 0;
    let currentDistance = 0;
    let isTracking = false;
    let isDragging = false;

    sheet.addEventListener(
        "touchstart",
        event => {
            if (
                !canStartSheetDrag(
                    event,
                    scrollContainer
                )
            ) {
                return;
            }

            startY =
                event.touches[0].clientY;

            currentDistance = 0;
            isTracking = true;
            isDragging = false;
        },
        {
            passive: true
        }
    );

    sheet.addEventListener(
        "touchmove",
        event => {
            if (!isTracking) {
                return;
            }

            const currentY =
                event.touches[0].clientY;

            const distance =
                currentY - startY;

            /*
             * Ignore upward movement.
             */
            if (distance <= 0) {
                return;
            }

            /*
             * Wait for a small amount of movement before
             * taking control away from normal scrolling.
             */
            if (
                !isDragging &&
                distance < 8
            ) {
                return;
            }

            isDragging = true;
            currentDistance = distance;

            moveSheetDown(
                sheet,
                currentDistance
            );

            event.preventDefault();
        },
        {
            passive: false
        }
    );

    sheet.addEventListener(
        "touchend",
        () => {
            if (!isTracking) {
                return;
            }

            isTracking = false;

            if (!isDragging) {
                return;
            }

            isDragging = false;

            if (
                currentDistance >=
                SHEET_DISMISS_DISTANCE
            ) {
                dismissDraggedSheet(
                    sheet,
                    onDismiss
                );

                return;
            }

            resetDraggedSheet(
                sheet
            );
        }
    );

    sheet.addEventListener(
        "touchcancel",
        () => {
            if (!isTracking) {
                return;
            }

            isTracking = false;

            if (!isDragging) {
                return;
            }

            isDragging = false;

            resetDraggedSheet(
                sheet
            );
        }
    );
}


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

    if (!modal || !modalSheet) {
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

    setupSwipeDownToClose(
        modalSheet,
        scrollContainer,
        finishDraggedLoraDetailsClose
    );
}

function getPreviewCarouselElements() {
    return {
        imageContainer:
            document.getElementById(
                "detailsImageContainer"
            ),

        previousButton:
            document.getElementById(
                "previousPreviewButton"
            ),

        nextButton:
            document.getElementById(
                "nextPreviewButton"
            ),

        indicators:
            document.getElementById(
                "previewIndicators"
            )
    };
}

function renderCarouselPreview(preview) {
    const {
        imageContainer
    } = getPreviewCarouselElements();

    if (!imageContainer) {
        return;
    }

    if (!preview?.filePath) {
        imageContainer.innerHTML = `
            <div class="lora-card-placeholder">
                No Preview
            </div>
        `;

        return;
    }

    if (isVideoPreview(preview.filePath)) {
        imageContainer.innerHTML = `
            <video
                src="${preview.filePath}"
                class="details-image"
                controls
                muted
                loop
                playsinline
                preload="metadata">
            </video>
        `;

        return;
    }

    imageContainer.innerHTML = `
        <img
            src="${preview.filePath}"
            class="details-image"
            alt="LoRA preview ${currentPreviewIndex + 1}">
    `;
}

function updatePreviewNavigationButtons() {
    const {
        previousButton,
        nextButton
    } = getPreviewCarouselElements();

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
}

function renderPreviewIndicators() {
    const {
        indicators
    } = getPreviewCarouselElements();

    if (!indicators) {
        return;
    }

    indicators.replaceChildren();

    const hasMultiplePreviews =
        currentPreviewImages.length > 1;

    indicators.classList.toggle(
        "hidden",
        !hasMultiplePreviews
    );

    if (!hasMultiplePreviews) {
        return;
    }

    currentPreviewImages.forEach(
        (preview, index) => {
            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";
            button.className =
                "preview-indicator-button";

            button.setAttribute(
                "aria-label",
                `Show preview ${index + 1}`
            );

            button.classList.toggle(
                "active",
                index === currentPreviewIndex
            );

            button.addEventListener(
                "click",
                () => {
                    showPreviewAtIndex(index);
                }
            );

            indicators.appendChild(button);
        }
    );
}

function showPreviewAtIndex(index) {
    if (
        index < 0 ||
        index >= currentPreviewImages.length
    ) {
        return;
    }

    currentPreviewIndex = index;

    const selectedPreview =
        currentPreviewImages[
            currentPreviewIndex
            ];

    renderCarouselPreview(
        selectedPreview
    );

    renderPreviewIndicators();
}

function showPreviousPreview() {
    if (currentPreviewImages.length <= 1) {
        return;
    }

    let previousIndex =
        currentPreviewIndex - 1;

    if (previousIndex < 0) {
        previousIndex =
            currentPreviewImages.length - 1;
    }

    showPreviewAtIndex(previousIndex);
}

function showNextPreview() {
    if (currentPreviewImages.length <= 1) {
        return;
    }

    let nextIndex =
        currentPreviewIndex + 1;

    if (
        nextIndex >=
        currentPreviewImages.length
    ) {
        nextIndex = 0;
    }

    showPreviewAtIndex(nextIndex);
}

function resetPreviewCarousel() {
    currentPreviewImages = [];
    currentPreviewIndex = 0;

    const {
        imageContainer,
        previousButton,
        nextButton,
        indicators
    } = getPreviewCarouselElements();

    if (imageContainer) {
        imageContainer.innerHTML = `
            <div class="lora-card-placeholder">
                No Preview
            </div>
        `;
    }

    previousButton?.classList.add("hidden");
    nextButton?.classList.add("hidden");

    if (indicators) {
        indicators.classList.add("hidden");
        indicators.replaceChildren();
    }
}

async function fetchLoraPreviewImages(loraId) {
    const response = await fetch(
        `${API_BASE_URL}/${loraId}/images`
    );

    if (!response.ok) {
        throw new Error(
            `Unable to load previews. Status: ${response.status}`
        );
    }

    return response.json();
}

async function loadPreviewCarousel(loraId) {
    resetPreviewCarousel();

    try {
        const previews =
            await fetchLoraPreviewImages(
                loraId
            );

        currentPreviewImages =
            Array.isArray(previews)
                ? previews
                : [];

        currentPreviewIndex = 0;

        if (
            currentPreviewImages.length === 0
        ) {
            return;
        }

        showPreviewAtIndex(0);
        updatePreviewNavigationButtons();

    } catch (error) {
        console.error(
            "Preview carousel error:",
            error
        );

        resetPreviewCarousel();
    }
}

function setupPreviewCarousel() {
    const {
        previousButton,
        nextButton
    } = getPreviewCarouselElements();

    if (!previousButton || !nextButton) {
        return;
    }

    previousButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            showPreviousPreview();
        }
    );

    nextButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            showNextPreview();
        }
    );
}