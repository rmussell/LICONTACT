document.getElementById('checkContact').addEventListener('click', async () => {
  try {
    let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab) {
      await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['content.js']
      });
    }
  } catch (error) {
    console.error('Error executing script:', error);
  }
});
