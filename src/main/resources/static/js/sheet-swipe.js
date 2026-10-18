/* Shared from the LoRA bottom-sheet touch implementation: 8px intent, 120px dismissal. */
const SHEET_DISMISS_DISTANCE = 120;
const SHEET_RESET_DURATION = 180;
const sheetSwipeControllers = new WeakMap();
function setupSwipeDownToClose(sheet, scrollContainer, onDismiss, {handleWhileScrolled = false, allowVideoSwipe = false} = {}) {
    if (!sheet) return null;
    if (sheetSwipeControllers.has(sheet)) return sheetSwipeControllers.get(sheet);
    let startX = 0, startY = 0, distance = 0;
    let tracking = false, dragging = false, settling = false, suppressClick = false;
    let timer = null, clickTimer = null;
    function reset() {
        clearTimeout(timer);
        timer = null;
        tracking = dragging = settling = false;
        distance = 0;
        sheet.classList.remove("dragging");
        sheet.style.transition = "";
        sheet.style.transform = "";
    }
    function settle(dismiss) {
        tracking = dragging = false;
        settling = true;
        sheet.classList.remove("dragging");
        sheet.style.transition = `transform ${SHEET_RESET_DURATION}ms ${dismiss ? "ease-in" : "ease"}`;
        sheet.style.transform = dismiss ? "translateY(100vh)" : "translateY(0)";
        timer = setTimeout(() => {
            if (dismiss) onDismiss();
            reset();
        }, SHEET_RESET_DURATION);
    }
    sheet.addEventListener("touchstart", event => {
        if (settling || event.touches.length !== 1) return;
        clearTimeout(clickTimer);
        suppressClick = false;
        const target = event.target;
        if (target.closest('button, a, input, select, textarea, audio, [role="button"], [contenteditable="true"]')) return;
        if (target.tagName === "VIDEO") {
            if (!allowVideoSwipe) return;
            // Native controls retarget touches to VIDEO. Keep their bottom strip interactive.
            if (target.controls && event.touches[0].clientY >= target.getBoundingClientRect().bottom - 64) return;
        }
        const handle = target.closest(".sheet-drag-handle, .filter-sheet-handle");
        if (scrollContainer?.scrollTop > 2 && !(handleWhileScrolled && handle)) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        distance = 0;
        tracking = true;
    }, {passive: true});
    sheet.addEventListener("touchmove", event => {
        if (!tracking) return;
        if (event.touches.length !== 1) { if (dragging) settle(false); else tracking = false; return; }
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;
        if (!dragging) {
            if (dy < -8 || (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy))) { tracking = false; return; }
            if (dy < 8) return;
        }
        // Non-passive touchmove is required for Safari to prevent native scrolling during a drag.
        if (!event.cancelable) { if (dragging) settle(false); else tracking = false; return; }
        event.preventDefault();
        dragging = true;
        distance = Math.max(0, dy);
        sheet.classList.add("dragging");
        sheet.style.transition = "none";
        sheet.style.transform = `translateY(${distance}px)`;
    }, {passive: false});
    function finish(cancelled) {
        if (!tracking) return;
        tracking = false;
        if (!dragging) return;
        suppressClick = true;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { suppressClick = false; }, 400);
        settle(!cancelled && distance >= SHEET_DISMISS_DISTANCE);
    }
    sheet.addEventListener("touchend", () => finish(false));
    sheet.addEventListener("touchcancel", () => finish(true));
    sheet.addEventListener("click", event => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
    const controller = {reset};
    sheetSwipeControllers.set(sheet, controller);
    return controller;
}
