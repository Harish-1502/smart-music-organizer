import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, QrCode, Server, ShieldCheck, Wifi } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api/apiBase";
import { getApiErrorMessage } from "../api/apiErrors";
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
  const [networkInfo, setNetworkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNetworkInfo() {
      setLoading(true);
      setMessage("");

      try {
        const response = await api.get("/system/network-info");

        if (isMounted) {
          setNetworkInfo(response.data);
        }
      } catch (error) {
        if (error?.response?.status === 401) {
          return;
        }

        if (isMounted) {
          setMessage(
            getApiErrorMessage(error, "Unable to load connection details.")
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadNetworkInfo();

    return () => {
      isMounted = false;
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const bestLanUrl = useMemo(
    () => networkInfo?.lan_urls?.[0] || "",
    [networkInfo],
  );

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

      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }

      copiedTimerRef.current = window.setTimeout(() => {
        setCopiedUrl("");
      }, 1600);
    } catch {
      setMessage("Could not copy the URL. Please copy it manually.");
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
          </div>
        </section>

        {message ? (
          <div className="connection-page__message" role="alert">
            {message}
          </div>
        ) : null}

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
