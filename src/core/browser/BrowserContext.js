export class BrowserContext {
  constructor(tabId) {
    this.tabId = tabId;
  }

  async getState(useVision = false) {
    try {
      // Inject DOM parsing script
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        world: "MAIN",
        func: this.buildDomTreeFunction
      });
        
      // testing injuction
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { console.log("TEST INJECTION SUCCESS"); }
      });

      // Execute and get DOM state
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => window.__buildDomTree(true, -1, 0)
      });

      const rawTree = results[0].result;
      const state = this.constructDomTree(rawTree);

      // Capture screenshot if vision enabled
      if (useVision) {
        const screenshot = await chrome.tabs.captureVisibleTab(null, {
          format: 'png'
        });
        state.screenshot = screenshot;
      }

      return state;
    } catch (error) {
      console.error('Failed to get browser state:', error);
      throw error;
    }
  }

  buildDomTreeFunction() {
    window.__buildDomTree = (showHighlight, focusElement, viewportExpansion) => {
      const elementMap = {};
      let highlightIndex = 0;

      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };

      const isInteractive = (element) => {
        const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
        return interactiveTags.includes(element.tagName) ||
          element.hasAttribute('onclick') ||
          element.getAttribute('role') === 'button';
      };

      const getXPath = (element) => {
        if (element.id) return `//*[@id="${element.id}"]`;

        const parts = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let index = 0;
          let sibling = current.previousSibling;

          while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE &&
              sibling.tagName === current.tagName) {
              index++;
            }
            sibling = sibling.previousSibling;
          }

          const tagName = current.tagName.toLowerCase();
          const pathIndex = index > 0 ? `[${index + 1}]` : '';
          parts.unshift(`${tagName}${pathIndex}`);

          current = current.parentNode;
        }

        return parts.length ? `/${parts.join('/')}` : '';
      };

      const addHighlight = (element, index) => {
        const overlay = document.createElement('div');
        overlay.className = '__ai_agent_highlight';
        overlay.textContent = index;
        overlay.style.cssText = `
          position: absolute;
          background: rgba(255, 0, 0, 0.3);
          border: 2px solid red;
          color: white;
          font-weight: bold;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 3px;
          z-index: 999999;
          pointer-events: none;
        `;

        const rect = element.getBoundingClientRect();
        overlay.style.left = `${rect.left + window.scrollX}px`;
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        document.body.appendChild(overlay);
      };

      const processNode = (node, parentId) => {
        const id = `node_${Object.keys(elementMap).length}`;

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (!text) return null;

          elementMap[id] = {
            type: 'TEXT_NODE',
            text,
            isVisible: isVisible(node.parentElement)
          };
          return id;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const rect = node.getBoundingClientRect();
          const interactive = isInteractive(node);
          const visible = isVisible(node);

          const elementData = {
            tagName: node.tagName.toLowerCase(),
            xpath: getXPath(node),
            attributes: {},
            isVisible: visible,
            isInteractive: interactive,
            highlightIndex: (interactive && visible) ? highlightIndex++ : null,
            children: []
          };

          // Get important attributes
          ['id', 'class', 'href', 'type', 'value', 'placeholder', 'aria-label'].forEach(attr => {
            if (node.hasAttribute(attr)) {
              elementData.attributes[attr] = node.getAttribute(attr);
            }
          });

          // Get text content
          if (['BUTTON', 'A', 'LABEL'].includes(node.tagName)) {
            elementData.text = node.textContent.trim().slice(0, 100);
          }

          // Process children
          Array.from(node.childNodes).forEach(child => {
            const childId = processNode(child, id);
            if (childId) elementData.children.push(childId);
          });

          elementMap[id] = elementData;

          // Add highlight
          if (showHighlight && elementData.highlightIndex !== null) {
            addHighlight(node, elementData.highlightIndex);
          }

          return id;
        }

        return null;
      };

      const rootId = processNode(document.documentElement);

      return {
        map: elementMap,
        rootId,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          url: window.location.href,
          title: document.title
        }
      };
    };
  }

  constructDomTree(rawTree) {
    const selectorMap = new Map();
    const nodeMap = {};

    // First pass: create nodes
    Object.entries(rawTree.map).forEach(([id, data]) => {
      nodeMap[id] = data;
      if (data.highlightIndex !== null && data.highlightIndex !== undefined) {
        selectorMap.set(data.highlightIndex, data);
      }
    });

    return {
      elementTree: nodeMap[rawTree.rootId],
      selectorMap,
      viewport: rawTree.viewport
    };
  }

  async clickElement(index) {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: (idx) => {
        const xpath = `//*[@data-highlight-index="${idx}"]`;
        const element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (element) {
          element.click();
          return { success: true };
        }
        return { success: false, error: 'Element not found' };
      },
      args: [index]
    });
  }

  async typeText(index, text) {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: (idx, txt) => {
        const xpath = `//*[@data-highlight-index="${idx}"]`;
        const element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (element) {
          element.value = txt;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true };
        }
        return { success: false, error: 'Element not found' };
      },
      args: [index, text]
    });
  }

  async removeHighlight() {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: () => {
        document.querySelectorAll('.__ai_agent_highlight').forEach(el => el.remove());
      }
    });
  }

  async getCurrentUrl() {
    const tab = await chrome.tabs.get(this.tabId);
    return tab.url;
  }
}