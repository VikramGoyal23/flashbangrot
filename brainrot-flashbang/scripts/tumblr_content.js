(async function () {
  if (window.__tumblrImageFlashRunning) return;
  window.__tumblrImageFlashRunning = true;

  const SCROLL_INTERVAL_MS = 200;
  const FLASH_INTERVAL_MS = 120;
  const BUFFER_SIZE = 6;

  const seen = new Set();
  const urlQueue = [];
  const buffer = [];

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "black",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  });

  const imgEl = document.createElement("img");
  Object.assign(imgEl.style, {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    transition: "opacity 0.08s linear",
    opacity: "0",
  });

  overlay.appendChild(imgEl);
  document.body.appendChild(overlay);

  function enqueueUrl(src) {
    if (!src || seen.has(src)) return;
    seen.add(src);
    urlQueue.push(src);
  }

  function parseSrcset(srcset) {
    // returns the highest-res URL
    const parts = srcset.split(",");
    const best = parts[parts.length - 1].trim().split(" ")[0];
    return best;
  }

  function getBackgroundImageUrl(el) {
    const bg = window.getComputedStyle(el).backgroundImage;
    const match = bg.match(/url\("?(.*?)"?\)/);
    return match ? match[1] : null;
  }

  async function preloadNext() {
    if (buffer.length >= BUFFER_SIZE) return;
    if (urlQueue.length === 0) return;

    const src = urlQueue.shift();

    return new Promise(resolve => {
      const img = new Image();
      img.src = src;

      img.onload = () => {
        buffer.push(img);
        resolve();
      };

      img.onerror = () => {
        resolve();
      };
    });
  }

  async function ensureBuffer() {
    while (buffer.length < BUFFER_SIZE && urlQueue.length > 0) {
      await preloadNext();
    }
  }

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;

        // IMG tags
        if (el.tagName === "IMG" && el.src) {
          enqueueUrl(el.src);
          if (el.srcset) enqueueUrl(parseSrcset(el.srcset));
        }

        // background images
        const bgUrl = getBackgroundImageUrl(el);
        if (bgUrl) enqueueUrl(bgUrl);

        // If this is a post, also look for img inside it
        if (el.closest("article")) {
          el.querySelectorAll("img").forEach(img => {
            enqueueUrl(img.src);
            if (img.srcset) enqueueUrl(parseSrcset(img.srcset));
          });
        }
      }
    },
    { threshold: 0.2 }
  );

  function observe() {
    document.querySelectorAll("article, div, img").forEach(el => observer.observe(el));
  }

  observe();

  const scrollInterval = setInterval(() => {
    window.scrollBy(0, window.innerHeight * 1.2);
    observe();
  }, SCROLL_INTERVAL_MS);

  const preloadInterval = setInterval(async () => {
    await ensureBuffer();
  }, 50);

  const flashInterval = setInterval(() => {
    if (buffer.length === 0) return;

    const img = buffer.shift();
    imgEl.style.opacity = "0";

    setTimeout(() => {
      imgEl.src = img.src;
      imgEl.style.opacity = "1";
    }, 30);
  }, FLASH_INTERVAL_MS);

  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(preloadInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__tumblrImageFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
