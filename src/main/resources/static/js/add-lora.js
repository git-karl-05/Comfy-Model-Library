const API_BASE_URL = "/api/loras";

let selectedPreviewUrl = null;

document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    setupImagePreview();
    setupAddLoraForm();
    setupMenu();
});

/* =========================
   LOAD CATEGORIES
========================= */

async function loadCategories() {
    const categorySelect = document.getElementById("category");

    if (!categorySelect) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/categories`);

        if (!response.ok) {
            throw new Error("Failed to load categories");
        }

        const categories = await response.json();

        categorySelect.innerHTML = `
            <option value="">
                Select category
            </option>
        `;

        categories.forEach(category => {
            const option = document.createElement("option");

            option.value = category;
            option.textContent = formatCategoryName(category);

            categorySelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading categories:", error);

        categorySelect.innerHTML = `
            <option value="">
                Unable to load categories
            </option>
        `;
    }
}

/* =========================
   IMAGE PREVIEW
========================= */

function setupImagePreview() {
    const imageInput = document.getElementById("previewImage");
    const previewContainer = document.getElementById(
        "addImagePreviewContainer"
    );
    const removeButton = document.getElementById(
        "removePreviewImageButton"
    );

    if (!imageInput || !previewContainer || !removeButton) {
        return;
    }

    imageInput.addEventListener("change", () => {
        const selectedFile = imageInput.files[0];

        if (!selectedFile) {
            clearImagePreview();
            return;
        }

        if (!selectedFile.type.startsWith("image/")) {
            imageInput.value = "";

            displayAddLoraMessage(
                "Select a valid image file.",
                true
            );

            clearImagePreview();
            return;
        }

        showImagePreview(selectedFile);
        clearAddLoraMessage();
    });

    removeButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        imageInput.value = "";
        clearImagePreview();
    });
}

function showImagePreview(imageFile) {
    const previewContainer = document.getElementById(
        "addImagePreviewContainer"
    );

    const removeButton = document.getElementById(
        "removePreviewImageButton"
    );

    if (!previewContainer || !removeButton) {
        return;
    }

    revokeSelectedPreviewUrl();

    selectedPreviewUrl = URL.createObjectURL(imageFile);

    const existingImage =
        previewContainer.querySelector(".add-preview-image");

    const placeholder =
        previewContainer.querySelector(".lora-card-placeholder");

    if (existingImage) {
        existingImage.remove();
    }

    if (placeholder) {
        placeholder.remove();
    }

    const image = document.createElement("img");

    image.src = selectedPreviewUrl;
    image.alt = "Selected LoRA preview";
    image.className = "details-image add-preview-image";

    previewContainer.prepend(image);

    removeButton.classList.remove("hidden");
    previewContainer.classList.add("has-image");
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

function clearImagePreview() {
    const previewContainer = document.getElementById(
        "addImagePreviewContainer"
    );

    const removeButton = document.getElementById(
        "removePreviewImageButton"
    );

    if (!previewContainer || !removeButton) {
        return;
    }

    revokeSelectedPreviewUrl();

    const existingImage =
        previewContainer.querySelector(".add-preview-image");

    if (existingImage) {
        existingImage.remove();
    }

    let placeholder =
        previewContainer.querySelector(".lora-card-placeholder");

    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "lora-card-placeholder";
        previewContainer.prepend(placeholder);
    }

    placeholder.textContent = "Click to choose a preview image";

    removeButton.classList.add("hidden");
    previewContainer.classList.remove("has-image");
}

function revokeSelectedPreviewUrl() {
    if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
        selectedPreviewUrl = null;
    }
}

/* =========================
   FORM SUBMISSION
========================= */

function setupAddLoraForm() {
    const form = document.getElementById("addLoraForm");
    const saveButton = document.getElementById("saveLoraButton");

    if (!form || !saveButton) {
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const validationError = validateAddLoraForm();

        if (validationError) {
            displayAddLoraMessage(validationError, true);
            return;
        }

        const formData = buildAddLoraFormData();

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        clearAddLoraMessage();

        try {
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const responseText = await response.text();

                throw new Error(
                    responseText ||
                    `Unable to save LoRA. Status: ${response.status}`
                );
            }

            revokeSelectedPreviewUrl();

            window.location.href = "/html/index.html";

        } catch (error) {
            console.error("Error saving LoRA:", error);

            displayAddLoraMessage(
                "Unable to save the LoRA. Check the backend logs.",
                true
            );

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save LoRA";
        }
    });
}

/* =========================
   BUILD MULTIPART REQUEST
========================= */

function buildAddLoraFormData() {
    const formData = new FormData();

    formData.append("loraName", getValue("loraName"));
    formData.append("creator", getValue("creator"));
    formData.append("version", getValue("version"));
    formData.append("category", getValue("category"));
    formData.append("subCategory", getValue("subCategory"));
    formData.append("groupName", getValue("groupName"));
    formData.append(
        "positivePrompt",
        getValue("positivePrompt")
    );
    formData.append(
        "negativePrompt",
        getValue("negativePrompt")
    );
    formData.append("notes", getValue("notes"));

    /*
     * The backend request may still contain a URL property.
     * Send an empty value until the field is removed from the DTO.
     */
    formData.append("url", "");

    const seedNumber = getValue("seedNumber");

    if (seedNumber !== "") {
        formData.append("seedNumber", seedNumber);
    }

    const imageInput = document.getElementById("previewImage");
    const previewImage = imageInput?.files[0];

    if (previewImage) {
        formData.append("previewImage", previewImage);
    }

    return formData;
}

/* =========================
   VALIDATION
========================= */

function validateAddLoraForm() {
    const loraName = getValue("loraName");
    const category = getValue("category");
    const seedNumber = getValue("seedNumber");

    if (loraName === "") {
        return "LoRA name is required.";
    }

    if (category === "") {
        return "Category is required.";
    }

    if (
        seedNumber !== "" &&
        Number.isNaN(Number(seedNumber))
    ) {
        return "Seed must be a valid number.";
    }

    return null;
}

/* =========================
   MESSAGES
========================= */

function displayAddLoraMessage(message, isError = false) {
    const messageElement = document.getElementById(
        "addLoraMessage"
    );

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

function clearAddLoraMessage() {
    const messageElement = document.getElementById(
        "addLoraMessage"
    );

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

/* =========================
   HELPERS
========================= */

function getValue(elementId) {
    const element = document.getElementById(elementId);

    return element ? element.value.trim() : "";
}

function formatCategoryName(category) {
    return category
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

window.addEventListener("beforeunload", () => {
    revokeSelectedPreviewUrl();
});