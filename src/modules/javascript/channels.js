//
// Anything related to channel rendering
//

async function loadDMs() {
  let channelContainer = document.getElementById("channelsContainer");
  let userCat = document.createElement("summary");

  activeChannel = "";

  userCat.classList.add("categoryText");

  document.querySelector("#serverBG").src = ``;

  document.getElementById("serverName").innerText = "Direct Messages";
  document.getElementById("channelName").innerText = "";
  channelContainer.replaceChildren();
  clearMessages();

  await fetchResource(`users/${userProfile._id}/dm`).then((response) => {
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

      if (cache.channels[i].recipients[1] !== userProfile._id) {
        user = await userLookup(cache.channels[i].recipients[1]);
      } else {
        user = await userLookup(cache.channels[i].recipients[0]);
      }

      dmButton.textContent = `@${user.username}#${user.discriminator}`;
    }

    dmButton.onclick = () => {
      getMessages(cache.channels[i].id);
      document.getElementById("channelName").innerText = dmButton.textContent;
    };

    dmButton.id = cache.channels[i].id;
    userCat.appendChild(dmButton);
  }
  channelContainer.appendChild(userCat);
}

// Renders channels from the cache
async function getChannels(id) {
  let channelContainer = document.getElementById("channelsContainer");
  const server = cacheLookup("servers", activeServer);
  channelContainer.replaceChildren();

  fetchResource(`servers/${id}/members/${userProfile._id}`).then((member) => {
    if (cacheLookup("members", member._id.user, activeServer) === 1)
      cache.servers[cacheIndexLookup("servers", activeServer)].members.push(
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
            document.getElementById("channelName").innerText =
              currentChannel.name;
          };

          channel.id = currentChannel.id;
          channelText.innerText = currentChannel.name;

          if (
            unreadChannels.indexOf(currentChannel.id) !== -1 &&
            mutedChannels.indexOf(currentChannel.id) === -1
          ) {
            if (unreadMentions.indexOf(currentChannel.id) !== -1)
              channel.classList.add("mentionedChannel");
            else channel.classList.add("unreadChannel");
          }

          channel.appendChild(channelText);

          if (mutedChannels.indexOf(currentChannel.id) !== -1)
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

    for (let i = 0; i < unreads.length; i++) {
      if (unreads[i]["_id"].channel === currentChannel.id) {
        //currentChannel[0] is the ID of the channel currently being returned
        if (
          mutedChannels.indexOf(currentChannel.id) === -1 &&
          currentChannel.lastMessage > unreads[i].lastMessage
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

