chrome.action.onClicked.addListener((tab) => {
    // Executing content.js on the active tab when the extension is clicked
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    });
});
