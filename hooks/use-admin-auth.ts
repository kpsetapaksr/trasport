'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentAdmin, getToken, clearAdminSession } from '@/lib/storage'
import type { Admin } from '@/lib/types'

export function useAdminAuth() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const currentAdmin = getCurrentAdmin()
    const token = getToken()

    // Require both admin data AND a valid token
    if (!currentAdmin || !token) {
      clearAdminSession()
      setIsLoading(false)
      router.push('/login')
      return
    }

    setAdmin(currentAdmin)
    setIsLoading(false)
  }, [router])

  const logout = () => {
    clearAdminSession()
    setAdmin(null)
    router.push('/login')
  }

  return { admin, isLoading, logout }
}
