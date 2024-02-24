// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Builds server, channel, and user caches
//

var cache = {
  //id, username, pfp, bot, displayname, relationship
  users: [],
  //0 is id, 1 is name, 2 is channel type, 3 is server, 4 is last message
  channels: [],
  //0 is id, 1 is name, 2 is server icon id, 3 is roles, 4 is members
  servers: [],
  //0 is id, 1 is author, 2 is content, masquerade
  messages: [],

  emotes: [],
};

function buildEmoteCache(emotes) {
  if (!emotes) return;

  emotes.forEach((emote) => {
    cache.emotes.push({
      id: emote._id,
      parent: emote.parent,
      creator: emote.creator_id,
      name: emote.name,
      animated: emote.animated,
      nsfw: emote.nsfw,
    });
  });
}

/*
 * Populates the server cache; only called from bonfire
 * @param {Array} servers A list of servers from the ready message
 * @return {Number} Error code; should never be 1
 * */
function buildServerCache(servers) {
  try {
    for (let i = 0; i < servers.length; i++) {
      cache.servers.push({
        id: servers[i]["_id"],
        name: servers[i]["name"],
        icon: servers[i].icon,
        background: servers[i].banner,
        roles: servers[i].roles,
        members: [], //Empty array to be populated later
        categories: servers[i].categories,
        channels: servers[i].channels,
      });
    }
  } catch (error) {
    showError(error);
    return 1;
  }
  return 0;
}

/*
 * Populates the user cache; doesn't clear it because there are many places that call it
 * @param {Array} users
 * @return {Number} Error code; should never be 1
 * */
function buildUserCache(users) {
  try {
    for (let i = 0; i < users.length; i++) {
      if (cacheLookup("users", users[i]._id) === 1)
        cache.users.push({
          id: users[i]._id,
          username: users[i].username,
          pfp: users[i].avatar
            ? `${settings.instance.autumn}/avatars/${users[i].avatar._id}`
            : `${settings.instance.delta}/users/${users[i]._id}/default_avatar`,
          bot: users[i].bot,
          discriminator: users[i].discriminator,
          displayName: users[i].display_name
            ? users[i].display_name
            : users[i].username,
          relationship: users[i].relationship,
          badges: getBadges(users[i].badges),
          status: users[i].status,
        });
    }
  } catch (error) {
    showError(error);
    return 1;
  }
  initUsers();
  return 0;
}

/*
 * Populates the channel cache; cleared on every run
 * @param {Array} channels  Array of channels returned by the ready function
 * @return {Number} Error code; should not ever be 1
 * */
function buildChannelCache(channels) {
  cache.channels.length = 0; //Clear the cache
  try {
    for (let i = 0; i < channels.length; i++) {
      switch (channels[i].channel_type) {
        case "TextChannel":
          cache.channels.push({
            id: channels[i]._id,
            name: channels[i].name,
            type: channels[i].channel_type,
            desc: channels[i].description,
            server: channels[i].server,
            lastMessage: channels[i].last_message_id,
            defaultPermissions: getPermissions(channels[i].default_permissions),
            rolePermissions: getRolePermissions(channels[i].role_permissions),
            icon: channels[i].icon ? channels[i].icon._id : undefined,
          });
          break;

        case "Group":
          cache.channels.push({
            id: channels[i]._id,
            name: channels[i].name,
            type: channels[i].channel_type,
            icon: channels[i].icon,
            desc: channels[i].description,
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
  } catch (error) {
    showError(error);
    return 1;
  }

  return 0;
}

/*
 * Badge processing function
 * @param badgesInt {Number} An integer containing the bitfield of badges
 * @return badges {Object} An object representing every badge that the user has
 * */
function getBadges(badgesInt) {
  if (!badgesInt) return null;
  let badges = {};

  Object.keys(storage.badges).forEach((key) => {
    badges[key] = Boolean(storage.badges[key].value & badgesInt);
  });

  return badges;
}

/*
 * Iterates over a list of roles and calculates permissions for each one
 * @param roleObjects {Object} An object containing all of the roles
 * @return permissions {Object} An object containing roleIDs as keys and permissions as values
 * */
function getRolePermissions(roleObjects) {
  if (!roleObjects) return null;
  let permissions = {};
  Object.keys(roleObjects).forEach((role) => {
    permissions[role] = getPermissions(roleObjects[role]);
  });

  return permissions;
}

/*
 * Calculate [relivant] permissions
 * @param permissionsInt {Number} An integer representation of the bitfield
 * @return permissions {Object} Allowed & Denied permissions
 * */
function getPermissions(permissionsInt) {
  if (!permissionsInt) return null;

  // Split into the bitfield; padStart is to ensure that it's the correct length
  let permissionsAllowedBit = permissionsInt["a"].toString(2).padStart(32, "0");
  let permissionsDeniedBit = permissionsInt["d"].toString(2).padStart(32, "0");

  // Assign values from the bitfield to an object
  let permissionsAllowed = {};
  Object.keys(storage.permissions).forEach((permission) => {
    permissionsAllowed[permission] =
      storage.permissions[permission] & permissionsAllowedBit;
  });

  let permissionsDenied = {};
  Object.keys(storage.permissions).forEach((permission) => {
    permissionsDenied[permission] =
      storage.permissions[permission] & permissionsDeniedBit;
  });

  return {
    Allowed: permissionsAllowed,
    Denied: permissionsDenied,
  };
}

//@license-end
