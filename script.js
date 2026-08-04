"use strict";

/*
 * COMMUNITY PRESS v1.0
 *
 * The design canvas uses an internal fixed size.
 * CSS scales it to fit the available screen.
 */

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 780;

const canvasElement = document.getElementById("pressCanvas");
const canvasFrame = document.getElementById("canvasFrame");

const headlineButton = document.getElementById("headlineButton");
const textButton = document.getElementById("textButton");
const photoButton = document.getElementById("photoButton");
const shapesButton = document.getElementById("shapesButton");
const drawButton = document.getElementById("drawButton");
const undoButton = document.getElementById("undoButton");
const deleteButton = document.getElementById("deleteButton");
const printButton = document.getElementById("printButton");

const shapeTray = document.getElementById("shapeTray");
const photoInput = document.getElementById("photoInput");

let canvas;
let drawingEnabled = false;
let history = [];
let restoringHistory = false;

startCommunityPress();

function startCommunityPress() {
    if (typeof fabric === "undefined") {
        showStartupError(
            "The page-making library did not load. Refresh the page and try again."
        );
        return;
    }

    canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: "rgba(255,255,255,0)",
        preserveObjectStacking: true,
        selection: true
    });

    configureCanvas();
    connectButtons();
    saveHistory();
}

function configureCanvas() {
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#171611";
    canvas.freeDrawingBrush.width = 8;

    /*
     * Larger controls are easier to see and grab on a touchscreen.
     */
    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: "#d7cfb9",
        cornerStrokeColor: "#171611",
        borderColor: "#171611",
        cornerSize: 18,
        padding: 6
    });

    canvas.on("object:added", rememberChange);
    canvas.on("object:modified", rememberChange);
    canvas.on("object:removed", rememberChange);
    canvas.on("path:created", rememberChange);

    window.addEventListener("resize", resizeCanvasDisplay);

    resizeCanvasDisplay();
}

function connectButtons() {
    headlineButton.addEventListener("click", addHeadline);
    textButton.addEventListener("click", addBodyText);

    photoButton.addEventListener("click", () => {
        closeShapeTray();
        photoInput.click();
    });

    photoInput.addEventListener("change", addPhoto);

    shapesButton.addEventListener("click", toggleShapeTray);

    shapeTray.addEventListener("click", event => {
        const button = event.target.closest("[data-shape]");

        if (!button) {
            return;
        }

        addShape(button.dataset.shape);
        closeShapeTray();
    });

    drawButton.addEventListener("click", toggleDrawing);

    undoButton.addEventListener("click", undo);

    deleteButton.addEventListener("click", deleteSelectedObject);

    printButton.addEventListener("click", prepareAndPrint);

    document.addEventListener("keydown", event => {
        if (
            event.key === "Delete" ||
            event.key === "Backspace"
        ) {
            const activeObject = canvas.getActiveObject();

            /*
             * Do not delete the whole object while someone is editing text.
             */
            if (
                activeObject &&
                activeObject.isEditing
            ) {
                return;
            }

            deleteSelectedObject();
        }

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "z"
        ) {
            event.preventDefault();
            undo();
        }
    });
}

/* ---------- Text ---------- */

function addHeadline() {
    stopDrawing();
    closeShapeTray();

    const headline = new fabric.IText("TYPE YOUR HEADLINE", {
        left: 80,
        top: 80,
        width: 900,

        fontFamily: "Impact, Arial Black, sans-serif",
        fontSize: 82,
        fontWeight: "bold",
        lineHeight: 0.9,

        fill: "#171611",

        editable: true
    });

    canvas.add(headline);
    canvas.setActiveObject(headline);
    canvas.requestRenderAll();

    headline.enterEditing();
    headline.selectAll();
}

function addBodyText() {
    stopDrawing();
    closeShapeTray();

    const text = new fabric.Textbox(
        "Speak, type or write something here.",
        {
            left: 100,
            top: 220,
            width: 650,

            fontFamily: "Georgia, Times New Roman, serif",
            fontSize: 38,
            lineHeight: 1.15,

            fill: "#171611",

            editable: true
        }
    );

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();

    text.enterEditing();
    text.selectAll();
}

/* ---------- Photos ---------- */

function addPhoto(event) {
    stopDrawing();
    closeShapeTray();

    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        window.alert("Please choose an image file.");
        photoInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", async () => {
        try {
            const image = await fabric.FabricImage.fromURL(
                reader.result,
                {
                    crossOrigin: "anonymous"
                }
            );

            const maximumWidth = 700;
            const maximumHeight = 520;

            const scale = Math.min(
                maximumWidth / image.width,
                maximumHeight / image.height,
                1
            );

            image.set({
                left: 120,
                top: 120,
                scaleX: scale,
                scaleY: scale
            });

            canvas.add(image);
            canvas.setActiveObject(image);
            canvas.requestRenderAll();
        } catch (error) {
            console.error(error);
            window.alert("That photo could not be added.");
        } finally {
            photoInput.value = "";
        }
    });

    reader.addEventListener("error", () => {
        window.alert("That photo could not be read.");
        photoInput.value = "";
    });

    reader.readAsDataURL(file);
}

/* ---------- Shapes and collage ---------- */

function addShape(shapeName) {
    stopDrawing();

    let shape;

    switch (shapeName) {
        case "circle":
            shape = new fabric.Circle({
                radius: 100,
                fill: "#171611"
            });
            break;

        case "square":
            shape = new fabric.Rect({
                width: 220,
                height: 220,
                fill: "#171611"
            });
            break;

        case "triangle":
            shape = new fabric.Triangle({
                width: 240,
                height: 220,
                fill: "#171611"
            });
            break;

        case "star":
            shape = createStar();
            break;

        case "wing":
            shape = createWing();
            break;

        default:
            return;
    }

    shape.set({
        left: 170,
        top: 150
    });

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.requestRenderAll();
}

function createStar() {
    const points = [];
    const outsideRadius = 120;
    const insideRadius = 52;
    const pointCount = 5;

    for (let index = 0; index < pointCount * 2; index += 1) {
        const radius =
            index % 2 === 0
                ? outsideRadius
                : insideRadius;

        const angle =
            -Math.PI / 2 +
            (index * Math.PI) / pointCount;

        points.push({
            x: Math.cos(angle) * radius + outsideRadius,
            y: Math.sin(angle) * radius + outsideRadius
        });
    }

    return new fabric.Polygon(points, {
        fill: "#171611"
    });
}

function createWing() {
    /*
     * A broad teardrop form that can be duplicated,
     * rotated and combined into a butterfly.
     */

    return new fabric.Path(
        [
            "M", 20, 145,
            "C", 25, 25, 155, 0, 235, 65,
            "C", 295, 115, 260, 250, 115, 275,
            "C", 60, 285, 20, 230, 20, 145,
            "Z"
        ].join(" "),
        {
            fill: "#171611",
            stroke: "#171611",
            strokeWidth: 2
        }
    );
}

/* ---------- Drawing ---------- */

function toggleDrawing() {
    closeShapeTray();

    drawingEnabled = !drawingEnabled;
    canvas.isDrawingMode = drawingEnabled;

    drawButton.classList.toggle("active", drawingEnabled);

    if (drawingEnabled) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
    }
}

function stopDrawing() {
    drawingEnabled = false;
    canvas.isDrawingMode = false;
    drawButton.classList.remove("active");
}

/* ---------- Shapes tray ---------- */

function toggleShapeTray() {
    stopDrawing();
    shapeTray.classList.toggle("hidden");
}

function closeShapeTray() {
    shapeTray.classList.add("hidden");
}

/* ---------- Delete ---------- */

function deleteSelectedObject() {
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length === 0) {
        return;
    }

    activeObjects.forEach(object => {
        canvas.remove(object);
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();
}

/* ---------- Undo ---------- */

function rememberChange() {
    if (restoringHistory) {
        return;
    }

    /*
     * Wait until Fabric has completed the current action.
     */
    window.clearTimeout(rememberChange.timer);

    rememberChange.timer = window.setTimeout(() => {
        saveHistory();
    }, 80);
}

function saveHistory() {
    const state = JSON.stringify(canvas.toJSON());

    if (history.at(-1) === state) {
        return;
    }

    history.push(state);

    /*
     * Keep memory use under control in a public kiosk.
     */
    if (history.length > 30) {
        history.shift();
    }
}

async function undo() {
    if (history.length <= 1) {
        return;
    }

    stopDrawing();
    closeShapeTray();

    history.pop();

    const previousState = history.at(-1);

    restoringHistory = true;

    try {
        await canvas.loadFromJSON(previousState);
        canvas.requestRenderAll();
    } catch (error) {
        console.error("Undo failed:", error);
    } finally {
        restoringHistory = false;
    }
}

/* ---------- Printing ---------- */

function prepareAndPrint() {
    stopDrawing();
    closeShapeTray();

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    /*
     * Allow the selection controls to disappear before printing.
     */
    window.setTimeout(() => {
        window.print();
    }, 100);
}

/* ---------- Display scaling ---------- */

function resizeCanvasDisplay() {
    if (!canvas || !canvasFrame) {
        return;
    }

    const displayWidth = canvasFrame.clientWidth;
    const displayHeight = canvasFrame.clientHeight;

    canvas.setDimensions(
        {
            width: displayWidth,
            height: displayHeight
        },
        {
            cssOnly: true
        }
    );

    canvas.calcOffset();
    canvas.requestRenderAll();
}

/* ---------- Startup error ---------- */

function showStartupError(message) {
    canvasFrame.innerHTML = "";

    const errorBox = document.createElement("p");

    errorBox.textContent = message;
    errorBox.style.padding = "30px";
    errorBox.style.fontSize = "24px";
    errorBox.style.fontWeight = "bold";

    canvasFrame.appendChild(errorBox);
}
