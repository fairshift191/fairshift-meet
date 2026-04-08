'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ConnectionState, RoomEvent, Track } from 'livekit-client'
import {
  LiveKitRoom,
  useConnectionState,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  VideoTrack,
  useParticipantTracks,
} from '@livekit/components-react'

const API = 'https://api.fairshift.co'
const STATE = { LOADING: 'loading', LOBBY: 'lobby', CALL: 'call', ENDED: 'ended', ERROR: 'error' }

// ─── Beam brand colors ────────────────────────────────────────────────────────
const BEAM = '#7c5cfc'
const BEAM_DIM = 'rgba(124,92,252,0.15)'
const BG = '#080810'
const SURFACE = '#0f0f1c'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#f0f0ff'
const MUTED = 'rgba(240,240,255,0.4)'

function fmtTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Beam logo mark ───────────────────────────────────────────────────────────
function BeamLogo({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, #5b3fc4, ${BEAM})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 0 ${size * 0.6}px rgba(124,92,252,0.35)`,
    }}>
      {/* Beam icon — signal waves */}
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill="#fff" />
        <path d="M7.5 7.5C9 6 10.4 5.5 12 5.5s3 .5 4.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
        <path d="M4.5 4.5C7 2 9.4 1 12 1s5 1 7.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.35"/>
        <path d="M7.5 16.5C9 18 10.4 18.5 12 18.5s3-.5 4.5-2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
        <path d="M4.5 19.5C7 22 9.4 23 12 23s5-1 7.5-3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.35"/>
      </svg>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BeamPage() {
  const { roomId } = useParams()
  const [state,      setState]      = useState(STATE.LOADING)
  const [token,      setToken]      = useState(null)
  const [livekitUrl, setLivekitUrl] = useState(null)
  const [callInfo,   setCallInfo]   = useState(null)
  const [error,      setError]      = useState(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    if (!roomId) return
    const params = new URLSearchParams(window.location.search)
    const directToken = params.get('token')
    if (directToken) {
      setToken(directToken)
      setLivekitUrl(params.get('livekit_url') || 'wss://livekit.fairshift.co')
      setCallInfo({ agent_name: 'Emma', company_name: 'Fairshift' })
      setState(STATE.LOBBY)
      return
    }
    fetch(`${API}/api/emma/calls/public/${roomId}`)
      .then(r => {
        if (r.status === 410) throw new Error('ended')
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then(d => {
        setCallInfo(d)
        setToken(d.room_token)
        setLivekitUrl(d.livekit_url || 'wss://livekit.fairshift.co')
        setState(STATE.LOBBY)
      })
      .catch(e => {
        if (e.message === 'ended') setState(STATE.ENDED)
        else { setError('Call not found or has expired.'); setState(STATE.ERROR) }
      })
  }, [roomId])

  if (state === STATE.LOADING) return <Screen><Spinner /></Screen>

  if (state === STATE.ERROR) return (
    <Screen>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <BeamLogo size={48} />
        <div style={{ marginTop: 24, fontSize: 20, fontWeight: 700, color: TEXT }}>Link not found</div>
        <div style={{ marginTop: 8, fontSize: 14, color: MUTED, lineHeight: 1.7 }}>{error}</div>
        <WordMark style={{ marginTop: 32 }} />
      </div>
    </Screen>
  )

  if (state === STATE.ENDED) return (
    <Screen>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>👋</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>Call ended</div>
        <div style={{ marginTop: 10, fontSize: 14, color: MUTED, lineHeight: 1.7 }}>
          Thanks for your time. A summary will be sent to your email shortly.
        </div>
        <WordMark style={{ marginTop: 36 }} />
      </div>
    </Screen>
  )

  if (state === STATE.LOBBY) return (
    <Lobby
      callInfo={callInfo}
      audioCtxRef={audioCtxRef}
      onJoin={() => setState(STATE.CALL)}
    />
  )

  if (state === STATE.CALL) return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={() => setState(STATE.ENDED)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <CallUI
          agentName={callInfo?.agent_name || 'Emma'}
          companyName={callInfo?.company_name || 'Fairshift'}
          personaId={callInfo?.persona_id}
          roomId={roomId}
          audioCtxRef={audioCtxRef}
          onLeave={() => setState(STATE.ENDED)}
        />
      </LiveKitRoom>
    </div>
  )

  return null
}

// ─── Lobby — Teams/Zoom style pre-join screen ─────────────────────────────────
function Lobby({ callInfo, audioCtxRef, onJoin }) {
  const agentName   = callInfo?.agent_name   || 'Emma'
  const company     = callInfo?.company_name || 'Fairshift'
  const prospect    = callInfo?.prospect_name
  const orgCompany  = callInfo?.prospect_company
  const scheduledAt = callInfo?.scheduled_at
  const timeStr     = fmtTime(scheduledAt)

  const [micOk, setMicOk] = useState(null)   // null=unchecked, true=ok, false=denied

  // Check mic permission on mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); setMicOk(true) })
      .catch(() => setMicOk(false))
  }, [])

  const handleJoin = () => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
      audioCtxRef.current.resume()
    } catch {}
    onJoin()
  }

  return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 20px' }}>

        {/* Top wordmark */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <WordMark />
        </div>

        {/* Call info card */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 20, padding: '28px 28px 24px', marginBottom: 20,
        }}>
          {/* Agent avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <AgentOrb name={agentName} size={64} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: BEAM, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                AI Sales Specialist
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{agentName}</div>
              <div style={{ fontSize: 13, color: MUTED }}>from {company}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: BORDER, marginBottom: 20 }} />

          {/* Call details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prospect && (
              <Detail icon="👤" label="With" value={prospect + (orgCompany ? ` · ${orgCompany}` : '')} />
            )}
            {timeStr && (
              <Detail icon="🕒" label="Scheduled" value={timeStr} />
            )}
            <Detail icon="🔒" label="Meeting" value="Private · End-to-end encrypted" />
            <Detail icon="🎙️" label="Format" value="Audio + AI screen share" />
          </div>
        </div>

        {/* Mic status */}
        {micOk === false && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <span style={{ fontSize: 18 }}>🎤</span>
            <div style={{ fontSize: 13, color: '#EF9090', lineHeight: 1.5 }}>
              Microphone access denied — {agentName} won't hear you. Allow microphone in your browser settings and refresh.
            </div>
          </div>
        )}

        {micOk === true && (
          <div style={{
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 12, padding: '10px 16px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <div style={{ fontSize: 13, color: 'rgba(34,197,94,0.9)' }}>Microphone ready</div>
          </div>
        )}

        {/* Join button */}
        <button
          onClick={handleJoin}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: `linear-gradient(135deg, #5b3fc4, ${BEAM})`,
            color: '#fff', border: 'none', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.01em',
            boxShadow: `0 4px 24px rgba(124,92,252,0.35)`,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Join Call
        </button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          No account or download required · This call may be recorded
        </div>
      </div>
    </Screen>
  )
}

function Detail({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>{label}</span>
        <span style={{ fontSize: 14, color: TEXT }}>{value}</span>
      </div>
    </div>
  )
}

// ─── Call UI ──────────────────────────────────────────────────────────────────
function CallUI({ agentName, companyName, personaId, roomId, audioCtxRef, onLeave }) {
  const connectionState = useConnectionState()
  const room = useRoomContext()
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const isConnected = connectionState === ConnectionState.Connected

  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const prevUrlRef = useRef(null)
  const nextPlayTimeRef = useRef(0)
  const [callDuration, setCallDuration] = useState(0)
  const startRef = useRef(null)

  // Call timer
  useEffect(() => {
    if (!isConnected) return
    if (!startRef.current) startRef.current = Date.now()
    const iv = setInterval(() => setCallDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [isConnected])

  const fmtDuration = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  const anamParticipant = participants.find(p => p.identity === 'anam-avatar-agent')
  const agentParticipant = participants.find(p => p.identity.startsWith('agent_') && p.identity !== 'anam-avatar-agent')
  const humanParticipants = participants.filter(p =>
    !p.identity.startsWith('agent_') &&
    p.identity !== 'anam-avatar-agent' &&
    p.identity !== localParticipant?.identity
  )

  useEffect(() => {
    if (!room) return
    const JPEG_1 = 0xFF, JPEG_2 = 0xD8
    const handler = (payload, participant, kind, topic) => {
      try {
        if (topic === 'screen' || (payload[0] === JPEG_1 && payload[1] === JPEG_2 && topic !== 'audio')) {
          const blob = new Blob([payload], { type: 'image/jpeg' })
          const url = URL.createObjectURL(blob)
          setScreenshotUrl(url)
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
          prevUrlRef.current = url
          return
        }
        if (topic === 'audio') {
          if (!audioCtxRef.current) {
            try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 }) } catch {}
          }
          const ctx = audioCtxRef.current
          if (!ctx) return
          if (ctx.state === 'suspended') ctx.resume()
          const copy = payload.slice(0)
          const int16 = new Int16Array(copy.buffer)
          const float32 = new Float32Array(int16.length)
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
          const buf = ctx.createBuffer(1, float32.length, 24000)
          buf.getChannelData(0).set(float32)
          const src = ctx.createBufferSource()
          src.buffer = buf
          src.connect(ctx.destination)
          const now = ctx.currentTime
          if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + 0.05
          src.start(nextPlayTimeRef.current)
          nextPlayTimeRef.current += buf.duration
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

  const anamVideoTrack = anamParticipant
    ? [...anamParticipant.trackPublications.values()].find(p => p.kind === Track.Kind.Video && p.track)
    : null

  const isSpeaking = agentParticipant?.isSpeaking || anamParticipant?.isSpeaking

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header bar */}
      <div style={{
        padding: '10px 18px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        background: SURFACE, borderBottom: `1px solid ${BORDER}`,
      }}>
        <BeamLogo size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
            {agentName} · {companyName}
          </div>
          {isConnected && startRef.current && (
            <div style={{ fontSize: 11, color: MUTED }}>{fmtDuration(callDuration)}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveDot isLive={isConnected} />
          <button onClick={handleLeave} style={{
            padding: '6px 16px', borderRadius: 8,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Leave
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Main view — screen share or avatar */}
        <div style={{ flex: 1, background: BG, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt={`${agentName}'s screen`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {anamVideoTrack?.track ? (
                <div style={{
                  width: 220, height: 220, borderRadius: '50%', overflow: 'hidden',
                  boxShadow: isSpeaking
                    ? '0 0 0 4px #22C55E, 0 0 32px rgba(34,197,94,0.3)'
                    : `0 0 0 2px ${BORDER}`,
                  transition: 'box-shadow 0.2s',
                }}>
                  <VideoTrack
                    trackRef={{ participant: anamParticipant, publication: anamVideoTrack, source: Track.Source.Camera }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ) : (
                <AgentOrb name={agentName} size={96} speaking={isSpeaking} />
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                  {isConnected ? `${agentName} is ready…` : 'Connecting…'}
                </div>
                <div style={{ fontSize: 13, color: MUTED }}>Speak naturally — {agentName} is listening</div>
              </div>
              <Dots />
            </div>
          )}

          {/* Agent PIP — bottom-left when screen is shown */}
          {screenshotUrl && (
            <div style={{
              position: 'absolute', bottom: 16, left: 16,
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              border: isSpeaking ? '2px solid #22C55E' : `2px solid ${BORDER}`,
              boxShadow: isSpeaking ? '0 0 12px rgba(34,197,94,0.4)' : '0 2px 12px rgba(0,0,0,0.4)',
              transition: 'border-color 0.2s',
              background: `linear-gradient(135deg, #3d2882, ${BEAM})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {anamVideoTrack?.track ? (
                <VideoTrack
                  trackRef={{ participant: anamParticipant, publication: anamVideoTrack, source: Track.Source.Camera }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <AgentOrb name={agentName} size={60} speaking={isSpeaking} />
              )}
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        <div style={{
          width: 156, background: SURFACE,
          borderLeft: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 10, flexShrink: 0, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
            In this call
          </div>
          <PipCard name={agentName} isAgent isSpeaking={isSpeaking} />
          <PipCard
            name={localParticipant?.identity?.replace('prospect_', '') || 'You'}
            isLocal
            isSpeaking={localParticipant?.isSpeaking}
          />
          {humanParticipants.map(p => (
            <PipCard
              key={p.identity}
              name={p.identity.replace('prospect_', '').replace('host_', '')}
              isSpeaking={p.isSpeaking}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── UI components ────────────────────────────────────────────────────────────
function AgentOrb({ name, size = 56, speaking }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, #5b3fc4, ${BEAM})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
      boxShadow: speaking
        ? `0 0 0 3px #22C55E, 0 0 18px rgba(34,197,94,0.35)`
        : `0 0 0 2px rgba(124,92,252,0.3)`,
      transition: 'box-shadow 0.2s', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function PipCard({ name, isAgent, isLocal, isSpeaking }) {
  return (
    <div style={{
      borderRadius: 12, border: isSpeaking ? '1.5px solid #22C55E' : `1.5px solid ${BORDER}`,
      overflow: 'hidden', background: '#0a0a14', transition: 'border-color 0.15s', flexShrink: 0,
    }}>
      <div style={{ position: 'relative', paddingTop: '75%' }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isAgent ? `linear-gradient(135deg, #3d2882, ${BEAM})` : '#12121e',
        }}>
          <AgentOrb name={name?.[0]?.toUpperCase() || '?'} size={40} speaking={isSpeaking} isAgent={isAgent} />
        </div>
        {isSpeaking && (
          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                width: 3, borderRadius: 2, background: '#22C55E',
                height: 4 + i * 3,
                animation: `beam-bar 0.6s ease infinite`,
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
            <style>{`@keyframes beam-bar{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}`}</style>
          </div>
        )}
      </div>
      <div style={{
        padding: '5px 8px', fontSize: 11, color: 'rgba(255,255,255,0.65)',
        fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        background: '#0a0a14',
      }}>
        {isAgent && <span style={{ marginRight: 4 }}>✦</span>}
        {isLocal ? `${name} (You)` : name}
      </div>
    </div>
  )
}

function LiveDot({ isLive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
      color: isLive ? '#22C55E' : MUTED }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
        background: isLive ? '#22C55E' : 'rgba(255,255,255,0.2)',
        boxShadow: isLive ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
      }} />
      {isLive ? 'Live' : 'Connecting…'}
    </div>
  )
}

function WordMark({ style: s }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...s }}>
      <BeamLogo size={30} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>Fairshift Beam</div>
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.04em' }}>AI Video Calls</div>
      </div>
    </div>
  )
}

function Dots() {
  return (
    <>
      <style>{`@keyframes beam-dot{0%,100%{transform:translateY(0);opacity:0.5}50%{transform:translateY(-7px);opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: BEAM,
            animation: 'beam-dot 1.3s ease infinite', animationDelay: `${i * 0.22}s`,
          }} />
        ))}
      </div>
    </>
  )
}

function Screen({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: BG,
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
        border: `3px solid ${BEAM_DIM}`, borderTopColor: BEAM,
        animation: 'spin 0.8s linear infinite',
      }} />
    </>
  )
}
