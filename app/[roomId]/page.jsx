'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ConnectionState } from 'livekit-client'
import { RoomEvent } from 'livekit-client'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { VideoTrack, useParticipantTracks } from '@livekit/components-react'

const STATE = { LOADING: 'loading', LOBBY: 'lobby', CALL: 'call', ENDED: 'ended', ERROR: 'error' }

export default function MeetPage() {
  const { roomId } = useParams()
  const [state,      setState]      = useState(STATE.LOADING)
  const [token,      setToken]      = useState(null)
  const [livekitUrl, setLivekitUrl] = useState(null)
  const [callInfo,   setCallInfo]   = useState(null)
  const [error,      setError]      = useState(null)
  const audioCtxRef  = useRef(null)

  useEffect(() => {
    if (!roomId) return

    // Allow direct token injection via query param (for testing)
    const params = new URLSearchParams(window.location.search)
    const directToken = params.get('token')
    if (directToken) {
      setToken(directToken)
      setLivekitUrl(params.get('livekit_url') || 'wss://livekit.fairshift.co')
      setCallInfo({ agent_name: 'Emma' })
      setState(STATE.LOBBY)
      return
    }

    fetch(`https://api.fairshift.co/api/emma/calls/public/${roomId}`)
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
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{error}</div>
        <div style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Contact us: <a href="https://fairshift.co" style={{ color: '#7c5cfc' }}>fairshift.co</a>
        </div>
      </div>
    </FullScreen>
  )

  if (state === STATE.ENDED) return (
    <FullScreen>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 18 }}>👋</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Thanks for your time!</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
          A summary of what we discussed will be sent to your email shortly.
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: '#7c5cfc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff',
          }}>F</div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
            {callInfo?.agent_name || 'Emma'} is ready for you
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            You're about to join a live Fairshift product demo.
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 28,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🎤</span>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Please allow microphone access when your browser asks — Emma needs to hear you.
          </div>
        </div>
        <button onClick={() => {
          // MUST create AudioContext inside user gesture — browsers block audio otherwise
          try {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
            audioCtxRef.current.resume()
          } catch(e) { console.warn('AudioContext failed:', e) }
          setState(STATE.CALL)
        }} style={{
          width: '100%', padding: '15px', borderRadius: 14,
          background: '#7c5cfc', color: '#fff', border: 'none',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}>
          Join Call with Emma
        </button>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          No account or app required · This call may be recorded
        </div>
      </div>
    </FullScreen>
  )

  if (state === STATE.CALL) return (
    <div style={{ height: '100dvh', background: '#111', display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={() => setState(STATE.ENDED)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <CallUI agentName={callInfo?.agent_name || 'Emma'} personaId={callInfo?.persona_id} roomId={roomId} audioCtxRef={audioCtxRef} onLeave={() => setState(STATE.ENDED)} />
      </LiveKitRoom>
    </div>
  )

  return null
}

// ─── Call UI ──────────────────────────────────────────────────────────────────
function CallUI({ agentName, personaId, roomId, audioCtxRef, onLeave }) {
  const connectionState = useConnectionState()
  const room = useRoomContext()
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const isConnected = connectionState === ConnectionState.Connected

  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const prevUrlRef = useRef(null)
  const nextPlayTimeRef = useRef(0)

  // Anam joins the room server-side as 'anam-avatar-agent' and publishes a video track.
  // We just find that participant and render their video track — no @anam-ai/js-sdk needed.
  const anamParticipant = participants.find(p => p.identity === 'anam-avatar-agent')
  const agentParticipant = participants.find(p => p.identity.startsWith('agent_') && p.identity !== 'anam-avatar-agent')
  const humanParticipants = participants.filter(p =>
    !p.identity.startsWith('agent_') &&
    p.identity !== 'anam-avatar-agent' &&
    p.identity !== localParticipant?.identity
  )

  // Receive data channel messages — screen frames (topic: 'screen') + audio PCM (topic: 'audio')
  useEffect(() => {
    if (!room) return
    const JPEG_MAGIC_1 = 0xFF, JPEG_MAGIC_2 = 0xD8

    const handler = (payload, participant, kind, topic) => {
      try {
        if (typeof window !== 'undefined' && !window._dcLogged) { window._dcLogged = true; console.log('[meet] DataReceived firing, topic:', topic, 'bytes:', payload?.byteLength) }
        // ── Screen frame ──
        if (topic === 'screen' || (payload[0] === JPEG_MAGIC_1 && payload[1] === JPEG_MAGIC_2 && topic !== 'audio')) {
          const blob = new Blob([payload], { type: 'image/jpeg' })
          const newUrl = URL.createObjectURL(blob)
          setScreenshotUrl(newUrl)
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
          prevUrlRef.current = newUrl
          return
        }

        // ── Audio PCM (24kHz mono 16-bit LE) ──
        if (topic === 'audio') {
          const ctx = audioCtxRef.current
          if (!ctx) { console.warn('[meet] No AudioContext'); return }
          if (ctx.state === 'suspended') ctx.resume()

          // Copy into a fresh ArrayBuffer — payload.buffer may be a shared pool with non-zero byteOffset
          const copy = payload.slice(0)
          const int16 = new Int16Array(copy.buffer)
          const float32 = new Float32Array(int16.length)
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

          const audioBuf = ctx.createBuffer(1, float32.length, 24000)
          audioBuf.getChannelData(0).set(float32)

          const source = ctx.createBufferSource()
          source.buffer = audioBuf
          source.connect(ctx.destination)

          const now = ctx.currentTime
          if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + 0.05
          source.start(nextPlayTimeRef.current)
          nextPlayTimeRef.current += audioBuf.duration
        }
      } catch {}
    }

    room.on(RoomEvent.DataReceived, handler)
    return () => room.off(RoomEvent.DataReceived, handler)
  }, [room])

  const handleLeave = () => {
    try { room.disconnect() } catch {}
    onLeave()
  }

  // Get Anam's video track for rendering
  const anamVideoTrack = anamParticipant
    ? [...anamParticipant.trackPublications.values()].find(p => p.kind === Track.Kind.Video && p.track)
    : null

  const isSpeaking = agentParticipant?.isSpeaking || anamParticipant?.isSpeaking

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#7c5cfc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: '#fff',
        }}>F</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Fairshift Demo</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveIndicator isLive={isConnected} />
          <LeaveButton onClick={handleLeave} />
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Main view — screenshot or avatar */}
        <div style={{ flex: 1, background: '#0a0a0a', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="Emma's screen"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {/* Anam avatar — renders as a normal LiveKit video track */}
              {anamVideoTrack?.track ? (
                <div style={{
                  width: 240, height: 240, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  boxShadow: isSpeaking ? '0 0 0 4px #22C55E, 0 0 32px rgba(34,197,94,0.4)' : '0 0 0 2px rgba(255,255,255,0.1)',
                  transition: 'box-shadow 0.2s',
                }}>
                  <VideoTrack
                    trackRef={{ participant: anamParticipant, publication: anamVideoTrack, source: Track.Source.Camera }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ) : (
                <AgentAvatar name={agentName} size={72} speaking={isSpeaking} />
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                  {isConnected ? `${agentName} is preparing your demo…` : 'Connecting…'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  Audio is live — you'll hear {agentName} shortly
                </div>
              </div>
              <PulsingDots />
            </div>
          )}
        </div>

        {/* Participant sidebar */}
        <div style={{
          width: 160, background: '#1a1a1a',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 10, flexShrink: 0, overflowY: 'auto',
        }}>
          <ParticipantCard name={agentName} isAgent={true} isSpeaking={isSpeaking} />
          <ParticipantCard
            name={localParticipant?.identity?.replace('prospect_', '') || 'You'}
            isLocal={true}
            isSpeaking={localParticipant?.isSpeaking}
          />
          {humanParticipants.map(p => (
            <ParticipantCard
              key={p.identity}
              name={p.identity.replace('prospect_', '').replace('host_', '')}
              isSpeaking={p.isSpeaking}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px', flexShrink: 0, textAlign: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.25)',
        background: '#1a1a1a', borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        🎤 Speak naturally — {agentName} is listening
      </div>
    </div>
  )
}

// ─── Participant card ─────────────────────────────────────────────────────────
function ParticipantCard({ name, isAgent, isLocal, isSpeaking }) {
  const displayName = isLocal ? `${name} (You)` : name
  return (
    <div style={{
      borderRadius: 12,
      border: isSpeaking ? '2px solid #22C55E' : '2px solid rgba(255,255,255,0.08)',
      overflow: 'hidden', background: '#111',
      transition: 'border-color 0.15s',
      flexShrink: 0,
    }}>
      <div style={{ position: 'relative', paddingTop: '75%' }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isAgent ? 'linear-gradient(135deg, #3d2882, #7c5cfc)' : '#1e1e2e',
        }}>
          <AgentAvatar name={isAgent ? name : name[0]?.toUpperCase() || '?'} size={44} speaking={isSpeaking} isAgent={isAgent} />
        </div>
        {isSpeaking && (
          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            {[1,2,3].map(i => (
              <style key={`s${i}`}>{`@keyframes bar${i}{0%,100%{height:4px}50%{height:${4+i*4}px}}`}</style>
            ))}
            {[1,2,3].map(i => (
              <div key={i} style={{
                width: 3, height: 4, background: '#22C55E', borderRadius: 2,
                animation: `bar${i} ${0.5 + i * 0.15}s ease infinite`,
              }} />
            ))}
          </div>
        )}
      </div>
      <div style={{
        padding: '5px 8px', fontSize: 11, color: 'rgba(255,255,255,0.7)',
        fontWeight: 600, background: '#111', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isAgent && <span style={{ marginRight: 4 }}>🤖</span>}
        {displayName}
      </div>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────
function AgentAvatar({ name, size = 48, speaking, isAgent }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: isAgent !== false ? 'linear-gradient(135deg, #5b3fc4, #7c5cfc)' : '#2a2a3e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
      boxShadow: speaking ? `0 0 0 3px #22C55E, 0 0 12px rgba(34,197,94,0.4)` : 'none',
      transition: 'box-shadow 0.2s', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function LiveIndicator({ isLive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
      color: isLive ? '#22C55E' : 'rgba(255,255,255,0.3)' }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
        background: isLive ? '#22C55E' : 'rgba(255,255,255,0.2)',
      }} />
      {isLive ? 'Live' : 'Connecting…'}
    </div>
  )
}

function LeaveButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 8,
      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
      color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}>
      Leave
    </button>
  )
}

function PulsingDots() {
  return (
    <>
      <style>{`@keyframes bd{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#7c5cfc', opacity: 0.7,
            animation: `bd 1.2s ease infinite`, animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    </>
  )
}

function FullScreen({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
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
        border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#7c5cfc',
        animation: 'spin 0.8s linear infinite',
      }} />
    </>
  )
}
