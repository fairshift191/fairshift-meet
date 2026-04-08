import '@livekit/components-styles'
import './globals.css'

export const metadata = {
  title: 'Fairshift Beam',
  description: 'Join your AI-powered video call',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
