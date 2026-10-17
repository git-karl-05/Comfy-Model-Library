const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(href = 'https://library.test/html/poses.html?page=3#cards', referrer = '') {
    const calls = [];
    const storage = new Map();
    const listeners = {};
    const context = vm.createContext({URL, URLSearchParams,
        sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
        document: {referrer, addEventListener: (event, callback) => { listeners[event] = callback; }},
        window: {location: {...new URL(href).toJSON(), href, origin: new URL(href).origin, pathname: new URL(href).pathname, search: new URL(href).search,
            assign: url => calls.push(['assign', url]), replace: url => calls.push(['replace', url])},
            scrollY: 240, addEventListener: (event, callback) => { listeners[event] = callback; }}});
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/form-navigation.js', 'utf8'), context);
    return {context, calls, listeners, run: source => vm.runInContext(source, context)};
}
test('all Add/Edit links preserve the same-origin originating URL and gallery state', () => {
    const {run} = fixture();
    run('FormNavigation.register(() => ({page: 3, sortBy: "seed", sortDirection: "desc", category: "Action", search: "standing"}))');
    for (const form of ['add-pose', 'edit-pose', 'add-lora', 'edit-lora']) {
        const url = new URL(run(`FormNavigation.formUrl('/html/${form}.html?id=12')`), 'https://library.test');
        assert.equal(url.searchParams.get('returnTo'), '/html/poses.html?page=3#cards');
        assert.equal(url.searchParams.get('id'), '12');
    }
    assert.deepEqual(JSON.parse(run('JSON.stringify(FormNavigation.restoreState())')), {page: 3, sortBy: 'seed', sortDirection: 'desc', category: 'Action', search: 'standing', scrollY: 240});
});
test('success replaces the form entry; opening forms assigns a new entry so browser Back remains available', () => {
    const {run, calls} = fixture('https://library.test/html/edit-pose.html?id=1&returnTo=%2Fhtml%2Fposes.html%3Fpage%3D3');
    run('FormNavigation.finish()');
    assert.deepEqual(calls[0], ['replace', '/html/poses.html?page=3']);
    run('FormNavigation.go("/html/add-lora.html")');
    assert.equal(calls[1][0], 'assign');
    assert.equal(new URL(calls[1][1], 'https://library.test').searchParams.get('returnTo'), '/html/poses.html?page=3');
});
test('external, malformed, credentialed, script and recursive form return targets use index fallback', () => {
    const {run} = fixture();
    for (const target of ['https://evil.test/', '//evil.test/', 'javascript:alert(1)', 'data:text/html,test', 'https://user@library.test/html/poses.html', 'http://[', '/html/add-pose.html', '/html/edit-lora.html', '']) {
        assert.equal(run(`FormNavigation.safeReturn(${JSON.stringify(target)})`), '/html/index.html');
    }
    assert.equal(run('FormNavigation.safeReturn("/html/character-gallery.html?q=one")'), '/html/character-gallery.html?q=one');
});
test('referrer is accepted only when same-origin; an explicitly invalid return target never uses it', () => {
    assert.equal(fixture('https://library.test/html/add-pose.html', 'https://library.test/html/poses.html?q=1').run('FormNavigation.returnUrl()'), '/html/poses.html?q=1');
    assert.equal(fixture('https://library.test/html/add-pose.html', 'https://evil.test/').run('FormNavigation.returnUrl()'), '/html/index.html');
    assert.equal(fixture('https://library.test/html/add-pose.html?returnTo=https://evil.test/', 'https://library.test/html/poses.html').run('FormNavigation.returnUrl()'), '/html/index.html');
});
