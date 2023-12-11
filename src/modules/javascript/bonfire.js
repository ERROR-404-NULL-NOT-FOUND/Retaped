// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Bonfire message handler
//

/*
 * Interface with Revolt's websocket service
 * @param none
 * @return none
 * */
async function bonfire() {
    state.connection.socket = new WebSocket(`${settings.instance.bonfire}/?token=${state.connection.token}`);
  
    state.connection.socket.addEventListener("message", async function (event) {
      let data;
      const typingBar = document.getElementById("typingBar");
      data = JSON.parse(event.data);
  
      switch (data.type) {
        // User provided correct credentials
        case "Authenticated": {
          debugInfo("Authenticated successfully");
          document.querySelector("#connectionStatus").textContent =
            storage.language.connection.active;
          loadSyncSettings();
          break;
        }
  
        // Used for message unreads and adding new messages to the messagebox
        case "Message":
          debugInfo("Received message", data);
          updateUnreads(
            data.channel,
            data._id,
            true,
            data.mentions
              ? data.mentions.indexOf(state.connection.userProfile._id) !== -1
              : false
          );
  
          if (data.channel === state.active.channel) {
            const messageContainer = document.querySelector("#messagesContainer");
            const shouldAck = true;
            /*document.hasFocus &&
              messageContainer.scrollHeight - messageContainer.offsetHeight >=
                messageContainer.scrollTop + 10;*/
  
            if (shouldAck) {
              fetch(
                `${settings.instance.delta}/channels/${state.active.channel}/ack/${data._id}`,
                {
                  headers: {
                    "x-session-token": state.connection.token,
                  },
                  method: "PUT",
                }
              );
            }
  
            messageContainer.appendChild(await parseMessage(data));
  
            if (shouldAck) scrollChatToBottom();
          } else {
            if (
              (channel = document.getElementById(data.channel)) &&
              state.unreads.muted.channels.indexOf(data.channel) === -1 &&
              state.unreads.muted.servers.indexOf(
                cacheLookup("channels", data.id).server
              ) === -1
            ) {
              channel.classList.add(
                data.mentions &&
                  data.mentions.indexOf(state.connection.userProfile._id) !== -1
                  ? "mentioned-channel"
                  : "unread-channel"
              );
            }
  
            if (
              state.unreads.muted.channels.indexOf(data.channel) === -1 &&
              state.unreads.muted.servers.indexOf(
                cacheLookup("channels", data.channel).server
              ) === -1
            ) {
              if (
                state.unreads.muted.channels.indexOf(
                  cacheLookup("channels", data.channel).server
                )
              )
                document
                  .getElementById(
                    `SERVER-${cacheLookup("channels", data.channel).server}`
                  )
                  .classList.add(
                    data.mentions &&
                      data.mentions.indexOf(state.connection.userProfile._id) !==
                        -1
                      ? "mentioned-server"
                      : "unread-server"
                  );
            }
          }
          break;
  
        case "MessageDelete":
          debugInfo("Message deleted", data);
          if (data.channel === state.active.channel) {
            document
              .querySelector("#messagesContainer")
              .removeChild(document.getElementById(`MSG-${data.id}`));
          }
          break;
  
        case "MessageUpdate":
          debugInfo("Message updated", data);
          if (data.channel === state.active.channel) {
            messageDisplay = document.querySelector(`#MSG-${data.id}`);
            messageContent = messageDisplay.querySelector(".messageContent");
            messageContent.innerHTML = parseMessageContent(data.data).innerHTML;
          }
  
        // Channel has been acknowledge as read
        case "ChannelAck":
          debugInfo("Message acknowledged", data);
          await updateUnreads(data.id, data.message_id, false);
  
          if ((channel = document.getElementById(data.id))) {
            channel.classList.remove("unread-channel");
            channel.classList.remove("mentioned-channel");
          }
  
          let stillUnread = false;
          let stillMentioned = false;
  
          if (
            state.unreads.muted.servers.indexOf(
              cacheLookup("channels", data.id).server
            ) === -1
          ) {
            cacheLookup(
              "servers",
              cacheLookup("channels", data.id).server
            ).channels.forEach((channel) => {
              if (state.unreads.muted.channels.indexOf(channel) === -1) {
                if (state.unreads.unread.channels.indexOf(channel) !== -1)
                  stillUnread = true;
                if (state.unreads.mentioned.channels.indexOf(channel) !== -1)
                  stillMentioned = true;
              }
            });
  
            let server = document.getElementById(
              `SERVER-${cacheLookup("channels", data.id).server}`
            );
            if (!stillUnread) server.classList.remove("unread-server");
            if (!stillMentioned) server.classList.remove("mentioned-server");
          }
          break;
  
        // Uh oh
        case "Error":
          showError(error);
          break;
  
        // Cache building, received immediately after 'Authenticated'
        case "Ready":
          debugInfo("Ready event received; building cache");
          buildServerCache(data.servers);
          buildChannelCache(data.channels);
          buildUserCache(data.users);
          buildEmoteCache(data.emojis);
          getServers();
          loadHome();
          init();
          break;
  
        // User begins typing
        // TODO: add timeout
        case "ChannelStartTyping": {
          debugInfo("User started typing", data);
          if (
            data.id !== state.active.channel ||
            state.currentlyTyping.indexOf(data.user) !== -1
          )
            break;
  
          const typingMember = cacheLookup(
            "members",
            data.user,
            state.active.server
          );
          const typingUser = await userLookup(data.user);
          const typingUserContainer = document.createElement("div");
          const typingUserName = document.createElement("span");
          const typingUserPfp = document.createElement("img");
  
          typingUserPfp.src =
            typingMember.pfp === undefined
              ? typingUser.pfp
              : `${settings.instance.autumn}/avatars/${typingMember.pfp._id}?max_side=25`;
          typingUserContainer.appendChild(typingUserPfp);
  
          typingUserName.textContent = typingUser.displayName;
          typingUserContainer.appendChild(typingUserName);
  
          typingUserContainer.id = typingUser.id;
  
          state.currentlyTyping.push(data.user);
          typingBar.appendChild(typingUserContainer);
          typingBar.parentElement.style.display = "flex";
          break;
        }
  
        // User stops typing
        case "ChannelStopTyping": {
          debugInfo("User stopped typing", data);
          if (data.id !== state.active.channel) break;
  
          if ((typingUserContainer = document.getElementById(data.user))) {
            typingUserContainer.remove();
            state.currentlyTyping = state.currentlyTyping.splice(
              state.currentlyTyping.indexOf(data.user),
              1
            );
          }
  
          if (typingBar.children.length === 0)
            typingBar.parentElement.style.display = "none";
          break;
        }
  
        case "MessageReact": {
          debugInfo("Message reacted", data);
          if (data.channel_id !== state.active.channel) break;
  
          let reactionsContainer = document.getElementById(
            `reactionsContainer${data.id}`
          );
  
          const message = cacheLookup("messages", data.id);
  
          if (
            message.reactions &&
            Object.keys(message.reactions).indexOf(data.emoji_id) === -1
          ) {
            reactionsContainer.appendChild(
              renderReactions(
                { [data.emoji_id]: [data.user_id] },
                data.channel_id,
                data.id
              )[0]
            );
          } else {
            if (
              !(reactionContainer = reactionsContainer.querySelector(
                `#REACTION-${data.emoji_id}`
              ))
            )
              break;
            reactionContainer.querySelector(".reactionCount").innerText =
              Number(
                reactionsContainer.querySelector(".reactionCount").innerText
              ) + 1;
          }
          if (message.reactions && message.reactions[data.emoji_id])
            message.reactions[data.emoji_id].push(data.user_id);
          else if (message.reactions)
            message.reactions[data.emoji_id] = [data.user_id];
  
          break;
        }
  
        case "MessageUnreact": {
          debugInfo("Message unreacted", data);
          if (data.channel_id !== state.active.channel) break;
  
          let reactionsContainer = document.getElementById(
            `reactionsContainer${data.id}`
          );
          let message = cacheLookup("messages", data.id);
          message.reactions[data.emoji_id].splice(
            message.reactions[data.emoji_id].indexOf(data.user_id),
            1
          );
          let reactionContainer = reactionsContainer.querySelector(
            `#REACTION-${data.emoji_id}`
          );
          if (!Object.keys(message.reactions).indexOf(data.emoji_id)) {
            message.reactions[data.emoji_id] = undefined;
            reactionsContainer.removeChild(reactionContainer);
          } else {
            reactionContainer.querySelector(".reactionCount").innerText =
              Number(
                reactionsContainer.querySelector(".reactionCount").innerText
              ) - 1;
          }
          break;
        }
  
        case "UserUpdate": {
          debugInfo("User updated", data);
          updateUser(data);
          break;
        }
  
        case "ServerMemberUpdate": {
          debugInfo("Member updated", data);
          updateUser(data);
          break;
        }
  
        case "ServerCreate": {
          debugInfo("Server created", data);
          state.ordering.push(data.server._id);
          buildServerCache([data.server]);
          saveSyncSettings();
          getServers();
          break;
        }
  
        case "ServerDelete": {
          debugInfo("Left server (or it was deleted)", data);
          state.ordering.splice(state.ordering.indexOf(data.id), 1);
          cache.servers.splice(cacheIndexLookup("servers", data.id), 1);
          saveSyncSettings();
          getServers();
          break;
        }
  
        case "ServerMemberLeave": {
          debugInfo("Member left", data);
          if (data.user === state.connection.userProfile._id) {
            state.ordering.splice(state.ordering.indexOf(data.id), 1);
            cache.servers.splice(cacheIndexLookup("servers", data.id), 1);
            saveSyncSettings();
            getServers();
          }
          break;
        }
      }
    });
  
    state.connection.socket.addEventListener("error", function (event) {
      showError(event);
    });
  
    state.connection.socket.onclose = (event) => {
      document.querySelector("#connectionStatus").textContent =
        storage.language.connection.inactive;
      showError({
        name: "connectionError",
        message: "Websocket disconnected; attempting reconnection",
      });
      setTimeout(() => {
        debugInfo("", data);
        start(settings.instance.bonfire);
      }, 5000);
    };
  }
  
  //@license-end