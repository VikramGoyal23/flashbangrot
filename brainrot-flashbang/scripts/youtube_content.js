(async function () {
  if (window.__ytHoverFlashRunning) return;
  window.__ytHoverFlashRunning = true;

  const SCROLL_INTERVAL_MS = 350;
  const FLASH_INTERVAL_MS = 90;
  const HOVER_TIME_MS = 150;

  const seen = new Set();
  const queue = [];

  console.log("YouTube Hover Flasher started");

  /* Overlay */
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
    transition: "opacity 0.05s linear",
  });

  overlay.appendChild(imgEl);
  document.body.appendChild(overlay);

  /* Detect preview sources */
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === "VIDEO") {
          const poster = node.getAttribute("poster");
          const src = node.querySelector("source")?.src || node.src;

          if (poster && !seen.has(poster)) {
            seen.add(poster);
            queue.push(poster);
          } else if (src && !seen.has(src)) {
            seen.add(src);
            queue.push(src);
          }
        }

        if (node.tagName === "IMG") {
          const src = node.src;
          if (src && src.includes("ytimg.com") && !seen.has(src)) {
            seen.add(src);
            queue.push(src);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /* Hover thumbnails */
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  async function hover(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));

    await new Promise(r => setTimeout(r, HOVER_TIME_MS));

    el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  }

  let index = 0;

  const hoverInterval = setInterval(async () => {
    const thumbs = Array.from(document.querySelectorAll("ytd-thumbnail, a#thumbnail"));
    if (!thumbs.length) return;

    const el = thumbs[index % thumbs.length];
    index++;

    if (isVisible(el)) hover(el);
  }, HOVER_TIME_MS + 60);

  /* Auto-scroll */
  const scrollInterval = setInterval(() => {
    window.scrollBy(0, window.innerHeight * 1.15);
  }, SCROLL_INTERVAL_MS);

  /* Flash */
  const flashInterval = setInterval(() => {
    if (!queue.length) return;

    const src = queue.shift();
    imgEl.style.opacity = "0";

    setTimeout(() => {
      imgEl.src = src;
      imgEl.style.opacity = "1";
    }, 20);
  }, FLASH_INTERVAL_MS);

  /* Exit */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(scrollInterval);
      clearInterval(hoverInterval);
      clearInterval(flashInterval);
      observer.disconnect();
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__ytHoverFlashRunning = false;
      console.log("YouTube Hover Flasher stopped");
    }
  }

  document.addEventListener("keydown", cleanup);
})();
