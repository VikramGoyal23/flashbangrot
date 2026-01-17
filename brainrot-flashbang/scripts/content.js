(async function () {
  // Prevent double injection
  if (window.__redditImageFlashRunning) return;
  window.__redditImageFlashRunning = true;

  const IMAGE_LIMIT = 30;
  const COLLECTION_TIME_MS = 5000;
  const SCROLL_INTERVAL_MS = 200;
  const SLIDESHOW_INTERVAL_MS = 120;

  const images = new Set();

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
  });

  const imgEl = document.createElement("img");
  Object.assign(imgEl.style, {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    transition: "opacity 0.08s linear",
  });

  overlay.appendChild(imgEl);
  document.body.appendChild(overlay);

  /* 
     IntersectionObserver
  */
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const img = entry.target;

        if (
          img.src &&
          (img.src.includes("i.redd.it") ||
           img.src.includes("preview.redd.it")) &&
          img.naturalWidth > 200 &&
          img.naturalHeight > 200
        ) {
          images.add(img.src);

          if (images.size >= IMAGE_LIMIT) {
            observer.disconnect();
          }
        }
      }
    },
    {
      root: null,
      threshold: 0.3,
    }
  );

  function observeImages() {
    document.querySelectorAll("img").forEach(img => observer.observe(img));
  }

  /* 
     Auto-scroll + observe
  */
  observeImages();

  const scrollInterval = setInterval(() => {
    window.scrollBy(0, window.innerHeight * 1.2);
    observeImages();
  }, SCROLL_INTERVAL_MS);

  /* 
     Hard stop after 5 seconds
  */
  await new Promise(resolve => setTimeout(resolve, COLLECTION_TIME_MS));
  clearInterval(scrollInterval);
  observer.disconnect();

  const imageList = [...images].slice(0, IMAGE_LIMIT);

  if (imageList.length === 0) {
    overlay.remove();
    window.__redditImageFlashRunning = false;
    return;
  }

  /* 
     Slideshow
  */
  let index = 0;
  imgEl.src = imageList[0];
  imgEl.style.opacity = "1";

  const slideshowInterval = setInterval(() => {
    imgEl.style.opacity = "0";

    setTimeout(() => {
      index = (index + 1) % imageList.length;
      imgEl.src = imageList[index];
      imgEl.style.opacity = "1";
    }, 40);
  }, SLIDESHOW_INTERVAL_MS);

  /* 
     Exit (ESC)
  */
  function cleanup(e) {
    if (e.key === "Escape") {
      clearInterval(slideshowInterval);
      overlay.remove();
      document.removeEventListener("keydown", cleanup);
      window.__redditImageFlashRunning = false;
    }
  }

  document.addEventListener("keydown", cleanup);
})();
