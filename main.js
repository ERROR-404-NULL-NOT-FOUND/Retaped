

//
// Variables
//

var cache = {
    //0 is id, 1 is username, 2 is pfp
    users: [],
    //0 is id, 1 is name
    channels: [],
    //0 is id, 1 is name
    servers: [],
    //0 is id, 1 is author, 2 is content
    messages : []
}

var activeReplies = [];

var activeChannel;
var currentReply;
var token;
var socket;
var userProfile;
var activeRequests = 0;

//
// Run on page load
//
window.onload = function () {
    token = localStorage.getItem('token');
    if (token) login();
}

//
// Functions
//

function cacheLookup (resource, ID) {
    for (let i=0; i<cache[resource].length; i++){
        if (cache[resource][i][0] === ID) return cache[resource][i];
    }
    return 'Unable to load resource';
}

async function fetchResource (target) {
    //Return of false means that it failed
    const res = await fetch(`https://api.revolt.chat/${target}`, {
        'headers': {
            'x-session-token': token
        },
        'method': 'GET'
    });
    return res.json()
}

//
// Main stuff
//
async function bonfire (){
    socket = new WebSocket('wss://ws.revolt.chat');
    
    socket.addEventListener('open', async function (event) {
        socket.send(`{"type": "Authenticate","token": "${token}"}`);
    })

    socket.addEventListener('message', async function (event) {
        let data;
        data = JSON.parse(event.data);
        switch (data.type) {
            case 'Authenticated':
                document.getElementById('connected').innerText = 'Connected';
                break;
            case 'Message':
                if(data.channel == activeChannel){
                    parseMessage(data);
                }
                break;
            case 'Error':
                document.getElementById('error').innerText = data.error;
                break;
            case 'Ready':
                buildServerCache(data.servers);
                buildChannelCache(data.channels);
                buildUserCache(data.users);
                getServers();
        }
    });

    socket.addEventListener('error', async function (event) {
        document.getElementById('error');
    });
}

async function login(){

    if (document.getElementById('token').value) {
        token = document.getElementById('token').value;

    }
    if ((userProfile = await fetchResource('users/@me')) === false) {
        showError("Login failed");
        return;
    }
    localStorage.setItem('token',token);

    bonfire();
    //Hiding elements
    document.querySelector('.login-screen').style.display = "none";
    //Showing elements
    document.getElementById('logged').style.display = "grid";
    document.getElementById('loginoe').hidden = true;
    document.getElementById('name').hidden = true;
    document.getElementById('descri').hidden = true;
    //Showing elements
    document.getElementById('logged').hidden = false;
    document.getElementById('messages').hidden = false;
    document.getElementById('replyMsg').hidden = false;
}

async function getServers() {
    let serverContainer = document.getElementById('servers');
    while (serverContainer.hasChildNodes()) {
        serverContainer.removeChild(serverContainer.lastChild)
    }
    for (let i=0; i<cache.servers.length; i++) {
        let server = document.createElement('button');

        server.onclick = () => {
            getChannels(cache.servers[i][0])
        };
        
        server.id = cache.servers[i][0];

        let serverIcon = document.createElement('img');
        serverIcon.className = 'server';
        if (cache.servers[i][2] == null){
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            const text = cache.servers[i][1].charAt(0);
            context.font = '64px Arial';
            context.fillStyle = '0,0,0';
            context.fillText(text, 8, 48);
            serverIcon.src = canvas.toDataURL();
        } else {
            serverIcon.src = `https://autumn.revolt.chat/icons/${cache.servers[i][2]}?max_side=64`;
        }
        server.appendChild(serverIcon);
        serverContainer.appendChild(server);
    }
}

async function getChannels(id) {
    let channelContainer = document.getElementById('channels');
    
    while (channelContainer.hasChildNodes()) {
        channelContainer.removeChild(channelContainer.lastChild)
    }

    for (let i=0; i<cache.channels.length; i++) {
        if (cache.channels[i][2] !== 'TextChannel') continue;
        if (cache.channels[i][3] !== id) continue;
        let channel = document.createElement('button');

        channel.onclick = () => {
            getMessages(cache.channels[i][0])
        };

        let channelText = document.createElement('span');
        channelText.className = 'channel';
        channelText.id = cache.channels[i][0];
        channelText.innerText = cache.channels[i][1];
        
        channel.appendChild(channelText);
        channelContainer.appendChild(channel);
    }
}

function clearMessages() {
    const messageContainer = document.getElementById('messages');
    while (messageContainer.hasChildNodes()) {
        messageContainer.removeChild(messageContainer.lastChild);
    }
}
//
// * Processing
//

async function buildChannelCache(channels) {
    for(let i=0; i<channels.length; i++) {
        switch(channels[i].channel_type) {
            case 'TextChannel':
                cache.channels.push([channels[i]._id, channels[i].name,  channels[i].channel_type, channels[i].server]);
                break;
            case 'Group':
                cache.channels.push([channels[i]._id, channels[i].name, channels[i].channel_type]);
                break;
            case 'DirectMessage':
                cache.channels.push([channels[i]._id, channels[i].recipients, channels[i].channel_type]);
    }
}

async function buildUserCache(users) {
    for(let i=0; i<users.length; i++) {
        if (users[i].avatar){
            cache.users.push([users[i]._id, users[i].username, users[i].avatar]);
        } else {
            cache.users.push([users[i]._id, users[i].username, undefined]);
        }
    }
}

async function buildServerCache(servers) {
    for(let i=0; i<servers.length; i++) {
        cache.servers.push([servers[i]['_id'], servers[i]['name'], servers[i].icon ? servers[i].icon._id : null]);
    }
    getServers();
}

function parseMessage(message){
    const messageContainer = document.getElementById('messages');
    cache.messages.push([message._id, message.author, message.content]);

    let messageDisplay = document.createElement('div');
    let messageContent = document.createElement('p');
    let userdata = document.createElement('div');
    let username = document.createElement('button');
    let profilepicture = document.createElement('img');
    let reply = document.createElement('div');
    let replyButton = document.createElement('button');

    const user = cacheLookup('users', message.author);

    username.textContent = user[1];
    username.onclick = () => { loadProfile(user[0]) };
    profilepicture.src = user[2] ?
    `https://autumn.revolt.chat/avatars/${user[2]._id}?max_side=256`:
    `https://api.revolt.chat/users/${user[0]._id}/default_avatar`;
    userdata.appendChild(profilepicture);
    userdata.appendChild(username);

    messageContent.textContent = message.content;
    if( message.replies ){
        for( let j=0; j < message.replies.length; j++){
            let replyContent = document.createElement('span'); 
            replyContent.textContent = '> ' + cacheLookup('messages', message.replies[j])[2];
            reply.appendChild(replyContent)
        }
    }

    replyButton.onclick = () => {
        activeReplies.push(
            {
                'id': message['_id'],
                'mention': false
            });
        const replyText = document.createElement('span');
        replyText.textContent = '> ' + message.content;
        document.getElementById('replyMsg').appendChild(replyText);
    };
    replyButton.innerText = 'Reply';

    messageDisplay.appendChild(userdata);
    messageDisplay.appendChild(reply);
    messageDisplay.appendChild(replyButton);
    messageDisplay.appendChild(messageContent);

    messageDisplay.id = message._id;
    messageDisplay.class = 'message';

    messageContainer.appendChild(messageDisplay);
}

async function getMessages(id){
    cache.messages = [];

    activeChannel = id;
    
    fetchResource(`channels/${id}`)
    .then( data => {
        document.getElementById('chanName').innerText = 
        data.channel_type === 'DirectMessage' ? 
        data.recipients[0] : data.name
    });

    const placeholder = await fetchResource(`channels/${id}/messages?include_users=true&sort=latest`);
    const users = placeholder.users;

    for (let i=0; i<users.length; i++){
        cache.users.push([users[i]._id, users[i].username, users[i].avatar]);
    }

    clearMessages();
    
    const messages = placeholder.messages;

    for (let i = messages.length - 1; i>=0; i--) {
        parseMessage(messages[i]);
    }
}

async function loadDMUserName (userID) {
    while (true) { 
        if(activeRequests<10) break;
        await new Promise(resolve => setTimeout(resolve, 1000))
    };
    activeRequests++;
    let returnValue = await fetchResource(`users/${userID}`);
    activeRequests--;
    return returnValue;

}

async function loadDMs() {
    let channelContainer = document.getElementById('channels');
    //Clear channel field
    while (channelContainer.hasChildNodes()) { channelContainer.removeChild(channelContainer.lastChild); }
    activeRequests = 0;
    
    for( let i=0; i<cache.channels.length; i++) {
        //Checking for only DMs
        if (!['DirectMessage','Group'].includes(cache.channels[i][2])) continue;

        const dmButton = document.createElement('button');
    
        dmButton.textContent = cache.channels[i][2] === 'Group' ?
            cache.channels[i][1] : 
                cache.channels[i][1][0] === userProfile._id ?
                    cache.channels[i][1][1] :
                    cache.channels[i][1][0];

        dmButton.onClick = () => {
            getMessages(cache.channels[i][0]);
        };

        dmButton.class = 'channel';
        dmButton.id = cache.channels[i][0];
        
        channelContainer.appendChild(dmButton);
        if (cache.channels[i][2] === 'DirectMessage')
            loadDMUserName(dmButton.textContent).then(data => document.getElementById(cache.channels[i][0]).textContent = data.username); 
    }
}
//
//Profiles
//

async function loadProfile(userID) {
    let userProfile = await fetchResource(`/users/${userID}/profile`);
    let username = document.getElementById('username');
    let profilePicture = document.getElementById('profilePicture');
    let profileBackground = document.getElementById('profileBackground');
    let bio = document.getElementById('bio');
    
    username.textContent = cacheLookup('users', userID)[1];
    profilePicture.src = `https://autumn.revolt.chat/avatars/${cacheLookup('users', userID)[2]._id}`;
    profileBackground.src = `https://autumn.revolt.chat/backgrounds/${userProfile.background._id}`;
    bio.textContent = userProfile.content;
    document.getElementById('userProfile').hidden=false;
}

//
// Message Sending
//

async function sendMessage () {
    const messageContainer = document.getElementById('input');
    let message = messageContainer.value;
    //Checking for valid pings, and replacing with an actual ping
    if (message.search(/ @[^ ]*/) != -1) {
        pings = /@[^ ]*/[Symbol.match](message);
        for (let i = 0; i < pings.length; i++) {
            message = message.replace(pings[i], `<@${cacheLookup('users',pings[i].replace("@", ""))[1]}>`);
        }
    }

    await fetch(`https://api.revolt.chat/channels/${activeChannel}/messages`, {
        'headers': {
            'x-session-token': token
        },
        'method': 'POST',
        'body': JSON.stringify({
            content: message,
            replies: activeReplies
        })
    });
    messageContainer.value = '';
    activeReplies = [];
}

//
// UX
//
let toolbar = document.querySelector(".toolbar");
let toolbarBtn = document.querySelector(".toolbar-btn");
toolbarBtn.addEventListener("click", () => {
    toolbar.classList.toggle("show-toolbar");
});
}
