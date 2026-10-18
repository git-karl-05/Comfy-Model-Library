// Keep the gallery title available as an accessible shortcut to the top.
document.querySelectorAll("[data-scroll-top]").forEach(button => {
    button.addEventListener("click", () => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({top: 0, behavior: reducedMotion ? "instant" : "smooth"});
    });
});
