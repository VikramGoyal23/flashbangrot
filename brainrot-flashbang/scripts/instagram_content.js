(async function () {
  if (window.__instagramMediaFlashRunning) return;
  window.__instagramMediaFlashRunning = true;

  const SCROLL_INTERVAL_MS = 200;
  const BUFFER_SIZE = 6;

  let IMAGE_FLASH_MS = 120;
  let VIDEO_FLASH_MS = 600;

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

  /* ---------------- Observer ---------------- */
  const observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;

      // Images
      if (el.tagName === "IMG" && el.src && el.naturalWidth > 150 && el.naturalHeight > 150) {
        enqueue({ type: "image", src: el.src });
      }

      // Videos
      if (el.tagName === "VIDEO" && el.src) {
        enqueue({ type: "video", src: el.src });
      }

      // If it's a post container, scan inside
      const post = el.closest("article");
      if (post) {
        post.querySelectorAll("img").forEach(i => {
          if (i.src) enqueue({ type: "image", src: i.src });
        });
        post.querySelectorAll("video").forEach(v => {
          if (v.src) enqueue({ type: "video", src: v.src });
        });
      }
    }
  }, { threshold: 0.2 });

  function observe() {
    document.querySelectorAll("article, img, video").forEach(el => {
      observer.observe(el);
    });
  }

  observe();

  /* ---------------- Auto-scroll ---------------- */
  const scrollInterval = setInterval(() => {
    window.scrollBy(0, innerHeight * 1.2);
    observe();
  }, SCROLL_INTERVAL_MS);

  /* ---------------- Preload loop ---------------- */
  const preloadInterval = setInterval(ensureBuffer, 50);

  /* ---------------- Flash loop ---------------- */
  let flashInterval = null;

  function startFlashing() {
    if (flashInterval) clearInterval(flashInterval);

    flashInterval = setInterval(async () => {
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
  }

  chrome.storage.sync.get(
    { imageFlashMs: 120, videoFlashMs: 600 },
    (data) => {
      IMAGE_FLASH_MS = data.imageFlashMs;
      VIDEO_FLASH_MS = data.videoFlashMs;
      startFlashing();
    }
  );

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.imageFlashMs) {
      IMAGE_FLASH_MS = changes.imageFlashMs.newValue;
      startFlashing();
    }
    if (changes.videoFlashMs) {
      VIDEO_FLASH_MS = changes.videoFlashMs.newValue;
    }
  });

  /* ---------------- Exit ---------------- */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(preloadInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__instagramMediaFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
