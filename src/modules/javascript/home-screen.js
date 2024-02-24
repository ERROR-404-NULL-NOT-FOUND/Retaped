function loadHome() {
  debugInfo("Loading home");
  state.homeScreen = true;
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
    const unreadChannel = renderChannel(channel, channelInfo.server);
    const unreadMessageContainer = document.createElement("div");
    const unreadServer = document.createElement("span");
    const lastMessage = document.createElement("div");

    unreadServer.textContent = cacheLookup("servers", channelInfo.server).name;
    lastMessage.classList.add("channel-last-message");
    unreadMessageContainer.classList.add("home-unread-message");
    unreadChannel.classList.add("home-unread-channel");

    unreadMessageContainer.appendChild(unreadChannel);
    unreadMessageContainer.appendChild(unreadServer);
    unreadMessageContainer.appendChild(lastMessage);
    unreadChannelsContainer.appendChild(unreadMessageContainer);
    fetchResource(
      `/channels/${channel}/messages/${channelInfo.lastMessage}`
    ).then(async (res) => {
      const parsedMessage = await parseMessage(res);
      lastMessage.outerHTML = parsedMessage.outerHTML;
    });
  });
  messagesContainer.appendChild(header);
  messagesContainer.appendChild(subheader);
  messagesContainer.appendChild(unreadChannelsContainer);
}
