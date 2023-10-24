// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Run on page load
//

// TODO: Move a lot of this code into modules/javascript/binds.js
window.onload = async function () {
  fetch("../assets/emojis.json")
    .then((res) => res.json())
    .then((json) => (emojis = json));

  fetch("../assets/badges.json")
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
      } else {
        if (documentHeight.scrollHeight - documentHeight.offsetHeight === documentHeight.scrollTop &&
          cache.messages[cache.messages.length - 1] in state.unreads.unread.messages) {
            fetch(
                `${settings.instance.delta}/channels/${state.active.channel}/ack/${data._id}`,
                {
                  headers: {
                    "x-session-token": state.connection.token,
                  },
                  method: "PUT",
                },
              );
          }
      }
    });

  document.querySelector("#input").addEventListener("paste", (event) => {
    let item = event.clipboardData.items[0];

    if (item.type.indexOf("image") === 0) {
      let blob = item.getAsFile();
      addFile(blob);
    }
  });

  await fetch("../assets/defaultSettings.json")
    .then((res) => res.json())
    .then((json) => (settings = json));
  if (!localStorage.getItem("token")) return;
  start();
};

/**
 * Main function to start all other functions
 * @returns {null} Should not return
 */
async function start() {
  state.connection.token = localStorage.getItem("token");
  await processSettings();
  await login();
  
  if (!localStorage.getItem("token") && settings.behaviour.rememberMe)
    localStorage.setItem("token", state.connection.token);

  loadSyncSettings();
  bonfire();

  screens.login.style.display = "none";
  screens.app.style.display = "grid";
}

// @license-end