

//
// Variables
//

var cache = {
    users: [],
    channels: [],
    servers: [],
    messages : []
}

var activeChannel;
var currentReply;
var token;
var socket;
var userProfile;

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
    return 'Unable to load message'
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
                loadServers();
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
    if (await fetchResource('users/@me') === false) {
        showError("Login failed");
        return;
    }
    localStorage.setItem('token',token);

    bonfire();
    //Hiding elements
    document.getElementById('loginoe').hidden = true;
    document.getElementById('name').hidden = true;
    document.getElementById('descri').hidden = true;
    //Showing elements
    document.getElementById('logged').hidden = false;
    document.getElementById('messages').hidden = false;
}

async function loadServers() {
    let serverContainer = document.getElementById('servers');
    while (serverContainer.hasChildNodes()) {
        serverContainer.removeChild(serverContainer.lastChild)
    }
    for (let i=0; i<cache.servers.length; i++) {
        let server = document.createElement('button');
        server.addEventListener('click', function () { getChannels(cache.servers[i][0])});
        server.id = cache.servers[i][0];

        let serverText = document.createElement('span');
        serverText.className = 'server';
        serverText.innerText = cache.servers[i][1];
        
        server.appendChild(serverText);
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
        channel.addEventListener('click', function () { getMessages(cache.channels[i][0])});

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
        messageContainer.removeChild(messageContainer.lastChild)
    }
}
//
// * Processing
//

async function buildChannelCache(channels) {
    for(let i=0; i<channels.length; i++) {
        if(channels[i].channel_type === "TextChannel") {
            cache.channels.push([channels[i]._id, channels[i].name,  channels[i].channel_type, channels[i].server]);
        } else {
            cache.channels.push([channels[i]._id, channels[i].name, channels[i].channel_type])
        }
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
        cache.servers.push([servers[i]['_id'], servers[i]['name']]);
    }
    loadServers();
}

function parseMessage(data){
    console.log(data);
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
    
    const messageContainer = document.getElementById('messages');
    for (let i = messages.length - 1; i>=0; i--) {
        
        cache.messages.push([messages[i]._id, messages[i].author, messages[i].content])

        let message = document.createElement('div');
        let messageContent = document.createElement('p');
        let userdata = document.createElement('div');
        let username = document.createElement('span');
        let profilepicture = document.createElement('img');
        let reply = document.createElement('div');

        const user = cacheLookup('users', messages[i].author);

        username.textContent = user[1];
        profilepicture.src = `https://autumn.revolt.chat/avatars/${user[2]._id}`;

        userdata.appendChild(profilepicture);
        userdata.appendChild(username);

        messageContent.textContent = messages[i].content;
        if( messages[i].replies ){
            for( let j=0; j < messages[i].replies.length; j++){
                let replyContent = document.createElement('span'); 
                replyContent.textContent = '> ' + cacheLookup('messages', messages[i].replies[j])[2];
                reply.appendChild(replyContent)
            }
        }

        message.appendChild(userdata);
        message.appendChild(reply);
        message.appendChild(messageContent);

        message.id = messages[i]._id;
        message.class = 'message';

        messageContainer.appendChild(message);
    }
}