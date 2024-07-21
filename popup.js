document.addEventListener('DOMContentLoaded', function() {
    const extractButton = document.getElementById('extractButton');
    const profileDataDiv = document.getElementById('profileData');
    const feedbackDiv = document.getElementById('feedback');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const apiKeyMask = document.getElementById('apiKeyMask');
    const editApiKeyButton = document.getElementById('editApiKey');
    const apiKeyWarning = document.getElementById('apiKeyWarning');

    console.log("Popup script loaded");

    // Load saved API key, if any
    chrome.storage.sync.get('hubspotApiKey', function(data) {
        console.log("Loaded API key from storage:", data.hubspotApiKey ? "Present" : "Not present");
        if (data.hubspotApiKey && apiKeyInput) {
            apiKeyInput.value = data.hubspotApiKey;
            updateApiKeyDisplay(data.hubspotApiKey);
        }
    });

    if (extractButton) {
        extractButton.addEventListener('click', function() {
            console.log("Extract button clicked");
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "extractProfileData"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        showFeedback("Error: " + chrome.runtime.lastError.message, "error");
                    } else if (response && response.profileData) {
                        updateProfileData(response.profileData);
                        chrome.runtime.sendMessage({type: "CHECK_CONTACT", profileData: response.profileData}, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                showFeedback("Error: " + chrome.runtime.lastError.message, "error");
                            } else {
                                showFeedback(response.message, response.status);
                            }
                        });
                    } else {
                        showFeedback("Failed to extract profile data", "error");
                    }
                });
            });
        });
    }

    if (saveApiKeyButton) {
        saveApiKeyButton.addEventListener('click', function() {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                chrome.storage.sync.set({hubspotApiKey: apiKey}, function() {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving API key:", chrome.runtime.lastError);
                        showFeedback("Error saving API key: " + chrome.runtime.lastError.message, "error");
                    } else {
                        console.log("API key saved successfully");
                        updateApiKeyDisplay(apiKey);
                        showFeedback("API Key saved successfully", "success");
                    }
                });
            } else {
                showFeedback("Please enter an API Key", "error");
            }
        });
    }

    if (editApiKeyButton) {
        editApiKeyButton.addEventListener('click', function() {
            apiKeyStatus.style.display = 'none';
            apiKeyInput.style.display = 'inline-block';
            saveApiKeyButton.style.display = 'inline-block';
        });
    }

    function updateProfileData(profileData) {
        for (const [key, value] of Object.entries(profileData)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value || 'No data';
            }
        }
    }

    function showFeedback(message, type) {
        if (feedbackDiv) {
            feedbackDiv.textContent = message;
            feedbackDiv.className = type;
            feedbackDiv.style.display = 'block';
            setTimeout(() => {
                feedbackDiv.style.display = 'none';
            }, 5000);
        } else {
            console.error("Feedback div not found");
        }
    }

    function updateApiKeyDisplay(apiKey) {
        if (apiKeyStatus && apiKeyMask) {
            apiKeyStatus.style.display = 'block';
            apiKeyMask.textContent = '*'.repeat(8);
            apiKeyInput.style.display = 'none';
            saveApiKeyButton.style.display = 'none';
        }
    }
});
