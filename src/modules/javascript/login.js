// Handles login and init
// TODO: replace all of the fucking if statements
async function login() {
  await processSettings();

  if (document.getElementById("token").value || token) {
    if (!token) token = document.getElementById("token").value;
  } else if (
    document.getElementById("email").value &&
    document.getElementById("password").value
  ) {
    let tokenResponse = await fetch(
      `${settings.instance.delta}/auth/session/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
          friendly_name: "Retaped",
        }),
      },
    )
      .then((res) => res.json())
      .then((data) => data);

    if (tokenResponse.result === "Success") {
      token = tokenResponse.token;
    } else {
      if (tokenResponse.result === "Unauthorized") {
        localStorage.removeItem("token");
        showError(tokenResponse.result);
      } else {
        if (!document.querySelector("#mfa").value) {
          showError({ name: "LoginError", message: "MFA token required but not provided" });
          return;
        }

        let mfaTokenResponse = await fetch(
          `${settings.instance.delta}/auth/session/login`,
          {
            method: "POST",
            body: JSON.stringify({
              mfa_ticket: tokenResponse.ticket,
              mfa_response: {
                totp_code: document.querySelector("#mfa").value,
              },
              friendly_name: "Retaped",
            }),
          },
        )
          .then((res) => res.json())
          .then((data) => data);

        if (mfaTokenResponse.result === "Success") token = mfaTokenResponse.token;
        else {
          showError(mfaTokenResponse);
          return;
        }
      }
    }
  } else {
    showError({ name: "loginError", message: "no login method provided" });
    return;
  }

  if ((userProfile = await fetchResource("users/@me")) === false) {
    showError({ name: "loginError", message: "generic" });
    return;
  }

  if (!localStorage.getItem("token") && settings.behaviour.rememberMe) localStorage.setItem("token", token);

  loadSyncSettings();
  bonfire();

  document.querySelector(".login-screen").style.display = "none";
  document.getElementById("app").style.display = "grid";
}
