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
};

/*
 * Populates the server cache; only called from bonfire
 * @param {Array} servers A list of servers from the ready message
 * @return {Number} Error code; should never be 1
 * */
async function buildServerCache(servers) {
  cache.servers.length = 0; // Clear the cache
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
    return 0;
  } catch (error) {
    showError(error);
    return 1;
  }
}

/*
 * Populates the user cache; doesn't clear it because there are many places that call it
 * @param {Array} users
 * @return {Number} Error code; should never be 1
 * */
async function buildUserCache(users) {
  try {
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
          badges: getBadges(users[i].badges),
          status: users[i].status,
        });
    }
    return 0;
  } catch (error) {
    showError(error);
    return 1;
  }
}

/*
 * Populates the channel cache; cleared on every run
 * @param {Array} channels  Array of channels returned by the ready function
 * @return {Number} Error code; should not ever be 1
 * */
async function buildChannelCache(channels) {
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
          });
          break;

        case "Group":
          cache.channels.push({
            id: channels[i]._id,
            name: channels[i].name,
            type: channels[i].channel_type,
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

  try {
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
  } catch (error) {
    showError(error);
    return 1;
  }
}

/*
 * Badge processing function
 * @param badgesInt {Number} An integer containing the bitfield of badges
 * @return badges {Object} An object representing every badge that the user has
 * */
function getBadges(badgesInt) {
  if (!badgesInt) return null;
  let badgesBit = badgesInt.toString(2);

  let badges = {
    Supporter: badgesBit[0],
    Translator: badgesBit[1],
    Developer: badgesBit[2],
    ResponsibleDisclosure: badgesBit[3],
    Founder: badgesBit[4],
    Paw: badgesBit[5],
    ActiveSupporter: badgesBit[6],
    PlatformModeration: badgesBit[7],
    EarlyAdopter: badgesBit[8],
    ReservedRelevantJokeBadge1: badgesBit[9],
    ReservedRelevantJokeBadge2: badgesBit[10],
  };
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

  // Split into the bitfield
  let permissionsAllowedBit = permissionsInt["a"].toString(2);
  let permissionsDeniedBit = permissionsInt["d"].toString(2);

  // Assign values from the bitfield to an object
  let permissionsAllowed = {
    ViewChannel: Boolean(permissionsAllowedBit[20]),
    ReadMessageHistory: Boolean(permissionsAllowedBit[21]),
    SendMessage: Boolean(permissionsAllowedBit[22]),
    ManageMessages: Boolean(permissionsAllowedBit[23]),
    SendEmbeds: Boolean(permissionsAllowedBit[26]),
    UploadFiles: Boolean(permissionsAllowedBit[27]),
    Masquerade: Boolean(permissionsAllowedBit[28]),
    React: Boolean(permissionsAllowedBit[29]),
  };

  let permissionsDenied = {
    ViewChannel: Boolean(permissionsDeniedBit[20]),
    ReadMessageHistory: Boolean(permissionsDeniedBit[21]),
    SendMessage: Boolean(permissionsDeniedBit[22]),
    ManageMessages: Boolean(permissionsDeniedBit[23]),
    SendEmbeds: Boolean(permissionsDeniedBit[26]),
    UploadFiles: Boolean(permissionsDeniedBit[27]),
    Masquerade: Boolean(permissionsDeniedBit[28]),
    React: Boolean(permissionsDeniedBit[29]),
  };
  return {
    Allowed: permissionsAllowed,
    Denied: permissionsDenied,
  };
}

//@license-end
