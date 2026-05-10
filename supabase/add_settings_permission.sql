-- ເພີ່ມ page.settings ໃຫ້ Admin ແລະ Manager ໃນ role_permissions table
-- Run ໃນ Supabase SQL Editor

update role_permissions
set permissions = array_append(permissions, 'page.settings')
where role in ('admin', 'manager')
  and not ('page.settings' = any(permissions));
