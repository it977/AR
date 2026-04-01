# AR-AP Finance System - ລະບົບຈັດການການເງິນ

ລະບົບຈັດການ AR (Accounts Receivable) ແລະ AP (Accounts Payable) ຄົບວົງຈອນ

## 🚀 ການຕິດຕັ້ງ ແລະ ນຳໃຊ້

### 1. ສລັບ Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### 2. ຕັ້ງຄ່າ Database (Supabase)

1. ສ້າງໂປຣເຈັກໃໝ່ທີ່ [Supabase](https://supabase.com)
2. ໄປທີ່ SQL Editor
3. Run SQL ຕາມລຳດັບ:

**ສຳລັບ AR (Accounts Receivable):**
- ໃຊ້ໄຟລ໌: `supabase/ap_schema.sql` (ສຳລັບ AR ເກົ່າ)

**ສຳລັບ AP (Accounts Payable) - ໃໝ່:**
- ໃຊ້ໄຟລ໌: `supabase/ap_schema_full.sql` (ຄົບວົງຈອນ)

4. ຄັດລອກ `.env.example` ເປັນ `.env`
5. ໃສ່ຄ່າ Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 📊 ໂຄງສ້າງລະບົບ

### AR (Accounts Receivable) - ລາຍັບ
- Daily Sales - ລາຍງານປະຈຳວັນ
- Customer & Service - ຈັດການລູກຄ້າ
- Payment Channel - ຊ່ອງທາງການຊຳລະ
- Outstanding Debt - ໜີ້ຄ້າງຊຳລະ
- Aging Report - ລາຍງານອາຍຸໜີ້
- Bills Management - ຈັດການໃບບິນ
- Debt Management - ຈັດການໜີ້

### AP (Accounts Payable) - ລາຍຈ່າຍ
- **00_Vendor Master** - ຂໍ້ມູນ Vendor
- **01_PR Log** - ໃບສະເໜີຊື້ (Purchase Request)
- **02_PO Log** - ໃບສັ່ງຊື້ (Purchase Order)
- **03_AP Register** - ເບີນຄ້າງຈ່າຍ
- **04_Payment Log** - ບັນທກການຈ່າຍເງິນ
- AP Dashboard - ແດດບອດສະຫຼຸບ
- AP Management - ຈັດການໃບເກັບເງິນ
- AP Debt Payment - ຈ່າຍໜີ້ຄ້າງ

## 📤 ການ Deploy ຂຶ້ນ Cloudflare Pages

### ວິທີທີ 1: ອັບໂຫຼດໂດຍກົງ (Recommended)

1. Build ໂຄງການ:
```bash
npm run build
```

2. ໄປທີ່ [Cloudflare Dashboard](https://dash.cloudflare.com)
3. ເລືອກ **Pages** → **Create a project**
4. ເລອກ **Upload assets**
5. Drag & drop ໂຟນເດີ `dist` ທັງໝົດ
6. ຕັ້ງຊ່ໂປຣເຈັກ: `ar-ap-finance`
7. ກົດ **Deploy**

### ວິທີທີ 2: ເຊື່ອມຕໍ່ກັບ GitHub

1. Push ຂຶ້ນ GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. ໄປທີ່ [Cloudflare Dashboard](https://dash.cloudflare.com)
3. ເລືອກ **Pages** → **Create a project**
4. ເລອກ **Connect to Git**
5. ເລືອກ repository `AR-main`
6. ຕັ້ງຄ່າ:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
7. ກົດ **Save and Deploy**

### ຕັ້ງຄ່າ Environment Variables

ໃນ Cloudflare Pages Dashboard:
1. ໄປທີ່ **Settings** → **Environment variables**
2. ເພີ່ມຕົວປ່ຽນ:
```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
```

## 🎯 ການນຳໃຊ້

### ເຂົ້າໃຊ້ງານລະບົບ
- **Development**: http://localhost:5174
- **Production**: https://ar-ap-finance.pages.dev (ຫຼັງ deploy)

### ປະເພດຜູ້ໃຊ້
1. **Admin** - ຈັດການທຸກຢ່າງໄດ້
2. **User** - ບັນທກ ແລະ ູຂໍ້ມູນໄດ້

## 📝 ໝາຍເຫດສຳຄັນ

1. **Database Schema** - ຕ້ອງ Run SQL ກ່ອນໃຊ້ງານ
2. **PDF Download** - ມີປຸ່ມດາວໂຫຼດ PDF ທຸກໜ້າ
3. **Responsive** - ໃຊ້ງານໄດ້ທັງມືຖື ລະ ຄອມພິວເຕີ

## 🛠️ ຕັກໂນໂລຊີທີ່ໃຊ້

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: ApexCharts
- **PDF**: html2pdf.js
- **Deployment**: Cloudflare Pages

## 📞 ການຊ່ວຍເຫຼືອ

ຖ້າມີບັນຫາ ຫຼື ຄຳາມ:
1. ວດ Console ໃນ Browser
2. ກວດ Supabase Dashboard
3. ຕິດຕໍ່ທີມພັດທະນາ

---

**Version**: 2.0.0  
**Last Updated**: 2026  
**License**: Private
