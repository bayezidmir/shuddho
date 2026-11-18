export type StaffRole =
  | 'owner'
  | 'manager'
  | 'agent'
  | 'packer'
  | 'editor'
  | 'marketing'
  | 'accountant';

export type Permission =
  | 'dashboard.view'
  | 'orders.view'
  | 'orders.edit'
  | 'orders.confirm'
  | 'orders.pack'
  | 'orders.courier'
  | 'incomplete_orders.view'
  | 'customers.view'
  | 'customers.edit'
  | 'products.view'
  | 'products.edit'
  | 'inventory.view'
  | 'inventory.edit'
  | 'couriers.view'
  | 'couriers.edit'
  | 'marketing.view'
  | 'marketing.edit'
  | 'content.view'
  | 'content.edit'
  | 'appearance.edit'
  | 'reports.view'
  | 'users.manage'
  | 'notifications.edit'
  | 'settings.view'
  | 'settings.edit'
  | 'tracking.code_inject';

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner / Super Admin',
  manager: 'Store Manager',
  agent: 'Order Confirmation Agent',
  packer: 'Packer / Warehouse',
  editor: 'Content Editor',
  marketing: 'Marketing Specialist',
  accountant: 'Accountant',
};

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  owner: [
    'dashboard.view',
    'orders.view',
    'orders.edit',
    'orders.confirm',
    'orders.pack',
    'orders.courier',
    'incomplete_orders.view',
    'customers.view',
    'customers.edit',
    'products.view',
    'products.edit',
    'inventory.view',
    'inventory.edit',
    'couriers.view',
    'couriers.edit',
    'marketing.view',
    'marketing.edit',
    'content.view',
    'content.edit',
    'appearance.edit',
    'reports.view',
    'users.manage',
    'notifications.edit',
    'settings.view',
    'settings.edit',
    'tracking.code_inject',
  ],
  manager: [
    'dashboard.view',
    'orders.view',
    'orders.edit',
    'orders.confirm',
    'orders.pack',
    'orders.courier',
    'incomplete_orders.view',
    'customers.view',
    'customers.edit',
    'products.view',
    'products.edit',
    'inventory.view',
    'inventory.edit',
    'couriers.view',
    'couriers.edit',
    'marketing.view',
    'marketing.edit',
    'content.view',
    'content.edit',
    'reports.view',
    'notifications.edit',
  ],
  agent: [
    'dashboard.view',
    'orders.view',
    'orders.edit',
    'orders.confirm',
    'incomplete_orders.view',
    'customers.view',
  ],
  packer: [
    'orders.view',
    'orders.pack',
    'orders.courier',
    'inventory.view',
  ],
  editor: [
    'products.view',
    'products.edit',
    'content.view',
    'content.edit',
  ],
  marketing: [
    'dashboard.view',
    'marketing.view',
    'marketing.edit',
    'reports.view',
    'customers.view',
  ],
  accountant: [
    'dashboard.view',
    'orders.view',
    'couriers.view',
    'reports.view',
    'customers.view',
  ],
};

export function hasPermission(
  role: StaffRole | string,
  permission: Permission,
  customOverrides?: Partial<Record<StaffRole, Permission[]>>,
): boolean {
  const r = role as StaffRole;
  const list = customOverrides?.[r] ?? ROLE_PERMISSIONS[r] ?? [];
  return list.includes(permission);
}
