// Import markdown renderer
var converter = new showdown.Converter();
//
// Variables
//



var activeReplies = [];
var emojis = {};
var badges = {};
var activeServer;
var activeChannel;
var token;
var socket;
var userProfile;
var activeRequests = 0;
var currentlyTyping = [];
var mutedChannels = [];
var mutedServers = [];
var unreads = [];
var unreadChannels = [];
var unreadMentions = [];
var cssVars = getComputedStyle(document.querySelector(":root"));
var keysDown = [];
var sendRawJSON = false;
var ordering = [];
var isMessageSending = false;
var editingMessageID = "";
var attachments = [];
var attachmentIDs = [];
var unreadMessages = [];
var errorTimeout;

//
// Run on page load
//

window.onload = function () {
  if (!localStorage.getItem("token")) return;
  token = localStorage.getItem("token");
  login();
};

fetch("./emojis.json")
  .then((res) => res.json())
  .then((json) => (emojis = json));

fetch("./badges.json")
  .then((res) => res.json())
  .then((json) => (badges = json));

document.querySelector("#upload").addEventListener("input", (event) => {
  addFile(document.querySelector("#upload").files[0]);
});

document.querySelector("#input").addEventListener("paste", (event) => {
  let item = event.clipboardData.items[0];

if (item.type.indexOf("image") === 0) {
    let blob = item.getAsFile();
    addFile(blob);
  }
});

document
  .querySelector("#messagesContainer")
  .addEventListener("scroll", async function (e) {
    let documentHeight = document.querySelector("#messagesContainer");
    if (documentHeight.scrollTop === 0) {
      initialHeight = documentHeight.scrollHeight;
      await getNewMessages(
        activeChannel,
        document
          .querySelector("#messagesContainer")
          .firstChild.id.replace("MSG-", ""),
      );
      documentHeight.scrollTo(0, documentHeight.scrollHeight - initialHeight);
    }
  });

//
// UI/UX
//

let toolbar = document.querySelector(".toolbar");
let toolbarBtn = document.querySelector(".toolbar-btn");
toolbarBtn.addEventListener("click", () => {
  toolbar.classList.toggle("show-toolbar");
});

function scrollChatToBottom() {
  const element = document.querySelector("#messagesContainer");
  element.scrollTo(0, element.scrollHeight);
}

