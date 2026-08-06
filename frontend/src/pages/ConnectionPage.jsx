import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, QrCode, Server, ShieldCheck, Wifi } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api/apiBase";
import { applyNetworkInfoConfig } from "../api/appConfig";
import { getAppMode, isOfflineMode, setAppMode } from "../appMode/appMode";
import {
  clearBackendBaseUrl,
  getBackendBaseUrl,
  getDefaultBackendBaseUrl,
  hasSavedBackendBaseUrl,
  isNativeAndroidRuntime,
  normalizeBackendBaseUrl,
  setBackendBaseUrl,
} from "../api/backendBaseUrl";
import { getApiErrorMessage } from "../api/apiErrors";
import {
  DEMO_MODE_UPDATED_EVENT,
  isDemoMode,
  setDemoMode,
} from "../utils/demoMode";
import "../styles/ConnectionPage.css";

function formatToggle(value) {
  return value ? "Enabled" : "Disabled";
}

function ConnectionUrlCard({ label, url, copiedUrl, onCopy }) {
  const isCopied = copiedUrl === url;

  return (
    <div className="connection-page__url-card">
      <div className="connection-page__url-card-copy">
        <p className="connection-page__url-label">{label}</p>
        <code className="connection-page__url-value">{url}</code>
      </div>
      <button
        type="button"
        className="connection-page__button connection-page__button--secondary"
        onClick={() => onCopy(url)}
      >
        {isCopied ? <Check size={16} /> : <Copy size={16} />}
        {isCopied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function ConnectionPage() {
  const [appMode, setAppModeState] = useState(() => getAppMode());
  const [backendUrlInput, setBackendUrlInput] = useState(() => getBackendBaseUrl());
  const [networkInfo, setNetworkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("error");
  const [copiedUrl, setCopiedUrl] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingBackendUrl, setSavingBackendUrl] = useState(false);
  const [demoModeEnabled, setDemoModeEnabled] = useState(() => isDemoMode());
  const copiedTimerRef = useRef(null);
  const isAndroidRuntime = isNativeAndroidRuntime();
  const defaultBackendBaseUrl = getDefaultBackendBaseUrl();
  const currentBackendBaseUrl = getBackendBaseUrl();
  const usingSavedBackendBaseUrl = hasSavedBackendBaseUrl();
  const offlineModeEnabled = isOfflineMode(appMode);

  useEffect(() => {
    let isMounted = true;

    async function loadNetworkInfo(baseURL) {
      if (!isMounted) {
        return null;
      }

      setLoading(true);
      setMessage("");
      setMessageTone("error");

      try {
        const response = await api.get(
          "/system/network-info",
          baseURL ? { baseURL } : undefined,
        );

        if (isMounted) {
          setNetworkInfo(response.data);
          applyNetworkInfoConfig(response.data);
        }

        return response.data;
      } catch (error) {
        if (error?.response?.status === 401) {
          return null;
        }

        if (isMounted) {
          setMessage(
            getApiErrorMessage(error, "Unable to load connection details."),
          );
          setMessageTone("error");
        }

        return null;
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (!currentBackendBaseUrl && isAndroidRuntime) {
      setLoading(false);
      return () => {
        isMounted = false;
        if (copiedTimerRef.current) {
          window.clearTimeout(copiedTimerRef.current);
        }
      };
    }

    loadNetworkInfo(currentBackendBaseUrl || undefined);

    function handleDemoModeUpdated() {
      if (!isMounted) {
        return;
      }

      setDemoModeEnabled(isDemoMode());
    }

    window.addEventListener(DEMO_MODE_UPDATED_EVENT, handleDemoModeUpdated);

    return () => {
      isMounted = false;
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      window.removeEventListener(DEMO_MODE_UPDATED_EVENT, handleDemoModeUpdated);
    };
  }, []);

  const bestLanUrl = useMemo(
    () => networkInfo?.lan_urls?.[0] || "",
    [networkInfo],
  );

  async function loadNetworkInfoForBaseUrl(baseURL) {
    setLoading(true);
    setMessage("");
    setMessageTone("error");

    try {
      const response = await api.get(
        "/system/network-info",
        baseURL ? { baseURL } : undefined,
      );
      setNetworkInfo(response.data);
      applyNetworkInfoConfig(response.data);
      return {
        status: "success",
        data: response.data,
      };
    } catch (error) {
      if (error?.response?.status === 401) {
        return {
          status: "unauthorized",
          data: null,
        };
      }

      if (error?.response?.status !== 401) {
        setMessage(
          getApiErrorMessage(error, "Unable to load connection details."),
        );
        setMessageTone("error");
      }

      return {
        status: "error",
        data: null,
      };
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl(url) {
    if (!url) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setMessage("Clipboard copy is unavailable in this browser. Copy the URL manually.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setMessage("");

      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }

      copiedTimerRef.current = window.setTimeout(() => {
        setCopiedUrl("");
      }, 1600);
    } catch {
      setMessage("Could not copy the URL. Please copy it manually.");
      setMessageTone("error");
    }
  }

  async function handleTestConnection() {
    let normalizedBackendBaseUrl = "";

    try {
      normalizedBackendBaseUrl = normalizeBackendBaseUrl(backendUrlInput);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Enter a valid backend URL before testing.",
      );
      setMessageTone("error");
      return;
    }

    setTestingConnection(true);
    const result = await loadNetworkInfoForBaseUrl(normalizedBackendBaseUrl);

    if (result?.status === "success") {
      setBackendUrlInput(normalizedBackendBaseUrl);
      setMessage("Connection test succeeded.");
      setMessageTone("success");
    }

    setTestingConnection(false);
  }

  async function handleSaveBackendUrl() {
    let normalizedBackendBaseUrl = "";

    try {
      normalizedBackendBaseUrl = setBackendBaseUrl(backendUrlInput);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Enter a valid backend URL before saving.",
      );
      setMessageTone("error");
      return;
    }

    setSavingBackendUrl(true);
    setBackendUrlInput(normalizedBackendBaseUrl);
    const result = await loadNetworkInfoForBaseUrl(normalizedBackendBaseUrl);

    if (result?.status === "success") {
      setMessage("Backend URL saved.");
      setMessageTone("success");
    } else if (result?.status === "unauthorized") {
      setMessage("Backend URL saved. Finish token entry to continue.");
      setMessageTone("success");
    }

    setSavingBackendUrl(false);
  }

  async function handleResetBackendUrl() {
    clearBackendBaseUrl();
    const resetBackendBaseUrl = getBackendBaseUrl();
    setBackendUrlInput(resetBackendBaseUrl);

    if (resetBackendBaseUrl) {
      const result = await loadNetworkInfoForBaseUrl(resetBackendBaseUrl);

      if (result?.status === "success") {
        setMessage("Runtime backend URL cleared. Using the build default.");
        setMessageTone("success");
      } else if (result?.status === "unauthorized") {
        setMessage(
          "Runtime backend URL cleared. Using the build default. Finish token entry to continue.",
        );
        setMessageTone("success");
      }

      return;
    }

    setNetworkInfo(null);
    setLoading(false);
    setMessage(
      isAndroidRuntime
        ? "Runtime backend URL cleared. Enter your PC LAN URL to reconnect."
        : "Runtime backend URL cleared.",
    );
    setMessageTone("success");
  }

  function handleAppModeChange(nextMode) {
    try {
      const normalizedMode = setAppMode(nextMode);
      setAppModeState(normalizedMode);
      setMessage(
        normalizedMode === "offline"
          ? "Offline Mode enabled. PC-only actions like library scans stay unavailable."
          : "LAN Mode enabled. The app will use your PC backend for library actions.",
      );
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not change app mode.",
      );
      setMessageTone("error");
    }
  }

  function handleDemoModeChange(nextValue) {
    try {
      setDemoMode(nextValue);
      setDemoModeEnabled(isDemoMode());
      setMessage(
        nextValue
          ? "Demo mode enabled. The UI will mask track and playlist details."
          : "Demo mode disabled. Real library details are visible again.",
      );
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not change demo mode.",
      );
      setMessageTone("error");
    }
  }

  return (
    <main className="connection-page">
      <div className="connection-page__inner">
        <section className="connection-page__hero">
          <div className="connection-page__hero-copy">
            <p className="connection-page__eyebrow">LAN helper</p>
            <h1 className="connection-page__title">Connection</h1>
            <p className="connection-page__lead">
              Use these URLs to connect a phone or tablet on the same Wi-Fi
              network. The API token is never shown here.
            </p>
          </div>

          <div className="connection-page__status-row" aria-label="Connection status">
            <span className="connection-page__pill">
              <ShieldCheck size={16} />
              LAN mode {formatToggle(Boolean(networkInfo?.lan_mode))}
            </span>
            <span className="connection-page__pill">
              <Server size={16} />
              Port {networkInfo?.backend_port ?? "-"}
            </span>
            <span className="connection-page__pill">
              <Wifi size={16} />
              API token configured{" "}
              {formatToggle(Boolean(networkInfo?.api_token_configured))}
            </span>
            <span className="connection-page__pill">
              App mode {offlineModeEnabled ? "Offline" : "LAN"}
            </span>
          </div>
        </section>

        {message ? (
          <div
            className={`connection-page__message connection-page__message--${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </div>
        ) : null}

        <section className="connection-page__panel">
          <div className="connection-page__panel-header">
            <div>
              <p className="connection-page__panel-eyebrow">App mode</p>
              <h2>LAN Mode / Offline Mode</h2>
            </div>
            <p className="connection-page__panel-note">
              LAN Mode controls the PC backend. Offline Mode uses downloaded tracks
              already stored on this device.
            </p>
          </div>

          <div className="connection-page__mode-toggle" role="group" aria-label="App mode">
            <button
              type="button"
              className={`connection-page__mode-option${!offlineModeEnabled ? " connection-page__mode-option--active" : ""}`}
              onClick={() => handleAppModeChange("lan")}
            >
              <span className="connection-page__mode-title">LAN Mode</span>
              <span className="connection-page__mode-copy">
                Connects to the PC backend and keeps scan, clear, and other PC-only actions available.
              </span>
            </button>

            <button
              type="button"
              className={`connection-page__mode-option${offlineModeEnabled ? " connection-page__mode-option--active" : ""}`}
              onClick={() => handleAppModeChange("offline")}
            >
              <span className="connection-page__mode-title">Offline Mode</span>
              <span className="connection-page__mode-copy">
                Uses downloaded tracks on this device. PC-only actions like scan folders stay unavailable.
              </span>
            </button>
          </div>

          <p className="connection-page__setting-note">
            Current app mode: <strong>{offlineModeEnabled ? "Offline Mode" : "LAN Mode"}</strong>
          </p>
        </section>

        <section className="connection-page__panel">
          <div className="connection-page__panel-header">
            <div>
              <p className="connection-page__panel-eyebrow">Privacy</p>
              <h2>Demo Mode</h2>
            </div>
            <p className="connection-page__panel-note">
              Demo mode masks track, playlist, and library details in the UI.
            </p>
          </div>

          <div className="connection-page__settings-actions">
            <button
              type="button"
              className={`connection-page__button${demoModeEnabled ? " connection-page__button--primary" : " connection-page__button--secondary"}`}
              onClick={() => handleDemoModeChange(true)}
              disabled={demoModeEnabled}
            >
              Turn Demo On
            </button>
            <button
              type="button"
              className={`connection-page__button${!demoModeEnabled ? " connection-page__button--primary" : " connection-page__button--secondary"}`}
              onClick={() => handleDemoModeChange(false)}
              disabled={!demoModeEnabled}
            >
              Turn Demo Off
            </button>
          </div>

          <p className="connection-page__setting-note">
            Current demo mode: <strong>{demoModeEnabled ? "Enabled" : "Disabled"}</strong>
          </p>
        </section>

        <section className="connection-page__panel">
          <div className="connection-page__panel-header">
            <div>
              <p className="connection-page__panel-eyebrow">Backend</p>
              <h2>Backend URL</h2>
            </div>
            <p className="connection-page__panel-note">
              Change the PC backend address at runtime without rebuilding the Android app.
            </p>
          </div>

          <div className="connection-page__settings-grid">
            <div className="connection-page__setting-card">
              <p className="connection-page__url-label">Current backend URL</p>
              <code className="connection-page__url-value">
                {currentBackendBaseUrl || "Not set"}
              </code>
              <p className="connection-page__setting-note">
                {usingSavedBackendBaseUrl
                  ? "Using the saved runtime backend URL."
                  : defaultBackendBaseUrl
                    ? "Using the build default backend URL."
                    : "No backend URL is saved yet."}
              </p>
            </div>

            <div className="connection-page__setting-card">
              <p className="connection-page__url-label">Build default</p>
              <code className="connection-page__url-value">
                {defaultBackendBaseUrl || "Not configured"}
              </code>
              <p className="connection-page__setting-note">
                Runtime settings override this value until you reset them.
              </p>
            </div>
          </div>

          <label className="connection-page__field">
            <span className="connection-page__field-label">PC backend URL</span>
            <input
              className="connection-page__input"
              type="url"
              inputMode="url"
              placeholder="http://192.168.1.50:8000"
              value={backendUrlInput}
              onChange={(event) => setBackendUrlInput(event.target.value)}
              autoComplete="off"
            />
          </label>

          <p className="connection-page__setting-note">
            Example: <code className="connection-page__inline-code">http://192.168.1.50:8000</code>
          </p>

          {isAndroidRuntime ? (
            <div className="connection-page__warning" role="note">
              Do not use localhost for your PC backend. Use your PC LAN IP.
            </div>
          ) : null}

          <div className="connection-page__settings-actions">
            <button
              type="button"
              className="connection-page__button connection-page__button--secondary"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              className="connection-page__button connection-page__button--primary"
              onClick={handleSaveBackendUrl}
              disabled={savingBackendUrl}
            >
              {savingBackendUrl ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="connection-page__button connection-page__button--secondary"
              onClick={handleResetBackendUrl}
            >
              Reset to Build Default
            </button>
          </div>
        </section>

        {loading && !networkInfo ? (
          <section className="connection-page__panel" aria-live="polite">
            <p className="connection-page__state-title">Loading connection info...</p>
            <p className="connection-page__state-text">
              Checking the local PC address and LAN configuration.
            </p>
          </section>
        ) : null}

        {networkInfo ? (
          <div className="connection-page__grid">
            <section className="connection-page__panel">
              <div className="connection-page__panel-header">
                <div>
                  <p className="connection-page__panel-eyebrow">URLs</p>
                  <h2>Connection URLs</h2>
                </div>
                <p className="connection-page__panel-note">
                  Local mode keeps LAN URLs empty. LAN mode shows every usable
                  IPv4 address the PC can advertise safely.
                </p>
              </div>

              <div className="connection-page__url-list">
                <ConnectionUrlCard
                  label="Local PC URL"
                  url={networkInfo.local_url}
                  copiedUrl={copiedUrl}
                  onCopy={copyUrl}
                />

                {networkInfo.lan_urls?.length ? (
                  networkInfo.lan_urls.map((url, index) => (
                    <ConnectionUrlCard
                      key={url}
                      label={`Phone/tablet URL ${index + 1}`}
                      url={url}
                      copiedUrl={copiedUrl}
                      onCopy={copyUrl}
                    />
                  ))
                ) : (
                  <p className="connection-page__empty">
                    No LAN URLs are currently exposed.
                  </p>
                )}
              </div>
            </section>

            <section className="connection-page__panel connection-page__panel--qr">
              <div className="connection-page__panel-header">
                <div>
                  <p className="connection-page__panel-eyebrow">QR</p>
                  <h2>Best LAN URL</h2>
                </div>
                <p className="connection-page__panel-note">
                  Scan this if the page found a usable LAN URL.
                </p>
              </div>

              {bestLanUrl ? (
                <div className="connection-page__qr-wrap">
                  <div className="connection-page__qr-card" aria-label="LAN QR code">
                    <QRCodeSVG
                      value={bestLanUrl}
                      size={216}
                      bgColor="transparent"
                      fgColor="#f8fafc"
                      level="M"
                    />
                  </div>
                  <div className="connection-page__qr-url">
                    <p className="connection-page__url-label">Best LAN URL</p>
                    <code className="connection-page__url-value">{bestLanUrl}</code>
                    <button
                      type="button"
                      className="connection-page__button connection-page__button--primary"
                      onClick={() => copyUrl(bestLanUrl)}
                    >
                      {copiedUrl === bestLanUrl ? <Check size={16} /> : <Copy size={16} />}
                      {copiedUrl === bestLanUrl ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="connection-page__empty-state">
                  <QrCode size={28} />
                  <p>No LAN URL detected yet.</p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
