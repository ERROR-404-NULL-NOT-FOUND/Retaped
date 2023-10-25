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

  if (channel.defaultPermissions &&
    channel.defaultPermissions.Denied[permission]) {
    if ((roles = cacheLookup("members", state.connection.userProfile._id, channel.server).roles) &&
      channel.rolePermissions) {

      return roles.some((role) => { //Some returns a value, hence its use here
        if (channel.rolePermissions[role] &&
          (channel.rolePermissions[role].Allowed[permission] || //If it's allowed or not explicitly denied
            !channel.rolePermissions[role].Denied[permission]))
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
function cacheIndexLookup(resource, ID) {
  for (let i = 0; i < cache[resource].length; i++) {
    if (cache[resource][i].id === ID) return i;
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
  const res = await fetch(`${settings.instance.delta}/${target}`, {
    headers: {
      "x-session-token": state.connection.token,
    },
    method: "GET",
  })
    .then((res) => res.json())
    .catch((error) => {
      showError(error);
      return false;
    });
  return res;
}

/**
 * Updates unreads from the parameters
 * @param {String} channelID ID of the channel
 * @param {String} messageID ID of the message
 * @param {Boolean} unread=true Whether or not to mark the resource as unread
 * @param {Boolean} mentioned=false Whether or not to mark the resource as having been mentioned
 * @returns {Number} Returns -1 for some reason, TODO: investigate
 */
async function updateUnreads(channelID, messageID, unread = true, mentioned = false) {
  if (unread) {
    if (state.unreads.unread.channels.indexOf(channelID) === -1) state.unreads.unread.channels.push(channelID);
  }
  else state.unreads.unread.channels.splice(state.unreads.unread.channels.indexOf(channelID), 1);

  if (state.unreads.mentioned.channels.indexOf(channelID) !== -1) state.unreads.mentioned.channels.splice(state.unreads.mentioned.channels.indexOf(channelID), 1);

  if (mentioned) {
    if (unread) {
      if (state.unreads.mentioned.channels.indexOf(channelID) === -1) state.unreads.mentioned.channels.push(channelID);
    }
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
 * Macro for showing error codes
 * @param {Object} error Object of the error to display
 * @returns {none} Doesn't return
 */
async function showError(error) {
  let errorContainer;
  if (state.errorTimeout) clearTimeout(state.errorTimeout);

  if (!state.connection.token)
    errorContainer = document.querySelector("#loginErrorContainer");
  else errorContainer = document.querySelector("#errorContainer");

  errorContainer.style.display = "block";

  errorContainer.querySelector(
    "#loginErrorContent"
  ).innerText = `${error.name}: ${error.message}`; //Only has one child, therefore this is safe

  state.errorTimeout = setTimeout(() => {
    errorContainer.style.display = "none";
  }, 30000); //30 seconds
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

//@license-end