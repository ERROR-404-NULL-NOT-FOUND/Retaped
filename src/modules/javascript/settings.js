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
    await fetch(isntanceURL.value)
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
        "x-session-token": token,
      },
      body: JSON.stringify({
        keys: ["theme", "notifications", "ordering"],
      }),
      method: "POST",
    },
  ).then((response) => response.json());

  fetch(`${settings.instance.delta}/sync/unreads`, {
    headers: {
      "x-session-token": token,
    },
    method: "GET",
  })
    .then((response) => response.json())
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

function loadSetting(settingCategory) {
  let mainSettings = document.querySelector("#mainSettings");
  let settingCatName = document.querySelector("#settingCatName");
  settingCatName.innerText = settingCategory;
  Object.keys(settings[settingCategory]).forEach((setting) => {
    let settingContainer = document.createElement("input");
    let settingContainerLabel = document.createElement("label");

    settingContainer.type = "checkbox";
    settingContainer.checked = settings[settingCategory][setting];
    settingContainer.id = setting;
    settingContainer.onclick = () => {
      settings[settingCategory][setting] = !settings[settingCategory][setting];
      setSettings();
    };

    settingContainerLabel.textContent = setting;
    settingContainerLabel.for = setting;
    settingContainer.classList.add("settingContainer");
    mainSettings.appendChild(settingContainer);
    mainSettings.appendChild(settingContainerLabel);
  });
}

function setSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
}
