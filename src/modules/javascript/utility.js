//
//Utility funcitons
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

  if (
    channel.defaultPermissions &&
    channel.defaultPermissions["Denied"][permission] === "0"
  ) {
    if (
      (roles = cacheLookup("members", state.connection.userProfile._id, channel.server).roles) &&
      channel.rolePermissions
    ) {
      roles.forEach((role) => {
        if (
          channel.rolePermissions[role] &&
          (channel.rolePermissions[role]["Allowed"][permission] === "1" ||
            channel.rolePermissions[role]["Denied"] === "0")
        )
          return true;
      });
    }
    return false;
  } else {
    return true;
  }
}

// Basically the same as the function above, but fetches the user and adds it to the cache if it isn't found
async function userLookup(ID) {
  if (cacheLookup("users", ID) !== 1) return cacheLookup("users", ID);
  user = await fetchResource(`users/${ID}`);

  buildUserCache([user]);
  return cacheLookup("users", ID);
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

function showError(error) {
  let errorContainer;
  if (state.errorTimeout) clearTimeout(state.errorTimeout);

  if (!state.connection.token)
    errorContainer = document.querySelector("#loginErrorContainer");
  else
    errorContainer = document.querySelector("#errorContainer");

  errorContainer.style.display = "block";

  errorContainer.querySelector("#loginErrorContent").innerText = `${error.name}: ${error.message}`; //Only has one child, therefore this is safe

  state.errorTimeout = setTimeout(() => {
    errorContainer.style.display = "none";
  }, 30000); //30 seconds
}

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

function getRolePermissions(roleObjects) {
  if (!roleObjects) return null;
  let permissions = {};
  Object.keys(roleObjects).forEach((role) => {
    permissions[role] = getPermissions(roleObjects[role]);
  });
  return permissions;
}

function scrollChatToBottom() {
  const element = document.querySelector("#messagesContainer");
  element.scrollTo(0, element.scrollHeight);
}
