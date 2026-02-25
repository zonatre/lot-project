import { useEffect, useState } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner@2.0.3';

interface LotHistoryViewProps {
  lotId: string;
  productId: string;
  onBack: () => void;
}

export function LotHistoryView({ lotId, productId, onBack }: LotHistoryViewProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const formatSktMonth = (value: string) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return value || '-';
    return `${match[2]}/${match[1]}`;
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}/lots/${lotId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'LOT detay verisi alınamadı');
      }
      setDetail(payload?.data || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [lotId, productId]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Yükleniyor...</div>;
  }

  if (!detail?.lot || !detail?.product) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2>LOT bulunamadı</h2>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  const lot = detail.lot;
  const product = detail.product;
  const lotOrders = Array.isArray(detail.assignments) ? detail.assignments : [];
  const totalSold = Number(detail?.summary?.totalSold || 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Ürüne Dön
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1>LOT İzlenebilirlik Görünümü</h1>
              <Badge variant={lot.status === 'Active' ? 'default' : 'secondary'}>
                {lot.status === 'Active' ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              Belirli parti numarası için detaylı satış geçmişi
            </p>
          </div>
        </div>
      </div>

      {/* LOT Information Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>LOT Numarası</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="text-lg bg-muted px-3 py-1 rounded">{lot.lotNumber}</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ürün Adı</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{product.canonicalName}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>SKT (Son Kullanma)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg">{formatSktMonth(lot.skt)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Oluşturulma Tarihi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {new Date(lot.createdAt).toLocaleDateString('tr-TR')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-2">{lotOrders.length}</div>
              <div className="text-sm text-muted-foreground">Toplam Satış Kaydı</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-2">{totalSold}</div>
              <div className="text-sm text-muted-foreground">Toplam Satılan Ünite</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-2">{lot.status === 'Active' ? 'Aktif' : 'Pasif'}</div>
              <div className="text-sm text-muted-foreground">LOT Durumu</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales History Table */}
      <Card>
        <CardHeader>
          <CardTitle>{lot.lotNumber} için Satış Geçmişi</CardTitle>
          <CardDescription>
            Bu belirli parti kullanılarak yerine getirilen siparişlerin tam listesi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lotOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <div className="text-muted-foreground">Bu LOT için kayıtlı satış yok</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sipariş Tarihi</TableHead>
                  <TableHead>Sipariş Numarası</TableHead>
                  <TableHead>Müşteri/Kanal</TableHead>
                  <TableHead>Satılan Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead>Depo</TableHead>
                  <TableHead>Fatura No</TableHead>
                  <TableHead>SKU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotOrders.map((order, index) => (
                  <TableRow
                    key={order.id}
                    className={index % 2 === 1 ? 'bg-muted/20' : ''}
                  >
                    <TableCell>
                      {new Date(order.issueDate).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{order.orderNumber}</code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{order.channel || 'Belirtilmemiş'}</div>
                        <Badge variant="outline" className="mt-1">
                          {order.channel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.unit || '-'}</TableCell>
                    <TableCell>{order.warehouse}</TableCell>
                    <TableCell>
                      <code className="text-sm">{order.invoiceNo}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {order.sku}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
