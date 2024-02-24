// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Utility funcitons
//

/**
 * Looks up the given resource by id from the cache
 * @param {String} resource The resource in the cache to look up
 * @param {String} ID ID of the resource
 * @param {String} serverID=null Only used for members and roles
 * @returns {Object:Number} The object of the cached item; returns 1 if not found
 */
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

/**
 * Basically the same as the function above, but fetches the user and adds it to the cache if it isn't found
 * @param {String} ID ID of the user
 * @returns {Object:Number} Returns the object of that cache item, 1 if not found
 */
async function userLookup(ID) {
  if (cacheLookup("users", ID) !== 1) return cacheLookup("users", ID);
  user = await fetchResource(`users/${ID}`);

  buildUserCache([user]);
  return cacheLookup("users", ID);
}

/**
 * Checks whether or not the user has a specific permission in a specific channel
 * @param {String} channelID  ID if the channel to check for the permission in
 * @param {String} permission Name of the permission
 * @returns {Boolean} True if the user has the permission, false if not
 */
function checkPermission(channelID, permission) {
  const channel = cacheLookup("channels", channelID);

  if (
    channel.defaultPermissions &&
    channel.defaultPermissions.Denied[permission]
  ) {
    if (
      (roles = cacheLookup(
        "members",
        state.connection.userProfile._id,
        channel.server
      ).roles) &&
      channel.rolePermissions
    ) {
      return roles.some((role) => {
        //Some returns a value, hence its use here
        if (
          channel.rolePermissions[role] &&
          (channel.rolePermissions[role].Allowed[permission] || //If it's allowed or not explicitly denied
            !channel.rolePermissions[role].Denied[permission])
        )
          return true;
      });
    }
    return false;
  } else {
    return true;
  }
}

/**
 * Looks up the given resource by id and returns the index
 * @param {any} resource Name of the resource
 * @param {any} ID ID of the resource
 * @returns {number} Returns the index of that specific resource, -1 if not found
 */
function cacheIndexLookup(resource, ID, serverID = undefined) {
  if (resource === "members") {
    const server = cacheLookup("servers", serverID);
    for (let i = 0; i < server.members.length; i++) {
      if (server.members[i].id === ID) return i;
    }
  } else {
    for (let i = 0; i < cache[resource].length; i++) {
      if (cache[resource][i].id === ID) return i;
    }
  }
  return -1;
}

/**
 * Macro to fetch remote resources
 * @param {String} target The relative URL to fetch from
 * @returns {Object} The Object of the returned data
 */
async function fetchResource(target) {
  //Return of false means that it failed
  try {
    return await fetch(`${settings.instance.delta}/${target}`, {
    headers: {
      "x-session-token": state.connection.token,
    },
    method: "GET",
  })
    .then((res) => res.json());
  } catch (e) {
    showError({name: "loginError", message: e});
    return false;
  }
}

/**
 * Updates unreads from the parameters
 * @param {String} channelID ID of the channel
 * @param {String} messageID ID of the message
 * @param {Boolean} unread=true Whether or not to mark the resource as unread
 * @param {Boolean} mentioned=false Whether or not to mark the resource as having been mentioned
 * @returns {Number} Returns -1 for some reason, TODO: investigate
 */
async function updateUnreads(
  channelID,
  messageID,
  unread = true,
  mentioned = false
) {
  if (unread) {
    if (state.unreads.unread.channels.indexOf(channelID) === -1)
      state.unreads.unread.channels.push(channelID);

    if (state.unreads.mentioned.channels.indexOf(channelID) === -1 && mentioned)
      state.unreads.mentioned.channels.push(channelID);
  } else {
    state.unreads.unread.channels.splice(
      state.unreads.unread.channels.indexOf(channelID),
      1
    );

    if (state.unreads.mentioned.channels.indexOf(channelID) !== -1)
      state.unreads.mentioned.channels.splice(
        state.unreads.mentioned.channels.indexOf(channelID),
        1
      );
  }

  for (let i = 0; i < state.unreads.unreadList.length; i++) {
    if (state.unreads.unreadList[i]._id.channel === channelID) {
      state.unreads.unreadList[i].last_id = messageID;
      return 0;
    }
  }
  return -1;
}

/**
 * Add a file to the attachment list
 * @param {File} file The file to add
 * @returns {null} Doesn't return
 */
function addFile(file) {
  if (state.messageMods.attachments.length >= 5) return;
  if (!checkPermission(state.active.channel, "UploadFiles")) return;

  const upload = file;
  const uploadsContainer = document.getElementById("uploadsBarContainer");

  let attachmentContainer = document.createElement("div");
  let uploadPreview = document.createElement("img");
  let attachmentText = document.createElement("span");

  if (upload.type.startsWith("image")) {
    var fr = new FileReader();
    fr.onload = function () {
      uploadPreview.src = fr.result;
    };
    fr.readAsDataURL(upload);
  }

  attachmentContainer.onclick = () => {
    const uploadContainer = document.getElementById(`IMG-${upload.name}`);
    uploadContainer.parentNode.removeChild(uploadContainer);
    attachments.splice(upload, 1);
  };

  attachmentContainer.classList.add("attachmentContainer");
  attachmentContainer.id = `IMG-${upload.name}`;
  attachmentText.innerText = upload.name;

  attachmentContainer.appendChild(uploadPreview);
  attachmentContainer.appendChild(attachmentText);

  uploadsContainer.appendChild(attachmentContainer);

  uploadsContainer.hidden = false;

  state.messageMods.attachments.push(upload);
}

/**
 * Macro to scroll to the bottom of the chatbox
 * @returns {none} Doesn't return
 */
function scrollChatToBottom() {
  const element = document.querySelector("#messagesContainer");
  element.scrollTo(0, element.scrollHeight);
}

function updateUser(dataObject) {
  const userID =
    Object.keys(dataObject.id).indexOf("user") !== -1
      ? dataObject.id.user
      : dataObject.id;

  if ((user = cacheLookup("users", userID)) === 1) return; //Don't bother if the user isn't in the cache

  let memberIndex;
  let serverIndex;
  let member;
  const userIndex = cacheIndexLookup("users", userID);

  if (dataObject.type === "ServerMemberUpdate") {
    memberIndex = cacheIndexLookup(
      "members",
      dataObject.id.user,
      dataObject.id.server
    );
    serverIndex = cacheIndexLookup("servers", dataObject.id.server);
    member = cacheLookup("members", dataObject.id.user, dataObject.id.server);
  } else member = cacheLookup("members", userID, state.active.server);

  Object.keys(dataObject.data).forEach((field) => {
    switch (field) {
      case "status": {
        cache.users[userIndex].status = dataObject.data.status;
        document
          .querySelectorAll(`#USRNM-${userID} > .presence-icon`)
          .forEach((element) => {
            element.src = `../assets/images/presence/${dataObject.data.status.presence}.svg`;
          });
        break;
      }

      case "display_name": {
        if (member.nickname) break;
        cache.users[userIndex].display_name = dataObject.data.display_name;
        document
          .querySelectorAll(`#USRNM-${userID} > .username`)
          .forEach((element) => {
            element.textContent = dataObject.data.display_name;
          });
        break;
      }

      case "avatar": {
        if (dataObject.type === "ServerMemberUpdate") {
          if (memberIndex !== -1)
            cache.servers[serverIndex].members[memberIndex].avatar =
              dataObject.data.avatar._id;
          else
            cache.servers[serverIndex].members.push({
              _id: { user: userID, server: dataObject.id.server },
              avatar: dataObject.data.avatar._id,
            });
        } else cache.users[userIndex].pfp = dataObject.data.avatar._id;

        if (
          dataObject.type === "ServerMemberUpdate" &&
          dataObject.id.server !== state.active.server
        )
          break;

        if (
          dataObject.type === "ServerMemberUpdate" ||
          !(member && member.avatar)
        ) {
          document
            .querySelectorAll(`#USRNM-${userID} > .chat-pfp`)
            .forEach((element) => {
              element.src = `${settings.instance.autumn}/avatars/${dataObject.data.avatar._id}`;
            });
        }
        break;
      }

      case "nickname": {
        if (memberIndex !== -1)
          cache.servers[serverIndex].members[memberIndex].nickname =
            dataObject.data.nickname;
        else
          cache.servers[serverIndex].members.push({
            _id: { user: userID, server: dataObject.id.server },
            nickname: dataObject.data.nickname,
          });
        document
          .querySelectorAll(`#USRNM-${userID} > .username`)
          .forEach((element) => {
            element.textContent = dataObject.data.nickname;
          });
      }
    }
  });

  if (dataObject.clear) {
    dataObject.clear.forEach((field) => {
      switch (field) {
        case "ProfileContent": {
          break;
        }

        case "ProfileBackground": {
          break;
        }

        case "StatusText": {
          cache.users[userIndex].status.text = undefined;
          break;
        }

        case "Avatar": {
          if (dataObject.type === "ServerMemberUpdate") {
            if (memberIndex !== -1)
              cache.servers[serverIndex].members[memberIndex] = undefined;
            document
              .querySelectorAll(`#USRNM-${userID} > .chat-pfp`)
              .forEach((element) => {
                element.src = `${settings.instance.autumn}/avatars/${user.pfp._id}`;
              });
          } else {
            cache.users[userIndex].avatar = undefined;
            if (!member || (member && !member.avatar))
              document
                .querySelectorAll(`#USRNM-${userID} > .chat-pfp`)
                .forEach((element) => {
                  element.src = `${settings.instance.delta}/users/${userID}/default_avatar`;
                });
          }
          break;
        }

        case "Nickname": {
          if (memberIndex !== -1)
            cache.servers[serverIndex].members[memberIndex].nickname =
              undefined;
          document
            .querySelectorAll(`#USRNM-${userID} > .username`)
            .forEach((element) => {
              element.textContent = user.displayName;
            });
          break;
        }

        case "Avatar": {
          cache.servers[serverIndex].members[memberIndex].avatar = undefined;
          document
            .querySelectorAll(`#USRNM-${userID} > .chat-pfp`)
            .forEach((element) => {
              if (user.pfp)
                element.src = `${settings.instance.autumn}/avatars/${user.pfp._id}`;
              else
                element.src = `${settings.instance.delta}/users/${user.id}/default_avatar`;
            });
          break;
        }
      }
    });
  }
}

function formatTranslationKey(input, key, replacement) {
  return input.replace(`{{${key}}}`, replacement);
}

//Note: Copy-pasted from stackoverflow, link: https://stackoverflow.com/questions/47062922/
function* deepKeys(t, pre = []) {
  if (Array.isArray(t)) return;
  else if (Object(t) === t)
    for (const [k, v] of Object.entries(t)) yield* deepKeys(v, [...pre, k]);
  else yield pre.join(".");
}

function valueOfDeepKey(keys, object) {
  val = object[keys[0]];
  if (Object(val) === val) {
    keys.shift();
    return valueOfDeepKey(keys, val);
  } else return val;
}

async function updateLanguage() {
  await fetch(`../assets/languages/${settings.visual.language.value}.json`)
    .then((res) => res.json())
    .then((res) => (storage.language = res));
  if (storage.language.config["text-direction"] === "RL") {
    let sheet = ".translatable {direction:rtl;}";
    let style = document.createElement("style");
    style.innerText = sheet;

    document.head.appendChild(style);
  }
  Array.from(deepKeys(storage.language)).forEach((translationKey) => {
    if ((element = document.querySelector(`*[name="${translationKey}"]`))) {
      let value = valueOfDeepKey(translationKey.split("."), storage.language);
      switch (element.tagName) {
        case "INPUT":
          element.placeholder = value;
        default:
          element.innerText = value;
      }
    } else {
      debugInfo(`Translatable element not found: ${translationKey}`);
    }
  });
}

//@license-end
