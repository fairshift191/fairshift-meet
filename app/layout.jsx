import '@livekit/components-styles'
import './globals.css'

export const metadata = {
  title: 'Fairshift — Sales Call',
  description: 'Join your Fairshift product demo call',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
