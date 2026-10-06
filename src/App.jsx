import './App.css'
import { useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ApproachesPage, DigitalPassportPage, HomePage, NotFoundPage, ProblemPage, ReferenceDatabasePage, TargetFoodCategoriesPage } from './pages.jsx'
import { AccountPage, AuthPage, RequireAuth } from './auth.jsx'
import { DashboardPage } from './dashboard.jsx'
import { useAuth } from './auth-context.js'
import { supabase } from './lib/supabase.js'

function App() {
	const location = useLocation()
	const isAuthRoute = ['/login', '/signup'].includes(location.pathname)
	const { session, loading, authEvent, authCallbackError, clearAuthCallbackError } = useAuth()
	const isPasswordRecovery = authEvent === 'PASSWORD_RECOVERY'
	const navigate = useNavigate()
	const [signOutError, setSignOutError] = useState('')
	const [signingOut, setSigningOut] = useState(false)

	async function handleSignOut() {
		if (!supabase) {
			setSignOutError('Authentication is not configured.')
			return
		}

		setSignOutError('')
		setSigningOut(true)
		try {
			const { error } = await supabase.auth.signOut()
			if (error) throw error
			navigate('/', { replace: true })
		} catch (error) {
			setSignOutError(error.message || 'Could not sign out. Please try again.')
		} finally {
			setSigningOut(false)
		}
	}

	if (loading) {
		return <main className="auth-loading" role="status">Loading FoodGuard…</main>
	}

	return (
		<main className={session && !isPasswordRecovery ? 'dashboard-shell' : isAuthRoute ? 'auth-shell' : undefined}>
			{session && !isPasswordRecovery ? (
				<header className="dashboard-header">
					<Link className="brand" to="/dashboard" aria-label="FoodGuard dashboard">
						<span className="brand-mark" aria-hidden="true">F</span>
						<span>FoodGuard <b>AI Nigeria</b></span>
					</Link>
					<button className="header-signout" disabled={signingOut} onClick={handleSignOut} type="button">
						{signingOut ? 'Signing out…' : 'Sign out'}
					</button>
					{signOutError && <p className="header-signout-error" role="alert">{signOutError}</p>}
				</header>
			) : !isAuthRoute && <header className="site-header">
				<Link className="brand" to="/" aria-label="FoodGuard AI Nigeria home">
					<span className="brand-mark" aria-hidden="true">F</span>
					<span>FoodGuard <b>AI Nigeria</b></span>
				</Link>
				<nav className="main-nav" aria-label="Main navigation">
					<NavLink to="/" end>Home</NavLink>
					<NavLink to="/problem">The Problem</NavLink>
					<NavLink to="/why-existing-approaches">Why Existing Approaches</NavLink>
					<NavLink to="/reference-database">Reference Database</NavLink>
					<NavLink to="/digital-food-passport">Digital Food Passport</NavLink>
				</nav>
				<div className="header-auth-actions">
					<Link className="header-cta" to="/login">Sign in</Link>
					<Link className="header-cta" to="/signup">Create account <span aria-hidden="true">↗</span></Link>
				</div>
				{signOutError && <p className="header-signout-error" role="alert">{signOutError}</p>}
			</header>}

			{session && !isPasswordRecovery ? <Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes> : session ? <AuthPage /> : <Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/problem" element={<ProblemPage />} />
				<Route path="/why-existing-approaches" element={<ApproachesPage />} />
				<Route path="/reference-database" element={<ReferenceDatabasePage />} />
				<Route path="/digital-food-passport" element={<DigitalPassportPage />} />
				<Route path="/target-food-categories" element={<TargetFoodCategoriesPage />} />
				<Route path="/login" element={<AuthPage />} />
				<Route path="/signup" element={<AuthPage />} />
				<Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
				<Route path="/dashboard" element={<Navigate to="/" replace />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>}

			{authCallbackError && <p className="auth-feedback auth-error" role="alert">
				{authCallbackError}
				<button className="auth-switch" onClick={clearAuthCallbackError} type="button">Dismiss</button>
			</p>}

			{!session && !isAuthRoute && <footer className="site-footer">
				<Link className="brand footer-brand" to="/">
					<span className="brand-mark" aria-hidden="true">F</span>
					<span>FoodGuard <b>AI Nigeria</b></span>
				</Link>
				<p id="partner">Earlier detection. Better decisions. Safer food.</p>
				<Link to="/problem" className="footer-contact">About the initiative <span aria-hidden="true">↗</span></Link>
			</footer>}
		</main>
	)
}

export default App
