const API_BASE_URL = "/api/loras";

/*
 * Change this route if your Spring controller uses
 * a different preview replacement endpoint.
 */
const PREVIEW_UPLOAD_ENDPOINT = loraId =>
    `${API_BASE_URL}/${loraId}/preview`;

const CATEGORY_OPTIONS = [
    "BACKGROUND",
    "CHARACTER",
    "CONCEPT",
    "ENHANCER",
    "OUTFIT",
    "POSES",
    "SLIDER",
    "STYLE"
];

let currentLora = null;
let selectedPreviewFile = null;
let selectedPreviewObjectUrl = null;


/* =========================
   URL HELPERS
========================= */

function getLoraIdFromUrl() {
    const queryParameters =
        new URLSearchParams(
            window.location.search
        );

    const rawId =
        queryParameters.get("id");

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

function buildLibraryReturnUrl(loraId) {
    const queryParameters =
        new URLSearchParams();

    if (loraId) {
        queryParameters.set(
            "openLora",
            String(loraId)
        );
    }

    const queryString =
        queryParameters.toString();

    return queryString
        ? `/html/index.html?${queryString}`
        : "/html/index.html";
}

function returnToLibrary(loraId) {
    window.location.href =
        buildLibraryReturnUrl(loraId);
}


/* =========================
   ELEMENT HELPERS
========================= */

function getElement(elementId) {
    return document.getElementById(
        elementId
    );
}

function getInputValue(elementId) {
    const element =
        getElement(elementId);

    if (!element) {
        return "";
    }

    return element.value.trim();
}

function setInputValue(
    elementId,
    value
) {
    const element =
        getElement(elementId);

    if (!element) {
        return;
    }

    element.value =
        value ?? "";
}


/* =========================
   CATEGORY HELPERS
========================= */

function formatCategoryLabel(category) {
    return category
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
}

function createCategoryOption(category) {
    const option =
        document.createElement("option");

    option.value =
        category;

    option.textContent =
        formatCategoryLabel(category);

    return option;
}

function populateCategoryOptions() {
    const categorySelect =
        getElement("editCategory");

    if (!categorySelect) {
        return;
    }

    categorySelect.replaceChildren();

    const placeholderOption =
        document.createElement("option");

    placeholderOption.value = "";
    placeholderOption.textContent =
        "Select category";

    categorySelect.appendChild(
        placeholderOption
    );

    CATEGORY_OPTIONS.forEach(
        category => {
            categorySelect.appendChild(
                createCategoryOption(
                    category
                )
            );
        }
    );
}

function ensureCategoryOption(category) {
    if (!category) {
        return;
    }

    const categorySelect =
        getElement("editCategory");

    if (!categorySelect) {
        return;
    }

    const categoryAlreadyExists =
        Array.from(
            categorySelect.options
        ).some(
            option =>
                option.value === category
        );

    if (categoryAlreadyExists) {
        return;
    }

    categorySelect.appendChild(
        createCategoryOption(category)
    );
}


/* =========================
   FILE HELPERS
========================= */

function isVideoFile(file) {
    return Boolean(
        file &&
        file.type === "video/mp4"
    );
}

function isVideoPath(filePath) {
    if (!filePath) {
        return false;
    }

    return filePath
        .toLowerCase()
        .split("?")[0]
        .endsWith(".mp4");
}

function isAllowedPreviewFile(file) {
    if (!file) {
        return false;
    }

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "video/mp4"
    ];

    return allowedTypes.includes(
        file.type
    );
}

function revokeSelectedPreviewObjectUrl() {
    if (!selectedPreviewObjectUrl) {
        return;
    }

    URL.revokeObjectURL(
        selectedPreviewObjectUrl
    );

    selectedPreviewObjectUrl = null;
}


/* =========================
   PREVIEW ELEMENT HELPERS
========================= */

function getPreviewContainer() {
    return getElement(
        "editImagePreviewContainer"
    );
}

function getPreviewInput() {
    return getElement(
        "editPreviewImage"
    );
}

function getRemovePreviewButton() {
    return getElement(
        "removeEditPreviewButton"
    );
}

function createRemovePreviewButton() {
    const button =
        document.createElement("button");

    button.type = "button";
    button.id =
        "removeEditPreviewButton";

    button.className =
        "remove-preview-image-button hidden";

    button.setAttribute(
        "aria-label",
        "Remove selected replacement image"
    );

    button.title =
        "Remove selected replacement image";

    button.textContent = "×";

    return button;
}

function appendRemovePreviewButton(
    previewContainer
) {
    const removeButton =
        createRemovePreviewButton();

    previewContainer.appendChild(
        removeButton
    );

    setupRemovePreviewButton();
}


/* =========================
   PREVIEW RENDERING
========================= */

function renderPreviewPlaceholder(message) {
    const previewContainer =
        getPreviewContainer();

    if (!previewContainer) {
        return;
    }

    previewContainer.classList.remove(
        "has-image"
    );

    previewContainer.replaceChildren();

    const placeholder =
        document.createElement("div");

    placeholder.className =
        "lora-card-placeholder";

    placeholder.textContent =
        message;

    previewContainer.appendChild(
        placeholder
    );

    appendRemovePreviewButton(
        previewContainer
    );
}

function renderPreviewImage(
    source,
    altText
) {
    const previewContainer =
        getPreviewContainer();

    if (!previewContainer) {
        return;
    }

    previewContainer.classList.add(
        "has-image"
    );

    previewContainer.replaceChildren();

    const image =
        document.createElement("img");

    image.src = source;
    image.alt =
        altText || "LoRA preview";

    image.className =
        "add-preview-image";

    previewContainer.appendChild(
        image
    );

    appendRemovePreviewButton(
        previewContainer
    );
}

function renderPreviewVideo(source) {
    const previewContainer =
        getPreviewContainer();

    if (!previewContainer) {
        return;
    }

    previewContainer.classList.add(
        "has-image"
    );

    previewContainer.replaceChildren();

    const video =
        document.createElement("video");

    video.src = source;
    video.className =
        "add-preview-image";

    video.controls = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";

    previewContainer.appendChild(
        video
    );

    appendRemovePreviewButton(
        previewContainer
    );
}

function showRemovePreviewButton() {
    const removeButton =
        getRemovePreviewButton();

    removeButton?.classList.remove(
        "hidden"
    );
}

function hideRemovePreviewButton() {
    const removeButton =
        getRemovePreviewButton();

    removeButton?.classList.add(
        "hidden"
    );
}

function getSavedPreviewPath(lora) {
    /*
     * filePath is used by the current script.
     *
     * The additional properties allow the page to continue
     * working if your response DTO uses previewUrl,
     * previewPath, or imageUrl instead.
     */
    return (
        lora?.previewUrl ||
        lora?.previewPath ||
        lora?.imageUrl ||
        lora?.filePath ||
        ""
    );
}

function renderSavedPreview(lora) {
    revokeSelectedPreviewObjectUrl();

    selectedPreviewFile = null;

    const savedPreviewPath =
        getSavedPreviewPath(lora);

    if (!savedPreviewPath) {
        renderPreviewPlaceholder(
            "Click to choose a preview image"
        );

        return;
    }

    if (
        isVideoPath(savedPreviewPath)
    ) {
        renderPreviewVideo(
            savedPreviewPath
        );
    } else {
        renderPreviewImage(
            savedPreviewPath,
            lora?.loraName ||
            "LoRA preview"
        );
    }

    hideRemovePreviewButton();
}

function renderSelectedPreview(file) {
    revokeSelectedPreviewObjectUrl();

    selectedPreviewObjectUrl =
        URL.createObjectURL(file);

    if (isVideoFile(file)) {
        renderPreviewVideo(
            selectedPreviewObjectUrl
        );
    } else {
        renderPreviewImage(
            selectedPreviewObjectUrl,
            file.name
        );
    }

    showRemovePreviewButton();
}


/* =========================
   PREVIEW EVENT HELPERS
========================= */

function handlePreviewFileSelection(event) {
    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (!isAllowedPreviewFile(file)) {
        event.target.value = "";

        displayEditMessage(
            "Choose a PNG, JPEG, WebP, GIF, or MP4 file.",
            true
        );

        return;
    }

    selectedPreviewFile = file;

    renderSelectedPreview(file);
    clearEditMessage();
}

function clearSelectedReplacementPreview() {
    const previewInput =
        getPreviewInput();

    selectedPreviewFile = null;

    revokeSelectedPreviewObjectUrl();

    if (previewInput) {
        previewInput.value = "";
    }

    renderSavedPreview(currentLora);
}

function setupRemovePreviewButton() {
    const removeButton =
        getRemovePreviewButton();

    if (!removeButton) {
        return;
    }

    removeButton.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            clearSelectedReplacementPreview();
        }
    );
}

function setupPreviewSelection() {
    const previewInput =
        getPreviewInput();

    if (!previewInput) {
        console.error(
            "The editPreviewImage input was not found."
        );

        return;
    }

    previewInput.addEventListener(
        "change",
        handlePreviewFileSelection
    );

    setupRemovePreviewButton();
}


/* =========================
   FORM POPULATION
========================= */

function populateEditForm(lora) {
    ensureCategoryOption(
        lora.category
    );

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
        "editBaseModel",
        lora.baseModel
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

    renderSavedPreview(lora);
}


/* =========================
   REQUEST BUILDING
========================= */

function buildLoraUpdateRequest() {
    const seedValue =
        getInputValue(
            "editSeedNumber"
        );

    return {
        loraName:
            getInputValue(
                "editLoraName"
            ),

        creator:
            getInputValue(
                "editCreator"
            ),

        version:
            getInputValue(
                "editVersion"
            ),

        category:
            getInputValue(
                "editCategory"
            ),

        subCategory:
            getInputValue(
                "editSubCategory"
            ),

        baseModel:
            getInputValue(
                "editBaseModel"
            ),

        seedNumber:
            seedValue === ""
                ? null
                : Number(seedValue),

        positivePrompt:
            getInputValue(
                "editPositivePrompt"
            ),

        negativePrompt:
            getInputValue(
                "editNegativePrompt"
            ),

        notes:
            getInputValue(
                "editNotes"
            ),

        favorite:
            currentLora?.favorite ??
            false
    };
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


/* =========================
   STATUS MESSAGE HELPERS
========================= */

function displayEditMessage(
    message,
    isError = false
) {
    const messageElement =
        getElement(
            "editLoraMessage"
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
        getElement(
            "editLoraMessage"
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
   BUTTON STATE HELPERS
========================= */

function setSaveButtonLoading(
    isLoading
) {
    const saveButton =
        getElement(
            "saveEditButton"
        );

    if (!saveButton) {
        return;
    }

    saveButton.disabled =
        isLoading;

    saveButton.textContent =
        isLoading
            ? "Saving..."
            : "Save Changes";
}


/* =========================
   RESPONSE HELPERS
========================= */

async function readErrorMessage(
    response,
    fallbackMessage
) {
    try {
        const contentType =
            response.headers.get(
                "content-type"
            );

        if (
            contentType?.includes(
                "application/json"
            )
        ) {
            const errorBody =
                await response.json();

            return (
                errorBody.message ||
                errorBody.error ||
                fallbackMessage
            );
        }

        const responseText =
            await response.text();

        return (
            responseText ||
            fallbackMessage
        );

    } catch (error) {
        return fallbackMessage;
    }
}

async function readOptionalJson(
    response
) {
    const contentType =
        response.headers.get(
            "content-type"
        );

    if (
        !contentType?.includes(
            "application/json"
        )
    ) {
        return null;
    }

    return response.json();
}


/* =========================
   API HELPERS
========================= */

async function fetchLora(loraId) {
    const response = await fetch(
        `${API_BASE_URL}/${loraId}`
    );

    if (!response.ok) {
        const message =
            await readErrorMessage(
                response,
                `Failed to load LoRA with status ${response.status}.`
            );

        throw new Error(message);
    }

    return response.json();
}



async function updateLora(
    loraId,
    requestBody,
    previewFile
) {
    const formData =
        new FormData();

    Object.entries(
        requestBody
    ).forEach(
        ([fieldName, fieldValue]) => {
            if (
                fieldValue !== null &&
                fieldValue !== undefined
            ) {
                formData.append(
                    fieldName,
                    String(fieldValue)
                );
            }
        }
    );

    if (previewFile) {
        formData.append(
            "preview",
            previewFile
        );
    }

    const response = await fetch(
        `${API_BASE_URL}/${loraId}`,
        {
            method: "PUT",
            body: formData
        }
    );

    if (!response.ok) {
        const message =
            await readErrorMessage(
                response,
                `Update failed with status ${response.status}.`
            );

        throw new Error(message);
    }

    return readOptionalJson(
        response
    );
}


/* =========================
   CANCEL HELPERS
========================= */

function handleEditCancellation() {
    const loraId =
        currentLora?.id ||
        getLoraIdFromUrl();

    returnToLibrary(loraId);
}

function setupCancelButtons() {
    const headerCancelButton =
        getElement(
            "cancelEditHeaderButton"
        );

    const footerCancelButton =
        getElement(
            "cancelEditActionButton"
        );

    headerCancelButton?.addEventListener(
        "click",
        handleEditCancellation
    );

    footerCancelButton?.addEventListener(
        "click",
        handleEditCancellation
    );
}


/* =========================
   MENU HELPERS
========================= */

function openMenu() {
    const sideMenu =
        getElement("sideMenu");

    const menuBackdrop =
        getElement("menuBackdrop");

    const optionsButton =
        getElement("optionsButton");

    sideMenu?.classList.remove(
        "hidden"
    );

    menuBackdrop?.classList.remove(
        "hidden"
    );

    sideMenu?.setAttribute(
        "aria-hidden",
        "false"
    );

    menuBackdrop?.setAttribute(
        "aria-hidden",
        "false"
    );

    optionsButton?.setAttribute(
        "aria-expanded",
        "true"
    );
}

function closeMenu() {
    const sideMenu =
        getElement("sideMenu");

    const menuBackdrop =
        getElement("menuBackdrop");

    const optionsButton =
        getElement("optionsButton");

    sideMenu?.classList.add(
        "hidden"
    );

    menuBackdrop?.classList.add(
        "hidden"
    );

    sideMenu?.setAttribute(
        "aria-hidden",
        "true"
    );

    menuBackdrop?.setAttribute(
        "aria-hidden",
        "true"
    );

    optionsButton?.setAttribute(
        "aria-expanded",
        "false"
    );
}

function setupMenu() {
    const optionsButton =
        getElement("optionsButton");

    const closeMenuButton =
        getElement("closeMenuButton");

    const menuBackdrop =
        getElement("menuBackdrop");

    optionsButton?.addEventListener(
        "click",
        openMenu
    );

    closeMenuButton?.addEventListener(
        "click",
        closeMenu
    );

    menuBackdrop?.addEventListener(
        "click",
        closeMenu
    );
}


/* =========================
   PAGE LOAD
========================= */

async function loadLoraForEditing() {
    const loraId =
        getLoraIdFromUrl();

    if (!loraId) {
        displayEditMessage(
            "A valid LoRA ID was not provided.",
            true
        );

        setSaveButtonLoading(true);

        return;
    }

    try {
        currentLora =
            await fetchLora(loraId);

        populateEditForm(
            currentLora
        );

    } catch (error) {
        console.error(
            "Unable to load LoRA:",
            error
        );

        displayEditMessage(
            error.message ||
            "Unable to load the LoRA.",
            true
        );

        setSaveButtonLoading(true);
    }
}


/* =========================
   FORM SUBMISSION
========================= */

async function handleEditFormSubmit(
    event
) {
    event.preventDefault();

    const loraId =
        currentLora?.id ||
        getLoraIdFromUrl();

    if (!loraId) {
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

    clearEditMessage();
    setSaveButtonLoading(true);

    try {
        const updatedLora =
            await updateLora(
                loraId,
                requestBody,
                selectedPreviewFile
            );

        if (updatedLora) {
            currentLora =
                updatedLora;
        } else {
            currentLora = {
                ...currentLora,
                ...requestBody,
                id: loraId
            };
        }

        selectedPreviewFile = null;
        revokeSelectedPreviewObjectUrl();

        displayEditMessage(
            "LoRA updated successfully."
        );

        await delay(700);

        returnToLibrary(
            loraId
        );

    } catch (error) {
        console.error(
            "Unable to update LoRA:",
            error
        );

        displayEditMessage(
            error.message ||
            "Unable to save the LoRA.",
            true
        );

        setSaveButtonLoading(false);
    }
}

function delay(milliseconds) {
    return new Promise(resolve => {
        window.setTimeout(
            resolve,
            milliseconds
        );
    });
}

function setupEditForm() {
    const editForm =
        getElement(
            "editLoraForm"
        );

    if (!editForm) {
        console.error(
            "The editLoraForm element was not found."
        );

        return;
    }

    editForm.addEventListener(
        "submit",
        handleEditFormSubmit
    );
}


/* =========================
   CLEANUP
========================= */

function setupPageCleanup() {
    window.addEventListener(
        "pagehide",
        revokeSelectedPreviewObjectUrl
    );
}


/* =========================
   MAIN INITIALIZATION
========================= */

async function initializeEditLoraPage() {
    populateCategoryOptions();

    setupMenu();
    setupCancelButtons();
    setupPreviewSelection();
    setupEditForm();
    setupPageCleanup();

    await loadLoraForEditing();
}

document.addEventListener(
    "DOMContentLoaded",
    initializeEditLoraPage
);

