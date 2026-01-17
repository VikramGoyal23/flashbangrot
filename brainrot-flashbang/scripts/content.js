(async function () {
  if (window.__redditImageFlashRunning) return;
  window.__redditImageFlashRunning = true;

  const SCROLL_INTERVAL_MS = 200;
  const FLASH_INTERVAL_MS = 120;

  const seen = new Set();
  const queue = [];

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
  function enqueue(src) {
    if (!src || seen.has(src)) return;
    seen.add(src);
    queue.push(src);
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
        if (url) enqueue(url.replace(/&amp;/g, "&"));
      });
    } catch {}
  }

  /* -----------------------------
     IntersectionObserver
  ----------------------------- */
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const el = entry.target;

        // Regular images
        if (
          el.tagName === "IMG" &&
          el.src &&
          (el.src.includes("i.redd.it") ||
           el.src.includes("preview.redd.it")) &&
          el.naturalWidth > 200 &&
          el.naturalHeight > 200
        ) {
          enqueue(el.src);
        }

        // Gallery posts
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
     Flash loop
  */
  const flashInterval = setInterval(() => {
    if (queue.length === 0) return;

    const src = queue.shift();
    imgEl.style.opacity = "0";

    setTimeout(() => {
      imgEl.src = src;
      imgEl.style.opacity = "1";
    }, 30);
  }, FLASH_INTERVAL_MS);

  /*
     Exit (ESC)
  */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__redditImageFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
