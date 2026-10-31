import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client.js'

const ADMIN_REFRESH_MS = 30_000

// Anything that changes a movement can change every movement-derived view.
function useInvalidateMovements() {
  const qc = useQueryClient()
  return () => Promise.all(
    [['me'], ['movements'], ['counts'], ['register'], ['monthly']].map((queryKey) => qc.invalidateQueries({ queryKey }))
  )
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api('/me')
      } catch (err) {
        if (err.status === 401) return null
        throw err
      }
    },
    staleTime: 30_000
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(['me'], null)
    }
  })
}

export function useAdmins() {
  return useQuery({ queryKey: ['admins'], queryFn: () => api('/admins'), staleTime: 5 * 60_000 })
}

// --- Staff: own movements ---

export function useTimeOut() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: (body) => api('/movements', { method: 'POST', body }),
    onSuccess: invalidate
  })
}

export function useRecordReturn() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: (id) => api(`/movements/${id}/return`, { method: 'PATCH' }),
    onSuccess: invalidate
  })
}

export function useEditDetails() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: ({ id, ...body }) => api(`/movements/${id}/details`, { method: 'PATCH', body }),
    onSuccess: invalidate
  })
}

export function useMyMovements(page) {
  return useQuery({
    queryKey: ['movements', 'mine', page],
    queryFn: () => api('/movements/mine', { query: { page } }),
    placeholderData: keepPreviousData
  })
}

// --- Admin ---

export function useCounts(enabled) {
  return useQuery({
    queryKey: ['counts'],
    queryFn: () => api('/admin/counts'),
    enabled,
    refetchInterval: ADMIN_REFRESH_MS
  })
}

export function useActiveMovements() {
  return useQuery({
    queryKey: ['movements', 'active'],
    queryFn: () => api('/movements/active'),
    refetchInterval: ADMIN_REFRESH_MS
  })
}

export function useMovements(filters) {
  return useQuery({
    queryKey: ['movements', 'list', filters],
    queryFn: () => api('/movements', { query: filters }),
    placeholderData: keepPreviousData
  })
}

export function useReview() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: ({ id, review, remark }) => api(`/movements/${id}/review`, { method: 'PATCH', body: { review, remark } }),
    onSuccess: invalidate
  })
}

export function useBulkReview() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: (body) => api('/movements/review/bulk', { method: 'POST', body }),
    onSuccess: invalidate
  })
}

export function useCorrect() {
  const invalidate = useInvalidateMovements()
  return useMutation({
    mutationFn: ({ id, ...body }) => api(`/movements/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate
  })
}

export function useAudit(id) {
  return useQuery({
    queryKey: ['movements', 'audit', id],
    queryFn: () => api(`/movements/${id}/audit`),
    enabled: Boolean(id)
  })
}

export function useRegister(from, to) {
  return useQuery({
    queryKey: ['register', from, to],
    queryFn: () => api('/register', { query: { from, to } }),
    enabled: Boolean(from && to)
  })
}

export function useMonthly(month) {
  return useQuery({
    queryKey: ['monthly', month],
    queryFn: () => api('/reports/monthly', { query: { month } }),
    enabled: Boolean(month),
    placeholderData: keepPreviousData
  })
}

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: () => api('/staff') })
}

export function useAddStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api('/staff', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] })
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api(`/staff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['staff'] }),
      qc.invalidateQueries({ queryKey: ['monthly'] })
    ])
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api('/settings') })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api('/settings', { method: 'PUT', body }),
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
      return Promise.all([['me'], ['movements'], ['counts'], ['register'], ['monthly']]
        .map((queryKey) => qc.invalidateQueries({ queryKey })))
    }
  })
}
