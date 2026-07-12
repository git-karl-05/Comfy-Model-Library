const API_BASE_URL = "/api/loras";

document.addEventListener("DOMContentLoaded", () => {
    fetchAllLoras();
    setupLayoutButtons();
    setupSearch();
    setupGoToTopButton();
    setupCategoryFilter();
    setupLoraDetailsModal();
    setupSearchOverlay();
    setupActionMenu();
    setupImportFolderForm();
    setupMenu();
});

async function fetchAllLoras() {
    try {
        const response = await fetch(API_BASE_URL);

        if (!response.ok) {
            throw new Error("Failed to fetch LoRAs");
        }

        const loras = await response.json();
        displayLoras(loras);

    } catch (error) {
        console.error("Error loading LoRAs:", error);

        document.getElementById("loraList").innerHTML = `
            <p class="empty-message">
                Unable to load LoRAs. Check that your backend endpoint is correct.
            </p>
        `;
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
        ? `
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
                ${lora.creator ? "by " + lora.creator : "Unknown creator"}
            </p>

            <h2>${lora.loraName ?? "Untitled LoRA"}</h2>
        </div>
    `;

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

function setupSearch() {
    const searchInput = document.getElementById("searchInput");

    if (!searchInput) {
        return;
    }

    searchInput.addEventListener("input", async () => {
        await refreshCurrentView();
    });
}

function setupSearchOverlay() {
    const searchButton = document.getElementById("searchIconButton");
    const closeButton = document.getElementById("closeSearchButton");
    const searchOverlay = document.getElementById("searchOverlay");
    const searchInput = document.getElementById("searchInput");

    if (!searchButton || !closeButton || !searchOverlay || !searchInput) {
        return;
    }

    searchButton.addEventListener("click", () => {
        searchOverlay.classList.remove("hidden");
        searchInput.focus();
    });

    closeButton.addEventListener("click", async () => {
        searchOverlay.classList.add("hidden");
        searchInput.value = "";

        await fetchAllLoras();
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
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    const keyword = searchInput ? searchInput.value.trim() : "";
    const selectedCategory = categoryFilter ? categoryFilter.value : "ALL";

    if (keyword !== "") {
        await searchLoras(keyword);
        return;
    }

    if (selectedCategory === "FAVORITES") {
        await fetchFavoriteLoras();
        return;
    }

    if (selectedCategory !== "ALL") {
        await fetchLorasByCategory(selectedCategory);
        return;
    }

    await fetchAllLoras();
}

async function searchLoras(keyword) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}`
        );

        if (!response.ok) {
            throw new Error("Search failed");
        }

        let loras = await response.json();

        const categoryFilter = document.getElementById("categoryFilter");
        const selectedCategory = categoryFilter ? categoryFilter.value : "ALL";

        if (selectedCategory === "FAVORITES") {
            loras = loras.filter(lora => lora.favorite);
        } else if (selectedCategory !== "ALL") {
            loras = loras.filter(lora => lora.category === selectedCategory);
        }

        displayLoras(loras);

    } catch (error) {
        console.error("Search error:", error);
    }
}

function setupCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");

    if (!categoryFilter) {
        return;
    }

    categoryFilter.addEventListener("change", async () => {
        await refreshCurrentView();
    });
}

async function fetchLorasByCategory(category) {
    try {
        const response = await fetch(`${API_BASE_URL}/category/${category}`);

        if (!response.ok) {
            throw new Error("Failed to fetch LoRAs by category");
        }

        const loras = await response.json();
        displayLoras(loras);

    } catch (error) {
        console.error("Category filter error:", error);
    }
}

async function fetchFavoriteLoras() {
    try {
        const response = await fetch(`${API_BASE_URL}/favorites`);

        if (!response.ok) {
            throw new Error("Failed to fetch favorite LoRAs");
        }

        const loras = await response.json();
        displayLoras(loras);

    } catch (error) {
        console.error("Favorites filter error:", error);
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
    const closeButton = document.getElementById("closeLoraDetailsButton");
    const modalOverlay = document.getElementById("loraDetailsModal");
    const editButton = document.getElementById("editLoraButton");

    if (!closeButton || !modalOverlay) {
        return;
    }

    closeButton.addEventListener("click", closeLoraDetailsModal);

    modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) {
            closeLoraDetailsModal();
        }
    });

    if (editButton) {
        editButton.addEventListener("click", () => {
            const loraId = editButton.dataset.loraId;

            if (loraId) {
                window.location.href = `/html/add-lora.html?id=${loraId}`;
            }
        });
    }
}

async function openLoraDetailsModal(loraId) {
    try {
        const response = await fetch(`${API_BASE_URL}/${loraId}`);

        if (!response.ok) {
            throw new Error("Failed to load LoRA details");
        }

        const lora = await response.json();

        populateLoraDetailsModal(lora);

        document.getElementById("loraDetailsModal").classList.remove("hidden");

    } catch (error) {
        console.error("Error loading LoRA details:", error);
        alert("Unable to load LoRA details.");
    }
}

function closeLoraDetailsModal() {
    document.getElementById("loraDetailsModal").classList.add("hidden");
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

    document.getElementById("detailsGroupName").textContent =
        lora.groupName || "N/A";

    document.getElementById("detailsSeedNumber").textContent =
        lora.seedNumber ?? "N/A";

    document.getElementById("detailsPositivePrompt").textContent =
        lora.positivePrompt || "No positive prompt saved.";

    document.getElementById("detailsNegativePrompt").textContent =
        lora.negativePrompt || "No negative prompt saved.";

    document.getElementById("detailsNotes").textContent =
        lora.notes || "No notes saved.";

    const imageContainer = document.getElementById("detailsImageContainer");

    if (lora.filePath) {
        imageContainer.innerHTML = `
            <img
                src="${lora.filePath}"
                alt="${lora.loraName || "LoRA Preview"}"
                class="details-image"
            >
        `;
    } else {
        imageContainer.innerHTML = `
            <div class="lora-card-placeholder">No Image</div>
        `;
    }

    const urlLink = document.getElementById("detailsUrl");

    if (lora.url) {
        urlLink.href = lora.url;
        urlLink.classList.remove("hidden");
    } else {
        urlLink.href = "#";
        urlLink.classList.add("hidden");
    }

    const editButton = document.getElementById("editLoraButton");

    if (editButton) {
        editButton.dataset.loraId = lora.id;
    }
}

function setupMenu() {
    const optionsButton = document.getElementById("optionsButton");
    const sideMenu = document.getElementById("sideMenu");
    const closeMenuButton = document.getElementById("closeMenuButton");
    const menuBackdrop = document.getElementById("menuBackdrop");

    if (!optionsButton || !sideMenu || !closeMenuButton || !menuBackdrop) {
        return;
    }

    const openMenu = () => {
        sideMenu.classList.remove("hidden");
        menuBackdrop.classList.remove("hidden");
    };

    const closeMenu = () => {
        sideMenu.classList.add("hidden");
        menuBackdrop.classList.add("hidden");
    };

    optionsButton.addEventListener("click", openMenu);
    closeMenuButton.addEventListener("click", closeMenu);
    menuBackdrop.addEventListener("click", closeMenu);
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

    importResult.classList.remove("hidden", "import-result-error");
    importResult.classList.add("import-result-success");

    importResult.innerHTML = `
        <h3>Import complete</h3>

        <div class="import-summary-grid">
            <span>Scanned</span>
            <strong>${summary.scannedFiles ?? 0}</strong>

            <span>Imported</span>
            <strong>${summary.importedCount ?? 0}</strong>

            <span>Skipped</span>
            <strong>${summary.skippedCount ?? 0}</strong>

            <span>Failed</span>
            <strong>${summary.failedCount ?? 0}</strong>
        </div>
    `;
}

function displayImportError(message) {
    const importResult = document.getElementById("importResult");

    if (!importResult) {
        return;
    }

    importResult.classList.remove("hidden", "import-result-success");
    importResult.classList.add("import-result-error");
    importResult.textContent = message;
}