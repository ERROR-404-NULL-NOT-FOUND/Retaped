//
// Bonfire message handler
//

// Function to interface with Revolt's websocket service
async function bonfire() {
  state.connection.socket = new WebSocket(settings.instance.bonfire);

  state.connection.socket.addEventListener("open", async function (event) {
    state.connection.socket.send(`{"type": "Authenticate","token": "${state.connection.token}"}`);
  });

  state.connection.socket.addEventListener("message", async function (event) {
    let data;
    const typingBar = document.getElementById("typingBar");
    data = JSON.parse(event.data);

    switch (data.type) {
      // User provided correct credentials
      case "Authenticated":
        document.getElementById("status").innerText = "Connected";
        break;

      // Used for message unreads and adding new messages to the messagebox
      case "Message":
        await updateUnreads(data.channel, data._id, true, data.mentions ? data.mentions.indexOf(state.connection.userProfile._id) !== -1 : false);
        if (data.channel === state.active.channel) {
          document
            .querySelector("#messagesContainer")
            .appendChild(await parseMessage(data));
          if (document.hasFocus) {
            fetch(
              `${settings.instance.delta}/channels/${state.active.channel}/ack/${data._id}`,
              {
                headers: {
                  "x-session-token": state.connection.token,
                },
                method: "PUT",
              },
            );
            scrollChatToBottom();
          }
        } else {
          if (
            (channel = document.getElementById(data.channel)) &&
            state.unreads.muted.channels.indexOf(data.channel) === -1
          ) {
            channel.classList.add(
              data.mentions && data.mentions.indexOf(state.connection.userProfile._id) !== -1
                ? "mentionedChannel"
                : "unreadChannel",
            );
          }

          if (
            state.unreads.muted.channels.indexOf(data.channel) === -1 &&
            state.unreads.muted.servers.indexOf(
              cacheLookup("channels", data.channel).server,
            ) === -1
          ) {
            document
              .getElementById(
                `SERVER-${cacheLookup("channels", data.channel).server}`,
              )
              .classList.add(
                data.mentions && data.mentions.indexOf(state.connection.userProfile._id) !== -1
                  ? "mentionedServer"
                  : "unreadServer",
              );
          }
        }
        break;

      case "MessageDelete":
        if (data.channel === state.active.channel) {
          document
            .querySelector("#messagesContainer")
            .removeChild(document.getElementById(`MSG-${data.id}`));
        }
        break;

      case "MessageUpdate":
        if (data.channel === state.active.channel) {
          messageDisplay = document.querySelector(`#MSG-${data.id}`);
          messageContent = messageDisplay.querySelector(".messageContent");
          messageContent.innerHTML = parseMessageContent(data.data).innerHTML;
        }

      // Channel has been acknowledge as read
      case "ChannelAck":
        await updateUnreads(data.id, data.message_id, false);

        if ((channel = document.getElementById(data.id))) {
          channel.classList.remove("unreadChannel");
          channel.classList.remove("mentionedChannel");
        }

        let stillUnread = false;
        let stillMentioned = false;
        cacheLookup("servers", cacheLookup("channels", data.id).server).channels.forEach((channel) => {
          if (state.unreads.unread.channels.indexOf(channel) !== -1) stillUnread = true;
          if (state.unreads.mentioned.channels.indexOf(channel) !== -1) stillMentioned = true;
        });

        let server = document.getElementById(
          `SERVER-${cacheLookup("channels", data.id).server}`,
        );
        if (!stillUnread) server.classList.remove("unreadServer");
        if (!stillMentioned) server.classList.remove("mentionedServer");
        break;

      // Uh oh
      case "Error":
        showError(error);
        break;

      // Cache building, received immediately after 'Authenticated'
      case "Ready":
        buildServerCache(data.servers);
        buildChannelCache(data.channels);
        buildUserCache(data.users);
        getServers();
        break;

      // User begins typing
      // TODO: add timeout
      case "ChannelStartTyping": {
        if (
          data.id !== state.active.channel ||
          state.currentlyTyping.indexOf(data.user) !== -1 ||
          document.getElementById(data.user) === null
        )
          break;

        const typingMember = cacheLookup("members", data.user, activeServer);
        const typingUser = await userLookup(data.user);
        const typingUserContainer = document.createElement("div");
        const typingUserName = document.createElement("span");
        const typingUserPfp = document.createElement("img");

        typingUserPfp.src =
          typingMember.pfp === undefined
            ? `${settings.instance.autumn}/avatars/${typingUser.pfp._id}?max_side=25`
            : `${settings.instance.autumn}/avatars/${typingMember.pfp._id}?max_side=25`;
        typingUserContainer.appendChild(typingUserPfp);

        typingUserName.textContent = typingUser.displayName;
        typingUserContainer.appendChild(typingUserName);

        typingUserContainer.id = typingUser.id;

        state.currentlyTyping.push(data.user);
        typingBar.appendChild(typingUserContainer);
        document.getElementById("typingBarContainer").style.display = "flex";
        scrollChatToBottom();
        break;
      }

      // User stops typing
      case "ChannelStopTyping": {
        if (data.id !== state.active.channel) break;

        const typingUserContainer = document.getElementById(data.user);
        if (typingUserContainer) {
          typingUserContainer.remove();
          state.currentlyTyping.splice(state.currentlyTyping.indexOf(data.user), 1);
        }

        if (typingBar.children.length === 0)
          document.getElementById("typingBarContainer").style.display = "none";
      }

      case "MessageReact": {
        let reactionsContainer = document.getElementById(
          `reactionsContainer${data.id}`,
        );
        if ((reactionContainer = undefined)) return;
        let message = cacheLookup("messages", data.id);
        if (
          message.reactions &&
          Object.keys(message.reactions).indexOf(data.emoji_id) === -1
        ) {
          reactionsContainer.appendChild(
            renderReactions(
              { [data.emoji_id]: [data.user_id] },
              data.channel_id,
              data.id,
            )[0],
          );
        } else {
          if (!(reactionContainer = reactionsContainer.querySelector(`#REACTION-${data.emoji_id}`))) break;
          reactionContainer.querySelector(".reactionCount").innerText =
            Number(
              reactionsContainer.querySelector(".reactionCount").innerText,
            ) + 1;
        }
        if (message.reactions && message.reactions[data.emoji_id])
          message.reactions[data.emoji_id].push(data.user_id);
        else if (message.reactions)
          message.reactions[data.emoji_id] = [data.user_id];

        break;
      }

      case "MessageUnreact": {
        let reactionsContainer = document.getElementById(
          `reactionsContainer${data.id}`,
        );
        let message = cacheLookup("messages", data.id);
        message.reactions[data.emoji_id].splice(
          message.reactions[data.emoji_id].indexOf(data.user_id),
          1,
        );
        let reactionContainer = reactionsContainer.querySelector(
          `#REACTION-${data.emoji_id}`,
        );
        if (!Object.keys(message.reactions).indexOf(data.emoji_id)) {
          message.reactions[data.emoji_id] = undefined;
          reactionsContainer.removeChild(reactionContainer);
        } else {
          reactionContainer.querySelector(".reactionCount").innerText =
            Number(
              reactionsContainer.querySelector(".reactionCount").innerText,
            ) - 1;
        }
        break;
      }
    }
  });

  state.connection.socket.addEventListener("error", function (event) {
    showError(event);
  });
}

