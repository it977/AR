import Swal from 'sweetalert2'

const baseButtons = {
  confirmButtonColor: '#4f46e5',
  cancelButtonColor: '#64748b',
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function showSuccess(title, text = '') {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
  })
}

export function showError(title, text = '') {
  return Swal.fire({
    ...baseButtons,
    icon: 'error',
    title,
    text,
    confirmButtonText: 'OK',
  })
}

export function showInfo(title, text = '') {
  return Swal.fire({
    ...baseButtons,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'OK',
  })
}

export async function confirmAction({
  title,
  text,
  confirmButtonText = 'ຢືນຢັນ',
  cancelButtonText = 'ຍົກເລີກ',
  icon = 'warning',
  confirmButtonColor = '#dc2626',
} = {}) {
  const result = await Swal.fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor,
    cancelButtonColor: baseButtons.cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

export async function confirmCodeAction({
  title,
  text,
  confirmButtonText = 'ລົບທັງໝົດ',
  cancelButtonText = 'ຍົກເລີກ',
} = {}) {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  const result = await Swal.fire({
    icon: 'warning',
    title,
    html: `
      <p style="margin:0 0 12px;color:#64748b;font-size:14px">${escapeHtml(text || '')}</p>
      <div style="margin:12px auto;padding:12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">ພິມລະຫັດນີ້ເພື່ອຢືນຢັນ</div>
        <div style="font:700 30px monospace;color:#dc2626;letter-spacing:.35em">${code}</div>
      </div>
    `,
    input: 'text',
    inputPlaceholder: '••••',
    inputAttributes: {
      inputmode: 'numeric',
      maxlength: '4',
      autocapitalize: 'off',
      autocorrect: 'off',
    },
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: baseButtons.cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
    preConfirm: value => {
      if (String(value || '').trim() !== code) {
        Swal.showValidationMessage('ລະຫັດຢືນຢັນບໍ່ຖືກ')
        return false
      }
      return true
    },
  })
  return result.isConfirmed
}
