//
// Functions related to server caching and rendering
//


// Renders servers from the cache
async function getServers() {
  let serverContainer = document.getElementById("serversContainer");
  serverContainer.replaceChildren();

  state.unreads.unreadList.forEach((unread) => {
    if (
      unread.last_id <
        cacheLookup("channels", unread._id.channel).lastMessage &&
      state.unreads.muted.channels.indexOf(unread._id.channel) === -1
    ) {
      state.unreads.unread.messages.push(unread.last_id);
      state.unreads.unread.channels.push(unread._id.channel);
      if (unread.mentions) state.unreads.mentions.channels.push(unread._id.channel);
      if (unread.mentions) state.unreads.mentions.servers.push(cacheLookup("channels", unread._id.channel).server);
    }
  });

  for (let i = 0; i < state.ordering.length; i++) {
    let server = document.createElement("button");
    let serverIndex = cacheIndexLookup("servers", state.ordering[i]);

    server.onclick = () => {
      state.active.server = cache.servers[serverIndex].id;
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
        if (state.unreads.unread.channels.indexOf(channel) !== -1) {
          server.classList.add(
            state.unreads.mentioned.channels.indexOf(channel) !== -1
              ? "mentionedServer"
              : "unreadServer",
          );
        }
      });
    }

    if (state.unreads.muted.servers.indexOf(cache.servers[serverIndex].id) !== -1) {
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

