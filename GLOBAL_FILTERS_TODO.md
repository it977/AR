# Global Filters - Manual Updates Required

## Pages to Update:

### 1. DailySales.jsx ✅ DONE
- Import: `import { useGlobalFilters } from '../context/FilterContext'`
- Replace: `const [filters, setFilters] = useState(...)` with `const { filters, updateFilters } = useGlobalFilters()`
- Update onChange: `onChange={updateFilters}` for DateFilter
- Update onChange: `onChange={v => updateFilters({ workload: v })}` for FilterSelect

### 2. CustomerService.jsx ✅ DONE
- Already updated

### 3. PaymentChannel.jsx
```jsx
// Add import
import { useGlobalFilters } from '../context/FilterContext'

// Replace state
const { filters, updateFilters } = useGlobalFilters()

// Update onChange handlers in JSX
<DateFilter filters={filters} onChange={updateFilters} />
<FilterSelect onChange={v => updateFilters({ customerType: v })} />
```

### 4. OutstandingDebt.jsx
```jsx
// Add import
import { useGlobalFilters } from '../context/FilterContext'

// Replace state
const { filters, updateFilters } = useGlobalFilters()
```

### 5. AgingReport.jsx
```jsx
// Add import
import { useGlobalFilters } from '../context/FilterContext'

// Replace state
const { filters, updateFilters } = useGlobalFilters()
```

## Multi-Page PDF Export

The PDF export needs to capture all pages. This requires:
1. Fetch data for all pages
2. Create separate sections for each page
3. Generate PDF with proper page breaks

This is complex and may require a backend solution for proper PDF generation.
