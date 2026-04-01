-- ========================================
-- AP (Accounts Payable) Schema - Full Version
-- ລະບົບຈັດການໃບເກັບເງິນຂາເຂົ້າ ຄົບວົງຈອນ
-- ========================================

-- DROP ຕາຕະລາງເກົ່າຖ້າມີ (ເພື່ອ avoid conflict)
DROP TABLE IF EXISTS ap_payment CASCADE;
DROP TABLE IF EXISTS ap_register CASCADE;
DROP TABLE IF EXISTS ap_po CASCADE;
DROP TABLE IF EXISTS ap_pr CASCADE;
DROP TABLE IF EXISTS ap_vendors CASCADE;
DROP TABLE IF EXISTS ap_debt CASCADE;
DROP TABLE IF EXISTS ap_bills CASCADE;

-- 1. ຕາຕະລາງ ap_vendors: ຂໍ້ມູນ Vendor (Master Data)
CREATE TABLE IF NOT EXISTS ap_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code TEXT UNIQUE NOT NULL,
  vendor_name TEXT NOT NULL,
  category TEXT, -- ຢາ/Medicine, ອຸປະກອນ/Equip, ຕ້ອງໃຊ້ອງການ, ບໍລິການ/Service, ວັດທະນະປະໄພກ, ຄອມພິວເຕີ
  credit_term INTEGER DEFAULT 30, -- Credit Term (Days)
  type TEXT, -- ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted), ຜູ້ສະໜອງທີ່ບໍ່ມີສັນຍາ (Non-Contracted), ຜູ້ສະໜອງອື່ນໆ
  cost_type_main TEXT, -- COGS, Operating Cost
  cost_type_sub TEXT, -- Cheme, Medicines, Medical Equip, Device, Out source Service, Utility, Staffing salary, Employee Benefit, SSO, Training, Recruitment, Maintenance, Stationaries, Rent, Legal+License, Emergency matter, Medes Office Supply, Others
  department TEXT, -- Pharmacy, Lab, Administration, Emergency Room, IT Support
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  bank_name TEXT,
  bank_account TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ຕາຕະລາງ ap_pr: ບສະເໜີຊື້ (Purchase Request)
CREATE TABLE IF NOT EXISTS ap_pr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  pr_no TEXT UNIQUE NOT NULL,
  request_by TEXT NOT NULL, -- Department
  cost_type_main TEXT, -- COGS, Operating Cost
  cost_type_sub TEXT, -- ໝວດຍ່ອຍ
  est_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Ordered', -- Ordered, Approved, Rejected, Pending
  po_ref TEXT, -- PO ທີ່ເຊື່ອມໂຍງ
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ຕາຕະລາງ ap_po: ໃບສັ່ງຊື້ (Purchase Order)
CREATE TABLE IF NOT EXISTS ap_po (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_date DATE NOT NULL,
  po_no TEXT UNIQUE NOT NULL,
  ref_pr TEXT, -- PR No ທີ່ເຊື່ອມໂຍງ
  department TEXT NOT NULL,
  vendor TEXT NOT NULL,
  cost_type_main TEXT, -- COGS, Operating Cost
  cost_type_sub TEXT, -- ໝວດຍ່ອຍ
  actual_amount NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  deposited_amount NUMERIC DEFAULT 0, -- ຍອດມັດຈຳ
  approve_status TEXT DEFAULT 'Pending', -- Pending, Approved, Revised, Rejected
  grn_no TEXT, -- Goods Received Note
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ຕາຕະລາງ ap_register: ສະເຕດິເບີນຄ້າງຈ່າຍ (AP Register) - ຫຼັກ
CREATE TABLE IF NOT EXISTS ap_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_date DATE NOT NULL, -- ວັນທີ່ັບເບີນ
  invoice_no TEXT NOT NULL,
  invoice_time TEXT, -- ເວລາຮັບເບີນ
  ref_po_grn TEXT, -- PO ຫຼ GRN ທີ່ເຊື່ອມໂຍງ
  vendor_name TEXT NOT NULL,
  cost_type TEXT, -- COGS, Operating Cost
  expense_item TEXT, -- ລາຍການຄ່າໃຊ້ຈ່າຍ (Medicines, Device, Utility, SSO, etc.)
  credit_term INTEGER DEFAULT 30,
  due_date DATE,
  total_amount NUMERIC DEFAULT 0,
  deposited_amount NUMERIC DEFAULT 0, -- ຍອດມັດຈຳ
  paid_date DATE,
  paid_amount NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  days_overdue INTEGER DEFAULT 0,
  aging TEXT, -- N, 0-15 Days, 16-30 Days, 31-45 Days, 46-60+ Days
  status TEXT DEFAULT 'Overdue', -- Paid, Overdue, Pending
  department TEXT,
  solved_time TEXT, -- 10+ Day, etc.
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ຕາຕະລາງ ap_payment: ບັນທຶກການຈ່າຍເງິນ (Payment Log)
CREATE TABLE IF NOT EXISTS ap_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_date DATE NOT NULL,
  pv_no TEXT UNIQUE NOT NULL, -- Payment Voucher No
  ref_invoice TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  payment_method TEXT, -- Transfer, Cash, Cheque, BCEL, BCEL2, LDB
  approved_by TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ດັດຊະນີ (Indexes) ເພ່ອ performance
CREATE INDEX IF NOT EXISTS idx_ap_vendors_code ON ap_vendors(vendor_code);
CREATE INDEX IF NOT EXISTS idx_ap_vendors_name ON ap_vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ap_pr_date ON ap_pr(date);
CREATE INDEX IF NOT EXISTS idx_ap_pr_no ON ap_pr(pr_no);
CREATE INDEX IF NOT EXISTS idx_ap_po_date ON ap_po(po_date);
CREATE INDEX IF NOT EXISTS idx_ap_po_no ON ap_po(po_no);
CREATE INDEX IF NOT EXISTS idx_ap_register_rec_date ON ap_register(rec_date);
CREATE INDEX IF NOT EXISTS idx_ap_register_invoice ON ap_register(invoice_no);
CREATE INDEX IF NOT EXISTS idx_ap_register_vendor ON ap_register(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ap_register_status ON ap_register(status);
CREATE INDEX IF NOT EXISTS idx_ap_register_aging ON ap_register(aging);
CREATE INDEX IF NOT EXISTS idx_ap_payment_date ON ap_payment(payment_date);
CREATE INDEX IF NOT EXISTS idx_ap_payment_pv_no ON ap_payment(pv_no);

-- ຂໍ້ມູນຕົວຢ່າງ (Sample Data) - Vendors
INSERT INTO ap_vendors (vendor_code, vendor_name, category, credit_term, type, cost_type_main, cost_type_sub, department) VALUES
  ('V-001', 'Berlin', 'ຢາ/Medicine', 30, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'COGS', 'Cheme', 'Pharmacy'),
  ('V-002', 'Viengthong', 'ອຸປະກອນ/Equip', 60, 'ຜູ້ສະໜອງອື່ນໆ (Non-Contracted)', 'COGS', 'Medicines', 'Lab'),
  ('V-003', 'EDL', 'ຕ້ອງໃຊ້ອງການ', 7, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'COGS', 'Medical Equip', 'Administration'),
  ('V-004', 'DKSH', 'ຢາ/Medicine', 30, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'COGS', 'Device', 'Emergency Room'),
  ('V-005', 'Zuellig', 'ຢາ/Medicine', 45, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'COGS', 'Out source Service', 'IT Support'),
  ('V-006', 'VT Office', 'ຕ້ອງໃຊ້ອງການ', 15, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'Operating Cost', 'Utility (ໄຟຟ້າ/ນ້ຳປະປາ)', 'Administration'),
  ('V-007', 'Clean Co', 'ບໍລິການ/Service', 30, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'Operating Cost', 'Staffing salary', 'Administration'),
  ('V-008', 'OC2 Laos', 'ແທັການແພດ', 30, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'Operating Cost', 'Employee Benefit', 'HR'),
  ('V-009', 'Water Laos', 'ວັດທະນະປະໄພກ', 7, 'ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 'HR'),
  ('V-010', 'IT Laos', 'ຄອມພິວເຕີ', 15, 'ຜູ້ສະໜອງອື່ນໆ (Non-Contracted)', 'Operating Cost', 'Training', 'IT Support')
ON CONFLICT (vendor_code) DO NOTHING;

-- ຂໍ້ມູນຕົວຢ່າງ - PR Log
INSERT INTO ap_pr (date, pr_no, request_by, cost_type_main, cost_type_sub, est_amount, status, po_ref) VALUES
  ('2026-01-01', 'PR-001', 'Pharmacy', 'COGS', 'Medicines', 5000000, 'Ordered', 'PO-001'),
  ('2026-01-02', 'PR-002', 'Lab', 'COGS', 'Out source Service', 120000000, 'Ordered', 'PO-002'),
  ('2026-01-05', 'PR-003', 'Administration', 'Operating Cost', 'Employee Benefit', 8500000, 'Ordered', 'PO-003'),
  ('2026-01-06', 'PR-004', 'Administration', 'Operating Cost', 'Training', 35000000, 'Ordered', 'PO-004'),
  ('2026-01-08', 'PR-005', 'Administration', 'COGS', 'Device', 15000000, 'Ordered', 'PO-005'),
  ('2026-01-10', 'PR-006', 'IT Support', 'Operating Cost', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 2500000, 'Ordered', 'PO-006'),
  ('2026-01-15', 'PR-007', 'Emergency Room', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 6800000, 'Ordered', 'PO-007'),
  ('2026-01-20', 'PR-008', 'Pharmacy', 'COGS', 'Device', 42000000, 'Ordered', 'PO-008'),
  ('2026-01-25', 'PR-009', 'IT Support', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 18500000, 'Ordered', 'PO-009'),
  ('2026-01-28', 'PR-010', 'Administration', 'COGS', 'Device', 1200000, 'Ordered', 'PO-010'),
  ('2026-02-19', 'PR-011', 'Lab', 'COGS', 'Medicines', 1000000, 'Ordered', 'PO-011')
ON CONFLICT DO NOTHING;

-- ຂໍ້ມູນຕົວຢ່າງ - PO Log
INSERT INTO ap_po (po_date, po_no, ref_pr, department, vendor, cost_type_main, cost_type_sub, actual_amount, discount_percent, deposited_amount, approve_status, grn_no) VALUES
  ('2026-01-03', 'PO-004', 'PR-004', 'Administration', 'EDL', 'Operating Cost', 'Training', 4800000, 10, 480000, 'Revised', NULL),
  ('2026-01-03', 'PO-001', 'PR-001', 'Pharmacy', 'Zuellig', 'COGS', 'Medicines', 4800000, 0, 0, 'Revised', NULL),
  ('2026-01-03', 'PO-002', 'PR-002', 'Lab', 'Berlin', 'COGS', 'Out source Service', 120000000, 0, 0, 'Rejected', 'GRN-002'),
  ('2026-01-05', 'PO-003', 'PR-003', 'Administration', 'VT Office', 'Operating Cost', 'Employee Benefit', 8500000, 0, 0, 'Rejected', NULL),
  ('2026-01-07', 'PO-005', 'PR-005', 'Administration', 'EDL', 'COGS', 'Device', 35000000, 0, 0, 'Rejected', 'GRN-003'),
  ('2026-01-10', 'PO-008', 'PR-008', 'Pharmacy', 'Water Laos', 'COGS', 'Device', 15000000, 0, 0, 'Revised', 'SVC-01'),
  ('2026-01-12', 'PO-007', 'PR-007', 'Emergency Room', 'DKSH', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 2500000, 0, 0, 'Approved', 'GRN-004'),
  ('2026-01-16', 'PO-010', 'PR-010', 'Administration', 'Berlin', 'COGS', 'Device', 6800000, 0, 0, 'Approved', 'GRN-005'),
  ('2026-01-22', 'PO-009', 'PR-009', 'IT Support', 'IT Laos', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 42000000, 0, 0, 'Revised', 'GRN-006'),
  ('2026-01-27', 'PO-006', 'PR-006', 'IT Support', 'IT Laos', 'Operating Cost', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 18500000, 0, 0, 'Approved', NULL),
  ('2026-02-19', 'PO-011', 'PR-011', 'Lab', 'Berlin', 'COGS', 'Medicines', 900000, 0, 0, 'Pending', NULL),
  ('2026-02-19', 'PO-002', 'PR-002', 'Lab', 'Viengthong', 'COGS', 'Out source Service', 0, 0, 0, 'Pending', NULL)
ON CONFLICT DO NOTHING;

-- ຂໍ້ມູນຕົວຢ່າງ - AP Register
INSERT INTO ap_register (rec_date, invoice_no, invoice_time, ref_po_grn, vendor_name, cost_type, expense_item, credit_term, due_date, total_amount, deposited_amount, paid_date, paid_amount, balance, days_overdue, aging, status, department, solved_time) VALUES
  ('2026-01-02', 'INV-B001', '10:00', 'PO-004', 'EDL', 'Operating Cost', 'Training', 7, '2026-01-09', 8500000, 480000, '2026-01-15', 8020000, 0, 0, 'N', 'Paid', 'Administration', '10+ Day'),
  ('2026-01-05', 'INV-B01', '14:00', 'PO-005', 'EDL', 'COGS', 'Device', 7, '2026-01-12', 1500000, 0, '2026-02-19', 1500000, 0, 0, 'N', 'Paid', 'Administration', '10+ Day'),
  ('2026-01-05', 'INV-V01', '09:00', 'PO-006', 'IT Laos', 'Operating Cost', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 15, '2026-01-20', 1600000, 0, NULL, 0, 1600000, 71, '30+ Days', 'Overdue', 'IT Support', '30+ Days'),
  ('2026-01-10', 'BILL-EDL', '11:00', 'PO-007', 'DKSH', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 30, '2026-02-09', 1700000, 0, NULL, 0, 1700000, 51, '30+ Days', 'Overdue', 'Emergency Room', '30+ Days'),
  ('2026-01-10', 'INV-D01', '15:00', 'PO-008', 'Water Laos', 'COGS', 'Device', 7, '2026-01-17', 1800000, 0, NULL, 0, 1800000, 74, '30+ Days', 'Overdue', 'Pharmacy', '30+ Days'),
  ('2026-01-15', 'INV-C01', '10:00', 'PO-009', 'IT Laos', 'Operating Cost', 'SSO (ປະກັນສັງຄົມ)', 15, '2026-01-30', 1900000, 0, NULL, 0, 1900000, 61, '30+ Days', 'Overdue', 'IT Support', '30+ Days'),
  ('2026-01-15', 'INV-OFF1', '16:00', 'PO-010', 'Berlin', 'COGS', 'Device', 30, '2026-02-14', 2000000, 0, NULL, 0, 2000000, 46, '30+ Days', 'Overdue', 'Administration', '30+ Days'),
  ('2026-01-20', 'INV-OXY', '09:00', 'PO-001', 'Zuellig', 'COGS', 'Medicines', 45, '2026-03-06', 2100000, 0, NULL, 0, 2100000, 26, '16-30 Days', 'Overdue', 'Pharmacy', '16-30 Days'),
  ('2026-01-25', 'INV-Z01', '14:00', 'PO-002', 'Berlin', 'COGS', 'Medicines', 30, '2026-02-24', 2200000, 0, NULL, 0, 2200000, 36, '30+ Days', 'Overdue', 'Lab', '30+ Days'),
  ('2026-02-19', 'INV-Z02', '10:00', 'PO-011', 'Berlin', 'COGS', 'Medicines', 30, '2026-03-21', 900000, 0, NULL, 0, 900000, 11, '0-15 Days', 'Overdue', 'Lab', '0-15 Days')
ON CONFLICT DO NOTHING;

-- ຂໍ້ມູນຕົວຢ່າງ - Payment Log
INSERT INTO ap_payment (payment_date, pv_no, ref_invoice, vendor, amount_paid, payment_method, approved_by) VALUES
  ('2026-01-15', 'PO-004', 'INV-B001', 'EDL', 8020000, 'Transfer', 'Test'),
  ('2026-02-19', 'PO-005', 'INV-B01', 'EDL', 1500000, 'Cash', 'Test')
ON CONFLICT DO NOTHING;

-- ສ້າງ RLS Policies (Row Level Security)
ALTER TABLE ap_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_pr ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_po ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_payment ENABLE ROW LEVEL SECURITY;

-- ອະນຸຍາດໃຫ້ read/write ທຸກຢ່າງ (ສຳລັບ development)
CREATE POLICY "Enable all access for ap_vendors" ON ap_vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_pr" ON ap_pr FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_po" ON ap_po FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_register" ON ap_register FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_payment" ON ap_payment FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- ສເລັດ! ້າງ AP Schema ົບວົງຈອນແລ້ວ
-- ========================================
