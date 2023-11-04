// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Keybinds
//

const replyingContainer = document.querySelector(".replying-container");
const inputContainer = document.querySelector("#input");

input.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "Enter":
      correctionsContainer.replaceChildren();
      if (!event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
      break;

    case "Escape":
      if (state.messageMods.replies.length !== 0) {
        state.messageMods.replies.pop();
        replyingContainer.lastChild.remove();
      } else {
        state.messageMods.editing = "";
        inputContainer.value = "";
      }
      break;

    case "Tab": {
      event.preventDefault();
      fill();
    }

    default:
      break;
  }
  return;
});

inputContainer.addEventListener("keyup", (event) => {
  if (["Enter", "Escape"].indexOf(event.key) === -1) engine();
});

//@license-end
