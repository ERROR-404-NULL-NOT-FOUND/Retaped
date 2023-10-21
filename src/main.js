//Import markdown renderer
var converter = new showdown.Converter();

//
// Run on page load
//

window.onload = function () {
  fetch("./emojis.json")
    .then((res) => res.json())
    .then((json) => (emojis = json));

  fetch("./badges.json")
    .then((res) => res.json())
    .then((json) => (badges = json));

  let toolbar = document.querySelector(".toolbar");
  let toolbarBtn = document.querySelector(".toolbar-btn");
  toolbarBtn.addEventListener("click", () => {
    toolbar.classList.toggle("show-toolbar");
  });

  document.querySelector("#upload").addEventListener("input", (event) => {
    addFile(document.querySelector("#upload").files[0]);
  });

  document
    .querySelector("#messagesContainer")
    .addEventListener("scroll", async function (e) {
      let documentHeight = document.querySelector("#messagesContainer");
      if (documentHeight.scrollTop === 0) {
        initialHeight = documentHeight.scrollHeight;
        await getNewMessages(
          state.active.channel,
          document
            .querySelector("#messagesContainer")
            .firstChild.id.replace("MSG-", ""),
        );
        setTimeout(() => {
          documentHeight.scrollTo(0, documentHeight.scrollHeight - initialHeight);
        }, 500);
      }
    });

  document.querySelector("#input").addEventListener("paste", (event) => {
    let item = event.clipboardData.items[0];

    if (item.type.indexOf("image") === 0) {
      let blob = item.getAsFile();
      addFile(blob);
    }
  });

  if (!localStorage.getItem("token")) return;
  token = localStorage.getItem("token");
  login();
};

