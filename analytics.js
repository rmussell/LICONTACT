// analytics.js
console.log('Analytics script loaded');

const GA_MEASUREMENT_ID = 'G-YYBG6B6Y5C';

function sendAnalyticsEvent(eventName, eventParams = {}) {
  chrome.storage.local.get('clientId', function(data) {
    const clientId = data.clientId || Math.random().toString(36).substring(2) + Date.now().toString(36);
    if (!data.clientId) {
      chrome.storage.local.set({clientId});
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

    fetch('https://www.google-analytics.com/collect?' + params.toString(), {
      method: 'POST',
      mode: 'no-cors'
    }).catch(error => console.error('Analytics error:', error));
  });
}

console.log('Analytics module initialized with Measurement ID:', GA_MEASUREMENT_ID);
window.sendAnalyticsEvent = sendAnalyticsEvent;
