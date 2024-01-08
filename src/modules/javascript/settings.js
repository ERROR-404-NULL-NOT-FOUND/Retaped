// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Settings handling
//

/**
 * Processes client-side settings
 * @returns {null} Doesn't return
 */
async function processSettings() {
  const toggleToken = document.querySelector("#toggleToken");
  const instanceURL = document.querySelector("#customInstance");
  const legacyEmoteServer = document.querySelector("#customLegacyEmotes");
  const assetsURL = document.querySelector("#customAssets");

  if (localStorage.getItem("settings"))
    settings = JSON.parse(localStorage.getItem("settings"));
  else return;

  if (loginData.instanceURL.value) {
    await fetch(instanceURL.value)
      .then((res) => res.json())
      .then((data) => {
        settings.instance.delta = loginData.instanceURL.value;
        settings.instance.autumn = data.features.autumn.url;
        settings.instance.january = data.features.january.url;
        setSettings();
      })
      .catch((error) => {
        showError(error);
        exit();
      });
  }

  if (legacyEmoteServer.value)
    settings.instance.legacyEmotes = legacyEmoteServer.value;
  if (assetsURL.value) settings.instance.assets = assetsURL.value;

  if (!toggleToken) settings.behaviour.rememberMe = false;
  setSettings();
}

/**
 * Loads settings from the user's Revolt account, mainly for colour loading
 * @returns {null} Doesn't return
 */
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
    }
  ).then((response) => response.json());

  await fetchResource("/sync/unreads").then((data) => {
    state.unreads.unreadList = data;
  });

  let theme = JSON.parse(rawSettings.theme[1])["appearance:theme:overrides"];
  let notifications = JSON.parse(rawSettings.notifications[1]);

  state.ordering = JSON.parse(rawSettings.ordering[1]).servers;

  Object.keys(notifications.channel).forEach((channel) => {
    if (notifications.channel[channel] === "muted")
      state.unreads.muted.channels.push(channel);
  });

  Object.keys(notifications.server).forEach((server) => {
    if (notifications.server[server] === "muted")
      state.unreads.muted.servers.push(server);
  });

  if (settings.visual.revoltTheme.value == true) {
    let themeVars = document.querySelector(":root");
    themeVars.style.setProperty("--accent", theme.accent);
    themeVars.style.setProperty("--error", theme.error);
    themeVars.style.setProperty("--servers-bg", theme.background);
    themeVars.style.setProperty("--channels-bg", theme["secondary-background"]);
    themeVars.style.setProperty("--secondary-background", theme["message-box"]);
    themeVars.style.setProperty(
      "--tertiary-background",
      theme["tertiary-background"]
    );
    themeVars.style.setProperty(
      "--tertiary-foreground",
      theme["tertiary-foreground"]
    );
    themeVars.style.setProperty("--background", theme["primary-background"]);
    themeVars.style.setProperty("--foreground", theme["foreground"]);
    themeVars.style.setProperty(
      "--secondary-foreground",
      theme["secondary-foreground"]
    );
    themeVars.style.setProperty("--hover", theme.hover);
    themeVars.style.setProperty("--mention", theme.mention);

    document.querySelector("#themeLabel").textContent = "Revolt theme";
  }
}

function saveSyncSettings() {
  debugInfo("Saving sync settings");
  fetch(`${settings.instance.delta}/sync/settings/set`, {
    method: "POST",
    headers: { "x-session-token": state.connection.token },
    body: JSON.stringify({
      ordering: JSON.stringify({
        servers: state.ordering,
      }),
    }),
  });
}

/**
 * Loads the settings in a given setting category
 * @param {String} settingCategory Any of: behaviour, visual, profile
 * @returns {null} Doesn't return
 */
async function loadSetting(settingCategory) {
  debugInfo("Loading settings");
  let mainSettings = document.querySelector("#mainSettings");
  let settingCatName = document.querySelector("#settingCatName");
  settingCatName.innerText =
    storage.language.settings.categories[settingCategory];
  mainSettings.replaceChildren();

  switch(settingCategory) {
    case "profile": {
    debugInfo("Loading profile editor");
    //Loki TODO: style
    //Creates a div with text, profile preview, text, profile editor, save button
    let user = await fetchResource(
      `users/${state.connection.userProfile._id}/profile`
    );

    let profileEditor = document.createElement("div");
    let profilePreviewContainer = document.createElement("div");
    let profileInputContainer = document.createElement("div");
    let profilePreview = document.createElement("p");
    let profileInput = document.createElement("textarea");
    let profilePreviewText = document.createElement("h4");
    let profileInputText = document.createElement("h4");
    let profileSaveButton = document.createElement("button");

    profileEditor.classList.add("profile-editor");
    profilePreviewContainer.classList.add("profile-preview");
    profileInputContainer.classList.add("profile-input");
    profileSaveButton.classList.add("profile-save-button");

    profilePreview.innerHTML = marked.parse(user.content);
    profilePreviewText.innerText =
      storage.language.settings.descriptions.profile.previewLabel;
    profileInputText.innerText =
      storage.language.settings.descriptions.profile.editorLabel;
    profileSaveButton.innerText =
      storage.language.settings.descriptions.profile.saveBtn;

    profileInput.value = user.content;

    profileInput.onkeyup = () => {
      profilePreview.innerHTML = marked.parse(profileInput.value);
    };

    profileSaveButton.onclick = () => {
      fetch(
        `${settings.instance.delta}/users/${state.connection.userProfile._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            profile: {
              content: profileInput.value,
            },
          }),
          headers: {
            "x-session-token": state.connection.token,
          },
        }
      );
    };

    profileInputContainer.appendChild(profileInputText);
    profileInputContainer.appendChild(profileInput);
    profilePreviewContainer.appendChild(profilePreviewText);
    profilePreviewContainer.appendChild(profilePreview);

    profileEditor.appendChild(profilePreviewContainer);
    profileEditor.appendChild(profileInputContainer);
    profileEditor.appendChild(profileSaveButton);
    mainSettings.appendChild(profileEditor);
      break;
  }
    case "info": {
      debugInfo("Displaying info");
      let links = {
        "Revolt": "https://github.com/RevoltChat",
        "Retaped": "https://github.com/error-404-null-not-found/Retaped",
        "Tetra": "https://meowcity.club",
        "Loki": "https://loki.monster"
      };
      let info = document.createElement("p");
      info.textContent = `Retaped: a minimalistic but powerful Revolt client programmed in vanilla JS 
        Developed by Tetra Green with the assistance of Lokicalmito
        Licensed under GPL-3.0-or-later
        Links:`;
      Object.keys(links).forEach(linkRef => {
        let link = document.createElement("a");
        link.href = links[linkRef];
        link.textContent = linkRef;
        info.appendChild(document.createElement("br"));
        info.appendChild(link);
      })
      mainSettings.appendChild(info);
      break;
    }
    default: {
    Object.keys(settings[settingCategory]).forEach((setting) => {
      debugInfo(`Loading setting: ${setting}`);
      let settingContainer = document.createElement("div");
      let settingInputLabel = document.createElement("label");
      let settingDesc = document.createElement("span");

      let settingInput;
      if (typeof settings[settingCategory][setting].value === "boolean") {
        settingInput = document.createElement("input");
        settingInput.type = "checkbox";
        settingInput.checked = settings[settingCategory][setting].value;
        settingInput.id = setting;
        settingInput.onclick = () => {
          settings[settingCategory][setting].value =
            !settings[settingCategory][setting].value;
          setSettings();
        };
      } else {
        settingInput = document.createElement("select");
        settingInput.onchange = () => {
          settings.visual.language.value =
            langSelect.options[settingInput.selectedIndex].value; //Set language to selection
          setSettings();
          updateLanguage();
        };
        storage.languages.forEach((language) => {
          languageOpt = document.createElement("option");
          languageOpt.value = language;
          languageOpt.text = language;
          settingInput.appendChild(languageOpt);
        });
      }

      //Loki TODO: style
      settingDesc.innerHTML =
        "<br>" + storage.language.settings.descriptions[setting];
      settingInputLabel.textContent = storage.language.settings.names[setting];
      settingInputLabel.for = setting;

      settingContainer.classList.add("setting-container");

      settingContainer.appendChild(settingInput);
      settingContainer.appendChild(settingInputLabel);
      settingContainer.appendChild(settingDesc);

      mainSettings.appendChild(settingContainer);
    });
      break;
    }
  }
}

/**
 * Macro to save settings
 * @returns {null} Doesn't return
 */
function setSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
}

//@license-end
