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

//Populates the server cache from the given argument; only called from bonfire  
async function buildServerCache(servers) {
  for (let i = 0; i < servers.length; i++) {
    cache.servers.push({
      id: servers[i]["_id"],
      name: servers[i]["name"],
      icon: servers[i].icon,
      background: servers[i].banner,
      roles: servers[i].roles,
      members: [],
      categories: servers[i].categories,
      channels: servers[i].channels,
    });
  }
  getServers();
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
      badges: getBadges(users[i].badges),
    });
  }
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
  };
  return { Allowed: permissionsAllowed, Denied: permissionsDenied };
}
