// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Settings handling
//

//Processes client-side settings
async function processSettings() {
  const toggleToken = document.querySelector("#toggleToken");
  const instanceURL = document.querySelector("#customInstance");
  const legacyEmoteServer = document.querySelector("#customLegacyEmotes");
  const assetsURL = document.querySelector("#customAssets");

  if (localStorage.getItem("settings"))
    settings = JSON.parse(localStorage.getItem("settings"));

  if (instanceURL.value) {
    await fetch(instanceURL.value)
      .then((res) => res.json())
      .then((data) => {
        settings.instance.delta = instanceURL.value;
        settings.instance.autumn = data.features.autumn.url;
        settings.instance.january = data.features.january.url;
      })
      .catch((error) => {
        showError(error);
        exit();
      });
  }

  if (legacyEmoteServer.value) settings.instance.legacyEmotes = legacyEmoteServer.value;
  if (assetsURL.value) settings.instance.assets = assetsURL.value;

  if (!toggleToken) settings.behaviour.rememberMe = false;
  setSettings();
}

// Loads settings from the user's Revolt account, mainly for colour loading
async function loadSyncSettings() {
  const rawSettings = await fetch(
    `${settings.instance.delta}/sync/settings/fetch`,
    {
      headers: {
        "x-session-token": state.connection.token,
      },
      body: JSON.stringify({
        keys: ["theme", "notifications", "ordering"],
      }),
      method: "POST",
    },
  ).then((response) => response.json());

  await fetchResource('/sync/unreads')
    .then((data) => {
      state.unreads.unreadList = data;
    });

  let theme = JSON.parse(rawSettings.theme[1])["appearance:theme:overrides"];
  let notifications = JSON.parse(rawSettings.notifications[1]);

  state.ordering = JSON.parse(rawSettings.ordering[1]).servers;

  Object.keys(notifications.channel).forEach((channel) => {
    if (notifications.channel[channel] === "muted") state.unreads.muted.channels.push(channel);
  });

  Object.keys(notifications.server).forEach((server) => {
    if (notifications.server[server] === "muted") state.unreads.muted.servers.push(server);
  });

  if (toggleTheme.checked == true) {
    let themeVars = document.querySelector(":root");
    themeVars.style.setProperty("--accent", theme.accent);
    themeVars.style.setProperty("--error", theme.error);
    themeVars.style.setProperty("--servers-bg", theme.background);
    themeVars.style.setProperty("--channels-bg", theme["secondary-background"]);
    themeVars.style.setProperty("--secondary-background", theme["message-box"]);
    themeVars.style.setProperty(
      "--tertiary-background",
      theme["tertiary-background"],
    );
    themeVars.style.setProperty(
      "--tertiary-foreground",
      theme["tertiary-foreground"],
    );
    themeVars.style.setProperty("--background", theme["primary-background"]);
    themeVars.style.setProperty("--foreground", theme["foreground"]);
    themeVars.style.setProperty(
      "--secondary-foreground",
      theme["secondary-foreground"],
    );
    themeVars.style.setProperty("--hover", theme.hover);
    themeVars.style.setProperty("--mention", theme.mention);

    document.querySelector("#themeLabel").textContent = "Revolt theme";
  }
}

async function loadSetting(settingCategory) {
  let mainSettings = document.querySelector("#mainSettings");
  let settingCatName = document.querySelector("#settingCatName");
  settingCatName.innerText = settingCategory;
  mainSettings.replaceChildren();

  if (settingCategory !== "profile") {
    Object.keys(settings[settingCategory]).forEach((setting) => {
      let settingContainer = document.createElement("div");
      let settingInput = document.createElement("input");
      let settingInputLabel = document.createElement("label");
      let settingDesc = document.createElement("span");

      settingInput.type = "checkbox";
      settingInput.checked = settings[settingCategory][setting].value;
      settingInput.id = setting;
      console.log(settings[settingCategory][setting])
      settingInput.onclick = () => {
        settings[settingCategory][setting] = !settings[settingCategory][setting].value;
        setSettings();
      };

      //Loki TODO: style
      settingDesc.innerHTML = "<br>" + settings[settingCategory][setting].description;
      settingInputLabel.textContent = settings[settingCategory][setting].name;
      settingInputLabel.for = setting;

      settingContainer.classList.add("setting-container");

      settingContainer.appendChild(settingInput);
      settingContainer.appendChild(settingInputLabel);
      settingContainer.appendChild(settingDesc);

      mainSettings.appendChild(settingContainer);
    });
  } else {
    //Loki TODO: style
    //Creates a div with text, profile preview, text, profile editor, save button
    let user = await fetchResource(`users/${state.connection.userProfile._id}/profile`);

    let profileEditor = document.createElement("div");
    let profilePreviewContainer = document.createElement("div");
    let profileInputContainer = document.createElement("div");
    let profilePreview = document.createElement("p");
    let profileInput = document.createElement("textarea");
    let profilePreviewText = document.createElement("h4");
    let profileInputText = document.createElement("h4");
    let profileSaveButton = document.createElement("button");

    profileEditor.classList.add("profile-editor")
    profilePreviewContainer.classList.add("profile-preview");
    profileInputContainer.classList.add("profile-input");
    profileSaveButton.classList.add("profile-save-button");

    profilePreview.innerHTML = converter.makeHtml(user.content);
    profilePreviewText.innerText = "Profile preview";
    profileInputText.innerText = "Profile editor";
    profileSaveButton.innerText = "Save profile"

    profileInput.value = user.content;

    profileInput.onkeyup = () => {
      profilePreview.innerHTML = converter.makeHtml(profileInput.value);
    }

    profileSaveButton.onclick = () => {
      fetch(`${settings.instance.delta}/users/${state.connection.userProfile._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          profile: {
            content: profileInput.value,
          }
        }),
        headers: {
          "x-session-token": state.connection.token,
        }
      });
    }

    profileInputContainer.appendChild(profileInputText);
    profileInputContainer.appendChild(profileInput);
    profilePreviewContainer.appendChild(profilePreviewText);
    profilePreviewContainer.appendChild(profilePreview);

    profileEditor.appendChild(profilePreviewContainer);
    profileEditor.appendChild(profileInputContainer);
    profileEditor.appendChild(profileSaveButton);
    mainSettings.appendChild(profileEditor);
  }
}

function setSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
}

//@license-end