// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0
//A bunch of .onclick functions

const embedButton = document.querySelector("#sendEmbedButton");
const masqButton = document.querySelector("#sendMasqButton");
const bonfireButton = document.querySelector("#bonfireButton");
const refreshChatButton = document.querySelector("#refreshChatButton");
const sendJSONbutton = document.querySelector("#sendJSONbutton");
const sendMessageButton = document.querySelector(".send-btn");
const closeSettingsButton = document.querySelector("#closeSettingsBtn");
const behaviourSetting = document.querySelector("#behaviourSetting");
const modalBackground = document.querySelectorAll(".modal-background");
const loginButton = document.querySelector("#login-btn");
const openSettingsButton = document.querySelector("#openSettingsBtn");
const openDMsbutton = document.querySelector("#dms");
const profileSetting = document.querySelector("#profileSetting");
const visualSetting = document.querySelector("#visualSetting");
const infoSetting = document.querySelector("#infoSetting");
const toolbar = document.querySelector(".toolbar");
const toolbarBtn = document.querySelector(".toolbar-btn");
const uploadContainer = document.querySelector("#upload");
const input = document.querySelector("#input");
const langSelect = document.querySelector("#langSelect");

langSelect.onchange = () => {
  settings.visual.language.value =
    langSelect.options[langSelect.selectedIndex].value; //Set language to selection
  setSettings();
  updateLanguage();
};

input.addEventListener("paste", (event) => {
  let item = event.clipboardData.items[0];

  if (item.type.indexOf("image") === 0) {
    let blob = item.getAsFile();
    addFile(blob);
  }
});

uploadContainer.addEventListener("input", (event) => {
  addFile(document.querySelector("#upload").files[0]);
});

toolbarBtn.onclick = () => {
  toolbar.classList.toggle("show-toolbar");
};

embedButton.onclick = () => {
  let embed = document.querySelector("#embed");
  embed.hidden = !embed.hidden;
};

masqButton.onclick = () => {
  let masq = document.querySelector("#masquerade");
  masq.hidden = !masq.hidden;
};

bonfireButton.onclick = () => {
  bonfire();
};

refreshChatButton.onclick = () => {
  getMessages(state.active.channel);
};

sendJSONbutton.onclick = () => {
  state.messageMods.sendRawJSON = !state.messageMods.sendRawJSON;
};

sendMessageButton.onclick = () => {
  sendMessage();
};

closeSettingsButton.onclick = () => {
  document.querySelector("#settings").style.display = "none";
};

behaviourSetting.onclick = () => {
  loadSetting("behaviour");
};

visualSetting.onclick = () => {
  loadSetting("visual");
};

profileSetting.onclick = () => {
  loadSetting("profile");
};

infoSetting.onclick = () => {
  loadSetting("info");
}

modalBackground.forEach((element) => {
  element.onclick = () => {
    element.parentElement.style.display = "none";
  };
});

loginButton.onclick = () => {
  start();
};

openSettingsButton.onclick = () => {
  document.querySelector("#settings").style.display = "flex";
};

openDMsbutton.onclick = () => {
  loadDMs();
};

//@license-end
