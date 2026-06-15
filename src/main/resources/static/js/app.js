const API_BASE_URL = "/api/loras";

document.addEventListener("DOMContentLoaded", () => {
    fetchAllLoras();
    setupLayoutButtons();
    setupSearch();
    setupGoToTopButton();
    setupAddButton();
    setupCategoryFilter();
    setupLoraDetailsModal();
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

        const loraList = document.getElementById("loraList");

        loraList.innerHTML = `
            <p class="empty-message">
                Unable to load LoRAs. Check that your backend endpoint is correct.
            </p>
        `;
    }
}

function displayLoras(loras) {
    const loraList = document.getElementById("loraList");

    loraList.innerHTML = "";

    if (loras.length === 0) {
        loraList.innerHTML = `
            <p class="empty-message">
                No LoRAs saved yet.
            </p>
        `;
        return;
    }

    loras.forEach(lora => {
        const card = createLoraCard(lora);
        loraList.appendChild(card);
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

        <button class="favorite-button">
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

        await fetchAllLoras();

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
        const keyword = searchInput.value.trim();

        if (keyword === "") {
            await fetchAllLoras();
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}`
            );

            if (!response.ok) {
                throw new Error("Search failed");
            }

            const loras = await response.json();
            displayLoras(loras);

        } catch (error) {
            console.error("Search error:", error);
        }
    });
}

function setupGoToTopButton() {
    const goTopButton = document.getElementById("goTopButton");

    if (!goTopButton) {
        return;
    }

    goTopButton.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
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

function setupCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");

    if (!categoryFilter) {
        return;
    }

    categoryFilter.addEventListener("change", async () => {
        const selectedCategory = categoryFilter.value;

        if (selectedCategory === "ALL") {
            await fetchAllLoras();
            return;
        }

        if (selectedCategory === "FAVORITES") {
            await fetchFavoriteLoras();
            return;
        }

        await fetchLorasByCategory(selectedCategory);
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

function setupAddButton() {
    const addButton = document.getElementById("openAddModalButton");

    if (!addButton) {
        return;
    }

    addButton.addEventListener("click", () => {
        window.location.href = "/html/add-lora.html";
    });
}

function setupLoraDetailsModal() {
    const closeButton = document.getElementById("closeLoraDetailsButton");
    const modalOverlay = document.getElementById("loraDetailsModal");

    if (!closeButton || !modalOverlay) {
        return;
    }

    closeButton.addEventListener("click", closeLoraDetailsModal);

    modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) {
            closeLoraDetailsModal();
        }
    });
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
}