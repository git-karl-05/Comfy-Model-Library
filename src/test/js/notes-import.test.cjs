const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('notes button opens picker and renders counts and failed text without HTML interpretation', async () => {
    function element() {
        return {
            children: [], handlers: {}, classList: {add() {}, remove() {}},
            addEventListener(event, handler) { this.handlers[event] = handler; },
            append(...children) { this.children.push(...children); },
            replaceChildren() { this.children = []; },
            setAttribute() {},
            showModal() { this.open = true; },
            close() { this.open = false; },
            remove() {},
            click() { this.clicked = true; }
        };
    }
    const elements = new Map(['importNotesButton', 'notesFileInput', 'notesImportResult',
        'notesImportListDialog', 'notesImportListTitle', 'notesImportListContent', 'closeNotesImportList'].map(id => [id, element()]));
    const button = elements.get('importNotesButton');
    const input = elements.get('notesFileInput');
    const file = {name: 'notes.txt'};
    input.files = [file];
    let refreshed = false;
    let download;
    let downloadedBlob;
    const source = fs.readFileSync('src/main/resources/static/js/app.js', 'utf8');
    const code = source.slice(source.indexOf('function setupNotesImport()'), source.indexOf('function setupImportFolderForm()'));
    const context = vm.createContext({
        document: {getElementById: id => elements.get(id), createElement: element,
            body: {append(link) { download = link; }}},
        Blob,
        URL: {createObjectURL(blob) { downloadedBlob = blob; return 'blob:failed-notes'; }, revokeObjectURL() {}},
        setTimeout: callback => callback(),
        FormData: class {append(key, value) { assert.equal(key, 'file'); assert.equal(value, file); }},
        fetch: async (url, options) => {
            assert.equal(url, '/api/loras/notes-import');
            assert.equal(options.method, 'POST');
            assert.equal(button.disabled, true);
            return {ok: true, json: async () => ({imported: 1, failed: 1, skipped: 1,
                failures: [{title: '<img src=x>', reason: 'No matching library entry', url: 'https://example.com', positivePrompt: 'full prompt',
                    rawNotes: '<img src=x>\nURL: https://example.com\nTrigger Words\nfull prompt'}],
                existingPrompts: [{title: 'Already populated'}]})};
        },
        refreshCurrentView: async () => { refreshed = true; }, console
    });
    vm.runInContext(code + '\nsetupNotesImport();', context);
    button.handlers.click();
    assert.equal(input.clicked, true);
    await input.handlers.change();
    const result = elements.get('notesImportResult');
    const actions = result.children[2].children;
    assert.deepEqual(actions.map(action => action.textContent), ['Show Failed List', 'Show Skipped List', 'Download Failed Notes']);
    actions[2].handlers.click();
    assert.equal(download.download, 'notes-failed.txt');
    assert.equal(download.clicked, true);
    assert.equal(await downloadedBlob.text(), '<img src=x>\nURL: https://example.com\nTrigger Words\nfull prompt\n');
    actions[0].handlers.click();
    const content = elements.get('notesImportListContent');
    assert.equal(elements.get('notesImportListTitle').textContent, 'Failed List');
    assert.equal(content.children[0].open, true);
    assert.equal(content.children[0].children[0].textContent, '<img src=x> — No matching library entry');
    assert.equal(content.children[0].children[1].textContent, 'https://example.com\n\nfull prompt');
    elements.get('closeNotesImportList').handlers.click();
    assert.equal(elements.get('notesImportListDialog').open, false);
    actions[1].handlers.click();
    assert.equal(elements.get('notesImportListTitle').textContent, 'Skipped List');
    assert.equal(content.children.length, 1);
    assert.equal(content.children[0].textContent, 'Already populated — Skipped, existing positive prompt');
    assert.equal(button.disabled, false);
    assert.equal(input.value, '');
    assert.equal(refreshed, true);
    const html = fs.readFileSync('src/main/resources/static/html/index.html', 'utf8');
    assert.ok(html.indexOf('id="importNotesButton"') > html.indexOf('id="showImportFolderButton"'));
});
