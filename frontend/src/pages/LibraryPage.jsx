import { useState } from "react";
import { scanLibrary, getScanStatus} from "../api/libraryApi"
import ScanProgress from "../components/ScanProgress";

export default function LibraryPage() {
  const [folderPath, setFolderPath] = useState("")
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleScan(){
    setLoading(true)
    setStatus("")
    setMessage("")

    try{
        await scanLibrary(folderPath)
        const latestStatus = await getScanStatus()
        setStatus(latestStatus)
        setMessage("Scan completed successfully")

    } catch (error){
        setMessage(error.message)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div>
      <h1>Library Scanner</h1>

      <input
        type="text"
        placeholder="Enter music folder path"
        value={folderPath}
        onChange={(e) => setFolderPath(e.target.value)}
      />

      <button onClick={handleScan} disabled={loading || !folderPath.trim()}>
        {loading ? "Scanning..." : "Scan Library"}
      </button>

      {message && <p>{message}</p>}
      <ScanProgress status={status} />
    </div>
  )
}