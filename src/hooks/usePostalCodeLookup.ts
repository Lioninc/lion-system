import { useCallback, useRef, useState } from 'react'
import type { UseFormSetValue } from 'react-hook-form'

interface AddressFields {
  prefecture?: string
  city?: string
  address?: string
}

export function usePostalCodeLookup(setValue: UseFormSetValue<any>) {
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handlePostalCodeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '')
      if (raw.length !== 7) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setSearching(true)
      try {
        const res = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${raw}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (json.results && json.results.length > 0) {
          const result = json.results[0]
          setValue('prefecture', result.address1, { shouldDirty: true })
          setValue('city', result.address2 + result.address3, { shouldDirty: true })
        }
      } catch {
        // abort or network error - ignore
      } finally {
        setSearching(false)
      }
    },
    [setValue]
  )

  return { handlePostalCodeChange, searching }
}
