// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

// TODO: replace all of the fucking if statements

/**
 * Handles login
 * @returns {null}
 */
async function login() {
  if (loginData.token.value || state.connection.token) {
    if (!state.connection.token) state.connection.token = loginData.token.value;
  } else if (loginData.email && loginData.password) {
    let tokenResponse = await fetch(
      `${settings.instance.delta}/auth/session/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: loginData.email.value,
          password: loginData.password.value,
          friendly_name: "Retaped",
        }),
      }
    )
      .then((res) => res.json())
      .then((data) => data);

    if (tokenResponse.result === "Success") {
      state.connection.token = tokenResponse.token;
    } else {
      if (tokenResponse.type === "InvalidCredentials") {
        showError({
          name: "LoginError",
          message: "InvalidCredentials"
        });
        return false;
      } else if (tokenResponse.result === "MFA"){
        if (!loginData.mfa) {
          showError({
            name: "LoginError",
            message: "MFA token required but not provided",
          });
          return false;
        }

        let mfaTokenResponse = await fetch(
          `${settings.instance.delta}/auth/session/login`,
          {
            method: "POST",
            body: JSON.stringify({
              mfa_ticket: tokenResponse.ticket,
              mfa_response: {
                totp_code: loginData.mfa.value,
              },
              friendly_name: "Retaped",
            }),
          }
        )
          .then((res) => res.json())
          .then((data) => data);

        if (mfaTokenResponse.result === "Success")
          state.connection.token = mfaTokenResponse.token;
        else {
          showError(mfaTokenResponse);
          return false;
        }
      }
    }
  } else {
    showError({ name: "loginError", message: "no login method provided" });
    return false;
  }

  if (
    (state.connection.userProfile = await fetchResource("users/@me")) === false
  ) {
    showError({ name: "loginError", message: "failed validation" });
    localStorage.removeItem("token");
    return false;
  }
}

//@license-end
