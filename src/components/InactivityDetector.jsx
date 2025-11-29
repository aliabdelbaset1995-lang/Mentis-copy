import { useEffect, useRef } from 'react'

const INACTIVITY_TIMEOUT = 30000 // 30 seconds

export default function InactivityDetector() {
	const timeoutRef = useRef(null)
	const audioRef = useRef(null)
	const isPlayingRef = useRef(false)
	const lastActivityRef = useRef(Date.now())

	function resetTimer() {
		// Clear existing timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
		
		// Stop any playing sound
		if (isPlayingRef.current && audioRef.current) {
			if (audioRef.current.stop) {
				audioRef.current.stop()
			} else if (audioRef.current.pause) {
				audioRef.current.pause()
				audioRef.current.currentTime = 0
			}
			audioRef.current = null
			isPlayingRef.current = false
		}
		
		// Update last activity time
		lastActivityRef.current = Date.now()
		
		// Set new timeout
		timeoutRef.current = setTimeout(() => {
			startSoundLoop()
		}, INACTIVITY_TIMEOUT)
	}

	function playBeep(audioContext) {
		const oscillator = audioContext.createOscillator()
		const gainNode = audioContext.createGain()
		
		oscillator.connect(gainNode)
		gainNode.connect(audioContext.destination)
		
		oscillator.frequency.value = 800 // 800 Hz beep
		oscillator.type = 'sine'
		
		// Fade in and out for a smoother beep
		const now = audioContext.currentTime
		gainNode.gain.setValueAtTime(0, now)
		gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1)
		gainNode.gain.linearRampToValueAtTime(0.3, now + 0.4)
		gainNode.gain.linearRampToValueAtTime(0, now + 0.5)
		
		oscillator.start(now)
		oscillator.stop(now + 0.5)
	}

	function startSoundLoop() {
		if (isPlayingRef.current) return
		
		isPlayingRef.current = true
		
		// Use Web Audio API to create a looping beep
		try {
			const audioContext = new (window.AudioContext || window.webkitAudioContext)()
			let intervalId = null
			
			// Play beep immediately
			playBeep(audioContext)
			
			// Then play beep every 1 second in a loop
			intervalId = setInterval(() => {
				if (isPlayingRef.current) {
					playBeep(audioContext)
				}
			}, 1000)
			
			// Store references for cleanup
			audioRef.current = {
				audioContext,
				intervalId,
				stop: () => {
					try {
						if (intervalId) {
							clearInterval(intervalId)
						}
						audioContext.close()
					} catch (e) {
						// Ignore errors on stop
					}
				}
			}
		} catch (error) {
			console.error('Error creating inactivity sound:', error)
			isPlayingRef.current = false
		}
	}

	useEffect(() => {
		// Activity event handlers
		const activityEvents = [
			'mousedown',
			'mousemove',
			'keypress',
			'scroll',
			'touchstart',
			'click',
			'keydown'
		]

		const handleActivity = () => {
			resetTimer()
		}

		// Add event listeners
		activityEvents.forEach(event => {
			window.addEventListener(event, handleActivity, { passive: true })
		})

		// Initialize timer
		resetTimer()

		// Cleanup
		return () => {
			activityEvents.forEach(event => {
				window.removeEventListener(event, handleActivity)
			})
			
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			
			if (audioRef.current) {
				if (audioRef.current.stop) {
					audioRef.current.stop()
				} else if (audioRef.current.pause) {
					audioRef.current.pause()
					audioRef.current.src = ''
					if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
						URL.revokeObjectURL(audioRef.current.src)
					}
				}
			}
		}
	}, [])

	return null // This component doesn't render anything
}

