function debugLog(...args) {
    chrome.storage.local.get('debugMode', function(data) {
        if (data.debugMode) {
            console.log(...args);
        }
    });
}

window.debugLog = debugLog;
