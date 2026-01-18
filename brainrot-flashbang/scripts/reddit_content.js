(async function () {
  if (window.__redditImageFlashRunning) return;
  window.__redditImageFlashRunning = true;

  const SCROLL_INTERVAL_MS = 200;
  let FLASH_INTERVAL_MS = 90;

  chrome.storage.sync.get({ imageFlashMs: 90 }, (data) => {
    FLASH_INTERVAL_MS = data.imageFlashMs;
  });
  const BUFFER_SIZE = 6; // how many images to keep preloaded

  const seen = new Set();
  const urlQueue = [];
  const buffer = [];

  /*
     Overlay
  */
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

  /*
     Helpers
  */
  function enqueueUrl(src) {
    if (!src || seen.has(src)) return;
    seen.add(src);
    urlQueue.push(src);
  }

  function extractGalleryFromPost(postEl) {
    try {
      const json = postEl.querySelector("script[type='application/json']");
      if (!json) return;

      const data = JSON.parse(json.textContent);
      const media = data?.media_metadata;
      if (!media) return;

      Object.values(media).forEach(item => {
        const url = item?.s?.u;
        if (url) enqueueUrl(url.replace(/&amp;/g, "&"));
      });
    } catch {}
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
        resolve(); // ignore failures
      };
    });
  }

  async function ensureBuffer() {
    while (buffer.length < BUFFER_SIZE && urlQueue.length > 0) {
      await preloadNext();
    }
  }

  /* -----------------------------
     IntersectionObserver
  ----------------------------- */
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const el = entry.target;

        if (
          el.tagName === "IMG" &&
          el.src &&
          (el.src.includes("i.redd.it") ||
           el.src.includes("preview.redd.it")) &&
          el.naturalWidth > 200 &&
          el.naturalHeight > 200
        ) {
          enqueueUrl(el.src);
        }

        const post = el.closest("shreddit-post, div[data-testid='post-container']");
        if (post) extractGalleryFromPost(post);
      }
    },
    {
      threshold: 0.3,
    }
  );

  function observe() {
    document.querySelectorAll("img, shreddit-post, div[data-testid='post-container']")
      .forEach(el => observer.observe(el));
  }

  /*
     Auto-scroll forever
  */
  observe();

  const scrollInterval = setInterval(() => {
    window.scrollBy(0, window.innerHeight * 1.2);
    observe();
  }, SCROLL_INTERVAL_MS);

  /*
     Preload loop
  */
  const preloadInterval = setInterval(async () => {
    await ensureBuffer();
  }, 50);

  /*
     Flash loop
  */
let flashInterval = null;

function startFlashing() {
  if (flashInterval) clearInterval(flashInterval);

  flashInterval = setInterval(() => {
    if (!urlQueue.length) return;

    const src = urlQueue.shift();
    imgEl.style.opacity = "0";

    setTimeout(() => {
      imgEl.src = src;
      imgEl.style.opacity = "1";
    }, 20);
  }, FLASH_INTERVAL_MS);
}

chrome.storage.sync.get({ imageFlashMs: 90 }, (data) => {
  FLASH_INTERVAL_MS = data.imageFlashMs;
  startFlashing();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.imageFlashMs) {
    FLASH_INTERVAL_MS = changes.imageFlashMs.newValue;
    startFlashing();
  }
});

  /*
     Exit (ESC)
  */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(preloadInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__redditImageFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
