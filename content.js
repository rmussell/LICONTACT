console.log("Content script loaded and running");

function isValidLinkedInProfilePage() {
    // Check if the URL matches a LinkedIn profile pattern
    const urlPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w\-]+\/?$/;
    console.log("Checking LinkedIn profile URL pattern");
    if (!urlPattern.test(window.location.href)) {
        console.log("URL does not match LinkedIn profile pattern: ", window.location.href);
        return false;
    }

    // Check for the presence of key profile elements
    console.log("Checking for key profile elements");
    const nameElement = document.querySelector('h1[class*="text-heading-xlarge"]');
    const profileSection = document.querySelector('section[class*="pv-top-card"]');

    if (!nameElement) {
        console.log("Name element not found");
    } else {
        const fullName = nameElement.textContent.trim();
        const [firstName, ...lastNameParts] = fullName.split(' ');
        const lastName = lastNameParts.join(' ');
        console.log(`First Name: ${firstName}, Last Name: ${lastName}`);
    }

    if (!profileSection) {
        console.log("Profile section not found");
    }

    console.log("Valid LinkedIn profile page detected");
    return true;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractProfileData") {
        if (!isValidLinkedInProfilePage()) {
            console.log("Not a valid LinkedIn profile page. Extraction aborted.");
            sendResponse({error: "Not a valid LinkedIn profile page"});
        } else {
            extractProfileData().then(profileData => {
                console.log("Profile data before sending:", JSON.stringify(profileData));
                sendResponse({profileData: profileData});
                console.log("Final profile data to display in modal:", profileData);
            }).catch(error => {
                console.error("Error extracting profile data:", error);
                sendResponse({error: "Failed to extract profile data"});
            });
        }
        return true;  // Indicates that the response is sent asynchronously
    }
});

async function extractProfileData() {
    try {
        console.log("Starting profile data extraction");

        // Extract the entire page source
        const pageSource = document.documentElement.innerHTML;

        // Use regex to find all <code> tags containing JSON-like structures
        const jsonMatches = pageSource.match(/<code[^>]*>(.*?)<\/code>/g);

        if (jsonMatches) {
            console.log(`Found ${jsonMatches.length} JSON-like structures`);
            for (const match of jsonMatches) {
                const jsonString = match.match(/<code[^>]*>(.*?)<\/code>/)[1];
                try {
                    const decodedString = JSON.parse(jsonString.replace(/&quot;/g, '"'));
                    console.log("Decoded JSON:", decodedString);

                    if (decodedString.included) {
                        for (const item of decodedString.included) {
                            if (item.firstName && item.lastName) {
                                console.log("Found firstName and lastName in JSON:", item);
                                const firstName = item.firstName || '';
                                const lastName = item.lastName || '';
                                name = `${firstName} ${lastName}`.trim();
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error parsing JSON:", error);
                }

                if (name) break;
            }
        } else {
            console.log("No JSON-like structures found");
        }

        console.log("Extracted name:", name);

        const location = document.querySelector('span.text-body-small.inline.t-black--light.break-words')?.textContent.trim() || '';
        console.log("Extracted location:", location);

        const { title, company } = await extractMostRecentJob();
        console.log("Extracted title and company:", { title, company });

        const email = await extractEmail();
        console.log("Extracted email:", email);

        const profileData = { name, title, company, location, email };
        console.log("Final extracted data:", profileData);
        return profileData;
    } catch (error) {
        console.error("Error extracting profile data:", error);
        return { name: '', title: '', company: '', location: '', email: '' };
    }
}

async function extractMostRecentJob() {
    try {
        console.log("Starting extraction of most recent job");

        let title = '';
        let company = '';

        // Try to get title and company from the top card
        const titleElement = document.querySelector('.text-body-medium');
        if (titleElement) {
            const fullText = titleElement.textContent.trim();
            console.log("Found full text in top card:", fullText);

            // Check if the title contains both title and company
            if (fullText.includes('@')) {
                const parts = fullText.split('@');
                title = parts[0].trim();
                company = parts[1].split('|')[0].trim();
            } else if (fullText.includes(' at ')) {
                const parts = fullText.split(' at ');
                title = parts[0].trim();
                company = parts[1].split(',')[0].trim();
            } else if (fullText.includes(' - ')) {
                const parts = fullText.split(' - ');
                title = parts[0].trim();
                company = parts[1].split(',')[0].trim();
            } else {
                title = fullText;
            }
        }

        // If company is still not found, try to get it from the right panel
        if (!company) {
            const companyElement = document.querySelector('.pv-text-details__right-panel-item-link span[aria-hidden="true"]');
            if (companyElement) {
                company = companyElement.textContent.trim();
            }
        }

        // If title or company is still not found, try to get from experience section
        if (!title || !company) {
            const experienceSection = document.querySelector('#experience-section');
            if (experienceSection) {
                const firstJob = experienceSection.querySelector('li.artdeco-list__item');
                if (firstJob) {
                    const jobTitleElement = firstJob.querySelector('span[aria-hidden="true"]');
                    const jobCompanyElement = firstJob.querySelector('.t-14.t-normal:not(.t-black--light)');

                    if (!title && jobTitleElement) {
                        title = jobTitleElement.textContent.trim();
                    }

                    if (!company && jobCompanyElement) {
                        company = jobCompanyElement.textContent.trim();
                    }
                }
            }
        }

        console.log("Extracted most recent job:", { title, company });
        return { title, company };
    } catch (error) {
        console.error("Error extracting most recent job:", error);
        return { title: '', company: '' };
    }
}

async function extractEmail(retryCount = 0) {
    let modalOverlay = null;
    try {
        console.log(`Starting email extraction, attempt: ${retryCount + 1}`);
        const contactInfoButton = document.querySelector('a[href*="overlay/contact-info"], button[aria-label*="Contact info"]');

        if (!contactInfoButton) {
            console.log("Contact info button not found");
            return '';
        }

        console.log("Contact info button found, clicking");
        contactInfoButton.click();

        // Wait for the modal to appear
        console.log("Waiting for modal to appear...");
        const modal = await waitForElement('.artdeco-modal__content', 10000);  // 10 seconds timeout
        if (!modal) {
            console.log(`Modal not found after 10 seconds, attempt ${retryCount + 1}`);
            if (retryCount < 2) {
                console.log("Retrying email extraction");
                await new Promise(resolve => setTimeout(resolve, 2000));  // Wait for 2 seconds before retrying
                return extractEmail(retryCount + 1);
            }
            return '';
        }
        console.log("Modal found");

        // Immediately hide the modal
        modalOverlay = document.querySelector('.artdeco-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            console.log("Modal hidden");
        } else {
            console.log("Modal overlay not found");
        }

        console.log("Extracting modal content");
        const modalContent = extractModalContent(modal);
        console.log("Modal content extracted:", JSON.stringify(modalContent, null, 2));

        const email = findEmailInContent(modalContent);
        console.log("Email search result:", email);

        if (!email && retryCount < 2) {
            console.log(`Email not found, retrying (attempt ${retryCount + 1})`);
            closeModal();
            await new Promise(resolve => setTimeout(resolve, 2000));  // Wait for 2 seconds before retrying
            return extractEmail(retryCount + 1);
        }

        closeModal();
        return email;
    } catch (error) {
        console.error(`Error in email extraction (attempt ${retryCount + 1}):`, error);
        if (retryCount < 2) {
            console.log("Error occurred, retrying");
            await new Promise(resolve => setTimeout(resolve, 2000));  // Wait for 2 seconds before retrying
            return extractEmail(retryCount + 1);
        }
        return '';
    } finally {
        // Ensure the modal is visible again in case it's needed for manual interaction
        if (modalOverlay) {
            modalOverlay.style.display = '';
            console.log("Modal visibility restored");
        }
    }
}

function closeModal() {
    const closeButton = document.querySelector('button[aria-label="Dismiss"], button[aria-label="Close"]');
    if (closeButton) {
        closeButton.click();
        console.log("Modal closed");
    } else {
        console.log("Close button not found, forcing modal removal");
        const modal = document.querySelector('.artdeco-modal');
        if (modal) {
            modal.remove();
        }
    }
    // Ensure any remaining overlay is removed
    const modalOverlay = document.querySelector('.artdeco-modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}

function extractModalContent(modal) {
    const content = {};
    const sections = modal.querySelectorAll('section');
    sections.forEach(section => {
        const title = section.querySelector('h3')?.textContent.trim() || 'Untitled Section';
        const items = Array.from(section.querySelectorAll('div')).map(div => div.textContent.trim());
        content[title] = items;
    });
    return content;
}

function findEmailInContent(content) {
    console.log("Searching for email in content");
    for (const [section, items] of Object.entries(content)) {
        console.log(`Searching in section: ${section}`);
        for (const item of items) {
            console.log(`Checking item: ${item}`);
            const emailMatch = item.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
                console.log(`Email found: ${emailMatch[0]}`);
                return emailMatch[0];
            }
        }
    }
    console.log("No email found in content");
    return '';
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

function extractCompany() {
    const experienceSection = document.getElementById('experience-section');
    if (!experienceSection) {
        console.log("Experience section not found");
        return '';
    }

    const firstExperienceItem = experienceSection.querySelector('li.artdeco-list__item');
    if (!firstExperienceItem) {
        console.log("No experience items found");
        return '';
    }

    const companyElement = firstExperienceItem.querySelector('span.pv-entity__secondary-title');
    if (companyElement) {
        return companyElement.textContent.trim();
    }

    // Fallback: try to find company name in the experience item text
    const experienceText = firstExperienceItem.textContent;
    const companyMatch = experienceText.match(/at\s+(.*?)\s*$/);
    if (companyMatch && companyMatch[1]) {
        return companyMatch[1].trim();
    }

    console.log("Company name not found in the first experience item");
    return '';
}

// Enhanced logging and error handling for name extraction
console.log("Attempting to extract name using JSON-like structures");
let name = '';

// Enhanced logging and error handling for company extraction
console.log("Attempting to extract company using primary method");
try {
    const company = extractCompany();
    console.log("Extracted company:", company);
} catch (error) {
    console.error("Error extracting company:", error);
}

// Ensure company data is correctly passed to the modal
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractProfileData") {
        if (!isValidLinkedInProfilePage()) {
            console.log("Not a valid LinkedIn profile page. Extraction aborted.");
            sendResponse({error: "Not a valid LinkedIn profile page"});
        } else {
            extractProfileData().then(profileData => {
                profileData.name = name;
                profileData.company = extractCompany();
                sendResponse({profileData: profileData});
                console.log("Final profile data to display in modal:", profileData);
            }).catch(error => {
                console.error("Error extracting profile data:", error);
                sendResponse({error: "Failed to extract profile data"});
            });
        }
        return true;  // Indicates that the response is sent asynchronously
    }
});

console.log("Content script fully loaded");

// Remove automatic extraction on page load
// Function to handle profile page load
function handleProfilePageLoad() {
    if (isValidLinkedInProfilePage()) {
        console.log("Profile page loaded");
        clearProfileData();
        // Extraction logic will be triggered by button click
    }
}

// Function to clear profile data
function clearProfileData() {
    name = '';
    profileData = {};
    console.log("Profile data cleared");
}

// Listen for URL changes
window.addEventListener('popstate', handleProfilePageLoad);

// Initial check on script load
handleProfilePageLoad();

// Add event listener for 'check contact' button
const checkContactButton = document.getElementById('checkContactButton');
if (checkContactButton) {
    checkContactButton.addEventListener('click', () => {
        if (isValidLinkedInProfilePage()) {
            extractProfileData().then(data => {
                profileData = data;
                console.log("Profile data updated:", profileData);
            }).catch(error => {
                console.error("Error updating profile data:", error);
            });
        } else {
            console.log("Not a valid LinkedIn profile page.");
        }
    });
}
