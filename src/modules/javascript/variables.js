// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// All global variables used in the app
//

// Note: var is used to differentiate between local and global variable definitions

const screens = {
  login: document.querySelector(".login-screen"),
  app: document.querySelector("#app"),
};

const loginData = {
  token: document.querySelector("#token"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  mfa: document.querySelector("#mfa"),
  instanceURL: document.querySelector("#customInstance"),
};

//Local settings; saved to localstorage
var settings;

var storage = {
  badges: {},
  emojis: {},
  permissions: {},
  language: {},
  packageSettings: {},
};

var state = {
  errorTimeout: [],
  homeScreen: false,
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
    },
  },
};

var assets = {
  emojis: {},
  badges: {},
};

//@license-end
