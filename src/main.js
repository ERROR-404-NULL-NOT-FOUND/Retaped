// Import markdown renderer
var converter = new showdown.Converter()
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
var emojis = { };
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
var cssVars = getComputedStyle(document.querySelector(":root"));
var keysDown = [];
var sendRawJSON = false;
var ordering = [];
var isMessageSending = false;

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

document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "Enter":
      if (keysDown.indexOf('Shift') === -1) sendMessage();

      else {
        let input = document.getElementById("input");
        input.value = `${input.value}\n`;
      }

      break;

    case "Escape":
      activeReplies.pop();
      document.querySelector(".replying-container").lastChild.remove();
      break;

    default:
      keysDown.push(event.key);
  }
  return;
});

document.addEventListener("keyup", (event) => { 
  keysDown.splice(keysDown.indexOf(event.key), 1);
  return;
})

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

// Basically the same as the function above, but fetches the user and adds it to the cache if it isn't found
async function userLookup(ID) {
  if (cacheLookup('users', ID) !== 1) return cacheLookup('users', ID);
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
      console.log(error);
      return false;
    });
  return res;
}

async function updateUnreads(channelID, messageID) {
  for (let i = 0; i < unreads.length; i++){
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
    }
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
    themeVars.style.setProperty("--background", theme["primary-background"]);
    themeVars.style.setProperty("--foreground", theme["foreground"]);
    themeVars.style.setProperty("--hover", theme.hover);

    document.querySelector("#themeLabel").textContent = "Revolt theme";
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
        if (data.channel === activeChannel) {
          parseMessage(data);
          fetch(
            `https://api.revolt.chat/channels/${activeChannel}/ack/${data._id}`,
            {
              headers: {
                "x-session-token": token,
              },
              method: "PUT",
            }
          );
        } else {
          if ((channel = document.getElementById(data.channel)) && mutedChannels.indexOf(data.channel) === -1) {
            channel.style.color =
              data.mentions && data.mentions.indexOf(userProfile._id) !== -1
                ? cssVars.getPropertyValue("--accent")
                : cssVars.getPropertyValue("--foreground");

            channel.classList.add("channel-unread");
          }
          if (mutedChannels.indexOf(data.channel) === -1){
            document.getElementById(
              cacheLookup("channels", data.channel).server
            ).style.boxShadow =
             data.mentions && data.mentions.indexOf(userProfile._id) !== -1
               ? cssVars.getPropertyValue("--accent")
               : cssVars.getPropertyValue("--foreground");
          }
        }
        break;

      case "MessageDelete":
        if (data.channel_id === activeChannel) {
          document.querySelector("#messagesContainer").removeChild(document.getElementById(data.id))
        };
        break;

      /*case "MessageUpdate":
        if (data.channel === activeChannel) {
          parseMessage(data.data, data.id);
        }
        */

      // Channel has been acknowledge as read
      case "ChannelAck":
        updateUnreads(data._id, data.message_id);

        if ((channel = document.getElementById(data.id))) {
          channel.style.colour = cssVars.getPropertyValue("--foreground");
          channel.classList.remove("channel-unread");
        }

        document.getElementById(
          cacheLookup("channels", data._id).server
        ).style.boxShadow =
          "rgba(0, 0, 0, 0.16) 0px 1px 4px, rgb(51, 51, 51) 0px 0px 0px 3px";

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
      case "ChannelStartTyping":
        if (
          data.id !== activeChannel ||
          currentlyTyping.indexOf(data.user) !== -1
        ) break;

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

      // User stops typing
      case "ChannelStopTyping":
        if (data.id !== activeChannel) break;

        const typingUserContainerz = document.getElementById(data.user);
        if (typingUserContainerz) {
          typingUserContainerz.remove();
          currentlyTyping.splice(currentlyTyping.indexOf(data.user), 1);
        }

        if (typingBar.children.length === 0)
          document.getElementById("typingBarContainer").style.display = "none";
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
      }
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
          }
        )
        .then((res) => res.json())
        .then((data) => data);
        if (mfaTokenResponse.result === "Success") {
          token = mfaTokenResponse.token;
        } else {
          console.error("You've scuffed your MFA key, for some reason the server returned: " + JSON.stringify(mfaTokenResponse));
        }
      }
    }
  } else {
    console.error("No login method provided, how the fuck do you expect to log in?");
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
  fetch('./emojis.json').then((res) => res.json()).then((json)=>emojis=json)

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
      unread.last_id < cacheLookup("channels", unread._id.channel).lastMessage &&
      mutedChannels.indexOf(unread._id.channel) === -1
    ) {
      unreadChannels.push(unread._id.channel);
    }
  });

  for (let i = 0; i < ordering.length; i++) {
    let server = document.createElement("button");
    let serverIndex = cacheIndexLookup("servers", ordering[i]);

    server.onclick = () => {
      activeServer = cache.servers[serverIndex].id;
      getChannels(cache.servers[serverIndex].id);
      clearMessages();

      document.getElementById("serverName").innerText = cache.servers[serverIndex].name;
      document.getElementById("channelName").innerText = "";
    };

    cache.servers[serverIndex].categories.forEach((channel) => {
      if (
        unreadChannels.indexOf(channel) !== -1 &&
        mutedChannels.indexOf(channel) === -1
      ) {
        server.style.boxShadow = `${cssVars.getPropertyValue(
          "--foreground"
        )} 0px 0px 0px 3px`;
      }
    });

    if (mutedServers.indexOf(cache.servers[serverIndex].id) !== -1)
      server.style.boxShadow = `hsl(0, 0%, 20%) 0px 0px 0px 3px`;

    server.id = cache.servers[serverIndex].id;

    if (cache.servers[serverIndex].icon == null) {
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
  channelContainer.replaceChildren();

  let addedChannels = [];

  cache.servers[cacheIndexLookup("servers", activeServer)].categories.forEach(
    (category) => {
      let categoryContainer = document.createElement("details");
      let categoryText = document.createElement("summary");

      categoryContainer.open = true;
      categoryContainer.classList.add("channel-category");

      categoryText.textContent = category.title;
      categoryText.classList.add("categoryText");
      categoryContainer.appendChild(categoryText);

      for (let j = 0; j < category.channels.length; j++) {
        const currentChannel = cacheLookup("channels", category.channels[j]);
        let channel = document.createElement("button");
        let channelText = document.createElement("span");

        if (currentChannel.type !== "TextChannel" || currentChannel.server !== id) continue;

        addedChannels.push(currentChannel.id);

        channel.classList.add("channel");

        channel.onclick = () => {
          getMessages(currentChannel.id);
          document.getElementById("channelName").innerText = currentChannel.name;
        };

        channel.id = currentChannel.id;
        channelText.innerText = currentChannel.name;

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

        channel.appendChild(channelText);

        if (mutedChannels.indexOf(currentChannel.id) !== -1)
          //Loki TODO: make this use a theme colour
          channel.style.color = "#777777";
        categoryContainer.appendChild(channel);
      }

      channelContainer.appendChild(categoryContainer);
    }
  );

  let defaultCategory = document.createElement("details");
  let defaultCategoryText = document.createElement("summary");

  defaultCategory.open = true;
  defaultCategory.classList.add("channel-category");
  defaultCategoryText.textContent = "Uncategorised";
  defaultCategoryText.classList.add("categoryText");
  defaultCategory.appendChild(defaultCategoryText);

  for (let i = 0; i < cache.channels.length; i++) {
    console.log("test")
    if (cache.channels[i].server !== id ||
      cache.channels[i].type !== "TextChannel" ||
      addedChannels.indexOf(cache.channels[i].id) !== -1) continue;

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

// Parses and renders messages
// TODO: make this function not be almost 200 lines long
// Loki TODO: Add blocked message styling
// Loki TODO: add some flair for messages sent by friends
async function parseMessage(message, id = null) {
  const member = cacheLookup("members", message.author, activeServer);
  const messageContainer = document.getElementById("messagesContainer");

  let messageActions = document.createElement("div");
  let messageContent = document.createElement("div");
  let userData = document.createElement("div");
  let username = document.createElement("button");
  let profilePicture = document.createElement("img");
  let replyButton = document.createElement("button");
  let masqueradeBadge = document.createElement("span");
  let messageDisplay = document.createElement("div");

  messageDisplay.classList.add("message-display");
  messageActions.classList.add("message-actions");
  profilePicture.classList.add("chat-pfp");
  userData.classList.add("userdata");
  username.classList.add("username");
  messageContent.classList.add("message-content");

  let user;
  if(message.system) {
    user = await userLookup(message.system.id ? message.system.id : message.system.by);
  } else {
    user = await userLookup(message.author);
  }

  if (message.system) {
    username.textContent = user.username;

    profilePicture.src = user.pfp ?
      `https://autumn.revolt.chat/avatars/${user.pfp._id}?max_side=256` :
      `https://api.revolt.chat/users/${user.id}/default_avatar`;

    switch (message.system.type) {
      case "user_added":
        messageContainer.textContent = `User ${await userLookup(message.system.by) ? await userLookup(message.system) : message.system.by}`;
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
      username.textContent = member.nickname ? member.nickname : user.displayName;
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

            if (/^#[0-9A-F]{6}$/i.test(tmpColour)) { // Testing if it's a valid hex code
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
      if (message.masquerade.name) username.textContent = message.masquerade.name;
      else username.textContent = member.nickname ? member.nickname : user.displayName;

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
    messageContent.innerHTML = converter.makeHtml(message.content);

    //Mention parser
    if (message.mentions) {
      message.mentions.forEach(async (mention) => {
        if (messageContent.innerText.split(`<@${mention}>`).length === 1) return;

        let segConcat = document.createElement("div");
        let newSeg;

        messageContent.innerText.split(`<@${mention}>`).forEach((segment) => {
          newSeg = document.createElement("span");
          newSeg.innerText = segment;
          segConcat.appendChild(newSeg);
        });

        let ping = document.createElement("div");
        let pingContainer = document.createElement("div");
        let mentionPfp = document.createElement("img");
        let mentionText = document.createElement("span");
        let userProfile = cacheLookup("users", mention);

        mentionPfp.classList.add("mentionPfp");
        mentionText.classList.add("mentionText");
        ping.classList.add("tag");

        ping.appendChild(mentionPfp);
        mentionText.textContent = cacheLookup("users", mention).displayName;


        mentionPfp.src = userProfile.pfp ? `https://autumn.revolt.chat/avatars/${userProfile.pfp._id}?max_side=256` :
          `https://api.revolt.chat/users/${mention}/default_avatar?max_side=256`;
        mentionText.textContent = cacheLookup("users", mention).displayName;

        ping.appendChild(mentionPfp);
        ping.appendChild(mentionText);
        pingContainer.appendChild(ping);
        segConcat.insertBefore(pingContainer, newSeg);
        messageContent = segConcat;

        //CSS TODO: Make this show a pointer on hover
        ping.onclick = () => {
          loadProfile(mention);
        }

        if (mention === userProfile._id) {
          messageContent.classList.add("selfMentioned");
        }
      });
    }

    // Emojis
    Object.keys(emojis.standard).forEach(emoji => {
      if (messageContent.textContent.search(`:${emoji}:`) !== -1) {
        messageContent.innerHTML = messageContent.innerHTML.replace(`:${emoji}:`, emojis.standard[emoji])
      }
    });

    Object.keys(emojis.custom).forEach(emoji => {
      if (messageContent.textContent.search(`:${emoji}`) === -1) return;

      let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
      let emojiImage = document.createElement("img");

      emojiImage.src = `https://dl.insrt.uk/projects/revolt/emotes/${emojis.custom[emoji]}`;
      messageContent.replaceChildren();

      for (let i = 0; i < tmpMsg.length; i++){
        if (i !== tmpMsg.length - 1) messageContent.innerHTML += tmpMsg[i] + emojiImage.outerHTML
        else messageContent.innerHTML += tmpMsg[i];
      }
    })

    if (messageContent.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g) !== null) {
      let matches = messageContent.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g)

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

    if (cache.messages.length === 0 || (cache.messages[cache.messages.length - 1].author !== message.author || cache.messages[cache.messages.length - 1].masquerade !== undefined))
      messageDisplay.appendChild(userData);
    messageDisplay.appendChild(messageContent);

    messageDisplay.id = message._id;
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

    if (cache.messages.length === 0 || (cache.messages[cache.messages.length - 1].author !== message.author || cache.messages[cache.messages.length - 1].masquerade !== undefined))
      messageDisplay.appendChild(userData);
    messageDisplay.appendChild(messageContent);

    messageDisplay.id = message._id;
    messageDisplay.class = "message";
    messageContent.innerText = "<Blocked user>";
    messageContainer.classList.add("blockedMessage");
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

  replyButton.innerText = "Reply";
  messageDisplay.appendChild(messageActions);
  messageActions.appendChild(replyButton);
  messageContainer.appendChild(messageDisplay);
  cache.messages.push({
    id: message._id,
    author: message.author,
    content: message.content,
    masquerade: message.masquerade
  });
  scrollChatToBottom();
}

//
// Cache building
//

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
    cache.servers[server].categories.forEach((category) => {
      let tmpCategory = [];

      category.channels.forEach((channel) => {
        let anthTmpChannel;
        for (tmpChannel in channels) {
          if (channels[tmpChannel]._id === channel) {
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
        displayName: users[i].display_name ? users[i].display_name : users[i].display_name,
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

async function getMessages(id) {
  cache.messages = [];
  activeReplies = [];
  activeChannel = id;

  document.querySelector(".replying-container").replaceChildren();
  document.querySelector("#typingBar").replaceChildren();

  // fetchResource(`channels/${id}`).then((data) => {
  //   // document.getElementById("serverName").innerText =
  //   //   data.channel_type === "DirectMessage" ? data.recipients[0] : data.channel_type === "SavedMessages" ? "Saved Messages" : cacheLookup("servers", data.server)[1];
  //   document.getElementById("serverName").innerText = cacheLookup("servers", data.server)[1];
  // });

  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&sort=latest`
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
        displayName: users[i].display_name ? users[i].display_name : users[i].username,
        relationship: users[i].relationship,
    });
  }

  if (placeholder.members) {
    const members = placeholder.members;

    for (let i = 0; i < members.length; i++) {
      if (cacheLookup("members", members[i]._id.user, activeServer) === 1)
        cache.servers[cacheIndexLookup("servers", activeServer)].members.push(
          members[i]
        );
    }
  }

  clearMessages();

  const messages = placeholder.messages;

  for (let i = messages.length - 1; i >= 1; i--) {
    parseMessage(messages[i]);
  }

  fetch(
    `https://api.revolt.chat/channels/${activeChannel}/ack/${messages[0]._id}`,
    {
      headers: {
        "x-session-token": token,
      },
      method: "PUT",
    }
  );
  parseMessage(messages[0]);
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
    }

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
        user = await userLookup(cache.channels[i].recipients[1])
      } else {
        user = await userLookup(cache.channels[i].recipients[0])
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
  const userProfile = await fetchResource(`users/${userID}/profile`);
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
    profilePicture.src = `https://api.revolt.chat/users/${user.pfp._id}/default_avatar`
  }

  if (Object.keys(userProfile).indexOf("background") > -1) {
    profileBackground.style.background = `linear-gradient(0deg, rgba(0,0,0,0.84) 10%, rgba(0,0,0,0) 100%),
        url(https://autumn.revolt.chat/backgrounds/${userProfile.background._id}) center center / cover`;
  } else profileBackground.style.background = "";

  bio.innerHTML = converter.makeHtml(userProfile.content);

  // Emojis
  Object.keys(emojis.standard).forEach(emoji => {
      if (bio.innerHTML.search(`:${emoji}:`) !== -1) {
        bio.innerHTML = bio.innerHTML.replace(`:${emoji}:`, emojis.standard[emoji])
      }
    });

  Object.keys(emojis.custom).forEach(emoji => {
    if (bio.innerHTML.search(`:${emoji}`) === -1) return;

    let tmpMsg = bio.innerHTML.split(`:${emoji}:`);
    let emojiImage = document.createElement("img");
    emojiImage.classList.add("emoji");

    emojiImage.src = `https://dl.insrt.uk/projects/revolt/emotes/${emojis.custom[emoji]}`;
    bio.textContent = "";
    bio.innerHTML = "";

    for (let i = 0; i < tmpMsg.length; i++) {
      if (i !== tmpMsg.length - 1) bio.innerHTML += tmpMsg[i] + emojiImage.outerHTML
        else bio.innerHTML += tmpMsg[i];
      }
    })

  if (bio.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g) !== null) {
    let matches = bio.innerHTML.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g);
    for (let i = 0; i < matches.length; i++) {
      let emoji = matches[i].split(":")[1];
      let tmpMsg = bio.innerHTML.split(`:${emoji}:`);
      let tmpImg = document.createElement("img");
      tmpImg.classList.add("emoji");

      tmpImg.src = `https://autumn.revolt.chat/emojis/${emoji}`;
      bio.innerHTML = tmpMsg[0] + tmpImg.outerHTML;

      for (let j = 1; j < tmpMsg.length; j++) {
        bio.innerHTML += tmpMsg[j]
      }
    }
  }

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
  if(isMessageSending) return;

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
 
 if (document.querySelector("#embedTitle").value || document.querySelector("#embedDesc").value || document.querySelector("#embedColour").value || document.querySelector("#embedIconURL").value || document.querySelector("#embedMedia").value || document.querySelector("#embedURL").value) {
   embeds = [{
     title: document.querySelector("#embedTitle").value ? document.querySelector("#embedTitle").value : null,
      description: document.querySelector("#embedDesc").value ? document.querySelector("#embedDesc").value : null,
      colour: document.querySelector("#embedColour").value ? document.querySelector("#embedColour").value : null,
      icon_url: document.querySelector("#embedIconURL").value ? document.querySelector("#embedIconURL").value : null,
      url: document.querySelector("#embedURL").value ? document.querySelector("#embedURL").value : null,
      media: document.querySelector("#embedMedia").value ? document.querySelector("#embedMedia").value : null,
    }];
  }

  if (document.querySelector("#masqName").value || document.querySelector("#masqPfp").value || document.querySelector("#masqColour").value) {
    masquerade = {
      name: document.querySelector("#masqName").value ? document.querySelector("#masqName").value : null,
      avatar: document.querySelector("#masqPfp").value ? document.querySelector("#masqPfp").value : null,
      colour: document.querySelector("#masqColour").value ? document.querySelector("#masqColour").value : null,
    };
  }

  let body = sendRawJSON ? message :
    JSON.stringify({
      content: message,
      replies: activeReplies,
      masquerade,
      embeds,
    });

  isMessageSending = true;

  await fetch(`https://api.revolt.chat/channels/${activeChannel}/messages`, {
    headers: {
      "x-session-token": token,
    },
    method: "POST",
    body: body
  })
    .then((response) => response.json())
    .then((data) => {
      isMessageSending = false;
      fetch(`https://api.revolt.chat/channels/${activeChannel}/ack/${data._id}`, { method: "PUT", headers: {"x-session-token": token}})
    }
  );

  messageContainer.value = "";
  activeReplies = [];
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
  const  element = document.getElementById("messagesContainer");
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

function createSettingDiv(settingName, settingValueType) { }
