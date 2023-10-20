//
// Keybinds
//

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "Enter":
      if (!event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
      break;

    case "Escape":
      if (activeReplies.length !== 0) {
        activeReplies.pop();
        document.querySelector(".replying-container").lastChild.remove();
      } else {
        editingMessageID = "";
        document.querySelector("#input").value = "";
      }
      break;

    default:
      keysDown.push(event.key);
  }
  return;
});
