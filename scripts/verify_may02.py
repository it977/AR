import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

fp = r'C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx'

# Daily
d = pd.read_excel(fp, sheet_name='Daily', header=0)
d.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in d.columns]
d['Date'] = pd.to_datetime(d['Date'], errors='coerce')

target = pd.Timestamp('2026-05-02')
df = d[d['Date']==target].copy()
print(f'=== 2026-05-02 ===')
print('Bills (unique):', df['Bill No'].nunique(), 'Rows:', len(df))
print('Gross:', df['Total'].sum())
print('Discounts:', df['Discounts'].sum())
print('Net:', df['Grand Total'].sum())
print('Outstanding Debt:', df['Outstanding Debt'].sum())
print()
g = df.groupby('Workload').agg(bills=('Bill No','nunique'), revenue=('Grand Total','sum'), debt=('Outstanding Debt','sum'))
print('--- By Workload ---')
print(g.to_string())
print()

# Bills with outstanding debt > 0
unpaid = df[df['Outstanding Debt']>0]
print(f'Bills with debt > 0 on 5/2: {unpaid["Bill No"].nunique()} (total outstanding {unpaid["Outstanding Debt"].sum():,.0f})')
print()

# Pay off
po = pd.read_excel(fp, sheet_name='Pay off', header=0)
po.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in po.columns]
po['Date'] = pd.to_datetime(po['Date'], errors='coerce')
po['Date Paid'] = pd.to_datetime(po['Date Paid'], errors='coerce')

po_orig = po[po['Date']==target]
po_paid = po[po['Date Paid']==target]
print(f'Pay off — bills originated 5/2: {len(po_orig)}, Amount Paid sum: {po_orig["Amount Paid"].sum():,.0f}')
print(f'Pay off — payments received 5/2: {len(po_paid)}, Amount Paid sum: {po_paid["Amount Paid"].sum():,.0f}')
