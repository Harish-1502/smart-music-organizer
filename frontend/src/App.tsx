// import { useEffect, useState } from 'react'
// import { getHealth } from './services/api'

function App() {
  // const [message, setMessage] = useState('Loading...')

  // // When loaded it runs getHealth to check status
  // useEffect(() => {
  //   getHealth()
  //     // Returns status
  //     .then((data) => setMessage(data.status))
  //     .catch(() => setMessage('Backend unreachable'))
  // }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Smart Music Organizer</h1>
      {/* <p>Backend status: {message}</p> */}
    </div>
  )
}

export default App