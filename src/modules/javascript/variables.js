//
// All global variables used in the app
//

const screens = {
  login: document.querySelector(".login-screen"),
  app: document.querySelector("#app"),
}

const loginData = {
  token: document.querySelector("#token"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  mfa: document.querySelector("#mfa"),
}

//Local settings; saved to localstorage
var settings = {
  behaviour: {
    dataSaver: false,
    extremeDataSaver: false,
    loadImages: true,
    rememberMe: true,
  },

  visual: {
    legacyStyleSheet: false,
    compactMode: false,
    revoltTheme: true,
    showPresenceIconsInChat: true,
  },

  instance: {
    delta: "https://api.revolt.chat",
    bonfire: "wss://ws.revolt.chat",
    autumn: "https://autumn.revolt.chat",
    january: "https://jan.revolt.chat",
    assets: "https://app.revolt.chat",
    legacyEmotes: "https://dl.insrt.uk",
  }
};

//
var state = {
  errorTimeout: [],
  messageMods: {
    sendRawJSON: false,
    replies: [],

    embed: {
      title: document.querySelector("#embedTitle").value,
      description: document.querySelector("#embedDesc").value,
      media: document.querySelector("#embedMedia").value,
      colour: document.querySelector("#embedColour").value,
      url: document.querySelector("#embedURL").value,
    },
    masquerade: {
      name: document.querySelector("#masqName").value,
      colour: document.querySelector("#masqColour").value,
      avatar: document.querySelector("#masqPfp").value,
    },

    editing: "",
    attachments: [],
  },

  active: {
    server: "",
    channel: "",
  },

  messageSending: false,

  connection: {
    token: "",
    socket: "",
    userProfile: {},
  },

  currentlyTyping: [],

  ordering: [],

  cssVars: getComputedStyle(document.querySelector(":root")),

  unreads: {
    unreadList: [],

    muted: {
      channels: [],
      servers: [],
    },

    unread: {
      channels: [],
      servers: [],
      messages: [],
    },

    mentioned: {
      channels: [],
      servers: [],
    }
  }
}

var assets = {
  emojis: {},
  badges: {},
}