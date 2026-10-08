import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-context.js'
import { foodCatalog } from './food-catalog.js'
import { supabase } from './lib/supabase.js'

const steps = [
	{ title: 'Select food', description: 'Choose the food category and item you want to screen.' },
	{ title: 'Scan', description: 'Take or upload a clear photo of the sample.' },
	{ title: 'Test', description: 'Record a reading from your screening device, if available.' },
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

export function DashboardPage({ consumerMode = false, embedded = false, onScan, onResult, onReport, onSafety }) {
	const { session } = useAuth()
	const [step, setStep] = useState(consumerMode ? 1 : 0)
	const [category, setCategory] = useState(consumerMode ? 'Unspecified' : '')
	const [foodName, setFoodName] = useState(consumerMode ? 'Unspecified food sample' : '')
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
	const [savingScreening, setSavingScreening] = useState(false)
	const [screeningSaved, setScreeningSaved] = useState(false)
	const [screeningSaveError, setScreeningSaveError] = useState('')
	const videoRef = useRef(null)

	useEffect(() => {
		return () => {
			if (photoUrl) URL.revokeObjectURL(photoUrl)
		}
	}, [photoUrl])

	function invalidateSavedScreening() {
		setScreeningSaved(false)
		setScreeningSaveError('')
	}

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
		invalidateSavedScreening()
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
			invalidateSavedScreening()
		}, 'image/jpeg', 0.9)
	}

	async function getAnalysisImageDataUrl(file) {
		const bitmap = await createImageBitmap(file)
		try {
			const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
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
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
		const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
		if (!supabaseUrl || !supabaseAnonKey) {
			setAnalysisError('FoodGuard is not connected to Supabase. Contact the site administrator.')
			return
		}
		if (!photo) {
			setAnalysisError('Take or upload a sample photo before asking for a visual review.')
			return
		}

		setAnalysing(true)
		try {
			const image = await getAnalysisImageDataUrl(photo)
			const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-food-image`, {
				method: 'POST',
				headers: {
					apikey: supabaseAnonKey,
					Authorization: `Bearer ${session.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ image, category: consumerMode ? 'Unspecified' : category, foodName }),
			})
			const data = await response.json().catch(() => null)
			if (!response.ok) {
				throw new Error(data?.error || data?.detail || 'The visual review could not be completed.')
			}
			const validRiskAreas = Array.isArray(data?.riskAreas) &&
				data.riskAreas.every((area) => area &&
					Number.isInteger(area.x) && area.x >= 0 && area.x <= 1000 &&
					Number.isInteger(area.y) && area.y >= 0 && area.y <= 1000 &&
					Number.isInteger(area.width) && area.width > 0 && area.width <= 1000 - area.x &&
					Number.isInteger(area.height) && area.height > 0 && area.height <= 1000 - area.y &&
					typeof area.observation === 'string')
			if (!data || !['no_obvious_visual_issue', 'possible_visual_issue', 'unclear'].includes(data.visibleCondition) ||
				!Array.isArray(data.observations) ||
				!data.observations.every((item) => typeof item === 'string') ||
				typeof data.guidance !== 'string' ||
				typeof data.disclaimer !== 'string') {
				throw new Error('The visual review returned an unexpected response. Please try again.')
			}
			if (consumerMode && !validRiskAreas) {
				throw new Error('The AI scan service needs an update to identify photo areas. Please try again later.')
			}
			setAnalysis(data)
			invalidateSavedScreening()
			if (consumerMode) setStep(3)
		} catch (error) {
			setAnalysisError(error.message || 'The visual review could not be completed. Please try again.')
		} finally {
			setAnalysing(false)
		}
	}

	async function handleSaveScreening() {
		setScreeningSaveError('')
		if (screeningSaved) return
		if (!supabase || !session?.user?.id) {
			setScreeningSaveError('FoodGuard is not connected to Supabase. Contact the site administrator.')
			return
		}

		setSavingScreening(true)
		try {
			const { error } = await supabase.from('food_screenings').insert({
				user_id: session.user.id,
				food_category: category,
				food_name: foodName.trim(),
				device_reading: deviceReading.trim() || null,
				visible_condition: analysis?.visibleCondition ?? null,
				observations: analysis?.observations ?? [],
			})
			if (error) throw error
			setScreeningSaved(true)
		} catch (error) {
			setScreeningSaveError(error.message || 'Could not save this screening. Please try again.')
		} finally {
			setSavingScreening(false)
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
		<section className={`dashboard-page${embedded ? ' consumer-scan-embedded' : ''}`}>
			{!embedded && <header className="dashboard-welcome">
				<div>
					<p className="eyebrow eyebrow-dark">{consumerMode ? 'Consumer food checker' : 'FoodGuard screening workspace'}</p>
					<h1>{consumerMode ? 'Check Before You Buy.' : 'Your food safety dashboard'}</h1>
					<p className="dashboard-intro">{consumerMode
						? 'Scan a food sample and review a preliminary AI observation. This screening cannot determine whether food is safe.'
						: `Hello, ${session.user.email}. Start a guided screening workflow for a food sample.`}</p>
				</div>
			</header>}

			{consumerMode && (
				<nav className="screening-steps consumer-feature-nav" aria-label="Consumer dashboard features">
					<button
						aria-current={step === 1 ? 'page' : undefined}
						className={`screening-step${step === 1 ? ' is-active' : ''}`}
						onClick={() => {
							setStep(1)
							setAnalysisError('')
							setPhotoError('')
							onScan?.()
						}}
						type="button"
					>
						<span className="screening-step-number">01</span>
						<span className="screening-step-title">Select food</span>
					</button>
					<button
						aria-current={step === 2 ? 'page' : undefined}
						className={`screening-step${step === 2 ? ' is-active' : ''}`}
						onClick={() => {
							if (!photo) {
								setPhotoError('Select a food photo before starting an AI scan.')
								setStep(1)
								onScan?.()
								return
							}
							setAnalysisError('')
							setStep(2)
						}}
						type="button"
					>
						<span className="screening-step-number">02</span>
						<span className="screening-step-title">AI scan</span>
					</button>
					<button
						aria-current={step === 3 ? 'page' : undefined}
						className={`screening-step${step === 3 ? ' is-active' : ''}`}
						onClick={() => {
							if (!photo) {
								setPhotoError('Select a food photo before viewing its AI result.')
								setStep(1)
								onScan?.()
								return
							}
							if (!analysis) {
								setAnalysisError('Run an AI scan first to view the result.')
								setStep(2)
								return
							}
							setAnalysisError('')
							setStep(3)
							onResult?.()
						}}
						type="button"
					>
						<span className="screening-step-number">03</span>
						<span className="screening-step-title">View result</span>
					</button>
					<button className="screening-step" onClick={onReport} type="button">
						<span className="screening-step-number">04</span>
						<span className="screening-step-title">Report suspicious products</span>
					</button>
					<button className="screening-step" onClick={onSafety} type="button">
						<span className="screening-step-number">05</span>
						<span className="screening-step-title">Access food-safety information</span>
					</button>
				</nav>
			)}

			{!consumerMode && <nav className="screening-steps" aria-label="Food screening steps">
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
			</nav>}

			<div className="screening-workspace">
				<section className="screening-panel" aria-live="polite">
					<p className="reference-label">{consumerMode ? 'Consumer AI food check' : `Step ${String(step + 1).padStart(2, '0')} of 06`}</p>
					<h2>{consumerMode
						? step === 1 ? 'Select food' : step === 2 ? 'AI scan' : 'View result'
						: steps[step].title}</h2>
					<p className="screening-step-description">{consumerMode
						? step === 1
							? 'Take or upload a clear photo of the food you want the AI to review.'
							: step === 2
								? 'Ask the AI to look for visible features and mark areas to review.'
								: 'The AI result is a preliminary visual observation, not a food-safety determination.'
						: steps[step].description}</p>

					{step === 0 && (
						<div className="screening-fields">
							<label htmlFor="food-category">Food category</label>
							<select id="food-category" onChange={(event) => {
								setCategory(event.target.value)
								setFoodName('')
								setFoodSearch('')
								setPhoto(null)
								setPhotoUrl('')
								setDeviceReading('')
								setTestCompleted(false)
								setAnalysis(null)
								setAnalysisError('')
								invalidateSavedScreening()
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
									setPhoto(null)
									setPhotoUrl('')
									setDeviceReading('')
									setTestCompleted(false)
									setAnalysis(null)
									setAnalysisError('')
									invalidateSavedScreening()
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
														setPhoto(null)
														setPhotoUrl('')
														setDeviceReading('')
														setTestCompleted(false)
														setAnalysis(null)
														setAnalysisError('')
														invalidateSavedScreening()
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
							{!consumerMode && <p className="selected-food"><strong>{foodName}</strong><span>{category}</span></p>}
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
								{!consumerMode && <button className="screening-secondary" onClick={() => setStep(0)} type="button">Back</button>}
								<button className="screening-primary" disabled={!photo} onClick={() => consumerMode ? setStep(2) : goToStep(2)} type="button">
									{consumerMode ? 'Continue to AI scan' : 'Continue to test'} <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className={consumerMode ? 'consumer-ai-scan screening-result-state' : 'screening-fields'}>
							{consumerMode ? (
								<>
									<div className="analysis-unavailable-icon" aria-hidden="true">AI</div>
									<h3>Scan the photo with AI</h3>
									<p>AI will look for visible warning signs, mark the areas it notices, and describe them. It cannot determine whether the food is good or bad to eat.</p>
									{photoUrl && <img className="consumer-ai-scan-photo" src={photoUrl} alt="Food photo selected for AI visual review" />}
									<p className="screening-privacy-note">The selected photo is sent to FoodGuard&apos;s AI analysis service for review. Avoid photos containing people or private information.</p>
									{analysisError && <p className="auth-feedback auth-error" role="alert">{analysisError}</p>}
									<button className="screening-primary" disabled={analysing || !photo} onClick={handleAnalyze} type="button">
										{analysing ? 'AI is scanning the photo…' : 'Start AI scan'}
									</button>
								</>
							) : (
								<>
									<p className="selected-food"><strong>{foodName}</strong><span>{category}</span></p>
									<p className="screening-privacy-note">When you request a visual review, this compressed photo is sent to FoodGuard&apos;s Gemini analysis service. Don&apos;t upload photos containing people or private information.</p>
									<div className="screening-notice">
										<strong>Automatic device integration is not connected.</strong>
										<p>Enter a reading manually if you have one. It will be saved with this screening when you choose Save screening.</p>
									</div>
									<label htmlFor="device-reading">Manual device reading <span>(optional)</span></label>
									<textarea
										id="device-reading"
										maxLength={500}
										onChange={(event) => {
											setDeviceReading(event.target.value)
											invalidateSavedScreening()
										}}
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
								</>
							)}
						</div>
					)}

					{step === 3 && (
						<div className="screening-result-state">
							{consumerMode ? (
								<>
									{analysing ? (
										<p className="analysis-loading" role="status">AI is reviewing visible features…</p>
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
											{photoUrl && (
												<div className="consumer-risk-image-wrap">
													<img className="consumer-risk-image" src={photoUrl} alt="Food photo with AI-identified visible areas marked" />
													{analysis.riskAreas.map((area, index) => (
														<span
															aria-hidden="true"
															className="consumer-risk-area"
															key={`${area.x}-${area.y}-${index}`}
															style={{
																left: `${area.x / 10}%`,
																top: `${area.y / 10}%`,
																width: `${area.width / 10}%`,
																height: `${area.height / 10}%`,
															}}
														>
															<span>{index + 1}</span>
														</span>
													))}
												</div>
											)}
											<h4 className="consumer-risk-heading">Visible areas to review</h4>
											{analysis.riskAreas.length > 0 ? (
												<ol className="consumer-risk-area-list">
													{analysis.riskAreas.map((area, index) => <li key={`${index}-${area.observation}`}><span>{index + 1}</span>{area.observation}</li>)}
												</ol>
											) : (
												<p className="consumer-risk-empty">No specific area was marked in this photo. That does not guarantee the food is safe.</p>
											)}
											{analysis.observations.length > 0 && (
												<>
													<h4 className="consumer-risk-heading">What the AI noticed</h4>
													<ul className="visual-observations">
														{analysis.observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}
													</ul>
												</>
											)}
											<p className="visual-analysis-disclaimer">{analysis.disclaimer}</p>
										</div>
									) : (
										<>
											<div className="analysis-unavailable-icon" aria-hidden="true">AI</div>
											<h3>Screen visible features</h3>
											<p>This AI review can describe visible features only. It cannot verify hidden hazards or determine whether food is safe.</p>
											{analysisError && <p className="auth-feedback auth-error" role="alert">{analysisError}</p>}
											<button className="screening-primary" disabled={analysing} onClick={handleAnalyze} type="button">
												{analysing ? 'Screening photo…' : 'Screen risk with AI'}
											</button>
										</>
									)}
									<button className="screening-secondary" disabled={analysing} onClick={() => {
										setStep(1)
										setAnalysis(null)
										setAnalysisError('')
									}} type="button">
										{analysis ? 'Scan another food' : 'Choose another photo'}
									</button>
									{analysis?.visibleCondition === 'possible_visual_issue' && onReport && (
										<div className="consumer-report-prompt" role="note">
											<strong>The photo review noticed a visible feature that may need attention.</strong>
											<p>You can report this product concern for follow-up. The AI has not tested for or confirmed pathogens, pesticide residues, or chemicals.</p>
											<button className="screening-primary" onClick={() => onReport(analysis)} type="button">
												Report this product concern
											</button>
										</div>
									)}
									{onSafety && (
										<button className="screening-secondary" onClick={onSafety} type="button">
											Access food-safety information
										</button>
									)}
								</>
							) : analysing ? (
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
									<p>AI can point out visible features in this photo, such as discoloration or surface damage. It cannot detect bacteria, pesticide residues, toxins, or other hidden hazards, and its observations do not establish whether food is safe to eat.</p>
									{analysisError && <p className="auth-feedback auth-error" role="alert">{analysisError}</p>}
									<button className="screening-primary" disabled={analysing} onClick={handleAnalyze} type="button">
										{analysing ? 'Reviewing photo…' : 'Review photo with AI'}
									</button>
								</>
							)}
							{!consumerMode && <div className="screening-actions">
								<button className="screening-secondary" onClick={() => setStep(2)} type="button">Back</button>
								<button className="screening-primary" disabled={!analysis || analysing} onClick={() => setStep(4)} type="button">
									Continue to verification <span aria-hidden="true">→</span>
								</button>
							</div>}
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
								<li>Food details, the manual reading, and visual observations can be saved to your FoodGuard account. The photo is not saved.</li>
								<li>Contact an accredited laboratory or local food-safety authority for appropriate testing.</li>
								<li>Follow official handling guidance while awaiting verified results.</li>
							</ol>
							{screeningSaved
								? <p className="auth-feedback" role="status">Screening saved to your account.</p>
								: (
									<>
										{screeningSaveError && <p className="auth-feedback auth-error" role="alert">{screeningSaveError}</p>}
										<button className="screening-primary" disabled={savingScreening} onClick={handleSaveScreening} type="button">
											{savingScreening ? 'Saving screening…' : 'Save screening'}
										</button>
									</>
								)}
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
								setScreeningSaved(false)
								setScreeningSaveError('')
							}} type="button">Start a new screening</button>
						</div>
					)}
				</section>

				<aside className="screening-sample-card">
					<p className="reference-label">Current sample</p>
					{consumerMode
						? <>
							{photoUrl
								? <img className="sample-thumbnail" src={photoUrl} alt="Selected food sample" />
								: <div className="sample-placeholder" aria-hidden="true"><span>F</span></div>}
							<h3>{photo ? 'Food photo selected' : 'No food selected'}</h3>
							<p>{photo ? 'Ready for a visual review.' : 'Choose a food photo to begin.'}</p>
							<div className="sample-safety-note">
								<strong>Screening only</strong>
								<span>This AI review cannot determine whether food is safe to eat.</span>
							</div>
						</>
						: <>
							{photoUrl
								? <img className="sample-thumbnail" src={photoUrl} alt={`Selected ${foodName} sample`} />
								: <div className="sample-placeholder" aria-hidden="true"><span>F</span></div>}
							<h3>{foodName || 'No food selected'}</h3>
							<p>{category || 'Choose a food category to begin'}</p>
							{deviceReading && <p className="sample-device-reading">Manual device reading added</p>}
							<div className="sample-safety-note">
								<strong>Screening only</strong>
								<span>This prototype does not determine whether food is safe to eat.</span>
							</div>
						</>}
				</aside>
			</div>
		</section>
	)
}
