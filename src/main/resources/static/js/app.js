const API_BASE_URL = "/api/loras";

document.addEventListener("DOMContentLoaded", () => {
    fetchAllLoras();
    setupSearch();
    setupGoToTopButton();
});

/* =========================
   FETCH ALL LORAS
========================= */

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

/* =========================
   DISPLAY LORAS
========================= */

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

/* =========================
   CREATE LORA CARD
========================= */

function createLoraCard(lora) {

    const card = document.createElement("article");
    card.className = "lora-card";

    /* =========================
       IMAGE
    ========================= */

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

    /* =========================
       CARD CONTENT
    ========================= */

    card.innerHTML = `
        ${imageHtml}

        <button class="favorite-button">
            ${lora.favorite ? "★" : "☆"}
        </button>

        <div class="lora-card-header">

            <p class="lora-meta">
                ${lora.creator
                    ? "by " + lora.creator
                    : "Unknown creator"}
            </p>

            <h2>
                ${lora.loraName ?? "Untitled LoRA"}
            </h2>

        </div>
    `;

    /* =========================
       OPEN DETAILS PAGE
    ========================= */

    card.addEventListener("click", () => {

        /*
           Placeholder detail route

           Later:
           /details.html?id=5

           Or:
           /loras/5
        */

        console.log("Clicked LoRA:", lora.id);
    });

    /* =========================
       FAVORITE BUTTON
    ========================= */

    const favoriteButton = card.querySelector(".favorite-button");

    favoriteButton.addEventListener("click", async (event) => {

        /*
           Prevent card click event
           from opening detail page
        */

        event.stopPropagation();

        await toggleFavorite(lora.id);
    });

    return card;
}

/* =========================
   TOGGLE FAVORITE
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
            throw new Error("Failed to toggle favorite");
        }

        /*
           Reload updated data
        */

        await fetchAllLoras();

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

function setupSearch() {

    const searchInput =
        document.getElementById("searchInput");

    searchInput.addEventListener("input", async () => {

        const keyword =
            searchInput.value.trim();

        /*
           Empty search
           reloads all loras
        */

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

            const loras =
                await response.json();

            displayLoras(loras);

        } catch (error) {

            console.error(
                "Search error:",
                error
            );
        }
    });
}

/* =========================
   GO TO TOP BUTTON
========================= */

function setupGoToTopButton() {

    const goTopButton =
        document.getElementById("goTopButton");

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