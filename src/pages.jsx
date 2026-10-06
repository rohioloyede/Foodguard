import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'

const impactAreas = ['Food System', 'Consumers', 'Markets', 'Public Health']
const foodChainStages = ['Production', 'Harvest', 'Storage', 'Transportation', 'Wholesale', 'Retail', 'Consumer']
const reportedConcerns = [
	'Chemical ripening of fruits',
	'Pesticide residues',
	'Inappropriate chemical preservation',
	'Contamination associated with storage',
	'Deterioration and spoilage',
	'Post-harvest losses',
	'Weak detection capacity',
]
const approachComparison = [
	['Visual inspection', 'Many risks are invisible', 'AI + sensing'],
	['Periodic laboratory testing', 'Expensive and slow for routine screening', 'Portable screening + laboratory confirmation'],
	['Consumer judgement', 'Limited ability to identify treatment', 'Consumer screening'],
	['Manual market inspection', 'Limited geographic coverage', 'Digital market intelligence'],
	['Fragmented records', 'Difficult to identify patterns', 'Centralised data architecture'],
	['Reactive enforcement', 'Intervention may occur after distribution', 'Early-warning intelligence'],
]
const passportSections = [
	{ title: 'Product', items: ['food category', 'variety'] },
	{ title: 'Origin', items: ['producer', 'location'] },
	{ title: 'Supply chain', items: ['aggregation', 'transport', 'storage', 'processor', 'retailer'] },
	{ title: 'Testing', items: ['date', 'screening result', 'sensor result', 'laboratory confirmation'] },
	{ title: 'AI', items: ['classification', 'confidence', 'risk history'] },
	{ title: 'QR Code', items: ['traceability link', 'trusted verification'] },
]
const targetFoodCategories = [
	{ name: 'Fruits', items: ['Mango', 'Banana', 'Pawpaw', 'Watermelon'] },
	{ name: 'Grains & legumes', items: ['Beans / cowpeas', 'Grains'] },
	{ name: 'Vegetables', items: ['Tomatoes', 'Leafy vegetables'] },
	{ name: 'Animal products', items: ['Fish', 'Meat', 'Poultry'] },
]

function QRCodeCard() {
	const [qrCodeUrl, setQrCodeUrl] = useState('')

	useEffect(() => {
		const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175'
		QRCode.toDataURL(url, {
			margin: 1,
			scale: 6,
			width: 180,
			color: {
				dark: '#173b2d',
				light: '#ffffff',
			},
		})
			.then((dataUrl) => setQrCodeUrl(dataUrl))
			.catch(() => setQrCodeUrl(''))
	}, [])

	return (
		<div className="qr-code-card" aria-label="QR code for this website">
			<div className="qr-code-wrap">
				{qrCodeUrl ? <img src={qrCodeUrl} alt="QR code for FoodGuard AI Nigeria" /> : <span className="qr-code-fallback">QR</span>}
			</div>
			<div className="qr-code-copy">
				<p className="eyebrow eyebrow-dark">Scan to visit</p>
				<h3>FoodGuard AI Nigeria</h3>
			</div>
		</div>
	)
}

export function HomePage() {
	return (
		<>
			<section className="hero">
				<div className="hero-image" role="img" aria-label="Fresh produce at a busy food market" />
				<div className="hero-shade" />
				<div className="hero-copy">
					<p className="eyebrow"><span /> A new lens on food safety</p>
					<h1>FoodGuard<br />AI Nigeria</h1>
					<p className="hero-title">Making food safety visible before it becomes a public health problem.</p>
					<p className="hero-description">
						An AI-enabled food safety intelligence and screening platform combining computer vision,
						portable sensing, laboratory validation and supply-chain data to identify food safety risks
						across Nigeria&apos;s food system.
					</p>
					<div className="hero-actions">
						<a className="button button-primary" href="#partner">Fund the FoodGuard Initiative <span aria-hidden="true">↗</span></a>
						<Link className="button button-quiet" to="/why-existing-approaches">Explore the technology <span aria-hidden="true">↓</span></Link>
					</div>
				</div>
				<div className="hero-caption"><span>01 / 04</span> Earlier signals. Stronger food systems.</div>
			</section>

			<section className="impact" aria-label="Areas of impact">
				<div className="impact-intro">
					<p className="eyebrow eyebrow-dark">Where change begins</p>
					<p>Four connected lenses.<br /><strong>One safer food system.</strong></p>
				</div>
				<div className="impact-list">
					{impactAreas.map((area, index) => (
						<div className="impact-item" key={area}>
							<span className="impact-number">0{index + 1}</span>
							<span>{area}</span>
							<span className="impact-arrow" aria-hidden="true">↗</span>
						</div>
					))}
				</div>
			</section>

		</>
	)
}

export function ProblemPage() {
	return (
		<section className="approach problem-page">
			<p className="eyebrow eyebrow-dark">The Problem</p>
			<div className="problem-heading">
				<h1>Nigeria&apos;s Food Safety Challenge Is Largely Invisible</h1>
				<p>Food safety risks can enter the chain at many points. The report identifies concerns across production, handling and sale; these examples indicate where risks may arise, not how prevalent they are nationally.</p>
			</div>
			<ol className="food-chain" aria-label="Food chain stages">
				{foodChainStages.map((stage) => <li key={stage}>{stage}</li>)}
			</ol>
			<div className="problem-details">
				<div className="reported-concerns">
					<p className="eyebrow eyebrow-dark">Concerns identified in the report</p>
					<ul>
						{reportedConcerns.map((concern) => <li key={concern}>{concern}</li>)}
					</ul>
					<p className="consumer-note">Some chemical treatments cannot be reliably identified by appearance, smell or ordinary home observation alone.</p>
				</div>
				<aside className="evidence-note">
					<p className="evidence-label">Evidence limitation</p>
					<p>Nigeria does not currently have a single nationally representative dataset establishing the prevalence of all forms of chemical food treatment. Existing evidence includes regulatory warnings, laboratory studies, field observations and reported incidents. FoodGuard therefore seeks not only to detect risk, but also to help build the evidence infrastructure required for better measurement.</p>
				</aside>
			</div>
		</section>
	)
}

export function ApproachesPage() {
	return (
		<section className="approaches-page">
			<div className="approaches-hero">
				<div className="approaches-copy">
					<p className="eyebrow eyebrow-dark">Built for the whole food chain</p>
					<h1>Why existing approaches are not enough.</h1>
					<p className="approaches-intro">Computer vision and portable sensing bring faster screening into the field. Laboratory validation and supply-chain data add the context to turn signals into useful evidence.</p>
					<Link to="/problem" className="button button-primary">Explore the problem <span aria-hidden="true">↗</span></Link>
				</div>
				<figure className="approaches-figure">
					<img src="https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=85" alt="Technician working with screening equipment in a laboratory" />
					<figcaption>Screening can guide attention. Laboratory testing confirms results.</figcaption>
				</figure>
			</div>
			<div className="comparison-section">
				<div className="comparison-heading">
					<p className="eyebrow eyebrow-dark">A connected response</p>
					<h2>From isolated checks to shared intelligence.</h2>
				</div>
				<div className="comparison-scroll" role="region" aria-label="Comparison of current approaches and FoodGuard responses" tabIndex={0}>
					<table className="comparison-table">
						<thead>
							<tr>
								<th scope="col">Current approach</th>
								<th scope="col">Limitation</th>
								<th scope="col">FoodGuard response</th>
							</tr>
						</thead>
						<tbody>
							{approachComparison.map(([approach, limitation, response]) => (
								<tr key={approach}>
									<td data-label="Current approach">{approach}</td>
									<td data-label="Limitation">{limitation}</td>
									<td data-label="FoodGuard response">{response}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<aside className="replacement-note">
					<p><strong>FoodGuard does not replace accredited laboratory testing or regulatory inspection.</strong> It is designed to strengthen screening, prioritisation, traceability and intelligence.</p>
				</aside>
				<div className="approaches-links">
					<Link to="/problem" className="text-link">The Problem <span aria-hidden="true">↗</span></Link>
					<a href="#partner" className="text-link">Partner with us <span aria-hidden="true">↗</span></a>
				</div>
			</div>
		</section>
	)
}

export function DigitalPassportPage() {
	return (
		<section className="passport-page">
			<header className="passport-hero">
				<p className="eyebrow eyebrow-dark">9. FoodGuard Digital Food Passport</p>
				<h1>Every Tested Batch Can Have a Digital Identity</h1>
				<p>A FoodGuard digital food passport could eventually contain:</p>
			</header>

			<div className="passport-grid">
				{passportSections.map((group) => (
					<article className="passport-card" key={group.title}>
						<h2>{group.title}</h2>
						<ul>
							{group.items.map((item) => <li key={item}>{item}</li>)}
						</ul>
					</article>
				))}
			</div>

			<div className="passport-qr-block">
				<div>
					<p className="eyebrow eyebrow-dark">QR Code</p>
					<h2>Traceability begins with a single scan.</h2>
				</div>
				<QRCodeCard />
			</div>

			<p className="passport-summary">This becomes the foundation for traceability and trusted food-market infrastructure.</p>
		</section>
	)
}

export function ReferenceDatabasePage() {
	return (
		<section className="reference-page">
			<header className="reference-hero">
				<p className="eyebrow eyebrow-dark">FoodGuard Reference Database</p>
				<h1>Building Nigeria&apos;s Food Safety Reference Intelligence</h1>
				<p>FoodGuard will establish validated reference datasets rather than training a generic “good food/bad food” model.</p>
			</header>

			<div className="reference-section-heading">
				<p className="eyebrow eyebrow-dark">Validated reference classes</p>
				<h2>Evidence before classification.</h2>
			</div>

			<div className="reference-grid">
				<article className="reference-entry">
					<p className="reference-label">Reference Class A</p>
					<h3>Verified Normal / Untreated Food</h3>
					<p>Food exhibiting expected characteristics without the target chemical treatment.</p>
				</article>
				<article className="reference-entry">
					<p className="reference-label">Reference Class B</p>
					<h3>Verified Chemically Treated Food</h3>
					<p>Reference samples associated with documented chemical-treatment conditions and laboratory measurements.</p>
				</article>
				<article className="reference-entry reference-entry-organic">
					<p className="reference-label">Reference Class C</p>
					<h3>Verified Organic Food</h3>
					<p>Food independently verified against the relevant organic production and verification criteria.</p>
					<p className="organic-caveat"><strong>Separate production-system reference:</strong> Organic status does not automatically mean contamination-free.</p>
				</article>
				<article className="reference-entry reference-entry-deterioration">
					<p className="reference-label">Reference Class D</p>
					<h3>Verified Spoiled / Deteriorated Food</h3>
					<p>Food showing validated deterioration characteristics, including reference information relating to:</p>
					<ul className="deterioration-list">
						<li>Over-ripening</li>
						<li>Mould and deterioration indicators</li>
						<li>Physical degradation</li>
						<li>Storage deterioration</li>
						<li>Moisture-related deterioration</li>
						<li>Freshness loss</li>
						<li>Temperature-abuse indicators, where measurable</li>
					</ul>
				</article>
			</div>

			<aside className="inconclusive-panel">
				<div>
					<p className="reference-label">Reference Class E</p>
					<h2>Unknown / Inconclusive</h2>
				</div>
				<div className="inconclusive-copy">
					<p className="inconclusive-principle">A critical scientific safeguard</p>
					<p>Where available evidence is insufficient, FoodGuard will not force a classification. The system will return:</p>
					<p className="inconclusive-outcome">Inconclusive — Further Testing Required</p>
					<p>This confidence-and-uncertainty approach avoids exaggerated AI claims and keeps further testing in view when evidence is limited.</p>
				</div>
			</aside>
		</section>
	)
}

export function TargetFoodCategoriesPage() {
	const [selectedCategory, setSelectedCategory] = useState(targetFoodCategories[0])

	return (
		<section className="categories-page">
			<header className="categories-hero">
				<p className="eyebrow eyebrow-dark">11. Target Food Categories</p>
				<h1>A focused start across high-value foods.</h1>
				<p>FoodGuard will initially focus on a limited number of high-value categories.</p>
			</header>

			<div className="category-selector" role="group" aria-label="Select a food category">
				{targetFoodCategories.map((category) => (
					<button
						className="category-selector-button"
						type="button"
						key={category.name}
						aria-pressed={selectedCategory.name === category.name}
						onClick={() => setSelectedCategory(category)}
					>
						{category.name}
					</button>
				))}
			</div>

			<section className="category-selection" aria-live="polite" aria-atomic="true">
				<div className="category-selection-heading">
					<p className="reference-label">Selected category</p>
					<h2>{selectedCategory.name}</h2>
				</div>
				<ul className="category-food-list">
					{selectedCategory.items.map((item) => <li key={item}>{item}</li>)}
				</ul>
			</section>

			<aside className="category-evidence-note">
				<p>The initial categories will be expanded as sufficient reference data, laboratory validation and sensor performance are established.</p>
				<p>The report specifically documents concerns and laboratory evidence across several of these categories.</p>
			</aside>
		</section>
	)
}

export function NotFoundPage() {
	return (
		<section className="not-found-page">
			<p className="eyebrow eyebrow-dark">Page not found</p>
			<h1>That page isn&apos;t here.</h1>
			<Link className="text-link" to="/">Return home <span aria-hidden="true">↗</span></Link>
		</section>
	)
}
