(async function () {
  if (window.__tumblrMediaFlashRunning) return;
  window.__tumblrMediaFlashRunning = true;

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

  function parseSrcset(srcset) {
    return srcset.split(",").pop().trim().split(" ")[0];
  }

  function getBgImage(el) {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg.match(/url\("?(.*?)"?\)/);
    return m?.[1];
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
      if (el.tagName === "IMG" && el.src) {
        enqueue({ type: "image", src: el.src });
        if (el.srcset) enqueue({ type: "image", src: parseSrcset(el.srcset) });
      }

      const bg = getBgImage(el);
      if (bg) enqueue({ type: "image", src: bg });

      // Videos
      if (el.tagName === "VIDEO") {
        if (el.src) enqueue({ type: "video", src: el.src });
        el.querySelectorAll("source").forEach(s => {
          enqueue({ type: "video", src: s.src });
        });
      }

      // Scan whole post
      const post = el.closest("article");
      if (post) {
        post.querySelectorAll("img").forEach(i => {
          enqueue({ type: "image", src: i.src });
          if (i.srcset) enqueue({ type: "image", src: parseSrcset(i.srcset) });
        });

        post.querySelectorAll("video, video source").forEach(v => {
          if (v.src) enqueue({ type: "video", src: v.src });
        });
      }
    }
  }, { threshold: 0.2 });

  function observe() {
    document.querySelectorAll("article, img, video, div")
      .forEach(el => observer.observe(el));
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

  /* ---------------- Exit ---------------- */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(preloadInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__tumblrMediaFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
