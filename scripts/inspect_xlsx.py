import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
fp = r'C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx'
for s in ['Daily','Pay off','Master_Clean','Summary_CashFlow','Looker_Data','Data']:
    df = pd.read_excel(fp, sheet_name=s, header=None, nrows=8)
    print('===', s, df.shape, '===')
    print(df.to_string())
    print()
