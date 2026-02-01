import { useState, useEffect, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, UserProfile } from '../lib/supabase'
import BetaSignupModal from './BetaSignupModal'
import { Sparkles } from 'lucide-react'

type AuthGateProps = {
  children: (
    user: User,
    profile: UserProfile,
    incrementDownloads: () => Promise<void>
  ) => ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [authLoading, setAuthLoading] = useState(false)
  const [showBetaModal, setShowBetaModal] = useState(false)

  const DOWNLOAD_LIMIT = 5

  useEffect(() => {
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          // Set temporary profile immediately to unblock UI
          setProfile({
            id: session.user.id,
            email: session.user.email || '',
            resume_downloads: 0,
            downloads_reset_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          // Then load real profile in background
          loadProfile(session.user.id, session.user.email)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      if (session?.user) {
        // Create a temporary profile to unblock the UI
        setProfile({
          id: session.user.id,
          email: session.user.email || '',
          resume_downloads: 0,
          downloads_reset_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        // Then load the real profile in background
        loadProfile(session.user.id, session.user.email)
      }
    } catch (err) {
      console.error('Error checking session:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadProfile(userId: string, userEmail?: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist - create it
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail || '',
            resume_downloads: 0,
            downloads_reset_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) throw insertError
        setProfile(newProfile)
        return
      }

      if (error) throw error

      // Check if 24 hours have passed since last reset
      if (data) {
        const resetAt = new Date(data.downloads_reset_at)
        const now = new Date()
        const hoursSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceReset >= 24) {
          // Reset downloads
          const { error: resetError } = await supabase
            .from('user_profiles')
            .update({
              resume_downloads: 0,
              downloads_reset_at: now.toISOString()
            })
            .eq('id', userId)

          if (!resetError) {
            setProfile({ ...data, resume_downloads: 0, downloads_reset_at: now.toISOString() })
            return
          }
        }
      }

      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAuthLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
      }
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    // Update UI immediately for responsiveness
    setUser(null)
    setProfile(null)
    // Then sign out in background
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  async function incrementDownloads() {
    if (!user || !profile) return

    const newCount = profile.resume_downloads + 1
    // Update UI immediately for responsiveness
    setProfile({ ...profile, resume_downloads: newCount })

    // Then persist to database in background (with timeout)
    try {
      const updatePromise = supabase
        .from('user_profiles')
        .update({ resume_downloads: newCount })
        .eq('id', user.id)

      // 5 second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database update timeout')), 5000)
      )

      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any
      if (error) throw error
    } catch (err) {
      console.error('Error incrementing downloads:', err)
      throw err
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in - show auth form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          {/* Early Access Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 mb-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100 bg-indigo-500/30 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  Early Access
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1">Curated Beta Program</h3>
              <p className="text-indigo-100 text-sm mb-4 leading-relaxed">
                We're currently accepting a limited number of new users into our exclusive early access phase.
              </p>
              <button
                onClick={() => setShowBetaModal(true)}
                className="w-full bg-white text-indigo-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition shadow-sm"
              >
                Request Invite
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Welcome to Forapplying</h1>
              <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                Optimize your resume to get past ATS systems and land more interviews. Free users get 5 downloads per day.
              </p>
              <p className="text-gray-500 mt-4 text-sm">
                {isLogin ? 'Sign in to continue' : 'Create your free account'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Free Trial Includes:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  5 free downloads per day
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  AI-powered ATS optimization
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Professional PDF formatting
                </li>
              </ul>
            </div>
          </div>
        </div>
        <BetaSignupModal isOpen={showBetaModal} onClose={() => setShowBetaModal(false)} />
      </div>
    )
  }

  // Limit reached - show daily limit message
  if (profile && profile.resume_downloads >= DOWNLOAD_LIMIT) {
    // Calculate time until reset
    const resetAt = new Date(profile.downloads_reset_at)
    const resetTime = new Date(resetAt.getTime() + 24 * 60 * 60 * 1000)
    const now = new Date()
    const hoursUntilReset = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60 * 60)))

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Limit Reached</h2>
            <p className="text-gray-600 mb-4">
              You've used all {DOWNLOAD_LIMIT} free downloads today. Come back tomorrow!
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Downloads reset in approximately {hoursUntilReset} hour{hoursUntilReset !== 1 ? 's' : ''}.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500">Signed in as</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated with downloads remaining
  if (profile) {
    const downloadsRemaining = DOWNLOAD_LIMIT - profile.resume_downloads
    const progressPercentage = (profile.resume_downloads / DOWNLOAD_LIMIT) * 100

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-bold text-gray-900">Forapplying</h1>

              <div className="flex items-center gap-6">
                <div className="hidden sm:block">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {downloadsRemaining} downloads remaining
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="w-24">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${downloadsRemaining <= 1 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                          style={{ width: `${100 - progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Mobile usage indicator */}
          <div className="sm:hidden border-t border-gray-100 px-4 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{user.email}</span>
              <span className="text-sm font-medium text-gray-900">
                {downloadsRemaining}/{DOWNLOAD_LIMIT} left
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${downloadsRemaining <= 1 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                style={{ width: `${100 - progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </header>

        <main>{children(user, profile, incrementDownloads)}</main>
      </div>
    )
  }

  // Fallback loading state while profile loads
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading profile...</p>
      </div>
    </div>
  )
}
