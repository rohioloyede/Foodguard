import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth-context.js'
import { supabase } from './lib/supabase.js'
import { DashboardPage } from './dashboard.jsx'

const safetyKeys = [
	['Keep clean', 'Wash hands and keep food-preparation surfaces and utensils clean.'],
	['Separate raw and cooked', 'Keep raw meat, poultry and seafood separate from ready-to-eat food.'],
	['Cook thoroughly', 'Cook food thoroughly, especially meat, poultry, eggs and seafood.'],
	['Keep food at safe temperatures', 'Refrigerate perishable food promptly and avoid leaving it at room temperature for long periods.'],
	['Use safe water and ingredients', 'Choose safe water and fresh ingredients, and wash produce with safe water.'],
]

const initialReport = {
	productName: '',
	brand: '',
	purchaseLocation: '',
	concern: '',
}

export function ConsumerPage() {
	const location = useLocation()
	const navigate = useNavigate()
	const { session } = useAuth()
	const [report, setReport] = useState(() => ({
		...initialReport,
		concern: location.pathname === '/consumer/report' && typeof location.state?.aiConcern === 'string'
			? location.state.aiConcern
			: '',
	}))
	const [reportBusy, setReportBusy] = useState(false)
	const [reportError, setReportError] = useState('')
	const [reportSubmitted, setReportSubmitted] = useState(false)

	async function handleReportSubmit(event) {
		event.preventDefault()
		setReportError('')
		setReportSubmitted(false)

		if (!supabase || !session?.user?.id) {
			setReportError('Sign in to submit a report. If this continues, contact the site administrator.')
			return
		}

		setReportBusy(true)
		try {
			const { error } = await supabase.from('food_product_reports').insert({
				user_id: session.user.id,
				product_name: report.productName.trim(),
				brand: report.brand.trim() || null,
				purchase_location: report.purchaseLocation.trim() || null,
				concern: report.concern.trim(),
			})
			if (error) throw error
			setReport(initialReport)
			setReportSubmitted(true)
		} catch (error) {
			setReportError(error.message || 'Could not submit the report. Please try again.')
		} finally {
			setReportBusy(false)
		}
	}

	const isReportPage = location.pathname === '/consumer/report'
	const isSafetyPage = location.pathname === '/consumer/safety'
	const consumerName = session?.user?.user_metadata?.full_name
		|| session?.user?.user_metadata?.name
		|| session?.user?.email?.split('@')[0]
		|| 'Consumer'
	const pageTitle = isReportPage
		? 'Report suspicious products'
		: isSafetyPage
			? 'Access food-safety information'
			: `Hello, ${consumerName}`

	return (
		<section className="dashboard-page consumer-dashboard-page">
			<header className="dashboard-welcome">
				<div>
					<p className="eyebrow eyebrow-dark">FoodGuard screening workspace</p>
					<h1>{pageTitle}</h1>
					<p className="dashboard-intro">
						{isReportPage
							? 'Share details about a product that concerns you.'
							: isSafetyPage
								? 'Find practical guidance for handling food safely.'
								: 'Start a visual screening workflow for a food sample.'}
					</p>
				</div>
			</header>

			{(isReportPage || isSafetyPage) ? (
				<>
					<nav className="screening-steps consumer-feature-nav" aria-label="Consumer dashboard features">
						<button className="screening-step" onClick={() => navigate('/consumer/dashboard')} type="button">
							<span className="screening-step-number">01</span><span className="screening-step-title">Select food</span>
						</button>
						<button className="screening-step" onClick={() => navigate('/consumer/dashboard')} type="button">
							<span className="screening-step-number">02</span><span className="screening-step-title">AI scan</span>
						</button>
						<button className="screening-step" onClick={() => navigate('/consumer/dashboard')} type="button">
							<span className="screening-step-number">03</span><span className="screening-step-title">View result</span>
						</button>
						<button aria-current={isReportPage ? 'page' : undefined} className={`screening-step${isReportPage ? ' is-active' : ''}`} onClick={() => navigate('/consumer/report')} type="button">
							<span className="screening-step-number">04</span><span className="screening-step-title">Report suspicious products</span>
						</button>
						<button aria-current={isSafetyPage ? 'page' : undefined} className={`screening-step${isSafetyPage ? ' is-active' : ''}`} onClick={() => navigate('/consumer/safety')} type="button">
							<span className="screening-step-number">05</span><span className="screening-step-title">Access food-safety information</span>
						</button>
					</nav>
					<section className={`consumer-feature-panel ${isReportPage ? 'consumer-report-section' : 'consumer-safety-section'}`}>
						{isReportPage ? (
							<>
								<div className="consumer-report-intro">
									<p className="eyebrow eyebrow-dark">Community reporting</p>
									<h1 id="consumer-report-title">Report a suspicious product</h1>
									<p>Reports are unverified and are submitted to FoodGuard only. They are not automatically sent to a regulator.</p>
									<p className="consumer-report-lab-note">An AI photo observation is not a laboratory test and cannot confirm pathogens, pesticide residues, or chemical treatments. Add any independent test information you have in the concern details.</p>
								</div>
								{session ? (
									<form className="consumer-report-form" onSubmit={handleReportSubmit}>
										<label htmlFor="report-product">Product name <span>Required</span></label>
										<input autoComplete="off" id="report-product" maxLength={100} onChange={(event) => setReport((current) => ({ ...current, productName: event.target.value }))} required value={report.productName} />
										<label htmlFor="report-brand">Brand or label <span>Optional</span></label>
										<input autoComplete="off" id="report-brand" maxLength={100} onChange={(event) => setReport((current) => ({ ...current, brand: event.target.value }))} value={report.brand} />
										<label htmlFor="report-location">Where did you see or buy it? <span>Optional</span></label>
										<input autoComplete="off" id="report-location" maxLength={160} onChange={(event) => setReport((current) => ({ ...current, purchaseLocation: event.target.value }))} value={report.purchaseLocation} />
										<label htmlFor="report-concern">What concerns you? <span>Required</span></label>
										<textarea id="report-concern" maxLength={1000} minLength={10} onChange={(event) => setReport((current) => ({ ...current, concern: event.target.value }))} required rows={4} value={report.concern} />
										{reportError && <p className="auth-feedback auth-error" role="alert">{reportError}</p>}
										{reportSubmitted && <p className="auth-feedback auth-notice" role="status">Your report was submitted to FoodGuard. It has not been independently verified.</p>}
										<button className="screening-primary" disabled={reportBusy} type="submit">{reportBusy ? 'Submitting report…' : 'Submit product report'}</button>
									</form>
								) : (
									<div className="consumer-report-signin">
										<p>Sign in to submit a product report.</p>
										<Link className="screening-primary" state={{ from: { pathname: '/consumer/report' } }} to="/login?audience=consumer">Consumer sign in</Link>
									</div>
								)}
							</>
						) : (
							<>
								<div className="consumer-section-heading">
									<p className="eyebrow eyebrow-dark">Food-safety information</p>
									<h1 id="consumer-safety-title">Five everyday food-safety keys.</h1>
									<p>These basic handling practices follow the World Health Organization&apos;s Five Keys to Safer Food.</p>
								</div>
								<ol className="consumer-safety-list">
									{safetyKeys.map(([title, description], index) => (
										<li key={title}>
											<span>{String(index + 1).padStart(2, '0')}</span>
											<div><h3>{title}</h3><p>{description}</p></div>
										</li>
									))}
								</ol>
								<div className="consumer-safety-sources">
									<a href="https://www.who.int/news-room/fact-sheets/detail/food-safety" rel="noreferrer" target="_blank">WHO food safety guidance ↗</a>
									<a href="https://nafdac.gov.ng/" rel="noreferrer" target="_blank">NAFDAC official website ↗</a>
								</div>
							</>
						)}
					</section>
				</>
			) : session ? (
				<DashboardPage
					consumerMode
					embedded
					onReport={(analysis) => {
						const details = analysis.riskAreas.length > 0
							? analysis.riskAreas.map((area) => area.observation)
							: analysis.observations
						const aiConcern = `AI visual review (not laboratory-confirmed): ${details.join('; ')}`.slice(0, 1000)
						navigate('/consumer/report', { state: { aiConcern } })
					}}
					onSafety={() => navigate('/consumer/safety')}
				/>
			) : (
				<div className="consumer-report-signin">
					<p>Sign in to scan a food sample.</p>
					<Link className="screening-primary" to="/login?audience=consumer">Consumer sign in</Link>
				</div>
			)}
		</section>
	)
}
