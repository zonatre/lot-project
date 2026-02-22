export interface Product {
  id: string;
  name: string;
  totalStock?: number;
  currentActiveLot: string | null;
  skt: string | null;
  status: 'Active' | 'Passive';
  trendyolSKU?: string;
  hepsiburadaSKU?: string;
  shopifySKU?: string;
}

export interface Lot {
  id: string;
  lotNumber: string;
  productId: string;
  skt: string;
  createdAt: string;
  status: 'Active' | 'Passive';
  quantity?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  productId: string;
  lotId: string;
  lotNumber: string;
  quantity: number;
  date: string;
  channel: 'Trendyol' | 'Hepsiburada' | 'Shopify';
  invoiceNo: string;
  warehouse: string;
  sku: string;
  customerName?: string;
}

export interface SyncStatus {
  lastSync: string;
  status: 'success' | 'pending' | 'error';
}
