import { useMemo, useState } from 'react'

const LANGUAGES = [
	{ code: 'en', label: 'English', flag: '🇬🇧' },
	{ code: 'ar', label: 'العربية', flag: '🇪🇬' }
]

const QUESTIONS = [
	{
		id: 1,
		prompt: {
			en: 'When you start daydreaming, do you feel like you can stop easily, or does it pull you in automatically?',
			ar: 'لما بتبدأ تسرح أو تتخيل، بتحس إنك بتقدر توقف بسهولة ولا بتحس إنك بتتسحب للعالم ده غصب عنك؟'
		},
		options: {
			en: ['I can stop easily', 'Sometimes', "It’s hard to stop", "I can’t stop at all"],
			ar: ['أقدر أوقف بسهولة', 'أحيانًا', 'صعب جدًا أوقف', 'مش بقدر أوقف خالص']
		}
	},
	{
		id: 2,
		prompt: {
			en: 'On an average day, how much time do you think you spend daydreaming or lost in thought?',
			ar: 'في اليوم، تقريبًا بتقضي قد إيه من وقتك في السرحان أو أحلام اليقظة؟'
		},
		options: {
			en: ['Less than an hour', '1–3 hours', 'More than 3 hours', 'It feels like a lot'],
			ar: ['أقل من ساعة', 'من ساعة لـ3 ساعات', 'أكتر من 3 ساعات', 'مش بعدّ بس بحسها كتير جدًا']
		}
	},
	{
		id: 3,
		prompt: {
			en: 'What are your daydreams usually about?',
			ar: 'أحلام اليقظة عندك بتكون عن إيه في الغالب؟'
		},
		options: {
			en: ['Things I wish would happen', 'Memories or past moments', 'Completely imaginary or fantasy worlds', 'It changes with my mood'],
			ar: ['حاجات بتمنى تحصل فعلًا', 'ذكريات أو مواقف قديمة', 'عوالم خيالية ملهاش علاقة بالواقع', 'بتتغير على حسب حالتي']
		}
	},
	{
		id: 4,
		prompt: {
			en: 'After you finish daydreaming, how do you usually feel?',
			ar: 'بعد ما تخلص سرحان، بتحس بإيه عادةً؟'
		},
		options: {
			en: ['Relaxed or calm', 'Regretful or down', 'Tired or emotionally drained', 'Nothing in particular'],
			ar: ['راحة وهدوء', 'ندم أو ضيق', 'تعب أو استنزاف نفسي', 'ولا حاجة معينة']
		}
	},
	{
		id: 5,
		prompt: {
			en: 'Do you think your daydreaming affects your study, work, or daily tasks?',
			ar: 'شايف إن السرحان مأثر على دراستك أو شغلك؟'
		},
		options: {
			en: ['Not at all', 'A little bit', 'Quite a lot', 'Very much — I struggle to focus'],
			ar: ['لأ خالص', 'شوية بسيط', 'كتير', 'جداً ومش عارف أركز']
		}
	},
	{
		id: 6,
		prompt: {
			en: 'Do people around you notice that you drift off or seem distracted often?',
			ar: 'الناس اللي حواليك بيلاحظوا إنك بتسرح كتير أو مش مركز؟'
		},
		options: {
			en: ['No', 'Sometimes', 'Often', 'Yes, they even complain'],
			ar: ['لأ', 'أحيانًا', 'كتير', 'آه وبيشتكوا بسبب ده']
		}
	},
	{
		id: 7,
		prompt: {
			en: 'When something upsets or frustrates you, do you use daydreaming as a way to escape?',
			ar: 'لما حاجة بتضايقك أو تحبطك، بتهرب للسرحان؟'
		},
		options: {
			en: ['Not really', 'Occasionally', 'Often', 'Almost always'],
			ar: ['لأ خالص', 'أحيانًا', 'كتير', 'دايمًا تقريبًا']
		}
	},
	{
		id: 8,
		prompt: {
			en: 'When you daydream, does it ever feel like you’re really there inside that imagined world?',
			ar: 'لما بتسرح، بتحس إنك عايش جوه العالم اللي بتتخيله؟'
		},
		options: {
			en: ['No, it’s just random thoughts', 'Sometimes, but I know it’s not real', 'Often — it feels vivid and real', 'Almost always — it feels like my world'],
			ar: ['لأ مجرد أفكار', 'أحيانًا بس عارف إنه مش حقيقي', 'كتير بحسه واقعي', 'دايمًا بحسه عالمي الحقيقي']
		}
	},
	{
		id: 9,
		prompt: {
			en: 'Do you feel daydreaming affects your relationships or makes you spend less time with people?',
			ar: 'حاسس إن السرحان بيأثر على علاقاتك أو بيخليك تبعد عن الناس؟'
		},
		options: {
			en: ['Not at all', 'A little', 'Yes, I’ve started to distance myself', 'Yes, I prefer daydreaming over people'],
			ar: ['لأ', 'شوية بسيط', 'آه بدأت أبعد', 'بقيت أفضل السرحان عن الناس']
		}
	},
	{
		id: 10,
		prompt: {
			en: 'Do you find yourself getting upset or irritated more easily lately?',
			ar: 'حاسس إنك سريع الزعل أو الغضب الفترة دي؟'
		},
		options: {
			en: ['No', 'Occasionally', 'Yes, more than before', "Very often, and I’m not sure why"],
			ar: ['لأ', 'أحيانًا', 'آه أكتر من الأول', 'كتير ومش فاهم السبب']
		}
	}
]

const TOTAL_POINTS = QUESTIONS.length * 4

const LEVEL_LABELS = {
	en: { mild: 'Mild', moderate: 'Moderate', high: 'High', severe: 'Severe' },
	ar: { mild: 'خفيف', moderate: 'متوسط', high: 'مرتفع', severe: 'حاد' }
}

function classifyLevel(percentage) {
	if (percentage <= 25) return 'mild'
	if (percentage <= 50) return 'moderate'
	if (percentage <= 75) return 'high'
	return 'severe'
}

function computeScore(answers) {
	const score = answers.reduce((sum, current) => sum + current, 0)
	const percentage = Math.round((score / TOTAL_POINTS) * 100)
	const level = classifyLevel(percentage)
	return { score, percentage, level }
}

function generateSummary({ language, score, percentage, level }) {
	const levelLabels = LEVEL_LABELS[language][level]

	if (language === 'ar') {
		return `درجتك الإجمالية ${score} من ${TOTAL_POINTS} (${percentage}٪)، وده يعني إن مستوى أحلام اليقظة عندك ${levelLabels}.`
	}

	return `Your total score is ${score} out of ${TOTAL_POINTS} (${percentage}%). That means your daydreaming level is ${levelLabels}.`
}

export default function AssessmentFlow({ onSubmit, onComplete, doctors = [], doctorsLoading = false, doctorsError = '' }) {
	const [language, setLanguage] = useState('en')
	const [currentIndex, setCurrentIndex] = useState(0)
	const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null))
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState('')
	const [finished, setFinished] = useState(false)
	const [result, setResult] = useState(null)
	const [wantsDoctor, setWantsDoctor] = useState(false)
	const [selectedDoctor, setSelectedDoctor] = useState('')
	const [savingDoctor, setSavingDoctor] = useState(false)

	const currentQuestion = QUESTIONS[currentIndex]
	const selectedValue = answers[currentIndex]

	const levelLabels = LEVEL_LABELS[language]
	const chosenDoctor = useMemo(
		() => doctors.find(option => option.id === selectedDoctor) || null,
		[selectedDoctor, doctors]
	)

	const progressText = useMemo(() => {
		const current = currentIndex + 1
		const total = QUESTIONS.length
		return language === 'ar'
			? `السؤال ${current} من ${total}`
			: `Question ${current} of ${total}`
	}, [currentIndex, language])

	function handleSelectOption(value) {
		if (submitting) return
		setAnswers(prev => {
			const next = [...prev]
			next[currentIndex] = value
			return next
		})
	}

	function goNext() {
		if (currentIndex < QUESTIONS.length - 1) {
			setCurrentIndex(currentIndex + 1)
		}
	}

	function goPrev() {
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1)
		}
	}

	async function handleSubmit() {
		if (answers[currentIndex] == null) {
			setError(language === 'ar' ? 'من فضلك اختر إجابة قبل المتابعة.' : 'Please choose an answer to continue.')
			return
		}

		const hasAllAnswers = answers.every(answer => answer != null)
		if (!hasAllAnswers) {
			setError(language === 'ar' ? 'من فضلك أجب عن جميع الأسئلة.' : 'Please answer every question to continue.')
			return
		}

		setError('')
		setSubmitting(true)

		const score = computeScore(answers)
		const summary = {
			language,
			score: score.score,
			percentage: score.percentage,
			level: score.level,
			summary: generateSummary({ language, score: score.score, percentage: score.percentage, level: score.level })
		}

		setResult(summary)
		setSubmitting(false)
		setFinished(true)
	}

	async function handleFinalise() {
		if (!result) return

		setError('')
		setSavingDoctor(true)
		try {
			await onSubmit({
				answers,
				language: result.language,
				summary: result.summary,
				doctorId: null, // Doctor selection happens in chat interface, not during assessment
				noDoctor: !wantsDoctor
			})
			onComplete()
		} catch (err) {
			console.error('Assessment submit error:', err)
			setError(err?.message || (language === 'ar' ? 'حصل خطأ أثناء حفظ الاختيار.' : 'We could not save your selection. Please try again.'))
		} finally {
			setSavingDoctor(false)
		}
	}

	const wrapperProps = {
		dir: language === 'ar' ? 'rtl' : 'ltr',
		lang: language
	}

	return (
		<section className={`assessment-wrapper ${language === 'ar' ? 'rtl' : 'ltr'}`} {...wrapperProps}>
			<div className="assessment-toolbar">
				<div className="language-switch">
					{LANGUAGES.map(option => (
						<button
							key={option.code}
							type="button"
							className={`language-option ${language === option.code ? 'active' : ''}`}
							onClick={() => setLanguage(option.code)}
							disabled={submitting}
						>
							<span className="lang-flag" aria-hidden="true">{option.flag}</span>
							<span className="lang-label">{option.label}</span>
						</button>
					))}
				</div>
			</div>

			<div className="assessment-card fade-in">
				{!finished ? (
					<div className="assessment-step">
						<header className="assessment-heading">
							<span className="assessment-progress">{progressText}</span>
							<h3 className="assessment-question">{currentQuestion.prompt[language]}</h3>
						</header>
						<div className="assessment-options">
							{currentQuestion.options[language].map((optionText, index) => {
								const value = index + 1
								const isActive = selectedValue === value
								return (
									<button
										key={optionText}
										type="button"
										className={`assessment-option ${isActive ? 'active' : ''}`}
										onClick={() => handleSelectOption(value)}
										disabled={submitting}
									>
										<span className="option-index">{value}</span>
										<span className="option-text">{optionText}</span>
									</button>
								)
							})}
						</div>
						<footer className="assessment-actions">
							<button type="button" className="ghost" onClick={goPrev} disabled={currentIndex === 0 || submitting}>
								{language === 'ar' ? 'السابق' : 'Back'}
							</button>
							{currentIndex < QUESTIONS.length - 1 ? (
								<button type="button" className="primary" onClick={goNext} disabled={selectedValue == null || submitting}>
									{language === 'ar' ? 'التالي' : 'Next'}
								</button>
							) : (
								<button type="button" className="primary" onClick={handleSubmit} disabled={selectedValue == null || submitting}>
									{submitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'عرض النتيجة' : 'See my results'}
								</button>
							)}
						</footer>
						{error && <p className="assessment-error">{error}</p>}
					</div>
				) : (
					<div className="assessment-summary">
						<h3>{language === 'ar' ? 'تلخيص التقييم' : 'Initial Level Assessment'}</h3>
						{result && (
							<div className="assessment-summary-stats">
								<div>
									<span className="summary-label">{language === 'ar' ? 'الدرجة' : 'Score'}</span>
									<strong>{result.score} / {TOTAL_POINTS}</strong>
								</div>
								<div>
									<span className="summary-label">{language === 'ar' ? 'النسبة' : 'Percentage'}</span>
									<strong>{result.percentage}%</strong>
								</div>
								<div>
									<span className="summary-label">{language === 'ar' ? 'المستوى' : 'Level'}</span>
									<strong className={`level ${result.level}`}>{levelLabels[result.level]}</strong>
								</div>
							</div>
						)}
						{result && (
							<div className="assessment-summary-body">
								<p>{result.summary}</p>
								<div className="doctor-selection">
									{doctorsLoading ? (
										<div className="doctor-loading">
											{language === 'ar' ? 'جارٍ تحميل الأطباء...' : 'Loading available specialists...'}
										</div>
									) : doctorsError ? (
										<div className="doctor-error">{doctorsError}</div>
									) : (
										<>
											<div className="doctor-checkbox-wrapper">
												<label htmlFor="doctor-checkbox" className="doctor-checkbox-label">
													<input
														type="checkbox"
														id="doctor-checkbox"
														className="doctor-checkbox"
														checked={wantsDoctor}
														onChange={(e) => {
															setWantsDoctor(e.target.checked)
															if (!e.target.checked) {
																setSelectedDoctor('')
															}
													setError('')
												}}
												disabled={savingDoctor}
													/>
													<span className="doctor-checkbox-text">
														{language === 'ar'
															? 'أريد التواصل مع طبيب'
															: 'I want to work with a doctor'}
													</span>
												</label>
											</div>
											{wantsDoctor && (
												<div className="doctor-info-notice">
													<p>{language === 'ar' 
														? 'ستتمكن من اختيار الطبيب الذي تريد مشاركة جلساتك معه من صفحة المحادثة.'
														: 'You will be able to choose which doctor to share your sessions with from the chat page.'}
													</p>
												</div>
											)}
											{!wantsDoctor && (
												<div className="no-doctor-notice">
													<p>{language === 'ar' 
														? 'ستتمكن من استخدام الرفيق المتفهم بدون مشاركة جلساتك مع طبيب. خصوصيتك محمية بالكامل.'
														: 'You will be able to use the Empathic Companion without sharing your sessions with a doctor. Your privacy is fully protected.'}
													</p>
												</div>
											)}
										</>
									)}
								</div>
								{error && <p className="assessment-error">{error}</p>}
							</div>
						)}
						<button
							type="button"
							className="primary"
							onClick={handleFinalise}
							disabled={savingDoctor || doctorsLoading}
						>
							{savingDoctor
								? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
								: (language === 'ar' ? 'حفظ ومتابعة' : 'Save & continue')}
						</button>
					</div>
				)}
			</div>
		</section>
	)
}
