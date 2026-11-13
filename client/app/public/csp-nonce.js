(function () {
  const meta = document.querySelector('meta[name="csp-nonce"]');
  const nonce = meta ? meta.nonce || meta.getAttribute("nonce") : "";
  if (!nonce || nonce.startsWith("__")) return;

  globalThis.__webpack_nonce__ = nonce;

  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (tagName, options) {
    const element = createElement.call(this, tagName, options);
    if (typeof tagName === "string" && tagName.toLowerCase() === "style") {
      element.setAttribute("nonce", nonce);
    }
    return element;
  };
})();
