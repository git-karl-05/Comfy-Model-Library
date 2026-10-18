const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const elements = new Map();
    for (const id of ['exportBackupButton', 'importBackupButton', 'backupFileInput']) {
        elements.set(id, {innerHTML: '<svg>icon</svg> Backup', handlers: {},
            files: [new Blob(['{"seedNumber":9223372036854775807}'])],
            addEventListener(event, handler) { this.handlers[event] = handler; }, click() {}});
    }
    const alerts = [], downloads = [], blobs = [];
    const context = vm.createContext({
        document: {getElementById: id => elements.get(id), addEventListener() {},
            body: {appendChild() {}}, createElement() {
                return {click() { downloads.push(this); }, remove() {}};
            }},
        window: {addEventListener() {}, confirm: () => true, alert: message => alerts.push(message)},
        URL: {createObjectURL(blob) { blobs.push(blob); return 'blob:backup'; }, revokeObjectURL() {}},
        FormData, IntersectionObserver: class {}, createGallerySort: () => ({}),
        console: {log() {}, error() {}}
    });
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/app.js', 'utf8'), context);
    vm.runInContext('refreshCurrentView = async () => {}; setupBackupExport(); setupBackupImport();', context);
    return {context, elements, alerts, downloads, blobs};
}

test('Export uses the actual backup endpoint and downloads unchanged bytes without numeric conversion', async () => {
    const f = fixture();
    const backup = new Blob(['{"backupVersion":1,"loras":[{"loraName":"Test","seedNumber":9223372036854775807}]}']);
    f.context.fetch = async url => {
        assert.equal(url, '/api/backup/export');
        return {ok: true, blob: async () => backup,
            headers: {get: () => 'attachment; filename="saved-backup.json"'}};
    };
    const button = f.elements.get('exportBackupButton');
    await button.handlers.click();
    assert.equal(f.alerts.length, 0);
    assert.equal(f.downloads[0].download, 'saved-backup.json');
    assert.equal(await f.blobs[0].text(), await backup.text());
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<svg>icon</svg> Backup');
});

test('Export failures expose HTTP status and server details, and restore the action button', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: false, status: 500, text: async () => 'Database unavailable'});
    await f.elements.get('exportBackupButton').handlers.click();
    assert.match(f.alerts[0], /HTTP 500.*Database unavailable/);
    assert.equal(f.elements.get('exportBackupButton').disabled, false);
    assert.equal(f.elements.get('exportBackupButton').innerHTML, '<svg>icon</svg> Backup');
});

test('Import sends original multipart file to the actual endpoint and reports updated records', async () => {
    const f = fixture();
    f.context.fetch = async (url, options) => {
        assert.equal(url, '/api/backup/import');
        assert.equal(options.method, 'POST');
        assert.equal(await options.body.get('file').text(), '{"seedNumber":9223372036854775807}');
        return {ok: true, headers: {get: () => 'application/json'},
            json: async () => ({importedCount: 1154, updatedCount: 2, skippedCount: 0})};
    };
    await f.elements.get('backupFileInput').handlers.change();
    assert.match(f.alerts[0], /Imported: 1154\nUpdated: 2\nSkipped: 0/);
    assert.equal(f.elements.get('importBackupButton').disabled, false);
    assert.equal(f.elements.get('importBackupButton').innerHTML, '<svg>icon</svg> Backup');
});

test('Rejected backups show validation details and leave the import button usable', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: false, status: 400, text: async () => 'Invalid backup: Unsupported backup version: 2'});
    await f.elements.get('backupFileInput').handlers.change();
    assert.equal(f.alerts[0], 'Invalid backup: Unsupported backup version: 2');
    assert.equal(f.elements.get('importBackupButton').disabled, false);
});
