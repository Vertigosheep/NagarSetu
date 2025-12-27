import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User as SupabaseUser, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useToast } from "@/components/ui/use-toast"
import { User, UserType } from '@/types'
import { userService } from '@/services/supabaseService'
import { validateAuthorityAccessCode, sanitizeAccessCode } from '@/utils/authValidation'
import { getErrorMessage } from '@/lib/utils'

interface AuthContextType {
  // User state
  currentUser: SupabaseUser | null
  userProfile: User | null
  session: Session | null
  loading: boolean
  isNewUser: boolean
  
  // Auth methods
  signUp: (
    email: string, 
    password: string, 
    name: string, 
    userType?: UserType, 
    department?: string,
    authorityAccessCode?: string
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  logOut: () => Promise<void>
  
  // Profile methods
  updateProfile: (profileData: Partial<User>) => Promise<void>
  refreshProfile: () => Promise<void>
  
  // Utility methods
  isAuthority: () => boolean
  isCitizen: () => boolean
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const { toast } = useToast()

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout - forcing loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  // Load user profile
  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const profile = await userService.getProfile(userId)
      setUserProfile(profile)
      
      if (!profile) {
        setIsNewUser(true)
      } else if (!profile.is_onboarding_complete) {
        setIsNewUser(true)
      } else {
        setIsNewUser(false)
      }
    } catch (error) {
      console.error("Error loading user profile:", error)
      setIsNewUser(true)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCurrentUser(session?.user ?? null)
      
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user ? 'User logged in' : 'No user')
      setSession(session)
      setCurrentUser(session?.user ?? null)
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setUserProfile(null)
        setIsNewUser(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserProfile])

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    userType: UserType = 'citizen', 
    department?: string,
    authorityAccessCode?: string
  ) => {
    try {
      console.log('Attempting to sign up:', email, 'as', userType)
      
      // Validate authority access code if signing up as authority
      if (userType === 'authority') {
        if (!authorityAccessCode) {
          throw new Error('Authority access code is required for authority accounts')
        }
        
        const sanitizedCode = sanitizeAccessCode(authorityAccessCode)
        const isValidCode = await validateAuthorityAccessCode(sanitizedCode)
        
        if (!isValidCode) {
          throw new Error('Invalid authority access code')
        }
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      })

      if (error) throw error

      if (data.user) {
        setIsNewUser(true)
        
        // Create user profile in database
        try {
          const profile = await userService.createProfile({
            id: data.user.id,
            email: data.user.email || email,
            full_name: name,
            user_type: userType,
            department: userType === 'authority' ? department : undefined,
            is_onboarding_complete: false,
          })
          
          setUserProfile(profile)
          console.log('User profile created successfully')
        } catch (profileError) {
          console.error('Error creating user profile:', profileError)
          // Don't throw here, as the auth user was created successfully
        }
        
        console.log('User signed up successfully')
        
        toast({
          title: "Account created",
          description: "Please check your email to verify your account.",
        })
      }
    } catch (error: any) {
      console.error("Sign up error:", error)
      
      const errorMessage = getErrorMessage(error)
      let userFriendlyMessage = errorMessage
      
      if (errorMessage.includes('already registered')) {
        userFriendlyMessage = "An account with this email already exists"
      } else if (errorMessage.includes('invalid email')) {
        userFriendlyMessage = "Please enter a valid email address"
      } else if (errorMessage.includes('password')) {
        userFriendlyMessage = "Password should be at least 6 characters"
      } else if (errorMessage.includes('Invalid authority access code')) {
        userFriendlyMessage = "Invalid authority access code. Please contact your administrator."
      } else if (errorMessage.includes('Authority access code is required')) {
        userFriendlyMessage = "Authority access code is required for authority accounts"
      }
      
      toast({
        title: "Sign up failed",
        description: userFriendlyMessage,
        variant: "destructive",
      })
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      console.log('User signed in successfully')
    } catch (error: any) {
      console.error("Sign in error:", error)
      let errorMessage = "Sign in failed"
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = "Invalid email or password"
      } else if (error.message?.includes('invalid email')) {
        errorMessage = "Please enter a valid email address"
      } else {
        errorMessage = error.message || "Sign in failed"
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      })
      throw error
    }
  }

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      console.log('Attempting Google sign in')
      
      // Store redirect URL for after authentication
      if (redirectTo) {
        sessionStorage.setItem('auth_redirect_to', redirectTo)
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
      
      console.log('Google sign in initiated - redirecting to Google...')
      // Note: The user will be redirected to Google, so no further code executes here
    } catch (error: any) {
      console.error("Google sign in error:", error)
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        status: error.status
      })
      
      let errorMessage = "Google sign in failed"
      let helpText = ""
      
      if (error.message?.includes('OAuth') || error.message?.includes('provider')) {
        errorMessage = "Google authentication is not configured"
        helpText = "Please set up Google OAuth in your Supabase dashboard under Authentication > Providers"
      } else if (error.message?.includes('Invalid login credentials')) {
        errorMessage = "Google authentication failed"
        helpText = "Please try again or contact support if the issue persists"
      } else if (error.message?.includes('redirect')) {
        errorMessage = "Redirect URL configuration error"
        helpText = "Please check your Google Cloud Console and Supabase redirect URL settings"
      } else {
        errorMessage = error.message || "Google sign in failed"
        helpText = "Please check the browser console for more details"
      }
      
      toast({
        title: errorMessage,
        description: helpText,
        variant: "destructive",
      })
      throw error
    }
  }

  const logOut = async () => {
    try {
      console.log('Attempting to sign out')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      console.log('User signed out successfully')
    } catch (error: any) {
      console.error("Sign out error:", error)
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      })
      throw error
    }
  }

  // Profile management methods
  const updateProfile = async (profileData: Partial<User>) => {
    if (!currentUser) {
      throw new Error('No user logged in')
    }
    
    try {
      const updatedProfile = await userService.updateProfile(currentUser.id, profileData)
      setUserProfile(updatedProfile)
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      })
      throw error
    }
  }

  const refreshProfile = async () => {
    if (!currentUser) return
    
    try {
      await loadUserProfile(currentUser.id)
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }

  // Utility methods
  const isAuthority = () => userProfile?.user_type === 'authority'
  const isCitizen = () => userProfile?.user_type === 'citizen'
  
  const hasPermission = (permission: string) => {
    if (!userProfile) return false
    
    // Basic permission system - can be expanded
    switch (permission) {
      case 'manage_issues':
        return isAuthority()
      case 'assign_issues':
        return isAuthority()
      case 'create_events':
        return isAuthority()
      case 'report_issues':
        return true // All users can report issues
      case 'comment_issues':
        return true // All users can comment
      default:
        return false
    }
  }

  const value = {
    // User state
    currentUser,
    userProfile,
    session,
    loading,
    isNewUser,
    
    // Auth methods
    signUp,
    signIn,
    signInWithGoogle,
    logOut,
    
    // Profile methods
    updateProfile,
    refreshProfile,
    
    // Utility methods
    isAuthority,
    isCitizen,
    hasPermission,
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600">Initializing Nagar Setu...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}