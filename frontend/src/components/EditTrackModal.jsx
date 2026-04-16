export default function EditTrackModal({
  isOpen,
  formData,
  onChange,
  onSave,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h2>Edit Track</h2>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => onChange("title", e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Artist</label>
          <input
            type="text"
            value={formData.artist}
            onChange={(e) => onChange("artist", e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Album</label>
          <input
            type="text"
            value={formData.album}
            onChange={(e) => onChange("album", e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={actionsStyle}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle = {
  backgroundColor: "#fff",
  padding: "20px",
  borderRadius: "8px",
  width: "400px",
  maxWidth: "90%",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
};

const fieldGroupStyle = {
  marginBottom: "12px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "16px",
};