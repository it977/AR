import { createContext, useContext, useState, useMemo } from 'react'

const FilterContext = createContext()

function queryDateParam(name) {
  if (typeof window === 'undefined') return ''
  const value = new URLSearchParams(window.location.search).get(name) || ''
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export function FilterProvider({ children }) {
  const [globalFilters, setGlobalFilters] = useState({
    dateFrom: queryDateParam('dateFrom'),
    dateTo: queryDateParam('dateTo'),
    workload: '',
    workloadDebt: '',
    customerType: '',
    gender: '',
    insiteOnsite: '',
    opdIpd: '',
    agingGroup: '',
    insurance: '',
  })

  const updateFilters = (newFilters) => {
    setGlobalFilters(prev => ({ ...prev, ...newFilters }))
  }

  const clearFilters = () => {
    setGlobalFilters({
      dateFrom: '',
      dateTo: '',
      workload: '',
      workloadDebt: '',
      customerType: '',
      gender: '',
      insiteOnsite: '',
      opdIpd: '',
      agingGroup: '',
      insurance: '',
    })
  }

  const value = useMemo(() => ({
    filters: globalFilters,
    updateFilters,
    clearFilters,
  }), [globalFilters])

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  )
}

export function useGlobalFilters() {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useGlobalFilters must be used within FilterProvider')
  }
  return context
}
