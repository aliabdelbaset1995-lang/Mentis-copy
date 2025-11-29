import { useMemo, useState } from 'react'
import { FaClipboardList, FaPaperPlane, FaRedoAlt, FaStethoscope, FaUserAlt } from 'react-icons/fa'

export default function DoctorFollowUpPanel({
	patients = [],
	loading = false,
	error = '',
	onRefresh,
	onAddNote
}) {
	const [noteDrafts, setNoteDrafts] = useState({})
	const [submitting, setSubmitting] = useState({})
	const [noteErrors, setNoteErrors] = useState({})

	const hasPatients = patients.length > 0

	const sortedPatients = useMemo(() => {
		return [...patients].sort((a, b) => {
			const latestA = a.followUps?.[a.followUps.length - 1]?.createdAt || 0
			const latestB = b.followUps?.[b.followUps.length - 1]?.createdAt || 0
			return latestB - latestA
		})
	}, [patients])

	async function handleSubmit(patientEmail, followUpId) {
		const content = (noteDrafts[followUpId] || '').trim()
		if (!content || !onAddNote) return
		setSubmitting(prev => ({ ...prev, [followUpId]: true }))
		setNoteErrors(prev => ({ ...prev, [followUpId]: '' }))
		try {
			await onAddNote(patientEmail, followUpId, content)
			setNoteDrafts(prev => ({ ...prev, [followUpId]: '' }))
		} catch (err) {
			setNoteErrors(prev => ({
				...prev,
				[followUpId]: err?.message || 'Failed to send note.'
			}))
		} finally {
			setSubmitting(prev => ({ ...prev, [followUpId]: false }))
		}
	}

	return (
		<section id="follow-up" className="follow-up-section fade-in">
			<header className="follow-up-header">
				<div>
					<h3>
						<FaClipboardList /> Follow-up briefs
					</h3>
					<p>Review patient summaries sent by the Empathic Companion.</p>
				</div>
				<button
					type="button"
					className="refresh-btn"
					onClick={onRefresh}
					disabled={loading}
				>
					{loading ? (
						<span>Refreshing…</span>
					) : (
						<>
							<FaRedoAlt /> Refresh
						</>
					)}
				</button>
			</header>

			{error && <div className="follow-up-error">{error}</div>}

			{!hasPatients && !loading && !error && (
				<div className="follow-up-empty">
					<p>No follow-up summaries yet. Ask your patients to share their sessions.</p>
				</div>
			)}

			<div className="follow-up-grid">
				{sortedPatients.map(patient => (
					<article key={patient.email} className="follow-up-card">
						<header className="follow-up-card-header">
							<div>
								<strong><FaUserAlt /> {patient.username}</strong>
								<p>{patient.email}</p>
							</div>
							{patient.assessment?.percentage != null && (
								<span className="assessment-pill">
									Assessment: {patient.assessment.percentage}%
								</span>
							)}
						</header>

						{(patient.followUps || []).length === 0 ? (
							<p className="follow-up-card-empty">
								No shared sessions yet.
							</p>
						) : (
							(patient.followUps || [])
								.slice()
								.sort((a, b) => b.createdAt - a.createdAt)
								.map(entry => (
									<div key={entry.id} className="follow-up-item">
										<div className="follow-up-item-meta">
											<span>
												<FaStethoscope /> {new Date(entry.createdAt).toLocaleString()}
											</span>
											<span className="improvement-pill">
												Improvement: {entry.improvementPercentage ?? '—'}%
											</span>
										</div>
										<p className="follow-up-summary">{entry.summary}</p>
										{entry.keyThemes?.length > 0 && (
											<ul className="follow-up-list">
												{entry.keyThemes.map((theme, index) => (
													<li key={`${entry.id}-theme-${index}`}>{theme}</li>
												))}
											</ul>
										)}
										{entry.riskSignals?.length > 0 && (
											<div className="risk-chip">
												Risk alerts: {entry.riskSignals.join(', ')}
											</div>
										)}
										{entry.doctorNotes?.length > 0 && (
											<div className="doctor-notes">
												<strong>Shared notes</strong>
												<ul>
													{entry.doctorNotes
														.slice()
														.sort((a, b) => b.createdAt - a.createdAt)
														.map(note => (
															<li key={note.id}>
																<p>{note.note}</p>
																<small>
																	by {note.doctorName || 'Doctor'} — {new Date(note.createdAt).toLocaleString()}
																</small>
															</li>
														))}
												</ul>
											</div>
										)}
										{onAddNote && (
											<div className="doctor-note-form">
												<textarea
													value={noteDrafts[entry.id] || ''}
													onChange={(event) => {
														const { value } = event.target
														setNoteDrafts(prev => ({ ...prev, [entry.id]: value }))
													}}
													placeholder="Add a short note for your patient…"
													rows={2}
												/>
												<button
													type="button"
													className="primary"
													onClick={() => handleSubmit(patient.email, entry.id)}
													disabled={submitting[entry.id] || !(noteDrafts[entry.id] || '').trim()}
												>
													{submitting[entry.id] ? 'Sending…' : (
														<>
															<FaPaperPlane /> Share note
														</>
													)}
												</button>
												{noteErrors[entry.id] && (
													<p className="note-error">{noteErrors[entry.id]}</p>
												)}
											</div>
										)}
									</div>
								))
						)}
					</article>
				))}
			</div>
		</section>
	)
}

