/**
 * Macro for showing error codes
 * @param {Object} error Object of the error to display
 * @returns {none} Doesn't return
 */
async function showError(error) {
  if (state.errorTimeout) clearTimeout(state.errorTimeout);

  console.error(error);
  let loginErrorContainer = document.querySelector("#loginErrorContainer");
  let loggedErrorContainer = document.querySelector("#errorContainer");

  loggedErrorContainer.style.display = "block";
  loginErrorContainer.style.display = "block";

  loggedErrorContainer.innerText = `${error.name}: ${error.message}`; //Only has one child, therefore this is safe
  loginErrorContainer.innerText = `${error.name}: ${error.message}`; //Only has one child, therefore this is safe

  state.errorTimeout = setTimeout(() => {
    errorContainer.style.display = "none";
  }, 10000); //10 seconds
}

function debugInfo(info, data = undefined) {
  if (storage.packageSettings && storage.packageSettings.debug) {
    console.info(`INFO: ${info}`);
    if (data) console.info(data);
  }
}
