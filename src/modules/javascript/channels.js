// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0
//
// Anything related to channel rendering
//

async function loadDMs() {
  let channelContainer = document.querySelector("#channelsContainer");
  let userCat = document.createElement("summary");

  state.active.channel = "";

  userCat.classList.add("categoryText");

  document.querySelector("#serverBG").src = '';

  document.querySelector("#serverName").innerText = "Direct Messages";
  document.querySelector("#channelName").innerText = "";
  channelContainer.replaceChildren();
  clearMessages();

  await fetchResource(`users/${state.connection.userProfile._id}/dm`).then((response) => {
    const dmButton = document.createElement("button");

    dmButton.textContent = "Saved messages";
    dmButton.classList.add("channel");
    dmButton.onclick = () => {
      getMessages(response._id);
    };

    dmButton.id = response._id;
    userCat.appendChild(dmButton);
  });

  for (let i = 0; i < cache.channels.length; i++) {
    //Checking for only DMs
    if (!["DirectMessage", "Group"].includes(cache.channels[i].type)) continue;

    const dmButton = document.createElement("button");
    dmButton.classList.add("channel");

    if (cache.channels[i].type === "Group") {
      dmButton.textContent = cache.channels[i].name;
    } else {
      let user;

      if (cache.channels[i].recipients[1] !== state.connection.userProfile._id) {
        user = await userLookup(cache.channels[i].recipients[1]);
      } else {
        user = await userLookup(cache.channels[i].recipients[0]);
      }

      dmButton.textContent = `@${user.username}#${user.discriminator}`;
    }

    dmButton.onclick = () => {
      getMessages(cache.channels[i].id);
      document.querySelector("#channelName").innerText = dmButton.textContent;
      document.querySelector("#channelDesc").innerText.length = 0;
    };

    dmButton.id = cache.channels[i].id;
    userCat.appendChild(dmButton);
  }
  channelContainer.appendChild(userCat);
}

// Renders channels from the cache
async function getChannels(id) {
  let channelContainer = document.querySelector("#channelsContainer");
  const server = cacheLookup("servers", state.active.server);
  channelContainer.replaceChildren();

  fetchResource(`servers/${id}/members/${state.connection.userProfile._id}`).then((member) => {
    if (cacheLookup("members", member._id.user, state.active.server) === 1)
      cache.servers[cacheIndexLookup("servers", state.active.server)].members.push(
        member,
      );
  });

  let addedChannels = [];
  if (server.categories) {
    server.categories.forEach((category) => {
      let categoryContainer = document.createElement("details");
      let categoryText = document.createElement("summary");

      categoryContainer.open = true;
      categoryContainer.classList.add("channel-category");

      categoryText.textContent = category.title;
      categoryText.classList.add("categoryText");
      categoryContainer.appendChild(categoryText);

      if (category.channels) {
        for (let j = 0; j < category.channels.length; j++) {
          const currentChannel = cacheLookup("channels", category.channels[j]);
          let channel = document.createElement("button");
          let channelText = document.createElement("span");
          if (currentChannel.type !== "TextChannel") continue;

          addedChannels.push(currentChannel.id);

          channel.classList.add("channel");

          channel.onclick = () => {
            getMessages(currentChannel.id);
            document.querySelector("#channelName").innerText =
              currentChannel.name;

            //Channel description setting; the expression checks whether or not the channel has a desc
            document.querySelector("#channelDesc").innerText = currentChannel.desc ?
              currentChannel.desc :
              "This channel doesn't have a description yet"
          };

          channel.id = currentChannel.id;
          channelText.innerText = currentChannel.name;

          if (
            state.unreads.unread.channels.indexOf(currentChannel.id) !== -1 &&
            state.unreads.muted.channels.indexOf(currentChannel.id) === -1
          ) {
            if (state.unreads.mentioned.channels.indexOf(currentChannel.id) !== -1)
              channel.classList.add("mentionedChannel");
            else channel.classList.add("unreadChannel");
          }

          channel.appendChild(channelText);

          if (state.unreads.muted.channels.indexOf(currentChannel.id) !== -1)
            channel.classList.add("mutedChannel");
          categoryContainer.appendChild(channel);
        }
      }

      channelContainer.appendChild(categoryContainer);
    });
  }

  let defaultCategory = document.createElement("details");
  let defaultCategoryText = document.createElement("summary");

  defaultCategory.open = true;
  defaultCategory.classList.add("channel-category");
  defaultCategoryText.textContent = "Uncategorised";
  defaultCategoryText.classList.add("categoryText");
  defaultCategory.appendChild(defaultCategoryText);

  for (let i = 0; i < cache.channels.length; i++) {
    if (
      cache.channels[i].server !== id ||
      cache.channels[i].type !== "TextChannel" ||
      addedChannels.indexOf(cache.channels[i].id) !== -1
    )
      continue;

    const currentChannel = cache.channels[i];

    addedChannels.push(currentChannel.id);

    let channel = document.createElement("button");
    channel.classList.add("channel");

    for (let i = 0; i < state.unreads.unreadList.length; i++) {
      if (state.unreads.unreadList[i]["_id"].channel === currentChannel.id) {
        //currentChannel[0] is the ID of the channel currently being returned
        if (
          state.unreads.muted.channels.indexOf(currentChannel.id) === -1 &&
          currentChannel.lastMessage > state.unreads.unreadList[i].lastMessage
        )
          channel.style.fontWeight = "bold";

        break;
      }
    }

    let channelText = document.createElement("span");
    channelText.id = currentChannel.id;
    channelText.innerText = currentChannel.name;

    channel.appendChild(channelText);
    defaultCategory.appendChild(channel);
  }

  channelContainer.insertBefore(defaultCategory, channelContainer.children[0]);
}


//@license-end