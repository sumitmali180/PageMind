/**
 * PageMind Manifest V3 Background Service Worker.
 * Ephemeral-safe: holds no mutable in-memory state.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.info('PageMind installed.');
  } else if (details.reason === 'update') {
    console.info('PageMind updated to', chrome.runtime.getManifest().version);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PAGEMIND_PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }
  return false;
});

