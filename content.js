console.log("Content script loaded and running");

function isValidLinkedInProfilePage() {
    const urlPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w\-]+\/?$/;
    console.log("Checking LinkedIn profile URL pattern");
    return urlPattern.test(window.location.href);
}

async function extractContactInfo() {
    try {
        // Get LinkedIn profile URL
        const linkedinUrl = window.location.href.split('?')[0];
        console.log("Found LinkedIn URL:", linkedinUrl);

        // Click the contact info button
        const contactButton = document.querySelector('a[id="top-card-text-details-contact-info"]');
        if (!contactButton) {
            console.log("Contact info button not found");
            return { email: '', phone: '', websites: [], linkedinUrl };
        }

        // Create a style element to hide the modal
        const style = document.createElement('style');
        style.textContent = '.artdeco-modal-overlay { opacity: 0 !important; }';
        document.head.appendChild(style);

        // Click the button and wait for modal to load
        contactButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Extract email
        const emailElement = document.querySelector('.pv-contact-info__contact-type a[href^="mailto:"]');
        const email = emailElement ? emailElement.textContent.trim() : '';
        console.log("Found email:", email);

        // Extract phone
        const phoneElement = document.querySelector('.pv-contact-info__contact-type span.t-14.t-black.t-normal');
        const phone = phoneElement ? phoneElement.textContent.trim() : '';
        console.log("Found phone:", phone);

        // Extract websites
        const websiteElements = document.querySelectorAll('.pv-contact-info__contact-type a.pv-contact-info__contact-link');
        const websites = Array.from(websiteElements).map(a => ({
            url: a.href,
            type: a.nextElementSibling?.textContent.trim().replace(/[()]/g, '') || 'Other'
        }));
        console.log("Found websites:", websites);

        // Close the modal
        const closeButton = document.querySelector('button[aria-label="Dismiss"]');
        if (closeButton) {
            closeButton.click();
        }

        // Remove the style element
        style.remove();

        return { email, phone, websites, linkedinUrl };
    } catch (error) {
        console.error("Error extracting contact info:", error);
        return { email: '', phone: '', websites: [], linkedinUrl: window.location.href.split('?')[0] };
    }
}

async function extractProfileData() {
    try {
        console.log("Starting profile data extraction");

        if (!isValidLinkedInProfilePage()) {
            console.log("Not a valid LinkedIn profile page. Extraction aborted.");
            return null;
        }

        // Extract name from profile picture
        const profilePicture = document.querySelector('img.pv-top-card-profile-picture__image--show');
        let name = '';
        if (profilePicture) {
            console.log("Found profile picture element:", profilePicture);
            name = profilePicture.title || profilePicture.alt || '';
            console.log("Extracted name from profile picture:", name);
        }

        // Extract location - updated selector
        const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
        const location = locationElement ? locationElement.textContent.trim() : '';
        console.log("Extracted location:", location);

        // Extract job info
        const { title, company } = await extractMostRecentJob();
        console.log("Extracted title and company:", { title, company });

        // Extract contact info
        const { email, phone, websites, linkedinUrl } = await extractContactInfo();
        console.log("Extracted contact info:", { email, phone, websites, linkedinUrl });

        // Return all extracted data
        return {
            name,
            title,
            company,
            location,
            email,
            phone,
            websites,
            linkedinUrl
        };
    } catch (error) {
        console.error("Error in profile data extraction:", error);
        return null;
    }
}

async function extractMostRecentJob() {
    try {
        let title = '';
        let company = '';

        // Look for the title in the experience section's sub-components
        const titleElement = document.querySelector('.pvs-entity__sub-components .display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
        if (titleElement) {
            title = titleElement.textContent.trim();
            console.log("Found job title:", title);
        } else {
            console.log("Job title element not found");
        }

        // Look for the company name
        const companyElement = document.querySelector('a[data-field="experience_company_logo"] .display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
        if (companyElement) {
            company = companyElement.textContent.trim();
            console.log("Found company:", company);
        } else {
            console.log("Company element not found");
        }

        return { title, company };
    } catch (error) {
        console.error("Error extracting job info:", error);
        return { title: '', company: '' };
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractProfileData") {
        extractProfileData().then(profileData => {
            if (profileData) {
                console.log("Sending profile data to popup:", profileData);
                sendResponse({ status: "success", data: profileData });
            } else {
                console.log("Failed to extract profile data");
                sendResponse({ status: "error", message: "Failed to extract profile data" });
            }
        })
        .catch(error => {
            console.error("Error in profile extraction:", error);
            sendResponse({ status: "error", message: error.message });
        });
        return true;
    }
});

console.log("Content script fully loaded");
