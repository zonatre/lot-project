import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
import { toast } from 'sonner';

type ExportRow = {
  id: string;
  issueDate: string;
  orderNumber: string;
  channel: string;
  productName: string;
  sku: string;
  skt: string | null;
  lotNumber: string;
  warehouse: string;
  quantity: number;
  invoiceNo: string;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR');
};

const formatSktMonth = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (match) return `${match[2]}/${match[1]}`;
  return formatDate(value);
};

const csvEscape = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

export function DataExportView() {
  const API_BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL as string) || 'http://localhost:5001';
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState(toIsoDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toIsoDate(today));
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 200;

  const fetchRows = async (targetPage: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        page: String(targetPage),
        page_size: String(pageSize),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/products/sales-lot-assignments/export?${params.toString()}`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Dışa aktarma verisi alınamadı');
      }

      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setTotalCount(Number(payload?.meta?.totalCount || 0));
      setTotalPages(Math.max(Number(payload?.meta?.totalPages || 1), 1));
    } catch (error) {
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
      const message = error instanceof Error ? error.message : 'Dışa aktarma verisi alınamadı';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(page);
  }, [page, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        all: 'true',
      });
      const response = await fetch(
        `${API_BASE_URL}/api/products/sales-lot-assignments/export?${params.toString()}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Export verisi hazırlanamadı');
      }

      const exportRows: ExportRow[] = Array.isArray(payload?.data) ? payload.data : [];
      const header = [
        'Sipariş Numarası',
        'Kanal',
        'Ürün Adı',
        'SKU',
        'SKT',
        'LOT Numarası',
        'Depo',
        'Miktar',
        'Sipariş Tarihi',
        'Fatura No',
      ];
      const body = exportRows.map((row) => [
        row.orderNumber,
        row.channel,
        row.productName,
        row.sku,
        row.skt ? formatSktMonth(row.skt) : 'Yok',
        row.lotNumber,
        row.warehouse,
        row.quantity,
        formatDate(row.issueDate),
        row.invoiceNo,
      ]);
      const csvContent = [header, ...body]
        .map((line) => line.map((cell) => csvEscape(cell)).join(','))
        .join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `satis_lot_export_${startDate}_${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Dışa aktarma başarıyla tamamlandı', {
        description: `${exportRows.length} kayıt indirildi`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dışa aktarma başarısız';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          <h1>Veri Dışa Aktarımı ve Raporlama</h1>
        </div>
      </div>

      {/* Export Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dışa Aktar</CardTitle>
          <CardDescription>Tarih aralığı seçiniz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 items-end">
            <div>
              <Label htmlFor="start-date">Başlangıç Tarihi</Label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="end-date">Bitiş Tarihi</Label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Button onClick={handleExport} className="w-full gap-2" size="lg" disabled={exporting || loading}>
                <Download className="w-4 h-4" />
                {exporting ? 'Hazırlanıyor...' : "Excel'e Aktar"}
              </Button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Seçilen aralıktaki kayıtlar:
              </div>
              <Badge variant="secondary" className="text-base px-3 py-1">
                {totalCount} sipariş
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Önizleme</CardTitle>
          <CardDescription>
            Dışa aktarılacak verilerin önizlemesi ({totalCount} kayıt)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Sipariş Numarası</TableHead>
                    <TableHead className="min-w-[120px]">Kanal</TableHead>
                    <TableHead className="min-w-[200px]">Ürün Adı</TableHead>
                    <TableHead className="min-w-[150px]">SKU</TableHead>
                    <TableHead className="min-w-[120px]">SKT</TableHead>
                    <TableHead className="min-w-[130px]">LOT Numarası</TableHead>
                    <TableHead className="min-w-[120px]">Depo</TableHead>
                    <TableHead className="min-w-[80px]">Miktar</TableHead>
                    <TableHead className="min-w-[120px]">Sipariş Tarihi</TableHead>
                    <TableHead className="min-w-[150px]">Fatura No</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        Kayıtlar yükleniyor...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <div>Seçilen tarih aralığında sipariş bulunamadı</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className={index % 2 === 1 ? 'bg-muted/20' : ''}
                      >
                        <TableCell>
                          <code className="text-xs">{row.orderNumber}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{row.productName}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {row.sku}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.skt ? formatSktMonth(row.skt) : 'Yok'}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {row.lotNumber}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">{row.warehouse}</TableCell>
                        <TableCell className="text-center">{row.quantity}</TableCell>
                        <TableCell className="text-sm">
                          {formatDate(row.issueDate)}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{row.invoiceNo}</code>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Sayfa {page} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || loading}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
