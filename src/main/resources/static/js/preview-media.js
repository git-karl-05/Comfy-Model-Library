// Keep source paths in records/backups; only media requests use the persistent local cache.
function localPreviewUrl(path) {
    return /^https?:\/\//i.test(path || "")
        ? `/api/loras/preview?url=${encodeURIComponent(path)}` : path;
}

function addPreviewCacheFallback(media, path) {
    if (!media || localPreviewUrl(path) === path) return;
    media.addEventListener("error", () => { media.src = path; }, {once: true});
}

function setupHorizontalPreviewSwipe(container, {getRecord, getIndex, getCount, previous, next}) {
    if (!container) return null;
    let gesture = null;
    const reset = () => { gesture = null; };
    container.addEventListener("touchstart", event => {
        reset();
        if (event.touches.length !== 1 || getCount() < 2) return;
        const target = event.target;
        if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
        const touch = event.touches[0];
        // Native video controls are retargeted to VIDEO; leave their bottom strip alone.
        if (target.tagName === "VIDEO" && target.controls
                && touch.clientY >= target.getBoundingClientRect().bottom - 64) return;
        gesture = {x: touch.clientX, y: touch.clientY, horizontal: false,
            record: getRecord(), index: getIndex()};
    }, {passive: true});
    container.addEventListener("touchmove", event => {
        if (!gesture) return;
        if (event.touches.length !== 1) { reset(); return; }
        const dx = Math.abs(event.touches[0].clientX - gesture.x);
        const dy = Math.abs(event.touches[0].clientY - gesture.y);
        if (!gesture.horizontal) {
            if (Math.max(dx, dy) < 8) return;
            if (dx <= dy * 1.25) { reset(); return; }
            gesture.horizontal = true;
        }
        if (!event.cancelable) { reset(); return; }
        event.preventDefault();
        event.stopPropagation();
    }, {passive: false});
    container.addEventListener("touchend", event => {
        const finished = gesture;
        reset();
        if (!finished || event.touches.length || !event.changedTouches.length
                || finished.record !== getRecord() || finished.index !== getIndex()) return;
        const dx = event.changedTouches[0].clientX - finished.x;
        const dy = event.changedTouches[0].clientY - finished.y;
        const threshold = Math.min(80, Math.max(40, container.clientWidth * 0.12));
        if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
        if (event.cancelable) event.preventDefault();
        if (dx < 0) next();
        else previous();
    }, {passive: false});
    container.addEventListener("touchcancel", reset, {passive: true});
    return {reset};
}
