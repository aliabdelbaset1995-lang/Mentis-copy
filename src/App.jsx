import { useState, useEffect, useCallback } from 'react'
import Background from './components/Background.jsx'
import AuthCard from './components/AuthCard.jsx'
import Home from './components/Home.jsx'
import RoleSelector from './components/RoleSelector.jsx'
import AssessmentFlow from './components/AssessmentFlow.jsx'
import CompanionPage from './pages/CompanionPage.jsx'
import DoctorFollowUpPage from './pages/DoctorFollowUpPage.jsx'
import InactivityDetector from './components/InactivityDetector.jsx'
import DoctorProfileForm from './components/DoctorProfileForm.jsx'

const resolvedHost = typeof window !== 'undefined'
	? `${window.location.protocol}//${window.location.hostname}:4343`
	: 'http://localhost:4343'
const API_BASE = import.meta.env.VITE_API_BASE || resolvedHost

export default function App() {
	const [user, setUser] = useState(null)
	const [showAssessmentFlow, setShowAssessmentFlow] = useState(false)
	const [doctors, setDoctors] = useState([])
	const [doctorsLoading, setDoctorsLoading] = useState(false)
	const [doctorsError, setDoctorsError] = useState('')
	const [activeView, setActiveView] = useState('home')
	const [doctorFollowUps, setDoctorFollowUps] = useState([])
	const [doctorFollowUpsLoading, setDoctorFollowUpsLoading] = useState(false)
	const [doctorFollowUpsError, setDoctorFollowUpsError] = useState('')

	useEffect(() => {
		checkSession()
	}, [])

	useEffect(() => {
		if (!user) {
			setShowAssessmentFlow(false)
			setActiveView('home')
			return
		}
		if (user.role === 'patient' && !user.assessmentCompleted) {
			setShowAssessmentFlow(true)
			setActiveView('home')
			if (!doctors.length) {
				loadDoctors()
			}
		} else {
			setShowAssessmentFlow(false)
			setActiveView('home')
		}
	}, [user])

	const loadDoctorFollowUps = useCallback(async () => {
		try {
			setDoctorFollowUpsLoading(true)
			setDoctorFollowUpsError('')
			const response = await fetch(`${API_BASE}/doctor/followups`, {
				credentials: 'include'
			})
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(payload?.error || 'Failed to load follow-ups.')
			}
			const payload = await response.json()
			setDoctorFollowUps(payload?.patients || [])
		} catch (err) {
			console.error('Failed to load doctor follow-ups:', err)
			setDoctorFollowUps([])
			setDoctorFollowUpsError(err?.message || 'Unable to load follow-up records.')
		} finally {
			setDoctorFollowUpsLoading(false)
		}
	}, [])

	const handleDoctorNoteSubmit = useCallback(async (patientEmail, followUpId, note) => {
		const response = await fetch(`${API_BASE}/doctor/followups/${encodeURIComponent(patientEmail)}/notes`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ followUpId, note })
		})
		const payload = await response.json().catch(() => ({}))
		if (!response.ok) {
			throw new Error(payload?.error || 'Failed to save note.')
		}
		setDoctorFollowUps(prev => prev.map(patient => {
			if (patient.email !== patientEmail) return patient
			const updatedFollowUps = (patient.followUps || []).map(entry => (
				entry.id === followUpId ? payload.followUp : entry
			))
			return { ...patient, followUps: updatedFollowUps }
		}))
		return payload.followUp
	}, [])

	useEffect(() => {
		if (user?.role === 'doctor') {
			loadDoctorFollowUps()
		} else {
			setDoctorFollowUps([])
		}
	}, [user, loadDoctorFollowUps])

	const handleOpenCompanion = useCallback(() => {
		setActiveView('companion')
	}, [])

	const handleOpenDoctorFollowUps = useCallback(() => {
		setActiveView('doctor-followups')
	}, [])

	const handleBackHome = useCallback(() => {
		setActiveView('home')
	}, [])

	async function checkSession() {
		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 5000)

			const response = await fetch(`${API_BASE}/session`, {
				credentials: 'include',
				signal: controller.signal
			})
			clearTimeout(timeoutId)

			if (response.ok) {
				const data = await response.json()
				if (data.user) {
					setUser(data.user)
				}
			} else if (response.status === 401) {
				// 401 is expected when no session exists - not an error
				setUser(null)
			}
		} catch (err) {
			// Only log actual errors, not expected aborts or network issues
			if (err.name !== 'AbortError') {
				console.error('Session check failed:', err)
			}
			// Don't set user to null on abort - might just be a timeout
		}
	}

	async function handleRoleSelect(role, retryCount = 0) {
		const response = await fetch(`${API_BASE}/user/role`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ role })
		})

		const payload = await response.json().catch(() => ({}))
		if (!response.ok) {
			// If unauthorized and we haven't retried yet, wait a bit and retry once
			// This handles cases where session cookie isn't ready yet
			if (response.status === 401 && retryCount === 0) {
				await new Promise(resolve => setTimeout(resolve, 500))
				return handleRoleSelect(role, 1)
			}
			throw new Error(payload?.error || 'Failed to update role.')
		}

		if (payload?.user) {
			setUser(payload.user)
			if (payload.user.role === 'patient') {
				// Load doctors for all patients - they can choose "no doctor" in assessment
				loadDoctors()
			}
		} else {
			setUser(prev => prev ? { ...prev, role } : prev)
			if (role === 'patient') {
				loadDoctors()
			}
		}
	}

	async function handleAssessmentSubmit({ answers, language, summary, doctorId, noDoctor }) {
		const response = await fetch(`${API_BASE}/assessment`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ answers, language, summary, doctorId, noDoctor })
		})

		const payload = await response.json().catch(() => ({}))
		if (!response.ok) {
			throw new Error(payload?.error || 'Failed to save assessment.')
		}

		if (payload?.user) {
			setUser(payload.user)
		}

		return payload?.assessment
	}

	function handleAssessmentComplete() {
		setShowAssessmentFlow(false)
		setActiveView('home')
		checkSession()
	}

	async function loadDoctors() {
		try {
			setDoctorsLoading(true)
			setDoctorsError('')
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
			setDoctorsError('Unable to load doctors. Please try again later.')
			setDoctors([])
		} finally {
			setDoctorsLoading(false)
		}
	}

	async function handleDoctorDescriptionSubmit(description) {
		const response = await fetch(`${API_BASE}/doctor/description`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ description })
		})

		const payload = await response.json().catch(() => ({}))
		if (!response.ok) {
			throw new Error(payload?.error || 'Failed to save description.')
		}

		if (payload?.user) {
			setUser(payload.user)
		} else {
			checkSession()
		}
	}

	function handleDoctorDescriptionSkip() {
		// Allow skipping - just refresh session to continue
		checkSession()
	}

	function handleLogout() {
		fetch(`${API_BASE}/logout`, {
			method: 'POST',
			credentials: 'include'
		}).then(() => {
			setUser(null)
			setDoctorFollowUps([])
			setDoctorFollowUpsError('')
			setActiveView('home')
			window.location.href = '/'
		})
	}

	return (
		<div className="app-root">
			<InactivityDetector />
			<Background />
			{user ? (
				user.role == null ? (
					<RoleSelector onSelect={handleRoleSelect} />
				) : user.role === 'doctor' && !user.doctorDescription ? (
					<DoctorProfileForm
						onSubmit={handleDoctorDescriptionSubmit}
						onCancel={handleDoctorDescriptionSkip}
					/>
				) : showAssessmentFlow ? (
					<AssessmentFlow
						onSubmit={handleAssessmentSubmit}
						onComplete={handleAssessmentComplete}
						doctors={doctors}
						doctorsLoading={doctorsLoading}
						doctorsError={doctorsError}
					/>
				) : activeView === 'companion' ? (
					<CompanionPage user={user} onBack={handleBackHome} />
				) : activeView === 'doctor-followups' && user.role === 'doctor' ? (
					<DoctorFollowUpPage
						patients={doctorFollowUps}
						loading={doctorFollowUpsLoading}
						error={doctorFollowUpsError}
						onRefresh={loadDoctorFollowUps}
						onAddNote={handleDoctorNoteSubmit}
						onBack={handleBackHome}
					/>
				) : (
					<Home
						user={user}
						onLogout={handleLogout}
						onOpenCompanion={user?.role === 'patient' ? handleOpenCompanion : undefined}
						onOpenDoctorFollowUps={user?.role === 'doctor' ? handleOpenDoctorFollowUps : undefined}
					/>
				)
			) : (
				<main className="app-main">
					<div className="brand fade-in">
						<h1 className="brand-title">Welcome to Mentis Anchora</h1>
					</div>
					<AuthCard onLogin={(userData) => {
						// If user data is provided from auth response, use it directly
						// Otherwise, check session (for cases where data wasn't returned)
						if (userData) {
							setUser(userData)
						} else {
							checkSession()
						}
					}} />
					<footer className="app-footer">
						<nav className="nav-bar">
							<button className="nav-item active" aria-label="Home">⌂</button>
							<button className="nav-item" aria-label="Secure">🔒</button>
							<button className="nav-item" aria-label="More">•••</button>
						</nav>
					</footer>
				</main>
			)}
		</div>
	)
}


