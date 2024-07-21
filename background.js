console.log("Background script loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_CONTACT") {
        chrome.storage.sync.get('hubspotApiKey', function(data) {
            if (data.hubspotApiKey) {
                createContact(request.profileData, data.hubspotApiKey)
                    .then(() => sendResponse({status: "success", message: "Contact created successfully"}))
                    .catch(error => sendResponse({status: "error", message: "Error creating contact: " + error.message}));
            } else {
                sendResponse({status: "error", message: "HubSpot API key not set"});
            }
        });
        return true; // Indicates that the response is sent asynchronously
    }
});

function createContact(profileData, apiKey) {
    return fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            properties: {
                email: profileData.email,
                firstname: profileData.name.split(' ')[0],
                lastname: profileData.name.split(' ').slice(1).join(' '),
                jobtitle: profileData.title,
                company: profileData.company,
                city: profileData.location
            }
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message) });
        }
        return response.json();
    });
}

console.log("Background script finished loading");
