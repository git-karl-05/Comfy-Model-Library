const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const document = {activeElement: null, querySelectorAll: () => []};
    function element() {
        return {handlers: {}, attrs: {}, style: {}, isConnected: true, disabled: false,
            addEventListener(name, handler) { this.handlers[name] = handler; },
            setAttribute(name, value) { this.attrs[name] = value; },
            focus() { document.activeElement = this; },
            getBoundingClientRect: () => ({top: 30, right: 300, bottom: 70, width: 180, height: 150})};
    }
    const trigger = element(), menu = element(), favorite = element(), edit = element(), archive = element();
    menu.showPopover = () => { menu.open = true; };
    menu.hidePopover = () => { menu.open = false; };
    menu.matches = () => Boolean(menu.open);
    menu.contains = target => [menu, favorite, edit, archive].includes(target);
    menu.querySelector = selector => ({'[data-action="favorite"]': favorite, '[data-action="edit"]': edit, '[data-action="archive"]': archive}[selector]);
    const card = {querySelector: selector => ({'.lora-card-actions-button': trigger, '.lora-card-actions-menu': menu}[selector])};
    const requests = [], alerts = [], events = [], favorites = [];
    const context = vm.createContext({document, console,
        window: {innerWidth: 360, innerHeight: 600, location: {}, addEventListener() {},
            dispatchEvent(event) {events.push(event.type);}, alert(message) {alerts.push(message);}},
        CustomEvent: class {constructor(type) {this.type = type;}},
        closeLoraDetailsActions() {},
        toggleFavorite: async id => {favorites.push(id); return {favorite: true};},
        buildEditLoraPageUrl: (id, reopen) => `/edit?id=${id}&reopen=${reopen}`,
        fetch: async (url, options) => {requests.push([url, options]); return {ok: true};}
    });
    const source = fs.readFileSync('src/main/resources/static/js/app.js', 'utf8');
    vm.runInContext(source.slice(source.indexOf('function setupLoraCardActions('), source.indexOf('function setupGalleryVideoPreview(')), context);
    context.card = card;
    vm.runInContext('setupLoraCardActions(card, {id:42});', context);
    return {context, document, trigger, menu, favorite, edit, archive, requests, alerts, events, favorites};
}

test('card menu opens without opening the card and supports keyboard navigation and dismissal', () => {
    const f = fixture();
    let stopped = false;
    f.trigger.handlers.click({stopPropagation() {stopped = true;}});
    assert.equal(stopped, true);
    assert.equal(f.menu.open, true);
    assert.equal(f.trigger.attrs['aria-expanded'], 'true');
    assert.equal(f.menu.style.top, '30px');
    assert.equal(f.menu.style.left, '120px');
    assert.equal(f.document.activeElement, f.favorite);
    f.menu.handlers.keydown({key: 'ArrowDown', preventDefault() {}});
    assert.equal(f.document.activeElement, f.edit);
    f.menu.handlers.keydown({key: 'End', preventDefault() {}});
    assert.equal(f.document.activeElement, f.archive);
    f.menu.handlers.keydown({key: 'Escape', preventDefault() {}, stopPropagation() {}});
    assert.equal(f.menu.open, false);
    assert.equal(f.document.activeElement, f.trigger);
    f.menu.handlers.toggle({newState: 'closed'});
    assert.equal(f.trigger.attrs['aria-expanded'], 'false');
});

test('card actions favorite, edit, and archive the selected card directly', async () => {
    const f = fixture();
    await f.favorite.handlers.click();
    assert.deepEqual(f.favorites, [42]);
    f.edit.handlers.click();
    assert.equal(f.context.window.location.href, '/edit?id=42&reopen=false');
    await f.archive.handlers.click();
    assert.equal(f.requests[0][0], '/api/loras/42/archive');
    assert.deepEqual(JSON.parse(f.requests[0][1].body), {archived: true});
    assert.deepEqual(f.events, ['library-archive-change']);
    assert.equal(f.archive.disabled, false);
    assert.deepEqual(f.alerts, []);
});

test('card menu stays open within its actions and closes when focus leaves it', () => {
    const f = fixture();
    f.trigger.handlers.click({stopPropagation() {}});
    f.menu.handlers.focusout({relatedTarget:f.edit});
    assert.equal(f.menu.open,true);
    f.menu.handlers.focusout({relatedTarget:{}});
    assert.equal(f.menu.open,false);
    assert.equal(f.trigger.attrs['aria-expanded'],'false');
    const css = fs.readFileSync('src/main/resources/static/css/styles.css','utf8');
    assert.match(css,/\.lora-card:has\(> \.lora-card-actions-menu:popover-open\) > \.lora-card-actions-button\s*\{\s*visibility: hidden;/);
});

test('failed archive remains retryable and does not announce an archive change', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: false});
    await f.archive.handlers.click();
    assert.equal(f.alerts.length, 1);
    assert.equal(f.archive.disabled, false);
    assert.deepEqual(f.events, []);
});
