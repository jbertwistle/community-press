"use strict";

const headlineButton = document.getElementById("headlineButton");
const clearButton = document.getElementById("clearButton");
const printButton = document.getElementById("printButton");
const workArea = document.getElementById("workArea");

let headlineCount = 0;

headlineButton.addEventListener("click", addHeadline);

clearButton.addEventListener("click", () => {
    const confirmed = window.confirm("Clear this edition?");

    if (confirmed) {
        workArea.replaceChildren();
        headlineCount = 0;
    }
});

printButton.addEventListener("click", () => {
    window.print();
});

function addHeadline() {
    headlineCount += 1;

    const headline = document.createElement("div");

    headline.className = "press-headline";
    headline.contentEditable = "true";
    headline.spellcheck = true;
    headline.textContent = "TYPE YOUR HEADLINE";

    headline.style.top = `${40 + headlineCount * 24}px`;
    headline.style.left = `${5 + headlineCount * 2}%`;

    workArea.appendChild(headline);

    makeDraggable(headline);

    headline.focus();

    selectAllText(headline);
}

function makeDraggable(element) {
    let dragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startLeft = 0;
    let startTop = 0;

    element.addEventListener("pointerdown", event => {
        /*
         * A quick touch places the cursor for editing.
         * A drag moves the complete headline.
         */

        dragging = true;

        const elementRect = element.getBoundingClientRect();
        const areaRect = workArea.getBoundingClientRect();

        startPointerX = event.clientX;
        startPointerY = event.clientY;

        startLeft = elementRect.left - areaRect.left;
        startTop = elementRect.top - areaRect.top;

        element.setPointerCapture(event.pointerId);
    });

    element.addEventListener("pointermove", event => {
        if (!dragging) {
            return;
        }

        const distanceX = event.clientX - startPointerX;
        const distanceY = event.clientY - startPointerY;

        /*
         * Allow small finger movements while editing.
         * Begin moving only after the pointer travels a little.
         */

        if (Math.abs(distanceX) < 7 && Math.abs(distanceY) < 7) {
            return;
        }

        event.preventDefault();

        const maximumLeft =
            workArea.clientWidth - Math.min(element.offsetWidth, workArea.clientWidth);

        const maximumTop =
            Math.max(0, workArea.clientHeight - element.offsetHeight);

        const nextLeft = clamp(startLeft + distanceX, 0, maximumLeft);
        const nextTop = clamp(startTop + distanceY, 0, maximumTop);

        element.style.left = `${nextLeft}px`;
        element.style.top = `${nextTop}px`;
    });

    element.addEventListener("pointerup", event => {
        dragging = false;

        if (element.hasPointerCapture(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
        }
    });

    element.addEventListener("pointercancel", () => {
        dragging = false;
    });
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function selectAllText(element) {
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(element);

    selection.removeAllRanges();
    selection.addRange(range);
}
