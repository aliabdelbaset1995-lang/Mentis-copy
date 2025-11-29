export default function SocialButton({ provider = 'google', onClick }) {
	const isGoogle = provider === 'google'
	const label = isGoogle ? 'Continue with Google' : 'Continue with Facebook'
	return (
		<button
			type="button"
			className={`social-btn ${isGoogle ? 'google' : 'facebook'}`}
			onClick={onClick}
		>
			{isGoogle ? (
				<img
					className="social-icon-img"
					alt="Google"
					height="18"
					width="18"
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/225px-Google_%22G%22_logo.svg.png"
					loading="lazy"
					decoding="async"
				/>
			) : (
				<span className="social-icon">🟦</span>
			)}
			{label}
		</button>
	)
}


