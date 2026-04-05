'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar } from '@livekit/components-react'

// ─── States ───────────────────────────────────────────────────────────────────
const STATE = { LOADING: 'loading', LOBBY: 'lobby', CALL: 'call', ENDED: 'ended', ERROR: 'error' }

export default function MeetPage() {
  const { roomId } = useParams()
  const searchParams = useSearchParams()

  const [state, setState] = useState(STATE.LOADING)
  const [token, setToken] = useState(searchParams.get('token') || null)
  const [livekitUrl, setLivekitUrl] = useState(null)
  const [callInfo, setCallInfo] = useState(null)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)

  const FAIRSHIFT_API = process.env.NEXT_PUBLIC_FAIRSHIFT_API || 'https://api.fairshift.co'

  // ─── Load call info ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

    // If token was passed in URL (from email link), use it directly
    if (token) {
      // Just need the LiveKit URL
      setLivekitUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://livekit.fairshift.co')
      setState(STATE.LOBBY)
      return
    }

    // Otherwise need to look up the call to get public info
    fetch(`${FAIRSHIFT_API}/api/emma/calls/public/${roomId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setError('Call not found or has expired.'); setState(STATE.ERROR); return }
        setCallInfo(d)
        setToken(d.room_token)
        setLivekitUrl(d.livekit_url)
        setState(STATE.LOBBY)
      })
      .catch(() => { setError('Unable to load call details.'); setState(STATE.ERROR) })
  }, [roomId, token])

  // ─── Join call ─────────────────────────────────────────────────────────────
  const handleJoin = () => {
    setState(STATE.CALL)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (state === STATE.LOADING) return <Screen center><Spinner /></Screen>

  if (state === STATE.ERROR) return (
    <Screen center>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>😔</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ color: 'var(--fs-muted)', fontSize: 14 }}>{error}</div>
        <div style={{ marginTop: 20, fontSize: 13, color: 'var(--fs-muted)' }}>
          Contact us: <a href="https://fairshift.co" style={{ color: 'var(--fs-green)' }}>fairshift.co</a>
        </div>
      </div>
    </Screen>
  )

  if (state === STATE.ENDED) return (
    <Screen center>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>👋</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Thanks for your time!</div>
        <div style={{ color: 'var(--fs-muted)', fontSize: 14, lineHeight: 1.6 }}>
          A summary of what we discussed will be sent to your email shortly.
          We look forward to speaking again soon.
        </div>
        <div style={{ marginTop: 24 }}>
          <a href="https://fairshift.co" style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 10,
            background: 'var(--fs-green)', color: '#fff', textDecoration: 'none',
            fontSize: 14, fontWeight: 700,
          }}>
            Explore Fairshift
          </a>
        </div>
      </div>
    </Screen>
  )

  if (state === STATE.LOBBY) return (
    <Screen center>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 20px' }}>
        {/* Fairshift logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: '#7c5cfc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#fff',
          }}>F</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            {callInfo?.agent_name || 'Emma'} is ready for you
          </div>
          <div style={{ fontSize: 14, color: 'var(--fs-muted)', lineHeight: 1.6 }}>
            You're joining a Fairshift product demo.
            Emma will walk you through the platform and answer your questions.
          </div>
        </div>

        {/* Camera/mic permissions note */}
        <div style={{
          background: 'var(--fs-card)', border: '1px solid var(--fs-border)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🎤</span>
          <div style={{ fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5 }}>
            Your browser will ask for microphone access. Please allow it — Emma needs to hear you to have a conversation.
            Camera is optional.
          </div>
        </div>

        <button
          onClick={handleJoin}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'var(--fs-green)', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.9'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          Join Call with Emma
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--fs-muted)' }}>
          No account or app required · Your call may be recorded
        </div>
      </div>
    </Screen>
  )

  if (state === STATE.CALL) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px', background: 'var(--fs-card)',
        borderBottom: '1px solid var(--fs-border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#7c5cfc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: '#fff',
        }}>F</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Fairshift Demo Call</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22C55E' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Live
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      {/* LiveKit room */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={() => setState(STATE.ENDED)}
          style={{ height: '100%' }}
          data-lk-theme="default"
        >
          <RoomAudioRenderer />
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  )

  return null
}

// ─── Utility components ───────────────────────────────────────────────────────
function Screen({ center, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: center ? 'center' : 'flex-start',
      justifyContent: center ? 'center' : 'flex-start',
      background: 'var(--fs-dark)',
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTopColor: 'var(--fs-green)',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
