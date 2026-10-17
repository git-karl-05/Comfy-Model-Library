/* Shared by the LoRA and pose galleries. State and data loading stay page-specific. */
function createGallerySort({getState, apply, reset, label = "Sort"}) {
    const modal = document.getElementById("sortModal");
    const button = document.getElementById("sortButton");
    let initialized = false;
    let swipe = null;
    function update() {
        const {field, direction} = getState();
        const resetButton = document.getElementById("resetSortButton");
        if (resetButton) resetButton.disabled = !field;
        const options = modal?.querySelectorAll("[data-sort-field]") ?? [];
        let fieldLabel = "";
        options.forEach(option => {
            const active = option.dataset.sortField === field;
            option.classList.toggle("active", active);
            option.setAttribute("aria-pressed", String(active));
            const arrow = option.querySelector(".sort-direction-arrow");
            if (arrow) arrow.textContent = active ? (direction === "desc" ? "↓" : "↑") : "";
            if (active) fieldLabel = option.dataset.sortLabel || option.textContent.trim();
        });
        button?.classList.toggle("active", Boolean(field));
        button?.setAttribute("aria-label", field ? `Sort: ${fieldLabel}, ${direction === "desc" ? "descending" : "ascending"}` : label);
        const text = document.getElementById("sortButtonText");
        if (text) text.textContent = fieldLabel || "Sort";
        const arrow = document.getElementById("sortButtonArrow");
        if (arrow) {
            arrow.textContent = field ? (direction === "desc" ? "↓" : "↑") : "";
            arrow.classList.toggle("hidden", !field);
        }
        if (button) {
            if (field) button.dataset.sortDirection = direction;
            else delete button.dataset.sortDirection;
        }
    }
    function open() {
        if (!modal) return;
        swipe?.reset();
        modal.inert = false;
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        button?.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        update();
        modal.querySelector("[data-sort-field]")?.focus();
    }
    function close() {
        if (!modal) return;
        swipe?.reset();
        button?.focus();
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        modal.inert = true;
        button?.setAttribute("aria-expanded", "false");
        if (!document.querySelector('.modal-overlay:not(.hidden), .filter-modal:not(.hidden)')) document.body.style.overflow = "";
    }
    function setup() {
        if (initialized) return;
        initialized = true;
        swipe = setupSwipeDownToClose(modal?.querySelector(".filter-sheet"), modal?.querySelector(".filter-sheet-content"), close);
        document.getElementById("resetSortButton")?.addEventListener("click", () => { if (getState().field) return reset(); });
        button?.addEventListener("click", open);
        document.getElementById("closeSortButton")?.addEventListener("click", close);
        document.getElementById("sortModalBackdrop")?.addEventListener("click", close);
        modal?.querySelectorAll("[data-sort-field]").forEach(option => {
            option.addEventListener("click", () => apply(option.dataset.sortField));
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) close();
        });
        update();
    }
    return {setup, open, close, update};
}
