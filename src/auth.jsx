import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth-context.js'
import { supabase } from './lib/supabase.js'

const getAuthRedirectUrl = (forConsumer = false) => {
	const redirectUrl = Capacitor.isNativePlatform()
		? new URL('foodguard://login')
		: new URL('/login', import.meta.env.VITE_SITE_URL || window.location.origin)
	if (forConsumer) redirectUrl.searchParams.set('audience', 'consumer')
	return redirectUrl.toString()
}

export function RequireAuth({ children }) {
	const { session, loading } = useAuth()
	const location = useLocation()

	if (loading) {
		return <div className="auth-loading" role="status">Checking your session…</div>
	}

	if (!session) {
		return <Navigate to="/login" replace state={{ from: location }} />
	}

	return children
}

export function AccountPage() {
	const { session } = useAuth()
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	async function handleSignOut() {
		if (!supabase) {
			setError('Authentication is not configured.')
			return
		}
		setBusy(true)
		setError('')
		try {
			const { error: authError } = await supabase.auth.signOut()
			if (authError) throw authError
			navigate('/', { replace: true })
		} catch (authError) {
			setError(authError.message || 'Could not sign out. Please try again.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="account-page">
			<p className="eyebrow eyebrow-dark">Your FoodGuard account</p>
			<h1>Account</h1>
			<p className="account-description">You are signed in with this email address:</p>
			<p className="account-email">{session.user.email}</p>
			{error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
			<button className="auth-submit account-signout" disabled={busy} onClick={handleSignOut} type="button">
				{busy ? 'Signing out…' : 'Sign out'}
			</button>
		</section>
	)
}

export function AuthPage() {
	const location = useLocation()
	const { session, authEvent } = useAuth()
	const isSignUp = location.pathname === '/signup'
	const isPasswordRecovery = authEvent === 'PASSWORD_RECOVERY'
	const audience = new URLSearchParams(location.search).get('audience')
	const isConsumerFlow = audience === 'consumer'
	const destination = location.state?.from?.pathname || (isConsumerFlow ? '/consumer/dashboard' : '/dashboard')
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [confirmationPending, setConfirmationPending] = useState(false)

	useEffect(() => {
		if (session && !isPasswordRecovery) {
			navigate(destination, { replace: true })
		}
	}, [destination, isPasswordRecovery, navigate, session])

	async function handleSubmit(event) {
		event.preventDefault()
		setError('')
		setNotice('')

		if (!supabase) {
			setError('Authentication is not configured yet. Add your Supabase URL and anon key to the environment.')
			return
		}

		setBusy(true)
		try {
			if (isPasswordRecovery) {
				const { error: authError } = await supabase.auth.updateUser({ password })
				if (authError) throw authError
				navigate(destination, { replace: true })
			} else if (isSignUp) {
				const { data, error: authError } = await supabase.auth.signUp({
					email: email.trim(),
					password,
					options: {
						emailRedirectTo: getAuthRedirectUrl(isConsumerFlow),
						data: { account_type: isConsumerFlow ? 'consumer' : 'platform' },
					},
				})
				if (authError) throw authError

				if (data.session) {
					navigate(destination, { replace: true })
				} else {
					setConfirmationPending(true)
					setNotice('Check your email for a confirmation link to finish creating your account.')
				}
			} else {
				const { error: authError } = await supabase.auth.signInWithPassword({
					email: email.trim(),
					password,
				})
				if (authError) throw authError
				navigate(destination, { replace: true })
			}
		} catch (authError) {
			const message = authError.message || 'Something went wrong. Please try again.'
			if (isSignUp && /email rate limit exceeded|over_email_send_rate_limit/i.test(`${message} ${authError.code || ''}`)) {
				setError('Supabase is temporarily limiting confirmation emails. Check your inbox and spam folder, then wait before trying again. Site admins can raise the sending limit by configuring custom SMTP in Supabase.')
			} else {
				setError(message)
			}
		} finally {
			setBusy(false)
		}
	}

	async function handleResendConfirmation() {
		setError('')
		setNotice('')
		if (!supabase) {
			setError('Authentication is not configured yet. Add your Supabase URL and anon key to the environment.')
			return
		}

		setBusy(true)
		try {
			const { error: authError } = await supabase.auth.resend({
				type: 'signup',
				email: email.trim(),
				options: { emailRedirectTo: getAuthRedirectUrl(isConsumerFlow) },
			})
			if (authError) throw authError
			setNotice('If this address has an unconfirmed account, a new confirmation link is on its way. Check your inbox and spam folder.')
		} catch (authError) {
			const message = authError.message || 'Could not resend the confirmation email. Please try again later.'
			if (/email rate limit exceeded|over_email_send_rate_limit/i.test(`${message} ${authError.code || ''}`)) {
				setError('Supabase is temporarily limiting emails. Wait before requesting another link, or ask the site admin to configure custom SMTP in Supabase.')
			} else {
				setError(message)
			}
		} finally {
			setBusy(false)
		}
	}

	async function handlePasswordReset() {
		setError('')
		setNotice('')
		if (!email.trim()) {
			setError('Enter your email address first, then request a password reset.')
			return
		}
		if (!supabase) {
			setError('Authentication is not configured yet. Add your Supabase URL and anon key to the environment.')
			return
		}

		setBusy(true)
		try {
			const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
				redirectTo: getAuthRedirectUrl(isConsumerFlow),
			})
			if (authError) throw authError
			setNotice('If an account exists for that address, a password reset link is on its way.')
		} catch (authError) {
			setError(authError.message || 'Could not send a reset link. Please try again.')
		} finally {
			setBusy(false)
		}
	}

	if (!session && !audience && !isPasswordRecovery) {
		return (
			<section className="consumer-entry-page">
				<div className="consumer-entry-card">
					<p className="eyebrow eyebrow-dark">FoodGuard</p>
					<h1>Are you a Consumer?</h1>
					<div className="consumer-entry-actions">
						<Link
							className="button button-primary consumer-entry-button"
							to={`${location.pathname}?audience=consumer`}
						>
							Continue as a Consumer <span aria-hidden="true">↗</span>
						</Link>
						<Link className="consumer-entry-platform-link" to={`${location.pathname}?audience=platform`}>
							Continue to the FoodGuard platform
						</Link>
					</div>
				</div>
			</section>
		)
	}

	return (
		<section className="auth-page">
			<div className="auth-story">
				<div className="auth-story-shade" />
				<div className="auth-story-copy">
					<p className="eyebrow"><span /> FoodGuard AI Nigeria</p>
					<h1>{isSignUp ? 'Build a safer food system with us.' : 'Good to have you back.'}</h1>
					<p>Earlier detection. Better decisions. Safer food.</p>
				</div>
				<Link to="/" className="auth-home-link">← Back to FoodGuard</Link>
			</div>
			<div className="auth-panel">
				<div className="auth-form-wrap">
					<p className="eyebrow eyebrow-dark">
						{isPasswordRecovery ? 'Password reset' : isConsumerFlow ? 'Consumer access' : isSignUp ? 'Create your account' : 'Welcome back'}
					</p>
					<h2>{isPasswordRecovery ? 'Choose a new password' : isConsumerFlow && !isSignUp ? 'Consumer sign in' : isSignUp ? 'Join FoodGuard' : 'Sign in'}</h2>
					<p className="auth-description">
						{isPasswordRecovery
							? 'Enter a new password for your FoodGuard account.'
							: isConsumerFlow
								? isSignUp
									? 'Create a consumer account to check food and access safety information.'
									: 'Sign in to continue to your Consumer page.'
							: isSignUp
								? 'Create an account to continue to the FoodGuard platform.'
								: 'Sign in to continue to the FoodGuard platform.'}
					</p>
					<form className="auth-form" onSubmit={handleSubmit}>
						{!isPasswordRecovery && <>
							<label htmlFor="auth-email">Email address</label>
							<input
								autoComplete="email"
								autoFocus
								id="auth-email"
								name="email"
								onChange={(event) => setEmail(event.target.value)}
								placeholder="you@example.com"
								required
								type="email"
								value={email}
							/>
						</>}
						<label htmlFor="auth-password">Password</label>
						<div className="auth-password-field">
							<input
								autoComplete={isSignUp || isPasswordRecovery ? 'new-password' : 'current-password'}
								id="auth-password"
								minLength={6}
								name="password"
								onChange={(event) => setPassword(event.target.value)}
								placeholder={isSignUp || isPasswordRecovery ? 'At least 6 characters' : 'Your password'}
								required
								type={showPassword ? 'text' : 'password'}
								value={password}
							/>
							<button
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								aria-pressed={showPassword}
								className="auth-password-toggle"
								onClick={() => setShowPassword((visible) => !visible)}
								type="button"
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
						{!isSignUp && !isPasswordRecovery && (
							<button className="auth-reset" disabled={busy} onClick={handlePasswordReset} type="button">
								Forgot password?
							</button>
						)}
						{error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
						{notice && <p className="auth-feedback auth-notice" role="status">{notice}</p>}
						{isSignUp && confirmationPending && (
							<button className="auth-reset auth-resend" disabled={busy} onClick={handleResendConfirmation} type="button">
								{busy ? 'Sending…' : 'Resend confirmation email'}
							</button>
						)}
						<button className="auth-submit" disabled={busy} type="submit">
							{busy
								? 'Please wait…'
								: isPasswordRecovery
									? 'Update password'
									: isSignUp
										? 'Create account'
										: 'Sign in'}
						</button>
					</form>
					{!isPasswordRecovery && <p className="auth-switch">
						{isSignUp ? 'Already have an account?' : 'New to FoodGuard?'}{' '}
						<Link
							state={location.state}
							to={`${isSignUp ? '/login' : '/signup'}${audience ? `?audience=${audience}` : ''}`}
						>
							{isSignUp ? 'Sign in' : 'Create an account'}
						</Link>
					</p>}
				</div>
			</div>
		</section>
	)
}