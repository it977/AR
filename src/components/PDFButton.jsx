export default function PDFButton({ elementId, filename, label = 'PDF' }) {
  const downloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default
    const element = document.getElementById(elementId)
    
    if (!element) {
      alert('ບໍ່ພົບຂໍ້ມູນທີ່ຕ້ອງດາວໂຫຼດ')
      return
    }

    const opt = {
      margin: 0.3,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape', compress: true },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    try {
      const btn = document.getElementById(`pdf-btn-${elementId}`)
      if (btn) {
        btn.disabled = true
        btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> ກຳລັງດາວໂຫຼດ...`
      }
      
      await html2pdf().set(opt).from(element).save()
      
      if (btn) {
        btn.disabled = false
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ${label}`
      }
    } catch (error) {
      console.error('PDF error:', error)
      alert('ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫຼດ PDF')
      if (btn) {
        btn.disabled = false
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ${label}`
      }
    }
  }

  return (
    <button
      id={`pdf-btn-${elementId}`}
      onClick={downloadPDF}
      className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl border border-red-200 transition-colors"
      title="ດາວໂຫຼດ PDF"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {label}
    </button>
  )
}
