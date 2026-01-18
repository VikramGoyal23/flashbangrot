(async function () {
  if (window.__articleFlashRunning) return;
  window.__articleFlashRunning = true;

  const WORD_MS = 120;

  const TRIGGERS = {
    sixseven: { type: "video", path: "assets/sixseven.mp4" }
  };


  // ---------------- Overlay ----------------
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: 0,
    background: "black",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 999999,
    pointerEvents: "none",
    textAlign: "center",
  });

  const titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontWeight: "700",
    marginBottom: "30px",
    width: "100%",
  });

  const wordEl = document.createElement("div");
  Object.assign(wordEl.style, {
    fontWeight: "400",
    width: "100%",
  });

  overlay.append(titleEl, wordEl);
  document.body.appendChild(overlay);

  // ---------------- Text extraction ----------------

  function getTextNodes(el) {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentElement.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function scoreElement(el) {
    // score based on text length
    const text = el.innerText || "";
    const len = text.trim().length;
    const images = el.querySelectorAll("img").length;
    return len + images * 50;
  }

  function findMainArticle() {
    // 1) Prefer <article>
    const article = document.querySelector("article");
    if (article && scoreElement(article) > 200) return article;

    // 2) Otherwise pick the largest visible text container
    const candidates = Array.from(document.querySelectorAll("main, section, div"));
    const best = candidates
      .filter(el => el.offsetParent !== null)
      .map(el => ({ el, score: scoreElement(el) }))
      .sort((a, b) => b.score - a.score)[0];

    return best?.el || document.body;
  }

  function extractContent(mainEl) {
    const title =
      document.querySelector("h1")?.innerText ||
      document.querySelector("h2")?.innerText ||
      document.title ||
      "";

    // collect all paragraphs and list items
    const paragraphs = Array.from(mainEl.querySelectorAll("p, li"))
      .map(p => p.innerText)
      .filter(Boolean);

    return { title, text: paragraphs.join(" ") };
  }

  const mainEl = findMainArticle();
  const { title, text } = extractContent(mainEl);

  const words = (title + " " + text).split(/\s+/).filter(Boolean);

  // ---------------- Fit Font Size ----------------
  function fitFontSize() {
    const base = Math.min(window.innerWidth, window.innerHeight);
    const size = Math.max(20, Math.floor(base / 18));
    wordEl.style.fontSize = size + "px";
    titleEl.style.fontSize = Math.max(30, size + 10) + "px";
  }

  fitFontSize();
  window.addEventListener("resize", fitFontSize);

  // ---------------- Flash words ----------------
  let index = 0;

  const interval = setInterval(() => {
    if (index >= words.length) {
      clearInterval(interval);
      overlay.remove();
      window.__articleFlashRunning = false;
      return;
    }

    const word = words[index];
    wordEl.innerText = word;
    titleEl.innerText = index === 0 ? title : "";

    index++;
  }, WORD_MS);

  // ---------------- Exit ----------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearInterval(interval);
      overlay.remove();
      window.__articleFlashRunning = false;
    }
  });
})();
