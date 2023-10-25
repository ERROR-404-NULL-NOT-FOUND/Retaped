// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Functions related to server caching and rendering
//


// Renders servers from the cache
/**
 * Renders servers from the cache
 * @returns {null} Doesn't return
 */
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
      if (unread.mentions) state.unreads.mentioned.channels.push(unread._id.channel);
      if (unread.mentions) state.unreads.mentioned.servers.push(cacheLookup("channels", unread._id.channel).server);
    }
  });

  for (let i = 0; i < state.ordering.length; i++) {
    const server = document.createElement("button");
    const serverIndex = cacheIndexLookup("servers", state.ordering[i]);
    const serverInfo = cacheLookup("servers", state.ordering[i]);
    if (serverInfo === 1) {
      showError({
        name: "AttributeError",
        message: "A server in your server ordering does not exist",
      });
      continue;
    }

    server.onclick = () => {
      getChannels(cache.servers[serverIndex].id);

      //Loki TODO: styling
      if (cache.servers[serverIndex].background)
        document.querySelector(
          "#serverBG"
        ).src = `${settings.instance.autumn}/banners/${serverInfo.background._id}?width=480`;
      else document.querySelector("#serverBG").src = "";

      document.getElementById("serverName").innerText = serverInfo.name;
    };

    if (serverInfo.channels) {
      serverInfo.channels.forEach((channel) => {
        if (state.unreads.unread.channels.indexOf(channel) !== -1) {
          server.classList.add(
            state.unreads.mentioned.channels.indexOf(channel) !== -1
              ? "mentioned-server"
              : "unread-server"
          );
        }
      });
    }

    if (state.unreads.muted.servers.indexOf(serverInfo.id) !== -1) {
      server.classList.remove("mentioned-server");
      server.classList.remove("unread-server");
    }

    server.classList.add("server");

    server.id = `SERVER-${serverInfo.id}}`;

    if (serverInfo.icon === undefined) {
      server.innerText = serverInfo.name.charAt(0);
    } else {
      let serverIcon = document.createElement("img");

      serverIcon.classList.add("serverIcon");
      serverIcon.src = `${settings.instance.autumn}/icons/${serverInfo.icon._id}?max_side=64`;
      server.appendChild(serverIcon);
    }

    serverContainer.appendChild(server);
  }
}

//@license-end
