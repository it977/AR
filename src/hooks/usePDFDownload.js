import html2pdf from 'html2pdf.js'

export function usePDFDownload() {
  const downloadPDF = async (elementId, filename) => {
    const element = document.getElementById(elementId)
    if (!element) {
      console.error('Element not found:', elementId)
      return
    }

    const opt = {
      margin: 0.5,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: { 
        unit: 'in', 
        format: 'a4', 
        orientation: 'landscape',
        compress: true,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    try {
      // ເພີ່ມ loading state
      const originalContent = element.innerHTML
      
      // ດາວໂຫຼດ PDF
      await html2pdf().set(opt).from(element).save()
      
      return true
    } catch (error) {
      console.error('PDF download error:', error)
      alert('ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫຼດ PDF')
      return false
    }
  }

  const downloadElement = async (element, filename) => {
    if (!element) {
      console.error('Element not found')
      return
    }

    const opt = {
      margin: 0.5,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: { 
        unit: 'in', 
        format: 'a4', 
        orientation: 'landscape',
        compress: true,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    try {
      await html2pdf().set(opt).from(element).save()
      return true
    } catch (error) {
      console.error('PDF download error:', error)
      alert('ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫຼດ PDF')
      return false
    }
  }

  return { downloadPDF, downloadElement }
}
