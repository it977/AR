import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'ar-finance-language'

function normalizeLanguage(value) {
  return value === 'en' || value === 'lo' ? value : null
}

function getInitialLanguage() {
  const queryLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'))
  if (queryLanguage) {
    localStorage.setItem(STORAGE_KEY, queryLanguage)
    return queryLanguage
  }
  return normalizeLanguage(localStorage.getItem(STORAGE_KEY)) || 'lo'
}

const enToLo = {
  'AR Finance System': 'ລະບົບການເງິນ AR',
  'OneMeds Dashboard': 'ແດຊບອດ OneMeds',
  'AR Finance': 'ການເງິນ AR',
  Other: 'ອື່ນໆ',
  Admin: 'ຜູ້ດູແລ',
  Logout: 'ອອກຈາກລະບົບ',
  'Auto-hide': 'ເຊື່ອງອັດຕະໂນມັດ',
  User: 'ຜູ້ໃຊ້',

  'Bill Management': 'ຈັດການໃບບິນ',
  'Debt Management': 'ຈັດການໜີ້',
  'Daily Report': 'ລາຍງານປະຈຳວັນ',
  'Customers & Services': 'ລູກຄ້າ ແລະ ບໍລິການ',
  'Customers and Services': 'ລູກຄ້າ ແລະ ບໍລິການ',
  'Payment Channels': 'ຊ່ອງທາງຊຳລະ',
  'Outstanding Debt': 'ໜີ້ຄ້າງ',
  'Aging Report': 'ລາຍງານອາຍຸໜີ້',
  'Upload Excel': 'ອັບໂຫຼດ Excel',
  'Upload Data': 'ອັບໂຫຼດຂໍ້ມູນ',
  'General Settings': 'ຕັ້ງຄ່າທົ່ວໄປ',
  RBAC: 'ສິດຜູ້ໃຊ້',
  'Users & Permissions': 'ຜູ້ໃຊ້ ແລະ ສິດ',

  'Download PDF': 'ດາວໂຫຼດ PDF',
  Template: 'ແບບຟອມ',
  'Export Excel': 'ສົ່ງອອກ Excel',
  Export: 'ສົ່ງອອກ',
  Exporting: 'ກຳລັງສົ່ງອອກ',
  'Add user': 'ເພີ່ມຜູ້ໃຊ້',
  Add: 'ເພີ່ມ',
  Edit: 'ແກ້ໄຂ',
  Delete: 'ລຶບ',
  Save: 'ບັນທຶກ',
  Cancel: 'ຍົກເລີກ',
  Close: 'ປິດ',
  Search: 'ຄົ້ນຫາ',
  'No data': 'ບໍ່ມີຂໍ້ມູນ',
  'Loading data...': 'ກຳລັງໂຫຼດຂໍ້ມູນ...',

  All: 'ທັງໝົດ',
  Today: 'ມື້ນີ້',
  '7 Days': '7 ມື້',
  '30 Days': '30 ມື້',
  '90 Days': '90 ມື້',
  'All Terms': 'ທຸກເງື່ອນໄຂ',
  'All Customer Type': 'ທຸກປະເພດລູກຄ້າ',
  'All OPD/IPD': 'ທຸກ OPD/IPD',
  'All Shift': 'ທຸກກະ',
  'Search insurance...': 'ຄົ້ນຫາປະກັນ...',
  'Search company...': 'ຄົ້ນຫາບໍລິສັດ...',
  'Search by bill, patient...': 'ຄົ້ນຫາເລກບິນ, ຊື່ຄົນເຈັບ...',

  'Pending Insurance Submission': 'ລໍຖ້າສົ່ງເອກະສານປະກັນ',
  'Pending Submission': 'ລໍຖ້າສົ່ງເອກະສານ',
  'Pending Insurance Payment': 'ລໍຖ້າປະກັນຊຳລະ',
  'Pending Payment': 'ລໍຖ້າຊຳລະ',
  'Collection Term Summary': 'ສະຫຼຸບເງື່ອນໄຂການເກັບເງິນ',
  'Bill totals by collection term': 'ຍອດບິນຕາມເງື່ອນໄຂການເກັບເງິນ',
  'Denied Claims': 'ເຄຣມຖືກປະຕິເສດ',
  'Outstanding Receivables': 'ໜີ້ຄ້າງຮັບ',
  'Current Receivables': 'ໜີ້ຍັງບໍ່ຮອດກຳນົດ',
  'Past Due Receivables': 'ໜີ້ເກີນກຳນົດ',
  Current: 'ປັດຈຸບັນ',
  Pending: 'ລໍຖ້າ',
  Overdue: 'ເກີນກຳນົດ',
  Paid: 'ຊຳລະແລ້ວ',
  Bills: 'ບິນ',
  bills: 'ບິນ',
  items: 'ລາຍການ',

  'Paid Amount': 'ຍອດຊຳລະແລ້ວ',
  Cash: 'ເງິນສົດ',
  Transfer: 'ໂອນເງິນ',
  'Cash/Transfer': 'ເງິນສົດ/ໂອນ',
  Transacted: 'ທຳລາຍການແລ້ວ',
  Deposit: 'ເງິນມັດຈຳ',
  Advance: 'ເງິນລ່ວງໜ້າ',
  'Payment Type': 'ປະເພດຊຳລະ',
  'Payment channel analysis - Unit: LAK': 'ວິເຄາະຊ່ອງທາງຊຳລະ - ຫົວໜ່ວຍ: LAK',
  'Payment channel proportion': 'ສັດສ່ວນຊ່ອງທາງຊຳລະ',
  'Payment Channel Summary': 'ສະຫຼຸບຊ່ອງທາງຊຳລະ',

  'Total Debt': 'ໜີ້ລວມ',
  'Total outstanding debt': 'ໜີ້ຄ້າງລວມ',
  'Total Outstanding Debt': 'ໜີ້ຄ້າງລວມ',
  'Total outstanding amount': 'ຍອດໜີ້ຄ້າງລວມ',
  Collected: 'ເກັບໄດ້',
  Remaining: 'ຍັງເຫຼືອ',
  'Remaining Balance': 'ຍອດຍັງເຫຼືອ',
  'Outstanding debt report': 'ລາຍງານໜີ້ຄ້າງ',
  'Debt by Customer Type': 'ໜີ້ຕາມປະເພດລູກຄ້າ',
  'Outstanding debt by customer type': 'ໜີ້ຄ້າງຕາມປະເພດລູກຄ້າ',
  'Outstanding Debt Trend': 'ແນວໂນ້ມໜີ້ຄ້າງ',
  'Outstanding debt trend': 'ແນວໂນ້ມໜີ້ຄ້າງ',
  'Outstanding Debt List': 'ລາຍການໜີ້ຄ້າງ',

  'Debt by Aging Bucket': 'ໜີ້ຕາມກຸ່ມອາຍຸໜີ້',
  'Debt amount by aging bucket (LAK)': 'ຍອດໜີ້ຕາມກຸ່ມອາຍຸໜີ້ (LAK)',
  'Aging Share': 'ສັດສ່ວນອາຍຸໜີ້',
  'Aging proportion': 'ສັດສ່ວນອາຍຸໜີ້',
  'Outstanding Debt by Insurance Company': 'ໜີ້ຄ້າງຕາມບໍລິສັດປະກັນ',
  'Insurance Company': 'ບໍລິສັດປະກັນ',
  'Debt Amount (LAK)': 'ຍອດໜີ້ (LAK)',
  '1-15 Days': '1-15 ມື້',
  '16-30 Days': '16-30 ມື້',
  '31-45 Days': '31-45 ມື້',
  '46-90 Days': '46-90 ມື້',

  'Before Discounts': 'ກ່ອນສ່ວນຫຼຸດ',
  'BEFORE DISCOUNTS': 'ກ່ອນສ່ວນຫຼຸດ',
  'Discount Amount': 'ຍອດສ່ວນຫຼຸດ',
  'DISCOUNT AMOUNT': 'ຍອດສ່ວນຫຼຸດ',
  'Actual Net Sales': 'ຍອດຂາຍສຸດທິ',
  'ACTUAL NET SALES': 'ຍອດຂາຍສຸດທິ',
  'Total Bill Count': 'ຈຳນວນບິນລວມ',
  'TOTAL BILL COUNT': 'ຈຳນວນບິນລວມ',
  'Total Customer Count': 'ຈຳນວນລູກຄ້າລວມ',
  'TOTAL CUSTOMER COUNT': 'ຈຳນວນລູກຄ້າລວມ',
  'Sales Breakdown': 'ລາຍລະອຽດຍອດຂາຍ',
  'Bill Breakdown': 'ລາຍລະອຽດບິນ',
  'Sale Revenue / Day': 'ລາຍຮັບຂາຍ/ມື້',
  'Cash In / Day': 'ເງິນສົດເຂົ້າ/ມື້',
  'Collection From Unpaid / Day': 'ເກັບຈາກບິນຄ້າງ/ມື້',
  'Paid Bill / Day': 'ບິນຊຳລະແລ້ວ/ມື້',
  'Unpaid Bill / Day': 'ບິນຄ້າງ/ມື້',
  'Discounts Bill / Day': 'ບິນມີສ່ວນຫຼຸດ/ມື້',
  'Collected Bill': 'ບິນເກັບໄດ້',

  Date: 'ວັນທີ',
  DATE: 'ວັນທີ',
  'Bill No.': 'ເລກບິນ',
  'Bill No': 'ເລກບິນ',
  BILLS: 'ບິນ',
  HN: 'HN',
  'Patient Name': 'ຊື່ຄົນເຈັບ',
  'PATIENT NAME': 'ຊື່ຄົນເຈັບ',
  Type: 'ປະເພດ',
  TYPE: 'ປະເພດ',
  Insurance: 'ປະກັນ',
  INSURANCE: 'ປະກັນ',
  'Grand Total': 'ຍອດລວມ',
  'GRAND TOTAL': 'ຍອດລວມ',
  Balance: 'ຍອດຄ້າງ',
  Aging: 'ອາຍຸໜີ້',
  AGING: 'ອາຍຸໜີ້',
  Status: 'ສະຖານະ',
  STATUS: 'ສະຖານະ',
  Actions: 'ຈັດການ',
  ACTIONS: 'ຈັດການ',
  Recorder: 'ຜູ້ບັນທຶກ',
  'Payment Date': 'ວັນທີຊຳລະ',
  'Bill Date': 'ວັນທີບິນ',
  Payment: 'ຊຳລະ',
  'Submission Date': 'ວັນທີສົ່ງເອກະສານ',
  Rows: 'ຈຳນວນແຖວ',
  days: 'ມື້',
  'Overdue Days': 'ຄ້າງ',
  Due: 'ກຳນົດຊຳລະ',
  DUE: 'ກຳນົດຊຳລະ',
}

const loToEn = {
  'ລະບົບການເງິນ AR': 'AR Finance System',
  'ແດຊບອດ OneMeds': 'OneMeds Dashboard',
  'ການເງິນ AR': 'AR Finance',
  'ອື່ນໆ': 'Other',
  'ຜູ້ດູແລ': 'Admin',
  'ອອກຈາກລະບົບ': 'Logout',
  'ຈັດການໃບບິນ': 'Bill Management',
  'ຈັດການໜີ້': 'Debt Management',
  'ລາຍງານປະຈຳວັນ': 'Daily Report',
  'ລູກຄ້າ ແລະ ບໍລິການ': 'Customers & Services',
  'ຊ່ອງທາງຊຳລະ': 'Payment Channels',
  'ໜີ້ຄ້າງ': 'Outstanding Debt',
  'ລາຍງານອາຍຸໜີ້': 'Aging Report',
  'ອັບໂຫຼດ Excel': 'Upload Excel',
  'ອັບໂຫຼດຂໍ້ມູນ': 'Upload Data',
  'ຕັ້ງຄ່າທົ່ວໄປ': 'General Settings',
  'ສິດຜູ້ໃຊ້': 'RBAC',
  'ຜູ້ໃຊ້ ແລະ ສິດ': 'Users & Permissions',
  'ດາວໂຫຼດ PDF': 'Download PDF',
  'ດາວໂຫຼດ Template': 'Download Template',
  'ແບບຟອມ': 'Template',
  'ສົ່ງອອກ Excel': 'Export Excel',
  'ສົ່ງອອກ': 'Export',
  'ເພີ່ມ': 'Add',
  'ເພີ່ມໃບບິນ': 'Add Bill',
  'ແກ້ໄຂ': 'Edit',
  'ລຶບ': 'Delete',
  'ບັນທຶກ': 'Save',
  'ຍົກເລີກ': 'Cancel',
  'ປິດ': 'Close',
  'ຄົ້ນຫາ': 'Search',
  'ບໍ່ມີຂໍ້ມູນ': 'No data',
  'ທັງໝົດ': 'All',
  'ທັງໝົດ ': 'All',
  'ມື້ນີ້': 'Today',
  'ທຸກເງື່ອນໄຂ': 'All Terms',
  'ທຸກປະເພດລູກຄ້າ': 'All Customer Type',
  'ທຸກກະ': 'All Shift',
  'ລໍຖ້າສົ່ງເອກະສານປະກັນ': 'Pending Insurance Submission',
  'ລໍຖ້າປະກັນຊຳລະ': 'Pending Insurance Payment',
  'ສະຫຼຸບເງື່ອນໄຂການເກັບເງິນ': 'Collection Term Summary',
  'ຍອດບິນຕາມເງື່ອນໄຂການເກັບເງິນ': 'Bill totals by collection term',
  'ເຄຣມຖືກປະຕິເສດ': 'Denied Claims',
  'ໜີ້ຄ້າງຮັບ': 'Outstanding Receivables',
  'ໜີ້ຍັງບໍ່ຮອດກຳນົດ': 'Current Receivables',
  'ໜີ້ເກີນກຳນົດ': 'Past Due Receivables',
  'ຊຳລະແລ້ວ': 'Paid',
  'ລໍຖ້າ': 'Pending',
  'ບິນ': 'bills',
  'ເງິນສົດ': 'Cash',
  'ໂອນເງິນ': 'Transfer',
  'ເງິນສົດ/ໂອນ': 'Cash/Transfer',
  'ປະເພດຊຳລະ': 'Payment Type',
  'ໜີ້ລວມ': 'Total Debt',
  'ເກັບໄດ້': 'Collected',
  'ຍັງເຫຼືອ': 'Remaining',
  'ຍອດຍັງເຫຼືອ': 'Remaining Balance',
  'ລາຍງານໜີ້ຄ້າງ': 'Outstanding debt report',
  'ວັນທີ': 'Date',
  'ວັນທີບິນ': 'Bill Date',
  'ວັນທີຊຳລະ': 'Payment Date',
  'ວັນທີຊຳລະບີນ': 'Payment Date',
  'ເລືອກບີນວັນທີ': 'Bill Date',
  'ເລກບິນ': 'Bill No.',
  'ຊື່ຄົນເຈັບ': 'Patient Name',
  'ປະເພດ': 'Type',
  'ປະກັນ': 'Insurance',
  'ຍອດລວມ': 'Grand Total',
  'ຍອດຄ້າງ': 'Balance',
  'ອາຍຸໜີ້': 'Aging',
  'ຊຳລະ': 'Payment',
  'ສົ່ງເອກະສານ': 'Submission Date',
  '1-15 ມື້': '1-15 Days',
  '16-30 ມື້': '16-30 Days',
  '31-45 ມື້': '31-45 Days',
  '46-90 ມື້': '46-90 Days',
  'ສະຖານະ': 'Status',
  'ຈັດການ': 'Actions',
  'ຜູ້ບັນທຶກ': 'Recorder',
  'ຈຳນວນແຖວ': 'Rows',
  'ມື້': ' days',
  'ຄ້າງ': 'Overdue Days',
  'ກຳນົດຊຳລະ': 'DUE',
}

function translateValue(value, language) {
  if (!value || typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (language === 'en') {
    const rowMatch = trimmed.match(/^(\d+)\s*ແຖວ$/)
    if (rowMatch) return value.replace(trimmed, `${rowMatch[1]} rows`)
    const dayMatch = trimmed.match(/^(\d+)\s*ມື້$/)
    if (dayMatch) return value.replace(trimmed, `${dayMatch[1]} days`)
  } else {
    const rowMatch = trimmed.match(/^(\d+)\s*rows?$/i)
    if (rowMatch) return value.replace(trimmed, `${rowMatch[1]} ແຖວ`)
    const dayMatch = trimmed.match(/^(\d+)\s*days?$/i)
    if (dayMatch) return value.replace(trimmed, `${dayMatch[1]} ມື້`)
  }
  const translated = language === 'lo' ? enToLo[trimmed] : loToEn[trimmed]
  if (!translated) return value
  return value.replace(trimmed, translated)
}

function shouldSkip(node) {
  const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  if (!parent) return true
  return !!parent.closest('[data-no-translate], script, style, svg, canvas, .apexcharts-tooltip')
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage)

  const toggleLanguage = useCallback(() => {
    setLanguage(current => {
      const next = current === 'lo' ? 'en' : 'lo'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  useEffect(() => {
    const queryLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'))
    if (!queryLanguage) return
    localStorage.setItem(STORAGE_KEY, queryLanguage)
    setLanguage(queryLanguage)
  }, [])

  const t = useCallback((value) => translateValue(value, language), [language])

  useEffect(() => {
    document.documentElement.lang = language === 'lo' ? 'lo' : 'en'
  }, [language])

  useEffect(() => {
    const attrNames = ['placeholder', 'title', 'aria-label']

    const translateTextNode = (node) => {
      if (shouldSkip(node)) return
      const next = translateValue(node.nodeValue, language)
      if (node.nodeValue !== next) node.nodeValue = next
    }

    const translateElement = (element) => {
      if (shouldSkip(element)) return
      attrNames.forEach(attr => {
        if (!element.hasAttribute?.(attr)) return
        const next = translateValue(element.getAttribute(attr), language)
        if (element.getAttribute(attr) !== next) element.setAttribute(attr, next)
      })
      element.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) translateTextNode(child)
        else if (child.nodeType === Node.ELEMENT_NODE) translateElement(child)
      })
    }

    const applyTranslations = () => {
      const root = document.getElementById('root')
      if (root) translateElement(root)
    }

    applyTranslations()
    const observer = new MutationObserver(() => applyTranslations())
    observer.observe(document.getElementById('root'), {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: attrNames,
    })
    return () => observer.disconnect()
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, toggleLanguage, t }), [language, toggleLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
