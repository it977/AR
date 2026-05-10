# AR Finance System - ລະບົບຈັດການລາຍຮັບ

ລະບົບນີ້ສຳລັບ AR (Accounts Receivable) ເທົ່ານັ້ນ ໃຊ້ຕິດຕາມຍອດຂາຍ, ໃບບິນ, ໜີ້ຄ້າງຊຳລະ, ແລະການອັບໂຫຼດຂໍ້ມູນ Excel ເຂົ້າ Supabase.

## ການຕິດຕັ້ງ

```bash
npm install
npm run dev
npm run build
npm run preview
```

## ຕັ້ງຄ່າ Database

1. ສ້າງ project ໃໝ່ໃນ [Supabase](https://supabase.com)
2. ໄປທີ່ SQL Editor
3. ຖ້າ database ເກົ່າຍັງມີ AP tables ຄ້າງຢູ່ ໃຫ້ run `supabase/drop_ap_tables.sql` ກ່ອນ
4. Run SQL ຕາມລຳດັບນີ້:

- `supabase/schema.sql`
- `supabase/debt_status.sql`
- `supabase/add_recorded_by_debt.sql`

5. ຕັ້ງ `.env` ໃຫ້ມີຄ່າ:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## ໂຄງສ້າງລະບົບ

- Daily Sales
- Customer & Service
- Payment Channel
- Outstanding Debt
- Aging Report
- Bills Management
- Debt Management
- Upload Excel

## Deploy ຂຶ້ນ Cloudflare Pages

1. Run `npm run build`
2. Upload ໂຟນເດີ `dist` ໄປທີ່ Cloudflare Pages ຫຼື connect repo ກັບ Git
3. ຕັ້ງ build command ເປັນ `npm run build`
4. ຕັ້ງ build output directory ເປັນ `dist`
5. ເພີ່ມ environment variables `VITE_SUPABASE_URL` ແລະ `VITE_SUPABASE_ANON_KEY`

## ໝາຍເຫດ

1. ກ່ອນໃຊ້ງານຕ້ອງ run SQL schema ໃຫ້ຄົບ
2. ລະບົບມີ PDF download ສຳລັບໜ້າ AR ຫຼັກ
3. ໜ້າ Upload Excel ໃຊ້ສຳລັບ `ar_bills` ແລະ `ar_debt`

## ເຕັກໂນໂລຊີ

- React 18 + Vite
- Tailwind CSS
- Supabase
- ApexCharts
- html2pdf.js
- Cloudflare Pages

---

**Version**: 2.0.0
**Last Updated**: 2026
**License**: Private
