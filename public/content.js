// Content script - injected into web pages
console.log('AI Browser Agent content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'ready' });
  }
});