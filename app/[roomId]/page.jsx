'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Track } from 'livekit-client'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useConnectionState,
  useRoomContext,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'

const STATE = { LOADING: 'loading', LOBBY: 'lobby', CALL: 'call', ENDED: 'ended', ERROR: 'error' }

export default function MeetPage() {
  const { roomId } = useParams()
  const [state,      setState]      = useState(STATE.LOADING)
  const [token,      setToken]      = useState(null)
  const [livekitUrl, setLivekitUrl] = useState(null)
  const [callInfo,   setCallInfo]   = useState(null)
  const [error,      setError]      = useState(null)

  const API = 'https://api.fairshift.co'

  useEffect(() => {
    if (!roomId) return
    fetch(`${API}/api/emma/calls/public/${roomId}`)
      .then(r => {
        if (r.status === 410) throw new Error('This call has already ended.')
        if (!r.ok)             throw new Error('Call not found or has expired.')
        return r.json()
      })
      .then(d => {
        setCallInfo(d)
        setToken(d.room_token)
        setLivekitUrl(d.livekit_url || 'wss://livekit.fairshift.co')
        setState(STATE.LOBBY)
      })
      .catch(e => { setError(e.message); setState(STATE.ERROR) })
  }, [roomId])

  if (state === STATE.LOADING) return <FullScreen><Spinner /></FullScreen>

  if (state === STATE.ERROR) return (
    <FullScreen>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 18 }}>😔</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: '#fff' }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{error}</div>
        <div style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Contact us: <a href="https://fairshift.co" style={{ color: '#7c5cfc' }}>fairshift.co</a>
        </div>
      </div>
    </FullScreen>
  )

  if (state === STATE.ENDED) return (
    <FullScreen>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 18 }}>👋</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#fff' }}>Thanks for your time!</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
          A summary of what we discussed will be sent to your email shortly.
          We look forward to speaking again soon.
        </div>
        <a href="https://fairshift.co" style={{
          display: 'inline-block', marginTop: 28, padding: '12px 28px',
          borderRadius: 12, background: '#7c5cfc', color: '#fff',
          textDecoration: 'none', fontSize: 15, fontWeight: 700,
        }}>
          Explore Fairshift →
        </a>
      </div>
    </FullScreen>
  )

  if (state === STATE.LOBBY) return (
    <FullScreen>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: '#7c5cfc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -1,
          }}>F</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
            {callInfo?.agent_name || 'Emma'} is ready for you
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            You're about to join a live Fairshift product demo.
            Emma will walk you through the platform and answer your questions.
          </div>
        </div>

        {/* Mic note */}
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 28,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🎤</span>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Your browser will ask for microphone access. Please allow it — Emma needs to hear you to have a conversation.
          </div>
        </div>

        <button
          onClick={() => setState(STATE.CALL)}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: '#7c5cfc', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Join Call with Emma
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          No account or app required · This call may be recorded
        </div>
      </div>
    </FullScreen>
  )

  if (state === STATE.CALL) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={() => setState(STATE.ENDED)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <CallUI agentName={callInfo?.agent_name || 'Emma'} onLeave={() => setState(STATE.ENDED)} />
      </LiveKitRoom>
    </div>
  )

  return null
}

// ─── Call UI (inside LiveKitRoom context) ─────────────────────────────────────
function CallUI({ agentName, onLeave }) {
  const connectionState = useConnectionState()
  const room = useRoomContext()

  // Get Emma's screenshare track specifically
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const agentScreen = screenTracks.find(t =>
    t.participant.identity.startsWith('agent_')
  )

  const isConnected = connectionState === ConnectionState.Connected

  const handleLeave = () => {
    try { room.disconnect() } catch {}
    onLeave()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Audio — renders all room audio automatically */}
      <RoomAudioRenderer />

      {/* Header */}
      <div style={{
        padding: '12px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: '#7c5cfc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900, color: '#fff',
        }}>F</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
          Fairshift Demo — {agentName}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isConnected ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isConnected ? '#22C55E' : 'rgba(255,255,255,0.3)',
              display: 'inline-block',
            }} />
            {isConnected ? 'Live' : 'Connecting…'}
          </div>
          {/* Leave button */}
          <button onClick={handleLeave} style={{
            marginLeft: 8, padding: '6px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Leave
          </button>
        </div>
      </div>

      {/* Main video area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>
        {agentScreen ? (
          // Emma's screenshare — fills the frame
          <VideoTrack
            trackRef={agentScreen}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          // Waiting for screen share
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: '#7c5cfc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#fff',
            }}>E</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                {isConnected ? `${agentName} is preparing your demo…` : 'Connecting…'}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Audio is active — you'll hear {agentName} shortly
              </div>
            </div>
            {/* Animated dots */}
            <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} .dot{animation:bounce 1.2s infinite} .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}`}</style>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0,1,2].map(i => (
                <div key={i} className={`dot`} style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c5cfc', opacity: 0.7 }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar — mic status */}
      <div style={{
        padding: '10px 20px', flexShrink: 0, textAlign: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.3)',
        background: 'rgba(0,0,0,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        🎤 Your microphone is active — speak naturally to talk with {agentName}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FullScreen({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d0d0d',
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#7c5cfc',
        animation: 'spin 0.8s linear infinite',
      }} />
    </>
  )
}
