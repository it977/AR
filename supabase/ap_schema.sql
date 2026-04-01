-- ========================================
-- AP (Accounts Payable) Schema
-- ລະບົບຈັດການໃບເກັບເງິນຂາເຂົ້າ ແລະ ການຈ່າຍເງິນ Vendor
-- ========================================

-- ຕາຕະລາງ ap_bills: ບັນທຶກໃບເກັບເງິນຈາກ Vendor
CREATE TABLE IF NOT EXISTS ap_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ຂໍ້ມູນພ້ນຖານ
  date DATE NOT NULL,
  week TEXT,
  workload TEXT,
  invoice_no TEXT NOT NULL,
  po_no TEXT,
  po_date DATE,
  
  -- ຂໍ້ມູນ Vendor
  vendor_name TEXT NOT NULL,
  vendor_code TEXT,
  department TEXT,
  contact_person TEXT,
  phone TEXT,
  
  -- ຂໍ້ມູນໃບເກັບເງິນ
  bill_date DATE,
  due_date DATE,
  description TEXT,
  
  -- ລາຍັບຕາມປະເພດ (ຄ້າຍ AR)
  svc_materials NUMERIC DEFAULT 0,
  svc_equipment NUMERIC DEFAULT 0,
  svc_maintenance NUMERIC DEFAULT 0,
  svc_consulting NUMERIC DEFAULT 0,
  svc_training NUMERIC DEFAULT 0,
  svc_software NUMERIC DEFAULT 0,
  svc_other NUMERIC DEFAULT 0,
  
  -- ຍອດເງິນ
  total NUMERIC DEFAULT 0,
  vat NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  
  -- ການຈ່າຍເງິນ
  cash_paid NUMERIC DEFAULT 0,
  bcel_paid NUMERIC DEFAULT 0,
  bcel2_paid NUMERIC DEFAULT 0,
  ldb_paid NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  
  -- ໜີ້ຄ້າງ
  balance NUMERIC DEFAULT 0,
  debt_status TEXT, -- 'pending', 'paid', 'partial'
  
  -- ສະຖານະ
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'revised'
  approved_by TEXT,
  approved_date DATE,
  rejected_reason TEXT,
  
  -- ອື່ນ
  aging_group TEXT,
  note TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(invoice_no, date)
);

-- ຕາຕະລາງ ap_debt: ບັນທຶກໜີ້ສິນຄ້າງຈ່າຍ (Pay off)
CREATE TABLE IF NOT EXISTS ap_debt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ຂໍ້ມູນພື້ນຖານ
  date DATE NOT NULL,
  invoice_no TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_code TEXT,
  department TEXT,
  po_no TEXT,
  
  -- ຍອດເງິນ
  grand_total NUMERIC DEFAULT 0,
  debt_amount NUMERIC DEFAULT 0,
  
  -- ການຈ່າຍເງິນ
  date_paid DATE,
  submit_date DATE,
  amount_paid NUMERIC DEFAULT 0,
  cash_paid NUMERIC DEFAULT 0,
  bcel_paid NUMERIC DEFAULT 0,
  bcel2_paid NUMERIC DEFAULT 0,
  ldb_paid NUMERIC DEFAULT 0,
  
  -- ຍອດຄ້າງ
  balance NUMERIC DEFAULT 0,
  due_date DATE,
  aging_group TEXT,
  
  -- ສະານະ
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'partial'
  approved_by TEXT,
  approved_date DATE,
  
  -- ອື່ນໆ
  note TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(invoice_no, date)
);

-- ຕາຕະລາງ ap_vendors: ຂໍ້ມູນ Vendor (ເສີມ)
CREATE TABLE IF NOT EXISTS ap_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code TEXT UNIQUE NOT NULL,
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  bank_name TEXT,
  bank_account TEXT,
  payment_terms INTEGER DEFAULT 30, -- ວັນຊຳລະ
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ດັດຊະນີ (Indexes) ເພ່ອ performance
CREATE INDEX IF NOT EXISTS idx_ap_bills_invoice ON ap_bills(invoice_no);
CREATE INDEX IF NOT EXISTS idx_ap_bills_vendor ON ap_bills(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ap_bills_date ON ap_bills(date);
CREATE INDEX IF NOT EXISTS idx_ap_bills_status ON ap_bills(status);
CREATE INDEX IF NOT EXISTS idx_ap_bills_aging ON ap_bills(aging_group);
CREATE INDEX IF NOT EXISTS idx_ap_bills_debt_status ON ap_bills(debt_status);

CREATE INDEX IF NOT EXISTS idx_ap_debt_invoice ON ap_debt(invoice_no);
CREATE INDEX IF NOT EXISTS idx_ap_debt_vendor ON ap_debt(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ap_debt_date ON ap_debt(date);
CREATE INDEX IF NOT EXISTS idx_ap_debt_status ON ap_debt(status);
CREATE INDEX IF NOT EXISTS idx_ap_debt_aging ON ap_debt(aging_group);

CREATE INDEX IF NOT EXISTS idx_ap_vendors_code ON ap_vendors(vendor_code);

-- ຂໍ້ມູນຕົວຢ່າງ (Sample Data)
INSERT INTO ap_vendors (vendor_code, vendor_name, contact_person, phone, payment_terms) VALUES
  ('VEN001', 'EDL', 'ສົມຈິດ', '020 1234 5678', 30),
  ('VEN002', 'Berlin', 'ນາງມາລີ', '020 2345 6789', 30),
  ('VEN003', 'IT Laos', 'ທ້າວສຸກ', '020 3456 7890', 30),
  ('VEN004', 'Zuellig', 'ນາງສີ', '020 4567 8901', 30),
  ('VEN005', 'Water Laos', 'ທ້າວຈັນ', '020 5678 9012', 30),
  ('VEN006', 'DKSH', 'ນາງແພວ', '020 6789 0123', 30)
ON CONFLICT (vendor_code) DO NOTHING;

-- ຕົວຢ່າງຂໍ້ມູນ AP Bills
INSERT INTO ap_bills (
  date, week, workload, invoice_no, po_no, po_date, vendor_name, vendor_code, department,
  bill_date, due_date, description,
  svc_materials, svc_equipment, svc_maintenance, svc_other,
  total, vat, grand_total,
  cash_paid, bcel_paid, balance, debt_status,
  status, aging_group, note, recorded_by
) VALUES
  ('2026-01-15', 'Week 3', '8AM-4PM', 'INV-EDL001', 'PO-2026-001', '2026-01-10', 'EDL', 'VEN001', 'Pharmacy',
   '2026-01-15', '2026-02-14', 'ຢາ ແລະ ອຸປະກອນການແພດ',
   10000000, 0, 0, 0,
   10000000, 700000, 10700000,
   0, 0, 10700000, 'pending',
   'approved', '30+ Days', 'ຄ້າງຈ່າຍ', 'Admin'),
   
  ('2026-01-20', 'Week 4', '8AM-4PM', 'INV-BER001', 'PO-2026-002', '2026-01-15', 'Berlin', 'VEN002', 'IT Support',
   '2026-01-20', '2026-02-19', 'ອຸປະກອນຄອມພິວເຕີ',
   3000000, 2000000, 0, 0,
   5000000, 350000, 5350000,
   0, 0, 5350000, 'pending',
   'approved', '30+ Days', 'ຄ້າງຈ່າຍ', 'Admin'),
   
  ('2026-01-25', 'Week 5', '8AM-4PM', 'INV-ITL001', 'PO-2026-003', '2026-01-20', 'IT Laos', 'VEN003', 'IT Support',
   '2026-01-25', '2026-02-24', 'ບໍລິການບຳລຸງຮັກສາ',
   0, 0, 1500000, 0,
   1500000, 105000, 1605000,
   0, 0, 1605000, 'pending',
   'pending', '30+ Days', 'ລໍຖ້າອະນຸມັດ', 'Admin')
ON CONFLICT (invoice_no, date) DO NOTHING;

-- ຕົວຢ່າງຂໍ້ມູນ AP Debt (ທີ່ຈ່າຍແລ້ວ)
INSERT INTO ap_debt (
  date, invoice_no, vendor_name, vendor_code, department, po_no,
  grand_total, debt_amount,
  date_paid, submit_date, amount_paid, cash_paid, bcel_paid,
  balance, due_date, aging_group,
  status, note, recorded_by
) VALUES
  ('2026-01-10', 'INV-EDL-PAID', 'EDL', 'VEN001', 'Pharmacy', 'PO-2026-000',
   9520000, 9520000,
   '2026-01-10', '2026-01-10', 9520000, 0, 9520000,
   0, '2026-02-09', '0-15 Days',
   'paid', 'ຈ່າຍແລ້ວ', 'Admin')
ON CONFLICT (invoice_no, date) DO NOTHING;

-- ສ້າງ RLS Policies (Row Level Security)
ALTER TABLE ap_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_debt ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_vendors ENABLE ROW LEVEL SECURITY;

-- ອະນຸຍາດໃຫ້ read/write ທຸກຢ່າງ (ສຳລັບ development)
CREATE POLICY "Enable all access for ap_bills" ON ap_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_debt" ON ap_debt FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for ap_vendors" ON ap_vendors FOR ALL USING (true) WITH CHECK (true);

-- ສ້າງ Function ອັບເດດ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ສ້າງ Trigger ອັບເດດ updated_at
DROP TRIGGER IF EXISTS update_ap_bills_updated_at ON ap_bills;
CREATE TRIGGER update_ap_bills_updated_at
  BEFORE UPDATE ON ap_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ap_debt_updated_at ON ap_debt;
CREATE TRIGGER update_ap_debt_updated_at
  BEFORE UPDATE ON ap_debt
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ap_vendors_updated_at ON ap_vendors;
CREATE TRIGGER update_ap_vendors_updated_at
  BEFORE UPDATE ON ap_vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ສຳເລັດ! ສ້າງ AP Schema ແລ້ວ
-- ========================================
