const input = document.getElementById("rate");
const button = document.getElementById("save");

chrome.storage.sync.get({ flashRate: 90 }, (data) => {
  input.value = data.flashRate;
});

button.addEventListener("click", () => {
  const rate = parseInt(input.value, 10);
  chrome.storage.sync.set({ flashRate: rate });
});
