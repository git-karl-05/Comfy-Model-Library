/* Shared tools always read live form values, including unsaved edits. */
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("expandedFieldEditor");
    const editor = document.getElementById("expandedFieldValue");
    let source = null;
    let opener = null;
    function close() {
        if (!source) return;
        source.value = editor.value;
        source.dispatchEvent(new Event("input", {bubbles: true}));
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        modal.inert = true;
        document.body.style.overflow = "";
        opener?.focus();
        source = null;
    }
    document.querySelectorAll("[data-edit-copy]").forEach(button => {
        button.addEventListener("click", async () => {
            const value = document.getElementById(button.dataset.editCopy).value;
            let copied = false;
            try { await navigator.clipboard.writeText(value); copied = true; }
            catch {
                const temporary = document.createElement("textarea");
                temporary.value = value;
                temporary.className = "clipboard-fallback";
                document.body.appendChild(temporary);
                temporary.select();
                try { copied = document.execCommand("copy"); } catch { /* Show failure below. */ }
                temporary.remove();
                button.focus();
            }
            button.textContent = copied ? "✓" : "!";
            button.setAttribute("aria-label", copied ? "Copied" : "Copy failed");
            setTimeout(() => { button.textContent = "⧉"; button.setAttribute("aria-label", button.dataset.copyLabel); }, 1400);
        });
    });
    document.querySelectorAll("[data-edit-expand]").forEach(button => {
        button.addEventListener("click", () => {
            source = document.getElementById(button.dataset.editExpand);
            opener = button;
            editor.value = source.value;
            document.getElementById("expandedFieldTitle").textContent = button.dataset.fieldLabel;
            editor.setAttribute("aria-label", button.dataset.fieldLabel);
            modal.inert = false;
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            editor.focus();
        });
    });
    document.getElementById("closeExpandedFieldEditor")?.addEventListener("click", close);
    modal?.addEventListener("click", event => { if (event.target === modal) close(); });
    modal?.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "Tab") {
            const closeButton = document.getElementById("closeExpandedFieldEditor");
            if (event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); editor.focus(); }
            else if (!event.shiftKey && document.activeElement === editor) { event.preventDefault(); closeButton.focus(); }
        }
    });
});
