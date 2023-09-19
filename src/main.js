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
    fmtUser = [
      user._id,
      user.username,
      user.avatar,
      user.bot,
      user.discriminator,
      user.display_name,
      user.relationship,
    ];
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
            channel.classList.add("channel-unread");
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
        if(data.channel_id===activeChannel) document.querySelector("#messagesContainer").removeChild(document.getElementById(data.id));
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
          channel.classList.remove("channel-unread");
        }
        document.getElementById(
          cacheLookup("channels", data.id)[3]
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
        typingBar.appendChild(typingUserContainer);
        document.getElementById("typingBarContainer").style.display = "flex";
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
      unread.last_id < cacheLookup("channels", unread._id.channel)[4] &&
      mutedChannels.indexOf(unread._id.channel) === -1
    ) {
      unreadChannels.push(unread._id.channel);
    }
  });
  for (let i = 0; i < ordering.length; i++) {
    let server = document.createElement("button");
    let serverIndex = cacheIndexLookup("servers", ordering[i]);
    server.onclick = () => {
      activeServer = cache.servers[serverIndex][0];
      getChannels(cache.servers[serverIndex][0]);
      clearMessages();

      document.getElementById("serverName").innerText = cache.servers[serverIndex][1];
      document.getElementById("channelName").innerText = "";
    };
    cache.servers[serverIndex][6].forEach((channel) => {
      if (
        unreadChannels.indexOf(channel) !== -1 &&
        mutedChannels.indexOf(channel) === -1
      )
        server.style.boxShadow = `${cssVars.getPropertyValue(
          "--foreground"
        )} 0px 0px 0px 3px`;
    });
    if (mutedServers.indexOf(cache.servers[serverIndex][0]) !== -1)
      server.style.boxShadow = `hsl(0, 0%, 20%) 0px 0px 0px 3px`;

    server.id = cache.servers[serverIndex][0];

    if (cache.servers[serverIndex][2] == null) {
      server.innerText = cache.servers[serverIndex][1].charAt(0);
    } else {
      let serverIcon = document.createElement("img");
      serverIcon.classList.add("serverIcon");
      serverIcon.src = `https://autumn.revolt.chat/icons/${cache.servers[serverIndex][2]}?max_side=64`;
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
          document.getElementById("channelName").innerText = currentChannel[1];
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
  let defaultCategory = document.createElement("details");
  let defaultCategoryText = document.createElement("summary");

  defaultCategory.open = true;
  defaultCategory.classList.add("channel-category");
  defaultCategoryText.textContent = "Uncategorised";
  defaultCategoryText.classList.add("categoryText");
  defaultCategory.appendChild(defaultCategoryText);

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
  var messageDisplay = "";
  const messageContainer = document.getElementById("messagesContainer");

  if (id !== null) {
    messageDisplay = document.getElementById(id);
    messageDisplay.replaceChildren();
  }
  else {
    messageDisplay = document.createElement("div");
  }
  let messageActions = document.createElement("div");
  let messageContent = document.createElement("div");
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
  if(message.system) {
    user = await userLookup(message.system.id ? message.system.id : message.system.by);
  } else {
    user = await userLookup(message.author);
  }
  if (message.system) {
    username.textContent = user[1];
    profilepicture.src = user[2] ?
      `https://autumn.revolt.chat/avatars/${user[2]._id}?max_side=256` :
      `https://api.revolt.chat/users/${user[0]._id}/default_avatar`;

    messageContent.textContent = message.system.type;
    
    username.onclick = () => {
      loadProfile(user[0]);
    };
    profilepicture.onclick = () => {
      loadProfile(user[0]);
    };

    userdata.appendChild(profilepicture);
    userdata.appendChild(username);
    messageContainer.appendChild(userdata);
    messageContainer.appendChild(messageContent);
    return;
  } else {
    if (!message.masquerade) {
      username.textContent = member.nickname ? member.nickname : user[5] ? user[5] : user[1];
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
      if(message.masquerade.name) username.textContent = message.masquerade.name;
      else username.textContent = member.nickname ? member.nickname : user[5] ? user[5] : user[1];
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
  if (user[6] !== "Blocked") {
    messageContent.innerHTML = converter.makeHtml(message.content);
    if (message.mentions) {
      message.mentions.forEach(async (mention) => {
        if (messageContent.innerText.split(`<@${mention}>`).length === 0) return;
        let segConcat = document.createElement("div");
        let newSeg;
        messageContent.innerText.split(`<@${mention}>`).forEach((segment) => {
          newSeg = document.createElement("span");
          newSeg.innerText = segment;
          segConcat.appendChild(newSeg);
        });
        let ping = document.createElement("span");
        ping.classList.add("tag");
        ping.textContent = '@' + cacheLookup("users", mention)[5];
        segConcat.insertBefore(ping, newSeg);
        messageContent = segConcat;
        if (mention === userProfile._id) {
          messageContent.classList.add("selfMentioned");
        }
      });
    }
    //messageContent.appendChild(parsedMessage);
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
      messageContent.replaceChildren()
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
          "> " + cacheLookup("messages", message.replies[j])[2] + "\n";
        reply.appendChild(replyContent);
      }
      messageDisplay.appendChild(reply);
    }

    if (cache.messages.length === 0 || (cache.messages[cache.messages.length - 1][1] !== message.author || cache.messages[cache.messages.length - 1][3] !== undefined))
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
  } else {
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

    if (cache.messages.length === 0 || (cache.messages[cache.messages.length - 1][1] !== message.author || cache.messages[cache.messages.length - 1][3] !== undefined))
      messageDisplay.appendChild(userdata);
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
  };
  replyButton.innerText = "Reply";
  messageDisplay.appendChild(messageActions);
  messageActions.appendChild(replyButton);
  if( id===null)messageContainer.appendChild(messageDisplay);
  cache.messages.push([message._id, message.author, message.content, message.masquerade]);
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
      cache.users.push([
        users[i]._id,
        users[i].username,
        users[i].avatar,
        users[i].bot,
        users[i].discriminator,
        users[i].display_name,
        users[i].relationship,
      ]);
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
      cache.users.push([
        users[i]._id,
        users[i].username,
        users[i].avatar,
        users[i].bot,
        users[i].discriminator,
        users[i].display_name,
        users[i].relationship,
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
  let channelContainer = document.getElementById("channelsContainer");
  let userCat = document.createElement("summary");
  userCat.classList.add("categoryText");

  document.getElementById("serverName").innerText = "";
  document.getElementById("channelName").innerText = "";
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
    if (!["DirectMessage", "Group"].includes(cache.channels[i][2])) continue;
    const dmButton = document.createElement("button");
    dmButton.classList.add("channel");
    //God, why did I do this
    if (cache.channels[i][2] === "Group") {
      dmButton.textContent = cache.channels[i][1];
    } else {
      if (cache.channels[i][1][1] !== userProfile._id) {
        let user = await userLookup(cache.channels[i][1][1])
        dmButton.textContent = `@${user[1]}#${user[4]}`;
      } else {
        let user = await userLookup(cache.channels[i][1][0])
        dmButton.textContent = `@${user[1]}#${user[4]}`;
      }
    }
    dmButton.onclick = () => {
      getMessages(cache.channels[i][0]);
      document.getElementById("channelName").innerText = "FIXME";
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
  let displayName = document.getElementById("displayName");
  let username = document.getElementById("username");
  let discriminator = document.getElementById("discrim");
  let profilePicture = document.getElementById("profilePicture");
  let profileBackground = document.getElementById("profileMedia");
  let bio = document.getElementById("bio");
  let roleContainer = document.getElementById("roleContainer");
  username.textContent = `${user[1]}#${user[4]}`;
  displayName.textContent = user[5] ? user[5] : user[1];
  if (user[2]) {
    profilePicture.src = `https://autumn.revolt.chat/avatars/${user[2]._id}`;
  } else {
    profilePicture.src = `https://api.revolt.chat/users/${userProfile._id}/default_avatar`
  }
  if (Object.keys(userProfile).indexOf("background") > -1) {
    // TODO: this needs some refactoring so the style isn't applied here, but in css
    profileBackground.style.background = `linear-gradient(0deg, rgba(0,0,0,0.84) 4%, rgba(0,0,0,0) 50%),
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
  if (message.search(/@[^ ]*/) != -1) {
    let pings = /@[^ ]*/[Symbol.match](message);
    for (let i = 0; i < pings.length; i++) {
      if (await userLookup(pings[i].replace("@", "")) !== undefined) {
        message = message.replace(
          pings[i],
          `<@${await userLookup(pings[i].replace("@", ""))[0]}>`
        );
      }
    }
  }
  let embeds = undefined;
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

  let masquerade = undefined;
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
  })
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
}

//
// UI/UX
//

let toolbar = document.querySelector(".toolbar");
let toolbarBtn = document.querySelector(".toolbar-btn");
toolbarBtn.addEventListener("click", () => {
  toolbar.classList.toggle("show-toolbar");
});

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

function creatSettingDiv(settingName, settingValueType) { }
