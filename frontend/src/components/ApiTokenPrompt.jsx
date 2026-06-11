import { useState } from "react";
import {
  clearApiToken,
  getApiToken,
  hasRuntimeApiToken,
  setApiToken,
} from "../api/authToken";

export default function ApiTokenPrompt({ open, onClose }) {
  const [token, setToken] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const hasSavedToken = hasRuntimeApiToken();

  if (!open) {
    return null;
  }

  function handleConnect(event) {
    event.preventDefault();

    const savedToken = setApiToken(token);
    // console.log("[auth-debug] token saved: yes/no", Boolean(savedToken));
    // console.log(
    //   "[auth-debug] token readable after save: yes/no",
    //   Boolean(getApiToken()),
    // );

    if (!savedToken) {
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    onClose();
  }

  function handleClearToken() {
    clearApiToken();
    setToken("");
    setShowValidation(false);
  }

  return (
    <div className="api-token-prompt" role="presentation">
      <div
        className="api-token-prompt__backdrop"
        aria-hidden="true"
      ></div>
      <form
        className="api-token-prompt__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-token-prompt-title"
        onSubmit={handleConnect}
      >
        <p className="api-token-prompt__eyebrow">LAN Mode</p>
        <h1 id="api-token-prompt-title" className="api-token-prompt__title">
          LAN Access Token Required
        </h1>
        <p className="api-token-prompt__message">
          Enter the API token from your PC LAN launcher.
        </p>

        <label className="api-token-prompt__field">
          <span className="api-token-prompt__label">API Token</span>
          <input
            className="api-token-prompt__input"
            type="password"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              if (showValidation && event.target.value.trim()) {
                setShowValidation(false);
              }
            }}
            autoComplete="off"
            autoFocus
          />
        </label>

        {showValidation ? (
          <p className="api-token-prompt__error" role="alert">
            Enter an API token to continue.
          </p>
        ) : null}

        <div className="api-token-prompt__actions">
          <button
            type="submit"
            className="api-token-prompt__button api-token-prompt__button--primary"
          >
            Connect
          </button>
          <button
            type="button"
            className="api-token-prompt__button api-token-prompt__button--secondary"
            onClick={handleClearToken}
          >
            {hasSavedToken ? "Reset Token" : "Clear"}
          </button>
        </div>
      </form>
    </div>
  );
}
