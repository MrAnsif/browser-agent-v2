export class BrowserContext {
  constructor(tabId) {
    this.tabId = tabId;
  }

  async injectDomBuilder() {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      files: ["domBuilder.js"],
      world: "MAIN"
    });
  }

  async getState(useVision = false) {
    try {
      await this.injectDomBuilder();

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        world: "MAIN",
        func: () => window.__buildDomTree(true, -1, 0)
      });

      const rawTree = result?.result;
      if (!rawTree || !rawTree.map) {
        throw new Error("DOM builder returned null or invalid structure.");
      }

      const state = this.constructDomTree(rawTree);

      if (useVision) {
        const screenshot = await chrome.tabs.captureVisibleTab(null, {
          format: "png"
        });
        state.screenshot = screenshot;
      }

      return state;
    } catch (err) {
      console.error("Failed to get browser state:", err);
      throw err;
    }
  }

  constructDomTree(rawTree) {
    const selectorMap = new Map();

    Object.entries(rawTree.map).forEach(([id, node]) => {
      if (node.highlightIndex !== null) {
        selectorMap.set(node.highlightIndex, node);
      }
    });

    return {
      elementTree: rawTree.map[rawTree.rootId],
      selectorMap,
      viewport: rawTree.viewport
    };
  }

  async clickElement(index) {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      world: "MAIN",
      func: (idx) => {
        const el = document.querySelector(`[data-highlight-index="${idx}"]`);
        if (el) {
          el.click();
          return { success: true };
        }
        return { success: false };
      },
      args: [index]
    });
  }

  async typeText(index, text) {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      world: "MAIN",
      func: (idx, txt) => {
        const el = document.querySelector(`[data-highlight-index="${idx}"]`);
        if (el) {
          el.value = txt;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return { success: true };
        }
        return { success: false };
      },
      args: [index, text]
    });
  }

  async removeHighlight() {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      files: ["removeHighlights.js"],
      world: "MAIN"
    });
  }

  async getCurrentUrl() {
    const tab = await chrome.tabs.get(this.tabId);
    return tab.url;
  }
}
