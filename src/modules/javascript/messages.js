// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Message fetching and rendering
//

/**
 * Description
 * @param {String} id ID of channel to fetch data from
 * @param {String} startingMessage=undefined  Message ID to start from
 * @returns {Array} List the messages that are fetched
 */
async function getNewMessages(id, startingMessage = undefined) {
  let messagesContainer = document.querySelector("#messagesContainer");
  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&${
      startingMessage ? `sort=latest&before=${startingMessage}` : "sort=latest"
    }`,
  );

  const users = placeholder.users;

  buildUserCache(users);

  if (placeholder.members) {
    const members = placeholder.members;

    for (let i = 0; i < members.length; i++) {
      if (cacheLookup("members", members[i]._id.user, state.active.server) === 1)
        cache.servers[cacheIndexLookup("servers", state.active.server)].members.push(
          members[i],
        );
    }
  }

  let messages;
  if (startingMessage) messages = placeholder.messages.reverse();
  else messages = placeholder.messages;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (startingMessage)
      messagesContainer.insertBefore(
        await parseMessage(messages[i]),
        messagesContainer.firstChild,
      );
    else messagesContainer.appendChild(await parseMessage(messages[i]));

    if (state.unreads.unread.messages.indexOf(messages[i]._id) !== -1) {
      let unreadMarkerContainer = document.createElement("div");
      let unreadMarkerText = document.createElement("span");

      unreadMarkerText.innerText = "NEW";
      unreadMarkerContainer.classList.add("unreadMarkerContainer");

      unreadMarkerContainer.appendChild(unreadMarkerText);
      document
        .querySelector("#messagesContainer")
        .appendChild(unreadMarkerContainer);
    }
  }

  return placeholder.messages;
}

/**
 * Fetches messages from a given channel and resets some stuff
 * @param {String} id  Id of the channel to fetch messages from
 * @returns {null} Doesn't return 
 */
async function getMessages(id) {
  cache.messages.length = 0;
  state.messageMods.replies.length = 0;
  state.active.channel = id;
  const input = document.querySelector("#input");

  input.value.length = 0;
  input.readOnly = false;

  document.querySelector(".replying-container").replaceChildren();
  document.querySelector("#typingBar").replaceChildren();
  document.querySelector("#typingBar").hidden = true;

  const uploadsBarContainer = document.querySelector("#uploadsBarContainer");

  uploadsBarContainer.replaceChildren();
  uploadsBarContainer.hidden = true;
  state.messageMods.attachments.length = 0;

  if (!checkPermission(id, "SendMessage")) {
    input.value = "You don't have permission to send messages in this channel";
    input.readOnly = true;
  } else {
    input.value = '';
    input.readOnly = false;
  }

  clearMessages();
  let messages = await getNewMessages(id);

  //Wait for images to start loading
  setTimeout(() => {
    scrollChatToBottom();
  }, 200);

  fetch(
    `${settings.instance.delta}/channels/${state.active.channel}/ack/${messages[0]._id}`,
    {
      headers: {
        "x-session-token": state.connection.token,
      },
      method: "PUT",
    },
  );
}

/**
 * Sends the message
 * @returns {null} Doesn't return
 */
async function sendMessage() {
  if (state.messageSending) return;

  const messageContainer = document.getElementById("input");
  let message = messageContainer.value;

  //Checking for valid pings, and replacing with an actual ping
  // TODO: Make this work
  /*
  if (message.search(/@[^ ]*) != -1) {
  //  let pings = /@[^ ]*[Symbol.match](message);
    for (let i = 0; i < pings.length; i++) {
      if (await userLookup(pings[i].replace("@", "")) !== undefined) {
        message = message.replace(
          pings[i],
          `<@${await userLookup(pings[i].replace("@", ""))[0]}>`
        );
      }
    }
  }
  */

  state.messageSending = true;
  messageContainer.classList.add("messageSending");
  messageContainer.readOnly = true;

  let attachmentIDs;
  if (state.messageMods.attachments) attachmentIDs = await uploadToAutumn();

  let body = state.messageMods.sendRawJSON
    ? message
    : {
        content: message,
        replies: state.messageMods.replies,
        masquerade: state.messageMods.masquerade,
        embeds: state.messageMods.embeds,
        attachments: attachmentIDs,
      };

  if (!state.messageMods.masquerade.name)
    body.masquerade = null;

  if (!state.messageMods.embed.title || !state.messageMods.embed.title)
    body.embed = null;

  await fetch(
    state.messageMods.editing === ""
      ? `${settings.instance.delta}/channels/${state.active.channel}/messages`
      : `${settings.instance.delta}/channels/${state.active.channel}/messages/${state.messageMods.editing}`,
    {
      headers: {
        "x-session-token": state.connection.token,
      },
      method: state.messageMods.editing === "" ? "POST" : "PATCH",
      body: JSON.stringify(body),
    },
  )
    .then((response) => response.json())
    .then((data) => {
      state.messageSending = false;
      messageContainer.readOnly = false;
      messageContainer.classList.remove("messageSending");

      if (state.messageMods.editing) {
        state.messageMods.editing = "";
        return;
      }
      fetch(
        `${settings.instance.delta}/channels/${state.active.channel}/ack/${data._id}`,
        { method: "PUT", headers: { "x-session-token": state.connection.token } },
      );
    });

  messageContainer.value = "";
  state.messageMods.replies.length = 0;
  state.messageMods.attachments.length = 0;

  document.querySelector("#uploadsBarContainer").replaceChildren();
  document.querySelector("#uploadsBarContainer").hidden = true;
  document.querySelector(".replying-container").replaceChildren();
  scrollChatToBottom();
}

/**
 * Macro to remove all messages and reset state
 * @returns {null} Doesn't return
 */
function clearMessages() {
  const input = document.querySelector("#input");
  document.getElementById("messagesContainer").replaceChildren();
  
  cache.messages.length = 0;
  state.messageMods.replies.length = 0;
  state.active.channel = id;

  input.value.length = 0;
  input.readOnly = false;
}

/**
 * Uploads the files in state.messageMods.attachments to autumn
 * @returns {null} Doesn't return
 */
async function uploadToAutumn() {
  let attachmentIDs = [];
  for (let i = 0; i < state.messageMods.attachments.length; i++) {
    const formData = new FormData();
    formData.append("myFile", state.messageMods.attachments[i]);

    await fetch(`${settings.instance.autumn}/attachments`, {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        attachmentIDs.push(data.id);
      });
  }
  return attachmentIDs;
}

//@license-end