import { useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './auth-context.js'
import { supabase } from './lib/supabase.js'

export function AuthProvider({ children }) {
	const navigate = useNavigate()
	const [session, setSession] = useState(null)
	const [authEvent, setAuthEvent] = useState(null)
	const [authCallbackError, setAuthCallbackError] = useState('')
	const [loading, setLoading] = useState(Boolean(supabase))
	const processedCallbacks = useRef(new Set())

	useEffect(() => {
		if (!supabase) return undefined

		const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
			setAuthEvent(event)
			setSession(nextSession)
			setLoading(false)
		})

		return () => subscription.unsubscribe()
	}, [])

	useEffect(() => {
		if (!supabase || !Capacitor.isNativePlatform()) return undefined

		async function handleAuthCallback(url) {
			if (processedCallbacks.current.has(url)) return
			processedCallbacks.current.add(url)
			try {
				const callbackUrl = new URL(url)
				const params = new URLSearchParams(callbackUrl.search)
				const hashParams = new URLSearchParams(callbackUrl.hash.slice(1))
				const errorDescription = params.get('error_description') || hashParams.get('error_description')
				if (errorDescription) throw new Error(errorDescription)

				const code = params.get('code') || hashParams.get('code')
				const authType = params.get('type') || hashParams.get('type')
				if (code) {
					const { error } = await supabase.auth.exchangeCodeForSession(code)
					if (error) throw error
				} else {
					const accessToken = params.get('access_token') || hashParams.get('access_token')
					const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token')
					if (!accessToken || !refreshToken) return
					const { error } = await supabase.auth.setSession({
						access_token: accessToken,
						refresh_token: refreshToken,
					})
					if (error) throw error
				}

				if (authType === 'recovery') setAuthEvent('PASSWORD_RECOVERY')
				setAuthCallbackError('')
				navigate(callbackUrl.searchParams.get('audience') === 'consumer'
					? '/login?audience=consumer'
					: '/login', { replace: true })
			} catch (error) {
				setAuthCallbackError(error.message || 'Could not complete the email link. Please open FoodGuard and sign in again.')
				navigate('/login', { replace: true })
			}
		}

		const listener = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
			void handleAuthCallback(url)
		})
		void CapacitorApp.getLaunchUrl()
			.then((launch) => {
				if (launch?.url) return handleAuthCallback(launch.url)
				return undefined
			})
			.catch((error) => {
				setAuthCallbackError(error.message || 'Could not read the email link. Please open FoodGuard and sign in again.')
				navigate('/login', { replace: true })
			})

		return () => {
			void listener.then((subscription) => subscription.remove())
		}
	}, [navigate])

	return (
		<AuthContext.Provider value={{
			session,
			authEvent,
			authCallbackError,
			clearAuthCallbackError: () => setAuthCallbackError(''),
			loading,
		}}>
			{children}
		</AuthContext.Provider>
	)
}
