function loadHome() {
  debugInfo("Loading home");
  const header = document.createElement("h1");
  const subheader = document.createElement("h3");
  const unreadChannelsContainer = document.createElement("div");
  const messagesContainer = document.querySelector("#messagesContainer");
  clearMessages();
  header.innerHTML = formatTranslationKey(
    storage.language.homeScreen.greeting,
    "logo",
    document.querySelector("#name").innerHTML
  );
  subheader.innerText = storage.language.homeScreen.unreadMessage;

  state.unreads.unread.channels.forEach((channel) => {
    if (state.unreads.muted.channels.indexOf(channel) !== -1) return;
    const channelInfo = cacheLookup("channels", channel);
    const unreadChannelContainer = document.createElement("div");
    const unreadChannel = renderChannel(channel, channelInfo.server);
    const lastMessage = document.createElement("div");

    lastMessage.classList.add("channel-last-message");
    unreadChannelContainer.classList.add("home-unread-channel");

    lastMessage.id = `MSG-${channelInfo.lastMessage}`;

    unreadChannelContainer.appendChild(unreadChannel);
    unreadChannelContainer.appendChild(lastMessage);
    unreadChannelsContainer.appendChild(unreadChannelContainer);
    fetchResource(
      `/channels/${channel}/messages/${channelInfo.lastMessage}`
    ).then(async (res) => {
      const username = document.createElement("span");
      const author = await userLookup(res.author);
      const parsedMessage = await parseMessageContent(res);

      username.classList.add("username");
      username.innerText = author.displayName;

      lastMessage.outerHTML = username.outerHTML + parsedMessage.outerHTML;
    });
  });
  messagesContainer.appendChild(header);
  messagesContainer.appendChild(subheader);
  messagesContainer.appendChild(unreadChannelsContainer);
}
