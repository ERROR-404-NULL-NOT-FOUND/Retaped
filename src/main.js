// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Run on page load
//
window.onload = async () => {
  fetch("../assets/emojis.json")
    .then((res) => res.json())
    .then((json) => (storage.emojis = json));

  fetch("../assets/badges.json")
    .then((res) => res.json())
    .then((json) => (storage.badges = json));

  fetch("../assets/permissions.json")
    .then((res) => res.json())
    .then((json) => (storage.permissions = json));

  //Handles messageBox trickery, specifically loading more messages when scrolled to top
  //and sending ack messages when scrolled to bottom
  //Not in modules/javascript/binds.js because it's huge
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
            .firstChild.id.replace("MSG-", "")
        );
        setTimeout(() => {
          documentHeight.scrollTo(
            0,
            documentHeight.scrollHeight - initialHeight
          );
        }, 500);
      } else {
        if (
          documentHeight.scrollHeight - documentHeight.offsetHeight ===
            documentHeight.scrollTop &&
          cache.messages[cache.messages.length - 1].id in
            state.unreads.unread.messages
        ) {
          fetch(
            `${settings.instance.delta}/channels/${state.active.channel}/ack/${
              cache.messages[cache.messages.length - 1].id
            }`,
            {
              headers: {
                "x-session-token": state.connection.token,
              },
              method: "PUT",
            }
          );
        }
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
