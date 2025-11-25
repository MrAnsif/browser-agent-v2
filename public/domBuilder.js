// Injected into the MAIN world — attaches DOM builder to window

(function () {
    window.__buildDomTree = function (showHighlight = false, focusElement = -1, viewportExpansion = 0) {
        const elementMap = {};
        let highlightIndex = 0;

        const isVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                parseFloat(style.opacity || "1") !== 0;
        };

        const isInteractive = (element) => {
            const tags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
            return (
                tags.includes(element.tagName) ||
                element.hasAttribute('onclick') ||
                element.getAttribute('role') === 'button'
            );
        };

        const getXPath = (element) => {
            if (element.id) return `//*[@id="${element.id}"]`;

            const parts = [];
            let current = element;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let index = 1;
                let sibling = current.previousSibling;

                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE &&
                        sibling.tagName === current.tagName) {
                        index++;
                    }
                    sibling = sibling.previousSibling;
                }

                const tag = current.tagName.toLowerCase();
                const path = `${tag}${index > 1 ? `[${index}]` : ''}`;
                parts.unshift(path);

                current = current.parentNode;
            }

            return `/${parts.join('/')}`;
        };

        const addHighlight = (element, index) => {
            const overlay = document.createElement('div');
            overlay.className = '__ai_agent_highlight';
            overlay.dataset.highlightIndex = index;
            overlay.style.cssText = `
        position: absolute;
        background: rgba(255, 0, 0, 0.2);
        border: 2px solid red;
        color: red;
        font-size: 14px;
        font-weight: bold;
        padding: 2px 4px;
        pointer-events: none;
        z-index: 999999;
      `;

            const rect = element.getBoundingClientRect();
            overlay.style.left = `${rect.left + window.scrollX}px`;
            overlay.style.top = `${rect.top + window.scrollY}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            overlay.textContent = index;

            document.body.appendChild(overlay);
        };

        const processNode = (node) => {
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
                const visible = isVisible(node);
                const interactive = isInteractive(node);

                const data = {
                    tagName: node.tagName.toLowerCase(),
                    xpath: getXPath(node),
                    attributes: {},
                    isVisible: visible,
                    isInteractive: interactive,
                    highlightIndex: (visible && interactive) ? highlightIndex++ : null,
                    children: []
                };

                ['id', 'class', 'href', 'type', 'value', 'placeholder', 'aria-label']
                    .forEach(attr => {
                        if (node.hasAttribute(attr)) data.attributes[attr] = node.getAttribute(attr);
                    });

                if (['BUTTON', 'A', 'LABEL'].includes(node.tagName)) {
                    data.text = node.textContent.trim().slice(0, 200);
                }

                Array.from(node.childNodes).forEach(child => {
                    const childId = processNode(child);
                    if (childId) data.children.push(childId);
                });

                elementMap[id] = data;

                if (showHighlight && data.highlightIndex !== null) {
                    addHighlight(node, data.highlightIndex);
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
})();
