import { useState } from 'react'

const ROLE_OPTIONS = [
	{
		value: 'doctor',
		title: 'I am a doctor or specialist',
		description: 'Access the dashboard to guide patients, monitor assessments, and share treatment plans.'
	},
	{
		value: 'patient',
		title: 'I am seeking support',
		description: 'Answer a short assessment so we can personalise your focus journey step by step.'
	}
]

export default function RoleSelector({ onSelect }) {
	const [pendingRole, setPendingRole] = useState(null)
	const [error, setError] = useState('')

	async function handleSelect(role) {
		if (pendingRole) return
		setError('')
		try {
			setPendingRole(role)
			await onSelect(role)
		} catch (err) {
			setPendingRole(null)
			setError(err?.message || 'Something went wrong. Please try again.')
		}
	}

	return (
		<section className="role-selector">
			<div className="role-card fade-in">
				<header className="role-card-header">
					<h2>Welcome! How would you like to continue?</h2>
					<p>Select the role that best matches you today so we can tailor the experience.</p>
				</header>
				<div className="role-options">
					{ROLE_OPTIONS.map(option => {
						const isActive = pendingRole === option.value
						return (
							<button
								key={option.value}
								type="button"
								className={`role-option ${option.value} ${isActive ? 'loading' : ''}`}
								onClick={() => handleSelect(option.value)}
								disabled={!!pendingRole}
							>
								<span className="role-title">{option.title}</span>
								<span className="role-description">{option.description}</span>
								{isActive && <span className="role-spinner" aria-hidden="true" />}
							</button>
						)
					})}
				</div>
				{error && <p className="role-error">{error}</p>}
			</div>
		</section>
	)
}
