// Placeholder for your OAuth 2.0 Access Token
// In practice, you'd retrieve this from storage or a secure server after the OAuth flow
const ACCESS_TOKEN = 'pat-na1-9a2f1fbe-da65-49dc-b83d-a79ddfe16dbd';

const HUBSPOT_API_BASE_URL = 'https://api.hubapi.com';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_HUBSPOT_CONTACT") {
    const { profileData } = request;
    console.log("Received profile data from content script:", profileData);
    checkContactInHubSpot(profileData)
      .then(sendResponse)
      .catch(error => console.error('Error in checking/creating contact in HubSpot:', error));
    return true; // Keep the message channel open for asynchronous response
  }
});

async function checkContactInHubSpot(profileData) {
  try {
    // Extract first name and last name from profileData
    const [firstName, ...lastNameParts] = profileData.name.split(' ');
    const lastName = lastNameParts.join(' ');

    // Check if contact exists by first name and last name
    let contactExists = await searchContactByName(firstName, lastName);
    if (contactExists) {
      console.log("Contact already exists in HubSpot.");
      return { exists: true, contactId: contactExists };
    } else {
      // Create contact (and company)
      let contactId = await createContact(profileData);
      console.log("Contact created in HubSpot with ID:", contactId);
      return { created: true, contactId: contactId };
    }
  } catch (error) {
    console.error("Error in HubSpot operations:", error);
    throw error; // Rethrow to catch in message listener
  }
}

async function searchContactByName(firstName, lastName) {
  const url = `${HUBSPOT_API_BASE_URL}/crm/v3/objects/contacts/search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`, // Assuming you're using OAuth 2.0
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "filterGroups": [{
        "filters": [
          {
            "propertyName": "firstname",
            "operator": "EQ",
            "value": firstName
          },
          {
            "propertyName": "lastname",
            "operator": "EQ",
            "value": lastName
          }
        ]
      }],
      "properties": ["firstname", "lastname", "email"]
    })
  });
  const data = await response.json();
  if (data.results && data.results.length > 0) {
    // Assuming you want to return the first match
    return data.results[0].id; // Return contact ID if exists
  } else {
    return null; // Contact does not exist
  }
}

async function createContact(profileData) {
  const url = `${HUBSPOT_API_BASE_URL}/crm/v3/objects/contacts`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email: profileData.email,
          firstname: profileData.name.split(' ')[0],
          lastname: profileData.name.split(' ').slice(1).join(' '),
          phone: profileData.phone,
          jobtitle: profileData.title,
          company: profileData.currentCompany,
          city: profileData.location // Adjust as necessary
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to create contact: ${data.message || 'Unknown error'}`);
    }
    return data.id;
  } catch (error) {
    console.error("Error creating contact in HubSpot with OAuth:", error);
    throw error;
  }
}
