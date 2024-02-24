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

    if (Object.values(storage.emojis.standard).indexOf(reaction) === -1)
      customEmoteImage = document.createElement("img");
    else {
      customEmoteImage = document.createElement("span");
      customEmoteImage.innerText = reaction;
    }

    let reactionIndicator = document.createElement("span");

    reactionContainer.onclick = () => {
      if (
        cacheLookup("messages", messageID).reactions[reaction].indexOf(
          state.connection.userProfile._id
        ) === -1 // If the reaction has been reacted by the user
      ) {
        fetch(
          `${settings.instance.delta}/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "PUT", headers: { "x-session-token": token } }
        );
      } else {
        fetch(
          `${settings.instance.delta}/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "DELETE", headers: { "x-session-token": token } }
        );
      }
    };

    if (Object.values(storage.emojis.standard).indexOf(reaction) === -1)
      customEmoteImage.src = `${settings.instance.autumn}/emojis/${reaction}`; // Jen insists that these are called "emotes," not emojis

    reactionIndicator.innerText = reactions[reaction].length;
    reactionIndicator.classList.add("reactionCount");
    if (reactions[reaction].indexOf(state.connection.userProfile._id) !== -1)
      reactionContainer.classList.add("selfReacted");

    reactionContainer.id = `REACTION-${reaction}`;
    reactionContainer.classList.add("reaction");
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
      let ping = document.createElement("button");
      let pingContainer = document.createElement("div");
      let mentionPfp = document.createElement("img");
      let mentionText = document.createElement("span");
      let tmpUserProfile = cacheLookup("users", mention);

      mentionPfp.classList.add("mentionPfp");
      mentionText.classList.add("mentionText");
      ping.classList.add("tag");

      //TODO: make this work
      ping.setAttribute("onclick", `loadProfile("${mention}")`);

      ping.appendChild(mentionPfp);
      mentionText.textContent = cacheLookup("users", mention).displayName;

      mentionPfp.src = tmpUserProfile.pfp;
      mentionText.textContent = cacheLookup("users", mention).displayName;

      ping.appendChild(mentionPfp);
      ping.appendChild(mentionText);
      pingContainer.appendChild(ping);

      // Due to sanitization, we have to check for the HTML equivalents of the symbols < and >
      messageContent.innerHTML = messageContent.innerHTML.replace(
        new RegExp(`&lt;@${mention}&gt;`, "g"),
        ping.outerHTML
      );
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
  //Loki TODO: Styling
  Object.keys(storage.emojis.standard).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}:`) === -1) return;
    let emojiImage = document.createElement("img");
    emojiImage.classList.add("emoji");

    emojiImage.src = `${settings.instance.emotes}/${storage.emojis.standard[
      emoji
    ]
      .codePointAt(0) //Finding emoji codepoint
      .toString(16)}.svg`; //Convert codepoint to hex to be compatible with the asset file naming

    messageContent.innerHTML = messageContent.innerHTML.replace(
      new RegExp(`:${emoji}:`, "g"),
      emojiImage.outerHTML
    );
  });

  //Ditto, but replaces it with an image instead
  Object.keys(storage.emojis.custom).forEach((emoji) => {
    if (messageContent.innerHTML.search(`:${emoji}:`) === -1) return;
    let emojiImage = document.createElement("img");
    emojiImage.classList.add("emoji");

    emojiImage.src = `${settings.instance.legacyEmotes}/projects/revolt/emotes/${storage.emojis.custom[emoji]}`;

    messageContent.innerHTML = messageContent.innerHTML.replace(
      new RegExp(`:${emoji}:`, "g"),
      emojiImage.outerHTML
    );
  });

  //Matches custom emojis
  if (
    (matches = messageContent.innerHTML.match(
      /:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g
    )) !== null
  ) {
    for (let i = 0; i < matches.length; i++) {
      let emoji = matches[i].split(":")[1]; //Split returns an array of [":", "<emoji>", ":"]
      let tmpImg = document.createElement("img");
      tmpImg.classList.add("emoji");

      tmpImg.src = `${settings.instance.autumn}/emojis/${emoji}`;

      messageContent.innerHTML = messageContent.innerHTML.replace(
        new RegExp(`:${emoji}:`, "g"),
        tmpImg.outerHTML
      );
    }
  }
  return messageContent;
}

function parseInvites(messageContent) {
  if (
    messageContent.innerHTML &&
    (matches = messageContent.innerText.match(/rvlt.gg\/[^ \/]*(?<!wiki\.)/))
  ) {
    matches.forEach((match) => {
      //Loki TODO: style
      const matched = match.match(/(?<=rvlt.gg\/).*/);
      const inviteContainer = document.createElement("div");
      const inviteText = document.createElement("span");
      const inviteIcon = document.createElement("img");
      const inviteMemberCount = document.createElement("span");
      const inviteButton = document.createElement("button");

      inviteContainer.classList.add("invite-container");
      inviteText.classList.add("invite-server-name");
      inviteIcon.classList.add("invite-server-icon");
      inviteMemberCount.classList.add("invite-server-members");

      fetchResource(`invites/${matched[0]}`).then((inviteData) => {
        inviteText.textContent = inviteData.server_name;

        if (
          inviteData.server_icon &&
          !settings.behaviour.extremeDataSaver.value
        )
          inviteIcon.src = `${settings.instance.autumn}/icons/${inviteData.server_icon._id}`;
        else inviteIcon.innerText = inviteData.server_name.charAt(0);

        inviteMemberCount.textContent = formatTranslationKey(
          storage.language.messages.invite.memberCountText,
          "members",
          inviteData.member_count
        );

        if (cacheLookup("servers", inviteData.server_id) === 1)
          inviteButton.textContent = storage.language.messages.invite.joinText;
        else
          inviteButton.textContent =
            storage.language.messages.invite.alreadyJoinedText;

        inviteButton.onclick = () => {
          fetch(`${settings.instance.delta}/invites/${matched[0]}`, {
            headers: {
              "x-session-token": state.connection.token,
            },
            method: "POST",
          });
        };

        inviteContainer.appendChild(inviteIcon);
        inviteContainer.appendChild(inviteText);
        inviteContainer.appendChild(inviteMemberCount);
        inviteContainer.appendChild(inviteButton);
        messageContent.appendChild(inviteContainer);
        scrollChatToBottom();
      });
    });
  }
  return messageContent;
}

function parseChannels(messageContent) {
  if (
    (matches = messageContent.innerText.match(
      /<#[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}>/g
    ))
  ) {
    matches.forEach((channelMatch) => {
      const channel = channelMatch.match(
        /[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}/g
      )[0];
      const channelInfo = cacheLookup("channels", channel);

      const channelElement = document.createElement("span");
      channelElement.classList.add("tag");
      channelElement.innerText = "#" + channelInfo.name;
      messageContent.innerHTML = messageContent.innerHTML.replace(
        new RegExp(`&lt;#${channel}&gt;`), //<#{channel}>
        channelElement.outerHTML
      );
    });
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
  messageContent = parseChannels(messageContent);

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
  try {
    let embedContainer = document.createElement("div");
    embedContainer.classList.add("embed");
    if (embed.type === "Text" || embed.type === "Website") {

      let embedSiteName = document.createElement("div");
      embedSiteName.classList.add("embed-site-name");
      embedContainer.appendChild(embedSiteName);

      if (embed.icon_url) {
        let icon = document.createElement("img");

        icon.src = `${settings.instance.january}/proxy?url=${embed.icon_url}`;
        icon.classList.add("embed-icon");

        embedSiteName.appendChild(icon);
      }

      if (embed.site_name) {
        let siteName = document.createElement("span");

        siteName.textContent = embed.site_name;

        embedSiteName.appendChild(siteName);
      }

      if (embed.original_url) {
        let originalURL = document.createElement("a");

        originalURL.classList.add("embed-site-name");
        originalURL.textContent = embed.original_url;
        originalURL.href = embed.original_url;

        embedContainer.appendChild(originalURL);
      }

      if (embed.title) {
        let title = document.createElement("h3");

        title.classList.add("embedTitle");
        title.textContent = embed.title;

        embedContainer.appendChild(title);
      }

      if (embed.description) {
        let description = document.createElement("div");

        description.innerHTML = marked.parse(
          embed.description.replace("<", "&lt;").replace(">", "&gt;")
        );

        embedContainer.appendChild(description);
      }

      //Loki TODO: cap image size
      if (
        embed.image &&
        embed.image.url &&
        !settings.behaviour.dataSaver.value
      ) {
        let media = document.createElement("img");

        media.classList.add("embedMedia");
        media.src = `${settings.instance.january}/proxy?url=${embed.image.url}`;

        embedContainer.appendChild(media);
      }

      if (
        embed.video &&
        embed.video.url &&
        !settings.behaviour.dataSaver.value
      ) {
        // This is done because January doesn't proxy videos, so, to avoid
        // external websites being without the user's consent, we just provide a link
        // to the video
        let media = document.createElement("a");

        media.href = `${settings.instance.january}/proxy?url=${embed.video.url}`;
        media.innerText = "Link to video";

        embedContainer.appendChild(media);
      }

      if (
        embed.media &&
        embed.media._id &&
        !settings.behaviour.dataSaver.value
      ) {
        let media = document.createElement("img");

        media.classList.add("embedMedia");
        media.src = `${settings.instance.autumn}/attachments/${embed.media._id}`;

        embedContainer.appendChild(media);
      }
    } else {
      if (
        embed.type === "Image" &&
        embed.url &&
        !settings.behaviour.dataSaver.value
      ) {
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
  } catch (error) {
    showError(error);
    return document.createElement("div");
  }
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

  replyButton.innerText = storage.language.messages.contextButtons.reply;
  editButton.innerText = storage.language.messages.contextButtons.edit;
  deleteButton.innerText = storage.language.messages.contextButtons.del;

  deleteButton.classList.add("deleteButton");

  messageActions.appendChild(replyButton);
  if (message.author === state.connection.userProfile._id)
    messageActions.appendChild(editButton);
  if (checkPermission(message.channel, "ManageMessages"))
    messageActions.appendChild(deleteButton);

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
    state.messageMods.editing = message._id;
    document.querySelector("#input").value = message.content;
    document.querySelector("#editingTag").hidden = false;
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
        }
      );
    }
  };

  return messageActions;
}

function renderUsername(message, user, member) {
  const masqueradeBadge = document.createElement("span");
  const botBadge = document.createElement("span");
  const profilePicture = document.createElement("img");
  const presenceIcon = document.createElement("img");
  const userData = document.createElement("div");
  const username = document.createElement("button");

  const pleaseNoMoreSuffering = document.createElement("div");
  pleaseNoMoreSuffering.style.position = "relative";

  profilePicture.classList.add("chat-pfp");
  userData.classList.add("userdata");
  username.classList.add("username");
  presenceIcon.classList.add("presence-icon");

  userData.id = `USRNM-${user.id}`;

  if (!message.masquerade) {
    username.textContent = member.nickname ? member.nickname : user.displayName;

    presenceIcon.src = `../assets/images/presence/${
      user.status
        ? user.status.presence
          ? user.status.presence
          : "Offline"
        : "Offline"
    }.svg`;

    if (user.bot !== undefined)
      botBadge.textContent = storage.language.messages.botBadge;

    profilePicture.src = member.avatar
      ? `${settings.instance.autumn}/avatars/${member.avatar._id}`
      : user.pfp;

    if (member.roles) {
      let highestRole;
      let currentRoleRank = 2 ** 64; //64-bit integer limit; no role can be ranked lower than this

      for (let i = 0; i < member.roles.length; i++) {
        let tmpRole = cacheLookup(
          "roles",
          member.roles[i],
          state.active.server
        );
        if (tmpRole.colour && tmpRole.rank < currentRoleRank) {
          //Higher number = lower rank
          highestRole = tmpRole;
          currentRoleRank = tmpRole.rank;
        }
      }

      if (highestRole !== undefined) {
        // Testing if it's a valid hex code
        if (/^#[0-9A-F]{6}$/i.test(highestRole.colour)) {
          username.style.color = highestRole.colour;
        } else {
          //For the funky CSS like role gradients
          username.style.backgroundImage = highestRole.colour;
          username.classList.add("css-username");
        }
      }
    }
  } else {
    masqueradeBadge.textContent = storage.language.messages.masqueradeBadge;
    if (message.masquerade.name) username.textContent = message.masquerade.name;
    else
      username.textContent = member.nickname
        ? member.nickname
        : user.displayName;

    username.appendChild(masqueradeBadge);

    if (message.masquerade.avatar) {
      profilePicture.src = `${settings.instance.january}/proxy?url=${message.masquerade.avatar}`;
    } else {
      profilePicture.src = user.pfp;
      username.style.color = message.masquerade.colour;
    }
  }

  username.onclick = () => {
    loadProfile(user.id);
  };

  profilePicture.onclick = () => {
    loadProfile(user.id);
  };

  userData.appendChild(pleaseNoMoreSuffering);
  pleaseNoMoreSuffering.appendChild(profilePicture);
  userData.appendChild(username);
  userData.appendChild(masqueradeBadge);
  userData.appendChild(botBadge);
  if (settings.visual.showPresenceIconsInChat)
    pleaseNoMoreSuffering.appendChild(presenceIcon);

  return userData;
}

function renderAttachments(message) {
  let attachments = document.createElement("div");
  attachments.classList.add("message-attachments");

  message.attachments.forEach((tmpAttchmntAttrs) => {
    let tmpAttachment;
    //TODO: edit this to only alter what type of element is created, to follow DRY
    if (tmpAttchmntAttrs.content_type.startsWith("image")) {
      tmpAttachment = document.createElement("img");
      tmpAttachment.src = `${settings.instance.autumn}/attachments/${tmpAttchmntAttrs._id}/${tmpAttchmntAttrs.filename}`;
    } else if (tmpAttchmntAttrs.content_type.startsWith("video")) {
      let subAttachment = document.createElement("source");

      tmpAttachment = document.createElement("video");
      //Loki TODO: move to CSS
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
    tmpAttachment.type = tmpAttchmntAttrs.content_type;
    tmpAttachment.height = tmpAttchmntAttrs.metadata.height;
    attachments.appendChild(tmpAttachment);
  });
  return attachments;
}

// Parses and renders messages
// TODO: make this function not be almost 200 lines long
// Loki TODO: Add blocked message styling
// Loki TODO: add some flair for messages sent by friends
/**
 * Description
 * @param {Object} message Message object
 * @returns {HTMLElement} Message element
 */
async function parseMessage(message) {
  const member = cacheLookup("members", message.author, state.active.server);
  const messageContainer = document.getElementById("messagesContainer");

  let messageContent = document.createElement("div");
  const messageDisplay = document.createElement("div");
  const reactionsContainer = document.createElement("div");

  messageDisplay.classList.add("message-display");
  messageContent.classList.add("message-content");
  reactionsContainer.classList.add("reactions-container");

  reactionsContainer.id = `reactionsContainer${message._id}`;

  let user;
  if (message.system) {
    user = await userLookup(
      message.system.id ? message.system.id : message.system.by
    );
  } else {
    user = await userLookup(message.author);
  }

  if (message.system || message.author === "00000000000000000000000000") {
    messageContent.textContent =
      storage.language.messages.system[message.system.type];

    messageContainer.appendChild(renderUsername(message, user, {}));
    messageContainer.appendChild(messageContent);
    return messageDisplay;
  } else {
    if (
      message.mentions &&
      message.mentions.indexOf(state.connection.userProfile._id) !== -1
    )
      messageDisplay.classList.add("selfMentioned");

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
        messageDisplay.appendChild(renderUsername(message, user, member));
      messageDisplay.appendChild(messageContent);

      messageDisplay.id = `MSG-${message._id}`;
      messageDisplay.class = "message";

      messageContent = parseInvites(messageContent);
      if (message.embeds) {
        let embeds = document.createElement("div");
        embeds.classList.add("embedsContainer");
        message.embeds.forEach((embed) => {
          embeds.appendChild(renderEmbed(embed));
        });
        messageDisplay.appendChild(embeds);
      }

      if (message.attachments && !settings.behaviour.dataSaver.value) {
        messageDisplay.appendChild(renderAttachments(message));
      }

      if (message.reactions) {
        renderReactions(
          message.reactions,
          message.channel,
          message._id
        ).forEach((reactionContainer) => {
          reactionsContainer.appendChild(reactionContainer);
        });
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
      messageContent.innerText = storage.language.messages.blockedUser;
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
}

//@license-end
