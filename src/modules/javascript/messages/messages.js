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
  debugInfo("Getting messages");
  let messagesContainer = document.querySelector("#messagesContainer");
  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&${
      startingMessage ? `sort=latest&before=${startingMessage}` : "sort=latest"
    }`
  );

  const users = placeholder.users;

  buildUserCache(users);

  if (placeholder.members) {
    const members = placeholder.members;

    for (let i = 0; i < members.length; i++) {
      if (
        cacheLookup("members", members[i]._id.user, state.active.server) === 1
      )
        cache.servers[
          cacheIndexLookup("servers", state.active.server)
        ].members.push(members[i]);
    }
  }

  let messages;
  if (startingMessage) messages = placeholder.messages.reverse();
  else messages = placeholder.messages;

  let unread = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (startingMessage)
      messagesContainer.insertBefore(
        await parseMessage(messages[i]),
        messagesContainer.firstChild
      );
    else messagesContainer.appendChild(await parseMessage(messages[i]));

    //LOKI todo: styling
    if (state.unreads.unread.messages.indexOf(messages[i]._id) !== -1) {
      let unreadMarkerContainer = document.createElement("div");
      let unreadMarkerText = document.createElement("span");
      unread = true;

      unreadMarkerText.innerText = storage.language.messages.markerText;
      unreadMarkerContainer.classList.add("unreadMarkerContainer");

      unreadMarkerContainer.appendChild(unreadMarkerText);
      messagesContainer.appendChild(unreadMarkerContainer);
    }
  }
  if (unread) document.querySelector(".unreadMarkerContainer").scrollIntoView();

  return [placeholder.messages, unread];
}

/**
 * Fetches messages from a given channel and resets some stuff
 * @param {String} id  Id of the channel to fetch messages from
 * @returns {null} Doesn't return
 */
async function getMessages(id) {
  state.homeScreen = false;
  document.querySelector(".replying-container").replaceChildren();
  document.querySelector("#typingBar").replaceChildren();
  document.querySelector("#typingBar").hidden = true;
  correctionsContainer.replaceChildren();

  const uploadsBarContainer = document.querySelector("#uploadsBarContainer");

  uploadsBarContainer.replaceChildren();
  uploadsBarContainer.hidden = true;
  state.messageMods.attachments.length = 0;

  clearMessages(id);

  if (!checkPermission(id, "SendMessage")) {
    input.value = formatTranslationKey(
      storage.language.messages.inputField.permissionDeniedText,
      "channel",
      `#${cacheLookup("channels", state.active.channel).name}`
    );
    input.readOnly = true;
  } else {
    input.placeholder = formatTranslationKey(
      storage.language.messages.inputField.sendMessageText,
      "channel",
      `#${cacheLookup("channels", state.active.channel).name}`
    );
    input.value = "";
    input.readOnly = false;
  }

  let [messages, unread] = await getNewMessages(id);

  //Wait for images to start loading
  //if (!unread)
  scrollChatToBottom();

  fetch(
    `${settings.instance.delta}/channels/${state.active.channel}/ack/${messages[0]._id}`,
    {
      headers: {
        "x-session-token": state.connection.token,
      },
      method: "PUT",
    }
  );
}

/**
 * Sends the message
 * @returns {null} Doesn't return
 */
async function sendMessage() {

  state.messageMods.masquerade = {
    colour: document.querySelector("#masqColour").value,
    avatar: document.querySelector("#masqPfp").value,
    name: document.querySelector("#masqName").value,
  };

  state.messageMods.embed = {
    title: document.querySelector("#embedTitle").value,
    description: document.querySelector("#embedDesc").value,
    media: document.querySelector("#embedMedia").value,
    colour: document.querySelector("#embedColour").value,
    url: document.querySelector("#embedURL").value,
  };
  if (state.messageSending || !(input.value || state.messageMods.embed.title)) return;

  const messageContainer = document.getElementById("input");
  let message = messageContainer.value;

  state.messageSending = true;
  messageContainer.classList.add("messageSending");
  messageContainer.readOnly = true;

  let attachmentIDs;
  if (state.messageMods.attachments) attachmentIDs = await uploadToAutumn();


  ["masquerade", "embed"].forEach((messageMod) => {
    Object.keys(state.messageMods[messageMod]).forEach((key) => {
      if (!state.messageMods[messageMod][key]) {
        delete state.messageMods[messageMod][key];
      }
    });
  });

  let body = state.messageMods.sendRawJSON
    ? message
    : {
        content: message,
        replies: state.messageMods.replies,
        masquerade: state.messageMods.masquerade,
        embeds: [state.messageMods.embed],
        attachments: attachmentIDs,
      };

  if (!state.messageMods.masquerade.name) delete body.masquerade;
  if (!state.messageMods.embed.title || !state.messageMods.embed.description)
    delete body.embeds;

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
    }
  )
    .then((response) => response.json())
    .then((data) => {
      state.messageSending = false;
      messageContainer.readOnly = false;
      messageContainer.classList.remove("messageSending");

      if (state.messageMods.editing) {
        state.messageMods.editing = "";
        document.querySelector("#editingTag").hidden = true;
        return;
      }
      fetch(
        `${settings.instance.delta}/channels/${state.active.channel}/ack/${data._id}`,
        {
          method: "PUT",
          headers: { "x-session-token": state.connection.token },
        }
      );
    });

  messageContainer.value = "";
  state.messageMods.masquerade = {};
  state.messageMods.embed = {};
  state.messageMods.replies.length = 0;
  state.messageMods.attachments.length = 0;

  ['embedTitle', 'embedDesc', 'embedMedia', 'embedURL'].forEach( id => {
    document.getElementById(id).value = "";
  });
  embed.hidden = true;
  

  document.querySelector("#uploadsBarContainer").replaceChildren();
  document.querySelector("#uploadsBarContainer").hidden = true;
  document.querySelector(".replying-container").replaceChildren();
  scrollChatToBottom();
}

/**
 * Macro to remove all messages and reset state
 * @param id channelID
 * @returns {null} Doesn't return
 */
function clearMessages(id) {
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
