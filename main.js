//
// Variables
//

var cache = {
  //0 is id, 1 is username, 2 is pfp, 3 is bot, 4 is discrim, 5 is display name
  users: [],
  //0 is id, 1 is name, 2 is channel type, 3 is server, 4 is last message
  channels: [],
  categories: [],
  //0 is id, 1 is name, 2 is server icon id, 3 is roles, 4 is members
  servers: [],
  //0 is id, 1 is author, 2 is content
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
var unreads = [];
var unreadChannels = [];
var cssVars = getComputedStyle(document.querySelector(":root"));
var keysDown = [];

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
      if (cache.servers[i][0] === serverID) {
        const index = resource === "members" ? 4 : 3;
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
    if (cache[resource][i][0] === ID) return cache[resource][i];
  }
  return 1;
}

// Basically the same as the function above, but fetches the user and adds it to the cache if it isn't found
async function userLookup(ID) {
  if (cacheLookup('users', ID) !== 1) return cacheLookup('users', ID);
  user = await fetchResource(`users/${ID}`);
  let fmtUser;
  if (user.avatar) {
    fmtUser = [
      user._id,
      user.username,
      user.avatar,
      user.bot,
    ];
  } else {
    fmtUser = [
      user._id,
      user.username,
      undefined,
      user.bot,
    ];
  }
  cache.users.push(fmtUser);
  return fmtUser;
}

// Looks up the given resource by id and returns the index
function cacheIndexLookup(resource, ID) {
  for (let i = 0; i < cache[resource].length; i++) {
    if (cache[resource][i][0] === ID) return i;
  }
  return 1;
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

// Loads settings from the user's Revolt account, mainly for color loading
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
  Object.keys(notifications.channel).forEach((channel) => {
    if (notifications.channel[channel] === "muted") mutedChannels.push(channel);
  });
  let themeVars = document.querySelector(":root");
  themeVars.style.setProperty("--accent", theme.accent);
  themeVars.style.setProperty("--error", theme.error);
  themeVars.style.setProperty("--servers-bg", theme.background);
  themeVars.style.setProperty("--channels-bg", theme["secondary-background"]);
  themeVars.style.setProperty("--secondary-background", theme["message-box"]);
  themeVars.style.setProperty("--background", theme["primary-background"]);
  themeVars.style.setProperty("--foreground", theme["foreground"]);
  themeVars.style.setProperty("--hover", theme.hover);

  document.querySelector("#theme-label").textContent = "Revolt theme";
}

// Function to interface with Revolt's websocket service
async function bonfire() {
  socket = new WebSocket("wss://ws.revolt.chat");

  socket.addEventListener("open", async function (event) {
    socket.send(`{"type": "Authenticate","token": "${token}"}`);
  });

  socket.addEventListener("message", async function (event) {
    let data;
    data = JSON.parse(event.data);
    const typingBar = document.getElementById("typingBar");
    switch (data.type) {

      // User provided correct credentials
      case "Authenticated":
        document.getElementById("status").innerText = "Connected";
        break;
      
        // Used for message unreads and adding new messages to the messagebox
      case "Message":
        if (data.channel === activeChannel) {
          parseMessage(data);
          if (data.author !== userProfile._id)
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
          if ((channel = document.getElementById(data.channel))) {
            channel.style.color =
              data.mentions && data.mentions.indexOf(userProfile._id) !== -1
                ? cssVars.getPropertyValue("--accent")
                : cssVars.getPropertyValue("--foreground");
            channel.style.fontWeight = "bold";
          }
          document.getElementById(
            cacheLookup("channels", data.channel)[3]
          ).style.boxShadow =
            data.mentions && data.mentions.indexOf(userProfile._id) !== -1
              ? cssVars.getPropertyValue("--accent")
              : cssVars.getPropertyValue("--foreground");
        }
        break;
      
      case "MessageDelete":
        if(data.channel_id===activeChannel) document.querySelector("#messages").removeChild(document.getElementById(data.id));
        break;
      
      case "MessageUpdate":
        if (data.channel_id === activeChannel) {
          parseMessage(data.data, data.id);
        }
        // Channel has been acknowledge as read
      case "ChannelAck":
        updateUnreads(data.id, data.message_id);
        if ((channel = document.getElementById(data.id))) {
          channel.style.colour = cssVars.getPropertyValue("--foreground");
          channel.style.fontWeight = "normal";
        }
        document.getElementById(
          cacheLookup("channels", data.id)[3]
        ).style.boxShadow =
          "rgba(0, 0, 0, 0.16) 0px 1px 4px, rgb(51, 51, 51) 0px 0px 0px 3px";

        break;
      
      // Uh oh
      case "Error":
        document.querySelector(".error-container").style.display = "block";
        document.querySelector(".error-content").textContent = data.error;
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
        )
          break;
        const typingMember = cacheLookup("members", data.user, activeServer);
        const typingUser = await userLookup(data.user);
        const typingUserContainer = document.createElement("div");
        const typingUserName = document.createElement("span");
        const typingUserPfp = document.createElement("img");

        typingUserPfp.src =
          typingMember[2] === undefined
            ? `https://autumn.revolt.chat/avatars/${typingUser[2]._id}?max_side=25`
            : `https://autumn.revolt.chat/avatars/${typingMember[2]._id}?max_side=25`;
        typingUserContainer.appendChild(typingUserPfp);
        typingUserName.textContent = typingUser[1];
        typingUserContainer.appendChild(typingUserName);
        typingUserContainer.id = typingUser[0];
        currentlyTyping.push(data.user);

        document.getElementById("typingBarContainer").style.display = "flex";
        typingBar.appendChild(typingUserContainer);
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
  let toggleTheme = document.querySelector("#toggleTheme");
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
      if(tokenResponse.result === "Unauthorized")
      localStorage.removeItem("token");
        console.log("Invalid token!");
    }
  } else {
    console.log(
      "No login method provided, how the fuck do you expect to log in?"
    );
    return;
  }
  if ((userProfile = await fetchResource("users/@me")) === false) {
    console.log("Login failed");
    return 1;
  }
  if (toggleToken.checked == true) {
    if (!localStorage.getItem("token")) localStorage.setItem("token", token);
  }
  if (toggleTheme.checked == true) {
    loadSyncSettings();
  }
  bonfire();
  fetch('./emojis.json').then((res) => res.json()).then((json)=>emojis=json)
  // Hide & show
  document.querySelector(".login-screen").style.display = "none";
  document.getElementById("logged").style.display = "grid";
}

//
// Rendering
//

// Renders servers from the cache
async function getServers() {
  let serverContainer = document.getElementById("servers");
  while (serverContainer.hasChildNodes()) {
    serverContainer.removeChild(serverContainer.lastChild);
  }
  unreads.forEach((unread) => {
    if (
      unread.last_id < cacheLookup("channels", unread._id.channel)[4] &&
      mutedChannels.indexOf(unread._id.channel) === -1
    ) {
      unreadChannels.push(unread._id.channel);
    }
  });
  for (let i = 0; i < cache.servers.length; i++) {
    let server = document.createElement("button");
    server.onclick = () => {
      activeServer = cache.servers[i][0];
      getChannels(cache.servers[i][0]);
    };
    cache.servers[i][6].forEach((channel) => {
      if (
        unreadChannels.indexOf(channel) !== -1 &&
        mutedChannels.indexOf(channel) === -1
      )
        server.style.boxShadow = `${cssVars.getPropertyValue(
          "--foreground"
        )} 0px 0px 0px 3px`;
    });

    server.id = cache.servers[i][0];

    let serverIcon = document.createElement("img");
    serverIcon.className = "server"; // TODO: use `classList`
    if (cache.servers[i][2] == null) {
      // TODO: refactor this to use html text and css style
      // hint: the `text` variable
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      const text = cache.servers[i][1].charAt(0);
      context.font = "64px Arial";
      context.fillStyle = "0,0,0";
      context.fillText(text, 8, 48);
      serverIcon.src = canvas.toDataURL();
    } else {
      serverIcon.src = `https://autumn.revolt.chat/icons/${cache.servers[i][2]}?max_side=64`;
    }
    server.appendChild(serverIcon);
    serverContainer.appendChild(server);
  }
}

// Renders channels from the cache
async function getChannels(id) {
  let channelContainer = document.getElementById("channels");

  while (channelContainer.hasChildNodes()) {
    channelContainer.removeChild(channelContainer.lastChild);
  }
  let addedChannels = [];

  cache.servers[cacheIndexLookup("servers", activeServer)][5].forEach(
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
        addedChannels.push(currentChannel[0]);

        if (currentChannel[2] !== "TextChannel") continue;
        if (currentChannel[3] !== id) continue;

        let channel = document.createElement("button");
        channel.classList.add("channel");

        channel.onclick = () => {
          getMessages(currentChannel[0]);
        };

        let channelText = document.createElement("span");
        channel.id = currentChannel[0];
        channelText.innerText = currentChannel[1];
        for (let i = 0; i < unreads.length; i++) {
          if (unreads[i]["_id"].channel === currentChannel[0]) {
            //currentChannel[0] is the ID of the channel currently being returned
            if (
              mutedChannels.indexOf(currentChannel[0]) === -1 &&
              currentChannel[4] > unreads[i].last_id
            )
              channel.style.fontWeight = "bold";

            break;
          }
        }
        channel.appendChild(channelText);

        if (mutedChannels.indexOf(currentChannel[0]) !== -1)
          channel.style.color = "#777777";
        categoryContainer.appendChild(channel);
      }
      channelContainer.appendChild(categoryContainer);
    }
  );

  let channels = cache.channels;
  for (let i = 0; i < channels.length; i++) {
    if (channels[i][3] !== id) continue;
    if (channels[i][2] !== "TextChannel") continue;
    if (addedChannels.indexOf(channels[i][0]) !== -1) continue;
    const currentChannel = cacheLookup("channels", channels[i][0]);
    addedChannels.push(currentChannel[0]);
    if (currentChannel[2] !== "TextChannel") continue;
    if (currentChannel[3] !== id) continue;

    let channel = document.createElement("button");
    channel.classList.add("channel");

    channel.onclick = () => {
      getMessages(currentChannel[0]);
    };
    for (let i = 0; i < unreads.length; i++) {
      if (unreads[i]["_id"].channel === currentChannel[0]) {
        //currentChannel[0] is the ID of the channel currently being returned
        if (
          mutedChannels.indexOf(currentChannel[0]) === -1 &&
          currentChannel[4] > unreads[i].last_id
        )
          channel.style.fontWeight = "bold";

        break;
      }
    }

    let channelText = document.createElement("span");
    channelText.id = currentChannel[0];
    channelText.innerText = currentChannel[1];

    channel.appendChild(channelText);
    channelContainer.insertBefore(channel, channelContainer.children[0]);
  }
}

function clearMessages() {
  const messageContainer = document.getElementById("messages");
  // TODO: use `replaceChildren()`
  while (messageContainer.hasChildNodes()) {
    messageContainer.removeChild(messageContainer.lastChild);
  }
}

// Parses and renders messages
// TODO: make this function not be almost 200 lines long
async function parseMessage(message, id = null) {
  const member = cacheLookup("members", message.author, activeServer);
  var messageDisplay = "";
  const messageContainer = document.getElementById("messages");

  if (id !== null) {
    messageDisplay = document.getElementById(id);
    // TODO: use `replaceChildren()`
    while (messageDisplay.hasChildNodes()) {
      messageDisplay.removeChild(messageDisplay.lastChild);
    }
  }
  else {
    messageDisplay = document.createElement("div");
  }
  let messageActions = document.createElement("div");
  let messageContent = document.createElement("p");
  let userdata = document.createElement("div");
  let username = document.createElement("button");
  let profilepicture = document.createElement("img");
  let replyButton = document.createElement("button");
  let masqueradeBadge = document.createElement("span");

  messageDisplay.classList.add("message-display");
  messageActions.classList.add("message-actions");
  profilepicture.classList.add("chat-pfp");
  userdata.classList.add("userdata");
  username.classList.add("username");
  messageContent.classList.add("message-content");
  let user;
  if ((user = await userLookup(message.author)) === 1) {
    if (Object.keys(message).indexOf("system") !== -1) {
      if (message.system.id) {
        user = [message.system.id, message.system.id, undefined, undefined];
      } else {
        user = [message.system.by, message.system.by, undefined, undefined];
      }
    } else {
      user = [message.author, message.author, undefined, undefined];
    }
  }
  if (message.system) {
    username.textContent = await userLookup(message.system.id)[0];
    messageContent.textContent = message.system.type;
  } else {
    if (!message.masquerade) {
      username.textContent = member.nickname ? member.nickname : user[5];
      if (user[3] !== undefined) masqueradeBadge.textContent = "Bot";
      username.appendChild(masqueradeBadge);
      profilepicture.src = member.avatar
        ? `https://autumn.revolt.chat/avatars/${member.avatar._id}`
        : user[2]
          ? `https://autumn.revolt.chat/avatars/${user[2]._id}?max_side=256`
          : `https://api.revolt.chat/users/${user[0]._id}/default_avatar`;

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
      username.textContent = message.masquerade.name;
      username.appendChild(masqueradeBadge);

      if (message.masquerade.avatar) {
        profilepicture.src = `https://jan.revolt.chat/proxy?url=${message.masquerade.avatar}`;
      } else {
        profilepicture.src = user[2]
          ? `https://autumn.revolt.chat/avatars/${user[2]._id}?max_side=256`
          : `https://api.revolt.chat/users/${user[0]._id}/default_avatar`;
        username.style.color = message.masquerade.colour;
      }
    }
  }
  username.onclick = () => {
    loadProfile(user[0]);
  };
  profilepicture.onclick = () => {
    loadProfile(user[0]);
  };
  userdata.appendChild(profilepicture);
  userdata.appendChild(username);
  if (message.mentions) {
    let parsedMessage = document.createElement("p");
    parsedMessage.textContent = message.content;
    message.mentions.forEach(async (mention) => {
      if (parsedMessage.innerText.split(`<@${mention}>`).length === 0) return;
      let segConcat = document.createElement("div");
      let newSeg;
      parsedMessage.innerText.split(`<@${mention}>`).forEach((segment) => {
        newSeg = document.createElement("span");
        newSeg.innerText = segment;
        segConcat.appendChild(newSeg);
      });
      let ping = document.createElement("span");
      ping.classList.add("mention");
      ping.textContent = '@' + cacheLookup('users', mention)[1];
      let segElement = document.createElement("span");
      segConcat.insertBefore(ping, newSeg);
      parsedMessage = segConcat;
    });
    messageContent.appendChild(parsedMessage);
  } else if (!message.system) messageContent.textContent = message.content;
  // Emojis
  /* Object.keys(emojis.standard).forEach(emoji => {
    if (messageContent.textContent.search(`:${emoji}:`) !== -1) {
      messageContent.textContent = messageContent.textContent.replace(`:${emoji}:`, emojis.standard[emoji])
    }
  });
  Object.keys(emojis.custom).forEach(emoji => {
    if (messageContent.textContent.search(`:${emoji}`) === -1) return;
    let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
    let emojiImage = document.createElement("img");
    emojiImage.src = `https://dl.insrt.uk/projects/revolt/emotes/${emojis.custom[emoji]}`;
    messageContent.textContent = "";
    messageContent.innerHTML = "";
    for (let i = 0; i < tmpMsg.length; i++){
      if (i !== tmpMsg.length - 1) messageContent.innerHTML += tmpMsg[i] + emojiImage.outerHTML
      else messageContent.innerHTML += tmpMsg[i];
    }
  })
  if (messageContent.textContent.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g) !== null) {
    let matches = messageContent.textContent.match(/:[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}:/g)
    for (let i = 0; i < matches.length; i++) {
      let emoji = matches[i].split(":")[1];
      let tmpMsg = messageContent.innerHTML.split(`:${emoji}:`);
      let tmpImg = document.createElement("img");
      tmpImg.src = `https://autumn.revolt.chat/emojis/${emoji}`;
      messageContent.innerHTML = tmpMsg[0] + tmpImg.outerHTML;
      for (let j = 1; j < tmpMsg.length-1; j++) {
        messageContent.innerHTML+= tmpMsg[j]
      }
    }
  } */
  if (message.replies) {
    let reply = document.createElement("div");
    reply.classList.add("reply-content");
    for (let j = 0; j < message.replies.length; j++) {
      let replyContent = document.createElement("span");
      replyContent.textContent =
        "> " + cacheLookup("messages", message.replies[j])[2] + "\n";
      reply.appendChild(replyContent);
    }
    messageDisplay.appendChild(reply);
  }

  if (cache.messages.length === 0 || cache.messages[cache.messages.length-1][1] !== message.author)
    messageDisplay.appendChild(userdata);
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
        tmpAttachment = document.createElement("video");
        tmpAttachment.controls = true;
        tmpAttachment.style.maxWidth = "30%";
        tmpAttachment.style.maxHeight = "30%";
        let subAttachment = document.createElement("source");
        subAttachment.src = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
        subAttachment.type = tmpAtchmntAttrs.content_type;
        tmpAttachment.appendChild(subAttachment);
      } else if (tmpAtchmntAttrs.content_type.startsWith("audio")) {
        tmpAttachment = document.createElement("div");
        
        let tmpContainer = document.createElement("audio");
        tmpContainer.controls = true;
        tmpContainer.textContent = tmpAtchmntAttrs.filename;
        
        let subAttachment = document.createElement("source");
        subAttachment.src = `https://autumn.revolt.chat/attachments/${tmpAtchmntAttrs._id}/${tmpAtchmntAttrs.filename}`;
        subAttachment.type = tmpAtchmntAttrs.content_type;
        
        tmpContainer.appendChild(subAttachment);
        let name = document.createElement("span");
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

  replyButton.onclick = () => {
    activeReplies.push({
      id: message["_id"],
      mention: false,
    });
    const replyText = document.createElement("p");
    replyText.textContent = message.content;
    replyText.classList.add("replying-content");
    document.querySelector(".replying-container").appendChild(replyText);
  };
  replyButton.innerText = "Reply";
  messageDisplay.appendChild(messageActions);
  messageActions.appendChild(replyButton);
  if( id===null)messageContainer.appendChild(messageDisplay);
  cache.messages.push([message._id, message.author, message.content]);
}

//
// Cache building
//

async function buildChannelCache(channels) {
  let categories = {};
  for (let i = 0; i < channels.length; i++) {
    switch (channels[i].channel_type) {
      case "TextChannel":
        cache.channels.push([
          channels[i]._id,
          channels[i].name,
          channels[i].channel_type,
          channels[i].server,
          channels[i].last_message_id,
        ]);
        break;
      case "Group":
        cache.channels.push([
          channels[i]._id,
          channels[i].name,
          channels[i].channel_type,
        ]);
        break;
      case "DirectMessage":
        cache.channels.push([
          channels[i]._id,
          channels[i].recipients,
          channels[i].channel_type,
        ]);
    }
  }

  for (const server in cache.servers) {
    cache.servers[server][5].forEach((category) => {
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

      cache.categories.push({ [category]: tmpCategory });
    });
  }
}

async function buildUserCache(users) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].avatar) {
      cache.users.push([
        users[i]._id,
        users[i].username,
        users[i].avatar,
        users[i].bot,
        users[i].discriminator,
        users[i].display_name
      ]);
    } else {
      cache.users.push([
        users[i]._id,
        users[i].username,
        undefined,
        users[i].bot,
        users[i].discriminator,
        users[i].display_name
      ]);
    }
  }
}

async function buildServerCache(servers) {
  for (let i = 0; i < servers.length; i++) {
    cache.servers.push([
      servers[i]["_id"],
      servers[i]["name"],
      servers[i].icon ? servers[i].icon._id : null,
      servers[i].roles,
      [],
      servers[i].categories,
      servers[i].channels,
    ]);
  }
  getServers();
}

//
// Wildcard category
//

async function getMessages(id) {
  cache.messages = [];

  activeChannel = id;
  document.querySelector("#typingBarContainer").innerHTML = "";

  fetchResource(`channels/${id}`).then((data) => {
    document.getElementById("chanName").innerText =
      data.channel_type === "DirectMessage" ? data.recipients[0] : data.name;
  });

  const placeholder = await fetchResource(
    `channels/${id}/messages?include_users=true&sort=latest`
  );
  const users = placeholder.users;

  for (let i = 0; i < users.length; i++) {
    if (cacheLookup("users", users[i]) === 1)
      cache.users.push([
        users[i]._id,
        users[i].username,
        users[i].avatar,
        users[i].bot,
        users[i].discriminator,
      ]);
  }
  if (placeholder.members) {
    const members = placeholder.members;
    for (let i = 0; i < members.length; i++) {
      if (cacheLookup("members", members[i]._id.user, activeServer) === 1)
        cache.servers[cacheIndexLookup("servers", activeServer)][4].push(
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

async function loadDMUserName(userID) {
  while (true) {
    if (activeRequests < 10) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  activeRequests++;
  let returnValue = await fetchResource(`users/${userID}`);
  activeRequests--;
  return returnValue;
}

async function loadDMs() {
  let channelContainer = document.getElementById("channels");
  let userCat = document.createElement("summary");
  userCat.classList.add("categoryText");
  //Clear channel field
  while (channelContainer.hasChildNodes()) {
    channelContainer.removeChild(channelContainer.lastChild);
  }
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
    if (!["DirectMessage", "Group"].includes(cache.channels[i][2])) continue;
    const dmButton = document.createElement("button");
    dmButton.classList.add("channel");
    //God, why did I do this
    if (cache.channels[i][2] === "Group") {
      dmButton.textContent = cache.channels[i][1];
    } else {
      if (cache.channels[i][1][1] === userProfile._id) {
        let user = await userLookup(cache.channels[i][1][1])
        dmButton.textContent = `@${user[1]}#${user[4]}`;
      } else {
        let user = await userLookup(cache.channels[i][1][1])
        dmButton.textContent = `@${user[1]}#${user[4]}`;
      }
    }
    dmButton.onclick = () => {
      getMessages(cache.channels[i][0]);
    };

    dmButton.id = cache.channels[i][0];

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
  let displayName = document.getElementById("displayname");
  let username = document.getElementById("username");
  let discriminator = document.getElementById("discrim");
  let profilePicture = document.getElementById("profilePicture");
  let profileBackground = document.getElementById("profileMedia");
  let bio = document.getElementById("bio");
  let roleContainer = document.getElementById("roleContainer");
  username.textContent = user[1];
  discriminator.textContent = user[4];
  if (user[2]) {
    profilePicture.src = `https://autumn.revolt.chat/avatars/${user[2]._id}`;
  } else {
    profilePicture.src = `https://api.revolt.chat/users/${userProfile._id}/default_avatar`
  }
  if (Object.keys(userProfile).indexOf("background") > -1) {
    profileBackground.style.background = `linear-gradient(0deg, rgba(0,0,0,0.8477591720281863) 4%, rgba(0,0,0,0) 50%),
        url(https://autumn.revolt.chat/backgrounds/${userProfile.background._id}) center center / cover`;
  } else profileBackground.style.background = "";
  bio.textContent = userProfile.content;

  while (roleContainer.hasChildNodes()) {
    roleContainer.removeChild(roleContainer.lastChild);
  }
  if (memberData.roles)
    for (let i = 0; i < memberData.roles.length; i++) {
      const role = document.createElement("span");
      const roleData = cacheLookup("roles", memberData.roles[i], activeServer);

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
  const messageContainer = document.getElementById("input");
  let message = messageContainer.value;
  //Checking for valid pings, and replacing with an actual ping
  if (message.search(/@[^ ]*/) != -1) {
    let pings = /@[^ ]*/[Symbol.match](message);
    for (let i = 0; i < pings.length; i++) {
      message = message.replace(
        pings[i],
        `<@${await userLookup(pings[i].replace("@", ""))[1]}>`
      );
    }
  }

  await fetch(`https://api.revolt.chat/channels/${activeChannel}/messages`, {
    headers: {
      "x-session-token": token,
    },
    method: "POST",
    body: JSON.stringify({
      content: message,
      replies: activeReplies,
    }),
  })
    .then((response) => response.json())
    .then((data) =>
      fetch(`https://api.revolt.chat/channels/${activeChannel}/ack/${data._id}`, { method: "PUT" })
    );
  messageContainer.value = "";
  activeReplies = [];
  document.querySelector(".replying-container").replaceChildren();
}

//
// UI/UX
//

let toolbar = document.querySelector(".toolbar");
let toolbarBtn = document.querySelector(".toolbar-btn");
toolbarBtn.addEventListener("click", () => {
  toolbar.classList.toggle("show-toolbar");
});
