/* Pending preview edits are local until the enclosing form is saved. */
(() => {
    class PreviewDraft {
        constructor() { this.entries = []; this.selectedKey = null; this.defaultKey = null; this.sequence = 0; }
        load(entries) {
            this.entries = entries.map(entry => ({...entry, key: `slot-${++this.sequence}`}));
            this.selectedKey = this.defaultKey = this.entries[0]?.key ?? null;
        }
        selected() { return this.entries.find(entry => entry.key === this.selectedKey); }
        select(key) { if (this.entries.some(entry => entry.key === key)) this.selectedKey = key; }
        navigate(delta) {
            if (!this.entries.length) return;
            const index = this.entries.findIndex(entry => entry.key === this.selectedKey);
            this.selectedKey = this.entries[(index + delta + this.entries.length) % this.entries.length].key;
        }
        put(entry, targetKey = null) {
            if (targetKey !== null) {
                const index = this.entries.findIndex(item => item.key === targetKey);
                if (index < 0) throw new Error("The selected preview no longer exists. Choose a preview again.");
                const old = this.entries[index];
                this.entries[index] = {...entry, key: targetKey};
                this.selectedKey = targetKey;
                return old;
            }
            if (this.entries.length >= 5) throw new Error("A maximum of 5 previews is allowed.");
            const added = {...entry, key: `slot-${++this.sequence}`};
            this.entries.push(added); this.selectedKey = added.key;
            this.defaultKey ??= added.key;
            return null;
        }
        remove() {
            const index = this.entries.findIndex(entry => entry.key === this.selectedKey);
            if (index < 0) return null;
            const [removed] = this.entries.splice(index, 1);
            this.selectedKey = this.entries[Math.min(index, this.entries.length - 1)]?.key ?? null;
            if (this.defaultKey === removed.key) this.defaultKey = this.entries[0]?.key ?? null;
            return removed;
        }
        setDefault() {
            const entry = this.selected();
            if (!entry) return;
            this.defaultKey = entry.key;
            this.entries = [entry, ...this.entries.filter(item => item.key !== entry.key)];
        }
        serialize() {
            const files = [];
            const entries = this.entries.map(entry => {
                const value = {key: entry.key, source: entry.source};
                if (entry.source === "existing") { value.ref = entry.ref; value.path = entry.path; }
                if (entry.source === "output") value.path = entry.path;
                if (entry.source === "upload") { value.uploadIndex = files.length; files.push(entry.file); }
                return value;
            });
            return {manifest: {entries, defaultKey: this.defaultKey}, files};
        }
    }
    let editorSequence = 0;
    function create({media, picker, input = null, disabled = false}) {
        let locked = disabled;
        const draft = new PreviewDraft();
        const section = media.parentElement;
        const make = (tag, className, text) => {
            const node = document.createElement(tag); node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };
        const button = (label, action, className = "details-cancel-button") => {
            const node = make("button", className, label); node.type = "button";
            node.addEventListener("click", event => {
                event.preventDefault(); event.stopPropagation(); action();
                if (node.parentElement === actions) closeMenu(!picker.open);
            });
            return node;
        };
        const stage = make("div", "form-preview-stage");
        media.before(stage); stage.appendChild(media);
        media.classList.add("form-preview-main");
        media.setAttribute("role", "button"); media.tabIndex = 0;
        media.setAttribute("aria-label", "Choose or replace selected preview from ComfyUI");
        const previous = button("‹", () => { draft.navigate(-1); render(); }, "carousel-navigation-button carousel-previous-button");
        const next = button("›", () => { draft.navigate(1); render(); }, "carousel-navigation-button carousel-next-button");
        previous.setAttribute("aria-label", "Previous preview"); next.setAttribute("aria-label", "Next preview");
        stage.append(previous, next);
        const strip = make("div", "preview-indicators form-preview-thumbnails");
        strip.setAttribute("role", "group"); strip.setAttribute("aria-label", "Preview selection");
        const actions = make("div", "form-preview-actions");
        actions.id = `form-preview-actions-${++editorSequence}`;
        actions.hidden = true;
        actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Preview actions");
        const more = button("⋮", () => {
            if (locked) return;
            if (actions.hidden) { actions.hidden = false; more.setAttribute("aria-expanded", "true"); showOverlay(); }
            else closeMenu();
        }, "form-preview-more");
        more.setAttribute("aria-label", "Preview actions"); more.title = "Preview actions";
        more.setAttribute("aria-expanded", "false"); more.setAttribute("aria-controls", actions.id);
        stage.append(more, actions);
        let fadeTimer;
        function showOverlay() {
            clearTimeout(fadeTimer); more.classList.remove("is-faded");
            if (actions.hidden && draft.entries.length) fadeTimer = setTimeout(() => {
                if (actions.hidden) more.classList.add("is-faded");
            }, 2500);
        }
        function closeMenu(focus = false) {
            actions.hidden = true; more.setAttribute("aria-expanded", "false"); showOverlay();
            if (focus) (more.hidden ? media : more).focus({preventScroll: true});
        }
        for (const type of ["pointermove", "pointerdown", "focusin"]) stage.addEventListener(type, event => { if (event.target.tagName !== "VIDEO") showOverlay(); });
        document.addEventListener("click", event => {
            if (!stage.contains(event.target)) closeMenu();
        });
        stage.addEventListener("focusout", event => {
            if (event.relatedTarget && !stage.contains(event.relatedTarget)) closeMenu();
        });
        stage.addEventListener("keydown", event => {
            if (event.key === "Escape" && !actions.hidden) {
                event.preventDefault(); event.stopPropagation(); closeMenu(true);
            }
        });
        actions.addEventListener("keydown", event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const choices = Array.from(actions.children).filter(button => !button.disabled);
            const current = choices.indexOf(document.activeElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1
                    : (current + (event.key === "ArrowUp" ? -1 : 1) + choices.length) % choices.length;
            choices[next]?.focus();
        });
        const error = make("p", "form-preview-error"); error.setAttribute("role", "alert");
        const frame = picker.querySelector("iframe");
        let intent = null, uploadTarget = null, uploadReplace = null, upload = null;
        const openPicker = replace => {
            if (locked || (!replace && draft.entries.length >= 5)) return;
            closeMenu();
            intent = replace ? draft.selectedKey : null;
            if (replace && !draft.selected()) return;
            const alreadyLoaded = Boolean(frame.getAttribute("src"));
            if (!alreadyLoaded) frame.src = "/html/output.html";
            picker.showModal(); frame.focus();
            if (alreadyLoaded) frame.contentWindow.postMessage({type: "output-browse"}, location.origin);
        };
        const add = button("Add previews", () => openPicker(false));
        const replace = button("Replace selected", () => openPicker(true));
        const remove = button("Remove selected", () => { release(draft.remove()); render(); });
        const primary = button("Set as default", () => { draft.setDefault(); render(); });
        actions.append(add, replace, remove, primary);
        if (input) {
            input.multiple = true;
            upload = button("Upload previews", () => { uploadTarget = null; input.click(); });
            uploadReplace = button("Upload replacement", () => { uploadTarget = draft.selectedKey; input.click(); });
            actions.append(upload, uploadReplace);
            input.addEventListener("change", () => {
                if (locked) { input.value = ""; return; }
                error.textContent = "";
                const files = Array.from(input.files);
                let accepted = false;
                const growth = files.length - (uploadTarget !== null ? 1 : 0);
                if (draft.entries.length + growth > Math.max(5, draft.entries.length)) {
                    error.textContent = "A maximum of 5 previews is allowed. Replace or remove an existing preview first.";
                } else if (files.some(file => !/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime|ogg))$/.test(file.type))) {
                    error.textContent = "Choose PNG, JPEG, WebP, GIF, MP4, WebM, MOV or OGG media.";
                } else {
                    accepted = files.length > 0;
                    files.forEach((file, index) => {
                    release(draft.put({source: "upload", file, path: file.name, url: URL.createObjectURL(file)}, index === 0 ? uploadTarget : null));
                    });
                }
                input.value = ""; render();
                if (accepted) focusTop();
            });
        }
        const addTile = button("+", () => { closeMenu(); openPicker(false); }, "preview-indicator-button form-preview-add");
        addTile.setAttribute("aria-label", "Add preview"); addTile.title = "Add preview";
        section.append(strip, error);
        const release = entry => { if (entry?.source === "upload") URL.revokeObjectURL(entry.url); };
        const toolbar = () => section.closest?.("form")?.querySelector(".shared-form-action-bar");
        let toolbarProgress = 1, previousScroll = window.scrollY || 0;
        const positionToolbar = () => {
            const bar = toolbar();
            if (!bar) return;
            bar.style?.setProperty("--preview-toolbar-offset", `${(1 - toolbarProgress) * 110}%`);
            if (toolbarProgress === 0) bar.classList.add("preview-toolbar-hidden");
            else bar.classList.remove("preview-toolbar-hidden");
        };
        const scrollToolbar = () => {
            const current = Math.max(0, window.scrollY || 0);
            const distance = Math.max(0, current - previousScroll);
            previousScroll = current;
            if (picker.open || toolbarProgress === 1 || distance === 0) return;
            toolbarProgress = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                    ? 1 : Math.min(1, toolbarProgress + distance / 96);
            positionToolbar();
        };
        window.addEventListener("scroll", scrollToolbar, {passive: true});
        const focusTop = () => {
            media.focus({preventScroll: true});
            const reset = () => {
                window.scrollTo?.({top: 0, left: 0, behavior: "instant"});
                previousScroll = 0;
            };
            reset(); window.requestAnimationFrame?.(reset);
            toolbarProgress = 0; positionToolbar();
        };
        const closePicker = (selected = false) => {
            picker.close(); intent = null; media.focus({preventScroll: true});
            if (selected) focusTop();
        };
        picker.addEventListener("cancel", event => { event.preventDefault(); closePicker(); });
        window.addEventListener("message", event => {
            if (event.origin !== location.origin || event.source !== frame.contentWindow || !picker.open) return;
            if (event.data?.type === "output-cancel") closePicker();
            if (event.data?.type === "output-select" && typeof event.data.path === "string" && event.data.path) {
                try {
                    release(draft.put({source: "output", path: event.data.path,
                        url: `/api/poses/output-image?path=${encodeURIComponent(event.data.path)}`}, intent));
                    error.textContent = ""; render(); closePicker(true);
                } catch (failure) { error.textContent = failure.message; closePicker(); }
            }
        });
        media.addEventListener("click", event => {
            if (event.defaultPrevented) return;
            if (event.target.tagName === "VIDEO" && Number.isFinite(event.clientY)
                    && event.clientY >= event.target.getBoundingClientRect().bottom - 64) return;
            event.preventDefault?.();
            openPicker(Boolean(draft.selected()));
        });
        media.addEventListener("keydown", event => {
            if (locked || event.target.tagName === "VIDEO") return;
            if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                event.preventDefault(); draft.navigate(event.key === "ArrowLeft" ? -1 : 1); render();
            } else if (["Enter", " "].includes(event.key) && event.target === media) {
                event.preventDefault();
                openPicker(Boolean(draft.selected()));
            }
        });
        const swipe = setupHorizontalPreviewSwipe(media, {getRecord: () => draft, getIndex: () => draft.selectedKey,
            getCount: () => draft.entries.length, previous: () => { draft.navigate(-1); render(); }, next: () => { draft.navigate(1); render(); }});
        // The main container is keyboard-accessible, but must not block swipes via [role=button].
        media.setAttribute("role", "group");
        strip.addEventListener("keydown", event => {
            if (locked || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault(); draft.navigate(event.key === "ArrowLeft" ? -1 : 1); render();
            thumbs.get(draft.selectedKey)?.focus({preventScroll: true});
        });
        const thumbs = new Map();
        let displayed = null, displayedUrl = null;
        function render() {
            const entry = draft.selected();
            if (displayed !== entry?.key || displayedUrl !== entry?.url || !media.firstChild) {
                media.querySelector("video")?.pause(); media.replaceChildren();
                if (entry) {
                    const video = /\.(mp4|webm|mov|ogg)([?#].*)?$/i.test(entry.path || entry.url);
                    const node = make(video ? "video" : "img", "details-image");
                    if (video) { node.controls = true; node.muted = true; node.playsInline = true; node.preload = "metadata"; }
                    else node.alt = `Preview ${draft.entries.indexOf(entry) + 1}`;
                    node.src = localPreviewUrl(entry.url);
                    addPreviewCacheFallback(node, entry.url);
                    media.appendChild(node);
                } else media.appendChild(make("div", "lora-card-placeholder", "Add previews from ComfyUI"));
                if (entry && media.querySelector("video")) {
                    const video = media.querySelector("video");
                    const activeControls = () => {
                        if (video.parentElement !== media || !actions.hidden) return;
                        clearTimeout(fadeTimer); more.classList.add("is-faded");
                        if (!video.paused) fadeTimer = setTimeout(() => {
                            if (video.parentElement === media) showOverlay();
                        }, 2500);
                    };
                    for (const type of ["pointermove", "pointerdown", "touchstart", "play", "pause", "seeking"])
                        video.addEventListener(type, activeControls);
                    video.addEventListener("pointerleave", () => { if (video.parentElement === media) showOverlay(); });
                }
                displayed = entry?.key; displayedUrl = entry?.url;
            }
            const displayedImage = media.querySelector("img");
            if (displayedImage && entry) displayedImage.alt = `Preview ${draft.entries.indexOf(entry) + 1}`;
            const keys = new Set(draft.entries.map(item => item.key));
            for (const [key, thumb] of thumbs) if (!keys.has(key)) { thumb.remove(); thumbs.delete(key); }
            draft.entries.forEach((item, index) => {
                let thumb = thumbs.get(item.key);
                if (!thumb) {
                    thumb = button("", () => { closeMenu(); draft.select(item.key); render(); }, "preview-indicator-button");
                    thumbs.set(item.key, thumb);
                }
                if (thumb.dataset.url !== item.url) {
                    thumb.replaceChildren();
                    const video = /\.(mp4|webm|mov|ogg)([?#].*)?$/i.test(item.path || item.url);
                    const node = make(video ? "video" : "img", "");
                    if (video) { node.preload = "metadata"; node.muted = true; node.playsInline = true; }
                    else { node.alt = ""; node.loading = "lazy"; }
                    node.src = localPreviewUrl(item.url); addPreviewCacheFallback(node, item.url);
                    thumb.appendChild(node); thumb.dataset.url = item.url;
                }
                const isDefault = draft.defaultKey === item.key;
                thumb.disabled = locked;
                thumb.classList.toggle("active", draft.selectedKey === item.key);
                thumb.classList.toggle("is-default", isDefault);
                thumb.setAttribute("aria-pressed", String(draft.selectedKey === item.key));
                thumb.setAttribute("aria-label", `Preview ${index + 1}${isDefault ? ", default" : ""}`);
                thumb.title = `Preview ${index + 1}${isDefault ? " (Default)" : ""}`;
                if (strip.children[index] !== thumb) strip.insertBefore(thumb, strip.children[index] ?? null);
            });
            const count = draft.entries.length;
            media.classList.toggle("has-preview", count > 0);
            Array.from(actions.children).forEach(button => { button.disabled = false; });
            if (strip.children[strip.children.length - 1] !== addTile) strip.appendChild(addTile);
            strip.hidden = count === 0;
            strip.classList.toggle("is-full", count === 5);
            addTile.hidden = count >= 5;
            addTile.disabled = locked || count >= 5;
            media.setAttribute("role", count ? "group" : "button");
            media.setAttribute("aria-label", count ? "Replace selected preview from ComfyUI" : "Add first preview from ComfyUI");
            more.hidden = count === 0 && !input;
            more.disabled = locked;
            previous.hidden = next.hidden = count < 2;
            replace.disabled = remove.disabled = !count;
            add.disabled = count >= 5;
            if (upload) upload.disabled = count >= 5;
            primary.disabled = !count || draft.defaultKey === draft.selectedKey;
            primary.textContent = count && draft.defaultKey === draft.selectedKey ? "Default preview" : "Set as default";
            if (uploadReplace) uploadReplace.disabled = !count;
            if (locked) Array.from(actions.children).forEach(button => { button.disabled = true; });
            media.tabIndex = locked ? -1 : 0;
            media.setAttribute("aria-busy", String(locked));
            previous.disabled = next.disabled = locked;
            const active = thumbs.get(draft.selectedKey);
            if (active && active.offsetLeft < strip.scrollLeft) strip.scrollLeft = active.offsetLeft;
            else if (active && active.offsetLeft + active.offsetWidth > strip.scrollLeft + strip.clientWidth)
                strip.scrollLeft = active.offsetLeft + active.offsetWidth - strip.clientWidth;
            closeMenu();
        }
        const api = {
            draft,
            load(entries) { draft.entries.forEach(release); draft.load(entries); locked = false; swipe?.reset(); render(); },
            appendTo(data) {
                const {manifest, files} = draft.serialize();
                for (const name of ["previewImage", "preview", "previewFiles", "removePreview", "images", "retainedImages", "outputImage"]) data.delete(name);
                data.set("previewManifest", JSON.stringify(manifest));
                files.forEach(file => data.append("previewFiles", file));
            },
            destroy() { toolbarProgress = 1; positionToolbar(); window.removeEventListener?.("scroll", scrollToolbar); clearTimeout(fadeTimer); draft.entries.forEach(release); media.querySelector("video")?.pause(); }
        };
        render(); return api;
    }
    window.PreviewDraft = PreviewDraft;
    window.PreviewEditor = {create};
})();
