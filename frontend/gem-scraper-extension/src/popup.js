document.getElementById('startBulkBtn').addEventListener('click', async () => {
  const text = document.getElementById('modelList').value.trim();
  const statusDiv = document.getElementById('status');
  
  if (!text) {
    statusDiv.innerText = "Please paste at least one model no.";
    return;
  }

  // Lines ko array me convert karna aur error messages ko filter out karna
  const models = text.split('\n')
    .map(m => m.trim())
    .filter(m => m.length > 0 && !m.includes("Please paste") && !m.includes("Searching"));

  if (models.length === 0) {
    statusDiv.innerText = "No valid model numbers found!";
    return;
  }

  statusDiv.innerText = `Starting loop for ${models.length} models...`;

  // Safe queue initialization
  chrome.storage.local.set({ modelQueue: models, currentIndex: 0 }, () => {
    processNextModel();
  });
});

async function processNextModel() {
  chrome.storage.local.get(['modelQueue', 'currentIndex'], async (data) => {
    const queue = data.modelQueue || [];
    const index = data.currentIndex || 0;
    const statusDiv = document.getElementById('status');

    if (index >= queue.length) {
      statusDiv.innerText = "🎉 All models processed successfully!";
      chrome.storage.local.clear();
      return;
    }

    const currentModel = queue[index];
    statusDiv.innerText = `Searching (${index + 1}/${queue.length}): ${currentModel}`;

    // Target CPU search page URL
    const searchUrl = `https://mkp.gem.gov.in/computers-entry-level-computer-cpu/search#/?q=${encodeURIComponent(currentModel)}`;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      chrome.tabs.update(tab.id, { url: searchUrl });
      chrome.storage.local.set({ currentIndex: index + 1 });
      
      // Next model loop template trigger after 8 seconds
      setTimeout(() => {
        processNextModel();
      }, 8000);
    }
  });
}