// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

//
// Profile rendering
//

/**
 * Description
 * @param {String} userID ID of the user to fetch the profile of
 * @returns {null} Doesn't return
 */
async function loadProfile(userID) {
  let displayName = document.querySelector("#displayName");
  let username = document.querySelector("#username");
  let status = document.querySelector("#status");
  let profilePicture = document.querySelector("#profilePicture");
  let profileBackground = document.querySelector("#profileMedia");
  let presenceIcon = document.querySelector("#presenceIcon");
  let badgesContainer = document.querySelector("#badgesContainer");
  let bio = document.querySelector("#bio");
  let roleContainer = document.querySelector("#roleContainer");

  username.textContent = "";
  displayName.textContent = "";
  badgesContainer.textContent = "";
  status.textContent = "";
  bio.textContent = "";
  profilePicture.src = "";
  presenceIcon.src = "";

  const tmpUserProfile = await fetchResource(`users/${userID}/profile`);
  const memberData = cacheLookup("members", userID, state.active.server);
  const user = await userLookup(userID);

  username.textContent = `${user.username}#${user.discriminator}`;
  displayName.textContent = user.displayName;
  badgesContainer.replaceChildren();

  profilePicture.src = user.pfp;

  //Loki TODO: Style
  if (user.status) {
    if (user.status.text) status.textContent = user.status.text;
    presenceIcon.src = `../assets/images/presence/${
      user.status.presence ? user.status.presence : "Offline"
    }.svg`;
  }

  if (user.badges) {
    //Loki TODO: style badges
    Object.keys(user.badges).forEach((badge) => {
      if (user.badges[badge]) {
        let badgeContainer = document.createElement("div");
        let badgeImg = document.createElement("img");

        badgeImg.src = `${settings.instance.assets}${storage.badges[badge].asset}`;
        badgeContainer.classList.add("badge", badge);

        badgeContainer.appendChild(badgeImg);
        badgesContainer.appendChild(badgeContainer);
      }
    });
  }

  if (Object.keys(tmpUserProfile).indexOf("background") > -1) {
    //Loki TODO: Move this shit into style.css
    profileBackground.style.background = `linear-gradient(0deg, rgba(0,0,0,0.84) 10%, rgba(0,0,0,0) 100%),
        url(${settings.instance.autumn}/backgrounds/${tmpUserProfile.background._id}) center center / cover`;
  } else profileBackground.style.background = "";

  bio.innerHTML = parseMessageContent(tmpUserProfile).innerHTML;
  roleContainer.replaceChildren();

  if (memberData.roles)
    for (let i = 0; i < memberData.roles.length; i++) {
      const role = document.createElement("span");
      const roleData = cacheLookup(
        "roles",
        memberData.roles[i],
        state.active.server
      );

      role.classList.add("tag");
      role.textContent = roleData["name"];
      role.style.color = roleData["colour"];
      roleContainer.appendChild(role);
    }

  document.getElementById("userProfile").style.display = "flex";
}

//@license-end
