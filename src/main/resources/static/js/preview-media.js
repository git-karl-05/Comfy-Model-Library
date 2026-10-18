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



// A tiny nonzero media fragment requests a decoded frame on mobile Safari,
// where metadata-only video thumbnails otherwise remain black until playback.
function videoThumbnailUrl(path) {
    const url = localPreviewUrl(path);
    return url.includes("#") ? url : `${url}#t=0.1`;
}

const videoPreviewPosters = new Map();
function setupVideoPreviewPoster(video, path, {thumbnail = false} = {}) {
    const cached = videoPreviewPosters.get(path);
    if (cached) video.poster = cached;
    video.addEventListener("loadedmetadata", () => {
        if (thumbnail && Number.isFinite(video.duration) && video.duration > 0) {
            try { video.currentTime = Math.min(0.1, video.duration / 2); }
            catch { /* Some browsers wait for more data before allowing seeks. */ }
        }
    });
    let captured = Boolean(cached);
    const capture = () => {
        if (captured || !video.videoWidth || !video.videoHeight || video.readyState < 2) return;
        try {
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) return;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const poster = canvas.toDataURL("image/jpeg", 0.8);
            video.poster = poster;
            videoPreviewPosters.set(path, poster);
            if (videoPreviewPosters.size > 32) videoPreviewPosters.delete(videoPreviewPosters.keys().next().value);
            captured = true;
        } catch { /* Cross-origin fallback videos can still play without a poster. */ }
    };
    video.addEventListener("loadeddata", capture);
    video.addEventListener("seeked", capture);
}
