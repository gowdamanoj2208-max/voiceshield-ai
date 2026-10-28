import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines,
  Bell, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download,
  ExternalLink, FileCheck2, FileText, Fingerprint, Headphones, LayoutDashboard,
  LockKeyhole, Menu, MessageSquareText, Mic, MicOff, MoreHorizontal, Pause,
  Play, Plus, Radio, Search, Settings, Shield, ShieldAlert, ShieldCheck,
  Siren, Sparkles, Square, Trash2, TrendingUp, UserRound, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const API = '/api'
const seedCalls = [
  { id: 'VS-2025-0842', time: '10:42:18 AM', date: 'Today', caller: 'Unknown · +1 (•••) •••-0182', score: 94, level: 'Critical', status: 'Honeypot engaged', duration: '04:32', transcript: 'This is Officer Daniel from the National Fraud Division. Your account has been compromised. I need you to install AnyDesk immediately and transfer your funds to a safe wallet. Do not tell anyone about this call.' },
  { id: 'VS-2025-0841', time: '10:18:04 AM', date: 'Today', caller: 'Unknown · +1 (•••) •••-7730', score: 68, level: 'High', status: 'Flagged for review', duration: '02:16', transcript: 'Your bank account is on hold. We need to verify your card number and the OTP we just sent. Please act now.' },
  { id: 'VS-2025-0840', time: '09:56:32 AM', date: 'Today', caller: 'Unknown · +1 (•••) •••-2419', score: 42, level: 'Medium', status: 'Completed', duration: '01:48', transcript: 'Hello, this is calling about your recent account activity. Can I confirm that you made a purchase yesterday?' },
  { id: 'VS-2025-0839', time: '09:22:17 AM', date: 'Today', caller: 'Contact · (•••) •••-4561', score: 8, level: 'Low', status: 'Safe', duration: '03:07', transcript: 'Hi, just calling to confirm dinner plans for this evening. See you at seven!' },
  { id: 'VS-2025-0838', time: 'Yesterday', date: 'Yesterday', caller: 'Unknown · +1 (•••) •••-9920', score: 86, level: 'Critical', status: 'Report prepared', duration: '06:11', transcript: 'We are from technical support. Your computer has a virus. Download this remote access tool and pay the $299 service fee to avoid data loss.' },
]
const initialTranscript = 'This is Officer Daniel from the National Fraud Division. Your account has been compromised. I need you to install AnyDesk immediately and transfer your funds to a safe wallet. Do not tell anyone about this call.'
const starterMessages = [
  { by: 'caller', text: 'Good morning. I’m calling from your bank’s security department about suspicious activity.' },
  { by: 'agent', text: 'Oh, that sounds worrying. Which account are you calling about?' },
  { by: 'caller', text: 'We need to verify your identity. Please read me the six-digit code we just sent.' },
]
const chartData = [
  { time: '08:00', calls: 16, risk: 4 }, { time: '09:00', calls: 25, risk: 8 },
  { time: '10:00', calls: 21, risk: 14 }, { time: '11:00', calls: 38, risk: 11 },
  { time: '12:00', calls: 30, risk: 22 }, { time: '13:00', calls: 46, risk: 19 },
  { time: '14:00', calls: 39, risk: 27 }, { time: '15:00', calls: 53, risk: 21 },
]
const navGroups = [
  { label: 'WORKSPACE', items: [{ id: 'landing', label: 'Home', icon: LayoutDashboard }, { id: 'overview', label: 'Overview', icon: Activity }, { id: 'monitor', label: 'Live monitoring', icon: AudioLines, dot: true }, { id: 'analysis', label: 'AI analysis', icon: Sparkles }, { id: 'honeypot', label: 'Honeypot lab', icon: Fingerprint }] },
  { label: 'MANAGE', items: [{ id: 'reports', label: 'Incident reports', icon: FileCheck2 }, { id: 'settings', label: 'Settings & privacy', icon: Settings }] },
]
const levels = ['Low', 'Medium', 'High', 'Critical']
const sampleReplies = [
  'I’m having a little trouble finding that. Could you tell me the name of your department again?',
  'Oh, I see. Can you explain what you mean by a “safe wallet”? I haven’t heard of that before.',
  'I’m not very good with my phone. Is there a public number I can call back to reach your office?',
  'I need a moment to find my notes. Could you walk me through why this needs to happen right away?',
]

function riskLevel(score) { return score >= 85 ? 'Critical' : score >= 65 ? 'High' : score >= 35 ? 'Medium' : 'Low' }
function makeId(prefix = 'VS') { return `${prefix}-${Date.now().toString().slice(-8)}` }
function sanitizeTranscript(text = '') {
  return text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]')
    .replace(/(?<!\w)(?:\+?\d[\d ().-]{7,}\d)(?!\w)/g, '[phone redacted]')
    .replace(/\b\d{6,}\b/g, '[number redacted]')
    .slice(0, 240)
}
function readStore(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
function cx(...classes) { return classes.filter(Boolean).join(' ') }

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `API request failed (${res.status})`)
  return res.json()
}
async function syncDemoData(backend, calls, reports, setCalls, setReports) {
  if (backend !== 'connected') return
  try {
    const [callData, reportData] = await Promise.all([apiRequest('/calls'), apiRequest('/reports')])
    if (callData.calls.length) setCalls(prev => {
      const merged = new Map(prev.map(c => [c.id, c]))
      callData.calls.forEach(c => merged.set(c.id, { ...merged.get(c.id), ...c, time: c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : c.time, date: c.date === new Date().toISOString().slice(0, 10) ? 'Today' : c.date }))
      return [...merged.values()]
    })
    if (reportData.reports.length) setReports(prev => {
      const merged = new Map(prev.map(r => [r.id, r]))
      reportData.reports.forEach(r => merged.set(r.id, { ...merged.get(r.id), ...r }))
      return [...merged.values()]
    })
  } catch { /* browser-local demo records stay available */ }
}

function Brand({ small = false }) {
  return <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={19} strokeWidth={2.4} /></div><div className="brand-copy"><strong>voice<span>shield</span></strong>{!small && <small>AI CALL PROTECTION</small>}</div></div>
}
function Tag({ children, tone = 'neutral', dot = false }) { return <span className={`tag tag-${tone}`}>{dot && <i />}{children}</span> }
function Button({ children, variant = 'secondary', icon: Icon, onClick, disabled, className = '', type = 'button' }) { return <button type={type} disabled={disabled} className={`button button-${variant} ${className}`} onClick={onClick}>{Icon && <Icon size={16} />}{children}</button> }
function CardTitle({ eyebrow, title, detail, action }) { return <div className="card-title-row"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h3>{title}</h3>{detail && <p>{detail}</p>}</div>{action}</div> }
function EmptyState({ icon: Icon = FileText, title, detail, action }) { return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{detail}</p>{action}</div> }

function App() {
  const [page, setPage] = useState('landing')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [calls, setCalls] = useState(() => readStore('vs-calls', seedCalls))
  const [reports, setReports] = useState(() => readStore('vs-reports', []))
  const [activeCall, setActiveCall] = useState(null)
  const [transcript, setTranscript] = useState(initialTranscript)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [monitoring, setMonitoring] = useState(true)
  const [filter, setFilter] = useState('All risks')
  const [query, setQuery] = useState('')
  const [detailCall, setDetailCall] = useState(null)
  const [honeypotRunning, setHoneypotRunning] = useState(false)
  const [messages, setMessages] = useState(() => readStore('vs-messages', starterMessages))
  const [honeypotSeconds, setHoneypotSeconds] = useState(0)
  const [settings, setSettings] = useState(() => readStore('vs-settings', { demo: true, retention: '30 days', consent: true, notifications: true }))
  const [backend, setBackend] = useState('checking')
  const [notification, setNotification] = useState('')
  const [micState, setMicState] = useState('not requested')
  const interval = useRef(null)
  const transcriptBox = useRef(null)

  useEffect(() => { localStorage.setItem('vs-calls', JSON.stringify(calls)) }, [calls])
  useEffect(() => { localStorage.setItem('vs-reports', JSON.stringify(reports)) }, [reports])
  useEffect(() => { localStorage.setItem('vs-settings', JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem('vs-messages', JSON.stringify(messages)) }, [messages])
  useEffect(() => { apiRequest('/health').then(() => setBackend('connected')).catch(() => setBackend('offline')) }, [])
  useEffect(() => { if (backend === 'connected') syncDemoData(backend, calls, reports, setCalls, setReports) }, [backend])
  useEffect(() => {
    if (!activeCall || activeCall.paused) return undefined
    interval.current = setInterval(() => setActiveCall(c => c ? { ...c, seconds: c.seconds + 1 } : c), 1000)
    return () => clearInterval(interval.current)
  }, [activeCall?.id, activeCall?.paused])
  useEffect(() => {
    if (!activeCall) return undefined
    const timer = setInterval(() => {
      setActiveCall(current => {
        if (!current || current.paused) return current
        const line = current.lines[current.lineIndex % current.lines.length]
        setTranscript(text => `${text}\n${line}`)
        return { ...current, lineIndex: current.lineIndex + 1 }
      })
    }, 8500)
    return () => clearInterval(timer)
  }, [activeCall?.id])
  useEffect(() => {
    if (!honeypotRunning) return undefined
    const t = setInterval(() => setHoneypotSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [honeypotRunning])
  useEffect(() => { if (notification) { const t = setTimeout(() => setNotification(''), 3200); return () => clearTimeout(t) } }, [notification])

  const filteredCalls = useMemo(() => calls.filter(c => (filter === 'All risks' || c.level === filter) && (!query || `${c.id} ${c.caller} ${c.status}`.toLowerCase().includes(query.toLowerCase()))), [calls, filter, query])
  const totalCalls = calls.length + 1247
  const suspicious = calls.filter(c => ['High', 'Critical'].includes(c.level)).length + 38
  const highRisk = calls.filter(c => c.level === 'Critical').length + 12
  const fmt = s => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String((s || 0) % 60).padStart(2, '0')}`
  const notify = message => setNotification(message)
  const go = id => { setPage(id); setMobileOpen(false) }

  async function analyzeText(text = transcript) {
    if (!text.trim()) { setAnalysisError('Add a transcript before running an analysis.'); return }
    setAnalyzing(true); setAnalysisError('')
    try {
      let result
      if (backend === 'connected' && settings.demo) {
        try { result = await apiRequest('/analyze', { method: 'POST', body: JSON.stringify({ transcript: text }) }) }
        catch { result = localAnalyze(text) }
      } else result = localAnalyze(text)
      setAnalysis(result)
      return result
    } catch (e) { setAnalysisError(e.message || 'Could not analyze transcript.') }
    finally { setAnalyzing(false) }
  }
  function localAnalyze(text) {
    const rules = [
      { id: 'sensitive_info', label: 'Sensitive information request', score: 30, patterns: [/\botp\b/i, /one[- ]time (?:password|code)/i, /\bpin\b/i, /password/i, /card number/i, /bank details/i, /verify your identity/i, /read me the (?:code|number)/i] },
      { id: 'urgency', label: 'Urgency & intimidation', score: 18, patterns: [/act now/i, /immediately/i, /right away/i, /urgent/i, /final warning/i, /arrest/i, /account.{0,24}(?:suspend|freeze|compromis)/i, /do not tell/i, /keep this (?:secret|private)/i] },
      { id: 'impersonation', label: 'Authority impersonation', score: 20, patterns: [/police/i, /officer/i, /government/i, /national fraud/i, /tax department/i, /security department/i, /from your bank/i, /customer support/i, /technical support/i] },
      { id: 'payment', label: 'Suspicious payment request', score: 24, patterns: [/transfer (?:your )?funds/i, /wire (?:the )?money/i, /gift cards?/i, /crypto(?:currency)?/i, /safe wallet/i, /pay (?:the )?\$?\d/i, /money transfer/i] },
      { id: 'remote_access', label: 'Remote-access or suspicious link', score: 24, patterns: [/install.{0,30}(?:anydesk|teamviewer|remote access|app)/i, /download.{0,30}(?:anydesk|teamviewer|app)/i, /remote access/i, /click (?:this )?link/i, /screen[- ]?sharing/i, /anydesk|teamviewer/i] },
      { id: 'pressure', label: 'Fear, pressure or secrecy', score: 12, patterns: [/safe account/i, /safe wallet/i, /compromised/i, /virus/i, /lose access/i, /avoid (?:data loss|arrest|suspension)/i, /do not (?:hang up|tell|disconnect)/i] },
    ]
    const found = rules.filter(rule => rule.patterns.some(re => re.test(text)))
    const score = Math.min(98, found.reduce((n, r) => n + r.score, 0))
    const phrasePatterns = [/\b(?:otp|one-time code|pin|password|card number)\b/ig, /\b(?:act now|immediately|right away|urgent|final warning)\b/ig, /\b(?:police|officer|government|national fraud|technical support|security department)\b/ig, /\b(?:transfer your funds|safe wallet|gift cards?|crypto|wire the money)\b/ig, /\b(?:anydesk|teamviewer|remote access|click this link)\b/ig, /\b(?:do not tell|keep this secret|compromised|arrest)\b/ig]
    const phrases = [...new Set(phrasePatterns.flatMap(re => text.match(re) || []))].slice(0, 8)
    let explanation = score >= 65 ? 'Several high-risk patterns overlap: the speaker combines ' : score >= 35 ? 'Some caution flags appear: the conversation includes ' : 'Few known scam indicators were found in this excerpt. '
    if (found.length) explanation += found.map(r => r.label.toLowerCase()).join(', ') + '. These language signals are not proof of identity or intent.'
    else explanation += 'A short text excerpt cannot establish that a call is safe.'
    return { risk_score: score, risk_level: riskLevel(score), detected_indicators: found.map(r => r.label), suspicious_phrases: phrases, explanation, recommended_action: score >= 65 ? 'End the conversation without sharing information. Verify the claim through an independently sourced official number, then have a human review this incident.' : score >= 35 ? 'Do not share codes or payment details. Pause and independently verify through a trusted contact channel.' : 'Continue cautiously. Never share authentication codes, passwords, or payment details on an unsolicited call.', confidence: Math.min(94, 64 + found.length * 5), mode: 'rule-based demo', caveat: 'Prototype estimate from text patterns only — not definitive proof of fraud. Tone, accent, pitch, and emotion are not used to identify callers.' }
  }

  async function startCall() {
    let session = { id: makeId('CALL'), seconds: 0, paused: false, lineIndex: 0, lines: [
      'Caller: For your protection, we need you to verify the one-time code sent to your phone.',
      'Caller: This is urgent. Your account will be locked unless you act immediately.',
      'Caller: Please download AnyDesk so our security team can help you secure the account.',
    ] }
    if (backend === 'connected') { try { const saved = await apiRequest('/demo-call/start', { method: 'POST', body: '{}' }); session.id = saved.session_id } catch { /* local demo continues */ } }
    setActiveCall(session); setTranscript('Caller: Hello, I am calling from the National Fraud Division about a compromised account.'); setAnalysis(null); go('monitor'); notify('Fictional demo call started')
  }
  async function endCall() {
    if (!activeCall) return
    const ended = activeCall
    const text = transcript
    setActiveCall(null)
    const result = analysis || localAnalyze(text)
    const call = { id: ended.id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), date: 'Today', caller: 'Unknown · fictional demo caller', score: result.risk_score, level: result.risk_level, status: result.risk_score >= 65 ? 'Flagged for review' : 'Completed', duration: fmt(ended.seconds), duration_seconds: ended.seconds, transcript: text }
    setCalls(prev => [call, ...prev]); setAnalysis(result); notify('Demo call ended and saved to local activity')
    if (backend === 'connected') { try { await apiRequest('/demo-call/end', { method: 'POST', body: JSON.stringify({ session_id: ended.id, transcript: text }) }) } catch { /* local persistence remains available */ } }
  }
  async function createReport(call = detailCall || calls.find(c => ['High', 'Critical'].includes(c.level))) {
    if (!call) { notify('No call is available to turn into a report'); return }
    const result = localAnalyze(call.transcript || '')
    const report = { id: backend === 'connected' ? makeId('INC') : makeId('INC'), call_id: call.id, created_at: new Date().toISOString(), score: call.score, level: call.level, patterns: result.detected_indicators, excerpt: sanitizeTranscript(call.transcript || ''), status: 'Prepared for review/submission', reviewed: false }
    try { if (backend === 'connected') { const saved = await apiRequest('/reports', { method: 'POST', body: JSON.stringify({ ...report, id: null }) }); Object.assign(report, saved) } } catch { /* local demo report */ }
    setReports(prev => [report, ...prev]); go('reports'); notify('Incident prepared for human review — not submitted')
  }
  async function deleteReport(id) {
    try { if (backend === 'connected') await apiRequest(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch { /* remove local record */ }
    setReports(prev => prev.filter(r => r.id !== id)); notify('Demo report deleted')
  }
  async function markReportReviewed(id) {
    try { if (backend === 'connected') await apiRequest(`/reports/${encodeURIComponent(id)}/review`, { method: 'PATCH' }) } catch { /* local review is still persisted */ }
    setReports(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r)); notify('Report marked as reviewed')
  }
  function exportCSV(report) {
    const rows = [['Incident ID', report.id], ['Call reference', report.call_id], ['Date and time', report.created_at], ['Risk score', report.score], ['Risk level', report.level], ['Patterns', (report.patterns || []).join('; ')], ['Sanitized transcript excerpt', sanitizeTranscript(report.excerpt)], ['Status', report.status]]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${report.id}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  function exportPDF(report) {
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) { notify('Allow pop-ups to print this report as PDF'); return }
    w.document.write(`<title>${report.id} · VoiceShield AI</title><style>body{font:15px Arial,sans-serif;max-width:760px;margin:48px auto;color:#17202d}h1{color:#0c8b6b}h2{margin-top:30px}pre{white-space:pre-wrap;background:#f3f5f7;padding:18px;border-radius:8px}.note{color:#687588;font-size:12px}</style><h1>VoiceShield AI</h1><h2>Incident report · ${report.id}</h2><p><b>Call reference:</b> ${report.call_id}<br><b>Prepared:</b> ${new Date(report.created_at).toLocaleString()}<br><b>Risk:</b> ${report.score}% · ${report.level}<br><b>Status:</b> Prepared for review/submission</p><h2>Detected patterns</h2><p>${(report.patterns || []).join(', ') || 'None'}.</p><h2>Sanitized transcript excerpt</h2><pre>${escapeHtml(sanitizeTranscript(report.excerpt))}</pre><p class="note">Prototype estimate; not definitive proof of fraud. Prepared for human review only; not submitted to law enforcement.</p>`)
    w.document.close(); w.focus(); w.print()
  }
  function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) }
  function toggleSetting(key, value) { setSettings(s => ({ ...s, [key]: value ?? !s[key] })) }
  function resetDemo() {
    if (!window.confirm('Reset all local demo calls, reports, and honeypot messages? This cannot be undone.')) return
    setCalls([]); setReports([]); setMessages([]); setActiveCall(null); setAnalysis(null); localStorage.removeItem('vs-calls'); localStorage.removeItem('vs-reports'); localStorage.removeItem('vs-messages'); notify('Local demo data reset')
    if (backend === 'connected') apiRequest('/demo-data/reset', { method: 'POST' }).catch(() => {})
  }
  function addScammerMessage() {
    setMessages(prev => [...prev, { by: 'caller', text: 'The suspicious caller asks for the security code again and says the transfer must happen right now.' }]); setHoneypotRunning(true)
  }
  function generateReply() {
    setMessages(prev => [...prev, { by: 'agent', text: sampleReplies[prev.filter(m => m.by === 'agent').length % sampleReplies.length] }]); setHoneypotRunning(true)
  }
  async function requestMic() {
    if (!navigator.mediaDevices?.getUserMedia) { setMicState('unavailable'); notify('Microphone capture is unavailable in this browser'); return }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(t => t.stop()); setMicState('permission granted · not recording'); notify('Permission granted. No audio was recorded or uploaded.') }
    catch { setMicState('permission denied'); notify('Microphone permission was not granted') }
  }
  function downloadTranscript() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain' })); a.download = `${activeCall?.id || 'voiceshield-transcript'}.txt`; a.click(); URL.revokeObjectURL(a.href) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="close-mobile icon-button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">N</div><div><strong>Northstar workspace</strong><small>Personal protection</small></div><ChevronDown size={15} /></div>
      <nav className="main-nav">{navGroups.map(group => <div className="nav-group" key={group.label}><span className="nav-caption">{group.label}</span>{group.items.map(item => <button key={item.id} onClick={() => go(item.id)} className={`nav-item ${page === item.id ? 'nav-active' : ''}`}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.dot && <i className="nav-live-dot" />}{item.id === 'reports' && reports.length > 0 && <small className="nav-count">{reports.length}</small>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="protection-card"><div className="protection-icon"><Shield size={17} /></div><strong>Your protection is on</strong><p>VoiceShield is monitoring demo activity only.</p><div className="protection-foot"><span className="status-dot" /> All systems operational</div></div><button className="profile-button" onClick={() => go('settings')}><div className="profile-avatar"><UserRound size={17} /></div><div><strong>Alex Morgan</strong><small>Free plan</small></div><MoreHorizontal size={18} /></button></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{navGroups.flatMap(g => g.items).find(i => i.id === page)?.label || 'Overview'}</strong></div></div><div className="topbar-right"><div className={`connection-pill connection-${backend}`}><span />{backend === 'connected' ? 'API connected' : backend === 'checking' ? 'Connecting…' : 'Local demo'} </div><button className="icon-button" aria-label="Notifications" onClick={() => notify('You’re all caught up')}><Bell size={18} /><i className="bell-dot" /></button><div className="top-divider" /><div className="top-avatar">AM</div></div></header>
      <div className="page-scroll">
        {page === 'landing' && <Landing go={go} />}
        {page === 'overview' && <Overview calls={calls} totalCalls={totalCalls} suspicious={suspicious} highRisk={highRisk} reports={reports} startCall={startCall} go={go} filteredCalls={filteredCalls} setDetailCall={setDetailCall} chartData={chartData} />}
        {page === 'monitor' && <Monitor activeCall={activeCall} transcript={transcript} setTranscript={setTranscript} analysis={analysis} analyzing={analyzing} analysisError={analysisError} analyze={() => analyzeText(transcript)} startCall={startCall} endCall={endCall} setActiveCall={setActiveCall} fmt={fmt} calls={calls} filteredCalls={filteredCalls} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} setDetailCall={setDetailCall} transcriptBox={transcriptBox} downloadTranscript={downloadTranscript} monitoring={monitoring} setMonitoring={setMonitoring} />}
        {page === 'analysis' && <AnalysisPage transcript={transcript} setTranscript={setTranscript} analysis={analysis} analyzing={analyzing} error={analysisError} analyze={analyzeText} />}
        {page === 'honeypot' && <Honeypot messages={messages} running={honeypotRunning} seconds={honeypotSeconds} start={() => { setHoneypotRunning(true); if (!messages.length) setMessages(starterMessages); notify('Isolated honeypot simulation started') }} stop={() => { setHoneypotRunning(false); notify('Simulation stopped') }} reply={generateReply} addMessage={addScammerMessage} />}
        {page === 'reports' && <Reports reports={reports} calls={calls} createReport={createReport} onDelete={deleteReport} onReview={markReportReviewed} onCSV={exportCSV} onPDF={exportPDF} />}
        {page === 'settings' && <SettingsPage settings={settings} toggle={toggleSetting} backend={backend} micState={micState} requestMic={requestMic} reset={resetDemo} />}
      </div>
    </main>
    {detailCall && <CallModal call={detailCall} onClose={() => setDetailCall(null)} onReport={() => createReport(detailCall)} onAnalyze={() => { setTranscript(detailCall.transcript); setDetailCall(null); go('analysis'); analyzeText(detailCall.transcript) }} />}
    {notification && <div className="toast"><CheckCircle2 size={17} />{notification}</div>}
  </div>
}

function Landing({ go }) {
  const features = [
    { icon: AudioLines, title: 'Live call monitoring', copy: 'Visualize demo call activity and inspect a risk estimate as a conversation unfolds.', tone: 'green' },
    { icon: Fingerprint, title: 'Social engineering analysis', copy: 'Surface contextual patterns like urgency, impersonation, secret-keeping, and code requests.', tone: 'cyan' },
    { icon: MessageSquareText, title: 'Isolated honeypot lab', copy: 'See a safe, fictional scam conversation engage with harmless, generic responses.', tone: 'purple' },
    { icon: FileCheck2, title: 'Human-reviewed reports', copy: 'Prepare sanitized evidence summaries for review. Nothing is automatically submitted.', tone: 'amber' },
  ]
  const steps = [
    { icon: Radio, name: 'Call monitoring' }, { icon: Sparkles, name: 'AI analysis' },
    { icon: ShieldAlert, name: 'Risk assessment' }, { icon: ShieldCheck, name: 'Safe response' },
    { icon: FileCheck2, name: 'Incident report' },
  ]
  return <div className="page-content landing-page">
    <div className="landing-hero"><div className="hero-content"><div className="hero-overline"><span className="status-dot" /> RESPONSIBLE CALL PROTECTION · DEMO ENVIRONMENT</div><h1>Stop voice scams<br />before they <span>strike.</span></h1><p>Explore how context-aware fraud detection can spot social engineering patterns, guide a safer response, and prepare incidents for human review.</p><div className="hero-actions"><Button variant="primary" icon={LayoutDashboard} onClick={() => go('overview')}>Launch dashboard <ArrowRight size={15} /></Button><button className="hero-secondary" onClick={() => document.getElementById('landing-features')?.scrollIntoView({ behavior: 'smooth' })}>Explore features <ArrowDownRight size={14} /></button></div><div className="hero-assurances"><span><LockKeyhole size={13} /> Privacy-first</span><span><Sparkles size={13} /> Context-aware</span><span><UserRound size={13} /> Human-in-the-loop</span></div></div><div className="hero-art"><div className="hero-halo halo-outer" /><div className="hero-halo halo-inner" /><div className="hero-signal signal-one"><AudioLines size={15} /><span>Voice signals</span><i /></div><div className="hero-signal signal-two"><ShieldCheck size={15} /><span>Pattern detected</span><i /></div><div className="hero-shield-wrap"><div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><div className="hero-shield"><ShieldCheck size={49} strokeWidth={1.5} /></div><div className="hero-crosshair crosshair-a" /><div className="hero-crosshair crosshair-b" /></div><div className="hero-spectrum">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--s': `${9 + Math.abs(Math.sin(i * .65) * 31)}px`, '--d': `${i * .025}s` }} />)}</div><div className="hero-demo-stamp"><span className="status-dot" /> FICTIONAL DEMO DATA</div></div><div className="hero-bottom"><span>HACKATHON PROTOTYPE <i /> SIMULATED CALLS ONLY <i /> NEVER AUTOMATICALLY REPORTS</span><span>Scroll to explore <ArrowDownRight size={13} /></span></div></div>
    <div className="landing-demo-metrics"><div><strong>1,247<span>+</span></strong><span>demo calls analyzed</span></div><div><strong>38</strong><span>suspicious patterns flagged</span></div><div><strong>12</strong><span>high-risk examples detected</span></div><div><strong>0</strong><span>real calls monitored</span></div><small>ILLUSTRATIVE SAMPLE STATISTICS · NOT LIVE TELEMETRY</small></div>
    <section className="landing-section" id="landing-features"><div className="landing-section-heading"><div><span className="eyebrow">DESIGNED FOR SAFER DECISIONS</span><h2>Protection that reads<br />between the lines.</h2></div><p>Scams rarely hinge on a single word. VoiceShield brings context, repeated tactics, and human judgement into one responsible review workflow.</p></div><div className="feature-grid">{features.map((f, i) => <article className="surface feature-card" key={f.title}><div className={`feature-icon feature-${f.tone}`}><f.icon size={18} /></div><span className="feature-num">0{i + 1}</span><h3>{f.title}</h3><p>{f.copy}</p><button className="feature-link" onClick={() => go(['monitor', 'analysis', 'honeypot', 'reports'][i])}>Explore <ArrowRight size={13} /></button></article>)}</div></section>
    <section className="landing-workflow surface"><div className="workflow-intro"><span className="eyebrow">A CLEARER WAY FORWARD</span><h2>From first signal<br />to safer response.</h2><p>Understand how a suspicious conversation becomes a carefully reviewed incident—not an automatic accusation.</p></div><div className="workflow-track">{steps.map((s, i) => <div className="workflow-step" key={s.name}><div className="workflow-icon"><s.icon size={17} /></div><span>0{i + 1}</span><strong>{s.name}</strong>{i < steps.length - 1 && <i className="workflow-connector" />}</div>)}</div></section>
    <section className="landing-safe"><div className="safe-mark"><ShieldCheck size={21} /></div><div><span className="eyebrow">PRIVACY IS A FEATURE, NOT AN AFTERTHOUGHT</span><h2>Signals deserve context.<br /><span>People deserve care.</span></h2><p>VoiceShield does not secretly record calls or identify people by voice. Risk scores are prototype estimates, evidence is prepared for human review, and every simulation uses fictional data.</p><button className="text-link" onClick={() => go('settings')}>Review privacy & consent settings <ArrowRight size={14} /></button></div><div className="safe-points"><span><Check size={14} /> No covert recording</span><span><Check size={14} /> No automatic reports</span><span><Check size={14} /> No tone-based identification</span><span><Check size={14} /> Human review required</span></div></section>
    <footer className="landing-footer"><Brand small /><span>VOICE PROTECTION, WITH PEOPLE IN CONTROL.</span><button onClick={() => go('overview')}>Open demo dashboard <ArrowRight size={13} /></button></footer>
  </div>
}

function Overview({ calls, totalCalls, suspicious, highRisk, reports, startCall, go, filteredCalls, setDetailCall, chartData }) {
  const recent = calls.slice(0, 4)
  return <div className="page-content overview-page">
    <div className="welcome-row"><div><div className="eyebrow welcome-eyebrow"><span className="status-dot" /> YOUR VOICE IS PROTECTED</div><h1>Good morning, Alex <span className="wave-emoji">✳</span></h1><p>Here’s what’s happening across your call protection today.</p></div><div className="welcome-actions"><span className="date-chip"><Clock3 size={14} /> Tuesday, October 28</span><Button variant="primary" icon={Plus} onClick={startCall}>Start demo call</Button></div></div>
    <div className="demo-banner"><div className="demo-banner-icon"><Sparkles size={17} /></div><div><strong>You’re exploring demo data</strong><span>All calls and numbers are fictional. No real calls are monitored or recorded.</span></div><button onClick={() => go('settings')}>Explore privacy settings <ArrowRight size={14} /></button></div>
    <section className="stat-grid">
      <StatCard label="Calls analyzed" value={totalCalls.toLocaleString()} delta="12.8%" direction="up" note="vs. last 7 days" icon={PhoneIcon} tone="green" spark={[18,24,20,36,28,49,38,56,45,63,58,76]} />
      <StatCard label="Suspicious calls" value={suspicious} delta="8.2%" direction="down" note="vs. last 7 days" icon={ShieldAlert} tone="amber" spark={[52,39,50,34,43,31,41,24,32,20,24,15]} />
      <StatCard label="High-risk detected" value={highRisk} delta="3 new" direction="up" note="require your review" icon={Siren} tone="red" spark={[12,16,10,23,17,33,25,40,32,48,40,54]} />
      <StatCard label="Reports prepared" value={reports.length + 23} delta="View reports" direction="flat" note="prepared for review" icon={FileCheck2} tone="purple" onClick={() => go('reports')} spark={[17,21,17,28,22,33,25,34,29,40,35,48]} />
    </section>
    <div className="overview-main-grid"><section className="surface chart-card"><CardTitle eyebrow="CALL ACTIVITY" title="Your protection at a glance" detail="Call patterns over the last 8 hours" action={<button className="select-chip">Today <ChevronDown size={13} /></button>} /><div className="chart-legend"><span><i className="legend-green" /> Calls analyzed</span><span><i className="legend-purple" /> Flagged for review</span></div><div className="main-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ left: -20, right: 4, top: 10, bottom: 0 }}><defs><linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#58e3b0" stopOpacity={0.2} /><stop offset="95%" stopColor="#58e3b0" stopOpacity={0} /></linearGradient><linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#aa8cff" stopOpacity={0.18} /><stop offset="95%" stopColor="#aa8cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202837" strokeDasharray="3 6" vertical={false} /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#6b778b', fontSize: 10 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b778b', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#151b27', border: '1px solid #2a3444', borderRadius: 10, color: '#e9eef5', fontSize: 12 }} /><Area type="monotone" dataKey="calls" stroke="#58e3b0" strokeWidth={2} fill="url(#callsFill)" /><Area type="monotone" dataKey="risk" stroke="#aa8cff" strokeWidth={2} fill="url(#riskFill)" /></AreaChart></ResponsiveContainer></div><div className="chart-bottom"><span><span className="chart-current-dot" /> Monitoring active</span><span>Updated just now</span></div></section>
      <section className="surface protection-panel"><CardTitle eyebrow="LIVE PROTECTION" title="Always one step ahead" /><div className="protection-visual"><div className="protection-orbit orbit-one" /><div className="protection-orbit orbit-two" /><div className="protection-glow" /><div className="protection-shield"><ShieldCheck size={36} /></div><span className="orbit-node node-a" /><span className="orbit-node node-b" /><span className="orbit-node node-c" /></div><div className="protection-state"><span className="status-dot" /> All systems operational</div><div className="protection-list"><div><span><AudioLines size={15} /> Call pattern analysis</span><Check size={15} /></div><div><span><Fingerprint size={15} /> Social engineering detection</span><Check size={15} /></div><div><span><LockKeyhole size={15} /> Privacy-first by design</span><Check size={15} /></div></div><button className="text-link" onClick={() => go('settings')}>Manage protection settings <ArrowRight size={14} /></button></section></div>
    <section className="surface recent-card"><CardTitle eyebrow="RECENT ACTIVITY" title="Your latest calls" detail="A closer look at what VoiceShield has seen" action={<button className="text-link" onClick={() => go('monitor')}>View all activity <ArrowRight size={14} /></button>} />{recent.length ? <CallTable calls={recent} setDetailCall={setDetailCall} compact /> : <EmptyState icon={AudioLines} title="No calls yet" detail="Your demo call activity will appear here." action={<Button variant="primary" icon={Plus} onClick={startCall}>Start a demo call</Button>} />}</section>
    <footer className="page-footer"><span>VoiceShield AI <span className="footer-dot">·</span> A responsible AI prototype</span><span><LockKeyhole size={12} /> Your privacy is always the priority</span></footer>
  </div>
}
function PhoneIcon(props) { return <Headphones {...props} /> }
function StatCard({ label, value, delta, direction, note, icon: Icon, tone, spark, onClick }) { return <div className={`surface stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17} /></div></div><div className="stat-value-row"><strong>{value}</strong><div className="mini-spark">{spark.map((v, i) => <i key={i} style={{ height: `${v}%` }} />)}</div></div><div className="stat-foot"><span className={`stat-delta ${direction}`} onClick={onClick}>{direction === 'up' ? <ArrowUpRight size={13} /> : direction === 'down' ? <ArrowDownRight size={13} /> : null}{delta}</span><span>{note}</span></div></div> }
function CallTable({ calls, setDetailCall, compact = false }) { return <div className={`table-wrap ${compact ? 'table-compact' : ''}`}><table><thead><tr><th>CALLER</th><th>TIME</th><th>RISK SCORE</th><th>CLASSIFICATION</th><th>STATUS</th><th /></tr></thead><tbody>{calls.map(call => <tr key={call.id} onClick={() => setDetailCall(call)} className="click-row"><td><div className="caller-cell"><div className="caller-icon"><PhoneIcon size={14} /></div><div><strong>{call.caller}</strong><small>{call.id}</small></div></div></td><td>{call.time}</td><td><div className="score-cell"><span>{call.score}%</span><div className="score-track"><i className={`risk-fill risk-${call.level.toLowerCase()}`} style={{ width: `${call.score}%` }} /></div></div></td><td><Tag tone={call.level.toLowerCase()} dot>{call.level}</Tag></td><td><span className="status-text"><i className={call.status === 'Safe' || call.status === 'Completed' ? 'status-muted' : 'status-dot'} />{call.status}</span></td><td><button aria-label={`View ${call.id}`} className="row-more" onClick={e => { e.stopPropagation(); setDetailCall(call) }}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div> }

function Monitor({ activeCall, transcript, setTranscript, analysis, analyzing, analysisError, analyze, startCall, endCall, setActiveCall, fmt, calls, filteredCalls, filter, setFilter, query, setQuery, setDetailCall, transcriptBox, downloadTranscript, monitoring, setMonitoring }) {
  return <div className="page-content"><PageHeading eyebrow="REAL-TIME PROTECTION" title="Live monitoring" subtitle="Watch suspicious patterns surface as conversations unfold." action={<div className="heading-status"><span className={`status-dot ${monitoring ? '' : 'status-off'}`} />{monitoring ? 'Monitoring active' : 'Monitoring paused'}</div>} />
    <div className="monitor-grid"><section className="surface monitor-live"><div className="live-head"><div className="live-title"><span className={`live-indicator ${activeCall ? 'live-pulse' : ''}`}><Radio size={16} /></span><div><span className="eyebrow">{activeCall ? 'DEMO SESSION IN PROGRESS' : 'VOICE ACTIVITY'}</span><h2>{activeCall ? 'Listening for red flags' : monitoring ? 'Standing by for a call' : 'Monitoring is paused'}</h2></div></div><div className="session-chip"><span>SESSION</span><strong>{activeCall?.id || '— — —'}</strong></div></div>
      <div className={`wave-visual ${activeCall && !activeCall.paused ? 'wave-active' : ''}`}>{Array.from({ length: 64 }, (_, i) => <i key={i} style={{ '--bar': `${8 + Math.abs(Math.sin(i * 0.57) * 38) + Math.abs(Math.cos(i * 0.19) * 15)}px`, '--delay': `${(i % 13) * 0.055}s` }} />)}</div>
      <div className="wave-labels"><span>{activeCall ? activeCall.paused ? 'AUDIO SIMULATION PAUSED' : 'SIMULATED AUDIO ACTIVITY' : 'NO ACTIVE DEMO CALL'}</span><strong><Clock3 size={13} />{activeCall ? fmt(activeCall.seconds) : '00:00'}</strong></div>
      <div className="monitor-actions"><Button icon={monitoring ? Pause : Play} onClick={() => { setMonitoring(value => !value); if (activeCall) setActiveCall(c => ({ ...c, paused: monitoring })) }}>{monitoring ? 'Pause monitoring' : 'Resume monitoring'}</Button>{!activeCall ? <Button variant="primary" icon={Play} onClick={startCall}>Start demo call</Button> : <><Button variant="danger" icon={Square} onClick={endCall}>End demo call</Button></>}<span className="monitor-demo-note"><LockKeyhole size={13} /> Fictional simulation · No real audio</span></div></section>
      <section className="surface risk-panel"><CardTitle eyebrow="CURRENT RISK ASSESSMENT" title="Fraud risk score" detail="Prototype estimate from text indicators" action={<button className="icon-button small-icon" aria-label="Risk score information" title="Risk is a prototype estimate, not proof of fraud."><CircleHelp size={16} /></button>} /><RiskGauge score={analysis?.risk_score ?? (activeCall ? 76 : 0)} level={analysis?.risk_level ?? (activeCall ? 'High' : 'No call')} /><div className="risk-scale">{levels.map(l => <div key={l} className={`scale-${l.toLowerCase()} ${analysis?.risk_level === l ? 'scale-active' : ''}`}><i />{l}</div>)}</div><div className="risk-info"><ShieldAlert size={15} /><span>{analysis?.risk_level ? `${analysis.risk_level} risk indicators detected` : 'Start a demo call to see live risk indicators'}</span></div>{analysisError && <div className="inline-error">{analysisError}</div>}</section></div>
    <div className="monitor-bottom-grid"><section className="surface transcript-card"><CardTitle eyebrow="LIVE TRANSCRIPT" title="Conversation transcript" detail={activeCall ? 'Simulated speech-to-text · demo content' : 'Sample transcript ready to analyze'} action={<button className="icon-button small-icon" onClick={downloadTranscript} title="Download transcript"><Download size={15} /></button>} /><textarea ref={transcriptBox} aria-label="Live call transcript" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transcript text will appear here…" /><div className="transcript-footer"><span><span className="transcript-safe-dot" /> Sanitized demo transcript</span><span>{transcript.length} characters</span></div><div className="transcript-buttons"><Button variant="primary" icon={analyzing ? undefined : Sparkles} disabled={analyzing} onClick={analyze}>{analyzing ? <><span className="spinner" />Analyzing…</> : 'Analyze transcript'}</Button><button className="text-link" onClick={() => setTranscript(initialTranscript)}>Load sample transcript</button></div>{analysis && <AnalysisResult result={analysis} compact />}</section>
      <section className="surface red-flags-card"><CardTitle eyebrow="LIVE DETECTION" title="Signals to watch for" detail="Patterns are context-dependent, never proof." /><div className="signal-list"><Signal icon={LockKeyhole} label="Sensitive information" detail="OTP, PIN, password or banking details" active={analysis?.detected_indicators?.includes('Sensitive information request')} /><Signal icon={Zap} label="Urgency & intimidation" detail="Time pressure, threats or secrecy tactics" active={analysis?.detected_indicators?.some(x => x.includes('Urgency') || x.includes('pressure'))} /><Signal icon={UserRound} label="Impersonation claims" detail="Unverified bank, police or government identity" active={analysis?.detected_indicators?.includes('Authority impersonation')} /><Signal icon={ArrowRight} label="Suspicious actions" detail="Payment transfers, remote apps or links" active={analysis?.detected_indicators?.some(x => x.includes('payment') || x.includes('access'))} /></div><div className="tone-note"><AudioLines size={15} /><span>Voice emotion is only a supporting signal. Tone, accent, pitch, or emotional state alone never determine a risk score.</span></div></section></div>
    <section className="surface recent-card monitor-history"><CardTitle eyebrow="CALL HISTORY" title="Recent demo activity" detail="Search and filter calls, then select one to inspect its transcript." action={<span className="demo-table-chip">DEMO RECORDS</span>} /><div className="call-table-tools"><label className="call-search"><Search size={14} /><input aria-label="Search calls" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search calls or session ID…" /></label><select aria-label="Filter calls by risk" value={filter} onChange={e => setFilter(e.target.value)}><option>All risks</option>{levels.map(level => <option key={level}>{level}</option>)}</select></div>{filteredCalls.length ? <CallTable calls={filteredCalls.slice(0, 50)} setDetailCall={setDetailCall} /> : <EmptyState icon={AudioLines} title={calls.length ? 'No calls match these filters' : 'No demo calls recorded'} detail={calls.length ? 'Try another search or risk level.' : 'Start a simulated call to populate your activity.'} />}</section>
  </div>
}
function RiskGauge({ score, level }) { return <div className="gauge-wrap"><div className="gauge-ring" style={{ '--score': `${Math.max(0, score)}%` }}><div className="gauge-inner"><strong>{score}<small>%</small></strong><span>{level}</span></div></div></div> }
function Signal({ icon: Icon, label, detail, active }) { return <div className={`signal-row ${active ? 'signal-active' : ''}`}><div className="signal-icon"><Icon size={15} /></div><div><strong>{label}</strong><span>{detail}</span></div><span className="signal-status">{active ? <AlertTriangle size={14} /> : <i />}</span></div> }

function AnalysisPage({ transcript, setTranscript, analysis, analyzing, error, analyze }) {
  const [draft, setDraft] = useState(transcript)
  useEffect(() => setDraft(transcript), [transcript])
  async function run() { setTranscript(draft); await analyze(draft) }
  return <div className="page-content"><PageHeading eyebrow="CONTEXT-AWARE DETECTION" title="AI fraud analysis" subtitle="Look beyond keywords. Understand the tactics behind the conversation." action={<Tag tone="purple" dot>RULE-BASED DEMO</Tag>} />
    <div className="analysis-layout"><section className="surface input-card"><CardTitle eyebrow="TRANSCRIPT INPUT" title="Analyze a conversation" detail="Paste a user-provided transcript. Avoid including private information." /><textarea className="analysis-textarea" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Paste or type a call transcript to analyze…" /><div className="text-tools"><span>{draft.length} characters <span>·</span> {draft.trim() ? draft.trim().split(/\s+/).length : 0} words</span><button className="text-link" onClick={() => setDraft(initialTranscript)}>Use fictional sample</button></div>{error && <div className="inline-error">{error}</div>}<div className="input-submit-row"><Button variant="primary" icon={Sparkles} disabled={analyzing || !draft.trim()} onClick={run}>{analyzing ? <><span className="spinner" />Analyzing conversation…</> : 'Analyze transcript'}</Button><span><LockKeyhole size={13} /> Processed locally in demo mode</span></div><div className="analysis-disclaimer"><AlertTriangle size={15} /><span>Analysis is a prototype estimate, not definitive proof. Review context and confirm claims independently; never take action based on a score alone.</span></div></section>
      <section className="surface methodology-card"><CardTitle eyebrow="WHAT WE LOOK FOR" title="Signals, not assumptions" detail="Contextual language patterns inform a human review." /><div className="method-list"><Method icon={LockKeyhole} title="Sensitive information requests" text="Attempts to obtain OTPs, PINs, passwords or bank details." /><Method icon={Clock3} title="Urgency and fear" text="Artificial deadlines, threats, or pressure to stay secret." /><Method icon={UserRound} title="Impersonation patterns" text="Unverified claims to represent a bank, police, or authority." /><Method icon={ArrowRight} title="Payment & access requests" text="Transfers, gift cards, suspicious links, or remote-access apps." /></div><div className="method-foot"><AudioLines size={15} /><p>Voice emotion can be a supporting signal only. <strong>Accent, pitch, tone, and emotional state never determine the score.</strong></p></div></section></div>
    {analysis && <AnalysisResult result={analysis} />}
    {!analysis && <section className="analysis-empty surface"><div className="analysis-empty-icon"><Sparkles size={22} /></div><div><strong>Your analysis will appear here</strong><p>Run the sample transcript or add your own to see a contextual risk assessment.</p></div><div className="analysis-empty-chips"><Tag tone="neutral">Risk score</Tag><Tag tone="neutral">Warning phrases</Tag><Tag tone="neutral">Recommended action</Tag></div></section>}
  </div>
}
function Method({ icon: Icon, title, text }) { return <div className="method-item"><div className="method-icon"><Icon size={16} /></div><div><strong>{title}</strong><p>{text}</p></div></div> }
function AnalysisResult({ result, compact = false }) { return <div className={`analysis-result ${compact ? 'analysis-result-compact' : ''}`}><div className="result-head"><div><span className="eyebrow">{compact ? 'LATEST ASSESSMENT' : 'ANALYSIS COMPLETE'}</span><h3>Conversation risk assessment</h3></div><Tag tone={result.risk_level.toLowerCase()} dot>{result.risk_level} risk</Tag></div><div className="result-score-row"><div className="result-score"><strong>{result.risk_score}<small>%</small></strong><span>Fraud probability estimate</span></div><div className="result-confidence"><span>CONFIDENCE</span><strong>{result.confidence || 78}%</strong><div className="confidence-track"><i style={{ width: `${result.confidence || 78}%` }} /></div><small>Moderate · language signals only</small></div></div><p className="result-explanation">{result.explanation}</p>{result.suspicious_phrases?.length > 0 && <div className="result-block"><span className="eyebrow">WARNING PHRASES</span><div className="phrase-list">{result.suspicious_phrases.map((p, i) => <span key={`${p}-${i}`}>“{p}”</span>)}</div></div>}<div className="result-block"><span className="eyebrow">SOCIAL ENGINEERING SIGNALS</span>{result.detected_indicators?.length ? <div className="indicator-list">{result.detected_indicators.map(x => <Tag tone="amber" key={x}>{x}</Tag>)}</div> : <p className="no-signals">No known patterns matched this excerpt. This does not guarantee a call is safe.</p>}</div><div className="recommended-action"><div className="recommend-icon"><ShieldCheck size={17} /></div><div><span className="eyebrow">RECOMMENDED SAFE ACTION</span><p>{result.recommended_action}</p></div></div><div className="result-caveat"><AlertTriangle size={14} /><span>{result.caveat || 'Prototype estimate, not definitive proof of fraud. Human review is required.'}</span></div></div> }

function Honeypot({ messages, running, seconds, start, stop, reply, addMessage }) {
  const listRef = useRef(null)
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [messages])
  const tactics = ['OTP harvesting', 'Authority impersonation', 'Urgency & pressure', 'Secrecy request']
  return <div className="page-content"><PageHeading eyebrow="ISOLATED RESEARCH ENVIRONMENT" title="Honeypot lab" subtitle="A safe, fictional simulation to demonstrate scammer engagement patterns." action={<Tag tone={running ? 'green' : 'neutral'} dot>{running ? 'SIMULATION ACTIVE' : 'ISOLATED · OFFLINE'}</Tag>} />
    <div className="honeypot-warning"><div><ShieldAlert size={18} /></div><p><strong>Simulation only.</strong> This honeypot has no connection to a phone network, real callers, real accounts, or payment systems. Every identity and detail is fictional.</p></div>
    <div className="honeypot-grid"><section className="surface conversation-card"><div className="conversation-head"><div className="conversation-title"><div className="conversation-avatar"><UserRound size={18} /></div><div><strong>Unknown caller <span className="fictional-pill">FICTIONAL</span></strong><small>Unverified identity · Isolated demo session</small></div></div><div className={`conversation-state ${running ? 'state-running' : ''}`}><i />{running ? 'Engaged' : 'Standby'}</div></div><div className="conversation-messages" ref={listRef}>{messages.length ? messages.map((m, i) => <div className={`chat-row chat-${m.by}`} key={`${i}-${m.text}`}><div className={`chat-avatar chat-avatar-${m.by}`}>{m.by === 'agent' ? <Shield size={14} /> : <UserRound size={14} />}</div><div className="chat-bubble-wrap"><span>{m.by === 'agent' ? 'SHIELD AGENT · FICTIONAL' : 'SUSPICIOUS CALLER · SIMULATED'}</span><div className="chat-bubble">{m.text}</div><small>{i < 3 ? `00:${String(8 + i * 17).padStart(2, '0')}` : `00:${fmtSmall(Math.min(seconds, 59))}`}</small></div></div>) : <EmptyState icon={MessageSquareText} title="Ready for a safe simulation" detail="Start the simulation to load a fictional scam conversation." />}</div><div className="conversation-foot"><div className="conversation-timer"><Clock3 size={14} /> Interaction duration <strong>{`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}</strong></div><div className="conversation-controls">{!running ? <Button variant="primary" icon={Play} onClick={start}>Start simulation</Button> : <Button variant="danger" icon={Square} onClick={stop}>Stop simulation</Button>}<Button icon={MessageSquareText} onClick={addMessage}>Simulate caller</Button><Button icon={Sparkles} onClick={reply}>Generate demo reply</Button></div></div></section>
      <aside className="surface tactics-card"><CardTitle eyebrow="OBSERVED TACTICS" title="Patterns in this session" detail="Illustrative signals, not identity verification." /><div className="tactic-progress"><div><span>Signals observed</span><strong>{messages.length ? '4' : '0'}<small> / 4</small></strong></div><div className="tactic-track"><i style={{ width: messages.length ? '78%' : '0%' }} /></div></div><div className="tactic-list">{tactics.map((x, i) => <div key={x} className={messages.length && i < 3 ? 'tactic-seen' : ''}><span className="tactic-check">{messages.length && i < 3 ? <Check size={13} /> : <i />}</span><span>{x}</span><small>{messages.length && i < 3 ? 'OBSERVED' : 'PENDING'}</small></div>)}</div><div className="tactic-isolation"><LockKeyhole size={15} /><span>Isolated by design</span><p>Generic replies only. No personal data, real contact, or external actions.</p></div><div className="tactic-note"><Sparkles size={14} /><span>The demo agent does not use a live AI provider and cannot act outside this page.</span></div></aside></div>
  </div>
}
function fmtSmall(s) { return String(s).padStart(2, '0') }

function Reports({ reports, calls, createReport, onDelete, onReview, onCSV, onPDF }) {
  const [reportView, setReportView] = useState(null)
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false)
  const shown = onlyUnreviewed ? reports.filter(r => !r.reviewed) : reports
  function markReviewed(id) { /* update owned report record */ }
  return <div className="page-content"><PageHeading eyebrow="HUMAN REVIEW WORKFLOW" title="Incident reports" subtitle="Prepare, review, and export sanitized incident summaries." action={<Button variant="primary" icon={Plus} onClick={() => createReport(calls.find(c => ['Critical', 'High'].includes(c.level)) || calls[0])}>Generate sample report</Button>} />
    <div className="reports-note"><div><FileCheck2 size={17} /></div><span>Reports are <strong>prepared for review/submission only.</strong> They are never sent to law enforcement or any third party.</span><Tag tone="purple">HUMAN REVIEW REQUIRED</Tag></div>
    <div className="report-stats"><div className="surface report-stat"><span>Prepared reports</span><strong>{reports.length}</strong><small><FileText size={13} /> In this demo workspace</small></div><div className="surface report-stat"><span>Awaiting review</span><strong>{reports.filter(r => !r.reviewed).length}</strong><small><Clock3 size={13} /> Human review required</small></div><div className="surface report-stat"><span>Reviewed</span><strong>{reports.filter(r => r.reviewed).length}</strong><small><CheckCircle2 size={13} /> Marked by you</small></div><div className="surface report-stat report-stat-action"><span>Create from a call</span><strong><FileCheck2 size={19} /></strong><button className="text-link" onClick={() => createReport(calls[0])}>Generate sample report <ArrowRight size={14} /></button></div></div>
    <section className="surface reports-table-card"><CardTitle eyebrow="REPORT LIBRARY" title="Prepared incidents" detail="Review the sanitized evidence before taking any action." action={<button className={`filter-chip ${onlyUnreviewed ? 'filter-on' : ''}`} onClick={() => setOnlyUnreviewed(x => !x)}><CheckCircle2 size={13} /> {onlyUnreviewed ? 'Awaiting review' : 'All reports'} <ChevronDown size={12} /></button>} />{shown.length ? <div className="table-wrap"><table><thead><tr><th>INCIDENT</th><th>PREPARED</th><th>RISK</th><th>DETECTED PATTERNS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map(r => <tr key={r.id}><td><div className="incident-id"><div><FileText size={15} /></div><span><strong>{r.id}</strong><small>Call ref · {r.call_id}</small></span></div></td><td>{new Date(r.created_at).toLocaleString()}</td><td><Tag tone={r.level.toLowerCase()} dot>{r.score}% · {r.level}</Tag></td><td><div className="report-patterns">{(r.patterns || []).slice(0, 2).map(p => <span key={p}>{p}</span>)}{(r.patterns || []).length > 2 && <span>+{r.patterns.length - 2}</span>}</div></td><td><span className="report-status"><i className={r.reviewed ? 'reviewed-dot' : 'status-dot'} />{r.reviewed ? 'Reviewed by you' : 'Prepared for review'}</span></td><td><div className="report-actions"><button title="View report" aria-label="View report" onClick={() => setReportView(r)}><ExternalLink size={15} /></button><button title="Export CSV" aria-label="Export CSV" onClick={() => onCSV(r)}><Download size={15} /></button><button title="Print or save as PDF" aria-label="Print or save as PDF" onClick={() => onPDF(r)}><FileText size={15} /></button><button title="Delete demo report" aria-label="Delete report" className="delete-action" onClick={() => onDelete(r.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={FileCheck2} title={reports.length ? 'No reports match this filter' : 'No reports prepared yet'} detail={reports.length ? 'Try switching back to all reports.' : 'Choose a call and prepare a fictional incident for human review.'} action={reports.length ? null : <Button variant="primary" icon={Plus} onClick={() => createReport(calls.find(c => ['Critical', 'High'].includes(c.level)) || calls[0])}>Generate sample report</Button>} />}</section>
    {reportView && <ReportModal report={reportView} close={() => setReportView(null)} onCSV={onCSV} onPDF={onPDF} onReview={() => onReview(reportView.id)} />}
    <p className="reports-footnote"><LockKeyhole size={13} /> Transcript excerpts are limited and sanitized for this prototype. Avoid entering sensitive personal information.</p>
  </div>
}
function ReportModal({ report, close, onCSV, onPDF, onReview }) { return <div className="modal-backdrop" onClick={close}><div className="modal-card report-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREPARED FOR HUMAN REVIEW</span><h2>{report.id}</h2></div><button className="icon-button" aria-label="Close" onClick={close}><X size={18} /></button></div><div className="modal-body"><div className="detail-metrics"><div><span>RISK SCORE</span><strong>{report.score}% · {report.level}</strong></div><div><span>CALL REFERENCE</span><strong>{report.call_id}</strong></div><div><span>PREPARED</span><strong>{new Date(report.created_at).toLocaleString()}</strong></div><div><span>EVIDENCE STATUS</span><strong>Sanitized demo excerpt</strong></div></div><h4>Detected patterns</h4><div className="indicator-list">{(report.patterns || []).length ? report.patterns.map(x => <Tag tone="amber" key={x}>{x}</Tag>) : <span>No known indicators found</span>}</div><h4>Transcript excerpt</h4><blockquote>{report.excerpt || 'No transcript excerpt available.'}</blockquote><div className="report-modal-warning"><AlertTriangle size={15} /> Prepared for review/submission. This has not been sent to law enforcement.</div></div><div className="modal-foot"><Button icon={Download} onClick={() => onCSV(report)}>Export CSV</Button><Button icon={FileText} onClick={() => onPDF(report)}>Print / PDF</Button><Button variant="primary" icon={Check} onClick={() => { onReview(); close() }}>Mark reviewed</Button></div></div></div> }

function SettingsPage({ settings, toggle, backend, micState, requestMic, reset }) {
  const [retention, setRetention] = useState(settings.retention)
  return <div className="page-content"><PageHeading eyebrow="CONTROL YOUR DATA" title="Settings & privacy" subtitle="Your calls are yours. Choose what to simulate, retain, and share." action={<Tag tone="green" dot>PRIVACY FIRST</Tag>} />
    <div className="settings-layout"><div className="settings-main"><section className="surface settings-section"><CardTitle eyebrow="MONITORING PREFERENCES" title="Your protection settings" detail="Nothing accesses a microphone without your explicit permission." /><SettingRow icon={Activity} title="Demo monitoring" desc="Enable simulated calls and rule-based transcript analysis." control={<Toggle checked={settings.demo} onChange={() => toggle('demo')} />} /><SettingRow icon={Bell} title="Protection notifications" desc="Show in-app alerts when a demo call triggers risk indicators." control={<Toggle checked={settings.notifications} onChange={() => toggle('notifications')} />} /><SettingRow icon={Mic} title="Microphone access" desc="Optional browser permission check. No recording or upload occurs." control={<Button icon={micState === 'permission granted · not recording' ? CheckCircle2 : Mic} onClick={requestMic}>{micState === 'not requested' ? 'Request permission' : micState}</Button>} /></section>
      <section className="surface settings-section"><CardTitle eyebrow="DATA & RETENTION" title="Keep only what you need" detail="Local demo records live in this browser and can be cleared at any time." /><div className="retention-setting"><div className="setting-icon"><Clock3 size={17} /></div><div className="setting-copy"><strong>Transcript retention</strong><span>Choose how long demo transcript records are kept.</span></div><select value={retention} onChange={e => { setRetention(e.target.value); toggle('retention', e.target.value) }}><option>Until deleted</option><option>30 days</option><option>7 days</option><option>Do not retain</option></select></div><div className="danger-zone"><div><strong>Reset local demo data</strong><span>Remove demo calls, reports, and simulation messages from this browser.</span></div><Button variant="danger-outline" icon={Trash2} onClick={reset}>Reset demo data</Button></div></section>
      <section className="surface settings-section"><CardTitle eyebrow="AI PROVIDER" title="Analysis configuration" detail="Detection works in local demo mode without any credentials." /><div className="provider-card"><div className="provider-logo"><Sparkles size={18} /></div><div className="provider-copy"><strong>Rule-based analyzer</strong><span>Local pattern matching · No external AI API required</span></div><Tag tone={backend === 'connected' ? 'green' : 'neutral'} dot>{backend === 'connected' ? 'BACKEND AVAILABLE' : 'DEMO MODE'}</Tag></div><div className="provider-help">A server-side AI provider can optionally be configured with <code>ZAI_API_KEY</code> and <code>ZAI_API_BASE</code>. Keys are kept on the backend and never sent to the browser. This prototype still uses the transparent rule-based analyzer by default.</div></section></div>
      <aside className="settings-aside"><div className="surface privacy-card"><div className="privacy-shield"><ShieldCheck size={25} /></div><span className="eyebrow">OUR PRIVACY PROMISE</span><h3>Protection without compromise.</h3><p>VoiceShield never secretly records calls or accesses phone audio. Every interaction is deliberate, transparent, and under your control.</p><div className="privacy-list"><span><Check size={14} /> No background recording</span><span><Check size={14} /> No automatic call interception</span><span><Check size={14} /> No hidden audio uploads</span><span><Check size={14} /> Human review before any action</span><span><Check size={14} /> Fictional data in demo mode</span></div></div><div className="surface mic-status-card"><div><MicOff size={17} /><strong>Audio capture</strong></div><Tag tone="neutral">{micState === 'permission granted · not recording' ? 'NOT RECORDING' : 'OFF'}</Tag><p>Microphone access is only requested when you press the permission button. Granting access does not begin a recording.</p></div><div className="settings-disclaimer"><AlertTriangle size={15} /><p>AI risk scores are estimates—not proof. Do not accuse, block, or report anyone solely on an automated score.</p></div></aside></div>
  </div>
}
function SettingRow({ icon: Icon, title, desc, control }) { return <div className="setting-row"><div className="setting-icon"><Icon size={17} /></div><div className="setting-copy"><strong>{title}</strong><span>{desc}</span></div>{control}</div> }
function Toggle({ checked, onChange }) { return <button role="switch" aria-checked={checked} className={`toggle ${checked ? 'toggle-on' : ''}`} onClick={onChange}><i /></button> }

function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="page-heading-action">{action}</div>}</div> }
function CallModal({ call, onClose, onReport, onAnalyze }) { return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CALL DETAIL · FICTIONAL DEMO</span><h2>{call.id}</h2></div><button className="icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button></div><div className="modal-body"><div className="detail-metrics"><div><span>CALLER</span><strong>{call.caller}</strong></div><div><span>TIME</span><strong>{call.time} · {call.date}</strong></div><div><span>RISK</span><strong>{call.score}% · {call.level}</strong></div><div><span>DURATION</span><strong>{call.duration || '—'}</strong></div></div><h4>Transcript excerpt</h4><blockquote>{call.transcript || 'No transcript available.'}</blockquote><div className="report-modal-warning"><AlertTriangle size={15} /> Risk score is a prototype estimate—not proof of fraud.</div></div><div className="modal-foot"><Button onClick={onAnalyze} icon={Sparkles}>Analyze transcript</Button><Button variant="primary" onClick={onReport} icon={FileCheck2}>Prepare incident</Button></div></div></div> }

export default App

