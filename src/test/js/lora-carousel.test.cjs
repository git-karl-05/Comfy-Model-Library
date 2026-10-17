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
        'previousPreviewButton', 'nextPreviewButton', 'loraList'].map(id => [id, new Element()]));
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
        IntersectionObserver: class {}, createGallerySort: () => ({}), console: {debug() {}, error() {}},
        fetch: async () => ({ok: true, json: async () => []})
    });
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

test('modal proportions follow the selected gallery card and are updated on resize', () => {
    const f = fixture();
    const modal = f.ids.get('loraDetailsModal');
    modal.querySelector = () => ({offsetWidth: 415, clientWidth: 400});
    f.run('sizePreviewLikeGalleryCard()');
    assert.equal(modal.style['--preview-card-ratio'], '0.8');
    assert.equal(modal.style['--preview-card-width'], '400px');
    assert.equal(modal.style['--preview-scrollbar-width'], '15px');
    f.card.getBoundingClientRect = () => ({width: 300, height: 400});
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
