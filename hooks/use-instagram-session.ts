"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"

const IDENTITY_KEYS = ["ig_user_id", "ig_username", "ig_profile_pic"]

function clearIdentity() {
    IDENTITY_KEYS.forEach((key) => localStorage.removeItem(key))
}

function storeIdentity(id: string, username: string, profilePic?: string | null) {
    localStorage.setItem("ig_user_id", id)
    localStorage.setItem("ig_username", username)
    if (profilePic) localStorage.setItem("ig_profile_pic", profilePic)
}

export function useInstagramSession() {
    const [username, setUsername] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [profilePic, setProfilePic] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        const code = searchParams.get("code")

        /**
         * Adopt identity from the signed session cookie.
         * Returns true when a valid session exists.
         */
        const restoreFromCookie = async (): Promise<boolean> => {
            try {
                const res = await fetch("/api/session", { cache: "no-store" })
                if (!res.ok) return false
                const session = await res.json()
                setUserId(session.userId)
                setUsername(session.username || null)
                setProfilePic(localStorage.getItem("ig_profile_pic"))
                storeIdentity(session.userId, session.username || "")
                return true
            } catch (err) {
                console.error("Session restore failed:", err)
                return false
            }
        }

        const handleSession = async () => {
            // CASE A: New Login from Instagram
            if (code) {
                let loggedIn = false
                try {
                    const res = await fetch("/api/instagram/callback", {
                        method: "POST",
                        body: JSON.stringify({ code }),
                    })
                    const data = await res.json()

                    if (data.success) {
                        storeIdentity(data.userId, data.username, data.profilePic)
                        setUserId(data.userId)
                        setUsername(data.username)
                        setProfilePic(data.profilePic || null)
                        loggedIn = true
                        // Remove code from URL
                        router.replace("/dashboard")
                    }
                } catch (err) {
                    console.error("Login failed:", err)
                }

                // The callback can reject a code that a parallel effect already
                // consumed (React StrictMode in dev). In that case a session may
                // still exist — adopt it instead of clearing a good login.
                if (!loggedIn) {
                    const restored = await restoreFromCookie()
                    if (!restored) {
                        clearIdentity()
                        setUserId(null)
                        setUsername(null)
                        setProfilePic(null)
                    }
                }
            }
            // CASE B: restore from the signed session cookie
            // (localStorage is display-only; never trusted as identity).
            else {
                const restored = await restoreFromCookie()
                if (!restored) {
                    clearIdentity()
                    setUserId(null)
                    setUsername(null)
                    setProfilePic(null)
                }
            }
            setIsLoading(false)
        }

        handleSession()
    }, [searchParams, router])

    const logout = useCallback(async () => {
        try {
            await fetch("/api/session", { method: "DELETE" })
        } catch (err) {
            console.error("Logout failed:", err)
        }
        clearIdentity()
        setUsername(null)
        setUserId(null)
        setProfilePic(null)
        router.push("/")
    }, [router])

    return { userId, username, profilePic, isLoading, logout }
}
