import { useMemo, useState } from 'react'
import Input from './Input.jsx'
import PasswordInput from './PasswordInput.jsx'
import SocialButton from './SocialButton.jsx'

const tabs = ['Sign in', 'Create account']
const resolvedHost = typeof window !== 'undefined'
	? `${window.location.protocol}//${window.location.hostname}:4343`
	: 'http://localhost:4343'
const API_BASE = import.meta.env.VITE_API_BASE || resolvedHost

export default function AuthCard({ onLogin }) {
	const [active, setActive] = useState(0)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [username, setUsername] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const isSignup = active === 1

	const valid = useMemo(() => {
		const base = /\S+@\S+\.\S+/.test(email) && password.length >= 6
		return isSignup ? base && username.trim().length >= 2 : base
	}, [email, password, username, isSignup])

	async function submit(event) {
		event.preventDefault()
		if (!valid || busy) return

		setBusy(true)
		setError('')

		try {
			const endpoint = isSignup ? '/signup' : '/login'
			const body = isSignup
				? { email, username, password }
				: { email, password }

			const response = await fetch(`${API_BASE}${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			})

			const contentType = response.headers.get('content-type')
			const isJSON = contentType && contentType.includes('application/json')
			let payload = null
			if (isJSON) {
				try {
					payload = await response.json()
				} catch (jsonErr) {
					console.error('Failed to parse auth response JSON:', jsonErr)
				}
			}

			if (!response.ok) {
				if (payload && typeof payload === 'object' && payload.error) {
					setError(payload.error)
					return
				}
				if (typeof payload === 'string') {
					setError(payload)
					return
				}
				setError('An error occurred. Please try again.')
				return
			}

			const redirectTarget = payload && typeof payload === 'object' ? payload.redirect : null
			const userData = payload && typeof payload === 'object' ? payload.user : null
			setEmail('')
			setPassword('')
			setUsername('')
			setError('')
			// Pass user data directly to avoid race condition with session cookie
			if (onLogin) onLogin(userData)

			if (redirectTarget && typeof window !== 'undefined' && redirectTarget !== window.location.origin) {
				window.location.href = redirectTarget
			}
		} catch (err) {
			setError('Network error. Please check if the server is running.')
			console.error('Auth error:', err)
		} finally {
			setBusy(false)
		}
	}

	function handleGoogleLogin() {
		if (typeof window === 'undefined') return
		const url = new URL(`${API_BASE}/auth/google`)
		url.searchParams.set('redirect', window.location.origin)
		window.location.href = url.toString()
	}

	return (
		<section className="auth-wrap fade-in">
			<div className="auth-card">
				<div className="auth-header">
					<div className="tabs">
						{tabs.map((name, index) => {
							const isActive = active === index
							return (
								<button
									key={name}
									type="button"
									className={`tab ${isActive ? 'active' : ''}`}
									onClick={() => {
										setActive(index)
										setError('')
									}}
									aria-current={isActive}
								>
									{name}
									{isActive && <span className="tab-underline" />}
								</button>
							)
						})}
					</div>
				</div>

				<form onSubmit={submit} className="form">
					{error && <div className="error-message">{error}</div>}
					{isSignup && (
						<Input
							label="Username"
							value={username}
							onChange={setUsername}
							placeholder="Username"
							autoComplete="username"
						/>
					)}
					<Input
						label="Email address"
						type="email"
						value={email}
						onChange={setEmail}
						placeholder="email@example.com"
						autoComplete="email"
					/>
					<PasswordInput
						value={password}
						onChange={setPassword}
						autoComplete={isSignup ? 'new-password' : 'current-password'}
					/>
					<button className="cta" type="submit" disabled={!valid || busy}>
						{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Continue'}
					</button>
					{!isSignup ? (
						<p className="subtle center form-help">
							New user?{' '}
							<button
								className="link"
								type="button"
								onClick={() => {
									setActive(1)
									setError('')
								}}
							>
								Create an account
							</button>
						</p>
					) : (
						<p className="subtle center form-help">
							Already have an account?{' '}
							<button
								className="link"
								type="button"
								onClick={() => {
									setActive(0)
									setError('')
								}}
							>
								Sign in
							</button>
						</p>
					)}
					<div className="or">
						<span />
						<i>Or</i>
						<span />
					</div>
					<SocialButton provider="google" onClick={handleGoogleLogin} />
					<p className="subtle center policy">
						By continuing, you agree to our
							{' '}
						<a href="#terms">Terms</a>
						{' '}and{' '}
						<a href="#privacy">Privacy Policy</a>
					</p>
				</form>
			</div>
		</section>
	)
}