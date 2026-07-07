const API_BASE_URL = "/api/loras";

document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    setupAddLoraForm();
});

async function loadCategories() {
    const categorySelect = document.getElementById("category");

    try {
        const response = await fetch(`${API_BASE_URL}/categories`);

        if (!response.ok) {
            throw new Error("Failed to load categories");
        }

        const categories = await response.json();

        categorySelect.innerHTML = `<option value="">Select category</option>`;

        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = formatCategoryName(category);
            categorySelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading categories:", error);
        categorySelect.innerHTML = `<option value="">Unable to load categories</option>`;
    }
}

function setupAddLoraForm() {
    const form = document.getElementById("addLoraForm");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData();

        formData.append("loraName", getValue("loraName"));
        formData.append("version", getValue("version"));
        formData.append("creator", getValue("creator"));
        formData.append("url", getValue("url"));
        formData.append("category", getValue("category"));
        formData.append("subCategory", getValue("subCategory"));
        formData.append("groupName", getValue("groupName"));
        formData.append("positivePrompt", getValue("positivePrompt"));
        formData.append("negativePrompt", getValue("negativePrompt"));

        const seedNumber = getValue("seedNumber");
        if (seedNumber !== "") {
            formData.append("seedNumber", seedNumber);
        }

        formData.append("notes", getValue("notes"));

        const previewImage = document.getElementById("previewImage").files[0];

        if (previewImage) {
            formData.append("previewImage", previewImage);
        }

        try {
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error("Failed to save LoRA");
            }

            window.location.href = "/html/index.html";

        } catch (error) {
            console.error("Error saving LoRA:", error);
            alert("Unable to save LoRA.");
        }
    });
}

function getValue(id) {
    return document.getElementById(id).value.trim();
}

function getNullableNumber(id) {
    const value = document.getElementById(id).value;

    return value === "" ? null : Number(value);
}

function formatCategoryName(category) {
    return category
        .toLowerCase()
        .replace("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

document.addEventListener("DOMContentLoaded", () => {

    const backButton = document.getElementById("backButton");
    const closeButton = document.getElementById("closeAddLoraButton");

    if (backButton) {
        backButton.addEventListener("click", () => {
            history.back();
        });
    }

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            window.location.href = "/html/index.html";
        });
    }

});