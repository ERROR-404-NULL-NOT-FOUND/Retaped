/**
 * Macro for showing error codes
 * @param {Object} error Object of the error to display
 * @returns {none} Doesn't return
 */
async function showError(error) {
  let errorContainer;
  if (state.errorTimeout) clearTimeout(state.errorTimeout);

  console.error(error);
  if (!state.connection.token)
    errorContainer = document.querySelector("#loginErrorContainer");
  else errorContainer = document.querySelector("#errorContainer");

  errorContainer.style.display = "block";

  errorContainer.innerText = `${error.name}: ${error.message}`; //Only has one child, therefore this is safe

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
