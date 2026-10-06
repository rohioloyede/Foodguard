import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-context.js'
import { foodCatalog } from './food-catalog.js'

const steps = [
	{ title: 'Select food', description: 'Choose the food category and item you want to screen.' },
	{ title: 'Scan', description: 'Take or upload a clear photo of the sample.' },
	{ title: 'Test', description: 'Add a reading from a connected screening device, if available.' },
	{ title: 'Analyse', description: 'Compare evidence with validated reference data.' },
	{ title: 'Verify', description: 'Refer high-risk or uncertain samples for laboratory confirmation.' },
	{ title: 'Act', description: 'Use verified findings to decide what to do next.' },
]

const foodOptionColors = [
	'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100',
	'border-lime-200 bg-lime-50 hover:border-lime-400 hover:bg-lime-100',
	'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100',
	'border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100',
	'border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100',
	'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100',
	'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100',
	'border-teal-200 bg-teal-50 hover:border-teal-400 hover:bg-teal-100',
]

const maxPhotoSize = 10 * 1024 * 1024
const maxAnalysisImageSize = 4 * 1024 * 1024

export function DashboardPage() {
	const { session } = useAuth()
	const [step, setStep] = useState(0)
	const [category, setCategory] = useState('')
	const [foodName, setFoodName] = useState('')
	const [foodSearch, setFoodSearch] = useState('')
	const [photo, setPhoto] = useState(null)
	const [photoUrl, setPhotoUrl] = useState('')
	const [cameraActive, setCameraActive] = useState(false)
	const [cameraBusy, setCameraBusy] = useState(false)
	const [deviceReading, setDeviceReading] = useState('')
	const [testCompleted, setTestCompleted] = useState(false)
	const [photoError, setPhotoError] = useState('')
	const [analysis, setAnalysis] = useState(null)
	const [analysisError, setAnalysisError] = useState('')
	const [analysing, setAnalysing] = useState(false)
	const videoRef = useRef(null)

	useEffect(() => {
		return () => {
			if (photoUrl) URL.revokeObjectURL(photoUrl)
		}
	}, [photoUrl])

	useEffect(() => {
		if (!cameraActive) return undefined

		let stream
		let cancelled = false
		if (!navigator.mediaDevices?.getUserMedia) {
			return undefined
		}
		const videoElement = videoRef.current

		navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
			.then((cameraStream) => {
				if (cancelled) {
					cameraStream.getTracks().forEach((track) => track.stop())
					return
				}
				stream = cameraStream
				if (videoElement) videoElement.srcObject = cameraStream
			})
			.catch((error) => {
				if (cancelled) return
				setPhotoError(error.name === 'NotAllowedError'
					? 'Camera permission was denied. Allow camera access in your browser settings, or use the photo upload option.'
					: error.message || 'Could not start the camera. Use the photo upload option instead.')
				setCameraActive(false)
			})

		return () => {
			cancelled = true
			stream?.getTracks().forEach((track) => track.stop())
			if (videoElement?.srcObject === stream) videoElement.srcObject = null
		}
	}, [cameraActive])

	function handlePhotoChange(event) {
		const selectedPhoto = event.target.files?.[0]
		event.target.value = ''
		setPhotoError('')
		if (!selectedPhoto) return

		if (!selectedPhoto.type.startsWith('image/')) {
			setPhoto(null)
			setPhotoUrl('')
			setPhotoError('Choose an image file to continue.')
			return
		}
		if (selectedPhoto.size > maxPhotoSize) {
			setPhoto(null)
			setPhotoUrl('')
			setPhotoError('Choose an image smaller than 10 MB.')
			return
		}
		setPhotoUrl(URL.createObjectURL(selectedPhoto))
		setPhoto(selectedPhoto)
		setCameraActive(false)
		setAnalysis(null)
		setTestCompleted(false)
	}

	function handleTakeSnapshot() {
		const video = videoRef.current
		if (!video?.videoWidth || !video.videoHeight) {
			setPhotoError('The camera is not ready yet. Wait a moment and try again.')
			return
		}

		setCameraBusy(true)
		setPhotoError('')
		const canvas = document.createElement('canvas')
		canvas.width = video.videoWidth
		canvas.height = video.videoHeight
		const context = canvas.getContext('2d')
		if (!context) {
			setPhotoError('Could not access the photo capture tool. Please upload an image instead.')
			setCameraBusy(false)
			return
		}
		context.drawImage(video, 0, 0, canvas.width, canvas.height)
		canvas.toBlob((blob) => {
			if (!blob) {
				setPhotoError('Could not capture the photo. Please try again or upload an image.')
				setCameraBusy(false)
				return
			}

			const snapshot = new File([blob], `foodguard-sample-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
			if (snapshot.size > maxPhotoSize) {
				setPhotoError('The captured photo is larger than 10 MB. Try again or upload a smaller image.')
				setCameraBusy(false)
				return
			}
			setPhotoUrl(URL.createObjectURL(snapshot))
			setPhoto(snapshot)
			setAnalysis(null)
			setTestCompleted(false)
			setCameraActive(false)
			setCameraBusy(false)
		}, 'image/jpeg', 0.9)
	}

	async function getAnalysisImageDataUrl(file) {
		const bitmap = await createImageBitmap(file)
		try {
			const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
			const canvas = document.createElement('canvas')
			canvas.width = Math.max(1, Math.round(bitmap.width * scale))
			canvas.height = Math.max(1, Math.round(bitmap.height * scale))
			const context = canvas.getContext('2d')
			if (!context) throw new Error('Could not prepare the photo for analysis. Please choose another image.')
			context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

			const compressed = await new Promise((resolve, reject) => {
				canvas.toBlob((blob) => {
					if (blob) resolve(blob)
					else reject(new Error('Could not prepare the photo for analysis. Please try again.'))
				}, 'image/jpeg', 0.82)
			})
			if (compressed.size > maxAnalysisImageSize) {
				throw new Error('This photo is too large to send for analysis. Choose a smaller image.')
			}

			return await new Promise((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(reader.result)
				reader.onerror = () => reject(new Error('Could not read the selected photo. Please try again.'))
				reader.readAsDataURL(compressed)
			})
		} finally {
			bitmap.close()
		}
	}

	async function handleAnalyze() {
		setAnalysisError('')
		setAnalysis(null)
		if (!session?.access_token) {
			setAnalysisError('Your session has expired. Sign in again before requesting a visual review.')
			return
		}
		const analysisApiUrl = import.meta.env.VITE_FOOD_ANALYSIS_API_URL
		if (!analysisApiUrl) {
			setAnalysisError('The visual analysis service is not configured yet. Contact the site administrator.')
			return
		}
		if (!photo) {
			setAnalysisError('Take or upload a sample photo before asking for a visual review.')
			return
		}

		setAnalysing(true)
		try {
			const image = await getAnalysisImageDataUrl(photo)
			const response = await fetch(`${analysisApiUrl.replace(/\/+$/, '')}/v1/analyze-food-image`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ image, category, foodName }),
			})
			const data = await response.json().catch(() => null)
			if (!response.ok) {
				throw new Error(data?.detail || 'The visual review could not be completed.')
			}
			if (!data || !['no_obvious_visual_issue', 'possible_visual_issue', 'unclear'].includes(data.visibleCondition) ||
				!Array.isArray(data.observations) ||
				!data.observations.every((item) => typeof item === 'string') ||
				typeof data.guidance !== 'string' ||
				typeof data.disclaimer !== 'string') {
				throw new Error('The visual review returned an unexpected response. Please try again.')
			}
			setAnalysis(data)
		} catch (error) {
			setAnalysisError(error.message || 'The visual review could not be completed. Please try again.')
		} finally {
			setAnalysing(false)
		}
	}

	function goToStep(nextStep) {
		if (nextStep >= 1 && (!category || !foodName.trim())) return
		if (nextStep >= 2 && !photo) return
		if (nextStep >= 3 && !testCompleted) return
		if (nextStep >= 4 && !analysis) return
		setStep(nextStep)
	}

	return (
		<section className="dashboard-page">
			<header className="dashboard-welcome">
				<div>
					<p className="eyebrow eyebrow-dark">FoodGuard screening workspace</p>
					<h1>Your food safety dashboard</h1>
					<p className="dashboard-intro">Hello, {session.user.email}. Start a guided screening workflow for a food sample.</p>
				</div>
			</header>

			<nav className="screening-steps" aria-label="Food screening steps">
				{steps.map((item, index) => (
					<button
						aria-current={step === index ? 'step' : undefined}
						className={`screening-step${step === index ? ' is-active' : ''}${step > index ? ' is-complete' : ''}`}
						disabled={index >= 1 && (!category || !foodName.trim()) ||
							index >= 2 && !photo ||
							index >= 3 && !testCompleted ||
							index >= 4 && !analysis}
						key={item.title}
						onClick={() => goToStep(index)}
						type="button"
					>
						<span className="screening-step-number">{step > index ? '✓' : String(index + 1).padStart(2, '0')}</span>
						<span className="screening-step-title">{item.title}</span>
					</button>
				))}
			</nav>

			<div className="screening-workspace">
				<section className="screening-panel" aria-live="polite">
					<p className="reference-label">Step {String(step + 1).padStart(2, '0')} of 06</p>
					<h2>{steps[step].title}</h2>
					<p className="screening-step-description">{steps[step].description}</p>

					{step === 0 && (
						<div className="screening-fields">
							<label htmlFor="food-category">Food category</label>
							<select id="food-category" onChange={(event) => {
								setCategory(event.target.value)
								setFoodName('')
								setFoodSearch('')
							}} value={category}>
								<option value="">Select a category</option>
								{Object.keys(foodCatalog).map((name) => <option key={name} value={name}>{name}</option>)}
							</select>
							<label htmlFor="food-name">Find a food item</label>
							<input
								autoComplete="off"
								disabled={!category}
								id="food-name"
								maxLength={100}
								onChange={(event) => {
									setFoodSearch(event.target.value)
									setFoodName(event.target.value)
								}}
								placeholder={category ? 'Search foods in this category' : 'Select a category first'}
								value={foodSearch}
							/>
							{category && (
								<>
									<p className="mb-2 mt-4 text-[11px] font-bold text-[#344c3e]">
										{foodSearch ? 'Matching foods — select one below or keep your custom entry' : `Choose from ${category}`}
									</p>
									<div
										aria-label={`${category} food items`}
										className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-[#d9ddd5] bg-white p-2 shadow-sm sm:grid-cols-2"
									>
										{foodCatalog[category]
											.filter((food) => food.toLocaleLowerCase().includes(foodSearch.trim().toLocaleLowerCase()))
											.map((food, index) => (
												<button
													aria-pressed={foodName === food}
													className={`min-h-10 rounded-md border px-3 py-2 text-left text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9573b] ${
														foodName === food
															? 'border-[#173b2d] bg-[#173b2d] font-semibold text-white'
															: `${foodOptionColors[index % foodOptionColors.length]} text-[#344c3e]`
													}`}
													key={food}
													onClick={() => {
														setFoodName(food)
														setFoodSearch(food)
													}}
													type="button"
												>
													<span className="flex items-center gap-2">
														<span
															aria-hidden="true"
															className={`h-2 w-2 shrink-0 rounded-full ${foodName === food ? 'bg-white' : 'bg-current opacity-50'}`}
														/>
														{food}
													</span>
												</button>
											))}
										{foodCatalog[category].filter((food) => food.toLocaleLowerCase().includes(foodSearch.trim().toLocaleLowerCase())).length === 0 &&
											<p className="col-span-full m-0 rounded-md bg-[#f2f3ed] p-3 text-[11px] leading-relaxed text-[#65736a]">
												No matching suggestions. You can use “{foodSearch}” as a custom food item.
											</p>}
									</div>
									<p className="screening-hint">
										{foodCatalog[category].length} suggestions. Don&apos;t see your food? Type its name.
										The list is a helpful starter catalog, not a complete list of every regional variety.
									</p>
								</>
							)}
							<button className="screening-primary" disabled={!category || !foodName.trim()} onClick={() => goToStep(1)} type="button">
								Continue to scan <span aria-hidden="true">→</span>
							</button>
						</div>
					)}

					{step === 1 && (
						<div className="screening-fields">
							<p className="selected-food"><strong>{foodName}</strong><span>{category}</span></p>
							{cameraActive ? (
								<div className="camera-capture">
									<video aria-label="Live camera preview of food sample" autoPlay playsInline ref={videoRef} />
									<div className="screening-actions">
										<button className="screening-secondary" disabled={cameraBusy} onClick={() => setCameraActive(false)} type="button">Cancel camera</button>
										<button className="screening-primary" disabled={cameraBusy} onClick={handleTakeSnapshot} type="button">
											{cameraBusy ? 'Capturing…' : 'Take snapshot'}
										</button>
									</div>
								</div>
							) : (
								<button className="camera-start-button" onClick={() => {
									setPhotoError('')
									if (!navigator.mediaDevices?.getUserMedia) {
										setPhotoError('Camera access is not supported in this browser. Use the photo upload option instead.')
										return
									}
									setCameraActive(true)
								}} type="button">
									<span className="camera-start-icon" aria-hidden="true">◎</span>
									<span><strong>Open camera</strong><small>Take a photo now with your device camera</small></span>
								</button>
							)}
							<label className="photo-picker" htmlFor="food-photo">
								<span className="photo-picker-icon" aria-hidden="true">＋</span>
								<strong>{photo ? 'Choose a different photo' : 'Or upload a photo instead'}</strong>
								<span>Use a clear, well-lit photo. Maximum size 10 MB.</span>
							</label>
							<input
								accept="image/*"
								capture="environment"
								className="visually-hidden-input"
								id="food-photo"
								onChange={handlePhotoChange}
								type="file"
							/>
							{photoError && <p className="auth-feedback auth-error" role="alert">{photoError}</p>}
							{photoUrl && (
								<div className="photo-preview">
									<img src={photoUrl} alt={`Selected sample of ${foodName}`} />
									<p>{photo.name}</p>
								</div>
							)}
							<div className="screening-actions">
								<button className="screening-secondary" onClick={() => setStep(0)} type="button">Back</button>
								<button className="screening-primary" disabled={!photo} onClick={() => goToStep(2)} type="button">
									Continue to test <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className="screening-fields">
							<p className="selected-food"><strong>{foodName}</strong><span>{category}</span></p>
							<p className="screening-privacy-note">When you request a visual review, this compressed photo is sent to FoodGuard&apos;s Gemini analysis service. Don&apos;t upload photos containing people or private information.</p>
							<div className="screening-notice">
								<strong>Portable device integration is not connected.</strong>
								<p>If you have a FoodGuard device reading, you can note it here for this session. It will not be independently interpreted or saved.</p>
							</div>
							<label htmlFor="device-reading">Device reading <span>(optional)</span></label>
							<textarea
								id="device-reading"
								maxLength={500}
								onChange={(event) => setDeviceReading(event.target.value)}
								placeholder="Enter the reading and units shown by your device"
								rows="3"
								value={deviceReading}
							/>
							<div className="screening-actions">
								<button className="screening-secondary" onClick={() => setStep(1)} type="button">Back</button>
								<button className="screening-primary" onClick={() => {
									setTestCompleted(true)
									setStep(3)
								}} type="button">
									Continue to analysis <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}

					{step === 3 && (
						<div className="screening-result-state">
							{analysing ? (
								<p className="analysis-loading" role="status">Reviewing visible appearance…</p>
							) : analysis ? (
								<div className="visual-analysis-result">
									<p className="screening-result-label">AI visual observation · preliminary</p>
									<h3>
										{analysis.visibleCondition === 'possible_visual_issue'
											? 'Possible visible concern'
											: analysis.visibleCondition === 'no_obvious_visual_issue'
												? 'No obvious visual issue detected'
												: 'Appearance unclear'}
									</h3>
									<p className="visual-analysis-limit">{analysis.guidance}</p>
									{analysis.observations.length > 0 && (
										<ul className="visual-observations">
											{analysis.observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}
										</ul>
									)}
									<p className="visual-analysis-disclaimer">{analysis.disclaimer}</p>
								</div>
							) : (
								<>
									<div className="analysis-unavailable-icon" aria-hidden="true">AI</div>
									<h3>Review visible appearance</h3>
									<p>Gemini can point out visible features in this photo, such as discoloration or surface damage. It cannot detect bacteria, pesticide residues, toxins, or other hidden hazards, and its observations do not establish whether food is safe to eat.</p>
									{analysisError && <p className="auth-feedback auth-error" role="alert">{analysisError}</p>}
									<button className="screening-primary" disabled={analysing} onClick={handleAnalyze} type="button">
										{analysing ? 'Reviewing photo…' : 'Review photo with AI'}
									</button>
								</>
							)}
							<div className="screening-actions">
								<button className="screening-secondary" onClick={() => setStep(2)} type="button">Back</button>
								<button className="screening-primary" disabled={!analysis || analysing} onClick={() => setStep(4)} type="button">
									Continue to verification <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}

					{step === 4 && (
						<div className="screening-result-state">
							<div className="verification-mark" aria-hidden="true">V</div>
							<h3>Laboratory verification</h3>
							<p>A photo-based AI review is not a food-safety test. It cannot check for pathogens, pesticide residues, chemical ripening agents, or toxins. Do not treat its visual observations as proof of safety or contamination. Contact an accredited food-testing laboratory or relevant food-safety authority for a safety decision.</p>
							<div className="screening-actions">
								<button className="screening-secondary" onClick={() => setStep(3)} type="button">Back</button>
								<button className="screening-primary" onClick={() => setStep(5)} type="button">
									View next steps <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}

					{step === 5 && (
						<div className="screening-result-state screening-action-state">
							<p className="screening-result-label">Screening outcome</p>
							<h3>Visual review only — Safety not determined</h3>
							<p>{analysis?.guidance || 'No AI visual review was completed.'} AI photo review cannot establish whether this food is safe or unsafe.</p>
							<ol>
								<li>Keep the sample details and photo for your own records.</li>
								<li>Contact an accredited laboratory or local food-safety authority for appropriate testing.</li>
								<li>Follow official handling guidance while awaiting verified results.</li>
							</ol>
							<button className="screening-secondary" onClick={() => {
								setStep(0)
								setCategory('')
								setFoodName('')
								setPhoto(null)
								setPhotoUrl('')
								setDeviceReading('')
								setTestCompleted(false)
								setAnalysis(null)
								setAnalysisError('')
							}} type="button">Start a new screening</button>
						</div>
					)}
				</section>

				<aside className="screening-sample-card">
					<p className="reference-label">Current sample</p>
					{photoUrl
						? <img className="sample-thumbnail" src={photoUrl} alt={`Selected ${foodName} sample`} />
						: <div className="sample-placeholder" aria-hidden="true"><span>F</span></div>}
					<h3>{foodName || 'No food selected'}</h3>
					<p>{category || 'Choose a food category to begin'}</p>
					{deviceReading && <p className="sample-device-reading">Device note added</p>}
					<div className="sample-safety-note">
						<strong>Screening only</strong>
						<span>This prototype does not determine whether food is safe to eat.</span>
					</div>
				</aside>
			</div>
		</section>
	)
}
