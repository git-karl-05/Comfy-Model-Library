const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture({scrollTop = 0, interactive = false, handle = false, handleWhileScrolled = false, allowVideoSwipe = false} = {}) {
    const handlers = {}, options = {}, classes = new Set(), timers = new Map();
    let nextTimer = 0, dismissed = 0, prevented = 0;
    const sheet = {style: {}, classList: {add: value => classes.add(value), remove: value => classes.delete(value)},
        addEventListener(name, handler, config) { (handlers[name] ||= []).push(handler); options[name] = config; }};
    const target = {closest(selector) { return selector.includes('button') ? interactive : handle; }};
    const context = vm.createContext({setTimeout(handler) { timers.set(++nextTimer, handler); return nextTimer; }, clearTimeout(id) { timers.delete(id); }});
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/sheet-swipe.js', 'utf8'), context);
    context.sheet = sheet; context.scroll = {scrollTop}; context.dismiss = () => dismissed++;
    const controller = vm.runInContext(`setupSwipeDownToClose(sheet, scroll, dismiss, {handleWhileScrolled: ${handleWhileScrolled}, allowVideoSwipe: ${allowVideoSwipe}})`, context);
    function send(name, x = 0, y = 0, extras = {}) {
        const event = {target, touches: [{clientX: x, clientY: y}], cancelable: true,
            preventDefault() { prevented++; }, stopImmediatePropagation() { this.stopped = true; }, ...extras};
        handlers[name]?.forEach(handler => handler(event));
        return event;
    }
    return {sheet, handlers, options, send, controller, context, get dismissed() { return dismissed; }, get prevented() { return prevented; }, flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(handler => handler()); }};
}
test('LoRA reference threshold: follow the finger, animate short drags back and dismiss long drags', () => {
    const f = fixture();
    f.send('touchstart', 0, 100); f.send('touchmove', 0, 150);
    assert.equal(f.sheet.style.transform, 'translateY(50px)');
    assert.equal(f.options.touchmove.passive, false);
    f.send('touchend');
    assert.equal(f.sheet.style.transform, 'translateY(0)');
    assert.match(f.sheet.style.transition, /180ms ease/);
    f.flush(); assert.equal(f.dismissed, 0); assert.equal(f.sheet.style.transform, '');
    f.send('touchstart'); f.send('touchmove', 0, 120); f.send('touchend');
    assert.equal(f.sheet.style.transform, 'translateY(100vh)');
    const click = f.send('click'); assert.equal(click.stopped, true);
    f.flush(); assert.equal(f.dismissed, 1); assert.equal(f.sheet.style.transform, '');
    f.send('touchstart'); f.send('touchmove', 0, 130); f.send('touchend'); f.flush();
    assert.equal(f.dismissed, 2);
});
test('buttons, scrolled content, horizontal swipes and upward scrolling never start a dismissal', () => {
    for (const config of [{interactive:true}, {scrollTop:20}, {}]) {
        const f = fixture(config); f.send('touchstart');
        f.send('touchmove', config.interactive || config.scrollTop ? 0 : 150, 130); f.send('touchend'); f.flush();
        assert.equal(f.dismissed, 0); assert.equal(f.prevented, 0);
    }
    const f = fixture(); f.send('touchstart', 0, 100); f.send('touchmove', 0, 50); f.send('touchend'); f.flush();
    assert.equal(f.dismissed, 0); assert.equal(f.prevented, 0);
});
test('Pose handle can dismiss scrolled details; ordinary LoRA scrolled-content behavior stays unchanged', () => {
    for (const enabled of [true, false]) {
        const f = fixture({scrollTop:100, handle:true, handleWhileScrolled:enabled});
        f.send('touchstart'); f.send('touchmove', 0, 150); f.send('touchend'); f.flush();
        assert.equal(f.dismissed, enabled ? 1 : 0);
    }
});
test('cancelled/multitouch drags return; close/open reset cancels pending dismissal; setup is idempotent', () => {
    const f = fixture();
    f.send('touchstart'); f.send('touchmove', 0, 150); f.send('touchcancel'); f.flush(); assert.equal(f.dismissed, 0);
    f.send('touchstart'); f.send('touchmove', 0, 150); f.send('touchmove', 0, 150, {touches:[{},{}]}); f.flush(); assert.equal(f.dismissed, 0);
    f.send('touchstart'); f.send('touchmove', 0, 150); f.send('touchend'); f.controller.reset(); f.flush(); assert.equal(f.dismissed, 0);
    vm.runInContext('setupSwipeDownToClose(sheet, scroll, dismiss)', f.context);
    assert.equal(f.handlers.touchstart.length, 1);
});


test('LoRA video surfaces follow downward drags and dismiss with the same threshold as images', () => {
    const f = fixture({allowVideoSwipe: true});
    const video = {tagName: 'VIDEO', controls: true, closest: () => null,
        getBoundingClientRect: () => ({bottom: 400})};
    f.send('touchstart', 50, 100, {target: video});
    f.send('touchmove', 52, 150, {target: video});
    assert.equal(f.sheet.style.transform, 'translateY(50px)');
    f.send('touchend'); f.flush();
    assert.equal(f.dismissed, 0);
    f.send('touchstart', 50, 100, {target: video});
    f.send('touchmove', 52, 225, {target: video});
    assert.equal(f.sheet.style.transform, 'translateY(125px)');
    f.send('touchend'); f.flush();
    assert.equal(f.dismissed, 1);
});

test('video controls, horizontal swipes, scrolled content and other sheets retain their behavior', () => {
    const video = {tagName: 'VIDEO', controls: true, closest: () => null,
        getBoundingClientRect: () => ({bottom: 400})};
    for (const config of [
        {allowVideoSwipe: true, startY: 380},
        {allowVideoSwipe: true, horizontal: true},
        {allowVideoSwipe: true, scrollTop: 50},
        {allowVideoSwipe: false}
    ]) {
        const f = fixture(config);
        const y = config.startY ?? 100;
        f.send('touchstart', 50, y, {target: video});
        f.send('touchmove', config.horizontal ? 200 : 50, y + 130, {target: video});
        f.send('touchend'); f.flush();
        assert.equal(f.dismissed, 0);
        assert.equal(f.prevented, 0);
    }
    const f = fixture({allowVideoSwipe: true});
    f.send('touchstart', 50, 100, {target: video});
    f.send('touchmove', 50, 230, {target: video});
    f.send('touchcancel'); f.flush();
    assert.equal(f.dismissed, 0);
});
