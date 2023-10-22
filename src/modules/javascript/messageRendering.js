//
// All of the message render functions
//

function renderReactions(reactions, channelID, messageID) {
  let children = [];
  Object.keys(reactions).forEach((reaction) => {
    let reactionContainer = document.createElement("button");
    let customEmoteImage;

    if (Object.values(emojis.standard).indexOf(reaction) === -1)
      customEmoteImage = document.createElement("img");
    else {
      customEmoteImage = document.createElement("span");
      customEmoteImage.innerText = reaction;
    }

    let reactionIndicator = document.createElement("span");

    reactionContainer.onclick = () => {
      if (
        cacheLookup("messages", messageID).reactions[reaction].indexOf(
          state.connection.userProfile._id,
        ) === -1
      ) {
        fetch(
          `${settings.instance.delta}/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "PUT", headers: { "x-session-token": token } },
        );
      } else {
        fetch(
          `${settings.instance.delta}/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "DELETE", headers: { "x-session-token": token } },
        );
      }
    };

    if (Object.values(emojis.standard).indexOf(reaction) === -1)
      customEmoteImage.src = `${settings.instance.autumn}/emojis/${reaction}`;
    reactionIndicator.innerText = reactions[reaction].length;
    reactionIndicator.classList.add("reactionCount");
    if (reactions[reaction].indexOf(state.connection.userProfile._id) !== -1)
      reactionContainer.classList.add("selfReacted");

    reactionContainer.id = `REACTION-${reaction}`;
    reactionContainer.classList.add("reaction")
    reactionContainer.appendChild(customEmoteImage);
    reactionContainer.appendChild(reactionIndicator);
    children.push(reactionContainer);
  });
  return children;
}

function parseMessageContent(message) {
  let messageContent = document.createElement("div");

  messageContent.classList.add("messageContent");
  if (!message.content) return messageContent;

  let sanitizedContent = message.content.replace(/</g, "&lt;");
  sanitizedContent = sanitizedContent.replace(/>/g, "&gt;");
  messageContent.innerHTML = sanitizedContent;

  //Mention parser
  if (message.mentions) {
    message.mentions.forEach((mention) => {
      let splitMessage;
      if ((splitMessage = messageContent.innerHTML.split(`&lt;@${mention}&gt;`)).length === 1) return;

      let segConcat = document.createElement("div");
      let newSeg;

      splitMessage.forEach((segment) => {
        newSeg = document.createElement("span");
        newSeg.innerHTML = segment;
        segConcat.appendChild(newSeg);
      });

      let ping = document.createElement("button");
      let pingContainer = document.createElement("div");
      let mentionPfp = document.createElement("img");
      let mentionText = document.createElement("span");
      let tmpUserProfile = cacheLookup("users", mention);

      mentionPfp.classList.add("mentionPfp");
      mentionText.classList.add("mentionText");
      ping.classList.add("tag");

      //TODO: make this work
      ping.onclick = () => {
        loadProfile(mention);
      };

      ping.appendChild(mentionPfp);
      mentionText.textContent = cacheLookup("users", mention).displayName;

      mentionPfp.src = tmpUserProfile.pfp
        ? `${settings.instance.autumn}/avatars/${tmpUserProfile.pfp._id}?max_side=256`
        : `${settings.instance.delta}/users/${mention}/default_avatar?max_side=256`;
      mentionText.textContent = cacheLookup("users", mention).displayName;

      ping.appendChild(mentionPfp);
      ping.appendChild(mentionText);
      pingContainer.appendChild(ping);
      segConcat.insertBefore(pingContainer, newSeg);
      messageContent = segConcat;
    });
  }

  // Emojis
  Object.keys(emojis.standard).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}:`) !== -1) {
      messageContent.innerHTML = messageContent.innerHTML.replace(
        new RegExp(`:${emoji}:`, "g"),
        emojis.standard[emoji],
      );
    }
  });

  Object.keys(emojis.custom).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}`) === -1) return;

    let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
    let emojiImage = document.createElement("img");

    emojiImage.src = `${settings.instance.legacyEmotes}/projects/revolt/emotes/${emojis.custom[emoji]}`;
    messageContent.replaceChildren();

    for (let i = 0; i < tmpMsg.length; i++) {
      if (i !== tmpMsg.length - 1)
        messageContent.innerHTML += tmpMsg[i] + emojiImage.outerHTML;
      else messageContent.innerHTML += tmpMsg[i];
    }
  });


  if (
    messageContent.innerHTML.match(
      /:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g,
    ) !== null
  ) {
    let matches = messageContent.innerHTML.match(
      /:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g,
    );

    for (let i = 0; i < matches.length; i++) {
      let emoji = matches[i].split(":")[1];
      let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
      let tmpImg = document.createElement("img");
      tmpImg.classList.add("emoji");
      //This is quite possibly the only bit of code in the entire client that I would classify as "spaghetti"
      let outputToGetAroundStupidDomManipulationShit = "";

      tmpImg.src = `${settings.instance.autumn}/emojis/${emoji}`;

      for (let j = 1; j < tmpMsg.length; j++) {
        outputToGetAroundStupidDomManipulationShit += tmpMsg[j];
      }
      messageContent.innerHTML = `${tmpMsg[0]}${tmpImg.outerHTML}${outputToGetAroundStupidDomManipulationShit}`;
    }
  }
  messageContent.innerHTML = converter
    .makeHtml(messageContent.innerHTML)
    .replace(/\n/g, "<br>");

  return messageContent;
}

function renderEmbed(embed) {
  let embedContainer = document.createElement("div");
  if (embed.type === "Text" || embed.type === "Website") {
    //Loki TODO: style
    embedContainer.style.backgroundColor = embed.colour;

    if (embed.icon_url) {
      let icon = document.createElement("img");

      icon.src = `${settings.instance.january}/proxy?url=${embed.icon_url}`;
      icon.classList.add("embed-icon");

      embedContainer.appendChild(icon);
    }

    if (embed.original_url) {
      let originalURL = document.createElement("span");

      originalURL.classList.add("embed-site-name");
      originalURL.textContent = embed.original_url;

      embedContainer.appendChild(originalURL);
    }

    if (embed.site_name) {
      let siteName = document.createElement("span");

      siteName.classList.add("embed-site-name");
      siteName.textContent = embed.site_name;

      embedContainer.appendChild(siteName);
    }

    if (embed.title) {
      let title = document.createElement("h3");

      title.classList.add("embedTitle");
      title.textContent = embed.title;

      embedContainer.appendChild(title);
    }

    if (embed.description) {
      let description = document.createElement("pre");

      description.classList.add("embedDesc");
      description.textContent = embed.description;

      embedContainer.appendChild(description);
    }

    //Loki TODO: cap image size
    if (embed.image && !settings.behaviour.dataSaver) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.image.url}`;

      embedContainer.appendChild(media);
    }

    if (embed.video && !settings.behaviour.dataSaver) {
      let media = document.createElement("video");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.image.url}`;

      embedContainer.appendChild(media);
    }

    if (embed.media && !settings.behaviour.dataSaver) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.autumn}/attachments/${embed.media._id}`;

      embedContainer.appendChild(media);
    }
  } else {
    if (embed.type === "Image" && !settings.behaviour.dataSaver) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.url}`;

      embedContainer.appendChild(media);
    } else {
      let media = document.createElement("video");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.url}`;

      embedContainer.appendChild(media);
    }
  }
  return embedContainer;
}

// Parses and renders messages
// TODO: make this function not be almost 200 lines long
// Loki TODO: Add blocked message styling
// Loki TODO: add some flair for messages sent by friends
async function parseMessage(message) {
  const member = cacheLookup("members", message.author, state.active.server);
  const messageContainer = document.getElementById("messagesContainer");

  let messageActions = document.createElement("div");
  let messageContent = document.createElement("div");
  let userData = document.createElement("div");
  let username = document.createElement("button");
  let profilePicture = document.createElement("img");
  let replyButton = document.createElement("button");
  let editButton = document.createElement("button");
  let deleteButton = document.createElement("button");
  let masqueradeBadge = document.createElement("span");
  let messageDisplay = document.createElement("div");
  let reactionsContainer = document.createElement("div");

  messageDisplay.classList.add("message-display");
  messageActions.classList.add("message-actions");
  profilePicture.classList.add("chat-pfp");
  userData.classList.add("userdata");
  username.classList.add("username");
  messageContent.classList.add("message-content");
  reactionsContainer.classList.add("reactionsContainer");

  reactionsContainer.id = `reactionsContainer${message._id}`;

  let user;
  if (message.system) {
    user = await userLookup(
      message.system.id ? message.system.id : message.system.by,
    );
  } else {
    user = await userLookup(message.author);
  }

  if (message.system) {
    username.textContent = user.username;

    profilePicture.src = user.pfp
      ? `${settings.instance.autumn}/avatars/${user.pfp._id}?max_side=256`
      : `${settings.instance.delta}/users/${user.id}/default_avatar`;

    messageContent.textContent = message.system.type;

    username.onclick = () => {
      loadProfile(user.id);
    };
    profilePicture.onclick = () => {
      loadProfile(user.id);
    };

    userData.appendChild(profilePicture);
    userData.appendChild(username);
    messageContainer.appendChild(userData);
    messageContainer.appendChild(messageContent);
    return messageDisplay;
  } else {
    if (message.mentions && message.mentions.indexOf(state.connection.userProfile._id) !== -1) messageDisplay.classList.add("selfMentioned");

    if (!message.masquerade) {
      username.textContent = member.nickname
        ? member.nickname
        : user.displayName;
      if (user.bot !== undefined) masqueradeBadge.textContent = "Bot";

      username.appendChild(masqueradeBadge);
      profilePicture.src = member.avatar
        ? `${settings.instance.autumn}/avatars/${member.avatar._id}`
        : user.pfp
        ? `${settings.instance.autumn}/avatars/${user.pfp._id}?max_side=256`
        : `${settings.instance.delta}/users/${user.id}/default_avatar`;

      if (member.roles) {
        for (let i = member.roles.length + 1; i >= 0; i--) {
          let tmpColour;
          if (
            (tmpColour = cacheLookup("roles", member.roles[i], state.active.server)[
              "colour"
            ])
          ) {
            if (/^#[0-9A-F]{6}$/i.test(tmpColour)) {
              // Testing if it's a valid hex code
              username.style.backgroundColor = tmpColour;
              break;
            } else {
              username.style.background = tmpColour;
              username.style.backgroundClip = "border-box";
            }
          }
        }
      }
    } else {
      masqueradeBadge.textContent = "Masq";
      if (message.masquerade.name)
        username.textContent = message.masquerade.name;
      else
        username.textContent = member.nickname
          ? member.nickname
          : user.displayName;

      username.appendChild(masqueradeBadge);

      if (message.masquerade.avatar) {
        profilePicture.src = `${settings.instance.january}/proxy?url=${message.masquerade.avatar}`;
      } else {
        profilePicture.src = user.pfp
          ? `${settings.instance.autumn}/avatars/${user.pfp._id}?max_side=256`
          : `${settings.instance.delta}/users/${user.pfp._id}/default_avatar`;
        username.style.color = message.masquerade.colour;
      }
    }
  }
  username.onclick = () => {
    loadProfile(user.id);
  };

  profilePicture.onclick = () => {
    loadProfile(user.id);
  };

  userData.appendChild(profilePicture);
  userData.appendChild(username);

  if (user.relationship !== "Blocked") {
    messageContent = parseMessageContent(message);

    if (message.replies) {
      let reply = document.createElement("div");
      reply.classList.add("reply-content");

      for (let j = 0; j < message.replies.length; j++) {
        let replyContent = document.createElement("span");
        replyContent.textContent =
          "> " + cacheLookup("messages", message.replies[j]).content + "\n";
        reply.appendChild(replyContent);
      }

      messageDisplay.appendChild(reply);
    }

    if (
      cache.messages.length === 0 ||
      cache.messages[cache.messages.length - 1].author !== message.author ||
      cache.messages[cache.messages.length - 1].masquerade !== undefined
    )
      messageDisplay.appendChild(userData);
    messageDisplay.appendChild(messageContent);

    messageDisplay.id = `MSG-${message._id}`;
    messageDisplay.class = "message";

    if (message.embeds) {
      let embeds = document.createElement("div");
      embeds.classList.add("embedsContainer");
      message.embeds.forEach((embed) => {
        embeds.appendChild(renderEmbed(embed));
      });
      messageDisplay.appendChild(embeds);
    }

    if (message.attachments && !settings.behaviour.dataSaver) {
      let attachments = document.createElement("div");
      attachments.classList.add("message-attachments");

      message.attachments.forEach((tmpAttchmntAttrs) => {
        let tmpAttachment
        //TODO: edit this to only alter what type of element is created, to follow DRY

        if (tmpAttchmntAttrs.content_type.startsWith("image")) {
          tmpAttachment = document.createElement("img");
          tmpAttachment.src = `${settings.instance.autumn}/attachments/${tmpAttchmntAttrs._id}/${tmpAttchmntAttrs.filename}`;
        } else if (tmpAttchmntAttrs.content_type.startsWith("video")) {
          let subAttachment = document.createElement("source");

          tmpAttachment = document.createElement("video");
          tmpAttachment.controls = true;
          tmpAttachment.style.maxWidth = "30%";
          tmpAttachment.style.maxHeight = "30%";

          subAttachment.src = `${settings.instance.autumn}/attachments/${tmpAttchmntAttrs._id}/${tmpAttchmntAttrs.filename}`;
          subAttachment.type = tmpAttchmntAttrs.content_type;
          tmpAttachment.appendChild(subAttachment);
        } else if (tmpAttchmntAttrs.content_type.startsWith("audio")) {
          let tmpContainer = document.createElement("audio");
          let subAttachment = document.createElement("source");
          let name = document.createElement("span");

          tmpAttachment = document.createElement("div");
          tmpContainer.controls = true;
          tmpContainer.textContent = tmpAttchmntAttrs.filename;

          subAttachment.src = `${settings.instance.autumn}/attachments/${tmpAttchmntAttrs._id}/${tmpAttchmntAttrs.filename}`;
          subAttachment.type = tmpAttchmntAttrs.content_type;

          tmpContainer.appendChild(subAttachment);
          name.textContent = tmpAttchmntAttrs.filename + "\n";

          tmpAttachment.appendChild(name);
          tmpAttachment.appendChild(tmpContainer);
        } else {
          tmpAttachment = document.createElement("a");
          tmpAttachment.textContent = tmpAttchmntAttrs.filename;
          tmpAttachment.href = `${settings.instance.autumn}/attachments/${tmpAttchmntAttrs._id}/${tmpAttchmntAttrs.filename}`;
        }
        tmpAttachment.type = tmpAttchmntAttrs.content_type
        attachments.appendChild(tmpAttachment);
      });
      messageDisplay.appendChild(attachments);
    }

    if (message.reactions) {
      renderReactions(message.reactions, message.channel, message._id).forEach(
        (reactionContainer) => {
          reactionsContainer.appendChild(reactionContainer);
        },
      );
    }
  } else {
    if (message.replies) {
      let reply = document.createElement("div");
      reply.classList.add("reply-content");

      for (let j = 0; j < message.replies.length; j++) {
        let replyContent = document.createElement("span");
        replyContent.textContent =
          "> " + cacheLookup("messages", message.replies[j]).content + "\n";
        reply.appendChild(replyContent);
      }
      messageDisplay.appendChild(reply);
    }

    if (
      cache.messages.length === 0 ||
      cache.messages[cache.messages.length - 1].author !== message.author ||
      cache.messages[cache.messages.length - 1].masquerade !== undefined
    )
      messageDisplay.appendChild(userData);
    messageDisplay.appendChild(messageContent);

    messageDisplay.id = message._id;
    messageDisplay.class = "message";
    messageContent.innerText = "<Blocked user>";
    messageDisplay.classList.add("blockedMessage");
  }

  replyButton.onclick = () => {
    if (activeReplies.length >= 5) return;
    activeReplies.push({
      id: message["_id"],
      mention: false,
    });
    const replyText = document.createElement("p");
    replyText.textContent = message.content;

    replyText.classList.add("replying-content");
    document.querySelector(".replying-container").appendChild(replyText);
    scrollChatToBottom();
  };

  editButton.onclick = () => {
    editingMessageID = message._id;
    document.querySelector("#input").value = message.content;
  };

  deleteButton.onclick = (event) => {
    if (
      checkPermission(message.channel, "ManageMessages") ||
      (message.author === state.connection.userProfile._id && event.shiftKey)
    ) {
      fetch(
        `${settings.instance.delta}/channels/${message.channel}/messages/${message._id}`,
        {
          method: "DELETE",
          headers: {
            "x-session-token": token,
          },
        },
      );
    }
  };

  replyButton.innerText = "Reply";
  editButton.innerText = "Edit";
  deleteButton.innerText = "Delete";

  deleteButton.classList.add("deleteButton");

  messageActions.appendChild(replyButton);
  if (message.author === state.connection.userProfile._id)
    messageActions.appendChild(editButton);
  messageActions.appendChild(deleteButton);

  messageDisplay.appendChild(messageActions);
  messageDisplay.appendChild(reactionsContainer);
  cache.messages.push({
    id: message._id,
    author: message.author,
    content: message.content,
    masquerade: message.masquerade,
    reactions: message.reactions,
  });
  return messageDisplay;
}

