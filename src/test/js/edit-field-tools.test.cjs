const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const page of ['edit-lora', 'edit-pose']) {
    test(`${page}: shared Copy and Expand read unsaved values and preserve multiline edits`, async () => {
        const html = fs.readFileSync(`src/main/resources/static/html/${page}.html`, 'utf8');
        const elements = new Map();
        function element() {
            const classes = new Set(['hidden']);
            return {value: '', dataset: {}, handlers: {}, attrs: {}, classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c)},
                addEventListener(name, handler) { this.handlers[name] = handler; }, setAttribute(name, value) { this.attrs[name] = value; }, focus() {}, dispatchEvent() { this.inputDispatched = true; }};
        }
        for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], element());
        const buttons = [...html.matchAll(/<button\b[^>]*data-edit-(?:copy|expand)[^>]*>/g)].map(match => {
            const button = element();
            for (const attr of match[0].matchAll(/data-([\w-]+)="([^"]+)"/g)) button.dataset[attr[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = attr[2];
            return button;
        });
        let startup;
        let copied;
        const document = {body: {style: {}}, getElementById: id => elements.get(id),
            querySelectorAll: selector => buttons.filter(button => selector.includes('data-edit-copy') ? button.dataset.editCopy : button.dataset.editExpand),
            addEventListener: (_, callback) => { startup = callback; }};
        const context = vm.createContext({document, navigator: {clipboard: {writeText: async text => { copied = text; }}}, Event, setTimeout() {}});
        vm.runInContext(fs.readFileSync('src/main/resources/static/js/edit-field-tools.js', 'utf8'), context);
        startup();
        const copies = buttons.filter(button => button.dataset.editCopy);
        assert.equal(copies.length, page === 'edit-pose' ? 4 : 2);
        for (const button of copies) {
            const target = elements.get(button.dataset.editCopy);
            target.value = 'unsaved first line\nsecond line';
            await button.handlers.click();
            assert.equal(copied, target.value);
            assert.equal(button.textContent, '✓');
        }
        for (const button of buttons.filter(button => button.dataset.editExpand)) {
            const target = elements.get(button.dataset.editExpand);
            target.value = 'unsaved prompt\nwith formatting';
            button.handlers.click();
            assert.equal(elements.get('expandedFieldValue').value, target.value);
            assert.equal(elements.get('expandedFieldEditor').attrs['aria-hidden'], 'false');
            elements.get('expandedFieldValue').value = 'expanded edit\nkept';
            elements.get('closeExpandedFieldEditor').handlers.click();
            assert.equal(target.value, 'expanded edit\nkept');
            assert.equal(target.inputDispatched, true);
        }
        for (const field of page === 'edit-pose' ? ['poseLoraInput', 'posePromptInput', 'poseNotesInput'] : ['editPositivePrompt', 'editNotes']) {
            assert.ok(html.indexOf(`data-edit-copy="${field}"`) < html.indexOf(`data-edit-expand="${field}"`));
        }
    });
}
