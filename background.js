chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: initializeEditor
    });
});

function initializeEditor() {
    if (window.visualEditorActive) {
        disableEditor();
    } else {
        enableEditor();
    }
}

function enableEditor() {
    window.visualEditorActive = true;
    document.body.classList.add("editor-active");
    createOverlay();
    console.log("Visual Editor Enabled");
}

function disableEditor() {
    window.visualEditorActive = false;
    document.body.classList.remove("editor-active");
    document.getElementById("editor-overlay")?.remove();
    console.log("Visual Editor Disabled");
}