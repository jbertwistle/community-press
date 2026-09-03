"use strict";

/*
 * COMMUNITY PRESS v1.1
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

const SAFE_MARGIN = 28;

const canvasElement = document.getElementById("pressCanvas");
const canvasFrame = document.getElementById("canvasFrame");

const machineStatus = document.getElementById("machineStatus");

const headlineButton = document.getElementById("headlineButton");
const textButton = document.getElementById("textButton");
const talkButton = document.getElementById("talkButton");
const publishButton = document.getElementById("publishButton");

const latestEditions = document.getElementById("latestEditions");
const editionCount = document.getElementById("editionCount");

const editionViewer = document.getElementById("editionViewer");
const publishedSheet = document.getElementById("publishedSheet");
const downloadSheet = document.getElementById("downloadSheet");
const closeViewer = document.getElementById("closeViewer");
const reportSheet = document.getElementById("reportSheet");
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

    window.addEventListener("resize", resizeCanvasDisplay);

    resizeCanvasDisplay();
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
            });
        });

    headlineButton.addEventListener("click", addHeadline);
    textButton.addEventListener("click", addBodyText);

   

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

reportSheet.addEventListener(
    "click",
    reportCurrentEdition
);

    document.addEventListener("keydown", event => {
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

    const text = new fabric.Textbox(
        "Type or write something here.",
        {
            left: 100,
            top: 220,

            width: 690,

            fontFamily: "Georgia",
            fontSize: 36,
            lineHeight: 1.18,

            fill: "#171611",

            editable: true,

            opacity: 0
        }
    );

    canvas.add(text);
    canvas.setActiveObject(text);

    animateObjectArrival(text, 220);

    setStatus("text object inserted");

    window.setTimeout(() => {
        text.enterEditing();
        text.selectAll();

        canvas.requestRenderAll();
    }, 170);
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
    const text = new fabric.Textbox(
        textValue,
        {
            left: 100,
            top: 220,

            width: 690,

            fontFamily: "Georgia",
            fontSize: 36,
            lineHeight: 1.18,

            fill: "#171611",

            editable: true,
            opacity: 0
        }
    );

    canvas.add(text);
    canvas.setActiveObject(text);

    animateObjectArrival(text, 220);

    lastSelectedObject = text;

    canvas.requestRenderAll();

    setStatus("speech inserted");
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
    const state = JSON.stringify(canvas.toJSON());

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

    setStatus("preparing print...");

    window.setTimeout(() => {
        window.print();

        setStatus("print command sent");
    }, 120);
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

    setStatus(`${objectName} selected`);
}

function getObjectName(object) {
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
            multiplier: 1
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

        setStatus("sheet published");

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

    downloadSheet.href =
        edition.image;

    downloadSheet.download =
        `community-press-${String(
            edition.number
        ).padStart(5, "0")}.png`;

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


/* --------------------------------------------------
   REPORT
   Database reporting comes next.
-------------------------------------------------- */

function reportCurrentEdition() {
    if (!activeEdition) {
        return;
    }

    reportSheet.textContent =
        "REPORTING COMING NEXT";

    window.setTimeout(() => {
        reportSheet.textContent =
            "REPORT";
    }, 1800);
}


/* --------------------------------------------------
   DATA URL → BLOB
-------------------------------------------------- */

async function dataURLToBlob(dataURL) {
    const response =
        await fetch(dataURL);

    return await response.blob();
}
