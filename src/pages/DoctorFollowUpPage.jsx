import { FaArrowLeft } from 'react-icons/fa'
import DoctorFollowUpPanel from '../components/DoctorFollowUpPanel.jsx'

export default function DoctorFollowUpPage({
	patients,
	loading,
	error,
	onRefresh,
	onAddNote,
	onBack
}) {
	return (
		<main className="companion-page doctor-followup-page">
			<header className="companion-page-header doctor-followup-header">
				<button type="button" className="back-button" onClick={onBack}>
					<FaArrowLeft />
					<span>Back to home</span>
				</button>
				<div className="companion-page-meta doctor-followup-meta">
					<h1>Patient Follow-ups</h1>
					<p>Review AI summaries, track improvement, and send notes to your patients.</p>
				</div>
			</header>

			<section className="companion-page-body doctor-followup-body">
				<DoctorFollowUpPanel
					patients={patients}
					loading={loading}
					error={error}
					onRefresh={onRefresh}
					onAddNote={onAddNote}
				/>
			</section>
		</main>
	)
}

