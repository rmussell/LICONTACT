async function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const intervalTime = 100;
        const endTime = Number(new Date()) + timeout;

        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Number(new Date()) < endTime) {
                setTimeout(check, intervalTime);
            } else {
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }
        };

        check();
    });
}

async function extractProfileData() {
    let profileData = {
        name: "",
        title: "",
        currentCompany: ""
    };

    try {
        // Extract name - This should work as per your existing code
        const nameElement = await waitForElement('h1.text-heading-xlarge');
        profileData.name = nameElement ? nameElement.innerText.trim() : "";

        // Extract title - Adjusted to target the general text body for the title
        const titleElement = await waitForElement('.text-body-medium');
        profileData.title = titleElement ? titleElement.innerText.trim() : "";

        // Extract current company - Adjusted to target the nested structure more accurately
        const companyElement = await waitForElement('.iLHmXXJBPkAEuvMjQXdAsVWWBwamTQZoeY div');
        profileData.currentCompany = companyElement ? companyElement.innerText.trim() : "";

        console.log("Extracted profile data:", profileData);
    } catch (error) {
        console.error("Error extracting profile data:", error);
    }

    return profileData;
}

// Execute the function and send the extracted profile data to the background script
extractProfileData().then(profileData => {
    chrome.runtime.sendMessage({type: "CHECK_HUBSPOT_CONTACT", profileData}, response => {
        console.log("Response from background:", response);
    });
});

