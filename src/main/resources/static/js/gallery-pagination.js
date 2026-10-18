/* Shared, one-based page-number editor. API page indexes remain zero-based. */
window.GalleryPagination = {
    render(indicator, current, total, jump) {
        const number = document.createElement("button");
        number.type = "button";
        number.className = "pagination-page-number";
        number.textContent = String(current + 1);
        number.setAttribute("aria-label", `Page ${current + 1} of ${total}. Jump to page`);
        number.disabled = total <= 1;
        indicator.replaceChildren(document.createTextNode("Page "), number, document.createTextNode(` of ${total}`));
        number.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "number"; input.inputMode = "numeric"; input.min = "1";
            input.max = String(total); input.step = "1"; input.value = String(current + 1);
            input.className = "pagination-page-input";
            input.setAttribute("aria-label", `Go to page, 1 to ${total}`);
            number.replaceWith(input); input.focus(); input.select();
            let finished = false;
            const restore = () => { if (!finished) { finished = true; input.replaceWith(number); } };
            const commit = () => {
                if (finished) return;
                const page = Number(input.value);
                if (!Number.isInteger(page) || page < 1 || page > total) {
                    input.setCustomValidity(`Enter a page from 1 to ${total}.`);
                    input.reportValidity(); return;
                }
                restore();
                if (page !== current + 1) jump(page - 1);
            };
            input.addEventListener("input", () => input.setCustomValidity(""));
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") { event.preventDefault(); commit(); }
                if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); restore(); number.focus(); }
            });
            input.addEventListener("change", commit);
            input.addEventListener("blur", () => { if (!finished) restore(); });
        });
    }
};
