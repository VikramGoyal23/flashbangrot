(async function () {
  if (window.__redditMediaFlashRunning) return;
  window.__redditMediaFlashRunning = true;

  const SCROLL_INTERVAL_MS = 200;
  const IMAGE_FLASH_MS = 120;
  const VIDEO_FLASH_MS = 600;
  const BUFFER_SIZE = 6;

  const seen = new Set();
  const queue = [];
  const buffer = [];

  /* ---------------- Overlay ---------------- */
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: 0,
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
    opacity: "0",
    transition: "opacity 0.08s linear",
  });

  const videoEl = document.createElement("video");
  Object.assign(videoEl.style, {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "none",
  });
  videoEl.muted = true;
  videoEl.playsInline = true;

  overlay.append(imgEl, videoEl);
  document.body.appendChild(overlay);

  /* ---------------- Helpers ---------------- */
  function enqueue(item) {
    if (!item?.src || seen.has(item.src)) return;
    seen.add(item.src);
    queue.push(item);
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
        if (url) enqueue({ type: "image", src: url.replace(/&amp;/g, "&") });
      });
    } catch {}
  }

  async function preloadNext() {
    if (buffer.length >= BUFFER_SIZE || queue.length === 0) return;

    const item = queue.shift();

    if (item.type === "image") {
      return new Promise(res => {
        const img = new Image();
        img.src = item.src;
        img.onload = () => {
          buffer.push({ type: "image", el: img });
          res();
        };
        img.onerror = res;
      });
    }

    if (item.type === "video") {
      return new Promise(res => {
        const v = document.createElement("video");
        v.src = item.src;
        v.muted = true;
        v.onloadedmetadata = () => {
          buffer.push({ type: "video", el: v });
          res();
        };
        v.onerror = res;
      });
    }
  }

  async function ensureBuffer() {
    while (buffer.length < BUFFER_SIZE && queue.length) {
      await preloadNext();
    }
  }

  /* ---------------- IntersectionObserver ---------------- */
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;

      // Images
      if (
        el.tagName === "IMG" &&
        el.src &&
        (el.src.includes("i.redd.it") ||
         el.src.includes("preview.redd.it")) &&
        el.naturalWidth > 200 &&
        el.naturalHeight > 200
      ) {
        enqueue({ type: "image", src: el.src });
      }

      // Videos
      if (el.tagName === "VIDEO") {
        if (el.src?.includes("v.redd.it")) {
          enqueue({ type: "video", src: el.src });
        }

        el.querySelectorAll("source").forEach(s => {
          if (s.src?.includes("v.redd.it")) {
            enqueue({ type: "video", src: s.src });
          }
        });
      }

      const post = el.closest("shreddit-post, div[data-testid='post-container']");
      if (post) extractGalleryFromPost(post);
    }
  }, { threshold: 0.3 });

  function observe() {
    document
      .querySelectorAll(
        "img, video, shreddit-post, div[data-testid='post-container']"
      )
      .forEach(el => observer.observe(el));
  }

  /* ---------------- Auto-scroll ---------------- */
  observe();

  const scrollInterval = setInterval(() => {
    window.scrollBy(0, innerHeight * 1.2);
    observe();
  }, SCROLL_INTERVAL_MS);

  /* ---------------- Preload loop ---------------- */
  const preloadInterval = setInterval(ensureBuffer, 50);

  /* ---------------- Flash loop ---------------- */
  const flashInterval = setInterval(async () => {
    if (!buffer.length) return;

    const item = buffer.shift();

    imgEl.style.opacity = "0";
    videoEl.style.display = "none";
    videoEl.pause();

    if (item.type === "image") {
      imgEl.src = item.el.src;
      imgEl.style.opacity = "1";
    }

    if (item.type === "video") {
      videoEl.src = item.el.src;
      videoEl.style.display = "block";
      await videoEl.play();
      setTimeout(() => videoEl.pause(), VIDEO_FLASH_MS);
    }
  }, IMAGE_FLASH_MS);

  /* ---------------- Exit (ESC) ---------------- */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(preloadInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__redditMediaFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
