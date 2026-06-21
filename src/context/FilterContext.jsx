import { createContext, useContext, useState, useMemo } from 'react'

const FilterContext = createContext()

export function FilterProvider({ children }) {
  const [globalFilters, setGlobalFilters] = useState({
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
