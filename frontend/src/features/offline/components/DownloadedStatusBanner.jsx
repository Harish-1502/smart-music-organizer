// Shared status banner for downloaded/offline page feedback. This keeps the
// success, warning, and error announcement markup consistent across the page.
export default function DownloadedStatusBanner({ message, messageTone }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`downloaded-page__message downloaded-page__message--${messageTone}`}
      role={messageTone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
