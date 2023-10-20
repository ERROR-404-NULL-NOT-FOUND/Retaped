//
// Functions related to server caching and rendering
//

var settings = {
  behaviour: {
    dataSaver: false,
    extremeDataSaver: false,
    loadImages: true,
    rememberMe: true,
  },
  visual: {
    legacyStyleSheet: false,
    compactMode: false,
    revoltTheme: true,
  },
  instance: {
    delta: "https://api.revolt.chat",
    bonfire: "wss://ws.revolt.chat",
    autumn: "https://autumn.revolt.chat",
    january: "https://jan.revolt.chat",
    assets: "https://app.revolt.chat",
    legacyEmotes: "https://dl.insrt.uk",
  }
};

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
      if (unread.mentions) unreadMentions.push(unread._id.channel);
    }
  });

  for (let i = 0; i < ordering.length; i++) {
    let server = document.createElement("button");
    let serverIndex = cacheIndexLookup("servers", ordering[i]);

    server.onclick = () => {
      activeServer = cache.servers[serverIndex].id;
      getChannels(cache.servers[serverIndex].id);

      //Loki TODO: styling
      if (cache.servers[serverIndex].background)
        document.querySelector(
          "#serverBG",
        ).src = `${settings.instance.autumn}/banners/${cache.servers[serverIndex].background._id}?width=480`;

      document.getElementById("serverName").innerText =
        cache.servers[serverIndex].name;
      document.getElementById("channelName").innerText = "";
    };

    if (cache.servers[serverIndex].channels) {
      cache.servers[serverIndex].channels.forEach((channel) => {
        if (unreadChannels.indexOf(channel) !== -1) {
          server.classList.add(
            unreadMentions.indexOf(channel) !== -1
              ? "mentionedServer"
              : "unreadServer",
          );
        }
      });
    }

    if (mutedServers.indexOf(cache.servers[serverIndex].id) !== -1) {
      server.classList.remove("mentionedServer");
      server.classList.remove("unreadServer");
    }

    server.classList.add("server");

    server.id = `SERVER-${cache.servers[serverIndex].id}`;

    if (cache.servers[serverIndex].icon === undefined) {
      server.innerText = cache.servers[serverIndex].name.charAt(0);
    } else {
      let serverIcon = document.createElement("img");

      serverIcon.classList.add("serverIcon");
      serverIcon.src = `${settings.instance.autumn}/icons/${cache.servers[serverIndex].icon._id}?max_side=64`;
      server.appendChild(serverIcon);
    }

    serverContainer.appendChild(server);
  }
}

