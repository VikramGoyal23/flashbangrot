const imgInput = document.getElementById("imgRate");
const vidInput = document.getElementById("vidRate");
const saveBtn = document.getElementById("save");

chrome.storage.sync.get({ imageFlashMs: 120, videoFlashMs: 600 }, (data) => {
  imgInput.value = data.imageFlashMs;
  vidInput.value = data.videoFlashMs;
});

saveBtn.addEventListener("click", () => {
  const imgRate = parseInt(imgInput.value, 10);
  const vidRate = parseInt(vidInput.value, 10);

  chrome.storage.sync.set({
    imageFlashMs: imgRate,
    videoFlashMs: vidRate,
  });
});
