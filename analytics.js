// analytics.js
console.log('Analytics script loaded');

const GA_MEASUREMENT_ID = 'G-YYBG6B6Y5C';

function sendAnalyticsEvent(eventName, eventParams = {}) {
  console.log('Attempting to send analytics event:', eventName, eventParams);

  // Generate a random client ID if not already set
  chrome.storage.local.get('clientId', function(data) {
    let clientId = data.clientId;
    if (!clientId) {
      clientId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      chrome.storage.local.set({clientId: clientId});
    }

    const params = new URLSearchParams({
      v: '1',
      t: 'event',
      tid: GA_MEASUREMENT_ID,
      cid: clientId,
      ec: 'extension',
      ea: eventName,
      el: JSON.stringify(eventParams),
      ...eventParams
    });

    const url = 'https://www.google-analytics.com/collect?' + params.toString();
    console.log('Sending analytics request to:', url);

    fetch(url, {
      method: 'POST',
      mode: 'no-cors'
    }).then(() => {
      console.log('Analytics event sent successfully:', eventName, eventParams);
    }).catch((error) => {
      console.error('Error sending analytics event:', error);
    });
  });
}

console.log('Analytics module initialized with Measurement ID:', GA_MEASUREMENT_ID);
window.sendAnalyticsEvent = sendAnalyticsEvent;
