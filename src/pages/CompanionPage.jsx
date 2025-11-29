import PatientCompanion from '../components/PatientCompanion.jsx'
import { FaArrowLeft } from 'react-icons/fa'

export default function CompanionPage({ user, onBack }) {
	return (
		<main className="companion-page">
			<header className="companion-page-header">
				<button type="button" className="back-button" onClick={onBack}>
					<FaArrowLeft />
					<span>Back to home</span>
				</button>
				<div className="companion-page-meta">
					<h1>The Empathic Companion</h1>
					<p>One focused chat to turn daydreams into steady steps.</p>
				</div>
			</header>

			<section className="companion-page-body">
				<PatientCompanion user={user} />
			</section>
		</main>
	)
}
