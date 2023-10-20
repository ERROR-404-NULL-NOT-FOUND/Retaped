//
// Message fetching and rendering
//

async function getNewMessages(id, startingMessage = undefined) {
  let messagesContainer = document.querySelector("#messagesContainer");
  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&${
      startingMessage ? `sort=latest&before=${startingMessage}` : "sort=latest"
    }`,
  );

  const users = placeholder.users;

  for (let i = 0; i < users.length; i++) {
    if (cacheLookup("users", users[i]._id) === 1)
      cache.users.push({
        id: users[i]._id,
        username: users[i].username,
        pfp: users[i].avatar,
        bot: users[i].bot,
        discriminator: users[i].discriminator,
        displayName: users[i].display_name
          ? users[i].display_name
          : users[i].username,
        relationship: users[i].relationship,
        badges: getBadges(users[i].badges),
      });
  }

  if (placeholder.members) {
    const members = placeholder.members;

    for (let i = 0; i < members.length; i++) {
      if (cacheLookup("members", members[i]._id.user, activeServer) === 1)
        cache.servers[cacheIndexLookup("servers", activeServer)].members.push(
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

    if (unreadMessages.indexOf(messages[i]._id) !== -1) {
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

async function getMessages(id) {
  cache.messages = [];
  activeReplies = [];
  activeChannel = id;
  const input = document.querySelector("#input");

  input.value = "";
  input.readOnly = false;

  document.querySelector(".replying-container").replaceChildren();
  document.querySelector("#typingBar").replaceChildren();
  document.querySelector("#typingBar").hidden = true;
  const uploadsBarContainer = document.querySelector("#uploadsBarContainer");

  uploadsBarContainer.replaceChildren();
  uploadsBarContainer.hidden = true;
  attachments = [];

  // fetchResource(`channels/${id}`).then((data) => {
  //   // document.getElementById("serverName").innerText =
  //   //   data.channel_type === "DirectMessage" ? data.recipients[0] : data.channel_type === "SavedMessages" ? "Saved Messages" : cacheLookup("servers", data.server)[1];
  //   document.getElementById("serverName").innerText = cacheLookup("servers", data.server)[1];
  // });
  if (!checkPermission(id, "SendMessage")) {
    input.value = "You don't have permission to send messages in this channel";
    input.readOnly = true;
  }

  clearMessages();
  let messages = await getNewMessages(id);
  scrollChatToBottom();

  fetch(
    `${settings.instance.delta}/channels/${activeChannel}/ack/${messages[0]._id}`,
    {
      headers: {
        "x-session-token": token,
      },
      method: "PUT",
    },
  );
}

async function sendMessage() {
  if (isMessageSending) return;

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

  let embeds = undefined;
  let masquerade = undefined;

  if (
    document.querySelector("#embedTitle").value ||
    document.querySelector("#embedDesc").value ||
    document.querySelector("#embedColour").value ||
    document.querySelector("#embedIconURL").value ||
    document.querySelector("#embedMedia").value ||
    document.querySelector("#embedURL").value
  ) {
    embeds = [
      {
        title: document.querySelector("#embedTitle").value
          ? document.querySelector("#embedTitle").value
          : null,
        description: document.querySelector("#embedDesc").value
          ? document.querySelector("#embedDesc").value
          : null,
        colour: document.querySelector("#embedColour").value
          ? document.querySelector("#embedColour").value
          : null,
        icon_url: document.querySelector("#embedIconURL").value
          ? document.querySelector("#embedIconURL").value
          : null,
        url: document.querySelector("#embedURL").value
          ? document.querySelector("#embedURL").value
          : null,
        media: document.querySelector("#embedMedia").value
          ? document.querySelector("#embedMedia").value
          : null,
      },
    ];
  }

  if (
    document.querySelector("#masqName").value ||
    document.querySelector("#masqPfp").value ||
    document.querySelector("#masqColour").value
  ) {
    masquerade = {
      name: document.querySelector("#masqName").value
        ? document.querySelector("#masqName").value
        : null,
      avatar: document.querySelector("#masqPfp").value
        ? document.querySelector("#masqPfp").value
        : null,
      colour: document.querySelector("#masqColour").value
        ? document.querySelector("#masqColour").value
        : null,
    };
  }

  isMessageSending = true;
  messageContainer.classList.add("messageSending");
  messageContainer.readOnly = true;

  if (attachments) await uploadToAutumn();

  let body = sendRawJSON
    ? message
    : JSON.stringify({
        content: message,
        replies: activeReplies,
        masquerade,
        embeds,
        attachments: attachmentIDs,
      });

  await fetch(
    editingMessageID === ""
      ? `${settings.instance.delta}/channels/${activeChannel}/messages`
      : `${settings.instance.delta}/channels/${activeChannel}/messages/${editingMessageID}`,
    {
      headers: {
        "x-session-token": token,
      },
      method: editingMessageID === "" ? "POST" : "PATCH",
      body: body,
    },
  )
    .then((response) => response.json())
    .then((data) => {
      isMessageSending = false;
      messageContainer.readOnly = false;
      messageContainer.classList.remove("messageSending");

      if (editingMessageID !== "") {
        editingMessageID = "";
        return;
      }
      fetch(
        `${settings.instance.delta}/channels/${activeChannel}/ack/${data._id}`,
        { method: "PUT", headers: { "x-session-token": token } },
      );
    });

  messageContainer.value = "";
  activeReplies = [];
  attachments = [];
  attachmentIDs = [];

  document.querySelector("#uploadsBarContainer").replaceChildren();
  document.querySelector("#uploadsBarContainer").hidden = true;
  document.querySelector(".replying-container").replaceChildren();
  scrollChatToBottom();
}

function clearMessages() {
  document.getElementById("messagesContainer").replaceChildren();
}
