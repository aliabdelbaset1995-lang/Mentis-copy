import { useMemo, useState } from 'react'
import { FaBrain, FaEye, FaBullseye, FaChartLine, FaBookMedical, FaHeart, FaUsers, FaLeaf, FaBars, FaTimes, FaEnvelope, FaPhoneAlt, FaHome, FaInfoCircle, FaStethoscope, FaBook, FaRobot, FaSignOutAlt, FaClipboardList } from 'react-icons/fa'

export default function Home({
	user,
	onLogout,
	onOpenCompanion,
	onOpenDoctorFollowUps
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

	function toggleMobileMenu() {
		setMobileMenuOpen((prev) => !prev)
	}

	function closeMobileMenu() {
		setMobileMenuOpen(false)
	}

	const navLinks = useMemo(() => {
		const base = [
			{ type: 'anchor', href: '#home', label: 'Home', icon: FaHome },
			{ type: 'anchor', href: '#about', label: 'About', icon: FaInfoCircle },
			{ type: 'anchor', href: '#treatment', label: 'Treatment', icon: FaStethoscope },
			{ type: 'anchor', href: '#resources', label: 'Resources', icon: FaBook }
		]
		if (user?.role === 'patient' && typeof onOpenCompanion === 'function') {
			base.push({ type: 'anchor', href: '#companion', label: 'AI Chat', onClick: onOpenCompanion, icon: FaRobot })
		}
		if (user?.role === 'doctor' && typeof onOpenDoctorFollowUps === 'function') {
			base.push({ type: 'anchor', href: '#follow-up', label: 'Follow-up', onClick: onOpenDoctorFollowUps, icon: FaClipboardList })
		}
		return base
	}, [user?.role, onOpenCompanion, onOpenDoctorFollowUps])

	return (
		<div className="home-page">
			<header className="home-header">
				<div className="header-container fade-in">
					<div className="logo">
						<h1>Mentis Anchora</h1>
					</div>
					<nav className="nav desktop-nav">
						{navLinks.map(link => {
							const Icon = link.icon
							return (
								<a 
									key={link.href} 
									href={link.href} 
									className="link-button"
									onClick={(e) => {
										if (link.onClick) {
											e.preventDefault()
											closeMobileMenu()
											link.onClick()
										}
									}}
								>
									{Icon && <Icon style={{ marginRight: '6px' }} />}
									{link.label}
								</a>
							)
						})}
						<button className="logout-btn" onClick={onLogout} type="button">
							<FaSignOutAlt style={{ marginRight: '6px' }} />
							Sign Out
						</button>
					</nav>
					<button
						className="mobile-menu-toggle"
						onClick={toggleMobileMenu}
						aria-label="Toggle menu"
						aria-expanded={mobileMenuOpen}
						type="button"
					>
						{mobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
					</button>
				</div>
				<nav
					className={`nav mobile-nav ${mobileMenuOpen ? 'open' : ''}`}
					aria-hidden={!mobileMenuOpen}
				>
					{navLinks.map(link => {
						const Icon = link.icon
						return (
							<a
								key={`mobile-${link.href}`}
								href={link.href}
								onClick={(e) => {
									if (link.onClick) {
										e.preventDefault()
									}
									closeMobileMenu()
									link.onClick?.()
								}}
								tabIndex={mobileMenuOpen ? 0 : -1}
							>
								{Icon && <Icon style={{ marginRight: '8px' }} />}
								{link.label}
							</a>
						)
					})}
					<button
						className="logout-btn"
						onClick={() => {
							closeMobileMenu()
							onLogout()
						}}
						type="button"
						tabIndex={mobileMenuOpen ? 0 : -1}
					>
						<FaSignOutAlt style={{ marginRight: '8px' }} />
						Sign Out
					</button>
				</nav>
			</header>

			<section className="hero" id="home">
				<div className="hero-container">
					<div className="hero-content">
						<h2 className="hero-title">Overcome Mentis Anchora</h2>
						<p className="hero-subtitle">Mentis Anchora - Regain Your Focus</p>
						<p className="hero-text">
							Mentis Anchora causes distraction and inability to focus. Our evidence-based treatment platform helps you overcome
							excessive daydreaming and regain control of your attention and concentration.
						</p>
						<div className="hero-stats">
							<div className="stat">
								<div className="stat-value">85%</div>
								<div className="stat-label">Success Rate</div>
							</div>
							<div className="stat">
								<div className="stat-value">10K+</div>
								<div className="stat-label">Patients Treated</div>
							</div>
							<div className="stat">
								<div className="stat-value">24/7</div>
								<div className="stat-label">Support</div>
							</div>
						</div>
					</div>
					<div className="hero-image-wrapper">
						<img
							src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&q=80&auto=format&fit=crop"
							alt="Focus and concentration"
							loading="lazy"
							decoding="async"
							onError={(event) => {
								event.currentTarget.src = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80&auto=format&fit=crop'
							}}
						/>
					</div>
				</div>
			</section>

			<section className="section about-section" id="about">
				<div className="container">
					<h3 className="section-title">Understanding Mentis Anchora</h3>
					<p className="section-subtitle">
						Mentis Anchora refers to excessive daydreaming that leads to distraction and inability to concentrate. Our
							comprehensive treatment approach addresses the root causes.
					</p>
					<div className="cards-grid">
						<div className="card">
							<div className="card-icon">
								<FaBrain size={32} />
							</div>
							<h4>Cognitive Behavioral Therapy</h4>
							<p>Structured CBT sessions help identify and modify thought patterns that contribute to excessive daydreaming and lack of focus.</p>
						</div>
						<div className="card">
							<div className="card-icon">
								<FaBullseye size={32} />
							</div>
							<h4>Focus Training</h4>
							<p>Evidence-based techniques to improve attention span and concentration, helping you stay present and engaged in daily activities.</p>
						</div>
						<div className="card">
							<div className="card-icon">
								<FaChartLine size={32} />
							</div>
							<h4>Progress Tracking</h4>
							<p>Monitor your improvement with detailed analytics and personalized reports showing your journey toward better focus and concentration.</p>
						</div>
					</div>
				</div>
			</section>

			<section className="section symptoms-section" id="symptoms">
				<div className="container">
					<h3 className="section-title">Recognizing the Symptoms</h3>
					<div className="symptoms-grid">
						<div className="symptom-item">
							<FaEye className="symptom-icon" />
							<h4>Excessive Daydreaming</h4>
							<p>Frequent, intrusive daydreams that interfere with daily tasks</p>
						</div>
						<div className="symptom-item">
							<FaBrain className="symptom-icon" />
							<h4>Difficulty Concentrating</h4>
							<p>Struggling to maintain focus on work, studies, or conversations</p>
						</div>
						<div className="symptom-item">
							<FaBookMedical className="symptom-icon" />
							<h4>Academic/Work Impact</h4>
							<p>Declining performance due to distraction and lack of attention</p>
						</div>
						<div className="symptom-item">
							<FaHeart className="symptom-icon" />
							<h4>Mental Fatigue</h4>
							<p>Feeling mentally exhausted from constant mental wandering</p>
						</div>
					</div>
				</div>
			</section>

			<section className="section treatment-section" id="treatment">
				<div className="container">
					<h3 className="section-title">Our Treatment Approach</h3>
					<div className="treatment-grid">
						<div className="treatment-card">
							<FaLeaf className="treatment-icon" />
							<h4>Mindfulness Training</h4>
							<p>Learn to observe your thoughts without judgment, bringing your attention back to the present moment.</p>
						</div>
						<div className="treatment-card">
							<FaUsers className="treatment-icon" />
							<h4>Support Groups</h4>
							<p>Connect with others on a similar journey and share experiences in a supportive environment.</p>
						</div>
						<div className="treatment-card">
							<FaBullseye className="treatment-icon" />
							<h4>Personalized Plans</h4>
							<p>Receive guidance and strategies tailored to your unique challenges and goals for lasting change.</p>
						</div>
					</div>
				</div>
			</section>

			<section className="section resources-section" id="resources">
				<div className="container">
					<h3 className="section-title">Explore Our Resources</h3>
					<div className="resources-grid">
						<div className="resource-card">
							<img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80" alt="Therapy" loading="lazy" decoding="async" />
							<div className="resource-overlay">
								<h4>Professional Therapy</h4>
								<p>One-on-one sessions with licensed therapists</p>
							</div>
						</div>
						<div className="resource-card">
							<img
								src="https://images.unsplash.com/photo-1519120126473-6010e01bab228?w=600&q=80&auto=format&fit=crop"
								alt="Mindfulness"
								loading="lazy"
								decoding="async"
								onError={(event) => {
									event.currentTarget.src = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80&auto=format&fit=crop'
								}}
							/>
							<div className="resource-overlay">
								<h4>Mindfulness Practices</h4>
								<p>Techniques to stay present and reduce stress</p>
							</div>
						</div>
						<div className="resource-card">
							<img src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80" alt="Support" loading="lazy" decoding="async" />
							<div className="resource-overlay">
								<h4>Support Groups</h4>
								<p>Connect with others on the same journey</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			<footer className="footer">
				<div className="container">
					<div className="footer-content">
						<div className="footer-section">
							<h4>Mentis Anchora</h4>
							<p>Mentis Anchora Treatment</p>
							<p>Overcoming distraction, restoring focus</p>
						</div>
						<div className="footer-section">
							<h4>Quick Links</h4>
							{navLinks.map(link => (
								<a key={`footer-${link.href}`} href={link.href}>{link.label}</a>
							))}
						</div>
						<div className="footer-section footer-contact">
							<h4>Contact</h4>
							<div className="footer-contact-list">
								<a className="footer-contact-item" href="mailto:mentis_anchora@gmail.com">
									<span className="contact-icon"><FaEnvelope size={16} /></span>
									<span>mentis_anchora@gmail.com</span>
								</a>
								<a className="footer-contact-item" href="tel:+201022858957">
									<span className="contact-icon"><FaPhoneAlt size={16} /></span>
									<span>+20 102 285 8957</span>
								</a>
							</div>
						</div>
					</div>
					<div className="footer-bottom">
						<p>&copy; 2025 Mentis Anchora. All rights reserved.</p>
					</div>
				</div>
			</footer>
		</div>
	)
}
