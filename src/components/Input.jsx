import { useId } from 'react'

export default function Input({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
	const id = useId()
	return (
		<label className="field" htmlFor={id}>
			<span className="field-label">{label}</span>
			<input
				id={id}
				className="field-input"
				type={type}
				value={value}
				onChange={e => onChange(e.target.value)}
				placeholder={placeholder}
				autoComplete={autoComplete}
				required
			/>
		</label>
	)
}