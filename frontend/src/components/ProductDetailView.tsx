import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Link2, Info, Save, Pencil, X, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
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

interface ProductDetailViewProps {
  productId: string;
  onBack: () => void;
  onViewLot: (lotId: string, productId: string) => void;
}

type SourceItem = {
  parasutId: string;
  name: string;
  code?: string;
  archived?: boolean;
};

type ProductDetail = {
  _id: string;
  canonicalName: string;
  status: 'Active' | 'Passive';
  currentActiveLot: string | null;
  skt: string | null;
  sourceItems?: SourceItem[];
};

type LotItem = {
  _id: string;
  lotNumber: string;
  skt: string;
  status: 'Active' | 'Passive';
  createdAt: string;
};

type SalesLotAssignment = {
  _id: string;
  issueDate: string;
  invoiceNumber: string;
  invoiceId: string;
  lotNumber: string;
  unit?: string;
  warehouse?: string;
  createdAt: string;
};

const formatSktMonth = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  return `${match[2]}/${match[1]}`;
};

export function ProductDetailView({ productId, onBack, onViewLot }: ProductDetailViewProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [lots, setLots] = useState<LotItem[]>([]);
  const [salesAssignments, setSalesAssignments] = useState<SalesLotAssignment[]>([]);

  const [newLotNumber, setNewLotNumber] = useState('');
  const [newSKT, setNewSKT] = useState('');
  const [editableName, setEditableName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSourceItemsOpen, setIsSourceItemsOpen] = useState(false);
  const [isSalesAssignmentsOpen, setIsSalesAssignmentsOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [newParasutId, setNewParasutId] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const [productRes, lotsRes, salesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/products/${productId}`),
        fetch(`${API_BASE_URL}/api/products/${productId}/lots`),
        fetch(`${API_BASE_URL}/api/products/${productId}/sales-lot-assignments`),
      ]);

      if (!productRes.ok) {
        throw new Error('Ürün detayı alınamadı');
      }
      if (!lotsRes.ok) {
        throw new Error('LOT listesi alınamadı');
      }
      if (!salesRes.ok) {
        throw new Error('Satış LOT atamaları alınamadı');
      }

      const productPayload = await productRes.json();
      const lotsPayload = await lotsRes.json();
      const salesPayload = await salesRes.json();

      setProduct(productPayload?.data || null);
      setEditableName(String(productPayload?.data?.canonicalName || ''));
      setLots(Array.isArray(lotsPayload?.data) ? lotsPayload.data : []);
      setSalesAssignments(Array.isArray(salesPayload?.data) ? salesPayload.data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
      setProduct(null);
      setLots([]);
      setSalesAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [productId]);

  const handleAddLot = async () => {
    if (!newLotNumber || !newSKT) {
      toast.error('LOT Numarası ve SKT zorunludur');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNumber: newLotNumber.trim(),
          skt: newSKT,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'LOT kaydedilemedi');
      }

      toast.success('Yeni LOT oluşturuldu');
      setNewLotNumber('');
      setNewSKT('');
      await fetchDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    }
  };

  const handleUpdateProductName = async () => {
    const nextName = editableName.trim();
    if (!nextName) {
      toast.error('Ürün adı zorunlu');
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalName: nextName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Ürün adı güncellenemedi');
      }

      setProduct(payload?.data || null);
      setEditableName(String(payload?.data?.canonicalName || nextName));
      setIsEditingName(false);
      toast.success('Ürün adı güncellendi');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setSavingName(false);
    }
  };

  const handleAddSourceItem = async () => {
    const parasutId = newParasutId.trim();
    if (!parasutId) {
      toast.error('Paraşüt ID zorunlu');
      return;
    }

    setAddingSource(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}/source-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parasutId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Paraşüt kaydı eklenemedi');
      }

      setProduct(payload?.data || null);
      setNewParasutId('');
      toast.success('Paraşüt kaydı ürüne eklendi');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setAddingSource(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Yükleniyor...</div>;
  }

  if (!product) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2>Ürün bulunamadı</h2>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Panoya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Panoya Dön
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1>{product.canonicalName}</h1>
              {!isEditingName && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingName(true)}
                  className="h-8 w-8"
                  title="Ürün adını düzenle"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
            {isEditingName && (
              <div className="mt-3 flex items-end gap-2 max-w-xl">
                <div className="flex-1">
                  <Label htmlFor="product-name">Ürün Adı</Label>
                  <Input
                    id="product-name"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleUpdateProductName} disabled={savingName}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingName ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setEditableName(product.canonicalName);
                  setIsEditingName(false);
                }}>
                  <X className="w-4 h-4 mr-2" />
                  Vazgeç
                </Button>
              </div>
            )}
            <div className="flex items-center gap-6 mt-2 text-muted-foreground">
              <span>
                Durum:{' '}
                <Badge variant={product.status === 'Active' ? 'default' : 'secondary'}>
                  {product.status === 'Active' ? 'Aktif' : 'Pasif'}
                </Badge>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card className="col-span-3">
          <Collapsible open={isSourceItemsOpen} onOpenChange={setIsSourceItemsOpen}>
            <CardHeader className="pb-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left hover:bg-accent/40 rounded-md px-2 py-2 transition-colors"
                >
                  <div>
                    <CardTitle>Eşleştirilen Paraşüt Kayıtları</CardTitle>
                    <CardDescription>Bu ürün altında birleştirilen tüm Paraşüt kayıtları</CardDescription>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${isSourceItemsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent>
                <div className="rounded-xl border border-border p-3 mb-4 bg-gradient-to-r from-accent/20 via-background to-accent/10 w-full lg:w-1/2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Label htmlFor="new-parasut-id" className="text-sm">Yeni Paraşüt Kaydı Ekle</Label>
                    <Badge variant="outline" className="text-[11px]">Sadece ID</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="new-parasut-id"
                      value={newParasutId}
                      onChange={(e) => setNewParasutId(e.target.value)}
                      placeholder="Paraşüt ID (örn: 123456789)"
                      className="h-10 flex-1 rounded-full bg-background"
                    />
                    <Button
                      onClick={handleAddSourceItem}
                      disabled={addingSource}
                      className="h-10 rounded-full px-5 shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {addingSource ? 'Ekleniyor...' : 'Ekle'}
                    </Button>
                  </div>
                </div>

                {!product.sourceItems || product.sourceItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Bu ürüne bağlı kaynak kayıt bulunamadı.</div>
                ) : (
                  <div className="space-y-2">
                    {product.sourceItems.map((item) => (
                      <div key={item.parasutId} className="rounded border border-border p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Paraşüt ID: <code>{item.parasutId}</code> {item.code ? `| Kod: ${item.code}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="gap-1">
                            <Link2 className="w-3 h-3" />
                            {item.archived ? 'Arşiv' : 'Aktif'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card className="col-span-3">
          <Collapsible open={isSalesAssignmentsOpen} onOpenChange={setIsSalesAssignmentsOpen}>
            <CardHeader className="pb-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left hover:bg-accent/40 rounded-md px-2 py-2 transition-colors"
                >
                  <div>
                    <CardTitle>Son 30 Satış Faturası</CardTitle>
                    <CardDescription>Paraşüt faturaları ile ilişkilendirilmiş ürün LOT bilgisi listesi</CardDescription>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${isSalesAssignmentsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {salesAssignments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Henüz satıştan LOT ataması yok.</div>
                ) : (
                  <div className="space-y-2">
                    {salesAssignments.map((row) => (
                      <div
                        key={row._id}
                        className="rounded border border-border px-3 py-2 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm">
                            Fatura: <code>{row.invoiceNumber || row.invoiceId}</code>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tarih: {row.issueDate} | İşlenme: {new Date(row.createdAt).toLocaleString('tr-TR')}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div>
                            LOT: <code>{row.lotNumber}</code>
                          </div>
                          <div className="text-muted-foreground">
                            Depo: {row.warehouse || 'Ana Depo'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>LOT Takip Sistemi</CardTitle>
            <CardDescription>Ürüne bağlı LOT history kayıtlarını yönetin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-accent/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-primary" />
                <span className="text-sm">Yeni LOT Ekle</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="new-lot">LOT Numarası</Label>
                  <Input
                    id="new-lot"
                    value={newLotNumber}
                    onChange={(e) => setNewLotNumber(e.target.value)}
                    placeholder="LOT:2026/001"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="new-skt">SKT</Label>
                  <Input
                    id="new-skt"
                    type="month"
                    value={newSKT}
                    onChange={(e) => setNewSKT(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-card rounded border border-border mb-4">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Yeni LOT eklendiğinde aktif LOT olur, önceki aktif LOT otomatik pasife düşer.
                </span>
              </div>

              <Button onClick={handleAddLot} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Yeni LOT Oluştur
              </Button>
            </div>

            <div>
              <h4 className="mb-3">LOT Geçmişi</h4>
              <div className="space-y-2">
                {lots.length === 0 && (
                  <div className="text-sm text-muted-foreground">LOT kaydı bulunmuyor.</div>
                )}
                {lots.map((lot) => (
                  <div
                    key={lot._id}
                    onClick={() => onViewLot(lot._id, productId)}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={lot.status === 'Active' ? 'default' : 'secondary'}>
                        {lot.status === 'Active' ? 'Aktif' : 'Pasif'}
                      </Badge>
                      <div>
                        <div className="text-sm">
                          <code className="bg-muted px-2 py-1 rounded">{lot.lotNumber}</code>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Oluşturulma: {new Date(lot.createdAt).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">SKT: {formatSktMonth(lot.skt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
