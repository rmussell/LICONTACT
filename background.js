console.log("Background script loaded");

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({leadsCount: 0});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_CONTACT") {
        chrome.storage.sync.get('hubspotApiKey', data => {
            if (!data.hubspotApiKey) {
                return sendResponse({status: "error", message: "HubSpot API key not set"});
            }

            createContact(request.profileData, data.hubspotApiKey)
                .then(() => {
                    chrome.storage.local.get('leadsCount', result => {
                        chrome.storage.local.set({leadsCount: (result.leadsCount || 0) + 1});
                    });
                    sendResponse({status: "success", message: "Contact created successfully"});
                })
                .catch(error => sendResponse({status: "error", message: "Error creating contact: " + error.message}));
        });
        return true;
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
                city: profileData.location,
                phone: profileData.phone,
                hs_linkedin_url: profileData.linkedinUrl
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
