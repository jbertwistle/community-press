"use strict";

/*
 * COMMUNITY PRESS v1.6
 *
 * A public broadsheet-making surface.
 *
 * The internal canvas stays at a fixed size.
 * CSS scales it to the available screen.
 */
const SUPABASE_URL =
    "https://nukcfktqqjsfzlxyknhl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_7A9kGf89X2ob6OUgt_UVJQ_2p1qDeB4";

let supabaseClient = null;
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 1700;
const PRINT_MULTIPLIER = 2;
const ARTICLE_WIDTH = 900;
const ARTICLE_GUTTER = 28;
const ARTICLE_FONT_SIZE = 30;
const ARTICLE_LINE_HEIGHT = 1.2;
const ARTICLE_PROPERTIES = [
    "communityPressType",
    "articleText",
    "articleColumns",
    "articleWidth"
];

const SAFE_MARGIN = 28;

const canvasElement = document.getElementById("pressCanvas");
const canvasFrame = document.getElementById("canvasFrame");

const machineStatus = document.getElementById("machineStatus");

const headlineButton = document.getElementById("headlineButton");
const textButton = document.getElementById("textButton");
const talkButton = document.getElementById("talkButton");
const publishButton = document.getElementById("publishButton");
const newSheet =
    document.getElementById("newSheet");

const latestEditions = document.getElementById("latestEditions");
const editionCount = document.getElementById("editionCount");

const editionViewer = document.getElementById("editionViewer");
const publishedSheet = document.getElementById("publishedSheet");
const printSheet = document.getElementById("printSheet");
const downloadSheet = document.getElementById("downloadSheet");
const closeViewer = document.getElementById("closeViewer");
const reportSheet = document.getElementById("reportSheet");
const printImage = document.getElementById("printImage");
const articleEditor = document.getElementById("articleEditor");
const articleText = document.getElementById("articleText");
const saveArticle = document.getElementById("saveArticle");
const cancelArticle = document.getElementById("cancelArticle");
const photoButton = document.getElementById("photoButton");
const shapesButton = document.getElementById("shapesButton");
const drawButton = document.getElementById("drawButton");
const undoButton = document.getElementById("undoButton");

const duplicateButton =
    document.getElementById("duplicateButton");

const deleteButton = document.getElementById("deleteButton");


const shapeTray = document.getElementById("shapeTray");
const photoInput = document.getElementById("photoInput");

let canvas;
let drawingEnabled = false;
let lastSelectedObject = null;

let speechRecognition = null;
let speechIsListening = false;
let dictatedText = "";


let history = [];
let restoringHistory = false;
let publishedEditions = [];
let activeEdition = null;
let articleBeingEdited = null;
let articleColumnCount = 2;

startCommunityPress();

/* --------------------------------------------------
   STARTUP
-------------------------------------------------- */

function startCommunityPress() {
    if (typeof fabric === "undefined") {
        showStartupError(
            "fabric unavailable · reload required"
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

    if (fabric.FabricObject) {
        fabric.FabricObject.customProperties = [
            ...new Set([
                ...(fabric.FabricObject.customProperties || []),
                ...ARTICLE_PROPERTIES
            ])
        ];
    }

    configureCanvas();
    connectButtons();
    saveHistory();

    if (window.supabase) {
        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );

        loadPublishedEditions();
    } else {
        console.error(
            "Supabase library did not load."
        );

        setStatus("archive unavailable");
        return;
    }

    setStatus("status: ready");
}

  

/* --------------------------------------------------
   CANVAS CONFIGURATION
-------------------------------------------------- */

function configureCanvas() {
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#171611";
    canvas.freeDrawingBrush.width = 8;

    /*
     * Smaller, utilitarian controls.
     * Less PowerPoint, more drafting table.
     */

    fabric.Object.prototype.set({
        transparentCorners: false,

        cornerColor: "#171611",
        cornerStrokeColor: "#d7cfb9",
        borderColor: "#171611",

        cornerStyle: "rect",
        cornerSize: 13,

        borderScaleFactor: 1.25,
        padding: 4
    });

    /*
     * Keep objects on the printable sheet.
     */

    canvas.on("object:moving", keepObjectOnSheet);
    canvas.on("object:scaling", keepObjectOnSheet);
    canvas.on("object:modified", keepObjectOnSheet);

    /*
     * Remember actions for Undo.
     */

    canvas.on("object:added", rememberChange);
    canvas.on("object:modified", rememberChange);
    canvas.on("object:removed", rememberChange);
    canvas.on("path:created", rememberChange);

  canvas.on("selection:created", rememberSelectedObject);
canvas.on("selection:updated", rememberSelectedObject);

canvas.on("selection:cleared", () => {
    /*
     * Keep the last object available when someone
     * moves from the canvas to a toolbar button.
     */
    if (!drawingEnabled) {
        setStatus("status: ready");
    }
});

    canvas.on("mouse:dblclick", event => {
        if (isArticle(event.target)) {
            openArticleEditor(event.target);
        }
    });

    window.addEventListener("resize", resizeCanvasDisplay);

    resizeCanvasDisplay();
}

function startNewSheet() {
    if (!canvas) {
        return;
    }

    stopDrawing();
    closeShapeTray();

    canvas.discardActiveObject();
    canvas.clear();

    canvas.backgroundColor =
        "rgba(255,255,255,0)";

    canvas.requestRenderAll();

    saveHistory();

    setStatus("status: ready");
}

/* --------------------------------------------------
   BUTTONS
-------------------------------------------------- */



function connectButtons() {
    document
        .querySelectorAll("#toolTray button, #shapeTray button")
        .forEach(button => {
            button.addEventListener("pointerdown", event => {
                event.preventDefault();

                newSheet.addEventListener(
    "click",
    startNewSheet
);
            });
        });

    headlineButton.addEventListener("click", addHeadline);
    textButton.addEventListener("click", addBodyText);

    articleEditor.addEventListener("click", event => {
        const columnButton = event.target.closest("[data-columns]");

        if (columnButton) {
            setArticleColumnCount(Number(columnButton.dataset.columns));
        }
    });

    saveArticle.addEventListener("click", saveArticleFromEditor);
    cancelArticle.addEventListener("click", closeArticleEditor);

   

talkButton.addEventListener(
    "click",
    toggleSpeechRecognition
);

    photoButton.addEventListener("click", () => {
        stopDrawing();
        closeShapeTray();

        setStatus("waiting for image...");
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

    duplicateButton.addEventListener(
        "click",
        duplicateSelectedObject
    );

    deleteButton.addEventListener(
        "click",
        deleteSelectedObject
    );

   publishButton.addEventListener(
    "click",
    publishCurrentSheet
);

closeViewer.addEventListener(
    "click",
    closeEditionViewer
);

printSheet.addEventListener(
    "click",
    printCurrentEdition
    
);

    downloadSheet.addEventListener(
    "click",
    downloadCurrentEdition
);

reportSheet.addEventListener(
    "click",
    reportCurrentEdition
);
    document.addEventListener("keydown", event => {
        if (event.target.matches("input, textarea")) {
            if (event.key === "Escape") {
                closeArticleEditor();
            }

            return;
        }

        const activeObject = canvas.getActiveObject();

        if (
            event.key === "Delete" ||
            event.key === "Backspace"
        ) {
            if (activeObject?.isEditing) {
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

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "d"
        ) {
            event.preventDefault();
            duplicateSelectedObject();
        }
    });
}
/* --------------------------------------------------
   TEXT
-------------------------------------------------- */

function addHeadline() {
    stopDrawing();
    closeShapeTray();

    const headline = new fabric.Textbox(
        "TYPE HEADLINE",
        {
            left: 90,
            top: 75,

            width: 900,

            fontFamily: "Courier New",
            fontSize: 72,
            fontWeight: "bold",
            lineHeight: 0.92,

            fill: "#171611",

            editable: true,

            opacity: 0
        }
    );

    canvas.add(headline);
    canvas.setActiveObject(headline);

    animateObjectArrival(headline, 75);

    setStatus("headline inserted");

    window.setTimeout(() => {
        headline.enterEditing();
        headline.selectAll();

        canvas.requestRenderAll();
    }, 170);
}

function addBodyText() {
    stopDrawing();
    closeShapeTray();

    openArticleEditor();
}

function openArticleEditor(article = null, initialText = "") {
    articleBeingEdited = isArticle(article) ? article : null;
    articleText.value = articleBeingEdited?.articleText || initialText;

    setArticleColumnCount(articleBeingEdited?.articleColumns || 2);

    saveArticle.textContent = articleBeingEdited
        ? "UPDATE ARTICLE"
        : "PLACE ARTICLE";

    articleEditor.classList.remove("hidden");
    articleText.focus();

    setStatus(articleBeingEdited ? "editing article" : "composing article");
}

function closeArticleEditor() {
    articleEditor.classList.add("hidden");
    articleBeingEdited = null;
    articleText.value = "";
    setStatus("status: ready");
}

function setArticleColumnCount(columnCount) {
    articleColumnCount = Math.min(3, Math.max(1, columnCount));

    articleEditor
        .querySelectorAll("[data-columns]")
        .forEach(button => {
            button.classList.toggle(
                "active",
                Number(button.dataset.columns) === articleColumnCount
            );
        });
}

function saveArticleFromEditor() {
    const sourceText = articleText.value.trim();

    if (!sourceText) {
        setStatus("article needs words");
        articleText.focus();
        return;
    }

    if (articleBeingEdited) {
        replaceArticle(
            articleBeingEdited,
            sourceText,
            articleColumnCount
        );
    } else {
        addArticle(sourceText, articleColumnCount);
    }

    articleEditor.classList.add("hidden");
    articleBeingEdited = null;
    articleText.value = "";
}

function addArticle(sourceText, columnCount = 2, placement = {}) {
    const article = createArticleGroup(sourceText, columnCount);

    article.set({
        left: placement.left ?? 100,
        top: placement.top ?? 220,
        angle: placement.angle ?? 0,
        scaleX: placement.scaleX ?? 1,
        scaleY: placement.scaleY ?? 1,
        opacity: placement.opacity ?? 0
    });

    canvas.add(article);
    canvas.setActiveObject(article);

    if (placement.opacity === undefined) {
        animateObjectArrival(article, placement.top ?? 220);
    }

    lastSelectedObject = article;
    canvas.requestRenderAll();
    setStatus(`${columnCount}-column article inserted`);

    return article;
}

function replaceArticle(article, sourceText, columnCount) {
    const placement = {
        left: article.left,
        top: article.top,
        angle: article.angle,
        scaleX: article.scaleX,
        scaleY: article.scaleY,
        opacity: 1
    };

    canvas.remove(article);

    const replacement = addArticle(sourceText, columnCount, placement);
    keepObjectOnSheet({ target: replacement });
    setStatus("article updated");
}

function createArticleGroup(sourceText, columnCount) {
    const safeColumnCount = Math.min(3, Math.max(1, columnCount));
    const columnWidth =
        (ARTICLE_WIDTH - ARTICLE_GUTTER * (safeColumnCount - 1)) /
        safeColumnCount;

    const columnTexts = splitTextIntoColumns(
        sourceText,
        safeColumnCount,
        columnWidth
    );

    const columns = columnTexts.map((columnText, index) => {
        return new fabric.Textbox(columnText, {
            left: index * (columnWidth + ARTICLE_GUTTER),
            top: 0,
            width: columnWidth,
            fontFamily: "Georgia",
            fontSize: ARTICLE_FONT_SIZE,
            lineHeight: ARTICLE_LINE_HEIGHT,
            splitByGrapheme: true
            fill: "#171611",
            editable: false,
            selectable: false,
            evented: false
        });
    });

    return new fabric.Group(columns, {
        communityPressType: "article",
        articleText: sourceText,
        articleColumns: safeColumnCount,
        articleWidth: ARTICLE_WIDTH,
        subTargetCheck: false,
        objectCaching: false
    });
}

function splitTextIntoColumns(sourceText, columnCount, columnWidth) {
    if (columnCount === 1) {
        return [sourceText];
    }

    let remainingTokens = sourceText.match(/\S+\s*/g) || [];
    const columns = [];

    for (let columnIndex = 0; columnIndex < columnCount - 1; columnIndex += 1) {
        const remainingColumnCount = columnCount - columnIndex;
        const remainingText = remainingTokens.join("").trim();
        const targetHeight =
            measureArticleTextHeight(remainingText, columnWidth) /
            remainingColumnCount;

        const maximumTake =
            remainingTokens.length - (remainingColumnCount - 1);

        let low = 1;
        let high = Math.max(1, maximumTake);
        let best = 1;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const candidate = remainingTokens.slice(0, middle).join("").trim();
            const height = measureArticleTextHeight(candidate, columnWidth);

            if (height <= targetHeight) {
                best = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        columns.push(remainingTokens.slice(0, best).join("").trim());
        remainingTokens = remainingTokens.slice(best);
    }

    columns.push(remainingTokens.join("").trim());
    return columns;
}

function measureArticleTextHeight(sourceText, width) {
    const measurement = new fabric.Textbox(sourceText || " ", {
        width,
        fontFamily: "Georgia",
        fontSize: ARTICLE_FONT_SIZE,
        lineHeight: ARTICLE_LINE_HEIGHT
    });

    return measurement.height || ARTICLE_FONT_SIZE;
}

function isArticle(object) {
    return object?.communityPressType === "article";
}
/* --------------------------------------------------
   TALK / SPEECH TO TEXT
-------------------------------------------------- */

function toggleSpeechRecognition() {
    if (speechIsListening) {
        stopSpeechRecognition();
        return;
    }

    startSpeechRecognition();
}

function startSpeechRecognition() {
    stopDrawing();
    closeShapeTray();

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setStatus("speech unavailable · use words");
        return;
    }

    dictatedText = "";

    speechRecognition = new SpeechRecognition();

    /*
     * Canadian English for the first prototype.
     * This can later become a language-choice control.
     */
    speechRecognition.lang = "en-CA";

    /*
     * One spoken passage per button press.
     */
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.maxAlternatives = 1;

    speechRecognition.onstart = () => {
        speechIsListening = true;

        talkButton.classList.add("active");
        setStatus("listening...");
    };

    speechRecognition.onresult = event => {
        let interimText = "";

        for (
            let index = event.resultIndex;
            index < event.results.length;
            index += 1
        ) {
            const transcript =
                event.results[index][0].transcript;

            if (event.results[index].isFinal) {
                dictatedText += transcript;
            } else {
                interimText += transcript;
            }
        }

        if (interimText.trim()) {
            setStatus(`hearing: ${interimText.trim()}`);
        }
    };

    speechRecognition.onerror = event => {
        console.error(
            "Speech recognition error:",
            event.error
        );

        speechIsListening = false;
        talkButton.classList.remove("active");

        switch (event.error) {
            case "not-allowed":
            case "service-not-allowed":
                setStatus("microphone permission required");
                break;

            case "no-speech":
                setStatus("no speech detected");
                break;

            case "audio-capture":
                setStatus("microphone unavailable");
                break;

            default:
                setStatus("speech recognition failed");
        }
    };

    speechRecognition.onend = () => {
        speechIsListening = false;
        talkButton.classList.remove("active");

        const finishedText = dictatedText.trim();

        if (finishedText) {
            insertDictatedText(finishedText);
        } else if (
            machineStatus.textContent === "listening..."
        ) {
            setStatus("no speech detected");
        }

        speechRecognition = null;
    };

    try {
        speechRecognition.start();
    } catch (error) {
        console.error(
            "Speech recognition could not start:",
            error
        );

        speechIsListening = false;
        talkButton.classList.remove("active");

        setStatus("speech could not start");
    }
}

function stopSpeechRecognition() {
    if (!speechRecognition) {
        return;
    }

    setStatus("processing speech...");
    speechRecognition.stop();
}

function insertDictatedText(textValue) {
    addArticle(textValue, 2);
    setStatus("speech inserted as 2-column article");
}
/* --------------------------------------------------
   IMAGE IMPORT
-------------------------------------------------- */

function addPhoto(event) {
    stopDrawing();
    closeShapeTray();

    const file = event.target.files?.[0];

    if (!file) {
        setStatus("image import cancelled");
        return;
    }

    if (!file.type.startsWith("image/")) {
        window.alert("Please choose an image file.");

        photoInput.value = "";
        setStatus("unsupported file");

        return;
    }

    setStatus("reading image...");

    const reader = new FileReader();

    reader.addEventListener("load", async () => {
        try {
            const image = await fabric.FabricImage.fromURL(
                reader.result,
                {
                    crossOrigin: "anonymous"
                }
            );

            const maximumWidth = 730;
            const maximumHeight = 540;

            const scale = Math.min(
                maximumWidth / image.width,
                maximumHeight / image.height,
                1
            );

            image.set({
                left: 150,
                top: 110,

                scaleX: scale,
                scaleY: scale,

                opacity: 0
            });

            canvas.add(image);
            canvas.setActiveObject(image);

            animateObjectArrival(image, 110);

            setStatus("image imported");
        } catch (error) {
            console.error(error);

            window.alert("That image could not be added.");
            setStatus("image import failed");
        } finally {
            photoInput.value = "";
        }
    });

    reader.addEventListener("error", () => {
        window.alert("That image could not be read.");

        photoInput.value = "";
        setStatus("image read failed");
    });

    reader.readAsDataURL(file);
}

/* --------------------------------------------------
   SHAPES
-------------------------------------------------- */

function addShape(shapeName) {
    stopDrawing();

    let shape;

    switch (shapeName) {
        case "circle":
            shape = new fabric.Circle({
                radius: 95,
                fill: "#171611"
            });
            break;

        case "square":
            shape = new fabric.Rect({
                width: 205,
                height: 205,
                fill: "#171611"
            });
            break;

        case "triangle":
            shape = new fabric.Triangle({
                width: 225,
                height: 210,
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
        left: 180,
        top: 145,
        opacity: 0
    });

    canvas.add(shape);
    canvas.setActiveObject(shape);

    animateObjectArrival(shape, 145);

    setStatus(`${shapeName} inserted`);
}

function createStar() {
    const points = [];

    const outsideRadius = 115;
    const insideRadius = 50;
    const pointCount = 5;

    for (
        let index = 0;
        index < pointCount * 2;
        index += 1
    ) {
        const radius =
            index % 2 === 0
                ? outsideRadius
                : insideRadius;

        const angle =
            -Math.PI / 2 +
            (index * Math.PI) / pointCount;

        points.push({
            x:
                Math.cos(angle) * radius +
                outsideRadius,

            y:
                Math.sin(angle) * radius +
                outsideRadius
        });
    }

    return new fabric.Polygon(points, {
        fill: "#171611"
    });
}

function createWing() {
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
function rememberSelectedObject() {
    const selected = canvas.getActiveObject();

    if (selected) {
        lastSelectedObject = selected;
    }

    updateObjectStatus();
}
/* --------------------------------------------------
   OBJECT ARRIVAL
-------------------------------------------------- */

function animateObjectArrival(object, finalTop) {
    /*
     * A slight mechanical drop.
     * No bounce and no congratulatory flourish.
     */

    object.set({
        top: finalTop - 18,
        opacity: 0
    });

    object.animate(
        {
            top: finalTop,
            opacity: 1
        },
        {
            duration: 150,
            easing: fabric.util.ease.easeOutCubic,

            onChange: () => {
                canvas.requestRenderAll();
            },

            onComplete: () => {
                keepObjectOnSheet({
                    target: object
                });

                canvas.requestRenderAll();
            }
        }
    );
}

/* --------------------------------------------------
   DRAWING
-------------------------------------------------- */

function toggleDrawing() {
    closeShapeTray();

    drawingEnabled = !drawingEnabled;
    canvas.isDrawingMode = drawingEnabled;

    drawButton.classList.toggle(
        "active",
        drawingEnabled
    );

    if (drawingEnabled) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();

        setStatus("mode: draw");
    } else {
        setStatus("mode: select");
    }
}

function stopDrawing() {
    drawingEnabled = false;
    canvas.isDrawingMode = false;

    drawButton.classList.remove("active");
}

/* --------------------------------------------------
   SHAPE TRAY
-------------------------------------------------- */

function toggleShapeTray() {
    stopDrawing();

    const isOpening =
        shapeTray.classList.contains("hidden");

    shapeTray.classList.toggle("hidden");

    setStatus(
        isOpening
            ? "shape tray open"
            : "shape tray closed"
    );
}

function closeShapeTray() {
    shapeTray.classList.add("hidden");
}

/* --------------------------------------------------
   KEEP OBJECTS ON THE SHEET
-------------------------------------------------- */

function keepObjectOnSheet(event) {
    const object = event.target;

    if (!object) {
        return;
    }

    object.setCoords();

    const bounds = object.getBoundingRect();

    /*
     * Adjust using the object's current position.
     * This allows rotation while still keeping some
     * visible, printable margin around the object.
     */

    if (bounds.left < SAFE_MARGIN) {
        object.left += SAFE_MARGIN - bounds.left;
    }

    if (bounds.top < SAFE_MARGIN) {
        object.top += SAFE_MARGIN - bounds.top;
    }

    if (
        bounds.left + bounds.width >
        CANVAS_WIDTH - SAFE_MARGIN
    ) {
        object.left -=
            bounds.left +
            bounds.width -
            (CANVAS_WIDTH - SAFE_MARGIN);
    }

    if (
        bounds.top + bounds.height >
        CANVAS_HEIGHT - SAFE_MARGIN
    ) {
        object.top -=
            bounds.top +
            bounds.height -
            (CANVAS_HEIGHT - SAFE_MARGIN);
    }

    object.setCoords();
}
/* --------------------------------------------------
   DELETE
-------------------------------------------------- */

function deleteSelectedObject() {
    stopDrawing();
    closeShapeTray();

    const object =
        canvas.getActiveObject() ||
        lastSelectedObject;

    if (!object) {
        setStatus("nothing selected");
        return;
    }

    /*
     * An ActiveSelection contains several objects.
     */
    if (object.type === "activeSelection") {
        const objects = [...object.getObjects()];

        canvas.discardActiveObject();

        objects.forEach(item => {
            canvas.remove(item);
        });

        setStatus(`${objects.length} objects deleted`);
    } else {
        canvas.remove(object);
        setStatus("object deleted");
    }

    lastSelectedObject = null;

    canvas.discardActiveObject();
    canvas.requestRenderAll();
}

/* --------------------------------------------------
   UNDO
-------------------------------------------------- */

function rememberChange() {
    if (restoringHistory) {
        return;
    }

    window.clearTimeout(rememberChange.timer);

    rememberChange.timer = window.setTimeout(() => {
        saveHistory();
    }, 90);
}

function saveHistory() {
    const state = JSON.stringify(canvas.toJSON(ARTICLE_PROPERTIES));

    if (history.at(-1) === state) {
        return;
    }

    history.push(state);

    if (history.length > 30) {
        history.shift();
    }
}

async function undo() {
    if (history.length <= 1) {
        setStatus("undo unavailable");
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

        setStatus("previous state restored");
    } catch (error) {
        console.error("Undo failed:", error);

        setStatus("undo failed");
    } finally {
        restoringHistory = false;
    }
}
/* --------------------------------------------------
   DUPLICATE
-------------------------------------------------- */

async function duplicateSelectedObject() {
    stopDrawing();
    closeShapeTray();

    const original =
        canvas.getActiveObject() ||
        lastSelectedObject;

    if (!original) {
        setStatus("nothing selected");
        return;
    }

    setStatus("duplicating...");

    try {
        const copy = await original.clone();

        if (isArticle(original)) {
            copy.set({
                communityPressType: original.communityPressType,
                articleText: original.articleText,
                articleColumns: original.articleColumns,
                articleWidth: original.articleWidth
            });
        }

        copy.set({
            left: (original.left ?? 0) + 40,
            top: (original.top ?? 0) + 40,
            evented: true,
            selectable: true
        });

        canvas.add(copy);

        keepObjectOnSheet({
            target: copy
        });

        canvas.setActiveObject(copy);
        lastSelectedObject = copy;

        canvas.requestRenderAll();

        setStatus("object duplicated");
    } catch (error) {
        console.error("Duplicate failed:", error);
        setStatus("duplicate failed");
    }
}
/* --------------------------------------------------
   PRINT
-------------------------------------------------- */

function prepareAndPrint() {
    stopDrawing();
    closeShapeTray();

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const imageData = canvas.toDataURL({
        format: "png",
        multiplier: PRINT_MULTIPLIER
    });

    printPreparedSheet(imageData).catch(error => {
        console.error("Community Press print failed:", error);
        setStatus("print failed");
    });
}

async function printPreparedSheet(imageSource) {
    setStatus("preparing 11 × 17 print...");

    await loadPrintImage(imageSource);

    setStatus("sending sheet to printer...");

    /*
     * In an ordinary browser this opens the normal print dialogue.
     * Chrome/Edge launched with --kiosk-printing sends it directly
     * to the computer's default printer.
     */
    await nextPaint();
    await nextPaint();
    window.print();

    setStatus("print command sent");
}

function loadPrintImage(imageSource) {
    return new Promise((resolve, reject) => {
        const onLoad = async () => {
            cleanup();

            try {
                if (typeof printImage.decode === "function") {
                    await printImage.decode();
                }
            } catch (error) {
                /* The load event already confirms the image is usable. */
            }

            resolve();
        };

        const onError = () => {
            cleanup();
            reject(new Error("The printable sheet could not be prepared."));
        };

        const cleanup = () => {
            printImage.removeEventListener("load", onLoad);
            printImage.removeEventListener("error", onError);
        };

        printImage.addEventListener("load", onLoad, { once: true });
        printImage.addEventListener("error", onError, { once: true });
        printImage.src = imageSource;

        if (printImage.complete && printImage.naturalWidth > 0) {
            onLoad();
        }
    });
}

function nextPaint() {
    return new Promise(resolve => {
        window.requestAnimationFrame(resolve);
    });
}

/* --------------------------------------------------
   STATUS
-------------------------------------------------- */

function setStatus(message) {
    machineStatus.textContent = message;
}

function updateObjectStatus() {
    const objectCount =
        canvas.getActiveObjects().length;

    if (objectCount > 1) {
        setStatus(`${objectCount} objects selected`);
        return;
    }

    const object = canvas.getActiveObject();

    if (!object) {
        setStatus("status: ready");
        return;
    }

    const objectName = getObjectName(object);

    setStatus(
        isArticle(object)
            ? "article selected · double-click to edit"
            : `${objectName} selected`
    );
}

function getObjectName(object) {
    if (isArticle(object)) {
        return "article";
    }

    const type =
        object.type?.toLowerCase() ?? "object";

    if (
        type.includes("text") ||
        type.includes("i-text")
    ) {
        return "text";
    }

    if (type.includes("image")) {
        return "image";
    }

    if (type.includes("path")) {
        return "path";
    }

    return type;
}

/* --------------------------------------------------
   DISPLAY SCALING
-------------------------------------------------- */

function resizeCanvasDisplay() {
    if (!canvas || !canvasFrame) {
        return;
    }

    const displayWidth = canvasFrame.clientWidth;

    const displayHeight =
        displayWidth * (CANVAS_HEIGHT / CANVAS_WIDTH);

    canvas.setDimensions(
        {
            width: displayWidth,
            height: displayHeight
        },
        {
            cssOnly: true
        }
    );
}
/* --------------------------------------------------
   STARTUP ERROR
-------------------------------------------------- */

function showStartupError(message) {
    canvasFrame.innerHTML = "";

    const errorBox = document.createElement("p");

    errorBox.textContent = message;

    errorBox.style.padding = "25px";
    errorBox.style.fontFamily =
        '"Courier New", monospace';

    errorBox.style.fontSize = "18px";
    errorBox.style.fontWeight = "bold";

    canvasFrame.appendChild(errorBox);
}

/* --------------------------------------------------
   COMMUNITY PRESS v1.4
   PERSISTENT PUBLISHING
-------------------------------------------------- */

async function publishCurrentSheet() {
    stopDrawing();
    closeShapeTray();

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    setStatus("publishing sheet...");
    publishButton.disabled = true;

    try {
        /*
         * Flatten the finished Fabric sheet into
         * a PNG before anything leaves the editor.
         */
        const imageData = canvas.toDataURL({
            format: "png",
            multiplier: PRINT_MULTIPLIER
        });

        const imageBlob =
            await dataURLToBlob(imageData);

        const fileName =
            `edition-${Date.now()}-${crypto.randomUUID()}.png`;

        const filePath =
            `editions/${fileName}`;

        /*
         * Upload flattened image.
         */
        const { error: uploadError } =
            await supabaseClient
                .storage
                .from("community-press")
                .upload(
                    filePath,
                    imageBlob,
                    {
                        contentType: "image/png",
                        cacheControl: "3600",
                        upsert: false
                    }
                );

        if (uploadError) {
            throw uploadError;
        }

        /*
         * Add publication to the archive database.
         */
        const { error: insertError } =
            await supabaseClient
                .from("community_press_editions")
                .insert({
                    image_path: filePath,
                    status: "published"
                });

        if (insertError) {
            throw insertError;
        }

        await loadPublishedEditions();

        setStatus("sheet published · preparing print...");

        try {
            await printPreparedSheet(imageData);
        } catch (printError) {
            console.error(
                "Community Press print failed:",
                printError
            );

            setStatus("sheet published · print failed");
        }

    } catch (error) {
        console.error(
            "Community Press publish failed:",
            error
        );

        setStatus("publication failed");

    } finally {
        publishButton.disabled = false;
    }
}


/* --------------------------------------------------
   LOAD ARCHIVE
-------------------------------------------------- */

async function loadPublishedEditions() {
    const { data, error } =
        await supabaseClient
            .from("community_press_editions")
            
               .select(
    "id, created_at, image_path, report_count, edition_number"
)
            .eq("status", "published")
            .order(
                "created_at",
                { ascending: false }
            )
            .limit(50);

    if (error) {
        console.error(
            "Could not load Community Press archive:",
            error
        );

        setStatus("archive unavailable");
        return;
    }

    publishedEditions =
       data.map(row => {

            const { data: publicURL } =
                supabaseClient
                    .storage
                    .from("community-press")
                    .getPublicUrl(
                        row.image_path
                    );

            return {
                id: row.id,
                number: row.edition_number,
                image: publicURL.publicUrl,
                imagePath: row.image_path,
                publishedAt:
                    new Date(row.created_at),
                reportCount:
                    row.report_count ?? 0
            };
        });

    renderLatestEditions();
}


/* --------------------------------------------------
   RENDER LATEST EDITIONS
-------------------------------------------------- */

function renderLatestEditions() {
    latestEditions.innerHTML = "";

    publishedEditions.forEach(edition => {

        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "editionThumbnail";

        const image =
            document.createElement("img");

        image.src = edition.image;

        image.alt =
            `Community Press edition ${edition.number}`;

        const label =
            document.createElement("span");

        label.className =
            "editionNumber";

        label.textContent =
            `sheet: ${String(
                edition.number
            ).padStart(5, "0")}`;

        button.appendChild(image);
        button.appendChild(label);

        button.addEventListener(
            "click",
            () => openEditionViewer(edition)
        );

        latestEditions.appendChild(button);
    });

    const count =
        publishedEditions.length;

    editionCount.textContent =
        `${count} ${
            count === 1
                ? "sheet"
                : "sheets"
        }`;
}


/* --------------------------------------------------
   EDITION VIEWER
-------------------------------------------------- */

function openEditionViewer(edition) {
    activeEdition = edition;

    publishedSheet.src =
        edition.image;

    editionViewer.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


function closeEditionViewer() {
    editionViewer.classList.add(
        "hidden"
    );

    publishedSheet.src = "";

    activeEdition = null;

    document.body.style.overflow = "";
}


async function printCurrentEdition() {
    if (!activeEdition) {
        return;
    }

    try {
        await printPreparedSheet(activeEdition.image);
    } catch (error) {
        console.error("Community Press print failed:", error);
        setStatus("print failed");
    }
}
async function downloadCurrentEdition() {
    if (!activeEdition) {
        return;
    }

    setStatus("preparing download...");

    try {
        const response =
            await fetch(activeEdition.image);

        if (!response.ok) {
            throw new Error(
                `Download failed: ${response.status}`
            );
        }

        const blob =
            await response.blob();

        const blobURL =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = blobURL;

        link.download =
            `community-press-${String(
                activeEdition.number
            ).padStart(5, "0")}.png`;

        document.body.appendChild(link);

        link.click();
        link.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(blobURL);
        }, 1000);

        setStatus("download ready");

    } catch (error) {
        console.error(
            "Community Press download failed:",
            error
        );

        setStatus("download failed");
    }
}
/* --------------------------------------------------
   REPORT
   Database reporting comes next.
-------------------------------------------------- */

async function reportCurrentEdition() {
    if (!activeEdition) {
        return;
    }

    reportSheet.disabled = true;
    reportSheet.textContent = "REPORTING...";

    try {
        const { error } =
            await supabaseClient
                .from("community_press_reports")
                .insert({
                    edition_id: activeEdition.id
                });

        if (error) {
            throw error;
        }

        reportSheet.textContent = "REPORTED";
        setStatus("report submitted");

    } catch (error) {
        console.error(
            "Community Press report failed:",
            error
        );

        reportSheet.textContent = "REPORT";
        reportSheet.disabled = false;

        setStatus("report failed");
    }
}


/* --------------------------------------------------
   DATA URL → BLOB
-------------------------------------------------- */

async function dataURLToBlob(dataURL) {
    const response =
        await fetch(dataURL);

    return await response.blob();
}
