// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// All of the message render functions
//

/**
 * Description
 * @param {Object} reactions  An object containing reactions and who reacted to them
 * @param {String} channelID  ID of channel that the message was sent in
 * @param {String} messageID  ID of message containing the reactions
 * @returns {any}
 */
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
        ) === -1 // If the reaction has been reacted by the user
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
      customEmoteImage.src = `${settings.instance.autumn}/emojis/${reaction}`; // Jen insists that these are called "emotes," not emojis

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

/**
 * Mention parser
 * @param {Object} message  Message object
 * @param {HTMLElement} messageContent  HTML element for the message
 * @returns {HTMLElement}
 */
function parseMentions(message, messageContent) {
  if (message.mentions) {
    message.mentions.forEach((mention) => {
      let splitMessage;
      // Due to sanitization, we have to check for the HTML eqiuvilents of the symbols < and >
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

  return messageContent;
}

/**
 * Parses the emojis in a message
 * @param {HTMLElement} messageContent HTML element for the message
 * @returns {HTMLElement} The element with emojis
 */
function parseEmojis(messageContent) {
  //Searches for each standard emoji and replaces it with its unicode counterpart
  //TODO: use mutant remix
  Object.keys(emojis.standard).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}:`) === -1) return;
    messageContent.innerHTML = messageContent.innerHTML.replace(
      new RegExp(`:${emoji}:`, "g"),
      emojis.standard[emoji],
    );
  });
  
  //Ditto, but replaces it with an image instead
  Object.keys(emojis.custom).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}:`) === -1) return;

    let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
    let emojiImage = document.createElement("img");

    emojiImage.src = `${settings.instance.legacyEmotes}/projects/revolt/emotes/${emojis.custom[emoji]}`;
    messageContent.replaceChildren(); //Removes all elements in the message content

    for (let i = 0; i < tmpMsg.length; i++) {
      if (i !== tmpMsg.length - 1)
        messageContent.innerHTML += tmpMsg[i] + emojiImage.outerHTML;
      else messageContent.innerHTML += tmpMsg[i];
    }
  });

  //Matches custom emojis
  if (
    (matches = messageContent.innerHTML.match(
      /:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g,
    )) !== null
  ) {
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
  return messageContent;
}

/**
 * Description
 * @param {Object} message  Message object to render
 * @returns {any}
 */
function parseMessageContent(message) {
  let messageContent = document.createElement("div");
  
  messageContent.classList.add("messageContent");
  if (!message.content) return messageContent;

  //Message sanitation; replaces < and > with their HTML symbols
  let sanitizedContent = message.content
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;");
  messageContent.innerHTML = sanitizedContent;

  messageContent = parseEmojis(messageContent);
  messageContent = parseMentions(message, messageContent);

  //Markdown renderer
  messageContent.innerHTML = marked
    .parse(messageContent.innerHTML)
    .replace(/\n/g, "<br>"); //Replace newlines with something that HTML parses

  //TODO: Make the following code work 100% of the time
  // messageContent.innerHTML = messageContent.innerHTML.substring(0, messageContent.innerHTML.length - 4); //Remove final <br> that gets added for some reason

  return messageContent;
}

/**
 * Description
 * @param {Object} embed Embed object to be rendered
 * @returns {HTMLElement} HTML element containing the embed
 */
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
    if (embed.image && embed.image.url && !settings.behaviour.dataSaver.value) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.image.url}`;

      embedContainer.appendChild(media);
    }

    if (embed.video && embed.video.url && !settings.behaviour.dataSaver.value) {
      let media = document.createElement("video");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.image.url}`;

      embedContainer.appendChild(media);
    }

    if (embed.media && embed.media._id && !settings.behaviour.dataSaver) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.autumn}/attachments/${embed.media._id}`;

      embedContainer.appendChild(media);
    }
  } else {
    if (embed.type === "Image" && embed.url && !settings.behaviour.dataSaver) {
      let media = document.createElement("img");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.url}`;

      embedContainer.appendChild(media);
    } else {
      if (!embed.url) return embedContainer;
      let media = document.createElement("video");

      media.classList.add("embedMedia");
      media.src = `${settings.instance.january}/proxy?url=${embed.url}`;

      embedContainer.appendChild(media);
    }
  }
  return embedContainer;
}

/**
 * Description
 * @param {Object} message  Message object
 * @returns {HTMLObject}  HTML object containing all of the message actions
 */
function contextButtons(message) {
  const replyButton = document.createElement("button");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const messageActions = document.createElement("div");

  messageActions.classList.add("message-actions");

  replyButton.innerText = "Reply";
  editButton.innerText = "Edit";
  deleteButton.innerText = "Delete";

  deleteButton.classList.add("deleteButton");

  messageActions.appendChild(replyButton);
  if (message.author === state.connection.userProfile._id)
    messageActions.appendChild(editButton);
  if(checkPermission(message.channel, "ManageMessages")) messageActions.appendChild(deleteButton);

  replyButton.onclick = () => {
    if (state.messageMods.replies.length >= 5) return;
    state.messageMods.replies.push({
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
    if (event.shiftKey) {
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

  return messageActions;
}
// Parses and renders messages
// TODO: make this function not be almost 200 lines long
// Loki TODO: Add blocked message styling
// Loki TODO: add some flair for messages sent by friends
async function parseMessage(message) {
  const member = cacheLookup("members", message.author, state.active.server);
  const messageContainer = document.getElementById("messagesContainer");

  let messageContent = document.createElement("div");
  const userData = document.createElement("div");
  const username = document.createElement("button");
  const profilePicture = document.createElement("img");
  const masqueradeBadge = document.createElement("span");
  const presenceIcon = document.createElement("img");
  const messageDisplay = document.createElement("div");
  const reactionsContainer = document.createElement("div");

  messageDisplay.classList.add("message-display");
  profilePicture.classList.add("chat-pfp");
  userData.classList.add("userdata");
  username.classList.add("username");
  messageContent.classList.add("message-content");
  reactionsContainer.classList.add("reactions-container");
  presenceIcon.classList.add("presence-icon");

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

      if (user.status) presenceIcon.src = `../assets/${user.status.presence ? user.status.presence : "Offline"}.svg`;

      if (user.bot !== undefined) masqueradeBadge.textContent = "Bot";

      profilePicture.src = member.avatar
        ? `${settings.instance.autumn}/avatars/${member.avatar._id}`
        : user.pfp
        ? `${settings.instance.autumn}/avatars/${user.pfp._id}?max_side=256`
        : `${settings.instance.delta}/users/${user.id}/default_avatar`;

      if (member.roles) {
        let highestRole;
        let currentRoleRank = 2 ^ 64; //64-bit integer limit; no role can be ranked lower than this

        for (let i = 0; i <= member.roles.length; i++) {
          let tmpRole = cacheLookup("roles", member.roles[i], state.active.server);
          if (tmpRole.colour &&
            tmpRole.rank < currentRoleRank) { //Higher number = lower rank
            highestRole = tmpRole;
            currentRoleRank = tmpRole.rank;
          }
        }

        if (highestRole !== undefined) {
          if (/^#[0-9A-F]{6}$/i.test(highestRole.colour)) {
            // Testing if it's a valid hex code
            username.style.backgroundColor = highestRole.colour;
          } else {
            username.style.background = highestRole.colour;
            username.style.backgroundClip = "border-box";
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
  userData.appendChild(masqueradeBadge);
  if (settings.visual.showPresenceIconsInChat) userData.appendChild(presenceIcon);

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
    messageDisplay.classList.add("blocked-message");
  }
  
  messageDisplay.appendChild(contextButtons(message));

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

//@license-end