// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0
//
// Anything related to channel rendering
//

/*
 * Load the user's DMs
 * @return {Number} Error code; should never be one
 * */
async function loadDMs() {
  try {
    const channelContainer = document.querySelector("#channelsContainer");
    const userCat = document.createElement("summary");

    state.active.channel = "";

    userCat.classList.add("categoryText");

    document.querySelector("#serverBG").src = "";

    document.querySelector("#serverName").innerText = "Direct Messages";
    document.querySelector("#channelName").innerText = "";
    channelContainer.replaceChildren();
    clearMessages();

    await fetchResource(`users/${state.connection.userProfile._id}/dm`).then(
      (response) => {
        const dmButton = document.createElement("button");

        dmButton.textContent = "Saved messages";
        dmButton.classList.add("channel");
        dmButton.onclick = () => {
          getMessages(response._id);
        };

        dmButton.id = response._id;
        userCat.appendChild(dmButton);
      }
    );

    for (let i = 0; i < cache.channels.length; i++) {
      //Checking for only DMs
      if (!["DirectMessage", "Group"].includes(cache.channels[i].type))
        continue;

      const dmButton = document.createElement("button");
      dmButton.classList.add("channel");

      if (cache.channels[i].type === "Group") {
        dmButton.textContent = cache.channels[i].name;
      } else {
        let user;

        if (
          cache.channels[i].recipients[1] !== state.connection.userProfile._id
        ) {
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
  } catch (error) {
    showError(error);
    return 1;
  }
}

/*
 * Renders channels from the cache
 * @return {Number} Error code; should never be 1
 * */
async function getChannels(id) {
  try {
    const channelContainer = document.querySelector("#channelsContainer");
    const server = cacheLookup("servers", state.active.server);
    channelContainer.replaceChildren();

    fetchResource(
      `servers/${id}/members/${state.connection.userProfile._id}`
    ).then((member) => {
      if (cacheLookup("members", member._id.user, state.active.server) === 1)
        cache.servers[
          cacheIndexLookup("servers", state.active.server)
        ].members.push(member);
    });

    let addedChannels = [];
    if (server.categories) {
      server.categories.forEach((category) => {
        const categoryContainer = document.createElement("details");
        const categoryText = document.createElement("summary");

        categoryContainer.open = true;
        categoryContainer.classList.add("channel-category");

        categoryText.textContent = category.title;
        categoryText.classList.add("category-text");
        categoryContainer.appendChild(categoryText);

        if (category.channels) {
          for (let j = 0; j < category.channels.length; j++) {
            const currentChannel = cacheLookup(
              "channels",
              category.channels[j]
            );
            const channel = document.createElement("button");
            const channelText = document.createElement("span");

            if (currentChannel.type !== "TextChannel") continue;

            addedChannels.push(currentChannel.id);

            channel.classList.add("channel");

            channel.onclick = () => {
              getMessages(currentChannel.id);
              document.querySelector("#channelName").innerText =
                currentChannel.name;

              //Channel description setting; the expression checks whether or not the channel has a desc
              document.querySelector("#channelDesc").innerText =
                currentChannel.desc
                  ? currentChannel.desc
                  : "This channel doesn't have a description yet";
            };

            channel.id = currentChannel.id;
            channelText.innerText = currentChannel.name;

            if (
              state.unreads.unread.channels.indexOf(currentChannel.id) !== -1 &&
              state.unreads.muted.channels.indexOf(currentChannel.id) === -1
            ) {
              if (
                state.unreads.mentioned.channels.indexOf(currentChannel.id) !==
                -1
              )
                channel.classList.add("mentioned-channel");
              else channel.classList.add("unread-channel");
            }

            channel.appendChild(channelText);

            //Add the muted-channel class to it if it's muted
            if (state.unreads.muted.channels.indexOf(currentChannel.id) !== -1)
              channel.classList.add("muted-channel");
            categoryContainer.appendChild(channel);
          }
        }

        channelContainer.appendChild(categoryContainer);
      });
    }

    const defaultCategory = document.createElement("details");
    const defaultCategoryText = document.createElement("summary");

    defaultCategory.open = true;
    defaultCategory.classList.add("channel-category");
    defaultCategoryText.textContent = "Uncategorised";
    defaultCategoryText.classList.add("categoryText");
    defaultCategory.appendChild(defaultCategoryText);

    for (let i = 0; i < cache.channels.length; i++) {
      // Continue if: the current channel isn't in the server trying to be loaded OR the channel isn't a text channel OR if it's already been added
      if (
        cache.channels[i].server !== id ||
        cache.channels[i].type !== "TextChannel" ||
        addedChannels.indexOf(cache.channels[i].id) !== -1
      )
        continue;

      const currentChannel = cache.channels[i];

      addedChannels.push(currentChannel.id);

      const channel = document.createElement("button");
      channel.classList.add("channel");

      for (let i = 0; i < state.unreads.unreadList.length; i++) {
        if (state.unreads.unreadList[i]["_id"].channel === currentChannel.id) {
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

    channelContainer.insertBefore(
      defaultCategory,
      channelContainer.children[0]
    );
  } catch (error) {
    showError(error);
    return 1;
  }
  return 0;
}

//@license-end
