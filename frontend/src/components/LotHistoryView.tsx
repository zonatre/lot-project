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
import { mockLots, mockOrders, mockProducts } from '../lib/mockData';

interface LotHistoryViewProps {
  lotId: string;
  productId: string;
  onBack: () => void;
}

export function LotHistoryView({ lotId, productId, onBack }: LotHistoryViewProps) {
  const lot = mockLots[productId]?.find((l) => l.id === lotId);
  const product = mockProducts.find((p) => p.id === productId);
  const lotOrders = mockOrders.filter((o) => o.lotId === lotId);

  if (!lot || !product) {
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

  const totalSold = lotOrders.reduce((sum, order) => sum + order.quantity, 0);

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
            <div className="text-sm">{product.name}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>SKT (Son Kullanma)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg">{lot.skt}</div>
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
              <div className="text-sm text-muted-foreground">Toplam Sipariş</div>
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
              <div className="text-3xl mb-2">{lot.quantity}</div>
              <div className="text-sm text-muted-foreground">Kalan Stok</div>
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
                      {new Date(order.date).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{order.orderNumber}</code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{order.customerName || 'Belirtilmemiş'}</div>
                        <Badge variant="outline" className="mt-1">
                          {order.channel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{order.quantity}</TableCell>
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
