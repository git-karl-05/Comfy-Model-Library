// Keep the gallery title available as an accessible shortcut to the top.
document.querySelectorAll("[data-scroll-top]").forEach(button => {
    button.addEventListener("click", () => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({top: 0, behavior: reducedMotion ? "instant" : "smooth"});
    });
});

// Use the visible content edges for menus on galleries and standalone forms.
function galleryMenuAnchors() {
    const grid = document.getElementById("loraList") || document.getElementById("poseList");
    const content = grid || document.querySelector(".content-container");
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    const style = getComputedStyle(content);
    const filter = document.getElementById("filterButton")
        || document.querySelector(".gallery-controls .gallery-chip-button, .gallery-controls .category-filter, .gallery-controls .layout-icon-button");
    const header = document.querySelector(".top-toolbar, .add-lora-header, .edit-lora-header");
    const top = filter ? filter.getBoundingClientRect().top : (header?.getBoundingClientRect().bottom || 64) + 10;
    return {
        top: Math.max(8, top),
        left: Math.max(8, rect.left + (parseFloat(style.paddingLeft) || 0)),
        right: Math.max(8, document.documentElement.clientWidth - rect.right + (parseFloat(style.paddingRight) || 0))
    };
}
window.GalleryMenus = {
    positionActionMenu() {
        const overlay = document.getElementById("actionMenuOverlay");
        const popover = document.getElementById("actionMenuPopover");
        if (!popover || overlay?.classList.contains("hidden")) return;
        const anchor = galleryMenuAnchors();
        if (!anchor) return;
        popover.style.setProperty("--action-menu-top", `${anchor.top}px`);
        popover.style.setProperty("--action-menu-right", `${anchor.right}px`);
    },
    positionSideMenu() {
        const menu = document.getElementById("sideMenu");
        if (!menu || menu.classList.contains("hidden")) return;
        const anchor = galleryMenuAnchors();
        if (!anchor) return;
        menu.style.setProperty("--side-menu-top", `${anchor.top}px`);
        menu.style.setProperty("--side-menu-left", `${anchor.left}px`);
    }
};
function positionGalleryMenus() {
    window.GalleryMenus.positionActionMenu();
    window.GalleryMenus.positionSideMenu();
}
for (const id of ["sideMenu", "actionMenuOverlay"]) {
    const menu = document.getElementById(id);
    if (menu) new MutationObserver(positionGalleryMenus).observe(menu, {attributes: true, attributeFilter: ["class"]});
}
window.addEventListener("resize", positionGalleryMenus);
window.addEventListener("scroll", positionGalleryMenus, {passive: true});
