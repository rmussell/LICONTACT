document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup DOM fully loaded');

    if (typeof sendAnalyticsEvent === 'function') {
        console.log('sendAnalyticsEvent function is available');
        sendAnalyticsEvent('extension_opened');
        console.log('Sent extension_opened event');
    } else {
        console.error('sendAnalyticsEvent function is not available');
    }

    const extractButton = document.getElementById('extractButton');
    const profileDataDiv = document.getElementById('profileData');
    const feedbackDiv = document.getElementById('feedback');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const apiKeyMask = document.getElementById('apiKeyMask');
    const editApiKeyButton = document.getElementById('editApiKey');
    const apiKeyWarning = document.getElementById('apiKeyWarning');
    const donatePayPalButton = document.getElementById('donatePayPal');
    const donateVenmoButton = document.getElementById('donateVenmo');
    const debugModeCheckbox = document.getElementById('debugModeCheckbox');
    const hubspotSetupSection = document.getElementById('hubspotSetupSection');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            console.log("Sending user_location event", { latitude, longitude });
            sendAnalyticsEvent('user_location', { latitude, longitude });
        }, (error) => {
            console.error("Error getting user location:", error);
        });
    }

    // Load and display the current API key status
    updateApiKeyDisplay();

    if (extractButton) {
        extractButton.addEventListener('click', function() {
            console.log("Extract button clicked");
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "extractProfileData"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        showFeedback("Error: " + chrome.runtime.lastError.message, "error");
                    } else if (response.status === "error") {
                        console.error(response.message);
                        showFeedback(response.message, "error");
                    } else if (response && response.status === "success" && response.data) {
                        updateProfileData(response.data);
                        chrome.runtime.sendMessage({type: "CHECK_CONTACT", profileData: response.data}, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                showFeedback("Error: " + chrome.runtime.lastError.message, "error");
                            } else {
                                showFeedback(response.message, response.status);
                                if (response.status === 'success') {
                                    console.log("Sending lead_pushed event");
                                    sendAnalyticsEvent('lead_pushed');
                                }
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
                        showFeedback("API Key saved successfully", "success");
                        console.log("Sending api_key_saved event");
                        sendAnalyticsEvent('api_key_saved');
                        
                        // Update the UI after saving the API key
                        updateApiKeyDisplay();
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

            // Show the HubSpot API setup section if the API key is being edited
            if (hubspotSetupSection) {
                hubspotSetupSection.style.display = 'block';
            }
        });
    }

    if (donatePayPalButton) {
        donatePayPalButton.addEventListener('click', function() {
            chrome.tabs.create({ url: 'https://www.paypal.com/paypalme/raelmussell' });
            console.log("Sending donate_paypal_clicked event");
            sendAnalyticsEvent('donate_paypal_clicked');
        });
    }

    if (donateVenmoButton) {
        donateVenmoButton.addEventListener('click', function() {
            chrome.tabs.create({ url: 'https://venmo.com/rael-mussell' });
            console.log("Sending donate_venmo_clicked event");
            sendAnalyticsEvent('donate_venmo_clicked');
        });
    }

    if (debugModeCheckbox) {
        chrome.storage.local.get('debugMode', function(data) {
            debugModeCheckbox.checked = data.debugMode;
        });

        debugModeCheckbox.addEventListener('change', function() {
            chrome.runtime.sendMessage({type: "SET_DEBUG_MODE", debugMode: this.checked}, function(response) {
                console.log("Debug mode set to:", this.checked);
            });
        });
    }

    function updateProfileData(profileData) {
        console.log("Received profile data:", profileData);
        for (const [key, value] of Object.entries(profileData)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value || 'No data';
                console.log(`Updated ${key} with value:`, value);
            } else {
                console.warn(`Element with ID ${key} not found`);
            }
        }
        console.log("Company data processed:", profileData.company);
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

    function updateApiKeyDisplay() {
        chrome.storage.sync.get('hubspotApiKey', function(data) {
            console.log("Updating API key display. API key exists:", !!data.hubspotApiKey);
            console.log("apiKeyStatus:", apiKeyStatus);
            console.log("apiKeyMask:", apiKeyMask);
            console.log("hubspotSetupSection:", hubspotSetupSection);
            
            if (apiKeyStatus && apiKeyMask && hubspotSetupSection) {
                if (data.hubspotApiKey) {
                    apiKeyStatus.style.display = 'block';
                    apiKeyMask.textContent = '*'.repeat(8);
                    apiKeyInput.style.display = 'none';
                    saveApiKeyButton.style.display = 'none';
                    apiKeyWarning.style.display = 'none';
                    hubspotSetupSection.style.display = 'none';
                    console.log("API key set, hiding setup section");
                } else {
                    apiKeyStatus.style.display = 'block';
                    apiKeyMask.textContent = 'NOT SET';
                    apiKeyInput.style.display = 'inline-block';
                    saveApiKeyButton.style.display = 'inline-block';
                    apiKeyWarning.style.display = 'block';
                    hubspotSetupSection.style.display = 'block';
                    console.log("API key not set, showing setup section");
                }
            } else {
                console.error("API Key status elements or HubSpot setup section not found");
            }
        });
    }
});
