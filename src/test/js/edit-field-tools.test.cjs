const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const page of ['add-lora', 'edit-lora', 'add-pose', 'edit-pose']) {
    test(`${page}: shared Copy and Expand read unsaved values and preserve multiline edits`, async () => {
        const html = fs.readFileSync(`src/main/resources/static/html/${page}.html`, 'utf8');
        const elements = new Map();
        function element() {
            const classes = new Set(['hidden']);
            return {value: '', style: {}, scrollHeight: 240, dataset: {}, handlers: {}, attrs: {}, classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c)},
                addEventListener(name, handler) { this.handlers[name] = handler; }, setAttribute(name, value) { this.attrs[name] = value; }, focus(options) { this.focusOptions = options; }, dispatchEvent() { this.inputDispatched = true; }};
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
        assert.equal(copies.length, page === 'edit-pose' ? 4 : 3);
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
            document.body.style.overflow = 'auto';
            button.handlers.click();
            assert.equal(elements.get('expandedFieldValue').style.height, '240px');
            assert.equal(elements.get('expandedFieldValue').focusOptions, undefined);
            assert.equal(elements.get('closeExpandedFieldEditor').focusOptions.preventScroll, true);
            assert.equal(elements.get('expandedFieldValue').value, target.value);
            assert.equal(elements.get('expandedFieldEditor').attrs['aria-hidden'], 'false');
            elements.get('expandedFieldValue').value = 'expanded edit\nkept';
            elements.get('closeExpandedFieldEditor').handlers.click();
            assert.equal(target.value, 'expanded edit\nkept');
            assert.equal(target.inputDispatched, true);
            assert.equal(document.body.style.overflow, 'auto');
            assert.equal(button.focusOptions.preventScroll, true);
            button.handlers.click();
            elements.get('expandedFieldValue').value = 'dismissed edit';
            elements.get('expandedFieldEditor').handlers.click({target: elements.get('expandedFieldEditor')});
            assert.equal(target.value, 'dismissed edit');
            button.handlers.click();
            elements.get('expandedFieldEditor').handlers.keydown({key: 'Escape', preventDefault() {}});
            assert.equal(elements.get('expandedFieldEditor').attrs['aria-hidden'], 'true');
        }
        for (const field of page === 'add-lora' ? ['positivePrompt', 'prompt', 'notes'] : page.endsWith('pose') ? ['poseLoraInput', 'posePromptInput', 'poseNotesInput'] : ['editPositivePrompt', 'editPrompt', 'editNotes']) {
            assert.ok(html.indexOf(`data-edit-copy="${field}"`) < html.indexOf(`data-edit-expand="${field}"`));
        }
    });
}
