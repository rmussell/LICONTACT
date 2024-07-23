console.log("Content script loaded and running");

function addStyleToHead() {
    const style = document.createElement('style');
    style.textContent = `
        .linkedin-grabber-hidden {
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
}

addStyleToHead();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractProfileData") {
        extractProfileData().then(profileData => {
            sendResponse({profileData: profileData});
        });
        return true;  // Indicates that the response is sent asynchronously
    }
});

async function extractProfileData() {
    try {
        console.log("Starting profile data extraction");

        const name = document.querySelector('h1.text-heading-xlarge')?.textContent.trim() || '';
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
                company = parts[1].trim();
            } else if (fullText.includes(' - ')) {
                const parts = fullText.split(' - ');
                title = parts[0].trim();
                company = parts[1].trim();
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
            const experienceSection = document.querySelector('#experience');
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

async function extractEmail() {
    try {
        console.log("Starting email extraction");
        const contactInfoButton = document.querySelector('a[href*="overlay/contact-info"], button[aria-label*="Contact info"]');

        if (!contactInfoButton) {
            console.log("Contact info button not found");
            return '';
        }

        console.log("Contact info button found, clicking");
        contactInfoButton.click();

        // Wait for the modal to appear
        const modal = await waitForElement('.artdeco-modal__content', 5000);
        if (!modal) {
            console.log("Modal not found");
            return '';
        }

        // Hide the modal
        const modalOverlay = document.querySelector('.artdeco-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.add('linkedin-grabber-hidden');
        }

        console.log("Modal opened, extracting content");
        const modalContent = extractModalContent(modal);
        const email = findEmailInContent(modalContent);
        console.log("Email found:", email);

        closeModal();
        return email;
    } catch (error) {
        console.error("Error in email extraction:", error);
        return '';
    } finally {
        // Ensure the modal is visible again
        const modalOverlay = document.querySelector('.artdeco-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('linkedin-grabber-hidden');
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
    for (const [section, items] of Object.entries(content)) {
        for (const item of items) {
            const emailMatch = item.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
                return emailMatch[0];
            }
        }
    }
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

console.log("Content script fully loaded");
