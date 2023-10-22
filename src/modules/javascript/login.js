// Handles login and init
// TODO: replace all of the fucking if statements



async function login() {
  await processSettings();

  if (loginData.token || state.connection.token) {
    if (!state.connection.token) state.connection.token = loginData.token;
  } else if (
    loginData.email &&
    loginData.password
  ) {
    let tokenResponse = await fetch(
      `${settings.instance.delta}/auth/session/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password,
          friendly_name: "Retaped",
        }),
      },
    )
      .then((res) => res.json())
      .then((data) => data);

    if (tokenResponse.result === "Success") {
      state.connection.token = tokenResponse.token;
    } else {
      if (tokenResponse.result === "Unauthorized") {
        localStorage.removeItem("token");
        showError(tokenResponse);
      } else {
        if (!loginData.mfa) {
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
                totp_code: loginData.mfa,
              },
              friendly_name: "Retaped",
            }),
          },
        )
          .then((res) => res.json())
          .then((data) => data);

        if (mfaTokenResponse.result === "Success") state.connection.token = mfaTokenResponse.token;
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

  if ((state.connection.userProfile = await fetchResource("users/@me")) === false) {
    showError({ name: "loginError", message: "generic" });
    return;
  }

  if (!localStorage.getItem("token") && settings.behaviour.rememberMe) localStorage.setItem("token", state.connection.token);

  loadSyncSettings();
  bonfire();

  screens.login.style.display = "none";
  screens.app.style.display = "grid";
}
