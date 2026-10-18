const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase();
            this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = {};
            this.style = {setProperty(key, value) { this[key] = value; }};
            this.scrollLeft = 0; this.clientWidth = 160; this.offsetWidth = 64;
            const classes = new Set();
            this.classList = {
                add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
                toggle(c, yes) { if (yes ?? !classes.has(c)) classes.add(c); else classes.delete(c); }
            };
        }
        set innerHTML(value) { assert.equal(value, ''); this.replaceChildren(); }
        setAttribute(key, value) { this.attrs[key] = value; }
        addEventListener(key, callback) { this.handlers[key] = callback; }
        appendChild(child) { child.parentElement = this; child.offsetLeft = this.children.length * 72; this.children.push(child); }
        replaceChildren(...children) { this.children.forEach(c => c.parentElement = null); this.children = []; children.forEach(c => this.appendChild(c)); }
        querySelector(tag) { return this.children.find(c => c.tagName === tag.toUpperCase()) ?? null; }
        remove() { this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
        pause() { this.paused = true; }
        play() { this.played = true; return Promise.resolve(); }
    }
    const ids = new Map(['loraDetailsModal', 'detailsImageContainer', 'previewIndicators', 'previewStatus',
        'previewPromptButton', 'copyPreviewPromptButton', 'closeExpandedTextButton', 'expandedTextModal', 'expandedTextTitle', 'expandedTextContent', 'previousPreviewButton', 'nextPreviewButton', 'loraList'].map(id => [id, new Element()]));
    const carousel = new Element();
    const sheet = new Element();
    ids.get('loraDetailsModal').querySelector = () => sheet;
    const card = new Element(); card.dataset.loraId = '1';
    card.getBoundingClientRect = () => ({width: 400, height: 500});
    const windowHandlers = {};
    const context = vm.createContext({
        document: {
            addEventListener() {}, getElementById: id => ids.get(id), createElement: tag => new Element(tag),
            querySelector: selector => selector === '#loraDetailsModal .details-carousel' ? carousel : null,
            querySelectorAll: () => [card]
        },
        window: {addEventListener(name, handler) { windowHandlers[name] = handler; }},
        getComputedStyle: () => ({paddingLeft: "2px", paddingRight: "2px"}),
        IntersectionObserver: class {}, createGallerySort: () => ({}), console: {debug() {}, error() {}},
        fetch: async () => ({ok: true, json: async () => []})
    });
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/preview-media.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/app.js', 'utf8'), context);
    const run = code => vm.runInContext(code, context);
    run('currentLora = {id: 1, loraName: "Example", filePath: "/main.png"}; setupPreviewCarousel();');
    return {ids, context, run, carousel, card, windowHandlers};
}

test('loads the existing images endpoint, preserves primary/order, deduplicates and shows thumbnails', async () => {
    const f = fixture();
    f.context.fetch = async url => {
        assert.equal(url, '/api/loras/1/images');
        return {ok: true, json: async () => [{filePath: '/main.png'}, {filePath: '/second.png'}, {filePath: '/clip.mp4'}, {filePath: '/second.png'}]};
    };
    await f.run('loadPreviewCarousel(1)');
    const strip = f.ids.get('previewIndicators');
    assert.equal(strip.children.length, 3);
    assert.deepEqual(strip.children.map(b => b.dataset.path), ['/main.png', '/second.png', '/clip.mp4']);
    assert.equal(strip.children[0].children[0].src, '/main.png');
    assert.equal(strip.children[0].attrs['aria-pressed'], 'true');
    assert.equal(strip.children[2].querySelector('video').played, undefined);
    assert.equal(f.ids.get('nextPreviewButton').disabled, false);
});

test('arrows, thumbnail selection and keyboard wrap correctly without replacing focused thumbnail buttons', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => ['/second.png', '/third.png', '/fourth.png']});
    await f.run('loadPreviewCarousel(1)');
    const strip = f.ids.get('previewIndicators');
    const originalButtons = [...strip.children];
    f.ids.get('previousPreviewButton').handlers.click();
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/fourth.png');
    assert.ok(strip.scrollLeft > 0);
    f.ids.get('nextPreviewButton').handlers.click();
    assert.equal(strip.scrollLeft, 0);
    strip.children[1].handlers.click();
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/second.png');
    let prevented = false;
    f.carousel.handlers.keydown({target: strip.children[1], key: 'ArrowRight', preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/third.png');
    assert.deepEqual(strip.children, originalButtons);
    assert.equal(f.ids.get('previewStatus').textContent, 'Preview 3 of 4');
});

test('video switching pauses the old preview; media errors preserve navigation and ignore old errors', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => ['/clip.mp4', '/broken.png']});
    await f.run('loadPreviewCarousel(1)');
    f.run('showNextPreview()');
    const video = f.ids.get('detailsImageContainer').children[0];
    assert.equal(video.played, true);
    f.run('showNextPreview()');
    assert.equal(video.paused, true);
    video.handlers.error();
    const broken = f.ids.get('detailsImageContainer').children[0];
    assert.equal(broken.src, '/broken.png');
    broken.handlers.error();
    assert.equal(f.ids.get('detailsImageContainer').children[0].textContent, 'Preview unavailable');
    assert.equal(f.ids.get('nextPreviewButton').disabled, false);
    f.run('showNextPreview()');
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/main.png');
});

test('legacy, empty and failed image requests fall back without exposing stale controls', async () => {
    for (const response of [{ok: true, json: async () => []}, {ok: false, status: 500}, null]) {
        const f = fixture();
        f.context.fetch = async () => { if (response) return response; throw new Error('Offline'); };
        await f.run('loadPreviewCarousel(1)');
        assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/main.png');
        assert.equal(f.ids.get('nextPreviewButton').disabled, true);
        assert.equal(f.ids.get('previewIndicators').classList.contains('hidden'), true);
        f.run('currentLora.filePath = null');
        await f.run('loadPreviewCarousel(1)');
        assert.equal(f.ids.get('detailsImageContainer').children[0].textContent, 'No Preview');
    }
});

test('late preview responses never replace another LoRA or update a closed modal', async () => {
    const f = fixture();
    let resolve;
    f.context.fetch = () => new Promise(done => { resolve = done; });
    const pending = f.run('loadPreviewCarousel(1)');
    f.run('detailsRequestSequence++; currentLora = {id: 2, filePath: "/new.png"}; currentPreviewImages = ["/new.png"]; renderCurrentPreview();');
    resolve({ok: true, json: async () => ['/old.png']});
    await pending;
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/new.png');
    const closing = f.run('loadPreviewCarousel(2)');
    f.run('currentLora = null');
    resolve({ok: true, json: async () => ['/late.png']});
    await closing;
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/new.png');
});

test('LoRA modal keeps single-column dimensions in both gallery layouts and updates on resize', () => {
    const f = fixture();
    const modal = f.ids.get('loraDetailsModal');
    modal.querySelector = () => ({offsetWidth: 415, clientWidth: 400});
    f.ids.get('loraList').clientWidth = 404;
    f.run('sizePreviewLikeGalleryCard()');
    assert.equal(modal.style['--preview-card-ratio'], '0.75');
    assert.equal(modal.style['--preview-card-width'], '400px');
    assert.equal(modal.style['--preview-scrollbar-width'], '15px');
    f.ids.get('loraList').classList.add('double-column');
    f.card.getBoundingClientRect = () => ({width: 193, height: 241.25});
    f.run('sizePreviewLikeGalleryCard()');
    assert.equal(modal.style['--preview-card-ratio'], '0.75');
    assert.equal(modal.style['--preview-card-width'], '400px');
    f.ids.get('loraList').clientWidth = 304;
    f.windowHandlers.resize();
    assert.equal(modal.style['--preview-card-ratio'], '0.75');
    assert.equal(modal.style['--preview-card-width'], '300px');
});

test('out-of-order detail responses cannot reopen an older LoRA', async () => {
    const f = fixture();
    const pending = new Map();
    f.context.fetch = url => new Promise(done => pending.set(url, done));
    f.run('populateLoraDetailsModal = () => {}; restartLoraModalOpeningAnimation = () => {}; resetLoraDetailsScrollPosition = () => {};');
    const first = f.run('openLoraDetailsModal(1)');
    const second = f.run('openLoraDetailsModal(2)');
    pending.get('/api/loras/2')({ok: true, json: async () => ({id: 2, filePath: '/new.png'})});
    // Let the details response queue its image request.
    await new Promise(done => setImmediate(done));
    pending.get('/api/loras/2/images')({ok: true, json: async () => ['/new.png']});
    await second;
    pending.get('/api/loras/1')({ok: true, json: async () => ({id: 1, filePath: '/old.png'})});
    await first;
    assert.equal(f.run('currentLora.id'), 2);
    assert.equal(f.ids.get('detailsImageContainer').children[0].src, '/new.png');
});

test('remote image/video previews and thumbnails share the local cache and retry original URLs on failure', async () => {
    const f = fixture();
    f.run('currentLora.filePath = "https://example.com/main.png";');
    f.context.fetch = async () => ({ok: true, json: async () => [
        {filePath: 'https://example.com/main.png'}, {filePath: 'https://example.com/clip.mp4'}]});
    await f.run('loadPreviewCarousel(1)');
    const image = f.ids.get('detailsImageContainer').children[0];
    assert.equal(image.src, '/api/loras/preview?url=https%3A%2F%2Fexample.com%2Fmain.png');
    const thumbnail = f.ids.get('previewIndicators').children[0].children[0];
    assert.equal(thumbnail.src, image.src);
    image.handlers.error();
    assert.equal(image.src, 'https://example.com/main.png');
    image.handlers.error();
    assert.equal(f.ids.get('detailsImageContainer').children[0].textContent, 'Preview unavailable');
    f.run('showNextPreview();');
    const video = f.ids.get('detailsImageContainer').children[0];
    assert.equal(video.tagName, 'VIDEO');
    assert.equal(video.src, '/api/loras/preview?url=https%3A%2F%2Fexample.com%2Fclip.mp4#t=0.1');
    video.handlers.error();
    assert.equal(video.src, 'https://example.com/clip.mp4#t=0.1');
});

function swipeEvent(x, y, target = {tagName: 'IMG', closest: () => null}) {
    return {target, touches: [{clientX: x, clientY: y}], changedTouches: [{clientX: x, clientY: y}],
        cancelable: true, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }};
}

async function swipeFixture() {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => ['/second.png', '/clip.mp4']});
    await f.run('loadPreviewCarousel(1)');
    f.media = f.ids.get('detailsImageContainer');
    f.swipe = (fromX, fromY, toX, toY, target) => {
        f.media.handlers.touchstart(swipeEvent(fromX, fromY, target));
        const move = swipeEvent(toX, toY, target);
        f.media.handlers.touchmove(move);
        const end = swipeEvent(toX, toY, target); end.touches = [];
        f.media.handlers.touchend(end);
        return move;
    };
    return f;
}

test('horizontal swipes navigate images and videos, wrap and update selected thumbnails', async () => {
    const f = await swipeFixture();
    const move = f.swipe(150, 100, 50, 104);
    assert.equal(move.prevented, true);
    assert.equal(move.stopped, true);
    assert.equal(f.media.children[0].src, '/second.png');
    assert.equal(f.ids.get('previewIndicators').children[1].attrs['aria-pressed'], 'true');
    f.swipe(150, 100, 50, 100);
    const video = f.media.children[0];
    assert.equal(video.tagName, 'VIDEO');
    video.closest = () => null;
    video.getBoundingClientRect = () => ({bottom: 400});
    f.swipe(150, 100, 50, 100, video);
    assert.equal(f.media.children[0].src, '/main.png');
    assert.equal(video.paused, true);
    f.swipe(50, 100, 150, 100);
    assert.equal(f.media.children[0].src, '/clip.mp4#t=0.1');
});

test('vertical scrolling, small movements, controls and cancelled/multitouch gestures never change previews', async () => {
    const f = await swipeFixture();
    assert.equal(f.swipe(150, 100, 140, 220).prevented, false);
    f.swipe(150, 100, 135, 101);
    f.swipe(150, 100, 50, 100, {tagName: 'BUTTON', closest: () => ({})});
    f.swipe(150, 380, 50, 380, {tagName: 'VIDEO', controls: true, closest: () => null,
        getBoundingClientRect: () => ({bottom: 400})});
    f.media.handlers.touchstart(swipeEvent(150, 100));
    f.media.handlers.touchmove(swipeEvent(50, 100));
    f.media.handlers.touchcancel();
    const end = swipeEvent(50, 100); end.touches = [];
    f.media.handlers.touchend(end);
    f.media.handlers.touchstart(swipeEvent(150, 100));
    const multi = swipeEvent(50, 100); multi.touches.push({clientX: 60, clientY: 110});
    f.media.handlers.touchmove(multi);
    f.media.handlers.touchend(end);
    assert.equal(f.media.children[0].src, '/main.png');
});

test('changing or resetting the current preview cancels a pending swipe; a single preview stays put', async () => {
    const f = await swipeFixture();
    const end = swipeEvent(50, 100); end.touches = [];
    f.media.handlers.touchstart(swipeEvent(150, 100));
    f.run('showNextPreview()');
    f.media.handlers.touchend(end);
    assert.equal(f.media.children[0].src, '/second.png');
    f.media.handlers.touchstart(swipeEvent(150, 100));
    f.run('resetPreviewCarousel(); currentPreviewImages = ["/only.png"]; renderCurrentPreview();');
    f.media.handlers.touchend(end);
    f.swipe(150, 100, 50, 100);
    assert.equal(f.media.children[0].src, '/only.png');
});


test('preview info follows the selected URL and clears stale prompts', async () => {
    const f = fixture();
    f.context.document.body = {style: {}};
    f.context.fetch = async () => ({ok: true, json: async () => [
        {filePath: '/main.png', prompt: '<first prompt>'},
        {filePath: '/clip.mp4', prompt: 'video prompt'},
        {filePath: '/unknown.png', prompt: null}
    ]});
    await f.run('loadPreviewCarousel(1)');
    const info = f.ids.get('previewPromptButton');
    info.handlers.click();
    assert.equal(f.ids.get('expandedTextContent').textContent, '<first prompt>');
    f.run('showNextPreview()');
    info.handlers.click();
    assert.equal(f.ids.get('expandedTextContent').textContent, 'video prompt');
    f.run('showNextPreview()');
    info.handlers.click();
    assert.equal(f.ids.get('expandedTextContent').textContent, 'No prompt available for this preview.');
    f.run('resetPreviewCarousel()');
    assert.equal(f.run('currentPreviewPrompts.size'), 0);
    assert.equal(info.classList.contains('hidden'), true);
});


test('video controls fade info on interaction and restore it after idle without affecting another preview', async () => {
    const f = fixture();
    let pending;
    f.context.setTimeout = callback => { pending = callback; return 1; };
    f.context.clearTimeout = () => { pending = null; };
    f.context.fetch = async () => ({ok: true, json: async () => ['/clip.mp4']});
    await f.run('loadPreviewCarousel(1)');
    f.run('showNextPreview()');
    const video = f.ids.get('detailsImageContainer').children[0];
    const info = f.ids.get('previewPromptButton');
    video.paused = false;
    video.handlers.pointermove();
    assert.equal(info.classList.contains('video-controls-active'), true);
    pending();
    assert.equal(info.classList.contains('video-controls-active'), false);
    video.paused = true;
    video.handlers.pause();
    assert.equal(info.classList.contains('video-controls-active'), true);
    assert.equal(pending, null);
    video.paused = false;
    video.handlers.play();
    const oldTimeout = pending;
    f.run('showNextPreview()');
    oldTimeout();
    video.handlers.pointermove();
    assert.equal(info.classList.contains('video-controls-active'), false);
});


test('preview prompt replaces close with shared copy action and dismisses on backdrop only', () => {
    const f = fixture();
    f.context.document.body = {style: {}};
    f.run('setupExpandedTextModal(); openExpandedTextModal("Preview prompt", "exact prompt", true)');
    const modal = f.ids.get('expandedTextModal');
    const copy = f.ids.get('copyPreviewPromptButton');
    const close = f.ids.get('closeExpandedTextButton');
    assert.equal(copy.classList.contains('hidden'), false);
    assert.equal(close.classList.contains('hidden'), true);
    modal.handlers.click({target: copy});
    assert.equal(modal.classList.contains('hidden'), false);
    modal.handlers.click({target: modal});
    assert.equal(modal.classList.contains('hidden'), true);
    f.run('openExpandedTextModal("Notes", "Other text")');
    assert.equal(copy.classList.contains('hidden'), true);
    assert.equal(close.classList.contains('hidden'), false);
});

test('mobile video thumbnails request a frame without autoplay and reuse captured posters', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => [{filePath: '/clip.mp4'}]});
    await f.run('loadPreviewCarousel(1)');
    const thumbnail = f.ids.get('previewIndicators').children[1].querySelector('video');
    assert.equal(thumbnail.src, '/clip.mp4#t=0.1');
    assert.equal(thumbnail.played, undefined);
    thumbnail.duration = 0.1;
    thumbnail.handlers.loadedmetadata();
    assert.equal(thumbnail.currentTime, 0.05);
    thumbnail.videoWidth = 1920; thumbnail.videoHeight = 1080; thumbnail.readyState = 2;
    let drawn;
    f.context.document.createElement = tag => {
        assert.equal(tag, 'canvas');
        return {getContext: () => ({drawImage(...args) { drawn = args; }}),
            toDataURL: () => 'data:image/jpeg;base64,frame'};
    };
    thumbnail.handlers.seeked();
    assert.equal(thumbnail.poster, 'data:image/jpeg;base64,frame');
    assert.deepEqual(drawn.slice(1), [0, 0, 640, 360]);
    const next = {handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; }};
    f.context.nextVideo = next;
    f.run('setupVideoPreviewPoster(nextVideo, "/clip.mp4")');
    assert.equal(next.poster, thumbnail.poster);
    assert.equal(next.played, undefined);
});
