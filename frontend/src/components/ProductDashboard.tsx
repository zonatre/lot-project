import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Search, AlertCircle, Package2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ParasutCodeModal } from './ParasutCodeModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Product, SyncStatus } from '../types';
import { toast } from 'sonner';

// Add Vite env type declaration if missing
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PARASUT_COMPANY_ID?: string;
  // add other env variables here as needed
}

// Extend ImportMeta globally for Vite
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

interface ProductDashboardProps {
  onNavigateToProduct: (productId: string) => void;
  onIntegrationStatusChange: (connected: boolean) => void;
}

const parseSktAsEndOfMonth = (skt: string | null) => {
  if (!skt) return null;

  const monthMatch = String(skt).match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return new Date(year, month, 0, 23, 59, 59, 999);
    }
  }

  const date = new Date(skt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatSktMonth = (skt: string | null) => {
  if (!skt) return 'Son kullanma yok';
  const monthMatch = String(skt).match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return `${monthMatch[2]}/${monthMatch[1]}`;

  const date = new Date(skt);
  if (Number.isNaN(date.getTime())) return skt;
  return date.toLocaleDateString('tr-TR');
};

export function ProductDashboard({
  onNavigateToProduct,
  onIntegrationStatusChange,
}: ProductDashboardProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const PARASUT_COMPANY_ID = import.meta.env.VITE_PARASUT_COMPANY_ID || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: '-',
    status: 'pending',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSalesSyncing, setIsSalesSyncing] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [isExchangingCode, setIsExchangingCode] = useState(false);
  const [syncAfterConnect, setSyncAfterConnect] = useState(false);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayLabel = yesterday.toLocaleDateString('tr-TR');

  const readApiError = (payload: any, fallback: string) => {
    if (payload?.message && payload?.details) {
      const details = typeof payload.details === 'string' ? payload.details : JSON.stringify(payload.details);
      return `${payload.message}: ${details}`;
    }
    return payload?.message || fallback;
  };

  const toTrDateTime = (date: Date) =>
    date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const setSyncError = () => {
    setSyncStatus({
      lastSync: toTrDateTime(new Date()),
      status: 'error',
    });
  };

  const extractAuthorizationCode = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
      const parsedUrl = new URL(trimmed);
      return parsedUrl.searchParams.get('code') || trimmed;
    } catch {
      return trimmed;
    }
  };

  const syncFromParasut = async () => {
    const params = new URLSearchParams();
    if (PARASUT_COMPANY_ID) {
      params.set('company_id', PARASUT_COMPANY_ID);
    }

    const syncResponse = await fetch(`${API_BASE_URL}/api/parasut/sync-drafts?${params.toString()}`, {
      method: 'POST',
    });
    if (!syncResponse.ok) {
      const syncError = await syncResponse.json().catch(() => null);
      throw new Error(readApiError(syncError, 'Paraşüt verisi çekilemedi'));
    }

    const payload = await syncResponse.json().catch(() => ({}));
    await fetchFinalProducts();

    setSyncStatus({
      lastSync: toTrDateTime(new Date()),
      status: 'success',
    });
    toast.success(`Taslak senkronizasyon tamamlandı (${payload?.upserted || 0} kayıt)`);
  };

  const fetchFinalProducts = async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    if (!response.ok) {
      throw new Error('Nihai ürün listesi alınamadı');
    }
    const payload = await response.json().catch(() => ({ data: [] }));
    const rawProducts: any[] = Array.isArray(payload?.data) ? payload.data : [];
    const normalized: Product[] = rawProducts
      .map((item: any) => ({
          id: String(item?._id || item?.id || ''),
          name: String(item?.canonicalName || item?.name || 'İsimsiz Ürün'),
          currentActiveLot: item?.currentActiveLot || null,
          skt: item?.skt || null,
          status: item?.currentActiveLot ? 'Active' : 'Passive',
        }));
    setProducts(normalized);

    const latestUpdateMs = rawProducts.reduce((max, item) => {
      const ms = new Date(item?.updatedAt || 0).getTime();
      if (!Number.isFinite(ms)) return max;
      return Math.max(max, ms);
    }, 0);

    if (latestUpdateMs > 0) {
      setSyncStatus({
        lastSync: toTrDateTime(new Date(latestUpdateMs)),
        status: 'success',
      });
    } else {
      setSyncStatus({
        lastSync: 'Henüz senkronizasyon yok',
        status: 'pending',
      });
    }
  };

  const fetchTokenStatus = async () => {
    const statusResponse = await fetch(`${API_BASE_URL}/api/parasut/token/status`);
    if (!statusResponse.ok) {
      throw new Error('Token durumu alınamadı');
    }
    const statusData: { connected: boolean } = await statusResponse.json();
    onIntegrationStatusChange(statusData.connected);
    return statusData.connected;
  };

  const openCodeDialog = async (shouldSyncAfterConnect: boolean) => {
    setAuthorizationCode('');
    setSyncAfterConnect(shouldSyncAfterConnect);
    setIsCodeDialogOpen(true);

    try {
      const authResponse = await fetch(`${API_BASE_URL}/api/parasut/auth-url`);
      if (!authResponse.ok) {
        throw new Error('Yetkilendirme URLi alınamadı');
      }

      const authData: { authUrl: string } = await authResponse.json();
      setAuthUrl(authData.authUrl);
      toast.info('Modal açıldı. Paraşüt giriş sayfasını modal içindeki buton ile açın.');
    } catch {
      setAuthUrl('');
      toast.warning('Yetkilendirme linki alınamadı. Code değerini manuel yapıştırabilirsiniz.');
    }
  };

  useEffect(() => {
    fetchTokenStatus().catch(() => onIntegrationStatusChange(false));
    fetchFinalProducts().catch(() => {
      setProducts([]);
      toast.error('Ürünler yüklenemedi');
    });
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    toast.info('Paraşüt ile senkronize ediliyor...');

    try {
      const connected = await fetchTokenStatus();
      if (!connected) {
        await openCodeDialog(true);
        toast.info('Paraşüt code değerini modal içine yapıştırın');
        return;
      }

      await syncFromParasut();
    } catch (error) {
      setSyncError();
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSalesLots = async () => {
    setIsSalesSyncing(true);
    try {
      const connected = await fetchTokenStatus();
      if (!connected) {
        await openCodeDialog(false);
        toast.info('Önce Paraşüt bağlantısını tamamlayın');
        return;
      }

      const params = new URLSearchParams();
      if (PARASUT_COMPANY_ID) {
        params.set('company_id', PARASUT_COMPANY_ID);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/parasut/sync-sales-lots?${params.toString()}`,
        { method: 'POST' }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readApiError(payload, 'Satış faturaları işlenemedi'));
      }

      toast.success(
        `Satış işleme tamamlandı: ${payload?.assignedLots || 0} satıra LOT atandı`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setIsSalesSyncing(false);
    }
  };

  const handleOpenConnectDialog = async () => {
    await openCodeDialog(false);
  };

  const handleExchangeCode = async () => {
    const normalizedCode = extractAuthorizationCode(authorizationCode);
    if (!normalizedCode) {
      toast.error('Lütfen code değerini girin');
      return;
    }

    setIsExchangingCode(true);
    try {
      const exchangeResponse = await fetch(`${API_BASE_URL}/api/parasut/token/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });

      if (!exchangeResponse.ok) {
        const exchangeError = await exchangeResponse.json().catch(() => null);
        throw new Error(exchangeError?.message || 'Code ile token alınamadı');
      }

      toast.success('Paraşüt bağlantısı tamamlandı');
      setIsCodeDialogOpen(false);
      setAuthorizationCode('');

      if (syncAfterConnect) {
        onIntegrationStatusChange(true);
        setIsSyncing(true);
        await syncFromParasut();
      } else {
        onIntegrationStatusChange(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
      setSyncError();
    } finally {
      setSyncAfterConnect(false);
      setIsExchangingCode(false);
      setIsSyncing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((product: Product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [searchQuery, products]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1>Nihai Ürün Kontrol Paneli</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Son Senkronizasyon</div>
              <div className="text-sm">{syncStatus.lastSync}</div>
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Paraşüt'ten Senkronize Et
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncSalesLots}
              disabled={isSalesSyncing || isSyncing}
            >
              {isSalesSyncing ? 'Satışlar Getiriliyor...' : `${yesterdayLabel} Satışlarını Getir`}
            </Button>
            <Button variant="outline" onClick={handleOpenConnectDialog} disabled={isSyncing}>
              Paraşüt Kodu Gir
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ürün ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Ürün Adı</TableHead>
              <TableHead>Aktif LOT Numarası</TableHead>
              <TableHead>SKT (Son Kullanma)</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <Package2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <div>Ürün bulunamadı</div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product, index) => {
                const expiryDate = parseSktAsEndOfMonth(product.skt);
                const isExpiringSoon = Boolean(
                  expiryDate &&
                    expiryDate <= new Date(new Date().setMonth(new Date().getMonth() + 3)),
                );
                
                return (
                  <TableRow
                    key={product.id}
                    onClick={() => onNavigateToProduct(product.id)}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      index % 2 === 1 ? 'bg-muted/20' : ''
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.name}
                        {isExpiringSoon && (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {product.currentActiveLot || 'Yok'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {product.skt ? (
                        <span className={isExpiringSoon ? 'text-destructive' : ''}>
                          {formatSktMonth(product.skt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Son kullanma yok</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.status === 'Active' ? 'default' : 'secondary'}
                      >
                        {product.status === 'Active' ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ParasutCodeModal
        open={isCodeDialogOpen}
        authUrl={authUrl}
        authorizationCode={authorizationCode}
        isExchangingCode={isExchangingCode}
        onAuthorizationCodeChange={setAuthorizationCode}
        onOpenAuthPage={() => {
          if (authUrl) {
            window.open(authUrl, '_blank', 'noopener,noreferrer');
          } else {
            toast.info('Yetkilendirme linki şu an yok. Code değerini direkt yapıştırabilirsiniz.');
          }
        }}
        onCancel={() => setIsCodeDialogOpen(false)}
        onConfirm={handleExchangeCode}
      />
    </div>
  );
}
