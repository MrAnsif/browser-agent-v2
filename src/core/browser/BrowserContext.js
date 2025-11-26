export class BrowserContext {
  constructor(tabId) {
    this.tabId = tabId;
    this.domBuilderInjected = false;
  }

  async injectDomBuilder() {
    // Only inject once per instance
    if (this.domBuilderInjected) return;

    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      files: ["domBuilder.js"],
      world: "MAIN"
    });

    this.domBuilderInjected = true;

    // Wait to ensure script is loaded
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async getState(useVision = false) {
    try {
      await this.removeHighlight();
      
      await this.injectDomBuilder();

      // Execute and get result in a single call
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        world: "MAIN",
        func: () => {
          console.log("[getState] Checking window.__buildDomTree:", typeof window.__buildDomTree);

          if (typeof window.__buildDomTree !== 'function') {
            return { error: "DOM builder function not found" };
          }

          try {
            const domResult = window.__buildDomTree(true, -1, 0);
            console.log("[getState] DOM builder result:", domResult);
            return domResult;
          } catch (e) {
            console.error("[getState] Error building DOM:", e);
            return { error: e.message };
          }
        }
      });

      console.log("[BrowserContext] Raw result:", result);

      if (!result || !result.result) {
        throw new Error("No result returned from script execution");
      }

      if (result.result.error) {
        throw new Error(`DOM builder error: ${result.result.error}`);
      }

      const rawTree = result.result;

      if (!rawTree || !rawTree.map || !rawTree.rootId) {
        console.error("Invalid DOM tree structure:", rawTree);
        throw new Error("DOM builder returned invalid structure");
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
      if (node.highlightIndex !== null && node.highlightIndex !== undefined) {
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
