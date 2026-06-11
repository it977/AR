import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

fp = r'C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx'
daily = pd.read_excel(fp, sheet_name='Daily', header=0)
daily.columns = [str(c).strip().replace('\n ','').replace('  ',' ') for c in daily.columns]
daily['Date'] = pd.to_datetime(daily['Date'], errors='coerce')

# Find any date with bills=39 and grand_total=40,662,000
print('Searching for daily totals matching dashboard...')
target_gross = 40662000
target_bills = 39
g = daily.groupby('Date').agg(bills=('Bill No','nunique'), rows=('Bill No','size'), gross=('Total','sum'), grand=('Grand Total','sum'), debt=('Outstanding Debt','sum'))
print('Days with bills==39:')
print(g[g['bills']==39].to_string())
print()
print('Days with grand~40,662,000 (+/- 50k):')
print(g[(g['grand']>=40612000)&(g['grand']<=40712000)].to_string())
print()

# By workload group on 2026-05-01
print('--- All days nearby for context ---')
nearby = g.loc['2026-04-29':'2026-05-03'] if '2026-04-29' in g.index else g.loc[:'2026-05-05'].tail(15)
print(nearby.to_string())
print()

# Show overall date range
print('Min date:', daily['Date'].min(), 'Max date:', daily['Date'].max())
print('Total rows:', len(daily), 'Total bills:', daily['Bill No'].nunique())
