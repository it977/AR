export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.STAFF]: 'Staff',
  [ROLES.VIEWER]: 'Viewer',
}

export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin', description: 'Full system access and RBAC management.' },
  { value: ROLES.MANAGER, label: 'Manager', description: 'Reports, records, uploads, and edits.' },
  { value: ROLES.STAFF, label: 'Staff', description: 'Daily work access for records and reports.' },
  { value: ROLES.VIEWER, label: 'Viewer', description: 'Read-only report access.' },
]

export const PERMISSIONS = {
  PAGE_DAILY_SALES: 'page.daily_sales',
  PAGE_CUSTOMER_SERVICE: 'page.customer_service',
  PAGE_PAYMENT_CHANNEL: 'page.payment_channel',
  PAGE_OUTSTANDING_DEBT: 'page.outstanding_debt',
  PAGE_AGING_REPORT: 'page.aging_report',
  PAGE_BILLS: 'page.bills',
  PAGE_DEBT: 'page.debt',
  PAGE_UPLOAD: 'page.upload',
  PAGE_RBAC: 'page.rbac',
  PAGE_SETTINGS: 'page.settings',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  RECORDS_VIEW: 'records.view',
  RECORDS_WRITE: 'records.write',
  RECORDS_DELETE: 'records.delete',
  DATA_UPLOAD: 'data.upload',
  USERS_MANAGE: 'users.manage',
}

export const PERMISSION_GROUPS = [
  {
    title: 'Dashboard pages',
    description: 'Controls visibility for reports and dashboard pages.',
    permissions: [
      { key: PERMISSIONS.PAGE_DAILY_SALES, label: 'ລາຍງານປະຈຳວັນ', detail: 'ແດຊບອດຍອດຂາຍປະຈຳວັນ' },
      { key: PERMISSIONS.PAGE_CUSTOMER_SERVICE, label: 'ລູກຄ້າ ແລະ ການບໍລິການ', detail: 'ລາຍງານປະເພດລູກຄ້າ ແລະ ລາຍຮັບການບໍລິການ' },
      { key: PERMISSIONS.PAGE_PAYMENT_CHANNEL, label: 'ຊ່ອງທາງຊຳລະ', detail: 'ລາຍງານເງິນສົດ ທະນາຄານ ແລະ ຊ່ອງທາງຊຳລະ' },
      { key: PERMISSIONS.PAGE_OUTSTANDING_DEBT, label: 'ໜີ້ຄ້າງຊຳລະ', detail: 'ຍອດໜີ້ຄ້າງ ແລະ ໃບບິນທີ່ຍັງບໍ່ຊຳລະ' },
      { key: PERMISSIONS.PAGE_AGING_REPORT, label: 'ລາຍງານອາຍຸໜີ້', detail: 'ສະຫຼຸບອາຍຸໜີ້ຄ້າງ' },
      { key: PERMISSIONS.REPORTS_EXPORT, label: 'Export reports', detail: 'PDF and report export actions' },
    ],
  },
  {
    title: 'AR records',
    description: 'Controls access to operational bill and debt records.',
    permissions: [
      { key: PERMISSIONS.PAGE_BILLS, label: 'ໜ້າຈັດການໃບບິນ', detail: 'ເປີດໜ້າບັນທຶກໃບບິນ' },
      { key: PERMISSIONS.PAGE_DEBT, label: 'ໜ້າຈັດການໜີ້ຄ້າງ', detail: 'ເປີດໜ້າບັນທຶກໜີ້ຄ້າງ' },
      { key: PERMISSIONS.RECORDS_WRITE, label: 'Create and edit records', detail: 'Add, update, and save AR data' },
      { key: PERMISSIONS.RECORDS_DELETE, label: 'Delete records', detail: 'Remove bills, debt, and related records' },
    ],
  },
  {
    title: 'Administration',
    description: 'Controls upload and user access settings.',
    permissions: [
      { key: PERMISSIONS.PAGE_UPLOAD, label: 'Upload Excel page', detail: 'Open the upload page' },
      { key: PERMISSIONS.DATA_UPLOAD, label: 'Import Excel data', detail: 'Upload and import Excel source files' },
      { key: PERMISSIONS.PAGE_RBAC, label: 'RBAC page', detail: 'Open this RBAC management page' },
      { key: PERMISSIONS.USERS_MANAGE, label: 'Manage RBAC and users', detail: 'Assign roles and configure permission sets' },
      { key: PERMISSIONS.PAGE_SETTINGS, label: 'ໜ້າຕັ້ງຄ່າທົ່ວໄປ', detail: 'ຈັດການຕົວເລືອກ dropdown ທີ່ໃຊ້ໃນແບບຟອມໃບບິນ' },
    ],
  },
]

export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.PAGE_DAILY_SALES,
    PERMISSIONS.PAGE_CUSTOMER_SERVICE,
    PERMISSIONS.PAGE_PAYMENT_CHANNEL,
    PERMISSIONS.PAGE_OUTSTANDING_DEBT,
    PERMISSIONS.PAGE_AGING_REPORT,
    PERMISSIONS.PAGE_BILLS,
    PERMISSIONS.PAGE_DEBT,
    PERMISSIONS.PAGE_UPLOAD,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_WRITE,
    PERMISSIONS.DATA_UPLOAD,
  ],
  [ROLES.STAFF]: [
    PERMISSIONS.PAGE_DAILY_SALES,
    PERMISSIONS.PAGE_CUSTOMER_SERVICE,
    PERMISSIONS.PAGE_PAYMENT_CHANNEL,
    PERMISSIONS.PAGE_OUTSTANDING_DEBT,
    PERMISSIONS.PAGE_AGING_REPORT,
    PERMISSIONS.PAGE_BILLS,
    PERMISSIONS.PAGE_DEBT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_WRITE,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.PAGE_DAILY_SALES,
    PERMISSIONS.PAGE_CUSTOMER_SERVICE,
    PERMISSIONS.PAGE_PAYMENT_CHANNEL,
    PERMISSIONS.PAGE_OUTSTANDING_DEBT,
    PERMISSIONS.PAGE_AGING_REPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],
}

export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS

export function normalizeRolePermissions(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_ROLE_PERMISSIONS

  return Object.values(ROLES).reduce((permissionsByRole, role) => {
    const row = rows.find(item => item.role === role)
    permissionsByRole[role] = Array.isArray(row?.permissions)
      ? row.permissions
      : DEFAULT_ROLE_PERMISSIONS[role] || []
    return permissionsByRole
  }, {})
}

export function can(role, permission, permissionsByRole = DEFAULT_ROLE_PERMISSIONS, userPermissions = null) {
  if (userPermissions?.denied?.includes(permission)) return false
  if (userPermissions?.allowed?.includes(permission)) return true
  return permissionsByRole?.[role]?.includes(permission) || false
}
