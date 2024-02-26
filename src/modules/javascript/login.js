// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0

// TODO: replace all of the fucking if statements

/**
 * Handles login
 * @returns {null}
 */
async function login() {
  if (loginData.token.value || state.connection.token) {
    if (!state.connection.token) state.connection.token = loginData.token.value; //This if statement is so that autofill doesn't break it
  } else if (loginData.email && loginData.password) {
    let tokenResponse = await fetchResource(
      "/auth/session/login",
      "POST",
      JSON.stringify({
        email: loginData.email.value,
        password: loginData.password.value,
        friendly_name: "Retaped",
      })
    );

    if (tokenResponse.result === "Success") {
      state.connection.token = tokenResponse.token;
    } else {
      if (tokenResponse.type === "InvalidCredentials") {
        //TODO: check for other failing types
        showError({
          name: "LoginError",
          message: tokenResponse.type,
        });
        return false;
      } else if (tokenResponse.result === "MFA") {
        //Why is 2FA implemented like this
        if (!loginData.mfa) {
          showError({
            name: "LoginError",
            message: "MFA token required but not provided",
          });
          return false;
        }

        let mfaTokenResponse = await fetchResource(
          "/auth/session/login",
          "POST",
          JSON.stringify({
            mfa_ticket: tokenResponse.ticket,
            mfa_response: {
              totp_code: loginData.mfa.value,
            },
            friendly_name: "Retaped",
          })
        );

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
