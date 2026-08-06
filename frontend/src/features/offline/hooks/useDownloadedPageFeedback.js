import { useState } from "react";

// Shared page-level feedback state for the downloaded/offline page. This keeps
// success, warning, and error messaging in one place so multiple controllers
// can report status without owning the banner state themselves.
export function useDownloadedPageFeedback() {
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  function clearMessage() {
    setMessage("");
    setMessageTone("success");
  }

  function setFeedback(nextMessage, nextTone = "success") {
    setMessage(nextMessage);
    setMessageTone(nextTone);
  }

  function showSuccessMessage(nextMessage) {
    setFeedback(nextMessage, "success");
  }

  function showWarningMessage(nextMessage) {
    setFeedback(nextMessage, "warning");
  }

  function showErrorMessage(nextMessage) {
    setFeedback(nextMessage, "error");
  }

  return {
    message,
    messageTone,
    clearMessage,
    setFeedback,
    showSuccessMessage,
    showWarningMessage,
    showErrorMessage,
  };
}
