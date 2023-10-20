const embedBotton = document.querySelector("#sendEmbedButton");
const masqButton = document.querySelector("#sendMasqButton")
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

embedBotton.onclick = () => {
    let embed = document.querySelector("#embed");
    embed.hidden = !embed.hidden;
};

masqButton.onclick = () => {
    let masq = document.querySelector('#masquerade');
    masq.hidden = !masq.hidden;
}

bonfireButton.onclick = () => {
    bonfire();
}

refreshChatButton.onclick = () => {
    getMessages(activeChannel);
}

sendJSONbutton.onclick = () => {
    sendRawJSON = !sendRawJSON;
}

sendMessageButton.onclick = () => {
    sendMessage();
}

closeSettingsButton.onclick = () => {
    document.querySelector("#settings").style.display = "none";
}

behaviourSetting.onclick = () => {
    loadSetting('behaviour');
}

modalBackground.forEach((element) => {
    element.onclick = () => {
        element.parentElement.style.display = 'none';
    }
});

loginButton.onclick = () => {
    login();
}

openSettingsButton.onclick = () => {
    document.querySelector("#settings").style.display = "flex";
}

openDMsbutton.onclick = () => {
    loadDMs();
}