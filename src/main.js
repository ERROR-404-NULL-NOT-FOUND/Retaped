// Import markdown renderer
var converter = new showdown.Converter();
//
// Variables
//

var cache = {
  //0 is id, 1 is username, 2 is pfp, 3 is bot, 4 is discrim, 5 is display name, 6 is relationshiphip
  users: [],
  //0 is id, 1 is name, 2 is channel type, 3 is server, 4 is last message
  channels: [],
  //0 is id, 1 is name, 2 is server icon id, 3 is roles, 4 is members
  servers: [],
  //0 is id, 1 is author, 2 is content, masquerade
  messages: [],
};

var activeReplies = [];
var emojis = {};
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

//
// Run on page load
//

window.onload = function () {
  if (!localStorage.getItem("token")) return;
  token = localStorage.getItem("token");
  login();
};

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
      }
      else {
        editingMessageID = "";
        document.querySelector("#input").value = ""
      }
      break;

    default:
      keysDown.push(event.key);
  }
  return;
});


document.querySelector("#upload").addEventListener("input", (event) => {
  addFile(document.querySelector("#upload").files[0]);
});

document.querySelector("#input").addEventListener("paste", (event) => {
  let item = event.clipboardData.items[0];
 
  if (item.type.indexOf("image") === 0)
  {
    let blob = item.getAsFile();
    addFile(blob);
  }
});

function addFile (file) {
  if (attachments.length > 5) return;

  const upload = file;
  const uploadsContainer = document.getElementById("uploadsBarContainer");

  let attachmentContainer = document.createElement("div");
  let uploadPreview = document.createElement("img");
  let attachmentText = document.createElement("span");
  
  if (upload.type.startsWith("image")) {
    var fr = new FileReader();
    fr.onload = function () {
      uploadPreview.src = fr.result;
    }
    fr.readAsDataURL(upload);
  };
  
  attachmentContainer.onclick = () => {
    const uploadContainer = document.getElementById(`IMG-${upload.name}`);
    uploadContainer.parentNode.removeChild(uploadContainer);
    attachments.splice(upload, 1);
  }
  
  attachmentContainer.classList.add("attachmentContainer");
  attachmentContainer.id = `IMG-${upload.name}`;
  attachmentText.innerText = upload.name;

  attachmentContainer.appendChild(uploadPreview);
  attachmentContainer.appendChild(attachmentText);

  uploadsContainer.appendChild(attachmentContainer);

  uploadsContainer.hidden = false;

  attachments.push(upload);
}

document.querySelector("#messagesContainer").addEventListener('scroll', async function(e) {
  let documentHeight = document.querySelector("#messagesContainer");
  if (documentHeight.scrollTop === 0) {
    initialHeight = documentHeight.scrollHeight;
    await getNewMessages(activeChannel, document.querySelector("#messagesContainer").firstChild.id.replace("MSG-", ""));
    documentHeight.scrollTo(0, documentHeight.scrollHeight - initialHeight);
  }
});


//
// Utility functions
//

// Looks up the given resource by id from the cache
function cacheLookup(resource, ID, serverID = null) {
  if (resource === "members" || resource === "roles") {
    for (let i = 0; i < cache.servers.length; i++) {
      if (cache.servers[i].id === serverID) {
        const index = resource === "members" ? "members" : "roles";

        if (resource === "members") {
          for (let j = 0; j < cache.servers[i][index].length; j++) {
            if (cache.servers[i][index][j]._id.user === ID)
              return cache.servers[i][index][j];
          }
        } else {
          for (const role in cache.servers[i][index]) {
            if (role === ID) return cache.servers[i][index][role];
          }
        }
      }
    }
    return 1;
  }

  for (let i = 0; i < cache[resource].length; i++) {
    if (cache[resource][i].id === ID) return cache[resource][i];
  }

  return 1;
}

function checkPermission(channelID, permission) {
  const channel = cacheLookup("channels", channelID);

  if (channel.defaultPermissions && channel.defaultPermissions["Denied"][permission]) {
    if (roles = cacheLookup("members", userProfile._id, channel.server).roles){
    roles.forEach(role => {
      if (channel.rolePermissions[role]["Allowed"][permission]) return true;
    });
      return false;
    }
  } else {
    return true;
  }
}

// Basically the same as the function above, but fetches the user and adds it to the cache if it isn't found
async function userLookup(ID) {
  if (cacheLookup("users", ID) !== 1) return cacheLookup("users", ID);
  user = await fetchResource(`users/${ID}`);

  let fmtUser;
  fmtUser = {
    id: user._id,
    username: user.username,
    pfp: user.avatar,
    bot: user.bot,
    discriminator: user.discriminator,
    displayName: user.display_name ? user.display_name : user.username,
    relationSHip: user.relationship,
  };
  cache.users.push(fmtUser);
  return fmtUser;
}

// Looks up the given resource by id and returns the index
function cacheIndexLookup(resource, ID) {
  for (let i = 0; i < cache[resource].length; i++) {
    if (cache[resource][i].id === ID) return i;
  }
  return -1;
}

// Macro to fetch remote resources
async function fetchResource(target) {
  //Return of false means that it failed
  const res = await fetch(`https://api.revolt.chat/${target}`, {
    headers: {
      "x-session-token": token,
    },
    method: "GET",
  })
    .then((res) => res.json())
    .catch((error) => {
      console.error(error);
      return false;
    });
  return res;
}

async function updateUnreads(channelID, messageID) {
  for (let i = 0; i < unreads.length; i++) {
    if (unreads[i]._id.channel === channelID) {
      unreads[i].last_id = messageID;
      return 0;
    }
  }
  return 1;
}

//
// Main stuff
//

// Loads settings from the user's Revolt account, mainly for colour loading
async function loadSyncSettings() {
  const rawSettings = await fetch(
    "https://api.revolt.chat/sync/settings/fetch",
    {
      headers: {
        "x-session-token": token,
      },
      body: JSON.stringify({
        keys: ["theme", "notifications", "ordering"],
      }),
      method: "POST",
    },
  ).then((response) => response.json());

  fetch("https://api.revolt.chat/sync/unreads", {
    headers: {
      "x-session-token": token,
    },
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      unreads = data;
    });

  let theme = JSON.parse(rawSettings.theme[1])["appearance:theme:overrides"];
  let notifications = JSON.parse(rawSettings.notifications[1]);

  ordering = JSON.parse(rawSettings.ordering[1]).servers;

  Object.keys(notifications.channel).forEach((channel) => {
    if (notifications.channel[channel] === "muted") mutedChannels.push(channel);
  });

  Object.keys(notifications.server).forEach((server) => {
    if (notifications.server[server] === "muted") mutedServers.push(server);
  });

  if (toggleTheme.checked == true) {
    let themeVars = document.querySelector(":root");
    themeVars.style.setProperty("--accent", theme.accent);
    themeVars.style.setProperty("--error", theme.error);
    themeVars.style.setProperty("--servers-bg", theme.background);
    themeVars.style.setProperty("--channels-bg", theme["secondary-background"]);
    themeVars.style.setProperty("--secondary-background", theme["message-box"]);
    themeVars.style.setProperty("--tertiary-background", theme["tertiary-background"]);
    themeVars.style.setProperty("--tertiary-foreground", theme["tertiary-foreground"]);
    themeVars.style.setProperty("--background", theme["primary-background"]);
    themeVars.style.setProperty("--foreground", theme["foreground"]);
    themeVars.style.setProperty("--secondary-foreground", theme["secondary-foreground"]);
    themeVars.style.setProperty("--hover", theme.hover);
    themeVars.style.setProperty("--mention", theme.mention);

    document.querySelector("#themeLabel").textContent = "Revolt theme";
  }
}

async function uploadToAutumn() {
  for (let i=0; i < attachments.length; i++){
    const formData = new FormData();
    formData.append('myFile', attachments[i]);

    await fetch('https://autumn.revolt.chat/attachments', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {attachmentIDs.push(data.id)});
  }
}

// Function to interface with Revolt's websocket service
async function bonfire() {
  socket = new WebSocket("wss://ws.revolt.chat");

  socket.addEventListener("open", async function (event) {
    socket.send(`{"type": "Authenticate","token": "${token}"}`);
  });

  socket.addEventListener("message", async function (event) {
    let data;
    const typingBar = document.getElementById("typingBar");
    data = JSON.parse(event.data);

    switch (data.type) {
      // User provided correct credentials
      case "Authenticated":
        document.getElementById("status").innerText = "Connected";
        break;

      // Used for message unreads and adding new messages to the messagebox
      case "Message":
        updateUnreads(data.id, data.message_id);
        if (data.channel === activeChannel) {
          document.querySelector("#messagesContainer").appendChild(await parseMessage(data));
          if (document.hasFocus) {
            fetch(
              `https://api.revolt.chat/channels/${activeChannel}/ack/${data._id}`,
              {
                headers: {
                  "x-session-token": token,
                },
                method: "PUT",
              },
            );
          }
        } else {
          if (
            (channel = document.getElementById(data.channel)) &&
            mutedChannels.indexOf(data.channel) === -1
          ) {
            channel.classList.add(
              data.mentions && data.mentions.indexOf(userProfile._id) !== -1
                ? "mentionedChannel"
                : "unreadChannel",
            );
          }

          if (
            mutedChannels.indexOf(data.channel) === -1 &&
            mutedServers.indexOf(
              cacheLookup("channels", data.channel).server,
            ) === -1
          ) {
            document.getElementById(`SERVER-${cacheLookup("channels", data.channel).server}`)
              .classList.add(
                (data.mentions && data.mentions.indexOf(userProfile._id) !== -1)
                  ? "mentionedServer"
                  : "unreadServer",
              );
          }
        }
        break;

      case "MessageDelete":
        if (data.channel_id === activeChannel) {
          document
            .querySelector("#messagesContainer")
            .removeChild(document.getElementById(data.id));
        }
        break;

      case "MessageUpdate":
        if (data.channel === activeChannel) {
          messageDisplay = document.querySelector(`#MSG-${data.id}`)
          messageContent = messageDisplay.querySelector(".messageContent")
          messageContent.innerHTML = parseMessageContent(data.data).innerHTML;
        }

      // Channel has been acknowledge as read
      case "ChannelAck":
        updateUnreads(data.id, data.message_id);

        if ((channel = document.getElementById(data.id))) {
          channel.classList.remove("unreadChannel");
          channel.classList.remove("mentionedChannel");
        }

        let stillUnread = false;
        for (const channel in cacheLookup(
          "servers",
          cacheLookup("channels", data.id).server,
        ).channels) {
          if (unreadChannels.indexOf(channel) !== -1) {
            stillUnread = true;
            break;
          }
        }
        if (!stillUnread) {
          let server = document.getElementById(`SERVER-${cacheLookup("channels", data.id).server}`)
            server.classList.remove("unreadServer")
            server.classList.remove("mentionedServer");
        }
        break;

      // Uh oh
      case "Error":
        document.querySelector("#errorContainer").style.display = "block";
        document.querySelector("#errorContent").textContent = data.error;
        break;

      // Cache building, received immediately after 'Authenticated'
      case "Ready":
        buildServerCache(data.servers);
        buildChannelCache(data.channels);
        buildUserCache(data.users);
        getServers();
        break;

      // User begins typing
      // TODO: add timeout
      case "ChannelStartTyping": {
        if (
          data.id !== activeChannel ||
          currentlyTyping.indexOf(data.user) !== -1 ||
          document.getElementById(data.user) === null
        )
          break;

        const typingMember = cacheLookup("members", data.user, activeServer);
        const typingUser = await userLookup(data.user);
        const typingUserContainer = document.createElement("div");
        const typingUserName = document.createElement("span");
        const typingUserPfp = document.createElement("img");

        typingUserPfp.src =
          typingMember.pfp === undefined
            ? `https://autumn.revolt.chat/avatars/${typingUser.pfp._id}?max_side=25`
            : `https://autumn.revolt.chat/avatars/${typingMember.pfp._id}?max_side=25`;
        typingUserContainer.appendChild(typingUserPfp);

        typingUserName.textContent = typingUser.displayName;
        typingUserContainer.appendChild(typingUserName);

        typingUserContainer.id = typingUser.id;

        currentlyTyping.push(data.user);
        typingBar.appendChild(typingUserContainer);
        document.getElementById("typingBarContainer").style.display = "flex";
        scrollChatToBottom();
        break;
      }

      // User stops typing
      case "ChannelStopTyping": {
        if (data.id !== activeChannel) break;

        const typingUserContainer = document.getElementById(data.user);
        if (typingUserContainer) {
          typingUserContainer.remove();
          currentlyTyping.splice(currentlyTyping.indexOf(data.user), 1);
        }

        if (typingBar.children.length === 0)
          document.getElementById("typingBarContainer").style.display = "none";
      }

      case "MessageReact": {
        let reactionsContainer = document.getElementById(`reactionsContainer${data.id}`);
        if (reactionContainer = undefined) return;
        let message = cacheLookup("messages", data.id);
        if (message.reactions && Object.keys(message.reactions).indexOf(data.emoji_id) === -1) {
          reactionsContainer.appendChild(
            renderReactions(
              { [data.emoji_id]: [data.user_id] },
              data.channel_id,
              data.id,
            )[0],
          );
        } else {
          let reactionContainer = reactionsContainer.querySelector(
            `#REACTION-${data.emoji_id}`,
          );
          reactionContainer.querySelector(".reactionCount").innerText =
            Number(
              reactionsContainer.querySelector(".reactionCount").innerText,
            ) + 1;
        }
        if (message.reactions && message.reactions[data.emoji_id])
          message.reactions[data.emoji_id].push(data.user_id);
        else if (message.reactions)
          message.reactions[data.emoji_id] = [data.user_id];

        break;
      }

      case "MessageUnreact": {
        let reactionsContainer = document.getElementById(
          `reactionsContainer${data.id}`,
        );
        let message = cacheLookup("messages", data.id);
        message.reactions[data.emoji_id].splice(
          message.reactions[data.emoji_id].indexOf(data.user_id),
          1,
        );
        let reactionContainer = reactionsContainer.querySelector(
          `#REACTION-${data.emoji_id}`,
        );
        if (!Object.keys(message.reactions).indexOf(data.emoji_id)) {
          message.reactions[data.emoji_id] = undefined;
          reactionsContainer.removeChild(reactionContainer);
        } else {
          reactionContainer.querySelector(".reactionCount").innerText =
            Number(
              reactionsContainer.querySelector(".reactionCount").innerText,
            ) - 1;
        }
        break;
      }
    }
  });

  socket.addEventListener("error", async function (event) {
    document.getElementById("error");
  });
}

// Handles login and init
// TODO: replace all of the fucking if statements
async function login() {
  let toggleToken = document.querySelector("#toggleToken");

  if (document.getElementById("token").value || token) {
    if (!token) token = document.getElementById("token").value;
  } else if (
    document.getElementById("email").value != "" &&
    document.getElementById("password").value != ""
  ) {
    let tokenResponse = await fetch(
      "https://api.revolt.chat/auth/session/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
          friendly_name: "Retaped",
        }),
      },
    )
      .then((res) => res.json())
      .then((data) => data);

    if (tokenResponse.result === "Success") {
      token = tokenResponse.token;
    } else {
      if (tokenResponse.result === "Unauthorized") {
        localStorage.removeItem("token");
        console.error("Invalid token!");
      } else {
        let mfaTokenResponse = await fetch(
          "https://api.revolt.chat/auth/session/login",
          {
            method: "POST",
            body: JSON.stringify({
              mfa_ticket: tokenResponse.ticket,
              mfa_response: {
                totp_code: document.querySelector("#mfa").value,
              },
              friendly_name: "Retaped",
            }),
          },
        )
          .then((res) => res.json())
          .then((data) => data);
        if (mfaTokenResponse.result === "Success") {
          token = mfaTokenResponse.token;
        } else {
          console.error(
            "You've scuffed your MFA key, for some reason the server returned: " +
              JSON.stringify(mfaTokenResponse),
          );
        }
      }
    }
  } else {
    console.error(
      "No login method provided, how the fuck do you expect to log in?",
    );
    return;
  }

  if ((userProfile = await fetchResource("users/@me")) === false) {
    console.error("Login failed");
    return;
  }

  if (toggleToken.checked == true) {
    if (!localStorage.getItem("token")) localStorage.setItem("token", token);
  }

  loadSyncSettings();
  bonfire();
  fetch("./emojis.json")
    .then((res) => res.json())
    .then((json) => (emojis = json));

  document.querySelector(".login-screen").style.display = "none";
  document.getElementById("app").style.display = "grid";
}

//
// Rendering
//

// Renders servers from the cache
async function getServers() {
  let serverContainer = document.getElementById("serversContainer");
  serverContainer.replaceChildren();

  unreads.forEach((unread) => {
    if (
      unread.last_id <
        cacheLookup("channels", unread._id.channel).lastMessage &&
      mutedChannels.indexOf(unread._id.channel) === -1
    ) {
      unreadMessages.push(unread.last_id);
      unreadChannels.push(unread._id.channel);
      if (unread.mentions)
        unreadMentions.push(unread._id.channel);
    }
  });

  for (let i = 0; i < ordering.length; i++) {
    let server = document.createElement("button");
    let serverIndex = cacheIndexLookup("servers", ordering[i]);

    server.onclick = () => {
      activeServer = cache.servers[serverIndex].id;
      getChannels(cache.servers[serverIndex].id);
      clearMessages();
      activeChannel = "";

      document.getElementById("serverName").innerText =
        cache.servers[serverIndex].name;
      document.getElementById("channelName").innerText = "";
    };

    if (cache.servers[serverIndex].channels) {
      cache.servers[serverIndex].channels.forEach((channel) => {
        if (unreadChannels.indexOf(channel) !== -1) {
          server.classList.add(
            unreadMentions.indexOf(channel) !== -1
              ? "mentionServer"
              : "unreadServer",
          );
        }
      });
    }

    if (mutedServers.indexOf(cache.servers[serverIndex].id) !== -1) {
      server.classList.remove("mentionServer");
      server.classList.remove("unreadServer");
    }

    server.classList.add("server");

    server.id = `SERVER-${cache.servers[serverIndex].id}`;

    if (cache.servers[serverIndex].icon === null) {
      server.innerText = cache.servers[serverIndex].name.charAt(0);
    } else {
      let serverIcon = document.createElement("img");

      serverIcon.classList.add("serverIcon");
      serverIcon.src = `https://autumn.revolt.chat/icons/${cache.servers[serverIndex].icon}?max_side=64`;
      server.appendChild(serverIcon);
    }

    serverContainer.appendChild(server);
  }
}

// Renders channels from the cache
async function getChannels(id) {
  let channelContainer = document.getElementById("channelsContainer");
  const server = cacheLookup("servers", activeServer);
  channelContainer.replaceChildren();

  let addedChannels = [];
  if (server.categories) {
    server.categories.forEach((category) => {
      let categoryContainer = document.createElement("details");
      let categoryText = document.createElement("summary");

      categoryContainer.open = true;
      categoryContainer.classList.add("channel-category");

      categoryText.textContent = category.title;
      categoryText.classList.add("categoryText");
      categoryContainer.appendChild(categoryText);

      if (category.channels) {
        for (let j = 0; j < category.channels.length; j++) {
          const currentChannel = cacheLookup("channels", category.channels[j]);
          let channel = document.createElement("button");
          let channelText = document.createElement("span");
          if (currentChannel.type !== "TextChannel")
            continue;

          addedChannels.push(currentChannel.id);

          channel.classList.add("channel");

          channel.onclick = () => {
            getMessages(currentChannel.id);
            document.getElementById("channelName").innerText =
              currentChannel.name;
          };

          channel.id = currentChannel.id;
          channelText.innerText = currentChannel.name;

          if (unreadChannels.indexOf(currentChannel.id) !== -1 && mutedChannels.indexOf(currentChannel.id) === -1) {
             if (unreadMentions.indexOf(currentChannel.id) !== -1) channel.classList.add("mentionedChannel");
             else channel.classList.add("unreadChannel");
          }

          channel.appendChild(channelText);

          if (mutedChannels.indexOf(currentChannel.id) !== -1)
            channel.classList.add("mutedChannel");
          categoryContainer.appendChild(channel);
        }
      }

      channelContainer.appendChild(categoryContainer);
    });
  }

  let defaultCategory = document.createElement("details");
  let defaultCategoryText = document.createElement("summary");

  defaultCategory.open = true;
  defaultCategory.classList.add("channel-category");
  defaultCategoryText.textContent = "Uncategorised";
  defaultCategoryText.classList.add("categoryText");
  defaultCategory.appendChild(defaultCategoryText);

  for (let i = 0; i < cache.channels.length; i++) {
    if (
      cache.channels[i].server !== id ||
      cache.channels[i].type !== "TextChannel" ||
      addedChannels.indexOf(cache.channels[i].id) !== -1
    )
      continue;

    const currentChannel = cache.channels[i];

    addedChannels.push(currentChannel.id);

    let channel = document.createElement("button");
    channel.classList.add("channel");

    for (let i = 0; i < unreads.length; i++) {
      if (unreads[i]["_id"].channel === currentChannel.id) {
        //currentChannel[0] is the ID of the channel currently being returned
        if (
          mutedChannels.indexOf(currentChannel.id) === -1 &&
          currentChannel.lastMessage > unreads[i].lastMessage
        )
          channel.style.fontWeight = "bold";

        break;
      }
    }

    let channelText = document.createElement("span");
    channelText.id = currentChannel.id;
    channelText.innerText = currentChannel.name;

    channel.appendChild(channelText);
    defaultCategory.appendChild(channel);
  }

  channelContainer.insertBefore(defaultCategory, channelContainer.children[0]);
}

function clearMessages() {
  document.getElementById("messagesContainer").replaceChildren();
}

function renderReactions(reactions, channelID, messageID) {
  let children = [];
  Object.keys(reactions).forEach((reaction) => {
    let reactionContainer = document.createElement("button");
    let customEmoteImage;
    if (Object.values(emojis.standard).indexOf(reaction) === -1) customEmoteImage = document.createElement("img");
    else {
      customEmoteImage = document.createElement("span");
      customEmoteImage.innerText = reaction;
    }
    let reactionIndicator = document.createElement("span");

    reactionContainer.onclick = () => {
      if (
        cacheLookup("messages", messageID).reactions[reaction].indexOf(
          userProfile._id,
        ) === -1
      ) {
        fetch(
          `https://api.revolt.chat/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "PUT", headers: { "x-session-token": token } },
        );
      } else {
        fetch(
          `https://api.revolt.chat/channels/${channelID}/messages/${messageID}/reactions/${reaction}`,
          { method: "DELETE", headers: { "x-session-token": token } },
        );
      }
    };
    if (Object.values(emojis.standard).indexOf(reaction) === -1)
      customEmoteImage.src = `https://autumn.revolt.chat/emojis/${reaction}`;
    reactionIndicator.innerText = reactions[reaction].length;
    reactionIndicator.classList.add("reactionCount");
    if (reactions[reaction].indexOf(userProfile._id) !== -1)
      reactionContainer.classList.add("selfReacted");

    reactionContainer.id = `REACTION-${reaction}`;
    reactionContainer.appendChild(customEmoteImage);
    reactionContainer.appendChild(reactionIndicator);
    children.push(reactionContainer);
  });
  return children;
}

function parseMessageContent(message) {
  let messageContent = document.createElement("div");

  messageContent.classList.add("messageContent");

  let sanitizedContent = message.content.replace(/</g, "&lt;");
  sanitizedContent = sanitizedContent.replace(/>/g, "&gt;");
    messageContent.innerHTML = sanitizedContent;


    //Mention parser
    if (message.mentions) {
      message.mentions.forEach((mention) => {
        if (messageContent.innerHTML.split(`<@${mention}>`).length === 1)
          return;

        let segConcat = document.createElement("div");
        let newSeg;

        messageContent.innerHTML.split(`<@${mention}>`).forEach((segment) => {
          newSeg = document.createElement("span");
          newSeg.innerHTML = segment;
          segConcat.appendChild(newSeg);
        });

        let ping = document.createElement("div");
        let pingContainer = document.createElement("div");
        let mentionPfp = document.createElement("img");
        let mentionText = document.createElement("span");
        let tmpUserProfile = cacheLookup("users", mention);

        mentionPfp.classList.add("mentionPfp");
        mentionText.classList.add("mentionText");
        ping.classList.add("tag");

        ping.appendChild(mentionPfp);
        mentionText.textContent = cacheLookup("users", mention).displayName;

        mentionPfp.src = tmpUserProfile.pfp
          ? `https://autumn.revolt.chat/avatars/${tmpUserProfile.pfp._id}?max_side=256`
          : `https://api.revolt.chat/users/${mention}/default_avatar?max_side=256`;
        mentionText.textContent = cacheLookup("users", mention).displayName;

        ping.appendChild(mentionPfp);
        ping.appendChild(mentionText);
        pingContainer.appendChild(ping);
        segConcat.insertBefore(pingContainer, newSeg);
        messageContent = segConcat;

        //CSS TODO: Make this show a pointer on hover
        ping.onclick = () => {
          loadProfile(mention);
        };

        if (mention === userProfile._id) {
          messageContent.classList.add("selfMentioned");
        }
      });
    }

    // Emojis
    Object.keys(emojis.standard).forEach((emoji) => {
      if (messageContent.innerHTML.search(`:${emoji}:`) !== -1) {
        messageContent.innerHTML = messageContent.innerHTML.replace(
          new RegExp(`:${emoji}:`, 'g'),
          emojis.standard[emoji],
        );
      }
    });

    Object.keys(emojis.custom).forEach((emoji) => {
      if (messageContent.innerHTML.search(`:${emoji}`) === -1) return;

      let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
      let emojiImage = document.createElement("img");

      emojiImage.src = `https://dl.insrt.uk/projects/revolt/emotes/${emojis.custom[emoji]}`;
      messageContent.replaceChildren();

      for (let i = 0; i < tmpMsg.length; i++) {
        if (i !== tmpMsg.length - 1)
          messageContent.innerHTML += tmpMsg[i] + emojiImage.outerHTML;
        else messageContent.innerHTML += tmpMsg[i];
      }
    });
    
    //Disabled due to being a pain in the ass

    if (messageContent.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g) !== null) {
      let matches = messageContent.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g);

      for (let i = 0; i < matches.length; i++) {
        let emoji = matches[i].split(":")[1];
        let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
        let tmpImg = document.createElement("img");
        tmpImg.classList.add("emoji");
        let outputToGetAroundStupidDomManipulationShit = "";

        tmpImg.src = `https://autumn.revolt.chat/emojis/${emoji}`;

        for (let j = 1; j < tmpMsg.length; j++) {
          outputToGetAroundStupidDomManipulationShit += tmpMsg[j];
        }
        messageContent.innerHTML = `${tmpMsg[0]}${tmpImg.outerHTML}${outputToGetAroundStupidDomManipulationShit}`;
      }
    }
    messageContent.innerHTML = converter.makeHtml(messageContent.innerHTML).replace(/\n/g, "<br>");

    return messageContent;
}

// Parses and renders messages
// TODO: make this function not be almost 200 lines long
// Loki TODO: Add blocked message styling
// Loki TODO: add some flair for messages sent by friends
async function parseMessage(message) {
  const member = cacheLookup("members", message.author, activeServer);
  const messageContainer = document.getElementById("messagesContainer");

  let messageActions = document.createElement("div");
  let messageContent = document.createElement("div");
  let userData = document.createElement("div");
  let username = document.createElement("button");
  let profilePicture = document.createElement("img");
  let replyButton = document.createElement("button");
  let editButton = document.createElement("button");
  let deleteButton = document.createElement("button")
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
      ? `https://autumn.revolt.chat/avatars/${user.pfp._id}?max_side=256`
      : `https://api.revolt.chat/users/${user.id}/default_avatar`;

    switch (message.system.type) {
      case "user_added":
        messageDisplay.textContent = `User ${
          (await userLookup(message.system.by))
            ? await userLookup(message.system)
            : message.system.by
        }`;
    }

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
    return;
  } else {
    if (!message.masquerade) {
      username.textContent = member.nickname
        ? member.nickname
        : user.displayName;
      if (user.bot !== undefined) masqueradeBadge.textContent = "Bot";

      username.appendChild(masqueradeBadge);
      profilePicture.src = member.avatar
        ? `https://autumn.revolt.chat/avatars/${member.avatar._id}`
        : user.pfp
        ? `https://autumn.revolt.chat/avatars/${user.pfp._id}?max_side=256`
        : `https://api.revolt.chat/users/${user.id}/default_avatar`;

      if (member.roles) {
        for (let i = member.roles.length + 1; i >= 0; i--) {
          let tmpColour;
          if (
            (tmpColour = cacheLookup("roles", member.roles[i], activeServer)[
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
        profilePicture.src = `https://jan.revolt.chat/proxy?url=${message.masquerade.avatar}`;
      } else {
        profilePicture.src = user.pfp
          ? `https://autumn.revolt.chat/avatars/${user.pfp._id}?max_side=256`
          : `https://api.revolt.chat/users/${user.pfp._id}/default_avatar`;
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

    if (message.attachments) {
      let attachments = document.createElement("div");
      attachments.classList.add("message-attachments");

      message.attachments.forEach((tmpAtchmntAttrs) => {
        let tmpAttachment;

        if (tmpAtchmntAttrs.content_type.startsWith("image")) {
          tmpAttachment = document.createElement("img");
          tmpAttachment.src = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
        } else if (tmpAtchmntAttrs.content_type.startsWith("video")) {
          let subAttachment = document.createElement("source");

          tmpAttachment = document.createElement("video");
          tmpAttachment.controls = true;
          tmpAttachment.style.maxWidth = "30%";
          tmpAttachment.style.maxHeight = "30%";

          subAttachment.src = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
          subAttachment.type = tmpAtchmntAttrs.content_type;
          tmpAttachment.appendChild(subAttachment);
        } else if (tmpAtchmntAttrs.content_type.startsWith("audio")) {
          let tmpContainer = document.createElement("audio");
          let subAttachment = document.createElement("source");
          let name = document.createElement("span");

          tmpAttachment = document.createElement("div");
          tmpContainer.controls = true;
          tmpContainer.textContent = tmpAtchmntAttrs.filename;

          subAttachment.src = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
          subAttachment.type = tmpAtchmntAttrs.content_type;

          tmpContainer.appendChild(subAttachment);
          name.textContent = tmpAtchmntAttrs.filename + "\n";

          tmpAttachment.appendChild(name);
          tmpAttachment.appendChild(tmpContainer);
        } else {
          tmpAttachment = document.createElement("a");
          tmpAttachment.textContent = tmpAtchmntAttrs.filename;
          tmpAttachment.href = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
        }
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

  replyButton.innerText = "Reply";
  editButton.innerText = "Edit";

  messageActions.appendChild(replyButton);
  if (message.author === userProfile._id) messageActions.appendChild(editButton);

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

//
// Cache building
//

function getPermissions(permissionsInt) {
  if (!permissionsInt) return null;
  let permissionsAllowedBit = permissionsInt["a"].toString(2); 
  let permissionsDeniedBit = permissionsInt["d"].toString(2); 
  let permissionsAllowed = {
    ViewChannel: permissionsAllowedBit[20],
    ReadMessageHistory: permissionsAllowedBit[21],
    SendMessage: permissionsAllowedBit[22],
    ManageMessages: permissionsAllowedBit[23],
    SendEmbeds: permissionsAllowedBit[26],
    UploadFiles: permissionsAllowedBit[27],
    Masquerade: permissionsAllowedBit[28],
    React: permissionsAllowedBit[29],
  };
  let permissionsDenied = {
    ViewChannel: permissionsDeniedBit[20],
    ReadMessageHistory: permissionsDeniedBit[21],
    SendMessage: permissionsDeniedBit[22],
    ManageMessages: permissionsDeniedBit[23],
    SendEmbeds: permissionsDeniedBit[26],
    UploadFiles: permissionsDeniedBit[27],
    Masquerade: permissionsDeniedBit[28],
    React: permissionsDeniedBit[29],
  }
  return {Allowed: permissionsAllowed, Denied: permissionsDenied};
}

function getRolePermissions(roleObjects) {
  if (!roleObjects) return null
  let permissions = {};
  Object.keys(roleObjects).forEach((role) => {
    permissions[role] = getPermissions(roleObjects[role]);
  });
  return permissions;
}

async function buildChannelCache(channels) {
  for (let i = 0; i < channels.length; i++) {
    switch (channels[i].channel_type) {
      case "TextChannel":
        cache.channels.push({
          id: channels[i]._id,
          name: channels[i].name,
          type: channels[i].channel_type,
          server: channels[i].server,
          lastMessage: channels[i].last_message_id,
          defaultPermissions: getPermissions(channels[i].default_permissions),
          rolePermissions: getRolePermissions(channels[i].role_permissions),
        });
        break;

      case "Group":
        cache.channels.push({
          id: channels[i]._id,
          name: channels[i].name,
          type: channels[i].channel_type,
        });
        break;

      case "DirectMessage":
        cache.channels.push({
          id: channels[i]._id,
          recipients: channels[i].recipients,
          type: channels[i].channel_type,
        });
    }
  }

  for (const server in cache.servers) {
    if (!cache.servers[server].categories) continue;

    cache.servers[server].categories.forEach((category) => {
      let tmpCategory = [];

      category.channels.forEach((channel) => {
        let anthTmpChannel;
        for (const tmpChannel in channels) {
          if (channels[tmpChannel].id === channel) {
            anthTmpChannel = tmpChannel;
            break;
          }
        }

        tmpCategory.push(channels[anthTmpChannel]);
      });

      cache.servers[server].categories.push({ [category]: tmpCategory });
    });
  }
}

async function buildUserCache(users) {
  for (let i = 0; i < users.length; i++) {
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
    });
  }
}

async function buildServerCache(servers) {
  for (let i = 0; i < servers.length; i++) {
    cache.servers.push({
      id: servers[i]["_id"],
      name: servers[i]["name"],
      icon: servers[i].icon ? servers[i].icon._id : null,
      roles: servers[i].roles,
      members: [],
      categories: servers[i].categories,
      channels: servers[i].channels,
    });
  }
  getServers();
}

//
// Wildcard category
//
async function getNewMessages(id, startingMessage = undefined) {
  let messagesContainer = document.querySelector("#messagesContainer");
  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&${startingMessage ? `sort=latest&before=${startingMessage}`: "sort=latest"}`,
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

  let messages
  if(startingMessage) messages = placeholder.messages.reverse();
  else messages = placeholder.messages;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (startingMessage) messagesContainer.insertBefore(await parseMessage(messages[i]), messagesContainer.firstChild);
    else messagesContainer.appendChild(await parseMessage(messages[i]));

    if (unreadMessages.indexOf(messages[i]._id) !== -1) {
      let unreadMarkerContainer = document.createElement("div");
      let unreadMarkerText = document.createElement("span");

      unreadMarkerText.innerText = "NEW";
      unreadMarkerContainer.classList.add("unreadMarkerContainer");

      unreadMarkerContainer.appendChild(unreadMarkerText);
      document.querySelector("#messagesContainer").appendChild(unreadMarkerContainer);
    }
  }

  return placeholder.messages;

}

async function getMessages(id) {
  cache.messages = [];
  activeReplies = [];
  activeChannel = id;
  const channel = cacheLookup("channels", id);
  const input = document.querySelector("#input");

  input.value = "";
  input.readOnly= false;

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
  if (!checkPermission(id, "SendMessage", "Denied")) {
    input.value = "You don't have permission to send messages in this channel";
    input.readOnly = true;
  } 

  clearMessages();
  let messages = await getNewMessages(id);
  scrollChatToBottom();

  fetch(
    `https://api.revolt.chat/channels/${activeChannel}/ack/${messages[0]._id}`,
    {
      headers: {
        "x-session-token": token,
      },
        method: "PUT",
      },
    );

  }

async function loadDMs() {
  let channelContainer = document.getElementById("channelsContainer");
  let userCat = document.createElement("summary");
  userCat.classList.add("categoryText");

  channelContainer.replaceChildren();
  clearMessages();

  await fetchResource(`users/${userProfile._id}/dm`).then((response) => {
    const dmButton = document.createElement("button");

    dmButton.textContent = "Saved messages";
    dmButton.classList.add("channel");
    dmButton.onclick = () => {
      getMessages(response._id);
    };

    dmButton.id = response._id;
    userCat.appendChild(dmButton);
  });

  for (let i = 0; i < cache.channels.length; i++) {
    //Checking for only DMs
    if (!["DirectMessage", "Group"].includes(cache.channels[i].type)) continue;

    const dmButton = document.createElement("button");
    dmButton.classList.add("channel");

    if (cache.channels[i].type === "Group") {
      dmButton.textContent = cache.channels[i].name;
    } else {
      let user;

      if (cache.channels[i].recipients[1] !== userProfile._id) {
        user = await userLookup(cache.channels[i].recipients[1]);
      } else {
        user = await userLookup(cache.channels[i].recipients[0]);
      }

      dmButton.textContent = `@${user.username}#${user.discriminator}`;
    }

    dmButton.onclick = () => {
      getMessages(cache.channels[i].id);
      document.getElementById("channelName").innerText = dmButton.textContent;
    };

    dmButton.id = cache.channels[i].id;
    userCat.appendChild(dmButton);
  }
  channelContainer.appendChild(userCat);
}

//
// Profiles
//

async function loadProfile(userID) {
  const tmpUserProfile = await fetchResource(`users/${userID}/profile`);
  const memberData = cacheLookup("members", userID, activeServer);
  const user = await userLookup(userID);

  let displayName = document.getElementById("displayName");
  let username = document.getElementById("username");
  let profilePicture = document.getElementById("profilePicture");
  let profileBackground = document.getElementById("profileMedia");
  let bio = document.getElementById("bio");
  let roleContainer = document.getElementById("roleContainer");

  username.textContent = `${user.username}#${user.discriminator}`;
  displayName.textContent = user.displayName;

  if (user.pfp) {
    profilePicture.src = `https://autumn.revolt.chat/avatars/${user.pfp._id}`;
  } else {
    profilePicture.src = `https://api.revolt.chat/users/${user.pfp._id}/default_avatar`;
  }

  if (Object.keys(tmpUserProfile).indexOf("background") > -1) {
    profileBackground.style.background = `linear-gradient(0deg, rgba(0,0,0,0.84) 10%, rgba(0,0,0,0) 100%),
        url(https://autumn.revolt.chat/backgrounds/${tmpUserProfile.background._id}) center center / cover`;
  } else profileBackground.style.background = "";

  bio.innerHTML = parseMessageContent(tmpUserProfile).innerHTML;
  roleContainer.replaceChildren();

  if (memberData.roles)
    for (let i = 0; i < memberData.roles.length; i++) {
      const role = document.createElement("span");
      const roleData = cacheLookup("roles", memberData.roles[i], activeServer);

      role.classList.add("tag");
      role.textContent = roleData["name"];
      role.style.color = roleData["colour"];
      roleContainer.appendChild(role);
    }

  document.getElementById("userProfile").style.display = "flex";
}

//
// Message Sending
//

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

  await fetch((editingMessageID === "") ? `https://api.revolt.chat/channels/${activeChannel}/messages` : `https://api.revolt.chat/channels/${activeChannel}/messages/${editingMessageID}`, {
    headers: {
      "x-session-token": token,
    },
    method: (editingMessageID === "") ? "POST" : "PATCH",
    body: body,
  })
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
        `https://api.revolt.chat/channels/${activeChannel}/ack/${data._id}`,
        { method: "PUT", headers: { "x-session-token": token } },
      );
    });

  messageContainer.value = "";
  activeReplies = [];
  attachments = [];
  attachmentIDs = [];

  document.querySelector("#uploadsBarContainer").replaceChildren();
  document.querySelector("#uploadsBarContainer").hidden=true;
  document.querySelector(".replying-container").replaceChildren();
  scrollChatToBottom();
}

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

//
// Settings
//

function openSettings() {
  document.querySelector("#settings").style.display = "flex";
}

function closeSettings() {
  document.querySelector("#settings").style.display = "none";
}

function loadSetting(setting) {
  switch (setting) {
    case "behaviour":
      let mainSettings = document.querySelector("mainSettings");
      document.querySelector("#settingCatName").innerText = "Behaviour";
      mainSettings;
  }
}

function setSetting(setting, value) {
  localStorage.setItem(setting, value);
}

function loadSetting(setting) {
  return localStorage.getItem(setting);
}

function createSettingDiv(settingName, settingValueType) {}
