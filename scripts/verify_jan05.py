import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

fp = r'C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx'
daily = pd.read_excel(fp, sheet_name='Daily', header=0)
daily.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in daily.columns]
daily['Date'] = pd.to_datetime(daily['Date'], errors='coerce')

for target_str in ['2026-01-05','2026-05-01']:
    target = pd.Timestamp(target_str)
    d = daily[daily['Date']==target].copy()
    print(f'=== {target_str} ===')
    print('rows:', len(d), 'bills:', d['Bill No'].nunique())
    print('Total:', d['Total'].sum(), 'Grand:', d['Grand Total'].sum(), 'Debt:', d['Outstanding Debt'].sum())
    g = d.groupby('Workload').agg(bills=('Bill No','nunique'), grand=('Grand Total','sum'), debt=('Outstanding Debt','sum'))
    print(g.to_string())
    print()

# Pay off for both dates
po = pd.read_excel(fp, sheet_name='Pay off', header=0)
po.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in po.columns]
po['Date'] = pd.to_datetime(po['Date'], errors='coerce')
po['Date Paid'] = pd.to_datetime(po['Date Paid'], errors='coerce')

for target_str in ['2026-01-05','2026-05-01']:
    target = pd.Timestamp(target_str)
    po_paid = po[po['Date Paid']==target]
    po_orig = po[po['Date']==target]
    print(f'=== Pay off {target_str} ===')
    print('paid on this date:', len(po_paid), 'Amount Paid sum:', po_paid['Amount Paid'].sum())
    print('originated this date:', len(po_orig), 'Amount Paid sum:', po_orig['Amount Paid'].sum())
    print()
