import { useState } from 'react'

export default function DoctorProfileForm({ onSubmit, onCancel }) {
	const [description, setDescription] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState('')

	async function handleSubmit(event) {
		event.preventDefault()
		if (!description.trim()) {
			setError('Please enter a description about yourself.')
			return
		}

		setError('')
		setSubmitting(true)
		try {
			await onSubmit(description.trim())
		} catch (err) {
			setError(err?.message || 'Failed to save description. Please try again.')
			setSubmitting(false)
		}
	}

	return (
		<section className="assessment-wrapper fade-in">
			<div className="assessment-card">
				<div className="assessment-step">
					<header className="assessment-heading">
						<span className="assessment-progress">Doctor Profile</span>
						<h3 className="assessment-question">Tell us about yourself</h3>
					</header>
					<form onSubmit={handleSubmit}>
						<div className="doctor-description-input-wrapper">
							<textarea
								id="doctor-description"
								className="doctor-description-input"
								value={description}
								onChange={(e) => {
									setDescription(e.target.value)
									setError('')
								}}
								placeholder="Example: I specialize in cognitive behavioral therapy with 10+ years of experience helping patients manage daydreaming and focus issues. My approach combines evidence-based techniques with personalized care..."
								rows={8}
								disabled={submitting}
								required
							/>
						</div>
						{error && <p className="assessment-error">{error}</p>}
						<footer className="assessment-actions">
							<button
								type="button"
								className="ghost"
								onClick={onCancel}
								disabled={submitting}
							>
								Skip for now
							</button>
							<button
								type="submit"
								className="primary"
								disabled={submitting || !description.trim()}
							>
								{submitting ? 'Saving...' : 'Save & continue'}
							</button>
						</footer>
					</form>
				</div>
			</div>
		</section>
	)
}

