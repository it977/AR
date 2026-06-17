import { useState } from 'react'
import { useCan } from '../context/AuthContext'
import { PERMISSIONS } from '../lib/rbac'
import { logAction } from '../lib/log'
import { showError, showSuccess } from '../lib/sweetAlert'
import Modal from './Modal'

const PDF_PAGE_SELECTOR = '.pdf-dashboard-page, .pdf-a4-page'

function getPdfPageOptions(element) {
  return [...element.querySelectorAll(PDF_PAGE_SELECTOR)].map((page, index) => ({
    index,
    label:
      page.dataset.pdfPageLabel ||
      page.querySelector('[data-pdf-title]')?.textContent?.trim() ||
      page.querySelector('h1, h2, h3')?.textContent?.trim() ||
      `Page ${index + 1}`,
  }))
}

function buildPdfSource(element, orientation, selectedPageIndexes) {
  const exportWidth = orientation === 'portrait' ? 900 : 2200
  const exportHeight = orientation === 'portrait' ? 1122 : 794
  const wrapper = document.createElement('div')
  const selectedPages = new Set(selectedPageIndexes)

  wrapper.className = 'pdf-export'
  wrapper.style.position = 'fixed'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.zIndex = '2147483647'
  wrapper.style.boxSizing = 'border-box'
  wrapper.style.width = `${exportWidth}px`
  wrapper.style.maxWidth = `${exportWidth}px`
  wrapper.style.padding = '0'
  wrapper.style.background = '#ffffff'
  wrapper.style.color = '#0f172a'
  wrapper.style.pointerEvents = 'none'

  const clone = element.cloneNode(true)
  clone.style.position = 'static'
  clone.style.left = 'auto'
  clone.style.top = 'auto'
  clone.style.zIndex = 'auto'
  clone.style.pointerEvents = 'auto'
  clone.style.width = '100%'
  clone.style.maxWidth = '100%'
  clone.style.margin = '0'

  clone.querySelectorAll('.pdf-dashboard-page').forEach(page => {
    page.style.width = `${exportWidth}px`
    page.style.boxSizing = 'border-box'
    page.style.pageBreakAfter = 'always'
    page.style.breakAfter = 'page'
    page.style.overflow = 'visible'
  })

  clone.querySelectorAll('.pdf-a4-page').forEach(page => {
    page.style.width = `${exportWidth}px`
    page.style.minHeight = `${exportHeight - 32}px`
    page.style.boxSizing = 'border-box'
    page.style.pageBreakAfter = 'always'
    page.style.breakAfter = 'page'
    page.style.overflow = 'hidden'
  })

  clone.querySelectorAll('.pdf-a4-page:last-child').forEach(page => {
    page.style.pageBreakAfter = 'auto'
    page.style.breakAfter = 'auto'
  })

  clone.querySelectorAll(`${PDF_PAGE_SELECTOR}:last-child`).forEach(page => {
    page.style.pageBreakAfter = 'auto'
    page.style.breakAfter = 'auto'
  })

  clone.querySelectorAll('[data-pdf-hidden="true"]').forEach(node => node.remove())
  clone.querySelectorAll('button, input, select, textarea, [role="button"]').forEach(node => node.remove())

  clone.querySelectorAll('.overflow-x-auto').forEach(node => {
    node.style.overflow = 'visible'
  })

  clone.querySelectorAll('table').forEach(table => {
    table.style.width = '100%'
    table.style.minWidth = '0'
  })

  clone.querySelectorAll('th, td').forEach(cell => {
    cell.style.whiteSpace = 'normal'
    cell.style.verticalAlign = 'top'
  })

  const originalCanvases = element.querySelectorAll('canvas')
  const clonedCanvases = clone.querySelectorAll('canvas')

  originalCanvases.forEach((canvas, index) => {
    const clonedCanvas = clonedCanvases[index]
    if (!clonedCanvas) return

    const image = document.createElement('img')
    image.src = canvas.toDataURL('image/png')
    image.style.width = `${canvas.offsetWidth || canvas.width}px`
    image.style.height = `${canvas.offsetHeight || canvas.height}px`
    image.style.display = 'block'
    image.style.maxWidth = '100%'
    clonedCanvas.replaceWith(image)
  })

  ;[...clone.querySelectorAll(PDF_PAGE_SELECTOR)].forEach((page, index) => {
    if (!selectedPages.has(index)) {
      page.remove()
    }
  })

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  return wrapper
}

async function savePagesAsPdf(exportElement, filename, orientation, previewWindow) {
  const { jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  await document.fonts?.ready

  const pages = [...exportElement.querySelectorAll(PDF_PAGE_SELECTOR)]
  if (!pages.length) {
    throw new Error('No PDF dashboard pages found')
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation, compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  for (const [pageIndex, page] of pages.entries()) {
    if (pageIndex > 0) pdf.addPage('a4', orientation)

    const canvas = await html2canvas(page, {
      backgroundColor: '#f8fafc',
      scale: 1.5,
      useCORS: true,
      logging: false,
      windowWidth: page.scrollWidth,
      windowHeight: page.scrollHeight,
    })

    const imageData = canvas.toDataURL('image/jpeg', 0.94)
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
    const imageWidth = canvas.width * ratio
    const imageHeight = canvas.height * ratio
    const imageX = (pageWidth - imageWidth) / 2
    const imageY = (pageHeight - imageHeight) / 2

    pdf.setFillColor(248, 250, 252)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
    pdf.addImage(imageData, 'JPEG', imageX, imageY, imageWidth, imageHeight, undefined, 'FAST')
  }

  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = url
  } else {
    window.location.href = url
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export default function PDFButton({
  elementId,
  filename,
  label = 'PDF',
  orientation = 'landscape',
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pageOptions, setPageOptions] = useState([])
  const [selectedPageIndexes, setSelectedPageIndexes] = useState([])
  const canExport = useCan(PERMISSIONS.REPORTS_EXPORT)

  if (!canExport) return null

  const allPageIndexes = pageOptions.map(page => page.index)
  const allPagesSelected = pageOptions.length > 0 && selectedPageIndexes.length === pageOptions.length

  const openPagePicker = () => {
    if (isDownloading) return

    const element = document.getElementById(elementId)

    if (!element) {
      showError('PDF content was not found.')
      return
    }

    const options = getPdfPageOptions(element)

    if (!options.length) {
      showError('No PDF pages were found.')
      return
    }

    setPageOptions(options)
    setSelectedPageIndexes(options.map(page => page.index))
    setIsPickerOpen(true)
  }

  const toggleAllPages = () => {
    setSelectedPageIndexes(allPagesSelected ? [] : allPageIndexes)
  }

  const togglePage = pageIndex => {
    setSelectedPageIndexes(current => {
      if (current.includes(pageIndex)) {
        return current.filter(index => index !== pageIndex)
      }
      return [...current, pageIndex].sort((a, b) => a - b)
    })
  }

  const downloadPDF = async () => {
    if (isDownloading) return
    if (!selectedPageIndexes.length) {
      showError('Please select at least one PDF page.')
      return
    }

    const element = document.getElementById(elementId)

    if (!element) {
      showError('PDF content was not found.')
      return
    }

    let exportElement = null
    const outputName = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`
    const previewWindow = window.open('', '_blank')
    previewWindow?.document.write('<p style="font:16px Arial;padding:24px">Generating dashboard PDF...</p>')

    try {
      setIsDownloading(true)
      exportElement = buildPdfSource(element, orientation, selectedPageIndexes)
      await savePagesAsPdf(exportElement, outputName, orientation, previewWindow)
      const selectedLabels = pageOptions
        .filter(page => selectedPageIndexes.includes(page.index))
        .map(page => page.label)
      await logAction({
        action: 'Exported PDF',
        action_type: 'report.export',
        entity_type: 'pdf',
        entity_id: outputName,
        details: `Exported ${outputName}`,
        metadata: {
          element_id: elementId,
          orientation,
          pages: selectedLabels,
        },
      })
      showSuccess('PDF exported successfully')
      setIsPickerOpen(false)
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.document.body.innerHTML = '<p style="font:16px Arial;padding:24px;color:#b91c1c">PDF download failed. Please try again.</p>'
      }
      showError('PDF download failed. Please try again.')
    } finally {
      exportElement?.remove()
      setIsDownloading(false)
    }
  }

  return (
    <>
      <button
        id={`pdf-btn-${elementId}`}
        onClick={openPagePicker}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 disabled:bg-red-100 disabled:text-red-400 disabled:cursor-not-allowed text-red-700 text-sm font-semibold rounded-xl border border-red-200 transition-colors"
        title="Download PDF"
      >
        {isDownloading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {isDownloading ? 'Generating PDF...' : label}
      </button>

      <Modal
        open={isPickerOpen}
        onClose={isDownloading ? undefined : () => setIsPickerOpen(false)}
        title="Download PDF"
        subtitle="Select one or more pages to export."
        size="sm"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allPagesSelected}
              onChange={toggleAllPages}
              disabled={isDownloading}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            All pages
          </label>

          <div className="space-y-2">
            {pageOptions.map((page, pageIndex) => (
              <label
                key={page.index}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedPageIndexes.includes(page.index)}
                  onChange={() => togglePage(page.index)}
                  disabled={isDownloading}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex-1 font-medium">{page.label}</span>
                <span className="text-xs text-slate-400">Page {pageIndex + 1}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-xs font-medium text-slate-500">
              {selectedPageIndexes.length} of {pageOptions.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                disabled={isDownloading}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={downloadPDF}
                disabled={isDownloading || !selectedPageIndexes.length}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isDownloading && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {isDownloading ? 'Generating...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
