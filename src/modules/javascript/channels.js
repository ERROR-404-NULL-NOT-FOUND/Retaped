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
    const infoCatText = document.createElement("summary");
    const userCatText = document.createElement("summary");
    const infoCat = document.createElement("details");
    const userCat = document.createElement("details");
    const savedMessagesButton = document.createElement("button");
    const homeButton = document.createElement("button");

    state.active.channel = "";
    infoCatText.textContent = storage.language.dms.infoCat;
    userCatText.textContent = storage.language.dms.description;

    userCatText.classList.add("category-text");
    userCat.classList.add("channel-category");
    infoCatText.classList.add("category-text");
    infoCat.classList.add("channel-category");
    infoCat.open = true;
    userCat.open = true;

    document.querySelector("#serverBG").src = "";

    document.querySelector("#serverName").innerText =
      storage.language.dms.description;
    document.querySelector("#channelName").innerText =
      storage.language.dms.description;
    document.querySelector("#channelDesc").innerText =
      storage.language.channels.noDesc;
    channelContainer.replaceChildren();
    clearMessages();

    savedMessagesButton.textContent = storage.language.dms.savedMessages;
    savedMessagesButton.classList.add("channel");
    savedMessagesButton.classList.add("saved-messages");

    homeButton.textContent = storage.language.homeScreen.home;
    homeButton.classList.add("channel");
    homeButton.classList.add("home-button");
    homeButton.onclick = loadHome;

    infoCat.appendChild(infoCatText);
    infoCat.appendChild(savedMessagesButton);
    infoCat.appendChild(homeButton);

    userCat.appendChild(userCatText);

    channelContainer.appendChild(infoCat);
    channelContainer.appendChild(userCat);

    fetchResource(`users/${state.connection.userProfile._id}/dm`).then(
      (response) => {
        savedMessagesButton.onclick = () => {
          getMessages(response._id);
        };
      }
    );

    for (let i = 0; i < cache.channels.length; i++) {
      //Checking for only DMs
      if (!["DirectMessage", "Group"].includes(cache.channels[i].type))
        continue;

      const dmButtonContainer = document.createElement("div");
      const dmButton = document.createElement("button");
      const dmButtonAvatar = document.createElement("img");

      dmButtonContainer.classList.add("channel");

      if (cache.channels[i].type === "Group") {
        dmButton.textContent = cache.channels[i].name;
        dmButtonAvatar.src = cache.channels[i].icon
          ? `${settings.instance.autumn}/icons/${cache.channels[i].icon._id}`
          : `${settings.instance.legacyEmotes}/projects/revolt/group.png`;
      } else {
        let user;

        if (
          cache.channels[i].recipients[1] !== state.connection.userProfile._id
        ) {
          user = await userLookup(cache.channels[i].recipients[1]);
        } else {
          user = await userLookup(cache.channels[i].recipients[0]);
        }

        dmButton.textContent = `${user.username}#${user.discriminator}`;
        dmButtonAvatar.src = user.pfp;
      }
      const onClick = () => {
        getMessages(cache.channels[i].id);
        document.querySelector("#channelName").innerText = dmButton.textContent;
        document.querySelector("#channelDesc").innerText.length = 0;
      };
      dmButton.onclick = onClick;
      dmButtonAvatar.onclick = onClick;

      dmButton.id = cache.channels[i].id;
      dmButtonContainer.appendChild(dmButtonAvatar);
      dmButtonContainer.appendChild(dmButton);
      userCat.appendChild(dmButtonContainer);
    }
  } catch (error) {
    showError(error);
    return 1;
  }
}

function renderChannel(channelID, id) {
  const currentChannel = cacheLookup("channels", channelID);
  const channel = document.createElement("button");
  const channelText = document.createElement("span");
  const channelIcon = document.createElement("img");

  if (currentChannel.type !== "TextChannel") return false;

  channel.classList.add("channel");

  channel.onclick = () => {
    if (state.active.server !== id) {
      fetchResource(
        `servers/${id}/members/${state.connection.userProfile._id}`
      ).then((member) => {
        if (cacheLookup("members", member._id.user, id) === 1)
          cache.servers[cacheIndexLookup("servers", id)].members.push(member);
      });
    }

    if (state.active.server !== id) getChannels(id);

    state.active.server = id;
    state.active.channel = currentChannel.id;
    getMessages(currentChannel.id);
    document.querySelector("#channelName").innerText = currentChannel.name;

    //Channel description setting; the expression checks whether or not the channel has a desc
    (async () => {
      console.log(await parseMessageContent(currentChannel.desc));
      document.querySelector("#channelDesc").innerHTML = currentChannel.desc
        ? await parseMessageContent({
          content: currentChannel.desc.split("\n")[0] // This is to prevent channel descriptions from getting in the way
        }).innerHTML
        : storage.language.channels.noDesc;
    })();
  };

  channel.id = currentChannel.id;
  channelText.innerText = currentChannel.name;

  if (currentChannel.icon) {
    channelIcon.src = `${settings.instance.autumn}/icons/${currentChannel.icon}`;
    channel.appendChild(channelIcon);
  } else channelText.innerText = "# " + channelText.innerText;

  if (
    state.unreads.unread.channels.indexOf(currentChannel.id) !== -1 &&
    state.unreads.muted.channels.indexOf(currentChannel.id) === -1
  ) {
    if (state.unreads.mentioned.channels.indexOf(currentChannel.id) !== -1)
      channel.classList.add("mentioned-channel");
    else channel.classList.add("unread-channel");
  }

  channel.appendChild(channelText);

  //Add the muted-channel class to it if it's muted
  if (state.unreads.muted.channels.indexOf(currentChannel.id) !== -1)
    channel.classList.add("muted-channel");
  return channel;
}
/*
 * Renders channels from the cache
 * @return {Number} Error code; should never be 1
 * */
async function getChannels(id) {
  try {
    const channelContainer = document.querySelector("#channelsContainer");
    const server = cacheLookup("servers", id);
    channelContainer.replaceChildren();

    //Loki TODO: styling
    if (server.background)
      document.querySelector(
        "#serverBG"
      ).src = `${settings.instance.autumn}/banners/${server.background._id}?width=480`;
    else document.querySelector("#serverBG").src = "";

    document.getElementById("serverName").innerText = server.name;

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

        try {
          category.channels.forEach((channel) => {
            //TODO: Ask Inderix for a VC icon
            const renderedChannel = renderChannel(channel, id);

            if (renderedChannel) categoryContainer.appendChild(renderedChannel);
            addedChannels.push(channel);
          });
          channelContainer.appendChild(categoryContainer);
        } catch (error) {
          showError(error);
        }
      });
    }

    if (server.channels.length !== addedChannels.length) {
      const defaultCategory = document.createElement("details");
      const defaultCategoryText = document.createElement("summary");

      defaultCategory.open = true;
      defaultCategory.classList.add("channel-category");
      defaultCategoryText.textContent = "Uncategorised"; //TODO: translation string
      defaultCategoryText.classList.add("categoryText");
      defaultCategory.appendChild(defaultCategoryText);

      server.channels.forEach((channel) => {
        if (addedChannels.indexOf(channel) !== -1) return;
        const renderedChannel = renderChannel(channel, id);
        if (renderedChannel) defaultCategory.appendChild(renderedChannel);
      });

      channelContainer.insertBefore(
        defaultCategory,
        channelContainer.children[0]
      );
    }
  } catch (error) {
    showError(error);
    return 1;
  }
  return 0;
}

//@license-end
