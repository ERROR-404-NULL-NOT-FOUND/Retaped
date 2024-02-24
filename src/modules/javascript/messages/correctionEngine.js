//Loki TODO: styling
const correctionsContainer = document.querySelector("#correctionsContainer");

const modules = { channel: channels, emote: emotes, user: users };
let channelMap = {};
let emoteMap = [];
let userMap = [];

let findMap = [];

function initUsers() {
  userMap.length = 0;
  cache.users.forEach((user) => {
    userMap.push({
      name: user.displayName,
      icon: user.pfp,
      id: user.id,
    });
  });
}

function init() {
  Object.keys(storage.emojis.standard).forEach((emoji) => {
    emoteMap.push({
      name: emoji,
      id: emoji,
      icon: `${settings.instance.emotes}/${storage.emojis.standard[emoji]
        .codePointAt(0)
        .toString(16)}.svg`,
    });
  });

  Object.keys(storage.emojis.custom).forEach((emoji) => {
    emoteMap.push({
      name: emoji,
      id: emoji,
      icon: `${settings.instance.legacyEmotes}/projects/revolt/emotes/${storage.emojis.custom[emoji]}`,
    });
  });

  cache.channels.forEach((channel) => {
    if (channel.type !== "DirectMessage") channelMap[channel.id] = channel.name;
  });

  cache.emotes.forEach((emote) => {
    emoteMap.push({
      name: emote.name,
      icon: `${settings.instance.autumn}/emojis/${emote.id}`,
      id: emote.id,
    });
  });
}

function fill() {
  const inputCont = document.querySelector("#input");
  const input =
    inputCont.value.split(" ")[inputCont.value.split(" ").length - 1];

  debugInfo("Correction winner determined; filling");
  const winner = findMap[0];
  inputCont.value =
    inputCont.value.substring(0, inputCont.value.length - input.length) +
    modules[winner.type](winner.id, true) +
    " ";
  correctionsContainer.replaceChildren();
}

function engine() {
  const inputCont = document.querySelector("#input").value;
  const input = inputCont.split(" ")[inputCont.split(" ").length - 1];
  if (!input) {
    correctionsContainer.replaceChildren();
    return;
  }

  findMap.length = 0;

  Object.values(modules).forEach((module) => {
    module(input).forEach((candidate) => {
      findMap.push(candidate);
    });
  });

  if (findMap.length === 0) {
    correctionsContainer.replaceChildren();
    return;
  }

  correctionsContainer.replaceChildren();
  findMap.forEach((candidate) => {
    let correctionContainer = document.createElement("div");
    let correctionImage = document.createElement("img");
    let correctionText = document.createElement("span");

    correctionImage.src = candidate.image;
    correctionText.innerText = candidate.name;

    correctionContainer.appendChild(correctionImage);
    correctionContainer.appendChild(correctionText);

    correctionsContainer.appendChild(correctionContainer);
  });
}

function channels(input, ret = false) {
  if (ret) return `<#${input}>`;
  if (input[0] !== "#") return [];
  if (findMap.length >= 5) return [];
  const processedIn = input.substring(1, input.length);

  let hits = [];
  Object.keys(channelMap).forEach((channel) => {
    if (hits.length >= 5) return;
    if (channelMap[channel].includes(processedIn)) {
      let channelInfo = cacheLookup("channels", channel);
      let channelImage = channelInfo.icon
        ? `${settings.instance.autumn}/icons/${channelInfo.icon._id}`
        : `${settings.instance.emotes}23.svg`;

      hits.push({
        id: channel,
        name: channelMap[channel],
        type: "channel",
        image: channelImage,
      });
    }
  });
  return hits;
}

function emotes(input, ret = false) {
  if (ret) return `:${input}:`;
  if (input[0] !== ":") return [];
  if (findMap.length >= 5) return [];

  const processedIn = input.split(":")[1];

  let hits = [];
  emoteMap.forEach((emote) => {
    if (hits.length >= 5) return;
    if (emote.name.includes(processedIn)) {
      hits.push({
        id: emote.id,
        name: emote.name,
        type: "emote",
        image: emote.icon,
      });
    }
  });
  return hits;
}

function users(input, ret = false) {
  if (ret) return `<@${input}>`;
  if (input[0] !== "@") return [];
  if (findMap.length >= 5) return [];

  const processedIn = input.split("@")[1];

  let hits = [];
  userMap.forEach((user) => {
    if (hits.length >= 5) return;
    if (user.name.includes(processedIn)) {
      hits.push({
        id: user.id,
        name: user.name,
        type: "user",
        image: user.icon,
      });
    }
  });
  return hits;
}
