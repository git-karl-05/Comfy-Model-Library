const API_BASE_URL = "/api/loras";

let currentLora = null;
let isEditingLora = false;

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
        ? isVideoPreview(lora.filePath)
            ? `
            <video
                class="lora-card-image"
                src="${lora.filePath}"
                muted
                loop
                playsinline
                preload="metadata"
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
    const cancelButton = document.getElementById("cancelLoraEditButton");
    const saveButton = document.getElementById("saveLoraEditButton");

    if (!closeButton || !modalOverlay || !editButton || !cancelButton || !saveButton) {
        return;
    }

    closeButton.addEventListener("click", () => {
        closeLoraDetailsModal();
    });

    modalOverlay.addEventListener("click", event => {
        if (event.target === modalOverlay) {
            closeLoraDetailsModal();
        }
    });

    editButton.addEventListener("click", () => {
        enterLoraEditMode();
    });

    cancelButton.addEventListener("click", () => {
        cancelLoraEdit();
    });

    saveButton.addEventListener("click", async () => {
        await saveLoraEdit();
    });
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
    const validationError = validateLoraUpdate(requestBody);

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
            const responseText = await response.text();

            throw new Error(
                responseText ||
                `Update failed with status ${response.status}`
            );
        }

        currentLora = await response.json();

        populateLoraDetailsModal(currentLora);
        exitLoraEditMode();

        await refreshCurrentView();

    } catch (error) {
        console.error("LoRA update error:", error);

        displayEditMessage(
            "Unable to save the LoRA. Check the backend logs.",
            true
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
        }
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

async function openLoraDetailsModal(loraId) {
    try {
        const response = await fetch(`${API_BASE_URL}/${loraId}`);

        if (!response.ok) {
            throw new Error("Failed to load LoRA details");
        }

        currentLora = await response.json();

        populateLoraDetailsModal(currentLora);
        exitLoraEditMode();

        document
            .getElementById("loraDetailsModal")
            .classList.remove("hidden");

    } catch (error) {
        console.error("Error loading LoRA details:", error);
        alert("Unable to load LoRA details.");
    }
}

function closeLoraDetailsModal() {
    const modal = document.getElementById("loraDetailsModal");

    if (modal) {
        modal.classList.add("hidden");
    }

    isEditingLora = false;
    currentLora = null;

    clearEditMessage();
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

    populateDetailsImage(lora);
    populateDetailsUrl(lora);
}

function populateDetailsImage(lora) {
    const imageContainer =
        document.getElementById("detailsImageContainer");

    if (!imageContainer) {
        return;
    }

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
            <div class="lora-card-placeholder">
                No Image
            </div>
        `;
    }
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

    const nameInput = document.getElementById("editLoraName");

    if (nameInput) {
        nameInput.focus();
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

function buildLoraUpdateRequest() {
    const seedValue =
        document.getElementById("editSeedNumber")?.value.trim() || "";

    return {
        loraName: getModalInputValue("editLoraName"),
        version: getModalInputValue("editVersion"),
        creator: getModalInputValue("editCreator"),
        category: getModalInputValue("editCategory"),
        subCategory: getModalInputValue("editSubCategory"),
        groupName: getModalInputValue("editGroupName"),
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

function showCopyButtonStatus(button, message) {
    const originalText =
        button.dataset.originalText || button.textContent;

    button.dataset.originalText = originalText;
    button.textContent = message;
    button.disabled = true;

    window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 1200);
}

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

function setCopyableField(elementId, buttonSelector, value) {
    const element = document.getElementById(elementId);
    const button = document.querySelector(buttonSelector);

    const hasValue =
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "";

    element.textContent = hasValue
        ? String(value)
        : "Not provided";

    button.disabled = !hasValue;
}

const additionalDetails =
    document.getElementById("additionalLoraDetails");

if (additionalDetails) {
    additionalDetails.open = false;
}

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