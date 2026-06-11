import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

fp = r'C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx'

# Read Daily with header row 0
daily = pd.read_excel(fp, sheet_name='Daily', header=0)
daily.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in daily.columns]
print('Daily columns:', daily.columns.tolist())
print()

# Filter for 2026-05-01
daily['Date'] = pd.to_datetime(daily['Date'], errors='coerce')
target = pd.Timestamp('2026-05-01')
d = daily[daily['Date']==target].copy()
print('Rows on 2026-05-01:', len(d))
print('Workload values:', d['Workload'].value_counts(dropna=False).to_dict())
print()

# Aggregates
print('Total (gross):', d['Total'].sum())
print('Discounts:', d['Discounts'].sum())
print('Grand Total (net):', d['Grand Total'].sum())
print('Outstanding Debt:', d['Outstanding Debt'].sum())
print('Cash:', d['Cash Received'].sum())
print('BCEL:', d['Transfer Payment by BCEL'].sum())
print('BCEL2:', d['Transfer Payment by BCEL2'].sum())
print('LDB:', d['Transfer Payment by LDB'].sum())
print('Bill count:', d['Bill No'].nunique(), '/ rows:', len(d))
print()

# By workload
print('--- By Workload ---')
g = d.groupby('Workload').agg(bills=('Bill No','nunique'), total=('Total','sum'), grand=('Grand Total','sum'), debt=('Outstanding Debt','sum'))
print(g.to_string())
print()

# Pay off on 2026-05-01 (collections on that day's bills, or paid on that day?)
po = pd.read_excel(fp, sheet_name='Pay off', header=0)
po.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in po.columns]
print('Pay off columns:', po.columns.tolist())
po['Date'] = pd.to_datetime(po['Date'], errors='coerce')
po['Date Paid'] = pd.to_datetime(po['Date Paid'], errors='coerce')

# Bills originated on 2026-05-01 that have paid off
po_orig = po[po['Date']==target]
print('Pay off rows with original date 2026-05-01:', len(po_orig))
print('Amount Paid (bills originated 5/1):', po_orig['Amount Paid'].sum())
print()

# Payments received on 2026-05-01 (collection day)
po_paid = po[po['Date Paid']==target]
print('Pay off rows with Date Paid == 2026-05-01:', len(po_paid))
print('Amount Paid (collected 5/1):', po_paid['Amount Paid'].sum())
