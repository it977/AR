import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const runtimeNodeModules = 'C:/Users/asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
const PptxGenJS = require(path.join(runtimeNodeModules, 'pptxgenjs'))
const sharp = require(path.join(runtimeNodeModules, 'sharp'))
const imageSizeModule = require(path.join(runtimeNodeModules, 'image-size'))

const sizeOf = imageSizeModule.imageSize || imageSizeModule.default || imageSizeModule

const root = process.cwd()
const imageDir = 'C:/Users/asus/Downloads/New folder'
const outDir = path.join(root, 'docs', 'sop')
const previewDir = path.join(outDir, 'previews')
fs.mkdirSync(previewDir, { recursive: true })

const pptxPath = path.join(outDir, 'AR-Finance-System-SOP-Timeline.pptx')
const contactSheetPath = path.join(previewDir, 'contact-sheet.png')

const W = 13.333
const H = 7.5
const pxW = 1600
const pxH = 900

const C = {
  navy: '0F172A',
  ink: '1E293B',
  muted: '64748B',
  light: 'F8FAFC',
  line: 'DDE7F2',
  purple: '4F46E5',
  teal: '14B8A6',
  green: '10B981',
  red: 'EF4444',
  amber: 'F59E0B',
  blue: '2563EB',
  white: 'FFFFFF',
}

const FONT = 'Noto Sans Lao'

const img = (n) => path.join(imageDir, `${n}.jpeg`)
const IM = {
  login: img(1),
  addBillBottom: img(2),
  addBillTop: img(3),
  bills: img(4),
  debt: img(5),
  daily: img(6),
  customer: img(7),
  payment: img(8),
  outstanding: img(9),
  aging: img(10),
  settings: img(11),
  rbac: img(12),
  permissions: img(13),
  upload: img(14),
}

const slides = [
  {
    title: 'AR Finance System SOP',
    subtitle: 'ຄູ່ມືການນຳໃຊ້ລະບົບແຕ່ລະໜ້າ ພ້ອມ Timeline 2 ເດືອນ 21 ວັນ',
    image: IM.login,
    type: 'cover',
  },
  {
    title: 'SOP Overview',
    timeline: 'Day 1-81',
    image: IM.daily,
    bullets: [
      'ເຂົ້າລະບົບຕາມ role ແລະສິດທີ່ກຳນົດ',
      'ອັບໂຫຼດ Excel ເພື່ອສ້າງຂໍ້ມູນ AR, Bills, Debt',
      'ກວດລາຍງານ: Daily Sales, Customer, Payment, Debt, Aging',
      'Admin ຄວບຄຸມ User, RBAC, Settings, Audit logs',
    ],
  },
  {
    title: 'Timeline Rollout ບໍ່ເກີນ 2 ເດືອນ 21 ວັນ',
    timeline: '81 days maximum',
    type: 'timeline',
    steps: [
      ['D1-3', 'Login + Role setup'],
      ['D4-10', 'Upload Excel'],
      ['D11-18', 'Bills Management'],
      ['D19-26', 'Debt Management'],
      ['D27-42', 'Daily + Customer Reports'],
      ['D43-58', 'Payment + Debt Reports'],
      ['D59-66', 'Aging Report'],
      ['D67-73', 'RBAC + Settings'],
      ['D74-81', 'UAT + Go-live'],
    ],
  },
  {
    title: '1. Login ແລະ ສິດການເຂົ້າໃຊ້',
    timeline: 'Day 1-3',
    image: IM.login,
    bullets: [
      'ໃສ່ Email / Password ແລ້ວກົດ Login',
      'ລະບົບກວດ Supabase Auth ແລະ profile role',
      'Admin ເຫັນເມນູ RBAC, Settings, Upload, Reports',
      'User ເຫັນສະເພາະໜ້າທີ່ໄດ້ຮັບສິດ',
    ],
  },
  {
    title: '2. Upload Excel',
    timeline: 'Day 4-10',
    image: IM.upload,
    bullets: [
      'ດາວໂຫຼດ Template ແລະກວດ Sheet “Daily” / “Pay off”',
      'ລາກໄຟລ ຫຼືກົດເລືອກ Excel (.xlsx, .xls)',
      'Preview ຂໍ້ມູນ ແລ້ວກົດ Upload',
      'ລະບົບບັນທຶກ ar_bills, ar_debt, ar_cashflow ແລະ audit log',
    ],
  },
  {
    title: '3. Bills Management',
    timeline: 'Day 11-18',
    image: IM.bills,
    bullets: [
      'ຄົ້ນຫາດ້ວຍເລກໃບບິນ / ຊື່ຄົນເຈັບ',
      'Filter ຕາມກະ, ວັນທີ, ຈຳນວນແຖວ',
      'ກົດ “ເພີ່ມໃບບິນ” ເພື່ອບັນທຶກລາຍຮັບຕາມບໍລິການ',
      'ໃບບິນທີ່ມີໜີ້ຄ້າງ ສາມາດສົ່ງໄປ Debt Management',
    ],
  },
  {
    title: '4. Add Bill Form',
    timeline: 'Day 11-18',
    image: IM.addBillTop,
    bullets: [
      'ກອກວັນທີ, Week, ກະ, ເລກໃບບິນ',
      'ກອກຂໍ້ມູນຄົນເຈັບ: HN, ຊື່, ເພດ',
      'ໃສ່ລາຍຮັບແຍກ OPD, Diag, IPD, Surg, Pharma ແລະອື່ນໆ',
      'Grand Total ແລະ Debt ຄຳນວນອັດຕະໂນມັດ',
    ],
  },
  {
    title: '5. Debt Management',
    timeline: 'Day 19-26',
    image: IM.debt,
    bullets: [
      'ກວດຍອດໜີ້ທັງໝົດ, ເກັບໄດ້ແລ້ວ, ຍອດຄົງເຫຼືອ',
      'Filter ຕາມສະຖານະ, Aging, ກະ, ວັນທີ',
      'ກົດຊຳລະເພື່ອບັນທຶກ Cash / BCEL / BCEL2 / LDB',
      'ສະຖານະປ່ຽນເປັນ “ຊຳລະແລ້ວ” ເມື່ອ balance = 0',
    ],
  },
  {
    title: '6. Daily Sales Report',
    timeline: 'Day 27-34',
    image: IM.daily,
    bullets: [
      'ເບິ່ງ Total Sales, Discounts, Actual Total Sale, Bills, Customers',
      'ໃຊ້ filter ມື້ນີ້ / 7 ວັນ / 30 ວັນ / custom date',
      'Filter ຕາມກະ ແລະປະເພດລູກຄ້າ',
      'ດາວໂຫຼດ PDF ເພື່ອສົ່ງລາຍງານ',
    ],
  },
  {
    title: '7. Customer & Service Analysis',
    timeline: 'Day 35-42',
    image: IM.customer,
    bullets: [
      'ວິເຄາະຈຳນວນລູກຄ້າ, ເພດ, Insite/Onsite, OPD/IPD',
      'Filter ຕາມກະ, ປະເພດລູກຄ້າ, ເພດ, OPD/IPD',
      'ໃຊ້ເພື່ອກວດສັດສ່ວນບໍລິການ ແລະ patient mix',
    ],
  },
  {
    title: '8. Payment Channel Analysis',
    timeline: 'Day 43-50',
    image: IM.payment,
    bullets: [
      'ກວດ Actual Income, Collected at Billing, Pay off, Outstanding',
      'ແຍກຊ່ອງທາງ Cash, BCEL, BCEL2, LDB',
      'ໃຊ້ filter ກະ, ວັນທີ, ປະເພດລູກຄ້າ',
      'ໃຊ້ສຳລັບ reconciliation ແລະການກວດເງິນປະຈຳວັນ',
    ],
  },
  {
    title: '9. Outstanding Debt Report',
    timeline: 'Day 51-58',
    image: IM.outstanding,
    bullets: [
      'ເບິ່ງໜີ້ຄ້າງທັງໝົດ, ຍອດເກັບໄດ້, ຍອດຄົງເຫຼືອ',
      'ເບິ່ງ debt by customer type ແລະລາຍການທີ່ຕ້ອງຕິດຕາມ',
      'ໃຊ້ກຳນົດ priority ການເກັບໜີ້ລາຍອາທິດ',
    ],
  },
  {
    title: '10. Debt Aging Report',
    timeline: 'Day 59-66',
    image: IM.aging,
    bullets: [
      'ແບ່ງໜີ້ຕາມ aging bucket: 0-15, 16-30, 31-45, 46-60+ ວັນ',
      'Filter ຕາມປະກັນ, ລູກຄ້າ, ວັນທີ',
      'ໃຊ້ກວດ SLA ການເກັບໜີ້ ແລະ overdue risk',
    ],
  },
  {
    title: '11. RBAC User Management',
    timeline: 'Day 67-70',
    image: IM.rbac,
    bullets: [
      'Admin ເພີ່ມ / ແກ້ໄຂ / ລົບ / ເປີດປິດສະຖານະ user',
      'ກຳນົດ Role: Admin, Manager, Staff, Viewer',
      'ປຸ່ມ P ເພື່ອກຳນົດ Page permissions ແບບ user-specific',
      'ທຸກ action ຖືກບັນທຶກໃນ activity_logs',
    ],
  },
  {
    title: '12. Page Permissions',
    timeline: 'Day 71-73',
    image: IM.permissions,
    bullets: [
      'ເລືອກໜ້າທີ່ role/user ເຂົ້າໄດ້',
      'ກຳນົດສິດ reports export, upload, records write/delete',
      'ກວດສອບດ້ວຍ user ທົດສອບກ່ອນ Go-live',
    ],
  },
  {
    title: '13. General Settings',
    timeline: 'Day 67-73',
    image: IM.settings,
    bullets: [
      'ຈັດການ dropdown: ກະ, ປະເພດລູກຄ້າ, Insite/Onsite, OPD/IPD',
      'ຈັດການບໍລິສັດປະກັນ ແລະຜູ້ບັນທຶກ',
      'ກຳນົດໃຫ້ label/value ເປັນມາດຕະຖານກ່ອນນຳໃຊ້ຈິງ',
    ],
  },
  {
    title: '14. UAT, Go-live & Control Checklist',
    timeline: 'Day 74-81',
    image: IM.rbac,
    bullets: [
      'ທົດສອບ Login / Upload / Add bill / Pay debt / Export PDF',
      'ກວດ dashboard numbers ທຽບກັບ Excel source',
      'ກວດ role permissions ໂດຍໃຊ້ user ແຕ່ລະ role',
      'ກວດ activity_logs ໃຫ້ບັນທຶກທຸກ action ທີ່ສຳຄັນ',
    ],
  },
]

function addFooter(slide, idx) {
  slide.addText(`AR Finance SOP  •  Slide ${idx + 1}/${slides.length}`, {
    x: 0.55, y: 7.12, w: 4.0, h: 0.18,
    fontFace: FONT, fontSize: 7.5, color: C.muted,
  })
}

function addTimelinePill(slide, label, x = 10.25, y = 0.48) {
  if (!label) return
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 2.45, h: 0.42,
    rectRadius: 0.06,
    fill: { color: 'EEF2FF' },
    line: { color: 'C7D2FE', width: 1 },
  })
  slide.addText(label, {
    x: x + 0.14, y: y + 0.105, w: 2.18, h: 0.15,
    fontFace: FONT, fontSize: 10, bold: true, color: C.purple,
    align: 'center',
  })
}

function addImageFit(slide, imagePath, x, y, w, h) {
  const dim = sizeOf(imagePath)
  const imgRatio = dim.width / dim.height
  const boxRatio = w / h
  let cw = w, ch = h, cx = x, cy = y
  if (imgRatio > boxRatio) {
    ch = h
    cw = h * imgRatio
    cx = x - (cw - w) / 2
  } else {
    cw = w
    ch = w / imgRatio
    cy = y - (ch - h) / 2
  }
  slide.addImage({ path: imagePath, x: cx, y: cy, w: cw, h: ch, transparency: 0 })
}

function addScreenshotPanel(slide, imagePath, x, y, w, h) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: C.white },
    line: { color: C.line, width: 1 },
    radius: 0.12,
    shadow: { type: 'outer', color: 'C7D2FE', opacity: 0.15, blur: 1, angle: 45, distance: 1 },
  })
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.08, y: y + 0.08, w: w - 0.16, h: h - 0.16,
    fill: { color: 'FFFFFF', transparency: 100 },
    line: { color: 'FFFFFF', transparency: 100 },
  })
  addImageFit(slide, imagePath, x + 0.08, y + 0.08, w - 0.16, h - 0.16)
}

function addBullets(slide, bullets, x, y, w) {
  bullets.forEach((b, i) => {
    const yy = y + i * 0.62
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: yy + 0.08, w: 0.18, h: 0.18,
      fill: { color: [C.purple, C.teal, C.blue, C.amber][i % 4] },
      line: { color: [C.purple, C.teal, C.blue, C.amber][i % 4] },
    })
    slide.addText(b, {
      x: x + 0.34, y: yy, w, h: 0.42,
      fontFace: FONT, fontSize: 14, color: C.ink,
      fit: 'shrink',
      breakLine: false,
    })
  })
}

function addHeader(slide, s, idx) {
  slide.addText('SOP ວິທີການນຳໃຊ້ລະບົບ', {
    x: 0.55, y: 0.34, w: 3.2, h: 0.18,
    fontFace: FONT, fontSize: 8.5, color: C.teal, bold: true,
    charSpace: 2,
  })
  slide.addText(s.title, {
    x: 0.55, y: 0.72, w: 8.8, h: 0.52,
    fontFace: FONT, fontSize: 25, bold: true, color: C.navy,
    fit: 'shrink',
  })
  addTimelinePill(slide, s.timeline)
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55, y: 1.32, w: 12.2, h: 0,
    line: { color: 'D7F3EF', width: 1 },
  })
  addFooter(slide, idx)
}

function addCover(slide, s) {
  slide.background = { color: C.navy }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: C.navy }, line: { color: C.navy } })
  slide.addShape(pptx.ShapeType.rect, { x: 6.45, y: 0, w: 6.88, h: H, fill: { color: C.light }, line: { color: C.light } })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.65, y: 2.15, w: 0.55, h: 0.55,
    fill: { color: C.purple },
    line: { color: C.purple },
  })
  slide.addText('AR FINANCE SYSTEM', {
    x: 0.65, y: 3.05, w: 4.4, h: 0.3,
    fontFace: FONT, fontSize: 13, bold: true, color: 'C7D2FE', charSpace: 4,
  })
  slide.addText('SOP ການນຳໃຊ້ລະບົບ', {
    x: 0.65, y: 3.55, w: 5.1, h: 0.7,
    fontFace: FONT, fontSize: 32, bold: true, color: C.white,
    fit: 'shrink',
  })
  slide.addText('ພ້ອມ Timeline ການຝຶກໃຊ້ ແລະ Go-live ບໍ່ເກີນ 2 ເດືອນ 21 ວັນ', {
    x: 0.68, y: 4.55, w: 5.4, h: 0.58,
    fontFace: FONT, fontSize: 14, color: 'E2E8F0',
    fit: 'shrink',
  })
  addScreenshotPanel(slide, s.image, 7.05, 1.18, 5.45, 5.15)
  slide.addText('Prepared for operations training', {
    x: 0.68, y: 6.8, w: 4.5, h: 0.2,
    fontFace: FONT, fontSize: 9, color: '94A3B8',
  })
}

function addTimelineSlide(slide, s, idx) {
  addHeader(slide, s, idx)
  slide.addText('ແຜນນຳໃຊ້ຕ້ອງຈົບພາຍໃນ 81 ວັນ: ຝຶກ, ທົດສອບ, ປັບສິດ, ແລະ Go-live', {
    x: 0.65, y: 1.55, w: 11.8, h: 0.34,
    fontFace: FONT, fontSize: 15, color: C.muted,
  })
  const startX = 0.75
  const y = 2.35
  const stepW = 1.28
  s.steps.forEach((st, i) => {
    const x = startX + i * 1.35
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: stepW, h: 0.58,
      fill: { color: i % 2 === 0 ? 'EEF2FF' : 'ECFDF5' },
      line: { color: i % 2 === 0 ? 'C7D2FE' : 'A7F3D0', width: 1 },
    })
    slide.addText(st[0], { x: x + 0.08, y: y + 0.13, w: stepW - 0.16, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: i % 2 === 0 ? C.purple : '047857', align: 'center' })
    slide.addShape(pptx.ShapeType.line, { x: x + stepW, y: y + 0.29, w: 0.16, h: 0, line: { color: C.line, width: 1 } })
    slide.addText(st[1], { x, y: 3.12, w: stepW, h: 0.75, fontFace: FONT, fontSize: 10, color: C.ink, bold: true, align: 'center', fit: 'shrink' })
  })
  addBullets(slide, [
    'ທຸກໜ້າຕ້ອງມີ owner ແລະ checklist ກ່ອນຍ້າຍໄປຂັ້ນຕອນຕໍ່ໄປ',
    'ຫຼັງ Day 73 ເປັນຊ່ວງ UAT, defect fixing, training refresh, ແລະ go-live approval',
    'ຖ້າມີ issue ໃນຂໍ້ມູນ/ສິດ user ຕ້ອງບັນທຶກໃນ activity log ແລະແກ້ກ່ອນ Day 81',
  ], 1.05, 5.0, 11.2)
}

function addContentSlide(slide, s, idx) {
  addHeader(slide, s, idx)
  addScreenshotPanel(slide, s.image, 0.65, 1.62, 6.55, 4.95)
  slide.addText('ຂັ້ນຕອນ SOP', {
    x: 7.55, y: 1.7, w: 4.0, h: 0.28,
    fontFace: FONT, fontSize: 16, bold: true, color: C.navy,
  })
  addBullets(slide, s.bullets, 7.58, 2.18, 4.75)
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.5, y: 6.13, w: 4.95, h: 0.5,
    fill: { color: 'F0FDFA' },
    line: { color: '99F6E4', width: 1 },
  })
  slide.addText(`Timeline: ${s.timeline}`, {
    x: 7.72, y: 6.29, w: 4.5, h: 0.12,
    fontFace: FONT, fontSize: 11.5, bold: true, color: '0F766E',
    align: 'center',
  })
}

function addOverviewSlide(slide, s, idx) {
  addHeader(slide, s, idx)
  addBullets(slide, s.bullets, 0.85, 1.72, 5.2)
  addScreenshotPanel(slide, s.image, 6.85, 1.55, 5.75, 4.9)
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.85, y: 5.65, w: 5.1, h: 0.78, fill: { color: 'EEF2FF' }, line: { color: 'C7D2FE' } })
  slide.addText('ຜົນລັບທີ່ຕ້ອງໄດ້: user ໃຊ້ງານໄດ້ຖືກຂັ້ນຕອນ, reports ກວດໄດ້, ແລະ admin ຄວບຄຸມສິດໄດ້.', {
    x: 1.05, y: 5.88, w: 4.7, h: 0.24, fontFace: FONT, fontSize: 11.5, color: C.ink, fit: 'shrink',
  })
}

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'Codex'
pptx.subject = 'AR Finance System SOP'
pptx.title = 'AR Finance System SOP Timeline'
pptx.company = 'ONE Meds / LXH'
pptx.lang = 'lo-LA'
pptx.theme = {
  headFontFace: FONT,
  bodyFontFace: FONT,
  lang: 'lo-LA',
}
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: W, height: H })
pptx.layout = 'CUSTOM_WIDE'

slides.forEach((s, idx) => {
  const slide = pptx.addSlide()
  slide.background = { color: idx === 0 ? C.navy : C.light }
  if (s.type === 'cover') addCover(slide, s)
  else if (s.type === 'timeline') addTimelineSlide(slide, s, idx)
  else if (idx === 1) addOverviewSlide(slide, s, idx)
  else addContentSlide(slide, s, idx)
})

await pptx.writeFile({ fileName: pptxPath })

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
}

async function svgPreview(s, idx) {
  const b64 = s.image && fs.existsSync(s.image) ? fs.readFileSync(s.image).toString('base64') : ''
  const imgTag = b64 ? `<image href="data:image/jpeg;base64,${b64}" x="${idx === 0 ? 840 : 90}" y="${idx === 0 ? 140 : 210}" width="${idx === 0 ? 650 : 780}" height="${idx === 0 ? 620 : 585}" preserveAspectRatio="xMidYMid slice"/>` : ''
  const bg = idx === 0 ? `#${C.navy}` : `#${C.light}`
  const rightBg = idx === 0 ? `<rect x="770" y="0" width="830" height="900" fill="#${C.light}"/>` : ''
  const titleX = idx === 0 ? 80 : 70
  const titleY = idx === 0 ? 360 : 96
  const titleColor = idx === 0 ? '#fff' : `#${C.navy}`
  const subtitle = s.subtitle || s.timeline || ''
  const bullets = (s.bullets || []).slice(0, 4).map((b, i) => {
    const y = 250 + i * 76
    return `<circle cx="910" cy="${y + 8}" r="9" fill="#${[C.purple, C.teal, C.blue, C.amber][i % 4]}"/><text x="935" y="${y + 18}" font-size="24" fill="#${C.ink}" font-family="${FONT}">${esc(b)}</text>`
  }).join('')
  const timeline = s.type === 'timeline' ? (s.steps || []).map((st, i) => {
    const x = 90 + i * 165
    return `<rect x="${x}" y="300" width="140" height="66" rx="18" fill="${i % 2 ? '#ECFDF5' : '#EEF2FF'}" stroke="${i % 2 ? '#A7F3D0' : '#C7D2FE'}"/><text x="${x + 70}" y="342" text-anchor="middle" font-size="23" font-weight="700" fill="${i % 2 ? '#047857' : '#4F46E5'}" font-family="${FONT}">${esc(st[0])}</text><text x="${x + 70}" y="430" text-anchor="middle" font-size="18" font-weight="700" fill="#${C.ink}" font-family="${FONT}">${esc(st[1])}</text>`
  }).join('') : ''
  const svg = `<svg width="${pxW}" height="${pxH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1600" height="900" fill="${bg}"/>${rightBg}
    <text x="${titleX}" y="${titleY}" font-size="${idx === 0 ? 62 : 42}" font-weight="800" fill="${titleColor}" font-family="${FONT}">${esc(s.title)}</text>
    <text x="${titleX}" y="${titleY + 56}" font-size="${idx === 0 ? 28 : 23}" fill="${idx === 0 ? '#E2E8F0' : '#64748B'}" font-family="${FONT}">${esc(subtitle)}</text>
    ${idx > 0 ? `<line x1="70" y1="155" x2="1530" y2="155" stroke="#D7F3EF" stroke-width="2"/>` : ''}
    ${s.type === 'timeline' ? timeline : imgTag}
    ${idx > 1 && s.type !== 'timeline' ? bullets : ''}
    ${idx === 1 ? bullets.replaceAll('910', '95').replaceAll('935', '125') : ''}
    <text x="70" y="860" font-size="15" fill="#64748B" font-family="${FONT}">AR Finance SOP • Slide ${idx + 1}/${slides.length}</text>
  </svg>`
  const out = path.join(previewDir, `slide-${String(idx + 1).padStart(2, '0')}.png`)
  await sharp(Buffer.from(svg)).png().toFile(out)
  return out
}

const previewFiles = []
for (let i = 0; i < slides.length; i += 1) {
  previewFiles.push(await svgPreview(slides[i], i))
}

const thumbs = await Promise.all(previewFiles.map((f) => sharp(f).resize(400, 225).toBuffer()))
const contactSvg = `<svg width="1600" height="${Math.ceil(slides.length / 4) * 255}" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="${Math.ceil(slides.length / 4) * 255}" fill="#F8FAFC"/>
  ${thumbs.map((buf, i) => {
    const x = (i % 4) * 400
    const y = Math.floor(i / 4) * 255
    return `<image href="data:image/png;base64,${buf.toString('base64')}" x="${x}" y="${y}" width="400" height="225"/><text x="${x + 12}" y="${y + 244}" font-family="${FONT}" font-size="16" fill="#334155">${i + 1}. ${esc(slides[i].title)}</text>`
  }).join('')}
</svg>`
await sharp(Buffer.from(contactSvg)).png().toFile(contactSheetPath)

console.log(JSON.stringify({ pptxPath, previewDir, contactSheetPath, slideCount: slides.length }, null, 2))
