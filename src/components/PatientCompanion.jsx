import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaPaperPlane, FaRobot, FaUserCircle, FaRegSmileBeam, FaRegCommentDots, FaStethoscope, FaStickyNote } from 'react-icons/fa'

function useCountdown(initialMs) {
	const [timeLeft, setTimeLeft] = useState(initialMs)
	
	useEffect(() => {
		if (!initialMs || initialMs <= 0) return
		
		const interval = setInterval(() => {
			setTimeLeft(prev => {
				const newTime = prev - 1000
				return newTime > 0 ? newTime : 0
			})
		}, 1000)
		
		return () => clearInterval(interval)
	}, [initialMs])
	
	useEffect(() => {
		if (initialMs) {
			setTimeLeft(initialMs)
		}
	}, [initialMs])
	
	return timeLeft
}

function formatTimeLeft(ms) {
	if (!ms || ms <= 0) return '0 days'
	const days = Math.floor(ms / (24 * 60 * 60 * 1000))
	const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
	const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
	
	if (days > 0) {
		return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`
	} else if (hours > 0) {
		return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
	} else {
		return `${minutes} minute${minutes !== 1 ? 's' : ''}`
	}
}

const resolvedHost = typeof window !== 'undefined'
	? `${window.location.protocol}//${window.location.hostname}:4343`
	: 'http://localhost:4343'
const API_BASE = import.meta.env.VITE_API_BASE || resolvedHost

function makeId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return Math.random().toString(36).slice(2, 11)
}

function detectLanguage(text) {
	if (!text) return 'auto'
	const arabicRange = /[\u0600-\u06FF]/
	return arabicRange.test(text) ? 'ar' : 'en'
}

function initialGreeting(languagePreference = 'en') {
	const greetings = {
		en: 'I am the Empathic Companion. Tell me what is on your mind and we will work through it together.',
		ar: 'أنا الرفيق المتفهم. احكي لي ما يجول في ذهنك وسنمضي معًا خطوة بخطوة.'
	}
	return greetings[languagePreference] || greetings.en
}

// Function to parse markdown-like formatting and convert to React elements
function parseMarkdown(text) {
	if (!text) return null
	
	// Split by newlines to handle paragraphs and lists
	const lines = text.split('\n')
	const elements = []
	let currentList = null
	
	lines.forEach((line, lineIndex) => {
		const trimmed = line.trim()
		
		// Check if it's a bullet point
		if (trimmed.match(/^[\*\-]\s+/)) {
			const listItem = trimmed.replace(/^[\*\-]\s+/, '')
			if (!currentList) {
				currentList = []
			}
			currentList.push(parseInlineMarkdown(listItem))
		} else {
			// Close any open list
			if (currentList) {
				elements.push(
					<ul key={`list-${lineIndex}`}>
						{currentList.map((item, idx) => (
							<li key={idx}>{item}</li>
						))}
					</ul>
				)
				currentList = null
			}
			
			// Process regular line
			if (trimmed) {
				const parsed = parseInlineMarkdown(trimmed)
				elements.push(
					<p key={`para-${lineIndex}`}>
						{parsed}
					</p>
				)
			} else if (lineIndex < lines.length - 1) {
				// Empty line for spacing
				elements.push(<br key={`br-${lineIndex}`} />)
			}
		}
	})
	
	// Close any remaining list
	if (currentList) {
		elements.push(
			<ul key={`list-final`}>
				{currentList.map((item, idx) => (
					<li key={idx}>{item}</li>
				))}
			</ul>
		)
	}
	
	return elements.length > 0 ? elements : [<p key="empty">{text}</p>]
}

// Function to parse inline markdown (bold, italic, etc.)
function parseInlineMarkdown(text) {
	const parts = []
	let lastIndex = 0
	let key = 0
	
	// Pattern to match **bold** or *italic* or *bold* (when not at start of line)
	const patterns = [
		{ regex: /\*\*([^*]+)\*\*/g, tag: 'strong' },
		{ regex: /\*([^*]+)\*/g, tag: 'em' }
	]
	
	// Find all matches
	const matches = []
	patterns.forEach(({ regex, tag }) => {
		let match
		regex.lastIndex = 0
		while ((match = regex.exec(text)) !== null) {
			matches.push({
				start: match.index,
				end: match.index + match[0].length,
				content: match[1],
				tag
			})
		}
	})
	
	// Sort matches by position
	matches.sort((a, b) => a.start - b.start)
	
	// Remove overlapping matches (prefer bold over italic)
	const filteredMatches = []
	matches.forEach(match => {
		const overlaps = filteredMatches.some(existing => 
			(match.start < existing.end && match.end > existing.start)
		)
		if (!overlaps) {
			filteredMatches.push(match)
		}
	})
	
	// Build parts array
	filteredMatches.forEach(match => {
		// Add text before match
		if (match.start > lastIndex) {
			parts.push(text.substring(lastIndex, match.start))
		}
		
		// Add formatted text
		if (match.tag === 'strong') {
			parts.push(<strong key={key++}>{match.content}</strong>)
		} else if (match.tag === 'em') {
			parts.push(<em key={key++}>{match.content}</em>)
		}
		
		lastIndex = match.end
	})
	
	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(text.substring(lastIndex))
	}
	
	return parts.length > 0 ? parts : text
}

export default function PatientCompanion({ user }) {
	const [messages, setMessages] = useState(() => [
		{ id: 'intro', role: 'assistant', text: initialGreeting(user?.languagePreference) }
	])
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)
	const [loadingHistory, setLoadingHistory] = useState(true)
	const [error, setError] = useState('')
	const [doctorNotes, setDoctorNotes] = useState([])
	const [doctorInfo, setDoctorInfo] = useState(null)
	const [doctorNotesLoading, setDoctorNotesLoading] = useState(true)
	const [doctorNotesError, setDoctorNotesError] = useState('')
	const [sharing, setSharing] = useState(false)
	const [shareNotice, setShareNotice] = useState(null)
	const [doctors, setDoctors] = useState([])
	const [selectingPermanent, setSelectingPermanent] = useState(false)
	const [selectedPermanentDoctor, setSelectedPermanentDoctor] = useState('')
	const scrollRef = useRef(null)
	const hasPatientMessagesRef = useRef(false)
	const shareInFlightRef = useRef(false)

	const PERMANENT_DOCTOR_MS = (user?.permanentDoctorDays || 2) * 24 * 60 * 60 * 1000
	const daysSinceSelection = user?.doctorSelectionDate 
		? Date.now() - user.doctorSelectionDate 
		: Infinity
	const isWithinPeriod = daysSinceSelection < PERMANENT_DOCTOR_MS
	const canChangeDoctor = isWithinPeriod && !user?.permanentDoctorId && !user?.noDoctor
	const timeLeftMs = user?.timeUntilPermanentRequired || null
	const timeLeft = useCountdown(timeLeftMs)

	const shouldShowFollowUpPanel = useMemo(() => {
		// Hide panel if user chose "no doctor" option
		if (user?.noDoctor) {
			return false
		}
		// Hide if needs permanent doctor (will show permanent doctor selection instead)
		if (user?.needsPermanentDoctor) {
			return false
		}
		// Always show panel if user wants doctor (even if no doctor selected yet, they can select one)
		return true
	}, [user?.noDoctor, user?.needsPermanentDoctor])

	const loadPatientFollowUps = useCallback(async () => {
		try {
			setDoctorNotesLoading(true)
			setDoctorNotesError('')
			const response = await fetch(`${API_BASE}/patient/followups`, {
				method: 'GET',
				credentials: 'include'
			})
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(payload?.error || 'Failed to load follow-ups.')
			}
			const payload = await response.json()
			const followUps = Array.isArray(payload?.followUps) ? payload.followUps : []
			const notes = followUps.flatMap(entry => {
				const entries = Array.isArray(entry.doctorNotes) ? entry.doctorNotes : []
				return entries.map(note => ({
					...note,
					followUpId: entry.id,
					followUpCreatedAt: entry.createdAt
				}))
			}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
			setDoctorNotes(notes)
			setDoctorInfo(payload?.doctor || null)
		} catch (err) {
			console.error('Failed to load doctor notes:', err)
			setDoctorNotes([])
			setDoctorInfo(null)
			setDoctorNotesError(err?.message || 'Unable to load doctor notes.')
		} finally {
			setDoctorNotesLoading(false)
		}
	}, [])

	// Load chat history on mount
	useEffect(() => {
		async function loadChatHistory() {
			try {
				const response = await fetch(`${API_BASE}/ai/chat/history`, {
					method: 'GET',
					credentials: 'include'
				})

				if (response.ok) {
					const payload = await response.json()
					const history = payload?.history || []
					
					if (history.length > 0) {
						// Convert saved history format to message format
						const loadedMessages = []
						
						// Add initial greeting if no history exists
						loadedMessages.push({
							id: 'intro',
							role: 'assistant',
							text: initialGreeting(user?.languagePreference)
						})
						
						// Add all historical messages
						history.forEach((entry, index) => {
							loadedMessages.push({
								id: `user-${entry.timestamp}-${index}`,
								role: 'user',
								text: entry.userMessage
							})
							loadedMessages.push({
								id: `assistant-${entry.timestamp}-${index}`,
								role: 'assistant',
								text: entry.aiReply
							})
						})
						
						setMessages(loadedMessages)
					}
				}
			} catch (err) {
				console.error('Error loading chat history:', err)
				// Continue with default greeting if history load fails
			} finally {
				setLoadingHistory(false)
			}
		}

		loadChatHistory()
		
		// Only load patient follow-ups if user wants doctor (not noDoctor)
		if (!user?.noDoctor) {
			loadPatientFollowUps()
		}
		
		// Load doctors if user wants doctor (not noDoctor) and needs to select or can change
		if (!user?.noDoctor && (user?.needsPermanentDoctor || canChangeDoctor || !user?.selectedDoctor)) {
			loadDoctors()
		}
	}, [user?.languagePreference, user?.needsPermanentDoctor, user?.noDoctor, user?.permanentDoctorId, user?.doctorSelectionDate, user?.selectedDoctor, canChangeDoctor, loadPatientFollowUps])
	
	const loadDoctors = useCallback(async () => {
		try {
			const response = await fetch(`${API_BASE}/doctors`, {
				credentials: 'include'
			})
			if (!response.ok) {
				throw new Error('Failed to load doctors')
			}
			const payload = await response.json()
			setDoctors(payload?.doctors || [])
		} catch (err) {
			console.error('Failed to fetch doctors:', err)
		}
	}, [])
	
	async function handleSetPermanentDoctor(doctorId = null) {
		const targetDoctorId = doctorId || selectedPermanentDoctor || user?.selectedDoctor?.id
		if (!targetDoctorId) {
			setShareNotice({ type: 'error', message: 'Please select a doctor first.' })
			return
		}
		setSelectingPermanent(true)
		try {
			const response = await fetch(`${API_BASE}/patient/permanent-doctor`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ doctorId: targetDoctorId })
			})
			const payload = await response.json()
			if (!response.ok) {
				throw new Error(payload?.error || 'Failed to set permanent doctor.')
			}
			// Refresh page to update user state
			window.location.reload()
		} catch (err) {
			setShareNotice({ type: 'error', message: err?.message || 'Failed to set permanent doctor.' })
		} finally {
			setSelectingPermanent(false)
		}
	}

	async function handleChangeDoctor(doctorId) {
		try {
			const response = await fetch(`${API_BASE}/patient/change-doctor`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ doctorId })
			})
			const payload = await response.json()
			if (!response.ok) {
				throw new Error(payload?.error || 'Failed to change doctor.')
			}
			// Refresh page to update user state
			window.location.reload()
		} catch (err) {
			setShareNotice({ type: 'error', message: err?.message || 'Failed to change doctor.' })
		}
	}

	useEffect(() => {
		if (!scrollRef.current) return
		scrollRef.current.scrollTop = scrollRef.current.scrollHeight
	}, [messages, loading])

	useEffect(() => {
		return () => {
			if (hasPatientMessagesRef.current) {
				shareFollowUpSilently()
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const canSend = useMemo(() => {
		return input.trim().length > 0 && !loading
	}, [input, loading])

	async function sendMessage(event) {
		event?.preventDefault()
		const trimmed = input.trim()
		if (!trimmed || loading) return

		const language = detectLanguage(trimmed)
		const outgoing = { id: makeId(), role: 'user', text: trimmed, timestamp: Date.now() }
		const historyPayload = messages.map(message => ({
			role: message.role === 'assistant' ? 'assistant' : 'user',
			text: message.text
		})).slice(-10)

		setMessages(prev => [...prev, outgoing])
		hasPatientMessagesRef.current = true
		setInput('')
		setError('')
		setLoading(true)

		try {
			const response = await fetch(`${API_BASE}/ai/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					message: trimmed,
					history: historyPayload,
					language
				})
			})

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(payload?.error || 'Could not reach the companion right now.')
			}

			const payload = await response.json()
			const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''

			setMessages(prev => [
				...prev,
				{
					id: makeId(),
					role: 'assistant',
					text: reply || 'I am here with you. Would you like to tell me more?'
				}
			])
		} catch (err) {
			console.error('AI chat error:', err)
			setMessages(prev => prev.filter(message => message.id !== outgoing.id))
			setError(err?.message || 'Something went wrong. Please try again in a moment.')
		} finally {
			setLoading(false)
		}
	}

	function shareFollowUpSilently() {
		if (!hasPatientMessagesRef.current || shareInFlightRef.current || !user?.selectedDoctor || user?.noDoctor) return
		shareInFlightRef.current = true
		const payload = JSON.stringify({ source: 'auto' })
		try {
			if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
				const blob = new Blob([payload], { type: 'application/json' })
				navigator.sendBeacon(`${API_BASE}/ai/follow-up`, blob)
			} else {
				fetch(`${API_BASE}/ai/follow-up`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					credentials: 'include',
					body: payload,
					keepalive: true
				}).catch(() => {})
			}
			hasPatientMessagesRef.current = false
		} catch (err) {
			console.error('Silent follow-up share failed:', err)
		} finally {
			shareInFlightRef.current = false
		}
	}

	async function handleShareWithDoctor() {
		if (sharing) return
		if (user?.noDoctor) {
			setShareNotice({ type: 'error', message: 'You chose to use the AI companion without a doctor. Sessions are not shared.' })
			return
		}
		if (!user?.selectedDoctor) {
			setShareNotice({ type: 'error', message: 'Please select a doctor before sharing.' })
			return
		}
		setSharing(true)
		setShareNotice(null)
		try {
			const response = await fetch(`${API_BASE}/ai/follow-up`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ source: 'manual' })
			})
			const payload = await response.json().catch(() => ({}))
			if (!response.ok) {
				throw new Error(payload?.error || 'Unable to share follow-up.')
			}
			setShareNotice({ type: 'success', message: 'Session shared with your doctor.' })
			hasPatientMessagesRef.current = false
			await loadPatientFollowUps()
		} catch (err) {
			console.error('Unable to share follow-up:', err)
			setShareNotice({ type: 'error', message: err?.message || 'Unable to share follow-up.' })
		} finally {
			setSharing(false)
		}
	}

	return (
		<div className="companion-card fade-in">
			<header className="companion-header">
				<div className="companion-title">
					<span className="companion-icon"><FaRobot size={18} /></span>
					<div>
						<h3>The Empathic Companion</h3>
						<p>Share your thoughts and we will turn dreams into steps.</p>
					</div>
				</div>
			</header>

			{user?.needsPermanentDoctor && !user?.noDoctor && (
				<section className="doctor-feedback-card permanent-doctor-selection">
					<header>
						<div className="doctor-feedback-title">
							<span className="doctor-icon"><FaStethoscope /></span>
							<div>
								<h4>Choose Your Permanent Doctor (Required)</h4>
								<p>
									After {user?.permanentDoctorDays || 2} days, you must choose one permanent doctor to continue with. This choice cannot be changed.
								</p>
							</div>
						</div>
					</header>
					<div className="permanent-doctor-select">
						<select
							value={selectedPermanentDoctor || user?.selectedDoctor?.id || ''}
							onChange={(e) => {
								setSelectedPermanentDoctor(e.target.value)
								if (e.target.value) {
									handleChangeDoctor(e.target.value)
								}
							}}
							disabled={selectingPermanent}
							className="doctor-select-input"
						>
							<option value="">Select a doctor</option>
							{doctors.map(doctor => (
								<option key={doctor.id} value={doctor.id}>
									{doctor.name} — {doctor.speciality}
								</option>
							))}
						</select>
						{(selectedPermanentDoctor || user?.selectedDoctor?.id) && (() => {
							const selectedDoctorId = selectedPermanentDoctor || user?.selectedDoctor?.id
							const selectedDoctorData = doctors.find(d => d.id === selectedDoctorId) || user?.selectedDoctor
							if (!selectedDoctorData) return null
							return (
								<div className="selected-doctor-info">
									<div className="selected-doctor-header">
										<strong>{selectedDoctorData.name || user?.selectedDoctor?.name}</strong>
										<span>{selectedDoctorData.speciality || user?.selectedDoctor?.speciality}</span>
									</div>
									{(selectedDoctorData.description || user?.selectedDoctor?.description) && (
										<div className="selected-doctor-description">
											<p>{selectedDoctorData.description || user?.selectedDoctor?.description}</p>
										</div>
									)}
								</div>
							)
						})()}
						<button
							type="button"
							className="primary"
							onClick={() => handleSetPermanentDoctor(selectedPermanentDoctor || user?.selectedDoctor?.id)}
							disabled={selectingPermanent || (!selectedPermanentDoctor && !user?.selectedDoctor?.id)}
						>
							{selectingPermanent ? 'Setting...' : 'Set as permanent doctor'}
						</button>
					</div>
					{shareNotice && (
						<div className={`share-notice ${shareNotice.type}`}>
							{shareNotice.message}
						</div>
					)}
				</section>
			)}
			{shouldShowFollowUpPanel && !user?.needsPermanentDoctor && (
				<section className="doctor-feedback-card">
					<header>
						<div className="doctor-feedback-title">
							<span className="doctor-icon"><FaStethoscope /></span>
							<div>
								<h4>Doctor follow-up</h4>
								<p>
									{doctorInfo?.name
										? `Assigned to ${doctorInfo.name}`
										: 'Select a doctor to share your sessions with.'}
								</p>
								{canChangeDoctor && (
									<p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--ink-2)' }}>
										You can share with any doctor within {user?.permanentDoctorDays || 2} days.
									</p>
								)}
								{timeLeft !== null && timeLeft > 0 && !user?.needsPermanentDoctor && (
									<p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--ink-2)' }}>
										Time left to choose permanent doctor: {formatTimeLeft(timeLeft)}
									</p>
								)}
							</div>
						</div>
						<div className="doctor-select-actions">
							{doctors.length > 0 && (
								<select
									value={user?.selectedDoctor?.id || ''}
									onChange={(e) => {
										if (e.target.value) {
											handleChangeDoctor(e.target.value)
										}
									}}
									className="doctor-select-input"
								>
									<option value="">Select a doctor to share with</option>
									{doctors.map(doctor => (
										<option key={doctor.id} value={doctor.id}>
											{doctor.name} — {doctor.speciality}
										</option>
									))}
								</select>
							)}
							{user?.selectedDoctor && (() => {
								const selectedDoctorData = doctors.find(d => d.id === user.selectedDoctor.id) || user.selectedDoctor
								if (!selectedDoctorData) return null
								return (
									<div className="selected-doctor-info">
										<div className="selected-doctor-header">
											<strong>{selectedDoctorData.name || user.selectedDoctor.name}</strong>
											<span>{selectedDoctorData.speciality || user.selectedDoctor.speciality}</span>
										</div>
										{(selectedDoctorData.description || user.selectedDoctor.description) && (
											<div className="selected-doctor-description">
												<p>{selectedDoctorData.description || user.selectedDoctor.description}</p>
											</div>
										)}
									</div>
								)
							})()}
							<div className="doctor-action-buttons">
								<button
									type="button"
									className="share-session-button"
									onClick={handleShareWithDoctor}
									disabled={sharing || !user?.selectedDoctor}
								>
									{sharing ? 'Sharing…' : 'Share session'}
								</button>
								{canChangeDoctor && user?.selectedDoctor && !user?.permanentDoctorId && (
									<button
										type="button"
										className="primary set-permanent-btn"
										onClick={() => handleSetPermanentDoctor(user?.selectedDoctor?.id)}
										disabled={selectingPermanent}
									>
										{selectingPermanent ? 'Setting...' : 'Set as permanent'}
									</button>
								)}
							</div>
						</div>
					</header>
					{shareNotice && (
						<div className={`share-notice ${shareNotice.type}`}>
							{shareNotice.message}
						</div>
					)}
					{doctorNotesLoading ? (
						<p className="doctor-note-placeholder">Loading doctor notes…</p>
					) : doctorNotesError ? (
						<p className="doctor-note-placeholder error">{doctorNotesError}</p>
					) : doctorNotes.length === 0 ? (
						<p className="doctor-note-placeholder">No notes from your doctor yet.</p>
					) : (
						<ul className="doctor-note-list">
							{doctorNotes.map(note => (
								<li key={note.id}>
									<div className="note-meta">
										<span className="note-icon"><FaStickyNote /></span>
										<div>
											<strong>{note.doctorName || 'Your doctor'}</strong>
											<small>{new Date(note.createdAt).toLocaleString()}</small>
										</div>
									</div>
									<p>{note.note}</p>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			<div ref={scrollRef} className="companion-messages" role="log" aria-live="polite">
				{messages.map(message => (
					<div
						key={message.id}
						className={`companion-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}
					>
						<div className="avatar" aria-hidden="true">
							{message.role === 'assistant' ? <FaRobot /> : <FaUserCircle />}
						</div>
						<div className="bubble">
							{message.role === 'assistant' ? parseMarkdown(message.text) : <p>{message.text}</p>}
						</div>
					</div>
				))}
				{loading && (
					<div className="companion-message assistant">
						<div className="avatar" aria-hidden="true"><FaRobot /></div>
						<div className="bubble typing">
							<span /><span /><span />
						</div>
					</div>
				)}
			</div>

			<form className="companion-input" onSubmit={sendMessage}>
				<label htmlFor="companion-message" className="companion-input-icon">
					<FaRegCommentDots aria-hidden="true" />
					<span className="sr-only">Your message</span>
				</label>
				<textarea
					id="companion-message"
					value={input}
					onChange={(event) => setInput(event.target.value)}
					placeholder="How are you feeling right now?"
					autoComplete="off"
					rows={2}
					disabled={loading}
				/>
				<button type="submit" className="primary" disabled={!canSend}>
					{loading ? <span className="sending">...</span> : <FaPaperPlane />}
				</button>
			</form>

			{error && (
				<div className="companion-error" role="alert">
					<FaRegSmileBeam />
					<span>{error}</span>
				</div>
			)}

			<footer className="companion-footer">
				<p>One chat, one step forward. I will remember today’s insight for you.</p>
			</footer>
		</div>
	)
}
