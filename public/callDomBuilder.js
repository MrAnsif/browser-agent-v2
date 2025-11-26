// callDomBuilder.js
(() => {
  console.log("[callDomBuilder] RUNNING in MAIN world:", window.__buildDomTree);
  try {
    window.__domBuilderResult = window.__buildDomTree(true, -1, 0);
    console.log("[callDomBuilder] RESULT:", window.__domBuilderResult);
  } catch (e) {
    console.error("[callDomBuilder] ERROR:", e);
    window.__domBuilderResult = null;
  }
})();
